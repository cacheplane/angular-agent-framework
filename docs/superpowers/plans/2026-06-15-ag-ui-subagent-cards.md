# AG-UI Subagent Cards (F5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a live `chat-subagent` card over the AG-UI transport by speaking the protocol's native ACTIVITY events (`activityType: "subagent"`), end to end through `examples/ag-ui` and a new `cockpit/ag-ui/subagents` capability.

**Architecture:** Three layers. **L3 (graph):** the `research` tool + a `SubagentStreamHandler` emit `subagent_activity` intent via `get_stream_writer` (sending accumulated `text_so_far`). **L2 (owned server transform):** an `ActivityEmittingAgent` subclass overrides the bridge's 1:1 `_dispatch_event` to convert each `subagent_activity` CUSTOM event into an `ACTIVITY_SNAPSHOT`/`ACTIVITY_DELTA` (pure, stateless). **L1 (library):** `@threadplane/ag-ui` reducer gains a generic activities store + `ACTIVITY_SNAPSHOT`/`ACTIVITY_DELTA` handling; `toAgent` projects `activityType === "subagent"` activities to the existing neutral `Subagent` contract, so `chat-subagents` (unchanged) renders the card.

**Tech Stack:** Python (LangGraph + `ag_ui_langgraph` bridge, `ag_ui.core` events, pytest via `uv run pytest -q`), Angular 21 signals (vitest + TestBed), Playwright + aimock e2e, nx.

**Branch:** `ag-ui-subagent-cards` (off `origin/main`; already checked out).

**Spec:** `docs/superpowers/specs/2026-06-15-ag-ui-subagent-cards-design.md` — read it first.

**Standing constraint:** Do **not** persist any reference to the external upstream demo source we compared against in spec/docs/code/comments — no repo name, no product name. (The pip dependency name `ag_ui_langgraph` is fine.)

**Confirmed anchors (already verified):**
- `LangGraphAgent._dispatch_event(self, event) -> event` (sync, 1:1) at `…/ag_ui_langgraph/agent.py:159`; `clone()` returns `Self` at `:139`; `run()` at `:167`. Endpoint loops `async for event in request_agent.run(...)` after `agent.clone()` (`…/ag_ui_langgraph/endpoint.py`).
- `applyPatch<T>(target, ops: readonly JsonPatchOp[]): T` + `JsonPatchOp` already exist at `libs/ag-ui/src/lib/internal/apply-patch.ts` — **reuse**, do not write a new patch helper.
- Reducer store interface `ReducerStore` at `libs/ag-ui/src/lib/reducer.ts:46`; `CUSTOM` case at `:295`; `RUN_STARTED` resets `customEvents` at `:90`. Store init in `toAgent` at `libs/ag-ui/src/lib/to-agent.ts:75`.
- Neutral contract: `Subagent { toolCallId, name?, status: Signal<SubagentStatus>, messages: Signal<Message[]>, state: Signal<Record<string,unknown>> }` at `libs/chat/src/lib/agent/subagent.ts`; `Agent.subagents?` at `libs/chat/src/lib/agent/agent.ts:52`. `chat-subagents` already renders it — **no chat-lib change**.
- Python test convention: `examples/<ex>/python/tests/test_*.py`, run `uv run pytest -q` (target in `project.json`). Mirror `examples/chat/python/tests/test_a2ui_partial_handler.py`.
- Emission template: `examples/ag-ui/python/src/streaming/a2ui_partial_handler.py` (`get_stream_writer()({"name":..,"data":..})`, `RuntimeError` guard, sends accumulated `args_so_far`).
- Capability registry `apps/cockpit/scripts/capability-registry.ts`; next free ag-ui ports 4326/5326. Scaffold to copy: `cockpit/ag-ui/streaming/`. Orchestrator to mirror: `cockpit/chat/subagents/python/src/graph.py`.

---

### Task 1: L2 — `subagent_custom_to_activity` transform + `ActivityEmittingAgent` (spike-gated)

This task both **de-risks the `_dispatch_event` seam** and ships the transport layer. Do it first.

**Files:**
- Create: `examples/ag-ui/python/src/streaming/activity_transform.py`
- Create: `examples/ag-ui/python/tests/test_activity_transform.py`
- Modify: `examples/ag-ui/python/project.json` (add `test` target)
- Modify: `examples/ag-ui/python/src/server.py` (use `ActivityEmittingAgent`)

- [ ] **Step 1: Confirm the ag_ui.core ACTIVITY event field names**

Run (from `examples/ag-ui/python`): `uv run python -c "from ag_ui.core import ActivitySnapshotEvent, ActivityDeltaEvent; print(list(ActivitySnapshotEvent.model_fields)); print(list(ActivityDeltaEvent.model_fields))"`
Expected: prints the field lists. Use the **exact** field names returned (snake_case like `message_id`, `activity_type`, `content`, `patch`, `replace`) in the code below — adjust if they differ.

- [ ] **Step 2: Add a pytest `test` target to project.json**

In `examples/ag-ui/python/project.json`, add a target mirroring `examples/chat/python/project.json`:

```json
"test": {
  "executor": "nx:run-commands",
  "options": { "cwd": "examples/ag-ui/python", "command": "uv run pytest -q" }
}
```

(Match the surrounding JSON shape of the existing targets in that file.)

- [ ] **Step 3: Write the failing transform unit test**

Create `examples/ag-ui/python/tests/test_activity_transform.py`:

```python
"""Tests for subagent_custom_to_activity — maps a `subagent_activity` CUSTOM
event to a native ACTIVITY event (1:1, stateless). Non-subagent events → None."""
from ag_ui.core import CustomEvent, EventType, TextMessageStartEvent
from src.streaming.activity_transform import subagent_custom_to_activity


def _custom(data: dict) -> CustomEvent:
    return CustomEvent(type=EventType.CUSTOM, name="subagent_activity", value=data)


def test_started_maps_to_activity_snapshot():
    ev = subagent_custom_to_activity(_custom(
        {"subagent_id": "tc-1", "phase": "started", "name": "research"}))
    assert ev.type == EventType.ACTIVITY_SNAPSHOT
    assert ev.message_id == "tc-1"
    assert ev.activity_type == "subagent"
    assert ev.content == {"toolCallId": "tc-1", "name": "research", "status": "running", "text": ""}
    assert ev.replace is True


def test_message_maps_to_activity_delta_replace_text():
    ev = subagent_custom_to_activity(_custom(
        {"subagent_id": "tc-1", "phase": "message", "text": "Paris is"}))
    assert ev.type == EventType.ACTIVITY_DELTA
    assert ev.message_id == "tc-1"
    assert ev.patch == [{"op": "replace", "path": "/text", "value": "Paris is"}]


def test_finished_maps_to_activity_delta_replace_status():
    ev = subagent_custom_to_activity(_custom(
        {"subagent_id": "tc-1", "phase": "finished", "status": "complete"}))
    assert ev.type == EventType.ACTIVITY_DELTA
    assert ev.patch == [{"op": "replace", "path": "/status", "value": "complete"}]


def test_non_subagent_event_returns_none():
    assert subagent_custom_to_activity(
        CustomEvent(type=EventType.CUSTOM, name="state_update", value={})) is None
    assert subagent_custom_to_activity(
        TextMessageStartEvent(type=EventType.TEXT_MESSAGE_START, message_id="m", role="assistant")) is None
```

- [ ] **Step 4: Run it to verify it fails**

Run (from `examples/ag-ui/python`): `uv run pytest tests/test_activity_transform.py -q`
Expected: FAIL — `ModuleNotFoundError: src.streaming.activity_transform`.

- [ ] **Step 5: Implement the transform**

Create `examples/ag-ui/python/src/streaming/activity_transform.py`:

```python
"""Maps a `subagent_activity` CUSTOM event (emitted by the research tool /
SubagentStreamHandler via get_stream_writer) to a native AG-UI ACTIVITY event.

Pure and stateless (1:1): the handler sends accumulated `text_so_far`, so each
DELTA carries the full text via JSON-patch `replace` (JSON-patch has no string
append). Anything that is not a `subagent_activity` CUSTOM event returns None.
"""
import json
from typing import Optional

from ag_ui.core import ActivityDeltaEvent, ActivitySnapshotEvent, BaseEvent, EventType

ACTIVITY_TYPE = "subagent"
_CUSTOM_NAME = "subagent_activity"


def subagent_custom_to_activity(event: BaseEvent) -> Optional[BaseEvent]:
    if getattr(event, "type", None) != EventType.CUSTOM:
        return None
    if getattr(event, "name", None) != _CUSTOM_NAME:
        return None
    value = getattr(event, "value", None)
    if isinstance(value, str):  # bridge may JSON-serialize custom values
        value = json.loads(value)
    if not isinstance(value, dict):
        return None

    sid = value.get("subagent_id")
    phase = value.get("phase")
    if not sid or not phase:
        return None

    if phase == "started":
        return ActivitySnapshotEvent(
            type=EventType.ACTIVITY_SNAPSHOT,
            message_id=sid,
            activity_type=ACTIVITY_TYPE,
            content={"toolCallId": sid, "name": value.get("name"), "status": "running", "text": ""},
            replace=True,
        )
    if phase == "message":
        return ActivityDeltaEvent(
            type=EventType.ACTIVITY_DELTA,
            message_id=sid,
            activity_type=ACTIVITY_TYPE,
            patch=[{"op": "replace", "path": "/text", "value": value.get("text", "")}],
        )
    if phase == "finished":
        return ActivityDeltaEvent(
            type=EventType.ACTIVITY_DELTA,
            message_id=sid,
            activity_type=ACTIVITY_TYPE,
            patch=[{"op": "replace", "path": "/status", "value": value.get("status", "complete")}],
        )
    return None
```

(If Step 1 showed camelCase field names, use those instead of `message_id`/`activity_type`.)

- [ ] **Step 6: Run the transform test to verify it passes**

Run: `uv run pytest tests/test_activity_transform.py -q`
Expected: PASS (4 tests).

- [ ] **Step 7: Write the failing seam integration test (de-risk `_dispatch_event`)**

Append to `examples/ag-ui/python/tests/test_activity_transform.py`:

```python
import pytest
from langgraph.graph import StateGraph, END
from langgraph.config import get_stream_writer
from typing_extensions import TypedDict
from ag_ui.core import RunAgentInput
from src.streaming.activity_emitting_agent import ActivityEmittingAgent


class _S(TypedDict):
    messages: list


async def _emit_node(state: _S) -> dict:
    get_stream_writer()({"name": "subagent_activity",
                         "data": {"subagent_id": "tc-1", "phase": "started", "name": "research"}})
    return {"messages": []}


def _tiny_graph():
    g = StateGraph(_S)
    g.add_node("emit", _emit_node)
    g.set_entry_point("emit")
    g.add_edge("emit", END)
    return g.compile()


@pytest.mark.asyncio
async def test_dispatch_event_seam_converts_custom_to_activity():
    agent = ActivityEmittingAgent(name="t", graph=_tiny_graph())
    run_input = RunAgentInput(thread_id="th", run_id="r", messages=[],
                              tools=[], context=[], state={}, forwarded_props={})
    types = [getattr(ev, "type", None) async for ev in agent.run(run_input)]
    assert EventType.ACTIVITY_SNAPSHOT in types
    assert EventType.CUSTOM not in [t for t in types]   # the subagent CUSTOM was replaced
    assert isinstance(agent.clone(), ActivityEmittingAgent)  # clone preserves subclass
```

(Adjust `RunAgentInput(...)` kwargs to the installed model's required fields — run `uv run python -c "from ag_ui.core import RunAgentInput; print(list(RunAgentInput.model_fields))"` if construction errors.)

- [ ] **Step 8: Run it to verify it fails**

Run: `uv run pytest tests/test_activity_transform.py::test_dispatch_event_seam_converts_custom_to_activity -q`
Expected: FAIL — `ModuleNotFoundError: src.streaming.activity_emitting_agent`.

- [ ] **Step 9: Implement `ActivityEmittingAgent`**

Create `examples/ag-ui/python/src/streaming/activity_emitting_agent.py`:

```python
"""LangGraphAgent subclass that converts subagent_activity CUSTOM events to
native AG-UI ACTIVITY events at the bridge's 1:1 dispatch point. Owned transport
adapter — keeps the wire protocol-native without patching the bridge."""
from ag_ui_langgraph import LangGraphAgent
from src.streaming.activity_transform import subagent_custom_to_activity


class ActivityEmittingAgent(LangGraphAgent):
    def _dispatch_event(self, event):
        activity = subagent_custom_to_activity(event)
        return super()._dispatch_event(activity if activity is not None else event)
```

- [ ] **Step 10: Run the seam test to verify it passes**

Run: `uv run pytest tests/test_activity_transform.py -q`
Expected: PASS (5 tests).

**If the seam test fails** because the `subagent_activity` CUSTOM event never reaches `_dispatch_event` in this bridge version (ACTIVITY_SNAPSHOT absent from the collected types but CUSTOM present), STOP and switch to the fallback: implement the override as `async def run(self, input)` wrapping `super().run()`, applying `subagent_custom_to_activity` per event in the loop. Update the test to call that path. Report which seam was used.

- [ ] **Step 11: Wire `server.py` to the new agent**

In `examples/ag-ui/python/src/server.py`, replace the `LangGraphAgent` import + construction:
```python
from src.streaming.activity_emitting_agent import ActivityEmittingAgent
# ...
add_langgraph_fastapi_endpoint(app, ActivityEmittingAgent(name="chat", graph=graph), path="/agent")
```
(Keep `add_langgraph_fastapi_endpoint` import; drop the now-unused `LangGraphAgent` import if nothing else uses it.)

- [ ] **Step 12: Commit**

```bash
git add examples/ag-ui/python/src/streaming/activity_transform.py examples/ag-ui/python/src/streaming/activity_emitting_agent.py examples/ag-ui/python/tests/test_activity_transform.py examples/ag-ui/python/project.json examples/ag-ui/python/src/server.py
git commit -m "feat(ag-ui example): L2 transport — subagent_activity CUSTOM → native ACTIVITY (_dispatch_event)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: L3 — `SubagentStreamHandler` + `research` tool emits intent (examples/ag-ui)

**Files:**
- Create: `examples/ag-ui/python/src/streaming/subagent_stream_handler.py`
- Create: `examples/ag-ui/python/tests/test_subagent_stream_handler.py`
- Modify: `examples/ag-ui/python/src/graph.py` (the `research` tool, ~lines 298-328)

- [ ] **Step 1: Write the failing handler test** (mirrors `test_a2ui_partial_handler.py`)

**Emission API (T1 spike finding):** emit via `adispatch_custom_event("subagent_activity", <data dict>)` from `langchain_core.callbacks`, NOT `get_stream_writer`. This bridge drives the graph with `astream_events` and turns `on_custom_event` callbacks into AG-UI `CUSTOM` events; `get_stream_writer` surfaces only as a RAW event that never reaches the `_dispatch_event` seam. `adispatch_custom_event` is async and picks up the ambient run config from contextvars (no explicit `config` needed inside a node/tool/LLM-callback). Verify the import path with `cd examples/ag-ui/python && uv run python -c "from langchain_core.callbacks import adispatch_custom_event; print('ok')"`.

Create `examples/ag-ui/python/tests/test_subagent_stream_handler.py`:

```python
"""Tests for SubagentStreamHandler — accumulates child LLM text tokens and
emits `subagent_activity` `message` events carrying the full `text_so_far`."""
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from src.streaming.subagent_stream_handler import SubagentStreamHandler


class TestSubagentStreamHandler:
    @pytest.mark.asyncio
    async def test_emits_accumulated_text_so_far(self):
        handler = SubagentStreamHandler(subagent_id="tc-1")
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock) as dispatch:
            await handler.on_llm_new_token("Paris ", run_id=uuid4())
            await handler.on_llm_new_token("is", run_id=uuid4())
        assert dispatch.call_args_list[0].args == (
            "subagent_activity", {"subagent_id": "tc-1", "phase": "message", "text": "Paris "})
        assert dispatch.call_args_list[1].args == (
            "subagent_activity", {"subagent_id": "tc-1", "phase": "message", "text": "Paris is"})

    @pytest.mark.asyncio
    async def test_buffers_isolated_across_instances(self):
        h1, h2 = SubagentStreamHandler("a"), SubagentStreamHandler("b")
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock) as dispatch:
            await h1.on_llm_new_token("x", run_id=uuid4())
            await h2.on_llm_new_token("y", run_id=uuid4())
        assert dispatch.call_args_list[0].args[1]["text"] == "x"
        assert dispatch.call_args_list[1].args[1]["text"] == "y"

    @pytest.mark.asyncio
    async def test_dispatch_failure_is_silent(self):
        handler = SubagentStreamHandler(subagent_id="tc-1")
        with patch("src.streaming.subagent_stream_handler.adispatch_custom_event",
                   new_callable=AsyncMock, side_effect=RuntimeError):
            await handler.on_llm_new_token("hi", run_id=uuid4())  # must not raise
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `examples/ag-ui/python`): `uv run pytest tests/test_subagent_stream_handler.py -q`
Expected: FAIL — `ModuleNotFoundError: src.streaming.subagent_stream_handler`.

- [ ] **Step 3: Implement the handler**

Create `examples/ag-ui/python/src/streaming/subagent_stream_handler.py`:

```python
"""Taps a child subagent LLM's text tokens and emits them as `subagent_activity`
`message` events, keyed by the parent tool_call_id. Accumulates `text_so_far`
so the L2 transform stays stateless. `started`/`finished` are emitted by the
research tool body. Uses adispatch_custom_event (the bridge reads on_custom_event
from astream_events; get_stream_writer would surface only as a RAW event)."""
from typing import Any
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler, adispatch_custom_event


class SubagentStreamHandler(AsyncCallbackHandler):
    def __init__(self, subagent_id: str) -> None:
        self._id = subagent_id
        self._buffer = ""

    async def on_llm_new_token(self, token: str, *, run_id: UUID | None = None, **kwargs: Any) -> None:
        if not token:
            return
        self._buffer += token
        try:
            await adispatch_custom_event(
                "subagent_activity",
                {"subagent_id": self._id, "phase": "message", "text": self._buffer},
            )
        except Exception:
            return  # no ambient run context (e.g. some unit-test paths) — emit best-effort
```
(Confirm the `adispatch_custom_event` import path in Step 2½ above; if it's `langchain_core.callbacks.manager`, import from there and patch that path in the test.)

- [ ] **Step 4: Run the handler test to verify it passes**

Run: `uv run pytest tests/test_subagent_stream_handler.py -q`
Expected: PASS (3 tests).

- [ ] **Step 5: Update the `research` tool to emit lifecycle + attach the handler**

In `examples/ag-ui/python/src/graph.py`, replace the `research` tool (currently ~lines 298-328). Add imports near the top (with the other `langchain_core`/`langgraph` imports):
```python
from langchain_core.tools import InjectedToolCallId
from langchain_core.callbacks import adispatch_custom_event
from src.streaming.subagent_stream_handler import SubagentStreamHandler
```
Replace the tool body:
```python
@tool
async def research(
    topic: str,
    tool_call_id: Annotated[str, InjectedToolCallId],
    subagent_type: str = "research",
) -> str:
    """Dispatch a research subagent to gather facts on a focused topic.
    The subagent returns a concise summary; pass that summary back to the user,
    citing it with the inline citation syntax if appropriate. The subagent run
    is surfaced to the UI as a native AG-UI ACTIVITY (activityType "subagent")."""

    async def _emit(payload: dict) -> None:
        try:
            await adispatch_custom_event("subagent_activity", {"subagent_id": tool_call_id, **payload})
        except Exception:
            pass

    await _emit({"phase": "started", "name": subagent_type})
    result = await research_subgraph.ainvoke(
        {"topic": topic, "messages": []},
        config={"callbacks": [SubagentStreamHandler(tool_call_id)]},
    )
    await _emit({"phase": "finished", "status": "complete"})

    msgs = result.get("messages") if isinstance(result, dict) else None
    if not msgs:
        return "(no research returned)"
    last = msgs[-1]
    content = getattr(last, "content", None) if not isinstance(last, dict) else last.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
        return "\n".join(parts) if parts else "(no research returned)"
    return "(no research returned)"
```

- [ ] **Step 6: Smoke-import the graph to catch syntax/import errors**

Run (from `examples/ag-ui/python`): `uv run python -c "import src.graph"`
Expected: no error (exit 0).

- [ ] **Step 7: Commit**

```bash
git add examples/ag-ui/python/src/streaming/subagent_stream_handler.py examples/ag-ui/python/tests/test_subagent_stream_handler.py examples/ag-ui/python/src/graph.py
git commit -m "feat(ag-ui example): L3 graph — research tool emits subagent_activity (started/message/finished)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: L1 — generic activities store + ACTIVITY reducer cases (`@threadplane/ag-ui`)

**Files:**
- Modify: `libs/ag-ui/src/lib/reducer.ts` (store interface + RUN_STARTED + two new cases)
- Test: `libs/ag-ui/src/lib/reducer.spec.ts`

- [ ] **Step 1: Write the failing reducer tests**

Append to `libs/ag-ui/src/lib/reducer.spec.ts` (match the file's existing `makeStore()`/`reduceEvent` harness — inspect a neighboring test for the exact store-factory + event-shape helpers; the casts below assume `reduceEvent(event, store)`):

```ts
describe('ACTIVITY events (F5 subagent activities)', () => {
  it('ACTIVITY_SNAPSHOT creates an activity entry keyed by messageId', () => {
    const store = makeStore();
    reduceEvent({ type: 'ACTIVITY_SNAPSHOT', messageId: 'tc-1', activityType: 'subagent',
      content: { toolCallId: 'tc-1', name: 'research', status: 'running', text: '' }, replace: true } as never, store);
    const entry = store.activities().get('tc-1');
    expect(entry?.activityType).toBe('subagent');
    expect(entry?.content()).toEqual({ toolCallId: 'tc-1', name: 'research', status: 'running', text: '' });
  });

  it('ACTIVITY_DELTA applies a JSON-patch to the entry content (live)', () => {
    const store = makeStore();
    reduceEvent({ type: 'ACTIVITY_SNAPSHOT', messageId: 'tc-1', activityType: 'subagent',
      content: { status: 'running', text: '' } } as never, store);
    reduceEvent({ type: 'ACTIVITY_DELTA', messageId: 'tc-1', activityType: 'subagent',
      patch: [{ op: 'replace', path: '/text', value: 'Paris is' }] } as never, store);
    expect(store.activities().get('tc-1')?.content()['text']).toBe('Paris is');
    reduceEvent({ type: 'ACTIVITY_DELTA', messageId: 'tc-1', activityType: 'subagent',
      patch: [{ op: 'replace', path: '/status', value: 'complete' }] } as never, store);
    expect(store.activities().get('tc-1')?.content()['status']).toBe('complete');
  });

  it('ACTIVITY_DELTA for an unknown messageId is ignored', () => {
    const store = makeStore();
    reduceEvent({ type: 'ACTIVITY_DELTA', messageId: 'nope', activityType: 'subagent',
      patch: [{ op: 'replace', path: '/text', value: 'x' }] } as never, store);
    expect(store.activities().size).toBe(0);
  });

  it('two concurrent subagents are keyed independently', () => {
    const store = makeStore();
    reduceEvent({ type: 'ACTIVITY_SNAPSHOT', messageId: 'a', activityType: 'subagent', content: { text: '' } } as never, store);
    reduceEvent({ type: 'ACTIVITY_SNAPSHOT', messageId: 'b', activityType: 'subagent', content: { text: '' } } as never, store);
    reduceEvent({ type: 'ACTIVITY_DELTA', messageId: 'a', activityType: 'subagent',
      patch: [{ op: 'replace', path: '/text', value: 'AAA' }] } as never, store);
    expect(store.activities().get('a')?.content()['text']).toBe('AAA');
    expect(store.activities().get('b')?.content()['text']).toBe('');
  });

  it('RUN_STARTED resets activities', () => {
    const store = makeStore();
    reduceEvent({ type: 'ACTIVITY_SNAPSHOT', messageId: 'a', activityType: 'subagent', content: {} } as never, store);
    reduceEvent({ type: 'RUN_STARTED' } as never, store);
    expect(store.activities().size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test ag-ui -- --run -t "ACTIVITY events"`
Expected: FAIL — `store.activities` is not a function (field doesn't exist).

- [ ] **Step 3: Add the `ActivityEntry` type + store field**

In `libs/ag-ui/src/lib/reducer.ts`, add near the `CustomStreamEvent` interface (~line 39):
```ts
/** A native AG-UI ACTIVITY (typed, identified, incrementally-streamed sub-process).
 *  Generic — keyed by messageId, grouped by activityType. toAgent projects
 *  activityType==='subagent' to the neutral Subagent contract. */
export interface ActivityEntry {
  messageId: string;
  activityType: string;
  content: WritableSignal<Record<string, unknown>>;
}
```
Add to the `ReducerStore` interface (after `customEvents`):
```ts
  activities: WritableSignal<Map<string, ActivityEntry>>;
```
Add the `signal` import if not present (the file already imports Angular signals via the store factory usage — `signal` is used in `to-agent.ts`; in `reducer.ts` add `import { signal } from '@angular/core';` if not already imported).

- [ ] **Step 4: Reset activities on RUN_STARTED**

In the `RUN_STARTED` case (~line 90), after `store.customEvents.set([]);` add:
```ts
      store.activities.set(new Map());
```

- [ ] **Step 5: Add the two ACTIVITY cases**

In `reduceEvent`'s switch, add before the `default:` case:
```ts
    case 'ACTIVITY_SNAPSHOT': {
      const e = event as unknown as {
        messageId: string; activityType: string;
        content: Record<string, unknown>; replace?: boolean;
      };
      const map = new Map(store.activities());
      const existing = map.get(e.messageId);
      if (existing && existing.activityType === e.activityType && !e.replace) {
        existing.content.update((c) => ({ ...c, ...e.content }));
      } else {
        map.set(e.messageId, {
          messageId: e.messageId,
          activityType: e.activityType,
          content: signal<Record<string, unknown>>(e.content ?? {}),
        });
      }
      store.activities.set(map);   // new ref → projection picks up membership change
      return;
    }
    case 'ACTIVITY_DELTA': {
      const e = event as unknown as {
        messageId: string; patch: readonly JsonPatchOp[];
      };
      const entry = store.activities().get(e.messageId);
      if (!entry) return;          // unknown activity — ignore
      entry.content.update((c) => applyPatch(c, e.patch));  // inner signal → live, no map churn
      return;
    }
```
(`applyPatch`/`JsonPatchOp` are already imported at the top of `reducer.ts`.)

- [ ] **Step 6: Add the store field to `to-agent.ts` init**

In `libs/ag-ui/src/lib/to-agent.ts`, in the `store` object (~line 75), after `customEvents: signal<CustomStreamEvent[]>([]),` add:
```ts
    activities:   signal<Map<string, ActivityEntry>>(new Map()),
```
Add `ActivityEntry` to the import from `./reducer`.

- [ ] **Step 7: Run the reducer tests to verify they pass**

Run: `npx nx test ag-ui -- --run -t "ACTIVITY events"`
Expected: PASS (5 tests).

- [ ] **Step 8: Run the full ag-ui suite (no regressions)**

Run: `npx nx test ag-ui -- --run`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add libs/ag-ui/src/lib/reducer.ts libs/ag-ui/src/lib/reducer.spec.ts libs/ag-ui/src/lib/to-agent.ts
git commit -m "feat(ag-ui): L1 reducer — generic ACTIVITY store + SNAPSHOT/DELTA handling

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: L1 — project `activityType:'subagent'` activities to `Agent.subagents`

**Files:**
- Modify: `libs/ag-ui/src/lib/to-agent.ts` (add `subagents` to the returned `AgUiAgent`)
- Modify: `libs/ag-ui/src/lib/to-agent.ts` (the `AgUiAgent` type if it locally re-declares the return shape — otherwise `Agent.subagents?` already covers it)
- Test: `libs/ag-ui/src/lib/to-agent.spec.ts`

- [ ] **Step 1: Write the failing projection tests**

Append to `libs/ag-ui/src/lib/to-agent.spec.ts` (use the file's existing `StubAgent`/`toAgent(...)` harness; `source.emit(event)` pushes an event through the reducer):

```ts
describe('subagents projection (F5)', () => {
  function snapshot(id: string, name: string) {
    return { type: 'ACTIVITY_SNAPSHOT', messageId: id, activityType: 'subagent',
      content: { toolCallId: id, name, status: 'running', text: '' }, replace: true };
  }
  it('projects a subagent activity to Agent.subagents', () => {
    const source = new StubAgent();
    const agent = toAgent(source as never);
    source.emit(snapshot('tc-1', 'research') as never);
    const sa = agent.subagents!().get('tc-1');
    expect(sa?.toolCallId).toBe('tc-1');
    expect(sa?.name).toBe('research');
    expect(sa?.status()).toBe('running');
    expect(sa?.messages()).toEqual([{ id: 'tc-1', role: 'assistant', content: '' }]);
  });
  it('text deltas flow into the subagent message; finished flips status', () => {
    const source = new StubAgent();
    const agent = toAgent(source as never);
    source.emit(snapshot('tc-1', 'research') as never);
    const before = agent.subagents!().get('tc-1');
    source.emit({ type: 'ACTIVITY_DELTA', messageId: 'tc-1', activityType: 'subagent',
      patch: [{ op: 'replace', path: '/text', value: 'Paris is the capital' }] } as never);
    expect(agent.subagents!().get('tc-1')?.messages()[0].content).toBe('Paris is the capital');
    source.emit({ type: 'ACTIVITY_DELTA', messageId: 'tc-1', activityType: 'subagent',
      patch: [{ op: 'replace', path: '/status', value: 'complete' }] } as never);
    expect(agent.subagents!().get('tc-1')?.status()).toBe('complete');
    // stable identity: same wrapper instance across deltas
    expect(agent.subagents!().get('tc-1')).toBe(before);
  });
  it('ignores non-subagent activityTypes', () => {
    const source = new StubAgent();
    const agent = toAgent(source as never);
    source.emit({ type: 'ACTIVITY_SNAPSHOT', messageId: 'x', activityType: 'open-generative-ui',
      content: {} } as never);
    expect(agent.subagents!().size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test ag-ui -- --run -t "subagents projection"`
Expected: FAIL — `agent.subagents` is undefined.

- [ ] **Step 3: Implement the projection**

In `libs/ag-ui/src/lib/to-agent.ts`, add imports: `computed` from `@angular/core`, and `Subagent`, `SubagentStatus`, `Message` types from `@threadplane/chat` (match how the file imports neutral types — they may already be imported). Before the `return { ... }`, add a stable-wrapper cache + builder:
```ts
  // Stable Subagent wrappers per messageId so chat-subagents (tracks by
  // toolCallId) doesn't churn as activity content streams.
  const subagentWrappers = new Map<string, Subagent>();
  function subagentFor(id: string, entry: ActivityEntry): Subagent {
    let w = subagentWrappers.get(id);
    if (!w) {
      w = {
        toolCallId: (entry.content()['toolCallId'] as string) ?? id,
        name: entry.content()['name'] as string | undefined,
        status: computed(() => (entry.content()['status'] as SubagentStatus) ?? 'running'),
        messages: computed<Message[]>(() => [
          { id, role: 'assistant', content: String(entry.content()['text'] ?? '') },
        ]),
        state: computed(() => (entry.content()['state'] as Record<string, unknown>) ?? {}),
      };
      subagentWrappers.set(id, w);
    }
    return w;
  }
```
Add to the returned object (near `customEvents: store.customEvents,`):
```ts
    subagents: computed<Map<string, Subagent>>(() => {
      const out = new Map<string, Subagent>();
      for (const [id, entry] of store.activities()) {
        if (entry.activityType !== 'subagent') continue;
        out.set(id, subagentFor(id, entry));
      }
      return out;
    }),
```
If `AgUiAgent` (the interface this function returns) is declared locally in `to-agent.ts`, add `subagents: Signal<Map<string, Subagent>>;` to it. (`Agent.subagents?` is already optional in the base contract.)

- [ ] **Step 4: Run the projection tests to verify they pass**

Run: `npx nx test ag-ui -- --run -t "subagents projection"`
Expected: PASS (3 tests).

- [ ] **Step 5: Full ag-ui suite + build**

Run: `npx nx run-many -t test,build -p ag-ui -- --run`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add libs/ag-ui/src/lib/to-agent.ts libs/ag-ui/src/lib/to-agent.spec.ts
git commit -m "feat(ag-ui): L1 — project subagent activities to Agent.subagents (stable identity)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: examples/ag-ui e2e — subagent card renders live (aimock)

**Files:**
- Create: `examples/ag-ui/angular/e2e/subagent-card.spec.ts`
- Create/extend: `examples/ag-ui/angular/e2e/fixtures/subagent.json` (aimock fixture with the research tool call + `subagent_activity` custom writes)
- Reference: `examples/ag-ui/angular/e2e/test-helpers.ts`, an existing spec (e.g. `interrupt-approval.spec.ts`) for the aimock harness + fixture format.

- [ ] **Step 1: Author the aimock fixture**

Create `examples/ag-ui/angular/e2e/fixtures/subagent.json` capturing a research run: the orchestrator emits a `research` tool call (id `tc-1`), the backend emits `subagent_activity` custom writes (`started` → `message`×N with growing text → `finished`), and a final assistant message citing the summary. Mirror the structure of an existing fixture in that folder (inspect one first; match its top-level shape and the AG-UI event encoding the aimock harness replays). The child research text MUST be distinct from the main answer text so the isolation assertion is meaningful (e.g. child text `"Louvre: opened 1793; ~35,000 works."`, main answer references it without quoting it verbatim).

- [ ] **Step 2: Write the failing e2e spec**

Create `examples/ag-ui/angular/e2e/subagent-card.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

test('research delegation renders a live subagent card that settles complete', async ({ page }) => {
  await openDemo(page);
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill('Research the Louvre and summarize');
  await page.getByRole('button', { name: /send/i }).click();

  // A subagent card appears (chat-subagents primitive).
  const card = page.locator('chat-subagents');
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText(/research/i);

  // The child research text must NOT leak into the main assistant message bubble.
  const mainBubble = page.locator('chat-message[data-role="assistant"]').last();
  await expect(mainBubble).not.toContainText('opened 1793; ~35,000 works');

  // The run completes — the card leaves the active (pending/running) set.
  await expect(card).toBeHidden({ timeout: 30_000 });
});
```
(Adjust selectors to the example's actual DOM — confirm `chat-subagents`, the assistant bubble selector, and `openDemo`'s signature against `test-helpers.ts` and a neighboring spec.)

- [ ] **Step 3: Run it to verify it fails (or errors on the fixture)**

Run: `NX_DAEMON=false npx nx e2e examples-ag-ui-angular --grep "subagent card"`
Expected: FAIL — card never appears (lib + backend not yet exercised together) or fixture mismatch. (Ports :8000/:4201 free; `rm -rf .nx/workspace-data` + `NX_DAEMON=false` if nx lock; regen license key if missing — see `examples/ag-ui/angular/e2e/README.md`.)

- [ ] **Step 4: Make it pass**

The lib (Tasks 3-4) and backend (Tasks 1-2) already implement the behavior; getting green here is about the **fixture** faithfully replaying `ACTIVITY_*` (post-L2 transform) or the raw `subagent_activity` custom writes the aimock harness feeds through the real `ActivityEmittingAgent`. Determine which layer aimock replays at (inspect the harness): if it replays the backend's emitted wire events, the fixture must contain ACTIVITY events; if it replays LLM responses and runs the real graph+server, the fixture contains the LLM turns and the live server produces ACTIVITY. Adjust the fixture accordingly until the spec passes.

- [ ] **Step 5: Run the full examples/ag-ui e2e (no regressions)**

Run: `NX_DAEMON=false npx nx e2e examples-ag-ui-angular`
Expected: all specs green (existing + the new one).

- [ ] **Step 6: Commit**

```bash
git add examples/ag-ui/angular/e2e/subagent-card.spec.ts examples/ag-ui/angular/e2e/fixtures/subagent.json
git commit -m "test(ag-ui example): e2e — research subagent renders a live card, child text isolated

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: cockpit `ag-ui/subagents` capability

**Files:**
- Create: `cockpit/ag-ui/subagents/**` (copy `cockpit/ag-ui/streaming/` scaffold, adapt)
- Modify: `apps/cockpit/scripts/capability-registry.ts` (registry entry)

- [ ] **Step 1: Copy the scaffold**

```bash
cp -r cockpit/ag-ui/streaming cockpit/ag-ui/subagents
```
Then rename/retarget within `cockpit/ag-ui/subagents/`: replace the `streaming` topic token in `python/project.json`, `angular/project.json`, `angular/package.json`, `python/index.ts`, `angular/src/index.ts`, `vercel.json`, `proxy.conf.mjs`, prompts, and `docs/guide.md` with `subagents`; rename `angular/src/app/streaming.component.ts` → `subagents.component.ts` and its e2e `e2e/streaming.spec.ts` → `e2e/subagents.spec.ts`, `e2e/fixtures/streaming.json` → `e2e/fixtures/subagents.json`, `e2e/manual/streaming.manual.ts` → `subagents.manual.ts`. Update the Angular project name to `cockpit-ag-ui-subagents-angular` and ports to 4326 (angular) / 5326 (python) everywhere they appear.

- [ ] **Step 2: Adapt the graph (mirror cockpit/chat/subagents orchestrator + emit subagent_activity)**

Replace `cockpit/ag-ui/subagents/python/src/graph.py` with an orchestrator + `task` tool mirroring `cockpit/chat/subagents/python/src/graph.py` (the `task(role, task_description)` tool dispatching role subagents), but: (a) give `task` a `tool_call_id: Annotated[str, InjectedToolCallId]`; (b) emit `subagent_activity` `started`/`finished` around `_run_subagent`, attaching `SubagentStreamHandler(tool_call_id)` to the subagent LLM's callbacks. Copy `subagent_stream_handler.py`, `activity_transform.py`, `activity_emitting_agent.py` into `cockpit/ag-ui/subagents/python/src/streaming/` (standalone — never import across examples). Wire `cockpit/ag-ui/subagents/python/src/server.py` to use `ActivityEmittingAgent` (mirror Task 1 Step 11).

- [ ] **Step 3: Adapt the Angular component**

`cockpit/ag-ui/subagents/angular/src/app/subagents.component.ts`: host `<chat [agent]="agent">` with `agent = injectAgent()` from `@threadplane/ag-ui` (mirror how `cockpit/ag-ui/streaming` injects the agent and renders `<chat>`). No subagent-specific wiring — `chat` renders `chat-subagents` once `agent.subagents` populates.

- [ ] **Step 4: Register the capability**

In `apps/cockpit/scripts/capability-registry.ts`, add after the `ag-ui-a2ui` entry:
```ts
  { id: 'ag-ui-subagents', product: 'ag-ui', topic: 'subagents', angularProject: 'cockpit-ag-ui-subagents-angular', port: 4326, pythonPort: 5326, pythonDir: 'cockpit/ag-ui/subagents/python' },
```

- [ ] **Step 5: Add python unit tests for the copied modules**

Create `cockpit/ag-ui/subagents/python/tests/test_activity_transform.py` and `test_subagent_stream_handler.py` (copies of Task 1/2 tests, import paths unchanged since modules live at `src.streaming.*`). Add a `test` target to `cockpit/ag-ui/subagents/python/project.json` if the copied one lacks it.

Run: `cd cockpit/ag-ui/subagents/python && uv run pytest -q` → PASS.

- [ ] **Step 6: Author the cockpit e2e + fixture, run it**

Adapt `cockpit/ag-ui/subagents/angular/e2e/subagents.spec.ts` to assert a `chat-subagents` card appears and settles (mirror Task 5's assertions + `cockpit/chat/subagents` e2e). Author `e2e/fixtures/subagents.json`.

Run: `NX_DAEMON=false npx nx e2e cockpit-ag-ui-subagents-angular`
Expected: green.

- [ ] **Step 7: Build + verify registration**

Run: `npx nx build cockpit-ag-ui-subagents-angular` (green) and `npx tsx apps/cockpit/scripts/<the script that lists/validates capabilities>` if one exists, or confirm the capability appears in the cockpit nav/matrix build. (Inspect how the registry feeds the website — verify `ag-ui-subagents` shows up.)

- [ ] **Step 8: Commit**

```bash
git add cockpit/ag-ui/subagents apps/cockpit/scripts/capability-registry.ts
git commit -m "feat(cockpit): ag-ui/subagents capability — native ACTIVITY subagent cards

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Railway deployment regen for the new capability

**Files:**
- Modify (generated): `deployments/ag-ui-dev/**`
- Reference: `scripts/generate-ag-ui-deployment-config.ts`, `scripts/ag-ui-proxy.ts`

- [ ] **Step 1: Regenerate the ag-ui deployment bundle**

Run: `npx tsx scripts/generate-ag-ui-deployment-config.ts`
Expected: regenerates `deployments/ag-ui-dev/` to include the `subagents` topic (the generator reads the capability registry — the new entry is picked up because `cockpit/ag-ui/subagents/python` has `pythonDir`).

- [ ] **Step 2: Confirm the diff includes the new topic**

Run: `git status --short deployments/ag-ui-dev/ && git diff --stat deployments/ag-ui-dev/`
Expected: new/modified files referencing `subagents` (server staging, requirements, deps).

- [ ] **Step 3: Confirm the proxy routes the topic**

Inspect `scripts/ag-ui-proxy.ts` — if topics are enumerated from the registry it needs no change; if hardcoded, add `subagents`. Verify the new capability's origin/route is reachable per the proxy's pattern.

- [ ] **Step 4: Commit**

```bash
git add deployments/ag-ui-dev scripts/ag-ui-proxy.ts
git commit -m "chore(deployments): add ag-ui subagents capability to ag-ui-dev bundle

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Gates, live smoke, PR

- [ ] **Step 1: Library + example gates**

Run:
```bash
npx nx run-many -t lint,test,build -p ag-ui,chat
cd examples/ag-ui/python && uv run pytest -q && cd -
cd cockpit/ag-ui/subagents/python && uv run pytest -q && cd -
npx nx build examples-ag-ui-angular
```
Expected: all green. (Watch for a `chat:lint` dependency-check failure like the Phase-3 `@angular/forms` removal — none expected here since we add no peer deps.)

- [ ] **Step 2: Full e2e**

Run:
```bash
NX_DAEMON=false npx nx e2e examples-ag-ui-angular
NX_DAEMON=false npx nx e2e cockpit-ag-ui-subagents-angular
```
Expected: green. Kill orphan uvicorn/serve on the relevant ports first; `rm -rf .nx/workspace-data` + `NX_DAEMON=false` if the nx lock appears.

- [ ] **Step 3: Live-LLM Chrome smoke (required gate before merge)**

Start the real backend (`examples/ag-ui/python`, real `OPENAI_API_KEY` from root `.env`) + `nx serve examples-ag-ui-angular --port 4201`. In Chrome: send "Research the Louvre and summarize". Verify: a subagent card appears in `running`, its text **streams live** (animates token-by-token), the child text does **not** appear in the main assistant bubble, and the card settles/leaves the active set on completion. Confirm via the AG-UI network frames that native `ACTIVITY_SNAPSHOT`/`ACTIVITY_DELTA` events are on the wire (not `CUSTOM{name:"subagent_activity"}`) — this verifies the L2 transform end to end.

- [ ] **Step 4: Push + PR + merge on green**

```bash
git push -u origin ag-ui-subagent-cards
gh pr create --title "feat(ag-ui): subagent cards over AG-UI via native ACTIVITY events (F5)" --body "<summarize the three layers, the native-ACTIVITY decision, the new cockpit/ag-ui/subagents capability, and the deploy regen; link the spec; note the deferred CUSTOM→native migration follow-up. Do not reference any external repo.>"
gh pr merge --auto --squash <PR#>
```

- [ ] **Step 5: Post-merge deploy verification**

Watch main CI + the Railway "Deploy AG-UI" workflow (the deploy-drift guard + redeploy — expect the #664-style resync may already be committed in Task 7). After deploy, smoke `ag-ui.threadplane.ai` (research prompt → card) and the cockpit `ag-ui/subagents` deployment. If the drift guard fails, re-run `npx tsx scripts/generate-ag-ui-deployment-config.ts`, commit, and follow the api-docs-bot/branch-behind merge playbook from memory.

---

## Self-review notes

- **Spec coverage:** L1 reducer → Task 3; L1 projection → Task 4; L2 transform+agent (spike) → Task 1; L3 graph → Task 2; cockpit capability → Task 6; deploy → Task 7; examples e2e → Task 5; gates/smoke/PR → Task 8. Generic activities store (reusable) → Task 3. Live token streaming → Tasks 2 (text_so_far) + 4 (messages computed) + 5/8 (smoke). Deferred CUSTOM→native migration → noted in PR body (Task 8), out of scope.
- **Type/name consistency:** `subagent_custom_to_activity`, `ActivityEmittingAgent`, `SubagentStreamHandler`, `ActivityEntry`, `store.activities`, `subagentFor`, custom-event name `subagent_activity`, `activityType: "subagent"`, content keys `toolCallId`/`name`/`status`/`text` — used identically across Tasks 1-6. `applyPatch`/`JsonPatchOp` reused from the existing module (not redefined).
- **Known risks carried from the spec:** Task 1 is the `_dispatch_event` seam spike with an explicit `run()`-wrap fallback; Task 5/6 fixtures depend on the aimock replay layer (inspect first); Task 7 is the deploy-drift surface.
- **Constraint:** no task writes an external-repo reference into the codebase.
