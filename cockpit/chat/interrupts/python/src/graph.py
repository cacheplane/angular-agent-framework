"""
Chat Interrupts Graph

A LangGraph StateGraph that demonstrates human-in-the-loop approval gates
using the interrupt() primitive. The graph generates a response, then pauses
for user approval before proceeding.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.types import interrupt
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, AIMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_interrupts_graph():
    """
    Constructs a graph with an approval gate that interrupts execution
    and waits for human approval before continuing.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "interrupts.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    async def approval_gate(state: MessagesState) -> dict:
        last_message = state["messages"][-1]
        result = interrupt({
            "type": "approval",
            "message": "The assistant wants to proceed. Do you approve?",
            "draft": last_message.content,
        })
        return {"messages": [AIMessage(content=f"Approved. Proceeding with: {last_message.content}")]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.add_node("approval_gate", approval_gate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", "approval_gate")
    graph.add_edge("approval_gate", END)

    return graph.compile()


graph = build_interrupts_graph()
