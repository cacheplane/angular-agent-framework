# Cockpit Examples Local-Dev + Validator Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `serve-example.ts` produce a working *local* cockpit (iframe points at localhost, correct backend per product), collapse the hand-written `serve-*` targets onto it, and add validators that prevent the wiring drift the audit found.

**Architecture:** Single registry-driven local-serve path. Extract a pure `backendCommand(cap)` (uvicorn for ag-ui, `langgraph dev` otherwise) so it's unit-testable; inject `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL=''` into the spawned cockpit so `resolveRuntimeUrl` falls through to `http://localhost:<devPort>`. Add parity assertions (registry↔ports, per-product smoke coverage) and delete dead validator branches.

**Tech Stack:** TypeScript (tsx scripts), Nx, Vitest (`nx test cockpit`), node:test (`cockpit-ports.spec.mjs`), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-06-05-cockpit-examples-local-dev-cleanup-design.md`

**Sequencing:** This lands **after PR #580** (Railway). Task 0 rebases onto post-#580 `main`. None of these tasks touch ag-ui production (#580 owns `deployments/ag-ui-dev/`, `assemble-examples.ts` ag-ui routing, `ag-ui-proxy.ts`, `deploy-ag-ui.yml`) — the files here (`serve-example.ts`, `apps/cockpit/project.json`, `cockpit-e2e-wiring.spec.ts`, `ci.yml` smoke job) are not substantially changed by #580, so the concrete code below holds.

---

## File map

| File | Change |
|------|--------|
| `apps/cockpit/scripts/serve-example.ts` | Export pure `backendCommand(cap)`; inject cockpit runtime env; drop the `8123` literal. |
| `apps/cockpit/scripts/serve-example.spec.ts` | **NEW** — unit tests for `backendCommand` + the cockpit env constant. |
| `apps/cockpit/project.json` | Replace the 14 hand-written `serve-*` targets with thin aliases to `serve-example.ts`. |
| `apps/cockpit/cockpit-e2e-wiring.spec.ts` | Add registry↔ports parity (Task 4) + per-product smoke coverage (Task 5) assertions; remove dead fallback branches (Task 6). |
| `.github/workflows/ci.yml` | Add a representative chat + render python project to the `cockpit-smoke` list (Task 5). |

---

## Task 0: Rebase onto post-#580 main and reconcile

**Files:** none (prep only)

- [ ] **Step 1: Confirm #580 has merged**

Run: `gh pr view 580 --json state -q .state`
Expected: `MERGED`. If `OPEN`, stop — this plan must not start until #580 lands.

- [ ] **Step 2: Rebase the cleanup branch onto current main**

```bash
git fetch origin main
git checkout claude/cockpit-examples-cleanup
git rebase origin/main
```
Resolve any conflicts (expected only if #580 touched `apps/cockpit/scripts/capability-registry.ts`; the registry is read-only here).

- [ ] **Step 3: Reconfirm the registry discriminator is unchanged**

Run: `grep -n "product:" apps/cockpit/scripts/capability-registry.ts | grep "ag-ui" | head`
Expected: ag-ui caps still carry `product: 'ag-ui'` and omit `graphName`. The discriminator used below is `cap.product === 'ag-ui'`. If #580 renamed/added fields, adjust `backendCommand` accordingly before continuing.

- [ ] **Step 4: Confirm no overlap with #580 on this plan's files**

Run: `git log origin/main --oneline -- apps/cockpit/scripts/serve-example.ts apps/cockpit/project.json | head`
Expected: #580 did not rewrite these. If it did, reconcile the diff into the tasks below.

---

## Task 1: Extract a testable `backendCommand(cap)` (TDD)

**Files:**
- Modify: `apps/cockpit/scripts/serve-example.ts`
- Create: `apps/cockpit/scripts/serve-example.spec.ts`

The backend command must come from the registry (port + product), not the stale `8123` literal: ag-ui → uvicorn, everything else with a `pythonDir` → `langgraph dev`, no `pythonDir` → none.

- [ ] **Step 1: Write the failing test**

`apps/cockpit/scripts/serve-example.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { backendCommand, COCKPIT_RUNTIME_ENV } from './serve-example';
import { findCapability, type Capability } from './capability-registry';

describe('backendCommand', () => {
  it('uses uvicorn on the registry pythonPort for ag-ui caps', () => {
    const cap = findCapability('ag-ui-streaming')!;
    const cmd = backendCommand(cap)!;
    expect(cmd).toContain('cd cockpit/ag-ui/streaming/python');
    expect(cmd).toContain('uv run uvicorn src.server:app --port 5321');
    expect(cmd).not.toContain('langgraph dev');
    expect(cmd).not.toContain('8123');
  });

  it('uses langgraph dev on the registry pythonPort for langgraph caps', () => {
    const cap = findCapability('streaming')!;
    const cmd = backendCommand(cap)!;
    expect(cmd).toContain('cd cockpit/langgraph/streaming/python');
    expect(cmd).toContain('uv run langgraph dev --port 5300 --no-browser');
    expect(cmd).not.toContain('uvicorn');
    expect(cmd).not.toContain('8123');
  });

  it('uses langgraph dev for chat and render caps too', () => {
    expect(backendCommand(findCapability('c-messages')!)).toContain('langgraph dev --port 5501');
    expect(backendCommand(findCapability('r-spec-rendering')!)).toContain('langgraph dev --port 5401');
  });

  it('returns null when the capability has no pythonDir', () => {
    const noPy: Capability = {
      id: 'x', product: 'render', topic: 'x', angularProject: 'cockpit-render-x-angular', port: 4499,
    };
    expect(backendCommand(noPy)).toBeNull();
  });

  it('exposes an empty runtime base URL so the cockpit iframe targets localhost', () => {
    expect(COCKPIT_RUNTIME_ENV).toEqual({ NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL: '' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- scripts/serve-example.spec.ts`
Expected: FAIL — `backendCommand` / `COCKPIT_RUNTIME_ENV` not exported. (If vitest does not pick up `scripts/`, add `'scripts/**/*.spec.ts'` to the cockpit vitest `include` in `apps/cockpit/vitest.config.ts` / `vite.config.*`, then re-run.)

- [ ] **Step 3: Implement the exports**

In `apps/cockpit/scripts/serve-example.ts`, add near the top (after the imports, before `const args`):

```ts
import type { Capability } from './capability-registry';

/** Empty base URL makes resolveRuntimeUrl fall through to http://localhost:<devPort>. */
export const COCKPIT_RUNTIME_ENV = { NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL: '' } as const;

/** Local backend launch command for a capability, derived from the registry. */
export function backendCommand(cap: Capability): string | null {
  if (!cap.pythonDir) return null;
  const enter = `cd ${cap.pythonDir} && source $HOME/.local/bin/env 2>/dev/null; uv sync`;
  if (cap.product === 'ag-ui') {
    return `${enter} && uv run uvicorn src.server:app --port ${cap.pythonPort}`;
  }
  return `${enter} && uv run langgraph dev --port ${cap.pythonPort} --no-browser`;
}
```

Also change the existing `import { capabilities, findCapability } from './capability-registry';` to also import the type if not already: `import { capabilities, findCapability, type Capability } from './capability-registry';` (and remove the duplicate `import type` line above if it conflicts — keep a single import).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- scripts/serve-example.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/scripts/serve-example.ts apps/cockpit/scripts/serve-example.spec.ts
git commit -m "feat(cockpit): registry-derived backendCommand + local runtime env for serve-example"
```

---

## Task 2: Wire `backendCommand` + cockpit env into `serve-example.ts`

**Files:**
- Modify: `apps/cockpit/scripts/serve-example.ts`

Use the new helpers in the orchestration: cockpit child gets `COCKPIT_RUNTIME_ENV`; backend launch uses `backendCommand`; the `8123` literal is gone.

- [ ] **Step 1: Let `run()` accept an env override**

Replace the `run` function with:

```ts
function run(label: string, cmd: string, color: string, extraEnv: Record<string, string> = {}): void {
  const proc = spawn('bash', ['-c', cmd], { stdio: ['inherit', 'pipe', 'pipe'], env: { ...process.env, ...extraEnv } });
  proc.stdout?.on('data', (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.log(`\x1b[${color}m[${label}]\x1b[0m ${l}`)));
  proc.stderr?.on('data', (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.error(`\x1b[${color}m[${label}]\x1b[0m ${l}`)));
  procs.push(proc);
}
```

- [ ] **Step 2: Pass the runtime env to the cockpit child**

Change the cockpit launch line from:

```ts
run('cockpit', 'npx nx serve cockpit --port 4201', '36');
```

to:

```ts
run('cockpit', 'npx nx serve cockpit --port 4201', '36', COCKPIT_RUNTIME_ENV);
```

- [ ] **Step 3: Replace the hardcoded backend launch with `backendCommand`**

Replace the single-capability `else` block (the `if (cap.pythonDir) { run(... langgraph dev --port 8123 ...) } else { ... }`) with:

```ts
  const cap = findCapability(capabilityArg!);
  if (!cap) { console.error(`Unknown: ${capabilityArg}`); process.exit(1); }
  run(cap.id, `npx nx run ${cap.angularProject}:serve:cockpit --port ${cap.port}`, '33');
  const backend = backendCommand(cap);
  if (backend) {
    run(`${cap.id}-py`, backend, '35');
    console.log(`\n🚀 ${cap.id}: cockpit=4201 angular=${cap.port} backend=${cap.pythonPort}\n`);
  } else {
    console.log(`\n🚀 ${cap.id}: cockpit=4201 angular=${cap.port} (no backend)\n`);
  }
```

(The `--all` branch is unchanged — it starts angular apps only; the cockpit child still gets `COCKPIT_RUNTIME_ENV` from Step 2 so the frontends resolve locally.)

- [ ] **Step 4: Verify no `8123` literal remains**

Run: `grep -n "8123" apps/cockpit/scripts/serve-example.ts`
Expected: no output.

- [ ] **Step 5: Run the existing cockpit suite (no regressions)**

Run: `npx nx test cockpit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/cockpit/scripts/serve-example.ts
git commit -m "refactor(cockpit): serve-example uses registry backend cmd + local runtime env, drops 8123"
```

---

## Task 3: Replace hand-written `serve-*` targets with aliases

**Files:**
- Modify: `apps/cockpit/project.json`

The 14 `serve-*` targets (langgraph + deep-agents) become thin aliases to `serve-example.ts --capability=<id>`, so `nx run cockpit:serve-streaming` keeps working off one source of truth and no longer carries the `8123`/env bugs.

- [ ] **Step 1: Map each serve-* target to its capability id**

The 14 targets and their registry ids (from `capability-registry.ts`): `serve-streaming`→`streaming`, `serve-persistence`→`persistence`, `serve-interrupts`→`interrupts`, `serve-memory`→`memory`, `serve-durable-execution`→`durable-execution`, `serve-subgraphs`→`subgraphs`, `serve-time-travel`→`time-travel`, `serve-deployment-runtime`→`deployment-runtime`, `serve-planning`→`da-planning`, `serve-filesystem`→`da-filesystem`, `serve-da-subagents`→`da-subagents`, `serve-da-memory`→`da-memory`, `serve-skills`→`da-skills`, `serve-sandboxes`→`da-sandboxes`.

- [ ] **Step 2: Replace each target body with an alias**

For each of the 14 targets in `apps/cockpit/project.json`, replace its `options` with the alias form. Example for `serve-streaming`:

```json
"serve-streaming": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx tsx apps/cockpit/scripts/serve-example.ts --capability=streaming",
    "cwd": "."
  }
},
```

Apply the same shape to all 14, substituting the capability id from Step 1. Leave `serve`, `serve-all`, and the `serve-<example>` non-existent ones untouched. (`serve-all` already delegates to `serve-example.ts --all`.)

- [ ] **Step 3: Verify the project.json parses and targets resolve**

Run: `npx nx show project cockpit --json | npx --yes json -e 'Object.keys(this.targets).filter(t=>t.startsWith("serve-")).join(" ")'`
(or `python3 -c "import json;print([k for k in json.load(open('apps/cockpit/project.json'))['targets'] if k.startswith('serve-')])"`)
Expected: all 14 `serve-*` keys present.

- [ ] **Step 4: Dry-run one alias resolves the command (don't leave it running)**

Run: `timeout 3 npx nx run cockpit:serve-streaming --help 2>&1 | head -5 || true`
Expected: it invokes `tsx apps/cockpit/scripts/serve-example.ts --capability=streaming` (you'll see the serve-example banner or process start). Kill it.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/project.json
git commit -m "refactor(cockpit): serve-* targets delegate to serve-example (single source of truth)"
```

---

## Task 4: registry ↔ ports.mjs parity assertion (3a)

**Files:**
- Modify: `apps/cockpit/cockpit-e2e-wiring.spec.ts`

Today `capability-registry.ts` (`port`/`pythonPort`) and `cockpit/ports.mjs` (`angular`/`langgraph`) are independent. Assert they agree for every cap. This goes in the vitest spec (it can import both TS registry and `portsFor`); `cockpit-ports.spec.mjs` is `node:test` and can't easily import the TS registry.

- [ ] **Step 1: Write the failing test**

Append a new `it` inside the existing `describe('cockpit e2e wiring', …)` in `apps/cockpit/cockpit-e2e-wiring.spec.ts`:

```ts
  it('keeps capability-registry ports aligned with cockpit/ports.mjs', async () => {
    const { capabilities } = await import('./scripts/capability-registry');
    const mismatches: string[] = [];
    for (const cap of capabilities) {
      const ports = portsFor(cap.angularProject) as { angular: number; langgraph: number };
      if (cap.port !== ports.angular) {
        mismatches.push(`${cap.id}: registry.port ${cap.port} !== ports.angular ${ports.angular}`);
      }
      if (cap.pythonPort !== undefined && cap.pythonPort !== ports.langgraph) {
        mismatches.push(`${cap.id}: registry.pythonPort ${cap.pythonPort} !== ports.langgraph ${ports.langgraph}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
```

(`capability-registry` is imported under `apps/cockpit/scripts/`; from `apps/cockpit/cockpit-e2e-wiring.spec.ts` the relative path is `./scripts/capability-registry`.)

- [ ] **Step 2: Run to verify it passes (registries currently agree)**

Run: `npx nx test cockpit -- cockpit-e2e-wiring.spec.ts`
Expected: PASS — this is a guard; it should be green now. To prove it bites, temporarily edit one `pythonPort` in the registry, re-run (expect FAIL), then revert.

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/cockpit-e2e-wiring.spec.ts
git commit -m "test(cockpit): assert capability-registry ports match ports.mjs"
```

---

## Task 5: per-product smoke coverage (3b)

**Files:**
- Modify: `apps/cockpit/cockpit-e2e-wiring.spec.ts`
- Modify: `.github/workflows/ci.yml`

The `cockpit-smoke` job (ci.yml:192) lists ag-ui + deep-agents + langgraph python projects but **no chat, no render** — entire products are unrepresented. Add a representative chat + render project, and assert every product with a smoke-capable cap appears in the list.

- [ ] **Step 1: Write the failing test**

Append to `apps/cockpit/cockpit-e2e-wiring.spec.ts`:

```ts
  it('smoke job represents every cockpit product', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { capabilities } = await import('./scripts/capability-registry');
    const ci = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    const smokeLine = ci.split('\n').find((l) => l.includes('-t smoke --projects=')) ?? '';
    const products = [...new Set(capabilities.map((c) => c.product))];
    const uncovered = products.filter(
      (product) => !capabilities.some((c) => c.product === product && smokeLine.includes(`${c.angularProject.replace('-angular', '-python')}`)),
    );
    expect(uncovered).toEqual([]);
  });
```

(`repoRoot` is already defined in this spec — reuse it; if not, derive it the same way the existing tests do.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test cockpit -- cockpit-e2e-wiring.spec.ts`
Expected: FAIL — `uncovered` contains `['render', 'chat']` (no chat/render python in the smoke list).

- [ ] **Step 3: Add a representative chat + render project to the smoke list**

In `.github/workflows/ci.yml`, line 192, append two projects to the `--projects=` comma list (before `--skip-nx-cache`):
`,cockpit-chat-messages-python,cockpit-render-spec-rendering-python`

- [ ] **Step 4: Run to verify it passes**

Run: `npx nx test cockpit -- cockpit-e2e-wiring.spec.ts`
Expected: PASS — every product now has ≥1 python project in the smoke list.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/cockpit-e2e-wiring.spec.ts .github/workflows/ci.yml
git commit -m "test+ci(cockpit): smoke job must represent every product; add chat+render reps"
```

---

## Task 6: Remove dead validator fallback branches (3c)

**Files:**
- Modify: `apps/cockpit/cockpit-e2e-wiring.spec.ts`

All caps (including ag-ui) are now in `ports.mjs`, so the `try/catch` "Cap not in registry" fallback (lines ~103–110) that parses `langgraphPort`/`angularPort` literals from global-setup is dead. Remove it; call `portsFor` directly.

- [ ] **Step 1: Replace the try/catch port lookup**

Find the block (≈ lines 100–111):

```ts
      let angularPort: number;
      let langgraphPort: number;
      try {
        const ports = portsFor(project.name) as { angular: number; langgraph: number };
        angularPort = ports.angular;
        langgraphPort = ports.langgraph;
      } catch {
        // Cap not in registry (e.g. cockpit-ag-ui-streaming-angular).
        langgraphPort = parseNumberProperty(globalSetup, 'langgraphPort')!;
        angularPort = parseNumberProperty(globalSetup, 'angularPort')!;
      }
```

Replace with:

```ts
      const ports = portsFor(project.name) as { angular: number; langgraph: number };
      const angularPort = ports.angular;
      const langgraphPort = ports.langgraph;
```

(Adjust to the exact variable names/shape in the current file — keep behavior identical for the in-registry path, which is now the only path.)

- [ ] **Step 2: Remove `parseNumberProperty` if now unused**

Run: `grep -n "parseNumberProperty" apps/cockpit/cockpit-e2e-wiring.spec.ts`
If the only remaining references are its definition, delete the function. If `langgraphCwd`/`pythonCwd` parsing still uses `parseStringProperty`, leave that helper.

- [ ] **Step 3: Run the spec**

Run: `npx nx test cockpit -- cockpit-e2e-wiring.spec.ts`
Expected: PASS (all wiring tests, including the two new ones).

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/cockpit-e2e-wiring.spec.ts
git commit -m "refactor(cockpit): drop dead 'cap not in registry' fallback in wiring spec"
```

---

## Task 7: Manual local-serve acceptance

**Files:** none (verification)

Reproduce the exact scenario the audit found broken — one langgraph cap and one ag-ui cap, confirming the iframe now points at localhost and streams.

- [ ] **Step 1: Run the full cockpit suite**

Run: `npx nx test cockpit`
Expected: PASS (incl. serve-example, the two new wiring assertions).

- [ ] **Step 2: Serve a langgraph cap and verify the iframe is local**

Run (ensure `OPENAI_API_KEY` is in the repo-root `.env`; generate the license key first if needed via `node libs/licensing/scripts/generate-public-key.mjs`):
```bash
set -a; . ./.env; set +a
npx nx run cockpit:serve-streaming
```
Open `http://localhost:4201/langgraph/core-capabilities/streaming/overview/python` → Run tab. In devtools, the iframe `src` must start with `http://localhost:4300` (NOT `https://examples.threadplane.ai`). Send a prompt → tokens stream. Stop the process.

- [ ] **Step 3: Serve an ag-ui cap and verify uvicorn + local iframe**

```bash
npx nx run cockpit:serve-all   # or: npx tsx apps/cockpit/scripts/serve-example.ts --capability=ag-ui-streaming
```
Confirm the `[ag-ui-streaming-py]` log shows `uvicorn src.server:app --port 5321` (not `langgraph dev`, not `8123`). Open the ag-ui streaming Run tab → iframe `src` is `http://localhost:4321` → a prompt streams. Stop.

- [ ] **Step 4: Final commit (only if verification fixups were needed)**

```bash
git add -A && git commit -m "chore(cockpit): local-serve cleanup verification fixups"
```

---

## Self-review notes

- **Spec coverage:** Area 1 (runtime resolution) → Tasks 1–2 (env var + registry backend cmd, no 8123); Area 1c (render backend) → handled by `backendCommand` launching `langgraph dev` for render (render has a `pythonDir`+graph in the registry; launching it is harmless and simpler than a special-case skip — documented deviation from spec §1c). Area 2 (ergonomics) → Task 3 (aliases). Area 3a/3b/3c → Tasks 4/5/6. Acceptance → Task 7.
- **#580 dependency:** isolated to Task 0; the concrete code touches files #580 doesn't rewrite.
- **Discriminator:** `cap.product === 'ag-ui'` (verified in registry); ag-ui omits `graphName`, so `cap.product` is the stable signal.
- **Test runners:** parity + coverage assertions live in the vitest `cockpit-e2e-wiring.spec.ts` (can import the TS registry); `cockpit-ports.spec.mjs` (node:test) is left as-is.
- **No placeholders:** every code step shows the actual code; ports (5300/5321/5501/5401) are the registry values.
