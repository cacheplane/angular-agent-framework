"""
LangGraph Subgraphs Graph

Demonstrates nested agent delegation using subgraphs. A parent orchestrator
delegates research tasks to a specialized child subgraph. The parent graph
controls the overall flow while the research subgraph handles deep-dive
information gathering independently.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_subgraphs_graph():
    """
    Constructs a parent graph that delegates to a child research subgraph.

    The parent orchestrator decides when to delegate to the research subgraph.
    The research subgraph runs independently and returns its results to the parent.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    # ── Child: research subgraph ──────────────────────────────────────────────

    async def research_node(state: MessagesState) -> dict:
        """Specialized research agent — performs deep-dive information gathering."""
        messages = state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    research_graph = StateGraph(MessagesState)
    research_graph.add_node("research", research_node)
    research_graph.set_entry_point("research")
    research_graph.add_edge("research", END)
    compiled_research = research_graph.compile()

    # ── Parent: orchestrator graph ────────────────────────────────────────────

    async def orchestrate_node(state: MessagesState) -> dict:
        """
        Orchestrator node — reviews the request and prepares context
        before delegating to the research subgraph.
        """
        system_prompt = (PROMPTS_DIR / "subgraphs.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    parent_graph = StateGraph(MessagesState)
    parent_graph.add_node("orchestrate", orchestrate_node)
    parent_graph.add_node("research", compiled_research)
    parent_graph.set_entry_point("orchestrate")
    parent_graph.add_edge("orchestrate", "research")
    parent_graph.add_edge("research", END)
    return parent_graph.compile()


# The graph instance — referenced by langgraph.json
graph = build_subgraphs_graph()
