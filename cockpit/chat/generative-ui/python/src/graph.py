"""Multi-node LangGraph graph for the SaaS metrics dashboard.

Flow:
  router → generate_shell (first turn) or plan_tools (follow-up)
  → call_tools → emit_state → respond
"""

import json
from pathlib import Path
from typing import Literal

from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode
from langgraph.types import Command

from src.dashboard_tools import ALL_TOOLS

_PROMPT = (Path(__file__).parent.parent / "prompts" / "dashboard.md").read_text()

_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, streaming=True)
_llm_with_tools = _llm.bind_tools(ALL_TOOLS)


class DashboardState(MessagesState):
    """Extended state that persists the dashboard spec across turns."""
    dashboard_spec: str | None


def router(state: DashboardState) -> Command[Literal["generate_shell", "plan_tools"]]:
    """Route based on whether a dashboard spec already exists."""
    if state.get("dashboard_spec") is None:
        return Command(goto="generate_shell")
    return Command(goto="plan_tools")


async def generate_shell(state: DashboardState) -> DashboardState:
    """Generate the dashboard shell spec on first turn."""
    messages = [SystemMessage(content=_PROMPT)] + state["messages"]
    response = await _llm.ainvoke(messages)
    spec_text = response.content if isinstance(response.content, str) else ""
    return {
        "messages": [response],
        "dashboard_spec": spec_text,
    }


async def plan_tools(state: DashboardState) -> DashboardState:
    """On follow-up turns, let the LLM decide which tools to call."""
    context = (
        f"The current dashboard spec is:\n{state['dashboard_spec']}\n\n"
        "Based on the user's message, decide which tools to call to update the dashboard data. "
        "If the user asks a question about the data that doesn't need fresh data, just respond conversationally."
    )
    messages = [SystemMessage(content=_PROMPT + "\n\n" + context)] + state["messages"]
    response = await _llm_with_tools.ainvoke(messages)
    return {"messages": [response]}


def should_call_tools(state: DashboardState) -> Literal["call_tools", "respond"]:
    """Check if the last message has tool calls."""
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "call_tools"
    return "respond"


async def emit_state(state: DashboardState) -> DashboardState:
    """Emit state_update custom events from tool results."""
    from langchain_core.callbacks import adispatch_custom_event

    tool_results = {}
    for msg in reversed(state["messages"]):
        if msg.type == "tool":
            try:
                data = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
            except (json.JSONDecodeError, TypeError):
                continue

            if msg.name == "query_mrr":
                for section_key, section_val in data.items():
                    if isinstance(section_val, dict):
                        for k, v in section_val.items():
                            tool_results[f"/{section_key}/{k}"] = v
            elif msg.name == "query_subscribers_by_plan":
                tool_results["/subscribers_by_plan"] = data
            elif msg.name == "query_mrr_trend":
                tool_results["/mrr_trend"] = data
            elif msg.name == "query_churned_accounts":
                tool_results["/churned_accounts"] = data
        elif msg.type == "ai":
            break

    if tool_results:
        await adispatch_custom_event("state_update", {"updates": tool_results})

    return state


async def respond(state: DashboardState) -> DashboardState:
    """Generate a brief conversational summary after tools have run."""
    last = state["messages"][-1]
    if last.type == "ai" and not (hasattr(last, "tool_calls") and last.tool_calls):
        return state

    messages = [
        SystemMessage(content="Provide a brief (1-2 sentence) conversational summary of what you just did. Do NOT output JSON.")
    ] + state["messages"]
    response = await _llm.ainvoke(messages)
    return {"messages": [response]}


_builder = StateGraph(DashboardState)
_builder.add_node("router", router)
_builder.add_node("generate_shell", generate_shell)
_builder.add_node("plan_tools", plan_tools)
_builder.add_node("call_tools", ToolNode(ALL_TOOLS))
_builder.add_node("emit_state", emit_state)
_builder.add_node("respond", respond)

_builder.set_entry_point("router")

# After shell generation, go to plan_tools to call all data tools
_builder.add_edge("generate_shell", "plan_tools")

# After plan_tools, check if we need to call tools
_builder.add_conditional_edges("plan_tools", should_call_tools)

# Tool calling flow
_builder.add_edge("call_tools", "emit_state")
_builder.add_edge("emit_state", "respond")
_builder.add_edge("respond", END)

graph = _builder.compile()
