# c-a2ui LLM-Driven Aviation Booking Form — Design

**Date:** 2026-05-16
**Status:** Spec — pending implementation plan
**Series:** PR 4 of 4 in the c-* aviation theme rollout

## Goal

Replace the hardcoded contact-form JSONL in `cockpit/langgraph/streaming/python/src/a2ui_graph.py` with an **LLM-authored** aviation flight-booking form, plus an LLM-authored follow-up "flight results" surface after submit. Constrain the LLM's JSON output to valid A2UI shapes via `.with_structured_output()` + Pydantic schemas, with retry on validation failure.

The existing code's docstring says *"The graph does NOT use an LLM for UI generation — A2UI JSONL requires exact format adherence that LLMs cannot reliably provide."* This PR proves the opposite is achievable when the LLM emits **schema-constrained structured output** rather than raw JSON strings.

Out of scope:
- Multi-leg / round-trip itineraries
- Real payment surface
- "Select flight" booking action — the button emits an acknowledgement only

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | LLM role | LLM emits the A2UI components directly via `.with_structured_output(BookingFormSpec)` / `.with_structured_output(FlightResultsSpec)`. Code wraps the validated output in the three deterministic envelopes (`createSurface`, `updateDataModel`, `updateComponents`). |
| 2 | Post-submit behavior | LLM emits a SECOND A2UI surface — a flight-results list — after calling `find_routes()` for the submitted origin/destination. Two LLM-authored surfaces per session. |
| 3 | Retry policy | On `ValidationError` / `OutputParserException`, retry up to 2× with the failure message re-injected into the prompt. After 3 total attempts, fall back to a hardcoded sentinel form. |
| 4 | LLM choice | `gpt-5` with `reasoning_effort="low"`. Matches PR #372's pattern of using gpt-5 for tool-discipline; "low" gives slightly more headroom than "minimal" for schema compliance. |

## Architecture

3-node graph (replaces today's single `create_form` node):

```
START → route ─→ build_form     (first turn → emit booking-form A2UI envelopes)
         └─────→ search_flights (form submit → call find_routes + emit results envelopes)
                              → END
```

`route(state)` inspects the last message:
- If `content` parses as `{"type": "a2ui_event", "context": {"formId": "booking"}}` and includes form data → goto `search_flights`
- Otherwise → goto `build_form`

`build_form(state)`:
1. LLM call: `_llm.with_structured_output(BookingFormSpec).ainvoke(messages)` with system prompt listing airports/fare-classes/required components + a few-shot example envelope
2. Retry up to 2× on validation failure (max 3 attempts total)
3. Wrap result in 3 envelopes: `createSurface(surface_id, catalogId='basic', sendDataModel=True)`, `updateDataModel(value=data_model)`, `updateComponents(components=components)`
4. Concatenate as JSONL, prepend `A2UI_PREFIX`, emit as `AIMessage(content=jsonl)`

`search_flights(state)`:
1. Parse form-submit payload → `(origin, dest, date, passengers, fare_class)`
2. Call `find_routes(origin, dest)` from `src.aviation_tools` (already exists from PR 1)
3. LLM call: `_llm.with_structured_output(FlightResultsSpec).ainvoke(messages + flight context)`
4. Wrap + emit same way as `build_form`

## Pydantic schemas

```python
from typing import Any, Literal
from pydantic import BaseModel, Field

class A2uiComponent(BaseModel):
    """Single component in an A2UI updateComponents envelope.

    Literal[...] on `component` is the gate that keeps the LLM from
    inventing component types not in the catalog.
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
    value: dict[str, Any] | None = None       # {"path": "/origin"}
    selected: dict[str, Any] | None = None
    children: list[str] | None = None
    checks: list[dict[str, Any]] | None = None
    action: dict[str, Any] | None = None

class BookingFormSpec(BaseModel):
    surface_id: str = Field(description="Surface id, use 'booking'")
    data_model: dict[str, Any] = Field(description="Form prefills, e.g. {origin, dest, date, passengers, fare_class}")
    components: list[A2uiComponent]

class FlightResultsSpec(BaseModel):
    surface_id: str = Field(description="Surface id, use 'results'")
    data_model: dict[str, Any]
    components: list[A2uiComponent]
```

## Aviation form contents

LLM is prompted to include these components:

| Field | Component | Notes |
|---|---|---|
| Origin | `ChoicePicker` | options = 10 IATA codes: LAX, JFK, SFO, ORD, BOS, ATL, DFW, SEA, MIA, DEN. `selected: {path:"/origin"}` |
| Destination | `ChoicePicker` | same options. `selected: {path:"/dest"}` |
| Departure date | `TextField` | `value: {path:"/date"}`, placeholder "YYYY-MM-DD". Validation check: format YYYY-MM-DD. |
| Passengers | `NumberField` | `value: {path:"/passengers"}`, default 1, min 1, max 9 |
| Fare class | `ChoicePicker` | options = `["Economy", "Premium", "Business", "First"]`. `selected: {path:"/fare_class"}` |
| Submit | `Button` | gated `checks`: origin/dest both set AND different AND date present. `action: {event: {name:"bookingSubmit", context:{formId:"booking"}}}` |

Default `data_model`: `{"origin": "", "dest": "", "date": "", "passengers": 1, "fare_class": "Economy"}`.

## Flight-results surface contents

For each flight returned by `find_routes(origin, dest)`:
- `Card` titled `"<airline> flight <number>"`
- Sub-text: `"<depart_local> → <arrive_local> (<duration_min> min)"`, aircraft, gate
- "Select" `Button` with `action: {event: {name:"flightSelect", context:{flightId:"<flight_number>"}}}`

If `find_routes()` returns an empty list, emit a `Card` titled `"No flights found"` with a "Modify search" `Button` that re-emits the booking-form surface (text-only acknowledgement is fine for v1).

## Retry implementation

```python
async def emit_with_retry(llm_fn, max_attempts=3):
    last_err = None
    messages = base_messages
    for attempt in range(max_attempts):
        try:
            return await llm_fn(messages)
        except (ValidationError, OutputParserException) as err:
            last_err = err
            messages = base_messages + [
                AIMessage(content=f"Previous attempt failed validation: {err}. Try again, strictly matching the schema."),
            ]
    raise RuntimeError(f"LLM failed structured output after {max_attempts} attempts: {last_err}")
```

## LLM prompts

**`build_form` system prompt:**
```
You are an aviation booking-form designer. Emit an A2UI booking form using the structured output schema. Required components: origin picker, destination picker, departure date, passenger count, fare class, submit button.

Airports (use these IATA codes as ChoicePicker options for both origin and destination):
LAX, JFK, SFO, ORD, BOS, ATL, DFW, SEA, MIA, DEN

Fare classes (ChoicePicker options): Economy, Premium, Business, First

Default data_model: {origin:"", dest:"", date:"", passengers:1, fare_class:"Economy"}

Submit button must:
- Be gated by checks that require origin and dest set, origin != dest, and date present
- Emit action {event: {name:"bookingSubmit", context:{formId:"booking"}}} when clicked

Wrap fields in a single Card with title "Book a flight" inside a Column root.
```

**`search_flights` system prompt:**
```
You just received a booking submission. Form data: {origin, dest, date, passengers, fare_class}. The find_routes tool returned the following flights: <inlined list>.

Emit an A2UI results surface using FlightResultsSpec. For each flight, create a Card titled with airline + flight number, listing depart/arrive times, duration, aircraft, gate. Each Card has a "Select" Button whose action emits {event: {name:"flightSelect", context:{flightId:<flight_number>}}}.

If the flights list is empty, emit a single Card "No flights found" with a "Modify search" Button.
```

## Standalone copy

This PR also updates the per-capability standalone at `cockpit/chat/a2ui/python/` if it exists. Will inspect during implementation and mirror the changes (analytics inlined, separate copy of the schemas) — same pattern as PR 3's standalone treatment.

## Files modified

| File | Change |
|---|---|
| `cockpit/langgraph/streaming/python/src/a2ui_graph.py` | Full rewrite — 3 nodes, LLM with structured output, Pydantic schemas, retry helper, find_routes integration |
| `cockpit/chat/a2ui/python/src/...` | Mirror if a standalone exists |

No frontend changes — chat-lib's A2UI primitives already render any valid envelope.

## Testing

**Programmatic:**
- Smoke `build_form` produces a JSONL string with 3 envelope keys (`createSurface`, `updateDataModel`, `updateComponents`) and at least 6 components (origin, dest, date, passengers, fare_class, submit)
- Smoke `search_flights` with a submit payload for LAX→JFK produces a JSONL string referencing at least one Card with a flight number from `aviation_data.FLIGHTS`
- Retry path: monkeypatch the LLM to return invalid JSON on first call → verify retry kicks in and second call succeeds

**Chrome MCP (gating):**
- `OPENAI_API_KEY` from repo root `.env`
- "I want to fly somewhere" → booking form renders with all 6 fields, airport pickers, fare-class picker, disabled Submit
- Pick LAX origin, JFK dest, date 2026-06-15, 2 passengers, Business → Submit becomes enabled, click it → flight results surface appears with 1+ Cards listing matching flights from `aviation_data`
- Validate no console errors related to A2UI parsing

## Risks and mitigations

- **`.with_structured_output()` on gpt-5 may not be fully wired in langchain-openai 1.1.12.** Mitigation: if structured-output mode errors at compile time, fall back to `model_kwargs={"response_format": {"type": "json_schema", "json_schema": {…}}}` (raw Responses-API call). Detect at module load, log a warning, continue.
- **LLM invents component types outside the catalog.** Caught by `Literal[...]` on `A2uiComponent.component`; Pydantic validation fails; retry kicks in.
- **Two surfaces in sequence (`createSurface "booking"` then `createSurface "results"`) — does the chat-lib handle the surface swap?** Will verify in chrome MCP. If not, the second `createSurface` may need `replace: true` (will check A2UI v0.9 envelope spec) or the LLM emits an `updateComponents` re-write to the same surface.
- **LLM latency.** Two structured-output calls per session (one per surface). gpt-5 with reasoning_effort=low is ~2-4s per call. Acceptable for a demo; surfaces stream as soon as emitted.
- **Fallback form on 3-retry exhaustion.** Hardcoded sentinel keeps the demo from crashing; logs a warning so we notice.

## Out-of-scope follow-ups (track but defer)

- Multi-leg / round-trip booking
- Real "Select flight" action (currently emits an event only)
- A2UI surface state persistence across thread restart
- Surface replace vs. append semantics — confirm during chrome smoke and document the chat-lib behavior
