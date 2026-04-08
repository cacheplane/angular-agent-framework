"""
LangGraph Generative UI Graph

A StateGraph that instructs the LLM to return JSON-render Spec objects.
The Angular frontend auto-detects the JSON and renders it as Angular
components via the streaming generative UI pipeline.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_generative_ui_graph():
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

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
