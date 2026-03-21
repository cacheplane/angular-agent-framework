import os
import uuid

import pytest


SKIP_REASON = "OPENAI_API_KEY not set - skipping integration tests"


@pytest.mark.integration
@pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason=SKIP_REASON)
def test_single_turn():
    """Graph compiles and LLM returns a non-empty AIMessage."""
    from langchain_core.messages import AIMessage, HumanMessage
    from chat_agent.agent import graph

    config = {"configurable": {"thread_id": str(uuid.uuid4())}}
    result = graph.invoke(
        {"messages": [HumanMessage(content="Say only the word: hello")]},
        config,
    )
    messages = result["messages"]
    assert len(messages) >= 2
    last = messages[-1]
    assert isinstance(last, AIMessage)
    assert len(last.content) > 0


@pytest.mark.integration
@pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason=SKIP_REASON)
def test_repeated_invocation_with_thread_id():
    """Repeated calls with the same thread_id should still produce valid responses."""
    from langchain_core.messages import AIMessage, HumanMessage
    from chat_agent.agent import graph

    config = {"configurable": {"thread_id": str(uuid.uuid4())}}

    graph.invoke(
        {"messages": [HumanMessage(content="My secret word is: PINEAPPLE.")]},
        config,
    )

    result = graph.invoke(
        {"messages": [HumanMessage(content="What is my secret word?")]},
        config,
    )
    last = result["messages"][-1]
    assert isinstance(last, AIMessage)
    assert len(last.content) > 0
