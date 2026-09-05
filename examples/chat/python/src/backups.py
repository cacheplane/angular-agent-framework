"""Demo-owned backup inventory and the tools that act on it.

Why this exists: the hero's approval beat used to replay an authored answer,
because after approval the graph had nothing to execute — `request_approval`
was the only relevant tool. These two tools give the model something REAL to
do, against state the demo owns, and put the approval interrupt inside the
destructive tool so it is enforced by code rather than by the system prompt.

The inventory lives in the graph State (see ``State.backups`` in graph.py)
so it rides the checkpoint: per-thread isolated, and it survives the
interrupt, the resume, and a page reload.

The clock is FROZEN. Ages are measured against ``INVENTORY_TODAY`` rather than
``date.today()`` so that "older than 90 days" selects the same rows on every
run — a recording made today must replay the same inventory next year.
"""
import json
from datetime import date
from typing import Annotated

from langchain_core.messages import ToolMessage
from langchain_core.tools import InjectedToolCallId, tool
from langgraph.prebuilt import InjectedState
from langgraph.types import Command, interrupt
from typing_extensions import NotRequired, TypedDict


class Backup(TypedDict):
    id: str
    location: str
    created_at: str  # ISO date, YYYY-MM-DD
    size_gb: float
    retain: NotRequired[bool]


INVENTORY_TODAY = "2026-09-05"

_SEED: list[Backup] = [
    {"id": "bk-2026-08-30-prod", "location": "s3://acme-db-backups/prod/2026-08-30.dump.gz", "created_at": "2026-08-30", "size_gb": 41.2},
    {"id": "bk-2026-08-16-prod", "location": "s3://acme-db-backups/prod/2026-08-16.dump.gz", "created_at": "2026-08-16", "size_gb": 40.7},
    {"id": "bk-2026-07-05-prod", "location": "s3://acme-db-backups/prod/2026-07-05.dump.gz", "created_at": "2026-07-05", "size_gb": 39.1},
    {"id": "bk-2026-05-28-prod", "location": "s3://acme-db-backups/prod/2026-05-28.dump.gz", "created_at": "2026-05-28", "size_gb": 37.8},
    {"id": "bk-2026-04-30-prod", "location": "s3://acme-db-backups/prod/2026-04-30.dump.gz", "created_at": "2026-04-30", "size_gb": 36.4},
    {"id": "bk-2026-03-15-prod", "location": "s3://acme-db-backups/prod/2026-03-15.dump.gz", "created_at": "2026-03-15", "size_gb": 35.0, "retain": True},
    {"id": "bk-2026-02-01-staging", "location": "s3://acme-db-backups/staging/2026-02-01.dump.gz", "created_at": "2026-02-01", "size_gb": 12.3},
    {"id": "bk-2025-12-31-prod", "location": "s3://acme-db-backups/prod/2025-12-31.dump.gz", "created_at": "2025-12-31", "size_gb": 33.6, "retain": True},
]


def seed_backups() -> list[Backup]:
    """A fresh copy of the fixed inventory. Copied so a caller's edits never
    leak into the next thread."""
    return [dict(row) for row in _SEED]  # type: ignore[return-value]


def inventory_of(state: dict) -> list[Backup]:
    """The thread's inventory, or the seed when the thread has none yet."""
    rows = state.get("backups") if isinstance(state, dict) else None
    return list(rows) if rows else seed_backups()


def age_days(backup: Backup) -> int:
    return (date.fromisoformat(INVENTORY_TODAY) - date.fromisoformat(backup["created_at"])).days


def older_than(inventory: list[Backup], days: int) -> list[Backup]:
    return [b for b in inventory if age_days(b) >= days]
