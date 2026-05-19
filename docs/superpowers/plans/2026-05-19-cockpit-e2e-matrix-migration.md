# cockpit-e2e matrix migration + submit helper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cockpit-e2e job's sequential bash for-loop with a GitHub Actions matrix (one runner per cap), and ship `submitAndWaitForResponse` in `libs/e2e-harness/src/` for fast-streaming aimock paths.

**Architecture:** Single ci.yml job replaced by a matrix-strategy job + a summary job. Summary job's `name: "Cockpit — e2e"` preserves branch-protection check name. New harness helper coexists with the existing `sendPromptAndWait` — both exported, callers choose based on cap UI shape.

**Tech Stack:** GitHub Actions matrix strategy, `@nx/playwright:playwright` executor, `@copilotkit/aimock`, TypeScript.

---

## File Structure

Two files modified, one helper added:

- **Modify** `.github/workflows/ci.yml` — replace `cockpit-e2e` job body with matrix + add `cockpit-e2e-summary` job. ~50 lines diff.
- **Modify** `libs/e2e-harness/src/test-helpers.ts` — append `submitAndWaitForResponse` function. ~30 lines added.
- **Modify** `libs/e2e-harness/src/index.ts` — add one export line.

No other files touched. No new files created.

---

### Task 1: Add `submitAndWaitForResponse` to the harness

**Files:**
- Modify: `libs/e2e-harness/src/test-helpers.ts` (append at end)

- [ ] **Step 1: Read the current end of test-helpers.ts**

Run:
```bash
cd /tmp/cockpit-e2e-matrix && tail -20 libs/e2e-harness/src/test-helpers.ts
```

Identify the last line of the file. The new function will be appended after the existing exports.

- [ ] **Step 2: Append `submitAndWaitForResponse`**

Edit `libs/e2e-harness/src/test-helpers.ts`. Append at the end of the file (after the existing `clickInterruptActionAndWaitFinal` export):

```typescript

/**
 * Send a user prompt and wait for the final assistant bubble to render.
 *
 * Unlike `sendPromptAndWait` (which polls for the "Stop generating" button
 * visibility), this waits directly on the durable end-state:
 * `chat-message[data-role="assistant"][data-streaming="false"]`.
 *
 * Use this helper for caps where the streaming pass is too fast for Playwright
 * to observe an intermediate loading state — typically aimock-backed e2es
 * where the SSE chunks arrive in <100ms. The "Stop generating" button is
 * conditionally rendered (`@if (isLoading() && canStop())`), and signal-
 * batched updates can collapse the visible state below Playwright's polling
 * resolution.
 *
 * Compatible with all cap shapes — composed `<chat>` AND raw primitive
 * components — because the assertion is on the rendered `chat-message`
 * element's data attributes, not on input/button affordances.
 */
export async function submitAndWaitForResponse(
  page: Page,
  prompt: string,
  opts?: { path?: string; timeoutMs?: number },
): Promise<Locator> {
  const path = opts?.path ?? '/';
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  await page.goto(path);
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(prompt);
  await page.getByRole('button', { name: /send message/i }).click();
  const finalAssistant = page
    .locator('chat-message[data-role="assistant"][data-streaming="false"]')
    .last();
  await expect(finalAssistant).toBeAttached({ timeout: timeoutMs });
  return finalAssistant;
}
```

The function uses the same `Page` and `Locator` types already imported at the top of the file (verify the existing imports are `import { expect, type Locator, type Page } from '@playwright/test';` — they are; no new imports needed).

- [ ] **Step 3: Typecheck**

Run:
```bash
cd /tmp/cockpit-e2e-matrix && npx tsc --noEmit -p libs/e2e-harness/tsconfig.lib.json 2>&1 | tail -10
```

Expected: clean (no errors). If `tsconfig.lib.json` doesn't exist for the harness, fall back to:
```bash
cd /tmp/cockpit-e2e-matrix && npx tsc --noEmit libs/e2e-harness/src/test-helpers.ts --module ESNext --target ES2022 --moduleResolution Bundler --strict --esModuleInterop --skipLibCheck --types node 2>&1 | tail -10
```
Expected: clean.

---

### Task 2: Export `submitAndWaitForResponse` from the harness barrel

**Files:**
- Modify: `libs/e2e-harness/src/index.ts`

- [ ] **Step 1: Read current index.ts**

The file currently exports:
```typescript
// SPDX-License-Identifier: MIT
export { startAimock, type AimockHandle, type AimockStartOptions } from './aimock-runner';
export {
  sendPromptAndWait,
  sendPromptAndWaitForInterrupt,
  clickInterruptActionAndWaitFinal,
  type SendPromptAndWaitOptions,
} from './test-helpers';
export { createGlobalSetup, type CreateGlobalSetupOpts } from './global-setup-factory';
```

- [ ] **Step 2: Add `submitAndWaitForResponse` to the test-helpers re-export block**

Edit `libs/e2e-harness/src/index.ts`. Change the test-helpers export block to:

```typescript
export {
  sendPromptAndWait,
  sendPromptAndWaitForInterrupt,
  clickInterruptActionAndWaitFinal,
  submitAndWaitForResponse,
  type SendPromptAndWaitOptions,
} from './test-helpers';
```

(One new line added.)

- [ ] **Step 3: Typecheck the index**

```bash
cd /tmp/cockpit-e2e-matrix && npx tsc --noEmit libs/e2e-harness/src/index.ts --module ESNext --target ES2022 --moduleResolution Bundler --strict --esModuleInterop --skipLibCheck --types node 2>&1 | tail -10
```
Expected: clean.

---

### Task 3: Verify existing harness tests still pass

**Files:** none changed.

- [ ] **Step 1: Run the harness's own tests**

```bash
cd /tmp/cockpit-e2e-matrix && npx nx test e2e-harness --skip-nx-cache 2>&1 | tail -20
```

Expected: all tests pass. The harness has `aimock-runner.spec.ts` and `test-helpers.spec.ts` — both should be unaffected since we only ADDED a function.

If the harness has no nx target for tests, try:
```bash
cd /tmp/cockpit-e2e-matrix && npx vitest run libs/e2e-harness --skip-nx-cache 2>&1 | tail -20
```

If neither works, that's fine — Task 5 (matrix CI run) is the real validation.

---

### Task 4: Replace the cockpit-e2e job with matrix + summary

**Files:**
- Modify: `.github/workflows/ci.yml` — replace the `cockpit-e2e:` block (lines 258-313 in current main) entirely; add new `cockpit-e2e-summary:` job immediately after.

- [ ] **Step 1: Locate the exact line range**

Run:
```bash
cd /tmp/cockpit-e2e-matrix && grep -n '^  cockpit-e2e:\|^  website-e2e:' .github/workflows/ci.yml
```

Expected: two lines printed. The block from `cockpit-e2e:` up to (but NOT including) `website-e2e:` is the existing job. The new content replaces this entire block.

- [ ] **Step 2: Replace the cockpit-e2e job**

Open `.github/workflows/ci.yml`. Find the existing `cockpit-e2e:` block (starts with `  cockpit-e2e:` at column 2). Replace from that line up to (but not including) the `  website-e2e:` line with:

```yaml
  cockpit-e2e:
    name: "Cockpit — e2e (${{ matrix.cap.angular }})"
    needs: ci-scope
    if: github.event_name == 'push' || needs.ci-scope.outputs.cockpit_e2e == 'true'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      max-parallel: 5
      matrix:
        cap:
          - { angular: cockpit-langgraph-streaming-angular, python: cockpit/langgraph/streaming/python }
          - { angular: cockpit-chat-tool-calls-angular,     python: cockpit/chat/tool-calls/python }
          - { angular: cockpit-chat-subagents-angular,      python: cockpit/chat/subagents/python }
          - { angular: cockpit-chat-interrupts-angular,     python: cockpit/chat/interrupts/python }
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
      - name: uv sync per-cap python
        working-directory: ${{ matrix.cap.python }}
        run: uv sync
      - run: npx playwright install --with-deps chromium
      - name: nx e2e ${{ matrix.cap.angular }}
        run: npx nx e2e "${{ matrix.cap.angular }}" --skip-nx-cache
      - name: Upload Playwright trace on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cockpit-e2e-trace-${{ matrix.cap.angular }}
          path: |
            cockpit/**/angular/e2e/test-results/
          retention-days: 7

  cockpit-e2e-summary:
    name: "Cockpit — e2e"
    needs: cockpit-e2e
    if: always() && (github.event_name == 'push' || needs.ci-scope.outputs.cockpit_e2e == 'true')
    runs-on: ubuntu-latest
    steps:
      - name: Aggregate matrix outcome
        run: |
          if [[ "${{ needs.cockpit-e2e.result }}" != "success" ]]; then
            echo "Matrix outcome: ${{ needs.cockpit-e2e.result }}"
            exit 1
          fi
          echo "All cockpit-e2e matrix expansions passed."

```

Critical formatting notes:
- Two-space indentation at the job level (matches sibling jobs).
- `cockpit-e2e-summary` block ends with a blank line before `  website-e2e:` follows.
- `needs: ci-scope` on the matrix job; `needs: cockpit-e2e` on the summary job.
- The summary job's gate `if: always() && (...)` is required so the summary runs even when matrix expansions fail (so we can report failure cleanly).
- `name: "Cockpit — e2e"` on the summary job is exact — this preserves the branch-protection required-check name. Do NOT change capitalization or the em-dash character.

- [ ] **Step 3: Lint the workflow file**

```bash
cd /tmp/cockpit-e2e-matrix && npx -y -- @action-validator/cli .github/workflows/ci.yml 2>&1 | tail -10
```

If `@action-validator/cli` isn't available, try `actionlint`:
```bash
cd /tmp/cockpit-e2e-matrix && actionlint .github/workflows/ci.yml 2>&1 | tail -10
```

If neither is installed, fall back to YAML syntax check:
```bash
cd /tmp/cockpit-e2e-matrix && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML valid')"
```
Expected: `YAML valid`.

- [ ] **Step 4: Pre-flight sanity grep**

```bash
cd /tmp/cockpit-e2e-matrix && \
  echo "=== sleep 5 (should be 0) ===" && \
  grep -c 'sleep 5' .github/workflows/ci.yml && \
  echo "=== matrix.cap refs (should be ≥6) ===" && \
  grep -c 'matrix.cap' .github/workflows/ci.yml && \
  echo "=== summary job present ===" && \
  grep -c 'cockpit-e2e-summary:' .github/workflows/ci.yml && \
  echo "=== matrix entries (should be 4) ===" && \
  grep -c '{ angular: cockpit-' .github/workflows/ci.yml
```

Expected output:
```
=== sleep 5 (should be 0) ===
0
=== matrix.cap refs (should be ≥6) ===
6
=== summary job present ===
1
=== matrix entries (should be 4) ===
4
```

If any number is off, re-check the edit before proceeding.

- [ ] **Step 5: Verify old job comment block is gone**

The replaced text included a long comment about "5s sleep between targets gives the OS time to fully release the port". That comment must NOT survive:

```bash
cd /tmp/cockpit-e2e-matrix && grep -c 'OS to fully release the port' .github/workflows/ci.yml
```
Expected: `0`.

---

### Task 5: Commit and push for CI validation

**Files:** none new; commit + push only.

- [ ] **Step 1: Stage and review the diff**

```bash
cd /tmp/cockpit-e2e-matrix && git add \
  libs/e2e-harness/src/test-helpers.ts \
  libs/e2e-harness/src/index.ts \
  .github/workflows/ci.yml && \
  git diff --cached --stat
```

Expected: 3 files modified. ci.yml shows ~50 lines net change (~60 added, ~60 removed). test-helpers.ts shows ~30 lines added. index.ts shows 1 line added.

- [ ] **Step 2: Commit**

```bash
cd /tmp/cockpit-e2e-matrix && git commit -m "$(cat <<'EOF'
ci(cockpit-e2e): matrix-per-cap + submitAndWaitForResponse helper

Replaces the sequential bash for-loop in the cockpit-e2e job with a
GitHub Actions matrix strategy (one runner per cap, max-parallel=5,
fail-fast=false). Adds a cockpit-e2e-summary job that preserves the
"Cockpit — e2e" required-check name for branch protection.

Drops the stale 5s sleep workaround (was a pre-per-cap-migration
artifact for port 8123 collisions; each cap now binds its own pythonPort
and matrix runners are fully isolated anyway).

Ships submitAndWaitForResponse in libs/e2e-harness/src/ — waits directly
on chat-message[data-role="assistant"][data-streaming="false"] instead
of the Stop-generating button. Addresses the leaky-helper finding from
PR #462: loading-state observability fails for fast-streaming aimock
paths regardless of cap UI shape.

Unblocks the Task #4 c-messages aimock re-pilot (and the 7-cap chat
batch follow-up) by giving them a clean matrix entry pattern + a helper
that doesn't depend on UI streaming state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push**

```bash
cd /tmp/cockpit-e2e-matrix && git push -u origin claude/cockpit-e2e-matrix 2>&1 | tail -3
```

Expected: branch pushed; PR URL hint printed.

- [ ] **Step 4: Open the PR**

```bash
cd /tmp/cockpit-e2e-matrix && gh pr create \
  --title "ci(cockpit-e2e): matrix-per-cap + submitAndWaitForResponse helper (Task #14)" \
  --body "$(cat <<'EOF'
## Summary
- Replaces the sequential bash for-loop in the \`cockpit-e2e\` CI job with a GitHub Actions matrix (one runner per cap, \`max-parallel: 5\`, \`fail-fast: false\`).
- Adds \`cockpit-e2e-summary\` job with \`name: \"Cockpit — e2e\"\` to preserve the branch-protection required-check name. **No admin action needed** to update branch protection settings.
- Drops the stale 5s \`sleep\` workaround (pre-per-cap-migration artifact for port-8123 collisions; each cap now binds its own \`pythonPort\`).
- Ships \`submitAndWaitForResponse\` helper in \`libs/e2e-harness/src/\` — waits on \`chat-message[data-role=\"assistant\"][data-streaming=\"false\"]\` instead of the Stop-generating button. Coexists with \`sendPromptAndWait\`; existing 4 cap e2es continue to use the original.
- Per-cap trace artifact names (\`cockpit-e2e-trace-<angular-project>\`) — no more clobbering on concurrent matrix uploads.

## Wins
- Wall-time for cockpit-e2e expected to drop from ~13 min sequential → ~5-6 min (\`max-parallel: 5\`).
- Per-cap failure isolation in the GitHub UI.
- Adding a new aimock cap is now a one-line matrix entry.
- Future caps using raw primitives (where Stop-generating button observability fails for fast aimock paths) have a durable helper ready.

## Files
- \`.github/workflows/ci.yml\` — replace \`cockpit-e2e\` job + add \`cockpit-e2e-summary\` job.
- \`libs/e2e-harness/src/test-helpers.ts\` — add \`submitAndWaitForResponse\`.
- \`libs/e2e-harness/src/index.ts\` — re-export the new helper.

## Test plan
- [ ] CI \`Cockpit — e2e\` summary check passes (matrix expansions × 4 all pass).
- [ ] Each matrix expansion shows in the Checks tab with \`Cockpit — e2e (cockpit-<cap>-angular)\` name.
- [ ] Per-cap trace artifact names visible if any failure.
- [ ] Wall-time materially lower than current sequential.
- [ ] No regression on \`Cockpit — build / test\`, \`Cockpit — build all examples\`, smoke jobs.
- [ ] Reviewer: confirm branch protection still tracks \`Cockpit — e2e\` (summary job preserves the name).

## Follow-ups (out of scope)
- Task #4: re-pilot c-messages aimock e2e against the new pattern.
- Task #15: scaffold generator that emits matrix entry + per-cap e2e/ directory together.
- Task #16: hybrid \`ci-scope.mjs\` → \`nx affected\` migration.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

Expected: PR URL printed.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Plan task |
|---|---|
| New `submitAndWaitForResponse` helper in test-helpers.ts | Task 1 |
| Export from index.ts barrel | Task 2 |
| Existing harness tests pass | Task 3 |
| Replace cockpit-e2e job with matrix strategy | Task 4 |
| `fail-fast: false`, `max-parallel: 5` | Task 4 Step 2 |
| Per-runner `uv sync ${{ matrix.cap.python }}` | Task 4 Step 2 |
| Drop `sleep 5` + stale comment block | Task 4 Steps 2 + 5 |
| Per-cap trace artifact name | Task 4 Step 2 |
| Summary job preserving "Cockpit — e2e" name | Task 4 Step 2 |
| `if: always()` on summary job | Task 4 Step 2 |
| Commit, push, PR | Task 5 |
| Branch-protection no-op (summary name preserves required check) | Task 4 Step 2 + PR description |
| Matrix CI is the real test | Task 5 (the PR itself) |

**Placeholder scan:** searched for "TBD", "TODO", "fill in", "similar to" — none present. Each step has either exact YAML/TypeScript blocks or exact commands.

**Type consistency:** `matrix.cap.angular` and `matrix.cap.python` used consistently across the YAML block. Matrix entries spell `cockpit-langgraph-streaming-angular`, `cockpit-chat-tool-calls-angular`, `cockpit-chat-subagents-angular`, `cockpit-chat-interrupts-angular` — all match the existing bash-loop project names verified in `.github/workflows/ci.yml` (lines around the for-loop). Job name `cockpit-e2e-summary` is referenced once in the spec; the YAML block uses `cockpit-e2e-summary:` (key) matching. The `name: "Cockpit — e2e"` em-dash character is U+2014 (the same character used in the existing job — verified by reading current ci.yml).
