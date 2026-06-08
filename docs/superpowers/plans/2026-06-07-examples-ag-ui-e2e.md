# examples/ag-ui e2e (aimock replay) Implementation Plan (Part 2b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the relevant `examples/chat` Playwright e2e suite to `examples/ag-ui`, driving the uvicorn `ag-ui-langgraph` backend with aimock-replayed LLM fixtures — proving transport + a2ui parity deterministically (no live LLM).

**Architecture:** aimock mocks the OpenAI provider (below the transport), so the *same* graph over AG-UI replaying the *same* recorded fixtures yields the *same* a2ui surfaces — the suite ports transport-agnostically. The only harness change is `global-setup` launching the uvicorn ag-ui server (`:8000`) instead of `langgraph dev` (`:2024`), and the app on `:4201`. Shell-specific specs (control-palette, mode-routing, model-picker, url-routing, debug-devtools, lifecycle, keyboard-accessibility, visual-polish, regenerate) are NOT ported — the ag-ui example is a simplified single-conversation app.

**Tech Stack:** Playwright, `@copilotkit/aimock` (repo-standard e2e LLM mock — confirmed in scope), Nx; the existing `examples/ag-ui` app + uvicorn backend (Part 2a).

**Spec:** `docs/superpowers/specs/2026-06-06-examples-ag-ui-standalone-design.md` (Part 2, e2e). Branches off `main` (Part 2a merged). CI e2e job + deploy = Part 3.

---

## Scope: which specs port

**Port (transport/message/a2ui — app-agnostic DOM assertions):**
- `initial-render.spec.ts`, `send-receive.spec.ts`, `a2ui-single-bubble.spec.ts` (critical a2ui parity + `customEvents` regression guard), `markdown-surfaces.spec.ts`, `color-scheme.spec.ts`, `error-handling.spec.ts`, `browser-hygiene.spec.ts`.

**Do NOT port (test the dropped demo shell):**
- `control-palette`, `mode-routing`, `model-picker`, `url-routing`, `debug-devtools`, `lifecycle`, `keyboard-accessibility`, `visual-polish`, `regenerate`, `interrupt-approval` (only if the graph exposes interrupts AND the simplified app surfaces the approval card — defer unless trivial), `research-subagent` (subagent surface — defer), `send-receive` keep, `aimock-runner.spec.ts` (a self-test of the runner — port only if it passes unchanged).

Each ported spec MUST be opened and checked: if it asserts a shell feature absent from the ag-ui app (mode tabs, palette, model picker, thread list), drop that spec or trim the shell-coupled assertions. Report any dropped/trimmed.

---

## File Structure

**New — `examples/ag-ui/angular/e2e/`** (ported from `examples/chat/angular/e2e/`):
- `aimock-runner.ts`, `test-helpers.ts` — verbatim copies (mock server + DOM helpers; transport-agnostic).
- `global-setup.ts` — adapted: uvicorn ag-ui backend on `:8000`, app on `:4201`.
- `global-teardown.ts` — adapted: kill uvicorn + angular.
- `playwright.config.ts` — `baseURL: http://localhost:4201`.
- `tsconfig.json`, `.gitignore`, `README.md`.
- `fixtures/` — copy the fixtures the ported specs use.
- `<spec subset>.spec.ts` — the ported specs above.

**Modified:**
- `examples/ag-ui/angular/project.json` — add `e2e` (+ optional `record`/`drift`) targets.

---

## Task 1: Port the e2e harness

**Files:** create `examples/ag-ui/angular/e2e/{aimock-runner.ts,test-helpers.ts,global-setup.ts,global-teardown.ts,playwright.config.ts,tsconfig.json,.gitignore,README.md,fixtures/**}`

- [ ] **Step 1: Copy the transport-agnostic harness files verbatim**

```bash
mkdir -p examples/ag-ui/angular/e2e/fixtures
cp examples/chat/angular/e2e/aimock-runner.ts examples/ag-ui/angular/e2e/aimock-runner.ts
cp examples/chat/angular/e2e/test-helpers.ts examples/ag-ui/angular/e2e/test-helpers.ts
cp examples/chat/angular/e2e/tsconfig.json examples/ag-ui/angular/e2e/tsconfig.json
cp examples/chat/angular/e2e/.gitignore examples/ag-ui/angular/e2e/.gitignore
cp examples/chat/angular/e2e/global-teardown.ts examples/ag-ui/angular/e2e/global-teardown.ts
```
Then READ `test-helpers.ts` and `global-teardown.ts`: if they reference `examples-chat` project names, `:4200`, `:2024`, or the `langgraph` child in `__AIMOCK_E2E_STATE__`, note them — `global-teardown.ts` likely kills `state.langgraph`; you will rename that to the uvicorn child in Step 3. `test-helpers.ts` should be pure DOM (sendPromptAndWait etc.) — if it has no backend coupling, leave verbatim.

- [ ] **Step 2: Write `examples/ag-ui/angular/e2e/playwright.config.ts`**

```ts
// SPDX-License-Identifier: MIT
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  testIgnore: ['aimock-runner.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4201',
    trace: 'retain-on-failure',
  },
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
});
```

- [ ] **Step 3: Write `examples/ag-ui/angular/e2e/global-setup.ts`** (uvicorn instead of langgraph dev)

```ts
// SPDX-License-Identifier: MIT
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { startAimock, type AimockHandle } from './aimock-runner';

interface SharedState {
  aimock: AimockHandle;
  backend: ChildProcess;
  angular: ChildProcess;
}

declare global {
  // eslint-disable-next-line no-var
  var __AIMOCK_E2E_STATE__: SharedState | undefined;
}

const REPO_ROOT = resolve(__dirname, '../../../..');
const FIXTURE_PATH = process.env.AIMOCK_FIXTURE
  ? resolve(__dirname, process.env.AIMOCK_FIXTURE)
  : resolve(__dirname, 'fixtures');

async function waitForPort(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not up yet
    }
    await delay(500);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  const aimock = await startAimock({ mode: 'replay', fixturePath: FIXTURE_PATH });
  console.log(`[aimock-e2e] aimock listening at ${aimock.baseUrl}`);

  const backend = spawn(
    'uv',
    ['run', 'uvicorn', 'src.server:app', '--port', '8000'],
    {
      cwd: resolve(REPO_ROOT, 'examples/ag-ui/python'),
      env: {
        ...process.env,
        OPENAI_BASE_URL: aimock.baseUrl,
        OPENAI_API_KEY: 'test-not-used',
      },
      stdio: 'pipe',
    },
  );
  backend.stdout?.on('data', (b) => process.stdout.write(`[uvicorn] ${b}`));
  backend.stderr?.on('data', (b) => process.stderr.write(`[uvicorn] ${b}`));

  await waitForPort('http://localhost:8000/ok', 60_000);
  console.log('[aimock-e2e] ag-ui backend ready on :8000');

  const angular = spawn(
    'npx',
    ['nx', 'serve', 'examples-ag-ui-angular', '--port', '4201'],
    { cwd: REPO_ROOT, env: { ...process.env }, stdio: 'pipe' },
  );
  angular.stdout?.on('data', (b) => process.stdout.write(`[angular] ${b}`));
  angular.stderr?.on('data', (b) => process.stderr.write(`[angular] ${b}`));

  await waitForPort('http://localhost:4201/', 120_000);
  console.log('[aimock-e2e] angular ready on :4201');

  globalThis.__AIMOCK_E2E_STATE__ = { aimock, backend, angular };
}
```

- [ ] **Step 4: Update `global-teardown.ts` to the renamed `backend` child**

Read the copied `global-teardown.ts`. It references `state.langgraph` (and/or `state.angular`, `state.aimock`). Rename `langgraph` → `backend` to match the new `SharedState`. Keep the kill logic identical (e.g. `state.backend?.kill('SIGTERM')`, `state.angular?.kill('SIGTERM')`, `await state.aimock.stop()`). If the teardown imports a `SharedState` type, ensure it matches global-setup's (or is duplicated identically).

- [ ] **Step 5: Copy the fixtures the ported specs need**

Determine which fixtures the to-be-ported specs reference (read each spec for `AIMOCK_FIXTURE` or prompt strings; the runner loads the whole `fixtures/` dir by default). Simplest + safe: copy the whole fixtures dir (same graph → all fixtures valid):
```bash
cp examples/chat/angular/e2e/fixtures/*.json examples/ag-ui/angular/e2e/fixtures/
```
Copy `examples/chat/angular/e2e/README.md` → adapt the ports (2024→8000, 4200→4201) and project name, or write a short fresh README.

- [ ] **Step 6: Add e2e target to `examples/ag-ui/angular/project.json`**

Read `examples/chat/angular/project.json`'s `e2e` target and mirror it with paths swapped:
```json
"e2e": {
  "executor": "@nx/playwright:playwright",
  "options": { "config": "examples/ag-ui/angular/e2e/playwright.config.ts" }
}
```
(Add `record`/`drift` targets only if you also port `scripts/record.ts`/`drift.ts` — OPTIONAL; defer if not needed for the e2e run.)

- [ ] **Step 7: Commit**

```bash
git add examples/ag-ui/angular/e2e examples/ag-ui/angular/project.json
git commit -m "test(examples/ag-ui): port aimock e2e harness (uvicorn backend, :4201)"
```

---

## Task 2: Port the spec subset

**Files:** create `examples/ag-ui/angular/e2e/<subset>.spec.ts`

- [ ] **Step 1: Copy the transport/a2ui spec subset**

```bash
cd examples/chat/angular/e2e
for s in initial-render send-receive a2ui-single-bubble markdown-surfaces color-scheme error-handling browser-hygiene; do
  cp "$s.spec.ts" ../../../ag-ui/angular/e2e/"$s.spec.ts"
done
cd ../../../..
```

- [ ] **Step 2: Audit each ported spec for shell coupling**

Open each copied spec. For each, check whether it:
- navigates to a shell route (e.g. `/embed`, `/popup`, mode tabs) that the ag-ui app doesn't have — change to `/` (the ag-ui app is single-route),
- asserts a shell element absent in the ag-ui app (mode tabs, palette, model picker, project/thread list) — remove that assertion or drop the spec,
- relies on `examples-chat`-specific selectors — the `<chat>` composition selectors (`chat-message`, `a2ui-surface`, `chat-streaming-md`, etc.) are shared and fine.

The ag-ui `app.html` renders `<chat main [agent]="agent" />` at route `/`. Most message/a2ui assertions work unchanged. Report exactly what you trimmed/dropped per spec.

- [ ] **Step 3: Run the suite locally (aimock replay — deterministic, no live LLM)**

```bash
npx nx e2e examples-ag-ui-angular 2>&1 | tail -40
```
Expected: the ported specs pass. The harness auto-starts aimock + uvicorn + angular. If a spec fails:
- If it's a shell-coupled assertion you missed, trim it (Step 2).
- If `a2ui-single-bubble` fails on the surface not rendering, that's a real signal — check the uvicorn log in the Playwright output; the a2ui surface depends on the `customEvents` signal (now on main) + the `render_a2ui_surface` tool call. Report BLOCKED with the failure if it's a genuine parity gap, not a shell-coupling issue.

> If `uv` / `nx serve` aren't available in the runner, that's an environment problem — report it; do not fake the run.

- [ ] **Step 4: Commit**

```bash
git add examples/ag-ui/angular/e2e/*.spec.ts
git commit -m "test(examples/ag-ui): port transport + a2ui e2e specs (aimock replay)"
```

---

## Task 3: PR

- [ ] **Step 1: Push + open PR**

```bash
git push -u origin claude/examples-ag-ui-e2e
gh pr create --title "test(examples/ag-ui): aimock e2e — transport + a2ui parity (Part 2b)" --body "$(cat <<'EOF'
## Summary

Ports the relevant `examples/chat` Playwright e2e to `examples/ag-ui`, driving the uvicorn ag-ui backend with aimock-replayed OpenAI fixtures. aimock mocks the LLM provider (below the transport), so the same graph over AG-UI + same fixtures = same a2ui surfaces — deterministic parity proof.

- Harness ported: `aimock-runner`/`test-helpers` verbatim; `global-setup` launches `uvicorn src.server:app` on `:8000` (was `langgraph dev :2024`); app on `:4201`.
- Specs ported (transport/message/a2ui): initial-render, send-receive, a2ui-single-bubble (the parity + `customEvents` regression guard), markdown-surfaces, color-scheme, error-handling, browser-hygiene.
- Shell-specific specs (palette/modes/model-picker/url-routing/etc.) intentionally NOT ported — the ag-ui example is a simplified single-conversation app.

aimock is the repo-standard e2e LLM mock (already used by examples/chat, cockpit, website) — in scope per prior decision.

Part 2b of `docs/superpowers/specs/2026-06-06-examples-ag-ui-standalone-design.md`. CI e2e job + deploy = Part 3.

## Test plan
- [x] `nx e2e examples-ag-ui-angular` green locally (aimock replay).
- [ ] CI green (the e2e CI job lands with Part 3).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Arm auto-merge**

```bash
gh pr merge <PR_NUMBER> --squash --auto --delete-branch
```

- [ ] **Step 3: Wait for green + merge.** If `Vercel – threadplane` preview fails on the known transient npm-registry 404, redeploy that preview via the Vercel API. If `chat:lint`-style broken-main blocks it, investigate whether main regressed (as in #607).

---

## Self-Review

- [ ] **Spec coverage (Part 2 e2e):** harness port + uvicorn adaptation → Task 1. Transport/a2ui spec subset → Task 2. Local green → Task 2 Step 3. Create-app smoke + CI e2e job deferred (smoke → later; CI → Part 3) — noted.
- [ ] **No placeholders:** harness files have full content or verbatim-copy instructions; specs are copy+audit with explicit drop/trim guidance.
- [ ] **Consistency:** `SharedState.backend` (renamed from `langgraph`) consistent between global-setup (Task 1 Step 3) and global-teardown (Task 1 Step 4); ports `:8000`/`:4201` consistent across global-setup + playwright.config + project.json; project name `examples-ag-ui-angular` consistent.
- [ ] **Honesty:** the spec subset is a deliberate reduction from examples/chat's full suite (shell specs dropped) — documented in the PR body and Scope section, not silently truncated.
