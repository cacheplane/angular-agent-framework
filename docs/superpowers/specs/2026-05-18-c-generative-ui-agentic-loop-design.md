# c-generative-ui Agentic-Loop Rewrite — Design

**Date:** 2026-05-18
**Status:** Spec — pending implementation plan

## Goal

Replace the current 6-node split-graph architecture (`router → generate_shell → populate_initial_data → emit_state → respond` for first turn, `router → plan_tools → call_tools → emit_state → respond` for follow-ups) with a **single agentic loop** where the LLM authors the dashboard spec AND chooses which data tools to call, in one coherent reasoning step.

This delivers on the demo's actual claim — *the LLM intelligently composes UI and data fetches together* — instead of fudging it with a deterministic "always call all 4 tools" node (PR #428's stopgap).

## Background

PR #428 made the demo render (today it fails: empty placeholder cards forever) by inserting a hardcoded `populate_initial_data` node that mechanically invokes all 4 data tools after `generate_shell`. That works but it's a fudge:

- Ignores the spec entirely — fetches all 4 datasets regardless of which components the LLM authored
- Couples the demo to the aviation tool set; can't be retargeted without a graph edit
- Zero LLM reasoning in the populate step — defeats the "generative" claim

The real shape, used everywhere else in our codebase (`c_tool_calls`, `c_subagents`), is **one LLM node with tools bound, looping until done.** This spec adopts that pattern.

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | How does the LLM emit the spec? | New `render_spec(spec: dict)` tool. LLM calls it like any other tool. Removes the "spec is special, it's in AIMessage content" carve-out. Uniform "all decisions = tool calls" shape, matches `c_tool_calls`. |
| 2 | Where does `dashboard_spec` state live? | `render_spec` returns `Command(update={"dashboard_spec": ..., "messages": [ToolMessage(...)]})` — directly mutating state via LangGraph 0.3+ `Command`-from-tool support (confirmed via `pyproject.toml` pin `langgraph>=0.3`). No separate extract node. |
| 3 | Graph shape | `START → agent ↔ tools → emit_state → respond → END`. No router (the agent's prompt + tool selection handles first-turn vs follow-up). No `generate_shell`, no `plan_tools`, no `populate_initial_data`. |
| 4 | Iteration cap | `should_continue` checks: (a) last message has tool_calls AND (b) tool-call count this turn < 8. 8 leaves headroom for 1 spec + 4 data tools + 3 retries. After cap, force exit to `emit_state`. |
| 5 | Model | gpt-5 with `reasoning_effort='minimal'` (matches today's planner, which was specifically chosen for instruction-following — see comment block at lines 24-36 of today's `dashboard_graph.py`). gpt-5-mini stays on `respond` (cheaper, prose-only). |
| 6 | `emit_state` behavior | Unchanged. Still iterates `state["messages"]` in reverse, looks at ToolMessages by `name`, fires `state_update` events. Now also encounters `render_spec` ToolMessages but those have no data payload (the spec is in `dashboard_spec` field, not the message) — `emit_state` ignores names it doesn't recognize. |
| 7 | `respond` behavior | Unchanged from PR #428 (always re-summarizes, no early-exit, "do not ask follow-up questions" instruction). |
| 8 | Tool-calling style | `tool_choice='auto'` (NOT `'required'`). Lets the agent return a pure-prose response on interpretive case-3 questions ("why did on-time % dip?"). |
| 9 | System prompt | Rewrite `prompts/dashboard.md` to be agentic-loop-aware. Instructs: "Use `render_spec` to author the dashboard. Then call data tools to populate the components you authored. On follow-up, call only the tools relevant to the user's request." |
| 10 | Mirror policy | Apply identical changes to per-cap (`cockpit/chat/generative-ui/python/src/graph.py`) AND umbrella (`cockpit/langgraph/streaming/python/src/dashboard_graph.py`). Prompt file change applies to per-cap (`cockpit/chat/generative-ui/python/prompts/dashboard.md`) AND umbrella (`cockpit/langgraph/streaming/python/prompts/dashboard.md`). |

## Architecture

```
START → agent ──→ should_continue ──┬─→ tools ─→ agent  (loop)
                                    └─→ emit_state → respond → END
```

Diff from PR #428:
- **Removed nodes:** `router`, `generate_shell`, `populate_initial_data`, `plan_tools`
- **New node:** `agent` (single LLM call, all tools bound)
- **New tool:** `render_spec(spec: dict)`
- **Tools bound to agent:** `[render_spec, query_airline_kpis, query_on_time_trend, query_flights_by_airline, query_recent_disruptions]`
- **Unchanged:** `tools` (ToolNode), `emit_state`, `respond`

`DashboardState` keeps `dashboard_spec: str | None` field — populated by `render_spec` tool, used by frontend to render the layout.

## `render_spec` tool

```python
import json
from langchain_core.messages import ToolMessage
from langchain_core.tools import tool
from langgraph.types import Command


@tool
def render_spec(spec: dict, tool_call_id: Annotated[str, InjectedToolCallId]) -> Command:
    """Render an interactive dashboard layout from a JSON spec.

    Use this tool to author or update the dashboard layout. The spec is a
    JSON object with `elements` (a dict keyed by component id) and `root`
    (the id of the top-level component). See the system prompt for the full
    schema and component catalog.

    Call this tool FIRST on any turn where the layout needs to be created
    or restructured. After calling render_spec, call the data tools needed
    to populate the components you authored.

    Args:
        spec: The dashboard JSON render spec.

    Returns:
        Command updating dashboard_spec in state and emitting a ToolMessage.
    """
    spec_text = json.dumps(spec)
    return Command(
        update={
            "dashboard_spec": spec_text,
            "messages": [
                ToolMessage(
                    content="Spec accepted.",
                    tool_call_id=tool_call_id,
                    name="render_spec",
                )
            ],
        }
    )
```

`InjectedToolCallId` is a LangChain-Core annotation that injects the calling AI message's tool_call_id without the LLM having to provide it. Available since `langchain-core>=0.3.0` (confirmed via cockpit deps).

The ToolMessage content is just `"Spec accepted."` — purely a placeholder so the loop continues; the actual spec lives in the `dashboard_spec` state field. `emit_state` will encounter this ToolMessage and ignore it (no matching `if msg.name == ...` branch — fall-through is benign).

## `agent` node

```python
async def agent(state: DashboardState) -> dict:
    """Single agentic node: LLM bound with all 5 tools (render_spec + 4 data
    tools), driven by the dashboard.md system prompt. Loops via the
    `tools` node + `should_continue` conditional edge until the LLM
    returns no tool_calls."""
    messages = [SystemMessage(content=_PROMPT)] + state["messages"]
    response = await _llm_with_tools.ainvoke(messages)
    return {"messages": [response]}


_llm_with_tools = ChatOpenAI(
    model="gpt-5",
    temperature=0,
    streaming=True,
    reasoning_effort="minimal",
).bind_tools([render_spec, *ALL_TOOLS])
```

`ALL_TOOLS` (the 4 data tools) imported from `dashboard_tools.py` unchanged.

## `should_continue` with iteration cap

```python
_MAX_TOOL_ITERATIONS = 8


def should_continue(state: DashboardState) -> Literal["tools", "emit_state"]:
    """Loop while the agent emits tool_calls, up to MAX_TOOL_ITERATIONS this
    turn. After the cap, force exit to emit_state — better to render a
    partial dashboard than to loop until the LLM gets bored."""
    last = state["messages"][-1]
    if not (hasattr(last, "tool_calls") and last.tool_calls):
        return "emit_state"

    # Count tool_call AIMessages in the current turn (since last human message)
    iter_count = 0
    for msg in reversed(state["messages"]):
        if msg.type == "human":
            break
        if msg.type == "ai" and getattr(msg, "tool_calls", None):
            iter_count += 1
    if iter_count >= _MAX_TOOL_ITERATIONS:
        return "emit_state"
    return "tools"
```

## System prompt rewrite (`prompts/dashboard.md`)

The existing prompt's "First message" / "Follow-up messages" sections describe a sequential workflow that maps poorly to a single agentic loop. Replace with an agent-style prompt:

```markdown
# Airline Operations Dashboard Agent

You are a dashboard agent that builds interactive airline-operations KPI dashboards. You have five tools:

- `render_spec(spec)` — Author or update the dashboard layout. The spec is a JSON object describing component types, props, children, and state bindings. See the schema below.
- `query_airline_kpis()` — Snapshot of operational KPIs: on-time %, flights today, avg delay, load factor.
- `query_on_time_trend(months=12)` — On-time performance per month, for the line chart.
- `query_flights_by_airline(airlines=None)` — Daily flight counts per airline, for the bar chart.
- `query_recent_disruptions(limit=5, type=None)` — Recent delays/cancellations, for the data grid.

## Workflow

### When no dashboard exists yet (first turn)

1. Call `render_spec` with a complete dashboard layout — stat cards, charts, table — using `$state` bindings to the slots that the data tools populate.
2. Call EACH data tool that backs a component in your spec. Do NOT call tools whose data your spec doesn't reference.
3. Return — no further tool calls. A separate node will write a brief summary.

### When the dashboard exists (follow-up turn)

Categorize the user's request and act ONCE. DO NOT ask clarifying questions — pick the most reasonable interpretation and act.

- **Filter / scope** (e.g. "filter to cancelled flights only", "last 6 months", "top 3"): call EXACTLY ONE data tool — the one that backs the affected component — with the new parameters. Do NOT call `render_spec`.
- **Structural change** (e.g. "add a card for X", "remove the table"): call `render_spec` with the modified layout, then call data tools only for the NEW components.
- **Interpretive question** that no tool could resolve (e.g. "why is on-time % low?"): respond in plain prose with no tool calls. Use this ONLY when no tool fetch could answer the question.

## render_spec schema

[... existing schema sections preserved verbatim: JSON Render Spec Format,
 Props with State Bindings, Available Component Types, State Path
 Conventions, Example Spec — keep these byte-identical since they're correct,
 only the workflow sections above are rewritten ...]
```

## State path conventions (unchanged)

`emit_state` already maps tool names to JSON-pointer paths:

| Tool | Pointer paths it populates |
|---|---|
| `query_airline_kpis` | `/on_time/value`, `/flights_today/value`, `/avg_delay/value`, `/load_factor/value` (each with `/delta`) |
| `query_on_time_trend` | `/on_time_trend` |
| `query_flights_by_airline` | `/flights_by_airline` |
| `query_recent_disruptions` | `/recent_disruptions` |

The agent prompt's "use `$state` bindings to slots the data tools populate" guidance refers to these paths. No change to `emit_state` or `dashboard_tools.py`.

## Files modified

| File | Change |
|---|---|
| `cockpit/chat/generative-ui/python/src/graph.py` | Rewrite to agentic-loop architecture; add `render_spec` tool; remove `router`, `generate_shell`, `populate_initial_data`, `plan_tools` |
| `cockpit/langgraph/streaming/python/src/dashboard_graph.py` | Identical rewrite (full-copy mirror) |
| `cockpit/chat/generative-ui/python/prompts/dashboard.md` | Replace "First message" / "Follow-up messages" sections with agent-style workflow; keep schema sections verbatim |
| `cockpit/langgraph/streaming/python/prompts/dashboard.md` | Identical prompt update (must stay in sync) |

No frontend changes. No `dashboard_tools.py` changes. No new dependencies.

## Testing

**Programmatic (per-cap on :5508, real LLM):**

1. Boot per-cap backend
2. **Turn 1** — "Show me a dashboard of airline operations":
   - Assert: `dashboard_spec` is populated (set by `render_spec` Command)
   - Assert: 4+ ToolMessages (1 from `render_spec`, ≥3 from data tools — `render_spec` always, plus at least the data tools the spec references)
   - Assert: final AI message is conversational prose (not JSON, not chatter)
3. **Turn 2** — "Filter to only cancelled flights":
   - Assert: 1 new tool call (likely `query_recent_disruptions` with `type='cancelled'`); NO new `render_spec` call (dashboard structure unchanged)
   - Assert: final message commits to the action
4. **Turn 3** — "Add a card showing total delays this month":
   - Assert: 2+ new tool calls (`render_spec` for the updated layout + the relevant data tool for the new card)
5. **Turn 4** — "Why is on-time % low?":
   - Assert: 0 tool calls (interpretive case-3); final message is plain prose

**Chrome MCP smoke (per-cap on :5508 + Angular on :4508):**

1. Navigate to `http://localhost:4508/`
2. Click "Render a dashboard" → wait 30s → expect populated KPI cards (NUMBERS), line chart, bar chart, table — no "Building UI…" placeholders
3. Type "Filter to only cancelled flights" → wait 15s → table updates to cancelled-only rows
4. Type "Why is on-time % low?" → wait 15s → prose answer, no spec regeneration
5. Screenshot for PR description

**Test caveat:** chrome MCP must run in an isolated worktree to avoid the concurrent-worktree-branch-switching that defeated PR #428's chrome MCP smoke. The implementation plan will spell out the `git worktree add` command for this.

## Risks and mitigations

- **Loop runaway.** Mitigated by `_MAX_TOOL_ITERATIONS = 8` cap in `should_continue`. After the cap, force exit to `emit_state` — partial dashboard is better than infinite loop. 8 leaves headroom: 1 spec + 4 data tools + 3 retries.
- **`Command`-from-tool API change in future LangGraph.** Current `langgraph>=0.3` pin includes this API; LangChain has marked it stable. Mitigation: pin a maximum version if a breaking change ships.
- **gpt-5 reasoning='minimal' refusing to commit to tool calls** (the exact failure mode PR #428 was working around). Mitigation: prompt explicitly lists "DO NOT ask clarifying questions"; `tool_choice='auto'` lets case-3 prose answers happen legitimately; if the LLM still flakes on first-turn spec generation, fall back to a one-shot retry inside the agent node (out of scope for v1, document as follow-up).
- **`render_spec` LLM emits invalid JSON.** The `tool` decorator's Pydantic validation will reject malformed dicts; the LLM gets a ToolMessage error and can retry. Mitigation: that's standard tool-calling resilience, no extra code needed.
- **Standalone per-cap vs umbrella mirror drift.** Same risk as every per-cap graph. Mitigation: both diffs in the same PR; reviewer eyeballs them. Per-cap drift CI guard remains backlog.

## Out-of-scope follow-ups

- Cache spec across structurally-identical turns (LLM re-emits the same spec on filter requests today — wasteful but works)
- Streaming `state_update` events DURING the loop (today they fire after the loop ends via `emit_state` — fine for now, smoother with mid-loop streaming)
- Per-cap drift guard CI check
- Pre-fill the chat input chip text with aviation-themed prompts (chip says "Q3 sales dashboard" today — frontend concern, separate PR)
- LLM self-validates the spec against a Pydantic schema before calling `render_spec` (today Pydantic validates the `spec: dict` shape but not the spec's internal structure)
