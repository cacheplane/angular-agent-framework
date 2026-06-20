# Inline, Persistent Subagent Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** Render each subagent once, anchored to its spawning `task` tool call, persisting in the transcript (running = expanded/live, done = collapsed summary) — replacing the generic tool chip. Fixes the duplicate-card framework bug + the transient-card weakness, transport-agnostically.

**Architecture:** A subagent's spawning tool call already lands in the assistant message that emitted it (`resolveMessageToolCalls`). Make `chat-tool-calls` render a `chat-subagent-card` (instead of a generic chip) for any tool call whose `id` is a key in `agent.subagents()`, ungrouped. Then remove the per-message `<chat-subagents>` mount from the `<chat>` composition (the source of duplication). `chat-trace` already auto-expands `running`/`error` and collapses `done`/`pending`, so persistence + collapse-on-done come for free.

**Tech Stack:** Angular 21 (signals, `@if`/`@for`, OnPush), vitest, Nx. Spec: `docs/superpowers/specs/2026-06-19-subagent-card-inline-persistent-design.md`.

---

## Task 1: `chat-tool-calls` renders subagent cards in place of chips

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts`
- Test: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.spec.ts`

- [ ] **Step 1: Write the failing test.** Follow the existing spec's `setSignalInput` SIGNAL-symbol pattern and the existing fake-agent shape in this file. Build an agent whose `toolCalls()` returns `[{id:'call_t', name:'task', args:{}, status:'success'}, {id:'call_s', name:'search', args:{}, status:'success'}]`, whose `subagents()` returns a `Map` with one entry keyed `'call_t'` → a `Subagent` (`{toolCallId:'call_t', name:'research', status: signal('running'), messages: signal([{id:'m1', role:'assistant', content:'hello from research'}]), state: signal({})}`), and a message linking both ids via `toolCallIds: ['call_t','call_s']`. Assert: exactly one `chat-subagent-card` renders, it contains "research"; the `search` call still renders a `chat-tool-call-card`; and the `task` call does NOT render a generic `chat-tool-call-card`. Add a second test: two `task` subagent calls (`call_t1`, `call_t2`, both in `subagents()`) render TWO separate `chat-subagent-card`s (not one grouped strip).

- [ ] **Step 2: Run it, verify it fails.** `npx nx test chat --skip-nx-cache -- chat-tool-calls` → FAIL (no `chat-subagent-card` rendered).

- [ ] **Step 3: Implement.** In `chat-tool-calls.component.ts`:
  - Import `ChatSubagentCardComponent` from `../../compositions/chat-subagent-card/chat-subagent-card.component` and add to `imports`. Import `Subagent` type from `../../agent`/`../../agent/subagent`.
  - Add `subagent?: Subagent` to the `Group` interface.
  - In the `groups` computed, read `const subs = this.agent().subagents?.() ?? new Map<string, Subagent>();` (read inside the computed for reactivity). When iterating `calls`, if `subs.has(tc.id)`, push a **standalone** group `{ name: tc.name, calls: [tc], subagent: subs.get(tc.id) }` and never append to/from it (a subagent call neither groups with a previous call nor accepts a following call — treat it like a grouping break). Otherwise keep the existing group/append logic.
  - In the template, add a FIRST branch inside the `@for (group of groups())`:
    ```html
    @if (group.subagent) {
      <chat-subagent-card [subagent]="group.subagent" />
    } @else if (group.calls.length > 1 && !group.templateRef) {
      ... existing grouped strip ...
    } @else if (group.templateRef) { ... } @else { ... }
    ```
  - Keep `track $index` on the outer `@for` (already primitive).

- [ ] **Step 4: Run tests.** `npx nx test chat --skip-nx-cache -- chat-tool-calls` → PASS (new + existing).

- [ ] **Step 5: Commit.**
```bash
git add libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.spec.ts
git commit -m "feat(chat): chat-tool-calls renders subagent cards inline (anchored to spawning task call)"
```

---

## Task 2: Remove the duplicate `<chat-subagents>` mount from the composition

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Test: `libs/chat/src/lib/compositions/chat/chat.component.spec.ts` (or the nearest existing composition spec)

- [ ] **Step 1: Write the failing test.** Add a composition-level test (mirror existing composition spec setup) that mounts `<chat [agent]="agent">` with an agent whose `messages()` has TWO assistant messages, only the FIRST of which has `toolCallIds: ['call_t']`, and `subagents()` containing `call_t` (status `running`). Assert the DOM contains exactly ONE `chat-subagent-card` (today it renders twice — once per assistant message — because of the line-221 mount). If a full composition mount is too heavy in this suite, instead assert structurally that the `ai` template no longer contains a standalone `<chat-subagents>` element by rendering and querying — but prefer the behavioral one-card assertion.

- [ ] **Step 2: Run it, verify it fails.** `npx nx test chat --skip-nx-cache -- chat.component` → FAIL (two cards).

- [ ] **Step 3: Implement.** In `chat.component.ts`: delete the `<chat-subagents [agent]="agent()" />` line (≈221) in the `ai` message template. Remove the now-unused `ChatSubagentsComponent` import from this file's `imports` array and import statement. Do NOT remove the lib's public-API export of `ChatSubagentsComponent`.

- [ ] **Step 4: Run tests.** `npx nx test chat --skip-nx-cache -- chat.component` → PASS (one card). Then `npx nx run-many -t test lint build --projects=chat --skip-nx-cache` → green.

- [ ] **Step 5: Commit.**
```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts libs/chat/src/lib/compositions/chat/chat.component.spec.ts
git commit -m "fix(chat): render subagent cards once via tool-calls; drop duplicate per-message mount"
```

---

## Task 3: Collapsed summary shows message count (small polish)

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts`
- Test: `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.spec.ts`

**Context:** `chat-trace` hides default `<ng-content />` when collapsed but always shows `[traceMeta]`. The card's `N message(s)` count is currently in the hidden content. Move it to `[traceMeta]` so a collapsed (done) card still shows `research ✓ · N message(s)`.

- [ ] **Step 1: Write the failing test.** With a `Subagent` whose `status` is `complete` and two messages, mount the card and assert the host (collapsed) still shows text matching `/2 message/`. (Today it's hidden when collapsed.)

- [ ] **Step 2: Run it, verify it fails.** `npx nx test chat --skip-nx-cache -- chat-subagent-card` → FAIL.

- [ ] **Step 3: Implement.** In the card template, move the `<div class="sac__count">{{ subagent().messages().length }} message(s)</div>` to be projected into the trace meta slot: add `ngProjectAs="[traceMeta]"` (or wrap as `<span traceMeta>`), matching how `chat-trace` selects `[traceMeta]`. Keep styling via `.sac__count`.

- [ ] **Step 4: Run tests.** `npx nx test chat --skip-nx-cache -- chat-subagent-card` → PASS.

- [ ] **Step 5: Commit.**
```bash
git add libs/chat/src/lib/compositions/chat-subagent-card
git commit -m "feat(chat): show subagent message count in collapsed card summary"
```

---

## Task 4: Reconcile subagent e2e (chip → card + persistence)

**Files:**
- Modify: `cockpit/ag-ui/subagents/angular/e2e/subagents.spec.ts`
- Modify: `cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts`
- Check (no change expected): `examples/chat/angular/e2e/*.spec.ts`, any `cockpit/langgraph` subagent e2e

- [ ] **Step 1: Re-scan.** `grep -rn "called task\|/task/i\|chat-subagent" cockpit/*/subagents/angular/e2e examples/chat/angular/e2e` to enumerate every chip assertion. Only the two cockpit subagent specs are expected.
- [ ] **Step 2: Update `cockpit/ag-ui/subagents/angular/e2e/subagents.spec.ts`.** The `task` call now renders as a `chat-subagent-card`, not a `getByRole('button', { name: /called task|task/i })` chip. Replace that chip assertion with one for the card — e.g. `await expect(page.locator('chat-subagent-card').first()).toBeVisible({ timeout: 30_000 })`. Keep the `readSubagents` projection assertions (still valid). Add an assertion that the card **persists after completion** (still present once the research subagent is `complete`) and that there is no duplicate (`expect(page.locator('chat-subagent-card')).toHaveCount(<expected>)` — assert count equals the number of distinct subagents, not 2× per message). Update the stale code comments that describe the active-only/transient behavior.
- [ ] **Step 3: Update `cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts`** the same way (chip → card; note the comment at line ~16 says it does NOT assert the card "because that primitive only [renders while active]" — now it CAN and SHOULD).
- [ ] **Step 4: Run the two e2e suites (aimock).**
```bash
# free ports first (per repo memory), then:
npx nx e2e cockpit-ag-ui-subagents-angular --skip-nx-cache
npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache
```
Expected: green. Reconcile fixtures only if a card assertion needs a longer settle (the aimock run settles fast; assert presence/persistence, not running-state timing).
- [ ] **Step 5: Commit.**
```bash
git add cockpit/ag-ui/subagents/angular/e2e/subagents.spec.ts cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts
git commit -m "test(cockpit): assert inline persistent subagent card (chip → card)"
```

---

## Task 5: Verify, live re-smoke, audit-doc close-out, PR

- [ ] **Step 1: Full lib gate + demo builds.** `npx nx run-many -t test lint build --projects=chat --skip-nx-cache`; build `cockpit-ag-ui-subagents-angular`, `cockpit-chat-subagents-angular`, `examples-chat-angular`, and any `cockpit-langgraph` subagent app. All green.
- [ ] **Step 2: Live re-smoke (AG-UI, real key).** Reuse the F5 harness: `uv run uvicorn src.server:app --port 5326 --env-file <root>/.env` in `cockpit/ag-ui/subagents/python` + `nx serve cockpit-ag-ui-subagents-angular --port 4326`; drive "Plan a trip from LAX to JFK" with the high-frequency Playwright probe (sample `chat-subagent-card` count + statuses). Confirm: ONE card per subagent (no duplicates), card persists after completion, collapses to summary when done, zero NG0956. Capture screenshots. Free ports + stop servers after.
- [ ] **Step 3: Update the audit findings doc.** In `docs/superpowers/specs/2026-06-11-ag-ui-capability-findings.md`, mark **F5 closed** with the real-defect note (card already rendered over AG-UI; the actual fix was the duplicate per-message mount + persistence). Commit.
- [ ] **Step 4: Final review** (correctness of the subagent partition in `chat-tool-calls`; no regression to GenUI/view exclusion or grouping; card persistence + collapse; e2e green; live smoke clean).
- [ ] **Step 5: Open PR**, arm auto-merge (`gh pr merge --squash --auto`), self-healing watcher (Monitor for `BEHIND` → `git merge origin/main`; ignore non-required `review` check).

---

## Self-Review
- Coverage: subagent-aware rendering (T1), duplicate-mount removal (T2), collapsed summary (T3), e2e reconcile (T4), verify+smoke+doc+PR (T5). ✓
- Type consistency: `Subagent` (status/messages are Signals); `agent().subagents?.()` is optional → default `new Map()`. Card uses `subagent` input (required). `track tc.id` / `track $index` primitives — no NG0956 risk.
- Risk: subagent `task` call must be present in the message's resolved tool calls on BOTH transports — verified by the live smoke (AG-UI) + the cockpit-chat e2e (LangGraph). If a transport surfaces a subagent with no owning message tool call, its card wouldn't render → caught by Step 2/Task 4.
- No public-API break: `ChatSubagentsComponent` stays exported; only the default composition stops mounting it.
