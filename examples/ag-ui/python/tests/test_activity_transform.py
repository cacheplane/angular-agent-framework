"""Tests for subagent_custom_to_activity — maps a `subagent_activity` CUSTOM
event to a native ACTIVITY event (1:1, stateless). Non-subagent events → None."""
from ag_ui.core import CustomEvent, EventType, TextMessageStartEvent
from src.streaming.activity_transform import subagent_custom_to_activity


def _custom(data: dict) -> CustomEvent:
    return CustomEvent(type=EventType.CUSTOM, name="subagent_activity", value=data)


def test_started_maps_to_activity_snapshot():
    ev = subagent_custom_to_activity(_custom(
        {"subagent_id": "tc-1", "phase": "started", "name": "research"}))
    assert ev.type == EventType.ACTIVITY_SNAPSHOT
    assert ev.message_id == "tc-1"
    assert ev.activity_type == "subagent"
    assert ev.content == {"toolCallId": "tc-1", "name": "research", "status": "running", "text": ""}
    assert ev.replace is True


def test_message_maps_to_activity_delta_replace_text():
    ev = subagent_custom_to_activity(_custom(
        {"subagent_id": "tc-1", "phase": "message", "text": "Paris is"}))
    assert ev.type == EventType.ACTIVITY_DELTA
    assert ev.message_id == "tc-1"
    assert ev.patch == [{"op": "replace", "path": "/text", "value": "Paris is"}]


def test_finished_maps_to_activity_delta_replace_status():
    ev = subagent_custom_to_activity(_custom(
        {"subagent_id": "tc-1", "phase": "finished", "status": "complete"}))
    assert ev.type == EventType.ACTIVITY_DELTA
    assert ev.patch == [{"op": "replace", "path": "/status", "value": "complete"}]


def test_non_subagent_event_returns_none():
    assert subagent_custom_to_activity(
        CustomEvent(type=EventType.CUSTOM, name="state_update", value={})) is None
    assert subagent_custom_to_activity(
        TextMessageStartEvent(type=EventType.TEXT_MESSAGE_START, message_id="m", role="assistant")) is None


import pytest
from langgraph.graph import StateGraph, END
from langchain_core.callbacks.manager import adispatch_custom_event
from langgraph.checkpoint.memory import MemorySaver
from typing_extensions import TypedDict
from ag_ui.core import RunAgentInput
from src.streaming.activity_emitting_agent import ActivityEmittingAgent


class _S(TypedDict):
    messages: list


# Emit via adispatch_custom_event (the LangChain callback API) — the SPIKE found
# that a plain get_stream_writer() payload surfaces only as an on_chain_stream
# RAW event in this bridge/LangGraph version and never becomes a discrete CUSTOM
# event at _dispatch_event, whereas adispatch_custom_event does. Layer 3's
# SubagentStreamHandler must use this same mechanism.
async def _emit_node(state: _S) -> dict:
    await adispatch_custom_event(
        "subagent_activity",
        {"subagent_id": "tc-1", "phase": "started", "name": "research"})
    return {"messages": []}


def _tiny_graph():
    g = StateGraph(_S)
    g.add_node("emit", _emit_node)
    g.set_entry_point("emit")
    g.add_edge("emit", END)
    return g.compile(checkpointer=MemorySaver())


@pytest.mark.asyncio
async def test_dispatch_event_seam_converts_custom_to_activity():
    agent = ActivityEmittingAgent(name="t", graph=_tiny_graph())
    run_input = RunAgentInput(thread_id="th", run_id="r", messages=[],
                              tools=[], context=[], state={}, forwarded_props={})
    types = [getattr(ev, "type", None) async for ev in agent.run(run_input)]
    assert EventType.ACTIVITY_SNAPSHOT in types
    assert EventType.CUSTOM not in [t for t in types]
    assert isinstance(agent.clone(), ActivityEmittingAgent)
