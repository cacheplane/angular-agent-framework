"""Tests for threadplane.middleware.langgraph.custom_events.

``emit_custom_event`` must reach ``astream_events`` as an ``on_custom_event``,
because that stream is the only path an ``ag-ui-langgraph`` bridge reads. A
``get_stream_writer`` write does not surface there, so the helper wraps
``adispatch_custom_event``.
"""

import asyncio

from langgraph.graph import END, StateGraph
from typing_extensions import TypedDict

from threadplane.middleware.langgraph import emit_custom_event


class _State(TypedDict, total=False):
    value: int


def _build_graph():
    async def node(state: _State, config=None) -> _State:
        # Once with the node's config, once relying on the contextvar.
        await emit_custom_event("analysis_progress", {"pct": 42}, config=config)
        await emit_custom_event("analysis_progress", {"pct": 100})
        return {"value": 1}

    graph = StateGraph(_State)
    graph.add_node("work", node)
    graph.add_edge("__start__", "work")
    graph.add_edge("work", END)
    return graph.compile()


def _collect_custom_events():
    async def run():
        graph = _build_graph()
        seen = []
        async for event in graph.astream_events({"value": 0}, version="v2"):
            if event["event"] == "on_custom_event":
                seen.append((event["name"], event["data"]))
        return seen

    return asyncio.run(run())


def test_emit_custom_event_reaches_astream_events():
    assert _collect_custom_events() == [
        ("analysis_progress", {"pct": 42}),
        ("analysis_progress", {"pct": 100}),
    ]
