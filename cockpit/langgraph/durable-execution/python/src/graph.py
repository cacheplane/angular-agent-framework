"""
LangGraph Durable Execution Graph

Demonstrates fault-tolerant multi-step execution with checkpointing.
The graph runs three nodes (analyze → plan → generate), saving state
after each one. If the process crashes mid-run, LangGraph can resume
from the last saved checkpoint rather than restarting from scratch.

The LangGraph API server provides checkpointing automatically,
enabling durable persistence across server restarts.
"""

from pathlib import Path
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, BaseMessage, HumanMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


class DurableState(TypedDict):
    messages: list
    step: str  # Current execution step name


def build_durable_execution_graph():
    """
    Constructs a multi-node StateGraph with checkpointing enabled.

    The graph runs three sequential nodes — analyze, plan, generate —
    and checkpoints state after each one. This means any node failure
    only requires replaying from the previous checkpoint, not the start.
    """
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)
    system_prompt = (PROMPTS_DIR / "durable-execution.md").read_text()

    async def analyze(state: DurableState) -> dict:
        """
        Node 1: Analyze the user request.

        Examines the incoming messages to understand intent and key details.
        Checkpoints after completion so a failure in 'plan' doesn't rerun this.
        """
        messages = [SystemMessage(content=system_prompt + "\n\nYou are in the ANALYZE step. Briefly identify the key aspects of the request in 1-2 sentences.")] + state["messages"]
        response = await llm.ainvoke(messages)
        return {
            "messages": state["messages"] + [response],
            "step": "analyze",
        }

    async def plan(state: DurableState) -> dict:
        """
        Node 2: Plan a structured response.

        Uses the analysis from node 1 to outline the approach. State is
        checkpointed here before the more expensive generate step runs.
        """
        messages = [SystemMessage(content=system_prompt + "\n\nYou are in the PLAN step. Given the analysis so far, briefly outline the key points to address in 2-3 bullet points.")] + state["messages"]
        response = await llm.ainvoke(messages)
        return {
            "messages": state["messages"] + [response],
            "step": "plan",
        }

    async def generate(state: DurableState) -> dict:
        """
        Node 3: Generate the final response.

        Synthesises the analysis and plan into a complete, helpful reply.
        This is the last node before END; its output is the user-visible answer.
        """
        messages = [SystemMessage(content=system_prompt + "\n\nYou are in the GENERATE step. Synthesise the analysis and plan into a single, clear, helpful response for the user.")] + state["messages"]
        response = await llm.ainvoke(messages)
        return {
            "messages": [HumanMessage(content=state["messages"][-1].content if hasattr(state["messages"][-1], "content") else ""), response],
            "step": "generate",
        }

    graph = StateGraph(DurableState)
    graph.add_node("analyze", analyze)
    graph.add_node("plan", plan)
    graph.add_node("generate", generate)

    graph.set_entry_point("analyze")
    graph.add_edge("analyze", "plan")
    graph.add_edge("plan", "generate")
    graph.add_edge("generate", END)

    return graph.compile()


# The graph instance — referenced by langgraph.json
graph = build_durable_execution_graph()
