"""Tests for SubagentStreamHandler — forwards each child LLM token as a
`subagent_activity` payload: one `message_start` (carrying the message id)
before the first token of a message, then a `message` per token whose `delta`
is the raw token (no accumulation — the emitter turns these into attributed
TEXT_MESSAGE_START / TEXT_MESSAGE_CONTENT events).

The research subgraph's `agent` node opens each assistant turn itself
(`SubagentRunState.open_message()` + its own `message_start` dispatch) before
invoking the model, so the handler only opens a message when none is open —
the subgraph and the handler never double-announce a turn."""
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from src.streaming.subagent_stream_handler import (
    SubagentRunState,
    SubagentStreamHandler,
)

TID = "call_7sxPY1sC236nPyHRTWAZMJB9"
M1 = f"{TID}-sub-m1"
M2 = f"{TID}-sub-m2"


class TestSubagentRunState:
    def test_open_message_derives_sequential_ids(self):
        state = SubagentRunState(TID)
        assert state.message_id is None
        assert state.open_message() == M1
        assert state.message_id == M1
        assert state.open_message() == M2
        assert state.message_id == M2
        assert state.message_count == 2


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
             {"subagent_id": TID, "phase": "message_start", "message_id": M1}),
            ("subagent_activity",
             {"subagent_id": TID, "phase": "message", "message_id": M1, "delta": "Paris "}),
            ("subagent_activity",
             {"subagent_id": TID, "phase": "message", "message_id": M1, "delta": "is"}),
        ]

    @pytest.mark.asyncio
    async def test_empty_token_emits_nothing(self):
        handler = SubagentStreamHandler(subagent_id=TID)
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock) as dispatch:
            await handler.on_llm_new_token("", run_id=uuid4())
        assert dispatch.call_args_list == []

    @pytest.mark.asyncio
    async def test_tags_the_message_the_subgraph_opened(self):
        # The subgraph opens the turn (and dispatches message_start itself);
        # the handler must reuse that id and NOT re-announce the message.
        run_state = SubagentRunState(TID)
        handler = SubagentStreamHandler(subagent_id=TID, run_state=run_state)
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock) as dispatch:
            run_state.open_message()
            await handler.on_llm_new_token("first", run_id=uuid4())
            # Subgraph advances to the next assistant turn.
            run_state.open_message()
            await handler.on_llm_new_token("sec", run_id=uuid4())
            await handler.on_llm_new_token("ond", run_id=uuid4())
        assert [c.args[1] for c in dispatch.call_args_list] == [
            {"subagent_id": TID, "phase": "message", "message_id": M1, "delta": "first"},
            {"subagent_id": TID, "phase": "message", "message_id": M2, "delta": "sec"},
            {"subagent_id": TID, "phase": "message", "message_id": M2, "delta": "ond"},
        ]

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
