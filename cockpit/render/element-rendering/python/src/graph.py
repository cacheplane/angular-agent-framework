"""
Render Element Rendering Graph

A LangGraph StateGraph that explains recursive RenderElementComponent usage.
The Angular frontend uses RenderElementComponent to recursively render
nested element trees with visibility conditions.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_element_rendering_graph():
    """
    Constructs a graph that explains recursive element rendering.

    The agent responds with guidance on using RenderElementComponent to
    recursively render nested element trees with visibility conditions.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "element-rendering.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)

    return graph.compile()


graph = build_element_rendering_graph()
