# Cockpit aimock E2E — Phase 2 Implementation Plan (harness library + per-example layout)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Stand up `libs/internal/aimock-harness` (shared runner + helpers + globalSetup factory), migrate the existing `streaming` spec to a per-example layout under `cockpit/langgraph/streaming/angular/e2e/`, and add `c-tool-calls` as the second example under the new pattern.

**Architecture:** Each cockpit example owns its own e2e dir next to its Angular app. Per-example `playwright.config.ts` calls `createGlobalSetup({ ... })` from the shared lib with this app's specifics (langgraph cwd, Angular project name + port, fixtures dir). CI runs all of them via `nx run-many --target=e2e --projects=cockpit-*-angular --parallel=1`.

**Tech Stack:** `@copilotkit/aimock`, Playwright, Nx, TypeScript path aliases.

**Spec:** [docs/superpowers/specs/2026-05-15-cockpit-aimock-harness-lib-design.md](../specs/2026-05-15-cockpit-aimock-harness-lib-design.md)

---

## Working environment

- Worktree: `/tmp/aimock-harness` (branch `claude/aimock-harness-lib`).
- `node_modules` symlinked from main checkout; `npx`/`nx`/`uv` work directly.
- License header `// SPDX-License-Identifier: MIT` on line 1 of every new TS file.
- One commit per task. DO NOT push, amend, or `git add -A`.
- Spec commit (`efd68cef`) already on the branch; this plan adds another.

---

## Task 0: De-risk path-alias resolution at Playwright runtime

**Files:** None (investigation only).

The spec assumes `import { createGlobalSetup } from '@ngaf-internal/aimock-harness'` resolves at Playwright config-load time. Vitest and Angular handle TS path aliases via their bundlers; Playwright loads its config through Node's module resolver, which does NOT honor `tsconfig.json` paths by default. If aliases don't resolve, the implementation falls back to relative imports.

- [ ] **Step 1: Inspect existing Playwright configs in the repo**

```bash
cd /tmp/aimock-harness
grep -rn "from '@ngaf\|from '@nx" apps/cockpit/e2e/*.ts examples/chat/aimock-e2e/*.ts 2>/dev/null | head -10
```

Expected: zero results. The existing harnesses use only relative imports (`./aimock-runner`, etc.), so we can't crib path-alias-in-Playwright pattern from existing code.

- [ ] **Step 2: Check if the repo uses tsconfig-paths or similar Node-side alias loaders**

```bash
grep -n "tsconfig-paths\|register" /tmp/aimock-harness/package.json /tmp/aimock-harness/playwright.config.* 2>/dev/null
```

Expected: probably empty. Note in the report.

- [ ] **Step 3: Test the alias one-shot**

Create scratch files:

```bash
mkdir -p /tmp/alias-test/lib/src /tmp/alias-test/consumer
cat > /tmp/alias-test/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "target": "ES2022",
    "esModuleInterop": true,
    "strict": true,
    "paths": {
      "@scratch/lib": ["lib/src/index.ts"]
    },
    "baseUrl": "."
  }
}
EOF

cat > /tmp/alias-test/lib/src/index.ts << 'EOF'
export const greeting = "hello from lib";
EOF

cat > /tmp/alias-test/consumer/playwright.config.ts << 'EOF'
import { greeting } from '@scratch/lib';
import { defineConfig } from '@playwright/test';
console.log('alias resolved:', greeting);
export default defineConfig({ testDir: '.' });
EOF

cd /tmp/alias-test/consumer
npx playwright test --list 2>&1 | head -10
```

Expected outcomes:
- (a) Prints `alias resolved: hello from lib` → Playwright honors paths. Use the alias.
- (b) Throws `Cannot find module '@scratch/lib'` → Playwright doesn't resolve paths. Fall back to relative imports in the implementation.

Report which outcome occurred.

Cleanup: `rm -rf /tmp/alias-test`.

- [ ] **Step 4: Report**

DE-RISK COMPLETE. Note:
- Whether the path alias resolved.
- If it didn't, the relative-import paths the spec needs to use:
  - From `cockpit/langgraph/streaming/angular/e2e/playwright.config.ts` → `libs/internal/aimock-harness/src/index.ts` is `../../../../../libs/internal/aimock-harness/src`.
  - From `cockpit/chat/tool-calls/angular/e2e/playwright.config.ts` → same depth, same relative path: `../../../../../libs/internal/aimock-harness/src`.

If aliases don't work, Tasks 6 and 7 swap import statements to use the relative path. The library's internal structure stays the same.

---

## Task 1: Scaffold `libs/internal/aimock-harness/`

**Files:**
- Create: `libs/internal/aimock-harness/project.json`
- Create: `libs/internal/aimock-harness/tsconfig.json`
- Create: `libs/internal/aimock-harness/README.md`
- Create: `libs/internal/aimock-harness/src/index.ts`

- [ ] **Step 1: Create project.json**

Write `libs/internal/aimock-harness/project.json`:

```json
{
  "name": "internal-aimock-harness",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "projectType": "library",
  "sourceRoot": "libs/internal/aimock-harness/src",
  "tags": ["scope:internal"],
  "targets": {
    "lint": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "libs/internal/aimock-harness",
        "command": "tsc --noEmit"
      }
    },
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "libs/internal/aimock-harness",
        "command": "vitest run"
      }
    }
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Write `libs/internal/aimock-harness/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create README.md**

Write `libs/internal/aimock-harness/README.md`:

```markdown
# @ngaf-internal/aimock-harness

Internal-only library that wraps [`@copilotkit/aimock`](https://github.com/CopilotKit/aimock) for our cockpit example aimock e2e suite.

NOT published. The `@ngaf-internal/*` namespace is reserved for internal libraries that are tightly coupled to repo-specific orchestration (langgraph + Angular dev server boot) and shouldn't appear in consumer-facing API surfaces.

## API

```typescript
import { createGlobalSetup, sendPromptAndWait } from '@ngaf-internal/aimock-harness';
```

- `createGlobalSetup(opts)` — returns a Playwright globalSetup function that boots aimock + langgraph + the named Angular dev server.
- `sendPromptAndWait(page, prompt, opts?)` — Playwright helper. Goes to a path (default `/`), sends the prompt, waits for `chat-message[data-role="assistant"][data-streaming="false"]`, returns the bubble locator.

## Per-example consumer shape

```
cockpit/<product>/<example>/angular/e2e/
├── playwright.config.ts         // imports createGlobalSetup, passes app-specific opts
├── global-setup-impl.ts         // re-exports createGlobalSetup({...}) as default
├── fixtures/<example>.json
├── scripts/record-<example>.py
└── <example>.spec.ts
```

See `cockpit/langgraph/streaming/angular/e2e/` for a working example.
```

- [ ] **Step 4: Create src/index.ts (skeleton)**

Write `libs/internal/aimock-harness/src/index.ts`:

```typescript
// SPDX-License-Identifier: MIT
export { startAimock, type AimockHandle, type AimockStartOptions } from './aimock-runner';
export { sendPromptAndWait, type SendPromptAndWaitOptions } from './test-helpers';
export { createGlobalSetup, type CreateGlobalSetupOpts } from './global-setup-factory';
```

(The imports point at files Tasks 2/3/5 create; this file is committed now and the modules are added in their tasks. tsc will fail until those tasks land — that's intentional and tracked by the per-task verification.)

- [ ] **Step 5: Commit Task 1**

```bash
cd /tmp/aimock-harness
git add libs/internal/aimock-harness/project.json \
        libs/internal/aimock-harness/tsconfig.json \
        libs/internal/aimock-harness/README.md \
        libs/internal/aimock-harness/src/index.ts
git commit -m "feat(internal-aimock-harness): scaffold internal library"
```

---

## Task 2: Port aimock-runner.ts + tests from chat harness

**Files:**
- Create: `libs/internal/aimock-harness/src/aimock-runner.ts`
- Create: `libs/internal/aimock-harness/src/aimock-runner.spec.ts`

- [ ] **Step 1: Copy aimock-runner.ts byte-for-byte from chat harness**

```bash
cd /tmp/aimock-harness
cp examples/chat/aimock-e2e/aimock-runner.ts libs/internal/aimock-harness/src/aimock-runner.ts
```

- [ ] **Step 2: Copy aimock-runner.spec.ts byte-for-byte**

```bash
cp examples/chat/aimock-e2e/aimock-runner.spec.ts libs/internal/aimock-harness/src/aimock-runner.spec.ts
```

The spec's `import { startAimock, type AimockHandle } from './aimock-runner';` is already correct for the new location (same relative).

- [ ] **Step 3: Run vitest on the new lib**

```bash
cd /tmp/aimock-harness/libs/internal/aimock-harness
npx vitest run aimock-runner.spec.ts
```

Expected: 3 passed (boots replay server, stop is idempotent, loads directory of fixtures).

- [ ] **Step 4: Commit Task 2**

```bash
cd /tmp/aimock-harness
git add libs/internal/aimock-harness/src/aimock-runner.ts \
        libs/internal/aimock-harness/src/aimock-runner.spec.ts
git commit -m "feat(internal-aimock-harness): port aimock-runner + tests from chat harness"
```

---

## Task 3: Implement test-helpers.ts with configurable path

**Files:**
- Create: `libs/internal/aimock-harness/src/test-helpers.ts`
- Create: `libs/internal/aimock-harness/src/test-helpers.spec.ts`

- [ ] **Step 1: Write test-helpers.ts**

Write `libs/internal/aimock-harness/src/test-helpers.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { expect, type Locator, type Page } from '@playwright/test';

export interface SendPromptAndWaitOptions {
  /** Route to navigate to before sending the prompt. Default: '/'. */
  path?: string;
}

/**
 * Send a user prompt and wait for the assistant bubble to finalize.
 *
 * "Finalized" means `chat-message[data-role="assistant"][data-streaming="false"]`:
 * the chat composition wires `[streaming]` to `agent.isLoading() && i === lastIndex`
 * on the latest assistant `<chat-message>`, so the attribute flips to `"false"`
 * once the agent stops loading and the markdown render has settled.
 *
 * Asserting on intermediate streaming-state DOM (partial `<ul>`, in-flight
 * code fences, etc.) is the source of e2e flake — always wait on this
 * attribute before counting or text-matching downstream of the assistant turn.
 */
export async function sendPromptAndWait(
  page: Page,
  prompt: string,
  opts?: SendPromptAndWaitOptions,
): Promise<Locator> {
  const path = opts?.path ?? '/';
  await page.goto(path);
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(prompt);
  await page.getByRole('button', { name: /send/i }).click();

  const finalizedAssistant = page
    .locator('chat-message[data-role="assistant"][data-streaming="false"]')
    .last();
  await expect(finalizedAssistant).toBeAttached({ timeout: 45_000 });
  await expect
    .poll(async () => ((await finalizedAssistant.innerText()) ?? '').trim().length, {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  return finalizedAssistant;
}
```

- [ ] **Step 2: Write a small unit test for the path defaulting**

Write `libs/internal/aimock-harness/src/test-helpers.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import type { SendPromptAndWaitOptions } from './test-helpers';

// The helper itself is integration-level (drives a real Playwright page);
// per-example specs exercise it. This file just locks in the type contract.

describe('SendPromptAndWaitOptions', () => {
  it('accepts an empty options object', () => {
    const opts: SendPromptAndWaitOptions = {};
    expect(opts.path).toBeUndefined();
  });

  it('accepts a path override', () => {
    const opts: SendPromptAndWaitOptions = { path: '/embed' };
    expect(opts.path).toBe('/embed');
  });
});
```

- [ ] **Step 3: Run vitest**

```bash
cd /tmp/aimock-harness/libs/internal/aimock-harness
npx vitest run test-helpers.spec.ts
```

Expected: 2 passed.

- [ ] **Step 4: Commit Task 3**

```bash
cd /tmp/aimock-harness
git add libs/internal/aimock-harness/src/test-helpers.ts \
        libs/internal/aimock-harness/src/test-helpers.spec.ts
git commit -m "feat(internal-aimock-harness): test-helpers with configurable path"
```

---

## Task 4: Implement global-teardown.ts

**Files:**
- Create: `libs/internal/aimock-harness/src/global-teardown.ts`

- [ ] **Step 1: Write global-teardown.ts**

Write `libs/internal/aimock-harness/src/global-teardown.ts`:

```typescript
// SPDX-License-Identifier: MIT
import type { ChildProcess } from 'node:child_process';
import type { AimockHandle } from './aimock-runner';

interface SharedState {
  aimock: AimockHandle;
  langgraph: ChildProcess;
  angular: ChildProcess;
}

declare global {
  // eslint-disable-next-line no-var
  var __AIMOCK_HARNESS_STATE__: Map<string, SharedState> | undefined;
}

/**
 * Default Playwright globalTeardown. Walks every state slot the factory
 * registered (one per Angular project), kills processes in reverse order
 * (Angular → langgraph → aimock), awaits aimock stop. Idempotent.
 */
export default async function globalTeardown(): Promise<void> {
  const states = globalThis.__AIMOCK_HARNESS_STATE__;
  if (!states) return;
  for (const state of states.values()) {
    state.angular.kill('SIGTERM');
    state.langgraph.kill('SIGTERM');
    await state.aimock.stop();
  }
  globalThis.__AIMOCK_HARNESS_STATE__ = undefined;
}
```

- [ ] **Step 2: Type-check**

```bash
cd /tmp/aimock-harness/libs/internal/aimock-harness
npx tsc --noEmit
```

Expected: errors only on `global-setup-factory.ts` (Task 5 hasn't created it yet). The error list should mention only `global-setup-factory` and the index re-export of it. If anything else fails, STOP.

- [ ] **Step 3: Commit Task 4**

```bash
cd /tmp/aimock-harness
git add libs/internal/aimock-harness/src/global-teardown.ts
git commit -m "feat(internal-aimock-harness): global-teardown with multi-slot state"
```

---

## Task 5: Implement global-setup-factory.ts

**Files:**
- Create: `libs/internal/aimock-harness/src/global-setup-factory.ts`

- [ ] **Step 1: Write global-setup-factory.ts**

Write `libs/internal/aimock-harness/src/global-setup-factory.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { startAimock, type AimockHandle } from './aimock-runner';

export interface CreateGlobalSetupOpts {
  /** Repo-relative path to the python langgraph project. */
  langgraphCwd: string;
  /** Port the langgraph dev server binds. Default: 8123. */
  langgraphPort?: number;
  /** Nx project name of the Angular dev server. */
  angularProject: string;
  /** Port the Angular dev server should bind. */
  angularPort: number;
  /** Absolute path to the per-example fixtures dir. */
  fixturesDir: string;
  /** Default 90_000. */
  langgraphReadyTimeoutMs?: number;
  /** Default 120_000. */
  angularReadyTimeoutMs?: number;
}

interface SharedState {
  aimock: AimockHandle;
  langgraph: ChildProcess;
  angular: ChildProcess;
}

declare global {
  // eslint-disable-next-line no-var
  var __AIMOCK_HARNESS_STATE__: Map<string, SharedState> | undefined;
}

async function waitForPort(url: string, timeoutMs: number, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // server not up yet
    }
    await delay(500);
  }
  throw new Error(`[${label}] not ready at ${url} within ${timeoutMs}ms`);
}

function repoRoot(opts: CreateGlobalSetupOpts): string {
  // The factory is called from per-example playwright configs that themselves
  // live many levels deep. We compute REPO_ROOT relative to the fixturesDir
  // (which the consumer passes as an absolute path) so the consumer doesn't
  // need to pass it explicitly. The repo root is the nearest ancestor that
  // contains a `cockpit/` directory; for our layout, walking up from any
  // per-example fixturesDir hits the repo root in 5 levels.
  let dir = opts.fixturesDir;
  for (let i = 0; i < 10; i++) {
    if (require('node:fs').existsSync(require('node:path').join(dir, 'cockpit'))) {
      return dir;
    }
    dir = require('node:path').dirname(dir);
  }
  throw new Error('repo root not found from fixturesDir; passed: ' + opts.fixturesDir);
}

export function createGlobalSetup(opts: CreateGlobalSetupOpts): () => Promise<void> {
  const langgraphPort = opts.langgraphPort ?? 8123;
  const langgraphTimeout = opts.langgraphReadyTimeoutMs ?? 90_000;
  const angularTimeout = opts.angularReadyTimeoutMs ?? 120_000;

  return async function globalSetup(): Promise<void> {
    const root = repoRoot(opts);
    const aimock = await startAimock({ mode: 'replay', fixturePath: opts.fixturesDir });
    // eslint-disable-next-line no-console
    console.log(`[aimock-harness] aimock listening at ${aimock.baseUrl}`);

    const langgraph = spawn(
      'uv',
      ['run', 'langgraph', 'dev', '--port', String(langgraphPort), '--no-browser'],
      {
        cwd: resolve(root, opts.langgraphCwd),
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

    await waitForPort(`http://localhost:${langgraphPort}/ok`, langgraphTimeout, 'langgraph');
    // eslint-disable-next-line no-console
    console.log(`[aimock-harness] langgraph ready on :${langgraphPort}`);

    const angular = spawn(
      'npx',
      ['nx', 'serve', opts.angularProject, '--port', String(opts.angularPort)],
      {
        cwd: root,
        env: { ...process.env },
        stdio: 'pipe',
      },
    );
    angular.stdout?.on('data', (b) => process.stdout.write(`[angular] ${b}`));
    angular.stderr?.on('data', (b) => process.stderr.write(`[angular] ${b}`));

    await waitForPort(`http://localhost:${opts.angularPort}/`, angularTimeout, 'angular');
    // eslint-disable-next-line no-console
    console.log(`[aimock-harness] angular ready on :${opts.angularPort} (${opts.angularProject})`);

    if (!globalThis.__AIMOCK_HARNESS_STATE__) {
      globalThis.__AIMOCK_HARNESS_STATE__ = new Map();
    }
    globalThis.__AIMOCK_HARNESS_STATE__.set(opts.angularProject, { aimock, langgraph, angular });
  };
}
```

- [ ] **Step 2: Type-check the whole library**

```bash
cd /tmp/aimock-harness/libs/internal/aimock-harness
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all lib tests**

```bash
cd /tmp/aimock-harness/libs/internal/aimock-harness
npx vitest run
```

Expected: 5 passed (3 from aimock-runner + 2 from test-helpers).

- [ ] **Step 4: Commit Task 5**

```bash
cd /tmp/aimock-harness
git add libs/internal/aimock-harness/src/global-setup-factory.ts
git commit -m "feat(internal-aimock-harness): createGlobalSetup factory"
```

---

## Task 6: Wire path alias (or use relative imports per Task 0 finding)

**Files:**
- Modify: root tsconfig (`tsconfig.json` or `tsconfig.base.json`)

If Task 0 reported aliases work, do this task. Otherwise SKIP and note in your report that consumers will use relative imports; Tasks 7 and 8 use the relative paths instead.

- [ ] **Step 1: Locate the root tsconfig with `paths`**

```bash
cd /tmp/aimock-harness
test -f tsconfig.base.json && echo "base" || (test -f tsconfig.json && echo "root")
grep -l '"paths"' /tmp/aimock-harness/tsconfig*.json
```

Use whichever file already declares `paths` for `@ngaf/*` (or similar). If neither exists with paths, add to `tsconfig.json` (the root).

- [ ] **Step 2: Add the alias**

In the chosen tsconfig file, add to `compilerOptions.paths`:

```json
"@ngaf-internal/aimock-harness": ["libs/internal/aimock-harness/src/index.ts"],
"@ngaf-internal/aimock-harness/global-teardown": ["libs/internal/aimock-harness/src/global-teardown.ts"]
```

Verify the file is valid JSON:
```bash
python3 -c "import json; json.load(open('<path>'))" && echo "OK"
```

- [ ] **Step 3: Commit Task 6**

```bash
cd /tmp/aimock-harness
git add <the-tsconfig-file>
git commit -m "chore(tsconfig): add @ngaf-internal/aimock-harness path alias"
```

If Task 0 found aliases don't resolve in Playwright, commit message is irrelevant — skip this task entirely.

---

## Task 7: Migrate the streaming spec to per-example layout

**Files:**
- Create: `cockpit/langgraph/streaming/angular/e2e/playwright.config.ts`
- Create: `cockpit/langgraph/streaming/angular/e2e/global-setup-impl.ts`
- Create: `cockpit/langgraph/streaming/angular/e2e/tsconfig.json`
- Create: `cockpit/langgraph/streaming/angular/e2e/.gitignore`
- Create: `cockpit/langgraph/streaming/angular/e2e/fixtures/streaming.json` (copied from existing)
- Create: `cockpit/langgraph/streaming/angular/e2e/scripts/record-streaming.py` (copied from existing)
- Create: `cockpit/langgraph/streaming/angular/e2e/streaming.spec.ts` (copied + import fixed)
- Modify: `cockpit/langgraph/streaming/angular/project.json` (add `e2e` target)

This task migrates the Phase 1 spec verbatim to its new home. Task 9 deletes the old `apps/cockpit/e2e/` location.

- [ ] **Step 1: Create the playwright config**

Write `cockpit/langgraph/streaming/angular/e2e/playwright.config.ts`. **Use the alias if Task 0 confirmed it works; otherwise use the relative import path the de-risk reported.**

```typescript
// SPDX-License-Identifier: MIT
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4300',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './global-setup-impl.ts',
  globalTeardown: require.resolve('@ngaf-internal/aimock-harness/global-teardown'),
});
```

If aliases don't work: replace the `globalTeardown` line with `globalTeardown: require.resolve('../../../../../libs/internal/aimock-harness/src/global-teardown'),`.

- [ ] **Step 2: Create global-setup-impl.ts**

Write `cockpit/langgraph/streaming/angular/e2e/global-setup-impl.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/aimock-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/streaming/python',
  angularProject: 'cockpit-langgraph-streaming-angular',
  angularPort: 4300,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
```

If aliases don't work: replace the `import` with `import { createGlobalSetup } from '../../../../../libs/internal/aimock-harness/src';`.

- [ ] **Step 3: Create tsconfig.json + .gitignore**

Write `cockpit/langgraph/streaming/angular/e2e/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "test-results", "playwright-report"]
}
```

Write `cockpit/langgraph/streaming/angular/e2e/.gitignore`:

```
test-results/
playwright-report/
*.tmp
```

- [ ] **Step 4: Copy the streaming fixture, capture script, and spec from the old location**

```bash
cd /tmp/aimock-harness
mkdir -p cockpit/langgraph/streaming/angular/e2e/fixtures cockpit/langgraph/streaming/angular/e2e/scripts
cp apps/cockpit/e2e/fixtures/streaming.json cockpit/langgraph/streaming/angular/e2e/fixtures/streaming.json
cp apps/cockpit/e2e/scripts/record-streaming.py cockpit/langgraph/streaming/angular/e2e/scripts/record-streaming.py
cp apps/cockpit/e2e/streaming.spec.ts cockpit/langgraph/streaming/angular/e2e/streaming.spec.ts
```

The streaming.spec.ts currently imports `from './test-helpers'`. Update it to use the library:

```bash
cd /tmp/aimock-harness
# Edit cockpit/langgraph/streaming/angular/e2e/streaming.spec.ts:
# Change: import { sendPromptAndWait } from './test-helpers';
# To:     import { sendPromptAndWait } from '@ngaf-internal/aimock-harness';
# (or the relative path if aliases don't work)
```

- [ ] **Step 5: Add the `e2e` target to the angular project**

Open `cockpit/langgraph/streaming/angular/project.json`. Add to `targets`:

```json
"e2e": {
  "executor": "@nx/playwright:playwright",
  "options": {
    "config": "cockpit/langgraph/streaming/angular/e2e/playwright.config.ts"
  }
}
```

Verify JSON is valid:
```bash
python3 -c "import json; json.load(open('cockpit/langgraph/streaming/angular/project.json'))" && echo "OK"
```

- [ ] **Step 6: Run the migrated spec**

```bash
cd /tmp/aimock-harness
cp /Users/blove/repos/angular-agent-framework/examples/chat/python/.env cockpit/langgraph/streaming/python/.env
node libs/licensing/scripts/generate-public-key.mjs 2>&1 | tail -1
npx playwright install --with-deps chromium
npx nx e2e cockpit-langgraph-streaming-angular
```

Expected: 1 test passes (the migrated streaming spec). Wall-clock ~60-120s.

If the test fails, STOP and report. Likely causes:
- Path alias / relative import still wrong.
- `repoRoot()` heuristic in the factory didn't land on the correct dir — check the log lines from `[aimock-harness]`.
- langgraph or Angular fail to start — check `[langgraph]` / `[angular]` log lines.

- [ ] **Step 7: Commit Task 7**

```bash
cd /tmp/aimock-harness
git add cockpit/langgraph/streaming/angular/e2e/ cockpit/langgraph/streaming/angular/project.json
git commit -m "feat(cockpit-langgraph-streaming): migrate aimock e2e to per-example layout"
```

---

## Task 8: Add c-tool-calls e2e (capture fixture + write spec)

**Files:**
- Create: `cockpit/chat/tool-calls/angular/e2e/playwright.config.ts`
- Create: `cockpit/chat/tool-calls/angular/e2e/global-setup-impl.ts`
- Create: `cockpit/chat/tool-calls/angular/e2e/tsconfig.json`
- Create: `cockpit/chat/tool-calls/angular/e2e/.gitignore`
- Create: `cockpit/chat/tool-calls/angular/e2e/scripts/record-c-tool-calls.py`
- Create: `cockpit/chat/tool-calls/angular/e2e/fixtures/c-tool-calls.json` (generated by script)
- Create: `cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts`
- Modify: `cockpit/chat/tool-calls/angular/project.json` (add `e2e` target)

- [ ] **Step 1: Create the per-example dir scaffolding**

Write `cockpit/chat/tool-calls/angular/e2e/playwright.config.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4504',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './global-setup-impl.ts',
  globalTeardown: require.resolve('@ngaf-internal/aimock-harness/global-teardown'),
});
```

(If aliases don't work: same relative-path swap as Task 7 Step 1.)

Write `cockpit/chat/tool-calls/angular/e2e/global-setup-impl.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/aimock-harness';

export default createGlobalSetup({
  langgraphCwd: 'cockpit/langgraph/streaming/python',
  angularProject: 'cockpit-chat-tool-calls-angular',
  angularPort: 4504,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
```

Write `cockpit/chat/tool-calls/angular/e2e/tsconfig.json` and `.gitignore` — same content as Task 7 Step 3.

- [ ] **Step 2: Write the capture script**

Write `cockpit/chat/tool-calls/angular/e2e/scripts/record-c-tool-calls.py`:

```python
"""Capture parent first-call (tool_call) + continuation (text) for c-tool-calls.

Mirrors cockpit/langgraph/streaming/python/src/chat_graphs.py's
_build_tool_calls_graph() LLM setup: ChatOpenAI(gpt-5-mini, streaming=True)
bound with AVIATION_TOOLS, system prompt from prompts/tool-calls.md.

Two LLM calls captured, written into one fixture with the hasToolResult
discriminator on the continuation entry.

Run from repo root:
  OPENAI_API_KEY=sk-... uv run --project cockpit/langgraph/streaming/python \\
    python cockpit/chat/tool-calls/angular/e2e/scripts/record-c-tool-calls.py
"""
import json
import os
import sys
import uuid
from pathlib import Path

env_path = Path("cockpit/langgraph/streaming/python/.env")
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

if not os.environ.get("OPENAI_API_KEY"):
    print("OPENAI_API_KEY not set", file=sys.stderr)
    sys.exit(1)

sys.path.insert(0, str(Path("cockpit/langgraph/streaming/python/src").resolve()))

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI

from src.aviation_tools import AVIATION_TOOLS, lookup_flight  # type: ignore

PROMPT = "What's the status of UA123?"
SYSTEM_PROMPT = (
    Path("cockpit/langgraph/streaming/python/prompts/tool-calls.md").read_text()
)

llm = ChatOpenAI(model="gpt-5-mini", temperature=0).bind_tools(AVIATION_TOOLS)

# 1. Parent's first call.
first = llm.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=PROMPT)])
assert first.tool_calls, f"Parent did not emit tool_calls; content={first.content!r}"
tc = first.tool_calls[0]
tc_args = tc.get("args") or {}
tc_id = tc.get("id") or f"call_{uuid.uuid4().hex[:12]}"
print(f"1. parent tool_call name={tc.get('name')} args={tc_args}")

# 2. Tool result (real lookup_flight).
tool_result = lookup_flight.invoke(tc_args)  # returns canned aviation data
print(f"2. tool result length={len(str(tool_result))}")

# 3. Parent's continuation call.
continuation = llm.invoke(
    [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=PROMPT),
        AIMessage(
            content="",
            tool_calls=[{"name": tc.get("name"), "args": tc_args, "id": tc_id, "type": "tool_call"}],
        ),
        ToolMessage(content=str(tool_result), tool_call_id=tc_id),
    ],
)
text = continuation.content if isinstance(continuation.content, str) else ""
if not text.strip():
    print("Continuation returned empty; aborting", file=sys.stderr)
    sys.exit(2)
print(f"3. continuation: {len(text)} chars; first 80: {text[:80]!r}")

fixture = {
    "fixtures": [
        # ORDER MATTERS: continuation match is more specific (hasToolResult);
        # aimock evaluates fixtures top-to-bottom and picks the first match.
        {
            "match": {"userMessage": PROMPT, "hasToolResult": True},
            "response": {"content": text},
        },
        {
            "match": {"userMessage": PROMPT},
            "response": {"toolCalls": [{"name": tc.get("name"), "arguments": tc_args}]},
        },
    ]
}

out_path = Path("cockpit/chat/tool-calls/angular/e2e/fixtures/c-tool-calls.json")
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(fixture, indent=2) + "\n")
print(f"\nWrote fixture to {out_path}")
```

- [ ] **Step 3: Run the capture script**

```bash
cd /tmp/aimock-harness
uv run --project cockpit/langgraph/streaming/python python cockpit/chat/tool-calls/angular/e2e/scripts/record-c-tool-calls.py
```

Expected: prints all three steps; writes the fixture.

If the parent doesn't emit `tool_calls`: STOP. Check that the `tool-calls.md` prompt is asking the LLM to use tools (it should after PR #347).

- [ ] **Step 4: Inspect the fixture and pick a phrase**

```bash
head -50 cockpit/chat/tool-calls/angular/e2e/fixtures/c-tool-calls.json
```

Pick a 1-2 word phrase from the continuation `content` that's likely to render verbatim. Good candidates: `UA123`, the flight number, or specific flight detail wording (e.g., `delayed`, `on time`, an airport code).

- [ ] **Step 5: Write the spec**

Write `cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts` (replace `<DISTINCTIVE_PHRASE>` with the phrase from Step 4):

```typescript
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { sendPromptAndWait } from '@ngaf-internal/aimock-harness';

const PROMPT = "What's the status of UA123?";

test('c-tool-calls: parent dispatches lookup_flight tool, continuation surfaces flight data', async ({ page }) => {
  const bubble = await sendPromptAndWait(page, PROMPT);

  // The chat-tool-calls primitive renders a card per tool call. Card label
  // includes the tool name. Asserting it's in the DOM proves the parent's
  // tool_call routed through the chat-tool-calls UI primitive.
  const toolCallChip = page.getByRole('button', { name: /lookup_flight|tool/i }).first();
  await expect(toolCallChip).toBeVisible({ timeout: 30_000 });

  // The continuation's text mentions a distinctive phrase from the captured
  // response — proves the tool-result-then-text loop completed end-to-end.
  const finalText = await bubble.innerText();
  expect(finalText.toLowerCase()).toContain('<DISTINCTIVE_PHRASE>'.toLowerCase());
});
```

(If aliases don't work: `import { sendPromptAndWait } from '../../../../../libs/internal/aimock-harness/src';`)

- [ ] **Step 6: Add the e2e target to the angular project**

Open `cockpit/chat/tool-calls/angular/project.json`. Add to `targets`:

```json
"e2e": {
  "executor": "@nx/playwright:playwright",
  "options": {
    "config": "cockpit/chat/tool-calls/angular/e2e/playwright.config.ts"
  }
}
```

Verify JSON valid:
```bash
python3 -c "import json; json.load(open('cockpit/chat/tool-calls/angular/project.json'))" && echo "OK"
```

- [ ] **Step 7: Run the spec**

```bash
cd /tmp/aimock-harness
npx nx e2e cockpit-chat-tool-calls-angular
```

Expected: 1 test passes within ~60-120s.

If it fails:
- "tool call chip not visible" → inspect the trace; the chip's accessible name may differ from `lookup_flight`. Adjust the selector.
- "innerText missing the phrase" → pick a different phrase from the fixture's content that's more likely to render verbatim.
- "no chat-message" → harness wiring problem; check `[aimock-harness]` log lines and `cockpit-chat-tool-calls-angular`'s app code (it should use `<chat>` per `tool-calls.component.ts`).

- [ ] **Step 8: Stability check**

Run 3 consecutive runs with port cooldown:

```bash
for i in 1 2 3; do
  echo "=== Run $i ==="
  rm -rf cockpit/chat/tool-calls/angular/e2e/test-results cockpit/chat/tool-calls/angular/e2e/playwright-report
  sleep 8
  npx nx e2e cockpit-chat-tool-calls-angular
done
```

Expected: 3/3 pass.

- [ ] **Step 9: Commit Task 8**

```bash
cd /tmp/aimock-harness
git add cockpit/chat/tool-calls/angular/e2e/ cockpit/chat/tool-calls/angular/project.json
git commit -m "test(cockpit-chat-tool-calls): aimock e2e — multi-turn tool-call flow"
```

---

## Task 9: Delete `apps/cockpit/e2e/` and remove its target

**Files:**
- Delete: entire `apps/cockpit/e2e/` directory
- Modify: `apps/cockpit/project.json` (remove `e2e` target)

- [ ] **Step 1: Delete the old dir**

```bash
cd /tmp/aimock-harness
git rm -r apps/cockpit/e2e/
```

Expected: removes the harness scaffolding, fixtures, scripts, and the streaming spec (already migrated in Task 7).

- [ ] **Step 2: Remove the e2e target from apps/cockpit/project.json**

Open `apps/cockpit/project.json` and locate the `"e2e"` target block:

```json
    "e2e": {
      "executor": "@nx/playwright:playwright",
      "options": {
        "config": "apps/cockpit/e2e/playwright.config.ts"
      }
    },
```

Delete the entire `"e2e": { ... }` entry (and adjust trailing commas in the surrounding JSON).

Verify the file is still valid JSON:
```bash
python3 -c "import json; json.load(open('apps/cockpit/project.json'))" && echo "OK"
```

- [ ] **Step 3: Verify nothing references the deleted dir**

```bash
cd /tmp/aimock-harness
grep -rn "apps/cockpit/e2e/\|nx e2e cockpit\b" \
  --include='*.ts' --include='*.json' --include='*.yml' --include='*.md' \
  | grep -v 'node_modules\|test-results\|playwright-report\|docs/superpowers/'
```

Expected: zero matches (the docs under `docs/superpowers/` are excluded since they document the migration).

If any matches remain, STOP and report.

- [ ] **Step 4: Commit Task 9**

```bash
cd /tmp/aimock-harness
git add apps/cockpit/project.json
git commit -m "chore(cockpit): drop legacy apps/cockpit/e2e (migrated to per-example dirs)"
```

The `git rm -r` from Step 1 staged the deletions; the `git add` here stages the project.json modification.

---

## Task 10: Update CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Locate and update the cockpit-e2e job**

Open `.github/workflows/ci.yml`, find the `cockpit-e2e` job. The `npx nx e2e cockpit` line needs to change to `npx nx run-many --target=e2e --projects=cockpit-*-angular --parallel=1 --skip-nx-cache`.

Updated job body:

```yaml
  cockpit-e2e:
    name: Cockpit — e2e
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
      - working-directory: cockpit/langgraph/streaming/python
        run: uv sync
      - run: npx playwright install --with-deps chromium
      - run: npx nx run-many --target=e2e --projects=cockpit-*-angular --parallel=1 --skip-nx-cache
      - name: Upload Playwright trace on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cockpit-e2e-trace
          path: |
            cockpit/**/angular/e2e/test-results/
          retention-days: 7
```

Note the trace upload path now uses a glob across all per-example test-results dirs.

- [ ] **Step 2: Verify YAML parses**

```bash
cd /tmp/aimock-harness
npx -y js-yaml .github/workflows/ci.yml > /dev/null && echo "OK"
```

- [ ] **Step 3: Commit Task 10**

```bash
cd /tmp/aimock-harness
git add .github/workflows/ci.yml
git commit -m "ci(cockpit): nx run-many for per-example aimock e2e"
```

---

## Task 11: Verify, push, open PR

- [ ] **Step 1: Run nx run-many locally**

```bash
cd /tmp/aimock-harness
npx nx run-many --target=e2e --projects=cockpit-*-angular --parallel=1 --skip-nx-cache
```

Expected: 2 projects targeted (`cockpit-langgraph-streaming-angular` + `cockpit-chat-tool-calls-angular`); both pass.

If it fails for either, STOP and report.

- [ ] **Step 2: Run library unit tests one final time**

```bash
cd /tmp/aimock-harness/libs/internal/aimock-harness
npx vitest run
```

Expected: 5 passed.

- [ ] **Step 3: Confirm working tree clean**

```bash
cd /tmp/aimock-harness
git status --short
```

Expected: empty (only `node_modules` symlink + any test-results dirs as untracked).

Remove any stray `cockpit/langgraph/streaming/python/.env` (gitignored, but verify): `rm -f cockpit/langgraph/streaming/python/.env`.

- [ ] **Step 4: Push**

```bash
cd /tmp/aimock-harness
git push -u origin claude/aimock-harness-lib
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --title "feat(cockpit): aimock harness library + per-example e2e layout (Phase 2)" --body "$(cat <<'EOF'
## Summary

Phase 2 of the cockpit aimock e2e plan. Restructures the harness so each cockpit example owns its own e2e dir next to its Angular app, backed by a shared internal library (`libs/internal/aimock-harness`).

- **New library** `@ngaf-internal/aimock-harness` exporting `createGlobalSetup`, `sendPromptAndWait`, `startAimock`, and a default global-teardown. Internal-only (not published).
- **Migrated** the Phase 1 streaming spec to `cockpit/langgraph/streaming/angular/e2e/`.
- **Added** `c-tool-calls` as the first new-pattern example with full multi-turn fixture (parent tool_call → tool result → continuation). Asserts the chat-tool-calls UI primitive activates AND the continuation's text surfaces flight data from the captured response.
- **Deleted** `apps/cockpit/e2e/` entirely; dropped the e2e target from `apps/cockpit/project.json`.
- **CI** `Cockpit — e2e` job now runs `nx run-many --target=e2e --projects=cockpit-*-angular --parallel=1`.

Sits on Phase 1 (#349) + the c-* aviation refactor (#347 + #350).

## Test plan

- [x] Library vitest suite green (5 tests)
- [x] streaming spec passes 3/3 stability runs after migration
- [x] c-tool-calls spec passes 3/3 stability runs
- [x] `nx run-many --target=e2e --projects=cockpit-*-angular --parallel=1` runs both green
- [x] No production code touched (only harness lib, per-example e2e dirs, project.json e2e target additions/removal, CI workflow)
- [ ] CI green on this PR

## Notes for reviewers

- Each future cockpit example PR is now small: one new `e2e/` dir under the example's angular app, one fixture, one spec, one project.json `e2e` target. The library handles all orchestration.
- Path-alias resolution at Playwright runtime was de-risked in Task 0 (the implementer reports the result in the PR body if a fallback to relative imports was needed).
- Module duplication with the chat aimock harness (`examples/chat/aimock-e2e/aimock-runner.ts` etc.) is intentional and untouched here. Migrating the chat harness onto this library is a separate cleanup PR.

Spec: `docs/superpowers/specs/2026-05-15-cockpit-aimock-harness-lib-design.md`
Plan: `docs/superpowers/plans/2026-05-15-cockpit-aimock-harness-lib.md`
EOF
)"
```

- [ ] **Step 6: Watch CI**

```bash
gh pr checks <PR-NUMBER> --watch --interval 30
```

Report when CI completes.

---

## Self-review checklist

- [x] Spec coverage:
  - Library scaffolding → Tasks 1-5
  - Path alias → Task 6 (skippable per Task 0 finding)
  - Streaming migration → Task 7
  - c-tool-calls → Task 8
  - Old dir deletion → Task 9
  - CI update → Task 10
  - Risks (path alias, port collisions) → Task 0 + `--parallel=1` flag in Task 10
- [x] Placeholder scan: no TBD/TODO. Path-alias and `<DISTINCTIVE_PHRASE>` are intentional implementer-fills based on Task 0 / Task 8 Step 4 findings.
- [x] Type consistency: `AimockHandle`, `AimockStartOptions`, `startAimock`, `sendPromptAndWait`, `createGlobalSetup`, `CreateGlobalSetupOpts` all consistent across tasks.
- [x] Constraints: `@copilotkit/aimock` only in TS imports, package.json, plan/spec/README. Not in commit messages.

## Execution handoff

Plan complete. Recommended: **subagent-driven-development** with Task 0 dispatched first as a blocking gate. If Task 0 finds aliases don't resolve, the implementer adapts Tasks 7 + 8 to use relative imports throughout (and skips Task 6).
