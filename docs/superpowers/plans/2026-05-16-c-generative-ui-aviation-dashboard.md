# c-generative-ui Aviation KPI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the `c-generative-ui` cockpit demo from a SaaS metrics dashboard to an airline operations KPI dashboard by swapping dataset, tools, prompt, and `emit_state` mapping — without touching graph topology or Angular view components.

**Architecture:** Extend `aviation_data.py` with 4 analytics fixtures (snapshot KPIs, on-time trend, flights-by-airline, recent disruptions). Rewrite `dashboard_tools.py` with 4 aviation `@tool` functions importing from `aviation_data.py`. Rewrite `dashboard.md` prompt (same structure — JSON render spec format and shell-gen flow stay) with aviation state paths and example spec. Update `dashboard_graph.py:emit_state`'s per-tool branches to map new tool names to new state paths. Mirror all changes into the per-capability standalone copy at `cockpit/chat/generative-ui/python/`, with inlined analytics constants (standalone has no `aviation_data.py`) and rename its prompt from `generative-ui.md` → `dashboard.md` to fix the long-standing path bug at `graph.py:20`.

**Tech Stack:** Python 3.12, LangGraph, langchain-openai (`gpt-5-mini`), uv. Frontend untouched — Angular 20 + `@ngaf/chat` view components stay as-is.

---

## File Structure

**Umbrella backend** (`cockpit/langgraph/streaming/python/`):
- `src/aviation_data.py` — MODIFY: append `KPI_SNAPSHOT`, `ON_TIME_TREND`, `FLIGHTS_BY_AIRLINE`, `RECENT_DISRUPTIONS` constants
- `src/dashboard_tools.py` — REWRITE: 4 aviation `@tool` functions reading from `aviation_data.py`
- `src/dashboard_graph.py` — MODIFY: `emit_state` function's per-tool branches only
- `prompts/dashboard.md` — REWRITE: aviation framing, state paths, example spec

**Standalone backend** (`cockpit/chat/generative-ui/python/`):
- `src/dashboard_tools.py` — REWRITE: same 4 tools, analytics constants inlined at top of file (no aviation_data.py in standalone)
- `src/graph.py` — MODIFY: `emit_state` per-tool branches (same change as umbrella)
- `prompts/dashboard.md` — CREATE (renamed from `generative-ui.md`)
- `prompts/generative-ui.md` — DELETE

**Frontend** (`cockpit/chat/generative-ui/angular/`): NO CHANGES.
**Langgraph registry** (`langgraph.json`): NO CHANGES.

---

## Task 1: Extend `aviation_data.py` with analytics fixtures

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/aviation_data.py` (append to end of file)

- [ ] **Step 1: Append analytics constants**

Append the following to the end of `cockpit/langgraph/streaming/python/src/aviation_data.py`:

```python

# ── Dashboard analytics (PR 3: c-generative-ui aviation KPIs) ───────────────

KPI_SNAPSHOT = {
    "on_time_pct": 84.2,
    "on_time_delta": "+1.4%",
    "flights_today": 312,
    "flights_today_delta": "+8",
    "avg_delay_min": 12,
    "avg_delay_delta": "-2 min",
    "load_factor_pct": 78.5,
    "load_factor_delta": "+0.6%",
}

ON_TIME_TREND = [
    {"month": "2025-05", "on_time_pct": 82.4},
    {"month": "2025-06", "on_time_pct": 81.1},
    {"month": "2025-07", "on_time_pct": 79.8},
    {"month": "2025-08", "on_time_pct": 80.5},
    {"month": "2025-09", "on_time_pct": 83.2},
    {"month": "2025-10", "on_time_pct": 84.0},
    {"month": "2025-11", "on_time_pct": 82.6},
    {"month": "2025-12", "on_time_pct": 78.9},
    {"month": "2026-01", "on_time_pct": 80.2},
    {"month": "2026-02", "on_time_pct": 81.7},
    {"month": "2026-03", "on_time_pct": 82.8},
    {"month": "2026-04", "on_time_pct": 84.2},
]

FLIGHTS_BY_AIRLINE = [
    {"airline": "American", "count": 87},
    {"airline": "United",   "count": 92},
    {"airline": "Delta",    "count": 78},
    {"airline": "JetBlue",  "count": 55},
]

RECENT_DISRUPTIONS = [
    {"flight_number": "UA123", "type": "delayed",   "minutes": 45, "route": "LAX→JFK", "date": "2026-05-14"},
    {"flight_number": "AA456", "type": "cancelled", "minutes": 0,  "route": "JFK→LAX", "date": "2026-05-14"},
    {"flight_number": "DL789", "type": "delayed",   "minutes": 22, "route": "ATL→ORD", "date": "2026-05-13"},
    {"flight_number": "B6101", "type": "delayed",   "minutes": 68, "route": "BOS→MIA", "date": "2026-05-13"},
    {"flight_number": "UA204", "type": "cancelled", "minutes": 0,  "route": "SFO→SEA", "date": "2026-05-12"},
    {"flight_number": "AA318", "type": "delayed",   "minutes": 15, "route": "DFW→DEN", "date": "2026-05-12"},
    {"flight_number": "DL552", "type": "delayed",   "minutes": 35, "route": "ATL→MIA", "date": "2026-05-11"},
    {"flight_number": "B6217", "type": "delayed",   "minutes": 80, "route": "JFK→BOS", "date": "2026-05-11"},
    {"flight_number": "UA640", "type": "cancelled", "minutes": 0,  "route": "ORD→DEN", "date": "2026-05-10"},
    {"flight_number": "AA871", "type": "delayed",   "minutes": 25, "route": "LAX→DFW", "date": "2026-05-10"},
]
```

- [ ] **Step 2: Verify imports parse cleanly**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "from src.aviation_data import KPI_SNAPSHOT, ON_TIME_TREND, FLIGHTS_BY_AIRLINE, RECENT_DISRUPTIONS; print(len(ON_TIME_TREND), len(FLIGHTS_BY_AIRLINE), len(RECENT_DISRUPTIONS))"`
Expected output: `12 4 10`

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/aviation_data.py
git commit -m "feat(c-generative-ui): add aviation dashboard analytics fixtures"
```

---

## Task 2: Rewrite `dashboard_tools.py` (umbrella)

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/dashboard_tools.py` (full replacement)

- [ ] **Step 1: Replace entire file**

Replace the entire contents of `cockpit/langgraph/streaming/python/src/dashboard_tools.py` with:

```python
"""Aviation KPI tools for the c-generative-ui dashboard demo.

Four tools mirror the SaaS shape they replaced (query_mrr et al):
- query_airline_kpis      → 4 stat cards (snapshot dict)
- query_on_time_trend     → line chart data
- query_flights_by_airline→ bar chart data
- query_recent_disruptions→ data grid rows

Data comes from src.aviation_data; no external calls.
"""

from langchain_core.tools import tool

from src.aviation_data import (
    KPI_SNAPSHOT,
    ON_TIME_TREND,
    FLIGHTS_BY_AIRLINE,
    RECENT_DISRUPTIONS,
)


@tool
def query_airline_kpis() -> dict:
    """Snapshot of operational KPIs across the fleet: on-time %, flights today,
    average delay (minutes), and load factor."""
    snap = KPI_SNAPSHOT
    return {
        "on_time":       {"value": f"{snap['on_time_pct']}%",      "delta": snap["on_time_delta"]},
        "flights_today": {"value": snap["flights_today"],          "delta": snap["flights_today_delta"]},
        "avg_delay":     {"value": f"{snap['avg_delay_min']} min", "delta": snap["avg_delay_delta"]},
        "load_factor":   {"value": f"{snap['load_factor_pct']}%",  "delta": snap["load_factor_delta"]},
    }


@tool
def query_on_time_trend(months: int = 12) -> list[dict]:
    """On-time performance over time, as percentage by month.

    Args:
        months: Number of months to return (default 12). Valid: 3, 6, 12, 24.
    """
    months = min(months, len(ON_TIME_TREND))
    return ON_TIME_TREND[-months:]


@tool
def query_flights_by_airline(airlines: list[str] | None = None) -> list[dict]:
    """Daily flight counts per airline.

    Args:
        airlines: Optional filter list, e.g. ["American", "United"]. All four
                  returned if omitted.
    """
    if airlines:
        return [a for a in FLIGHTS_BY_AIRLINE if a["airline"] in airlines]
    return FLIGHTS_BY_AIRLINE


@tool
def query_recent_disruptions(limit: int = 5, type: str | None = None) -> list[dict]:
    """Recent flight delays or cancellations.

    Args:
        limit: Maximum entries to return (default 5).
        type: Optional filter, "delayed" or "cancelled".
    """
    filtered = RECENT_DISRUPTIONS
    if type:
        filtered = [d for d in filtered if d["type"] == type]
    return filtered[:limit]


ALL_TOOLS = [
    query_airline_kpis,
    query_on_time_trend,
    query_flights_by_airline,
    query_recent_disruptions,
]
```

- [ ] **Step 2: Smoke-test the module**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "
from src.dashboard_tools import ALL_TOOLS, query_airline_kpis, query_on_time_trend, query_flights_by_airline, query_recent_disruptions
assert len(ALL_TOOLS) == 4
print(query_airline_kpis.invoke({}))
print(len(query_on_time_trend.invoke({'months': 6})))
print(len(query_flights_by_airline.invoke({'airlines': ['United']})))
print(len(query_recent_disruptions.invoke({'limit': 3, 'type': 'cancelled'})))
"`
Expected output (4 lines): KPI dict, `6`, `1`, `3`.

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/dashboard_tools.py
git commit -m "feat(c-generative-ui): replace SaaS dashboard tools with aviation KPI tools"
```

---

## Task 3: Update `emit_state` mapping (umbrella `dashboard_graph.py`)

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/dashboard_graph.py` (function `emit_state` at lines 69–98 in current HEAD; replace its per-tool branches only — everything else stays)

- [ ] **Step 1: Replace `emit_state` function body**

Locate the `emit_state` async function (currently lines 69–98). Replace the entire function with:

```python
async def emit_state(state: DashboardState) -> DashboardState:
    """Emit state_update custom events from tool results."""
    from langchain_core.callbacks import adispatch_custom_event

    tool_results = {}
    for msg in reversed(state["messages"]):
        if msg.type == "tool":
            try:
                data = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
            except (json.JSONDecodeError, TypeError):
                continue

            if msg.name == "query_airline_kpis":
                # data is {"on_time": {"value": ..., "delta": ...}, ...}
                for section_key, section_val in data.items():
                    if isinstance(section_val, dict):
                        for k, v in section_val.items():
                            tool_results[f"/{section_key}/{k}"] = v
            elif msg.name == "query_on_time_trend":
                tool_results["/on_time_trend"] = data
            elif msg.name == "query_flights_by_airline":
                tool_results["/flights_by_airline"] = data
            elif msg.name == "query_recent_disruptions":
                tool_results["/recent_disruptions"] = data
        elif msg.type == "ai":
            break

    if tool_results:
        await adispatch_custom_event("state_update", {"updates": tool_results})

    return state
```

- [ ] **Step 2: Verify graph still compiles**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "from src.dashboard_graph import graph; print(type(graph).__name__)"`
Expected output: `CompiledStateGraph`

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/dashboard_graph.py
git commit -m "feat(c-generative-ui): map aviation tool results to dashboard state paths"
```

---

## Task 4: Rewrite `dashboard.md` prompt (umbrella)

**Files:**
- Modify: `cockpit/langgraph/streaming/python/prompts/dashboard.md` (full replacement)

- [ ] **Step 1: Replace entire prompt file**

Replace `cockpit/langgraph/streaming/python/prompts/dashboard.md` with:

````markdown
# Airline Operations Dashboard Agent

You are a dashboard agent that builds interactive airline-operations KPI dashboards using a JSON render spec format. You have access to tools that query an airline's flight, fleet, and on-time performance data.

## Your Behavior

### First message (no existing dashboard)

1. Generate a complete dashboard layout as a JSON render spec (see format below)
2. Call ALL four data tools to populate the dashboard
3. After the tools return, provide a brief conversational summary

### Follow-up messages (dashboard already exists)

Categorize the user's request:

- **Data change** (e.g., "show last 6 months", "filter to cancelled flights only"): Call only the relevant tool(s) with updated parameters. Do NOT regenerate the spec. Just respond conversationally confirming the update.
- **Structural change** (e.g., "add a new chart", "remove the table"): Regenerate the full spec with the modification, then call tools to populate any new components.
- **Question about data** (e.g., "why did on-time % dip in December?"): Respond conversationally in plain text. Do NOT output JSON or call tools.

## JSON Render Spec Format

Your spec response MUST be raw JSON only — no markdown, no code fences, no surrounding text.

```
{
  "elements": { [key: string]: Element },
  "root": string
}
```

An Element has:
```
{
  "type": string,
  "props": { ... },
  "children?": string[]
}
```

### Props with State Bindings

Use `{ "$state": "/json/pointer/path" }` for props that will be populated by tool results. The dashboard renders skeleton placeholders until the data arrives.

Example: `"value": { "$state": "/on_time/value" }` — this prop will be populated when the `/on_time/value` state path receives data.

## Available Component Types

| Type | Props | Children | Description |
|------|-------|----------|-------------|
| `dashboard_grid` | *(none)* | Yes | Top-level vertical layout with section spacing |
| `container` | `direction` ("row" or "column") | Yes | Flex layout container |
| `stat_card` | `label` (string), `value` ($state), `delta` ($state) | No | Metric summary card |
| `line_chart` | `title` (string), `data` ($state array), `xKey` (string), `yKey` (string) | No | SVG line chart |
| `bar_chart` | `title` (string), `data` ($state array), `labelKey` (string), `valueKey` (string) | No | SVG bar chart |
| `data_grid` | `title` (string), `rows` ($state array), `columns` (string[]) | No | Data table |

## State Path Conventions

Use these state paths to match what the tools populate:

- `/on_time/value`, `/on_time/delta` — from query_airline_kpis
- `/flights_today/value`, `/flights_today/delta` — from query_airline_kpis
- `/avg_delay/value`, `/avg_delay/delta` — from query_airline_kpis
- `/load_factor/value`, `/load_factor/delta` — from query_airline_kpis
- `/on_time_trend` — array from query_on_time_trend
- `/flights_by_airline` — array from query_flights_by_airline
- `/recent_disruptions` — array from query_recent_disruptions

## Example Spec

For "show me the dashboard":

{"elements":{"root":{"type":"dashboard_grid","children":["stats_row","charts_row","table_section"]},"stats_row":{"type":"container","props":{"direction":"row"},"children":["on_time_card","flights_card","delay_card","load_card"]},"on_time_card":{"type":"stat_card","props":{"label":"On-time %","value":{"$state":"/on_time/value"},"delta":{"$state":"/on_time/delta"}}},"flights_card":{"type":"stat_card","props":{"label":"Flights Today","value":{"$state":"/flights_today/value"},"delta":{"$state":"/flights_today/delta"}}},"delay_card":{"type":"stat_card","props":{"label":"Avg Delay","value":{"$state":"/avg_delay/value"},"delta":{"$state":"/avg_delay/delta"}}},"load_card":{"type":"stat_card","props":{"label":"Load Factor","value":{"$state":"/load_factor/value"},"delta":{"$state":"/load_factor/delta"}}},"charts_row":{"type":"container","props":{"direction":"row"},"children":["trend_chart","airline_chart"]},"trend_chart":{"type":"line_chart","props":{"title":"On-time % Trend","data":{"$state":"/on_time_trend"},"xKey":"month","yKey":"on_time_pct"}},"airline_chart":{"type":"bar_chart","props":{"title":"Flights by Airline","data":{"$state":"/flights_by_airline"},"labelKey":"airline","valueKey":"count"}},"table_section":{"type":"data_grid","props":{"title":"Recent Disruptions","rows":{"$state":"/recent_disruptions"},"columns":["flight_number","type","minutes","route","date"]}}},"root":"root"}
````

- [ ] **Step 2: Verify file reads cleanly from the graph**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "from src.dashboard_graph import _PROMPT; assert 'Airline Operations' in _PROMPT; assert '/on_time_trend' in _PROMPT; print('ok')"`
Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/python/prompts/dashboard.md
git commit -m "feat(c-generative-ui): rewrite dashboard prompt for airline operations"
```

---

## Task 5: End-to-end umbrella backend smoke (real LLM)

**Files:**
- Read-only: `.env` (root) for `OPENAI_API_KEY`

- [ ] **Step 1: Confirm key is loadable**

Run: `grep -q '^OPENAI_API_KEY=' .env && echo found`
Expected output: `found`

- [ ] **Step 2: Invoke the umbrella graph with a real prompt**

Run from repo root:
```bash
set -a; source .env; set +a
cd cockpit/langgraph/streaming/python && uv run python -c "
import asyncio, json
from src.dashboard_graph import graph
from langchain_core.messages import HumanMessage

async def main():
    state = {'messages': [HumanMessage(content='Show me the dashboard')], 'dashboard_spec': None}
    result = await graph.ainvoke(state)
    spec = result['dashboard_spec']
    print('SPEC_LEN', len(spec))
    parsed = json.loads(spec)
    assert 'elements' in parsed and 'root' in parsed
    assert parsed['root'] in parsed['elements']
    print('AVIATION_PATHS', sum(1 for v in str(parsed).split() if '/on_time' in v or '/flights_today' in v or '/load_factor' in v or '/avg_delay' in v or '/on_time_trend' in v or '/flights_by_airline' in v or '/recent_disruptions' in v))
    msgs = result['messages']
    tool_msgs = [m for m in msgs if m.type == 'tool']
    print('TOOL_CALLS', sorted({m.name for m in tool_msgs}))

asyncio.run(main())
"
```
Expected: `SPEC_LEN` > 200, `AVIATION_PATHS` > 0, `TOOL_CALLS` contains at least `query_airline_kpis` (and ideally all 4 tool names).

- [ ] **Step 3: Commit any incidental fixups, otherwise no-op**

If output passed: no commit. If output revealed a bug in Tasks 1–4: fix the relevant task's file, re-run Step 2, then:

```bash
git add -A
git commit -m "fix(c-generative-ui): umbrella backend smoke fixes"
```

---

## Task 6: Mirror tool rewrite into standalone (`cockpit/chat/generative-ui/python/`)

**Files:**
- Modify: `cockpit/chat/generative-ui/python/src/dashboard_tools.py` (full replacement, analytics constants inlined)

- [ ] **Step 1: Replace entire file**

Replace `cockpit/chat/generative-ui/python/src/dashboard_tools.py` with:

```python
"""Aviation KPI tools for the c-generative-ui standalone demo.

Standalone copy — analytics constants are inlined here because this
backend has no shared aviation_data.py module. Mirrors the umbrella
backend at cockpit/langgraph/streaming/python/src/dashboard_tools.py.
"""

from langchain_core.tools import tool

# ── Analytics fixtures (inlined; no aviation_data.py in standalone) ─────────

KPI_SNAPSHOT = {
    "on_time_pct": 84.2,
    "on_time_delta": "+1.4%",
    "flights_today": 312,
    "flights_today_delta": "+8",
    "avg_delay_min": 12,
    "avg_delay_delta": "-2 min",
    "load_factor_pct": 78.5,
    "load_factor_delta": "+0.6%",
}

ON_TIME_TREND = [
    {"month": "2025-05", "on_time_pct": 82.4},
    {"month": "2025-06", "on_time_pct": 81.1},
    {"month": "2025-07", "on_time_pct": 79.8},
    {"month": "2025-08", "on_time_pct": 80.5},
    {"month": "2025-09", "on_time_pct": 83.2},
    {"month": "2025-10", "on_time_pct": 84.0},
    {"month": "2025-11", "on_time_pct": 82.6},
    {"month": "2025-12", "on_time_pct": 78.9},
    {"month": "2026-01", "on_time_pct": 80.2},
    {"month": "2026-02", "on_time_pct": 81.7},
    {"month": "2026-03", "on_time_pct": 82.8},
    {"month": "2026-04", "on_time_pct": 84.2},
]

FLIGHTS_BY_AIRLINE = [
    {"airline": "American", "count": 87},
    {"airline": "United",   "count": 92},
    {"airline": "Delta",    "count": 78},
    {"airline": "JetBlue",  "count": 55},
]

RECENT_DISRUPTIONS = [
    {"flight_number": "UA123", "type": "delayed",   "minutes": 45, "route": "LAX→JFK", "date": "2026-05-14"},
    {"flight_number": "AA456", "type": "cancelled", "minutes": 0,  "route": "JFK→LAX", "date": "2026-05-14"},
    {"flight_number": "DL789", "type": "delayed",   "minutes": 22, "route": "ATL→ORD", "date": "2026-05-13"},
    {"flight_number": "B6101", "type": "delayed",   "minutes": 68, "route": "BOS→MIA", "date": "2026-05-13"},
    {"flight_number": "UA204", "type": "cancelled", "minutes": 0,  "route": "SFO→SEA", "date": "2026-05-12"},
    {"flight_number": "AA318", "type": "delayed",   "minutes": 15, "route": "DFW→DEN", "date": "2026-05-12"},
    {"flight_number": "DL552", "type": "delayed",   "minutes": 35, "route": "ATL→MIA", "date": "2026-05-11"},
    {"flight_number": "B6217", "type": "delayed",   "minutes": 80, "route": "JFK→BOS", "date": "2026-05-11"},
    {"flight_number": "UA640", "type": "cancelled", "minutes": 0,  "route": "ORD→DEN", "date": "2026-05-10"},
    {"flight_number": "AA871", "type": "delayed",   "minutes": 25, "route": "LAX→DFW", "date": "2026-05-10"},
]


# ── Tools ───────────────────────────────────────────────────────────────────

@tool
def query_airline_kpis() -> dict:
    """Snapshot of operational KPIs across the fleet: on-time %, flights today,
    average delay (minutes), and load factor."""
    snap = KPI_SNAPSHOT
    return {
        "on_time":       {"value": f"{snap['on_time_pct']}%",      "delta": snap["on_time_delta"]},
        "flights_today": {"value": snap["flights_today"],          "delta": snap["flights_today_delta"]},
        "avg_delay":     {"value": f"{snap['avg_delay_min']} min", "delta": snap["avg_delay_delta"]},
        "load_factor":   {"value": f"{snap['load_factor_pct']}%",  "delta": snap["load_factor_delta"]},
    }


@tool
def query_on_time_trend(months: int = 12) -> list[dict]:
    """On-time performance over time, as percentage by month.

    Args:
        months: Number of months to return (default 12). Valid: 3, 6, 12, 24.
    """
    months = min(months, len(ON_TIME_TREND))
    return ON_TIME_TREND[-months:]


@tool
def query_flights_by_airline(airlines: list[str] | None = None) -> list[dict]:
    """Daily flight counts per airline.

    Args:
        airlines: Optional filter list, e.g. ["American", "United"]. All four
                  returned if omitted.
    """
    if airlines:
        return [a for a in FLIGHTS_BY_AIRLINE if a["airline"] in airlines]
    return FLIGHTS_BY_AIRLINE


@tool
def query_recent_disruptions(limit: int = 5, type: str | None = None) -> list[dict]:
    """Recent flight delays or cancellations.

    Args:
        limit: Maximum entries to return (default 5).
        type: Optional filter, "delayed" or "cancelled".
    """
    filtered = RECENT_DISRUPTIONS
    if type:
        filtered = [d for d in filtered if d["type"] == type]
    return filtered[:limit]


ALL_TOOLS = [
    query_airline_kpis,
    query_on_time_trend,
    query_flights_by_airline,
    query_recent_disruptions,
]
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/chat/generative-ui/python/src/dashboard_tools.py
git commit -m "feat(c-generative-ui standalone): mirror aviation KPI tools"
```

---

## Task 7: Mirror `emit_state` rewrite into standalone `graph.py`

**Files:**
- Modify: `cockpit/chat/generative-ui/python/src/graph.py` (function `emit_state` only)

- [ ] **Step 1: Replace `emit_state` function**

Find the `emit_state` async function in `cockpit/chat/generative-ui/python/src/graph.py` and replace it with the identical body used in Task 3:

```python
async def emit_state(state: DashboardState) -> DashboardState:
    """Emit state_update custom events from tool results."""
    from langchain_core.callbacks import adispatch_custom_event

    tool_results = {}
    for msg in reversed(state["messages"]):
        if msg.type == "tool":
            try:
                data = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
            except (json.JSONDecodeError, TypeError):
                continue

            if msg.name == "query_airline_kpis":
                for section_key, section_val in data.items():
                    if isinstance(section_val, dict):
                        for k, v in section_val.items():
                            tool_results[f"/{section_key}/{k}"] = v
            elif msg.name == "query_on_time_trend":
                tool_results["/on_time_trend"] = data
            elif msg.name == "query_flights_by_airline":
                tool_results["/flights_by_airline"] = data
            elif msg.name == "query_recent_disruptions":
                tool_results["/recent_disruptions"] = data
        elif msg.type == "ai":
            break

    if tool_results:
        await adispatch_custom_event("state_update", {"updates": tool_results})

    return state
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/chat/generative-ui/python/src/graph.py
git commit -m "feat(c-generative-ui standalone): map aviation tool results to state paths"
```

---

## Task 8: Rename standalone prompt + drop `generative-ui.md`

**Files:**
- Rename: `cockpit/chat/generative-ui/python/prompts/generative-ui.md` → `cockpit/chat/generative-ui/python/prompts/dashboard.md`
- Replace contents with the aviation prompt from Task 4

The standalone `graph.py` already references `prompts/dashboard.md` (line 20). The current file is misnamed `generative-ui.md`, causing a `FileNotFoundError` at runtime. This task fixes the bug AND lands the aviation rewrite.

- [ ] **Step 1: Verify no other consumer of `generative-ui.md` in the standalone tree**

Run: `grep -rn "generative-ui.md" cockpit/chat/generative-ui/python/`
Expected: zero output (no references).

- [ ] **Step 2: Delete old prompt file and create the new one**

Delete: `cockpit/chat/generative-ui/python/prompts/generative-ui.md`

Create: `cockpit/chat/generative-ui/python/prompts/dashboard.md` with the exact same content as the umbrella prompt from Task 4 (Airline Operations Dashboard Agent — full file).

- [ ] **Step 3: Verify the standalone graph loads the prompt**

Run: `cd cockpit/chat/generative-ui/python && uv run python -c "from src.graph import _PROMPT; assert 'Airline Operations' in _PROMPT; print('ok')"`
Expected output: `ok`

- [ ] **Step 4: Commit**

```bash
git add cockpit/chat/generative-ui/python/prompts/
git commit -m "fix(c-generative-ui standalone): rename prompt to dashboard.md, aviation rewrite"
```

---

## Task 9: Build verification across the whole repo

**Files:**
- No code changes — pure CI parity check

- [ ] **Step 1: Build the umbrella langgraph python project**

Run: `pnpm nx run cockpit-langgraph-streaming-python:build`
Expected: build succeeds with no errors.

- [ ] **Step 2: Build all cockpit examples**

Run: `pnpm nx build all-examples`
Expected: build succeeds.

- [ ] **Step 3: Run the existing chat-generative-ui Angular unit tests**

Run: `pnpm nx test cockpit-chat-generative-ui-angular`
Expected: all tests pass — frontend was untouched, this is a sanity check.

- [ ] **Step 4: No commit (verification only)**

If any of the above fails, the failing task's file change is the cause — go back and fix that task's file, then re-run from Step 1.

---

## Task 10: Manual chrome MCP smoke (REQUIRED gating check before PR)

**Files:**
- No code changes — interactive verification with the real LLM via the running cockpit

This task is REQUIRED (not deferred) per the spec. `OPENAI_API_KEY` is in repo root `.env`.

- [ ] **Step 1: Start the langgraph backend with env loaded**

Run in a background shell:
```bash
set -a; source .env; set +a
pnpm nx serve cockpit-langgraph-streaming-python
```
Expected: server listens (default port 2024).

- [ ] **Step 2: Start the cockpit dev server**

In a second background shell:
```bash
pnpm nx serve cockpit
```
Expected: Angular dev server listens (default port 4200).

- [ ] **Step 3: Navigate to chat-generative-ui in chrome MCP**

Using the `mcp__Claude_in_Chrome__navigate` tool, open: `http://localhost:4200/chat-generative-ui`
Expected: chat page renders with an empty conversation.

- [ ] **Step 4: Smoke prompt — initial dashboard**

Type into the chat input and submit: `Show me the dashboard`

Expected (capture screenshot):
- Dashboard shell renders within ~3s with skeleton placeholders
- 4 tool calls fire (visible in the chat-debug overlay if enabled, or inferable from the populating cards)
- Cards populate with: On-time % 84.2%, Flights Today 312, Avg Delay 12 min, Load Factor 78.5%
- Line chart shows 12 monthly on-time % data points
- Bar chart shows American/United/Delta/JetBlue counts
- Data grid shows 5 recent disruptions

- [ ] **Step 5: Smoke prompt — data-only update**

Type and submit: `Filter to cancelled flights only`

Expected (capture screenshot):
- ONLY the disruptions table updates (3 rows: AA456, UA204, UA640)
- No shell regeneration (cards/charts stay put)
- LLM replies with a brief conversational confirmation

- [ ] **Step 6: Smoke prompt — conversational question**

Type and submit: `Why might on-time % have dipped in December?`

Expected:
- LLM responds in plain prose (no JSON, no tool calls)
- Dashboard does not re-render

- [ ] **Step 7: Tear down background servers**

Stop both background shells.

- [ ] **Step 8: Commit screenshots to PR description, not the repo**

Attach screenshots from Steps 4–6 to the PR description body. Do NOT commit them to the repo.

If any smoke step fails: identify which underlying task (1–8) caused the regression, fix it there, re-run Tasks 9–10.

---

## Task 11: Open the PR

**Files:**
- No code changes

- [ ] **Step 1: Push branch**

Run: `git push -u origin HEAD`

- [ ] **Step 2: Open PR**

Run:
```bash
gh pr create --title "feat(c-generative-ui): airline operations KPI dashboard (PR 3 of 4)" --body "$(cat <<'EOF'
## Summary
- PR 3 of 4 in the c-* aviation theme rollout. Converts the c-generative-ui demo from a SaaS metrics dashboard to an airline operations KPI dashboard.
- Swaps dataset (KPI snapshot, on-time trend, flights-by-airline, recent disruptions), 4 tools, prompt, and the `emit_state` per-tool branches. Graph topology and Angular view components are unchanged.
- Mirrors the same rewrite into the per-capability standalone backend AND fixes a long-standing prompt-path bug (`graph.py` referenced `prompts/dashboard.md` while the file was misnamed `generative-ui.md`).

## Test plan
- [x] `pnpm nx run cockpit-langgraph-streaming-python:build`
- [x] `pnpm nx build all-examples`
- [x] `pnpm nx test cockpit-chat-generative-ui-angular`
- [x] Manual chrome MCP smoke against real LLM (screenshots attached):
  - [x] "Show me the dashboard" — shell renders, 4 tools fire, all cards/charts/table populate
  - [x] "Filter to cancelled flights only" — only disruptions table updates
  - [x] "Why might on-time % have dipped in December?" — conversational reply, no JSON

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 3: Wait for CI, merge on green**

Run: `gh pr checks <PR_NUMBER> --watch` then `gh pr merge <PR_NUMBER> --squash`.

---

## Self-Review

**Spec coverage:**
- Decision 1 (extend aviation_data.py) → Task 1 ✓
- Decision 2 (4 mirror-SaaS tools) → Task 2 ✓
- Decision 3 (standalone parity + path bug fix) → Tasks 6, 7, 8 ✓
- Decision 4 (chrome MCP required) → Task 10 ✓
- KPI mapping table → Tasks 2 (tools) + 3 (emit_state) + 4 (prompt example) all aligned ✓
- emit_state rewrite called out as the one intentional graph change → Tasks 3, 7 ✓
- Frontend untouched → Task 9 Step 3 verifies ✓

**Placeholder scan:**
- No TBDs, no "similar to Task N" hand-waves, no "add validation". Every code step has complete code. Task 8 explicitly references "exact same content as Task 4" — acceptable because both prompt files are identical by design; the alternative would be 80 lines of duplicate markdown in the plan.

**Type consistency:**
- Tool names match across Tasks 2, 3, 4, 6, 7 (`query_airline_kpis`, `query_on_time_trend`, `query_flights_by_airline`, `query_recent_disruptions`).
- State paths match across Tasks 3 (emit_state), 4 (prompt example), 6 (tool data shape).
- Data constant names (`KPI_SNAPSHOT`, `ON_TIME_TREND`, `FLIGHTS_BY_AIRLINE`, `RECENT_DISRUPTIONS`) identical in Tasks 1 (umbrella aviation_data.py), 2 (umbrella import), 6 (standalone inlined).
