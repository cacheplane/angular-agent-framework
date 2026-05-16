# c-generative-ui Aviation KPI Dashboard — Design

**Date:** 2026-05-16
**Status:** Spec — pending implementation plan
**Series:** PR 3 of 4 in the c-* aviation theme rollout

## Goal

Convert the `c-generative-ui` demo from a SaaS metrics dashboard to an airline operations KPI dashboard. The graph architecture, custom-event streaming, and Angular view components stay untouched — only the dataset, tools, and prompt change. Result: the chat-generative-ui cockpit demo tells the same operations-dashboard story as the rest of the c-* track.

Out of scope:
- Graph topology changes (`dashboard_graph.py` stays as-is — router → generate_shell → plan_tools → call_tools → emit_state → respond)
- Angular view components (stat_card, container, dashboard_grid, line_chart, bar_chart, data_grid) — already domain-agnostic, reused as-is
- Langgraph registry (`langgraph.json`) — `c-generative-ui` keeps pointing at `chat_graphs.py:generative_ui` which re-exports `dashboard_graph.graph`
- c-tool-calls, c-subagents (PR 1, shipped); 7 simple prompts (PR 2, shipped); c-a2ui (PR 4)

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Dataset source | Extend `aviation_data.py` with analytics fixtures. Single source of truth shared with the c-tool-calls graph from PR 1. |
| 2 | Tool surface | Mirror SaaS — 4 tools (`query_airline_kpis`, `query_on_time_trend`, `query_flights_by_airline`, `query_recent_disruptions`). Same shape as today's tools; zero graph-architecture risk. |
| 3 | Standalone backend | Update the per-capability `cockpit/chat/generative-ui/python/` copy in lockstep, AND fix its stale prompt-path bug (graph.py reads `prompts/dashboard.md` but the file is `prompts/generative-ui.md`). Resolution: rename the standalone's prompt to `dashboard.md` for parity with umbrella. |
| 4 | Manual smoke gate | Chrome MCP smoke is REQUIRED before merge (not deferred). `OPENAI_API_KEY` is in repo root `.env`. |

## KPI mapping

| Component | Label | State path | Source tool |
|---|---|---|---|
| `stat_card` | On-time % | `/on_time/value`, `/on_time/delta` | `query_airline_kpis` |
| `stat_card` | Flights today | `/flights_today/value`, `/flights_today/delta` | `query_airline_kpis` |
| `stat_card` | Avg delay (min) | `/avg_delay/value`, `/avg_delay/delta` | `query_airline_kpis` |
| `stat_card` | Load factor | `/load_factor/value`, `/load_factor/delta` | `query_airline_kpis` |
| `line_chart` | On-time % trend | `/on_time_trend` | `query_on_time_trend(months)` |
| `bar_chart` | Flights by airline | `/flights_by_airline` | `query_flights_by_airline(airlines?)` |
| `data_grid` | Recent disruptions | `/recent_disruptions` | `query_recent_disruptions(limit, type?)` |

## Mock data additions (`aviation_data.py`)

```python
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
    # ... 12 monthly entries through 2026-04
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
    # ... ~10 entries
]
```

All values hardcoded for determinism. No date math, no random.

## Tool signatures (`dashboard_tools.py` rewrite)

```python
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
        airlines: Optional filter list, e.g. ["American", "United"]. All four returned if omitted.
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

ALL_TOOLS = [query_airline_kpis, query_on_time_trend, query_flights_by_airline, query_recent_disruptions]
```

## `emit_state` updates

The `dashboard_graph.py:emit_state` function maps tool results to state paths. Rewire the per-tool branches to the new tool names and state paths:

| Tool name | Emitted state paths |
|---|---|
| `query_airline_kpis` | `/on_time/value`, `/on_time/delta`, `/flights_today/value`, ... (flatten nested dict, same pattern as current `query_mrr`) |
| `query_on_time_trend` | `/on_time_trend` |
| `query_flights_by_airline` | `/flights_by_airline` |
| `query_recent_disruptions` | `/recent_disruptions` |

This is the ONE intentional graph code change — the surrounding nodes (router, generate_shell, plan_tools, call_tools, respond) are untouched.

## Prompt rewrite (`prompts/dashboard.md`)

Preserve the existing structure verbatim — first-turn shell-gen + tool call cascade, follow-up data/structural/question categorization, JSON spec format section, component-type table, state-path conventions, example spec. Swap:

- Title: "SaaS Metrics Dashboard Agent" → "Airline Operations Dashboard Agent"
- Domain framing: "SaaS metrics" → "airline operations KPIs"
- State path table to the 7 aviation paths above
- Example spec JSON to render the aviation dashboard (4 stat cards + on-time-trend line + flights-by-airline bar + recent-disruptions table)

The aviation-assistant character header from PR 2 is intentionally NOT applied — this graph emits raw JSON, not prose; a friendly persona would be noise.

## Files modified

| File | Change |
|---|---|
| `cockpit/langgraph/streaming/python/src/aviation_data.py` | Append KPI_SNAPSHOT, ON_TIME_TREND, FLIGHTS_BY_AIRLINE, RECENT_DISRUPTIONS |
| `cockpit/langgraph/streaming/python/src/dashboard_tools.py` | Full rewrite — 4 aviation tools, import from aviation_data |
| `cockpit/langgraph/streaming/python/src/dashboard_graph.py` | Rewrite `emit_state` tool-name branches only |
| `cockpit/langgraph/streaming/python/prompts/dashboard.md` | Full rewrite (same structure, aviation framing) |
| `cockpit/chat/generative-ui/python/src/dashboard_tools.py` | Mirror umbrella rewrite |
| `cockpit/chat/generative-ui/python/src/graph.py` | Mirror `emit_state` rewrite (architecture unchanged) |
| `cockpit/chat/generative-ui/python/prompts/dashboard.md` | NEW (rename from generative-ui.md) — mirrors umbrella `dashboard.md` |
| `cockpit/chat/generative-ui/python/prompts/generative-ui.md` | DELETE (renamed to dashboard.md) |

Aviation-data extensions live only in the umbrella copy; the standalone backend imports from `src/dashboard_tools.py` which inlines the data — to keep both backends standalone, duplicate the analytics constants into the standalone's `dashboard_tools.py` rather than introducing a new `aviation_data.py` file in the standalone. (The standalone has no aviation_data.py today; it doesn't need one.)

## Testing

**Build verification:**
- `pnpm nx run cockpit-langgraph-streaming-python:build` clean
- `pnpm nx build all-examples` clean
- `pnpm nx test cockpit-chat-generative-ui-angular` clean (view components untouched, should pass)

**Required manual chrome MCP smoke (gating merge):**

`OPENAI_API_KEY` available in repo root `.env`. Steps:
1. Start cockpit dev server (`pnpm nx serve cockpit`)
2. Start langgraph dev server with .env loaded
3. Chrome MCP: navigate to chat-generative-ui route
4. Ask "Show me the dashboard" → expect: shell renders with skeleton placeholders, four tool calls fire, cards/charts/table populate from streamed state events
5. Ask "Filter to delayed flights only" → expect: only `query_recent_disruptions` re-fires with `type="delayed"`, table updates, no shell regeneration
6. Ask "Add a stat card for fleet utilization" → expect: structural change — spec regenerates with new card; LLM acknowledges no data tool exists (acceptable for demo)
7. Ask "Why is on-time % up this month?" → expect: conversational reply, no JSON, no tool calls

Capture before/after screenshots for the PR description.

## Risks and mitigations

- **JSON-spec drift** — gpt-5-mini might emit invalid JSON for the new domain. Pre-existing risk; structure is unchanged. If the LLM fails repeatedly, the prompt example block (verbatim aviation JSON) gives a strong few-shot anchor.
- **State-path renames break frontend rendering** — the Angular views read `$state` paths blindly; spec drives the paths. Risk is the *prompt* outputting the wrong paths (e.g., `/mrr/value` from training memory). Mitigated by the prompt example block calling out aviation paths explicitly.
- **Standalone backend drift** — two copies. Mitigation: PR includes a `diff` check between umbrella and standalone `dashboard_tools.py` minus the data-import line; flag in CI follow-up if cheap.
- **Domain "feel"** — airline KPI deltas (avg delay shrinking, load factor up <1%) read less dramatic than SaaS MRR growth. Acceptable for a demo whose point is generative UI, not narrative.

## Out-of-scope follow-ups

- PR 4 — c-a2ui contact form → flight booking form
- aimock e2e fixtures for the aviation dashboard scenario
- Extract shared `aviation_data.py` for the standalone backend (currently duplicated inline)
- Lint/CI check to prevent umbrella/standalone tool-set drift
