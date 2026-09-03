"""Tests for the SUBAGENT_* emitter — drives the tool_stream_event_handler
with synthetic Strands events (shapes copied from the Task-0 wire capture in
docs/wire-capture-subagents.md) and asserts the exact emitted AG-UI sequence
field-for-field. The bridge calls the handler once per event with a fresh
generator, which is exactly how these tests drive it."""

import pytest

from ag_ui.core import EventType
from ag_ui_strands import ToolStreamEventContext

from src import subagent_emitter
from src.subagent_emitter import emit_subagent_events

TOOL_USE_ID = "call_vF6Vc6Wzl40vz9pBZOOrDxS7"
RUN_ID = f"{TOOL_USE_ID}-sub"
MESSAGE_ID = f"{TOOL_USE_ID}-sub-m1"


@pytest.fixture(autouse=True)
def _clean_sessions():
    subagent_emitter._sessions.clear()
    yield
    subagent_emitter._sessions.clear()


async def _drive(events: list, tool_use_id: str = TOOL_USE_ID) -> list:
    """Feed synthetic stream payloads one at a time, the way the bridge
    dispatches tool_stream_events, collecting everything yielded."""
    out = []
    for data in events:
        ctx = ToolStreamEventContext(
            tool_use_id=tool_use_id,
            tool_name="research_availability",
            stream_data=data,
        )
        async for ev in emit_subagent_events(ctx):
            out.append(ev)
    return out


async def test_success_sequence_field_for_field():
    out = await _drive([
        {"init_event_loop": True},           # specialist loop init
        {"start": True},
        {"data": "- Ada"},                   # streamed text deltas
        {"data": " is free"},
        {"data": " Tuesday"},
        {"result": object()},                # terminal AgentResult event
        "- Ada is free Tuesday",             # the tool's final yield (result string)
    ])

    types = [ev.type for ev in out]
    assert types == [
        EventType.SUBAGENT_STARTED,
        EventType.TEXT_MESSAGE_START,
        EventType.TEXT_MESSAGE_CONTENT,
        EventType.TEXT_MESSAGE_CONTENT,
        EventType.TEXT_MESSAGE_CONTENT,
        EventType.TEXT_MESSAGE_END,
        EventType.SUBAGENT_FINISHED,
    ]

    started = out[0]
    assert started.subagent_run_id == RUN_ID
    assert started.name == "availability_researcher"
    assert started.parent_tool_call_id == TOOL_USE_ID

    start = out[1]
    assert start.message_id == MESSAGE_ID
    assert start.role == "assistant"
    assert start.subagent_run_id == RUN_ID

    deltas = out[2:5]
    assert [ev.delta for ev in deltas] == ["- Ada", " is free", " Tuesday"]
    for ev in deltas:
        assert ev.message_id == MESSAGE_ID
        assert ev.subagent_run_id == RUN_ID

    end = out[5]
    assert end.message_id == MESSAGE_ID
    assert end.subagent_run_id == RUN_ID

    finished = out[6]
    assert finished.subagent_run_id == RUN_ID
    assert finished.outcome.type == "success"

    # The session stays, marked finished, so stragglers stay suppressed.
    assert subagent_emitter._sessions[TOOL_USE_ID].finished is True


async def test_no_deltas_still_brackets_with_started_and_finished():
    out = await _drive([{"init_event_loop": True}, {"result": object()}])
    assert [ev.type for ev in out] == [
        EventType.SUBAGENT_STARTED,
        EventType.SUBAGENT_FINISHED,
    ]


async def test_delegation_error_yields_subagent_error():
    out = await _drive([
        {"init_event_loop": True},
        {"data": "- Ada"},
        {"delegation_error": "specialist exploded"},
    ])
    assert [ev.type for ev in out] == [
        EventType.SUBAGENT_STARTED,
        EventType.TEXT_MESSAGE_START,
        EventType.TEXT_MESSAGE_CONTENT,
        EventType.TEXT_MESSAGE_END,   # open message is closed before the error
        EventType.SUBAGENT_ERROR,
    ]
    err = out[-1]
    assert err.subagent_run_id == RUN_ID
    assert err.message == "specialist exploded"
    assert subagent_emitter._sessions[TOOL_USE_ID].finished is True


async def test_force_stop_yields_subagent_error():
    out = await _drive([
        {"init_event_loop": True},
        {"force_stop": True, "force_stop_reason": "max tokens"},
    ])
    assert [ev.type for ev in out] == [
        EventType.SUBAGENT_STARTED,
        EventType.SUBAGENT_ERROR,
    ]
    assert out[-1].message == "max tokens"


async def test_events_after_terminal_are_ignored():
    out = await _drive([
        {"result": object()},
        {"data": "late straggler"},
        "final string",
    ])
    assert [ev.type for ev in out] == [
        EventType.SUBAGENT_STARTED,
        EventType.SUBAGENT_FINISHED,
    ]


async def test_reused_tool_use_id_resets_on_init_event_loop():
    # Some Strands providers reuse tool_use_ids across calls (see the
    # bridge's _reused_frontend_tool_identity_error). A fresh inner stream
    # always opens with init_event_loop, so a full second sequence must be
    # emitted — with a bumped message-id generation so -m1 is not reused.
    first = await _drive([
        {"init_event_loop": True},
        {"data": "- Ada"},
        {"result": object()},
        "- Ada",
    ])
    assert [ev.type for ev in first] == [
        EventType.SUBAGENT_STARTED,
        EventType.TEXT_MESSAGE_START,
        EventType.TEXT_MESSAGE_CONTENT,
        EventType.TEXT_MESSAGE_END,
        EventType.SUBAGENT_FINISHED,
    ]
    assert first[1].message_id == f"{TOOL_USE_ID}-sub-m1"

    second = await _drive([
        {"init_event_loop": True},
        {"data": "- Grace"},
        {"result": object()},
        "- Grace",
    ])
    assert [ev.type for ev in second] == [
        EventType.SUBAGENT_STARTED,
        EventType.TEXT_MESSAGE_START,
        EventType.TEXT_MESSAGE_CONTENT,
        EventType.TEXT_MESSAGE_END,
        EventType.SUBAGENT_FINISHED,
    ]
    # Same subagent_run_id (identity-unchanged re-announce), fresh message id.
    assert second[0].subagent_run_id == RUN_ID
    assert second[1].message_id == f"{TOOL_USE_ID}-sub-m2"
    assert second[2].delta == "- Grace"


async def test_str_payload_on_unfinished_session_is_terminal_success():
    # A stream that ends without a {"result": ...} event still terminates:
    # the tool's final result-string yield closes the message and finishes
    # the subagent instead of leaving the card open forever.
    out = await _drive([
        {"init_event_loop": True},
        {"data": "- Ada is free Tuesday"},
        "- Ada is free Tuesday",
    ])
    assert [ev.type for ev in out] == [
        EventType.SUBAGENT_STARTED,
        EventType.TEXT_MESSAGE_START,
        EventType.TEXT_MESSAGE_CONTENT,
        EventType.TEXT_MESSAGE_END,
        EventType.SUBAGENT_FINISHED,
    ]
    assert out[-1].outcome.type == "success"
    assert subagent_emitter._sessions[TOOL_USE_ID].finished is True


async def test_sessions_growth_is_capped():
    for i in range(subagent_emitter._MAX_SESSIONS + 5):
        await _drive([{"result": object()}], tool_use_id=f"call_{i}")
    assert len(subagent_emitter._sessions) == subagent_emitter._MAX_SESSIONS
    # Oldest entries were evicted, newest kept.
    assert "call_0" not in subagent_emitter._sessions
    assert f"call_{subagent_emitter._MAX_SESSIONS + 4}" in subagent_emitter._sessions


async def test_eviction_prefers_finished_sessions_over_in_flight_ones():
    # Fill the cap with UNFINISHED (in-flight) delegations, then one finished
    # one inserted LAST (the youngest entry — plain oldest-first eviction
    # would keep it and drop an in-flight session, whose next event would
    # then re-emit SUBAGENT_STARTED). The finished entry must go first.
    for i in range(subagent_emitter._MAX_SESSIONS - 1):
        await _drive([{"data": "x"}], tool_use_id=f"call_inflight_{i}")
    await _drive([{"result": object()}], tool_use_id="call_finished")
    assert len(subagent_emitter._sessions) == subagent_emitter._MAX_SESSIONS

    out = await _drive([{"data": "y"}], tool_use_id="call_one_more")

    assert len(subagent_emitter._sessions) == subagent_emitter._MAX_SESSIONS
    assert "call_finished" not in subagent_emitter._sessions
    assert "call_one_more" in subagent_emitter._sessions
    for i in range(subagent_emitter._MAX_SESSIONS - 1):
        assert f"call_inflight_{i}" in subagent_emitter._sessions
    # The newcomer started normally (STARTED + message open + delta).
    assert [ev.type for ev in out] == [
        EventType.SUBAGENT_STARTED,
        EventType.TEXT_MESSAGE_START,
        EventType.TEXT_MESSAGE_CONTENT,
    ]

    # A straggler on a surviving in-flight session does NOT re-emit STARTED.
    again = await _drive([{"data": "z"}], tool_use_id="call_inflight_0")
    assert [ev.type for ev in again] == [EventType.TEXT_MESSAGE_CONTENT]


async def test_eviction_falls_back_to_oldest_in_flight_when_none_finished():
    for i in range(subagent_emitter._MAX_SESSIONS):
        await _drive([{"data": "x"}], tool_use_id=f"call_inflight_{i}")
    await _drive([{"data": "y"}], tool_use_id="call_one_more")
    assert len(subagent_emitter._sessions) == subagent_emitter._MAX_SESSIONS
    assert "call_inflight_0" not in subagent_emitter._sessions
    assert "call_one_more" in subagent_emitter._sessions


async def test_ids_derive_from_tool_use_id():
    out = await _drive([{"data": "x"}, {"result": object()}], tool_use_id="call_other")
    assert out[0].subagent_run_id == "call_other-sub"
    assert out[1].message_id == "call_other-sub-m1"


def test_handler_is_registered_on_the_agent_config():
    from src.agent import agent

    behavior = agent.config.tool_behaviors["research_availability"]
    assert behavior.tool_stream_event_handler is emit_subagent_events
