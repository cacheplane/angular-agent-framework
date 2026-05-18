# Cockpit aimock Phase 2 — c-interrupts spec — design

> **Place in the larger plan.** Follow-on to PR #382 (c-interrupts real `interrupt()` wiring + UI action→resume), which targets the **standalone** per-cap python backend at `cockpit/chat/interrupts/python/` after the per-cap architecture landed via PR #396. This spec adds the Phase 2 aimock-driven e2e for `c-interrupts`, matching the per-example pattern established by c-tool-calls and c-subagents.

## Goal

Add a Playwright spec that drives the c-interrupts booking flow end-to-end via aimock, asserting the interrupt panel renders for a booking request and that Accept/Ignore correctly resume the LangGraph `book_flight` tool. Unblocks regression coverage for the c-interrupts UI primitive.

## Non-goals

- Other interrupt UI actions (Edit, Respond) — the booking flow uses only Accept and Ignore.
- Other c-* graphs (threads, timeline, generative-ui, etc.) — separate spec PRs per capability.
- Replacing the pre-existing `cockpit/chat/interrupts/angular/e2e/interrupts.spec.ts` structural smoke — it stays as a dev-time check that requires manual `nx serve` and is not run in CI today; the new aimock spec is the CI-gated one.
- Changing the shape of the existing `sendPromptAndWait` helper in `libs/e2e-harness/src/test-helpers.ts`.

## Architecture overview (post per-cap, post-umbrella-cleanup)

The c-interrupts demo runs as a self-contained pair:

- **Backend:** `cockpit/chat/interrupts/python/` — standalone langgraph deployment with `book_flight` tool + agent ↔ ToolNode loop (PR #382). Default dev port: 5503. **Source of truth for both local dev (PR #421 flipped the registry) and production deploy (PR #432 re-routed the deploy script).**
- **Frontend:** `cockpit/chat/interrupts/angular/` — Angular app that proxies `/api` → backend. Default dev port: 4503.

The umbrella's `chat_graphs.py` was deleted in PR #437 — the per-cap backend is the only source for c-interrupts now.

## What changes

### New e2e dir scaffolding

```
cockpit/chat/interrupts/angular/e2e/
├── c-interrupts.spec.ts          # NEW — two tests (confirm, cancel)
├── manual/
│   └── interrupts.manual.ts       # EXISTING — pre-existing manual smoke (untouched)
├── playwright.config.ts           # NEW
├── global-setup-impl.ts           # NEW
├── tsconfig.json                  # NEW
├── fixtures/
│   └── c-interrupts.json          # NEW — captured llmock fixtures
└── scripts/
    └── record-c-interrupts.sh    # NEW — runs llmock --record against real OpenAI
```

The pre-existing manual smoke at `e2e/manual/interrupts.manual.ts` lives outside the `**/*.spec.ts` glob and runs only on demand; the new playwright.config needs no `testIgnore` rule to exclude it.

### New aimock helpers (added to the lib)

Added to `libs/e2e-harness/src/test-helpers.ts` alongside `sendPromptAndWait`:

1. `sendPromptAndWaitForInterrupt(page, prompt, opts?)` — submits a prompt, waits for the agent to reach an idle-with-pending-interrupt state (`chat-interrupt-panel` is in the DOM and visible). Cannot reuse `sendPromptAndWait` because that helper waits for the Stop-generating cycle to complete with no pending interrupt; when an interrupt fires, the agent goes idle while the panel is open.
2. `clickInterruptActionAndWaitFinal(page, label)` — clicks a button in the panel by exact label match (`/^Accept$/` or `/^Ignore$/`), then re-waits the Stop-generating cycle for the resume continuation to finalize. Returns the last `chat-message[data-role="assistant"][data-streaming="false"]` locator.

Both helpers go in the lib because they apply to any future cockpit example that exercises the interrupt primitive.

### Global-setup target — per-cap convention

The lib's `createGlobalSetup` config switches to the standalone backend:

```typescript
createGlobalSetup({
  langgraphCwd: 'cockpit/chat/interrupts/python',   // standalone, not umbrella
  langgraphPort: 5503,                               // per-cap default
  angularProject: 'cockpit-chat-interrupts-angular',
  angularPort: 4503,                                 // matches env.development
  fixturesDir: resolve(__dirname, 'fixtures'),
});
```

**No port change required** to the existing `proxy.conf.json` or `environment.development.ts` — they already point at 5503/4503 on main. This is a major simplification vs the pre-per-cap design (which would have required port renumbering to 8126/4506).

### Spec: `c-interrupts.spec.ts`

Two tests, one per flow. Both follow the same shape: submit → assert panel → click action → assert final bubble text.

```typescript
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
  sendPromptAndWaitForInterrupt,
  clickInterruptActionAndWaitFinal,
} from '../../../../../libs/e2e-harness/src';

test('c-interrupts: confirm path books the flight via book_flight + resume("confirm")', async ({ page }) => {
  await sendPromptAndWaitForInterrupt(page, 'Book me on UA123.');

  const panel = page.locator('chat-interrupt-panel');
  await expect(panel).toBeVisible();

  const finalBubble = await clickInterruptActionAndWaitFinal(page, 'Accept');
  const text = (await finalBubble.innerText()).toLowerCase();
  expect(text).toMatch(/booked/);
  expect(text).toMatch(/ua123/);
});

test('c-interrupts: cancel path returns "Booking cancelled." via resume("cancel")', async ({ page }) => {
  await sendPromptAndWaitForInterrupt(page, 'Book me on AA404.');

  const panel = page.locator('chat-interrupt-panel');
  await expect(panel).toBeVisible();

  const finalBubble = await clickInterruptActionAndWaitFinal(page, 'Ignore');
  const text = (await finalBubble.innerText()).toLowerCase();
  expect(text).toMatch(/cancel/);
});
```

Loose regex on the final bubble text — the LLM's continuation wording is non-deterministic at the word level even with the recorded fixture. The key invariants are the booking phrase + flight number (confirm) or cancel-related text (cancel).

### `project.json` additions

Add to `cockpit/chat/interrupts/angular/project.json` `targets`:

```json
"e2e": {
  "executor": "@nx/playwright:playwright",
  "options": {
    "config": "cockpit/chat/interrupts/angular/e2e/playwright.config.ts"
  }
},
"record": {
  "executor": "nx:run-commands",
  "options": {
    "command": "bash cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh"
  }
}
```

### CI

Single edit to `.github/workflows/ci.yml`: append `cockpit-chat-interrupts-angular` to the `for proj in …` shell loop inside the `cockpit-e2e` job. Same artifact upload path covers it.

Note — the CI job will need to `uv sync` the new standalone backend. Confirm by reading the current ci.yml: if the per-cap CI loop already does a `for proj in cockpit/chat/*/python; do uv sync ...` step, no change needed; otherwise add `cockpit/chat/interrupts/python` to that sync loop.

### Recording script

`scripts/record-c-interrupts.sh` is a near-copy of `cockpit/chat/subagents/angular/e2e/scripts/record-c-subagents.sh` with these differences:

- `LANGGRAPH_CWD=cockpit/chat/interrupts/python` (standalone, not `cockpit/langgraph/streaming/python`)
- `LANGGRAPH_PORT=5503`
- `assistant_id: c-interrupts`
- Two flows captured in one run:
  1. Thread A: send `"Book me on UA123."` → poll for `status=interrupted` → POST `{"command":{"resume":"confirm"}}` to `/threads/$T/runs` → poll for `status=success`
  2. Thread B: send `"Book me on AA404."` → poll for `status=interrupted` → POST `{"command":{"resume":"cancel"}}` → poll for `status=success`
- Output: `cockpit/chat/interrupts/angular/e2e/fixtures/c-interrupts.json`
- Same merge step (concatenate per-request fixture files into one)

## Components

### `sendPromptAndWaitForInterrupt`

```typescript
export async function sendPromptAndWaitForInterrupt(
  page: Page,
  prompt: string,
  opts?: SendPromptAndWaitOptions,
): Promise<void> {
  const path = opts?.path ?? '/';
  await page.goto(path);
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(prompt);
  await page.getByRole('button', { name: /send/i }).click();

  await expect(page.getByRole('button', { name: /stop generating/i })).toBeVisible({
    timeout: 10_000,
  });
  // Panel visible implies run paused at an interrupt rather than completing.
  await expect(page.locator('chat-interrupt-panel')).toBeVisible({ timeout: 60_000 });
}
```

### `clickInterruptActionAndWaitFinal`

```typescript
export async function clickInterruptActionAndWaitFinal(
  page: Page,
  label: 'Accept' | 'Ignore' | 'Edit' | 'Respond',
): Promise<Locator> {
  const button = page
    .locator('chat-interrupt-panel')
    .getByRole('button', { name: new RegExp(`^${label}$`) });
  await button.click();

  await expect(page.getByRole('button', { name: /stop generating/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('button', { name: /stop generating/i })).not.toBeAttached({
    timeout: 60_000,
  });

  const finalizedAssistant = page
    .locator('chat-message[data-role="assistant"][data-streaming="false"]')
    .last();
  await expect(finalizedAssistant).toBeAttached({ timeout: 5_000 });
  return finalizedAssistant;
}
```

### `global-setup-impl.ts`

```typescript
// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/interrupts/python',
  langgraphPort: 5503,
  angularProject: 'cockpit-chat-interrupts-angular',
  angularPort: 4503,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
```

### `playwright.config.ts` and `tsconfig.json`

Direct copy of the subagents versions, with the project name and port adjusted. No `testIgnore` needed — the pre-existing manual smoke lives at `e2e/manual/interrupts.manual.ts` and is excluded by the default `**/*.spec.ts` glob.

## Data flow per test

**Confirm test (UA123):**
1. Helper navigates to the cockpit interrupts page (port 4503), types `"Book me on UA123."`, clicks Send.
2. Aimock (proxied through langgraph at 5503) replies with a `book_flight(flight_number="UA123")` tool-call from the fixture entry keyed on `userMessage="Book me on UA123."`.
3. ToolNode runs `book_flight`, which calls real `lookup_flight("UA123")` (no LLM), then raises `interrupt({type:'approval_request', summary, flight})`.
4. Stream pauses; `<chat-interrupt-panel>` renders.
5. Helper clicks Accept; `interrupts.component.ts` calls `agent.submit({ resume: 'confirm' })`.
6. `book_flight` resumes, returns `"Booked UA UA123 from LAX to JFK (departs 08:00)."`.
7. Orchestrator LLM is invoked again with the new ToolMessage. Aimock matches on the original `userMessage="Book me on UA123."` + `hasToolResult=true` + recorded turn order and replies with the captured continuation.
8. Final assistant bubble lands. Test asserts text matches `/booked/i` + `/ua123/i`.

**Cancel test (AA404):** symmetric, with `Ignore` button → `resume: 'cancel'` → `"Booking cancelled."` → final bubble matches `/cancel/i`.

## Risk surface

- **Helper assumption — interrupt produces idle-with-panel.** Verified manually via Chrome MCP on PR #382 (Stream Status went to "idle" with the panel visible). The panel locator is the durable signal.
- **Aimock fingerprint collision.** Both flows submit different initial user messages (UA123 vs AA404), so the orchestrator's first turn fingerprints are distinct. Continuation turns reference the original user message + recorded turn index, so they should not collide at replay. Recording-time mitigation if needed: capture each flow in its own fixture file and gate per-test loading.
- **Standalone backend `uv sync` in CI.** The new `cockpit/chat/interrupts/python` backend needs its deps installed before `langgraph dev` can launch. The per-cap CI loop already syncs all per-cap backends; verify during implementation.
- **~~`interrupts.spec.ts` collision.~~** No longer a concern. The pre-existing manual smoke moved to `e2e/manual/interrupts.manual.ts` (PR #420-era cleanup), outside the playwright `**/*.spec.ts` glob.
- **Multiple parallel agents on the shared checkout.** The brainstorming + planning phase exposed at least one parallel agent landing concurrent changes (per-cap-cleanup landed mid-conversation). The implementer must `git fetch origin && git rebase origin/main` before starting and verify the standalone backend is intact at start-of-task.
- **Dependency on PR #382 landing first.** This spec assumes `cockpit/chat/interrupts/python/src/graph.py` has `book_flight` + the ToolNode loop, and that `interrupts.component.ts` wires Accept/Ignore → `agent.submit({resume})`. Both are part of PR #382. If #382 has not merged when this PR opens, rebase this PR on top of #382's branch or wait for the merge.

## Acceptance criteria

- `cockpit/chat/interrupts/angular/e2e/c-interrupts.spec.ts` exists with two passing tests (confirm + cancel).
- `cockpit/chat/interrupts/angular/e2e/fixtures/c-interrupts.json` committed; replay-deterministic (CI passes without `OPENAI_API_KEY`).
- `libs/e2e-harness/src/test-helpers.ts` exports `sendPromptAndWaitForInterrupt` and `clickInterruptActionAndWaitFinal`; both re-exported from `index.ts`.
- `cockpit/chat/interrupts/angular/project.json` has `e2e` and `record` targets.
- No changes required to `cockpit/chat/interrupts/angular/proxy.conf.json` or `environment.development.ts` — ports unchanged.
- Local: `nx e2e cockpit-chat-interrupts-angular` passes 3/3 consecutive stability runs.
- Local: existing cockpit e2e suites (streaming, tool-calls, subagents) still pass — proves no cross-graph regression.
- CI: `Cockpit — e2e` job green with `cockpit-chat-interrupts-angular` in the loop.
- Reference grep `grep -rn 'c-interrupts' cockpit/chat/interrupts/angular/e2e/` returns the spec file, the global-setup, and the fixture.
