"""Tests for SubagentStreamHandler — accumulates child LLM text tokens and
emits `subagent_activity` `message` events carrying the full `text_so_far`."""
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from src.streaming.subagent_stream_handler import SubagentStreamHandler


class TestSubagentStreamHandler:
    @pytest.mark.asyncio
    async def test_emits_accumulated_text_so_far(self):
        handler = SubagentStreamHandler(subagent_id="tc-1")
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock) as dispatch:
            await handler.on_llm_new_token("Paris ", run_id=uuid4())
            await handler.on_llm_new_token("is", run_id=uuid4())
        assert dispatch.call_args_list[0].args == (
            "subagent_activity", {"subagent_id": "tc-1", "phase": "message", "text": "Paris "})
        assert dispatch.call_args_list[1].args == (
            "subagent_activity", {"subagent_id": "tc-1", "phase": "message", "text": "Paris is"})

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
    async def test_dispatch_failure_is_silent(self):
        handler = SubagentStreamHandler(subagent_id="tc-1")
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock, side_effect=RuntimeError):
            await handler.on_llm_new_token("hi", run_id=uuid4())  # must not raise
