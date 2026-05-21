"""Chat Subagents Graph — orchestrator LLM with a single `task` tool that
dispatches to specialized aviation subagents (research/booking/itinerary).

Mirrors umbrella's c-subagents. Self-contained: aviation_tools + aviation_data
copied into this module.
"""

import os
from pathlib import Path
from typing import Literal

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode
from langgraph_sdk import get_client

from src.aviation_tools import (
    get_airport_info,
    find_routes,
    lookup_flight,
)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# ── generate_title node (inline; matches Pattern D from spec
#     2026-05-19-llm-generated-labels-design.md) ──────────────────────────────

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


_RESEARCH_PROMPT = """You are a Research Agent for trip planning. Your job is to gather
destination intel about airports the traveler is considering. Use the
get_airport_info tool to look up airport details (city, weather, terminals,
runways) for any airport codes mentioned in the task description.

Return a concise 2-4 sentence summary of what you found. If a code isn't
recognized, say so."""

_BOOKING_PROMPT = """You are a Booking Agent for trip planning. Your job is to find
flight options between the origin and destination airports in the task
description. Use find_routes to list available flights, and lookup_flight
if the user mentioned a specific flight number.

Return a concise summary listing 2-3 best flight options with airline,
flight number, times, and price-or-aircraft info. If no flights are found,
say so and suggest alternatives."""

_ITINERARY_PROMPT = """You are an Itinerary Agent for trip planning. Your job is to
synthesize a final trip plan from research + booking outputs you receive in
the task description.

Return a clean 3-5 sentence itinerary summarizing the recommended flight
choice, what to expect on arrival (weather), and any practical tips
(e.g., delays, terminal info). Be helpful and concise."""


async def _run_subagent(role: str, task_description: str, system_prompt: str, tools: list):
    """Run a single subagent: LLM bound with role-specific tools, single tool loop."""
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)
    if tools:
        llm = llm.bind_tools(tools)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=task_description),
    ]
    # Allow up to 3 tool-loop iterations
    for _ in range(3):
        response = await llm.ainvoke(messages)
        messages.append(response)
        tool_calls = getattr(response, "tool_calls", None)
        if not tool_calls:
            return response.content
        # Execute tool calls inline
        for tc in tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]
            target = next((t for t in tools if t.name == tool_name), None)
            if target is None:
                tool_result = f"Tool {tool_name} not available"
            else:
                tool_result = await target.ainvoke(tool_args)
            from langchain_core.messages import ToolMessage
            messages.append(ToolMessage(content=str(tool_result), tool_call_id=tc["id"]))
    return response.content


@tool
async def task(role: Literal["research", "booking", "itinerary"], task_description: str) -> str:
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
    """
    if role == "research":
        return await _run_subagent(role, task_description, _RESEARCH_PROMPT, [get_airport_info])
    if role == "booking":
        return await _run_subagent(role, task_description, _BOOKING_PROMPT, [find_routes, lookup_flight])
    if role == "itinerary":
        return await _run_subagent(role, task_description, _ITINERARY_PROMPT, [])
    return f"Unknown role: {role}"


def build_subagents_graph():
    """Orchestrator LLM with a single `task` tool that dispatches to subagent functions."""
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
        return END

    graph = StateGraph(MessagesState)
    graph.add_node("orchestrator", orchestrator)
    graph.add_node("tools", ToolNode([task]))
    graph.add_node("generate_title", generate_title)
    graph.set_entry_point("orchestrator")
    graph.add_conditional_edges("orchestrator", should_continue, {"tools": "tools", END: "generate_title"})
    graph.add_edge("tools", "orchestrator")
    graph.add_edge("generate_title", END)
    return graph.compile()


graph = build_subagents_graph()
