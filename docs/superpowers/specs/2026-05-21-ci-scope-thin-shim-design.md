# ci-scope thin shim + implicitDependencies — design

> **Place in the larger plan.** Task #16 in the post-Task-#4 cleanup arc. Final item from the e2e audit. Replaces the hand-maintained 340-LOC `scripts/ci-scope.mjs` classifier with a ~50-LOC shim that delegates to `nx affected` for project ownership and reads `scope:*` tags off each project to decide which CI scopes to emit.

## Goal

Shrink `scripts/ci-scope.mjs` from 340 LOC to ~50 LOC by replacing two pieces of hand-maintained logic with data:

1. **`applyProjectScope` rules** (~80 LOC) → become `tags: ["scope:*"]` on each `project.json`. The shim reads tags off projects nx reports as affected and unions them into scope booleans.
2. **`applyFallbackPathScope` rules** (~50 LOC) → become `implicitDependencies` entries on the projects that should be affected when non-project files (vercel.json, deploy scripts, capability-registry.ts, etc.) change. Nx then considers those projects affected via the implicit dep edge.

Preserve all existing CI gate semantics: every scope boolean still emits correctly for the same set of file changes; jobs still skip cleanly (no "fast pass" cost regression).

## Non-goals

- Switching from gate semantics to per-job `nx affected -t <target>` (Option C in the brainstorm). The runner-minute and wall-time cost analysis showed Option C trades real developer friction for stylistic cleanness; not worth it.
- Touching workflow `if:` conditions. They still gate on the same scope booleans; the upstream computation just changes.
- Refactoring the `SCOPE_KEYS` list. Same 11 scope names emit; the only thing that changes is how they're computed.
- Re-organizing the project structure or splitting any lib. The migration is purely metadata + classifier rewrite.

## Background — what ci-scope.mjs does today

The CI workflow's first job runs `scripts/ci-scope.mjs --base $base --head $head --output $GITHUB_OUTPUT`. The script:

1. Computes changed files via `git diff --name-only base head`.
2. For each file, applies up to three transforms:
   - **Global short-circuit**: if the file is `.github/workflows/ci.yml`, `package.json`, etc., return the full scope (every gate runs).
   - **Project ownership**: discover every `project.json` in the repo, find which ones own the file via `ownsPath`, apply `applyProjectScope` rules per owning project.
   - **Fallback path**: apply file-specific rules in `applyFallbackPathScope` (e.g., `vercel.json` → `website + website_e2e`).
3. Writes scope booleans (`cockpit_e2e=true/false`) to `$GITHUB_OUTPUT` for downstream jobs to gate on via `if: needs.ci-scope.outputs.cockpit_e2e == 'true'`.

The 11 scope booleans: `library`, `website`, `website_e2e`, `cockpit`, `cockpit_examples`, `cockpit_smoke`, `cockpit_secret`, `cockpit_deploy_smoke`, `cockpit_e2e`, `examples_chat`, `posthog`.

## New shape — thin shim

### `scripts/ci-scope.mjs` after migration (~50 LOC)

```js
#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCOPE_KEYS = [
  'library', 'website', 'website_e2e', 'cockpit', 'cockpit_examples',
  'cockpit_smoke', 'cockpit_secret', 'cockpit_deploy_smoke', 'cockpit_e2e',
  'examples_chat', 'posthog',
];

const GLOBAL_CI_FILES = new Set([
  '.github/workflows/ci.yml', 'package.json', 'package-lock.json',
  'nx.json', 'tsconfig.json', 'tsconfig.base.json', 'eslint.config.mjs',
]);

export function emptyScope() {
  return Object.fromEntries(SCOPE_KEYS.map((k) => [k, false]));
}
export function fullScope() {
  return Object.fromEntries(SCOPE_KEYS.map((k) => [k, true]));
}

function tagToScopeKey(tag) {
  // 'scope:cockpit-e2e' → 'cockpit_e2e'
  return tag.replace(/^scope:/, '').replaceAll('-', '_');
}

export function classifyFromAffected(changedFiles, affectedProjects) {
  for (const f of changedFiles) {
    if (GLOBAL_CI_FILES.has(f)) return fullScope();
  }
  const scope = emptyScope();
  for (const project of affectedProjects) {
    for (const tag of project.tags ?? []) {
      if (!tag.startsWith('scope:')) continue;
      const key = tagToScopeKey(tag);
      if (SCOPE_KEYS.includes(key)) scope[key] = true;
    }
  }
  return scope;
}

function changedFilesBetween(base, head, workspaceRoot) {
  return execFileSync('git', ['diff', '--name-only', base, head], {
    cwd: workspaceRoot, encoding: 'utf8',
  }).split('\n').map((l) => l.trim()).filter(Boolean);
}

function loadAffectedProjects(base, head, workspaceRoot) {
  const namesJson = execFileSync('npx', ['nx', 'show', 'projects', '--affected',
    '--base', base, '--head', head, '--json'], {
    cwd: workspaceRoot, encoding: 'utf8',
  });
  const names = JSON.parse(namesJson);
  return names.map((name) => {
    const projectJsonPath = execFileSync('npx', ['nx', 'show', 'project', name, '--json'], {
      cwd: workspaceRoot, encoding: 'utf8',
    });
    return JSON.parse(projectJsonPath);
  });
}

function writeOutputs(scope, outputPath) {
  const lines = SCOPE_KEYS.map((k) => `${k}=${scope[k] ? 'true' : 'false'}`);
  if (outputPath) appendFileSync(outputPath, `${lines.join('\n')}\n`);
  for (const line of lines) console.log(line);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    args[a.slice(2)] = argv[i + 1];
    i++;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const workspaceRoot = process.cwd();
  if (args.event === 'push') {
    writeOutputs(fullScope(), args.output);
    console.log('Push to main runs the full CI suite.');
    return;
  }
  if (!args.base || !args.head) {
    throw new Error('Expected --base and --head for pull request scope detection.');
  }
  const changedFiles = changedFilesBetween(args.base, args.head, workspaceRoot);
  const affectedProjects = loadAffectedProjects(args.base, args.head, workspaceRoot);
  const scope = classifyFromAffected(changedFiles, affectedProjects);
  console.log('Changed files:');
  for (const f of changedFiles) console.log(`  ${f}`);
  writeOutputs(scope, args.output);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) {
    console.error(`::error::${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
```

That's it. Everything else is data on projects.

## Tag taxonomy — `scope:*` on projects

Every project that participates in CI gating gets one or more `scope:*` tags. The shim translates `scope:cockpit-e2e` → `cockpit_e2e` scope key. The mapping is mechanical — kebab-case tag suffix → snake_case scope key.

### Tags by project category

**Publishable libs** (`chat`, `langgraph`, `ag-ui`, `render`, `a2ui`, `licensing`, `telemetry`):

```json
{
  "tags": [
    "scope:library", "scope:website", "scope:website-e2e",
    "scope:cockpit", "scope:cockpit-examples", "scope:cockpit-smoke",
    "scope:cockpit-secret", "scope:cockpit-deploy-smoke",
    "scope:cockpit-e2e", "scope:examples-chat"
  ]
}
```

(Publishable libs broadcast to almost everything because any consumer could be affected. Matches today's `if (publishableProjects.has(name))` block.)

**Cockpit internal libs** (`libs/cockpit-*`, `libs/design-tokens`, `libs/ui-react`, `libs/example-layouts`, `libs/e2e-harness`):

```json
{ "tags": ["scope:cockpit", "scope:cockpit-examples", "scope:cockpit-deploy-smoke", "scope:cockpit-e2e"] }
```

**Cockpit cap angular apps** (`cockpit/*/*/angular`):

```json
{ "tags": ["scope:cockpit-examples", "scope:cockpit-e2e"] }
```

(Plus `scope:cockpit-secret` if `targets.integration` exists. Plus `scope:cockpit-smoke` is irrelevant for angular — smoke is python-side.)

**Cockpit cap python projects** (`cockpit/*/*/python`):

```json
{ "tags": ["scope:cockpit-smoke", "scope:cockpit-examples", "scope:cockpit-e2e"] }
```

(Python changes affect the sibling angular's e2e + build — current `if (root.includes('/python'))` rule.)

**Website** (`apps/website`):

```json
{ "tags": ["scope:website", "scope:website-e2e"] }
```

**Cockpit app** (`apps/cockpit`):

```json
{ "tags": ["scope:cockpit", "scope:cockpit-examples", "scope:cockpit-deploy-smoke", "scope:cockpit-e2e"] }
```

**Examples chat** (`examples/chat/*`):

```json
{ "tags": ["scope:examples-chat"] }
```

**PostHog tools** (`tools/posthog`):

```json
{ "tags": ["scope:posthog"] }
```

Each project's tags array is the **single declaration** of which workflow gates its changes trigger. Reviewers grep `scope:*` to audit.

## implicitDependencies — fallback paths become first-class

The current `applyFallbackPathScope` has ~12 file-specific rules. Each becomes an entry in the relevant project's `implicitDependencies`:

| File | Owner project | Rationale |
|---|---|---|
| `vercel.json` | `apps/website` | Site-level Vercel config; affects website deploy. |
| `vercel.cockpit.json` | `apps/cockpit` | Cockpit deploy config. |
| `vercel.examples.json` | `apps/cockpit` | Examples assembly affects cockpit. |
| `vercel.demo.json` | `apps/cockpit` | Demo-mode wrapper config. |
| `scripts/assemble-demo.ts` | `apps/cockpit` | Builds cockpit demo bundle. |
| `scripts/assemble-examples.ts` | `apps/cockpit` | Assembles per-cap examples. |
| `scripts/demo-middleware.ts` | `apps/cockpit` | Demo runtime middleware. |
| `scripts/langgraph-proxy.ts` | `apps/cockpit` | Demo LangGraph proxy. |
| `scripts/rate-limit.ts` | `apps/cockpit` | Demo rate limiter. |
| `scripts/deploy-smoke.ts` | `apps/cockpit` | Cockpit deploy-smoke driver. |
| `apps/cockpit/scripts/deploy-smoke.ts` | `apps/cockpit` | Same; in-cockpit path. |
| `scripts/generate-shared-deployment-config.ts` | `apps/cockpit` | Drives LangSmith deployment manifest. |
| `apps/cockpit/scripts/capability-registry.ts` | `apps/cockpit` | Source of truth for all cap metadata. |
| `tools/posthog/**` | `tools/posthog` (already a project) | Auto-owned via project root match. |

After this migration, `applyFallbackPathScope` and `isGlobalCiFile`'s file-list disappear (except for the `GLOBAL_CI_FILES` short-circuit set, which stays in the shim because some workflow-config changes need to trigger every gate).

Project.json edit example:

```json
// apps/website/project.json
{
  "name": "website",
  "tags": ["scope:website", "scope:website-e2e"],
  "implicitDependencies": ["//vercel.json"],
  ...
}
```

The `//` prefix tells nx these are workspace file paths, not project names.

## Migration sequencing

Split into **3 PRs** for safe rollout:

### PR 1 — metadata add (no behavior change)

- Add `tags: ["scope:*"]` to every project that should participate in CI gating (~50 project.json files).
- Add `implicitDependencies` for the ~13 fallback files to their target projects (~5-10 project.json files; some overlap).
- ci-scope.mjs unchanged. The old `applyProjectScope`/`applyFallbackPathScope` still drive gating. Tags + implicitDependencies are inert.
- **Verification**: `npx nx show projects --affected --base origin/main --head HEAD` returns expected projects when test files are touched (manual spot-check).

### PR 2 — shim rewrite + test migration

- Replace `scripts/ci-scope.mjs` with the ~50-LOC shim above.
- Migrate `scripts/ci-scope.spec.mjs`: tests now inject synthetic `affectedProjects` arrays (with `tags`) and assert scope output. Old `workspace` fixtures go away.
- Run dual-mode in CI: keep the old code as `ci-scope-legacy.mjs`; run both, assert outputs match in a smoke test. (Optional safety net; the migration is the whole point so dual-mode is short-lived.)
- **Verification**: CI on PR 2 itself must classify correctly — the PR's own gates must fire as expected.

### PR 3 — cleanup

- Remove dual-mode + legacy script.
- Add a `cockpit-e2e-wiring.spec.ts`-style assertion: every cap project has the expected `scope:cockpit-e2e` + `scope:cockpit-examples` tags (drift guard).

## Test strategy

The shim's `classifyFromAffected(changedFiles, affectedProjects)` is a **pure function** of pre-computed inputs. Tests inject synthetic data:

```js
import { classifyFromAffected, fullScope, emptyScope } from './ci-scope.mjs';

test('publishable lib affected → broadcasts to all related scopes', () => {
  const scope = classifyFromAffected(['libs/chat/src/foo.ts'], [
    { name: 'chat', tags: ['scope:library', 'scope:website', 'scope:cockpit-e2e', ...] }
  ]);
  expect(scope.library).toBe(true);
  expect(scope.cockpit_e2e).toBe(true);
});

test('global ci file → full scope short-circuit', () => {
  const scope = classifyFromAffected(['.github/workflows/ci.yml'], []);
  expect(scope).toEqual(fullScope());
});

test('no affected projects + no global files → empty scope', () => {
  const scope = classifyFromAffected(['some/docs/file.md'], []);
  expect(scope).toEqual(emptyScope());
});
```

The `loadAffectedProjects` and `changedFilesBetween` Nx-shell-out helpers don't need unit tests (they're thin wrappers around `execFileSync`). The first PR run on PR 2 is the integration test.

## Risk surface

- **Tag drift**: a contributor adds a new project but forgets `scope:*` tags → that project's changes silently don't trigger CI. Mitigation: PR 3 adds an assertion that every project in `cockpit/` has at least `scope:cockpit-examples` + `scope:cockpit-e2e`.
- **Nx version coupling**: `npx nx show projects --affected --json` output format could change across Nx major versions. Mitigation: pin Nx version (already pinned via package-lock); fail fast if output isn't a JSON array of strings.
- **`implicitDependencies` for files that don't exist**: nx will warn but not fail. Mitigation: in PR 1, validate every implicit-dep file path exists at write time.
- **PR 2's own gating**: the shim rewrite runs against the PR's own changes. If something's wrong, PR 2's gates fire wrong, and we may merge incorrectly. Mitigation: optional dual-mode parallel-run in PR 2 (assert old & new agree before cutting over).
- **`nx affected` cold startup**: 2-5s overhead on every CI run. Already analyzed; acceptable trade-off for the simpler classifier + dependency-graph correctness.

## Acceptance criteria

- `scripts/ci-scope.mjs` is ≤80 LOC (down from 340).
- Every CI-participating project has `scope:*` tags declaring its scope membership.
- Every fallback file (vercel.*.json, scripts/*.ts, apps/cockpit/scripts/capability-registry.ts) is reachable via `implicitDependencies` on the correct project.
- All existing `scripts/ci-scope.spec.mjs` scenarios pass under the new shape (with synthetic-affected-project test fixtures).
- A PR that changes `vercel.json` triggers `website` + `website_e2e` gates (no other gates). (Smoke test on PR 2.)
- A PR that changes `cockpit/chat/messages/python/src/graph.py` triggers `cockpit_e2e` + `cockpit_smoke` + `cockpit_examples` gates. (Smoke test on PR 2.)
- A PR that changes `.github/workflows/ci.yml` triggers all gates (full scope short-circuit). (Smoke test on PR 2.)
- No regression: every gate that fires for a file today fires the same way after migration.

**End state**: ci-scope.mjs is a ~50-LOC shim; project.json files declare their CI participation via `scope:*` tags; fallback paths live as `implicitDependencies` next to the project they affect. New contributors discover scope membership by reading the project they're touching, not a centralized 340-LOC classifier.
