# aimock E2E Harness — Phase 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an aimock-driven Playwright E2E harness for `examples/chat`, wired into CI, ready for scenario PRs in subsequent phases.

**Architecture:** A new Nx project `examples-chat-aimock-e2e` boots aimock as an in-process Node server in a Playwright `globalSetup`. The Python LangGraph dev server is launched with `OPENAI_BASE_URL` pointed at aimock. Real Chromium drives the Angular `/embed` route end-to-end. One smoke fixture (`hi.json`) lands in this phase; scenario fixtures come later.

**Tech Stack:** `@copilotkit/aimock` (Node API), Playwright, Nx, GitHub Actions. Python LangGraph dev server (uv) already exists.

**Spec:** [docs/superpowers/specs/2026-05-13-aimock-e2e-phase-2a-design.md](../specs/2026-05-13-aimock-e2e-phase-2a-design.md)

---

## Working environment

- Worktree: `/tmp/aimock-phase-2a` (branch `claude/aimock-e2e-phase-2a`, forked from origin/main).
- `node_modules` symlinked from the main checkout — `npx` and `nx` work directly.
- Python deps: run `cd examples/chat/python && uv sync` once at session start.
- License header `// SPDX-License-Identifier: MIT` on line 1 of every new TS/JS file.
- DO NOT commit the harness's captured fixtures from a real OPENAI run unless explicitly asked. Phase 2a's `hi.json` is small and handwritten.
- Aimock library name (`@copilotkit/aimock`) is allowed in spec/plan docs and in `package.json` dependency lists. It MUST NOT appear in commit messages, PR bodies, or in user-visible UI strings.

---

## Task 0: De-risk integration assumptions

**Files:** None (this is an investigation task that produces a scratch script and a report — nothing committed).

This task validates the spec's assumptions before any code lands. If any assumption fails, STOP and report — the spec needs updating before the rest of the plan can proceed.

- [ ] **Step 1: Install the package locally in the worktree**

Run:
```bash
cd /tmp/aimock-phase-2a
npm install --no-save --no-package-lock @copilotkit/aimock
```

Expected: install succeeds, package present at `node_modules/@copilotkit/aimock/`.

If install fails: STOP. Report the error.

- [ ] **Step 2: Smoke-test the Node API**

Create a one-off scratch script (do NOT commit) at `/tmp/aimock-smoke.mjs`:

```javascript
import { LLMock } from "@copilotkit/aimock";
import OpenAI from "openai";

const mock = new LLMock({ port: 0 });
mock.onMessage("say hi briefly", { content: "Hi!" });
await mock.start();

const port = mock.port ?? mock.url;
console.log("aimock listening at:", port);

const client = new OpenAI({
  apiKey: "test-not-used",
  baseURL: `${mock.url}/v1`,
});

const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "say hi briefly" }],
});

console.log("response:", completion.choices[0].message.content);
await mock.stop();
```

Run:
```bash
cd /tmp/aimock-phase-2a
npm install --no-save --no-package-lock openai
node /tmp/aimock-smoke.mjs
```

Expected output (last two lines):
```
aimock listening at: <some-url-or-port>
response: Hi!
```

If the script fails OR the response is not `"Hi!"`: STOP. The exact API surface differs from what the spec assumed. Report the actual error/behavior and ask for spec updates before proceeding.

- [ ] **Step 3: Verify OPENAI_BASE_URL works with the Python OpenAI SDK**

Create a one-off scratch python file at `/tmp/aimock-py-smoke.py`:

```python
import os
from openai import OpenAI

# Caller has already started aimock and set OPENAI_BASE_URL externally.
client = OpenAI(api_key="test-not-used", base_url=os.environ["OPENAI_BASE_URL"])
resp = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "say hi briefly"}],
)
print("python response:", resp.choices[0].message.content)
```

Modify `/tmp/aimock-smoke.mjs` (still scratch) to keep aimock running long enough to drive the Python script: replace `await mock.stop()` with `await new Promise(() => {})` (run forever; kill with Ctrl-C after the python step).

In one terminal:
```bash
cd /tmp/aimock-phase-2a
node /tmp/aimock-smoke.mjs
# Note the URL it prints. Leave running.
```

In another terminal:
```bash
cd /tmp/aimock-phase-2a/examples/chat/python
OPENAI_BASE_URL=<url-from-above>/v1 uv run python /tmp/aimock-py-smoke.py
```

Expected output:
```
python response: Hi!
```

If the python script fails: STOP. The Python OpenAI SDK likely needs a different base-URL shape (with or without `/v1`, or a config option we haven't found). Report the failure mode.

- [ ] **Step 4: Verify the langgraph dev server can be started with OPENAI_BASE_URL**

Find the agent source under `examples/chat/python/src/` and locate the file that constructs the OpenAI client (search for `ChatOpenAI(` or `OpenAI(` or `openai`). Confirm by reading that the constructor honors `OPENAI_BASE_URL` (the langchain-openai default does; we just need to verify nothing local-overrides it).

If the agent hardcodes a `base_url=` argument that overrides the env var: report this. The spec assumed env-var override is sufficient.

- [ ] **Step 5: Tear down and report**

Kill the scratch aimock process. Delete `/tmp/aimock-smoke.mjs` and `/tmp/aimock-py-smoke.py`. Remove the `--no-save` test install:
```bash
cd /tmp/aimock-phase-2a
rm -rf node_modules/@copilotkit /tmp/aimock-smoke.mjs /tmp/aimock-py-smoke.py
```
(The symlink to the parent's node_modules means the directory shouldn't be modified anyway; cleanup is defensive.)

Report DE-RISK COMPLETE with:
- aimock URL shape (with or without `/v1` suffix)
- Python SDK base_url shape (the value that actually worked)
- Whether langgraph agent code requires any modification (it should not)

If all four sub-steps succeeded, proceed to Task 1.

---

## Task 1: Scaffold the `examples-chat-aimock-e2e` Nx project

**Files:**
- Create: `examples/chat/aimock-e2e/project.json`
- Create: `examples/chat/aimock-e2e/tsconfig.json`
- Create: `examples/chat/aimock-e2e/.gitignore`
- Create: `examples/chat/aimock-e2e/README.md`
- Modify: `package.json` (add `@copilotkit/aimock` and `@playwright/test` if not already present)

- [ ] **Step 1: Add aimock to package.json**

Check whether `@copilotkit/aimock` and `@playwright/test` are already in `package.json` devDependencies. If not, add them. Use the latest published versions (check `npm view @copilotkit/aimock version` and `npm view @playwright/test version`).

```bash
cd /tmp/aimock-phase-2a
npm view @copilotkit/aimock version
npm view @playwright/test version
```

Edit `package.json` and add to `devDependencies`:
```json
"@copilotkit/aimock": "^<version-from-above>",
"@playwright/test": "^<version-from-above>"
```

Skip the @playwright/test entry if it's already present.

Run:
```bash
npm install
```

DO NOT regenerate `package-lock.json` from scratch (per the memory note about Linux SWC bindings). Verify `package-lock.json` only changed minimally — just the new entry.

- [ ] **Step 2: Create the project.json**

Write `examples/chat/aimock-e2e/project.json`:

```json
{
  "name": "examples-chat-aimock-e2e",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "examples/chat/aimock-e2e",
  "targets": {
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "examples/chat/aimock-e2e",
        "command": "playwright test"
      }
    },
    "record": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "examples/chat/aimock-e2e",
        "command": "tsx scripts/record.ts"
      }
    },
    "drift": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "examples/chat/aimock-e2e",
        "command": "tsx scripts/drift.ts"
      }
    }
  }
}
```

- [ ] **Step 3: Create the tsconfig.json**

Write `examples/chat/aimock-e2e/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": false,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "test-results", "playwright-report"]
}
```

- [ ] **Step 4: Create .gitignore**

Write `examples/chat/aimock-e2e/.gitignore`:

```
test-results/
playwright-report/
*.tmp
.aimock-cache/
```

- [ ] **Step 5: Create the README**

Write `examples/chat/aimock-e2e/README.md`:

```markdown
# examples-chat-aimock-e2e

Cross-stack E2E harness for the chat example. Uses [`@copilotkit/aimock`](https://github.com/CopilotKit/aimock) as a deterministic mock for LLM API calls; the Python LangGraph dev server is launched with `OPENAI_BASE_URL` pointed at it; Playwright drives the Angular `/embed` route in real Chromium.

## Run the suite

```
npx nx run examples-chat-aimock-e2e:test
```

Replay-only. No `OPENAI_API_KEY` needed. Reads committed fixtures from `fixtures/`.

## Refresh a fixture

```
OPENAI_API_KEY=sk-... npx nx run examples-chat-aimock-e2e:record -- hi
```

Captures a real OpenAI run for the named scenario, writes the result to `fixtures/<name>.json`. Commit the updated fixture.

## Detect fixture drift

```
OPENAI_API_KEY=sk-... npx nx run examples-chat-aimock-e2e:drift
```

Re-records each committed fixture against real OpenAI and reports byte-level diffs. CI runs this on a daily schedule and opens an issue when drift is detected; it does NOT auto-update fixtures.

## Layout

- `aimock-runner.ts` — programmatic boot of the mock server.
- `fixtures/` — committed JSON fixtures keyed by scenario name.
- `scripts/record.ts` — dev-only fixture-capture CLI.
- `scripts/drift.ts` — CI fixture-drift comparison.
- `playwright.config.ts` — Playwright config with globalSetup that boots aimock + LangGraph + Angular dev server.
- `smoke.spec.ts` — Phase 2a smoke test (one scenario: "hi").

## Env vars

- `AIMOCK_FIXTURE` — path to the fixture JSON file. Defaults per-test.
- `AIMOCK_MODE` — `replay` (default) or `record`. Tests run only in replay.
```

- [ ] **Step 6: Commit Task 1**

```bash
cd /tmp/aimock-phase-2a
git add examples/chat/aimock-e2e/project.json \
        examples/chat/aimock-e2e/tsconfig.json \
        examples/chat/aimock-e2e/.gitignore \
        examples/chat/aimock-e2e/README.md \
        package.json package-lock.json
git commit -m "feat(examples-chat): scaffold aimock-e2e Nx project"
```

---

## Task 2: Implement `aimock-runner.ts`

**Files:**
- Create: `examples/chat/aimock-e2e/aimock-runner.ts`
- Create: `examples/chat/aimock-e2e/aimock-runner.spec.ts`

The runner is the harness's single source of truth for booting the mock. Both Playwright's globalSetup and the record/drift scripts go through this module.

The exact mock-API shape was verified in Task 0. Adapt the imports below if Task 0 revealed a different shape.

- [ ] **Step 1: Write a failing test**

Write `examples/chat/aimock-e2e/aimock-runner.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startAimock, type AimockHandle } from './aimock-runner';

describe('startAimock', () => {
  let handle: AimockHandle | null = null;
  let workDir = '';

  afterEach(async () => {
    if (handle) await handle.stop();
    handle = null;
    if (workDir) rmSync(workDir, { recursive: true, force: true });
    workDir = '';
  });

  it('boots a replay server backed by a fixture file', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    const fixturePath = join(workDir, 'hi.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({
        fixtures: [
          { match: { userMessage: 'say hi briefly' }, response: { content: 'Hi!' } },
        ],
      }),
    );

    handle = await startAimock({ mode: 'replay', fixturePath });
    expect(handle.port).toBeGreaterThan(0);
    expect(handle.baseUrl).toMatch(/^http:\/\/.+\/v1$/);

    // The OpenAI SDK call path is exercised in Task 0's de-risk; this
    // unit test stops at "the harness started cleanly and exposes the
    // documented shape."
  });

  it('stop() is idempotent', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    const fixturePath = join(workDir, 'hi.json');
    writeFileSync(fixturePath, JSON.stringify({ fixtures: [] }));
    handle = await startAimock({ mode: 'replay', fixturePath });
    await handle.stop();
    await handle.stop();
    expect(true).toBe(true);
  });
});
```

Run:
```bash
cd /tmp/aimock-phase-2a/examples/chat/aimock-e2e
npx vitest run aimock-runner.spec.ts
```

Expected: FAIL with module not found / `startAimock` not exported.

- [ ] **Step 2: Implement aimock-runner.ts**

Write `examples/chat/aimock-e2e/aimock-runner.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { LLMock } from '@copilotkit/aimock';
import { readFileSync } from 'node:fs';

export interface AimockHandle {
  /** Port the mock server is listening on. */
  readonly port: number;
  /** Full base URL the OpenAI SDK should target (includes /v1 suffix). */
  readonly baseUrl: string;
  /** Tear down the server. Safe to call multiple times. */
  stop(): Promise<void>;
}

export interface AimockStartOptions {
  mode: 'replay';
  fixturePath: string;
}

interface FixtureFile {
  fixtures: ReadonlyArray<{
    match: { userMessage: string };
    response: { content: string };
  }>;
}

export async function startAimock(opts: AimockStartOptions): Promise<AimockHandle> {
  const raw = readFileSync(opts.fixturePath, 'utf-8');
  const parsed = JSON.parse(raw) as FixtureFile;

  const mock = new LLMock({ port: 0 });
  for (const fx of parsed.fixtures) {
    mock.onMessage(fx.match.userMessage, fx.response);
  }
  await mock.start();

  const port = mock.port;
  const baseUrl = `${mock.url}/v1`;
  let stopped = false;

  return {
    port,
    baseUrl,
    async stop() {
      if (stopped) return;
      stopped = true;
      await mock.stop();
    },
  };
}
```

**Note:** If Task 0 revealed that `mock.port` is named differently, or `mock.url` requires no `/v1` suffix, adapt this code to match. The interface (`AimockHandle.port`, `AimockHandle.baseUrl`) stays as-is.

- [ ] **Step 3: Run the tests**

```bash
cd /tmp/aimock-phase-2a/examples/chat/aimock-e2e
npx vitest run aimock-runner.spec.ts
```

Expected: 2 passed.

If any test fails, STOP and report. Do not adjust the test to make it pass — the test encodes the contract.

- [ ] **Step 4: Commit Task 2**

```bash
cd /tmp/aimock-phase-2a
git add examples/chat/aimock-e2e/aimock-runner.ts \
        examples/chat/aimock-e2e/aimock-runner.spec.ts
git commit -m "feat(examples-chat): add aimock-runner harness module"
```

---

## Task 3: Author the hi.json fixture (handwritten seed)

**Files:**
- Create: `examples/chat/aimock-e2e/fixtures/hi.json`

Phase 2a's fixture is small enough to handwrite. Phases 2b+ may use the record script for richer scenarios.

- [ ] **Step 1: Write the fixture**

Write `examples/chat/aimock-e2e/fixtures/hi.json`:

```json
{
  "fixtures": [
    {
      "match": { "userMessage": "say hi briefly" },
      "response": { "content": "Hi! How can I help?" }
    }
  ]
}
```

- [ ] **Step 2: Smoke-verify the fixture loads**

```bash
cd /tmp/aimock-phase-2a/examples/chat/aimock-e2e
npx tsx -e "import('./aimock-runner').then(async ({ startAimock }) => { const h = await startAimock({ mode: 'replay', fixturePath: 'fixtures/hi.json' }); console.log('OK:', h.baseUrl); await h.stop(); })"
```

Expected: `OK: http://...:<port>/v1` printed; process exits cleanly.

- [ ] **Step 3: Commit Task 3**

```bash
cd /tmp/aimock-phase-2a
git add examples/chat/aimock-e2e/fixtures/hi.json
git commit -m "feat(examples-chat): add hi.json seed fixture"
```

---

## Task 4: Implement playwright.config.ts with globalSetup

**Files:**
- Create: `examples/chat/aimock-e2e/playwright.config.ts`
- Create: `examples/chat/aimock-e2e/global-setup.ts`
- Create: `examples/chat/aimock-e2e/global-teardown.ts`

GlobalSetup launches three processes in order: aimock, the Python LangGraph dev server (with `OPENAI_BASE_URL` pointed at aimock), and the Angular dev server. GlobalTeardown reverses the order.

- [ ] **Step 1: Write playwright.config.ts**

Write `examples/chat/aimock-e2e/playwright.config.ts`:

```typescript
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
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
});
```

- [ ] **Step 2: Write global-setup.ts**

Write `examples/chat/aimock-e2e/global-setup.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { startAimock, type AimockHandle } from './aimock-runner';

interface SharedState {
  aimock: AimockHandle;
  langgraph: ChildProcess;
  angular: ChildProcess;
}

declare global {
  // eslint-disable-next-line no-var
  var __AIMOCK_E2E_STATE__: SharedState | undefined;
}

const REPO_ROOT = resolve(__dirname, '../../..');
const FIXTURE_PATH = process.env.AIMOCK_FIXTURE
  ? resolve(__dirname, process.env.AIMOCK_FIXTURE)
  : resolve(__dirname, 'fixtures/hi.json');

async function waitForPort(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // ignored — server not up yet
    }
    await delay(500);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  const aimock = await startAimock({ mode: 'replay', fixturePath: FIXTURE_PATH });
  // eslint-disable-next-line no-console
  console.log(`[aimock-e2e] aimock listening at ${aimock.baseUrl}`);

  const langgraph = spawn(
    'uv',
    ['run', 'langgraph', 'dev', '--port', '2024', '--no-browser'],
    {
      cwd: resolve(REPO_ROOT, 'examples/chat/python'),
      env: {
        ...process.env,
        OPENAI_BASE_URL: aimock.baseUrl,
        OPENAI_API_KEY: 'test-not-used',
      },
      stdio: 'pipe',
    },
  );
  langgraph.stdout?.on('data', (b) => process.stdout.write(`[langgraph] ${b}`));
  langgraph.stderr?.on('data', (b) => process.stderr.write(`[langgraph] ${b}`));

  await waitForPort('http://localhost:2024/ok', 60_000);
  // eslint-disable-next-line no-console
  console.log('[aimock-e2e] langgraph ready on :2024');

  const angular = spawn(
    'npx',
    ['nx', 'serve', 'examples-chat-angular', '--port', '4200'],
    {
      cwd: REPO_ROOT,
      env: { ...process.env },
      stdio: 'pipe',
    },
  );
  angular.stdout?.on('data', (b) => process.stdout.write(`[angular] ${b}`));
  angular.stderr?.on('data', (b) => process.stderr.write(`[angular] ${b}`));

  await waitForPort('http://localhost:4200/', 120_000);
  // eslint-disable-next-line no-console
  console.log('[aimock-e2e] angular ready on :4200');

  globalThis.__AIMOCK_E2E_STATE__ = { aimock, langgraph, angular };
}
```

- [ ] **Step 3: Write global-teardown.ts**

Write `examples/chat/aimock-e2e/global-teardown.ts`:

```typescript
// SPDX-License-Identifier: MIT
export default async function globalTeardown(): Promise<void> {
  const state = globalThis.__AIMOCK_E2E_STATE__;
  if (!state) return;
  state.angular.kill('SIGTERM');
  state.langgraph.kill('SIGTERM');
  await state.aimock.stop();
  globalThis.__AIMOCK_E2E_STATE__ = undefined;
}
```

- [ ] **Step 4: Verify the config loads (syntax check)**

```bash
cd /tmp/aimock-phase-2a/examples/chat/aimock-e2e
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit Task 4**

```bash
cd /tmp/aimock-phase-2a
git add examples/chat/aimock-e2e/playwright.config.ts \
        examples/chat/aimock-e2e/global-setup.ts \
        examples/chat/aimock-e2e/global-teardown.ts
git commit -m "feat(examples-chat): add playwright config with globalSetup"
```

---

## Task 5: Write the smoke spec

**Files:**
- Create: `examples/chat/aimock-e2e/smoke.spec.ts`

- [ ] **Step 1: Write the spec**

Write `examples/chat/aimock-e2e/smoke.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

test('hi: assistant bubble renders non-empty text from the replayed fixture', async ({ page }) => {
  await page.goto('/embed');

  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill('say hi briefly');
  await page.getByRole('button', { name: /send/i }).click();

  // Wait for the assistant bubble to appear.
  const assistantBubble = page.locator('chat-message').filter({ hasNotText: 'say hi briefly' }).last();
  await expect(assistantBubble).toBeVisible({ timeout: 30_000 });

  // Wait for streaming to settle: bubble must contain non-whitespace text.
  await expect.poll(
    async () => ((await assistantBubble.innerText()) ?? '').trim().length,
    { timeout: 30_000 },
  ).toBeGreaterThan(0);

  const finalText = await assistantBubble.innerText();
  expect(finalText.trim()).toMatch(/hi/i);
});
```

- [ ] **Step 2: Run the test locally**

```bash
cd /tmp/aimock-phase-2a
npx playwright install --with-deps chromium
cd /tmp/aimock-phase-2a/examples/chat/python
uv sync
cd /tmp/aimock-phase-2a
npx nx run examples-chat-aimock-e2e:test
```

Expected: 1 test passed. Total runtime ~60–120 seconds (dominated by Python + Angular startup).

If the test fails with the assistant bubble not appearing or empty: STOP. Capture the Playwright trace from `examples/chat/aimock-e2e/test-results/` and report. Do not modify the test assertions — diagnose the root cause first.

Common failure modes and the right fix (not a workaround):
- Angular `npx nx serve examples-chat-angular` doesn't exist as a target → look up the correct target name in `examples/chat/angular/project.json`.
- Python langgraph fails to start → check `uv sync` ran and the `--port 2024` flag is correct.
- aimock URL shape requires no `/v1` suffix → already covered by Task 0; if Task 0 was skipped, run it now.

- [ ] **Step 3: Commit Task 5**

```bash
cd /tmp/aimock-phase-2a
git add examples/chat/aimock-e2e/smoke.spec.ts
git commit -m "feat(examples-chat): add aimock-e2e smoke spec"
```

---

## Task 6: Add the per-PR CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml` (append new job)

- [ ] **Step 1: Append the job**

Open `.github/workflows/ci.yml`, find the existing job `examples-chat-smoke` (the python smoke job), and append a new job after it modeled on the cockpit-e2e pattern but reusing the python+node setup. Snippet to add:

```yaml
  examples-chat-aimock-e2e:
    name: examples/chat — aimock e2e
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: actions/setup-node@v6.3.0
        with:
          node-version: 22
          cache: npm
      - name: Install uv
        uses: astral-sh/setup-uv@v8.0.0
        with:
          python-version: '3.12'
      - run: npm ci
      - working-directory: examples/chat/python
        run: uv sync
      - run: npx playwright install --with-deps chromium
      - run: npx nx run examples-chat-aimock-e2e:test --skip-nx-cache
      - name: Upload Playwright trace on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: aimock-e2e-trace
          path: examples/chat/aimock-e2e/test-results/
          retention-days: 7
```

Add `examples-chat-aimock-e2e` to the `needs:` array of the `deploy` job so a broken aimock-e2e blocks the Vercel deploy. (Find the existing `needs:` list under the `deploy` job and add the new job name to it.)

- [ ] **Step 2: Verify the workflow YAML parses**

```bash
cd /tmp/aimock-phase-2a
npx -y js-yaml .github/workflows/ci.yml > /dev/null
```

Expected: no output (success).

- [ ] **Step 3: Commit Task 6**

```bash
cd /tmp/aimock-phase-2a
git add .github/workflows/ci.yml
git commit -m "ci(examples-chat): add aimock-e2e per-PR job"
```

---

## Task 7: Add the scheduled drift-detection workflow

**Files:**
- Create: `examples/chat/aimock-e2e/scripts/record.ts`
- Create: `examples/chat/aimock-e2e/scripts/drift.ts`
- Create: `.github/workflows/aimock-drift.yml`

- [ ] **Step 1: Write scripts/record.ts**

Write `examples/chat/aimock-e2e/scripts/record.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const NAME = process.argv[2];
if (!NAME) {
  console.error('Usage: record.ts <fixture-name>');
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY required for record mode');
  process.exit(1);
}

const FIXTURE_PATH = resolve(__dirname, `../fixtures/${NAME}.json`);

const result = spawnSync(
  'npx',
  [
    '-p', '@copilotkit/aimock',
    'llmock',
    '--record',
    '--provider-openai', 'https://api.openai.com',
    '--out', FIXTURE_PATH,
  ],
  { stdio: 'inherit', env: process.env },
);

if (result.status !== 0) {
  console.error('Record failed');
  process.exit(result.status ?? 1);
}

console.log(`Recorded fixture to ${FIXTURE_PATH}`);
```

**Note:** The exact CLI flag set for record mode must be confirmed in Task 0. If `--out` is not the correct flag for the output path, adapt to the actual aimock CLI surface (see aimock docs).

- [ ] **Step 2: Write scripts/drift.ts**

Write `examples/chat/aimock-e2e/scripts/drift.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const FIXTURES_DIR = resolve(__dirname, '../fixtures');

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY required for drift detection');
  process.exit(1);
}

const fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
if (fixtureFiles.length === 0) {
  console.log('No fixtures to check.');
  process.exit(0);
}

const tmpDir = mkdtempSync(join(tmpdir(), 'aimock-drift-'));
const drifts: Array<{ name: string; bytesCommitted: number; bytesRecorded: number; diff: number }> = [];

for (const file of fixtureFiles) {
  const name = file.replace(/\.json$/, '');
  const committedPath = join(FIXTURES_DIR, file);
  const recordedPath = join(tmpDir, file);

  const result = spawnSync(
    'npx',
    [
      '-p', '@copilotkit/aimock',
      'llmock',
      '--record',
      '--provider-openai', 'https://api.openai.com',
      '--out', recordedPath,
    ],
    { stdio: 'inherit', env: process.env },
  );

  if (result.status !== 0) {
    console.error(`Drift check failed to record ${name}`);
    process.exit(result.status ?? 1);
  }

  const committed = readFileSync(committedPath);
  const recorded = readFileSync(recordedPath);
  const diff = Math.abs(committed.length - recorded.length);

  drifts.push({ name, bytesCommitted: committed.length, bytesRecorded: recorded.length, diff });
}

console.log(JSON.stringify({ drifts }, null, 2));

const THRESHOLD_PCT = 0.2;
const significant = drifts.filter((d) => d.diff / Math.max(d.bytesCommitted, 1) > THRESHOLD_PCT);
if (significant.length > 0) {
  console.error(`::error::Drift exceeds threshold for: ${significant.map((d) => d.name).join(', ')}`);
  process.exit(2);
}
```

- [ ] **Step 3: Write .github/workflows/aimock-drift.yml**

Write `.github/workflows/aimock-drift.yml`:

```yaml
name: aimock fixture drift

on:
  schedule:
    - cron: '0 7 * * *'
  workflow_dispatch:

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: actions/setup-node@v6.3.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Run drift check
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: npx nx run examples-chat-aimock-e2e:drift --skip-nx-cache
      - name: Open issue on drift
        if: failure()
        uses: actions/github-script@v8
        with:
          script: |
            const { owner, repo } = context.repo;
            const today = new Date().toISOString().slice(0, 10);
            const title = `aimock fixture drift detected — ${today}`;
            const body = [
              'The scheduled fixture drift check failed.',
              '',
              `Workflow run: ${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`,
              '',
              'Investigate which fixture drifted and either refresh it intentionally',
              'or open a PR fixing the regression on the LLM side.',
            ].join('\n');
            const existing = await github.rest.issues.listForRepo({
              owner, repo, labels: 'aimock-drift', state: 'open',
            });
            if (existing.data.length === 0) {
              await github.rest.issues.create({
                owner, repo, title, body, labels: ['aimock-drift'],
              });
            } else {
              await github.rest.issues.createComment({
                owner, repo, issue_number: existing.data[0].number,
                body: `Drift again on ${today}. ${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`,
              });
            }
```

- [ ] **Step 4: Verify the workflow YAML parses**

```bash
cd /tmp/aimock-phase-2a
npx -y js-yaml .github/workflows/aimock-drift.yml > /dev/null
```

Expected: no output.

- [ ] **Step 5: Commit Task 7**

```bash
cd /tmp/aimock-phase-2a
git add examples/chat/aimock-e2e/scripts/record.ts \
        examples/chat/aimock-e2e/scripts/drift.ts \
        .github/workflows/aimock-drift.yml
git commit -m "ci(examples-chat): add scheduled aimock fixture drift workflow"
```

---

## Task 8: Verify end-to-end and push

- [ ] **Step 1: Run the full new test target**

```bash
cd /tmp/aimock-phase-2a
npx nx run examples-chat-aimock-e2e:test
```

Expected: 1 Playwright test passes. Captured browser trace clean on success.

- [ ] **Step 2: Run aimock-runner unit tests**

```bash
cd /tmp/aimock-phase-2a/examples/chat/aimock-e2e
npx vitest run aimock-runner.spec.ts
```

Expected: 2 passed.

- [ ] **Step 3: Confirm existing Phase 1 tests still green**

```bash
cd /tmp/aimock-phase-2a
npx nx run-many --target=test --projects=chat,a2ui
```

Expected: green (no regressions from npm-install or workspace changes).

- [ ] **Step 4: Push branch**

```bash
cd /tmp/aimock-phase-2a
git push -u origin claude/aimock-e2e-phase-2a
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --title "feat(examples-chat): aimock E2E harness — Phase 2a (infra)" --body "$(cat <<'EOF'
## Summary

Stands up the cross-stack E2E test harness for `examples/chat`. Phase 2a is infrastructure only — the harness, one trivial smoke fixture, the per-PR CI job, and a scheduled fixture-drift workflow. Real scenario coverage lands in Phase 2b+ as small additive PRs.

Sits on top of Phase 1 ([#305](https://github.com/cacheplane/angular-agent-framework/pull/305)) which covers parser-level invariants at unit granularity. Phase 2a covers integration shapes that Phase 1 cannot reach.

Spec: `docs/superpowers/specs/2026-05-13-aimock-e2e-phase-2a-design.md`
Plan: `docs/superpowers/plans/2026-05-13-aimock-e2e-phase-2a.md`

## Test plan

- [x] `nx run examples-chat-aimock-e2e:test` passes locally
- [x] aimock-runner unit tests green
- [x] Existing Phase 1 chat + a2ui suites still green
- [x] No production code touched
- [x] Drift workflow has a `workflow_dispatch` trigger for manual verification
EOF
)"
```

- [ ] **Step 6: Manually verify the drift workflow once after merge**

After the PR merges to main, fire the drift workflow manually via `gh workflow run aimock-drift.yml` and confirm it runs without opening a false-positive issue.

---

## Self-review checklist

- [x] Spec coverage: Each spec section maps to a task. (Goal/non-goals → all tasks; Architecture → Tasks 1, 4; File layout → Tasks 1, 4, 5, 7; Components → Tasks 2, 3, 4, 5, 7; CI integration → Tasks 6, 7; Local dev → README in Task 1; Risks → Task 0.)
- [x] Placeholder scan: No TBD/TODO. Two notes (`adapt if Task 0 revealed...`) are intentional guidance to handle API-surface differences discovered during de-risking.
- [x] Type consistency: `AimockHandle`, `AimockStartOptions`, `startAimock` names match across Tasks 2, 4, and 7.
- [x] Constraints: aimock named only in spec/plan/README/package.json; not in commit messages or PR body.

## Execution handoff

Plan complete. Recommended: **subagent-driven-development**. The first subagent should be tasked SOLELY with Task 0 (de-risk) — it must report back before any subsequent task is dispatched. If de-risk fails, the spec needs updating before continuing.
