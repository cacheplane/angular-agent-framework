# c-a2ui Select-Flight Confirmation Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `flightSelect` action (Select button on results surface) to a new LLM-authored A2UI **confirmation surface** showing the selected flight + the user's prior passengers/fare-class choices + a Modify search button.

**Architecture:** Extend the existing 3-node graph to 4 nodes: `route → {build_form | search_flights | confirm_booking} → END`. `confirm_booking` is symmetric with the existing two LLM-authored nodes — Pydantic-validated structured output, retry on validation failure, hardcoded sentinel fallback. It calls `lookup_flight()` for the selected flight + walks message history to recover the user's prior `bookingSubmit` context.

**Tech Stack:** Python 3.12, LangGraph, langchain-openai (`gpt-5`, `reasoning_effort="low"`), Pydantic v2, uv. No frontend changes — Select button already exists.

---

## Files modified

- Modify: `cockpit/langgraph/streaming/python/src/a2ui_graph.py` (umbrella)
- Modify: `cockpit/chat/a2ui/python/src/graph.py` (standalone — full copy mirror per PR #396 policy)

No other files. No new tools. No new prompts files (system prompt for confirm_booking lives inline like the other two).

---

## Task 1: Add the schemas, helpers, and prompt

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/a2ui_graph.py` (additions only — leave existing code intact)

- [ ] **Step 1: Add `lookup_flight` import**

Find the existing import block in `cockpit/langgraph/streaming/python/src/a2ui_graph.py`:

```python
from src.aviation_tools import find_routes  # noqa: E402
```

Change it to:

```python
from src.aviation_tools import find_routes, lookup_flight  # noqa: E402
```

- [ ] **Step 2: Add `ConfirmationSpec` Pydantic class**

Find the existing schema block (after `class FlightResultsSpec(_SurfaceSpec): pass`). Append:

```python


class ConfirmationSpec(_SurfaceSpec):
    """Booking confirmation surface — selected flight + prior party context."""
    pass
```

- [ ] **Step 3: Add `_is_flight_select_event`, `_extract_prior_submit_context`, `_format_party` helpers**

Find the existing `_is_submit_event` function. Append below it:

```python


def _is_flight_select_event(content: str) -> bool:
    """True iff the content is a v1 A2uiActionMessage named flightSelect."""
    try:
        payload = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return False
    if not isinstance(payload, dict):
        return False
    action = payload.get("action")
    return (
        isinstance(action, dict)
        and action.get("name") == "flightSelect"
    )


def _extract_prior_submit_context(messages: list[Any]) -> dict[str, Any]:
    """Walk back, find the most recent bookingSubmit A2UI action message;
    return its unwrapped context dict (origin/dest/date/passengers/fare_class).
    Returns {} if not found."""
    for msg in reversed(messages):
        content = getattr(msg, "content", None)
        if not isinstance(content, str):
            continue
        try:
            payload = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            continue
        if (
            isinstance(payload, dict)
            and isinstance(payload.get("action"), dict)
            and payload["action"].get("name") == "bookingSubmit"
        ):
            ctx = payload["action"].get("context", {})
            if not isinstance(ctx, dict):
                return {}
            return {k: _unwrap_literal(v) for k, v in ctx.items()}
    return {}


def _format_party(prior: dict[str, Any]) -> str:
    """Pretty-print passenger count + fare class for the confirmation text.
    Tolerant of missing fields."""
    parts: list[str] = []
    n = prior.get("passengers")
    if isinstance(n, (int, float)) and n > 0:
        parts.append(f"{int(n)} passenger" + ("" if int(n) == 1 else "s"))
    fare = prior.get("fare_class")
    if isinstance(fare, str) and fare:
        parts.append(fare)
    return "  •  ".join(parts) if parts else "(party details unavailable)"
```

- [ ] **Step 4: Add `_CONFIRM_BOOKING_SYSTEM` prompt and `_build_sentinel_confirmation`**

Find the existing `_SENTINEL_RESULTS` constant. Append below the section it lives in:

```python


# ── confirm_booking node ────────────────────────────────────────────────────

_CONFIRM_BOOKING_SYSTEM = """You just received a Select event from the flight results surface. The user picked a flight; here are its details from lookup_flight():

{flight_json}

The user's prior search context (party_text, derived from passengers + fare_class on the original booking submission): {party_text}

The selected flight number (from the Select button's action context, used in the fallback title if flight_json is null): {flight_id}

Emit an A2UI v1 confirmation surface using the ConfirmationSpec schema.

A2UI format (CRITICAL): every component is `{{"id": "...", "component": {{"<ComponentName>": {{<props>}}}}}}`. The component name is the SINGLE KEY of the inner dict.

Allowed component names: Column, Card, Text, Button, Divider.

Per-component shapes you'll need:
  Column:        {{"children": {{"explicitList": ["id1","id2"]}}}}
  Card:          {{"child": "<single-id>"}}
  Text:          {{"text": "literal", "usageHint": "h2"}}  (h1/h2/h3/body/caption)
  Button:        {{"child": "<text-id>", "primary": true, "action": {{"name": "<event>", "context": [{{"key":"formId","value":"booking"}}]}}}}
  Divider:       {{}}

Surface constraints:
  surface_id MUST be "confirmation"
  data_model = {{}}

Build this component tree exactly (use these ids):
  root         (Column, children = explicitList=[card])
  card         (Card, child = card_col)
  card_col     (Column, children = explicitList=[title, route_text, time_text, gate_text, divider, party_text, modify])
  title        (Text, "<airline> flight <flight_number>", usageHint="h2")
  route_text   (Text, "<from> → <to>  •  <duration_min> min  •  <aircraft>", usageHint="body")
  time_text    (Text, "Depart <depart_local>  •  Arrive <arrive_local>", usageHint="caption")
  gate_text    (Text, "Gate <gate>", usageHint="caption")
  divider      (Divider, {{}})
  party_text   (Text, "{party_text}", usageHint="body")  ← use the supplied string verbatim
  modify       (Button, child=modify_label, primary=true,
                action={{"name":"modifySearch","context":[{{"key":"formId","value":"booking"}}]}})
  modify_label (Text, "Modify search")

If flight_json is null, omit route_text, time_text, gate_text from card_col's children and set the title to "Flight {flight_id} selected" (or "Booking selected" if {flight_id} is empty). Always include party_text + modify."""


def _build_sentinel_confirmation(flight_id: str, party_text: str) -> ConfirmationSpec:
    """Hardcoded fallback used when retry exhausts."""
    title = f"Flight {flight_id} selected" if flight_id else "Booking selected"
    return ConfirmationSpec(
        surface_id="confirmation",
        data_model={},
        components=[
            _comp("root", "Column", {"children": {"explicitList": ["card"]}}),
            _comp("card", "Card", {"child": "card_col"}),
            _comp("card_col", "Column", {"children": {"explicitList": ["title", "party", "modify"]}}),
            _comp("title", "Text", {"text": title, "usageHint": "h2"}),
            _comp("party", "Text", {"text": party_text, "usageHint": "body"}),
            _comp("modify", "Button", {"child": "modify_label",
                                       "action": {"name": "modifySearch",
                                                  "context": [{"key": "formId", "value": "booking"}]}}),
            _comp("modify_label", "Text", {"text": "Modify search"}),
        ],
    )
```

- [ ] **Step 5: Verify imports / parse cleanly**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "
from src.a2ui_graph import (
    ConfirmationSpec, _is_flight_select_event, _extract_prior_submit_context,
    _format_party, _CONFIRM_BOOKING_SYSTEM, _build_sentinel_confirmation,
    lookup_flight,
)
print('ok')
print('sentinel ids:', [c.id for c in _build_sentinel_confirmation('UA123', '1 passenger  •  Economy').components])
"`
Expected output:
```
ok
sentinel ids: ['root', 'card', 'card_col', 'title', 'party', 'modify', 'modify_label']
```

- [ ] **Step 6: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/a2ui_graph.py
git commit -m "feat(c-a2ui): confirm-booking schema + helpers + prompt + sentinel (umbrella)"
```

---

## Task 2: Add the `confirm_booking` node

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/a2ui_graph.py`

- [ ] **Step 1: Append `confirm_booking` async node**

Below `_build_sentinel_confirmation` from Task 1, append:

```python


async def confirm_booking(state: MessagesState) -> dict:
    """Post-Select node: look up the chosen flight, recover party context from
    prior submit, emit confirmation surface."""
    last = state["messages"][-1]
    select_data = _parse_submit_payload(getattr(last, "content", "")) or {}
    flight_id_raw = select_data.get("flightId") or select_data.get("flight_id") or ""
    flight_id = flight_id_raw.upper() if isinstance(flight_id_raw, str) else ""

    flight: dict[str, Any] | None = None
    if flight_id:
        try:
            flight = await lookup_flight.ainvoke({"flight_number": flight_id})
        except Exception as err:  # noqa: BLE001 — demo robustness
            _logger.warning("lookup_flight failed for %s: %s", flight_id, err)

    prior = _extract_prior_submit_context(state["messages"])
    party_text = _format_party(prior)

    base_messages = [
        SystemMessage(content=_CONFIRM_BOOKING_SYSTEM.format(
            flight_json=json.dumps(flight, indent=2) if flight else "null",
            party_text=party_text,
            flight_id=flight_id,
        )),
        HumanMessage(content=f"Emit the confirmation surface for flight {flight_id or '(unknown)'}."),
    ]
    try:
        spec = await _emit_with_retry(ConfirmationSpec, base_messages)
    except RuntimeError as err:
        _logger.error("Falling back to sentinel confirmation surface: %s", err)
        spec = _build_sentinel_confirmation(flight_id, party_text)
    return {"messages": [AIMessage(content=_wrap_envelopes(spec))]}
```

- [ ] **Step 2: Verify import**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "from src.a2ui_graph import confirm_booking; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/a2ui_graph.py
git commit -m "feat(c-a2ui): confirm_booking node — LLM-authored confirmation surface (umbrella)"
```

---

## Task 3: Wire `route()` + `_builder` to dispatch flightSelect

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/a2ui_graph.py`

- [ ] **Step 1: Update `route()`**

Find the existing `route()` function and replace it with:

```python
def route(state: MessagesState) -> Command[Literal["build_form", "search_flights", "confirm_booking"]]:
    """Inspect the last message — submit event → search_flights, flight-select
    event → confirm_booking, else build_form."""
    last_content = getattr(state["messages"][-1], "content", "") if state["messages"] else ""
    if _is_submit_event(last_content):
        return Command(goto="search_flights")
    if _is_flight_select_event(last_content):
        return Command(goto="confirm_booking")
    return Command(goto="build_form")
```

- [ ] **Step 2: Add `confirm_booking` to the graph builder**

Find the `_builder = StateGraph(MessagesState)` block. Insert this line after `_builder.add_node("search_flights", search_flights)`:

```python
_builder.add_node("confirm_booking", confirm_booking)
```

Add an edge after `_builder.add_edge("search_flights", END)`:

```python
_builder.add_edge("confirm_booking", END)
```

- [ ] **Step 3: Verify graph compiles + routing works**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "
import json
from src.a2ui_graph import graph, _is_flight_select_event, _is_submit_event
print('TYPE:', type(graph).__name__)
print('SELECT_TRUE:', _is_flight_select_event(json.dumps({'version':'v1','action':{'name':'flightSelect','context':{'flightId':{'literalString':'UA123'}}}})))
print('SELECT_FALSE:', _is_flight_select_event(json.dumps({'action':{'name':'bookingSubmit'}})))
print('SUBMIT_TRUE:', _is_submit_event(json.dumps({'action':{'name':'bookingSubmit'}})))
"`
Expected output:
```
TYPE: CompiledStateGraph
SELECT_TRUE: True
SELECT_FALSE: False
SUBMIT_TRUE: True
```

- [ ] **Step 4: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/a2ui_graph.py
git commit -m "feat(c-a2ui): route + graph wires flightSelect → confirm_booking (umbrella)"
```

---

## Task 4: End-to-end real-LLM smoke (umbrella)

**Files:**
- Read-only: repo root `.env` for `OPENAI_API_KEY`

- [ ] **Step 1: Confirm key present**

Run from repo root: `grep -q '^OPENAI_API_KEY=' .env && echo found`
Expected: `found`

- [ ] **Step 2: Simulate full flow programmatically**

Run from repo root:
```bash
set -a; source .env; set +a
cd cockpit/langgraph/streaming/python && uv run python -c "
import asyncio, json
from src.a2ui_graph import graph, A2UI_PREFIX
from langchain_core.messages import HumanMessage

async def main():
    submit = json.dumps({
        'version': 'v1',
        'action': {
            'name': 'bookingSubmit',
            'surfaceId': 'booking',
            'sourceComponentId': 'submit',
            'timestamp': '2026-05-17T00:00:00Z',
            'context': {
                'formId': {'literalString': 'booking'},
                'origin': {'literalString': 'LAX'},
                'dest':   {'literalString': 'JFK'},
                'date':   {'literalString': '2026-06-15'},
                'passengers':  {'literalNumber': 2},
                'fare_class':  {'literalString': 'Business'},
            },
        },
    })
    select = json.dumps({
        'version': 'v1',
        'action': {
            'name': 'flightSelect',
            'surfaceId': 'results',
            'sourceComponentId': 'btn_1',
            'timestamp': '2026-05-17T00:00:30Z',
            'context': {
                'flightId': {'literalString': 'UA123'},
            },
        },
    })
    # Sequential turns to populate thread history so confirm can walk back
    state = await graph.ainvoke({'messages': [HumanMessage(content=submit)]})
    state2 = await graph.ainvoke({'messages': state['messages'] + [HumanMessage(content=select)]})
    out = state2['messages'][-1].content
    assert out.startswith(A2UI_PREFIX), f'missing prefix, got: {out[:80]}'
    lines = out.strip().split('\n')[1:]
    envelopes = [json.loads(l) for l in lines]
    print('ENVELOPE_KEYS:', [list(e.keys())[0] for e in envelopes])
    su = next(e for e in envelopes if 'surfaceUpdate' in e)
    print('SURFACE_ID:', su['surfaceUpdate']['surfaceId'])
    comps = su['surfaceUpdate']['components']
    print('N_COMPONENTS:', len(comps))
    flat = json.dumps(comps)
    print('HAS_UA123:', 'UA123' in flat)
    print('HAS_PARTY:', '2 passengers' in flat or 'Business' in flat)
    print('HAS_MODIFY:', 'modifySearch' in flat)

asyncio.run(main())
"
```
Expected: `ENVELOPE_KEYS: ['dataModelUpdate', 'surfaceUpdate', 'beginRendering']`, `SURFACE_ID: confirmation`, `N_COMPONENTS >= 6`, all three `HAS_*` print `True`.

- [ ] **Step 3: If smoke revealed an issue, fix the relevant earlier task and re-run; otherwise no commit needed.**

If you needed to fix something:

```bash
git add cockpit/langgraph/streaming/python/src/a2ui_graph.py
git commit -m "fix(c-a2ui): umbrella smoke fixes for confirm_booking"
```

---

## Task 5: Mirror everything into the standalone

**Files:**
- Modify: `cockpit/chat/a2ui/python/src/graph.py`

The standalone is a full copy of the umbrella with one explicit substitution: the `from src.aviation_tools import find_routes` line is replaced by an inline `_FLIGHTS` dataset and an `_AsyncFn` shim. Apply the same Tasks 1-3 edits to the standalone, plus add a `lookup_flight` shim.

- [ ] **Step 1: Add `lookup_flight` shim alongside `find_routes`**

Find the existing block in `cockpit/chat/a2ui/python/src/graph.py`:

```python
def _find_routes_impl(from_code, to_code, date_offset_days=0):
    return [f for f in _FLIGHTS if f["from"] == from_code and f["to"] == to_code]


find_routes = _AsyncFn(_find_routes_impl)
```

Insert immediately after `find_routes = _AsyncFn(_find_routes_impl)`:

```python


def _lookup_flight_impl(flight_number: str) -> dict | None:
    """Inline mirror of aviation_tools.lookup_flight for the standalone."""
    return next((f for f in _FLIGHTS if f["flight_number"] == flight_number), None)


lookup_flight = _AsyncFn(_lookup_flight_impl)
```

- [ ] **Step 2: Add `ConfirmationSpec`**

Find the existing `class FlightResultsSpec(_SurfaceSpec): pass`. Append:

```python


class ConfirmationSpec(_SurfaceSpec):
    """Booking confirmation surface — selected flight + prior party context."""
    pass
```

- [ ] **Step 3: Add `_is_flight_select_event`, `_extract_prior_submit_context`, `_format_party`**

Find the existing `_is_submit_event` in the standalone. Append the same three helpers as Task 1 Step 3 (byte-for-byte identical):

```python


def _is_flight_select_event(content: str) -> bool:
    """True iff the content is a v1 A2uiActionMessage named flightSelect."""
    try:
        payload = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return False
    if not isinstance(payload, dict):
        return False
    action = payload.get("action")
    return (
        isinstance(action, dict)
        and action.get("name") == "flightSelect"
    )


def _extract_prior_submit_context(messages: list[Any]) -> dict[str, Any]:
    """Walk back, find the most recent bookingSubmit A2UI action message;
    return its unwrapped context dict (origin/dest/date/passengers/fare_class).
    Returns {} if not found."""
    for msg in reversed(messages):
        content = getattr(msg, "content", None)
        if not isinstance(content, str):
            continue
        try:
            payload = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            continue
        if (
            isinstance(payload, dict)
            and isinstance(payload.get("action"), dict)
            and payload["action"].get("name") == "bookingSubmit"
        ):
            ctx = payload["action"].get("context", {})
            if not isinstance(ctx, dict):
                return {}
            return {k: _unwrap_literal(v) for k, v in ctx.items()}
    return {}


def _format_party(prior: dict[str, Any]) -> str:
    """Pretty-print passenger count + fare class for the confirmation text.
    Tolerant of missing fields."""
    parts: list[str] = []
    n = prior.get("passengers")
    if isinstance(n, (int, float)) and n > 0:
        parts.append(f"{int(n)} passenger" + ("" if int(n) == 1 else "s"))
    fare = prior.get("fare_class")
    if isinstance(fare, str) and fare:
        parts.append(fare)
    return "  •  ".join(parts) if parts else "(party details unavailable)"
```

- [ ] **Step 4: Add `_CONFIRM_BOOKING_SYSTEM`, `_build_sentinel_confirmation`, and `confirm_booking` (paste umbrella block from Task 1 Step 4 + Task 2 Step 1)**

Find the existing `_SENTINEL_RESULTS` constant in the standalone. Append everything from Task 1 Step 4 (the prompt + sentinel builder) AND Task 2 Step 1 (the `confirm_booking` async function). Identical code — no substitutions needed since `lookup_flight` resolves to the shim we added in Step 1 above.

- [ ] **Step 5: Update `route()` + graph wiring (paste from Task 3 Steps 1-2)**

Replace the standalone's existing `route()` with the new 3-way version from Task 3 Step 1. Add `_builder.add_node("confirm_booking", confirm_booking)` and `_builder.add_edge("confirm_booking", END)` per Task 3 Step 2.

- [ ] **Step 6: Verify standalone module imports + graph compiles**

Run: `cd cockpit/chat/a2ui/python && uv run python -c "
import asyncio, json
from src.graph import graph, confirm_booking, ConfirmationSpec, lookup_flight, _is_flight_select_event, _build_sentinel_confirmation
print('TYPE:', type(graph).__name__)
async def main():
    r = await lookup_flight.ainvoke({'flight_number':'UA123'})
    print('LOOKUP_UA123:', r and r['airline'] + r['flight_number'])
asyncio.run(main())
print('SELECT_TRUE:', _is_flight_select_event(json.dumps({'action':{'name':'flightSelect','context':{}}})))
print('SENT_IDS:', [c.id for c in _build_sentinel_confirmation('AA456', '2 passengers  •  Economy').components])
"`
Expected output:
```
TYPE: CompiledStateGraph
LOOKUP_UA123: UAUA123
SELECT_TRUE: True
SENT_IDS: ['root', 'card', 'card_col', 'title', 'party', 'modify', 'modify_label']
```

- [ ] **Step 7: Commit**

```bash
git add cockpit/chat/a2ui/python/src/graph.py
git commit -m "feat(c-a2ui standalone): mirror confirm_booking + lookup_flight shim"
```

---

## Task 6: Build verification

**Files:** none (verification only)

- [ ] **Step 1: Build the umbrella python**

Run from repo root: `pnpm nx run cockpit-langgraph-streaming-python:build`
Expected: green.

- [ ] **Step 2: Build the standalone python**

Run: `pnpm nx run cockpit-chat-a2ui-python:build`
Expected: green.

- [ ] **Step 3: Build the Angular app (sanity)**

Run: `pnpm nx run cockpit-chat-a2ui-angular:build`
Expected: green. (Frontend untouched.)

- [ ] **Step 4: Production deploy manifest unchanged**

Run: `npx tsx scripts/generate-shared-deployment-config.ts && git diff deployments/shared-dev/langgraph.json`
Expected: empty diff. The manifest only knows about the umbrella; standalone changes don't propagate.

- [ ] **Step 5: No commit (verification only)**

---

## Task 7: REQUIRED — chrome MCP end-to-end smoke

**Files:** none (verification only). Requires `OPENAI_API_KEY` in repo-root `.env`.

Spot-check the full flow against the per-cap **standalone** backend (not umbrella) so we exercise the mirror.

- [ ] **Step 1: Start standalone backend + Angular dev**

Background shell 1:
```bash
set -a; source .env; set +a
pnpm nx run cockpit-chat-a2ui-python:serve
```

Background shell 2:
```bash
pnpm nx serve cockpit-chat-a2ui-angular --port 4511
```

Wait for both to be ready (backend log: `Application started up`; frontend log: `Local:.*4511`).

- [ ] **Step 2: Drive the full flow via chrome MCP**

Use `mcp__Claude_in_Chrome__javascript_tool` to JS-inject the first prompt (avoids the known Angular hydration race), then drive the form via chrome MCP's `computer` actions (real keyboard works once mounted).

1. Navigate `http://localhost:4511/`
2. JS-inject "I want to fly from LAX to JFK", press Enter → booking form renders (verify via DOM: `a2ui-multiple-choice` count ≥ 2, `a2ui-button` ≥ 1, body text includes "Book a flight")
3. Select Origin = LAX, Destination = JFK, accept defaults (1 passenger, Economy)
4. Click **Search flights** → results surface renders with at least one flight Card (verify via DOM: `a2ui-card` count ≥ 2, text includes a flight number from the standalone's `_FLIGHTS` set: UA123, AA456, DL789, B6101, or UA204)
5. Click **Select** on the first flight Card → confirmation surface renders
6. Verify confirmation surface DOM:
   - `a2ui-surface` count = 3 (booking + results + confirmation)
   - Latest `a2ui-surface` text includes the flight number + party text + "Modify search"
7. Click **Modify search** → booking form re-renders (via build_form fallback)

Take a screenshot at step 5 with `save_to_disk: true` for the PR description.

- [ ] **Step 3: If any step fails**

Inspect:
- Backend log (`/tmp/...` from the nx run task) for traceback or retry exhaustion
- Direct `curl` against `http://localhost:5511/threads/.../state` to see what envelopes the agent actually emitted
- Frontend console for A2UI parse errors

Fix the relevant earlier task's code, restart backend, re-run the chrome flow.

- [ ] **Step 4: Stop background servers**

---

## Task 8: Open PR + watch CI + merge

- [ ] **Step 1: Push branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(c-a2ui): select-flight confirmation surface" --body "$(cat <<'EOF'
## Summary
Wires the existing \`flightSelect\` action (Select button on the c-a2ui results surface) to a new LLM-authored A2UI **confirmation surface**.

Previously: clicking Select on a flight Card dispatched the action message but the agent's \`route()\` only matched \`bookingSubmit\`, so flightSelect fell through to \`build_form\` and re-rendered an empty booking form — misleading and wasted.

After: a fourth graph node \`confirm_booking\` runs on flightSelect events. It:
1. Parses the action context for \`flightId\`
2. Calls \`lookup_flight()\` for full flight details
3. Walks the message history (\`_extract_prior_submit_context\`) for the user's prior \`bookingSubmit\` to recover \`passengers\` + \`fare_class\`
4. Calls gpt-5 with \`.with_structured_output(ConfirmationSpec)\` + retry to emit the surface
5. Falls back to a hardcoded sentinel surface (with the looked-up flight number + party text) if retry exhausts

Modify search button works as before — falls through \`route()\` to \`build_form\`, which re-renders an empty form.

## Files
- \`cockpit/langgraph/streaming/python/src/a2ui_graph.py\` — umbrella additions
- \`cockpit/chat/a2ui/python/src/graph.py\` — full-copy mirror per PR #396 + \`lookup_flight\` shim

## Test plan
- [x] \`pnpm nx run cockpit-langgraph-streaming-python:build\` — green
- [x] \`pnpm nx run cockpit-chat-a2ui-python:build\` — green
- [x] \`pnpm nx run cockpit-chat-a2ui-angular:build\` — green
- [x] \`npx tsx scripts/generate-shared-deployment-config.ts\` — shared manifest diff empty
- [x] Programmatic real-LLM smoke against umbrella: bookingSubmit (LAX→JFK, 2 passengers, Business) → flightSelect (UA123) → confirmation surface with UA123 + "2 passengers" + "Business" + Modify search
- [x] Chrome MCP smoke against per-cap standalone (5511): full flow LAX→JFK → Select UA123 → confirmation card with flight details + party text + Modify search; click Modify search returns to booking form
- [ ] CI

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

`gh pr checks <PR_NUMBER> --watch`

- [ ] **Step 4: Squash-merge on green**

`gh pr merge <PR_NUMBER> --squash`

---

## Self-Review

**Spec coverage:**
- Decision 1 (history walk for party context) → `_extract_prior_submit_context` in Tasks 1, 5 ✓
- Decision 2 (lookup_flight for selected flight) → Task 1 Step 1 import + Task 5 Step 1 shim ✓
- Decision 3 (modifySearch falls through unchanged) → unchanged in `route()`; Task 3 Step 1's new function still defaults to build_form ✓
- Decision 4 (sentinel includes flight_id + party_text) → `_build_sentinel_confirmation` in Tasks 1, 5 ✓
- 4-node architecture → Task 3 Step 2 wires `confirm_booking` into the builder ✓
- ConfirmationSpec Pydantic class → Task 1 Step 2, Task 5 Step 2 ✓
- Confirmation surface composition (all 11 component ids in card_col) → spelled out in `_CONFIRM_BOOKING_SYSTEM` prompt in Tasks 1, 5 ✓
- Frontend NO changes → confirmed in Tasks 6 (Step 3 sanity), 7 ✓
- Standalone mirror per PR #396 full-copy policy → Task 5 ✓

**Placeholder scan:** No TBDs. Every step shows full code. Task 5 explicitly references "paste from Task 1 Step 4 + Task 2 Step 1" — acceptable because (a) the code in those tasks IS the source of truth, (b) standalone is required to be byte-identical to umbrella per the full-copy decision, (c) repeating the full body would double the plan length without adding clarity.

**Type consistency:**
- `ConfirmationSpec`, `_build_sentinel_confirmation(flight_id, party_text)`, `_format_party(prior)`, `_extract_prior_submit_context(messages)`, `_is_flight_select_event(content)` — all signatures match across Tasks 1, 2, 5.
- `_CONFIRM_BOOKING_SYSTEM` placeholders (`flight_json`, `party_text`, `flight_id`) match the call site in `confirm_booking()` Task 2 Step 1.
- Routing return type `Command[Literal["build_form", "search_flights", "confirm_booking"]]` matches the 3 strings used as `goto` targets.
- `lookup_flight.ainvoke({"flight_number": ...})` signature matches umbrella's `@tool` definition AND the standalone shim's `_AsyncFn.ainvoke(args)` which forwards as `_lookup_flight_impl(flight_number=...)`.
