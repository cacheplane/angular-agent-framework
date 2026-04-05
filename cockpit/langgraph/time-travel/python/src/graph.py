"""
LangGraph Time Travel Graph

Demonstrates checkpoint-based time travel. Each message exchange is saved as
a checkpoint snapshot. The client can read checkpoint history via the LangGraph
SDK's thread history API and branch the conversation from any past state by
calling `setBranch(checkpointId)` before the next submit.

The LangGraph API server provides checkpointing automatically.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_time_travel_graph():
    """
    Constructs a StateGraph with checkpointing enabled for time travel.

    The LangGraph API checkpointer saves a snapshot after each node execution,
    producing a history of ThreadState objects that the client can replay or
    branch from using checkpoint IDs.
    """
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        """Generate a response, checkpointed for time travel."""
        system_prompt = (PROMPTS_DIR / "time-travel.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)
    return graph.compile()


# The graph instance — referenced by langgraph.json
graph = build_time_travel_graph()
