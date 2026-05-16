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


# ── LLM + retry ─────────────────────────────────────────────────────────────

# gpt-5 with low reasoning effort: PR #372 established gpt-5 follows
# directive precisely; "low" gives slightly more headroom than "minimal"
# for schema compliance.
_llm: ChatOpenAI | None = None


def _get_llm() -> ChatOpenAI:
    """Lazy-initialize the LLM so imports succeed without OPENAI_API_KEY set."""
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(
            model="gpt-5",
            streaming=True,
            reasoning_effort="low",
        )
    return _llm


async def _emit_with_retry(
    spec_cls: type[_SurfaceSpec],
    base_messages: list[Any],
    max_attempts: int = 3,
) -> _SurfaceSpec:
    """Call the LLM with structured output, retrying on validation failure.

    Each retry re-injects the error message so the model has a chance
    to correct its output. After max_attempts, raises RuntimeError.
    """
    llm = _get_llm().with_structured_output(spec_cls)
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
