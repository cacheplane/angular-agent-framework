"""Chat Tool-Calls Graph — canonical agent ↔ ToolNode loop with aviation tools.

Mirrors umbrella's c-tool-calls. Self-contained: aviation_tools + aviation_data
copied into this module.
"""

from pathlib import Path

from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode

from src.aviation_tools import ALL_TOOLS as AVIATION_TOOLS

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_tool_calls_graph():
    """Canonical agent ↔ ToolNode loop with aviation tools bound."""
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True).bind_tools(AVIATION_TOOLS)

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


graph = build_tool_calls_graph()
