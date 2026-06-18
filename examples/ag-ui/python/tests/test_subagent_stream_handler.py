"""Tests for SubagentStreamHandler — accumulates child LLM text tokens and
emits `subagent_activity` `message` events carrying the full `text_so_far`."""
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from src.streaming.subagent_stream_handler import (
    SubagentStreamHandler,
    SubagentRunState,
)


class TestSubagentStreamHandler:
    @pytest.mark.asyncio
    async def test_emits_accumulated_text_so_far(self):
        handler = SubagentStreamHandler(subagent_id="tc-1")
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock) as dispatch:
            await handler.on_llm_new_token("Paris ", run_id=uuid4())
            await handler.on_llm_new_token("is", run_id=uuid4())
        assert dispatch.call_args_list[0].args == (
            "subagent_activity",
            {"subagent_id": "tc-1", "phase": "message", "message_index": 0, "text": "Paris "})
        assert dispatch.call_args_list[1].args == (
            "subagent_activity",
            {"subagent_id": "tc-1", "phase": "message", "message_index": 0, "text": "Paris is"})

    @pytest.mark.asyncio
    async def test_buffers_isolated_across_instances(self):
        h1, h2 = SubagentStreamHandler("a"), SubagentStreamHandler("b")
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock) as dispatch:
            await h1.on_llm_new_token("x", run_id=uuid4())
            await h2.on_llm_new_token("y", run_id=uuid4())
        assert dispatch.call_args_list[0].args[1]["text"] == "x"
        assert dispatch.call_args_list[1].args[1]["text"] == "y"

    @pytest.mark.asyncio
    async def test_tags_message_index_from_run_state(self):
        run_state = SubagentRunState()
        handler = SubagentStreamHandler(subagent_id="tc-1", run_state=run_state)
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock) as dispatch:
            await handler.on_llm_new_token("first", run_id=uuid4())
            # Subgraph advances to the next assistant turn.
            run_state.message_index = 1
            await handler.on_llm_new_token("second", run_id=uuid4())
        first, second = dispatch.call_args_list
        assert first.args[1]["message_index"] == 0
        assert first.args[1]["text"] == "first"
        # Buffer resets per turn so text_so_far is scoped to the new turn.
        assert second.args[1]["message_index"] == 1
        assert second.args[1]["text"] == "second"

    @pytest.mark.asyncio
    async def test_dispatch_failure_is_silent(self):
        handler = SubagentStreamHandler(subagent_id="tc-1")
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock, side_effect=RuntimeError):
            await handler.on_llm_new_token("hi", run_id=uuid4())  # must not raise
