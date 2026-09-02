"""Tests for SubagentStreamHandler — forwards each child LLM token as a
`subagent_activity` payload: one `message_start` (carrying the derived
message id) before the first token, then a `message` per token whose `delta`
is the raw token (no accumulation — the emitter turns these into attributed
TEXT_MESSAGE_START / TEXT_MESSAGE_CONTENT events)."""
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from src.streaming.subagent_stream_handler import SubagentStreamHandler

TID = "call_7sxPY1sC236nPyHRTWAZMJB9"
MESSAGE_ID = f"{TID}-sub-m1"


class TestSubagentStreamHandler:
    @pytest.mark.asyncio
    async def test_emits_message_start_then_per_token_deltas(self):
        handler = SubagentStreamHandler(subagent_id=TID)
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock) as dispatch:
            await handler.on_llm_new_token("Paris ", run_id=uuid4())
            await handler.on_llm_new_token("is", run_id=uuid4())
        assert [c.args for c in dispatch.call_args_list] == [
            ("subagent_activity",
             {"subagent_id": TID, "phase": "message_start", "message_id": MESSAGE_ID}),
            ("subagent_activity",
             {"subagent_id": TID, "phase": "message", "message_id": MESSAGE_ID, "delta": "Paris "}),
            ("subagent_activity",
             {"subagent_id": TID, "phase": "message", "message_id": MESSAGE_ID, "delta": "is"}),
        ]

    @pytest.mark.asyncio
    async def test_empty_token_emits_nothing(self):
        handler = SubagentStreamHandler(subagent_id=TID)
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock) as dispatch:
            await handler.on_llm_new_token("", run_id=uuid4())
        assert dispatch.call_args_list == []

    @pytest.mark.asyncio
    async def test_message_ids_isolated_across_instances(self):
        h1, h2 = SubagentStreamHandler("a"), SubagentStreamHandler("b")
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock) as dispatch:
            await h1.on_llm_new_token("x", run_id=uuid4())
            await h2.on_llm_new_token("y", run_id=uuid4())
        payloads = [c.args[1] for c in dispatch.call_args_list]
        assert [p["phase"] for p in payloads] == [
            "message_start", "message", "message_start", "message"]
        assert payloads[0]["message_id"] == "a-sub-m1"
        assert payloads[1] == {"subagent_id": "a", "phase": "message",
                               "message_id": "a-sub-m1", "delta": "x"}
        assert payloads[2]["message_id"] == "b-sub-m1"
        assert payloads[3] == {"subagent_id": "b", "phase": "message",
                               "message_id": "b-sub-m1", "delta": "y"}

    @pytest.mark.asyncio
    async def test_dispatch_failure_is_silent(self):
        handler = SubagentStreamHandler(subagent_id=TID)
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock, side_effect=RuntimeError):
            await handler.on_llm_new_token("hi", run_id=uuid4())  # must not raise
