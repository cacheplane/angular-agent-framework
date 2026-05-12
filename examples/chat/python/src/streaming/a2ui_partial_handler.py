# SPDX-License-Identifier: MIT
"""Streaming callback handler that sidebands a parent LLM's growing
tool_call.arguments as A2UI-partial custom events.

Hooks into LangChain's `on_llm_new_token` callback (the canonical
streaming-token callback fired by ChatOpenAI when streaming=True is
enabled). Two delta shapes are observed in production depending on
which OpenAI API the model uses:

  - Chat Completions API: `chunk.message.tool_call_chunks` carries the
    classic `[{name, id, args, index}, ...]` deltas.
  - Responses API (gpt-5 family): `chunk.message.content` carries a
    list of content blocks; tool-call deltas appear as
    `{type: 'function_call', name?: str, call_id?: str, arguments: str,
    index: int}`. The first block for each call carries `name` and
    `call_id`; subsequent blocks for the same `index` carry only the
    `arguments` delta.

The handler covers both shapes. For each delta belonging to our target
tool name, it concatenates arguments per `tool_call_id` and dispatches
an `a2ui-partial` custom event when the cumulative string grows. The
frontend bridge (libs/chat partial-args-bridge) consumes these.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler, adispatch_custom_event
from langchain_core.outputs import ChatGenerationChunk, GenerationChunk


class A2uiPartialHandler(AsyncCallbackHandler):
    """Track per-tool_call_id cumulative arguments; dispatch a2ui-partial
    custom events when the cumulative string grows."""

    def __init__(self, tool_name: str = "render_a2ui_surface") -> None:
        super().__init__()
        self._tool_name = tool_name
        # tool_call_id -> cumulative args string
        self._buffers: dict[str, str] = {}
        # Responses-API index -> tool_call_id mapping. The first content
        # block for each tool call carries name + call_id; subsequent
        # blocks for that `index` carry only the args delta, so we
        # remember the mapping to attribute later deltas correctly.
        self._index_to_call_id: dict[int, str] = {}

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
        if chunk is None:
            return
        message = getattr(chunk, "message", None)
        if message is None:
            return

        # Path 1: Chat Completions API — classic tool_call_chunks list.
        for tc in getattr(message, "tool_call_chunks", None) or []:
            await self._handle_classic_chunk(tc)

        # Path 2: Responses API — content blocks with type='function_call'.
        content = getattr(message, "content", None)
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "function_call":
                    await self._handle_responses_block(block)

    async def _handle_classic_chunk(self, tc: dict) -> None:
        """Chat Completions delta: {id, name?, args?, index}."""
        name = tc.get("name") or ""
        call_id = tc.get("id")
        delta = tc.get("args") or ""
        if not call_id:
            return
        # The first chunk for a call carries the name; later chunks may omit
        # it but should be attributed to the same call_id (which IS carried
        # on every chunk in this shape).
        if name and name != self._tool_name:
            return
        await self._dispatch_delta(call_id, delta)

    async def _handle_responses_block(self, block: dict) -> None:
        """Responses API delta: {type, name?, call_id?, arguments, index}.

        The first block for a call carries `name` and `call_id`. Subsequent
        blocks for the same `index` carry only the `arguments` delta — we
        remember the index→call_id mapping to attribute them correctly.
        """
        index = block.get("index")
        name = block.get("name") or ""
        call_id = block.get("call_id")
        delta = block.get("arguments") or ""

        if call_id:
            # First block for this call. Validate target tool name.
            if name and name != self._tool_name:
                # Not our target — still remember the mapping is "ignore".
                if isinstance(index, int):
                    self._index_to_call_id.pop(index, None)
                return
            if isinstance(index, int):
                self._index_to_call_id[index] = call_id
        else:
            # Subsequent block — look up call_id by index.
            if not isinstance(index, int):
                return
            call_id = self._index_to_call_id.get(index)
            if not call_id:
                # Either we never saw a first-block for this index, or it
                # was for a non-target tool. Skip.
                return

        await self._dispatch_delta(call_id, delta)

    async def _dispatch_delta(self, call_id: str, delta: str) -> None:
        existing = self._buffers.get(call_id, "")
        updated = existing + delta
        if updated == existing:
            return  # No growth — suppress duplicate dispatch.
        self._buffers[call_id] = updated
        await adispatch_custom_event(
            "a2ui-partial",
            {"tool_call_id": call_id, "args_so_far": updated},
        )
