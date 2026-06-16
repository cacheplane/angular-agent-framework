"""Taps a child subagent LLM's text tokens and emits them as `subagent_activity`
`message` events, keyed by the parent tool_call_id. Accumulates `text_so_far`
so the L2 transform stays stateless. `started`/`finished` are emitted by the
research tool body. Uses adispatch_custom_event (the bridge reads on_custom_event
from astream_events; get_stream_writer would surface only as a RAW event)."""
from typing import Any
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler, adispatch_custom_event


class SubagentStreamHandler(AsyncCallbackHandler):
    def __init__(self, subagent_id: str) -> None:
        self._id = subagent_id
        self._buffer = ""

    async def on_llm_new_token(self, token: str, *, run_id: UUID | None = None, **kwargs: Any) -> None:
        if not token:
            return
        self._buffer += token
        try:
            await adispatch_custom_event(
                "subagent_activity",
                {"subagent_id": self._id, "phase": "message", "text": self._buffer},
            )
        except Exception:
            return  # no ambient run context (some unit-test paths) — best-effort
