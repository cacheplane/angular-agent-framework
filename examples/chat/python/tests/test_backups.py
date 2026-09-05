"""Backup inventory + the executable approval tools.

The inventory is demo-owned state: seeded from a fixed list against a FROZEN
clock so every thread starts identically and a recording is reproducible.
"""
import json
from typing import Annotated, Optional

import pytest
from langchain_core.messages import AIMessage, ToolMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import Command
from typing_extensions import TypedDict


@pytest.mark.smoke
def test_state_declares_backups_channel():
    from src.graph import State
    assert "backups" in State.__annotations__


def test_seed_is_fixed_and_fresh_per_call():
    from src.backups import seed_backups
    a = seed_backups()
    b = seed_backups()
    assert a == b
    assert a is not b, "callers mutate their copy; the seed must not be shared"
    assert len(a) == 8
    assert all({"id", "location", "created_at", "size_gb"} <= set(row) for row in a)


def test_inventory_of_falls_back_to_seed_when_state_is_empty():
    from src.backups import inventory_of, seed_backups
    assert inventory_of({}) == seed_backups()
    assert inventory_of({"backups": None}) == seed_backups()
    rows = [{"id": "x", "location": "s3://x", "created_at": "2026-01-01", "size_gb": 1.0}]
    assert inventory_of({"backups": rows}) == rows


def test_age_is_measured_against_the_frozen_clock():
    from src.backups import INVENTORY_TODAY, age_days
    assert INVENTORY_TODAY == "2026-09-05"
    assert age_days({"created_at": "2026-09-05"}) == 0
    assert age_days({"created_at": "2026-06-07"}) == 90


def test_older_than_selects_rows_at_or_past_the_threshold():
    from src.backups import older_than, seed_backups
    old = older_than(seed_backups(), 90)
    ids = [b["id"] for b in old]
    assert ids == [
        "bk-2026-05-28-prod",
        "bk-2026-04-30-prod",
        "bk-2026-03-15-prod",
        "bk-2026-02-01-staging",
        "bk-2025-12-31-prod",
    ]
    assert older_than(seed_backups(), 0) == seed_backups()
    assert older_than(seed_backups(), 10_000) == []


def test_two_seed_rows_are_retained_and_both_are_old():
    from src.backups import older_than, seed_backups
    retained = [b["id"] for b in seed_backups() if b.get("retain")]
    assert retained == ["bk-2026-03-15-prod", "bk-2025-12-31-prod"]
    old_ids = {b["id"] for b in older_than(seed_backups(), 90)}
    assert set(retained) <= old_ids, "the retain rule must matter for the 90-day scenario"


class _ToolState(TypedDict):
    messages: Annotated[list, add_messages]
    backups: Optional[list]


def _tool_graph(*tools):
    """A one-node graph around ToolNode with an in-memory checkpointer, so the
    tools run exactly the way the real graph runs them (InjectedState,
    Command updates, interrupts) without an LLM."""
    b = StateGraph(_ToolState)
    b.add_node("tools", ToolNode(list(tools)))
    b.set_entry_point("tools")
    b.add_edge("tools", END)
    return b.compile(checkpointer=MemorySaver())


def _call(name: str, args: dict, call_id: str = "t1") -> dict:
    return {"messages": [AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": call_id}])]}


def _last_tool_json(result: dict) -> dict:
    msg = result["messages"][-1]
    assert isinstance(msg, ToolMessage)
    return json.loads(msg.content)


def test_list_backups_returns_matching_rows_and_seeds_the_thread():
    from src.backups import list_backups, seed_backups
    g = _tool_graph(list_backups)
    cfg = {"configurable": {"thread_id": "list-1"}}
    out = g.invoke(_call("list_backups", {"older_than_days": 90}), cfg)
    payload = _last_tool_json(out)
    assert payload["older_than_days"] == 90
    assert [b["id"] for b in payload["backups"]] == [
        "bk-2026-05-28-prod",
        "bk-2026-04-30-prod",
        "bk-2026-03-15-prod",
        "bk-2026-02-01-staging",
        "bk-2025-12-31-prod",
    ]
    assert payload["total"] == 8
    assert g.get_state(cfg).values["backups"] == seed_backups()


def test_list_backups_reads_the_thread_inventory_not_the_seed():
    from src.backups import list_backups
    g = _tool_graph(list_backups)
    cfg = {"configurable": {"thread_id": "list-2"}}
    only = [{"id": "bk-only", "location": "s3://x", "created_at": "2025-01-01", "size_gb": 1.0}]
    out = g.invoke({**_call("list_backups", {"older_than_days": 1}), "backups": only}, cfg)
    assert [b["id"] for b in _last_tool_json(out)["backups"]] == ["bk-only"]
