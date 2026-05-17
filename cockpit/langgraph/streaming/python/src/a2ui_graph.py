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
from pydantic import BaseModel, Field, ValidationError, field_validator

from src.aviation_tools import find_routes, lookup_flight  # noqa: E402

_logger = logging.getLogger(__name__)

A2UI_PREFIX = "---a2ui_JSON---"

# 10 IATA airports from aviation_data.py
AIRPORT_CODES = ["LAX", "JFK", "SFO", "ORD", "BOS", "ATL", "DFW", "SEA", "MIA", "DEN"]
FARE_CLASSES = ["Economy", "Premium", "Business", "First"]

# Catalog component names — must match libs/chat/src/lib/a2ui/catalog/index.ts.
# The chat-lib's unwrapComponentDef() looks for ONE key from this set inside the
# `component` field. Unknown / multiple keys fall through to a stub Text and
# render nothing visible — silent failure mode, hence the field_validator below.
ALLOWED_COMPONENTS = frozenset({
    "AudioPlayer", "Button", "Card", "CheckBox", "Column", "DateTimeInput",
    "Divider", "Icon", "Image", "List", "Modal", "MultipleChoice", "Row",
    "Slider", "Tabs", "Text", "TextField", "Video",
})


# ── Pydantic schemas ────────────────────────────────────────────────────────

class A2uiComponent(BaseModel):
    """Single A2UI v1 updateComponents entry.

    Format (from libs/chat/src/lib/a2ui/surface-to-spec.ts):
        {id: "name_field",
         component: {TextField: {label: "Name", text: {path: "/name"}}}}

    The `component` field MUST be a single-key dict whose key is one of
    ALLOWED_COMPONENTS. The inner dict is the per-component props (see
    libs/a2ui/src/lib/types.ts for the per-component shapes).

    Key per-component notes the LLM must respect:
      Card({child: "<id>"})                         — single child only
      Button({child: "<id>", action: {...}})        — child is a Text id (label)
      Column/Row/List({children: {explicitList:[id,...]}})
      TextField({label, text: {path:"/p"}, textFieldType: "shortText"|"number"|"date"|...})
      MultipleChoice({label, options:[{label,value}], selections:{path}, maxAllowedSelections:1})
      Text({text: "literal or {path:'/p'}", usageHint?: "h1"|"h2"|"body"|...})
      Divider({})
    """
    id: str
    component: dict[str, dict[str, Any]] = Field(
        description=(
            "Single-key map {ComponentName: {props}}. ComponentName must be "
            "one of: " + ", ".join(sorted(ALLOWED_COMPONENTS))
        ),
    )

    @field_validator("component")
    @classmethod
    def _single_known_key(cls, v: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(v, dict) or len(v) != 1:
            raise ValueError(
                f"component must be a single-key dict, got keys: {list(v) if isinstance(v, dict) else type(v)}"
            )
        key = next(iter(v))
        if key not in ALLOWED_COMPONENTS:
            raise ValueError(
                f"component '{key}' not in catalog. Allowed: {sorted(ALLOWED_COMPONENTS)}"
            )
        return v


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


class ConfirmationSpec(_SurfaceSpec):
    """Booking confirmation surface — selected flight + prior party context."""
    pass


# ── Envelope wrapping ───────────────────────────────────────────────────────

# Chat-lib parser (libs/a2ui/src/lib/parser.ts) accepts exactly four envelope
# keys: surfaceUpdate, dataModelUpdate, beginRendering, deleteSurface. Anything
# else (e.g. createSurface, updateComponents) is silently dropped. Surface is
# created implicitly on first surfaceUpdate; beginRendering is what actually
# triggers mount and must include the root component id.

def _to_data_model_contents(model: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert a flat {key:value} dict to the typed A2uiDataModelEntry list shape."""
    contents: list[dict[str, Any]] = []
    for k, v in model.items():
        if isinstance(v, bool):
            contents.append({"key": k, "valueBoolean": v})
        elif isinstance(v, (int, float)):
            contents.append({"key": k, "valueNumber": float(v)})
        elif isinstance(v, str):
            contents.append({"key": k, "valueString": v})
        # dict/list nested values not supported in this demo
    return contents


def _wrap_envelopes(spec: _SurfaceSpec, root_id: str = "root") -> str:
    """Wrap a validated SurfaceSpec into A2UI v1 JSONL.

    Order matters: dataModelUpdate first (so bindings resolve), then
    surfaceUpdate (components), then beginRendering (mount + root id).
    """
    lines = [
        json.dumps({"dataModelUpdate": {
            "surfaceId": spec.surface_id,
            "contents": _to_data_model_contents(spec.data_model),
        }}),
        json.dumps({"surfaceUpdate": {
            "surfaceId": spec.surface_id,
            "components": [c.model_dump(exclude_none=True) for c in spec.components],
        }}),
        json.dumps({"beginRendering": {
            "surfaceId": spec.surface_id,
            "root": root_id,
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
    # method="function_calling" is required because our schema uses
    # `dict[str, Any]` fields (value/selected/checked/checks/action) for
    # A2UI binding payloads. OpenAI's default strict structured-output mode
    # demands additionalProperties=false on every nested object and rejects
    # open dicts. Function-calling mode is more flexible and the model
    # still adheres to the rest of the schema (especially the Literal[...]
    # on component type, which is the actual safety gate we need).
    llm = _get_llm().with_structured_output(spec_cls, method="function_calling")
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

_AIRPORT_OPTIONS = [{"label": c, "value": c} for c in AIRPORT_CODES]
_FARE_OPTIONS = [{"label": c, "value": c} for c in FARE_CLASSES]

_BUILD_FORM_SYSTEM = f"""You are an aviation booking-form designer. Emit an A2UI v1 booking form using the structured output schema.

A2UI FORMAT (CRITICAL): each component is `{{"id": "...", "component": {{"<ComponentName>": {{<props>}}}}}}`. The component name is the SINGLE KEY of the inner dict. ComponentName must be one of:
  Column, Row, Card, Text, TextField, MultipleChoice, DateTimeInput, CheckBox, Button, Divider, List, Image, Icon, Modal, Slider, Tabs

Per-component shapes:
  Column / Row / List: {{"children": {{"explicitList": ["id1", "id2"]}}}}
  Card:                {{"child": "<id>"}}            ← single child only
  Button:              {{"child": "<text-id>", "primary": true, "action": {{"name": "<eventName>", "context": [{{"key":"formId","value":"booking"}}]}}}}
  Text:                {{"text": "literal string", "usageHint": "h2"}}    (h1/h2/h3/h4/h5/caption/body)
  TextField:           {{"label": "Field", "text": {{"path": "/p"}}, "textFieldType": "shortText"}}  (shortText/longText/number/date/obscured)
  MultipleChoice:      {{"label": "Origin", "options": [{{"label":"LAX","value":"LAX"}}], "selections": {{"path":"/origin"}}, "maxAllowedSelections": 1}}
  CheckBox:            {{"label": "...", "checked": {{"path":"/p"}}}}
  Divider:             {{}}

Required form composition for THIS task:
  surface_id MUST be "booking"
  data_model MUST be {{"origin": "", "dest": "", "date": "", "passengers": 1, "fare_class": "Economy"}}

  Build this component tree:
    root (Column, children=[card])
    card (Card, child=card_col)
    card_col (Column, children=[title, origin, dest, date, passengers, fare, submit])
    title (Text, text="Book a flight", usageHint="h2")
    origin (MultipleChoice, label="Origin", options={_AIRPORT_OPTIONS}, selections={{"path":"/origin"}}, maxAllowedSelections=1)
    dest (MultipleChoice, label="Destination", options={_AIRPORT_OPTIONS}, selections={{"path":"/dest"}}, maxAllowedSelections=1)
    date (TextField, label="Departure date (YYYY-MM-DD)", text={{"path":"/date"}}, textFieldType="date")
    passengers (TextField, label="Passengers", text={{"path":"/passengers"}}, textFieldType="number")
    fare (MultipleChoice, label="Fare class", options={_FARE_OPTIONS}, selections={{"path":"/fare_class"}}, maxAllowedSelections=1)
    submit (Button, child=submit_label, primary=true, action={{"name":"bookingSubmit","context":[
                                                                  {{"key":"formId","value":"booking"}},
                                                                  {{"key":"origin","value":{{"path":"/origin"}}}},
                                                                  {{"key":"dest","value":{{"path":"/dest"}}}},
                                                                  {{"key":"date","value":{{"path":"/date"}}}},
                                                                  {{"key":"passengers","value":{{"path":"/passengers"}}}},
                                                                  {{"key":"fare_class","value":{{"path":"/fare_class"}}}}
                                                                ]}})
    submit_label (Text, text="Search flights")

Use these exact ids."""


def _comp(id_: str, name: str, props: dict[str, Any]) -> A2uiComponent:
    """Tiny helper so the sentinels read naturally."""
    return A2uiComponent(id=id_, component={name: props})


_SENTINEL_BOOKING_FORM = BookingFormSpec(
    surface_id="booking",
    data_model={"origin": "", "dest": "", "date": "", "passengers": 1, "fare_class": "Economy"},
    components=[
        _comp("root", "Column", {"children": {"explicitList": ["card"]}}),
        _comp("card", "Card", {"child": "card_col"}),
        _comp("card_col", "Column", {"children": {"explicitList": [
            "title", "origin", "dest", "date", "passengers", "fare", "submit",
        ]}}),
        _comp("title", "Text", {"text": "Book a flight (fallback)", "usageHint": "h2"}),
        _comp("origin", "MultipleChoice", {"label": "Origin", "options": _AIRPORT_OPTIONS,
                                            "selections": {"path": "/origin"}, "maxAllowedSelections": 1}),
        _comp("dest", "MultipleChoice", {"label": "Destination", "options": _AIRPORT_OPTIONS,
                                          "selections": {"path": "/dest"}, "maxAllowedSelections": 1}),
        _comp("date", "TextField", {"label": "Departure date (YYYY-MM-DD)",
                                     "text": {"path": "/date"}, "textFieldType": "date"}),
        _comp("passengers", "TextField", {"label": "Passengers",
                                           "text": {"path": "/passengers"}, "textFieldType": "number"}),
        _comp("fare", "MultipleChoice", {"label": "Fare class", "options": _FARE_OPTIONS,
                                          "selections": {"path": "/fare_class"}, "maxAllowedSelections": 1}),
        _comp("submit", "Button", {"child": "submit_label", "primary": True,
                                    "action": {"name": "bookingSubmit", "context": [
                                        {"key": "formId", "value": "booking"},
                                        {"key": "origin", "value": {"path": "/origin"}},
                                        {"key": "dest", "value": {"path": "/dest"}},
                                        {"key": "date", "value": {"path": "/date"}},
                                        {"key": "passengers", "value": {"path": "/passengers"}},
                                        {"key": "fare_class", "value": {"path": "/fare_class"}},
                                    ]}}),
        _comp("submit_label", "Text", {"text": "Search flights"}),
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

Emit an A2UI v1 results surface using the FlightResultsSpec schema.

A2UI format (CRITICAL): every component is `{{"id": "...", "component": {{"<ComponentName>": {{<props>}}}}}}`. The component name is the SINGLE KEY of the inner dict.

Allowed component names: Column, Row, Card, Text, TextField, Button, Divider, List.

Per-component shapes you'll need:
  Column / List: {{"children": {{"explicitList": ["id1", "id2"]}}}}
  Card:          {{"child": "<single-id>"}}
  Text:          {{"text": "literal", "usageHint": "h2"}}  (or h1/h3/body/caption)
  Button:        {{"child": "<text-id>", "primary": true, "action": {{"name": "<event>", "context": [{{"key":"flightId","value":"<num>"}}]}}}}
  Divider:       {{}}

Surface constraints:
  surface_id MUST be "results"
  data_model can be {{}}
  Root = a Column whose explicitList lists every flight Card id (or just ["no_flights"] when empty)

Build pattern (one per flight):
  card_<n>      (Card, child=col_<n>)
  col_<n>       (Column, children explicitList = [title_<n>, route_<n>, time_<n>, btn_<n>])
  title_<n>     (Text, text="<airline> flight <flight_number>", usageHint="h3")
  route_<n>     (Text, text="<from> → <to>  •  <duration_min> min  •  <aircraft>", usageHint="body")
  time_<n>      (Text, text="Depart <depart_local>  •  Arrive <arrive_local>  •  Gate <gate>", usageHint="caption")
  btn_<n>       (Button, child=btn_label_<n>, primary=true,
                 action={{"name":"flightSelect","context":[{{"key":"flightId","value":"<flight_number>"}}]}})
  btn_label_<n> (Text, text="Select")

Empty case: components = [
  {{"id":"root", "component":{{"Column":{{"children":{{"explicitList":["no_flights"]}}}}}}}},
  {{"id":"no_flights","component":{{"Card":{{"child":"empty_col"}}}}}},
  {{"id":"empty_col","component":{{"Column":{{"children":{{"explicitList":["empty_msg","modify_btn"]}}}}}}}},
  {{"id":"empty_msg","component":{{"Text":{{"text":"No flights found","usageHint":"h3"}}}}}},
  {{"id":"modify_btn","component":{{"Button":{{"child":"modify_label","action":{{"name":"modifySearch","context":[{{"key":"formId","value":"booking"}}]}}}}}}}},
  {{"id":"modify_label","component":{{"Text":{{"text":"Modify search"}}}}}}
]

Use unique ids for every component."""


_SENTINEL_RESULTS = FlightResultsSpec(
    surface_id="results",
    data_model={},
    components=[
        _comp("root", "Column", {"children": {"explicitList": ["msg"]}}),
        _comp("msg", "Card", {"child": "msg_col"}),
        _comp("msg_col", "Column", {"children": {"explicitList": ["msg_text", "modify"]}}),
        _comp("msg_text", "Text", {"text": "Results unavailable", "usageHint": "h3"}),
        _comp("modify", "Button", {"child": "modify_label",
                                    "action": {"name": "modifySearch",
                                               "context": [{"key": "formId", "value": "booking"}]}}),
        _comp("modify_label", "Text", {"text": "Modify search"}),
    ],
)


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


def _unwrap_literal(v: Any) -> Any:
    """Unwrap a v1 literal wrapper ({literalString|literalNumber|literalBoolean: <v>})."""
    if isinstance(v, dict):
        for k in ("literalString", "literalNumber", "literalBoolean"):
            if k in v:
                return v[k]
    return v


def _parse_submit_payload(content: str) -> dict[str, Any] | None:
    """Extract the form-data dict from a v1 A2uiActionMessage content.

    Chat-lib sends:
      {"version":"v1","action":{"name":"...","surfaceId":"...",
        "sourceComponentId":"...","timestamp":"...",
        "context":{"formId":{"literalString":"booking"},
                   "origin":{"literalString":"LAX"}, ...}}}
    """
    try:
        payload = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(payload, dict):
        return None
    action = payload.get("action")
    if not isinstance(action, dict):
        return None
    ctx = action.get("context", {})
    if not isinstance(ctx, dict):
        return None
    return {k: _unwrap_literal(v) for k, v in ctx.items()}


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
    """True iff the content is a v1 A2uiActionMessage named bookingSubmit."""
    try:
        payload = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return False
    if not isinstance(payload, dict):
        return False
    action = payload.get("action")
    return (
        isinstance(action, dict)
        and action.get("name") == "bookingSubmit"
    )


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
