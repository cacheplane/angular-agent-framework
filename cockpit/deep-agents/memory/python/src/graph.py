"""
Deep Agents Memory Graph

Demonstrates persistent agent memory across sessions. The agent extracts
facts about the user from each conversation turn and stores them in the
`agent_memory` dict in state. Subsequent turns include remembered facts
in the system prompt, giving the agent context about the user.
"""

import json
import re
from pathlib import Path
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, BaseMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


class MemoryState(TypedDict):
    messages: list[BaseMessage]
    agent_memory: dict[str, str]


def build_memory_graph():
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MemoryState) -> dict:
        """Generate a response using remembered facts in the system prompt."""
        system_prompt = (PROMPTS_DIR / "memory.md").read_text()

        memory = state.get("agent_memory", {})
        if memory:
            facts_text = "\n".join(f"- {k}: {v}" for k, v in memory.items())
            system_prompt += f"\n\n## What you remember about the user\n{facts_text}"

        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    async def extract_facts(state: MemoryState) -> dict:
        """Parse the latest exchange for new facts to remember about the user."""
        system_prompt = (
            "You are a fact extractor. Given a conversation, extract any new facts "
            "about the user as a JSON object where keys are short fact labels and "
            "values are concise descriptions. Only include facts explicitly stated by "
            "the user. If no new facts are present, return an empty object {}."
        )

        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)

        current_memory = dict(state.get("agent_memory", {}))
        try:
            raw = response.content
            # Strip markdown code fences if present
            match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
            if match:
                raw = match.group(1)
            new_facts = json.loads(raw.strip())
            if isinstance(new_facts, dict):
                current_memory.update(new_facts)
        except (json.JSONDecodeError, TypeError):
            pass

        return {"agent_memory": current_memory}

    graph = StateGraph(MemoryState)
    graph.add_node("generate", generate)
    graph.add_node("extract_facts", extract_facts)
    graph.set_entry_point("generate")
    graph.add_edge("generate", "extract_facts")
    graph.add_edge("extract_facts", END)
    return graph.compile()


graph = build_memory_graph()
