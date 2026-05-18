"""Single-node agentic graph for the airline operations KPI dashboard.

Flow:
  START → agent ↔ tools → wrap_spec_into_ai → agent (loop) → emit_state → respond → END

`agent` is a single LLM call with all 5 tools bound (render_spec + 4 data
tools). After tools run, `wrap_spec_into_ai` post-processes — if the LLM
called render_spec, it replaces the parent AI message's content with the
spec JSON (in place via add_messages' id-match reducer) so the chat-lib's
content-classifier mounts <chat-generative-ui>. Then loops back to agent
until the LLM returns no tool_calls (cap _MAX_TOOL_ITERATIONS per turn).

Mirrors the emit_generated_surface pattern from examples/chat/python/src/graph.py,
adapted for a continuation loop instead of terminal dispatch.
"""

import json
from pathlib import Path
from typing import Literal

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode

from src.dashboard_tools import ALL_TOOLS as _DATA_TOOLS

_PROMPT = (Path(__file__).parent.parent / "prompts" / "dashboard.md").read_text()

_MAX_TOOL_ITERATIONS = 6


class DashboardState(MessagesState):
    """The dashboard spec lives in AI message content (the canonical
    chat-lib surface-delivery protocol), not on the state object."""
    pass


@tool
async def render_spec(elements: dict, root: str) -> str:
    """Render an interactive dashboard layout.

    Use this tool to author or update the dashboard layout. See the system
    prompt for the full component catalog and state binding conventions.

    Call this tool AT MOST ONCE per turn — only when the layout needs to
    be created (first turn) or restructured (follow-up structural change).
    Do NOT call it again to refresh data; the data tools handle that.

    Args:
        elements: Dict keyed by component id. Each value has `type`, optional
            `props`, and optional `children` (list of component ids).
        root: The id of the top-level component (must be a key in `elements`).

    Returns:
        The spec serialized as JSON. A post-process node (wrap_spec_into_ai)
        wraps this payload into the AI message content where the
        chat-lib's content-classifier picks it up.
    """
    return json.dumps({"elements": elements, "root": root})


_ALL_TOOLS = [render_spec, *_DATA_TOOLS]

_llm_with_tools = ChatOpenAI(
    model="gpt-5",
    temperature=0,
    streaming=True,
    reasoning_effort="minimal",
).bind_tools(_ALL_TOOLS)

_respond_llm = ChatOpenAI(model="gpt-5-mini", temperature=0, streaming=True)


async def agent(state: DashboardState) -> dict:
    """Single agentic node: LLM bound with all 5 tools."""
    messages = [SystemMessage(content=_PROMPT)] + state["messages"]
    response = await _llm_with_tools.ainvoke(messages)
    return {"messages": [response]}


def should_continue(state: DashboardState) -> Literal["tools", "finalize", "emit_state"]:
    """Loop while the agent emits tool_calls, up to _MAX_TOOL_ITERATIONS
    this turn. After the cap, route through `finalize` (strips orphan
    tool_calls from the last AI message) before emit_state — otherwise
    `respond`'s LLM call rejects the message history because the AI
    message had tool_calls without matching ToolMessages."""
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
        return "finalize"
    return "tools"


async def finalize(state: DashboardState) -> dict:
    """Strip tool_calls from the last AI message when the iteration cap
    is hit, so respond's LLM call doesn't fail with 'tool_calls without
    matching ToolMessage' errors. Replaces in place via add_messages
    id-match reducer."""
    last = state["messages"][-1]
    if not (isinstance(last, AIMessage) and last.tool_calls):
        return {}
    replacement_kwargs: dict = {
        "content": last.content or "(iteration cap reached)",
        "additional_kwargs": last.additional_kwargs or {},
        "response_metadata": last.response_metadata or {},
    }
    if getattr(last, "id", None):
        replacement_kwargs["id"] = last.id
    return {"messages": [AIMessage(**replacement_kwargs)]}


async def wrap_spec_into_ai(state: DashboardState) -> dict:
    """Post-process that wraps the most recent render_spec ToolMessage
    payload into the parent AI tool-call message's content (in place via
    LangGraph's add_messages reducer matching by id). The chat-lib's
    content-classifier then sees content starting with `{` and mounts
    <chat-generative-ui>.

    Idempotent: if the parent AI message already has non-empty content
    (already wrapped on a prior iteration), no-op. Also no-op if there
    is no render_spec ToolMessage to process.

    Mirrors emit_generated_surface from examples/chat/python/src/graph.py,
    adapted to loop back to `agent` instead of going to END.
    """
    msgs = state["messages"]

    render_tool_msg: ToolMessage | None = None
    parent_ai: AIMessage | None = None
    for m in reversed(msgs):
        if isinstance(m, ToolMessage) and m.name == "render_spec":
            render_tool_msg = m
            for prior in reversed(msgs):
                if isinstance(prior, AIMessage) and prior.tool_calls:
                    if any(tc.get("id") == render_tool_msg.tool_call_id for tc in prior.tool_calls):
                        parent_ai = prior
                        break
            break

    if render_tool_msg is None or parent_ai is None:
        return {}

    existing = parent_ai.content
    if isinstance(existing, str) and existing.strip():
        return {}

    payload = render_tool_msg.content if isinstance(render_tool_msg.content, str) else ""
    if not payload:
        return {}

    stripped = payload.strip()
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        stripped = "\n".join(line for line in lines if not line.startswith("```")).strip()

    out: list = []

    placeholder_kwargs: dict = {
        "content": "rendered",
        "tool_call_id": render_tool_msg.tool_call_id,
        "name": "render_spec",
    }
    if getattr(render_tool_msg, "id", None):
        placeholder_kwargs["id"] = render_tool_msg.id
    out.append(ToolMessage(**placeholder_kwargs))

    replacement_kwargs: dict = {
        "content": stripped,
        "tool_calls": parent_ai.tool_calls,
        "additional_kwargs": parent_ai.additional_kwargs or {},
        "response_metadata": parent_ai.response_metadata or {},
    }
    if getattr(parent_ai, "id", None):
        replacement_kwargs["id"] = parent_ai.id
    out.append(AIMessage(**replacement_kwargs))

    return {"messages": out}


async def emit_state(state: DashboardState) -> DashboardState:
    """Emit state_update custom events from data tool results. Walks
    state["messages"] in reverse, accumulates state patches from
    ToolMessages produced this turn (until the most recent human message
    — NOT ai, since the loop produces multiple AI messages per turn).

    Ignores tool names not in the known set (e.g. render_spec, whose
    payload was already wrapped into AI content by wrap_spec_into_ai
    and whose ToolMessage is now the "rendered" stub).
    """
    from langgraph.config import get_stream_writer

    tool_results: dict = {}
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
        elif msg.type == "human":
            break

    if tool_results:
        writer = get_stream_writer()
        writer({"name": "state_update", "data": tool_results})

    return state


async def respond(state: DashboardState) -> dict:
    """Generate a brief conversational summary of what just happened on
    this turn. ALWAYS runs (no early-exit)."""
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
_builder.add_node("wrap_spec_into_ai", wrap_spec_into_ai)
_builder.add_node("finalize", finalize)
_builder.add_node("emit_state", emit_state)
_builder.add_node("respond", respond)

_builder.set_entry_point("agent")
_builder.add_conditional_edges("agent", should_continue)
_builder.add_edge("tools", "wrap_spec_into_ai")
_builder.add_edge("wrap_spec_into_ai", "agent")
_builder.add_edge("finalize", "emit_state")
_builder.add_edge("emit_state", "respond")
_builder.add_edge("respond", END)

graph = _builder.compile()
