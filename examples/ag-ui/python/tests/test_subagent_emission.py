"""In-process verification of the research subagent's reason → tool → answer
loop and its structured `subagent_activity` transcript emission.

Runs the enriched subgraph with a FAKE tool-calling chat model (no network):
turn 0 returns an AIMessage carrying a `lookup` tool_call; turn 1 returns the
final answer. We intercept every `adispatch_custom_event` the subgraph nodes
fire and assert the ORDER + payloads of the structured phases:

    message_start(0) → tool_call(0, …) → tool_result(0, …)
    → message_start(1) → finished-by-tool? no → final answer

(Live `message` token events come from SubagentStreamHandler, which the fake
model doesn't drive — so this test asserts the node-emitted phases only, which
is exactly the transcript skeleton the L2 transform consumes.)
"""
from typing import Any

import pytest
from langchain_core.messages import AIMessage
from langchain_core.runnables import Runnable

import src.graph as graph_mod
from src.graph import _build_research_subgraph
from src.streaming.subagent_stream_handler import SubagentRunState


class _FakeToolCallingModel(Runnable):
    """A tiny Runnable standing in for ChatOpenAI. First invocation returns an
    AIMessage with a `lookup` tool_call; subsequent invocations return a final
    text answer. `bind_tools` is a no-op (returns self) so the subgraph's
    gathering-turn `.bind_tools([lookup])` works unchanged."""

    def __init__(self) -> None:
        self.calls = 0

    def bind_tools(self, tools: Any, **kwargs: Any) -> "_FakeToolCallingModel":
        return self

    def invoke(self, input: Any, config: Any = None, **kwargs: Any) -> AIMessage:
        self.calls += 1
        if self.calls == 1:
            return AIMessage(
                content="",
                tool_calls=[
                    {
                        "id": "call_lookup_1",
                        "name": "lookup",
                        "args": {"query": "angular signals"},
                    }
                ],
            )
        return AIMessage(content="- Signals are reactive.\n- No zone.js needed.")

    async def ainvoke(self, input: Any, config: Any = None, **kwargs: Any) -> AIMessage:
        return self.invoke(input, config, **kwargs)


@pytest.mark.asyncio
async def test_subgraph_emits_reason_tool_answer_transcript():
    events: list[dict] = []

    async def fake_emit(payload: dict) -> None:
        events.append({"subagent_id": "tc-research", **payload})

    fake_model = _FakeToolCallingModel()
    run_state = SubagentRunState()
    subgraph = _build_research_subgraph(
        fake_emit, run_state, llm_factory=lambda force_answer: fake_model
    )

    result = await subgraph.ainvoke(
        {"topic": "Angular signals", "messages": [], "iterations": 0}
    )

    phases = [(e["phase"], e) for e in events]
    phase_names = [p for p, _ in phases]

    # Full structured phase sequence the node loop emits.
    assert phase_names == [
        "message_start",  # turn 0 opens
        "tool_call",      # turn 0 calls lookup
        "tool_result",    # tool node runs lookup
        "message_start",  # turn 1 opens (forced-answer turn)
    ], phase_names

    by_phase = {p: e for p, e in phases}

    # message_start indices: 0 then 1.
    starts = [e["message_index"] for p, e in phases if p == "message_start"]
    assert starts == [0, 1], starts

    # tool_call carries id/name/args + the originating message_index (0).
    tc = by_phase["tool_call"]
    assert tc["message_index"] == 0
    assert tc["tool_call_id"] == "call_lookup_1"
    assert tc["name"] == "lookup"
    assert tc["args"] == {"query": "angular signals"}

    # tool_result carries the matching tool_index (0), the lookup result text,
    # and a complete status.
    tr = by_phase["tool_result"]
    assert tr["tool_index"] == 0
    assert tr["status"] == "complete"
    assert isinstance(tr["result"], str) and "signal" in tr["result"].lower()

    # Loop terminates: the forced-answer turn returns a plain answer (no tool
    # calls), so the run ends with a final AIMessage and exactly two turns.
    assert fake_model.calls == 2
    last = result["messages"][-1]
    assert isinstance(last, AIMessage)
    assert not last.tool_calls
    assert "Signals" in last.content


@pytest.mark.asyncio
async def test_lookup_tool_is_deterministic_and_offline():
    # The canned fact lookup must be reproducible for the aimock fixture.
    assert graph_mod.lookup.invoke({"query": "angular signals"}) == \
        graph_mod.lookup.invoke({"query": "tell me about SIGNALS please"})
    # Unknown topic falls back to the default fact, never raises / hits network.
    assert graph_mod.lookup.invoke({"query": "quantum widgets"}) == \
        graph_mod._RESEARCH_DEFAULT_FACT
