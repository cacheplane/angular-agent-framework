"""Tests for A2uiPartialHandler — drives canned on_chat_model_stream events."""
from unittest.mock import patch, AsyncMock

import pytest
from langchain_core.messages import AIMessageChunk

from src.streaming.a2ui_partial_handler import A2uiPartialHandler


class TestA2uiPartialHandler:
    @pytest.mark.asyncio
    async def test_dispatches_event_when_chunk_grows_args(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
            chunk = AIMessageChunk(content="", tool_call_chunks=[
                {"id": "tc-1", "name": "render_a2ui_surface", "args": "{\"envelopes\":[", "index": 0},
            ])
            await handler.on_chat_model_stream(chunk, run_id="r1")
        mock.assert_awaited_once_with("a2ui-partial", {"tool_call_id": "tc-1", "args_so_far": "{\"envelopes\":["})

    @pytest.mark.asyncio
    async def test_concatenates_args_across_chunks_same_tool_call_id(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
            await handler.on_chat_model_stream(
                AIMessageChunk(content="", tool_call_chunks=[{"id": "tc-1", "name": "render_a2ui_surface", "args": "{", "index": 0}]),
                run_id="r1",
            )
            await handler.on_chat_model_stream(
                AIMessageChunk(content="", tool_call_chunks=[{"id": "tc-1", "name": "render_a2ui_surface", "args": "\"x\":1}", "index": 0}]),
                run_id="r1",
            )
        # Second dispatch carries the cumulative string.
        assert mock.await_count == 2
        args = [call.args for call in mock.await_args_list]
        assert args[0][1]["args_so_far"] == "{"
        assert args[1][1]["args_so_far"] == "{\"x\":1}"

    @pytest.mark.asyncio
    async def test_ignores_chunks_for_unrelated_tools(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
            await handler.on_chat_model_stream(
                AIMessageChunk(content="", tool_call_chunks=[{"id": "tc-x", "name": "search_documents", "args": "x", "index": 0}]),
                run_id="r1",
            )
        mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_no_dispatch_when_args_did_not_grow(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
            # First chunk grows the buffer; second chunk has empty args delta
            # (a no-op chunk from the model) and must not re-dispatch.
            await handler.on_chat_model_stream(
                AIMessageChunk(content="", tool_call_chunks=[{"id": "tc-1", "name": "render_a2ui_surface", "args": "{", "index": 0}]),
                run_id="r1",
            )
            await handler.on_chat_model_stream(
                AIMessageChunk(content="", tool_call_chunks=[{"id": "tc-1", "name": "render_a2ui_surface", "args": "", "index": 0}]),
                run_id="r1",
            )
        mock.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_per_tool_call_id_state_isolation(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
            await handler.on_chat_model_stream(
                AIMessageChunk(content="", tool_call_chunks=[
                    {"id": "tc-A", "name": "render_a2ui_surface", "args": "{", "index": 0},
                    {"id": "tc-B", "name": "render_a2ui_surface", "args": "[", "index": 1},
                ]),
                run_id="r1",
            )
        assert mock.await_count == 2
        ids = {call.args[1]["tool_call_id"] for call in mock.await_args_list}
        assert ids == {"tc-A", "tc-B"}
