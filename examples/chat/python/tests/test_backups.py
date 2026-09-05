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
