# Cockpit aimock Phase 2 — c-interrupts spec — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Playwright + aimock-driven e2e spec for `c-interrupts` covering both the confirm and cancel booking flows, plus two new shared helpers in the e2e-harness lib.

**Architecture:** New per-example e2e dir under `cockpit/chat/interrupts/angular/e2e/` modeled on the existing c-subagents harness. Two new helpers in `libs/e2e-harness/src/test-helpers.ts` (`sendPromptAndWaitForInterrupt`, `clickInterruptActionAndWaitFinal`) make interrupt-flow assertions reusable across capabilities. Fixture captured via `llmock --record` against the real OpenAI API by a script that drives two booking flows (UA123 confirm, AA404 cancel) through the standalone `cockpit/chat/interrupts/python` backend.

**Tech Stack:** Playwright 1.x, `@copilotkit/aimock` (`llmock` CLI for record mode), LangGraph 1.x `interrupt()` + `Command(resume=...)`, `langgraph_sdk` HTTP API for the record script, Nx `@nx/playwright:playwright` executor, GitHub Actions.

---

## Pre-flight notes (READ FIRST)

**Dependency on PR #382.** This plan assumes `cockpit/chat/interrupts/python/src/graph.py` has `book_flight` + the ToolNode loop, and `cockpit/chat/interrupts/angular/src/app/interrupts.component.ts` wires `(action)="onInterruptAction($event)"` mapping Accept→`resume('confirm')` and Ignore→`resume('cancel')`. Both are PR #382. **Before starting, verify PR #382 is merged to main.** If not merged, either rebase this plan's branch on top of `claude/c-interrupts-real-wiring` or pause.

**Existing patterns to mirror.**
- `cockpit/chat/subagents/angular/e2e/` is the structural template for the new dir (playwright.config.ts, global-setup-impl.ts, tsconfig.json, scripts/record-*.sh).
- `cockpit/chat/subagents/angular/e2e/scripts/record-c-subagents.sh` is the direct template for the record script.
- `libs/e2e-harness/src/test-helpers.ts` contains the existing `sendPromptAndWait`; add the two new helpers alongside it.
- Per-cap port convention: `langgraphPort = angularPort + 1000`. Interrupts: angular=4503, langgraph=5503 (already set on main).

**Hard rules.**
- One commit per task. Stage specific paths only — never `git add -A` or `git add .`.
- Never push, open PR, or `--amend`.
- Never skip hooks.
- If any verification step fails first-run, STOP and report the failure with full output.

**Working tree.** Use a fresh branch off `origin/main` named `claude/c-interrupts-aimock-phase2`. The shared checkout at `/Users/blove/repos/angular-agent-framework` has multiple parallel agents; `git fetch origin && git checkout -b claude/c-interrupts-aimock-phase2 origin/main` before starting.

**Heavy steps.** Task 7 boots the standalone backend + Angular dev server then runs Playwright (~30–60s). Task 9 runs three cockpit e2e suites (~5 min). Task 10 is recording (network to OpenAI; ~60–120s) — orchestrator-only.

---

## File Structure

**New:**
- `cockpit/chat/interrupts/angular/e2e/c-interrupts.spec.ts` — two-test aimock spec.
- `cockpit/chat/interrupts/angular/e2e/playwright.config.ts` — config (no `testIgnore` needed — manual smoke lives in `e2e/manual/` outside the `**/*.spec.ts` glob).
- `cockpit/chat/interrupts/angular/e2e/global-setup-impl.ts` — `createGlobalSetup({...})`.
- `cockpit/chat/interrupts/angular/e2e/tsconfig.json` — same shape as subagents.
- `cockpit/chat/interrupts/angular/e2e/fixtures/c-interrupts.json` — captured llmock fixtures (committed).
- `cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh` — record script.

**Modified:**
- `libs/e2e-harness/src/test-helpers.ts` — add two new helpers.
- `libs/e2e-harness/src/index.ts` — re-export the two new helpers.
- `cockpit/chat/interrupts/angular/project.json` — add `e2e` + `record` targets.
- `.github/workflows/ci.yml` — append `cockpit-chat-interrupts-angular` to the cockpit-e2e loop.

**Untouched:**
- `cockpit/chat/interrupts/angular/e2e/manual/interrupts.manual.ts` (pre-existing manual smoke; lives outside `**/*.spec.ts` so playwright doesn't pick it up).
- `cockpit/chat/interrupts/angular/proxy.conf.json` (already targets `http://localhost:5503`).
- `cockpit/chat/interrupts/angular/src/environments/environment.development.ts` (already correct).

---

## Task 1: Add `sendPromptAndWaitForInterrupt` helper to the lib

**Files:**
- Modify: `libs/e2e-harness/src/test-helpers.ts`
- Modify: `libs/e2e-harness/src/index.ts`

- [ ] **Step 1: Read the existing helpers file to find the insertion point**

```bash
cat libs/e2e-harness/src/test-helpers.ts
```

Confirm the file exports `sendPromptAndWait` and `SendPromptAndWaitOptions`. The new helper goes at the bottom of the file.

- [ ] **Step 2: Append the new helper to `test-helpers.ts`**

At the end of `libs/e2e-harness/src/test-helpers.ts`, add:

```typescript

/**
 * Send a user prompt and wait for an interrupt to surface.
 *
 * Unlike `sendPromptAndWait`, this helper does NOT wait for the
 * Stop-generating cycle to complete with the agent fully idle. When an
 * interrupt fires, the agent transitions to idle while the
 * `chat-interrupt-panel` is still showing — the panel locator is the
 * durable signal that the run has paused.
 *
 * Pair with `clickInterruptActionAndWaitFinal` to drive the resume.
 */
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

  // Brief — typically <1s. Catches the case where the click didn't dispatch.
  await expect(page.getByRole('button', { name: /stop generating/i })).toBeVisible({
    timeout: 10_000,
  });

  // Panel visible implies the run paused at an interrupt rather than completing.
  await expect(page.locator('chat-interrupt-panel')).toBeVisible({ timeout: 60_000 });
}
```

- [ ] **Step 3: Verify the helper compiles**

```bash
npx nx test e2e-harness --skip-nx-cache 2>&1 | tail -20
```

Expected: all existing lib tests pass (the new helper has no tests yet — the spec is the gate; vitest just confirms the file compiles).

- [ ] **Step 4: Commit**

```bash
git add libs/e2e-harness/src/test-helpers.ts
git commit -m "$(cat <<'EOF'
feat(e2e-harness): add sendPromptAndWaitForInterrupt helper

Pairs with clickInterruptActionAndWaitFinal (next commit) to drive
chat-interrupt-panel flows from per-example aimock specs. Reusable
across any cockpit example that exercises the interrupt primitive.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `clickInterruptActionAndWaitFinal` helper to the lib

**Files:**
- Modify: `libs/e2e-harness/src/test-helpers.ts`
- Modify: `libs/e2e-harness/src/index.ts`

- [ ] **Step 1: Append the second helper to `test-helpers.ts`**

At the end of `libs/e2e-harness/src/test-helpers.ts`, add:

```typescript

/**
 * Click an action button on the visible chat-interrupt-panel and wait
 * for the resume continuation to finalize.
 *
 * Returns the last finalized assistant bubble (same return shape as
 * `sendPromptAndWait`), so callers can text-match the post-resume
 * response.
 *
 * Label is matched exactly (anchored regex). The library composition
 * emits 'accept' | 'edit' | 'respond' | 'ignore' as host outputs; the
 * actual button text is 'Accept' / 'Edit' / 'Respond' / 'Ignore'.
 */
export async function clickInterruptActionAndWaitFinal(
  page: Page,
  label: 'Accept' | 'Edit' | 'Respond' | 'Ignore',
): Promise<Locator> {
  const button = page
    .locator('chat-interrupt-panel')
    .getByRole('button', { name: new RegExp(`^${label}$`) });
  await button.click();

  // Resume re-enters loading.
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

- [ ] **Step 2: Re-export both helpers from `index.ts`**

Read `libs/e2e-harness/src/index.ts`. Find the existing re-export of `sendPromptAndWait` (likely `export * from './test-helpers';` — if so, no edit needed; the new helpers are already exported). If the file uses named re-exports like `export { sendPromptAndWait } from './test-helpers';`, append the two new names to that list:

```typescript
export {
  sendPromptAndWait,
  sendPromptAndWaitForInterrupt,
  clickInterruptActionAndWaitFinal,
} from './test-helpers';
```

- [ ] **Step 3: Verify the helper compiles**

```bash
npx nx test e2e-harness --skip-nx-cache 2>&1 | tail -10
```

Expected: lib tests pass (or the existing pass count, unchanged).

- [ ] **Step 4: Verify the named exports are reachable from a consumer path**

```bash
node -e "console.log(Object.keys(require('./libs/e2e-harness/src/test-helpers.ts')))" 2>&1 | tail -3 || true
```

The above will likely fail in Node (TS file), but the next sanity check works:

```bash
grep -n 'sendPromptAndWaitForInterrupt\|clickInterruptActionAndWaitFinal' libs/e2e-harness/src/test-helpers.ts libs/e2e-harness/src/index.ts
```

Expected: two matches in `test-helpers.ts` (the function definitions) and zero or two in `index.ts` (zero if it's a star export; two if named).

- [ ] **Step 5: Commit**

```bash
git add libs/e2e-harness/src/test-helpers.ts libs/e2e-harness/src/index.ts
git commit -m "$(cat <<'EOF'
feat(e2e-harness): add clickInterruptActionAndWaitFinal helper

Clicks an interrupt-panel button by exact label, then waits for the
resume continuation to finalize. Returns the last assistant bubble
(same return shape as sendPromptAndWait) for downstream text matching.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Scaffold the e2e dir — config + tsconfig + global-setup

**Files:**
- Create: `cockpit/chat/interrupts/angular/e2e/playwright.config.ts`
- Create: `cockpit/chat/interrupts/angular/e2e/global-setup-impl.ts`
- Create: `cockpit/chat/interrupts/angular/e2e/tsconfig.json`

- [ ] **Step 1: Create `playwright.config.ts`**

Write `cockpit/chat/interrupts/angular/e2e/playwright.config.ts`:

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
    baseURL: 'http://localhost:4503',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './global-setup-impl.ts',
  globalTeardown: require.resolve('../../../../../libs/e2e-harness/src/global-teardown'),
});
```

- [ ] **Step 2: Create `global-setup-impl.ts`**

Write `cockpit/chat/interrupts/angular/e2e/global-setup-impl.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  // Per-cap cleanup PR: each chat cap runs its OWN standalone backend
  // (cockpit/chat/<name>/python) on `<angular_port> + 1000`. The
  // proxy.conf.json target matches.
  langgraphCwd: 'cockpit/chat/interrupts/python',
  langgraphPort: 5503,
  angularProject: 'cockpit-chat-interrupts-angular',
  angularPort: 4503,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
```

- [ ] **Step 3: Create `tsconfig.json`**

Write `cockpit/chat/interrupts/angular/e2e/tsconfig.json`:

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

- [ ] **Step 4: Verify the three files compile clean**

```bash
npx tsc --noEmit -p cockpit/chat/interrupts/angular/e2e/tsconfig.json 2>&1 | tail -20
```

Expected: no errors. (Warnings about Playwright/Node types are acceptable if non-fatal.)

- [ ] **Step 5: Commit**

```bash
git add cockpit/chat/interrupts/angular/e2e/playwright.config.ts \
        cockpit/chat/interrupts/angular/e2e/global-setup-impl.ts \
        cockpit/chat/interrupts/angular/e2e/tsconfig.json
git commit -m "$(cat <<'EOF'
test(c-interrupts): scaffold aimock e2e config

playwright.config.ts wires the e2e-harness global setup + teardown.
global-setup-impl.ts points at the standalone backend
(cockpit/chat/interrupts/python, port 5503). No testIgnore needed —
the pre-existing manual smoke lives at e2e/manual/interrupts.manual.ts
outside the default **/*.spec.ts glob.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Write the `c-interrupts.spec.ts` test file

**Files:**
- Create: `cockpit/chat/interrupts/angular/e2e/c-interrupts.spec.ts`

- [ ] **Step 1: Write the spec**

Write `cockpit/chat/interrupts/angular/e2e/c-interrupts.spec.ts`:

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

- [ ] **Step 2: Verify the spec compiles**

```bash
npx tsc --noEmit -p cockpit/chat/interrupts/angular/e2e/tsconfig.json 2>&1 | tail -10
```

Expected: no errors. If the helper imports can't be resolved, double-check Task 2 Step 2 exported them from `libs/e2e-harness/src/index.ts`.

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/interrupts/angular/e2e/c-interrupts.spec.ts
git commit -m "$(cat <<'EOF'
test(c-interrupts): aimock spec — confirm + cancel booking flows

Two tests assert chat-interrupt-panel renders for booking requests
and that Accept/Ignore correctly drive the resume continuation to
"Booked …" / "Booking cancelled." respectively. Distinct flight
numbers (UA123 vs AA404) keep aimock fixture matches unambiguous.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add `e2e` and `record` targets to `project.json`

**Files:**
- Modify: `cockpit/chat/interrupts/angular/project.json`

- [ ] **Step 1: Read the existing project.json**

```bash
cat cockpit/chat/interrupts/angular/project.json
```

Locate the `"targets"` object. Identify the last existing target (e.g., `"serve"` or `"smoke"`) so you know where to append.

- [ ] **Step 2: Add `e2e` and `record` targets**

Edit `cockpit/chat/interrupts/angular/project.json`. Inside `"targets": { ... }`, after the last existing target, add (with the appropriate leading comma):

```json
,
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

- [ ] **Step 3: Verify JSON parses**

```bash
node -e "JSON.parse(require('node:fs').readFileSync('cockpit/chat/interrupts/angular/project.json','utf8'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Verify the e2e target is registered**

```bash
npx nx show project cockpit-chat-interrupts-angular --json 2>/dev/null | grep -E '"e2e"|"record"' | head -5
```

Expected: both target names appear.

- [ ] **Step 5: Commit**

```bash
git add cockpit/chat/interrupts/angular/project.json
git commit -m "$(cat <<'EOF'
build(c-interrupts): register e2e + record nx targets

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Write the record script

**Files:**
- Create: `cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh`

- [ ] **Step 1: Read the subagents template**

```bash
cat cockpit/chat/subagents/angular/e2e/scripts/record-c-subagents.sh
```

Internalize the shape: starts aimock in record mode, starts langgraph against `OPENAI_BASE_URL=http://127.0.0.1:$AIMOCK_PORT/v1`, posts a run, polls for status, merges per-request fixtures into one file.

- [ ] **Step 2: Write the c-interrupts variant**

Write `cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh`:

```bash
#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# Capture aimock fixtures for the c-interrupts graph by running the standalone
# langgraph dev server against aimock in --record mode. Drives TWO booking
# flows in sequence so the recorded fixture covers both confirm and cancel
# resume paths.
#
# Run from repo root:
#   OPENAI_API_KEY=sk-... bash cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../../../.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  for env_path in examples/chat/python/.env cockpit/chat/interrupts/python/.env; do
    if [[ -f "$env_path" ]]; then
      set -a; source "$env_path"; set +a
      break
    fi
  done
fi
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "OPENAI_API_KEY not set (in env or examples/chat/python/.env)" >&2
  exit 1
fi

AIMOCK_PORT=19999
LANGGRAPH_PORT=5503
FIXTURE_OUT="cockpit/chat/interrupts/angular/e2e/fixtures/c-interrupts.json"
RECORD_DIR="$(pwd)/cockpit/chat/interrupts/angular/e2e/fixtures/.staging"
rm -rf "$RECORD_DIR"
mkdir -p "$RECORD_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -f "examples/chat/python/.env" ]]; then
  cp examples/chat/python/.env cockpit/chat/interrupts/python/.env
fi

echo "[record] starting aimock --record on :$AIMOCK_PORT"
mkdir -p "$(dirname "$FIXTURE_OUT")"
npx -y -p @copilotkit/aimock llmock \
  --port "$AIMOCK_PORT" \
  --record \
  --provider-openai https://api.openai.com \
  --fixtures "$RECORD_DIR" \
  --chunk-size 4096 \
  > "$TMP_DIR/aimock.log" 2>&1 &
AIMOCK_PID=$!

cleanup() {
  if [[ -n "${LG_PID:-}" ]]; then
    pkill -P "$LG_PID" 2>/dev/null || true
    kill "$LG_PID" 2>/dev/null || true
  fi
  kill "$AIMOCK_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

for _ in {1..30}; do
  if curl -sf "http://127.0.0.1:$AIMOCK_PORT/health" > /dev/null 2>&1; then break; fi
  if curl -sf "http://127.0.0.1:$AIMOCK_PORT/" > /dev/null 2>&1; then break; fi
  sleep 1
done
echo "[record] aimock ready"

echo "[record] starting langgraph dev on :$LANGGRAPH_PORT (OPENAI_BASE_URL=http://127.0.0.1:$AIMOCK_PORT/v1)"
if command -v setsid >/dev/null 2>&1; then
  RUN_PREFIX="setsid"
else
  RUN_PREFIX=""
fi
(
  cd cockpit/chat/interrupts/python
  OPENAI_BASE_URL="http://127.0.0.1:$AIMOCK_PORT/v1" OPENAI_API_KEY="test-record" \
    exec $RUN_PREFIX uv run langgraph dev --port "$LANGGRAPH_PORT" --no-browser
) > "$TMP_DIR/langgraph.log" 2>&1 &
LG_PID=$!

for _ in {1..60}; do
  if curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/ok" > /dev/null; then break; fi
  sleep 1
done
if ! curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/ok" > /dev/null; then
  echo "[record] langgraph failed to start; tail of log:" >&2
  tail -30 "$TMP_DIR/langgraph.log" >&2
  exit 2
fi
echo "[record] langgraph ready"

# Helper: drive one full booking flow (prompt → interrupt → resume → final).
drive_flow() {
  local prompt="$1"
  local resume_value="$2"
  local label="$3"

  echo "[record][$label] thread + run with prompt: $prompt"
  local thread
  thread=$(curl -sf -X POST "http://127.0.0.1:$LANGGRAPH_PORT/threads" \
    -H 'content-type: application/json' -d '{}' \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["thread_id"])')
  local run
  run=$(curl -sf -X POST "http://127.0.0.1:$LANGGRAPH_PORT/threads/$thread/runs" \
    -H 'content-type: application/json' \
    -d "{\"assistant_id\": \"c-interrupts\", \"input\": {\"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}]}}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["run_id"])')
  echo "[record][$label] thread=$thread run=$run; polling for interrupt"

  local status=""
  for _ in {1..120}; do
    status=$(curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/threads/$thread/runs/$run" \
      | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
    case "$status" in
      interrupted|success|error|timeout) break ;;
    esac
    sleep 2
  done
  if [[ "$status" != "interrupted" ]]; then
    echo "[record][$label] expected interrupted, got: $status" >&2
    tail -40 "$TMP_DIR/langgraph.log" >&2
    exit 3
  fi
  echo "[record][$label] interrupted; posting resume=$resume_value"

  local resume_run
  resume_run=$(curl -sf -X POST "http://127.0.0.1:$LANGGRAPH_PORT/threads/$thread/runs" \
    -H 'content-type: application/json' \
    -d "{\"assistant_id\": \"c-interrupts\", \"command\": {\"resume\": \"$resume_value\"}}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["run_id"])')

  status=""
  for _ in {1..120}; do
    status=$(curl -sf "http://127.0.0.1:$LANGGRAPH_PORT/threads/$thread/runs/$resume_run" \
      | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
    case "$status" in
      success|error|timeout|interrupted) break ;;
    esac
    sleep 2
  done
  if [[ "$status" != "success" ]]; then
    echo "[record][$label] resume run did not succeed (status=$status)" >&2
    tail -40 "$TMP_DIR/langgraph.log" >&2
    exit 4
  fi
  echo "[record][$label] resume run succeeded"
}

drive_flow "Book me on UA123." "confirm" "confirm"
drive_flow "Book me on AA404." "cancel"  "cancel"

# Give aimock a moment to flush per-request fixture files.
sleep 2

RECORDED_DIR="$RECORD_DIR/recorded"
if [[ ! -d "$RECORDED_DIR" ]]; then
  echo "[record] no recorded fixtures dir at $RECORDED_DIR" >&2
  tail -40 "$TMP_DIR/aimock.log" >&2
  exit 5
fi
RECORDED_FILES=$(find "$RECORDED_DIR" -name "*.json" | wc -l | tr -d ' ')
echo "[record] $RECORDED_FILES recorded fixture files in $RECORDED_DIR"

python3 - <<PYEOF
import json, os, glob
recorded = sorted(glob.glob(os.path.join(r"$RECORDED_DIR", "*.json")))
merged = {"fixtures": []}
for f in recorded:
    with open(f) as fh:
        data = json.load(fh)
    merged["fixtures"].extend(data.get("fixtures", []))
with open(r"$FIXTURE_OUT", "w") as fh:
    json.dump(merged, fh, indent=2)
print(f"[record] merged {len(merged['fixtures'])} entries into $FIXTURE_OUT")
PYEOF

rm -rf "$RECORD_DIR"

if [[ ! -s "$FIXTURE_OUT" ]]; then
  echo "[record] fixture file is missing or empty: $FIXTURE_OUT" >&2
  exit 6
fi
echo "[record] fixture written: $FIXTURE_OUT ($(wc -c < "$FIXTURE_OUT") bytes)"
ENTRY_COUNT=$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(len(d.get("fixtures",[])))' "$FIXTURE_OUT")
echo "[record] $ENTRY_COUNT fixture entries"
```

- [ ] **Step 3: Make the script executable**

```bash
chmod +x cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh
```

- [ ] **Step 4: Lint with shellcheck if available (optional sanity)**

```bash
command -v shellcheck >/dev/null && shellcheck cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh || echo "shellcheck not installed; skipping"
```

Expected: no errors if shellcheck is installed; "skipping" otherwise.

- [ ] **Step 5: Commit**

```bash
git add cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh
git commit -m "$(cat <<'EOF'
test(c-interrupts): record script for two-flow aimock fixture

Drives UA123→confirm and AA404→cancel through the standalone
cockpit/chat/interrupts/python backend with llmock --record; merges
per-request fixtures into c-interrupts.json.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Record the fixture (one-time, requires OPENAI_API_KEY)

**Files:**
- Create: `cockpit/chat/interrupts/angular/e2e/fixtures/c-interrupts.json`

This task hits real OpenAI and produces the committed fixture. The orchestrator runs this — the implementer should STOP here and signal the orchestrator if `OPENAI_API_KEY` is unavailable.

- [ ] **Step 1: Ensure a clean state (no stale aimock/langgraph)**

```bash
lsof -t -i :5503 -i :19999 2>/dev/null | xargs kill -9 2>/dev/null
echo cleaned
```

- [ ] **Step 2: Run the record script**

```bash
bash cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh 2>&1 | tail -25
```

Expected last lines: `[record][cancel] resume run succeeded`, `[record] merged N entries into …/c-interrupts.json`, `[record] fixture written: … (~XXXX bytes)`, `[record] N fixture entries` where N is small (typically 3–6: one tool-call entry per flow + one continuation per flow).

- [ ] **Step 3: Verify the fixture file**

```bash
python3 -c 'import json; d=json.load(open("cockpit/chat/interrupts/angular/e2e/fixtures/c-interrupts.json")); print(len(d["fixtures"]), "entries"); print([e["match"]["userMessage"][:40] for e in d["fixtures"]])'
```

Expected: 3+ entries, with `userMessage` values including `"Book me on UA123."` and `"Book me on AA404."`.

- [ ] **Step 4: Commit**

```bash
git add cockpit/chat/interrupts/angular/e2e/fixtures/c-interrupts.json
git commit -m "$(cat <<'EOF'
test(c-interrupts): captured aimock fixture for confirm + cancel flows

Recorded via llmock --record against the standalone backend on :5503.
Both flows succeed end-to-end (interrupted → resumed → final assistant
bubble). Replay-deterministic — CI does not need OPENAI_API_KEY.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Local verification — `nx e2e cockpit-chat-interrupts-angular`

**Files:** none modified.

- [ ] **Step 1: Ensure a clean state**

```bash
lsof -t -i :5503 -i :4503 -i :19999 2>/dev/null | xargs kill -9 2>/dev/null
echo cleaned
```

- [ ] **Step 2: Run the e2e**

```bash
npx nx e2e cockpit-chat-interrupts-angular --skip-nx-cache 2>&1 | tail -30
```

Expected: `2 passed` (both confirm and cancel). Total runtime ~30–60 seconds (includes harness boot).

If `confirm` passes but `cancel` fails with a fingerprint-collision symptom (e.g., the cancel test sees the confirm continuation), see the spec's Risk surface — mitigation is to capture each flow into a separate fixture file. That mitigation is OUT of scope for this plan; STOP and report.

- [ ] **Step 3: Run twice more for stability**

```bash
npx nx e2e cockpit-chat-interrupts-angular --skip-nx-cache 2>&1 | tail -5
npx nx e2e cockpit-chat-interrupts-angular --skip-nx-cache 2>&1 | tail -5
```

Expected: both runs pass 2/2. Three consecutive passes is the stability gate.

- [ ] **Step 4: No commit (verification only)**

---

## Task 9: Regression check — other cockpit e2es still pass

**Files:** none modified.

- [ ] **Step 1: Run the three existing cockpit aimock suites sequentially**

```bash
npx nx e2e cockpit-langgraph-streaming-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-tool-calls-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache
```

Expected: all three pass. Total runtime ~5 minutes.

- [ ] **Step 2: No commit (verification only)**

---

## Task 10: Add `cockpit-chat-interrupts-angular` to the CI cockpit-e2e loop

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Find the existing cockpit-e2e loop**

```bash
grep -n -B1 -A10 'for proj in cockpit-' .github/workflows/ci.yml | head -25
```

Locate the shell loop that iterates `cockpit-langgraph-streaming-angular cockpit-chat-tool-calls-angular cockpit-chat-subagents-angular`.

- [ ] **Step 2: Append `cockpit-chat-interrupts-angular` to the loop**

Edit `.github/workflows/ci.yml`. In the line beginning `for proj in cockpit-langgraph-streaming-angular cockpit-chat-tool-calls-angular cockpit-chat-subagents-angular; do`, append the new project name before the semicolon:

```yaml
for proj in cockpit-langgraph-streaming-angular cockpit-chat-tool-calls-angular cockpit-chat-subagents-angular cockpit-chat-interrupts-angular; do
```

- [ ] **Step 3: Verify the diff**

```bash
git diff .github/workflows/ci.yml | head -20
```

Expected: one-line change adding `cockpit-chat-interrupts-angular` to the loop.

- [ ] **Step 4: Verify CI `uv sync` covers the interrupts python backend**

```bash
grep -n 'cockpit/chat/.*python\|uv sync' .github/workflows/ci.yml | head -20
```

If there's an `for proj in cockpit/chat/*/python; do uv sync ...` pattern, the wildcard already covers `cockpit/chat/interrupts/python` and no further edit is needed. If the sync uses an explicit list (e.g., `tool-calls subagents`), append `interrupts` to that list with the same syntax.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci(cockpit-e2e): include cockpit-chat-interrupts-angular in the loop

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Final reference grep

**Files:** none modified.

- [ ] **Step 1: Confirm all expected references exist**

```bash
grep -rn 'c-interrupts\|cockpit/chat/interrupts' \
  cockpit/chat/interrupts/angular/e2e/ \
  libs/e2e-harness/src/ \
  .github/workflows/ci.yml \
  2>/dev/null | wc -l
```

Expected: a non-zero count (typically 8–15 references across the spec, global-setup, fixture, helpers, and CI line).

- [ ] **Step 2: Confirm no orphaned references to the old umbrella backend in the new e2e dir**

```bash
grep -rn 'cockpit/langgraph/streaming' cockpit/chat/interrupts/angular/e2e/ 2>/dev/null
```

Expected: zero matches. The new e2e dir must only reference the standalone backend.

- [ ] **Step 3: Confirm only the aimock spec is in the playwright glob**

```bash
find cockpit/chat/interrupts/angular/e2e -name '*.spec.ts' -not -path '*/manual/*'
```

Expected: exactly one match — `cockpit/chat/interrupts/angular/e2e/c-interrupts.spec.ts`. The manual smoke at `e2e/manual/interrupts.manual.ts` is excluded by the default `**/*.spec.ts` glob.

- [ ] **Step 4: No commit (verification only)**

---

## Task 12: Push, open PR, watch CI, merge

This task is handled by the orchestrator (not the implementer). Implementer stops after Task 11 and reports.

- [ ] **Step 1: Push branch**

```bash
git push -u origin claude/c-interrupts-aimock-phase2
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "test(c-interrupts): aimock phase 2 — confirm + cancel flows" --body "$(cat <<'EOF'
## Summary
- Add aimock-driven e2e spec for c-interrupts covering both confirm + cancel booking flows.
- New e2e infra under `cockpit/chat/interrupts/angular/e2e/` (playwright.config, global-setup, fixture, record script) modeled on c-subagents.
- Two new shared helpers in `libs/e2e-harness/src/test-helpers.ts`: `sendPromptAndWaitForInterrupt` + `clickInterruptActionAndWaitFinal` (reusable across any cockpit example that exercises the interrupt primitive).
- Append `cockpit-chat-interrupts-angular` to the `Cockpit — e2e` job's per-project loop.

## Test plan
- [x] Lib helpers compile (`nx test e2e-harness`)
- [x] `nx e2e cockpit-chat-interrupts-angular` passes 3/3 stability runs (2 tests each)
- [x] `nx e2e cockpit-langgraph-streaming-angular` still passes
- [x] `nx e2e cockpit-chat-tool-calls-angular` still passes
- [x] `nx e2e cockpit-chat-subagents-angular` still passes
- [ ] CI `Cockpit — e2e` job green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

```bash
gh pr checks <PR#>
```

Cockpit jobs take ~5 minutes. The `Cockpit — e2e` job runs four projects sequentially now (up from three).

- [ ] **Step 4: Merge on green**

```bash
gh pr merge <PR#> --squash --delete-branch
```

---

## Self-review notes

**Spec coverage check:**
- "New e2e dir scaffolding" (playwright.config.ts, global-setup-impl.ts, tsconfig.json, fixtures/, scripts/) → Tasks 3 (config) + 4 (spec) + 6 (script) + 7 (fixture).
- "New aimock helpers" → Tasks 1 + 2.
- "Global-setup target — per-cap convention" → Task 3 Step 2 with the exact `langgraphCwd: 'cockpit/chat/interrupts/python'` + port 5503.
- "Spec: c-interrupts.spec.ts" → Task 4 with the exact code from the spec.
- "project.json additions" → Task 5.
- "CI" → Task 10.
- "Recording script" → Task 6.
- Components (`sendPromptAndWaitForInterrupt`, `clickInterruptActionAndWaitFinal`, `global-setup-impl.ts`) → Tasks 1 + 2 + 3 with the exact code from the spec.
- Acceptance criteria — local 3/3 stability → Task 8 Step 3; other suites pass → Task 9; CI green → Task 12 Step 3; no proxy/env port changes → confirmed in Task 3 Step 2 wording.

**Placeholder scan:** none — every step has either complete code or an exact command.

**Type consistency:**
- Helper names match between Task 1 (`sendPromptAndWaitForInterrupt`), Task 2 (`clickInterruptActionAndWaitFinal`), Task 4 (the spec imports both), and Task 11 (final grep).
- Port numbers match between Task 3 Step 2 (`langgraphPort: 5503, angularPort: 4503`), Task 6 (`LANGGRAPH_PORT=5503`), and Task 8 Step 1 (`lsof -t -i :5503 -i :4503`).
- Project name `cockpit-chat-interrupts-angular` consistent across Tasks 5 + 8 + 9 + 10 + 12.
- Button label vocabulary (`Accept` / `Ignore`) matches between Task 2 (helper signature), Task 4 (spec calls), and the underlying `chat-interrupt-panel` component (verified during spec design).
