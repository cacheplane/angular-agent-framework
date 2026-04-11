"""
Chat example graphs — consolidated into the streaming deployment.

Each chat cockpit example (messages, input, debug, generative-ui, etc.) uses
the same graph architecture: a single-node StateGraph that prepends a system
prompt and calls the LLM. They differ only in the prompt file.

Registering them all here avoids separate LangGraph Cloud deployments while
keeping each example addressable by its own assistant ID.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _build_prompt_graph(prompt_file: str):
    """Factory: creates a compiled graph that uses the given prompt file."""
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / prompt_file).read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)
    return graph.compile()


# Each graph instance is referenced by langgraph.json
c_messages = _build_prompt_graph("messages.md")
c_input = _build_prompt_graph("input.md")
c_debug = _build_prompt_graph("debug.md")
c_interrupts = _build_prompt_graph("interrupts.md")
c_theming = _build_prompt_graph("theming.md")
c_threads = _build_prompt_graph("threads.md")
c_timeline = _build_prompt_graph("timeline.md")
c_tool_calls = _build_prompt_graph("tool-calls.md")
c_subagents = _build_prompt_graph("subagents.md")
generative_ui = _build_prompt_graph("generative-ui.md")
