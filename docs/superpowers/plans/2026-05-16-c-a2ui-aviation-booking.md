# c-a2ui LLM-Driven Aviation Booking Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded contact-form JSONL in `a2ui_graph.py` with an LLM-authored aviation booking form (and post-submit LLM-authored flight-results surface), both constrained via `.with_structured_output()` + Pydantic schemas with retry.

**Architecture:** 3-node graph `route → {build_form | search_flights} → END`. Pydantic `A2uiComponent` + `BookingFormSpec` / `FlightResultsSpec` constrain LLM output; code wraps validated output in deterministic `createSurface` / `updateDataModel` / `updateComponents` envelopes. `gpt-5` planner from PR #372 reused. On submit, `find_routes()` (from PR #347) feeds the flight-results LLM call.

**Tech Stack:** Python 3.12, LangGraph, langchain-openai (`gpt-5` w/ `reasoning_effort="low"`), Pydantic v2, uv. No frontend changes — chat-lib's A2UI primitives already render any valid envelope.

---

## File structure

**Umbrella backend** (`cockpit/langgraph/streaming/python/`):
- `src/a2ui_graph.py` — REWRITE. 3 nodes + Pydantic schemas + retry helper + envelope wrappers. Single-file containment because the whole module is < 250 LOC.

**Standalone backend** (`cockpit/chat/a2ui/python/`):
- `src/graph.py` — REWRITE. Mirror of umbrella `a2ui_graph.py` (currently a byte-for-byte copy per `diff`).

No frontend changes. No `langgraph.json` changes. No standalone `aviation_data.py` needed — the standalone backend's `aviation_tools.py` doesn't exist; this PR inlines the only piece needed (`find_routes` over an inlined `FLIGHTS` list) into the standalone module to keep it self-contained.

---

## Task 1: Pydantic schemas + envelope helpers (umbrella)

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/a2ui_graph.py` (full rewrite — but build it in stages; this task lays the schema + envelope helper foundation)

- [ ] **Step 1: Replace the file with schemas + envelope helpers only**

Replace `cockpit/langgraph/streaming/python/src/a2ui_graph.py` with:

```python
"""
A2UI Aviation Booking Form Graph

LLM-authored A2UI surfaces:
- build_form: emits a flight-booking form via gpt-5 with structured output
- search_flights: post-submit, calls find_routes() and emits a results surface

Both surfaces are constrained by Pydantic schemas (A2uiComponent +
BookingFormSpec / FlightResultsSpec) and validated; on ValidationError,
the LLM is re-prompted with the error up to 2 retries. After 3 total
attempts, a hardcoded sentinel form is emitted so the demo doesn't 500.

This replaces the prior hardcoded contact-form implementation. The
prior file's claim that "LLMs cannot reliably emit A2UI JSONL" is
disproven by schema-constrained structured output — the LLM authors
the components list, code wraps it in the deterministic envelope keys.
"""

import json
import logging
from typing import Any, Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.types import Command
from pydantic import BaseModel, Field, ValidationError

from src.aviation_tools import find_routes  # noqa: E402

_logger = logging.getLogger(__name__)

A2UI_PREFIX = "---a2ui_JSON---"

# 10 IATA airports from aviation_data.py
AIRPORT_CODES = ["LAX", "JFK", "SFO", "ORD", "BOS", "ATL", "DFW", "SEA", "MIA", "DEN"]
FARE_CLASSES = ["Economy", "Premium", "Business", "First"]


# ── Pydantic schemas ────────────────────────────────────────────────────────

class A2uiComponent(BaseModel):
    """Single A2UI updateComponents entry.

    Literal[...] on `component` is the gate that keeps the LLM from
    inventing component types not in the catalog. Pydantic raises
    ValidationError if it does, triggering retry.
    """
    id: str
    component: Literal[
        "Column", "Row", "Card", "TextField", "ChoicePicker",
        "NumberField", "DatePicker", "CheckBox", "Button", "Divider",
    ]
    label: str | None = None
    title: str | None = None
    placeholder: str | None = None
    options: list[str] | None = None
    value: dict[str, Any] | None = None
    selected: dict[str, Any] | None = None
    checked: dict[str, Any] | None = None
    children: list[str] | None = None
    checks: list[dict[str, Any]] | None = None
    action: dict[str, Any] | None = None


class _SurfaceSpec(BaseModel):
    """Common shape — both booking and results surfaces produce the same
    triple (surface_id, data_model, components)."""
    surface_id: str = Field(description="Surface id. Use 'booking' for the form, 'results' for flights.")
    data_model: dict[str, Any] = Field(description="Initial form/state values, e.g. prefills.")
    components: list[A2uiComponent]


class BookingFormSpec(_SurfaceSpec):
    pass


class FlightResultsSpec(_SurfaceSpec):
    pass


# ── Envelope wrapping ───────────────────────────────────────────────────────

def _wrap_envelopes(spec: _SurfaceSpec) -> str:
    """Wrap a validated SurfaceSpec into A2UI JSONL with the three required envelopes."""
    lines = [
        json.dumps({"createSurface": {
            "surfaceId": spec.surface_id,
            "catalogId": "basic",
            "sendDataModel": True,
        }}),
        json.dumps({"updateDataModel": {
            "surfaceId": spec.surface_id,
            "value": spec.data_model,
        }}),
        json.dumps({"updateComponents": {
            "surfaceId": spec.surface_id,
            "components": [c.model_dump(exclude_none=True) for c in spec.components],
        }}),
    ]
    return A2UI_PREFIX + "\n" + "\n".join(lines) + "\n"
```

- [ ] **Step 2: Verify module imports cleanly**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "from src.a2ui_graph import BookingFormSpec, FlightResultsSpec, _wrap_envelopes, A2UI_PREFIX, AIRPORT_CODES; print(len(AIRPORT_CODES))"`
Expected output: `10`

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/a2ui_graph.py
git commit -m "feat(c-a2ui): pydantic schemas + envelope wrapper (foundation)"
```

---

## Task 2: LLM + retry helper

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/a2ui_graph.py` (append below the envelope helper from Task 1)

- [ ] **Step 1: Append LLM setup + retry helper**

Append to `cockpit/langgraph/streaming/python/src/a2ui_graph.py`:

```python


# ── LLM + retry ─────────────────────────────────────────────────────────────

# gpt-5 with low reasoning effort: PR #372 established gpt-5 follows
# directive precisely; "low" gives slightly more headroom than "minimal"
# for schema compliance.
_llm = ChatOpenAI(
    model="gpt-5",
    streaming=True,
    reasoning_effort="low",
)


async def _emit_with_retry(
    spec_cls: type[_SurfaceSpec],
    base_messages: list[Any],
    max_attempts: int = 3,
) -> _SurfaceSpec:
    """Call the LLM with structured output, retrying on validation failure.

    Each retry re-injects the error message so the model has a chance
    to correct its output. After max_attempts, raises RuntimeError.
    """
    llm = _llm.with_structured_output(spec_cls)
    messages = list(base_messages)
    last_err: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return await llm.ainvoke(messages)
        except ValidationError as err:
            last_err = err
            _logger.warning(
                "A2UI structured-output validation failed (attempt %d/%d): %s",
                attempt + 1, max_attempts, err,
            )
            messages = list(base_messages) + [
                AIMessage(content=(
                    f"Previous attempt failed schema validation: {err}. "
                    "Try again, strictly matching the schema. "
                    "Do not invent component types outside the Literal list."
                )),
            ]
    raise RuntimeError(
        f"LLM failed structured output after {max_attempts} attempts: {last_err}"
    )
```

- [ ] **Step 2: Verify module still imports**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "from src.a2ui_graph import _llm, _emit_with_retry; print('ok')"`
Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/a2ui_graph.py
git commit -m "feat(c-a2ui): gpt-5 structured-output LLM + retry helper"
```

---

## Task 3: build_form node

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/a2ui_graph.py` (append below retry helper)

- [ ] **Step 1: Append build_form node + sentinel fallback**

Append to `cockpit/langgraph/streaming/python/src/a2ui_graph.py`:

```python


# ── build_form node ─────────────────────────────────────────────────────────

_BUILD_FORM_SYSTEM = f"""You are an aviation booking-form designer. Emit an A2UI booking form using the structured output schema.

Required components (in this order, inside a single Card titled "Book a flight" inside a Column root):
1. Origin airport ChoicePicker — options = {AIRPORT_CODES}, selected = {{"path": "/origin"}}
2. Destination airport ChoicePicker — same options, selected = {{"path": "/dest"}}
3. Departure date TextField — value = {{"path": "/date"}}, placeholder "YYYY-MM-DD"
4. Passengers NumberField — value = {{"path": "/passengers"}}
5. Fare class ChoicePicker — options = {FARE_CLASSES}, selected = {{"path": "/fare_class"}}
6. Submit Button — label "Search flights", action = {{"event": {{"name": "bookingSubmit", "context": {{"formId": "booking"}}}}}}

Submit button MUST be gated by `checks` that require:
- /origin set (call: "required")
- /dest set (call: "required")
- /date set (call: "required")

Default data_model: {{"origin": "", "dest": "", "date": "", "passengers": 1, "fare_class": "Economy"}}
surface_id MUST be "booking".

Use unique `id` values for every component (e.g. "root", "card", "origin_field", etc.)."""


_SENTINEL_BOOKING_FORM = BookingFormSpec(
    surface_id="booking",
    data_model={"origin": "", "dest": "", "date": "", "passengers": 1, "fare_class": "Economy"},
    components=[
        A2uiComponent(id="root", component="Column", children=["card"]),
        A2uiComponent(id="card", component="Card", title="Book a flight (fallback)",
                      children=["origin", "dest", "date", "passengers", "fare", "submit"]),
        A2uiComponent(id="origin", component="ChoicePicker", label="Origin",
                      options=AIRPORT_CODES, selected={"path": "/origin"}),
        A2uiComponent(id="dest", component="ChoicePicker", label="Destination",
                      options=AIRPORT_CODES, selected={"path": "/dest"}),
        A2uiComponent(id="date", component="TextField", label="Date",
                      value={"path": "/date"}, placeholder="YYYY-MM-DD"),
        A2uiComponent(id="passengers", component="NumberField", label="Passengers",
                      value={"path": "/passengers"}),
        A2uiComponent(id="fare", component="ChoicePicker", label="Fare class",
                      options=FARE_CLASSES, selected={"path": "/fare_class"}),
        A2uiComponent(id="submit", component="Button", label="Search flights",
                      action={"event": {"name": "bookingSubmit", "context": {"formId": "booking"}}}),
    ],
)


async def build_form(state: MessagesState) -> dict:
    """First-turn node: LLM authors the booking form."""
    base_messages = [SystemMessage(content=_BUILD_FORM_SYSTEM)] + state["messages"]
    try:
        spec = await _emit_with_retry(BookingFormSpec, base_messages)
    except RuntimeError as err:
        _logger.error("Falling back to sentinel booking form: %s", err)
        spec = _SENTINEL_BOOKING_FORM
    return {"messages": [AIMessage(content=_wrap_envelopes(spec))]}
```

- [ ] **Step 2: Verify module imports**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "from src.a2ui_graph import build_form, _SENTINEL_BOOKING_FORM; print(len(_SENTINEL_BOOKING_FORM.components))"`
Expected output: `8`

- [ ] **Step 3: Smoke the sentinel envelope output**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "
from src.a2ui_graph import _SENTINEL_BOOKING_FORM, _wrap_envelopes, A2UI_PREFIX
out = _wrap_envelopes(_SENTINEL_BOOKING_FORM)
assert out.startswith(A2UI_PREFIX)
lines = out.strip().split('\n')[1:]
keys = [list(__import__('json').loads(l).keys())[0] for l in lines]
print('ENVELOPE_KEYS:', keys)
"`
Expected output: `ENVELOPE_KEYS: ['createSurface', 'updateDataModel', 'updateComponents']`

- [ ] **Step 4: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/a2ui_graph.py
git commit -m "feat(c-a2ui): build_form node — LLM-authored booking form + sentinel fallback"
```

---

## Task 4: search_flights node

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/a2ui_graph.py` (append below build_form)

- [ ] **Step 1: Append search_flights node + sentinel fallback**

Append to `cockpit/langgraph/streaming/python/src/a2ui_graph.py`:

```python


# ── search_flights node ─────────────────────────────────────────────────────

_SEARCH_FLIGHTS_SYSTEM = """You just received a booking submission. The find_routes() tool returned the following flights:

{flights_json}

Form data (for context): {form_json}

Emit an A2UI results surface using the FlightResultsSpec schema.

- surface_id MUST be "results"
- data_model can be {{}} (no user input needed on this surface)
- Root is a Column with children = list of flight Card ids (or a single Card "no_flights" if the list is empty)
- For each flight: a Card with title "<airline> flight <flight_number>", containing TextField/Divider children showing route, depart/arrive times, duration, aircraft, gate, and a "Select" Button whose action emits {{"event": {{"name": "flightSelect", "context": {{"flightId": "<flight_number>"}}}}}}
- For the empty case: a single Card with id "no_flights" titled "No flights found", containing a "Modify search" Button with action {{"event": {{"name": "modifySearch", "context": {{"formId": "booking"}}}}}}

Use unique `id` values for every component."""


_SENTINEL_RESULTS = FlightResultsSpec(
    surface_id="results",
    data_model={},
    components=[
        A2uiComponent(id="root", component="Column", children=["msg"]),
        A2uiComponent(id="msg", component="Card", title="Results unavailable",
                      children=["modify"]),
        A2uiComponent(id="modify", component="Button", label="Modify search",
                      action={"event": {"name": "modifySearch", "context": {"formId": "booking"}}}),
    ],
)


def _parse_submit_payload(content: str) -> dict[str, Any] | None:
    """Extract the form-data dict from an a2ui_event message content."""
    try:
        payload = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(payload, dict) or payload.get("type") != "a2ui_event":
        return None
    # Accept either {"data": {...}} or {"value": {...}} or context-level fields
    data = payload.get("data") or payload.get("value") or {}
    if not isinstance(data, dict):
        return None
    return data


async def search_flights(state: MessagesState) -> dict:
    """Post-submit node: call find_routes, emit results A2UI surface."""
    last = state["messages"][-1]
    form_data = _parse_submit_payload(getattr(last, "content", "")) or {}
    origin = (form_data.get("origin") or "").upper()
    dest = (form_data.get("dest") or "").upper()
    flights: list[dict[str, Any]] = []
    if origin and dest and origin != dest:
        try:
            flights = await find_routes.ainvoke({"from_code": origin, "to_code": dest})
        except Exception as err:  # noqa: BLE001 — demo robustness
            _logger.warning("find_routes failed for %s→%s: %s", origin, dest, err)

    base_messages = [
        SystemMessage(content=_SEARCH_FLIGHTS_SYSTEM.format(
            flights_json=json.dumps(flights, indent=2),
            form_json=json.dumps(form_data, indent=2),
        )),
        HumanMessage(content=f"Emit the results surface for {origin}→{dest}."),
    ]
    try:
        spec = await _emit_with_retry(FlightResultsSpec, base_messages)
    except RuntimeError as err:
        _logger.error("Falling back to sentinel results surface: %s", err)
        spec = _SENTINEL_RESULTS
    return {"messages": [AIMessage(content=_wrap_envelopes(spec))]}
```

- [ ] **Step 2: Smoke parse_submit_payload**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "
from src.a2ui_graph import _parse_submit_payload
import json
ok = _parse_submit_payload(json.dumps({'type':'a2ui_event','data':{'origin':'LAX','dest':'JFK'}}))
print('PARSED:', ok)
"`
Expected output: `PARSED: {'origin': 'LAX', 'dest': 'JFK'}`

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/a2ui_graph.py
git commit -m "feat(c-a2ui): search_flights node — LLM-authored results surface"
```

---

## Task 5: route node + graph compile

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/a2ui_graph.py` (append below search_flights)

- [ ] **Step 1: Append route + graph compile**

Append to `cockpit/langgraph/streaming/python/src/a2ui_graph.py`:

```python


# ── Routing + compile ───────────────────────────────────────────────────────

def _is_submit_event(content: str) -> bool:
    """True iff the content is an a2ui_event whose formId is 'booking'."""
    try:
        payload = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return False
    return (
        isinstance(payload, dict)
        and payload.get("type") == "a2ui_event"
        and isinstance(payload.get("context"), dict)
        and payload["context"].get("formId") == "booking"
    )


def route(state: MessagesState) -> Command[Literal["build_form", "search_flights"]]:
    """Inspect the last message — submit event → search_flights, else build_form."""
    last_content = getattr(state["messages"][-1], "content", "") if state["messages"] else ""
    if _is_submit_event(last_content):
        return Command(goto="search_flights")
    return Command(goto="build_form")


_builder = StateGraph(MessagesState)
_builder.add_node("route", route)
_builder.add_node("build_form", build_form)
_builder.add_node("search_flights", search_flights)
_builder.set_entry_point("route")
_builder.add_edge("build_form", END)
_builder.add_edge("search_flights", END)

graph = _builder.compile()
```

- [ ] **Step 2: Verify graph compiles + routes correctly**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "
from src.a2ui_graph import graph, _is_submit_event
import json
print('TYPE:', type(graph).__name__)
print('SUBMIT_TRUE:', _is_submit_event(json.dumps({'type':'a2ui_event','context':{'formId':'booking'}})))
print('SUBMIT_FALSE:', _is_submit_event('hello'))
"`
Expected output:
```
TYPE: CompiledStateGraph
SUBMIT_TRUE: True
SUBMIT_FALSE: False
```

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/a2ui_graph.py
git commit -m "feat(c-a2ui): route node + 3-node graph compile"
```

---

## Task 6: End-to-end real-LLM smoke (umbrella)

**Files:**
- Read-only: repo root `.env` for `OPENAI_API_KEY`

- [ ] **Step 1: Confirm key present**

Run from repo root: `grep -q '^OPENAI_API_KEY=' .env && echo found`
Expected: `found`

- [ ] **Step 2: Smoke build_form via the graph**

Run from repo root:
```bash
set -a; source .env; set +a
cd cockpit/langgraph/streaming/python && uv run python -c "
import asyncio, json
from src.a2ui_graph import graph, A2UI_PREFIX
from langchain_core.messages import HumanMessage

async def main():
    result = await graph.ainvoke({'messages': [HumanMessage(content='I want to fly somewhere')]})
    out = result['messages'][-1].content
    assert out.startswith(A2UI_PREFIX), f'missing prefix, got: {out[:80]}'
    lines = out.strip().split('\n')[1:]
    envelopes = [json.loads(l) for l in lines]
    keys = [list(e.keys())[0] for e in envelopes]
    print('ENVELOPE_KEYS:', keys)
    components = envelopes[2]['updateComponents']['components']
    types = sorted({c['component'] for c in components})
    print('COMPONENT_TYPES:', types)
    print('SURFACE_ID:', envelopes[0]['createSurface']['surfaceId'])

asyncio.run(main())
"
```
Expected: `ENVELOPE_KEYS: ['createSurface', 'updateDataModel', 'updateComponents']`; `COMPONENT_TYPES` includes at least `Button`, `Card`, `ChoicePicker`, `Column`, `NumberField`, `TextField`; `SURFACE_ID: booking`.

- [ ] **Step 3: Smoke search_flights via the graph**

Run from repo root:
```bash
set -a; source .env; set +a
cd cockpit/langgraph/streaming/python && uv run python -c "
import asyncio, json
from src.a2ui_graph import graph, A2UI_PREFIX
from langchain_core.messages import HumanMessage

async def main():
    submit = json.dumps({
        'type': 'a2ui_event',
        'context': {'formId': 'booking'},
        'data': {'origin': 'LAX', 'dest': 'JFK', 'date': '2026-06-15', 'passengers': 1, 'fare_class': 'Economy'},
    })
    result = await graph.ainvoke({'messages': [HumanMessage(content=submit)]})
    out = result['messages'][-1].content
    assert out.startswith(A2UI_PREFIX), f'missing prefix, got: {out[:80]}'
    lines = out.strip().split('\n')[1:]
    envelopes = [json.loads(l) for l in lines]
    keys = [list(e.keys())[0] for e in envelopes]
    print('ENVELOPE_KEYS:', keys)
    print('SURFACE_ID:', envelopes[0]['createSurface']['surfaceId'])
    components = envelopes[2]['updateComponents']['components']
    print('N_COMPONENTS:', len(components))

asyncio.run(main())
"
```
Expected: `ENVELOPE_KEYS: ['createSurface', 'updateDataModel', 'updateComponents']`; `SURFACE_ID: results`; `N_COMPONENTS >= 2`.

- [ ] **Step 4: No commit unless smoke revealed a bug**

If both smokes pass: nothing to commit. If they revealed an issue, fix the relevant earlier task's code, re-run Step 2/3, then:

```bash
git add cockpit/langgraph/streaming/python/src/a2ui_graph.py
git commit -m "fix(c-a2ui): smoke fixes for end-to-end run"
```

---

## Task 7: Mirror to standalone

**Files:**
- Modify: `cockpit/chat/a2ui/python/src/graph.py` (full replacement — mirror of umbrella `a2ui_graph.py` minus the `from src.aviation_tools import find_routes` line, which doesn't exist in the standalone)

- [ ] **Step 1: Verify standalone has no aviation_tools**

Run: `ls cockpit/chat/a2ui/python/src/ 2>&1`
Expected: shows `graph.py`, `index.ts` (and `__pycache__`). NO `aviation_tools.py`.

- [ ] **Step 2: Inline find_routes minimally into standalone**

Replace `cockpit/chat/a2ui/python/src/graph.py` with the entire contents of `cockpit/langgraph/streaming/python/src/a2ui_graph.py` BUT:

1. Replace this import:
```python
from src.aviation_tools import find_routes  # noqa: E402
```
with this inline data + helper (same 4-airline / per-route shape as `aviation_data.py`'s FLIGHTS list, abbreviated to keep standalone self-contained):

```python
# Inlined flight fixtures — standalone has no aviation_data module.
_FLIGHTS = [
    {"flight_number": "UA123", "airline": "UA", "from": "LAX", "to": "JFK",
     "depart_local": "08:00", "arrive_local": "16:30", "duration_min": 330,
     "status": "on_time", "gate": "B14", "aircraft": "Boeing 787"},
    {"flight_number": "AA456", "airline": "AA", "from": "JFK", "to": "LAX",
     "depart_local": "10:00", "arrive_local": "13:30", "duration_min": 390,
     "status": "on_time", "gate": "T5-22", "aircraft": "Boeing 777"},
    {"flight_number": "DL789", "airline": "DL", "from": "ATL", "to": "ORD",
     "depart_local": "07:15", "arrive_local": "08:45", "duration_min": 150,
     "status": "delayed", "gate": "A12", "aircraft": "Airbus A320"},
    {"flight_number": "B6101", "airline": "B6", "from": "BOS", "to": "MIA",
     "depart_local": "06:30", "arrive_local": "10:15", "duration_min": 225,
     "status": "on_time", "gate": "C8", "aircraft": "Airbus A321"},
    {"flight_number": "UA204", "airline": "UA", "from": "SFO", "to": "SEA",
     "depart_local": "09:00", "arrive_local": "11:00", "duration_min": 120,
     "status": "on_time", "gate": "F11", "aircraft": "Boeing 737"},
]


class _AsyncFn:
    """Tiny shim so we can call find_routes.ainvoke({...}) like the umbrella's
    LangChain @tool decorator does."""
    def __init__(self, fn):
        self._fn = fn

    async def ainvoke(self, args: dict[str, Any]) -> list[dict[str, Any]]:
        return self._fn(**args)


def _find_routes_impl(from_code: str, to_code: str, date_offset_days: int = 0) -> list[dict[str, Any]]:
    return [f for f in _FLIGHTS if f["from"] == from_code and f["to"] == to_code]


find_routes = _AsyncFn(_find_routes_impl)
```

The rest of the module (schemas, _wrap_envelopes, LLM, retry, build_form, search_flights, route, graph compile) is identical to the umbrella copy.

- [ ] **Step 3: Verify standalone imports + graph compiles**

Run: `cd cockpit/chat/a2ui/python && uv run python -c "
from src.graph import graph, find_routes
import asyncio
print('TYPE:', type(graph).__name__)
async def main():
    print('ROUTES_LAX_JFK:', await find_routes.ainvoke({'from_code':'LAX','to_code':'JFK'}))
asyncio.run(main())
"`
Expected: `TYPE: CompiledStateGraph` and one flight dict in the list.

- [ ] **Step 4: Commit**

```bash
git add cockpit/chat/a2ui/python/src/graph.py
git commit -m "feat(c-a2ui standalone): mirror LLM-driven booking form + inlined flight fixtures"
```

---

## Task 8: Build verification

**Files:**
- No code changes — pure check

- [ ] **Step 1: Build umbrella langgraph python**

Run from repo root: `pnpm nx run cockpit-langgraph-streaming-python:build`
Expected: green.

- [ ] **Step 2: Build chat-a2ui Angular**

Run from repo root: `pnpm nx run cockpit-chat-a2ui-angular:build`
Expected: green. (Frontend untouched — sanity check.)

- [ ] **Step 3: No commit (verification only)**

If either fails, fix the underlying task's file, re-run.

---

## Task 9: REQUIRED — iterative chrome MCP smoke

This task is iterative: send a prompt, observe behavior, fix any bug found in the relevant earlier task, restart backend, re-test. Do not skip. The user explicitly requested "use chrome MCP to iteratively verify until successful. Be exhaustive."

**Files:**
- Read-only: `.env` for `OPENAI_API_KEY`
- Servers: start umbrella langgraph dev + cockpit chat-a2ui Angular dev

- [ ] **Step 1: Start servers**

In one background shell from repo root:
```bash
set -a; source .env; set +a
cd cockpit/langgraph/streaming/python && uv run langgraph dev --port 8123 --no-browser
```

In another background shell from repo root:
```bash
pnpm nx serve cockpit-chat-a2ui-angular --port 4201
```

(If port 4200 is taken, use 4201 — PR 3's verification used 4201 already.)

- [ ] **Step 2: Ensure dev env points to umbrella backend on /api**

If `cockpit/chat/a2ui/angular/src/environments/environment.development.ts` doesn't already point at `/api` with assistantId `c-a2ui`, edit it locally (do NOT commit this — it's a local-only override matching PR 3's pattern). Confirm proxy.conf.json forwards `/api` → `localhost:8123`.

- [ ] **Step 3: Drive the first prompt via chrome MCP**

Use programmatic JS input (avoids the known Angular hydration race):
```
mcp__Claude_in_Chrome__javascript_tool:
  (()=>{const ta=document.querySelector('textarea');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    setter.call(ta,'I want to fly from LAX to JFK');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    ta.focus();
    ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
    return 'sent'})()
```

Then wait 30s.

- [ ] **Step 4: Verify booking form rendered**

Screenshot + DOM query:
```
mcp__Claude_in_Chrome__javascript_tool:
  JSON.stringify({
    surfaces: document.querySelectorAll('a2ui-surface, [data-surface-id]').length,
    pickers: document.querySelectorAll('a2ui-choicepicker, [data-component="ChoicePicker"]').length,
    textfields: document.querySelectorAll('a2ui-textfield, [data-component="TextField"]').length,
    buttons: document.querySelectorAll('a2ui-button, [data-component="Button"]').length,
    text: document.body.innerText.substring(0, 400),
  })
```

Expected: surfaces ≥ 1; at least 2 ChoicePickers (origin + dest + fare = 3 actually); at least 1 TextField (date) or 1 NumberField; at least 1 Button (submit); the text snapshot includes "Book a flight" or similar.

If any expected element is missing or the surface didn't render at all: open backend `/threads` to inspect the actual JSONL produced, identify which envelope or component is malformed, fix the prompt or schema in the relevant Task (1–5), restart backend, retry Step 3.

- [ ] **Step 5: Fill the form and submit**

Inspect the rendered form to identify input element refs (use `mcp__Claude_in_Chrome__find` with queries like "origin airport picker"). For each field:
- Origin picker → click + select "LAX"
- Destination picker → click + select "JFK"
- Date TextField → click, type "2026-06-15"
- Fare class → select "Business" (or accept default)
- Submit button → click

Approximate JS-driven path if mouse interactions are flaky:
```
mcp__Claude_in_Chrome__javascript_tool:
  // Find the submit button by label and click it after filling the data model
  (()=>{
    // The render-element store is populated via path bindings; in the chat lib,
    // form field changes go through the a2ui:datamodel:<path>:<value> emit protocol.
    // For verification, just click the submit button and let the model send empty data.
    const buttons = Array.from(document.querySelectorAll('button'));
    const submit = buttons.find(b => /Search flights|Submit/i.test(b.textContent || ''));
    if (submit) { submit.click(); return 'clicked'; }
    return 'no-submit-found';
  })()
```

Wait 30s.

- [ ] **Step 6: Verify results surface rendered**

```
mcp__Claude_in_Chrome__javascript_tool:
  JSON.stringify({
    cards: document.querySelectorAll('a2ui-card, [data-component="Card"]').length,
    selectButtons: Array.from(document.querySelectorAll('button')).filter(b => /Select/.test(b.textContent || '')).length,
    text: document.body.innerText.substring(0, 600),
  })
```

Expected (LAX→JFK, with `aviation_data.FLIGHTS` containing UA123 LAX→JFK): cards ≥ 1; selectButtons ≥ 1; text includes "UA123" or another flight number.

If results didn't render or `find_routes` returned empty when it shouldn't have, debug:
- Check backend log: did `search_flights` run? Did the submit payload parse?
- Check the LLM output: was it valid FlightResultsSpec or did the retry exhaust?

Fix the relevant earlier task, restart backend, redo Step 5/6.

- [ ] **Step 7: Capture before/after screenshots for the PR**

Use `mcp__Claude_in_Chrome__computer` action `screenshot` with `save_to_disk: true`. Attach these to the PR body in Task 11.

- [ ] **Step 8: Stop servers** when done.

---

## Task 10: Final integration smoke (post-iteration)

**Files:**
- No code changes

- [ ] **Step 1: Re-run umbrella `:build`**

Run: `pnpm nx run cockpit-langgraph-streaming-python:build`
Expected: green.

- [ ] **Step 2: Re-run all-examples build (lighter version: chat-a2ui only)**

Run: `pnpm nx run cockpit-chat-a2ui-angular:build`
Expected: green.

If clean, no commit.

---

## Task 11: Open the PR

- [ ] **Step 1: Push branch**

Run: `git push -u origin HEAD`

- [ ] **Step 2: Open PR**

Run:
```bash
gh pr create --title "feat(c-a2ui): LLM-driven aviation booking form (PR 4 of 4)" --body "$(cat <<'EOF'
## Summary
- PR 4 of 4 — final piece of the c-* aviation theme rollout.
- Replaces the hardcoded contact-form JSONL in \`a2ui_graph.py\` with an **LLM-authored** aviation booking form, plus an **LLM-authored** post-submit flight-results surface.
- LLM output is constrained by Pydantic schemas (\`A2uiComponent\` + \`BookingFormSpec\` / \`FlightResultsSpec\`) via \`.with_structured_output()\`. On validation failure: 2 retries with the error re-injected, then a hardcoded sentinel form so the demo doesn't crash.
- Disproves the prior code's claim that "LLMs cannot reliably emit A2UI JSONL" — schema-constrained structured output works.

## Architecture
\`route → {build_form | search_flights} → END\`. \`build_form\` runs on first turn; \`search_flights\` runs when the last message is an a2ui_event with formId='booking' and calls \`find_routes()\` (PR 1's aviation_tools) before authoring the results surface.

LLM: \`gpt-5\` with \`reasoning_effort='low'\` (matches PR #372's tool-discipline pattern).

## Test plan
- [x] \`pnpm nx run cockpit-langgraph-streaming-python:build\` — green
- [x] \`pnpm nx run cockpit-chat-a2ui-angular:build\` — green
- [x] Programmatic real-LLM smoke (umbrella):
  - \`build_form\` → 3 envelopes (createSurface/updateDataModel/updateComponents), surface_id 'booking', all required component types present
  - \`search_flights\` for LAX→JFK submit → 3 envelopes, surface_id 'results', N≥2 components
- [x] Manual chrome MCP smoke:
  - "I want to fly from LAX to JFK" → booking form renders with origin/dest pickers, date field, passenger field, fare-class picker, gated submit
  - Submit LAX→JFK → results surface with at least one flight Card
- [ ] CI

## Files
- \`cockpit/langgraph/streaming/python/src/a2ui_graph.py\` — full rewrite (3 nodes, Pydantic schemas, retry, find_routes integration)
- \`cockpit/chat/a2ui/python/src/graph.py\` — mirror with inlined flight fixtures

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

Run: `gh pr checks <PR_NUMBER> --watch`

- [ ] **Step 4: Squash-merge on green**

Run: `gh pr merge <PR_NUMBER> --squash`

---

## Self-Review

**Spec coverage:**
- Decision 1 (LLM emits via structured output with retry) → Tasks 2, 3, 4 ✓
- Decision 2 (post-submit emits 2nd A2UI surface) → Task 4 ✓
- Decision 3 (2 retries + sentinel fallback) → Task 2 helper + Tasks 3, 4 sentinels ✓
- Decision 4 (gpt-5 + reasoning_effort='low') → Task 2 ✓
- Pydantic schemas (BookingFormSpec, FlightResultsSpec, A2uiComponent) → Task 1 ✓
- Envelope wrapping with deterministic 3-envelope sequence → Task 1 `_wrap_envelopes` ✓
- Aviation form fields (origin, dest, date, passengers, fare class, submit) → Task 3 prompt ✓
- find_routes integration → Task 4 ✓
- Sentinel fallback for both surfaces → Tasks 3, 4 ✓
- Standalone mirror → Task 7 ✓
- Chrome MCP iterative verification → Task 9 ✓

**Placeholder scan:** No TBDs. Every code step includes full code. Task 7 explicitly references "the rest of the module is identical to the umbrella copy" — acceptable because the umbrella file is fully specified in Tasks 1-5 and the only diff is the `find_routes` import substitution.

**Type consistency:**
- `BookingFormSpec` / `FlightResultsSpec` extend `_SurfaceSpec` consistently
- `A2uiComponent.component` Literal list (`Column, Row, Card, TextField, ChoicePicker, NumberField, DatePicker, CheckBox, Button, Divider`) matches what build_form prompt asks for and what search_flights prompt asks for
- `_emit_with_retry(spec_cls, base_messages, max_attempts=3)` signature consistent across Tasks 3, 4
- `_wrap_envelopes(spec)` signature consistent across Tasks 3, 4
- `find_routes.ainvoke({"from_code", "to_code"})` matches the @tool signature in `aviation_tools.py` (verified against PR 1)
