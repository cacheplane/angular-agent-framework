"""
Chat example graphs — consolidated into the streaming deployment.

Most chat cockpit examples (messages, input, debug, etc.) use the same simple
architecture: a single-node StateGraph that prepends a system prompt and calls
the LLM. They differ only in the prompt file.

The c_tool_calls and c_subagents graphs are richer: c_tool_calls binds real
aviation tools (so the chat-tool-calls UI shows tool-call streaming);
c_subagents uses a `task` tool the orchestrator calls to dispatch to
specialized subagent functions (so the chat-subagents UI shows subagent cards).
"""

from pathlib import Path
from typing import Literal
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool

from src.aviation_tools import (
    ALL_TOOLS as AVIATION_TOOLS,
    get_airport_info,
    find_routes,
    lookup_flight,
)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
MODEL = "gpt-5-mini"


def _build_prompt_graph(prompt_file: str):
    """Factory: simple single-node graph that prepends a system prompt and calls the LLM."""
    llm = ChatOpenAI(model=MODEL, streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / prompt_file).read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)
    return graph.compile()


def _build_tool_calls_graph():
    """Canonical agent ↔ ToolNode loop with aviation tools bound."""
    llm = ChatOpenAI(model=MODEL, streaming=True).bind_tools(AVIATION_TOOLS)

    async def agent(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "tool-calls.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    def should_continue(state: MessagesState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(MessagesState)
    graph.add_node("agent", agent)
    graph.add_node("tools", ToolNode(AVIATION_TOOLS))
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")
    return graph.compile()


# ── c-subagents internals ────────────────────────────────────────────────────

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
    llm = ChatOpenAI(model=MODEL, streaming=True)
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


def _build_subagents_graph():
    """Orchestrator LLM with a single `task` tool that dispatches to subagent functions."""
    llm = ChatOpenAI(model=MODEL, streaming=True).bind_tools([task])

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
    graph.set_entry_point("orchestrator")
    graph.add_conditional_edges("orchestrator", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "orchestrator")
    return graph.compile()


# ── Graph registration ───────────────────────────────────────────────────────

c_messages = _build_prompt_graph("messages.md")
c_input = _build_prompt_graph("input.md")
c_debug = _build_prompt_graph("debug.md")
c_interrupts = _build_prompt_graph("interrupts.md")
c_theming = _build_prompt_graph("theming.md")
c_threads = _build_prompt_graph("threads.md")
c_timeline = _build_prompt_graph("timeline.md")

c_tool_calls = _build_tool_calls_graph()
c_subagents = _build_subagents_graph()

from src.dashboard_graph import graph as generative_ui  # noqa: E402,F401
