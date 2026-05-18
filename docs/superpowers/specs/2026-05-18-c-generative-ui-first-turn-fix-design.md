# c-generative-ui First-Turn Fix — Design

**Date:** 2026-05-18
**Status:** Spec — pending implementation plan

## Goal

Fix the c-generative-ui dashboard demo so that on the first turn the agent actually populates the spec it just generated (today: zero tool calls, 6 empty "Building UI…" placeholder cards forever). And on follow-up turns, make `plan_tools` act on the user's request instead of asking clarifying questions.

## Evidence (chrome MCP, 2026-05-18, against `cockpit/chat/generative-ui/python` on :5508 + Angular dev on :4508)

**Turn 1 — "Show me a Q3 sales dashboard with three metrics."**
- `generate_shell` emits valid 1239-char render spec (✓)
- `plan_tools` (gpt-5, `reasoning='minimal'`, bound with all 4 tools) emits prose with **zero tool calls**: *"Got it — I'll stick with the current Q3 sales dashboard layout you're seeing. If you want any changes (e.g., swap a metric, rename cards, or add/remove charts)…"*
- `should_call_tools` sees no tool calls → routes to `respond`
- `respond` short-circuits early because `last.type == "ai" and not tool_calls` → returns state unchanged
- User sees: empty placeholder cards + the planner's chatter masquerading as a summary

**Turn 2 — "Filter to only the cancelled flights"**
- `plan_tools` again emits zero tool calls: *"On it — I'll filter the Recent Disruptions table to cancelled flights only. Would you also like the charts or metrics filtered, or just the table?"*
- Same downstream path → no `state_update` event → table stays as it was (empty)

## Root cause

Three-way mismatch:

1. **Split node, mismatched prompts.** `generate_shell` runs the LLM with `dashboard.md` (which says "call ALL four data tools") but binds NO tools — physically can't call them. `plan_tools` runs next with tools bound but uses a **separate inline prompt** scoped to follow-up turns only (filter / structural / question cases). The post-`generate_shell` situation ("you just emitted a spec, now populate it") matches none of the planner's listed cases, so the LLM falls through to "respond conversationally" (case 3).

2. **Planner over-asks instead of acting.** Even on follow-ups the planner picks "ask a clarifying question" over "commit to a tool call." gpt-5 + `reasoning='minimal'` exposes this prompt-following weakness.

3. **`respond` early-exit hides the bug.** When `plan_tools` returns chatter, `respond`'s `if last.type == "ai" and not tool_calls: return state` short-circuit lets that chatter through unchanged as the final user-visible message. There's never a real summary; the user sees the planner's voice.

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | How to handle the deterministic "call all 4 tools on first turn" requirement | New node `populate_initial_data` that mechanically invokes all 4 tools in a Python loop. No LLM. Synthesizes one AIMessage with 4 `tool_calls` + 4 corresponding ToolMessages. Reuses `emit_state` downstream unchanged. |
| 2 | How to skip `plan_tools` on first turn | `generate_shell` returns `Command(goto="populate_initial_data", update={...})` instead of a plain dict. The new node edges into `emit_state` (mirrors the post-`call_tools` edge). |
| 3 | Follow-up turn behavior | Keep `plan_tools` LLM-routed; tighten its inline prompt to "ACT, do not ASK" — convert case 3 from "respond conversationally, call NO tools" to "answer in prose if and only if no data fetch could possibly answer the question; otherwise call exactly one tool". Add an explicit anti-pattern: "Never ask a clarifying question." |
| 4 | `respond` behavior | Remove the early-exit. `respond` ALWAYS regenerates a brief summary, so first-turn and follow-up both produce a real conversational message authored by `respond` itself (not the planner's chatter). |
| 5 | Sentinel for tool failures | None. If a deterministic tool call raises, let it propagate — these are pure-Python lookups against an in-memory dataset, no external IO. A failure means the dataset is broken and should surface as a 500 from langgraph-dev. |
| 6 | Mirror policy | Apply identical changes to both `cockpit/chat/generative-ui/python/src/graph.py` (per-cap canonical, post-PR #417) AND `cockpit/langgraph/streaming/python/src/dashboard_graph.py` (umbrella mirror — kept in sync per the full-copy policy from PR #396). |

## Architecture (new graph shape)

```
START → router ┬→ generate_shell → populate_initial_data → emit_state → respond → END
               │   (first turn:                 (4 tool calls,
               │    no spec yet)                 no LLM)
               │
               └→ plan_tools ┬→ call_tools → emit_state → respond → END
                   (follow-up: │   (1+ tool calls
                    spec exists)│    from planner)
                               │
                               └→ respond → END
                                   (case: planner committed to plain-prose
                                    answer for a pure interpretive question)
```

Diff from today:
- **New node** `populate_initial_data` between `generate_shell` and `emit_state`
- **Removed edge** `generate_shell → plan_tools` (replaced by `generate_shell → populate_initial_data`)
- **New edge** `populate_initial_data → emit_state`
- **`respond` early-exit removed** — always re-summarizes
- **`plan_tools` prompt tightened** — case 3 narrowed, "never ask clarifying questions" added

## `populate_initial_data` node

```python
import uuid
from langchain_core.messages import AIMessage, ToolMessage

async def populate_initial_data(state: DashboardState) -> dict:
    """Deterministic first-turn data fetch: invoke all 4 data tools.

    The dashboard prompt mandates 'call ALL four data tools to populate the
    dashboard' on first turn. That's a fixed instruction, not a judgment call —
    encode it as Python instead of paying an LLM round-trip + risking the
    planner refusing to commit to tool calls.

    Synthesizes one AIMessage with tool_calls for all 4 tools + one
    ToolMessage per result. This is the same shape ToolNode would produce,
    so `emit_state` (which reads ToolMessages by name) needs no changes.
    """
    tool_calls = [
        {"name": t.name, "args": {}, "id": f"init_{t.name}_{uuid.uuid4().hex[:8]}", "type": "tool_call"}
        for t in ALL_TOOLS
    ]
    ai = AIMessage(content="", tool_calls=tool_calls)

    tool_msgs: list[ToolMessage] = []
    for t, tc in zip(ALL_TOOLS, tool_calls):
        result = await t.ainvoke({})
        # ToolNode serializes results to str(); match that behavior so
        # emit_state's json.loads(...) path works identically.
        content = json.dumps(result) if not isinstance(result, str) else result
        tool_msgs.append(ToolMessage(content=content, tool_call_id=tc["id"], name=t.name))

    return {"messages": [ai] + tool_msgs}
```

Notes:
- All 4 tools take zero required args (`query_airline_kpis()`, `query_on_time_trend(months=12)` default, `query_flights_by_airline()` default, `query_recent_disruptions(limit=5)` default). Empty `{}` is safe.
- `uuid` suffix on `tool_call_id` keeps it unique across re-runs / replays.
- The synthesized AIMessage has empty `content` — that's fine; `emit_state` doesn't read it, and `respond` will emit the real summary.

## `generate_shell` change

Add a Command return so first-turn routing skips `plan_tools`:

```python
from langgraph.types import Command
from typing import Literal

async def generate_shell(state: DashboardState) -> Command[Literal["populate_initial_data"]]:
    """Generate the dashboard shell spec on first turn, then dispatch to
    deterministic data-population (skipping plan_tools, which has a
    follow-up-only prompt)."""
    messages = [SystemMessage(content=_PROMPT)] + state["messages"]
    response = await _llm.ainvoke(messages)
    spec_text = response.content if isinstance(response.content, str) else ""
    return Command(
        goto="populate_initial_data",
        update={"messages": [response], "dashboard_spec": spec_text},
    )
```

## `respond` change

Remove the early-exit. `respond` always re-summarizes:

```python
async def respond(state: DashboardState) -> DashboardState:
    """Generate a brief conversational summary of what just happened on this
    turn. ALWAYS runs — no early-exit — so the user-visible summary is always
    authored by this node, never inherited from plan_tools' chatter."""
    messages = [
        SystemMessage(content=(
            "Provide a brief (1-2 sentence) conversational summary of what "
            "you just did this turn. If you generated a dashboard, say so. "
            "If you filtered data, say what you filtered. "
            "Do NOT output JSON. Do NOT ask follow-up questions."
        ))
    ] + state["messages"]
    response = await _llm.ainvoke(messages)
    return {"messages": [response]}
```

## `plan_tools` prompt tightening

Replace the existing case-3 ("QUESTION about existing data… Call NO tools") with a stricter formulation, and add an explicit anti-pattern:

```python
context = (
    f"The current dashboard spec is:\n{state['dashboard_spec']}\n\n"
    "The user has sent a follow-up. Classify and act ONCE — DO NOT ask\n"
    "clarifying questions. Pick the smallest action that satisfies the\n"
    "request and commit to it.\n"
    "\n"
    "1) FILTER / SCOPE (e.g. 'filter to cancelled flights only', 'last 6\n"
    "   months', 'top 3'): call EXACTLY ONE tool — the one that backs the\n"
    "   affected component — with the new parameters. Do NOT call the\n"
    "   other tools. Do NOT regenerate the spec.\n"
    "\n"
    "2) STRUCTURAL change (e.g. 'add a card for X', 'remove the table'):\n"
    "   regenerate the spec, then call only the tools needed to populate\n"
    "   NEW components.\n"
    "\n"
    "3) INTERPRETIVE question that no tool could answer (e.g. 'why is\n"
    "   on-time % low?', 'what does this mean?'): respond in plain prose,\n"
    "   call NO tools. Use this ONLY when no tool fetch could resolve the\n"
    "   question. If a tool could provide more data to help answer, pick\n"
    "   case 1 or 2 instead.\n"
    "\n"
    "Anti-patterns to avoid:\n"
    "  - Asking 'would you also like…' or any clarifying question.\n"
    "    Commit to the most reasonable interpretation and act.\n"
    "  - Calling all four tools. That is reserved for an explicit\n"
    "    'refresh' / 'reload everything' request.\n"
    "  - Responding conversationally when the request mentions filtering,\n"
    "    sorting, or scoping. Those are case 1, always."
)
```

## Files modified

| File | Change |
|---|---|
| `cockpit/chat/generative-ui/python/src/graph.py` | Add `populate_initial_data`, convert `generate_shell` to Command return, remove `respond` early-exit, tighten `plan_tools` prompt, add `populate_initial_data` to builder + edge to `emit_state`, remove `generate_shell → plan_tools` edge |
| `cockpit/langgraph/streaming/python/src/dashboard_graph.py` | Identical changes (full-copy mirror) |

No frontend changes. No new tools. No schema changes. No prompt-file (`prompts/dashboard.md`) changes — the prompt is already correct; the graph just wasn't honoring it.

## Testing

**Programmatic (curl + langgraph SDK, against per-cap on :5508):**

1. Start per-cap backend: `nx run cockpit-chat-generative-ui-python:serve`
2. POST a first-turn run: "Show me a Q3 sales dashboard"
3. Assert in final thread state:
   - `dashboard_spec` is non-empty
   - 4 ToolMessage entries (one per tool: query_airline_kpis, query_on_time_trend, query_flights_by_airline, query_recent_disruptions)
   - Final AI message is a brief conversational summary (not the spec, not a clarifying question)
4. POST a follow-up: "Filter to only cancelled flights"
5. Assert: at least one new ToolMessage (likely `query_recent_disruptions` with `type='cancelled'`); no clarifying question in the final AI message

**Chrome MCP smoke (against per-cap on :5508 + Angular on :4508):**

1. Navigate to `http://localhost:4508/`
2. Click "Render a dashboard" chip → expect: KPI cards with NUMBERS, line chart with data, bar chart with bars, data table with rows (no "Building UI…" placeholders)
3. Type "Filter to cancelled flights only" → expect: data table updates to cancellations only, no clarifying question
4. Type "Why is on-time % low?" → expect: conversational prose answer, no spec regeneration
5. Screenshot the populated dashboard for the PR description

## Risks and mitigations

- **`emit_state` reads ToolMessages by name and assumes JSON-serializable string content.** `populate_initial_data` matches that format (json.dumps the dict/list results); risk is low. Mitigation: the existing `emit_state` already has `try: data = json.loads(...)` with a continue on failure, so a bad payload silently no-ops rather than crashing.
- **Removing `respond`'s early-exit costs one extra LLM call per turn.** ~$0.001 with gpt-5-mini, ~500ms latency. Acceptable for the gain (real summary instead of planner chatter).
- **Tightened `plan_tools` prompt might over-correct → call a tool for genuinely interpretive questions.** Case 3 is now narrower. Mitigation: explicit examples + the "use ONLY when no tool fetch could resolve" qualifier keep the door open for plain-prose answers.
- **Standalone per-cap and umbrella mirror drift.** Same risk as every per-cap graph since PR #396. Mitigation: both diffs land in the same PR; reviewer can eyeball that they match. (A per-cap drift CI guard is in the backlog but not in this PR's scope.)

## Out-of-scope follow-ups

- Real per-cap drift CI guard (separate backlog item)
- Per-component skeleton states (today the placeholders are uniform "Building UI…"; richer would be type-aware skeletons matching the component shape)
- Cache tool results across structurally-identical re-renders (each turn re-fetches; not a real bottleneck since data is in-memory)
- Replace the prompt's "Q3 sales dashboard" example chip with an aviation-themed prompt (the chip text comes from the Angular component; this PR doesn't touch frontend)
