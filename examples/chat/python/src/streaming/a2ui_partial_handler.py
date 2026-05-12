# SPDX-License-Identifier: MIT
"""Streaming callback handler that sidebands a parent LLM's growing
tool_call.arguments as A2UI-partial custom events. Listens to LangChain's
on_llm_new_token events (the canonical streaming-token callback for
both chat models and legacy LLMs); per tool_call_id, concatenates argument
deltas and dispatches each cumulative state via adispatch_custom_event.
The frontend bridge (libs/chat partial-args-bridge) consumes these.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler, adispatch_custom_event
from langchain_core.outputs import ChatGenerationChunk, GenerationChunk


class A2uiPartialHandler(AsyncCallbackHandler):
    """Track per-tool_call_id cumulative arguments; dispatch a2ui-partial
    custom events when the cumulative string grows.

    Hooks into `on_llm_new_token` — the canonical streaming-token callback
    fired by ChatOpenAI when `streaming=True` is enabled. For each chunk
    we inspect the embedded `chunk.message.tool_call_chunks` list (only
    populated when the LLM is mid-stream of a tool_call) and forward any
    delta belonging to our target tool name to the frontend.
    """

    def __init__(self, tool_name: str = "render_a2ui_surface") -> None:
        super().__init__()
        self._tool_name = tool_name
        # tool_call_id -> cumulative args string
        self._buffers: dict[str, str] = {}

    async def on_llm_new_token(
        self,
        token: str,
        *,
        chunk: ChatGenerationChunk | GenerationChunk | None = None,
        run_id: UUID | None = None,
        parent_run_id: UUID | None = None,
        tags: list[str] | None = None,
        **kwargs: Any,
    ) -> None:
        # We only care about chat-model chunks that carry tool_call_chunks.
        if chunk is None:
            return
        message = getattr(chunk, "message", None)
        if message is None:
            return
        tool_call_chunks = getattr(message, "tool_call_chunks", None) or []
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
