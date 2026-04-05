"""
LangGraph Deployment Runtime Graph

Standard chat graph demonstrating production deployment patterns.
The graph itself is intentionally simple — the focus of this example
is the deployment configuration, not a unique graph pattern.

Deploy with:
    langgraph deploy

Or run locally for development:
    langgraph dev
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_deployment_runtime_graph():
    """
    Constructs a standard chat StateGraph suitable for production deployment.

    This graph is designed to be deployed via `langgraph deploy` to
    LangGraph Cloud. The assistantId in the Angular component must match
    the graph key in langgraph.json.
    """
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        """Generate a response using the full message history."""
        system_prompt = (PROMPTS_DIR / "deployment-runtime.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)
    return graph.compile()


# The graph instance — referenced by langgraph.json
graph = build_deployment_runtime_graph()
