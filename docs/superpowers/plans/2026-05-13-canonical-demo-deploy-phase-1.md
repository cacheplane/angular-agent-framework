# Canonical Demo Deploy — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the canonical demo's LangGraph (`examples/chat/python`, graph name `chat`) to the existing shared `cockpit-dev` LangGraph Cloud deployment, so it's reachable on the LangGraph side before the frontend ships in Phase 2.

**Architecture:** Extend the generator `scripts/generate-shared-deployment-config.ts` to include a small hardcoded list of "non-cockpit" Python dependencies alongside the existing capability-registry-driven cockpit graphs. Add `examples/chat/python/**` to the deploy-langgraph workflow's watched paths so changes there retrigger redeployment. Register `chat` in `deployment-urls.json` (so the shared-URL coherence check still passes) and in `scripts/verify-shared-deployment.ts`'s smoke list (so post-deploy verification confirms the graph is reachable).

**Tech Stack:** TypeScript (Nx), vitest, GitHub Actions workflow YAML, LangGraph CLI.

**Reference spec:** `docs/superpowers/specs/2026-05-13-canonical-demo-deploy-design.md` — see "Phase 1 — backend graph addition".

---

## Background for the implementer

The deploy pipeline today:

1. `apps/cockpit/scripts/capability-registry.ts` exports an array of capability descriptors. Each has `pythonDir` and `graphName` fields.
2. `scripts/generate-shared-deployment-config.ts` reads that array, filters to `product === 'langgraph' || product === 'deep-agents'`, reads each capability's `langgraph.json` manifest, and aggregates all graphs into `deployments/shared-dev/langgraph.json`.
3. `.github/workflows/deploy-langgraph.yml` runs on pushes to main that touch any cockpit Python graph (or the generator, or the registry) and deploys `deployments/shared-dev/` to the shared `cockpit-dev` LangGraph Cloud assistant.
4. After CI deploy, `scripts/verify-shared-deployment.ts` runs in production smoke and asserts each entry in `SMOKE_ASSISTANT_IDS` is reachable.
5. `deployment-urls.json` is consulted by `verify-shared-deployment.ts` — every capability that targets the shared deployment is listed there, all pointing to the same URL.

The canonical demo (`examples/chat/python`, graph `chat`) is **not** in any of these. After this phase it will be.

We deliberately don't add `examples/chat` to `capability-registry.ts`. That registry's entries describe Angular SPAs with ports and project names — adding a phantom `chat-canonical` row would force fake values into multiple fields. Cleaner: put a single dedicated array of "extra Python deployments" in the generator itself.

---

### Task 1: Extend generator to include `examples/chat/python`

**Files:**
- Modify: `scripts/generate-shared-deployment-config.ts`
- Create: `scripts/generate-shared-deployment-config.spec.ts`

**Context:** The generator is a top-level script today — no exported functions. We'll refactor lightly to extract the build into a callable function, then test it by running the generator end-to-end and reading the output. Refactoring is mild because the script is 86 lines and self-contained.

---

- [ ] **Step 1: Create the failing test**

Create `scripts/generate-shared-deployment-config.spec.ts`:

```ts
// scripts/generate-shared-deployment-config.spec.ts
// SPDX-License-Identifier: MIT
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('generate-shared-deployment-config', () => {
  it('includes the canonical-demo chat graph in the aggregated manifest', () => {
    const root = resolve(__dirname, '..');
    execSync('npx tsx scripts/generate-shared-deployment-config.ts', {
      cwd: root,
      stdio: 'pipe',
    });
    const manifestPath = resolve(root, 'deployments/shared-dev/langgraph.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      graphs: Record<string, string>;
      dependencies: string[];
    };
    expect(manifest.graphs).toHaveProperty('chat');
    expect(manifest.graphs.chat).toMatch(/examples-chat\/.+\.py:graph$/);
    expect(manifest.dependencies.some((d) => d.includes('examples-chat'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```
npx vitest run scripts/generate-shared-deployment-config.spec.ts
```

Expected: FAIL with `expected { ... } to have property "chat"`.

- [ ] **Step 3: Modify the generator to stage `examples/chat/python` as an extra dependency**

In `scripts/generate-shared-deployment-config.ts`, locate the loop that ends on line 68 (`}` closing the `for (const capability of capabilities)` block). Immediately after that closing `}`, before the line `const streamingManifestPath = resolve(rootDir, 'cockpit/langgraph/streaming/python/langgraph.json');`, insert:

```ts
// Extra Python deployments NOT in the cockpit capability registry.
// These have no Angular project / port — only a backend graph aggregated
// into the shared cockpit-dev assistant.
const extraPythonDeployments: ReadonlyArray<{ pythonDir: string; alias: string }> = [
  { pythonDir: 'examples/chat/python', alias: 'examples-chat' },
];

for (const extra of extraPythonDeployments) {
  const manifestPath = resolve(rootDir, extra.pythonDir, 'langgraph.json');
  const extraManifest = readManifest(manifestPath);
  if (!extraManifest.graphs) {
    throw new Error(`Missing graphs in ${manifestPath}`);
  }
  const stagedDependencyRoot = stageDependency(extra.pythonDir, extra.alias);
  for (const [graphName, entrypoint] of Object.entries(extraManifest.graphs)) {
    addGraph(graphName, toDeploymentPath(stagedDependencyRoot, entrypoint));
  }
}
```

- [ ] **Step 4: Run test to verify pass**

```
npx vitest run scripts/generate-shared-deployment-config.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Inspect the generated manifest manually**

```
cat deployments/shared-dev/langgraph.json | head -30
```

Expected: `"chat": "./deps/examples-chat/src/graph.py:graph"` should appear in the `graphs` object. `"./deps/examples-chat"` should appear in `dependencies`.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-shared-deployment-config.ts \
        scripts/generate-shared-deployment-config.spec.ts \
        deployments/shared-dev/langgraph.json
git commit -m "feat(deploy): include examples/chat/python in shared cockpit-dev deployment

Adds the canonical demo's Python graph to the aggregated manifest
generator. After CI redeploys, the shared cockpit-dev LangGraph
Cloud assistant will expose 'chat' alongside the existing cockpit
capability graphs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Wire the new graph into the deploy + verify pipeline

**Files:**
- Modify: `.github/workflows/deploy-langgraph.yml` (watched paths)
- Modify: `deployment-urls.json` (add `chat` entry)
- Modify: `scripts/verify-shared-deployment.ts` (`SMOKE_ASSISTANT_IDS` array)

**Context:** Three small config edits. No tests — config-only edits don't benefit from unit coverage; the integration check is the production smoke that runs after deploy.

---

- [ ] **Step 1: Extend the deploy-langgraph workflow's watched paths**

In `.github/workflows/deploy-langgraph.yml`, locate the `paths:` block at the top (lines 5–10):

```yaml
    paths:
      - 'cockpit/langgraph/**/python/**'
      - 'cockpit/deep-agents/**/python/**'
      - 'apps/cockpit/scripts/capability-registry.ts'
      - 'scripts/generate-shared-deployment-config.ts'
      - 'deployments/shared-dev/langgraph.json'
```

Add a new entry for the canonical demo's Python dir. The final block should read:

```yaml
    paths:
      - 'cockpit/langgraph/**/python/**'
      - 'cockpit/deep-agents/**/python/**'
      - 'examples/chat/python/**'
      - 'apps/cockpit/scripts/capability-registry.ts'
      - 'scripts/generate-shared-deployment-config.ts'
      - 'deployments/shared-dev/langgraph.json'
```

- [ ] **Step 2: Register `chat` in `deployment-urls.json`**

`verify-shared-deployment.ts`'s `getSharedUrl()` function requires every entry in `deployment-urls.json` to resolve to the same URL. Append `chat` with the existing shared URL.

In `deployment-urls.json`, after the existing `"sandboxes"` line, add a `"chat"` entry. The shared URL value to use is the same one every other capability uses today (read the current file before editing — copy that value verbatim):

```json
  "chat": "https://cockpit-dev-219a15942c545a00a03a9a41905d7fc2.us.langgraph.app"
```

Result: every capability + `chat` all point to the same `cockpit-dev` URL.

- [ ] **Step 3: Add `chat` to the production-smoke assistant list**

In `scripts/verify-shared-deployment.ts`, locate `SMOKE_ASSISTANT_IDS` (around line 21):

```ts
const SMOKE_ASSISTANT_IDS = [
  'streaming',
  'deployment-runtime',
  'planning',
  'filesystem',
  'c-generative-ui',
  'c-a2ui',
] as const;
```

Append `'chat'`:

```ts
const SMOKE_ASSISTANT_IDS = [
  'streaming',
  'deployment-runtime',
  'planning',
  'filesystem',
  'c-generative-ui',
  'c-a2ui',
  'chat',
] as const;
```

- [ ] **Step 4: Re-run the generator test to confirm nothing broke**

```
npx vitest run scripts/generate-shared-deployment-config.spec.ts
```

Expected: PASS — the test from Task 1 still passes.

- [ ] **Step 5: Run the verify script in dry-run mode locally**

```
npx tsx scripts/verify-shared-deployment.ts --dry-run
```

Expected: succeeds, prints a summary listing `chat` as one of the smoke assistants. (The script's full mode requires `LANGSMITH_API_KEY` and live network; `--dry-run` validates config only.)

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/deploy-langgraph.yml \
        deployment-urls.json \
        scripts/verify-shared-deployment.ts
git commit -m "feat(deploy): wire 'chat' assistant into deploy + verify pipeline

- Watch examples/chat/python/** so changes there retrigger deploy
- Register chat in deployment-urls.json (single shared URL)
- Include chat in production-smoke SMOKE_ASSISTANT_IDS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Open PR and wait for the first deploy run

**Context:** After merging to main, the deploy-langgraph workflow runs, redeploys `cockpit-dev` with the chat graph included, and the production-smoke job (in ci.yml) calls `verify-shared-deployment.ts`. If the chat assistant is reachable, smoke passes and Phase 1 is done. No frontend exists yet — the chat graph is dormant until Phase 2.

---

- [ ] **Step 1: Push branch + open PR**

```bash
git push -u origin claude/canonical-demo-deploy
gh pr create --title "feat(deploy): add canonical demo chat graph to shared cockpit-dev deployment (Phase 1)" --body "$(cat <<'EOF'
## Summary

Phase 1 of the canonical-demo deployment plan. Adds the canonical demo's Python graph (`examples/chat/python`, graph name `chat`) to the aggregated `cockpit-dev` LangGraph Cloud deployment.

No frontend yet — Phase 2 stands up `demo.cacheplane.ai`. This phase makes the backend graph reachable so Phase 2 has something to consume.

## Changes

- `scripts/generate-shared-deployment-config.ts` — stages `examples/chat/python` as an extra Python dependency, aggregating its graphs alongside the cockpit registry.
- `.github/workflows/deploy-langgraph.yml` — watches `examples/chat/python/**` so changes there retrigger redeploy.
- `deployment-urls.json` — `chat` entry pointing at the shared URL.
- `scripts/verify-shared-deployment.ts` — `chat` added to `SMOKE_ASSISTANT_IDS` for post-deploy smoke.
- `scripts/generate-shared-deployment-config.spec.ts` — vitest spec asserting the generator includes the chat graph.

## Spec & Plan

- `docs/superpowers/specs/2026-05-13-canonical-demo-deploy-design.md`
- `docs/superpowers/plans/2026-05-13-canonical-demo-deploy-phase-1.md`

## Test plan

- [x] vitest generator spec passes (asserts `chat` in manifest + `examples-chat` in dependencies)
- [x] `npx tsx scripts/verify-shared-deployment.ts --dry-run` succeeds
- [ ] After merge: deploy-langgraph workflow runs successfully
- [ ] After deploy: production-smoke job passes (verify-shared-deployment.ts confirms `chat` assistant is reachable)
EOF
)"
```

- [ ] **Step 2: Wait for CI to be green on the PR**

Required green checks before merge:
- `Library — lint / test / build` (the new vitest spec runs in this job)
- `Website — lint / build`
- `Cockpit — build / test`, `e2e`, `representative capability smoke`, `build all examples`, `deploy smoke dry-run`, `secret-gated integration`
- `examples/chat — python smoke`

The deploy-langgraph workflow does NOT run on PRs — only on pushes to main with the watched paths touched. So the first real-world test of this phase is the post-merge deploy.

- [ ] **Step 3: After merge, verify deploy + smoke**

Within ~10 minutes of merge:
1. Confirm `Deploy LangGraph` workflow ran (Actions tab; should be triggered by the changes to `examples/chat/python/**` watched path entry → no, that path doesn't change on first ship, but the changes to `generate-shared-deployment-config.ts` + `deployments/shared-dev/langgraph.json` DO match — confirm the workflow triggered).
2. Confirm it succeeded (`Deploy cockpit-dev` step).
3. Confirm the subsequent CI `production-smoke` job passed (`verify-shared-deployment.ts` reports `chat` reachable).

If `production-smoke` fails because the chat assistant isn't reachable, the deploy succeeded but the graph didn't register properly. Check the LangGraph Cloud dashboard for the cockpit-dev assistant and look for the `chat` entry. If absent, the manifest needs investigation; if present but unreachable via the SDK, the assistant ID may need to be configured separately.

---

## Self-review notes

- **Spec coverage:** every Phase 1 requirement from the spec maps to a task. (a) generator extension → Task 1. (b) workflow paths → Task 2 Step 1. (c) deployment-urls → Task 2 Step 2. (d) verify smoke → Task 2 Step 3. (e) deploy run → Task 3.
- **No placeholders:** every code block is final content the implementer pastes verbatim.
- **Type consistency:** all references to `chat`, `examples-chat`, `examples/chat/python` are spelled identically across tasks.
- **Test coverage proportional to value:** the generator gets a vitest spec because it's pure code; the YAML / JSON / TS config edits don't (low-value tests would just duplicate `grep`).
