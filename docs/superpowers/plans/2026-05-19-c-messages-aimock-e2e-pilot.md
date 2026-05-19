# c-messages aimock e2e pilot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add aimock-driven Playwright e2e coverage for `cockpit/chat/messages`, locking in the per-cap scaffold pattern so the remaining 7 chat caps can be batched in a follow-up PR.

**Architecture:** Mirror `cockpit/chat/interrupts/angular/e2e/` 1:1 — copy the 5 e2e/ files with substitutions for paths/ports/capability id, hand-author one fixture entry covering a "Hello" prompt → canned response, add the `e2e` Nx target to the cap's `project.json`, and add c-messages to the two ci.yml lists (uv-sync per python dir + bash loop over angular project names). The `cockpit-e2e-wiring` spec auto-discovers via `project.json`'s `e2e` target, so no edit needed there.

**Tech Stack:** Playwright + `@nx/playwright:playwright` executor, `@copilotkit/aimock` via shared `libs/e2e-harness/src/`, existing `createGlobalSetup`/`sendPromptAndWait` primitives.

---

## File Structure

Per-cap e2e scaffold under `cockpit/chat/messages/angular/e2e/`:

- `c-messages.spec.ts` — 2 Playwright tests using `sendPromptAndWait`.
- `playwright.config.ts` — port-substituted copy of c-interrupts config.
- `global-setup-impl.ts` — `createGlobalSetup({...})` factory call with c-messages paths/ports.
- `tsconfig.json` — copy verbatim from c-interrupts.
- `fixtures/c-messages.json` — single hand-authored fixture entry: prompt "Hello" → canned text response.

Modifications outside `e2e/`:

- `cockpit/chat/messages/angular/project.json` — add `e2e` target (1 block, 6 lines).
- `.github/workflows/ci.yml` — add `cockpit/chat/messages/python` to uv-sync list AND `cockpit-chat-messages-angular` to the bash for-loop in the cockpit-e2e job (2 small edits).

Pre-existing assets (no edit needed):

- `cockpit/chat/messages/angular/proxy.conf.json` — already targets `http://localhost:5501` ✓
- `cockpit/chat/messages/angular/e2e/manual/messages.manual.ts` — manual smoke; coexists with the new spec, no interaction
- `apps/cockpit/cockpit-e2e-wiring.spec.ts` — auto-discovers via `project.json`'s `e2e` target ✓

---

### Task 1: Create the playwright config

**Files:**
- Create: `cockpit/chat/messages/angular/e2e/playwright.config.ts`

- [ ] **Step 1: Create the file**

Write `cockpit/chat/messages/angular/e2e/playwright.config.ts`:

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
    baseURL: 'http://localhost:4501',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './global-setup-impl.ts',
  globalTeardown: require.resolve('../../../../../libs/e2e-harness/src/global-teardown'),
});
```

Note: `baseURL` is `4501` (c-messages angular port from the capability registry).

---

### Task 2: Create the global-setup-impl

**Files:**
- Create: `cockpit/chat/messages/angular/e2e/global-setup-impl.ts`

- [ ] **Step 1: Create the file**

Write `cockpit/chat/messages/angular/e2e/global-setup-impl.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  // Per-cap cleanup PR: each chat cap runs its OWN standalone backend
  // (cockpit/chat/<name>/python) on `<angular_port> + 1000`. The
  // proxy.conf.json target matches.
  langgraphCwd: 'cockpit/chat/messages/python',
  langgraphPort: 5501,
  angularProject: 'cockpit-chat-messages-angular',
  angularPort: 4501,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
```

---

### Task 3: Create the tsconfig

**Files:**
- Create: `cockpit/chat/messages/angular/e2e/tsconfig.json`

- [ ] **Step 1: Create the file**

Write `cockpit/chat/messages/angular/e2e/tsconfig.json`:

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

(Verbatim copy of `cockpit/chat/interrupts/angular/e2e/tsconfig.json`.)

---

### Task 4: Create the aimock fixture

**Files:**
- Create: `cockpit/chat/messages/angular/e2e/fixtures/c-messages.json`

- [ ] **Step 1: Create the fixtures directory and file**

Write `cockpit/chat/messages/angular/e2e/fixtures/c-messages.json`:

```json
{
  "fixtures": [
    {
      "match": {
        "userMessage": "Hello",
        "model": "gpt-5-mini",
        "turnIndex": 0,
        "hasToolResult": false
      },
      "response": {
        "content": "Hi! I'm the chat-messages capability demo. I show how ChatMessageListComponent, ChatInputComponent, and ChatTypingIndicatorComponent render together. Try sending a few messages to see the bubbles and typing indicator in action."
      }
    }
  ]
}
```

`match` shape and model are verbatim from `cockpit/chat/interrupts/angular/e2e/fixtures/c-interrupts.json` — c-messages uses the same `gpt-5-mini` model (verified in `cockpit/chat/messages/python/src/graph.py:18`).

The cap has no tools, so `turnIndex: 0` + `hasToolResult: false` covers the single LLM turn. No `metadata` (systemHash/toolsHash) block — those are recorder-generated; hand-authored fixtures omit them, and the aimock matcher accepts.

---

### Task 5: Create the spec

**Files:**
- Create: `cockpit/chat/messages/angular/e2e/c-messages.spec.ts`

- [ ] **Step 1: Create the file**

Write `cockpit/chat/messages/angular/e2e/c-messages.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { sendPromptAndWait } from '../../../../../libs/e2e-harness/src';

test('c-messages: user message and AI response both render', async ({ page }) => {
  const finalBubble = await sendPromptAndWait(page, 'Hello');

  // User bubble appears with the submitted text.
  await expect(
    page.locator('chat-message[data-role="user"]').last(),
  ).toContainText('Hello');

  // AI bubble contains the canned response substring.
  await expect(finalBubble).toContainText('chat-messages capability demo');
});

test('c-messages: chat-message-list renders both turns', async ({ page }) => {
  await sendPromptAndWait(page, 'Hello');

  // After the turn finishes there are exactly 2 messages (user + assistant).
  await expect(page.locator('chat-message-list chat-message')).toHaveCount(2);
});
```

Two tests, both share the same fixture entry (deterministic). `sendPromptAndWait` (from `libs/e2e-harness/src/test-helpers.ts`) navigates to `/`, fills the input, clicks send, waits for the "Stop generating"→"Send" transition, returns the final assistant bubble.

---

### Task 6: Add the e2e target to project.json

**Files:**
- Modify: `cockpit/chat/messages/angular/project.json` — add `e2e` target.

- [ ] **Step 1: Read the current targets section**

Run: `cat cockpit/chat/messages/angular/project.json`

Identify the last entry in `targets` (likely `serve`, `lint`, or similar). The new `e2e` target gets added as a new key inside `targets`.

- [ ] **Step 2: Add the e2e target**

Edit `cockpit/chat/messages/angular/project.json`. Find the closing of the `targets` object (the `}` that closes the last existing target) and add an `e2e` entry before that closing brace. The block to add:

```json
    "e2e": {
      "executor": "@nx/playwright:playwright",
      "options": {
        "config": "cockpit/chat/messages/angular/e2e/playwright.config.ts"
      }
    }
```

Make sure the preceding target's closing `}` gets a trailing comma if it didn't have one. Verify with:

```bash
cd /tmp/c-messages-aimock && python3 -c "import json; print('OK' if json.load(open('cockpit/chat/messages/angular/project.json')) else 'BAD')"
```

Expected: `OK`.

- [ ] **Step 3: Verify Nx recognizes the target**

```bash
cd /tmp/c-messages-aimock && npx nx show project cockpit-chat-messages-angular --json 2>&1 | python3 -c "import json,sys; d=json.load(sys.stdin); print('e2e' in d.get('targets', {}))"
```

Expected: `True`.

---

### Task 7: Wire c-messages into ci.yml

**Files:**
- Modify: `.github/workflows/ci.yml` — two surgical additions.

- [ ] **Step 1: Find the uv-sync block**

Run:

```bash
cd /tmp/c-messages-aimock && grep -n 'working-directory: cockpit/chat/.*python' .github/workflows/ci.yml
```

Expected: several lines listing `cockpit/chat/{interrupts,tool-calls,subagents}/python` (and possibly more).

- [ ] **Step 2: Add c-messages uv-sync entry**

Insert immediately after the existing `cockpit/chat/interrupts/python` uv-sync block. The block to add:

```yaml
      - working-directory: cockpit/chat/messages/python
        run: uv sync
```

Indentation must match neighboring entries (typically 6 spaces). Verify with `grep -A1 "cockpit/chat/messages/python" .github/workflows/ci.yml`.

- [ ] **Step 3: Find the cockpit-e2e bash for-loop**

Run:

```bash
cd /tmp/c-messages-aimock && grep -n 'for proj in cockpit-langgraph-streaming-angular' .github/workflows/ci.yml
```

Expected: one line. The full statement spans the next line where projects are listed space-separated.

- [ ] **Step 4: Add c-messages-angular to the loop**

Edit `.github/workflows/ci.yml`. Find the line:

```
          for proj in cockpit-langgraph-streaming-angular cockpit-chat-tool-calls-angular cockpit-chat-subagents-angular cockpit-chat-interrupts-angular; do
```

Replace with:

```
          for proj in cockpit-langgraph-streaming-angular cockpit-chat-tool-calls-angular cockpit-chat-subagents-angular cockpit-chat-interrupts-angular cockpit-chat-messages-angular; do
```

(Appended at the end of the list.)

- [ ] **Step 5: Sanity-grep both edits**

```bash
cd /tmp/c-messages-aimock && \
  grep -c 'cockpit/chat/messages/python' .github/workflows/ci.yml && \
  grep -c 'cockpit-chat-messages-angular' .github/workflows/ci.yml
```

Both should print at least `1`.

---

### Task 8: Verify cockpit-e2e-wiring spec accepts the new cap

**Files:**
- Read-only check: `apps/cockpit/cockpit-e2e-wiring.spec.ts`

This spec auto-discovers caps with an `e2e` target. It cross-checks: capability-registry entry, proxy.conf.json target, ci.yml workflow references. After Tasks 1-7 land it should pass without edits.

- [ ] **Step 1: Run the wiring spec**

```bash
cd /tmp/c-messages-aimock && npx nx test cockpit-e2e-wiring --skip-nx-cache 2>&1 | tail -30
```

Expected: PASS. Specifically the second `it(...)` (the cross-check) should not raise any errors for `cockpit-chat-messages-angular`.

- [ ] **Step 2: If it fails, diagnose**

Common failure messages and remedies:

| Error fragment | Cause | Fix |
|---|---|---|
| `missing capability registry entry` | Registry id mismatch | Check `apps/cockpit/scripts/capability-registry.ts` already has c-messages (it does, port 4501) — should not happen |
| `proxy target ... != http://localhost:5501` | proxy.conf.json wrong | Already correct on main (verified pre-flight) — should not happen |
| `ci.yml does not run the e2e target` | Task 7 Step 4 not applied | Re-apply that edit |
| `ci.yml does not pre-sync cockpit/chat/messages/python` | Task 7 Step 2 not applied | Re-apply that edit |
| `missing capability.pythonDir` guard error | Pre-existing optional-field bug | NOT a regression; report as DONE_WITH_CONCERNS |

If the spec still fails after Task 7 edits look correct, STOP and report the exact error text — don't guess at fixes.

---

### Task 9: Local e2e smoke

**Files:** none changed.

- [ ] **Step 1: Verify port 4501 and 5501 are free**

```bash
lsof -i :4501 -i :5501 2>&1 | head -10
```

Expected: empty output (no processes bound). If anything's listed, kill it before proceeding (`kill <pid>` or restart your dev sessions).

- [ ] **Step 2: Run the e2e against the new cap**

```bash
cd /tmp/c-messages-aimock && npx nx e2e cockpit-chat-messages-angular --skip-nx-cache 2>&1 | tail -50
```

Expected: 2/2 tests pass within ~60s. `createGlobalSetup` will:
1. Spawn `nx serve cockpit-chat-messages-angular --port 4501`.
2. Spawn aimock-backed langgraph dev for `cockpit/chat/messages/python` on 5501.
3. Wait for both to be ready.
4. Run Playwright tests against `http://localhost:4501`.
5. Tear down on completion.

- [ ] **Step 3: If e2e fails, capture diagnostics**

If a test fails:

```bash
cd /tmp/c-messages-aimock && \
  ls cockpit/chat/messages/angular/e2e/test-results/ 2>&1 && \
  ls cockpit/chat/messages/angular/e2e/playwright-report/ 2>&1
```

Open the HTML report (`open playwright-report/index.html`) to inspect the failure. Most common causes:

| Symptom | Likely cause | Fix |
|---|---|---|
| "AI bubble never appears" | Fixture mismatch — aimock didn't match the prompt | Check `match.userMessage` in fixture exactly matches what spec sends (string equality, no trailing whitespace) |
| "Stop generating button never appears" | Backend not started or wrong port | Check langgraph dev startup logs; verify port 5501 free |
| "ECONNREFUSED localhost:4501" | Angular dev server not running | Verify Nx serve target boots; check for previous process holding 4501 |
| "Cannot find module aimock-runner" | Harness import path wrong | Verify `libs/e2e-harness/src/index.ts` exports `sendPromptAndWait` and `createGlobalSetup` |

If still failing after these checks, the hand-authored fixture may not match aimock's expected discriminator shape — fall back to the recording path (Task 10) and document in PR.

---

### Task 10: (Fallback only) Record the fixture if hand-authored mismatch persists

Skip this task if Task 9 passed. Only run if the hand-authored fixture from Task 4 won't replay.

**Files:**
- Create: `cockpit/chat/messages/angular/e2e/scripts/record-c-messages.sh`
- Modify: `cockpit/chat/messages/angular/e2e/fixtures/c-messages.json` (overwrite with recorded output)
- Modify: `cockpit/chat/messages/angular/project.json` (add `record` target)

- [ ] **Step 1: Copy and adapt the c-interrupts record script**

Read `cockpit/chat/interrupts/angular/e2e/scripts/record-c-interrupts.sh` and create the c-messages equivalent at `cockpit/chat/messages/angular/e2e/scripts/record-c-messages.sh`. Substitute:

- `cockpit/chat/interrupts/python` → `cockpit/chat/messages/python`
- Prompts (book flight) → `Hello`
- Output path → `cockpit/chat/messages/angular/e2e/fixtures/c-messages.json`
- Port 5503 → 5501 (if hardcoded; the script may use $PORT)

- [ ] **Step 2: Make executable + add record target**

```bash
chmod +x cockpit/chat/messages/angular/e2e/scripts/record-c-messages.sh
```

In `cockpit/chat/messages/angular/project.json` add a `record` target inside `targets`:

```json
    "record": {
      "executor": "nx:run-commands",
      "options": {
        "command": "bash cockpit/chat/messages/angular/e2e/scripts/record-c-messages.sh"
      }
    }
```

- [ ] **Step 3: Run the recorder**

```bash
OPENAI_API_KEY=<real-key> bash cockpit/chat/messages/angular/e2e/scripts/record-c-messages.sh
```

Expected: writes `cockpit/chat/messages/angular/e2e/fixtures/c-messages.json` with `metadata.systemHash` + `metadata.toolsHash` populated.

- [ ] **Step 4: Re-run e2e to verify**

Repeat Task 9 Step 2 with the recorded fixture.

---

### Task 11: Commit and open the PR

**Files:** none new; just stage + commit + push.

- [ ] **Step 1: Stage everything in the e2e/ directory plus the two modified files**

```bash
cd /tmp/c-messages-aimock && git add \
  cockpit/chat/messages/angular/e2e/c-messages.spec.ts \
  cockpit/chat/messages/angular/e2e/playwright.config.ts \
  cockpit/chat/messages/angular/e2e/global-setup-impl.ts \
  cockpit/chat/messages/angular/e2e/tsconfig.json \
  cockpit/chat/messages/angular/e2e/fixtures/c-messages.json \
  cockpit/chat/messages/angular/project.json \
  .github/workflows/ci.yml
```

If Task 10 (fallback) was used, also stage:

```bash
cd /tmp/c-messages-aimock && git add cockpit/chat/messages/angular/e2e/scripts/record-c-messages.sh
```

Verify the diff is exactly what's expected:

```bash
cd /tmp/c-messages-aimock && git diff --cached --stat
```

Expected: 6 new files + 2 modified (project.json, ci.yml). With fallback: +1 file (record script).

- [ ] **Step 2: Commit**

```bash
cd /tmp/c-messages-aimock && git commit -m "$(cat <<'EOF'
test(c-messages): add aimock e2e pilot

First slice of Task #4. Pilots the per-cap aimock e2e scaffold on
cockpit/chat/messages so the remaining 7 chat caps can be batched in
a follow-up PR.

- e2e/ scaffold (playwright config, global-setup-impl, tsconfig,
  c-messages.spec.ts with 2 tests, c-messages.json fixture).
- Add e2e target to project.json.
- Wire cockpit/chat/messages/python uv-sync + cockpit-chat-messages-
  angular into ci.yml's cockpit-e2e job.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push**

```bash
cd /tmp/c-messages-aimock && git push -u origin claude/c-messages-aimock
```

- [ ] **Step 4: Open the PR**

```bash
cd /tmp/c-messages-aimock && gh pr create \
  --title "test(c-messages): add aimock e2e pilot (Task #4 slice 1)" \
  --body "$(cat <<'EOF'
## Summary
- Adds aimock-driven Playwright e2e coverage for the c-messages cap.
- First slice of Task #4 (aimock e2e for newly-eligible caps): pilots the per-cap scaffold pattern; remaining 7 chat caps batch in follow-up PR.
- Hand-authored single-entry fixture (Hello → canned text response). No live recording.

## Files
- New: \`cockpit/chat/messages/angular/e2e/{c-messages.spec.ts,playwright.config.ts,global-setup-impl.ts,tsconfig.json,fixtures/c-messages.json}\`
- Modified: \`cockpit/chat/messages/angular/project.json\` (add e2e target), \`.github/workflows/ci.yml\` (uv-sync + bash loop).

## Test plan
- [x] \`npx nx test cockpit-e2e-wiring\` passes (cross-checks new cap).
- [x] \`npx nx e2e cockpit-chat-messages-angular\` passes locally (2/2).
- [ ] CI \`Cockpit — e2e\` gate passes.
- [ ] Existing 4 aimock cap e2es continue to pass (no regression).

\U0001f916 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Report it for tracking.

---

## Self-Review

**Spec coverage:**

| Spec section | Plan task(s) |
|---|---|
| Template source (c-interrupts mirror) | Tasks 1-5 (each copies the corresponding c-interrupts file) |
| Files to create (5 e2e files) | Tasks 1-5 |
| Ports (4501/5501) | Task 1 (baseURL), Task 2 (global-setup ports) |
| Fixture content (hand-authored) | Task 4 |
| Spec assertions (2 tests) | Task 5 |
| CI wiring: e2e target | Task 6 |
| CI wiring: ci.yml uv-sync + loop | Task 7 |
| CI wiring: cockpit-e2e-wiring spec | Task 8 (verification — no edit needed because spec auto-discovers) |
| Verification: local | Tasks 8 + 9 |
| Verification: CI | Task 11 |
| Risk: fixture mismatch fallback | Task 10 |
| Risk: port conflict pre-flight | Task 9 Step 1 |
| Risk: wiring-spec regression | Task 8 |

**Placeholder scan:** Searched plan for "TBD", "TODO", "fill in", "similar to". None found. Each Edit task shows the exact code/JSON/YAML block.

**Type consistency:** Port 4501 (angular) and 5501 (langgraph) are used consistently across Tasks 1, 2, and 9. The capability id `cockpit-chat-messages-angular` is consistent across Tasks 2, 7, 8, 11. The python dir `cockpit/chat/messages/python` is consistent across Tasks 2, 7, 8.

Inline ambiguity resolved: Task 6 Step 2's exact insertion point depends on the existing `targets` shape — the step instructs reading the file first then inserting before the closing brace. Same for Task 7's edits, which use `grep -n` to locate the exact line first. Both are concrete-enough without prescribing line numbers that could drift.
