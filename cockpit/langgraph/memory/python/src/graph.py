"""
LangGraph Memory Graph

Demonstrates cross-thread persistent context by maintaining a `memory` dict
in graph state. The agent learns facts from conversation and stores them in
state so they persist across messages (and across threads when using a
persistent checkpointer in production).

Two nodes work in tandem:
  - generate: produces a response using full message history and known memory
  - extract_memory: parses the conversation to extract new facts to remember
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
    memory: dict  # {"user_name": "Alice", "preferences": {...}, ...}


def build_memory_graph():
    """
    Constructs a StateGraph with two nodes: generate and extract_memory.

    The graph flow is:
      generate -> extract_memory -> END

    This ensures every response is followed by a memory extraction pass,
    keeping the agent's knowledge up to date without blocking the reply.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)
    extractor_llm = ChatOpenAI(model="gpt-5-mini", streaming=False)

    async def generate(state: MemoryState) -> dict:
        """Generate a response using current messages and known memory."""
        system_prompt = (PROMPTS_DIR / "memory.md").read_text()

        # Inject known memory facts into the system prompt
        memory = state.get("memory", {})
        if memory:
            facts = "\n".join(f"- {k}: {v}" for k, v in memory.items())
            system_prompt = f"{system_prompt}\n\n## What you remember about the user:\n{facts}"

        messages = [SystemMessage(content=system_prompt)] + list(state["messages"])
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    async def extract_memory(state: MemoryState) -> dict:
        """
        Scan the latest exchange for facts worth remembering.

        Uses a structured prompt to extract key-value pairs from the
        conversation. Returns an updated `memory` dict merged with any
        facts already known.
        """
        messages = state.get("messages", [])
        current_memory = state.get("memory", {})

        # Build a summary of the last few exchanges for extraction
        recent = messages[-4:] if len(messages) >= 4 else messages
        transcript = "\n".join(
            f"{m.type.upper()}: {m.content}"
            for m in recent
            if hasattr(m, "content") and isinstance(m.content, str)
        )

        extraction_prompt = f"""Review this conversation excerpt and extract any facts about the user worth remembering.
Return ONLY a JSON object with string keys and string values. Keys should be snake_case identifiers
(e.g. "user_name", "location", "favorite_color"). Return an empty object {{}} if nothing new is learned.

Conversation:
{transcript}

Current known facts (do not repeat these unless the value changed):
{json.dumps(current_memory)}

Respond with ONLY the JSON object of NEW or UPDATED facts:"""

        response = await extractor_llm.ainvoke([SystemMessage(content=extraction_prompt)])
        raw = response.content.strip()

        # Safely parse the JSON response
        try:
            # Strip markdown code fences if present
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            new_facts = json.loads(match.group()) if match else {}
        except (json.JSONDecodeError, AttributeError):
            new_facts = {}

        if not new_facts:
            return {}

        updated_memory = {**current_memory, **new_facts}
        return {"memory": updated_memory}

    graph = StateGraph(MemoryState)
    graph.add_node("generate", generate)
    graph.add_node("extract_memory", extract_memory)
    graph.set_entry_point("generate")
    graph.add_edge("generate", "extract_memory")
    graph.add_edge("extract_memory", END)
    return graph.compile()


# The graph instance — referenced by langgraph.json
graph = build_memory_graph()
