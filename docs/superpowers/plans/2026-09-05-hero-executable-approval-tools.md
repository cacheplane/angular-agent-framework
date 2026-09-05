# Executable Approval Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the demo graph a real backup inventory and two real tools, `list_backups` and `delete_backups`, where the destructive tool interrupts itself for human approval, so the hero's post-approval turn is executed rather than narrated.

**Architecture:** A `backups` channel on the graph `State` carries a seeded inventory through the checkpoint. `list_backups` reads it through `InjectedState` and returns rows as a JSON object; `delete_backups` calls `interrupt()` first, then removes rows via `Command(update=...)`. On the Angular side a `BackupTableComponent` is registered as a tool view under `list_backups` and merged into the A2UI catalog every demo surface already passes. One small lib fix lets a LangGraph tool's JSON-string result reach a tool view as props.

**Tech Stack:** LangGraph 1.1 (Python, `langgraph.prebuilt.ToolNode`, `InjectedState`, `Command`, `interrupt`), pytest, Angular 20 signals, vitest, Playwright recorders, `uv`.

**Spec:** `docs/superpowers/specs/2026-09-04-hero-executable-approval-tools-design.md`

**Prerequisite status:** The spec's blocking bug (duplicate submit → HTTP 400) was root-caused and fixed in PR #1005 (`fix(langgraph): adopt a transport-created thread id instead of aborting the run`, merged 2026-09-05). Nothing in this plan waits on it.

---

## File structure

| File | Responsibility |
|---|---|
| `examples/chat/python/src/backups.py` (new) | Inventory data model, frozen demo clock, seed, helpers, and the two tools. Kept out of `graph.py` so the guardrail is one readable module. |
| `examples/chat/python/src/graph.py` (modify) | `backups` channel on `State`; `SERVER_TOOLS` list shared by `generate` and `ToolNode`; system-prompt paragraph routing cleanup requests to the tools. |
| `examples/chat/python/tests/test_backups.py` (new) | Seeding, filtering, retain refusal, and the interrupt guarantee. |
| `examples/chat/python/tests/test_graph_smoke.py` (modify) | Graph wiring assertions. |
| `examples/chat/python/scripts/measure_approval_turn.py` (new) | Live measurement of the post-approval turn (the spec's gate). |
| `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.ts` (modify) | Parse a JSON-object string result into view props. |
| `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.spec.ts` (modify) | Pin that behaviour. |
| `examples/chat/angular/src/app/backup-table.component.ts` (new) | The registered tool view; three states. |
| `examples/chat/angular/src/app/backup-table.component.spec.ts` (new) | Those three states. |
| `examples/chat/angular/src/app/demo-views.ts` (new) | One registry: A2UI catalog + `list_backups` view, shared by the hero and the three demo modes. |
| `examples/chat/angular/src/app/hero/hero-mode.component.ts`, `modes/{embed,popup,sidebar}-mode.component.ts` (modify) | Use `demoViews()`. |
| `examples/chat/angular/src/app/modes/welcome-suggestions.ts` (modify) | The approval chip sends the hero prompt. |
| `examples/chat/angular/e2e/fixtures/hero-approval.json` (delete), `record-hero.config.ts`, `record-hero-poster-mobile.record.ts`, `hero/hero-script.ts` (modify comments) | The hero fixture is recorded live only; aimock cannot script a two-tool sequence. |
| `examples/chat/angular/public/hero-replay.json` (re-record), `hero/hero-replay.fixture.spec.ts` (modify) | New recording, and the spec that pins its shape. |
| `apps/website/public/screenshots/hero-walkthrough-poster*.webp` (re-record) | Posters show the first streamed reply, which changes. |

---

## Conventions used below

- Python commands run from `examples/chat/python` with `uv run`. The Nx target `npx nx run examples-chat-python:test` runs the whole suite.
- Angular unit tests: `cd examples/chat/angular && npx vitest run <path-fragment>`; lib tests: `cd libs/chat && npx vitest run <path-fragment>`. Nx equivalents: `npx nx test examples-chat-angular`, `npx nx test chat`.
- Commit after every task. All commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Branch: `blove/hero-executable-approval-design-23b7b3` (already carries the spec commit).

---

### Task 1: Backup inventory module and `State` channel

**Files:**
- Create: `examples/chat/python/src/backups.py`
- Modify: `examples/chat/python/src/graph.py` (the `State` class, currently ends with `itinerary: list[Stop]`)
- Test: `examples/chat/python/tests/test_backups.py`

- [ ] **Step 1: Write the failing tests**

```python
# examples/chat/python/tests/test_backups.py
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd examples/chat/python && uv run pytest -q tests/test_backups.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.backups'` and `AssertionError: 'backups' not in State.__annotations__`.

- [ ] **Step 3: Create the module**

```python
# examples/chat/python/src/backups.py
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
from typing import Annotated, Optional

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
```

- [ ] **Step 4: Add the `State` channel**

In `examples/chat/python/src/graph.py`, inside `class State(TypedDict)`, after the `itinerary: list[Stop]` line, add:

```python
    # Demo-owned backup inventory the list_backups / delete_backups tools act
    # on. Seeded from src/backups.py on first use; per-thread checkpoint,
    # last-write-wins (plain key). See the module docstring for why it lives
    # in State rather than in a tool-local variable.
    backups: Optional[list[Backup]]
```

and add the import near the other `src.` imports:

```python
from src.backups import Backup, delete_backups, list_backups
```

(`delete_backups` and `list_backups` do not exist yet — Tasks 2 and 3 add them. Until then, import only `Backup` and add the other two names in Task 4. Keep the import line as `from src.backups import Backup` for this task.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd examples/chat/python && uv run pytest -q tests/test_backups.py tests/test_graph_smoke.py`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/python/src/backups.py examples/chat/python/src/graph.py examples/chat/python/tests/test_backups.py
git commit -m "feat(examples/chat): seed a demo-owned backup inventory into the graph State

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `list_backups` tool

**Files:**
- Modify: `examples/chat/python/src/backups.py`
- Test: `examples/chat/python/tests/test_backups.py`

- [ ] **Step 1: Add a tool-graph helper and the failing tests**

Append to `tests/test_backups.py`:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd examples/chat/python && uv run pytest -q tests/test_backups.py -k list_backups`
Expected: FAIL — `ImportError: cannot import name 'list_backups'`.

- [ ] **Step 3: Implement the tool**

Append to `src/backups.py`:

```python
@tool
def list_backups(
    older_than_days: int,
    state: Annotated[dict, InjectedState],
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> Command:
    """List database backups whose age is at least `older_than_days` days.

    Read-only. Returns JSON with `older_than_days`, the matching `backups`
    (each with id, location, created_at, size_gb, and `retain: true` when
    the backup is under a retention hold and must never be deleted), and
    `total`, the size of the whole inventory. Pass 0 to list everything.
    """
    inventory = inventory_of(state)
    rows = older_than(inventory, older_than_days)
    content = json.dumps(
        {"older_than_days": older_than_days, "backups": rows, "total": len(inventory)}
    )
    # Writes the inventory back even on a read so the FIRST touch seeds the
    # checkpoint: from here on the thread owns its rows explicitly.
    return Command(
        update={
            "backups": inventory,
            "messages": [ToolMessage(content=content, tool_call_id=tool_call_id)],
        }
    )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd examples/chat/python && uv run pytest -q tests/test_backups.py`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/python/src/backups.py examples/chat/python/tests/test_backups.py
git commit -m "feat(examples/chat): list_backups reads the inventory through InjectedState

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `delete_backups` tool — the interrupt is the first statement

**Files:**
- Modify: `examples/chat/python/src/backups.py`
- Test: `examples/chat/python/tests/test_backups.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_backups.py`:

```python
_OLD_DELETABLE = ["bk-2026-05-28-prod", "bk-2026-04-30-prod", "bk-2026-02-01-staging"]


def test_delete_without_approval_interrupts_and_deletes_nothing():
    """The test that carries the whole claim. Mutation-checked: with the
    `interrupt(...)` call removed from delete_backups this MUST fail."""
    from src.backups import delete_backups, inventory_of, seed_backups
    g = _tool_graph(delete_backups)
    cfg = {"configurable": {"thread_id": "del-1"}}
    out = g.invoke(_call("delete_backups", {"ids": _OLD_DELETABLE}), cfg)

    assert "__interrupt__" in out, "delete_backups must pause before doing anything"
    value = out["__interrupt__"][0].value
    assert value["type"] == "approval_request"
    assert isinstance(value["reason"], str)
    for bid in _OLD_DELETABLE:
        assert bid in value["reason"]
    assert value["ids"] == _OLD_DELETABLE

    # Nothing was written: no ToolMessage, and the inventory is still whole.
    assert not any(isinstance(m, ToolMessage) for m in g.get_state(cfg).values["messages"])
    assert inventory_of(g.get_state(cfg).values) == seed_backups()


def test_approval_deletes_exactly_the_named_rows_and_persists():
    from src.backups import delete_backups
    g = _tool_graph(delete_backups)
    cfg = {"configurable": {"thread_id": "del-2"}}
    g.invoke(_call("delete_backups", {"ids": _OLD_DELETABLE}), cfg)
    out = g.invoke(Command(resume="approved"), cfg)

    payload = _last_tool_json(out)
    assert payload["deleted"] == _OLD_DELETABLE
    assert payload["remaining"] == 5
    assert payload["freed_gb"] == pytest.approx(37.8 + 36.4 + 12.3)
    remaining_ids = {b["id"] for b in g.get_state(cfg).values["backups"]}
    assert remaining_ids.isdisjoint(_OLD_DELETABLE)
    assert len(remaining_ids) == 5


@pytest.mark.parametrize("answer", ["denied", "no", "Stop, keep the staging one", ""])
def test_anything_but_approval_deletes_nothing(answer):
    from src.backups import delete_backups, inventory_of, seed_backups
    g = _tool_graph(delete_backups)
    cfg = {"configurable": {"thread_id": f"del-3-{answer!r}"}}
    g.invoke(_call("delete_backups", {"ids": _OLD_DELETABLE}), cfg)
    out = g.invoke(Command(resume=answer), cfg)

    payload = _last_tool_json(out)
    assert payload["deleted"] == []
    assert payload["declined"] is True
    assert payload["human_response"] == answer
    assert inventory_of(g.get_state(cfg).values) == seed_backups()


@pytest.mark.parametrize("answer", ["approved", "Approve", "APPROVED — go ahead", "yes", "ok", "confirm"])
def test_approval_wording_is_recognised(answer):
    from src.backups import delete_backups
    g = _tool_graph(delete_backups)
    cfg = {"configurable": {"thread_id": f"del-4-{answer!r}"}}
    g.invoke(_call("delete_backups", {"ids": ["bk-2026-02-01-staging"]}), cfg)
    out = g.invoke(Command(resume=answer), cfg)
    assert _last_tool_json(out)["deleted"] == ["bk-2026-02-01-staging"]


def test_retained_ids_are_refused_before_any_interrupt():
    from src.backups import delete_backups, inventory_of, seed_backups
    g = _tool_graph(delete_backups)
    cfg = {"configurable": {"thread_id": "del-5"}}
    out = g.invoke(_call("delete_backups", {"ids": ["bk-2026-05-28-prod", "bk-2026-03-15-prod"]}), cfg)

    assert "__interrupt__" not in out, "a refusal must not ask a human to approve it"
    payload = _last_tool_json(out)
    assert payload["deleted"] == []
    assert payload["refused"] == ["bk-2026-03-15-prod"]
    assert "retain" in payload["error"]
    assert inventory_of(g.get_state(cfg).values) == seed_backups()


def test_unknown_ids_are_refused_before_any_interrupt():
    from src.backups import delete_backups
    g = _tool_graph(delete_backups)
    cfg = {"configurable": {"thread_id": "del-6"}}
    out = g.invoke(_call("delete_backups", {"ids": ["bk-nope"]}), cfg)
    assert "__interrupt__" not in out
    payload = _last_tool_json(out)
    assert payload["deleted"] == []
    assert payload["refused"] == ["bk-nope"]


def test_empty_id_list_is_refused():
    from src.backups import delete_backups
    g = _tool_graph(delete_backups)
    cfg = {"configurable": {"thread_id": "del-7"}}
    out = g.invoke(_call("delete_backups", {"ids": []}), cfg)
    assert "__interrupt__" not in out
    assert _last_tool_json(out)["deleted"] == []


def test_approval_reason_is_compact_enough_for_the_hero_dwell():
    """INTERRUPT_DWELL_MS in hero-script.ts is calibrated to a ~40-word
    proposal. The reason for five ids must stay well inside that budget."""
    from src.backups import approval_reason, older_than, seed_backups
    reason = approval_reason(older_than(seed_backups(), 90))
    assert len(reason.split()) <= 60
    assert "bk-2026-05-28-prod" in reason
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd examples/chat/python && uv run pytest -q tests/test_backups.py -k "delete or approval or refused"`
Expected: FAIL — `ImportError: cannot import name 'delete_backups'`.

- [ ] **Step 3: Implement the tool**

Append to `src/backups.py`:

```python
_APPROVAL_WORDS = ("approve", "yes", "ok", "okay", "confirm", "proceed", "go ahead")


def is_approval(response: object) -> bool:
    """True only for an unambiguous yes. Free text that merely mentions
    approval ("approve the prod ones but keep staging") is NOT a yes — the
    model gets the words back and re-plans instead."""
    text = str(response or "").strip().lower()
    if not text:
        return False
    if text.startswith(("approve", "approved")):
        return True
    return text in _APPROVAL_WORDS


def approval_reason(targets: list[Backup]) -> str:
    total_gb = round(sum(b["size_gb"] for b in targets), 1)
    ids = ", ".join(b["id"] for b in targets)
    return (
        f"Delete {len(targets)} backups ({total_gb} GB): {ids}. "
        "This permanently removes them from storage and cannot be undone."
    )


def _refusal(ids: list[str], error: str, tool_call_id: str) -> Command:
    content = json.dumps({"deleted": [], "refused": ids, "error": error})
    return Command(update={"messages": [ToolMessage(content=content, tool_call_id=tool_call_id)]})


@tool
def delete_backups(
    ids: list[str],
    state: Annotated[dict, InjectedState],
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> Command:
    """Permanently delete the backups with these ids.

    This tool PAUSES for the human's approval on its own before deleting
    anything, so do not call `request_approval` first. Pass only ids
    returned by `list_backups`, and never an id whose backup carries
    `retain: true` — the call is refused outright, nothing is deleted, and
    you must call again without it. Returns JSON: `deleted` (ids removed),
    `freed_gb`, and `remaining` (rows left in the inventory). If the human
    declines, `declined` is true, nothing is deleted, and `human_response`
    carries their words so you can adjust the plan.
    """
    # Everything above the interrupt() call is idempotent on purpose:
    # LangGraph re-runs this function on resume, and interrupt() returns the
    # human's answer on that second pass. request_approval in graph.py works
    # the same way and is the precedent.
    inventory = inventory_of(state)
    by_id = {b["id"]: b for b in inventory}
    if not ids:
        return _refusal([], "No ids given; call list_backups first.", tool_call_id)
    unknown = [i for i in ids if i not in by_id]
    if unknown:
        return _refusal(unknown, f"Unknown backup ids: {', '.join(unknown)}. Nothing was deleted.", tool_call_id)
    retained = [i for i in ids if by_id[i].get("retain")]
    if retained:
        return _refusal(
            retained,
            f"Refused: {', '.join(retained)} tagged retain and cannot be deleted. Nothing was deleted.",
            tool_call_id,
        )

    targets = [by_id[i] for i in ids]
    # The guardrail. There is no path to the deletion below that skips this
    # line, so a prompt cannot talk past it and neither can a jailbreak.
    decision = interrupt({"type": "approval_request", "reason": approval_reason(targets), "ids": ids})

    if not is_approval(decision):
        content = json.dumps(
            {"deleted": [], "declined": True, "human_response": str(decision or ""), "remaining": len(inventory)}
        )
        return Command(update={"messages": [ToolMessage(content=content, tool_call_id=tool_call_id)]})

    doomed = set(ids)
    remaining = [b for b in inventory if b["id"] not in doomed]
    content = json.dumps(
        {
            "deleted": ids,
            "freed_gb": round(sum(b["size_gb"] for b in targets), 1),
            "remaining": len(remaining),
        }
    )
    return Command(
        update={
            "backups": remaining,
            "messages": [ToolMessage(content=content, tool_call_id=tool_call_id)],
        }
    )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd examples/chat/python && uv run pytest -q tests/test_backups.py`
Expected: all PASS.

- [ ] **Step 5: Mutation-check the guardrail test**

Temporarily replace the `decision = interrupt(...)` line with `decision = "approved"` and run:

`cd examples/chat/python && uv run pytest -q tests/test_backups.py -k "without_approval"`
Expected: FAIL on `assert "__interrupt__" in out`.

Then restore the line and re-run the file: all PASS. Do not commit the mutation.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/python/src/backups.py examples/chat/python/tests/test_backups.py
git commit -m "feat(examples/chat): delete_backups interrupts for approval before it can delete

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Wire the tools into the graph and the system prompt

**Files:**
- Modify: `examples/chat/python/src/graph.py`
- Test: `examples/chat/python/tests/test_graph_smoke.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_graph_smoke.py`:

```python
@pytest.mark.smoke
def test_backup_tools_are_server_tools():
    from src.graph import SERVER_TOOLS
    names = {t.name for t in SERVER_TOOLS}
    assert {"list_backups", "delete_backups", "request_approval", "search_documents", "research"} <= names


@pytest.mark.smoke
def test_system_prompt_routes_cleanup_to_the_executable_tools():
    from src.graph import SYSTEM_PROMPT
    assert "list_backups" in SYSTEM_PROMPT
    assert "delete_backups" in SYSTEM_PROMPT
    # The destructive tool gates itself; the prompt must not send the model
    # to the generic gate first, or the walkthrough gains a second pause.
    assert "do not call `request_approval` first" in SYSTEM_PROMPT
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd examples/chat/python && uv run pytest -q tests/test_graph_smoke.py`
Expected: FAIL — `ImportError: cannot import name 'SERVER_TOOLS'`.

- [ ] **Step 3: Update the import, the tool lists, and the prompt**

In `graph.py`, change the Task 1 import to:

```python
from src.backups import Backup, delete_backups, list_backups
```

Right after the `research` tool definition (before the `A2UI_PREFIX` comment block), add:

```python
# Server-side tools bound on every turn. generate() appends the ONE GenUI tool
# for the current mode; ToolNode below is bound to both GenUI tools so either
# side of that conditional resolves at execution time.
SERVER_TOOLS = [search_documents, request_approval, research, list_backups, delete_backups]
```

In `generate()`, replace

```python
    llm = bind_client_tools(
        ChatOpenAI(**kwargs),
        [search_documents, request_approval, research, gen_ui_tool],
        state,
    )
```

with

```python
    llm = bind_client_tools(
        ChatOpenAI(**kwargs),
        [*SERVER_TOOLS, gen_ui_tool],
        state,
    )
```

In the builder, replace

```python
_builder.add_node("tools", ToolNode([
    search_documents, request_approval, research,
    render_a2ui_surface, generate_json_render_spec,
]))
```

with

```python
_builder.add_node("tools", ToolNode([
    *SERVER_TOOLS,
    render_a2ui_surface, generate_json_render_spec,
]))
```

In `SYSTEM_PROMPT`, immediately after the sentence ending `"proceed, modify, or stop. "`, insert:

```python
    "Exception — backup cleanup. When the user asks to clean up, prune, or "
    "delete database backups, first call `list_backups` with the age "
    "threshold they gave (in days) to see exactly what qualifies, then call "
    "`delete_backups` with the exact ids you intend to remove, excluding any "
    "row marked `retain: true`. `delete_backups` pauses for the human's "
    "approval by itself, so do not call `request_approval` first. Once the "
    "tool returns, reply in two or three short sentences: what was deleted, "
    "how much space it freed, and what was kept and why. Do not restate the "
    "table and do not propose further steps unless the human declined. "
```

- [ ] **Step 4: Run the whole Python suite**

Run: `cd examples/chat/python && uv run pytest -q`
Expected: all PASS.

- [ ] **Step 5: Boot the dev server once to prove the graph compiles under `langgraph dev`**

Run (from `examples/chat/python`, no API key needed to import):
`uv run python -c "from src.graph import graph; print(sorted(graph.get_graph().nodes))"`
Expected: prints a list containing `tools`, `generate`, `attach_citations`, `generate_title`, `emit_generated_surface`.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/python/src/graph.py examples/chat/python/tests/test_graph_smoke.py
git commit -m "feat(examples/chat): bind list_backups and delete_backups and route cleanup requests to them

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Lib — a JSON-object string result reaches a tool view as props

**Why:** `libs/langgraph/src/lib/agent.fn.ts` `toToolCall()` sets `result` to the ToolMessage `content` verbatim, and LangGraph's `ToolNode` serialises a dict return to a JSON string. `toToolViewSpec` only spreads `result` when it is already an object, so on the LangGraph path a JSON-returning tool's view gets `status` and `args` but never its rows.

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.ts`
- Test: `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add inside the existing `describe('ChatToolViewsComponent', ...)` block, after `'merges result fields on completion'`:

```ts
  it('parses a JSON-object string result into props (LangGraph ToolMessage content)', () => {
    agent.toolCalls.set([
      {
        id: 'c1', name: 'weather_card',
        args: { location: 'San Francisco' },
        status: 'complete',
        result: '{"temperatureF": 68, "conditions": "Sunny"}',
      },
    ] as ToolCall[]);
    const fixture = mountHost(agent, msg);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.temp')?.textContent).toContain('68');
    expect(el.querySelector('.loc')?.textContent).toContain('San Francisco');
    expect(el.querySelector('.tool-result')?.textContent).toContain('true');
  });

  it('leaves a non-object string result alone', () => {
    agent.toolCalls.set([
      { id: 'c1', name: 'weather_card', args: { location: 'SF' }, status: 'complete', result: 'Human response: approved' },
      { id: 'c2', name: 'weather_card', args: { location: 'LA' }, status: 'complete', result: '[1, 2]' },
    ] as ToolCall[]);
    const twoCalls: Message = { id: 'm2', role: 'assistant', content: '', toolCallIds: ['c1', 'c2'] };
    const fixture = mountHost(agent, twoCalls);
    const el = fixture.nativeElement as HTMLElement;
    const temps = Array.from(el.querySelectorAll('.temp')).map((n) => n.textContent?.trim());
    expect(temps).toEqual(['', '']);
    const locs = Array.from(el.querySelectorAll('.loc')).map((n) => n.textContent?.trim());
    expect(locs).toEqual(['SF', 'LA']);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd libs/chat && npx vitest run src/lib/primitives/chat-tool-views`
Expected: the JSON-string test FAILS (`.temp` is empty); the other new test passes already.

- [ ] **Step 3: Implement**

In `chat-tool-views.component.ts`, replace

```ts
function toToolViewSpec(tc: ToolCall): Spec {
  const args = isRecord(tc.args) ? tc.args : {};
  const result = isRecord(tc.result) ? tc.result : {};
```

with

```ts
function toToolViewSpec(tc: ToolCall): Spec {
  const args = isRecord(tc.args) ? tc.args : {};
  const result = resultRecord(tc.result);
```

and add below `toClientToolLifecycle`:

```ts
/**
 * The result as a props record. A LangGraph ToolMessage carries a tool's
 * dict return as a JSON STRING (ToolNode serialises it), so a string that
 * parses to a plain object is spread the same way an object result is.
 * Anything else — prose, arrays, malformed JSON — contributes no props.
 */
function resultRecord(result: unknown): Record<string, unknown> {
  if (isRecord(result)) return result;
  if (typeof result !== 'string') return {};
  const text = result.trim();
  if (!text.startsWith('{')) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
```

Also update the class docstring sentence `Props merge the live `args` (present while the call streams) with the `result` (on completion)` to read `... with the `result` (on completion; a JSON-object string result is parsed first, since that is how a LangGraph ToolMessage carries a dict return)`.

- [ ] **Step 4: Run the tests and lint**

Run: `cd libs/chat && npx vitest run src/lib/primitives/chat-tool-views`
Expected: all PASS.

Run: `npx nx lint chat 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "error|✖" ; echo "exit=$?"`
Expected: no `error` lines (warnings are tolerated; see memory: lint ERRORS vs warnings).

No public export changed, so `generate-api-docs` is not needed.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-tool-views/
git commit -m "fix(chat): parse a JSON-object string tool result into tool-view props

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `BackupTableComponent` — the registered tool view

**Files:**
- Create: `examples/chat/angular/src/app/backup-table.component.ts`
- Test: `examples/chat/angular/src/app/backup-table.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// examples/chat/angular/src/app/backup-table.component.spec.ts
import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BackupTableComponent, type BackupRow } from './backup-table.component';

const ROWS: BackupRow[] = [
  { id: 'bk-2026-05-28-prod', location: 's3://acme-db-backups/prod/2026-05-28.dump.gz', created_at: '2026-05-28', size_gb: 37.8 },
  { id: 'bk-2026-03-15-prod', location: 's3://acme-db-backups/prod/2026-03-15.dump.gz', created_at: '2026-03-15', size_gb: 35, retain: true },
];

function mount(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(BackupTableComponent);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('BackupTableComponent', () => {
  it('shows a pending state while the tool runs and no table', () => {
    const el = mount({ older_than_days: 90, status: 'running' });
    expect(el.querySelector('[data-state]')?.getAttribute('data-state')).toBe('pending');
    expect(el.textContent).toMatch(/Listing backups older than 90 days/);
    expect(el.querySelector('table')).toBeNull();
  });

  it('renders the rows on completion and flags the retained one', () => {
    const el = mount({ older_than_days: 90, status: 'complete', backups: ROWS, total: 8 });
    expect(el.querySelector('[data-state]')?.getAttribute('data-state')).toBe('rows');
    const rows = el.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('bk-2026-05-28-prod');
    expect(rows[0].textContent).toContain('37.8 GB');
    expect(rows[1].querySelector('.bt__retain')?.textContent).toMatch(/retain/i);
    expect(rows[0].querySelector('.bt__retain')).toBeNull();
    expect(el.textContent).toMatch(/2 of 8 backups are older than 90 days/);
  });

  it('says so when nothing matches', () => {
    const el = mount({ older_than_days: 400, status: 'complete', backups: [], total: 8 });
    expect(el.querySelector('[data-state]')?.getAttribute('data-state')).toBe('empty');
    expect(el.textContent).toMatch(/No backups are older than 400 days/);
    expect(el.querySelector('table')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd examples/chat/angular && npx vitest run src/app/backup-table`
Expected: FAIL — cannot resolve `./backup-table.component`.

- [ ] **Step 3: Implement the component**

```ts
// examples/chat/angular/src/app/backup-table.component.ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** One row of the demo graph's backup inventory (examples/chat/python/src/backups.py). */
export interface BackupRow {
  id: string;
  location: string;
  created_at: string;
  size_gb: number;
  retain?: boolean;
}

type ViewState = 'pending' | 'rows' | 'empty';

/**
 * Tool view for the graph's `list_backups` call, registered through
 * `demoViews()`. The chat composition feeds it the call's streaming args
 * (`older_than_days`), the parsed result (`backups`, `total`) and the call
 * `status`, so the SAME component shows "listing…" while the tool runs and
 * the table once it returns — the tool-progress beat needs no extra wiring.
 *
 * Input names mirror the tool's JSON keys on purpose (`older_than_days`):
 * `chat-tool-views` matches props to inputs by their public template name.
 */
@Component({
  selector: 'app-backup-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bt" [attr.data-state]="state()">
      <div class="bt__head">
        @switch (state()) {
          @case ('pending') {
            <span class="bt__title">Listing backups older than {{ olderThanDays() ?? '…' }} days</span>
            <span class="bt__badge">Running…</span>
          }
          @case ('empty') {
            <span class="bt__title">No backups are older than {{ olderThanDays() }} days.</span>
          }
          @default {
            <span class="bt__title">
              {{ backups().length }} of {{ total() ?? backups().length }} backups are older than {{ olderThanDays() }} days
            </span>
          }
        }
      </div>
      @if (state() === 'rows') {
        <table class="bt__table">
          <thead>
            <tr><th>Backup</th><th>Location</th><th>Created</th><th class="bt__num">Size</th></tr>
          </thead>
          <tbody>
            @for (b of backups(); track b.id) {
              <tr [class.bt__row--retain]="b.retain === true">
                <td>
                  <code class="bt__id">{{ b.id }}</code>
                  @if (b.retain) { <span class="bt__retain">retain</span> }
                </td>
                <td class="bt__loc">{{ b.location }}</td>
                <td>{{ b.created_at }}</td>
                <td class="bt__num">{{ b.size_gb }} GB</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: [`
    .bt { margin: 4px 0 8px; padding: 12px 14px; border: 1px solid var(--tplane-chat-separator); border-radius: var(--tplane-chat-radius-card); background: var(--tplane-chat-surface-alt); color: var(--tplane-chat-text); font-size: var(--tplane-chat-font-size-sm); }
    .bt__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .bt__title { font-weight: 600; }
    .bt__badge { flex: none; padding: 2px 8px; border: 1px solid var(--tplane-chat-separator); border-radius: var(--tplane-chat-radius-button); background: color-mix(in srgb, var(--tplane-chat-primary) 12%, var(--tplane-chat-surface-alt)); color: var(--tplane-chat-primary); font-size: var(--tplane-chat-font-size-xs); }
    .bt__table { width: 100%; margin-top: 10px; border-collapse: collapse; }
    .bt__table th { text-align: left; padding: 4px 8px 6px 0; color: var(--tplane-chat-text-muted); font-size: var(--tplane-chat-font-size-xs); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .bt__table td { padding: 5px 8px 5px 0; border-top: 1px solid var(--tplane-chat-separator); vertical-align: top; }
    .bt__num { text-align: right; white-space: nowrap; }
    .bt__id { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: var(--tplane-chat-font-size-xs); }
    .bt__loc { color: var(--tplane-chat-text-muted); font-family: ui-monospace, Menlo, Consolas, monospace; font-size: var(--tplane-chat-font-size-xs); word-break: break-all; }
    .bt__retain { margin-left: 6px; padding: 1px 6px; border-radius: 999px; background: color-mix(in srgb, var(--tplane-chat-warning-text) 14%, var(--tplane-chat-surface-alt)); color: var(--tplane-chat-warning-text); font-size: var(--tplane-chat-font-size-xs); font-weight: 600; }
    .bt__row--retain td { color: var(--tplane-chat-text-muted); }
  `],
})
export class BackupTableComponent {
  readonly olderThanDays = input<number | undefined>(undefined, { alias: 'older_than_days' });
  readonly backups = input<BackupRow[]>([]);
  readonly total = input<number | undefined>(undefined);
  readonly status = input<'pending' | 'running' | 'complete' | 'error' | undefined>(undefined);

  readonly state = computed<ViewState>(() => {
    const s = this.status();
    if (s !== 'complete' && s !== 'error') return 'pending';
    return this.backups().length === 0 ? 'empty' : 'rows';
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd examples/chat/angular && npx vitest run src/app/backup-table`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/backup-table.component.ts examples/chat/angular/src/app/backup-table.component.spec.ts
git commit -m "feat(examples/chat): BackupTableComponent tool view with pending, rows and empty states

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: One `demoViews()` registry for the hero and the three demo modes

**Files:**
- Create: `examples/chat/angular/src/app/demo-views.ts`
- Modify: `examples/chat/angular/src/app/hero/hero-mode.component.ts`, `examples/chat/angular/src/app/modes/embed-mode.component.ts`, `examples/chat/angular/src/app/modes/popup-mode.component.ts`, `examples/chat/angular/src/app/modes/sidebar-mode.component.ts`
- Test: `examples/chat/angular/src/app/demo-views.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// examples/chat/angular/src/app/demo-views.spec.ts
import { describe, expect, it } from 'vitest';
import { a2uiBasicCatalog } from '@threadplane/chat';
import { BackupTableComponent } from './backup-table.component';
import { demoViews } from './demo-views';

describe('demoViews', () => {
  it('keeps every A2UI catalog entry and adds the list_backups tool view', () => {
    const reg = demoViews();
    for (const key of Object.keys(a2uiBasicCatalog())) expect(reg[key]).toBeDefined();
    expect(reg['list_backups']).toBe(BackupTableComponent);
  });

  it('returns a frozen registry', () => {
    expect(Object.isFrozen(demoViews())).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd examples/chat/angular && npx vitest run src/app/demo-views`
Expected: FAIL — cannot resolve `./demo-views`.

- [ ] **Step 3: Create the registry and use it everywhere**

```ts
// examples/chat/angular/src/app/demo-views.ts
import { a2uiBasicCatalog, withViews, type ViewRegistry } from '@threadplane/chat';
import { BackupTableComponent } from './backup-table.component';

/**
 * The view registry every demo surface passes to `<chat [views]>`: the A2UI
 * basic catalog (so `---a2ui_JSON---` messages mount a surface) plus the
 * frontend components registered for specific SERVER tool calls by name.
 * Registering `list_backups` here is what turns that tool's JSON result into
 * a table in the transcript, in the hero and in the demo a visitor takes over.
 */
export function demoViews(): ViewRegistry {
  return withViews(a2uiBasicCatalog(), { list_backups: BackupTableComponent });
}
```

In `hero/hero-mode.component.ts`:
- remove `a2uiBasicCatalog,` from the `@threadplane/chat` import;
- add `import { demoViews } from '../demo-views';`;
- replace `protected readonly catalog = a2uiBasicCatalog();` with `protected readonly catalog = demoViews();`.

In `modes/embed-mode.component.ts`, `modes/popup-mode.component.ts`, `modes/sidebar-mode.component.ts`:
- change the `@threadplane/chat` import to drop `a2uiBasicCatalog` (keep the composition component import);
- add `import { demoViews } from '../demo-views';`;
- replace `protected readonly catalog = a2uiBasicCatalog();` with `protected readonly catalog = demoViews();` and update the comment above it to: `// A2UI catalog + registered tool views — see demo-views.ts.`

- [ ] **Step 4: Run the example's unit suite and a build**

Run: `cd examples/chat/angular && npx vitest run`
Expected: all PASS (the hero-mode spec and mode specs still boot).

Run: `npx nx build examples-chat-angular --configuration=production 2>&1 | tail -15`
Expected: build succeeds; note the bundle size stays inside the production budget (see memory: prod-only bundle budget).

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/demo-views.ts examples/chat/angular/src/app/demo-views.spec.ts examples/chat/angular/src/app/hero/hero-mode.component.ts examples/chat/angular/src/app/modes/
git commit -m "feat(examples/chat): register the list_backups view on the hero and every demo mode

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The approval chip sends the hero prompt; retire the aimock hero fixture

**Files:**
- Modify: `examples/chat/angular/src/app/modes/welcome-suggestions.ts`
- Modify: `examples/chat/angular/src/app/hero/hero-script.ts` (the `HERO_PROMPTS` doc comment)
- Delete: `examples/chat/angular/e2e/fixtures/hero-approval.json`
- Modify: `examples/chat/angular/e2e/record-hero.config.ts`, `examples/chat/angular/e2e/record-hero-poster-mobile.record.ts` (comments)
- Test: `examples/chat/angular/src/app/modes/welcome-suggestions.spec.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `describe` in `welcome-suggestions.spec.ts`:

```ts
  it('the approval chip sends the hero prompt verbatim so the demo runs the same scenario', async () => {
    const { HERO_PROMPTS } = await import('../hero/hero-script');
    const chip = MORE_SUGGESTIONS.find((s) => s.id === 'approve-before-a-destructive');
    expect(chip?.value).toBe(HERO_PROMPTS[0]);
    expect(chip?.value).not.toMatch(/request_approval/);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd examples/chat/angular && npx vitest run src/app/modes/welcome-suggestions.spec`
Expected: FAIL — the chip still names `request_approval`.

- [ ] **Step 3: Update the chip**

In `welcome-suggestions.ts`, replace the `approve-before-a-destructive` entry with:

```ts
  {
    // The id is linked from the website (`section-media.ts`); keep it stable.
    id: 'approve-before-a-destructive',
    label: 'Approve before a destructive action',
    // Byte-identical to HERO_PROMPTS[0]: the demo runs the hero's scenario.
    value: 'Clean up our old database backups, anything older than 90 days.',
    description: 'Lists the backups, then pauses for your approval before deleting any.',
  },
```

- [ ] **Step 4: Retire the aimock hero fixture and fix the comments that point at it**

Delete `examples/chat/angular/e2e/fixtures/hero-approval.json`. aimock matches on `userMessage` + `hasToolResult` only, which cannot script list → delete → resume, so the hero recording is live-only from now on (`record-hero-live.config.ts`).

In `hero/hero-script.ts`, replace the first paragraph of the `HERO_PROMPTS` comment (`The two prompts must stay VERBATIM: aimock fixtures match on the exact user message (see e2e/fixtures/hero-approval.json and contact-form.json), so rewording either one breaks recording.`) with:

```
 * The two prompts must stay VERBATIM. The first is also the demo's
 * "Approve before a destructive action" chip (welcome-suggestions.ts, pinned
 * by its spec) and the recording in public/hero-replay.json was made from it;
 * the second matches the aimock fixture e2e/fixtures/contact-form.json.
```

and replace its last paragraph (`hero-approval.json is a fixture of its OWN ... must not be unified.`) with:

```
 * `interrupt-approval.json` and `record-demo.record.ts` still exercise the
 * older, explicit phrasing of this request on purpose, so the two texts are
 * not byte-identical and must not be unified. The hero itself is recorded
 * LIVE (record-hero-live.config.ts): with real tools behind the pause, the
 * post-approval turn is executed, not scripted, and aimock cannot stage a
 * list → delete → resume sequence.
```

Also update the paragraph that begins `An earlier version of this prompt spelled out` so its final sentence reads: `Verified live against gpt-5-mini before this fixture was written: 12 of 12 runs of the bare prompt paused for approval first, and (after the executable tools landed) every measured run listed the inventory before asking — see scripts/measure_approval_turn.py in the Python package.`

In `e2e/record-hero.config.ts`, replace the header comment with:

```ts
/**
 * Playwright config for the hero POSTER recorders. Mirrors
 * `record-demo.config.ts` — same aimock-backed global setup, so the demo
 * boots without an API key — but captures stills, not a clip.
 *
 * `record-hero-fixture.record.ts` also matches `testMatch`, but must NOT be
 * run through this config: the fixture is recorded against the real model via
 * `record-hero-live.config.ts`, because the post-approval turn now executes
 * real tools and aimock cannot stage that sequence.
 *
 *   npx playwright test --config examples/chat/angular/e2e/record-hero.config.ts record-hero-poster
 */
```

In `e2e/record-hero-poster-mobile.record.ts`, replace the paragraph beginning `The height budget is just as coupled, and to the FIXTURE rather than the replay:` with:

```
 * The height budget is just as coupled, and to the REPLAY: the opening line
 * of the recorded post-approval answer in `public/hero-replay.json` has to fit
 * on ONE line at 390px (about 44 characters) or the whole block shifts up and
 * the first line is sliced off the top edge. Re-check it on every re-record.
```

- [ ] **Step 5: Run the tests**

Run: `cd examples/chat/angular && npx vitest run src/app/modes src/app/hero`
Expected: all PASS.

Run: `grep -rn "hero-approval" examples/ docs/superpowers/plans/2026-09-02-hero-demo-route.md | grep -v "^docs" ; echo "exit=$?"`
Expected: no matches outside `docs/`.

- [ ] **Step 6: Commit**

```bash
git add -A examples/chat/angular/src/app/modes/welcome-suggestions.ts examples/chat/angular/src/app/modes/welcome-suggestions.spec.ts examples/chat/angular/src/app/hero/hero-script.ts examples/chat/angular/e2e/
git commit -m "feat(examples/chat): approval chip runs the hero scenario; hero fixture is recorded live only

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Measurement gate — is the post-approval turn compact with tools in hand?

The spec asserts that real tools make the turn compact. That is a hypothesis; measure it before recording anything.

**Files:**
- Create: `examples/chat/python/scripts/measure_approval_turn.py`

- [ ] **Step 1: Write the script**

```python
# examples/chat/python/scripts/measure_approval_turn.py
"""Measure the hero's post-approval turn against a LIVE backend.

For each run: new thread, send the hero prompt, wait for the interrupt,
resume with "approved", and record which tools were called and how long the
final assistant message is. Prints per-run rows and the median.

    cd examples/chat/python
    export OPENAI_API_KEY=...            # the dev server needs it, not this script
    uv run langgraph dev --port 2024 --no-browser &
    uv run python scripts/measure_approval_turn.py --runs 10

Compare against the figures in
docs/superpowers/specs/2026-09-04-hero-executable-approval-tools-design.md:
the shipped narration was 482 characters; before the tools, the walked-through
prompt produced a median 5,802-character plan. The spec's gate: if this is
still thousands of characters, STOP and rethink rather than trimming by hand.
"""
import argparse
import asyncio
import json
import statistics

from langgraph_sdk import get_client

PROMPT = "Clean up our old database backups, anything older than 90 days."


def _text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    return ""


async def one_run(client, assistant_id: str) -> dict:
    thread = await client.threads.create()
    tid = thread["thread_id"]
    await client.runs.wait(tid, assistant_id, input={"messages": [{"role": "human", "content": PROMPT}]})
    state = await client.threads.get_state(tid)
    interrupted = bool(state.get("tasks") and any(t.get("interrupts") for t in state["tasks"]))
    if interrupted:
        await client.runs.wait(tid, assistant_id, command={"resume": "approved"})
        state = await client.threads.get_state(tid)
    msgs = state["values"]["messages"]
    tools = [tc["name"] for m in msgs if m.get("type") == "ai" for tc in (m.get("tool_calls") or [])]
    final = next((m for m in reversed(msgs) if m.get("type") == "ai" and not m.get("tool_calls")), None)
    text = _text(final.get("content")) if final else ""
    backups = state["values"].get("backups")
    return {
        "thread_id": tid,
        "interrupted": interrupted,
        "tools": tools,
        "chars": len(text),
        "lines": text.count("\n") + 1 if text else 0,
        "remaining": len(backups) if isinstance(backups, list) else None,
        "text": text,
    }


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=10)
    ap.add_argument("--url", default="http://localhost:2024")
    ap.add_argument("--assistant", default="chat")
    ap.add_argument("--show", action="store_true", help="print each final answer")
    args = ap.parse_args()
    client = get_client(url=args.url)
    rows = []
    for i in range(args.runs):
        r = await one_run(client, args.assistant)
        rows.append(r)
        print(f"{i+1:>2}  interrupt={r['interrupted']!s:5}  chars={r['chars']:>5}  lines={r['lines']:>3}  remaining={r['remaining']}  tools={r['tools']}")
        if args.show:
            print("    " + r["text"].replace("\n", "\n    "))
    chars = [r["chars"] for r in rows]
    listed_first = sum(1 for r in rows if r["tools"][:1] == ["list_backups"])
    deleted = sum(1 for r in rows if "delete_backups" in r["tools"])
    print(json.dumps({
        "runs": len(rows),
        "interrupted": sum(1 for r in rows if r["interrupted"]),
        "list_backups_first": listed_first,
        "delete_backups_called": deleted,
        "used_request_approval": sum(1 for r in rows if "request_approval" in r["tools"]),
        "median_chars": statistics.median(chars) if chars else 0,
        "max_chars": max(chars) if chars else 0,
        "remaining_rows_after_approval": sorted({r["remaining"] for r in rows if r["remaining"] is not None}),
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Start the backend with the real key and run the measurement**

```bash
cd examples/chat/python && export OPENAI_API_KEY=$(grep -E '^OPENAI_API_KEY=' ../../../.env | cut -d= -f2-) && (uv run langgraph dev --port 2024 --no-browser > /tmp/lg-measure.log 2>&1 &) && sleep 8 && uv run python scripts/measure_approval_turn.py --runs 10 --show
```

Expected: 10 rows. Success criteria for the gate, all three required:
- `interrupted` = 10 and `used_request_approval` = 0 (the pause comes from `delete_backups`);
- `list_backups_first` = 10 and `delete_backups_called` = 10;
- `median_chars` under ~900 with `max_chars` under ~1,400 (the shipped narration is 482; three short sentences with three or five ids lands around 300–700).

If the median is still in the thousands: STOP. Record the numbers in the spec's Gates section, do not re-record, and report back — the spec says to rethink rather than trim by hand. Do not start Task 10.

If `remaining_rows_after_approval` is anything other than `[5]`, read the `--show` output: the model is either including a retained id (refused → extra round trip) or not deleting all five. Tighten the docstring of `delete_backups` or the prompt paragraph in Task 4, re-run the Python tests, restart the server, and measure again.

- [ ] **Step 3: Record the measurement in the spec**

Append to the `## 5. Gates` section of `docs/superpowers/specs/2026-09-04-hero-executable-approval-tools-design.md`:

```markdown
**Measured 2026-09-05 (10 live runs, gpt-5-mini, `scripts/measure_approval_turn.py`):** interrupt from `delete_backups` in N/10; `list_backups` first in N/10; median post-approval turn X chars / Y lines (max Z). <one sentence: gate passed, recording proceeds / gate failed, stopping.>
```

Fill in the real numbers from Step 2's JSON summary.

- [ ] **Step 4: Stop the backend and commit**

```bash
pkill -f "langgraph dev --port 2024" ; git add examples/chat/python/scripts/measure_approval_turn.py docs/superpowers/specs/2026-09-04-hero-executable-approval-tools-design.md
git commit -m "chore(examples/chat): measure the post-approval turn live and record the result

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Re-record the hero walkthrough and the posters (only if Task 9's gate passed)

**Files:**
- Re-record: `examples/chat/angular/public/hero-replay.json`
- Modify: `examples/chat/angular/src/app/hero/hero-replay.fixture.spec.ts`
- Re-record: `apps/website/public/screenshots/hero-walkthrough-poster.webp`, `apps/website/public/screenshots/hero-walkthrough-poster-mobile.webp`

- [ ] **Step 1: Extend the fixture spec first (it will fail against the old recording)**

In `hero-replay.fixture.spec.ts`, add after `'the prompt run pauses on an interrupt'`:

```ts
  it('the prompt run lists the inventory and pauses inside delete_backups, not request_approval', () => {
    const prompt = JSON.stringify(rec.runs[0].events);
    expect(prompt).toMatch(/"name":\s*"list_backups"/);
    expect(prompt).toMatch(/"name":\s*"delete_backups"/);
    expect(prompt).not.toMatch(/"name":\s*"request_approval"/);
  });
  it('the resume run executes the deletion and answers compactly', () => {
    const resume = JSON.stringify(rec.runs[1].events);
    expect(resume).toMatch(/"deleted":\s*\[/);
    // The whole point of the change: the answer is executed, then summarised.
    // 1,400 chars is the ceiling the measurement gate accepted; see the spec.
    const finalValues = rec.runs[1].events.filter((e) => (e.event as { type?: string }).type === 'values').at(-1);
    const messages = ((finalValues?.event as { messages?: { type?: string; content?: unknown; tool_calls?: unknown[] }[] })?.messages ?? []);
    const last = [...messages].reverse().find((m) => m.type === 'ai' && !(m.tool_calls && m.tool_calls.length));
    const text = typeof last?.content === 'string'
      ? last.content
      : (last?.content as { type?: string; text?: string }[] | undefined)?.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('') ?? '';
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThan(1400);
  });
```

Run: `cd examples/chat/angular && npx vitest run src/app/hero/hero-replay.fixture`
Expected: the two new tests FAIL against the current recording (it calls `request_approval`).

- [ ] **Step 2: Record live**

Three terminals (or background processes), per the header of `record-hero-live.config.ts`:

```bash
cd examples/chat/python && export OPENAI_API_KEY=$(grep -E '^OPENAI_API_KEY=' ../../../.env | cut -d= -f2-) && uv run langgraph dev --port 2024 --no-browser
```

```bash
npx nx serve examples-chat-angular --port 4200
```

```bash
npx playwright test -c examples/chat/angular/e2e/record-hero-live.config.ts record-hero-fixture
```

Expected: `wrote .../public/hero-replay.json`. Take several takes; keep the one whose resume answer is complete and whose opening line is under 44 characters (the mobile poster constraint). Never edit the text inside the recording.

Then: `cd examples/chat/angular && npx vitest run src/app/hero/hero-replay.fixture`
Expected: all PASS.

- [ ] **Step 3: Recalibrate the interrupt dwell comment**

Count the words of the `reason` in the new `hero-replay.json` (`grep -o '"reason": "[^"]*"' public/hero-replay.json | head -1 | wc -w`). Update the `CALIBRATED TO THE PROPOSAL COPY, which is currently ~40 words` sentence in `hero-script.ts` with the real count, and if it exceeds ~55 words raise `INTERRUPT_DWELL_MS` to 5000 and say why in the comment. `test_approval_reason_is_compact_enough_for_the_hero_dwell` in Task 3 keeps the Python side inside the same budget.

- [ ] **Step 4: Run the hero e2e on the committed replay**

Stop the live servers first (memory: never run e2e while a live serve holds the ports):

```bash
pkill -f "langgraph dev --port 2024"; pkill -f "nx serve examples-chat-angular"; lsof -ti :4200 -ti :2024 | xargs -r kill
```

```bash
npx playwright test -c examples/chat/angular/e2e/playwright.config.ts hero.spec.ts interrupt-approval.spec.ts initial-render.spec.ts
```

Expected: all PASS. The hero spec waits for `chat-interrupt-panel` and then an `a2ui-surface`; both still come from runs 0 and 2. The approval panel still renders because the interrupt keeps `{ type: 'approval_request', reason }`.

Also confirm visually that the table renders in the replay: open `http://localhost:4200/hero` from the aimock-backed serve (`npx nx serve examples-chat-angular --port 4200` with no backend is enough for replay mode) and check that an `app-backup-table` element appears before the interrupt panel. A one-liner:

```bash
npx playwright test -c examples/chat/angular/e2e/playwright.config.ts hero.spec.ts -g "reaches the generated UI" --trace on
```

and inspect the trace, or add this assertion to the second hero test right after the interrupt-panel wait and keep it:

```ts
    await expect(page.locator('app-backup-table [data-state="rows"]')).toBeAttached();
```

- [ ] **Step 5: Re-record both posters**

```bash
npx playwright test --config examples/chat/angular/e2e/record-hero.config.ts record-hero-poster
```

Expected: both `record-hero-poster.record.ts` and `record-hero-poster-mobile.record.ts` write their `.webp` files. Check the mobile poster's first answer line is not sliced (open the file), and re-measure the 2800ms wait per the comments in those recorders if the cursor lands on prose.

Run the website checks that guard posters:

```bash
cd apps/website && npx vitest run src/lib/section-media.spec.ts src/lib/positioning
```

Expected: PASS (poster budgets are absolute; see memory `guard-coupled-to-moving-artifact`).

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/public/hero-replay.json examples/chat/angular/src/app/hero/ examples/chat/angular/e2e/hero.spec.ts apps/website/public/screenshots/hero-walkthrough-poster.webp apps/website/public/screenshots/hero-walkthrough-poster-mobile.webp
git commit -m "feat(hero): re-record the walkthrough with the executable approval tools

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Full verification and PR

- [ ] **Step 1: Run every affected check**

```bash
cd examples/chat/python && uv run pytest -q
```
Expected: all PASS.

```bash
npx nx run-many -t lint test --projects=chat,examples-chat-angular 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | tail -30
```
Expected: tests PASS; lint reports no `error` lines.

```bash
npx nx build examples-chat-angular --configuration=production 2>&1 | tail -8
```
Expected: success, budget respected.

```bash
cd apps/website && npx vitest run
```
Expected: PASS (public-copy contract, section-media id cross-check, poster budgets).

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin blove/hero-executable-approval-design-23b7b3
gh pr create --title "feat(examples/chat): executable approval tools behind the hero's pause" --body-file - <<'EOF'
## Why

The hero's approval beat replayed an authored narration describing behaviour the product did not have: after approval the graph had nothing to execute, so the model either asked clarifying questions or wrote a 5,800-character ops document. Spec: `docs/superpowers/specs/2026-09-04-hero-executable-approval-tools-design.md`.

## What

- `examples/chat/python/src/backups.py`: a demo-owned inventory seeded into the graph `State` (rides the checkpoint), `list_backups`, and `delete_backups` whose FIRST statement is `interrupt()` — approval is enforced by code, not by the system prompt. Retained ids are refused before any interrupt.
- `libs/chat` `chat-tool-views`: a JSON-object string result (how a LangGraph ToolMessage carries a dict return) is parsed into view props.
- `BackupTableComponent` registered as the `list_backups` tool view on the hero and all three demo modes via one `demoViews()` registry; the "Approve before a destructive action" chip now runs the same scenario.
- The hero fixture is recorded live only (aimock cannot stage list → delete → resume); `hero-replay.json` and both posters re-recorded.

## Measurement gate

<paste the JSON summary from scripts/measure_approval_turn.py>

## Tests

- Python: seeding, filtering, retain refusal, and `test_delete_without_approval_interrupts_and_deletes_nothing` — mutation-checked by replacing the `interrupt()` call, which turns it red.
- Angular: tool view's three states; registry composition; chip pinned to the hero prompt; replay-fixture spec now requires `list_backups` + `delete_backups` in the prompt run and a compact resume answer.
- Hero, interrupt-approval and initial-render e2e green on the committed replay.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| §3 State: `backups` channel, seeded, per-thread, survives interrupt/resume/reload | Task 1 (channel + seed), Task 2 (first touch writes it), Task 3 (`test_approval_deletes_exactly_the_named_rows_and_persists`) |
| §3 Tools: `list_backups(older_than_days)` via `InjectedState` | Task 2 |
| §3 Tools: `delete_backups(ids)` interrupts BEFORE anything; resume removes via `Command`; declined deletes nothing; hard-refuses `retain` | Task 3 |
| §3 Idempotent pre-interrupt work | Task 3 (pure lookups only before `interrupt()`, documented inline) |
| §3 Keeps `{ type: 'approval_request', reason }` so the panel renders unchanged | Task 3 payload; Task 10 Step 4 e2e |
| §3 Why the guardrail is real | Task 3 Step 5 mutation check |
| §3 `request_approval` stays for the generic case | Task 4 keeps it in `SERVER_TOOLS`; prompt exception paragraph |
| §3 Rendering: registered tool view merged with the A2UI catalog; shows pending then rows | Tasks 5, 6, 7 |
| §3 Reach: demo shell views + welcome chip | Tasks 7, 8 |
| §4 Python tests incl. mutation-checked guardrail; Angular three-state specs; hero e2e on replay | Tasks 1–3, 6, 10 |
| §5 Prerequisite (400) | landed in PR #1005; noted in header |
| §5 Measurement gate before re-recording | Task 9, with an explicit STOP |
| §6 Out of scope (docs guide, cockpit example, title bubble, shared message id) | untouched |

Type consistency: `BackupRow` field names (`id`, `location`, `created_at`, `size_gb`, `retain`) match the Python `Backup` TypedDict and the `list_backups` JSON (`older_than_days`, `backups`, `total`); the view's public input names are `older_than_days` (alias), `backups`, `total`, `status`, which are exactly the props `chat-tool-views` produces after Task 5. `demoViews()` is the single name used in Task 7's four call sites. `SERVER_TOOLS` is the single name used in Task 4's code and test.
