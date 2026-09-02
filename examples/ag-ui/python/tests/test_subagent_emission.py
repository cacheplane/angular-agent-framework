"""In-process verification of the research subagent's reason → tool → answer
loop and the standard SUBAGENT_* sequence it produces on the wire.

Runs the enriched subgraph with a FAKE tool-calling chat model (no network):
turn 0 returns an AIMessage carrying a `lookup` tool_call; turn 1 returns the
final answer. We intercept every `subagent_activity` payload the subgraph
nodes dispatch, bracket them with the `research` tool body's `started` /
`finished`, and push them through `SubagentEmittingAgent` exactly as the
bridge would (as CUSTOM events in `LangGraphAgent.run`) — asserting the
ORDER + fields of the standard events:

    SUBAGENT_STARTED → TEXT_MESSAGE_START(m1) → TEXT_MESSAGE_END(m1)
    → TOOL_CALL_START/ARGS/END(lookup, parent m1) → TOOL_CALL_RESULT(lookup)
    → TEXT_MESSAGE_START(m2) → TEXT_MESSAGE_END(m2) → SUBAGENT_FINISHED

(Live `message` deltas come from SubagentStreamHandler, which the fake model
does not drive — so the answer turn has no TEXT_MESSAGE_CONTENT here; the
handler's own tests cover the per-token deltas.)
"""
import json
from typing import Any

import pytest
from ag_ui.core import CustomEvent, EventType, RunAgentInput
from ag_ui_langgraph import LangGraphAgent
from langchain_core.messages import AIMessage
from langchain_core.runnables import Runnable
from langgraph.graph import END, MessagesState, StateGraph

import src.graph as graph_mod
from src.graph import _build_research_subgraph
from src.streaming.subagent_emitting_agent import SubagentEmittingAgent
from src.streaming.subagent_stream_handler import SubagentRunState

TID = "tc-research"
RUN_ID = f"{TID}-sub"
M1, M2 = f"{TID}-sub-m1", f"{TID}-sub-m2"


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


def _noop_graph():
    g = StateGraph(MessagesState)
    g.add_node("noop", lambda state: {})
    g.set_entry_point("noop")
    g.add_edge("noop", END)
    return g.compile()


async def _run_subgraph_and_collect_payloads() -> tuple[list[dict], dict, _FakeToolCallingModel]:
    payloads: list[dict] = []

    async def fake_emit(payload: dict) -> None:
        payloads.append({"subagent_id": TID, **payload})

    fake_model = _FakeToolCallingModel()
    subgraph = _build_research_subgraph(
        fake_emit, SubagentRunState(TID), llm_factory=lambda force_answer: fake_model
    )
    result = await subgraph.ainvoke({"topic": "Angular signals", "messages": [], "iterations": 0})
    return payloads, result, fake_model


async def _expand(monkeypatch, payloads: list[dict]) -> list:
    async def fake_run(self, input):
        for p in payloads:
            yield CustomEvent(type=EventType.CUSTOM, name="subagent_activity", value=p)

    monkeypatch.setattr(LangGraphAgent, "run", fake_run)
    agent = SubagentEmittingAgent(name="chat", graph=_noop_graph())
    run_input = RunAgentInput(
        thread_id="t", run_id="r", messages=[], tools=[], context=[], state={}, forwarded_props={}
    )
    return [ev async for ev in agent.run(run_input)]


@pytest.mark.asyncio
async def test_subgraph_emits_reason_tool_answer_phases():
    payloads, result, fake_model = await _run_subgraph_and_collect_payloads()

    # Full structured phase sequence the node loop dispatches.
    assert [p["phase"] for p in payloads] == [
        "message_start",  # turn 1 opens
        "tool_call",      # turn 1 calls lookup
        "tool_result",    # tool node runs lookup
        "message_start",  # turn 2 opens (forced-answer turn)
    ]
    by_phase = {p["phase"]: p for p in payloads}
    assert [p["message_id"] for p in payloads if p["phase"] == "message_start"] == [M1, M2]

    tc = by_phase["tool_call"]
    assert tc["message_id"] == M1
    assert tc["tool_call_id"] == "call_lookup_1"
    assert tc["name"] == "lookup"
    assert tc["args"] == {"query": "angular signals"}

    tr = by_phase["tool_result"]
    assert tr["tool_call_id"] == "call_lookup_1"
    assert isinstance(tr["content"], str) and "signal" in tr["content"].lower()

    # Loop terminates: the forced-answer turn returns a plain answer (no tool
    # calls), so the run ends with a final AIMessage and exactly two turns.
    assert fake_model.calls == 2
    last = result["messages"][-1]
    assert isinstance(last, AIMessage)
    assert not last.tool_calls
    assert "Signals" in last.content


@pytest.mark.asyncio
async def test_subgraph_run_expands_to_the_standard_subagent_sequence(monkeypatch):
    payloads, _, _ = await _run_subgraph_and_collect_payloads()
    # Bracket with what the `research` tool body dispatches around ainvoke.
    script = [
        {"subagent_id": TID, "phase": "started", "name": "research"},
        *payloads,
        {"subagent_id": TID, "phase": "finished", "status": "complete"},
    ]
    out = await _expand(monkeypatch, script)

    assert [(ev.type, getattr(ev, "message_id", None) or getattr(ev, "tool_call_id", None)) for ev in out] == [
        (EventType.SUBAGENT_STARTED, None),
        (EventType.TEXT_MESSAGE_START, M1),
        (EventType.TEXT_MESSAGE_END, M1),
        (EventType.TOOL_CALL_START, "call_lookup_1"),
        (EventType.TOOL_CALL_ARGS, "call_lookup_1"),
        (EventType.TOOL_CALL_END, "call_lookup_1"),
        (EventType.TOOL_CALL_RESULT, "call_lookup_1-result"),
        (EventType.TEXT_MESSAGE_START, M2),
        (EventType.TEXT_MESSAGE_END, M2),
        (EventType.SUBAGENT_FINISHED, None),
    ]
    assert not any(ev.type == EventType.CUSTOM for ev in out)
    assert all(ev.subagent_run_id == RUN_ID for ev in out)

    assert out[0].name == "research"
    assert out[0].parent_tool_call_id == TID
    assert out[3].tool_call_name == "lookup"
    assert out[3].parent_message_id == M1
    assert json.loads(out[4].delta) == {"query": "angular signals"}
    assert out[6].tool_call_id == "call_lookup_1"
    assert out[6].role == "tool"
    assert "signal" in out[6].content.lower()
    assert out[9].outcome.type == "success"


@pytest.mark.asyncio
async def test_lookup_tool_is_deterministic_and_offline():
    # The canned fact lookup must be reproducible for the aimock fixture.
    assert graph_mod.lookup.invoke({"query": "angular signals"}) == \
        graph_mod.lookup.invoke({"query": "tell me about SIGNALS please"})
    # Unknown topic falls back to the default fact, never raises / hits network.
    assert graph_mod.lookup.invoke({"query": "quantum widgets"}) == \
        graph_mod._RESEARCH_DEFAULT_FACT
