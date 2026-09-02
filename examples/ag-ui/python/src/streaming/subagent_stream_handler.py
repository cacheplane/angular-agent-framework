"""Taps a child subagent LLM's text tokens and forwards each one as a
`subagent_activity` payload keyed by the parent tool_call_id:

    message_start {subagent_id, message_id}          once per assistant turn
    message       {subagent_id, message_id, delta}   one per token (raw delta)

`SubagentEmittingAgent` turns those into `subagentRunId`-attributed
TEXT_MESSAGE_START / TEXT_MESSAGE_CONTENT events and closes the message
(TEXT_MESSAGE_END) itself at the next `message_start` / `tool_call` /
`finished` / `error`. `started` / `tool_call` / `tool_result` / `finished` /
`error` are emitted by the research subgraph nodes and the `research` tool
body.

Message ids follow the `<tool_call_id>-sub-m<n>` convention. The research
subgraph runs several assistant turns per delegation (reason → tool → answer),
so it owns the turn counter: its `agent` node calls
`SubagentRunState.open_message()` and dispatches `message_start` BEFORE
invoking the model, and the handler reads the open id for the tokens that
follow. When no turn is open (a bare LLM call outside the subgraph, or the
unit tests) the handler opens one itself so a token is never orphaned.

Uses adispatch_custom_event (the bridge reads on_custom_event from
astream_events; get_stream_writer would surface only as a RAW event)."""
from typing import Any, Optional
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler, adispatch_custom_event

CUSTOM_NAME = "subagent_activity"


class SubagentRunState:
    """Per-delegation shared state: the message counter that derives
    `<subagent_id>-sub-m<n>` ids and the id of the currently open assistant
    turn. The research subgraph's nodes advance it; the SubagentStreamHandler
    reads it so its streamed `message` deltas tag the right turn."""

    def __init__(self, subagent_id: str) -> None:
        self.subagent_id = subagent_id
        self.message_count: int = 0
        self.message_id: Optional[str] = None

    def open_message(self) -> str:
        """Advance to the next assistant turn and return its message id."""
        self.message_count += 1
        self.message_id = f"{self.subagent_id}-sub-m{self.message_count}"
        return self.message_id


class SubagentStreamHandler(AsyncCallbackHandler):
    def __init__(self, subagent_id: str, run_state: Optional[SubagentRunState] = None) -> None:
        self._id = subagent_id
        self._run_state = run_state if run_state is not None else SubagentRunState(subagent_id)

    async def on_llm_new_token(self, token: str, *, run_id: UUID | None = None, **kwargs: Any) -> None:
        if not token:
            return
        try:
            if self._run_state.message_id is None:
                message_id = self._run_state.open_message()
                await adispatch_custom_event(
                    CUSTOM_NAME,
                    {"subagent_id": self._id, "phase": "message_start", "message_id": message_id},
                )
            await adispatch_custom_event(
                CUSTOM_NAME,
                {
                    "subagent_id": self._id,
                    "phase": "message",
                    "message_id": self._run_state.message_id,
                    "delta": token,
                },
            )
        except Exception:
            return  # no ambient run context (some unit-test paths) — best-effort
