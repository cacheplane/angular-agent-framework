# c-generative-ui Agentic-Loop Rewrite — Design (v2, canonical-pattern)

**Date:** 2026-05-18 (v2 revision)
**Status:** Spec — pending implementation plan
**Supersedes:** the v1 design that used `Command`-from-tool to bypass the message stream. v2 reuses the established `emit_generated_surface` pattern from `examples/chat/python/src/graph.py`.

## Goal

Replace the c-generative-ui 6-node split graph with a single agentic loop where the LLM authors the dashboard spec via a `render_spec` tool AND chooses the data tools to populate it — in one coherent reasoning step. Match the canonical surface-delivery protocol used by the rest of the codebase (the chat-lib's content-classifier reads `AIMessage.content`; the spec must arrive there).

This delivers on the "generative UI" claim that PR #428's `populate_initial_data` fudge sidestepped.

## Why a v2

v1 proposed a `render_spec(spec)` tool that returned `Command(update={"dashboard_spec": ..., "messages": [ToolMessage("Spec accepted.")]})` — bypassing the message stream entirely. Implementation revealed the consequence:

- The frontend's `content-classifier` (`libs/chat/src/lib/streaming/content-classifier.ts`) inspects `AIMessage.content` only — never `tool_calls`, never custom state fields. It classifies on the first non-whitespace character: `{` → `'json-render'` → renders via `<chat-generative-ui>`.
- v1's `render_spec` wrote the spec to `state.dashboard_spec` and left the AI message content empty. The frontend saw "empty content + tool_calls" → classified as `'markdown'` → rendered nothing.
- Chrome MCP confirmed: tool-call cards appeared in the chat, but ZERO rendered KPI cards / charts / table.

The proposed "agent node mutates AIMessage to inject spec into content" was a backend patch around an invariant we shouldn't violate in the first place. **The frontend's source of truth for surfaces is `AIMessage.content`** — every other surface in the codebase respects this (a2ui, json-render). The clean fix is to make c-generative-ui respect it too.

`examples/chat/python/src/graph.py` already implements this protocol. v2 mirrors that pattern.

## Background — the canonical pattern (`examples/chat`)

```
generate → tools → after_tools ─┬→ emit_generated_surface → END
                                └→ generate (loop on non-GenUI tools)
```

- **GenUI tools** (`render_a2ui_surface`, `generate_json_render_spec`) return spec/envelope JSON as `ToolMessage.content` (plain string).
- **`after_tools`** conditional edge: if the most recent ToolMessage came from a GenUI tool, route to `emit_generated_surface`; otherwise loop back to `generate`.
- **`emit_generated_surface`** is a post-process node that:
  1. Reads the ToolMessage payload
  2. Wraps it with the content-classifier sentinel (`---a2ui_JSON---\n…` for a2ui; raw JSON for json-render)
  3. Replaces the AI tool-call message in place (LangGraph's `add_messages` reducer matches by `id` and overwrites) with content = wrapped payload, tool_calls preserved
  4. Replaces the ToolMessage in place with stub content `"rendered"` (collapses the tool-call card chrome from a multi-KB schema dump to one word)
- **Frontend `genuiToolNames`** (default in `libs/chat/src/lib/compositions/chat/chat.component.ts:318`) excludes these tool names from `<chat-tool-calls>` so the tool-call card doesn't duplicate the spec rendering.

c-generative-ui v2 follows this exactly, with ONE adaptation to support the agentic loop (next section).

## The one adaptation

`examples/chat`'s `emit_generated_surface` is **terminal** — after wrap, the graph goes to END. One GenUI dispatch per turn.

c-generative-ui needs `render_spec` AND data tools in the same turn. So the wrap step must **continue the loop** instead of ending it: after wrapping, route back to `agent` so any pending non-GenUI tool calls' results (already in state) can be reasoned over and the loop can resolve to "no more tool calls" → exit to `emit_state` → `respond` → END.

Concrete shape: `agent → tools → wrap_spec_into_ai → agent ↔ tools (no render_spec) → emit_state → respond → END`. The `wrap_spec_into_ai` node is idempotent — if the parent AI message's content is already non-empty (already wrapped on a prior iteration), do nothing.

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | `render_spec` tool signature | `render_spec(spec: dict) -> str` returning `json.dumps(spec)` as the ToolMessage content. NO `Command`, no state-field write. Matches the canonical pattern. |
| 2 | Where the spec lives in state | In `AIMessage.content` after `wrap_spec_into_ai` runs. The `dashboard_spec` field on `DashboardState` is **removed**; spec is reachable by walking message history if any consumer needs it. |
| 3 | Graph shape | `START → agent ↔ tools → wrap_spec_into_ai → agent (loop while tool_calls; up to N iterations) → emit_state → respond → END`. `wrap_spec_into_ai` runs ALWAYS after tools (idempotent no-op if no render_spec ToolMessage to process), simplifying the conditional. |
| 4 | Iteration cap | `_MAX_TOOL_ITERATIONS = 6` (down from v1's 8). 1 round for render_spec + data tools, plus 5 retries — more than enough; tightens the loop. |
| 5 | Model | gpt-5 with `reasoning_effort='minimal'` for the agent (matches today's planner). gpt-5-mini stays on `respond`. |
| 6 | `emit_state` behavior | Unchanged from PR #428 (walks back to break on `human`, fires `state_update` events for data tool results). Encounters render_spec ToolMessages whose content is `"rendered"` (post-wrap stub) and ignores them (no matching `if msg.name == "..."` branch). |
| 7 | `respond` behavior | Unchanged from PR #428 (always re-summarizes, "do not ask follow-up questions" instruction). |
| 8 | Frontend coupling | Add `'render_spec'` to the default `genuiToolNames` list in `libs/chat/src/lib/compositions/chat/chat.component.ts:318` (currently `['generate_a2ui_schema', 'generate_json_render_spec']`). One-line lib change; benefits any future graph using the same tool name. No cockpit consumer change needed. |
| 9 | Mirror policy | Apply identical Python changes to per-cap (`cockpit/chat/generative-ui/python/src/graph.py`) AND umbrella (`cockpit/langgraph/streaming/python/src/dashboard_graph.py`). Same for the prompt file. |
| 10 | Tool-choice | `tool_choice='auto'` (default; no override). Lets the agent return a pure-prose response on interpretive case-3 questions. |

## Architecture

```
START → agent ──→ should_continue ──┬→ tools → wrap_spec_into_ai → agent  (loop)
                                    └→ emit_state → respond → END
```

Comparison to today (post PR #428):

| Node | Today (PR #428) | v2 (this design) |
|---|---|---|
| `router` | First-turn vs follow-up dispatch | **Removed** — agent prompt handles both cases |
| `generate_shell` | LLM call, no tools bound, emits spec as AIMessage.content | **Removed** — folded into `agent` |
| `populate_initial_data` | Hardcoded loop calling all 4 tools | **Removed** — agent chooses tools |
| `plan_tools` | LLM call, tools bound, follow-up-only prompt | **Removed** — folded into `agent` |
| `agent` | — | **New** — single LLM call, 5 tools bound (`render_spec` + 4 data) |
| `tools` | ToolNode for 4 data tools | Same `ToolNode` but for 5 tools (includes `render_spec`) |
| `wrap_spec_into_ai` | — | **New** — post-process that wraps the render_spec ToolMessage into AI.content |
| `emit_state` | Walks reversed messages, fires state_update | Same, with one fix: break on `human` (not `ai`) since the loop produces multiple AI messages per turn |
| `respond` | Re-summarizes, no early-exit | Same |

## `render_spec` tool

```python
@tool
async def render_spec(spec: dict) -> str:
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
        The spec serialized as JSON. A post-process node wraps this
        payload into the AI message content where the frontend's
        content-classifier picks it up.
    """
    return json.dumps(spec)
```

No `Command`, no `InjectedToolCallId`, no state-field mutation. Just returns a string.

## `wrap_spec_into_ai` node

```python
async def wrap_spec_into_ai(state: DashboardState) -> dict:
    """Post-process that wraps the most recent render_spec ToolMessage
    payload into the parent AI tool-call message's content (in place via
    LangGraph's add_messages reducer matching by id), where the chat-lib's
    content-classifier picks it up and renders <chat-generative-ui>.

    Idempotent: if the parent AI message already has non-empty content
    (already wrapped on a prior iteration), no-op. Also no-op if no
    render_spec ToolMessage is found at all.

    Mirrors examples/chat/python/src/graph.py's emit_generated_surface,
    but loops back to `agent` instead of going to END so the agent can
    still call data tools in the same turn.
    """
    msgs = state["messages"]

    # Find the most recent render_spec ToolMessage + its originating AI message
    render_tool_msg = None
    parent_ai = None
    for m in reversed(msgs):
        if isinstance(m, ToolMessage) and m.name == "render_spec":
            render_tool_msg = m
            for prior in reversed(msgs):
                if isinstance(prior, AIMessage) and prior.tool_calls:
                    if any(tc.get("id") == render_tool_msg.tool_call_id for tc in prior.tool_calls):
                        parent_ai = prior
                        break
            break

    if render_tool_msg is None or parent_ai is None:
        return {}

    # Idempotency: if the parent AI message already has non-empty content,
    # the wrap has already happened this turn — no-op.
    existing = parent_ai.content
    if isinstance(existing, str) and existing.strip():
        return {}

    payload = render_tool_msg.content if isinstance(render_tool_msg.content, str) else ""
    if not payload:
        return {}

    # Strip optional markdown fencing (gpt-5 sometimes wraps its JSON
    # output in ```json blocks despite the prompt instructions).
    stripped = payload.strip()
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        stripped = "\n".join(line for line in lines if not line.startswith("```")).strip()

    # In-place replacements via add_messages id-match reducer.
    out = []

    # Replace the ToolMessage with a tiny "rendered" stub so the
    # chat-tool-calls UI (if it ever showed render_spec — it shouldn't,
    # given genuiToolNames excludes it) doesn't display the multi-KB
    # schema JSON.
    placeholder_kwargs = {
        "content": "rendered",
        "tool_call_id": render_tool_msg.tool_call_id,
        "name": "render_spec",
    }
    if getattr(render_tool_msg, "id", None):
        placeholder_kwargs["id"] = render_tool_msg.id
    out.append(ToolMessage(**placeholder_kwargs))

    # Replace the parent AI message with the same id + same tool_calls,
    # but content swapped to the spec JSON. The chat-lib content-classifier
    # sees content starting with `{` and routes to <chat-generative-ui>.
    replacement_kwargs = {
        "content": stripped,
        "tool_calls": parent_ai.tool_calls,
        "additional_kwargs": parent_ai.additional_kwargs or {},
        "response_metadata": parent_ai.response_metadata or {},
    }
    if getattr(parent_ai, "id", None):
        replacement_kwargs["id"] = parent_ai.id
    out.append(AIMessage(**replacement_kwargs))

    return {"messages": out}
```

## `agent` node

```python
async def agent(state: DashboardState) -> dict:
    """Single agentic node: LLM bound with all 5 tools (render_spec + 4
    data tools), driven by dashboard.md. Loops via the `tools` node +
    `wrap_spec_into_ai` post-process + `should_continue` until the LLM
    returns no tool_calls or the iteration cap is hit."""
    messages = [SystemMessage(content=_PROMPT)] + state["messages"]
    response = await _llm_with_tools.ainvoke(messages)
    return {"messages": [response]}


_llm_with_tools = ChatOpenAI(
    model="gpt-5",
    temperature=0,
    streaming=True,
    reasoning_effort="minimal",
).bind_tools([render_spec, *_DATA_TOOLS])
```

## `should_continue` with iteration cap

```python
_MAX_TOOL_ITERATIONS = 6


def should_continue(state: DashboardState) -> Literal["tools", "emit_state"]:
    """Loop while the agent emits tool_calls, up to _MAX_TOOL_ITERATIONS
    this turn. After the cap, force exit to emit_state — partial dashboard
    is better than an infinite loop."""
    last = state["messages"][-1]
    if not (hasattr(last, "tool_calls") and last.tool_calls):
        return "emit_state"

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

## System prompt (`prompts/dashboard.md`) — workflow rewrite

Replace the existing "First message" / "Follow-up messages" section with:

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

1. Call `render_spec` ONCE with a complete dashboard layout — stat cards, charts, table — using `$state` bindings to the slots the data tools populate (see "State Path Conventions" below).
2. In the SAME turn (same tool_calls array), call EACH data tool that backs a component in your spec. Do NOT call tools whose data your spec doesn't reference.
3. After the tools return, return WITHOUT any further tool calls. A separate node will write a brief conversational summary.

### When the dashboard exists (follow-up turn)

Categorize the user's request and act ONCE. DO NOT ask clarifying questions — pick the most reasonable interpretation and act.

- **Filter / scope** (e.g. "filter to cancelled flights only", "last 6 months", "top 3"): call EXACTLY ONE data tool — the one that backs the affected component — with the new parameters. Do NOT call `render_spec`.
- **Structural change** (e.g. "add a card for X", "remove the table"): call `render_spec` with the modified layout, then call data tools only for the NEW components.
- **Interpretive question** that no tool could resolve (e.g. "why is on-time % low?"): respond in plain prose with no tool calls.

```

The schema sections that follow (`## JSON Render Spec Format`, `### Props with State Bindings`, `## Available Component Types`, `## State Path Conventions`, `## Example Spec`) are preserved verbatim — they're already correct.

## Frontend change

`libs/chat/src/lib/compositions/chat/chat.component.ts:318` — extend the default `genuiToolNames` list:

```typescript
readonly genuiToolNames = input<readonly string[]>([
  'generate_a2ui_schema',
  'generate_json_render_spec',
  'render_spec',  // c-generative-ui agentic-loop dashboard tool
]);
```

This is a one-line addition. Any chat composition consumer that uses the default (e.g. cockpit/chat/generative-ui/angular) will automatically exclude `render_spec` tool calls from the `<chat-tool-calls>` UI, so the tool-call card chrome doesn't duplicate the rendered dashboard.

## Files modified

| File | Change |
|---|---|
| `cockpit/chat/generative-ui/python/src/graph.py` | Rewrite to agentic-loop with `render_spec` returning JSON string + `wrap_spec_into_ai` post-process |
| `cockpit/langgraph/streaming/python/src/dashboard_graph.py` | Identical rewrite (full-copy mirror) |
| `cockpit/chat/generative-ui/python/prompts/dashboard.md` | Workflow section rewrite; schema sections preserved |
| `cockpit/langgraph/streaming/python/prompts/dashboard.md` | Identical prompt mirror |
| `libs/chat/src/lib/compositions/chat/chat.component.ts` | Add `'render_spec'` to default `genuiToolNames` list (1 line) |

No `dashboard_tools.py` changes. No other frontend changes. No `pyproject.toml` changes.

## Testing

**Programmatic (real LLM, per-cap on :5508):**

1. Turn 1 — "Show me a dashboard of airline operations":
   - Assert: `render_spec` ToolMessage exists with content starting `{`
   - Assert: ≥1 data tool ToolMessage exists
   - Assert: After `wrap_spec_into_ai` runs, the AI message containing the render_spec tool_call has `content` starting `{` (the spec JSON) — NOT empty
   - Assert: Final AI message (from `respond`) is conversational prose, doesn't start with `{`
2. Turn 2 — "Filter to only cancelled flights":
   - Assert: ≥1 new data tool ToolMessage (likely `query_recent_disruptions`)
   - Assert: NO new `render_spec` ToolMessage (no structural change)
3. Turn 3 — "Why might on-time % be lower than industry average?":
   - Assert: 0 new tool calls; final message is prose

**Chrome MCP smoke (in isolated worktree, per-cap on :5508):**

1. Navigate to `http://localhost:4508/`
2. Type "Show me a dashboard of airline operations." (NOT the chip — chip text is "Q3 sales", a separate frontend bug). Wait ~30s.
3. Expect: populated KPI cards (numbers, not "Building UI…"), line chart, bar chart, data table — rendered via `<chat-generative-ui>` driven by the wrapped AIMessage content
4. Expect: `<chat-tool-calls>` shows the 4 data tool cards (`query_*`) but NOT a `render_spec` card (excluded by `genuiToolNames`)
5. Type "Filter to only cancelled flights" → expect data table updates
6. Screenshot for PR description

## Risks and mitigations

- **Loop runaway.** Mitigated by `_MAX_TOOL_ITERATIONS = 6`.
- **`wrap_spec_into_ai` runs but no render_spec was called this turn.** No-op (early return).
- **`wrap_spec_into_ai` runs multiple times in a turn (because it's after every `tools` invocation).** Idempotent: if parent AI's content is already non-empty, no-op.
- **Markdown fencing on the spec JSON.** Stripped before wrap.
- **Frontend cache: existing browser sessions may have stale `genuiToolNames`.** Hard refresh covers it; not a production concern (new build = new bundle).
- **The order of tool_calls within ONE AI message determines order of ToolMessages.** That's fine — `wrap_spec_into_ai` walks back from the end and finds the most recent render_spec ToolMessage regardless of position.
- **Standalone per-cap vs umbrella mirror drift.** Same risk as every per-cap graph; mitigated by landing both diffs in the same PR.

## What this design intentionally does NOT do

- It does NOT touch `examples/chat`'s `emit_generated_surface` to abstract a shared helper. The two patterns are similar but not identical (terminal vs loop continuation, single tool vs render_spec+data tools). Premature abstraction would couple two independent graphs.
- It does NOT change the cockpit consumer (`cockpit/chat/generative-ui/angular/src/app/generative-ui.component.ts`). The default `genuiToolNames` update in chat-lib covers it.
- It does NOT fix the chip text ("Q3 sales dashboard" vs aviation theme). Documented as out-of-scope follow-up; pure frontend change.

## Out-of-scope follow-ups

- Aviation-themed welcome chip text in `cockpit/chat/generative-ui/angular/src/app/generative-ui.component.ts` (replace "Show me a Q3 sales dashboard with three metrics." with "Show me a dashboard of airline operations.")
- Extract a `make_genui_wrap_node(tool_name)` helper if a third c-* graph needs the same pattern
- Per-cap drift guard CI check
- Cache spec across structurally-identical turns
- Stream `state_update` events DURING the loop (today they fire after the loop in `emit_state`)
