"""Smoke tests for the examples/chat backend graph.

These tests intentionally do not invoke the LLM — they verify only that
the graph imports cleanly and exposes the expected state shape.
Live-LLM behavior is exercised by the Angular smoke checklist.
"""

import pytest


@pytest.mark.smoke
def test_graph_imports():
    from src.graph import graph
    assert graph is not None


@pytest.mark.smoke
def test_state_shape_includes_required_channels():
    from src.graph import State
    annotations = State.__annotations__
    assert "messages" in annotations, "State must have a `messages` channel"
    assert "model" in annotations, "State must have a `model` channel"
    assert "reasoning_effort" in annotations, \
        "State must have a `reasoning_effort` channel (Phase 2A)"


@pytest.mark.smoke
def test_state_graph_has_tools_and_attach_citations_nodes():
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "generate" in nodes, "State graph must keep the generate node"
    assert "tools" in nodes, "State graph must add a tools node (Phase 2B)"
    assert "attach_citations" in nodes, \
        "State graph must add an attach_citations terminal node (Phase 2B)"


@pytest.mark.smoke
def test_search_documents_tool_returns_json():
    import json
    from src.graph import search_documents
    result = search_documents.invoke({"query": "signals"})
    assert isinstance(result, str), \
        "search_documents must return a JSON string for ToolMessage compatibility"
    parsed = json.loads(result)
    assert isinstance(parsed, list)
    assert len(parsed) > 0, \
        "Hits list must be non-empty (fallback to first 3 docs when no match)"
    assert "title" in parsed[0]
    assert "url" in parsed[0]
    assert "snippet" in parsed[0]
    assert "id" in parsed[0]


@pytest.mark.smoke
def test_request_approval_tool_exists():
    from src.graph import request_approval
    assert request_approval is not None
    assert request_approval.name == "request_approval"


@pytest.mark.smoke
def test_state_graph_still_includes_attach_citations_node():
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "tools" in nodes
    assert "attach_citations" in nodes


@pytest.mark.smoke
def test_research_tool_exists():
    from src.graph import research, research_subgraph
    assert research is not None
    # @tool decorator gives the resulting object a `.name` attribute
    assert research.name == "research"
    # research_subgraph is the compiled child StateGraph
    assert research_subgraph is not None
    # A compiled LangGraph exposes get_graph() with at least one node
    nodes = set(research_subgraph.get_graph().nodes.keys())
    assert "research_node" in nodes


@pytest.mark.smoke
def test_state_graph_topology_unchanged_after_research():
    # Regression check: Phase 3B must not break Phase 2B / 3A topology.
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "generate" in nodes
    assert "tools" in nodes
    assert "attach_citations" in nodes



@pytest.mark.smoke
def test_genui_tools_exist():
    from src.graph import generate_a2ui_schema, generate_json_render_spec
    assert generate_a2ui_schema.name == "generate_a2ui_schema"
    assert generate_json_render_spec.name == "generate_json_render_spec"


@pytest.mark.smoke
def test_state_graph_has_emit_generated_surface_node():
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "emit_generated_surface" in nodes
    assert "tools" in nodes
    assert "attach_citations" in nodes


@pytest.mark.smoke
def test_state_includes_gen_ui_mode_channel():
    from src.graph import State
    annotations = State.__annotations__
    assert "gen_ui_mode" in annotations, \
        "State must have a gen_ui_mode channel (Phase 5)"


@pytest.mark.smoke
def test_phase4_artifacts_removed():
    """Phase 5 removes Phase 4's hardcoded path entirely."""
    import importlib
    mod = importlib.import_module("src.graph")
    assert not hasattr(mod, "render_demo_form"), \
        "render_demo_form tool should be removed in Phase 5"
    assert not hasattr(mod, "FEEDBACK_FORM_JSONL"), \
        "FEEDBACK_FORM_JSONL constant should be removed in Phase 5"
    assert not hasattr(mod, "emit_a2ui_surface"), \
        "emit_a2ui_surface node should be replaced by emit_generated_surface"


from src.graph import _slice_title


class TestSliceTitle:
    def test_short_text_returned_as_is(self):
        assert _slice_title("hello world") == "hello world"

    def test_long_text_truncated_to_50(self):
        text = "a" * 80
        result = _slice_title(text)
        assert len(result) == 50
        assert result == "a" * 50

    def test_newlines_replaced_with_spaces(self):
        assert _slice_title("hello\nworld") == "hello world"

    def test_emoji_not_split_mid_grapheme(self):
        # The flag-USA emoji is a 2-codepoint regional-indicator sequence.
        # A naive [:50] could land between the two indicators if the
        # 50-char boundary falls there. Slice on grapheme boundary so
        # the flag stays intact.
        text = "x" * 49 + "🇺🇸"
        result = _slice_title(text)
        # At grapheme boundary 50, the flag is either fully present (51 cps)
        # or fully absent (49 'x' chars + truncation). Never mid-flag.
        assert "🇺🇸" in result or result == "x" * 49 or result == "x" * 50

    def test_empty_string_returns_empty(self):
        assert _slice_title("") == ""

    def test_strips_leading_trailing_whitespace(self):
        assert _slice_title("  hello  ") == "hello"


import asyncio
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage


class TestEmitGeneratedSurfaceCoalescing:
    def test_replaces_tool_call_ai_in_place_same_id(self):
        """emit_generated_surface returns an AIMessage with the same id
        as the upstream tool-call AI so add_messages replaces in-place."""
        from src.graph import emit_generated_surface

        tool_call_ai = AIMessage(
            id="ai-1",
            content=[
                {"type": "function_call", "name": "generate_a2ui_schema",
                 "arguments": '{"request":"r"}'}
            ],
            tool_calls=[{
                "id": "call_1",
                "name": "generate_a2ui_schema",
                "args": {"request": "r"},
                "type": "tool_call",
            }],
        )
        tool_msg = ToolMessage(
            tool_call_id="call_1",
            name="generate_a2ui_schema",
            content='[{"surfaceUpdate":{"surfaceId":"s1","components":[]}},'
                    '{"beginRendering":{"surfaceId":"s1","root":""}}]',
        )
        state = {
            "messages": [HumanMessage(content="render a card"), tool_call_ai, tool_msg],
            "gen_ui_mode": "a2ui",
        }

        result = asyncio.run(emit_generated_surface(state))

        # Expect TWO message updates: the tool placeholder + a replacement
        # AIMessage with the SAME id as the upstream tool-call AI.
        msgs = result["messages"]
        assert len(msgs) == 2
        replacement_ai = next(m for m in msgs if isinstance(m, AIMessage))
        assert replacement_ai.id == "ai-1", \
            "Replacement AI must reuse the upstream tool-call AI id for in-place merge"
        # Content carries the wrapped surface payload.
        assert "---a2ui_JSON---" in replacement_ai.content
        # tool_calls is preserved so detection (frontend isGenuiTurn) still fires.
        assert any(tc.get("name") == "generate_a2ui_schema" for tc in replacement_ai.tool_calls)

    def test_beginRendering_envelope_ordering(self):
        """emit reorders the wrapped envelopes so beginRendering lands
        before any dataModelUpdate envelopes."""
        from src.graph import emit_generated_surface

        tool_call_ai = AIMessage(
            id="ai-2",
            content=[],
            tool_calls=[{
                "id": "call_2",
                "name": "generate_a2ui_schema",
                "args": {"request": "r"},
                "type": "tool_call",
            }],
        )
        tool_msg = ToolMessage(
            tool_call_id="call_2",
            name="generate_a2ui_schema",
            content='['
                    '{"surfaceUpdate":{"surfaceId":"s","components":[]}},'
                    '{"dataModelUpdate":{"surfaceId":"s","contents":[]}},'
                    '{"dataModelUpdate":{"surfaceId":"s","contents":[]}},'
                    '{"beginRendering":{"surfaceId":"s","root":""}}'
                    ']',
        )
        state = {"messages": [HumanMessage(content="x"), tool_call_ai, tool_msg],
                 "gen_ui_mode": "a2ui"}

        result = asyncio.run(emit_generated_surface(state))
        replacement_ai = next(m for m in result["messages"] if isinstance(m, AIMessage))

        # Strip prefix + grab JSONL lines
        body = replacement_ai.content.split("---a2ui_JSON---\n", 1)[1].rstrip("\n")
        envelope_lines = body.split("\n")
        # First envelope = surfaceUpdate, SECOND = beginRendering, then dataModelUpdates.
        import json
        parsed = [json.loads(line) for line in envelope_lines]
        assert "surfaceUpdate" in parsed[0]
        assert "beginRendering" in parsed[1], \
            f"beginRendering should follow surfaceUpdate; got {list(parsed[1].keys())}"
        # The remaining dataModelUpdate envelopes follow.
        assert "dataModelUpdate" in parsed[2]
        assert "dataModelUpdate" in parsed[3]
