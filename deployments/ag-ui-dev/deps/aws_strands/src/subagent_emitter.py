"""SUBAGENT_* emitter for the `research_availability` delegation tool.

The Strands bridge natively drops a child agent's text deltas: an
async-generator `@tool` re-yielding a specialist's ``stream_async`` events
produces ``tool_stream_event``s, but `_forward_inner_agent_events` forwards
only the inner TOOL-CALL lifecycle and never inner text (measured in
docs/wire-capture-subagents.md). Registering this
``ToolBehavior.tool_stream_event_handler`` claims the whole child stream and
re-emits it as standard AG-UI subagent wire events:

    SUBAGENT_STARTED                      (first inner event)
    TEXT_MESSAGE_START/CONTENT.../END     (inner ``data`` deltas, streamed)
    SUBAGENT_FINISHED outcome=success     (inner terminal ``result`` event)

or ``SUBAGENT_ERROR`` when the delegation fails (the tool yields a
``delegation_error`` sentinel before re-raising, or the inner stream
force-stops). Ids derive from the wire ``toolCallId`` (``ctx.tool_use_id``)
so the client can key the subagent card on ``parentToolCallId`` with zero
bookkeeping.

The bridge instantiates this handler ONCE PER EVENT (a fresh async generator
per ``tool_stream_event``), so per-invocation lifecycle state lives in a
module-level dict keyed by ``tool_use_id``. The encoder requires pydantic
``BaseEvent`` instances — raw dicts crash the stream — so only typed
``ag_ui.core`` events are yielded.
"""

from dataclasses import dataclass

from ag_ui.core import (
    EventType,
    SubagentErrorEvent,
    SubagentFinishedEvent,
    SubagentFinishedSuccessOutcome,
    SubagentStartedEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
)

from ag_ui_strands import ToolStreamEventContext

SPECIALIST_NAME = "availability_researcher"


@dataclass
class _DelegationState:
    """Lifecycle of one delegation call, keyed by tool_use_id."""

    started: bool = False
    message_open: bool = False
    finished: bool = False
    generation: int = 1
    """Bumped when a reused tool_use_id starts a fresh inner stream, so the
    re-run's message id (-m2, -m3, ...) never collides with an already-emitted
    one."""


# Finished entries are kept (not popped) so the tool's trailing result-string
# yield and any stragglers stay suppressed. Growth is capped at _MAX_SESSIONS
# (dict insertion order = age; eviction prefers finished sessions, see
# _eviction_candidate; each entry is a short key string plus a 4-field
# dataclass, ~414 bytes measured with sys.getsizeof — the cap bounds the dict
# at ~200 KiB).
_sessions: dict[str, _DelegationState] = {}
_MAX_SESSIONS = 512


def _eviction_candidate(current: str) -> str:
    """Pick the session to drop when the cap is exceeded: the oldest FINISHED
    session first (its only job is straggler suppression); only when every
    other session is still in flight, the oldest in-flight one — evicting an
    unfinished session makes its next event re-emit SUBAGENT_STARTED, so that
    is the last resort that keeps the cap a hard memory bound. Never the
    session being registered right now."""
    oldest_unfinished: str | None = None
    for key, state in _sessions.items():
        if key == current:
            continue
        if state.finished:
            return key
        if oldest_unfinished is None:
            oldest_unfinished = key
    assert oldest_unfinished is not None  # cap > 1, so another key exists
    return oldest_unfinished


def _subagent_run_id(tool_use_id: str) -> str:
    return f"{tool_use_id}-sub"


def _message_id(tool_use_id: str, generation: int) -> str:
    return f"{tool_use_id}-sub-m{generation}"


async def emit_subagent_events(ctx: ToolStreamEventContext):
    """tool_stream_event_handler translating child events to SUBAGENT_* wire
    events. Async generator, called once per inner event."""
    state = _sessions.get(ctx.tool_use_id)
    if state is None:
        state = _DelegationState()
        _sessions[ctx.tool_use_id] = state
        while len(_sessions) > _MAX_SESSIONS:
            del _sessions[_eviction_candidate(ctx.tool_use_id)]
    run_id = _subagent_run_id(ctx.tool_use_id)
    data = ctx.stream_data
    if state.finished and isinstance(data, dict) and "init_event_loop" in data:
        # Reused tool_use_id (real for some Strands providers — see the
        # bridge's _reused_frontend_tool_identity_error): a fresh inner
        # stream always opens with init_event_loop, so reset for a second
        # full SUBAGENT_* sequence under the same subagent_run_id (the
        # adapter treats an identity-unchanged re-announce as content-only).
        # Non-init stragglers after the terminal stay swallowed below.
        state = _DelegationState(generation=state.generation + 1)
        _sessions[ctx.tool_use_id] = state
    message_id = _message_id(ctx.tool_use_id, state.generation)
    try:
        if state.finished:
            # The tool's final yield (the result string) and any stragglers
            # arrive after the inner terminal event — nothing left to emit.
            return

        if not state.started:
            state.started = True
            yield SubagentStartedEvent(
                type=EventType.SUBAGENT_STARTED,
                subagent_run_id=run_id,
                name=SPECIALIST_NAME,
                parent_tool_call_id=ctx.tool_use_id,
            )

        if isinstance(data, str):
            # Terminal-success fallback: the tool's final result-string yield
            # arriving on an UNFINISHED session means the inner stream ended
            # without a {"result": ...} event — close out rather than leaving
            # the subagent card open forever.
            state.finished = True
            if state.message_open:
                state.message_open = False
                yield TextMessageEndEvent(
                    type=EventType.TEXT_MESSAGE_END,
                    message_id=message_id,
                    subagent_run_id=run_id,
                )
            yield SubagentFinishedEvent(
                type=EventType.SUBAGENT_FINISHED,
                subagent_run_id=run_id,
                outcome=SubagentFinishedSuccessOutcome(),
            )
            return
        if not isinstance(data, dict):
            return

        if "delegation_error" in data or data.get("force_stop"):
            message = str(
                data.get("delegation_error")
                or data.get("force_stop_reason")
                or "subagent stream force-stopped"
            )
            state.finished = True
            if state.message_open:
                state.message_open = False
                yield TextMessageEndEvent(
                    type=EventType.TEXT_MESSAGE_END,
                    message_id=message_id,
                    subagent_run_id=run_id,
                )
            yield SubagentErrorEvent(
                type=EventType.SUBAGENT_ERROR,
                subagent_run_id=run_id,
                message=message,
            )
        elif isinstance(data.get("data"), str) and data["data"]:
            if not state.message_open:
                state.message_open = True
                yield TextMessageStartEvent(
                    type=EventType.TEXT_MESSAGE_START,
                    message_id=message_id,
                    role="assistant",
                    subagent_run_id=run_id,
                )
            yield TextMessageContentEvent(
                type=EventType.TEXT_MESSAGE_CONTENT,
                message_id=message_id,
                delta=data["data"],
                subagent_run_id=run_id,
            )
        elif "result" in data:
            state.finished = True
            if state.message_open:
                state.message_open = False
                yield TextMessageEndEvent(
                    type=EventType.TEXT_MESSAGE_END,
                    message_id=message_id,
                    subagent_run_id=run_id,
                )
            yield SubagentFinishedEvent(
                type=EventType.SUBAGENT_FINISHED,
                subagent_run_id=run_id,
                outcome=SubagentFinishedSuccessOutcome(),
            )
    except Exception as exc:  # pragma: no cover - defensive: never crash the run
        state.finished = True
        yield SubagentErrorEvent(
            type=EventType.SUBAGENT_ERROR,
            subagent_run_id=run_id,
            message=str(exc),
        )
