"""
Chat Subagents Graph

A LangGraph StateGraph demonstrating an orchestrator pattern with
subagent delegation. The orchestrator routes tasks to specialized
subagent nodes that simulate domain-specific processing.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, AIMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_subagents_graph():
    """
    Constructs an orchestrator graph that delegates to specialized subagents.
    Demonstrates the subagent pattern with research, analysis, and summary nodes.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def orchestrator(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "subagents.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    async def research_agent(state: MessagesState) -> dict:
        last = state["messages"][-1].content
        response = AIMessage(
            content=f"[Research Agent] Gathered background information on: {last[:100]}"
        )
        return {"messages": [response]}

    async def analysis_agent(state: MessagesState) -> dict:
        last = state["messages"][-1].content
        response = AIMessage(
            content=f"[Analysis Agent] Analyzed findings and identified key patterns."
        )
        return {"messages": [response]}

    async def summary_agent(state: MessagesState) -> dict:
        messages = [SystemMessage(content="Summarize the conversation so far in a concise paragraph.")] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("orchestrator", orchestrator)
    graph.add_node("research_agent", research_agent)
    graph.add_node("analysis_agent", analysis_agent)
    graph.add_node("summary_agent", summary_agent)
    graph.set_entry_point("orchestrator")
    graph.add_edge("orchestrator", "research_agent")
    graph.add_edge("research_agent", "analysis_agent")
    graph.add_edge("analysis_agent", "summary_agent")
    graph.add_edge("summary_agent", END)

    return graph.compile()


graph = build_subagents_graph()
