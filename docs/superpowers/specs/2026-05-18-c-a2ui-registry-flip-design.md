# c-a2ui capability-registry flip — design

> **Place in the larger plan.** Sub-project 5 of the per-cap migration chain — the LAST capability migration before the final umbrella cleanup. The per-cap standalone backend at `cockpit/chat/a2ui/python/` already contains the LLM-driven A2UI design (build_form → search_flights → confirm_booking) — both that work and its umbrella counterpart landed via squash-merges from now-deleted parallel branches (`claude/c-a2ui-aviation-spec`, `claude/c-a2ui-confirm-booking-spec`). This spec covers only the registry flip to activate the per-cap backend for local dev.

## Goal

Switch `c-a2ui` from consuming the umbrella's `a2ui_graph.py` to its already-built per-cap standalone backend at `cockpit/chat/a2ui/python/`, by editing one `pythonDir` value in `apps/cockpit/scripts/capability-registry.ts`. After this PR lands, **all 11 c-* caps are on per-cap backends for local dev** — the per-cap migration phase of the chain is complete, leaving only the final umbrella cleanup.

## Non-goals

- Modifying `cockpit/chat/a2ui/python/` contents (already complete; same LLM-driven graph as umbrella with tiny intentional drift around flight-data plumbing).
- Modifying the umbrella's `a2ui_graph.py` (still serves production).
- Landing an aimock spec for c-a2ui (separate sub-project — listening to A2UI custom envelope events is more involved than the other caps' aimock specs).
- Expanding the per-cap's inlined 5-flight subset to match the umbrella's full ~30+ flight dataset (can be revisited if demo UX suffers).
- The final umbrella cleanup (next sub-project).

## What changes

### Single code edit

`apps/cockpit/scripts/capability-registry.ts` — change `pythonDir` on one row:

| Cap id | Before | After |
|---|---|---|
| `c-a2ui` | `cockpit/langgraph/streaming/python` | `cockpit/chat/a2ui/python` |

`pythonPort: 5511` stays — already aligned with the per-cap `proxy.conf.json` target (`http://localhost:5511`).

### No other files changed

Verified during brainstorm:
- `cockpit/chat/a2ui/python/src/graph.py` (673 lines) — multi-node LLM-driven A2UI graph with build_form, search_flights, confirm_booking nodes. Inlines 5-flight fixture subset + `_AsyncFn` shim so the LLM-graph code can call `find_routes(...).ainvoke({...})` without a shared `aviation_data.py`.
- `cockpit/chat/a2ui/python/langgraph.json` — registers exactly `c-a2ui`.
- `cockpit/chat/a2ui/python/prompts/a2ui.md` — present (booking-form prompt).
- `cockpit/chat/a2ui/angular/proxy.conf.json` — already targets `localhost:5511`.

### Drift acknowledgment

The 45-line diff between umbrella `a2ui_graph.py` and per-cap `graph.py` covers only the data plumbing:
- Umbrella: `from src.aviation_tools import find_routes, lookup_flight` (uses shared aviation_data module).
- Per-cap: inlines a 5-flight `_FLIGHTS` list + `_AsyncFn` shim class that lets the LLM-graph code call `.ainvoke({...})` on a plain Python function.

Both versions are functionally equivalent for the demo. The smaller per-cap flight subset is a minor UX consideration, not a blocker.

## Verification

### Production deploy is byte-identical

Same as PRs #413, #417, #421. `scripts/generate-shared-deployment-config.ts` line 54 skips chat caps; c-a2ui reaches production via the umbrella's manifest. The manifest must be byte-identical before/after this PR.

### Per-cap backend imports + boots

- `from src.graph import graph` returns `CompiledStateGraph`.
- `langgraph dev --port 5511` registers exactly `c-a2ui`, no traceback.

### SDK turn exchange

A representative prompt to exercise the build_form path:

- **Turn 1:** `"Help me book a flight."`
- **Expected:** Run reaches a terminal stopping point (success or interrupted — A2UI surfaces may pause for user input). State has at least one assistant message. No tracebacks in the langgraph dev log.

Full surface-emission validation (asserting on `surfaceUpdate` / `dataModelUpdate` / `beginRendering` envelope events) requires listening to `runs.stream()` with custom event types — beyond this PR's scope. The next sub-project's aimock spec (if we add one for c-a2ui) is where that lands.

### Regression

- `nx e2e cockpit-langgraph-streaming-angular` passes.
- `nx e2e cockpit-chat-tool-calls-angular` passes.
- `nx e2e cockpit-chat-subagents-angular` passes.

### Reverse audit

After this PR lands:
- **All 11 c-* caps on per-cap dirs.**
- **Zero c-* caps on the umbrella.**
- Umbrella's `a2ui_graph.py` untouched.

## Risk surface

- **Per-cap backend never battle-tested via local-dev tooling.** Per-cap `graph.py` is byte-near-identical to the umbrella version (which IS exercised in production), so the per-cap should "just work." The SDK turn-exchange step catches any wiring bug.
- **gpt-5 structured-output availability.** If transient OpenAI issues hit during the SDK turn exchange, re-run once before reporting a real migration issue.
- **Inlined 5-flight subset vs umbrella's full dataset.** Acceptable for the demo; flagged for future expansion if needed.
- **A2UI v0.9 envelope format compatibility.** Both umbrella + per-cap are on the latest envelope keys per recent fix commits. Migration preserves whatever's on main today.

## Acceptance criteria

- `apps/cockpit/scripts/capability-registry.ts` shows `c-a2ui` → `cockpit/chat/a2ui/python`. No other rows changed.
- Per-cap import smoke returns `CompiledStateGraph`.
- `langgraph dev` boots with exactly `c-a2ui`, no traceback.
- SDK turn exchange: `"Help me book a flight."` → terminal status (not error/timeout), at least one assistant message in state.
- Shared-deployment manifest byte-identical before/after.
- Existing cockpit aimock e2es (streaming, tool-calls, subagents) still pass.
- Umbrella's `a2ui_graph.py` untouched.
- Reverse audit: 11 c-* caps on per-cap dirs, 0 on umbrella.
