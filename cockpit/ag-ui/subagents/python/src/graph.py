"""AG-UI Subagents Graph — orchestrator LLM with a single `task` tool that
dispatches to specialized subagents (research/booking/itinerary), surfacing
each dispatch as a native AG-UI subagent card.

Mirrors cockpit/chat/subagents' orchestrator + `task` tool + `_run_subagent`
structure, but each dispatch emits `subagent_activity` CUSTOM events (like the
examples/ag-ui `research` tool): `started` before the run, `message` per
streamed token (via SubagentStreamHandler), `finished` after. The backend's
ActivityEmittingAgent converts those CUSTOM events into native AG-UI ACTIVITY
events, which the @threadplane/ag-ui reducer projects onto agent.subagents().

Self-contained: no imports from examples/ or other cockpit capabilities.
"""

import os
from pathlib import Path
from typing import Annotated, Literal

from langchain_core.callbacks import adispatch_custom_event
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool, InjectedToolCallId
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode
from langgraph_sdk import get_client

from src.streaming.subagent_stream_handler import SubagentStreamHandler

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# ── generate_title node (background thread-title generation) ────────────────

_TITLE_PROMPT = (
    "In 3-5 words, summarize what the user is asking about. "
    "Output ONLY the title — no quotes, no period, no prefix."
)
_TITLE_MODEL = "gpt-5-mini"


async def generate_title(state: MessagesState, config) -> dict:
    """Background title generation: on the first turn, summarize the user's
    intent into 3-5 words and persist to LangGraph thread metadata.

    Idempotent — skips when metadata.title already exists. Errors are
    swallowed because the title is a UX nicety, never a blocker.
    """
    thread_id = (config.get("configurable") or {}).get("thread_id")
    if not thread_id:
        return {}
    sdk_url = os.environ.get("LANGGRAPH_API_URL")
    try:
        client = get_client(url=sdk_url)
        thread = await client.threads.get(thread_id)
        if (thread.get("metadata") or {}).get("title"):
            return {}
        first_user = next(
            (m for m in state["messages"] if getattr(m, "type", None) == "human"),
            None,
        )
        if not first_user or not isinstance(first_user.content, str):
            return {}
        if first_user.content.lstrip().startswith("{"):
            return {}
        llm = ChatOpenAI(model=_TITLE_MODEL, temperature=0)
        response = await llm.ainvoke([
            SystemMessage(content=_TITLE_PROMPT),
            HumanMessage(content=first_user.content),
        ])
        title = (response.content or "").strip().strip('"').strip("'")[:80]
        if title:
            await client.threads.update(thread_id, metadata={"title": title})
    except Exception as e:  # noqa: BLE001 — title is a UX nicety; never block
        print(
            f"[generate_title] failed for thread {thread_id}: "
            f"{type(e).__name__}: {e}",
            flush=True,
        )
    return {}


# ── Subagent role prompts ───────────────────────────────────────────────────

_RESEARCH_PROMPT = """You are a Research Agent for trip planning. Your job is to
gather destination intel about the airports the traveler is considering: city,
typical weather/conditions, terminals, and any practical travel notes for the
route described in the task.

Return a concise 2-4 sentence summary of what you found."""

_BOOKING_PROMPT = """You are a Booking Agent for trip planning. Your job is to
suggest flight options between the origin and destination airports described in
the task.

Return a concise summary listing 2-3 plausible flight options with airline,
approximate times, and a rough price estimate. Be helpful and concise."""

_ITINERARY_PROMPT = """You are an Itinerary Agent for trip planning. Your job is
to synthesize a final trip plan from the research + booking outputs you receive
in the task description.

Return a clean 3-5 sentence itinerary summarizing the recommended flight choice,
what to expect on arrival (weather), and any practical tips. Be helpful and
concise."""


async def _run_subagent(
    role: str,
    task_description: str,
    system_prompt: str,
    tool_call_id: str,
) -> str:
    """Run a single subagent LLM, streaming its tokens through
    SubagentStreamHandler so they surface as `subagent_activity` `message`
    events keyed by the parent tool_call_id."""
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=task_description),
    ]
    response = await llm.ainvoke(
        messages,
        config={"callbacks": [SubagentStreamHandler(tool_call_id)]},
    )
    content = response.content
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [
            b.get("text", "")
            for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        ]
        return "\n".join(parts)
    return ""


@tool
async def task(
    role: Literal["research", "booking", "itinerary"],
    task_description: str,
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> str:
    """Delegate a subtask to a specialized subagent.

    Roles:
      - research: gathers destination intel (airports, weather, conditions)
      - booking: finds flight options between origin and destination
      - itinerary: synthesizes a final trip plan combining research + bookings

    Args:
        role: One of "research", "booking", "itinerary".
        task_description: Plain-English description of what the subagent
            should do (e.g., "Gather info on LAX and JFK airports", or
            "Find morning flights from LAX to JFK").

    Returns:
        The subagent's final answer as a string.

    The subagent run is surfaced to the UI as a native AG-UI ACTIVITY
    (activityType "subagent"): started → message-per-token → finished, keyed
    by this tool's own call id.
    """

    async def _emit(payload: dict) -> None:
        try:
            await adispatch_custom_event(
                "subagent_activity", {"subagent_id": tool_call_id, **payload}
            )
        except Exception:
            pass

    prompts = {
        "research": _RESEARCH_PROMPT,
        "booking": _BOOKING_PROMPT,
        "itinerary": _ITINERARY_PROMPT,
    }
    system_prompt = prompts.get(role)
    if system_prompt is None:
        return f"Unknown role: {role}"

    await _emit({"phase": "started", "name": role})
    result = await _run_subagent(role, task_description, system_prompt, tool_call_id)
    await _emit({"phase": "finished", "status": "complete"})
    return result


def build_subagents_graph():
    """Orchestrator LLM with a single `task` tool that dispatches subagents."""
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True).bind_tools([task])

    async def orchestrator(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "subagents.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    def should_continue(state: MessagesState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return "generate_title"

    graph = StateGraph(MessagesState)
    graph.add_node("orchestrator", orchestrator)
    graph.add_node("tools", ToolNode([task]))
    graph.add_node("generate_title", generate_title)
    graph.set_entry_point("orchestrator")
    graph.add_conditional_edges(
        "orchestrator",
        should_continue,
        {"tools": "tools", "generate_title": "generate_title"},
    )
    graph.add_edge("tools", "orchestrator")
    graph.add_edge("generate_title", END)
    return graph.compile(checkpointer=MemorySaver())


# The graph instance — referenced by server.py
graph = build_subagents_graph()
