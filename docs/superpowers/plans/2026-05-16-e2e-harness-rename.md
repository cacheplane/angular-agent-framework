# E2E harness rename + chat folder consistency implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rename `libs/internal/aimock-harness/` → `libs/e2e-harness/`. Rename `examples/chat/aimock-e2e/` → `examples/chat/angular/e2e/`. Chat keeps its own inline harness (preserves working behavior); cockpit consumers update their relative imports to the new lib path.

**Architecture:** Pure rename + path-relative updates. No semantic changes to either harness. Lib's `sendPromptAndWait` (cockpit-tuned) is already correct on main; no revert needed.

**Tech Stack:** Nx, Playwright, `@copilotkit/aimock` (via the lib's runner).

**Spec:** [docs/superpowers/specs/2026-05-16-e2e-harness-rename-design.md](../specs/2026-05-16-e2e-harness-rename-design.md)

---

## Working environment

- Worktree: `/tmp/e2e-rename` (branch `claude/e2e-harness-rename`).
- `node_modules` symlinked from main checkout; `npx`/`nx`/`uv` work directly.
- License header `// SPDX-License-Identifier: MIT` on line 1 of any new TS file. None are CREATED here — all touches are moves + path/string edits.
- One commit per task. DO NOT push, amend, or `git add -A`.
- Spec commit (`d2400dff`) already on branch; this plan adds a second commit, then implementation.

## Pre-flight survey (already verified by orchestrator, recorded here for reference)

- Lib current state on main: `libs/internal/aimock-harness/src/{aimock-runner.ts, aimock-runner.spec.ts, global-setup-factory.ts, global-teardown.ts, index.ts, test-helpers.spec.ts, test-helpers.ts}` — 7 files.
- Lib's `test-helpers.ts` already has the cockpit-tuned shape (Stop-generating waits + 5_000ms `toBeAttached`). NO revert needed.
- Cockpit per-example dirs that reference the lib: 3
  - `cockpit/langgraph/streaming/angular/e2e/`
  - `cockpit/chat/tool-calls/angular/e2e/`
  - `cockpit/chat/subagents/angular/e2e/`
  - Each has 3 import lines using `../../../../../libs/internal/aimock-harness/src` (spec + global-setup-impl + playwright.config)
- Chat dir current state: `examples/chat/aimock-e2e/{README.md, project.json, tsconfig.json, playwright.config.ts, global-setup.ts, global-teardown.ts, test-helpers.ts, aimock-runner.ts, aimock-runner.spec.ts, fixtures/, scripts/, 8 *.spec.ts}` — 8 specs total.

## Path-segment notes

- Cockpit per-example imports go to `repoRoot/libs/<dir>/src` from `cockpit/<product>/<example>/angular/e2e/<file>`. That's 5 segments up to root. Path becomes `'../../../../../libs/e2e-harness/src'`.
- Chat's moved global-setup.ts goes from `examples/chat/aimock-e2e/` (3 segments to root) to `examples/chat/angular/e2e/` (4 segments to root). `REPO_ROOT = resolve(__dirname, '../../..')` becomes `'../../../..'`.

---

## Task 1: Rename `libs/internal/aimock-harness/` → `libs/e2e-harness/`

**Files:**
- Move (via `git mv`): entire `libs/internal/aimock-harness/` directory tree to `libs/e2e-harness/`
- Modify: `libs/e2e-harness/project.json` — rename `name` field

- [ ] **Step 1: Move the directory**

```bash
cd /tmp/e2e-rename
mkdir -p libs
git mv libs/internal/aimock-harness libs/e2e-harness
```

Verify:
```bash
ls libs/e2e-harness/src/
```

Expected output:
```
aimock-runner.spec.ts
aimock-runner.ts
global-setup-factory.ts
global-teardown.ts
index.ts
test-helpers.spec.ts
test-helpers.ts
```

If `libs/internal/` is now empty, remove it (Nx doesn't need empty intermediate dirs):

```bash
# Check first — there may be other libs under internal/
ls libs/internal/ 2>/dev/null
# If empty, remove
rmdir libs/internal 2>/dev/null || true
```

- [ ] **Step 2: Update project.json name**

Open `libs/e2e-harness/project.json`. Change the `name` field from `"internal-aimock-harness"` to `"e2e-harness"`. The `sourceRoot` should also be updated (if it references the old path).

Before (likely):
```json
{
  "name": "internal-aimock-harness",
  "sourceRoot": "libs/internal/aimock-harness/src",
  ...
}
```

After:
```json
{
  "name": "e2e-harness",
  "sourceRoot": "libs/e2e-harness/src",
  ...
}
```

Verify JSON is still valid:
```bash
cd /tmp/e2e-rename
python3 -c "import json; json.load(open('libs/e2e-harness/project.json'))" && echo "OK"
```

Expected: `OK`.

- [ ] **Step 3: Update README references**

Open `libs/e2e-harness/README.md`. Find references to `internal/aimock-harness`, `internal-aimock-harness`, `@ngaf-internal/aimock-harness` and update to `e2e-harness`, `@ngaf/e2e-harness` (if mentioned), etc. Edit conservatively — only rename references.

If the README's "Per-example consumer shape" section references cockpit-only patterns, also add a one-line note that chat uses its own inline harness and consumes only `startAimock` from this lib (or doesn't consume anything; chat keeps its own runner copy for now).

- [ ] **Step 4: Run lib vitest**

```bash
cd /tmp/e2e-rename/libs/e2e-harness
npx vitest run
```

Expected: 5 passed (3 from aimock-runner + 2 from test-helpers).

- [ ] **Step 5: Type-check the lib**

```bash
cd /tmp/e2e-rename/libs/e2e-harness
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit Task 1**

```bash
cd /tmp/e2e-rename
git add libs/e2e-harness/project.json libs/e2e-harness/README.md
git commit -m "chore(e2e-harness): rename libs/internal/aimock-harness → libs/e2e-harness"
```

(`git mv` from Step 1 staged the moves.)

---

## Task 2: Update cockpit per-example imports to new lib path

**Files (3 dirs × 3 imports = 9 lines):**
- `cockpit/langgraph/streaming/angular/e2e/{streaming.spec.ts, global-setup-impl.ts, playwright.config.ts}`
- `cockpit/chat/tool-calls/angular/e2e/{c-tool-calls.spec.ts, global-setup-impl.ts, playwright.config.ts}`
- `cockpit/chat/subagents/angular/e2e/{c-subagents.spec.ts, global-setup-impl.ts, playwright.config.ts}`

- [ ] **Step 1: Bulk-replace the import path across all cockpit per-example files**

```bash
cd /tmp/e2e-rename
find cockpit -path "*/angular/e2e/*.ts" -type f -exec sed -i '' \
  -e 's|libs/internal/aimock-harness/src|libs/e2e-harness/src|g' \
  {} +
```

- [ ] **Step 2: Verify all references updated**

```bash
cd /tmp/e2e-rename
grep -rn "internal/aimock-harness" cockpit/ 2>/dev/null
```

Expected: zero matches.

```bash
grep -rn "libs/e2e-harness/src" cockpit/ 2>/dev/null | wc -l
```

Expected: at least 9 (3 per dir × 3 dirs).

- [ ] **Step 3: Type-check one of the cockpit e2e dirs**

```bash
cd /tmp/e2e-rename/cockpit/chat/tool-calls/angular/e2e
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit Task 2**

```bash
cd /tmp/e2e-rename
git add cockpit/langgraph/streaming/angular/e2e/ \
        cockpit/chat/tool-calls/angular/e2e/ \
        cockpit/chat/subagents/angular/e2e/
git commit -m "chore(cockpit-e2e): update lib imports to libs/e2e-harness path"
```

---

## Task 3: Move `examples/chat/aimock-e2e/` → `examples/chat/angular/e2e/`

**Files:**
- Move (via `git mv`): entire `examples/chat/aimock-e2e/` directory tree to `examples/chat/angular/e2e/`
- Modify: `examples/chat/angular/e2e/global-setup.ts` — `REPO_ROOT` relative-path adjustment for new depth

- [ ] **Step 1: Confirm `examples/chat/angular/e2e/` doesn't already exist**

```bash
cd /tmp/e2e-rename
ls examples/chat/angular/e2e 2>/dev/null
```

Expected: error / "no such file". If a stray `e2e/` already exists under `examples/chat/angular/`, STOP and report.

- [ ] **Step 2: Move the directory**

```bash
cd /tmp/e2e-rename
git mv examples/chat/aimock-e2e examples/chat/angular/e2e
```

- [ ] **Step 3: Update `REPO_ROOT` in moved global-setup.ts**

Open `examples/chat/angular/e2e/global-setup.ts`. Find:

```typescript
const REPO_ROOT = resolve(__dirname, '../../..');
```

Replace with (one additional `../`):

```typescript
const REPO_ROOT = resolve(__dirname, '../../../..');
```

- [ ] **Step 4: Audit other `__dirname`-relative paths in moved files**

```bash
cd /tmp/e2e-rename
grep -rn "__dirname\|\\.\\./\\.\\./\\.\\." examples/chat/angular/e2e/ 2>/dev/null | grep -v node_modules
```

Inspect each match. For each, determine if it was depth-3-relative-to-old-location and needs to become depth-4-relative-to-new-location. Typical patterns to update:

- `resolve(__dirname, '../../..')` → `resolve(__dirname, '../../../..')`
- `path.join(__dirname, '../..', 'fixtures')` → no change (relative to its own dir, not repo root)

The fixtures dir reference inside global-setup.ts is `resolve(__dirname, 'fixtures')` — relative to its own dir, no change needed.

Inside `scripts/record.ts` and `scripts/drift.ts`, check for similar patterns. If found, update.

- [ ] **Step 5: Verify the move**

```bash
cd /tmp/e2e-rename
ls examples/chat/angular/e2e/
```

Expected: same file listing as `examples/chat/aimock-e2e/` had pre-move (8 spec files, fixtures/, scripts/, project.json, etc.).

- [ ] **Step 6: Commit Task 3**

```bash
cd /tmp/e2e-rename
git add examples/chat/angular/e2e/
git commit -m "chore(examples-chat): move aimock-e2e → angular/e2e for folder consistency"
```

---

## Task 4: Dissolve chat Nx project; add `e2e` target to `examples-chat-angular`

**Files:**
- Delete: `examples/chat/angular/e2e/project.json`
- Modify: `examples/chat/angular/project.json` — add `e2e` target (and optionally `record`, `drift`)

- [ ] **Step 1: Inspect the chat e2e project.json**

```bash
cd /tmp/e2e-rename
cat examples/chat/angular/e2e/project.json
```

Note the targets present (`test`, `record`, `drift`). The `test` target becomes `e2e` on the angular project. `record` + `drift` are dev-only; either move to the angular project or drop entirely (the scripts can be shell-invoked directly).

- [ ] **Step 2: Delete the chat e2e project.json**

```bash
cd /tmp/e2e-rename
git rm examples/chat/angular/e2e/project.json
```

- [ ] **Step 3: Add `e2e`, `record`, `drift` targets to examples-chat-angular project.json**

Open `examples/chat/angular/project.json`. Add to `targets`:

```json
"e2e": {
  "executor": "@nx/playwright:playwright",
  "options": {
    "config": "examples/chat/angular/e2e/playwright.config.ts"
  }
},
"record": {
  "executor": "nx:run-commands",
  "options": {
    "cwd": "examples/chat/angular/e2e",
    "command": "tsx scripts/record.ts"
  }
},
"drift": {
  "executor": "nx:run-commands",
  "options": {
    "cwd": "examples/chat/angular/e2e",
    "command": "tsx scripts/drift.ts"
  }
}
```

Position them near the existing targets. Maintain JSON syntax (commas).

Verify:
```bash
cd /tmp/e2e-rename
python3 -c "import json; d=json.load(open('examples/chat/angular/project.json')); print('targets:', list(d['targets'].keys()))"
```

Expected: targets list includes `e2e`, `record`, `drift` plus the existing ones.

- [ ] **Step 4: Verify the now-orphaned `examples-chat-aimock-e2e` Nx project name no longer exists**

```bash
cd /tmp/e2e-rename
npx nx show projects 2>&1 | grep -E "examples-chat-aimock-e2e|examples-chat-angular" | head
```

Expected: no `examples-chat-aimock-e2e` (we deleted its project.json). `examples-chat-angular` present.

If Nx complains about the path, run `npx nx reset` to clear the daemon cache.

- [ ] **Step 5: Commit Task 4**

```bash
cd /tmp/e2e-rename
git add examples/chat/angular/project.json
git commit -m "chore(examples-chat): dissolve aimock-e2e Nx project; add e2e/record/drift targets to angular project"
```

---

## Task 5: Update CI workflows

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/aimock-drift.yml`

- [ ] **Step 1: Update ci.yml chat job**

Open `.github/workflows/ci.yml`. Find the `examples-chat-aimock-e2e` job. Replace its definition:

OLD (find this block):
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

NEW (rename id, display name, command, artifact name + path):
```yaml
  examples-chat-e2e:
    name: examples/chat — e2e
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
      - run: npx nx e2e examples-chat-angular --skip-nx-cache
      - name: Upload Playwright trace on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: examples-chat-e2e-trace
          path: examples/chat/angular/e2e/test-results/
          retention-days: 7
```

- [ ] **Step 2: Update `deploy.needs` array in ci.yml**

Find the `deploy` job's `needs:` array. Replace `examples-chat-aimock-e2e` with `examples-chat-e2e`.

- [ ] **Step 3: Update aimock-drift.yml**

Open `.github/workflows/aimock-drift.yml`. Find:

```yaml
        run: npx nx run examples-chat-aimock-e2e:drift --skip-nx-cache
```

Replace with:

```yaml
        run: npx nx run examples-chat-angular:drift --skip-nx-cache
```

(Or the equivalent direct shell invocation `npx tsx examples/chat/angular/e2e/scripts/drift.ts` — both work; nx target is more consistent with the new layout.)

- [ ] **Step 4: Verify both workflows parse**

```bash
cd /tmp/e2e-rename
npx -y js-yaml .github/workflows/ci.yml > /dev/null && echo "ci.yml OK"
npx -y js-yaml .github/workflows/aimock-drift.yml > /dev/null && echo "aimock-drift.yml OK"
```

Expected: both `OK`.

- [ ] **Step 5: Commit Task 5**

```bash
cd /tmp/e2e-rename
git add .github/workflows/ci.yml .github/workflows/aimock-drift.yml
git commit -m "ci(examples-chat): rename job and target to new e2e layout"
```

---

## Task 6: Final reference grep

**Files:** none — verification only.

- [ ] **Step 1: Final grep for stale references**

```bash
cd /tmp/e2e-rename
grep -rn "internal/aimock-harness\|examples-chat-aimock-e2e\|examples/chat/aimock-e2e" \
  --include='*.ts' --include='*.json' --include='*.yml' --include='*.md' \
  . | grep -v "node_modules\|test-results\|playwright-report\|docs/superpowers/"
```

Expected: zero matches (the spec/plan docs under `docs/superpowers/` are excluded since they document the rename).

If any non-docs matches remain, fix them in this task before considering complete.

- [ ] **Step 2: Final grep for the OLD lib name**

```bash
cd /tmp/e2e-rename
grep -rn "internal-aimock-harness\|@ngaf-internal/aimock-harness" \
  --include='*.ts' --include='*.json' --include='*.yml' --include='*.md' \
  . | grep -v "node_modules\|docs/superpowers/"
```

Expected: zero matches.

If matches remain, edit them (likely tsconfig path aliases — if there's a `paths` entry, update to `e2e-harness`).

- [ ] **Step 3: Commit Task 6 ONLY IF edits happened**

If Steps 1 or 2 found stale references that you edited, commit:

```bash
cd /tmp/e2e-rename
git add -p  # interactively stage just the cleanups
git commit -m "chore: clean up stale internal-aimock-harness references"
```

If both grep steps found zero matches, no commit needed; skip to Task 7.

---

## Task 7: Verify locally

- [ ] **Step 1: Set up env**

```bash
cd /tmp/e2e-rename
cp /Users/blove/repos/angular-agent-framework/examples/chat/python/.env examples/chat/python/.env
node libs/licensing/scripts/generate-public-key.mjs 2>&1 | tail -1
npx playwright install --with-deps chromium  # idempotent
```

- [ ] **Step 2: Run lib vitest**

```bash
cd /tmp/e2e-rename/libs/e2e-harness
npx vitest run
```

Expected: 5 passed.

- [ ] **Step 3: Run chat e2e**

```bash
cd /tmp/e2e-rename
lsof -ti :2024 :4200 2>/dev/null | xargs kill -9 2>/dev/null
ps aux | grep -E "uv |langgraph dev" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
sleep 5
npx nx e2e examples-chat-angular --skip-nx-cache 2>&1 | tail -8
```

Expected: all 8 chat specs pass (or however many were passing pre-rename — chat's behavior is preserved exactly). Wall-clock ~2-3 min.

If anything fails, STOP and report.

- [ ] **Step 4: Run each cockpit e2e**

```bash
cd /tmp/e2e-rename
for proj in cockpit-langgraph-streaming-angular cockpit-chat-tool-calls-angular cockpit-chat-subagents-angular; do
  echo "=== $proj ==="
  lsof -ti :8123 :8124 :8125 :4300 :4504 :4505 2>/dev/null | xargs kill -9 2>/dev/null
  ps aux | grep -E "uv |langgraph dev" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
  sleep 5
  npx nx e2e "$proj" --skip-nx-cache 2>&1 | tail -3
done
```

Expected: all 3 cockpit projects pass. Wall-clock ~5-8 min total.

If anything fails, STOP and report.

- [ ] **Step 5: Confirm working tree is clean**

```bash
cd /tmp/e2e-rename
rm -rf examples/chat/angular/e2e/test-results examples/chat/angular/e2e/playwright-report
rm -rf cockpit/*/angular/e2e/test-results cockpit/*/angular/e2e/playwright-report
git status --short
```

Expected: only `node_modules` symlink as untracked.

---

## Task 8: Push, open PR, watch CI, merge

(Orchestrator handles — implementer STOPS after Task 7.)

- Push branch.
- Open PR titled `chore: rename aimock-harness → e2e-harness; chat aimock-e2e → angular/e2e for folder consistency`.
- Watch CI: `examples/chat — e2e` and `Cockpit — e2e` must both pass green.
- Merge with `--squash` when green; clean up worktree.

---

## Self-review checklist

- [x] Spec coverage:
  - Lib rename + project.json + README → Task 1
  - Cockpit consumer import updates → Task 2
  - Chat dir move + REPO_ROOT adjustment → Task 3
  - Dissolve chat Nx project + add targets to angular project → Task 4
  - CI updates → Task 5
  - Final grep cleanup → Task 6
  - Local verification → Task 7
  - Push + PR + merge → Task 8 (orchestrator)
- [x] Placeholder scan: no TBD/TODO. Conditional commit in Task 6 ("only if edits happened") is intentional — the find-and-fix loop is real work, but might find nothing if the rename was complete.
- [x] Type consistency: `e2e-harness` is the only new identifier introduced. Used consistently.
- [x] No new code authored — all tasks are file moves + string-replace edits + JSON modifications.

## Execution handoff

Plan complete. Recommended: **subagent-driven-development**, one implementer for Tasks 1-7 (sequential, mechanical). Orchestrator handles Task 8 (push + PR + merge).
