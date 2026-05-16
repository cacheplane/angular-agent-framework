"""Multi-node LangGraph graph for the airline operations KPI dashboard.

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

_llm = ChatOpenAI(model="gpt-5-mini", temperature=0, streaming=True)

# Dedicated planner: full gpt-5 with minimal reasoning effort.
# gpt-5-mini at default reasoning ignores the "EXACTLY ONE tool" directive
# in plan_tools and reflexively calls all four data tools on every
# follow-up — verified in chrome MCP after PR #363 tightened the prompt
# but the model still over-called. Bumping the planner to gpt-5 sharpens
# instruction-following, and reasoning_effort='minimal' suppresses the
# "let me be thorough" deliberation that drives the fan-out.
_planner_llm = ChatOpenAI(
    model="gpt-5",
    temperature=0,
    streaming=True,
    reasoning_effort="minimal",
)
_llm_with_tools = _planner_llm.bind_tools(ALL_TOOLS)


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
    """On follow-up turns, pick the MINIMAL set of tools — usually one."""
    context = (
        f"The current dashboard spec is:\n{state['dashboard_spec']}\n\n"
        "Classify the user's message and act ONCE — do not refetch everything.\n"
        "\n"
        "1) FILTER / SCOPE existing data (e.g. 'filter to cancelled flights only',\n"
        "   'show last 6 months', 'limit to enterprise', 'sort by date',\n"
        "   'only show delayed', 'top 3'): call EXACTLY ONE tool — the one that\n"
        "   backs the affected component — with the new parameters. Do NOT call\n"
        "   the other tools. Do NOT regenerate the spec.\n"
        "\n"
        "2) STRUCTURAL change (e.g. 'add a card for X', 'remove the table',\n"
        "   'split this into two columns'): regenerate the spec, then call only\n"
        "   the tools needed to populate NEW components.\n"
        "\n"
        "3) QUESTION about existing data (e.g. 'why', 'how', 'explain',\n"
        "   'what does this mean'): respond conversationally in plain prose.\n"
        "   Call NO tools. Output NO JSON.\n"
        "\n"
        "If none of these fit, call only the smallest set of tools you need.\n"
        "Calling all four tools is reserved for an explicit 'refresh' /\n"
        "'reload' / 'update everything' request."
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
    """Emit state_update custom events from tool results.

    Uses LangGraph 1.x's `get_stream_writer()` — `adispatch_custom_event`
    no longer flows into the `custom` stream channel. The chat-lib bridge
    parses the payload as `{name: 'state_update', data: <patches>}`.
    """
    from langgraph.config import get_stream_writer

    tool_results = {}
    for msg in reversed(state["messages"]):
        if msg.type == "tool":
            try:
                data = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
            except (json.JSONDecodeError, TypeError):
                continue

            if msg.name == "query_airline_kpis":
                for section_key, section_val in data.items():
                    if isinstance(section_val, dict):
                        for k, v in section_val.items():
                            tool_results[f"/{section_key}/{k}"] = v
            elif msg.name == "query_on_time_trend":
                tool_results["/on_time_trend"] = data
            elif msg.name == "query_flights_by_airline":
                tool_results["/flights_by_airline"] = data
            elif msg.name == "query_recent_disruptions":
                tool_results["/recent_disruptions"] = data
        elif msg.type == "ai":
            break

    if tool_results:
        # The chat-lib bridge (stream-manager.bridge.ts handles the 'custom'
        # case) parses `eventData['name']` for routing and `eventData['data']`
        # for payload; chat.component.ts then forwards data to
        # signal-state-store.update() which expects flat Record<jsonPointer, value>.
        writer = get_stream_writer()
        writer({"name": "state_update", "data": tool_results})

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
