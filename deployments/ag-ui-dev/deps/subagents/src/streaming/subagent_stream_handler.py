"""Taps a child subagent LLM's text tokens and forwards each one as a
`subagent_activity` payload keyed by the parent tool_call_id:

    message_start {subagent_id, message_id}          once, before the first token
    message       {subagent_id, message_id, delta}   one per token (raw delta)

`SubagentEmittingAgent` turns those into `subagentRunId`-attributed
TEXT_MESSAGE_START / TEXT_MESSAGE_CONTENT events; it closes the message
(TEXT_MESSAGE_END) itself on `finished` / `error`. `started` / `finished` /
`error` are emitted by the `task` tool body. The message id follows the
`<tool_call_id>-sub-m<n>` convention; this demo's child runs a single
completion, so n is always 1.

Uses adispatch_custom_event (the bridge reads on_custom_event from
astream_events; get_stream_writer would surface only as a RAW event)."""
from typing import Any
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler, adispatch_custom_event


class SubagentStreamHandler(AsyncCallbackHandler):
    def __init__(self, subagent_id: str) -> None:
        self._id = subagent_id
        self._message_id = f"{subagent_id}-sub-m1"
        self._message_open = False

    async def on_llm_new_token(self, token: str, *, run_id: UUID | None = None, **kwargs: Any) -> None:
        if not token:
            return
        try:
            if not self._message_open:
                self._message_open = True
                await adispatch_custom_event(
                    "subagent_activity",
                    {"subagent_id": self._id, "phase": "message_start", "message_id": self._message_id},
                )
            await adispatch_custom_event(
                "subagent_activity",
                {"subagent_id": self._id, "phase": "message", "message_id": self._message_id, "delta": token},
            )
        except Exception:
            return  # no ambient run context (some unit-test paths) — best-effort
