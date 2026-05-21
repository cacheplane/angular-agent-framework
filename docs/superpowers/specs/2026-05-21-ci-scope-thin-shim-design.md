# ci-scope thin shim + namedInputs — design

> **Place in the larger plan.** Task #16 in the post-Task-#4 cleanup arc. Final item from the e2e audit. Replaces the hand-maintained 340-LOC `scripts/ci-scope.mjs` classifier with a ~50-LOC shim that delegates to `nx affected` for project ownership and reads `scope:*` tags off each project to decide which CI scopes to emit.
>
> **Revision (post-PR-#503):** The original spec used `implicitDependencies: ["//path"]` for file-level deps. PR #503 surfaced that Nx 22.5.1 rejects this syntax — `implicitDependencies` entries are validated strictly as project names, with error: "The following implicitDependencies point to non-existent project(s)". The correct Nx-native mechanism is per-project `namedInputs` referenced by target `inputs`. Spec updated below.

## Goal

Shrink `scripts/ci-scope.mjs` from 340 LOC to ~50 LOC by replacing two pieces of hand-maintained logic with data:

1. **`applyProjectScope` rules** (~80 LOC) → become `tags: ["scope:*"]` on each `project.json`. The shim reads tags off projects nx reports as affected and unions them into scope booleans. **Shipped in PR #503.**
2. **`applyFallbackPathScope` rules** (~50 LOC) → become per-project `namedInputs` referenced by target `inputs`. When any file in the named input changes, nx considers the project affected. The shim picks up the project as affected via `nx show projects --affected` + reads its `scope:*` tags.

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

## namedInputs — fallback paths become first-class

The current `applyFallbackPathScope` has ~12 file-specific rules. Each fallback file becomes part of a per-project `namedInputs` entry, referenced by that project's target `inputs` array. When any file in the named input changes, nx considers the project affected — and the shim picks it up via `nx show projects --affected`.

**Why `namedInputs` instead of `implicitDependencies`:** Nx 22.5.1's `implicitDependencies` is validated strictly as a list of project names; file paths produce "implicitDependencies point to non-existent project(s)" at graph-load time. The `namedInputs` + target `inputs` pattern is the Nx-native mechanism for declaring file-level affecting-deps. (Surfaced by PR #503's first attempt; details in the spec header revision note.)

### Per-project namedInputs

| File | Owner project | Added to namedInput |
|---|---|---|
| `vercel.json` | `apps/website` | `deploymentConfig` |
| `vercel.cockpit.json` | `apps/cockpit` | `deploymentConfig` |
| `vercel.examples.json` | `apps/cockpit` | `deploymentConfig` |
| `vercel.demo.json` | `apps/cockpit` | `deploymentConfig` |
| `scripts/assemble-demo.ts` | `apps/cockpit` | `deploymentConfig` |
| `scripts/assemble-examples.ts` | `apps/cockpit` | `deploymentConfig` |
| `scripts/demo-middleware.ts` | `apps/cockpit` | `deploymentConfig` |
| `scripts/langgraph-proxy.ts` | `apps/cockpit` | `deploymentConfig` |
| `scripts/rate-limit.ts` | `apps/cockpit` | `deploymentConfig` |
| `apps/cockpit/scripts/deploy-smoke.ts` | `apps/cockpit` | `deploymentConfig` |
| `scripts/generate-shared-deployment-config.ts` | `apps/cockpit` | `deploymentConfig` |
| `apps/cockpit/scripts/capability-registry.ts` | `apps/cockpit` | `deploymentConfig` |
| `tools/posthog/**` | `tools/posthog` (already a project) | (auto-owned via project root match) |

After this migration, `applyFallbackPathScope` disappears entirely. `isGlobalCiFile`'s short-circuit set stays in the shim (workflow-config changes correctly trigger every gate via the full-scope return).

### Project.json edit example

```json
// apps/cockpit/project.json
{
  "name": "cockpit",
  "tags": [
    "scope:cockpit", "scope:cockpit-deploy-smoke",
    "scope:cockpit-e2e", "scope:cockpit-examples"
  ],
  "namedInputs": {
    "deploymentConfig": [
      "{workspaceRoot}/vercel.cockpit.json",
      "{workspaceRoot}/vercel.examples.json",
      "{workspaceRoot}/vercel.demo.json",
      "{workspaceRoot}/scripts/assemble-demo.ts",
      "{workspaceRoot}/scripts/assemble-examples.ts",
      "{workspaceRoot}/scripts/demo-middleware.ts",
      "{workspaceRoot}/scripts/langgraph-proxy.ts",
      "{workspaceRoot}/scripts/rate-limit.ts",
      "{workspaceRoot}/apps/cockpit/scripts/deploy-smoke.ts",
      "{workspaceRoot}/scripts/generate-shared-deployment-config.ts",
      "{workspaceRoot}/apps/cockpit/scripts/capability-registry.ts"
    ]
  },
  "targets": {
    "build": {
      "inputs": ["default", "deploymentConfig", "^default"]
    }
  }
}
```

The `{workspaceRoot}/...` syntax is the Nx-native token for repo-relative paths. The `inputs` reference in the `build` target tells nx that any change to `deploymentConfig` files invalidates the build's cache AND marks this project as affected.

For `apps/cockpit`, the `inputs` need to land on whichever target nx affected uses to determine project affectedness — typically `build` (and any other long-running targets like `test`). The plan covers exact target placement during implementation.

## Migration sequencing

Split into **3 PRs** for safe rollout:

### PR 1 — tags only (no behavior change) — **SHIPPED in PR #503**

- Added `tags: ["scope:*"]` to 87 project.json files.
- Original spec also added `implicitDependencies: ["//path"]` for fallback files; this broke 29 CI jobs because Nx 22.5.1 rejects file-path syntax in implicitDependencies. Reverted within PR #503.
- ci-scope.mjs unchanged. Tags inert until PR 2.

### PR 2 — namedInputs + shim rewrite + test migration

- Add `namedInputs.deploymentConfig` to `apps/cockpit` and `apps/website` project.json. Reference it in target `inputs` (typically `build`, `test`).
- Replace `scripts/ci-scope.mjs` with the ~50-LOC shim above (reads tags from `nx show projects --affected --json`).
- Migrate `scripts/ci-scope.spec.mjs`: tests now inject synthetic `affectedProjects` arrays (with `tags`) and assert scope output. Old `workspace` fixtures go away.
- **Verification**: CI on PR 2 itself must classify correctly — the PR's own gates fire as expected. The namedInputs change is the critical part — must confirm via `nx show projects --affected` that changing `vercel.cockpit.json` correctly marks `apps/cockpit` as affected.

### PR 3 — drift guard

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
- **namedInputs target-binding fragility**: the named input must be referenced by a target's `inputs` array for nx to consider it affecting. If a contributor adds a new target without that reference, file changes in the named input won't mark the project affected through that target. Mitigation: bind `deploymentConfig` to a stable target (`build`) that exists on every relevant project; document the pattern in the project.json comment.
- **PR 2's own gating**: the shim rewrite runs against the PR's own changes. If something's wrong, PR 2's gates fire wrong, and we may merge incorrectly. Mitigation: pre-flight verification — run `nx show projects --affected` locally against a fixture change in `vercel.cockpit.json` BEFORE pushing PR 2; verify `apps/cockpit` appears.
- **`nx affected` cold startup**: 2-5s overhead on every CI run. Already analyzed; acceptable trade-off for the simpler classifier + dependency-graph correctness.

## Acceptance criteria

- `scripts/ci-scope.mjs` is ≤80 LOC (down from 340).
- Every CI-participating project has `scope:*` tags declaring its scope membership. **(Shipped in PR #503.)**
- Every fallback file (vercel.*.json, scripts/*.ts, apps/cockpit/scripts/capability-registry.ts) is reachable via per-project `namedInputs` referenced by a target's `inputs` on the correct project.
- All existing `scripts/ci-scope.spec.mjs` scenarios pass under the new shape (with synthetic-affected-project test fixtures).
- A PR that changes `vercel.json` triggers `website` + `website_e2e` gates (no other gates). (Smoke test on PR 2.)
- A PR that changes `cockpit/chat/messages/python/src/graph.py` triggers `cockpit_e2e` + `cockpit_smoke` + `cockpit_examples` gates. (Smoke test on PR 2.)
- A PR that changes `.github/workflows/ci.yml` triggers all gates (full scope short-circuit). (Smoke test on PR 2.)
- No regression: every gate that fires for a file today fires the same way after migration.

**End state**: ci-scope.mjs is a ~50-LOC shim; project.json files declare their CI participation via `scope:*` tags; fallback paths live as per-project `namedInputs` referenced by target `inputs` — Nx-native, not a centralized 340-LOC classifier.
