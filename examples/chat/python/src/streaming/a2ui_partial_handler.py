# SPDX-License-Identifier: MIT
"""Streaming callback handler that sidebands a parent LLM's growing
tool_call.arguments as A2UI-partial custom events. Listens to LangChain's
on_chat_model_stream events; per tool_call_id, concatenates argument
deltas and dispatches each cumulative state via adispatch_custom_event.
The frontend bridge (libs/chat partial-args-bridge) consumes these.
"""
from __future__ import annotations

from typing import Any

from langchain_core.callbacks import AsyncCallbackHandler, adispatch_custom_event


class A2uiPartialHandler(AsyncCallbackHandler):
    """Track per-tool_call_id cumulative arguments; dispatch a2ui-partial
    custom events when the cumulative string grows."""

    def __init__(self, tool_name: str = "render_a2ui_surface") -> None:
        super().__init__()
        self._tool_name = tool_name
        # tool_call_id -> cumulative args string
        self._buffers: dict[str, str] = {}

    async def on_chat_model_stream(
        self,
        chunk: Any,
        *,
        run_id: str | None = None,
        **kwargs: Any,
    ) -> None:
        # `chunk` is an AIMessageChunk. Each chunk may carry multiple
        # tool_call_chunks (e.g. interleaved across concurrent tool_calls).
        tool_call_chunks = getattr(chunk, "tool_call_chunks", None) or []
        for tc in tool_call_chunks:
            name = tc.get("name") or ""
            call_id = tc.get("id")
            delta = tc.get("args") or ""
            if name != self._tool_name or not call_id:
                continue
            existing = self._buffers.get(call_id, "")
            updated = existing + delta
            if updated == existing:
                # No growth — don't re-dispatch the same payload.
                continue
            self._buffers[call_id] = updated
            await adispatch_custom_event(
                "a2ui-partial",
                {"tool_call_id": call_id, "args_so_far": updated},
            )
