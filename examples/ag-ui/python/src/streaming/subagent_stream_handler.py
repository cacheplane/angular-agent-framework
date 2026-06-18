"""Taps a child subagent LLM's text tokens and emits them as `subagent_activity`
`message` events, keyed by the parent tool_call_id. Accumulates `text_so_far`
so the L2 transform stays stateless. `started`/`finished` are emitted by the
research tool body. Uses adispatch_custom_event (the bridge reads on_custom_event
from astream_events; get_stream_writer would surface only as a RAW event).

Each `message` event also carries the current `message_index` — the 0-based
ordinal of the assistant turn the tokens belong to. The subgraph owns the
counter (it opens each turn with a `message_start`); the handler reads it
through a shared mutable ref (`SubagentRunState`) so the index it tags stays
in lock-step with the transcript the subgraph emits. The handler resets its
text buffer whenever the subgraph advances to a new turn so each message's
`text_so_far` starts fresh."""
from typing import Any, Optional
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler, adispatch_custom_event


class SubagentRunState:
    """Per-research-run shared state. The subgraph nodes own `message_index`
    (bumping it as each assistant turn opens) and `tool_index` (the running
    position in the run's toolCalls[]); the SubagentStreamHandler reads
    `message_index` so its streamed `message` events tag the right turn."""

    def __init__(self) -> None:
        self.message_index: int = 0
        self.tool_index: int = 0


class SubagentStreamHandler(AsyncCallbackHandler):
    def __init__(self, subagent_id: str, run_state: Optional[SubagentRunState] = None) -> None:
        self._id = subagent_id
        self._buffer = ""
        self._run_state = run_state if run_state is not None else SubagentRunState()
        # Track which turn the current buffer belongs to so we reset the
        # accumulated text when the subgraph advances to a new assistant turn.
        self._buffer_index = self._run_state.message_index

    async def on_llm_new_token(self, token: str, *, run_id: UUID | None = None, **kwargs: Any) -> None:
        if not token:
            return
        index = self._run_state.message_index
        if index != self._buffer_index:
            # New assistant turn opened since the last token — start fresh so
            # `text_so_far` is scoped to this message, not the whole run.
            self._buffer = ""
            self._buffer_index = index
        self._buffer += token
        try:
            await adispatch_custom_event(
                "subagent_activity",
                {
                    "subagent_id": self._id,
                    "phase": "message",
                    "message_index": index,
                    "text": self._buffer,
                },
            )
        except Exception:
            return  # no ambient run context (some unit-test paths) — best-effort
