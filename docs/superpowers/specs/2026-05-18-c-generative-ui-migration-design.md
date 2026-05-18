# c-generative-ui per-cap migration — design

> **Place in the larger plan.** Sub-project 3 of the per-cap migration chain (Tier A batch was sub-project 1, c-interrupts via PR #382 is sub-project 2). Flips `c-generative-ui`'s `pythonDir` in the capability registry to its per-cap standalone backend. Local-dev-only migration — production continues to deploy from the umbrella's `dashboard_graph.py` until the deploy-script extension PR lands (last in the chain).
>
> **Side-note follow-up:** the cockpit chat demos' suggested-prompt chips (the welcome-state starter chips from PR #383) should align with the prompts our aimock e2e specs exercise. Audited in a separate spawned task; not in scope here. This PR's test prompts are chosen so future chip alignment is easy.

## Goal

Switch `c-generative-ui` from consuming the umbrella's `dashboard_graph.py` + `dashboard_tools.py` to its already-built per-cap standalone backend at `cockpit/chat/generative-ui/python/`. Heavier verification than Tier A because the graph is multi-node (router → generate_shell / plan_tools → call_tools → emit_state → respond) and dispatches custom events for progressive structured state.

## Non-goals

- Reconciling the inlined-vs-imported fixture difference between per-cap `dashboard_tools.py` (inlines `KPI_SNAPSHOT` etc.) and umbrella `dashboard_tools.py` (imports from `src.aviation_data`). Per-cap chose inlining intentionally (no `aviation_data.py` exists in the per-cap dir). Data values are byte-identical; that's enough.
- Modifying the per-cap graph or tools logic. They were already built by PR #396 (and refined by PRs #360, #363, #371, #372). This PR just connects them.
- Modifying the umbrella's `dashboard_graph.py` or `dashboard_tools.py`. Those keep serving production until the deploy-script extension.
- Suggested-prompt chip alignment. Tracked in a separate spawned task.

## Architecture (post per-cap)

The c-generative-ui demo runs as a self-contained pair:
- **Backend:** `cockpit/chat/generative-ui/python/` — multi-node LangGraph with router/plan_tools/call_tools/emit_state/respond nodes, ToolNode wrapping 4 KPI query tools, `get_stream_writer`-based state emission. Default dev port: 5508.
- **Frontend:** `cockpit/chat/generative-ui/angular/` — Angular app proxying `/api` → backend. Default dev port: 4508.

Production continues to deploy `c-generative-ui` from the umbrella's `dashboard_graph.py` (registered in `cockpit/langgraph/streaming/python/langgraph.json`).

## What changes

### Single code edit

`apps/cockpit/scripts/capability-registry.ts` — change `pythonDir` on one row:

| Cap id | Before | After |
|---|---|---|
| `c-generative-ui` | `cockpit/langgraph/streaming/python` | `cockpit/chat/generative-ui/python` |

No other rows touched. `pythonPort: 5508` stays — already aligned with the per-cap `proxy.conf.json` target.

### No other files changed

- `cockpit/chat/generative-ui/python/src/graph.py` — exists, 176 lines, multi-node ToolNode+emit_state pattern.
- `cockpit/chat/generative-ui/python/src/dashboard_tools.py` — exists, 117 lines, four `@tool` functions (`query_airline_kpis`, `query_on_time_trend`, `query_flights_by_airline`, `query_recent_disruptions`) with inlined fixtures.
- `cockpit/chat/generative-ui/python/prompts/dashboard.md` — exists.
- `cockpit/chat/generative-ui/python/langgraph.json` — registers exactly `c-generative-ui`.
- `cockpit/chat/generative-ui/angular/proxy.conf.json` — already targets `localhost:5508`.
- `cockpit/chat/generative-ui/angular/src/environments/environment.development.ts` — `/api` + `streamingAssistantId: 'c-generative-ui'`.

## Verification

### Pre-flight drift audits

1. **Per-cap graph.py vs umbrella dashboard_graph.py:** diff. Expect only comment/import minor differences (already observed during brainstorm).
2. **Per-cap dashboard_tools.py vs umbrella dashboard_tools.py:** diff. Expect the inlined-fixtures vs imported-from-aviation_data difference. Confirm the numerical fixture values are identical (manually compare the inlined `KPI_SNAPSHOT`, `ON_TIME_TREND`, `FLIGHTS_BY_AIRLINE`, `RECENT_DISRUPTIONS` in per-cap vs the values in `cockpit/langgraph/streaming/python/src/aviation_data.py`).
3. **Per-cap graph uses `get_stream_writer`:** grep the per-cap `graph.py` for `get_stream_writer`. Required because the chat-generative-ui UI consumes the emitted state. If missing, the migration would produce a working agent that doesn't render structured state. (PR #360 added this fix — the per-cap version must have inherited it.)

### Production deploy is byte-identical

Same as Tier A. `scripts/generate-shared-deployment-config.ts` skips chat caps; c-generative-ui reaches production via the umbrella's manifest. Manifest must be byte-identical before/after.

### Multi-node graph end-to-end via SDK

Single-turn "Hello" doesn't exercise the dashboard pathway. Use two representative prompts in sequence on the same thread:

1. **Turn 1 (shell generation):** `"Show me the airline operations dashboard."` → expect at least one tool call (`query_airline_kpis` typically first) + final assistant text.
2. **Turn 2 (follow-up):** `"What's the on-time trend?"` → expect `query_on_time_trend` tool call + final assistant text.

Both turns must complete `status=success`. Both turns' final assistant text should be non-empty. The tool-call presence proves the planner → ToolNode flow works; the emit_state events are inferred (verified at UI layer in a future e2e, out of scope here).

### Regression

- `nx e2e cockpit-langgraph-streaming-angular` passes (the umbrella's streaming graph is independent of the dashboard cleanup).
- `nx e2e cockpit-chat-tool-calls-angular`, `nx e2e cockpit-chat-subagents-angular` pass (per-cap demos unaffected).
- If a `cockpit-chat-generative-ui-angular` aimock e2e suite exists, run it. (Spot-checked during brainstorm: no `e2e/` dir scaffolded yet for this cap — bonus item if it appears.)

### Reverse audit

- Registry still has `c-interrupts` and `c-a2ui` on `cockpit/langgraph/streaming/python` (the remaining unmigrated caps).
- Umbrella's `dashboard_graph.py` + `dashboard_tools.py` untouched.

## Risk surface

- **Per-cap graph never battle-tested locally.** The scaffolded `graph.py` and `dashboard_tools.py` import clean (verified at brainstorm time) but haven't run an end-to-end turn against a real LLM in the migrated state. Verification via SDK turn exchange catches any wiring bug per-cap.
- **gpt-5 planner availability.** The graph uses `ChatOpenAI(model='gpt-5', reasoning_effort='minimal')` for the planner (per PR #372). If gpt-5 has transient availability issues during verification, both turn-exchange tests could fail spuriously — distinguish from migration issues by re-running.
- **`get_stream_writer` API.** Per-cap graph must use the LangGraph 1.x API (`get_stream_writer`) rather than the deprecated `emit_state`/`dispatch_custom_event` pattern. Verified at pre-flight audit step.
- **Fixture-data drift.** If a future PR updates `cockpit/langgraph/streaming/python/src/aviation_data.py` constants, the per-cap inlined copies won't pick that up automatically. Accepted as part of the "two copies" tech debt until the deploy-script extension makes per-cap the single source of truth.
- **Shared-checkout chaos.** Same as prior PRs in this chain — parallel agents have caused branch drift. Implementer must `git fetch origin && git rebase origin/main` before final push.

## Acceptance criteria

- `apps/cockpit/scripts/capability-registry.ts` shows `c-generative-ui` → `cockpit/chat/generative-ui/python`. No other rows changed.
- Pre-flight diffs: graph.py minor comment/import drift only; dashboard_tools.py fixture values numerically identical (inlined vs imported); per-cap graph uses `get_stream_writer`.
- Per-cap `langgraph dev` boots with exactly 1 graph (`c-generative-ui`), no traceback.
- SDK turn 1 (`"Show me the airline operations dashboard."`): `status=success`, tool-call(s) present, non-empty assistant text.
- SDK turn 2 (`"What's the on-time trend?"`): `status=success`, `query_on_time_trend` tool call present, non-empty assistant text.
- `npx tsx scripts/generate-shared-deployment-config.ts` output: shared-deploy manifest byte-identical before/after.
- Existing cockpit aimock e2es (streaming, tool-calls, subagents) still pass.
- Umbrella's `dashboard_graph.py` + `dashboard_tools.py` untouched (`git diff origin/main -- cockpit/langgraph/streaming/python/` empty for those files).
