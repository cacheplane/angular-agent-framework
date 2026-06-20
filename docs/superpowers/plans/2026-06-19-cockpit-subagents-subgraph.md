# Cockpit chat/subagents → real subgraph — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make `cockpit/chat/subagents` populate `agent.subagents()` (via a real LangGraph subgraph + `subagentToolNames`) so the inline persistent `chat-subagent-card` (#711) renders; assert the card e2e on both cockpit and `examples/chat`.

**Spec:** `docs/superpowers/specs/2026-06-19-cockpit-subagents-subgraph-design.md`. Base: branch `claude/cockpit-subagents-subgraph` off main (post-#711).

**Decisions:** one parameterized subagent subgraph (role drives prompt + tools); remove the redundant sidebar `<chat-subagents>` tray; re-record aimock fixtures with the root `.env` key.

---

## Task 1: Backend — parameterized subagent subgraph
**File:** `cockpit/chat/subagents/python/src/graph.py`

- [ ] **Step 1:** Build one compiled `StateGraph` (`subagent_subgraph`) whose state carries `role`, `task_description`, and `messages`. Its single node resolves the role's system prompt (research/booking/itinerary, existing `_RESEARCH_PROMPT`/`_BOOKING_PROMPT`/`_ITINERARY_PROMPT`) and role tools (research→`[get_airport_info]`, booking→`[find_routes, lookup_flight]`, itinerary→`[]`), binds them, runs the focused LLM loop (≤3 rounds, same as today's `_run_subagent`), and returns `{"messages": [...]}`.
- [ ] **Step 2:** Rewrite the `task` tool to (a) include a `subagent_type: str` arg equal to the role so the SubagentTracker registers each dispatch (mirror `examples/chat`'s `research(topic, subagent_type="research")` pattern — make the orchestrator pass `subagent_type=role`, or set it server-side from `role` and ensure it appears in the tool-call args), and (b) `await subagent_subgraph.ainvoke({"role": role, "task_description": task_description, "messages": []})`, returning the child's final text. Delete `_run_subagent`.
- [ ] **Step 3:** Keep orchestrator / `ToolNode([task])` / `generate_title` wiring unchanged.
- [ ] **Step 4:** Lint/typecheck the python (`uv run ruff check` / the project's check) — clean. (Runtime correctness is validated by the live recording in Task 3.) Commit.

## Task 2: Frontend — subagentToolNames + drop sidebar tray
**Files:** `cockpit/chat/subagents/angular/src/app/app.config.ts`, `cockpit/chat/subagents/angular/src/app/subagents.component.ts`

- [ ] **Step 1:** Add `subagentToolNames: ['task']` to the `provideAgent({...})` call in `app.config.ts`.
- [ ] **Step 2:** In `subagents.component.ts`, remove the `<chat-subagents [agent]>` "Active Subagents" sidebar block (the inline persistent cards supersede it). Keep the layout minimal; remove now-empty sidebar scaffolding or leave the static "Agent Pipeline" note — minimal diff. Drop the unused `ChatSubagentsComponent` import if present.
- [ ] **Step 3:** `npx nx build cockpit-chat-subagents-angular --skip-nx-cache` — green. Commit.

## Task 3: Re-record aimock fixtures (live key)
**Files:** `cockpit/chat/subagents/angular/e2e/fixtures/c-subagents.json` (regenerated)

- [ ] **Step 1:** Run `cockpit/chat/subagents/angular/e2e/scripts/record-c-subagents.sh` with `OPENAI_API_KEY` from `/Users/blove/repos/angular-agent-framework/.env` (source it into the environment for the script). This drives the real graph against aimock `--record` → real OpenAI, capturing the new subgraph call flow.
- [ ] **Step 2:** Confirm the new fixture replays deterministically: run `npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache` against the regenerated fixture (free ports first). It must pass the EXISTING assertions before adding new ones. If replay is non-deterministic (subagent loop count varies), re-record or tighten the graph until stable.
- [ ] **Step 3:** Commit the regenerated fixture.

## Task 4: e2e — assert the persistent card (both demos)
**Files:** `cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts`, `examples/chat/angular/e2e/research-subagent.spec.ts`

- [ ] **Step 1:** In `c-subagents.spec.ts`: assert `await expect(page.locator('chat-subagent-card').first()).toBeVisible({ timeout: 30_000 })` and that it persists after the run settles; keep the final-summary regex. Update the stale "card only renders while RUNNING" comment.
- [ ] **Step 2:** In `examples/chat/angular/e2e/research-subagent.spec.ts`: add a `chat-subagent-card` visibility assertion (its `subagents()` already populates). Keep existing assertions.
- [ ] **Step 3:** Run both: `npx nx e2e cockpit-chat-subagents-angular` and `npx nx e2e examples-chat-angular` (the research-subagent spec) — green. Commit.

## Task 5: Verify + live smoke + PR
- [ ] **Step 1:** `npx nx run-many -t build --projects=cockpit-chat-subagents-angular,examples-chat-angular` — green.
- [ ] **Step 2:** Live smoke `cockpit/chat/subagents` (LangGraph, real key): serve the python backend (uvicorn/langgraph dev with the key) + `nx serve`; drive "Plan a trip from LAX to JFK"; confirm the inline `chat-subagent-card` renders + persists (one per role, named research/booking/itinerary), no duplicates, 0 NG0956. Screenshot. Stop servers + free ports.
- [ ] **Step 3:** Final review; open PR; arm auto-merge + self-healing watcher.

---

## Self-Review
- Coverage: backend subgraph (T1), frontend config + sidebar (T2), fixtures (T3), e2e both demos (T4), verify + smoke + PR (T5). ✓
- Risk: `subagent_type` must reach the tool-call args AND the subgraph must emit `tools:<id>` namespaces — validated by the Task 5 live smoke (the card only renders if `subagents()` populates).
- No `libs/` changes — demo backend + config + e2e only.
