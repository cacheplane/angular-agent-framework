# Cockpit chat/subagents → real subgraph (LangGraph subagent-card parity) — Design

**Status:** Approved direction (2026-06-19). Builds on #711 (inline persistent subagent cards, now on main).

## Why

After #711, the spawning subagent tool call renders as an inline, persistent `chat-subagent-card` whenever `agent.subagents()` is populated. This works on AG-UI (ACTIVITY events) and on `examples/chat` (real LangGraph subgraph). But `cockpit/chat/subagents` uses a **flat inline `task` tool** (`_run_subagent()` runs an LLM loop in-process, no subgraph), so it emits no `tools:<id>` namespace stream events and never configures `subagentToolNames` → `agent.subagents()` stays empty → no card. This is a demo-wiring gap (not an aimock or framework limitation: aimock mocks only the LLM HTTP layer, so a real subgraph's namespace events flow through under replay).

**Goal:** Align `cockpit/chat/subagents` with the `examples/chat` subagent pattern so its `subagents()` populates and the inline card renders; and add the now-possible persistent-card e2e assertion to both demos.

## Reference pattern (examples/chat — already works)
- `examples/chat/python/src/graph.py`: a compiled `research_subgraph = StateGraph(ResearchState)...compile()`, and a `research` tool that does `await research_subgraph.ainvoke({...})` and carries `subagent_type: str = "research"` in its signature (the SubagentTracker keys on `subagent_type` to register, then matches the `tools:<callid>` subgraph namespace to it).
- `examples/chat/.../demo-shell.component.ts`: `provideAgent(..., { subagentToolNames: ['research'] })`.

## Design

### 1. Backend: replace the flat task tool with a real subgraph
`cockpit/chat/subagents/python/src/graph.py`
- Build one **parameterized subagent subgraph** (single compiled `StateGraph`) whose node binds the role-specific tools and runs the focused LLM loop. Input state carries `role`, `task_description`, and resolves the role's system prompt + tools (research → `get_airport_info`; booking → `find_routes`, `lookup_flight`; itinerary → none) — preserving today's three roles and their tools/prompts.
- Rewrite the `task` tool to `await subagent_subgraph.ainvoke({...})` instead of calling `_run_subagent()`. The tool **must carry a `subagent_type` arg equal to the role** (mirror examples/chat's `subagent_type` default-param mechanism, adapted so research/booking/itinerary each register with a distinct label) so the tracker registers the dispatch and the card is named by role. Remove the now-dead `_run_subagent()`.
- Orchestrator/ToolNode/`generate_title` wiring otherwise unchanged.

### 2. Frontend: configure subagentToolNames
`cockpit/chat/subagents/angular/src/app/app.config.ts` — add `subagentToolNames: ['task']` to the `provideAgent({...})` call.

### 3. Frontend: drop the redundant sidebar tray
`cockpit/chat/subagents/angular/src/app/subagents.component.ts` — remove the `<chat-subagents [agent]>` "Active Subagents" sidebar mount (the inline persistent cards now show subagents in conversation; the active-only sidebar tray would double-display and vanish on completion). Keep the rest of the layout (or simplify the now-thin sidebar — the static "Agent Pipeline" list may stay as decoration or be removed; implementer's call, keep the diff minimal).

### 4. Re-record aimock fixtures (the finicky part)
The graph topology change invalidates `cockpit/chat/subagents/angular/e2e/fixtures/c-subagents.json` (the LLM call flow at the HTTP boundary changes). Re-record with the existing script:
`cockpit/chat/subagents/angular/e2e/scripts/record-c-subagents.sh` — needs a real `OPENAI_API_KEY` (sourced from the root `.env` for this work). Verify the new fixture replays deterministically before asserting on it.

### 5. e2e — assert the persistent card on both demos
- `cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts`: assert the inline `chat-subagent-card` is visible and persists after completion (the run settles fast under aimock, but the card now persists collapsed, so presence is stable). Keep the final-summary assertion. Update the stale "card only renders while RUNNING" comment.
- `examples/chat/angular/e2e/research-subagent.spec.ts`: add a `chat-subagent-card` assertion (its `subagents()` already populates; the old spec only asserted the chip because the pre-#711 card was transient).

## Verification
1. `nx build` cockpit-chat-subagents-angular + examples-chat-angular — green.
2. Re-record fixtures; run `nx e2e cockpit-chat-subagents-angular` + `nx e2e examples-chat-angular` (the research-subagent spec) — green, asserting the card.
3. **Live smoke** of `cockpit/chat/subagents` (LangGraph, real key via root `.env`): confirm the inline `chat-subagent-card` renders + persists (one per role, named research/booking/itinerary), no duplicates, 0 NG0956. Screenshot.
4. Final review; PR + auto-merge + watcher.

## Risks
- **`subagent_type` registration:** the tracker requires `subagent_type` in the tool-call args AND a matching `tools:<callid>` subgraph namespace. Both must be present — verify the card actually populates via the live smoke before trusting the e2e.
- **Fixture recording fidelity:** record against the SAME prompts/model the e2e uses; a sub-agent that loops differently will desync. Re-run replay to confirm determinism.
- **No `libs/` changes** — this is demo backend + config + e2e only; zero risk to other examples.

## Self-review
- Closes the LangGraph subagent-card coverage gap end-to-end (cockpit demo renders the card; both demos e2e-assert it).
- Reuses the proven examples/chat subgraph mechanism; no framework changes.
- The one real execution hazard is fixture re-recording (needs the key + determinism check) — called out explicitly.
