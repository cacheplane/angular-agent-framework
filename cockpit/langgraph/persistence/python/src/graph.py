"""
LangGraph Persistence Graph

Demonstrates thread persistence with checkpointing. Each thread's
conversation history is saved and can be resumed by providing the
same thread_id. The LangGraph API server provides checkpointing
automatically — no custom checkpointer needed.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
def build_persistence_graph():
    """
    Constructs a StateGraph with checkpointing enabled.

    The LangGraph API server provides checkpointing automatically,
    allowing conversations to be resumed with the same thread_id.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        """Generate a response with conversation history preserved."""
        system_prompt = (PROMPTS_DIR / "persistence.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)
    return graph.compile()


# The graph instance — referenced by langgraph.json
graph = build_persistence_graph()
