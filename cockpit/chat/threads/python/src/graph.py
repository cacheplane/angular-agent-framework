"""
Chat Threads Graph

Conversational agent with inline thread-title generation. Each new
thread gets an LLM-generated 3-5 word title written to LangGraph
thread metadata on the first turn (idempotent — subsequent turns skip
the write). The chat-threads frontend reads `metadata.thread_title`
from `client.threads.search()` and displays it in the sidenav.

Pattern D from spec 2026-05-19-llm-generated-labels-design.md: the
generate_title node lives inline in this file (not extracted to a
shared helper) so a developer reading this cap sees the entire agent
in one place.
"""

import os
from pathlib import Path
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, END
from langgraph_sdk import get_client

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# ── generate_title node (inline; matches Pattern D from spec
#     2026-05-19-llm-generated-labels-design.md) ──────────────────────────────

_TITLE_PROMPT = (
    "In 3-5 words, summarize what the user is asking about. "
    "Output ONLY the title — no quotes, no period, no prefix."
)
_TITLE_MODEL = "gpt-5-mini"


async def generate_title(state: MessagesState, config) -> dict:
    """Background title generation: on the first turn, summarize the user's
    intent into 3-5 words and persist to LangGraph thread metadata so the
    sidenav shows something meaningful instead of a UUID slice.

    Idempotent — skips when metadata.thread_title already exists. Errors
    are swallowed (title is a UX nicety, never a blocker). Runs after the
    user-visible turn so it never blocks the response.
    """
    thread_id = (config.get("configurable") or {}).get("thread_id")
    if not thread_id:
        return {}
    sdk_url = os.environ.get("LANGGRAPH_API_URL", "http://localhost:2024")
    try:
        client = get_client(url=sdk_url)
        thread = await client.threads.get(thread_id)
        if (thread.get("metadata") or {}).get("thread_title"):
            return {}
        first_user = next(
            (m for m in state["messages"] if getattr(m, "type", None) == "human"),
            None,
        )
        if not first_user or not isinstance(first_user.content, str):
            return {}
        # Skip action-message JSON (those flow as human-role too)
        if first_user.content.lstrip().startswith("{"):
            return {}
        llm = ChatOpenAI(model=_TITLE_MODEL, temperature=0)
        response = await llm.ainvoke([
            SystemMessage(content=_TITLE_PROMPT),
            HumanMessage(content=first_user.content),
        ])
        title = (response.content or "").strip().strip('"').strip("'")[:80]
        if title:
            await client.threads.update(thread_id, metadata={"thread_title": title})
    except Exception:  # noqa: BLE001 — title is a UX nicety; never block
        pass
    return {}


def build_threads_graph():
    """Standard conversational agent + inline title gen on first turn."""
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "threads.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.add_node("generate_title", generate_title)
    graph.set_entry_point("generate")
    graph.add_edge("generate", "generate_title")
    graph.add_edge("generate_title", END)

    return graph.compile()


graph = build_threads_graph()
