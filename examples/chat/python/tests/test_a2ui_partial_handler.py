"""Tests for A2uiPartialHandler — drives canned on_llm_new_token events."""
from unittest.mock import patch, AsyncMock
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


class TestA2uiPartialHandler:
    @pytest.mark.asyncio
    async def test_dispatches_event_when_chunk_grows_args(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
            chunk = _make_chunk([
                {"id": "tc-1", "name": "render_a2ui_surface", "args": "{\"envelopes\":[", "index": 0},
            ])
            await handler.on_llm_new_token("", chunk=chunk, run_id=uuid4())
        mock.assert_awaited_once_with("a2ui-partial", {"tool_call_id": "tc-1", "args_so_far": "{\"envelopes\":["})

    @pytest.mark.asyncio
    async def test_concatenates_args_across_chunks_same_tool_call_id(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
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
        # Second dispatch carries the cumulative string.
        assert mock.await_count == 2
        args = [call.args for call in mock.await_args_list]
        assert args[0][1]["args_so_far"] == "{"
        assert args[1][1]["args_so_far"] == "{\"x\":1}"

    @pytest.mark.asyncio
    async def test_ignores_chunks_for_unrelated_tools(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
            await handler.on_llm_new_token(
                "",
                chunk=_make_chunk([{"id": "tc-x", "name": "search_documents", "args": "x", "index": 0}]),
                run_id=uuid4(),
            )
        mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_no_dispatch_when_args_did_not_grow(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
            # First chunk grows the buffer; second chunk has empty args delta
            # (a no-op chunk from the model) and must not re-dispatch.
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
        mock.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_per_tool_call_id_state_isolation(self):
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
            await handler.on_llm_new_token(
                "",
                chunk=_make_chunk([
                    {"id": "tc-A", "name": "render_a2ui_surface", "args": "{", "index": 0},
                    {"id": "tc-B", "name": "render_a2ui_surface", "args": "[", "index": 1},
                ]),
                run_id=uuid4(),
            )
        assert mock.await_count == 2
        ids = {call.args[1]["tool_call_id"] for call in mock.await_args_list}
        assert ids == {"tc-A", "tc-B"}

    @pytest.mark.asyncio
    async def test_ignores_token_event_without_chunk_message(self):
        """Some emitters of on_llm_new_token may pass chunk=None (legacy LLM
        path). Handler must silently skip — no crash, no dispatch."""
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
            await handler.on_llm_new_token("some token", chunk=None, run_id=uuid4())
        mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_responses_api_function_call_content_blocks(self):
        """gpt-5 / Responses API streams tool-call deltas as content blocks
        of type='function_call' rather than tool_call_chunks. The first
        block for each call carries name + call_id; subsequent blocks for
        the same index carry only the args delta."""
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        first = ChatGenerationChunk(
            text="",
            message=AIMessageChunk(content=[
                {"type": "function_call", "name": "render_a2ui_surface",
                 "call_id": "call_ABC", "id": "fc_1",
                 "arguments": "", "index": 1},
            ]),
        )
        next1 = ChatGenerationChunk(
            text="",
            message=AIMessageChunk(content=[
                {"type": "function_call", "arguments": "{\"en", "index": 1},
            ]),
        )
        next2 = ChatGenerationChunk(
            text="",
            message=AIMessageChunk(content=[
                {"type": "function_call", "arguments": "velopes", "index": 1},
            ]),
        )
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
            await handler.on_llm_new_token("", chunk=first, run_id=uuid4())
            await handler.on_llm_new_token("", chunk=next1, run_id=uuid4())
            await handler.on_llm_new_token("", chunk=next2, run_id=uuid4())
        # First block has empty args — no dispatch. Two subsequent grow the buffer.
        assert mock.await_count == 2
        call1 = mock.await_args_list[0].args[1]
        call2 = mock.await_args_list[1].args[1]
        assert call1["tool_call_id"] == "call_ABC"
        assert call1["args_so_far"] == "{\"en"
        assert call2["tool_call_id"] == "call_ABC"
        assert call2["args_so_far"] == "{\"envelopes"

    @pytest.mark.asyncio
    async def test_responses_api_ignores_non_target_tools(self):
        """Responses-API content blocks for a different tool are ignored."""
        handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
        chunk = ChatGenerationChunk(
            text="",
            message=AIMessageChunk(content=[
                {"type": "function_call", "name": "search_documents",
                 "call_id": "call_X", "arguments": "{}", "index": 0},
            ]),
        )
        with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
            await handler.on_llm_new_token("", chunk=chunk, run_id=uuid4())
        mock.assert_not_awaited()
