# CI scope per-cap python + deploy script — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the CI-scope classifier so per-cap python changes and deploy-script changes trigger Cockpit e2e + build (not just smoke), and add the 6 missing `project.json` files under `cockpit/render/<topic>/python/`.

**Architecture:** Single PR with three changes: (1) extend `scripts/ci-scope.mjs` with two new rules — a per-cap python branch in `applyProjectScope` and a deploy-script entry in `applyFallbackPathScope`; (2) add tests in `scripts/ci-scope.spec.mjs`; (3) create 6 new project.json files mirroring the chat per-cap python template. All changes are mechanical and test-covered.

**Tech Stack:** Node.js (`node --test`), Nx project discovery, TypeScript (no compilation impact — only project.json + .mjs files touched).

---

## Pre-flight notes (READ FIRST)

**Spec branch:** `claude/ci-scope-per-cap-python` (commit `22554c62`) in the dedicated worktree at `/tmp/ci-scope-fix`. Stay there to avoid the shared-checkout chaos.

**Working tree.** Start every command session with:

```bash
cd /tmp/ci-scope-fix
pwd && git branch --show-current
```

Expected: `pwd` is `/tmp/ci-scope-fix`, branch is `claude/ci-scope-per-cap-python`. If either is wrong, STOP and report — do not try to recover.

**Hard rules.**
- One commit per task. Tasks 1-3 produce one commit each.
- Never `git add -A` or `git add .` — stage specific paths only.
- Never push, open PR, or `--amend` except where the plan explicitly says (Task 5 = orchestrator).
- Never skip hooks.
- STOP and report if ANY verification step fails first-run.

**Heavy steps.** None. Total plan runtime ~5 minutes.

---

## File Structure

**Modified:**
- `scripts/ci-scope.mjs` — add per-cap python branch + deploy-script fallback.
- `scripts/ci-scope.spec.mjs` — add 3 new tests.

**Created:**
- `cockpit/render/computed-functions/python/project.json`
- `cockpit/render/element-rendering/python/project.json`
- `cockpit/render/registry/python/project.json`
- `cockpit/render/repeat-loops/python/project.json`
- `cockpit/render/spec-rendering/python/project.json`
- `cockpit/render/state-management/python/project.json`

**Untouched:** everything else.

---

## Task 1: Extend the classifier (`scripts/ci-scope.mjs`)

**Files:**
- Modify: `scripts/ci-scope.mjs`

- [ ] **Step 1: Read the current `applyProjectScope` function to find the insertion point**

```bash
grep -n "root.startsWith('cockpit/')" scripts/ci-scope.mjs
```

Expected: one line number (around 151 per the brainstorm audit).

- [ ] **Step 2: Add the per-cap python branch inside the existing `root.startsWith('cockpit/')` block**

Edit `scripts/ci-scope.mjs`. Find this block:

```javascript
  if (root.startsWith('cockpit/')) {
    if (root.includes('/angular') || project.projectType === 'application') {
      scope.cockpit_examples = true;
    }

    if (targets.smoke && root.includes('/python')) {
      scope.cockpit_smoke = true;
    }

    if (targets.integration) {
      scope.cockpit_secret = true;
    }

    if (targets.e2e) {
      scope.cockpit_e2e = true;
    }
  }
```

Insert this NEW branch immediately after the `targets.e2e` block, INSIDE the closing `}` of `root.startsWith('cockpit/')`:

```javascript
    // Per-cap python changes affect the sibling angular's e2e + build.
    // (Python project.jsons don't carry e2e/build-all targets; those live
    // on the sibling angular project. This rule bridges that gap.)
    if (root.includes('/python')) {
      scope.cockpit_examples = true;
      scope.cockpit_e2e = true;
    }
```

After the edit, the full block should be:

```javascript
  if (root.startsWith('cockpit/')) {
    if (root.includes('/angular') || project.projectType === 'application') {
      scope.cockpit_examples = true;
    }

    if (targets.smoke && root.includes('/python')) {
      scope.cockpit_smoke = true;
    }

    if (targets.integration) {
      scope.cockpit_secret = true;
    }

    if (targets.e2e) {
      scope.cockpit_e2e = true;
    }

    // Per-cap python changes affect the sibling angular's e2e + build.
    // (Python project.jsons don't carry e2e/build-all targets; those live
    // on the sibling angular project. This rule bridges that gap.)
    if (root.includes('/python')) {
      scope.cockpit_examples = true;
      scope.cockpit_e2e = true;
    }
  }
```

- [ ] **Step 3: Add the deploy-script fallback rule to `applyFallbackPathScope`**

Find the `applyFallbackPathScope` function. After the existing fallback rules (the last one is the `tools/posthog/` block) and before the closing `}`, add:

```javascript
  if (
    changedFile === 'scripts/generate-shared-deployment-config.ts' ||
    changedFile === 'apps/cockpit/scripts/capability-registry.ts'
  ) {
    scope.cockpit = true;
    scope.cockpit_examples = true;
    scope.cockpit_smoke = true;
    scope.cockpit_e2e = true;
    scope.cockpit_deploy_smoke = true;
  }
```

- [ ] **Step 4: Confirm the file still parses (syntactic check)**

```bash
node --check scripts/ci-scope.mjs && echo "parse OK"
```

Expected: `parse OK`. Any syntax error STOPs.

- [ ] **Step 5: Commit**

```bash
git add scripts/ci-scope.mjs
git commit -m "$(cat <<'EOF'
fix(ci-scope): trigger cockpit_e2e/examples for per-cap python + deploy script

Two classifier gaps surfaced by PR #432 (umbrella cleanup PR 1) where
Cockpit gates skipped because the diff was per-cap python + a script
file with no project ownership:

1. Per-cap python project.jsons declare `build` + `smoke` targets but
   no `e2e` target (e2e lives on the sibling angular project). The
   classifier's existing `targets.e2e` check therefore never sets
   `cockpit_e2e` for python changes. New rule: any change under
   cockpit/<product>/<cap>/python/ sets cockpit_examples + cockpit_e2e.

2. `scripts/generate-shared-deployment-config.ts` and (defensively)
   `apps/cockpit/scripts/capability-registry.ts` aren't claimed by any
   project root. Explicit fallback rule now sets the full cockpit
   scope when these files change.

Tests in scripts/ci-scope.spec.mjs cover the new behaviors.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add classifier tests (`scripts/ci-scope.spec.mjs`)

**Files:**
- Modify: `scripts/ci-scope.spec.mjs`

- [ ] **Step 1: Read the existing tests to identify the insertion point**

```bash
grep -n "test('\|^const " scripts/ci-scope.spec.mjs | head -20
```

This shows the structure (existing `const projects = [...]` block + a series of `test('...')` blocks).

- [ ] **Step 2: Add three new tests at the end of the file**

Open `scripts/ci-scope.spec.mjs`. After the last existing `test('...')` block, append the following:

```javascript

test('per-cap chat python change triggers cockpit_e2e + cockpit_examples + cockpit_smoke', () => {
  const scope = classifyChangedFiles(
    ['cockpit/new/cap/python/langgraph.json'],
    workspace,
  );
  assert.equal(scope.cockpit_examples, true);
  assert.equal(scope.cockpit_e2e, true);
  assert.equal(scope.cockpit_smoke, true); // existing path — preserved
});

test('per-cap python change without smoke target still triggers e2e + examples', () => {
  // Project setup: an imagined render python with only `build` target.
  const renderProjects = [
    ...projects,
    {
      name: 'cockpit-render-fake-python',
      root: 'cockpit/render/fake/python',
      sourceRoot: 'cockpit/render/fake/python/src',
      projectType: 'library',
      tags: [],
      targets: { build: {} },
    },
  ];
  const scope = classifyChangedFiles(
    ['cockpit/render/fake/python/langgraph.json'],
    { projects: renderProjects, publishableProjects: ['chat'] },
  );
  assert.equal(scope.cockpit_examples, true);
  assert.equal(scope.cockpit_e2e, true);
  // No smoke target → cockpit_smoke stays false
  assert.equal(scope.cockpit_smoke, false);
});

test('generate-shared-deployment-config.ts triggers full cockpit scope', () => {
  const scope = classifyChangedFiles(
    ['scripts/generate-shared-deployment-config.ts'],
    workspace,
  );
  assert.equal(scope.cockpit, true);
  assert.equal(scope.cockpit_examples, true);
  assert.equal(scope.cockpit_smoke, true);
  assert.equal(scope.cockpit_e2e, true);
  assert.equal(scope.cockpit_deploy_smoke, true);
});
```

- [ ] **Step 3: Run the tests — both new and existing**

```bash
node --test scripts/ci-scope.spec.mjs 2>&1 | tail -15
```

Expected: all tests pass (existing count + 3 new). The summary line shows `# pass <N+3>` and `# fail 0`. If any fail, STOP — likely a quoting/syntax issue in the new test text.

- [ ] **Step 4: Commit**

```bash
git add scripts/ci-scope.spec.mjs
git commit -m "$(cat <<'EOF'
test(ci-scope): cover per-cap python + deploy-script trigger rules

Three new tests:
- Per-cap chat python (langgraph.json change) → cockpit_examples,
  cockpit_e2e, cockpit_smoke all true.
- Per-cap python WITHOUT a smoke target → cockpit_examples + cockpit_e2e
  true; cockpit_smoke stays false (proves the new rule doesn't
  accidentally trigger smoke).
- scripts/generate-shared-deployment-config.ts change → all 5 cockpit
  scopes true.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add 6 render python project.json files

**Files:**
- Create: `cockpit/render/computed-functions/python/project.json`
- Create: `cockpit/render/element-rendering/python/project.json`
- Create: `cockpit/render/registry/python/project.json`
- Create: `cockpit/render/repeat-loops/python/project.json`
- Create: `cockpit/render/spec-rendering/python/project.json`
- Create: `cockpit/render/state-management/python/project.json`

- [ ] **Step 1: Write all 6 project.json files**

For each render python dir, write a project.json. Use a loop to generate them mechanically (substituting `<topic>`):

```bash
for topic in computed-functions element-rendering registry repeat-loops spec-rendering state-management; do
  cat > "cockpit/render/$topic/python/project.json" <<JSON
{
  "name": "cockpit-render-$topic-python",
  "\$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/render/$topic/python/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/cockpit/render/$topic/python"],
      "options": {
        "outputPath": "dist/cockpit/render/$topic/python",
        "main": "cockpit/render/$topic/python/src/index.ts",
        "tsConfig": "cockpit/render/$topic/python/tsconfig.json"
      }
    }
  }
}
JSON
done
echo "wrote 6 project.json files"
```

Note: the heredoc uses `\$schema` (escaped dollar) so bash doesn't try to expand `$schema` as a variable.

- [ ] **Step 2: Verify all 6 files parse as valid JSON**

```bash
for topic in computed-functions element-rendering registry repeat-loops spec-rendering state-management; do
  p="cockpit/render/$topic/python/project.json"
  node -e "JSON.parse(require('fs').readFileSync('$p','utf8'))" \
    && echo "  ✓ $p" \
    || echo "  ✗ $p"
done
```

Expected: 6 ✓ marks.

- [ ] **Step 3: Verify nx discovers all 6 new projects**

```bash
npx nx show projects 2>/dev/null | grep -E "^cockpit-render-.*-python$" | sort
```

Expected: 6 lines:
```
cockpit-render-computed-functions-python
cockpit-render-element-rendering-python
cockpit-render-registry-python
cockpit-render-repeat-loops-python
cockpit-render-spec-rendering-python
cockpit-render-state-management-python
```

If fewer than 6 appear, STOP and check which project.json is malformed.

- [ ] **Step 4: Spot-check that `nx build` succeeds for one of them**

```bash
npx nx build cockpit-render-spec-rendering-python --skip-nx-cache 2>&1 | tail -10
```

Expected: `Successfully ran target build for project cockpit-render-spec-rendering-python`. If it fails with "Cannot find module" or a tsconfig error, STOP — likely a path mismatch between project.json and the actual src/index.ts or tsconfig.json. Common fix: confirm `cockpit/render/spec-rendering/python/tsconfig.json` exists.

- [ ] **Step 5: Commit**

```bash
git add cockpit/render/computed-functions/python/project.json \
        cockpit/render/element-rendering/python/project.json \
        cockpit/render/registry/python/project.json \
        cockpit/render/repeat-loops/python/project.json \
        cockpit/render/spec-rendering/python/project.json \
        cockpit/render/state-management/python/project.json
git commit -m "$(cat <<'EOF'
chore(cockpit-render): add nx project.json to 6 render python dirs

Each of the 6 cockpit/render/<topic>/python/ directories had src/,
package.json, langgraph.json, prompts/, and tsconfig.json — but no
nx project.json. This made the CI-scope classifier unable to claim
ownership of files under those paths (surfaced by PR #432 where a
change to cockpit/render/registry/python/langgraph.json triggered
zero cockpit scope).

Each new project.json mirrors the chat per-cap python template
(library + build target via @nx/js:tsc). No serve target since
render python dirs don't currently boot from `nx serve`.

After this commit, nx show projects lists 6 new entries and the
ci-scope classifier correctly triggers cockpit_e2e + examples for
any render python change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integration verification (no commit)

- [ ] **Step 1: Confirm `node --test` passes the full suite**

```bash
node --test scripts/ci-scope.spec.mjs 2>&1 | tail -8
```

Expected: all tests pass, no failures.

- [ ] **Step 2: Manual dry-run simulating PR #432's file set**

Recreate the changed-files list and run the classifier directly. The simplest way is to inline-call the classifier from Node using `discoverProjects`:

```bash
node -e "
import('./scripts/ci-scope.mjs').then(m => {
  const ws = { projects: m.discoverProjects(process.cwd()), publishableProjects: [] };
  const scope = m.classifyChangedFiles(
    ['scripts/generate-shared-deployment-config.ts',
     'cockpit/langgraph/streaming/python/langgraph.json',
     'cockpit/render/registry/python/langgraph.json'],
    ws,
  );
  console.log('cockpit_e2e:', scope.cockpit_e2e);
  console.log('cockpit_examples:', scope.cockpit_examples);
  console.log('cockpit_smoke:', scope.cockpit_smoke);
  console.log('cockpit_deploy_smoke:', scope.cockpit_deploy_smoke);
});
"
```

Expected: `cockpit_e2e: true`, `cockpit_examples: true`, `cockpit_smoke: true` (deploy-script fallback adds it for `generate-shared-deployment-config.ts`), `cockpit_deploy_smoke: true`.

If `cockpit_e2e: false`, the fix didn't land — STOP.

- [ ] **Step 3: Confirm no regression — existing classifier tests pass**

(Already done in Step 1; this is a sanity-recheck for the committed final state.)

```bash
node --test scripts/ci-scope.spec.mjs 2>&1 | grep -E "^# (pass|fail|tests)" | head -5
```

Expected: `# fail 0`, `# pass <some number ≥ the original count + 3>`.

---

## Task 5: Push, open PR, watch CI, merge

Orchestrator task. Implementer STOPS after Task 4.

- [ ] **Step 1: Push from the dedicated worktree**

```bash
cd /tmp/ci-scope-fix
git push -u origin claude/ci-scope-per-cap-python
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --head claude/ci-scope-per-cap-python --title "fix(ci-scope): trigger cockpit_e2e for per-cap python + deploy script + add render python project.jsons" --body "$(cat <<'EOF'
## Summary
Surfaced during PR #432 (umbrella cleanup PR 1) where Cockpit — e2e, build / test, and build all examples all SKIPPED despite the PR touching per-cap python files and the deploy script. Three coordinated fixes:

1. \`scripts/ci-scope.mjs\` — add a per-cap python branch to \`applyProjectScope\` so any change under \`cockpit/<product>/<cap>/python/\` sets \`cockpit_examples\` + \`cockpit_e2e\` (today: only \`cockpit_smoke\` triggers, because python project.jsons declare no e2e target). Plus add an explicit fallback rule for \`scripts/generate-shared-deployment-config.ts\` (today: no cockpit scope triggers).
2. \`scripts/ci-scope.spec.mjs\` — three new tests covering chat python, render-python-without-smoke-target, and the deploy script.
3. 6 new \`cockpit/render/<topic>/python/project.json\` files. Render python dirs previously had no project.json, so the classifier couldn't claim ownership of files under those paths.

**This unblocks PR 2 of the umbrella cleanup** — without this fix, deleting the umbrella's dead source files would skip the same Cockpit gates that PR #432 did.

## Test plan
- [x] \`node --test scripts/ci-scope.spec.mjs\` — all tests pass (existing + 3 new)
- [x] Manual dry-run: classifier against PR #432's changed-files list now triggers \`cockpit_e2e\`, \`cockpit_examples\`, \`cockpit_smoke\`, \`cockpit_deploy_smoke\`
- [x] \`npx nx show projects\` lists 6 new render python projects
- [x] \`npx nx build cockpit-render-spec-rendering-python\` succeeds (spot-check)
- [ ] CI \`Cockpit — e2e\`, \`Cockpit — build all examples\`, \`Cockpit — build / test\` actually RUN (not skip) on this PR — proves the classifier fix works on its own changes (this PR touches \`scripts/\`, which the new fallback rule covers... actually no — scripts/ci-scope.mjs is a CI-global file so the meta-test would trigger via that path; the meaningful test is on the next PR that touches per-cap python)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

```bash
gh pr checks <PR#>
```

Required to pass: `CI scope` (classifier tests), `Library — lint / test / build` (if it runs — scripts/ci-scope.mjs is in scope), `Cockpit — *` jobs.

Note: scripts/ci-scope.mjs is itself in `isGlobalCiFile` check? No, it's not — checking the source. So this PR triggers via `applyFallbackPathScope`? No, scripts/ci-scope.mjs isn't in that list. It would NOT trigger any cockpit scope. That's fine — the CI scope check itself runs on every PR (it's the gate, not gated). The classifier tests run as part of the `ci-scope` job's `node --test scripts/ci-scope.spec.mjs` step.

- [ ] **Step 4: Merge on green**

```bash
gh pr merge <PR#> --squash --delete-branch
```

- [ ] **Step 5: Clean up worktree**

After merge, remove the dedicated worktree:

```bash
cd /Users/blove/repos/angular-agent-framework
git worktree remove --force /tmp/ci-scope-fix
git worktree list | head -3
```

Expected: `/tmp/ci-scope-fix` no longer in the worktree list.

---

## Self-review notes

**Spec coverage:**
- `scripts/ci-scope.mjs` per-cap python branch → Task 1 Step 2.
- `scripts/ci-scope.mjs` deploy-script fallback → Task 1 Step 3.
- `scripts/ci-scope.spec.mjs` three new tests → Task 2 Step 2.
- 6 new render python project.jsons → Task 3 Step 1.
- Classifier tests pass → Task 2 Step 3 + Task 4 Step 1.
- Manual dry-run of PR #432's file set → Task 4 Step 2.
- `nx show projects` lists 6 new entries → Task 3 Step 3.
- `nx build` succeeds for spot-check → Task 3 Step 4.

**Placeholder scan:** none. Every step has exact code or commands with expected output.

**Type consistency:** `applyProjectScope` / `applyFallbackPathScope` function names match the spec and the actual file. Project naming pattern `cockpit-render-<topic>-python` consistent across project.jsons, tests, and dry-run output expectations.

**Concurrency note:** dedicated worktree at `/tmp/ci-scope-fix` insulates from shared-checkout chaos. Implementer's first command is `cd /tmp/ci-scope-fix` + branch confirm.
