"""
LangGraph Interrupts Graph

Demonstrates human-in-the-loop approval using LangGraph's interrupt()
function. The graph generates a response, then pauses for human approval
before delivering it. Resuming with null continues execution; resuming
with { resume: false } rejects the action.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.types import interrupt
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, AIMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_interrupts_graph():
    """
    Constructs a StateGraph with human-in-the-loop approval.

    The graph generates a response, then pauses at check_approval
    using interrupt(). The frontend displays the interrupt data and
    resumes execution when the user approves or rejects.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        """Generate a response using the LLM."""
        system_prompt = (PROMPTS_DIR / "interrupts.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    async def check_approval(state: MessagesState) -> dict:
        """Pause for human approval before proceeding."""
        last_msg = state["messages"][-1]
        interrupt(f"The assistant wants to respond: {last_msg.content[:100]}...")
        return state

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.add_node("check_approval", check_approval)
    graph.set_entry_point("generate")
    graph.add_edge("generate", "check_approval")
    graph.add_edge("check_approval", END)
    return graph.compile()


# The graph instance — referenced by langgraph.json
graph = build_interrupts_graph()
