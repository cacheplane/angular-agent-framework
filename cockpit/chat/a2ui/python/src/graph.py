"""
A2UI Chat Graph

A LangGraph StateGraph that generates A2UI JSONL responses using an LLM.
The Angular frontend detects the ---a2ui_JSON--- prefix and renders
interactive surfaces from the streamed component definitions.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_a2ui_graph():
    """
    Single-node graph that invokes an LLM with the A2UI system prompt.
    The LLM generates A2UI JSONL that builds interactive surfaces.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "a2ui.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)

    return graph.compile()


graph = build_a2ui_graph()
