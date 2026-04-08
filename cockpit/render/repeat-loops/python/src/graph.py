"""
Render Repeat Loops Graph

A LangGraph StateGraph that explains repeat/loop rendering with
RepeatScope for iterating arrays in render specs.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_repeat_loops_graph():
    """
    Constructs a graph that explains repeat rendering.

    The agent responds with guidance on using RepeatScope injection token,
    repeatItem, repeatIndex, and repeatBasePath for iterating arrays.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "repeat-loops.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)

    return graph.compile()


graph = build_repeat_loops_graph()
