# c-a2ui Select-Flight Confirmation Surface — Design

**Date:** 2026-05-17
**Status:** Spec — pending implementation plan

## Goal

When the user clicks **Select** on a flight Card in the c-a2ui results surface, the agent should emit a third LLM-authored A2UI surface — a booking confirmation showing the selected flight's full details, the user's prior party choices (passenger count + fare class), and a **Modify search** button that returns to the booking form.

Today: the Select button already emits an `A2uiActionMessage` with `action.name == "flightSelect"` (PR 4 wired the button; PR 396 ensured the per-cap standalone matched). But the agent's `route()` only routes `bookingSubmit`; `flightSelect` falls through to `build_form` and re-renders the empty booking form — misleading and wasted.

Out of scope:
- Real booking commit / payment
- Multi-leg / round-trip itineraries
- Re-prefilling the booking form with the user's prior selections (Modify Search starts fresh, matching today's `modifySearch` action behavior)

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Where party-context comes from | `_extract_prior_submit_context()` walks `state["messages"]` in reverse, finds the most recent message whose content parses as `A2uiActionMessage` with `action.name == "bookingSubmit"`, unwraps `action.context` to get the prior `origin/dest/date/passengers/fare_class`. No new fields on the Select button. |
| 2 | Where flight details come from | `lookup_flight(flight_number)` from `aviation_tools` (umbrella) or a new inlined `_AsyncFn` shim alongside the existing `find_routes` shim (standalone). The Select button's action context carries only `flightId`. |
| 3 | Modify search behavior | Unchanged — `modifySearch` falls through `route()` → `build_form`, which re-renders the empty booking form. Already works accidentally. |
| 4 | Sentinel fallback | New `_SENTINEL_CONFIRMATION`: minimal Card titled "Booking selected" with the looked-up flight number + a Modify search button. Activated when retry exhausts. |

## Architecture

4-node graph (extends today's 3-node graph):

```
START → route ─→ build_form        (default first turn → emit booking form)
         ├─────→ search_flights    (bookingSubmit → call find_routes + emit results surface)
         └─────→ confirm_booking   (flightSelect → call lookup_flight + walk history for party + emit confirmation surface)
                                 → END
```

`route(state)` adds one new branch:

```python
def route(state) -> Command[Literal["build_form", "search_flights", "confirm_booking"]]:
    last_content = getattr(state["messages"][-1], "content", "") if state["messages"] else ""
    if _is_submit_event(last_content):
        return Command(goto="search_flights")
    if _is_flight_select_event(last_content):
        return Command(goto="confirm_booking")
    return Command(goto="build_form")
```

The `_is_submit_event` test stays exactly as it is. `_is_flight_select_event` is new.

## Pydantic schema (new)

```python
class ConfirmationSpec(_SurfaceSpec):
    """Booking confirmation surface — selected flight + prior party context."""
    pass
```

Empty subclass mirroring `BookingFormSpec` and `FlightResultsSpec`. Keeps the `_emit_with_retry(spec_cls, ...)` API uniform.

## confirm_booking node

```python
async def confirm_booking(state: MessagesState) -> dict:
    """Post-Select node: look up the chosen flight, recover party context from prior submit, emit confirmation surface."""
    last = state["messages"][-1]
    select_data = _parse_submit_payload(getattr(last, "content", "")) or {}
    flight_id = (select_data.get("flightId") or "").upper()

    flight: dict[str, Any] | None = None
    if flight_id:
        try:
            flight = await lookup_flight.ainvoke({"flight_number": flight_id})
        except Exception as err:  # noqa: BLE001 — demo robustness
            _logger.warning("lookup_flight failed for %s: %s", flight_id, err)

    prior = _extract_prior_submit_context(state["messages"])
    party_text = _format_party(prior)  # e.g. "1 passenger  •  Economy"

    base_messages = [
        SystemMessage(content=_CONFIRM_BOOKING_SYSTEM.format(
            flight_json=json.dumps(flight, indent=2) if flight else "null",
            party_text=party_text,
            flight_id=flight_id,
        )),
        HumanMessage(content=f"Emit the confirmation surface for flight {flight_id}."),
    ]
    try:
        spec = await _emit_with_retry(ConfirmationSpec, base_messages)
    except RuntimeError as err:
        _logger.error("Falling back to sentinel confirmation surface: %s", err)
        spec = _build_sentinel_confirmation(flight_id, party_text)
    return {"messages": [AIMessage(content=_wrap_envelopes(spec))]}
```

`_parse_submit_payload` already exists from PR 4; it generically unwraps any `A2uiActionMessage` context dict. Reuses cleanly.

## Helpers (new)

### `_is_flight_select_event(content: str) -> bool`

Symmetric with `_is_submit_event`:

```python
def _is_flight_select_event(content: str) -> bool:
    try:
        payload = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return False
    return (
        isinstance(payload, dict)
        and isinstance(payload.get("action"), dict)
        and payload["action"].get("name") == "flightSelect"
    )
```

### `_extract_prior_submit_context(messages) -> dict[str, Any]`

Walk back, find most recent `bookingSubmit`, return its unwrapped context (origin/dest/date/passengers/fare_class). Returns `{}` if not found.

```python
def _extract_prior_submit_context(messages: list[Any]) -> dict[str, Any]:
    """Find the most recent bookingSubmit A2UI action message; return its context dict."""
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
```

### `_format_party(prior: dict) -> str`

Pretty-print passenger count + fare class for the confirmation text. Tolerant of missing fields.

```python
def _format_party(prior: dict[str, Any]) -> str:
    """Format passenger count + fare class for display."""
    parts: list[str] = []
    n = prior.get("passengers")
    if isinstance(n, (int, float)) and n > 0:
        parts.append(f"{int(n)} passenger" + ("" if int(n) == 1 else "s"))
    fare = prior.get("fare_class")
    if isinstance(fare, str) and fare:
        parts.append(fare)
    return "  •  ".join(parts) if parts else "(party details unavailable)"
```

## Confirmation surface composition (LLM prompt)

`_CONFIRM_BOOKING_SYSTEM` prompt instructs the LLM to emit:

```
root          (Column, children=[card])
card          (Card, child=card_col)
card_col      (Column, children=[title, route_text, time_text, gate_text, divider, party_text, modify])
title         (Text, "<airline> flight <flight_number>", usageHint=h2)
route_text    (Text, "<from> → <to>  •  <duration_min> min  •  <aircraft>", usageHint=body)
time_text     (Text, "Depart <depart_local>  •  Arrive <arrive_local>", usageHint=caption)
gate_text     (Text, "Gate <gate>", usageHint=caption)
divider       (Divider, {})
party_text    (Text, "<party_text from helper>", usageHint=body)
modify        (Button, child=modify_label, primary=true,
               action={"name": "modifySearch", "context": [{"key": "formId", "value": "booking"}]})
modify_label  (Text, "Modify search")
```

Constraints in the prompt: `surface_id = "confirmation"`, `data_model = {}`.

## Sentinel fallback

```python
def _build_sentinel_confirmation(flight_id: str, party_text: str) -> ConfirmationSpec:
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

Built per-call (not module-level) so the sentinel can include the actual flight_id and party_text instead of a static "Results unavailable".

## Standalone mirror (`cockpit/chat/a2ui/python/src/graph.py`)

Add a `lookup_flight` shim alongside the existing `find_routes`:

```python
def _lookup_flight_impl(flight_number: str) -> dict | None:
    return next((f for f in _FLIGHTS if f["flight_number"] == flight_number), None)

lookup_flight = _AsyncFn(_lookup_flight_impl)
```

All other additions (schema, prompt, node, helpers, sentinel) are byte-for-byte mirrors of the umbrella version per the per-cap full-copy policy from PR 396.

## Files modified

| File | Change |
|---|---|
| `cockpit/langgraph/streaming/python/src/a2ui_graph.py` | Add `_is_flight_select_event`, `_extract_prior_submit_context`, `_format_party`, `ConfirmationSpec`, `_build_sentinel_confirmation`, `_CONFIRM_BOOKING_SYSTEM`, `confirm_booking`. Extend `route()`. Extend graph compile to add the new node. |
| `cockpit/chat/a2ui/python/src/graph.py` | Same changes as umbrella + add `lookup_flight = _AsyncFn(_lookup_flight_impl)` shim. |
| `cockpit/langgraph/streaming/python/src/a2ui_graph.py` (imports) | Add `from src.aviation_tools import lookup_flight` |

No frontend changes — the Select button already exists in the results surface.

## Testing

**Programmatic (curl, run from repo root, no per-cap servers required for this test path):**
1. Start umbrella backend: `nx run cockpit-chat-a2ui-python:serve` (port 5511)
2. Create thread, simulate full flow:
   - Send `bookingSubmit` action message with `context: {origin: LAX, dest: JFK, passengers: 2, fare_class: Business, ...}` → expect results surface
   - In the SAME thread, send `flightSelect` action message with `context: {flightId: UA123}` → expect confirmation surface
3. Assert: response starts with `---a2ui_JSON---`, contains exactly 3 envelope keys (`dataModelUpdate`/`surfaceUpdate`/`beginRendering`), `surface_id == "confirmation"`, components include the looked-up `UA123` flight number AND "2 passengers" AND "Business"

**Chrome MCP smoke (against per-cap a2ui standalone on 5511):**
1. Send "I want to fly LAX to JFK" → form renders
2. Fill in (or accept defaults) → click Search flights → results surface
3. Click Select on UA123 → confirmation surface appears with the selected flight details + "1 passenger • Economy" (or whatever was submitted)
4. Click Modify search → booking form re-renders

## Risks and mitigations

- **Walking history to find prior context relies on the chat lib continuing to send a2ui_event messages as HumanMessage with serialized JSON content.** Today that's how it works. Mitigation: `_extract_prior_submit_context()` returns `{}` on any parse failure, and `_format_party` gracefully degrades to `(party details unavailable)`.
- **lookup_flight may return None for unknown flight numbers.** The confirmation prompt renders without route/time/gate text in that case — title falls back to bare "Flight <id> selected". Sentinel handles the worst case.
- **gpt-5 retry exhaustion.** Same risk as the other 2 surfaces; same sentinel pattern mitigates.
- **The standalone's `_FLIGHTS` list has only 5 entries.** Selecting any other airline's flight (from umbrella's 30-flight dataset) won't resolve in standalone. Documented; aligns with the "self-contained example" purpose of standalones.

## Out-of-scope follow-ups

- Real booking commit (would need a new `commitBooking` action + payment surface)
- Pre-fill the booking form with the user's prior selections on Modify search
- Persistence of party context across thread restart (currently relies on the message history in-thread)
- An equivalent "review/edit before confirm" intermediate surface
