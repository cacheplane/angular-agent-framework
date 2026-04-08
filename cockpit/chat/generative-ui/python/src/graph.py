"""
Chat Generative UI Graph

A LangGraph StateGraph that generates responses containing JSON render
spec objects. The Angular frontend detects these specs in chat messages
and renders them as live UI components using ChatGenerativeUiComponent.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_generative_ui_graph():
    """
    Constructs an agent that includes JSON render specs in its responses,
    enabling dynamic UI generation within chat messages.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "generative-ui.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)

    return graph.compile()


graph = build_generative_ui_graph()
