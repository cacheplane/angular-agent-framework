# ag-ui capability-registry integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register the existing `cockpit-ag-ui-streaming-angular` cap in `apps/cockpit/scripts/capability-registry.ts`. Make `pythonDir` + `graphName` optional in the `Capability` interface (ag-ui has no Python backend). Guard the 2 consumers that read those fields.

**Architecture:** 3 file edits in lockstep (registry interface + entry, deploy script guard, e2e-wiring spec guard) + verification. Each is a small focused change; one commit per file for clarity.

**Tech Stack:** TypeScript (capability registry + scripts), Angular (the ag-ui demo itself is unchanged).

---

## Pre-flight notes (READ FIRST)

**Working tree.** Dedicated worktree at `/tmp/agui-registry`, branch `claude/agui-registry-integration` (spec already committed). Start every session with:

```bash
cd /tmp/agui-registry
pwd && git branch --show-current && git log --oneline -3
```

Expected: pwd `/tmp/agui-registry`, branch `claude/agui-registry-integration`, top commit `a8002ec6` (the spec).

After any long-running step, confirm branch is still `claude/agui-registry-integration`. If swap detected, STOP.

**Pre-flight verified during plan-write (2026-05-18):**
- `Capability` interface declares `pythonDir: string` + `graphName: string` as required.
- `scripts/generate-shared-deployment-config.ts` reads `capability.pythonDir` unconditionally inside the per-cap loop.
- `apps/cockpit/cockpit-e2e-wiring.spec.ts` reads `capability.pythonDir` + `capability.pythonPort` (pythonPort already wrapped in `!== undefined`).
- ag-ui's Angular project at `cockpit/ag-ui/streaming/angular/` exists, builds, and uses `provideFakeAgUiAgent` (in-process; no backend).
- No other consumers of `capability.pythonDir`/`capability.graphName` (confirmed via grep at brainstorm).

**Hard rules.**
- One commit per task (Tasks 1, 2, 3 each produce a commit).
- Never `git add -A` or `git add .` — stage specific paths only.
- Never push, open PR, or `--amend` (Task 5 = orchestrator).
- Never skip hooks.
- If ANY verification step fails first-run, STOP and report.

**Heavy steps.** Task 4 Step 5 runs 4 cockpit aimock e2es (~7 min). Task 4 Step 6 boots Angular dev server (manual spot check; orchestrator runs this).

---

## File Structure

**Modified (3 files):**
- `apps/cockpit/scripts/capability-registry.ts` — interface + new entry.
- `scripts/generate-shared-deployment-config.ts` — `!pythonDir` skip.
- `apps/cockpit/cockpit-e2e-wiring.spec.ts` — `pythonDir !== undefined` guard.

**Untouched:**
- `cockpit/ag-ui/streaming/angular/*` — already correct.
- All other per-cap config (registry rows for langgraph/deep-agents/render/chat caps stay byte-identical).

---

## Task 0: Pre-flight verify (no commit)

- [ ] **Step 1: Confirm starting state**

```bash
grep -n 'pythonDir:\|graphName:' apps/cockpit/scripts/capability-registry.ts | head -5
```

Expected: first 2 lines show the interface fields as required (`pythonDir: string;`, `graphName: string;`). If they're already optional, the schema change is partially done — STOP.

```bash
grep -n "'ag-ui'" apps/cockpit/scripts/capability-registry.ts
```

Expected: zero matches. If non-empty, ag-ui is already in the union — STOP and investigate.

- [ ] **Step 2: Confirm consumer grep — only 2 files reference these fields**

```bash
grep -rln "capability\.pythonDir\|capability\.graphName" \
  apps/ scripts/ libs/ .github/ 2>/dev/null | \
  grep -v node_modules | grep -v __pycache__ | grep -v dist | grep -v test-results | grep -v '\.next/'
```

Expected: exactly 2 lines —
```
apps/cockpit/cockpit-e2e-wiring.spec.ts
scripts/generate-shared-deployment-config.ts
```

If a third file appears, STOP and add it to the guard list.

- [ ] **Step 3: Confirm node_modules present (fresh worktree)**

```bash
test -d node_modules && echo "node_modules OK" || (npm ci 2>&1 | tail -3)
```

Expected: `node_modules OK`. If `npm ci` runs, it should complete cleanly (no lockfile changes).

- [ ] **Step 4: Confirm ag-ui project builds clean on the unmodified baseline**

```bash
npx nx build cockpit-ag-ui-streaming-angular --skip-nx-cache 2>&1 | tail -3
```

Expected: `Successfully ran target build for project cockpit-ag-ui-streaming-angular`. If it fails, the cap has a pre-existing breakage independent of this PR — STOP and report.

- [ ] **Step 5: Confirm port 4600 is free**

```bash
lsof -t -i :4600 2>/dev/null | wc -l | tr -d ' '
```

Expected: `0` (nothing on it). If `1+`, choose a different port and update the plan + spec.

---

## Task 1: Update Capability interface + register ag-ui

**Files:**
- Modify: `apps/cockpit/scripts/capability-registry.ts`

- [ ] **Step 1: Make `pythonDir` + `graphName` optional + add `'ag-ui'` to product union**

Edit `apps/cockpit/scripts/capability-registry.ts`. Find the interface block (currently lines ~5-15):

```typescript
export interface Capability {
  id: string;
  product: 'langgraph' | 'deep-agents' | 'render' | 'chat';
  topic: string;
  angularProject: string;
  port: number;
  pythonPort?: number;
  pythonDir: string;
  graphName: string;
}
```

Replace with:

```typescript
export interface Capability {
  id: string;
  product: 'langgraph' | 'deep-agents' | 'render' | 'chat' | 'ag-ui';
  topic: string;
  angularProject: string;
  port: number;
  pythonPort?: number;
  /** Optional — ag-ui caps run in-process via FakeAgent and have no Python backend. */
  pythonDir?: string;
  /** Optional — see pythonDir. */
  graphName?: string;
}
```

- [ ] **Step 2: Append the ag-ui-streaming entry at the end of the capabilities array**

Find the closing `] as const;` of the `capabilities` array. Insert this row just before it (after the last chat cap, currently `c-a2ui`):

```typescript
  // AG-UI capabilities (in-process FakeAgent; no Python backend, not deployed to LangSmith)
  { id: 'ag-ui-streaming', product: 'ag-ui', topic: 'streaming', angularProject: 'cockpit-ag-ui-streaming-angular', port: 4600 },
```

- [ ] **Step 3: Verify TypeScript still parses**

```bash
npx tsc --noEmit apps/cockpit/scripts/capability-registry.ts --skipLibCheck 2>&1 | tail -5
```

Expected: no errors. If tsc complains about `pythonDir` being undefined in existing rows, the optional change went wrong — investigate.

- [ ] **Step 4: Verify the new entry**

```bash
grep "'ag-ui-streaming'" apps/cockpit/scripts/capability-registry.ts
```

Expected: one line containing the full row.

```bash
grep -c "'ag-ui'" apps/cockpit/scripts/capability-registry.ts
```

Expected: `2` (once in the union, once as the `product` value of the new row).

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/scripts/capability-registry.ts
git commit -m "$(cat <<'EOF'
feat(cockpit-registry): add ag-ui product type + ag-ui-streaming entry

Schema change: pythonDir and graphName become optional to accommodate
caps without a Python backend. Adds 'ag-ui' to the product union and
registers the existing cockpit-ag-ui-streaming-angular cap (uses
FakeAgent in-process; no LangSmith deployment).

Two downstream consumers need guards (separate commits):
- scripts/generate-shared-deployment-config.ts (skip when no pythonDir)
- apps/cockpit/cockpit-e2e-wiring.spec.ts (guard pythonDir check)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add deploy-script skip for caps without `pythonDir`

**Files:**
- Modify: `scripts/generate-shared-deployment-config.ts`

- [ ] **Step 1: Find the per-cap loop and insert the skip**

Edit `scripts/generate-shared-deployment-config.ts`. Find the loop (currently around lines 54-68):

```typescript
for (const capability of capabilities) {
  const manifestPath = resolve(rootDir, capability.pythonDir, 'langgraph.json');
  const manifest = readManifest(manifestPath);
  if (!manifest.graphs) {
    throw new Error(`Missing graphs in ${manifestPath}`);
  }
  const stagedDependencyRoot = stageDependency(capability.pythonDir, capability.id);

  for (const [graphName, entrypoint] of Object.entries(manifest.graphs)) {
    addGraph(graphName, toDeploymentPath(stagedDependencyRoot, entrypoint));
  }
}
```

(Note: post-PR-#434 the filter was removed; the loop now iterates ALL caps. This commit adds back a minimal skip for the no-Python case.)

Replace with:

```typescript
for (const capability of capabilities) {
  if (!capability.pythonDir) {
    continue; // ag-ui (in-process) and other no-Python caps
  }
  const manifestPath = resolve(rootDir, capability.pythonDir, 'langgraph.json');
  const manifest = readManifest(manifestPath);
  if (!manifest.graphs) {
    throw new Error(`Missing graphs in ${manifestPath}`);
  }
  const stagedDependencyRoot = stageDependency(capability.pythonDir, capability.id);

  for (const [graphName, entrypoint] of Object.entries(manifest.graphs)) {
    addGraph(graphName, toDeploymentPath(stagedDependencyRoot, entrypoint));
  }
}
```

- [ ] **Step 2: Verify TypeScript parses**

```bash
npx tsc --noEmit scripts/generate-shared-deployment-config.ts --skipLibCheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Run the generator + confirm manifest unchanged**

```bash
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "import json; d=json.load(open('deployments/shared-dev/langgraph.json')); print(len(d['graphs']), 'graphs')"
git checkout HEAD -- deployments/shared-dev/langgraph.json
```

Expected: `32 graphs`. The ag-ui cap contributes none. If different from 32, STOP.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-shared-deployment-config.ts
git commit -m "$(cat <<'EOF'
fix(deploy): skip caps without pythonDir in shared-deploy manifest

Per the schema change in the prior commit, pythonDir is now optional.
ag-ui caps (in-process FakeAgent) and any future no-Python caps need
to be skipped — they have no langgraph.json to stage and contribute
no graphs to the shared-dev deployment.

Manifest graph count unchanged (32 graphs).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Guard the e2e-wiring spec's pythonDir checks

**Files:**
- Modify: `apps/cockpit/cockpit-e2e-wiring.spec.ts`

- [ ] **Step 1: Wrap the pythonDir comparison in an `undefined` guard**

Edit `apps/cockpit/cockpit-e2e-wiring.spec.ts`. Find the block at lines 152-154:

```typescript
      if (capability.pythonDir !== wiring.langgraphCwd) {
        errors.push(`${wiring.project}: registry pythonDir ${capability.pythonDir} != global setup langgraphCwd ${wiring.langgraphCwd}`);
      }
```

Replace with:

```typescript
      if (capability.pythonDir !== undefined && capability.pythonDir !== wiring.langgraphCwd) {
        errors.push(`${wiring.project}: registry pythonDir ${capability.pythonDir} != global setup langgraphCwd ${wiring.langgraphCwd}`);
      }
```

The `capability.pythonPort` check on lines 149-151 is already wrapped in `!== undefined` — no change there. The new guard mirrors that pattern for `pythonDir`.

- [ ] **Step 2: Verify TypeScript parses**

```bash
npx tsc --noEmit apps/cockpit/cockpit-e2e-wiring.spec.ts --skipLibCheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Run the spec via the cockpit test target**

```bash
npx nx test cockpit --skip-nx-cache 2>&1 | tail -10
```

Expected: tests pass (or no regression in the pass count vs the baseline before Task 1). If the cockpit-registry pre-existing test failure (`manifest.spec.ts` entry count assertion) surfaces here, it's unrelated — distinguish by re-running on the spec's parent commit.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/cockpit-e2e-wiring.spec.ts
git commit -m "$(cat <<'EOF'
test(cockpit-e2e-wiring): guard pythonDir check for no-Python caps

Per the registry schema change two commits prior, pythonDir is now
optional. The e2e-wiring spec compares capability.pythonDir against
the per-cap e2e harness's langgraphCwd; caps without pythonDir (ag-ui)
don't have an e2e harness either, so the check should skip rather
than fail comparing undefined to a path string.

Mirrors the existing pythonPort guard pattern (already wrapped in
!== undefined).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Comprehensive verification (no commit)

- [ ] **Step 1: Final registry state**

```bash
grep -n "'ag-ui'" apps/cockpit/scripts/capability-registry.ts
```

Expected: 2 matches (union + product value).

```bash
grep "'ag-ui-streaming'" apps/cockpit/scripts/capability-registry.ts
```

Expected: 1 match (the cap row).

```bash
grep -c "id: '" apps/cockpit/scripts/capability-registry.ts
```

Expected: `32` (31 prior + 1 new).

- [ ] **Step 2: Shared-deploy manifest unchanged**

```bash
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "
import json
d = json.load(open('deployments/shared-dev/langgraph.json'))
print(f'count={len(d[\"graphs\"])}')
print(f'has ag-ui? {\"ag-ui-streaming\" in d[\"graphs\"]}')
"
git checkout HEAD -- deployments/shared-dev/langgraph.json
```

Expected: `count=32`, `has ag-ui? False`. The ag-ui cap correctly contributes zero graphs.

- [ ] **Step 3: ag-ui project still builds**

```bash
npx nx build cockpit-ag-ui-streaming-angular --skip-nx-cache 2>&1 | tail -3
```

Expected: `Successfully ran target build for project cockpit-ag-ui-streaming-angular`.

- [ ] **Step 4: Cockpit test target passes (or no regression vs baseline)**

```bash
npx nx test cockpit --skip-nx-cache 2>&1 | tail -10
```

Expected: same pass/fail status as the baseline before this PR's commits. If a pre-existing failure is now surfacing as a NEW failure caused by this PR, STOP. The pre-existing `cockpit-registry` test failure (manifest.spec.ts entry count) is unrelated.

- [ ] **Step 5: 4 cockpit aimock e2es still pass (regression sanity)**

```bash
npx nx e2e cockpit-langgraph-streaming-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-tool-calls-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-interrupts-angular --skip-nx-cache
```

Expected: all four pass. If any fails, STOP and report.

- [ ] **Step 6: Manual spot-check (orchestrator runs this)**

This step is for the orchestrator after all commits are local:

```bash
lsof -t -i :4600 2>/dev/null | xargs kill -9 2>/dev/null
npx nx serve cockpit-ag-ui-streaming-angular --port 4600 &
SERVE_PID=$!
sleep 30  # let the Angular dev server build + serve
# Manual: open http://localhost:4600 in a browser; expect the AG-UI streaming
# demo to load and stream the canned FakeAgent tokens.
# When done:
kill $SERVE_PID 2>/dev/null
lsof -t -i :4600 2>/dev/null | xargs kill -9 2>/dev/null
```

Expected: server boots, browser shows streaming demo. Defer to orchestrator (interactive).

---

## Task 5: Push, open PR, watch CI, merge

Orchestrator task. Implementer STOPS after Task 4 Step 5.

- [ ] **Step 1: Push**

```bash
cd /tmp/agui-registry
git push -u origin claude/agui-registry-integration
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --head claude/agui-registry-integration --title "feat(cockpit-registry): add ag-ui product type + register ag-ui-streaming demo" --body "$(cat <<'EOF'
## Summary
Thread A of Task #2 (rename + structural-consistency sweep). Threads B + C landed via PR #449.

Registers the existing \`cockpit-ag-ui-streaming-angular\` demo in \`apps/cockpit/scripts/capability-registry.ts\`. The ag-ui cap is unique in having no Python backend (uses FakeAgent in-process), so:

1. \`Capability\` interface: \`pythonDir\` + \`graphName\` become optional; \`product\` union adds \`'ag-ui'\`.
2. New entry: \`{ id: 'ag-ui-streaming', product: 'ag-ui', topic: 'streaming', angularProject: 'cockpit-ag-ui-streaming-angular', port: 4600 }\`. Port 4600 picks a new range above chat's 4500s.
3. \`scripts/generate-shared-deployment-config.ts\`: skip caps without \`pythonDir\`. Shared-deploy manifest unchanged (32 graphs; ag-ui contributes none).
4. \`apps/cockpit/cockpit-e2e-wiring.spec.ts\`: guard the \`pythonDir\` check with \`!== undefined\` (mirrors the existing \`pythonPort\` guard).

3 commits, one per file. Per-commit boundaries keep each change reviewable.

## Test plan
- [x] TypeScript parses clean (capability-registry.ts, generate-shared-deployment-config.ts, cockpit-e2e-wiring.spec.ts)
- [x] Generated shared-deploy manifest unchanged (32 graphs)
- [x] \`nx build cockpit-ag-ui-streaming-angular\` succeeds
- [x] \`nx test cockpit\` passes (or no regression vs baseline)
- [x] \`nx e2e cockpit-langgraph-streaming-angular\` passes
- [x] \`nx e2e cockpit-chat-tool-calls-angular\` passes
- [x] \`nx e2e cockpit-chat-subagents-angular\` passes
- [x] \`nx e2e cockpit-chat-interrupts-angular\` passes
- [ ] Manual: \`nx serve cockpit-ag-ui-streaming-angular --port 4600\` loads in browser; FakeAgent streams canned tokens
- [ ] CI Cockpit gates green

## What this doesn't touch
- No backend deployment changes (ag-ui has no LangSmith assistant)
- No nav additions in the cockpit Next.js app (if nav auto-renders from the registry, ag-ui appears automatically; otherwise polish follow-up)
- No new ag-ui caps beyond the existing \`streaming\` demo
- No aimock e2e for ag-ui (under Task #4 — separate sub-project)

## CI noise
Per the user's standing warning, parallel domain changes may turn unrelated jobs red. Cockpit gates are the real signal here. Admin-merge if only unrelated jobs fail.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

```bash
gh pr checks <PR#>
```

- [ ] **Step 4: Merge on green (admin if branch protection blocks due to unrelated failures)**

```bash
gh pr merge <PR#> --squash --delete-branch
# or --admin --squash --delete-branch
```

- [ ] **Step 5: Manual ag-ui browser spot-check**

```bash
cd /Users/blove/repos/angular-agent-framework
git pull origin main
lsof -t -i :4600 2>/dev/null | xargs kill -9 2>/dev/null
npx nx serve cockpit-ag-ui-streaming-angular --port 4600 &
sleep 30
# open http://localhost:4600 — expect AG-UI streaming demo with canned tokens
kill %1 2>/dev/null
lsof -t -i :4600 2>/dev/null | xargs kill -9 2>/dev/null
```

If the page shows the demo with the streaming FakeAgent text, the integration is verified end-to-end.

- [ ] **Step 6: Cleanup worktree**

```bash
cd /Users/blove/repos/angular-agent-framework
git worktree remove --force /tmp/agui-registry
```

---

## Self-review notes

**Spec coverage:**
- Schema change → Task 1 Step 1.
- New registry entry → Task 1 Step 2.
- Deploy script skip → Task 2.
- e2e-wiring guard → Task 3.
- Manifest unchanged verification → Task 4 Step 2.
- Build succeeds → Task 4 Step 3.
- Test target unaffected → Task 4 Step 4.
- Aimock e2e regression → Task 4 Step 5.
- Manual demo verification → Task 4 Step 6 / Task 5 Step 5.

**Placeholder scan:** none. Every step has exact code + expected output.

**Type consistency:** `pythonDir?: string` / `graphName?: string` used consistently. `'ag-ui'` product type used in both union + new row. Port 4600 consistent across plan + spec + commit messages. Branch name `claude/agui-registry-integration` consistent.

**Concurrency note:** dedicated worktree at `/tmp/agui-registry`. Per-task branch confirmation after long-running steps.
