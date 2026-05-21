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
    assert "generate_title" in nodes, \
        "State graph must add a generate_title terminal node"


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
    from src.graph import render_a2ui_surface, generate_json_render_spec
    assert render_a2ui_surface.name == "render_a2ui_surface"
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


import asyncio
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage


class TestGenerateTitle:
    def test_calls_llm_and_writes_metadata_title(self, monkeypatch):
        import src.graph as graph_mod

        updates = []
        title_messages = []
        title_model_kwargs = []

        class FakeThreads:
            async def get(self, thread_id):
                assert thread_id == "thread-1"
                return {"metadata": {}}

            async def update(self, thread_id, metadata):
                updates.append((thread_id, metadata))

        class FakeClient:
            threads = FakeThreads()

        class FakeChatOpenAI:
            def __init__(self, **kwargs):
                title_model_kwargs.append(kwargs)

            async def ainvoke(self, messages):
                title_messages.extend(messages)
                return AIMessage(content='"Plan Kyoto Trip."')

        monkeypatch.setattr(graph_mod, "get_client", lambda url=None: FakeClient())
        monkeypatch.setattr(graph_mod, "ChatOpenAI", FakeChatOpenAI)

        result = asyncio.run(
            graph_mod.generate_title(
                {"messages": [HumanMessage(content="Help me plan a Kyoto trip in April")]},
                {"configurable": {"thread_id": "thread-1"}},
            )
        )

        assert result == {}
        assert updates == [("thread-1", {"title": "Plan Kyoto Trip."})]
        assert title_model_kwargs == [{"model": "gpt-5-mini", "temperature": 0}]
        assert title_messages[-1].content == "Help me plan a Kyoto trip in April"

    def test_skips_when_metadata_title_already_exists(self, monkeypatch):
        import src.graph as graph_mod

        updates = []
        llm_calls = []

        class FakeThreads:
            async def get(self, thread_id):
                return {"metadata": {"title": "Existing title"}}

            async def update(self, thread_id, metadata):
                updates.append((thread_id, metadata))

        class FakeClient:
            threads = FakeThreads()

        class FakeChatOpenAI:
            def __init__(self, **kwargs):
                llm_calls.append(kwargs)

        monkeypatch.setattr(graph_mod, "get_client", lambda url=None: FakeClient())
        monkeypatch.setattr(graph_mod, "ChatOpenAI", FakeChatOpenAI)

        result = asyncio.run(
            graph_mod.generate_title(
                {"messages": [HumanMessage(content="Plan a trip")]},
                {"configurable": {"thread_id": "thread-1"}},
            )
        )

        assert result == {}
        assert updates == []
        assert llm_calls == []


class TestEmitGeneratedSurfaceCoalescing:
    def test_replaces_tool_call_ai_in_place_same_id(self):
        """emit_generated_surface returns an AIMessage with the same id
        as the upstream tool-call AI so add_messages replaces in-place."""
        from src.graph import emit_generated_surface

        tool_call_ai = AIMessage(
            id="ai-1",
            content=[
                {"type": "function_call", "name": "render_a2ui_surface",
                 "arguments": '{"request":"r"}'}
            ],
            tool_calls=[{
                "id": "call_1",
                "name": "render_a2ui_surface",
                "args": {"request": "r"},
                "type": "tool_call",
            }],
        )
        tool_msg = ToolMessage(
            tool_call_id="call_1",
            name="render_a2ui_surface",
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
        assert any(tc.get("name") == "render_a2ui_surface" for tc in replacement_ai.tool_calls)

    def test_beginRendering_envelope_ordering(self):
        """emit reorders the wrapped envelopes so beginRendering lands
        before any dataModelUpdate envelopes."""
        from src.graph import emit_generated_surface

        tool_call_ai = AIMessage(
            id="ai-2",
            content=[],
            tool_calls=[{
                "id": "call_2",
                "name": "render_a2ui_surface",
                "args": {"request": "r"},
                "type": "tool_call",
            }],
        )
        tool_msg = ToolMessage(
            tool_call_id="call_2",
            name="render_a2ui_surface",
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


class TestParentEmitsEnvelopes:
    def test_render_a2ui_surface_is_bound_for_a2ui_mode(self):
        """Sanity: the parent LLM's generate node binds render_a2ui_surface
        when gen_ui_mode='a2ui'. We import the graph module and check the
        tools registered on ToolNode."""
        from src.graph import _builder

        tool_node = _builder.nodes["tools"].runnable
        # ToolNode keeps a `.tools_by_name` dict
        tool_names = list(tool_node.tools_by_name.keys())
        assert "render_a2ui_surface" in tool_names

    def test_generate_a2ui_schema_tool_is_removed(self):
        """The old sub-LLM-dispatching tool must be removed from the graph."""
        from src.graph import _builder
        tool_node = _builder.nodes["tools"].runnable
        tool_names = list(tool_node.tools_by_name.keys())
        assert "generate_a2ui_schema" not in tool_names


import json
from uuid import uuid4


class TestEmitInPlaceCoalescing:
    """Regression: emit_generated_surface MUST coalesce the GenUI turn
    into a single AI message (3-message thread, not 4), preserving the
    upstream tool-call AI's id, tool_calls, additional_kwargs, and
    response_metadata. Envelopes inside the wrapped content MUST be
    ordered surfaceUpdate -> beginRendering -> dataModelUpdate × N."""

    def _run(self, state):
        from src.graph import emit_generated_surface
        return asyncio.run(emit_generated_surface(state))

    def test_post_emit_thread_has_three_messages_not_four(self):
        original_ai_id = str(uuid4())
        tool_call_id = "call_123"
        envelopes = [
            {"dataModelUpdate": {"surfaceId": "s1", "contents": [{"key": "name", "valueString": "Ada"}]}},
            {"surfaceUpdate": {"surfaceId": "s1", "components": [{"id": "c1", "component": {"TextField": {"value": "{$.name}"}}}]}},
            {"beginRendering": {"surfaceId": "s1", "root": "c1"}},
        ]
        tool_call_ai = AIMessage(
            id=original_ai_id,
            content="",
            tool_calls=[{"id": tool_call_id, "name": "render_a2ui_surface", "args": {}, "type": "tool_call"}],
        )
        tool_msg = ToolMessage(
            id="tool_msg_1",
            tool_call_id=tool_call_id,
            content=json.dumps(envelopes),
        )
        state = {"messages": [HumanMessage(content="render a card"), tool_call_ai, tool_msg]}

        result = self._run(state)

        # add_messages will REPLACE the tool message (same id) and the
        # AI message (same id) — net thread length stays 3 after merge.
        # Here we just assert the returned message list is 2 entries
        # (replacements only), both targeting the upstream ids.
        returned = result["messages"]
        assert len(returned) == 2, f"expected 2 replacements, got {len(returned)}: {returned}"
        # ToolMessage replacement keeps its id and tool_call_id
        tool_replacement = next(m for m in returned if isinstance(m, ToolMessage))
        assert tool_replacement.id == tool_msg.id
        assert tool_replacement.tool_call_id == tool_call_id
        # AI replacement keeps the upstream AI id (in-place merge)
        ai_replacement = next(m for m in returned if isinstance(m, AIMessage))
        assert ai_replacement.id == original_ai_id, (
            "AI replacement must reuse upstream tool-call AI id for in-place merge"
        )

    def test_preserves_tool_calls_additional_kwargs_response_metadata(self):
        original_ai_id = str(uuid4())
        tool_call_id = "call_xyz"
        envelopes = [
            {"surfaceUpdate": {"surfaceId": "s1", "components": []}},
            {"beginRendering": {"surfaceId": "s1", "root": "c1"}},
        ]
        tool_call_ai = AIMessage(
            id=original_ai_id,
            content="",
            tool_calls=[{"id": tool_call_id, "name": "render_a2ui_surface", "args": {}, "type": "tool_call"}],
            additional_kwargs={"reasoning": "the user wants a card"},
            response_metadata={"finish_reason": "tool_calls"},
        )
        tool_msg = ToolMessage(id="t1", tool_call_id=tool_call_id, content=json.dumps(envelopes))
        state = {"messages": [HumanMessage(content="x"), tool_call_ai, tool_msg]}

        result = self._run(state)
        ai_replacement = next(m for m in result["messages"] if isinstance(m, AIMessage))
        assert ai_replacement.tool_calls and ai_replacement.tool_calls[0]["id"] == tool_call_id
        assert ai_replacement.additional_kwargs.get("reasoning") == "the user wants a card"
        assert ai_replacement.response_metadata.get("finish_reason") == "tool_calls"

    def test_envelopes_reordered_to_surface_begin_data(self):
        tool_call_id = "call_r"
        envelopes_unordered = [
            {"dataModelUpdate": {"surfaceId": "s1", "contents": [{"key": "n", "valueString": "1"}]}},
            {"dataModelUpdate": {"surfaceId": "s1", "contents": [{"key": "m", "valueString": "2"}]}},
            {"beginRendering": {"surfaceId": "s1", "root": "c1"}},
            {"surfaceUpdate": {"surfaceId": "s1", "components": []}},
        ]
        tool_call_ai = AIMessage(
            id="ai-1",
            content="",
            tool_calls=[{"id": tool_call_id, "name": "render_a2ui_surface", "args": {}, "type": "tool_call"}],
        )
        tool_msg = ToolMessage(id="t-1", tool_call_id=tool_call_id, content=json.dumps(envelopes_unordered))
        state = {"messages": [HumanMessage(content="x"), tool_call_ai, tool_msg]}

        result = self._run(state)
        ai = next(m for m in result["messages"] if isinstance(m, AIMessage))
        # Strip the A2UI_PREFIX wrapper before splitting JSONL.
        lines = [ln for ln in ai.content.split("\n") if ln.strip() and not ln.startswith("---a2ui_JSON---")]
        keys = [list(json.loads(ln).keys())[0] for ln in lines]
        assert keys == ["surfaceUpdate", "beginRendering", "dataModelUpdate", "dataModelUpdate"], (
            f"expected surfaceUpdate -> beginRendering -> dataModelUpdate × N, got {keys}"
        )
