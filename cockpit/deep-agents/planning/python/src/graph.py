"""
Deep Agents Planning Graph

Demonstrates agent task decomposition. The agent receives a complex
task, breaks it into ordered steps, and executes them sequentially.
The plan state is visible to the frontend via stream.value().
"""

import json
from pathlib import Path
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, BaseMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


class PlanStep(TypedDict):
    title: str
    status: str  # 'pending' | 'running' | 'complete'


class PlanningState(TypedDict):
    messages: list[BaseMessage]
    plan: list[PlanStep]


def build_planning_graph():
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

    async def create_plan(state: PlanningState) -> dict:
        """Decompose the task into ordered steps."""
        system_prompt = (PROMPTS_DIR / "planning.md").read_text()
        plan_prompt = system_prompt + "\n\nReturn a JSON array of steps: [{\"title\": \"step name\", \"status\": \"pending\"}]"
        messages = [SystemMessage(content=plan_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)

        try:
            plan = json.loads(response.content)
            if not isinstance(plan, list):
                plan = [{"title": "Process request", "status": "pending"}]
        except (json.JSONDecodeError, TypeError):
            plan = [{"title": "Process request", "status": "pending"}]

        return {"plan": plan, "messages": [response]}

    async def execute_plan(state: PlanningState) -> dict:
        """Execute the plan and generate a response."""
        plan = [dict(s, status="complete") for s in state.get("plan", [])]
        system_prompt = (PROMPTS_DIR / "planning.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"plan": plan, "messages": [response]}

    graph = StateGraph(PlanningState)
    graph.add_node("create_plan", create_plan)
    graph.add_node("execute_plan", execute_plan)
    graph.set_entry_point("create_plan")
    graph.add_edge("create_plan", "execute_plan")
    graph.add_edge("execute_plan", END)
    return graph.compile()


graph = build_planning_graph()
