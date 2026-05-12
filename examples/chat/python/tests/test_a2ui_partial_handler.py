"""Tests for A2uiPartialHandler — drives canned on_llm_new_token events
and asserts on the data written to the LangGraph stream writer."""
from unittest.mock import patch, MagicMock
from uuid import uuid4

import pytest
from langchain_core.messages import AIMessageChunk
from langchain_core.outputs import ChatGenerationChunk

from src.streaming.a2ui_partial_handler import A2uiPartialHandler


def _make_chunk(tool_call_chunks: list[dict]) -> ChatGenerationChunk:
    """Wrap an AIMessageChunk in a ChatGenerationChunk the way the real
    LangChain streaming callback path does."""
    return ChatGenerationChunk(
        text="",
        message=AIMessageChunk(content="", tool_call_chunks=tool_call_chunks),
    )


def _make_responses_chunk(blocks: list[dict]) -> ChatGenerationChunk:
    """Wrap Responses-API content blocks (gpt-5 family) in a ChatGenerationChunk."""
    return ChatGenerationChunk(
        text="",
        message=AIMessageChunk(content=blocks),
    )


class TestA2uiPartialHandler:
    @pytest.mark.asyncio
    async def test_dispatches_event_when_chunk_grows_args(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        writer = MagicMock()
        with patch("src.streaming.a2ui_partial_handler.get_stream_writer", return_value=writer):
            chunk = _make_chunk([
                {"id": "tc-1", "name": "render_a2ui_surface", "args": "{\"envelopes\":[", "index": 0},
            ])
            await handler.on_llm_new_token("", chunk=chunk, run_id=uuid4())
        writer.assert_called_once_with({
            "name": "a2ui-partial",
            "data": {"tool_call_id": "tc-1", "args_so_far": "{\"envelopes\":["},
        })

    @pytest.mark.asyncio
    async def test_concatenates_args_across_chunks_same_tool_call_id(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        writer = MagicMock()
        with patch("src.streaming.a2ui_partial_handler.get_stream_writer", return_value=writer):
            await handler.on_llm_new_token(
                "",
                chunk=_make_chunk([{"id": "tc-1", "name": "render_a2ui_surface", "args": "{", "index": 0}]),
                run_id=uuid4(),
            )
            await handler.on_llm_new_token(
                "",
                chunk=_make_chunk([{"id": "tc-1", "name": "render_a2ui_surface", "args": "\"x\":1}", "index": 0}]),
                run_id=uuid4(),
            )
        assert writer.call_count == 2
        args = [c.args[0] for c in writer.call_args_list]
        assert args[0]["data"]["args_so_far"] == "{"
        assert args[1]["data"]["args_so_far"] == "{\"x\":1}"

    @pytest.mark.asyncio
    async def test_ignores_chunks_for_unrelated_tools(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        writer = MagicMock()
        with patch("src.streaming.a2ui_partial_handler.get_stream_writer", return_value=writer):
            await handler.on_llm_new_token(
                "",
                chunk=_make_chunk([{"id": "tc-x", "name": "search_documents", "args": "x", "index": 0}]),
                run_id=uuid4(),
            )
        writer.assert_not_called()

    @pytest.mark.asyncio
    async def test_no_dispatch_when_args_did_not_grow(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        writer = MagicMock()
        with patch("src.streaming.a2ui_partial_handler.get_stream_writer", return_value=writer):
            await handler.on_llm_new_token(
                "",
                chunk=_make_chunk([{"id": "tc-1", "name": "render_a2ui_surface", "args": "{", "index": 0}]),
                run_id=uuid4(),
            )
            await handler.on_llm_new_token(
                "",
                chunk=_make_chunk([{"id": "tc-1", "name": "render_a2ui_surface", "args": "", "index": 0}]),
                run_id=uuid4(),
            )
        writer.assert_called_once()

    @pytest.mark.asyncio
    async def test_per_tool_call_id_state_isolation(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        writer = MagicMock()
        with patch("src.streaming.a2ui_partial_handler.get_stream_writer", return_value=writer):
            await handler.on_llm_new_token(
                "",
                chunk=_make_chunk([
                    {"id": "tc-A", "name": "render_a2ui_surface", "args": "{", "index": 0},
                    {"id": "tc-B", "name": "render_a2ui_surface", "args": "[", "index": 1},
                ]),
                run_id=uuid4(),
            )
        assert writer.call_count == 2
        ids = {c.args[0]["data"]["tool_call_id"] for c in writer.call_args_list}
        assert ids == {"tc-A", "tc-B"}

    @pytest.mark.asyncio
    async def test_ignores_token_event_without_chunk_message(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        writer = MagicMock()
        with patch("src.streaming.a2ui_partial_handler.get_stream_writer", return_value=writer):
            await handler.on_llm_new_token("some token", chunk=None, run_id=uuid4())
        writer.assert_not_called()

    @pytest.mark.asyncio
    async def test_silently_skips_when_no_stream_writer_context(self):
        """When invoked outside a LangGraph stream context (e.g. raw script),
        get_stream_writer() raises RuntimeError. Handler should swallow."""
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        with patch("src.streaming.a2ui_partial_handler.get_stream_writer", side_effect=RuntimeError("not in stream")):
            # Must not raise.
            await handler.on_llm_new_token(
                "",
                chunk=_make_chunk([{"id": "tc-1", "name": "render_a2ui_surface", "args": "{", "index": 0}]),
                run_id=uuid4(),
            )

    @pytest.mark.asyncio
    async def test_responses_api_function_call_content_blocks(self):
        """gpt-5 / Responses API streams tool-call deltas as content blocks
        of type='function_call'. The first block carries name + call_id;
        subsequent blocks for the same index carry only args delta."""
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        writer = MagicMock()
        with patch("src.streaming.a2ui_partial_handler.get_stream_writer", return_value=writer):
            await handler.on_llm_new_token("", chunk=_make_responses_chunk([
                {"type": "function_call", "name": "render_a2ui_surface",
                 "call_id": "call_ABC", "id": "fc_1", "arguments": "", "index": 1},
            ]), run_id=uuid4())
            await handler.on_llm_new_token("", chunk=_make_responses_chunk([
                {"type": "function_call", "arguments": "{\"en", "index": 1},
            ]), run_id=uuid4())
            await handler.on_llm_new_token("", chunk=_make_responses_chunk([
                {"type": "function_call", "arguments": "velopes", "index": 1},
            ]), run_id=uuid4())
        # First block has empty args — no dispatch. Two subsequent grow.
        assert writer.call_count == 2
        first = writer.call_args_list[0].args[0]
        second = writer.call_args_list[1].args[0]
        assert first["data"]["tool_call_id"] == "call_ABC"
        assert first["data"]["args_so_far"] == "{\"en"
        assert second["data"]["args_so_far"] == "{\"envelopes"

    @pytest.mark.asyncio
    async def test_responses_api_ignores_non_target_tools(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        writer = MagicMock()
        with patch("src.streaming.a2ui_partial_handler.get_stream_writer", return_value=writer):
            await handler.on_llm_new_token("", chunk=_make_responses_chunk([
                {"type": "function_call", "name": "search_documents",
                 "call_id": "call_X", "arguments": "{}", "index": 0},
            ]), run_id=uuid4())
        writer.assert_not_called()
