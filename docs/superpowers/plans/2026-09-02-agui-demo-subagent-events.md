# AG-UI Demo SUBAGENT_* Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Our two LangGraph-backed AG-UI subagent demos emit the protocol's standard `SUBAGENT_*` + attributed content events instead of the private ACTIVITY convention, with per-token deltas.

**Architecture:** See `docs/superpowers/specs/2026-09-02-agui-demo-subagent-events-design.md`. A `SubagentEmittingAgent` wraps `LangGraphAgent.run` (1:N expansion of the graph's `subagent_activity` CUSTOM events into pydantic `ag_ui.core` events); the graph emits per-token deltas; the SDK pin is bumped. Cockpit first (flat variant, generator-mirrored into `deployments/ag-ui-dev`), then examples (richer fork).

**Tech Stack:** Python 3.12 + uv, `ag-ui-protocol>=0.1.22`, `ag_ui_langgraph 0.0.37`, LangGraph; Playwright + aimock replay.

**Branch:** `blove/agui-demo-subagent-events` (off origin/main; spec + this plan committed on it).

## Reference implementations (copy style, never import across examples)

- Seam + tests: `cockpit/runtimes/microsoft-agent-framework/python/src/subagent_emitter.py`, `tests/test_subagent_emitter.py` (run-wrapper generator; sequence assertions).
- Id derivation: `cockpit/runtimes/aws-strands/python/src/subagent_emitter.py` (`<tid>-sub`, `<tid>-sub-m{n}`).
- Wire-capture doc convention: `cockpit/runtimes/*/python/docs/wire-capture-subagents.md`.

## Expansion contract (exact)

```
started        {subagent_id: tid, name}                 → SubagentStartedEvent(subagent_run_id=f"{tid}-sub", name, parent_tool_call_id=tid)
message_start  {subagent_id, message_id}                → TextMessageStartEvent(message_id, role="assistant", subagent_run_id)
message        {subagent_id, message_id, delta}          → TextMessageContentEvent(message_id, delta, subagent_run_id)
(next message_start / tool_call / finished / error)      → TextMessageEndEvent for any open message first
tool_call      {subagent_id, tool_call_id, name, args}  → ToolCallStartEvent(tool_call_id, tool_call_name=name, subagent_run_id) + ToolCallArgsEvent(json.dumps(args)) + ToolCallEndEvent
tool_result    {subagent_id, tool_call_id, content}     → ToolCallResultEvent(message_id=f"{tool_call_id}-result", tool_call_id, content, subagent_run_id)
finished       {subagent_id}                            → SubagentFinishedEvent(subagent_run_id, outcome=SubagentFinishedSuccessOutcome())
error          {subagent_id, message}                   → SubagentErrorEvent(subagent_run_id, message)
```
Message ids: `f"{tid}-sub-m{n}"` where `n` increments per `message_start` (cockpit emits exactly one message, so `-m1`). The CUSTOM event is consumed, never forwarded. All events are pydantic `ag_ui.core` classes; verify exact field spellings in the installed `ag_ui/core/events.py`.

---

### Task 0 (cockpit): SDK bump + baseline wire capture

**Files:** `cockpit/ag-ui/subagents/python/pyproject.toml`, `uv.lock`; create `cockpit/ag-ui/subagents/python/docs/wire-capture-subagents.md`.

- [ ] Add `"ag-ui-protocol>=0.1.22",` to `[project].dependencies`; `uv lock && uv sync`; verify: `uv run python -c "from ag_ui.core import SubagentStartedEvent, TextMessageContentEvent; print(TextMessageContentEvent.model_fields['subagent_run_id'])"`.
- [ ] Baseline capture: export the key silently (`export OPENAI_API_KEY=$(grep '^OPENAI_API_KEY=' /Users/blove/repos/angular-agent-framework/.env | cut -d= -f2-)`), `uv run uvicorn src.server:app --port <this cap's python port from apps/cockpit/scripts/capability-registry.ts>`, POST the demo's delegation prompt (read `angular/e2e/subagents.spec.ts` for the prompt + `angular/e2e/fixtures/subagents.json`), tee the SSE. Record: today's ACTIVITY_SNAPSHOT/DELTA sequence and the position of `TOOL_CALL_START` for `task` relative to the first ACTIVITY event (the ordering datum for the design's §6).
- [ ] Serializer probe: temporarily emit one `SubagentStartedEvent` from a scratch `_dispatch_event` override (uncommitted) and confirm it appears on the wire with `subagentRunId` camelCased; revert.
- [ ] Write the doc (baseline section + probe result + ordering finding). Commit: `docs(cockpit): ag-ui subagents baseline wire capture; ag-ui-protocol >=0.1.22` + trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (pyproject/uv.lock in the same commit).

### Task 1 (cockpit): graph payloads emit deltas

**Files:** `cockpit/ag-ui/subagents/python/src/graph.py` (`_emit` closure ~:165-171, phases at ~:182/:184), `src/streaming/subagent_stream_handler.py`, `tests/test_subagent_stream_handler.py`.

- [ ] Failing test first: rewrite `test_emits_accumulated_text_so_far` into `test_emits_per_token_deltas` — feed tokens "Paris ", "is" and assert two `subagent_activity` payloads `{"phase":"message","message_id": "<tid>-sub-m1","delta":"Paris "}` then `delta:"is"` (no accumulation) — plus a `message_start` payload emitted once before the first delta. Run `uv run pytest -q tests/test_subagent_stream_handler.py` → FAIL.
- [ ] Implement: handler emits `message_start` on first token and `message` with `delta=token`; drop `_buffer`. Graph: `started` payload carries `name`; `finished` unchanged; add `error` emission in the tool body's except path (re-raise after).
- [ ] Green → commit: `feat(cockpit): ag-ui subagents graph emits per-token subagent deltas` + trailer.

### Task 2 (cockpit): SubagentEmittingAgent replaces the ACTIVITY translator

**Files:** create `src/streaming/subagent_emitting_agent.py`; delete `src/streaming/activity_transform.py`, `activity_emitting_agent.py`, `tests/test_activity_transform.py`; modify `src/server.py` (mount the new class); create `tests/test_subagent_emitting_agent.py`.

- [ ] Failing tests (MAF style): feed a scripted inner `run()` generator (RUN_STARTED, TOOL_CALL_START for `task` with id `call_1`, CUSTOM `subagent_activity` started/message_start/message×2/finished, TOOL_CALL_RESULT, RUN_FINISHED) and assert the exact output sequence field-for-field per the contract table; the CUSTOM events are absent from the output; unrelated CUSTOM events pass through untouched; `error` phase → SubagentErrorEvent and any open message is closed first; two sequential delegations in one run get distinct run ids.
- [ ] Implement `SubagentEmittingAgent(LangGraphAgent)`: override `run` as an async generator wrapping `super().run(...)`; per-run `_Delegation` state keyed by tid (open message id, message counter); `expand(event)` per the contract; unknown phases → drop with a `logging.warning`. Mount in `server.py` exactly where `ActivityEmittingAgent` was.
- [ ] `uv run pytest -q` green → commit: `feat(cockpit): ag-ui subagents emits standard SUBAGENT_* events via a run-wrapping emitter` + trailer.

### Task 3 (cockpit): regen, e2e, live verification, guide

- [ ] `npx tsx scripts/generate-ag-ui-deployment-config.ts` → commit `chore(deployments): regenerate ag-ui-dev with the subagents SUBAGENT_* emitter` + trailer.
- [ ] Update `angular/e2e/subagents.spec.ts` comments (:24-25, :56-57) that name the ACTIVITY pipeline; assertions stay. Free the cap's ports; run `npx playwright test --config cockpit/ag-ui/subagents/angular/e2e/playwright.config.ts` → green.
- [ ] Live browser check (real key + `nx serve` the cap): card streams token by token; screenshot to `angular/e2e/manual/subagent-card-live.png`; append "## After the emitter" + "## Browser verification" to the wire-capture doc, with the measured `TOOL_CALL_START` vs `SUBAGENT_STARTED` order.
- [ ] Rewrite `cockpit/ag-ui/subagents/python/docs/guide.md` (:13, :79, :87, :98) to describe the standard events + `SubagentEmittingAgent`; regenerate ag-ui-dev again if guide.md is mirrored. Commit: `docs(cockpit): ag-ui subagents guide + live verification` + trailer.
- [ ] Open PR 1: `feat(cockpit): ag-ui subagents demo emits the protocol's SUBAGENT_* events`. Two-stage review; arm auto-merge after.

### Task 4 (examples): same migration on the richer fork

**Files:** `examples/ag-ui/python/{pyproject.toml,uv.lock}`, `src/graph.py` (phases at ~:359-360, :387-389, :411-416, :458-474), `src/streaming/*` (replace transform/emitting agent; adapt handler + `SubagentRunState`), `tests/test_activity_transform.py` (delete), `tests/test_subagent_stream_handler.py`, `tests/test_subagent_emission.py` (rewrite to the standard sequence), `src/server.py`; create `examples/ag-ui/python/docs/wire-capture-subagents.md`.

- [ ] `uv sync` first (no .venv exists); SDK bump identical to Task 0; baseline capture with the examples delegation prompt (`examples/ag-ui/angular/e2e/subagent-card.spec.ts`).
- [ ] Graph: `message_start` → carries `message_id=f"{tid}-sub-m{n}"` from the run state's message counter; `message` → delta; `tool_call`/`tool_result` payloads carry `tool_call_id`/`name`/`args`/`content` per the contract; `SubagentRunState` keeps only the message counter.
- [ ] `SubagentEmittingAgent` as in Task 2 (copy the file — standalone rule), plus the tool_call/tool_result branches; tests assert the multi-message + tool-call ordering `message_start(m1) → tool_call → tool_result → message_start(m2) → …` from `test_subagent_emission.py`'s fake-model run, now as standard events.
- [ ] `uv run pytest -q` green; `npx playwright test --config examples/ag-ui/angular/e2e/playwright.config.ts -g subagent` green (whole config if fast); live browser check + wire-capture doc sections.
- [ ] Commits: `feat(examples): ag-ui demo emits per-token subagent deltas`, `feat(examples): ag-ui demo emits standard SUBAGENT_* events`, `docs(examples): ag-ui subagent wire capture + live verification` (+ trailers). Open PR 2.

### Task 5: docs

- [ ] `apps/website/content/blog/2026-08-27-langgraph-subgraphs-when-to-split.mdx` :185 and :212 — replace "emits `subagent_activity` CUSTOM events" phrasing with the standard-events description (no contractions, one sentence per line); check `choosing-an-adapter/index.mdx` for any surviving "convention our own demo backend adopts" sentence. `npx nx test website` green. Fold into PR 2 or open PR 3 `docs(website): subagent demos emit the protocol's SUBAGENT_* events`.
