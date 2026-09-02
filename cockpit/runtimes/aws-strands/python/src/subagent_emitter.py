# SPDX-License-Identifier: MIT
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


# Finished entries are kept (not popped) so the tool's trailing result-string
# yield and any stragglers stay suppressed; the dict grows one small entry per
# delegation call for the life of the process, matching the module-level demo
# state in agent.py.
_sessions: dict[str, _DelegationState] = {}


def _subagent_run_id(tool_use_id: str) -> str:
    return f"{tool_use_id}-sub"


def _message_id(tool_use_id: str) -> str:
    return f"{tool_use_id}-sub-m1"


async def emit_subagent_events(ctx: ToolStreamEventContext):
    """tool_stream_event_handler translating child events to SUBAGENT_* wire
    events. Async generator, called once per inner event."""
    state = _sessions.setdefault(ctx.tool_use_id, _DelegationState())
    run_id = _subagent_run_id(ctx.tool_use_id)
    message_id = _message_id(ctx.tool_use_id)
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

        data = ctx.stream_data
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
