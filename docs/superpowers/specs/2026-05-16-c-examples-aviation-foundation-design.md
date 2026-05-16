# c-* Examples Aviation Foundation + Class A — Design

**Date:** 2026-05-16
**Status:** Spec — pending implementation plan
**Series:** PR 1 of 4 in the c-* aviation theme rollout

## Goal

Build the aviation foundation (shared mock data + tool library) and use it to make two cockpit chat examples — `c-tool-calls` and `c-subagents` — actually do what their prompts claim. Today both are single-node `system_prompt + LLM` stubs whose prompts promise tool calls / subagent orchestration the graphs don't actually perform; the LLM hallucinates structured output in plain text instead of emitting real tool-call messages or routing through subagent nodes.

After this PR, the chat-tool-calls cockpit demo shows real tool-call streaming + tool-result rendering, and the chat-subagents demo shows a real 3-stage subagent pipeline with the chat-lib's existing subagent UI primitives lighting up correctly.

The aviation theme establishes a consistent narrative for the c-* track. Subsequent PRs (2-4) extend the theme to the other 9 c-* examples.

Out of scope:
- The other 9 c-* prompts/graphs (PR 2-4)
- Frontend changes — chat lib already renders tool-call streaming and subagent activity from the message stream
- Real external APIs (search/weather/flight-status etc.) — all data is hardcoded mock to keep the demo deterministic and zero-network

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Aviation domain — single source of truth | New `aviation_data.py` with ~10 airports, ~4 airlines, ~30 flights, static "current weather" per airport |
| 2 | c-tool-calls tool set | 3 tools: `lookup_flight(flight_number)`, `get_airport_info(airport_code)`, `find_routes(from_code, to_code, date_offset_days=0)` |
| 3 | c-tool-calls graph shape | Standard agent ↔ ToolNode loop (the canonical LangGraph pattern); LLM bound with all 3 tools |
| 4 | c-subagents architecture | Orchestrator LLM with single `task` tool. System prompt directs sequential invocation: research → booking → itinerary. LLM is sequential because the prompt mandates it (not via graph structure). |
| 5 | c-subagents subagent tools | Research: `[get_airport_info]`. Booking: `[find_routes, lookup_flight]`. Itinerary: no tools (text synthesis only). |
| 6 | c-subagents UI rendering | Orchestrator LLM calls a single `task(role, task_description)` tool. Chat lib's `SubagentTracker` auto-creates subagent cards from tool calls matching `subagentToolNames` (default `['task']`). The `role` arg distinguishes which specialized subagent ran. |
| 7 | Theme-rewrite scope | Only `tool-calls.md` + `subagents.md` prompt files in this PR. The other 9 prompts (messages/input/debug/interrupts/theming/threads/timeline/generative-ui/a2ui) get their aviation rewrites in subsequent PRs. |

## Architecture

**Module layout** (`cockpit/langgraph/streaming/python/src/`):

```
aviation_data.py      ← mock dataset (airports, airlines, flights, weather)
aviation_tools.py     ← @tool functions wrapping the dataset
chat_graphs.py        ← MODIFIED: c_tool_calls + c_subagents now use real graphs
```

`aviation_data.py` exports plain Python data structures. `aviation_tools.py` imports from it and wraps lookups in `@tool`-decorated async functions with proper docstrings (LLM uses these for tool selection). `chat_graphs.py` factories build the two graphs.

**c-tool-calls graph (canonical agent loop):**

```
START → agent → [tool_calls?] → ToolNode → agent → ... → END
```

Single LLM node bound with all 3 tools. Standard `langgraph.prebuilt.ToolNode`. Loops until LLM emits a final answer with no tool calls.

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

## Mock dataset shape

**Airports** (10): LAX, JFK, SFO, ORD, BOS, ATL, DFW, SEA, MIA, DEN. Each entry:
```py
{
  "code": "LAX",
  "name": "Los Angeles International",
  "city": "Los Angeles",
  "country": "USA",
  "weather": {"temp_f": 72, "conditions": "Partly Cloudy"},
  "terminals": 9,
  "runways": 4,
}
```

**Airlines** (4): AA (American), UA (United), DL (Delta), B6 (JetBlue). Each entry:
```py
{
  "code": "AA",
  "name": "American Airlines",
  "hub": "DFW",
}
```

**Flights** (~30): predefined routes between the 10 airports. Each entry:
```py
{
  "flight_number": "UA123",
  "airline": "UA",
  "from": "LAX",
  "to": "JFK",
  "depart_local": "08:00",
  "arrive_local": "16:30",
  "duration_min": 330,
  "status": "on_time",  # or "delayed" / "cancelled"
  "gate": "B14",
  "aircraft": "Boeing 787",
}
```

`find_routes` filters this list by `from`/`to`. `lookup_flight` looks up by flight_number. `get_airport_info` looks up by code.

`date_offset_days=0` parameter on `find_routes` is a stub — the mock dataset has no per-date variation; the parameter exists so the LLM has a realistic API surface to demonstrate. Returns the same list regardless of date offset, but echoes the requested date in the response so the LLM can reason about it.

## Tool signatures

```py
@tool
async def lookup_flight(flight_number: str) -> dict:
    """Look up the status, route, and gate for a specific flight number.

    Args:
        flight_number: Flight number like 'UA123' or 'AA456'.

    Returns: {
        "flight_number": str, "airline": str, "from": str, "to": str,
        "depart_local": str, "arrive_local": str, "status": str,
        "gate": str, "aircraft": str, "duration_min": int,
    }
    Raises ValueError if flight_number is not in the mock dataset.
    """

@tool
async def get_airport_info(airport_code: str) -> dict:
    """Get details about an airport: name, city, current weather, terminals, runways.

    Args:
        airport_code: 3-letter IATA code like 'LAX' or 'JFK'.

    Returns: {
        "code": str, "name": str, "city": str, "country": str,
        "weather": {"temp_f": int, "conditions": str},
        "terminals": int, "runways": int,
    }
    Raises ValueError if airport_code is not in the mock dataset.
    """

@tool
async def find_routes(from_code: str, to_code: str, date_offset_days: int = 0) -> list[dict]:
    """Find available flights between two airports for a given date.

    Args:
        from_code: 3-letter IATA code for departure airport.
        to_code: 3-letter IATA code for arrival airport.
        date_offset_days: 0 = today, 1 = tomorrow, etc. (Mock data is the same
                          regardless; this is for demo realism.)

    Returns: list of flight dicts (same shape as lookup_flight) sorted by
    departure time. Empty list if no routes found.
    """
```

## Prompt updates

**`prompts/tool-calls.md`** — rewrite to:
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

**`prompts/subagents.md`** — rewrite to:
```markdown
# Trip Planner Orchestrator

You coordinate three specialized subagents to plan a trip:

1. **Research Agent** — gathers destination intel (airports, weather, conditions)
2. **Booking Agent** — finds flight options between origin and destination
3. **Itinerary Agent** — synthesizes a final trip plan combining research + bookings

When the user asks about a trip (e.g., "plan a trip from LAX to Tokyo" or
"I want to fly from Boston to Miami next week"), acknowledge their request
and explain that you're delegating to the subagents. Each subagent will
process the task in sequence and stream its findings to the UI.
```

(Each subagent will have its own narrower system prompt embedded in the graph code, since they need different persona / tool focus / output format.)

## Public surface

`aviation_tools.py` exports:
```py
ALL_TOOLS = [lookup_flight, get_airport_info, find_routes]
```

`chat_graphs.py` swaps:
```py
# Before:
c_tool_calls = _build_prompt_graph("tool-calls.md")
c_subagents = _build_prompt_graph("subagents.md")

# After:
from src.aviation_tools import ALL_TOOLS
c_tool_calls = _build_tool_calls_graph()
c_subagents = _build_subagents_graph()
```

`langgraph.json` registry entries unchanged (the names `c-tool-calls` and `c-subagents` keep pointing at `chat_graphs.py:c_tool_calls` / `c_subagents`).

## Testing

**Manual smoke (chrome MCP, post-merge):**
- Cockpit chat-tool-calls capability route, ask: "What's the status of UA123?" — observe `lookup_flight` tool call streaming + result card rendering, then LLM response
- Same route, ask: "Compare LAX and JFK" — observe two parallel `get_airport_info` calls (or sequential, depending on LLM behavior)
- Cockpit chat-subagents capability route, ask: "Plan a trip from LAX to JFK" — observe orchestrator card → research card → booking card → itinerary card streaming sequentially in the chat-subagents UI

**Automated:**
- Existing aimock e2e harness can replay scenario fixtures — leave fixture authoring to a follow-up PR (the chat-debug PR is currently iterating on aimock e2e patterns; piggyback on whatever shape lands there)

## Risks and mitigations

- **LLM choice / availability** — `gpt-5-mini` (existing for the other graphs) is fine for tool calling. If unavailable, fall back to `gpt-4o-mini` or whatever the deployment env supports. No code change needed; just `ChatOpenAI(model="...")`.
- **Tool errors crash the graph** — `@tool` decorators in LangGraph automatically wrap return value or exception. `lookup_flight("XX999")` raising `ValueError` becomes a tool-error message the LLM sees and recovers from.
- **Subagent outputs leak into wrong card** — relies on `AIMessage(name=...)` being preserved by the chat lib's rendering. The chat lib renders subagent cards by message `name` field; verified via the existing `chat-subagents.component.ts` reading message metadata.
- **Sequential subagent latency** — running 3 LLM calls sequentially is slow. Acceptable for demo; users see incremental streaming. If perceived too slow, future PR can switch to parallel fan-out.
- **Scope creep into PR 2-4** — explicitly out of scope. This PR ships only c-tool-calls + c-subagents + the shared aviation foundation.

## Out-of-scope follow-ups (track but defer)

- **PR 2** — aviation prompts for messages/input/debug/interrupts/theming/threads/timeline (7 prompt-only edits)
- **PR 3** — c-generative-ui dashboard → airline KPI dashboard (replace `dashboard_tools.py` with aviation analytics tools; rewrite dashboard prompt)
- **PR 4** — c-a2ui hardcoded contact form → flight booking form (still hardcoded JSONL, OR LLM-driven JSONL via tools — decide at PR 4 brainstorm)
- aimock e2e fixtures for the new graphs
