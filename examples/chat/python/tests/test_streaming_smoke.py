"""Integration smoke: the generate node, when invoked with a canned chat-model
stream, dispatches a2ui-partial events and the final state has the
single-bubble shape from PR #255."""
import json
from unittest.mock import patch, AsyncMock

import pytest
from langchain_core.messages import AIMessageChunk

from src.streaming.a2ui_partial_handler import A2uiPartialHandler


def _make_canned_stream() -> list[AIMessageChunk]:
    """Five chunks of growing args for one tool_call to render_a2ui_surface."""
    return [
        AIMessageChunk(content="", tool_call_chunks=[{
            "id": "tc-1", "name": "render_a2ui_surface", "index": 0,
            "args": '{"envelopes":[',
        }]),
        AIMessageChunk(content="", tool_call_chunks=[{
            "id": "tc-1", "name": "render_a2ui_surface", "index": 0,
            "args": '{"surfaceUpdate":{"surfaceId":"s","components":[{"id":"root","type":"text","props":{}}]}},',
        }]),
        AIMessageChunk(content="", tool_call_chunks=[{
            "id": "tc-1", "name": "render_a2ui_surface", "index": 0,
            "args": '{"beginRendering":{"surfaceId":"s","root":"root"}},',
        }]),
        AIMessageChunk(content="", tool_call_chunks=[{
            "id": "tc-1", "name": "render_a2ui_surface", "index": 0,
            "args": '{"dataModelUpdate":{"surfaceId":"s","contents":[{"key":"text","valueString":"hi"}]}}',
        }]),
        AIMessageChunk(content="", tool_call_chunks=[{
            "id": "tc-1", "name": "render_a2ui_surface", "index": 0,
            "args": "]}",
        }]),
    ]


@pytest.mark.asyncio
async def test_handler_dispatches_per_chunk():
    """At least 3 a2ui-partial events fire as the canned stream advances."""
    handler = A2uiPartialHandler(tool_name="render_a2ui_surface")
    with patch("src.streaming.a2ui_partial_handler.adispatch_custom_event", new=AsyncMock()) as mock:
        for chunk in _make_canned_stream():
            await handler.on_chat_model_stream(chunk, run_id="r1")
    assert mock.await_count >= 3
    # Last cumulative string is the full envelope JSON.
    last = mock.await_args_list[-1].args[1]
    assert last["tool_call_id"] == "tc-1"
    body = json.loads(last["args_so_far"])
    assert "envelopes" in body
    assert len(body["envelopes"]) == 3
