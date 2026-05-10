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
def test_render_demo_form_tool_exists():
    from src.graph import render_demo_form
    assert render_demo_form is not None
    # @tool decorator gives the resulting object a `.name` attribute
    assert render_demo_form.name == "render_demo_form"


@pytest.mark.smoke
def test_state_graph_includes_emit_a2ui_surface_node():
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "emit_a2ui_surface" in nodes
    assert "attach_citations" in nodes
    assert "tools" in nodes
    assert "generate" in nodes


@pytest.mark.smoke
def test_a2ui_jsonl_starts_with_prefix_and_parses():
    import json
    from src.graph import A2UI_PREFIX, FEEDBACK_FORM_JSONL
    assert A2UI_PREFIX == "---a2ui_JSON---", \
        "Prefix must match the chat content-classifier sentinel"
    full = A2UI_PREFIX + "\n" + FEEDBACK_FORM_JSONL
    lines = [ln for ln in full.split("\n") if ln.strip() and ln != A2UI_PREFIX]
    parsed = [json.loads(ln) for ln in lines]
    assert any("surfaceUpdate" in m for m in parsed), \
        "JSONL must include a surfaceUpdate envelope"
    assert any("beginRendering" in m for m in parsed), \
        "JSONL must include a beginRendering envelope"
