# c-* Aviation Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the aviation mock data + tool library and use them to convert `c-tool-calls` and `c-subagents` from stubs into working demos that actually do what their prompts claim.

**Architecture:** New `aviation_data.py` (mock dataset) + `aviation_tools.py` (`@tool`-decorated functions). `c-tool-calls` becomes a canonical agent ↔ ToolNode loop bound with the 3 aviation tools. `c-subagents` becomes an orchestrator LLM with a `task(role, task_description)` tool that dispatches to 3 internal subagent functions (research / booking / itinerary); the orchestrator's system prompt directs sequential invocation. The chat lib's subagent UI auto-renders the `task` tool calls as subagent cards (default `subagentToolNames = ['task']`).

**Tech Stack:** Python 3.12, LangGraph, LangChain, ChatOpenAI (gpt-5-mini), `uv` package manager.

**Spec:** `docs/superpowers/specs/2026-05-16-c-examples-aviation-foundation-design.md` (with the design correction documented in Task 0).

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `docs/superpowers/specs/2026-05-16-c-examples-aviation-foundation-design.md` | Correct decision 6 + revise c-subagents architecture (Task 0) |
| Create | `cockpit/langgraph/streaming/python/src/aviation_data.py` | Mock dataset (airports, airlines, flights) |
| Create | `cockpit/langgraph/streaming/python/src/aviation_tools.py` | `@tool` wrappers: `lookup_flight`, `get_airport_info`, `find_routes` |
| Modify | `cockpit/langgraph/streaming/python/src/chat_graphs.py` | Add `_build_tool_calls_graph()` and `_build_subagents_graph()` factories; swap `c_tool_calls` + `c_subagents` to use them |
| Modify | `cockpit/langgraph/streaming/python/prompts/tool-calls.md` | Aviation tool-calls prompt |
| Modify | `cockpit/langgraph/streaming/python/prompts/subagents.md` | Aviation trip-planner orchestrator prompt |

---

## Task 0: Correct the spec inline

**Files:**
- Modify: `docs/superpowers/specs/2026-05-16-c-examples-aviation-foundation-design.md`

The spec's decision 6 is wrong — the chat lib's subagent UI renders from `task` tool calls, not `AIMessage(name=...)`. Document the correction before implementing.

- [ ] **Step 1: Edit the decisions table**

In `docs/superpowers/specs/2026-05-16-c-examples-aviation-foundation-design.md`, replace decision 6:

```markdown
| 6 | c-subagents UI rendering | Orchestrator LLM calls a single `task(role, task_description)` tool. Chat lib's `SubagentTracker` auto-creates subagent cards from tool calls matching `subagentToolNames` (default `['task']`). The `role` arg distinguishes which specialized subagent ran. |
```

Replace decision 4 description text:

```markdown
| 4 | c-subagents architecture | Orchestrator LLM with single `task` tool. System prompt directs sequential invocation: research → booking → itinerary. LLM is sequential because the prompt mandates it (not via graph structure). |
```

In the Architecture section, replace the c-subagents subsection with:

```markdown
**c-subagents graph (orchestrator + task tool):**

```
START → orchestrator (LLM with task tool) → [task calls] → ToolNode → orchestrator → ... → END
```

- The orchestrator is a single LLM node bound with one tool: `task(role: Literal["research","booking","itinerary"], task_description: str)`
- The `task` tool's implementation dispatches to one of 3 internal async functions:
  - `_run_research_subagent(description)` — own LLM bound with `[get_airport_info]`, own system prompt
  - `_run_booking_subagent(description)` — own LLM bound with `[find_routes, lookup_flight]`, own system prompt
  - `_run_itinerary_subagent(description)` — own LLM, no tools, focused on synthesis
- Each subagent function returns its final answer as a string (the tool result)
- The orchestrator's system prompt directs sequential invocation: "Call task() three times in order: research, booking, itinerary"
- The chat lib's `SubagentTracker` watches for tool calls named `task` (its default) and surfaces them as subagent cards in the chat-subagents UI
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-16-c-examples-aviation-foundation-design.md
git commit -m "docs: correct c-subagents architecture (task tool, not AIMessage name)"
```

---

## Task 1: Aviation mock dataset

**Files:**
- Create: `cockpit/langgraph/streaming/python/src/aviation_data.py`

- [ ] **Step 1: Create the dataset module**

Create `cockpit/langgraph/streaming/python/src/aviation_data.py` with:

```python
"""Aviation mock dataset for c-* example demos.

Hardcoded data for the c-tool-calls and c-subagents demos (and future c-*
aviation-themed examples). Zero external API calls — everything is canned
for deterministic demos and offline-friendly development.

The dataset is small but cohesive: ~10 US airports, 4 major airlines,
~30 flights criss-crossing those airports. Each airport has a static
"current weather" entry that doesn't change between calls (for
repeatability in screencasts and snapshot tests).
"""

# ── Airports ────────────────────────────────────────────────────────────────

AIRPORTS = {
    "LAX": {"code": "LAX", "name": "Los Angeles International", "city": "Los Angeles", "country": "USA",
            "weather": {"temp_f": 72, "conditions": "Partly Cloudy"}, "terminals": 9, "runways": 4},
    "JFK": {"code": "JFK", "name": "John F. Kennedy International", "city": "New York", "country": "USA",
            "weather": {"temp_f": 58, "conditions": "Clear"}, "terminals": 6, "runways": 4},
    "SFO": {"code": "SFO", "name": "San Francisco International", "city": "San Francisco", "country": "USA",
            "weather": {"temp_f": 64, "conditions": "Foggy"}, "terminals": 4, "runways": 4},
    "ORD": {"code": "ORD", "name": "O'Hare International", "city": "Chicago", "country": "USA",
            "weather": {"temp_f": 48, "conditions": "Light Rain"}, "terminals": 4, "runways": 8},
    "BOS": {"code": "BOS", "name": "Logan International", "city": "Boston", "country": "USA",
            "weather": {"temp_f": 52, "conditions": "Overcast"}, "terminals": 4, "runways": 6},
    "ATL": {"code": "ATL", "name": "Hartsfield-Jackson Atlanta International", "city": "Atlanta", "country": "USA",
            "weather": {"temp_f": 68, "conditions": "Sunny"}, "terminals": 2, "runways": 5},
    "DFW": {"code": "DFW", "name": "Dallas/Fort Worth International", "city": "Dallas", "country": "USA",
            "weather": {"temp_f": 76, "conditions": "Sunny"}, "terminals": 5, "runways": 7},
    "SEA": {"code": "SEA", "name": "Seattle-Tacoma International", "city": "Seattle", "country": "USA",
            "weather": {"temp_f": 55, "conditions": "Drizzle"}, "terminals": 3, "runways": 3},
    "MIA": {"code": "MIA", "name": "Miami International", "city": "Miami", "country": "USA",
            "weather": {"temp_f": 82, "conditions": "Humid, Sunny"}, "terminals": 3, "runways": 4},
    "DEN": {"code": "DEN", "name": "Denver International", "city": "Denver", "country": "USA",
            "weather": {"temp_f": 60, "conditions": "Clear, Windy"}, "terminals": 1, "runways": 6},
}

# ── Airlines ────────────────────────────────────────────────────────────────

AIRLINES = {
    "AA": {"code": "AA", "name": "American Airlines", "hub": "DFW"},
    "UA": {"code": "UA", "name": "United Airlines", "hub": "ORD"},
    "DL": {"code": "DL", "name": "Delta Air Lines", "hub": "ATL"},
    "B6": {"code": "B6", "name": "JetBlue Airways", "hub": "JFK"},
}

# ── Flights ─────────────────────────────────────────────────────────────────

FLIGHTS = [
    # United transcontinental
    {"flight_number": "UA123", "airline": "UA", "from": "LAX", "to": "JFK",
     "depart_local": "08:00", "arrive_local": "16:30", "duration_min": 330,
     "status": "on_time", "gate": "B14", "aircraft": "Boeing 787"},
    {"flight_number": "UA456", "airline": "UA", "from": "JFK", "to": "LAX",
     "depart_local": "10:00", "arrive_local": "13:15", "duration_min": 375,
     "status": "delayed", "gate": "T7-12", "aircraft": "Boeing 757"},
    {"flight_number": "UA789", "airline": "UA", "from": "ORD", "to": "SFO",
     "depart_local": "09:30", "arrive_local": "12:00", "duration_min": 270,
     "status": "on_time", "gate": "C15", "aircraft": "Airbus A320"},

    # American out of DFW hub
    {"flight_number": "AA101", "airline": "AA", "from": "DFW", "to": "LAX",
     "depart_local": "07:15", "arrive_local": "08:45", "duration_min": 210,
     "status": "on_time", "gate": "A23", "aircraft": "Boeing 737"},
    {"flight_number": "AA202", "airline": "AA", "from": "DFW", "to": "JFK",
     "depart_local": "11:00", "arrive_local": "15:30", "duration_min": 210,
     "status": "on_time", "gate": "D8", "aircraft": "Boeing 737"},
    {"flight_number": "AA303", "airline": "AA", "from": "DFW", "to": "MIA",
     "depart_local": "13:45", "arrive_local": "17:30", "duration_min": 165,
     "status": "on_time", "gate": "C11", "aircraft": "Airbus A321"},
    {"flight_number": "AA404", "airline": "AA", "from": "BOS", "to": "DFW",
     "depart_local": "06:30", "arrive_local": "10:00", "duration_min": 270,
     "status": "cancelled", "gate": "B5", "aircraft": "Boeing 737"},

    # Delta hub-and-spoke from ATL
    {"flight_number": "DL501", "airline": "DL", "from": "ATL", "to": "LAX",
     "depart_local": "10:00", "arrive_local": "11:45", "duration_min": 285,
     "status": "on_time", "gate": "F20", "aircraft": "Boeing 757"},
    {"flight_number": "DL502", "airline": "DL", "from": "ATL", "to": "JFK",
     "depart_local": "14:20", "arrive_local": "16:50", "duration_min": 150,
     "status": "on_time", "gate": "B9", "aircraft": "Boeing 737"},
    {"flight_number": "DL503", "airline": "DL", "from": "ATL", "to": "SEA",
     "depart_local": "09:15", "arrive_local": "11:35", "duration_min": 320,
     "status": "delayed", "gate": "A17", "aircraft": "Airbus A330"},
    {"flight_number": "DL504", "airline": "DL", "from": "ATL", "to": "MIA",
     "depart_local": "16:00", "arrive_local": "17:50", "duration_min": 110,
     "status": "on_time", "gate": "T2", "aircraft": "Boeing 717"},

    # JetBlue from JFK
    {"flight_number": "B6601", "airline": "B6", "from": "JFK", "to": "LAX",
     "depart_local": "07:30", "arrive_local": "10:55", "duration_min": 385,
     "status": "on_time", "gate": "T5-12", "aircraft": "Airbus A321"},
    {"flight_number": "B6602", "airline": "B6", "from": "JFK", "to": "BOS",
     "depart_local": "12:15", "arrive_local": "13:30", "duration_min": 75,
     "status": "on_time", "gate": "T5-9", "aircraft": "Embraer 190"},
    {"flight_number": "B6603", "airline": "B6", "from": "JFK", "to": "MIA",
     "depart_local": "15:45", "arrive_local": "18:55", "duration_min": 190,
     "status": "on_time", "gate": "T5-15", "aircraft": "Airbus A320"},
    {"flight_number": "B6604", "airline": "B6", "from": "BOS", "to": "MIA",
     "depart_local": "09:00", "arrive_local": "12:35", "duration_min": 215,
     "status": "on_time", "gate": "C42", "aircraft": "Airbus A320"},

    # Denver hub (United secondary)
    {"flight_number": "UA850", "airline": "UA", "from": "DEN", "to": "LAX",
     "depart_local": "08:45", "arrive_local": "10:00", "duration_min": 135,
     "status": "on_time", "gate": "B33", "aircraft": "Boeing 737"},
    {"flight_number": "UA851", "airline": "UA", "from": "DEN", "to": "ORD",
     "depart_local": "11:30", "arrive_local": "14:55", "duration_min": 145,
     "status": "on_time", "gate": "B41", "aircraft": "Airbus A319"},
    {"flight_number": "UA852", "airline": "UA", "from": "SFO", "to": "DEN",
     "depart_local": "06:00", "arrive_local": "09:25", "duration_min": 145,
     "status": "on_time", "gate": "F8", "aircraft": "Boeing 737"},

    # Seattle (United + Delta)
    {"flight_number": "UA901", "airline": "UA", "from": "SEA", "to": "ORD",
     "depart_local": "07:00", "arrive_local": "12:55", "duration_min": 235,
     "status": "on_time", "gate": "S2", "aircraft": "Boeing 737"},
    {"flight_number": "DL902", "airline": "DL", "from": "SEA", "to": "ATL",
     "depart_local": "14:30", "arrive_local": "22:05", "duration_min": 275,
     "status": "on_time", "gate": "B12", "aircraft": "Boeing 757"},

    # SFO-LAX shuttle
    {"flight_number": "UA1001", "airline": "UA", "from": "SFO", "to": "LAX",
     "depart_local": "06:00", "arrive_local": "07:25", "duration_min": 85,
     "status": "on_time", "gate": "F3", "aircraft": "Airbus A320"},
    {"flight_number": "UA1002", "airline": "UA", "from": "SFO", "to": "LAX",
     "depart_local": "09:30", "arrive_local": "10:55", "duration_min": 85,
     "status": "on_time", "gate": "F5", "aircraft": "Airbus A320"},
    {"flight_number": "UA1003", "airline": "UA", "from": "LAX", "to": "SFO",
     "depart_local": "08:00", "arrive_local": "09:25", "duration_min": 85,
     "status": "on_time", "gate": "B22", "aircraft": "Airbus A320"},
    {"flight_number": "UA1004", "airline": "UA", "from": "LAX", "to": "SFO",
     "depart_local": "12:15", "arrive_local": "13:40", "duration_min": 85,
     "status": "delayed", "gate": "B26", "aircraft": "Airbus A320"},

    # Chicago hub (United + American)
    {"flight_number": "UA710", "airline": "UA", "from": "ORD", "to": "BOS",
     "depart_local": "06:30", "arrive_local": "09:45", "duration_min": 135,
     "status": "on_time", "gate": "C12", "aircraft": "Boeing 737"},
    {"flight_number": "AA711", "airline": "AA", "from": "ORD", "to": "DFW",
     "depart_local": "07:15", "arrive_local": "09:50", "duration_min": 155,
     "status": "on_time", "gate": "K8", "aircraft": "Boeing 737"},
    {"flight_number": "UA712", "airline": "UA", "from": "ORD", "to": "DEN",
     "depart_local": "10:00", "arrive_local": "11:30", "duration_min": 150,
     "status": "on_time", "gate": "C20", "aircraft": "Embraer 175"},

    # MIA southbound
    {"flight_number": "AA801", "airline": "AA", "from": "MIA", "to": "JFK",
     "depart_local": "08:00", "arrive_local": "11:00", "duration_min": 180,
     "status": "on_time", "gate": "D40", "aircraft": "Boeing 737"},
    {"flight_number": "DL802", "airline": "DL", "from": "MIA", "to": "ATL",
     "depart_local": "12:30", "arrive_local": "14:20", "duration_min": 110,
     "status": "on_time", "gate": "H5", "aircraft": "Boeing 717"},

    # BOS additional
    {"flight_number": "B6605", "airline": "B6", "from": "BOS", "to": "SFO",
     "depart_local": "07:45", "arrive_local": "11:30", "duration_min": 405,
     "status": "on_time", "gate": "C40", "aircraft": "Airbus A321"},
]
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/aviation_data.py
git commit -m "feat(c-examples): aviation mock dataset (10 airports, 4 airlines, 30 flights)"
```

---

## Task 2: Aviation tools module

**Files:**
- Create: `cockpit/langgraph/streaming/python/src/aviation_tools.py`

- [ ] **Step 1: Create tool module**

Create `cockpit/langgraph/streaming/python/src/aviation_tools.py`:

```python
"""LangChain @tool wrappers around the aviation mock dataset.

Each tool's docstring is what the LLM sees for tool-selection — keep them
informative and example-laden.
"""

from langchain_core.tools import tool
from src.aviation_data import AIRPORTS, AIRLINES, FLIGHTS


@tool
async def lookup_flight(flight_number: str) -> dict:
    """Look up the status, route, and gate for a specific flight number.

    Use this when the user asks about a specific flight (e.g., "what's the
    status of UA123?", "is AA404 on time?", "what gate is DL501 leaving from?").

    Args:
        flight_number: Flight number like 'UA123' or 'AA456'. Case-insensitive.

    Returns:
        dict with keys: flight_number, airline, from, to, depart_local,
        arrive_local, status (on_time/delayed/cancelled), gate, aircraft,
        duration_min.

    Returns {"error": "Flight not found"} if the flight number is not in
    the dataset.
    """
    fn = flight_number.upper().strip()
    for f in FLIGHTS:
        if f["flight_number"] == fn:
            return f
    return {"error": f"Flight {fn} not found in dataset"}


@tool
async def get_airport_info(airport_code: str) -> dict:
    """Get details about an airport: name, city, current weather, terminals, runways.

    Use this when the user asks about an airport (e.g., "what's the weather
    at LAX?", "tell me about JFK", "how many runways does ORD have?").

    Args:
        airport_code: 3-letter IATA code like 'LAX' or 'JFK'. Case-insensitive.

    Returns:
        dict with keys: code, name, city, country, weather (with temp_f and
        conditions), terminals, runways.

    Returns {"error": "Airport not found"} if the code is not in the dataset.
    """
    code = airport_code.upper().strip()
    if code in AIRPORTS:
        return AIRPORTS[code]
    return {"error": f"Airport {code} not in dataset. Available: {sorted(AIRPORTS.keys())}"}


@tool
async def find_routes(from_code: str, to_code: str, date_offset_days: int = 0) -> dict:
    """Find available flights between two airports.

    Use this when the user asks about flight options (e.g., "what flights
    are there from LAX to JFK?", "find me a flight from Boston to Miami
    tomorrow").

    Args:
        from_code: 3-letter IATA code for departure airport.
        to_code: 3-letter IATA code for arrival airport.
        date_offset_days: 0 = today, 1 = tomorrow, etc. Note: mock data is
            the same regardless of date; the LLM can still reason about
            the date in its response.

    Returns:
        dict with keys:
          - "flights": list of flight dicts (same shape as lookup_flight)
            sorted by depart_local, OR empty list if no routes.
          - "from": echoed from_code
          - "to": echoed to_code
          - "date_offset_days": echoed
    """
    fc = from_code.upper().strip()
    tc = to_code.upper().strip()
    flights = sorted(
        [f for f in FLIGHTS if f["from"] == fc and f["to"] == tc],
        key=lambda f: f["depart_local"],
    )
    return {"from": fc, "to": tc, "date_offset_days": date_offset_days, "flights": flights}


ALL_TOOLS = [lookup_flight, get_airport_info, find_routes]
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/aviation_tools.py
git commit -m "feat(c-examples): aviation tools (lookup_flight, get_airport_info, find_routes)"
```

---

## Task 3: Update c-tool-calls graph

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/chat_graphs.py`

- [ ] **Step 1: Read current file**

```bash
cat cockpit/langgraph/streaming/python/src/chat_graphs.py
```

- [ ] **Step 2: Replace the file**

Replace `cockpit/langgraph/streaming/python/src/chat_graphs.py` with:

```python
"""
Chat example graphs — consolidated into the streaming deployment.

Most chat cockpit examples (messages, input, debug, etc.) use the same simple
architecture: a single-node StateGraph that prepends a system prompt and calls
the LLM. They differ only in the prompt file.

The c_tool_calls and c_subagents graphs are richer: c_tool_calls binds real
aviation tools (so the chat-tool-calls UI shows tool-call streaming);
c_subagents uses a `task` tool the orchestrator calls to dispatch to
specialized subagent functions (so the chat-subagents UI shows subagent cards).
"""

from pathlib import Path
from typing import Literal
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool

from src.aviation_tools import (
    ALL_TOOLS as AVIATION_TOOLS,
    get_airport_info,
    find_routes,
    lookup_flight,
)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
MODEL = "gpt-5-mini"


def _build_prompt_graph(prompt_file: str):
    """Factory: simple single-node graph that prepends a system prompt and calls the LLM."""
    llm = ChatOpenAI(model=MODEL, streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / prompt_file).read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)
    return graph.compile()


def _build_tool_calls_graph():
    """Canonical agent ↔ ToolNode loop with aviation tools bound."""
    llm = ChatOpenAI(model=MODEL, streaming=True).bind_tools(AVIATION_TOOLS)

    async def agent(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "tool-calls.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    def should_continue(state: MessagesState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(MessagesState)
    graph.add_node("agent", agent)
    graph.add_node("tools", ToolNode(AVIATION_TOOLS))
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")
    return graph.compile()


# ── c-subagents internals ────────────────────────────────────────────────────

_RESEARCH_PROMPT = """You are a Research Agent for trip planning. Your job is to gather
destination intel about airports the traveler is considering. Use the
get_airport_info tool to look up airport details (city, weather, terminals,
runways) for any airport codes mentioned in the task description.

Return a concise 2-4 sentence summary of what you found. If a code isn't
recognized, say so."""

_BOOKING_PROMPT = """You are a Booking Agent for trip planning. Your job is to find
flight options between the origin and destination airports in the task
description. Use find_routes to list available flights, and lookup_flight
if the user mentioned a specific flight number.

Return a concise summary listing 2-3 best flight options with airline,
flight number, times, and price-or-aircraft info. If no flights are found,
say so and suggest alternatives."""

_ITINERARY_PROMPT = """You are an Itinerary Agent for trip planning. Your job is to
synthesize a final trip plan from research + booking outputs you receive in
the task description.

Return a clean 3-5 sentence itinerary summarizing the recommended flight
choice, what to expect on arrival (weather), and any practical tips
(e.g., delays, terminal info). Be helpful and concise."""


async def _run_subagent(role: str, task_description: str, system_prompt: str, tools: list):
    """Run a single subagent: LLM bound with role-specific tools, single tool loop."""
    llm = ChatOpenAI(model=MODEL, streaming=True)
    if tools:
        llm = llm.bind_tools(tools)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=task_description),
    ]
    # Allow up to 3 tool-loop iterations
    for _ in range(3):
        response = await llm.ainvoke(messages)
        messages.append(response)
        tool_calls = getattr(response, "tool_calls", None)
        if not tool_calls:
            return response.content
        # Execute tool calls inline
        for tc in tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]
            target = next((t for t in tools if t.name == tool_name), None)
            if target is None:
                tool_result = f"Tool {tool_name} not available"
            else:
                tool_result = await target.ainvoke(tool_args)
            from langchain_core.messages import ToolMessage
            messages.append(ToolMessage(content=str(tool_result), tool_call_id=tc["id"]))
    return response.content


@tool
async def task(role: Literal["research", "booking", "itinerary"], task_description: str) -> str:
    """Delegate a subtask to a specialized subagent.

    Roles:
      - research: gathers destination intel (airports, weather, conditions)
      - booking: finds flight options between origin and destination
      - itinerary: synthesizes a final trip plan combining research + bookings

    Args:
        role: One of "research", "booking", "itinerary".
        task_description: Plain-English description of what the subagent
            should do (e.g., "Gather info on LAX and JFK airports", or
            "Find morning flights from LAX to JFK").

    Returns:
        The subagent's final answer as a string.
    """
    if role == "research":
        return await _run_subagent(role, task_description, _RESEARCH_PROMPT, [get_airport_info])
    if role == "booking":
        return await _run_subagent(role, task_description, _BOOKING_PROMPT, [find_routes, lookup_flight])
    if role == "itinerary":
        return await _run_subagent(role, task_description, _ITINERARY_PROMPT, [])
    return f"Unknown role: {role}"


def _build_subagents_graph():
    """Orchestrator LLM with a single `task` tool that dispatches to subagent functions."""
    llm = ChatOpenAI(model=MODEL, streaming=True).bind_tools([task])

    async def orchestrator(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "subagents.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    def should_continue(state: MessagesState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(MessagesState)
    graph.add_node("orchestrator", orchestrator)
    graph.add_node("tools", ToolNode([task]))
    graph.set_entry_point("orchestrator")
    graph.add_conditional_edges("orchestrator", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "orchestrator")
    return graph.compile()


# ── Graph registration ───────────────────────────────────────────────────────

c_messages = _build_prompt_graph("messages.md")
c_input = _build_prompt_graph("input.md")
c_debug = _build_prompt_graph("debug.md")
c_interrupts = _build_prompt_graph("interrupts.md")
c_theming = _build_prompt_graph("theming.md")
c_threads = _build_prompt_graph("threads.md")
c_timeline = _build_prompt_graph("timeline.md")

c_tool_calls = _build_tool_calls_graph()
c_subagents = _build_subagents_graph()

from src.dashboard_graph import graph as generative_ui  # noqa: E402,F401
```

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/chat_graphs.py
git commit -m "feat(c-examples): wire c_tool_calls + c_subagents to real graphs"
```

---

## Task 4: Update prompts

**Files:**
- Modify: `cockpit/langgraph/streaming/python/prompts/tool-calls.md`
- Modify: `cockpit/langgraph/streaming/python/prompts/subagents.md`

- [ ] **Step 1: Replace `tool-calls.md`**

```markdown
# Aviation Assistant — Tool Calls Demo

You are a helpful aviation assistant with access to flight and airport data
through three tools:

- **lookup_flight(flight_number)** — status, route, and gate for a specific flight
- **get_airport_info(airport_code)** — airport name, city, weather, terminals, runways
- **find_routes(from_code, to_code, date_offset_days)** — available flights between two airports

Use these tools whenever the user asks about flights, airports, or routes.
Combine multiple calls when helpful (e.g., "compare LAX and JFK" → call
get_airport_info twice). Always cite which tools you used and summarize
the results clearly.

If a flight number or airport code isn't recognized, say so and suggest
alternatives from the dataset (LAX, JFK, SFO, ORD, BOS, ATL, DFW, SEA, MIA, DEN).
```

- [ ] **Step 2: Replace `subagents.md`**

```markdown
# Trip Planner Orchestrator

You coordinate three specialized subagents to plan a trip. You delegate work
by calling the `task` tool with a `role` and `task_description`.

The three roles, in the order you should always call them:

1. `task(role="research", ...)` — gathers destination intel (airports, weather, conditions)
2. `task(role="booking", ...)` — finds flight options between origin and destination
3. `task(role="itinerary", ...)` — synthesizes a final trip plan combining research + bookings

When the user asks about a trip (e.g., "plan a trip from LAX to Tokyo" or
"I want to fly from Boston to Miami next week"), call task() three times in
that order, then summarize the final plan in 1-2 sentences. Each subagent
will process its task and its output will be visible in the chat-subagents UI.

If the user's request is ambiguous (e.g., they don't mention airports), ask
a clarifying question before delegating. Once you have origin + destination,
delegate to all three subagents.

Note: the dataset is limited to 10 US airports (LAX, JFK, SFO, ORD, BOS,
ATL, DFW, SEA, MIA, DEN). If the user asks about an airport not in this
list, the research subagent will note it; suggest a nearby supported airport.
```

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/python/prompts/tool-calls.md cockpit/langgraph/streaming/python/prompts/subagents.md
git commit -m "feat(c-examples): aviation prompts for c-tool-calls + c-subagents"
```

---

## Task 5: Verify python imports + graph compilation

**Files:** none modified.

- [ ] **Step 1: Confirm uv environment**

```bash
cd cockpit/langgraph/streaming/python && uv sync 2>&1 | tail -5
```

Expected: no error.

- [ ] **Step 2: Smoke-test all graphs compile**

```bash
cd cockpit/langgraph/streaming/python && uv run python -c "from src.chat_graphs import c_tool_calls, c_subagents, c_messages; print('graphs imported OK')"
```

Expected: `graphs imported OK` printed; no traceback. If a `from langchain_core.tools import tool` import fails, langchain-core may need updating — check `pyproject.toml`.

- [ ] **Step 3: Verify tool docstrings are accessible (LLM needs them)**

```bash
cd cockpit/langgraph/streaming/python && uv run python -c "from src.aviation_tools import ALL_TOOLS; print([t.name + ': ' + t.description[:80] for t in ALL_TOOLS])"
```

Expected: 3 tool names + descriptions printed.

- [ ] **Step 4: Commit (no changes — verification step only)**

No commit. If everything passes, move to Task 6.

---

## Task 6: Open PR + merge on green

- [ ] **Step 1: Push branch**

```bash
git push -u origin chat-examples-llm-aviation-pr1
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(c-examples): aviation foundation + c-tool-calls + c-subagents (PR 1 of 4)" --body "$(cat <<'EOF'
## Summary

PR 1 of 4 in the c-* aviation theme rollout (spec: \`docs/superpowers/specs/2026-05-16-c-examples-aviation-foundation-design.md\`).

- **Aviation foundation**: \`aviation_data.py\` (~10 airports / 4 airlines / 30 flights, all canned for deterministic demos) + \`aviation_tools.py\` (\`lookup_flight\`, \`get_airport_info\`, \`find_routes\`).
- **c-tool-calls**: converted from single-node stub → canonical agent ↔ ToolNode loop bound with the 3 aviation tools. The chat-tool-calls cockpit demo now shows real tool-call streaming and tool-result rendering.
- **c-subagents**: converted from single-node stub → orchestrator LLM with a \`task(role, task_description)\` tool that dispatches to 3 specialized subagent functions (research / booking / itinerary). The orchestrator's prompt directs sequential invocation. Chat-subagents UI auto-renders \`task\` tool calls as subagent cards (matches the chat lib's default \`subagentToolNames = ['task']\`).
- **Aviation prompts** for both: tool-calls.md and subagents.md rewritten to match the new graph behaviors.

### Spec correction

Decision 6 in the spec was wrong (\"AIMessage with name=\" doesn't drive the chat lib's subagent UI; tool calls with name in \`subagentToolNames\` do). Corrected in Task 0 of the implementation plan + the spec markdown itself.

### Out-of-scope (PR 2-4)

- PR 2: aviation prompts for the other 7 simple c-* graphs (messages/input/debug/interrupts/theming/threads/timeline)
- PR 3: c-generative-ui dashboard_graph → aviation KPI dashboard
- PR 4: c-a2ui hardcoded contact form → aviation booking form

## Test plan

- [x] \`uv sync\` + Python import smoke (Task 5)
- [ ] CI verifies python build/test
- [ ] Manual chrome MCP smoke (post-merge): chat-tool-calls (\"What's the status of UA123?\") and chat-subagents (\"Plan a trip from LAX to JFK\")

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for green CI**

```bash
gh pr checks --watch
```

- [ ] **Step 4: Squash-merge**

```bash
gh pr merge --squash --delete-branch
```

---

## Self-review

**Spec coverage:**
- ✅ Aviation foundation (data + tools) → Tasks 1, 2
- ✅ c-tool-calls rewrite → Task 3 (the `_build_tool_calls_graph` factory)
- ✅ c-subagents rewrite with corrected architecture → Tasks 0 (spec fix), 3 (the `_build_subagents_graph` factory + `task` tool + `_run_subagent` helper + 3 subagent prompts)
- ✅ Prompt updates → Task 4
- ✅ Verification → Task 5

**Adjustments from spec:**
1. **Spec correction (Task 0)** — chat lib subagent UI is driven by tool calls named `task`, not by `AIMessage(name=...)`. Architecture revised accordingly.
2. **`_run_subagent` is a helper, not a node** — the spec talked about subagents as "nodes" in the orchestrator graph. Actually they're internal functions invoked by the `task` tool. Cleaner: orchestrator's graph has just the agent + tools loop; subagent runtime is hidden inside the tool implementation. Chat-subagents UI sees only `task` tool calls and their results.
3. **Subagent tool loop cap** — added a 3-iteration cap on each subagent's internal tool loop to prevent runaway. Documented in the helper.

**Placeholder scan:** No "TBD" / "TODO" / "fill in details." All Python code complete.

**Type consistency:** `AVIATION_TOOLS` / `ALL_TOOLS` consistent between import + use. `task` tool's `role: Literal[...]` matches the `if role ==` dispatch checks. Subagent function names (`_run_subagent`) used consistently.
