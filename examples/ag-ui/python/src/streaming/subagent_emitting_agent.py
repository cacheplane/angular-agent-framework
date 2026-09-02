# SPDX-License-Identifier: MIT
"""SUBAGENT_* emitter for the `research` delegation tool.

The graph cannot reach the AG-UI wire directly: the research subgraph's nodes,
the `research` tool body and `SubagentStreamHandler` dispatch
`subagent_activity` CUSTOM events through LangChain's
``adispatch_custom_event``, which the ag-ui-langgraph bridge forwards 1:1 as
``CustomEvent`` items in ``LangGraphAgent.run`` (the async generator the
FastAPI endpoint consumes). The standard sequence needs 1:N expansion — a
``tool_call`` phase becomes three ``TOOL_CALL_*`` events, a ``finished``
phase must close the open child message AND finish the subagent, and the
CUSTOM event itself must be consumed — so the seam is ``run`` rather than the
bridge's strictly one-in/one-out ``_dispatch_event`` hook (measured in
docs/wire-capture-subagents.md).

Expansion contract (``tid`` = the payload's ``subagent_id`` = the ``research``
tool call id, identical to the bridge's ``TOOL_CALL_START.toolCallId``):

    started       {subagent_id, name}                       → SUBAGENT_STARTED   {subagentRunId: <tid>-sub, name, parentToolCallId: <tid>}
    message_start {subagent_id, message_id}                 → TEXT_MESSAGE_START {messageId: <tid>-sub-m<n>, role: assistant, subagentRunId}
    message       {subagent_id, message_id, delta}          → TEXT_MESSAGE_CONTENT {messageId, delta, subagentRunId}
    (next message_start / tool_call / finished / error)     → TEXT_MESSAGE_END for any open message first
    tool_call     {subagent_id, tool_call_id, name, args}   → TOOL_CALL_START {toolCallId, toolCallName, parentMessageId: <open message>, subagentRunId}
                                                              + TOOL_CALL_ARGS {delta: json(args)} + TOOL_CALL_END
    tool_result   {subagent_id, tool_call_id, content}      → TOOL_CALL_RESULT {messageId: <tool_call_id>-result, toolCallId, content, role: tool, subagentRunId}
    finished      {subagent_id}                             → SUBAGENT_FINISHED  {subagentRunId, outcome: success}
    error         {subagent_id, message}                    → SUBAGENT_ERROR     {subagentRunId, message}

Unknown phases are dropped with a warning; malformed payloads are dropped;
CUSTOM events with any other name pass through untouched. No queue merge is
needed: the CUSTOM events already flow through the bridge generator live,
interleaved with the bridge's own events, so a plain ``for out in
expand(ev): yield out`` preserves streaming. Delegation state is per
``run()`` call (the endpoint clones the agent per request anyway).

Because the child here is a compiled SUBGRAPH and the bridge streams
subgraphs, the bridge ALSO emits the child's own LLM text and ``lookup``
tool call as unattributed, bridge-native ``TEXT_MESSAGE_*`` /
``TOOL_CALL_*`` events — the same content the attributed expansion carries,
landing in the parent transcript (wire capture §2b). While a delegation
window is open (``started`` → ``finished`` / ``error``) the parent is blocked
in its tools node, so every unattributed content event in that window is the
child's duplicate; the wrapper drops them (remembering their ids so a
trailing ``TEXT_MESSAGE_END`` / ``TOOL_CALL_END`` after the window is dropped
too). ``STEP_*``, ``STATE_SNAPSHOT``, RAW mirrors and the parent's own
``TOOL_CALL_RESULT`` (which arrives after ``finished``) are untouched.

The encoder requires pydantic ``BaseEvent`` instances — raw dicts crash the
stream — so only typed ``ag_ui.core`` events are yielded.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Iterator

from ag_ui.core import (
    BaseEvent,
    EventType,
    SubagentErrorEvent,
    SubagentFinishedEvent,
    SubagentFinishedSuccessOutcome,
    SubagentStartedEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
    ToolCallArgsEvent,
    ToolCallEndEvent,
    ToolCallResultEvent,
    ToolCallStartEvent,
)
from ag_ui_langgraph import LangGraphAgent

CUSTOM_NAME = "subagent_activity"

# Bridge-native content events the child subgraph duplicates inside a
# delegation window (see module docstring).
_CHILD_MESSAGE_TYPES = frozenset({
    EventType.TEXT_MESSAGE_START, EventType.TEXT_MESSAGE_CONTENT, EventType.TEXT_MESSAGE_END,
})
_CHILD_TOOL_TYPES = frozenset({
    EventType.TOOL_CALL_START, EventType.TOOL_CALL_ARGS, EventType.TOOL_CALL_END,
})

logger = logging.getLogger(__name__)


@dataclass
class _Delegation:
    """Lifecycle of one delegation call, keyed by parent tool-call id."""

    run_id: str
    open_message_id: str | None = None
    message_count: int = 0
    active: bool = False


@dataclass
class _RunState:
    """Per-``run()`` expansion state."""

    delegations: dict[str, _Delegation] = field(default_factory=dict)
    # Ids of bridge-native child messages / tool calls dropped inside a window,
    # so their trailing END events are dropped after the window closes too.
    dropped_message_ids: set[str] = field(default_factory=set)
    dropped_tool_call_ids: set[str] = field(default_factory=set)

    def in_window(self) -> bool:
        return any(d.active for d in self.delegations.values())


def _subagent_run_id(tid: str) -> str:
    return f"{tid}-sub"


def _message_id(tid: str, n: int) -> str:
    return f"{tid}-sub-m{n}"


def _as_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if content is None:
        return ""
    try:
        return json.dumps(content)
    except (TypeError, ValueError):
        return str(content)


def _payload(event: BaseEvent) -> dict[str, Any] | None:
    """Return the `subagent_activity` payload dict, or None if `event` is not
    one (or is malformed)."""
    if getattr(event, "type", None) != EventType.CUSTOM:
        return None
    if getattr(event, "name", None) != CUSTOM_NAME:
        return None
    value = getattr(event, "value", None)
    if isinstance(value, str):  # the bridge may JSON-serialize custom values
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            logger.warning("subagent_activity payload is not JSON; dropped")
            return {}
    if not isinstance(value, dict):
        logger.warning("subagent_activity payload is not an object; dropped")
        return {}
    return value


class SubagentEmittingAgent(LangGraphAgent):
    """LangGraphAgent whose ``run`` expands the graph's `subagent_activity`
    CUSTOM events into standard SUBAGENT_* + attributed TEXT_MESSAGE_* /
    TOOL_CALL_* events, and drops the bridge's unattributed duplicates of the
    child subgraph's stream.

    Keeps the bridge's ``__init__`` signature so ``clone()`` (called by the
    FastAPI endpoint per request) reconstructs this subclass.
    """

    async def run(self, *args: Any, **kwargs: Any) -> AsyncGenerator[BaseEvent, None]:
        state = _RunState()
        async for event in super().run(*args, **kwargs):
            for out in self._expand(event, state):
                yield out

    def _expand(self, event: BaseEvent, state: _RunState) -> Iterator[BaseEvent]:
        payload = _payload(event)
        if payload is None:
            if not self._is_child_duplicate(event, state):
                yield event
            return
        if not payload:
            return  # malformed — already logged
        tid = payload.get("subagent_id")
        phase = payload.get("phase")
        if not isinstance(tid, str) or not tid or not isinstance(phase, str):
            logger.warning("subagent_activity missing subagent_id/phase; dropped: %r", payload)
            return

        delegation = state.delegations.get(tid)
        if delegation is None:
            delegation = _Delegation(run_id=_subagent_run_id(tid))
            state.delegations[tid] = delegation
        run_id = delegation.run_id

        if phase == "started":
            delegation.active = True
            yield SubagentStartedEvent(
                type=EventType.SUBAGENT_STARTED,
                subagent_run_id=run_id,
                name=str(payload.get("name") or tid),
                parent_tool_call_id=tid,
            )
        elif phase == "message_start":
            yield from self._close_message(delegation)
            yield from self._open_message(delegation, tid, payload.get("message_id"))
        elif phase == "message":
            delta = payload.get("delta")
            if not isinstance(delta, str) or not delta:
                return
            if delegation.open_message_id is None:
                yield from self._open_message(delegation, tid, payload.get("message_id"))
            yield TextMessageContentEvent(
                type=EventType.TEXT_MESSAGE_CONTENT,
                message_id=delegation.open_message_id,
                delta=delta,
                subagent_run_id=run_id,
            )
        elif phase == "tool_call":
            tool_call_id = payload.get("tool_call_id")
            if not isinstance(tool_call_id, str) or not tool_call_id:
                logger.warning("subagent_activity tool_call missing tool_call_id; dropped: %r", payload)
                return
            parent_message_id = delegation.open_message_id
            yield from self._close_message(delegation)
            yield ToolCallStartEvent(
                type=EventType.TOOL_CALL_START,
                tool_call_id=tool_call_id,
                tool_call_name=str(payload.get("name") or tool_call_id),
                parent_message_id=parent_message_id,
                subagent_run_id=run_id,
            )
            args = payload.get("args")
            yield ToolCallArgsEvent(
                type=EventType.TOOL_CALL_ARGS,
                tool_call_id=tool_call_id,
                delta=_as_text(args if args is not None else {}),
                subagent_run_id=run_id,
            )
            yield ToolCallEndEvent(
                type=EventType.TOOL_CALL_END,
                tool_call_id=tool_call_id,
                subagent_run_id=run_id,
            )
        elif phase == "tool_result":
            tool_call_id = payload.get("tool_call_id")
            if not isinstance(tool_call_id, str) or not tool_call_id:
                logger.warning("subagent_activity tool_result missing tool_call_id; dropped: %r", payload)
                return
            yield ToolCallResultEvent(
                type=EventType.TOOL_CALL_RESULT,
                message_id=f"{tool_call_id}-result",
                tool_call_id=tool_call_id,
                content=_as_text(payload.get("content")),
                role="tool",
                subagent_run_id=run_id,
            )
        elif phase == "finished":
            yield from self._close_message(delegation)
            delegation.active = False
            yield SubagentFinishedEvent(
                type=EventType.SUBAGENT_FINISHED,
                subagent_run_id=run_id,
                outcome=SubagentFinishedSuccessOutcome(),
            )
        elif phase == "error":
            yield from self._close_message(delegation)
            delegation.active = False
            yield SubagentErrorEvent(
                type=EventType.SUBAGENT_ERROR,
                subagent_run_id=run_id,
                message=str(payload.get("message") or "subagent failed"),
            )
        else:
            logger.warning("subagent_activity phase %r not supported; dropped", phase)

    @staticmethod
    def _is_child_duplicate(event: BaseEvent, state: _RunState) -> bool:
        """True for a bridge-native, unattributed content event that duplicates
        the child subgraph's stream (inside a delegation window, or a trailing
        END for an id dropped inside one)."""
        event_type = getattr(event, "type", None)
        if getattr(event, "subagent_run_id", None):
            return False  # already attributed — someone else's business
        if event_type in _CHILD_MESSAGE_TYPES:
            message_id = getattr(event, "message_id", None)
            if state.in_window():
                if message_id:
                    state.dropped_message_ids.add(message_id)
                return True
            return message_id in state.dropped_message_ids
        if event_type in _CHILD_TOOL_TYPES:
            tool_call_id = getattr(event, "tool_call_id", None)
            if state.in_window():
                if tool_call_id:
                    state.dropped_tool_call_ids.add(tool_call_id)
                return True
            return tool_call_id in state.dropped_tool_call_ids
        return False

    @staticmethod
    def _open_message(
        delegation: _Delegation, tid: str, message_id: Any
    ) -> Iterator[BaseEvent]:
        delegation.message_count += 1
        if not isinstance(message_id, str) or not message_id:
            message_id = _message_id(tid, delegation.message_count)
        delegation.open_message_id = message_id
        yield TextMessageStartEvent(
            type=EventType.TEXT_MESSAGE_START,
            message_id=message_id,
            role="assistant",
            subagent_run_id=delegation.run_id,
        )

    @staticmethod
    def _close_message(delegation: _Delegation) -> Iterator[BaseEvent]:
        if delegation.open_message_id is None:
            return
        message_id, delegation.open_message_id = delegation.open_message_id, None
        yield TextMessageEndEvent(
            type=EventType.TEXT_MESSAGE_END,
            message_id=message_id,
            subagent_run_id=delegation.run_id,
        )
