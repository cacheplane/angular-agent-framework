import os
from functools import lru_cache
from typing import TYPE_CHECKING, cast

from dotenv import load_dotenv
from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, MessagesState, StateGraph

from chat_agent.config import Configuration

if TYPE_CHECKING:
    from langchain_openai import ChatOpenAI

load_dotenv()


@lru_cache(maxsize=1)
def get_llm() -> "ChatOpenAI":
    """Create the LLM lazily so graph import stays cheap during cold starts."""
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(model=os.environ.get("OPENAI_MODEL", "gpt-5-mini"))


def call_model(state: MessagesState, config: RunnableConfig) -> dict:
    """Invoke the LLM with the current message history and system prompt."""
    cfg = cast(Configuration, (config or {}).get("configurable", {}))
    system_prompt = cfg.get("system_prompt", "You are a helpful assistant.")

    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = get_llm().invoke(messages)
    return {"messages": [response]}


# Build the graph
_builder = StateGraph(MessagesState)
_builder.add_node("call_model", call_model)
_builder.add_edge(START, "call_model")
_builder.add_edge("call_model", END)

# LangGraph API manages persistence for deployed graphs, so keep the exported
# graph free of a custom checkpointer.
graph = _builder.compile()
