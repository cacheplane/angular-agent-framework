"""Chat Interrupts Graph — agent ↔ ToolNode loop with book_flight (interrupt).

Self-contained: aviation_tools + aviation_data copied into this module.
The book_flight tool raises interrupt({...}) before completing the booking,
so the chat-interrupt-panel renders and the user can Accept or Ignore.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage
from langchain_core.tools import tool

from src.aviation_tools import (
    get_airport_info,
    find_routes,
    lookup_flight,
)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
MODEL = "gpt-5-mini"


@tool
async def book_flight(flight_number: str) -> str:
    """Book a flight by flight number. Pauses for human confirmation.

    Use this tool when the user explicitly asks to book a specific flight.
    The tool raises a LangGraph interrupt so the UI can render an
    approval card; on resume, it returns a confirmation or cancellation
    message.

    Args:
        flight_number: Flight number like 'AA123' or 'UA456'.

    Returns:
        A short booking confirmation or cancellation message.
    """
    flight = await lookup_flight.ainvoke({"flight_number": flight_number})
    if "error" in flight:
        return f"Cannot book {flight_number}: {flight['error']}."

    summary = (
        f"Book {flight['airline']} {flight['flight_number']} from "
        f"{flight['from']} to {flight['to']} "
        f"(departs {flight['depart_local']}, {flight['aircraft']})?"
    )
    response = interrupt({
        "type": "approval_request",
        "summary": summary,
        "flight": flight,
    })

    decision = str(response).strip().lower()
    if decision.startswith("confirm"):
        return (
            f"Booked {flight['airline']} {flight['flight_number']} from "
            f"{flight['from']} to {flight['to']} "
            f"(departs {flight['depart_local']})."
        )
    return "Booking cancelled."


def build_interrupts_graph():
    """Agent ↔ ToolNode loop with aviation read tools + book_flight (interrupt)."""
    tools = [book_flight, find_routes, lookup_flight, get_airport_info]
    llm = ChatOpenAI(model=MODEL, streaming=True).bind_tools(tools)

    async def agent(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "interrupts.md").read_text()
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
    graph.add_node("tools", ToolNode(tools))
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")
    return graph.compile()


graph = build_interrupts_graph()
