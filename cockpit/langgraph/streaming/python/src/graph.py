"""
LangGraph Streaming Graph

A minimal StateGraph that demonstrates real-time token streaming from an LLM.
Uses LangGraph's MessagesState for compatibility with the LangGraph SDK client.

The graph uses LangSmith for observability — every invocation is traced
automatically when LANGCHAIN_TRACING_V2=true is set.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_streaming_graph():
    """
    Constructs the LangGraph StateGraph for streaming.

    The graph has a single node that calls the LLM with the system prompt
    and user message. Uses MessagesState so the LangGraph SDK can send
    and receive messages directly.

    Returns:
        A compiled StateGraph ready for invocation
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        """
        Generate a streaming response from the LLM.

        Reads the system prompt and prepends it to the conversation,
        then invokes the LLM with streaming enabled.
        """
        system_prompt = (PROMPTS_DIR / "streaming.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)

    return graph.compile()


# The graph instance — referenced by langgraph.json
graph = build_streaming_graph()
