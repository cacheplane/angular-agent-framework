"""
Chat Debug Graph

A multi-step agent (generate -> process -> summarize) that produces
interesting debug data for inspecting with the ChatDebugComponent.
Multiple nodes create rich state transitions for the debug panel.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, AIMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_debug_graph():
    """
    Constructs a multi-step graph with generate, process, and summarize
    nodes to produce rich state transitions for debug inspection.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "debug.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    async def process(state: MessagesState) -> dict:
        last = state["messages"][-1].content
        processed = AIMessage(
            content=f"[Processing] Analyzed {len(last)} characters. "
            f"Found {last.count(' ') + 1} words. Processing complete."
        )
        return {"messages": [processed]}

    async def summarize(state: MessagesState) -> dict:
        messages = [
            SystemMessage(content="Provide a brief one-sentence summary of the conversation so far.")
        ] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.add_node("process", process)
    graph.add_node("summarize", summarize)
    graph.set_entry_point("generate")
    graph.add_edge("generate", "process")
    graph.add_edge("process", "summarize")
    graph.add_edge("summarize", END)

    return graph.compile()


graph = build_debug_graph()
