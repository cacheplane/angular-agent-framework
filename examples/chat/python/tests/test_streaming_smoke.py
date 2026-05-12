"""Integration smoke: when fed a canned chat-model token stream, the
A2uiPartialHandler writes at least 3 a2ui-partial entries to the
LangGraph stream writer carrying the cumulative tool_call.args string."""
import json
from unittest.mock import patch, MagicMock
from uuid import uuid4

import pytest
from langchain_core.messages import AIMessageChunk
from langchain_core.outputs import ChatGenerationChunk

from src.streaming.a2ui_partial_handler import A2uiPartialHandler


def _make_canned_stream() -> list[ChatGenerationChunk]:
    """Five chunks of growing args for one tool_call to render_a2ui_surface,
    wrapped in ChatGenerationChunk as LangChain emits them from the
    on_llm_new_token callback."""
    deltas = [
        '{"envelopes":[',
        '{"surfaceUpdate":{"surfaceId":"s","components":[{"id":"root","type":"text","props":{}}]}},',
        '{"beginRendering":{"surfaceId":"s","root":"root"}},',
        '{"dataModelUpdate":{"surfaceId":"s","contents":[{"key":"text","valueString":"hi"}]}}',
        "]}",
    ]
    return [
        ChatGenerationChunk(
            text="",
            message=AIMessageChunk(content="", tool_call_chunks=[{
                "id": "tc-1", "name": "render_a2ui_surface", "index": 0,
                "args": delta,
            }]),
        )
        for delta in deltas
    ]


@pytest.mark.asyncio
async def test_handler_writes_per_chunk():
    """At least 3 a2ui-partial entries written to the stream as the canned
    stream advances."""
    handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
    writer = MagicMock()
    with patch("src.streaming.a2ui_partial_handler.get_stream_writer", return_value=writer):
        for chunk in _make_canned_stream():
            await handler.on_llm_new_token("", chunk=chunk, run_id=uuid4())
    assert writer.call_count >= 3
    last = writer.call_args_list[-1].args[0]
    assert last["name"] == "a2ui-partial"
    assert last["data"]["tool_call_id"] == "tc-1"
    body = json.loads(last["data"]["args_so_far"])
    assert "envelopes" in body
    assert len(body["envelopes"]) == 3
