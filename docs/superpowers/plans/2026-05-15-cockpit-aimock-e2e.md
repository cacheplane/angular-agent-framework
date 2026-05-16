# Cockpit aimock E2E — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the existing cockpit e2e surface at `apps/cockpit/e2e/` with an aimock-driven harness, with one pilot spec exercising the `c-messages` example through aimock end-to-end. Existing `cockpit` Nx project's `e2e` target is repointed at the new playwright config; no new Nx project is created.

**Architecture:** Harness mirroring `examples/chat/aimock-e2e/`, living at `apps/cockpit/e2e/`. Playwright globalSetup boots aimock + `cockpit/langgraph/streaming/python` (multi-graph langgraph) + the `cockpit-chat-messages-angular` dev server. Pilot spec captures a real LLM text response, asserts the finalized assistant bubble carries a distinctive phrase.

**Tech Stack:** `@copilotkit/aimock`, Playwright, Nx, GitHub Actions. Python LangGraph dev server via `uv`.

**Spec:** [docs/superpowers/specs/2026-05-15-cockpit-aimock-e2e-design.md](../specs/2026-05-15-cockpit-aimock-e2e-design.md)

---

## Working environment

- Worktree: `/tmp/cockpit-aimock-spec` (branch `claude/cockpit-aimock-e2e-design`).
- `node_modules` is symlinked from main checkout; `npx` and `nx` work directly. (If the worktree was recreated, run `ln -sf /Users/blove/repos/angular-agent-framework/node_modules /tmp/cockpit-aimock-spec/node_modules`.)
- Copy `.env` for capture: `cp /Users/blove/repos/angular-agent-framework/examples/chat/python/.env cockpit/langgraph/streaming/python/.env` (the cockpit langgraph project doesn't keep its own .env — `OPENAI_API_KEY` is reused).
- Generate the licensing public key if missing: `node libs/licensing/scripts/generate-public-key.mjs`.
- License header `// SPDX-License-Identifier: MIT` on line 1 of every new TS file.
- One commit per task. DO NOT push, amend, or `git add -A`.
- Two commits (spec + plan) already exist on the branch.

## Coordination with open PR #339

PR #339 modifies `apps/cockpit/playwright.config.ts` (which this plan deletes outright). Merge order:
1. #339 lands first.
2. Pull main into this branch (`git fetch origin main && git merge origin/main`).
3. Task 7 of this plan deletes the file #339 modified — Git resolves cleanly (a delete-vs-edit conflict resolves to "deleted").

If #339 hasn't merged when this work starts, proceed anyway — the merge conflict is mechanical.

---

## Task 0: De-risk cockpit-langgraph + aimock integration

**Files:** None (investigation only).

The chat harness verified `examples/chat/python` honors `OPENAI_BASE_URL`. The cockpit `streaming/python` agent has a different code path. Verify before any code lands.

- [ ] **Step 1: Verify no hardcoded base_url in cockpit streaming agent code**

Run:
```bash
grep -rn "base_url\|ChatOpenAI\|OpenAI(" cockpit/langgraph/streaming/python/src/ | head -30
```

Expected: zero `base_url=` arguments. ChatOpenAI / OpenAI constructors should accept the env var by default.

If any hardcoded `base_url=` is found that overrides `OPENAI_BASE_URL`: STOP, report. Spec may need a workaround.

- [ ] **Step 2: Inspect the c-messages graph setup**

Read `cockpit/langgraph/streaming/python/src/chat_graphs.py` — find `_build_prompt_graph` and confirm `c_messages = _build_prompt_graph("messages.md")` is registered. Read `cockpit/langgraph/streaming/python/prompts/messages.md` to see the system prompt the LLM is bottled with. Note both in your report.

Expected: single-node graph that calls `ChatOpenAI(model="gpt-5-mini", streaming=True).ainvoke(messages)`. No tool bindings.

- [ ] **Step 3: Smoke-test the aimock + streaming-python flow**

Create scratch fixture at `/tmp/cockpit-tc-fixture.json` (text response — `c-messages` doesn't bind tools, so the mock returns plain content):

```json
{
  "fixtures": [
    {
      "match": { "userMessage": "say hi briefly" },
      "response": { "content": "Hello from cockpit-streaming!" }
    }
  ]
}
```

In one terminal, start aimock + langgraph:
```bash
cd /tmp/cockpit-aimock-spec
npm install --no-save --no-package-lock @copilotkit/aimock openai

# Inline node script that starts aimock and keeps it alive
node -e "
const { LLMock } = require('@copilotkit/aimock');
const fs = require('fs');
const mock = new LLMock({ port: 0, chunkSize: 4096 });
const fx = JSON.parse(fs.readFileSync('/tmp/cockpit-tc-fixture.json', 'utf-8'));
mock.addFixturesFromJSON(fx.fixtures);
mock.start().then(() => console.log('AIMOCK_BASE_URL=' + mock.url + '/v1'));
" &
NODE_PID=$!
sleep 3
# Capture the URL printed; pass it to langgraph below.
# NOTE: keep this node process alive; kill with `kill $NODE_PID` after step 4.
```

Verify aimock printed an `AIMOCK_BASE_URL=...` line.

If the inline node script fails: STOP. Report whether `@copilotkit/aimock` is importable, what error occurred.

- [ ] **Step 4: Hit langgraph via the proxy, confirm tool flow**

In another terminal:
```bash
cd /tmp/cockpit-aimock-spec/cockpit/langgraph/streaming/python
cp /Users/blove/repos/angular-agent-framework/examples/chat/python/.env .env
uv sync
OPENAI_BASE_URL=<value-from-step-3>/v1 OPENAI_API_KEY=test-not-used \
  uv run langgraph dev --port 8123 --no-browser &
LG_PID=$!
sleep 15
curl -sf http://localhost:8123/ok
```

Expected: `{"ok":true}`. If langgraph fails to start (port conflict, missing deps): STOP.

Then dispatch a single run against the c-messages graph:
```bash
THREAD=$(curl -s -X POST http://localhost:8123/threads -H 'content-type: application/json' -d '{}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["thread_id"])')
echo "thread: $THREAD"
curl -s -X POST http://localhost:8123/threads/$THREAD/runs -H 'content-type: application/json' -d "{\"assistant_id\":\"c-messages\",\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"say hi briefly\"}]}}" > /tmp/run.json
sleep 5
curl -s http://localhost:8123/threads/$THREAD/state | python3 -c 'import sys,json; s=json.load(sys.stdin); print("message_count:", len(s["values"].get("messages",[]))); print("last_message_content:", str(s["values"]["messages"][-1].get("content",""))[:200])'
```

Expected: at least 2 messages (user + AI), and the AI message `content` contains the mock's response text (`"Hello from cockpit-streaming!"`). Confirms aimock served the c-messages graph's LLM call. Report `last_message_content` verbatim so Task 5's assertion can use the actual phrase.

- [ ] **Step 5: Tear down**

```bash
kill $NODE_PID $LG_PID 2>/dev/null || true
rm -f /tmp/cockpit-tc-fixture.json /tmp/run.json
rm -f cockpit/langgraph/streaming/python/.env
# remove the test install
rm -rf node_modules/@copilotkit/aimock node_modules/openai 2>/dev/null || true
```

Confirm: `git status` clean (the worktree node_modules is a symlink to the main checkout — the rm above only removes from the symlinked target's `node_modules`, which is fine because Task 1 reinstalls properly).

- [ ] **Step 6: Report**

DE-RISK COMPLETE or DE-RISK FAILED. Include:
- Hardcoded `base_url=` findings (should be none).
- `c-messages` graph confirmation: built from `_build_prompt_graph("messages.md")`, no tool bindings.
- The system prompt content from `prompts/messages.md` (just the first paragraph or so — informs the capture script).
- Whether the curl-driven run produced an AI message with the mock's exact content text.
- Any deviations from the spec's assumed shape.

If de-risk passes, proceed to Task 1. If it fails, STOP and escalate.

---

## Task 1: Add per-directory configs at `apps/cockpit/e2e/`

**Files:**
- Create: `apps/cockpit/e2e/tsconfig.json`
- Create: `apps/cockpit/e2e/.gitignore`
- Create: `apps/cockpit/e2e/README.md`

No new Nx `project.json` — the existing `cockpit` project's `e2e` target is reused (its `config` path is updated in Task 6 once the new harness's playwright config exists).

- [ ] **Step 1: Create tsconfig.json**

Write `apps/cockpit/e2e/tsconfig.json`:

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

- [ ] **Step 2: Create .gitignore**

Write `apps/cockpit/e2e/.gitignore`:

```
test-results/
playwright-report/
*.tmp
```

- [ ] **Step 3: Create README.md**

Write `apps/cockpit/e2e/README.md`:

```markdown
# cockpit e2e

Cross-stack E2E harness for cockpit example apps. Uses [`@copilotkit/aimock`](https://github.com/CopilotKit/aimock) as a deterministic mock for LLM API calls; the per-product Python LangGraph dev server is launched with `OPENAI_BASE_URL` pointed at it; Playwright drives the example Angular app in real Chromium.

Phase 1 covers `c-messages` only. Future phases each add one example (one fixture + one spec file per PR).

## Run the suite

```
npx nx e2e cockpit
```

Replay-only. No `OPENAI_API_KEY` needed. Reads committed fixtures from `fixtures/`.

## Refresh a fixture

Each captured fixture has a recipe script under `scripts/`. Example for the c-messages fixture:

```
OPENAI_API_KEY=sk-... uv run --project cockpit/langgraph/streaming/python \
  python apps/cockpit/e2e/scripts/record-c-messages.py
```

Commit the updated `fixtures/c-messages.json`. Scripts are dev-only; CI never runs them.

## Layout

- `aimock-runner.ts` — programmatic boot of the mock server (mirrors `examples/chat/aimock-e2e/aimock-runner.ts`).
- `test-helpers.ts` — `sendPromptAndWait` helper that waits on `chat-message[data-streaming="false"]`.
- `fixtures/` — committed JSON fixtures keyed by example.
- `scripts/` — fixture-capture recipes (one per fixture).
- `playwright.config.ts` — Playwright config with globalSetup that boots aimock + LangGraph + Angular dev server.
- `c-messages.spec.ts` — Phase 1 pilot.
```

- [ ] **Step 4: Commit Task 1**

```bash
cd /tmp/cockpit-aimock-spec
git add apps/cockpit/e2e/tsconfig.json \
        apps/cockpit/e2e/.gitignore \
        apps/cockpit/e2e/README.md
git commit -m "feat(cockpit): scaffold e2e dir tsconfig + .gitignore + README"
```

NOTE: this task may fail to apply cleanly if any of the four legacy specs in `apps/cockpit/e2e/` still exist (the `.gitignore` is fine; the tsconfig and README will live alongside them temporarily). That's expected — Task 6 deletes the legacy files. Until then, the new harness modules and the legacy specs coexist in the same directory.

---

## Task 2: Copy harness modules from the chat harness

**Files:**
- Create: `apps/cockpit/e2e/aimock-runner.ts`
- Create: `apps/cockpit/e2e/aimock-runner.spec.ts`
- Create: `apps/cockpit/e2e/test-helpers.ts`

These are byte-for-byte copies of the chat harness modules (acknowledged duplication per the spec). The runner is already battle-tested through Phase 2a–2e + the regenerate scenario.

- [ ] **Step 1: Copy aimock-runner.ts**

```bash
cd /tmp/cockpit-aimock-spec
cp examples/chat/aimock-e2e/aimock-runner.ts apps/cockpit/e2e/aimock-runner.ts
```

- [ ] **Step 2: Copy aimock-runner.spec.ts**

```bash
cp examples/chat/aimock-e2e/aimock-runner.spec.ts apps/cockpit/e2e/aimock-runner.spec.ts
```

- [ ] **Step 3: Copy test-helpers.ts**

```bash
cp examples/chat/aimock-e2e/test-helpers.ts apps/cockpit/e2e/test-helpers.ts
```

- [ ] **Step 4: Run the runner unit tests**

```bash
cd /tmp/cockpit-aimock-spec/apps/cockpit/e2e
npx vitest run aimock-runner.spec.ts
```

Expected: 3 passed (boots a replay server, stop is idempotent, loads directory of fixtures).

If `@copilotkit/aimock` import fails: `cd /tmp/cockpit-aimock-spec && npm install` should fix it (the package is already in the root `package.json` from Phase 2a).

If any test fails, STOP and report — the modules should be byte-identical to the chat harness which passes today.

- [ ] **Step 5: Commit Task 2**

```bash
cd /tmp/cockpit-aimock-spec
git add apps/cockpit/e2e/aimock-runner.ts \
        apps/cockpit/e2e/aimock-runner.spec.ts \
        apps/cockpit/e2e/test-helpers.ts
git commit -m "feat(cockpit): copy aimock-runner and test-helpers from chat harness"
```

---

## Task 3: Capture the c-messages fixture

**Files:**
- Create: `apps/cockpit/e2e/scripts/record-c-messages.py`
- Create: `apps/cockpit/e2e/fixtures/c-messages.json` (generated by script)

- [ ] **Step 1: Write the capture script**

Write `apps/cockpit/e2e/scripts/record-c-messages.py`. The script mirrors `cockpit/langgraph/streaming/python/src/chat_graphs.py`'s `_build_prompt_graph("messages.md")` LLM setup (same model, same system prompt source). Captures a text response — `c-messages` doesn't bind tools.

```python
"""Capture a real text response from the c-messages graph's LLM.

Mirrors cockpit/langgraph/streaming/python/src/chat_graphs.py's
_build_prompt_graph("messages.md") setup: ChatOpenAI(gpt-5-mini, streaming=True)
+ system prompt from prompts/messages.md.

Run from repo root:
  OPENAI_API_KEY=sk-... uv run --project cockpit/langgraph/streaming/python \\
    python apps/cockpit/e2e/scripts/record-c-messages.py
"""
import json
import os
import sys
from pathlib import Path

env_path = Path("cockpit/langgraph/streaming/python/.env")
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

if not os.environ.get("OPENAI_API_KEY"):
    print("OPENAI_API_KEY not set (in env or .env)", file=sys.stderr)
    sys.exit(1)

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

PROMPT = "Tell me one quick fact about Angular signals in two sentences."
SYSTEM_PROMPT = (
    Path("cockpit/langgraph/streaming/python/prompts/messages.md").read_text()
)

llm = ChatOpenAI(model="gpt-5-mini", temperature=0)
response = llm.invoke(
    [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=PROMPT)],
)
text = response.content if isinstance(response.content, str) else ""
if not text.strip():
    print("LLM returned empty content; cannot build fixture", file=sys.stderr)
    sys.exit(2)
print(f"captured {len(text)} chars; first 80: {text[:80]!r}")

fixture = {
    "fixtures": [
        {
            "match": {"userMessage": PROMPT},
            "response": {"content": text},
        }
    ]
}

out_path = Path("apps/cockpit/e2e/fixtures/c-messages.json")
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(fixture, indent=2) + "\n")
print(f"\nWrote fixture to {out_path}")
```

The PROMPT is intentionally specific ("Angular signals in two sentences") so the captured response contains a distinctive phrase Task 5's assertion can match.

- [ ] **Step 2: Run the script**

```bash
cd /tmp/cockpit-aimock-spec
# .env should be present from Task 0; recreate if removed:
cp /Users/blove/repos/angular-agent-framework/examples/chat/python/.env cockpit/langgraph/streaming/python/.env
uv run --project cockpit/langgraph/streaming/python python apps/cockpit/e2e/scripts/record-c-messages.py
```

Expected: prints `captured <N> chars; first 80: '<some text mentioning signals>'` and writes `apps/cockpit/e2e/fixtures/c-messages.json`.

If `text.strip()` is empty: STOP. The LLM didn't respond — check `OPENAI_API_KEY` validity, check the messages.md file isn't empty.

- [ ] **Step 3: Inspect the captured fixture**

```bash
cd /tmp/cockpit-aimock-spec
head -10 apps/cockpit/e2e/fixtures/c-messages.json
```

Verify the file starts with `{"fixtures": [` and contains a `response.content` string mentioning "signal" (or close variant). Note a distinctive 1-2 word phrase from the response — Task 5's spec uses it as the assertion target. Common phrases: "signal", "Angular", "reactive".

- [ ] **Step 4: Commit Task 3**

```bash
cd /tmp/cockpit-aimock-spec
git add apps/cockpit/e2e/scripts/record-c-messages.py \
        apps/cockpit/e2e/fixtures/c-messages.json
git commit -m "feat(cockpit): add c-messages fixture and capture script"
```

DO NOT commit the `.env` file at `cockpit/langgraph/streaming/python/.env` — it's gitignored, but verify with `git status`.

---

## Task 4: Playwright config + globalSetup + globalTeardown

**Files:**
- Create: `apps/cockpit/e2e/playwright.config.ts`
- Create: `apps/cockpit/e2e/global-setup.ts`
- Create: `apps/cockpit/e2e/global-teardown.ts`

- [ ] **Step 1: Write playwright.config.ts**

Write `apps/cockpit/e2e/playwright.config.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  testIgnore: ['aimock-runner.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4501',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
});
```

- [ ] **Step 2: Write global-setup.ts**

Write `apps/cockpit/e2e/global-setup.ts`:

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
  var __COCKPIT_AIMOCK_E2E_STATE__: SharedState | undefined;
}

const REPO_ROOT = resolve(__dirname, '../../..');
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
      // server not up yet
    }
    await delay(500);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  const aimock = await startAimock({ mode: 'replay', fixturePath: FIXTURE_PATH });
  // eslint-disable-next-line no-console
  console.log(`[cockpit] aimock listening at ${aimock.baseUrl}`);

  const langgraph = spawn(
    'uv',
    ['run', 'langgraph', 'dev', '--port', '8123', '--no-browser'],
    {
      cwd: resolve(REPO_ROOT, 'cockpit/langgraph/streaming/python'),
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

  await waitForPort('http://localhost:8123/ok', 90_000);
  // eslint-disable-next-line no-console
  console.log('[cockpit] langgraph ready on :8123');

  const angular = spawn(
    'npx',
    ['nx', 'serve', 'cockpit-chat-messages-angular', '--port', '4501'],
    {
      cwd: REPO_ROOT,
      env: { ...process.env },
      stdio: 'pipe',
    },
  );
  angular.stdout?.on('data', (b) => process.stdout.write(`[angular] ${b}`));
  angular.stderr?.on('data', (b) => process.stderr.write(`[angular] ${b}`));

  await waitForPort('http://localhost:4501/', 120_000);
  // eslint-disable-next-line no-console
  console.log('[cockpit] angular ready on :4501');

  globalThis.__COCKPIT_AIMOCK_E2E_STATE__ = { aimock, langgraph, angular };
}
```

- [ ] **Step 3: Write global-teardown.ts**

Write `apps/cockpit/e2e/global-teardown.ts`:

```typescript
// SPDX-License-Identifier: MIT
export default async function globalTeardown(): Promise<void> {
  const state = globalThis.__COCKPIT_AIMOCK_E2E_STATE__;
  if (!state) return;
  state.angular.kill('SIGTERM');
  state.langgraph.kill('SIGTERM');
  await state.aimock.stop();
  globalThis.__COCKPIT_AIMOCK_E2E_STATE__ = undefined;
}
```

- [ ] **Step 4: Type-check the config**

```bash
cd /tmp/cockpit-aimock-spec/apps/cockpit/e2e
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit Task 4**

```bash
cd /tmp/cockpit-aimock-spec
git add apps/cockpit/e2e/playwright.config.ts \
        apps/cockpit/e2e/global-setup.ts \
        apps/cockpit/e2e/global-teardown.ts
git commit -m "feat(cockpit): add Playwright config with cockpit-streaming globalSetup"
```

---

## Task 5: Write the c-messages pilot spec

**Files:**
- Create: `apps/cockpit/e2e/c-messages.spec.ts`

- [ ] **Step 1: Identify a phrase to assert on**

Open `apps/cockpit/e2e/fixtures/c-messages.json` and look at the `response.content` string. Pick a distinctive 1-2 word phrase that's likely to appear verbatim — the captured response was about Angular signals, so `signal`, `Angular`, or `reactive` are good candidates. Note it; Step 2 uses it.

- [ ] **Step 2: Write the spec**

Write `apps/cockpit/e2e/c-messages.spec.ts` (replace `<DISTINCTIVE_PHRASE>` with the phrase from Step 1):

```typescript
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { sendPromptAndWait } from './test-helpers';

test('c-messages: assistant text from the mocked LLM renders in the cockpit chat composition', async ({ page }) => {
  const bubble = await sendPromptAndWait(
    page,
    'Tell me one quick fact about Angular signals in two sentences.',
  );

  // The captured fixture's content (Angular signals fact) must reach the
  // rendered bubble. Proves: aimock served the c-messages graph's LLM call,
  // langgraph routed back the AI message, the cockpit-chat-messages-angular
  // app rendered it via the chat composition, and the streaming-finalized
  // signal (data-streaming="false") settled.
  const finalText = await bubble.innerText();
  expect(finalText.toLowerCase()).toContain('<DISTINCTIVE_PHRASE>'.toLowerCase());
});
```

- [ ] **Step 3: Run the spec**

```bash
cd /tmp/cockpit-aimock-spec
npx playwright install --with-deps chromium
cd apps/cockpit/e2e
rm -rf test-results playwright-report
npx playwright test c-messages.spec.ts
```

Expected: 1 test passes within ~60–120s wall-clock (includes Angular dev-server cold-start).

If the spec fails: capture Playwright trace from `test-results/`, STOP, report. Likely causes:
- The `cockpit-chat-messages-angular` app's `streamingAssistantId` doesn't match the `c-messages` graph_id — verify with `grep -n "AssistantId\|c-messages" cockpit/chat/messages/angular/src/environments/environment.ts`.
- The Angular proxy.conf.json points elsewhere than 8123 — check `cockpit/chat/messages/angular/proxy.conf.json`.
- The fixture's prompt doesn't exact-match the spec's `sendPromptAndWait` argument — both must be byte-identical.

- [ ] **Step 4: Run the suite three times for stability**

```bash
cd /tmp/cockpit-aimock-spec/apps/cockpit/e2e
for i in 1 2 3; do
  echo "=== Run $i ==="
  rm -rf test-results playwright-report ../../../../test-results
  sleep 8
  npx playwright test
done
```

Expected: 3 consecutive clean runs (1 passed each). If any run fails, STOP and investigate — flakes here would compound across the future per-example specs.

- [ ] **Step 5: Commit Task 5**

```bash
cd /tmp/cockpit-aimock-spec
git add apps/cockpit/e2e/c-messages.spec.ts
git commit -m "test(cockpit): add c-messages aimock pilot spec"
```

---

## Task 6: Delete legacy specs and old playwright config, repoint cockpit e2e target

**Files:**
- Delete: `apps/cockpit/e2e/cockpit.spec.ts`
- Delete: `apps/cockpit/e2e/dark-mode.spec.ts`
- Delete: `apps/cockpit/e2e/all-examples-smoke.spec.ts`
- Delete: `apps/cockpit/e2e/production-smoke.spec.ts`
- Delete: `apps/cockpit/playwright.config.ts`
- Modify: `apps/cockpit/project.json` (point `e2e` target's `config` at the new playwright config)

- [ ] **Step 1: Delete the legacy specs and old top-level playwright config**

```bash
cd /tmp/cockpit-aimock-spec
git rm apps/cockpit/e2e/cockpit.spec.ts \
       apps/cockpit/e2e/dark-mode.spec.ts \
       apps/cockpit/e2e/all-examples-smoke.spec.ts \
       apps/cockpit/e2e/production-smoke.spec.ts \
       apps/cockpit/playwright.config.ts
```

If `apps/cockpit/e2e/` contains other unexpected files (helpers, fixtures from older work), list them with `ls apps/cockpit/e2e/` and report — Task 1–5 only added expected files.

- [ ] **Step 2: Repoint the cockpit project's e2e target**

Open `apps/cockpit/project.json` and find the `"e2e"` target block. The `config` option currently reads `"apps/cockpit/playwright.config.ts"`:

```json
    "e2e": {
      "executor": "@nx/playwright:playwright",
      "options": {
        "config": "apps/cockpit/playwright.config.ts"
      }
    },
```

Update the `config` value to point at the new harness's config:

```json
    "e2e": {
      "executor": "@nx/playwright:playwright",
      "options": {
        "config": "apps/cockpit/e2e/playwright.config.ts"
      }
    },
```

Verify the file is still valid JSON:
```bash
cd /tmp/cockpit-aimock-spec
python3 -c "import json; json.load(open('apps/cockpit/project.json'))" && echo "OK"
```

Expected: `OK`.

- [ ] **Step 3: Verify nothing else references the old config path**

```bash
cd /tmp/cockpit-aimock-spec
grep -rn "apps/cockpit/playwright.config" \
  --include='*.ts' --include='*.json' --include='*.yml' --include='*.md' \
  | grep -v 'node_modules\|test-results\|playwright-report\|docs/superpowers/'
```

Expected: zero matches. If any reference to the old top-level `apps/cockpit/playwright.config.ts` remains, STOP and report.

- [ ] **Step 4: Commit Task 6**

```bash
cd /tmp/cockpit-aimock-spec
git add apps/cockpit/project.json
git commit -m "chore(cockpit): drop legacy e2e specs; repoint e2e target to new harness config"
```

The `git rm` from Step 1 staged the deletions; the `git add` here stages the project.json modification.

---

## Task 7: Update existing CI cockpit-e2e job

**Files:**
- Modify: `.github/workflows/ci.yml`

The existing `cockpit-e2e` job already invokes `npx nx e2e cockpit`, which after Task 6 drives the new harness. It just needs additional setup steps (uv install, python sync, trace upload).

- [ ] **Step 1: Locate and update the cockpit-e2e job**

Open `.github/workflows/ci.yml` and find the `cockpit-e2e` job. Current shape:

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
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx nx e2e cockpit --skip-nx-cache
```

Replace with:

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
      - run: npx nx e2e cockpit --skip-nx-cache
      - name: Upload Playwright trace on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cockpit-e2e-trace
          path: apps/cockpit/e2e/test-results/
          retention-days: 7
```

- [ ] **Step 2: Confirm deploy.needs is unchanged**

```bash
grep -A20 "deploy:" /tmp/cockpit-aimock-spec/.github/workflows/ci.yml | grep cockpit
```

Expected: includes `cockpit-e2e` (job name unchanged). No edit needed.

- [ ] **Step 3: Verify the workflow YAML parses**

```bash
cd /tmp/cockpit-aimock-spec
npx -y js-yaml .github/workflows/ci.yml > /dev/null && echo "OK"
```

Expected: `OK`.

- [ ] **Step 4: Commit Task 7**

```bash
cd /tmp/cockpit-aimock-spec
git add .github/workflows/ci.yml
git commit -m "ci(cockpit): wire cockpit-e2e job for aimock harness (uv + python + trace)"
```

---

## Task 8: Verify, push, open PR

- [ ] **Step 1: Final local verification**

Run the new project end-to-end one more time:

```bash
cd /tmp/cockpit-aimock-spec
npx nx e2e cockpit
```

Expected: 1 test passes.

Then run the existing chat aimock harness to confirm nothing collateral broke:

```bash
cd examples/chat/aimock-e2e && npx playwright test && cd -
```

Expected: 9 tests pass (smoke + 3 markdown + a2ui-single-bubble + research-subagent + interrupt-approval + regenerate).

- [ ] **Step 2: Confirm working tree is clean**

```bash
cd /tmp/cockpit-aimock-spec
git status --short
```

Expected: empty (only `node_modules` symlink as untracked).

Remove any stray `.env` or `test-results/` directories from the worktree.

- [ ] **Step 3: Push branch**

```bash
cd /tmp/cockpit-aimock-spec
git push -u origin claude/cockpit-aimock-e2e-design
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "feat(cockpit): aimock E2E harness — Phase 1 (c-messages pilot)" --body "$(cat <<'EOF'
## Summary

Replaces the legacy cockpit e2e surface with an aimock-driven harness living at the existing `apps/cockpit/e2e/` location. Phase 1 lands the harness modules + one pilot spec for the `c-messages` example end-to-end. No new Nx project — the existing `cockpit` project's `e2e` target is repointed at the new playwright config.

Sits on the chat aimock harness pattern ([#309](https://github.com/cacheplane/angular-agent-framework/pull/309) and onward). Cockpit-shell coverage is dropped — to be rebuilt separately if/when needed.

### What changed
- Added harness modules at `apps/cockpit/e2e/` (aimock-runner, test-helpers, globalSetup/teardown, playwright config), copied byte-for-byte from `examples/chat/aimock-e2e/` where applicable.
- Captured c-messages fixture + reusable capture script under `apps/cockpit/e2e/scripts/`.
- Playwright globalSetup boots aimock + `cockpit/langgraph/streaming/python` (multi-graph langgraph serving 12 graphs including `c-messages`) + `cockpit-chat-messages-angular` dev server on :4501.
- Deleted: 4 legacy specs in `apps/cockpit/e2e/` and the old `apps/cockpit/playwright.config.ts`.
- `apps/cockpit/project.json`'s `e2e` target's `config` path updated to the new harness's playwright config.
- CI: existing `Cockpit — e2e` job augmented with uv install + python sync + trace upload. Job name + position in `deploy.needs` unchanged.

### Test plan
- [x] Local: pilot spec passes 3/3 consecutive runs
- [x] Chat aimock harness still green (no shared-state regressions)
- [x] No production code touched (only harness, fixtures, CI workflow, deletions, one project.json config-path edit)
- [ ] CI green on this PR

### Notes for reviewers
- Module duplication (`aimock-runner.ts`, `test-helpers.ts`) is intentional per the design — promoting to a shared library is deferred until a third harness wants the same code.
- Pilot assertion uses strictness "B" from brainstorming: surface attached + `data-streaming="false"` wait + content-phrase match. No per-component structural assertions.
- Future per-example PRs each add one fixture JSON + one spec file. If they hit a graph not registered in `streaming/python/langgraph.json`, globalSetup grows to spawn an additional langgraph process on a different port.

Spec: `docs/superpowers/specs/2026-05-15-cockpit-aimock-e2e-design.md`
Plan: `docs/superpowers/plans/2026-05-15-cockpit-aimock-e2e.md`
EOF
)"
```

- [ ] **Step 5: Watch CI**

```bash
gh pr checks <PR-NUMBER> --watch --interval 30
```

Report when CI completes.

---

## Self-review checklist

- [x] Spec coverage:
  - Goal → Tasks 1–5
  - File layout (8 files) → Tasks 1, 2, 4, 5
  - Components (runner, helpers, fixture, globalSetup, spec) → Tasks 2, 3, 4, 5
  - CI integration → Task 7
  - "Replace existing cockpit e2e" → Task 6
  - Risks/unknowns → Task 0 de-risk
  - Phase 1 acceptance criteria → Task 8 verification
- [x] Placeholder scan: no TBD/TODO. Two adapt-if-Task-0-revealed notes are intentional guidance for the implementer to incorporate de-risk findings.
- [x] Type consistency: `AimockHandle`, `AimockStartOptions`, `startAimock`, `sendPromptAndWait` names match across tasks and align with the chat harness (since the modules are copied).
- [x] Constraints: `@copilotkit/aimock` referenced only in plan/spec/README/imports; commit messages and PR body avoid the library name.

## Execution handoff

Plan complete. Recommended: **subagent-driven-development**, with Task 0 dispatched first as a blocking gate (proven valuable in Phase 2a and 2c). If Task 0 reports unexpected agent-code shape, the spec needs updating before Tasks 1+ proceed.
