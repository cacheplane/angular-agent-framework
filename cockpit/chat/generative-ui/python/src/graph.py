"""Single-node agentic graph for the airline operations KPI dashboard.

Flow:
  START → agent ↔ tools → emit_state → respond → END

`agent` is a single LLM call with all 5 tools bound (render_spec + 4 data
tools). Loops via `should_continue` until the LLM returns no tool_calls or
the iteration cap is hit. Replaces the prior 6-node split graph (PR #428's
generate_shell / populate_initial_data / plan_tools / router scaffolding)
with a single coherent reasoning loop, as described in the agentic-loop
design spec (2026-05-18).
"""

import json
from pathlib import Path
from typing import Annotated, Literal

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import InjectedToolCallId, tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode
from langgraph.types import Command

from src.dashboard_tools import ALL_TOOLS as _DATA_TOOLS

_PROMPT = (Path(__file__).parent.parent / "prompts" / "dashboard.md").read_text()

_MAX_TOOL_ITERATIONS = 8


class DashboardState(MessagesState):
    """Extended state that persists the dashboard spec across turns."""
    dashboard_spec: str | None


@tool
def render_spec(spec: dict, tool_call_id: Annotated[str, InjectedToolCallId]) -> Command:
    """Render an interactive dashboard layout from a JSON spec.

    Use this tool to author or update the dashboard layout. The spec is a
    JSON object with `elements` (a dict keyed by component id) and `root`
    (the id of the top-level component). See the system prompt for the full
    schema and component catalog.

    Call this tool FIRST on any turn where the layout needs to be created
    or restructured. After calling render_spec, call the data tools needed
    to populate the components you authored.

    Args:
        spec: The dashboard JSON render spec.

    Returns:
        Command updating dashboard_spec in state and emitting a ToolMessage.
    """
    spec_text = json.dumps(spec)
    return Command(
        update={
            "dashboard_spec": spec_text,
            "messages": [
                ToolMessage(
                    content="Spec accepted.",
                    tool_call_id=tool_call_id,
                    name="render_spec",
                )
            ],
        }
    )


_ALL_TOOLS = [render_spec, *_DATA_TOOLS]

_llm_with_tools = ChatOpenAI(
    model="gpt-5",
    temperature=0,
    streaming=True,
    reasoning_effort="minimal",
).bind_tools(_ALL_TOOLS)

_respond_llm = ChatOpenAI(model="gpt-5-mini", temperature=0, streaming=True)


async def agent(state: DashboardState) -> dict:
    """Single agentic node: LLM bound with all 5 tools, driven by the
    dashboard.md system prompt. Loops via the `tools` node + should_continue
    until the LLM returns no tool_calls."""
    messages = [SystemMessage(content=_PROMPT)] + state["messages"]
    response = await _llm_with_tools.ainvoke(messages)
    return {"messages": [response]}


def should_continue(state: DashboardState) -> Literal["tools", "emit_state"]:
    """Loop while the agent emits tool_calls, up to _MAX_TOOL_ITERATIONS this
    turn. After the cap, force exit to emit_state — partial dashboard is
    better than an infinite loop."""
    last = state["messages"][-1]
    if not (hasattr(last, "tool_calls") and last.tool_calls):
        return "emit_state"

    iter_count = 0
    for msg in reversed(state["messages"]):
        if msg.type == "human":
            break
        if msg.type == "ai" and getattr(msg, "tool_calls", None):
            iter_count += 1
    if iter_count >= _MAX_TOOL_ITERATIONS:
        return "emit_state"
    return "tools"


async def emit_state(state: DashboardState) -> DashboardState:
    """Emit state_update custom events from tool results.

    Uses LangGraph 1.x's `get_stream_writer()` — `adispatch_custom_event`
    no longer flows into the `custom` stream channel. The chat-lib bridge
    parses the payload as `{name: 'state_update', data: <patches>}`.

    Walks `state["messages"]` in reverse, accumulates state patches from
    ToolMessages produced this turn (until the most recent ai turn boundary
    or human message). Tool names not in the known set are ignored
    (e.g. render_spec, which writes to dashboard_spec via Command instead).
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
            # Tool results from this turn are after the most recent prior ai
            # turn — but since the agent loop produces multiple ai messages
            # per turn (one per tool-call round), don't break on ai. Break
            # on human instead.
            continue
        elif msg.type == "human":
            break

    if tool_results:
        writer = get_stream_writer()
        writer({"name": "state_update", "data": tool_results})

    return state


async def respond(state: DashboardState) -> dict:
    """Generate a brief conversational summary of what just happened on this
    turn. ALWAYS runs (no early-exit) so the user-visible summary is always
    authored by this node, never inherited from the agent's tool-calling
    chatter."""
    messages = [
        SystemMessage(content=(
            "Provide a brief (1-2 sentence) conversational summary of what "
            "you just did this turn. If you generated a dashboard, say so. "
            "If you filtered data, say what you filtered. "
            "Do NOT output JSON. Do NOT ask follow-up questions."
        ))
    ] + state["messages"]
    response = await _respond_llm.ainvoke(messages)
    return {"messages": [response]}


_builder = StateGraph(DashboardState)
_builder.add_node("agent", agent)
_builder.add_node("tools", ToolNode(_ALL_TOOLS))
_builder.add_node("emit_state", emit_state)
_builder.add_node("respond", respond)

_builder.set_entry_point("agent")
_builder.add_conditional_edges("agent", should_continue)
_builder.add_edge("tools", "agent")
_builder.add_edge("emit_state", "respond")
_builder.add_edge("respond", END)

graph = _builder.compile()
