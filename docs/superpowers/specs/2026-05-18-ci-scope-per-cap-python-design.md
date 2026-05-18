# CI scope classifier — per-cap python + deploy script — design

> **Place in the larger plan.** Surfaced during PR #432 (umbrella cleanup PR 1): the Cockpit — e2e, build / test, and build all examples jobs all SKIPPED because the diff (deploy script + 2 per-cap python langgraph.json files) didn't match any project-owned path that triggers `cockpit_e2e`. This PR fixes the classifier so future per-cap python and deploy-script changes correctly trigger Cockpit CI. Must land BEFORE PR 2 (umbrella code deletion) so PR 2's CI actually runs the cockpit suite.

## Goal

Close two CI-scope classifier gaps that caused PR #432's Cockpit gates to skip:
1. Per-cap python changes only set `cockpit_smoke` (because python project.jsons have no `e2e` target — e2e lives on the sibling angular project). Should also set `cockpit_examples` + `cockpit_e2e`.
2. Changes to `scripts/generate-shared-deployment-config.ts` set no cockpit scopes at all (the file isn't owned by a project). Should set the full cockpit scope.

Also add the 6 missing `project.json` files under `cockpit/render/*/python/` so they're discoverable as nx projects (currently the classifier can't claim ownership of files under those paths).

## Non-goals

- Restructuring how cockpit e2e is wired or scoped beyond fixing these two gaps.
- Adding `e2e` or `smoke` targets to per-cap python `project.json` files (the classifier extension makes this unnecessary).
- Refactoring `scripts/ci-scope.mjs` for clarity (touched minimally).
- Anything in PR 2 (the umbrella code deletion that's waiting on this).

## Background — how the classifier resolves scope

`scripts/ci-scope.mjs` runs as the `CI scope` job, classifying each PR's changed files into named scopes (e.g., `cockpit_e2e`, `library`, `examples_chat`). Downstream jobs gate on these scopes via `needs.ci-scope.outputs.<scope> == 'true'`.

For each changed file the classifier:
1. Checks if it's a "global CI file" → returns full scope.
2. Walks all discovered projects (any dir with `project.json`) and calls `applyProjectScope` for any that "own" the path.
3. Calls `applyFallbackPathScope` for explicit individual-file rules.

`applyProjectScope` for a `cockpit/<product>/<cap>/python/` project today:
- Sets `cockpit_examples` only if `root.includes('/angular') || projectType === 'application'` — FALSE for python (library).
- Sets `cockpit_smoke` if `targets.smoke && root.includes('/python')` — TRUE if the python project.json has a smoke target.
- Sets `cockpit_e2e` only if `targets.e2e` exists — FALSE for python projects (e2e lives on sibling angular).

Result: per-cap python changes today trigger ONLY `cockpit_smoke`. The e2e/build jobs skip.

For files like `scripts/generate-shared-deployment-config.ts`, no project owns the `scripts/` path (no project.json in `scripts/`). `applyFallbackPathScope` lists specific scripts but not this one. Result: zero cockpit scope.

For files under `cockpit/render/<topic>/python/` today, no project.json exists under those paths, so the classifier can't claim ownership at all. Files there trigger nothing.

## What changes

### 1. `scripts/ci-scope.mjs`

**Add to `applyProjectScope`** inside the existing `root.startsWith('cockpit/')` block, after the existing `targets.e2e` check:

```javascript
// Per-cap python changes affect the sibling angular's e2e + build.
// (Python project.jsons don't carry e2e/build-all targets; those live
// on the sibling angular project. This rule bridges that gap.)
if (root.includes('/python')) {
  scope.cockpit_examples = true;
  scope.cockpit_e2e = true;
}
```

**Add to `applyFallbackPathScope`** an explicit rule for the deploy + capability-registry scripts:

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

Note: `apps/cockpit/scripts/capability-registry.ts` IS already owned by the `apps/cockpit` project (via `ownsPath`) and therefore already triggers cockpit scopes via `applyProjectScope`. The explicit rule is defensive — guards against the registry file being moved to a non-owned location, and documents intent. Acceptable belt-and-suspenders.

### 2. `scripts/ci-scope.spec.mjs`

Add tests covering:
- Per-cap chat python changes (e.g., `cockpit/chat/messages/python/langgraph.json`) → `cockpit_e2e = true`, `cockpit_examples = true`, `cockpit_smoke = true`.
- Per-cap render python changes (after the new project.jsons land) → `cockpit_e2e = true`, `cockpit_examples = true`, `cockpit_smoke = true` (if render python has smoke targets).
- Deploy script changes → all 5 cockpit scopes set (`cockpit`, `cockpit_examples`, `cockpit_smoke`, `cockpit_e2e`, `cockpit_deploy_smoke`).
- Existing tests still pass (regression).

### 3. Six new `project.json` files under `cockpit/render/<topic>/python/`

Each one mirrors the chat per-cap python template at `cockpit/chat/tool-calls/python/project.json`:

```json
{
  "name": "cockpit-render-<topic>-python",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/render/<topic>/python/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/cockpit/render/<topic>/python"],
      "options": {
        "outputPath": "dist/cockpit/render/<topic>/python",
        "main": "cockpit/render/<topic>/python/src/index.ts",
        "tsConfig": "cockpit/render/<topic>/python/tsconfig.json"
      }
    }
  }
}
```

Six topics: `computed-functions`, `element-rendering`, `registry`, `repeat-loops`, `spec-rendering`, `state-management`. Each gets a project.json with its topic substituted.

These do NOT include a `serve` target (chat python templates have one, but render caps don't currently boot from `nx serve` so we omit it). The classifier doesn't require any specific targets; just project.json existence enables ownership claims.

**Tsconfig sanity:** each render python dir already has a `tsconfig.json` (verified earlier). The `build` target's `main` points at the existing `src/index.ts`. No new files beyond the 6 project.jsons.

## Verification

### Classifier tests

- `node --test scripts/ci-scope.spec.mjs` — all tests pass (existing + new).
- Manual classifier dry-run simulating PR #432's changed file set:
  ```bash
  echo -e 'scripts/generate-shared-deployment-config.ts\ncockpit/langgraph/streaming/python/langgraph.json\ncockpit/render/registry/python/langgraph.json' \
    | node scripts/ci-scope.mjs --stdin
  ```
  Expected output: `cockpit_e2e=true`, `cockpit_examples=true`, `cockpit_smoke=true`, `cockpit_deploy_smoke=true`. Before this PR: only `cockpit_smoke=true`.

  (If `--stdin` is not a real flag, the test mechanism is whatever `ci-scope.mjs` supports for offline testing — adjust during implementation. The classifier-spec tests cover the same ground programmatically.)

### Nx project discovery

- `npx nx show projects | grep render.*python` lists all 6 new render python projects.
- `npx nx build cockpit-render-spec-rendering-python` succeeds. (Spot-check 1 of 6.)

### No regression

- Existing classifier tests pass.
- `nx show projects` still lists all existing projects.

## Risk surface

- **More PRs will trigger cockpit jobs.** Intentional. Any per-cap python change now triggers e2e + build, vs. just smoke today. Slightly higher CI cost; correctly identifies actual risk surface.
- **The 6 new project.jsons add nx discovery overhead.** `nx show projects` will list 6 more entries. No meaningful build/CI cost — render python doesn't typically get built or tested in standard pipelines.
- **Tsconfig drift.** If a render python dir's `tsconfig.json` doesn't match the `build` target's expectations, `npx nx build` fails. Pre-flight verification step covers this for at least one render python project.

## Acceptance criteria

- `scripts/ci-scope.mjs` has the two new code blocks (applyProjectScope python branch + applyFallbackPathScope deploy-script rule).
- `scripts/ci-scope.spec.mjs` has at least 3 new tests covering: per-cap chat python → e2e/examples/smoke triggered; deploy script → all cockpit scopes; existing scenarios unchanged.
- `node --test scripts/ci-scope.spec.mjs` passes.
- 6 new `cockpit/render/<topic>/python/project.json` files exist; each follows the template above with `<topic>` substituted.
- `npx nx show projects` includes the 6 new render python projects.
- `npx nx build cockpit-render-spec-rendering-python` succeeds (spot-check).
- Existing classifier tests still pass.

**End state:** A future PR identical in scope to PR #432 (per-cap python + deploy script changes) will trigger Cockpit — e2e, Cockpit — build all examples, and Cockpit — build / test rather than skipping them.
