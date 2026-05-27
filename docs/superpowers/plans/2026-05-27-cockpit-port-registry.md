# Cockpit Port Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize cockpit cap port allocation behind a `cockpit/ports.mjs` registry that proxy configs + e2e setup files import at runtime, plus a CI verifier that asserts python project.json `--port` literals match the registry.

**Architecture:** Single ESM module exports a frozen `PORTS` map keyed by cap angular project name. 31 × `proxy.conf.mjs` (replacing `.json`) and 24 × `e2e/global-setup-impl.ts` + 24 × `e2e/playwright.config.ts` import from it. The 31 × `python/project.json` `--port` literals stay as-is and are verified by `scripts/cockpit-ports.spec.mjs` in CI. `cockpit/ag-ui/streaming` is excluded by design (non-LangGraph backend).

**Tech Stack:** Node.js ESM (.mjs), `node:test` + `node:assert/strict`, Angular dev-server `proxyConfig` (`.mjs` support), Playwright config, Nx `nx:run-commands` executor.

**Spec correction**: there is no `port` in angular `project.json`. The Angular port for e2e is set via `nx serve --port` override (passed by the e2e harness from `global-setup-impl.ts`) AND duplicated in `e2e/playwright.config.ts` `baseURL`. Spec's verifier test #4 ("angular project.json `serve.options.port`") is replaced with verifying `playwright.config.ts` baseURL.

---

### Task 1: Verifier spec (TDD) + minimal registry

**Files:**
- Create: `scripts/cockpit-ports.spec.mjs`
- Create: `cockpit/ports.mjs` (minimal — empty PORTS object so tests can run)

- [ ] **Step 1: Write the failing tests**

Create `scripts/cockpit-ports.spec.mjs`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORTS } from '../cockpit/ports.mjs';

const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
const cockpitDir = join(repoRoot, 'cockpit');

const AGUI_EXCEPTION = 'cockpit-ag-ui-streaming-angular';

function findCockpitAngularProjects() {
  // Walk cockpit/ for project.json files inside angular/ dirs.
  const out = [];
  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const full = join(dir, name);
      if (name === 'node_modules' || name.startsWith('.')) continue;
      let stat;
      try { stat = readFileSync(join(full, 'project.json'), 'utf8'); }
      catch { walk(full); continue; }
      try {
        const meta = JSON.parse(stat);
        if (typeof meta.name === 'string' && meta.name.endsWith('-angular') && meta.name.startsWith('cockpit-')) {
          out.push({ name: meta.name, dir: full, meta });
        }
      } catch {}
      walk(full);
    }
  }
  walk(cockpitDir);
  return out;
}

const projects = findCockpitAngularProjects();

describe('cockpit/ports.mjs registry', () => {
  test('covers every cockpit-*-angular project on disk except ag-ui', () => {
    const onDisk = projects.map((p) => p.name).filter((n) => n !== AGUI_EXCEPTION);
    const missing = onDisk.filter((n) => !(n in PORTS));
    assert.deepEqual(missing, [], `missing from PORTS: ${missing.join(', ')}`);
  });

  test('has no orphan entries (each PORTS key has a project on disk)', () => {
    const diskNames = new Set(projects.map((p) => p.name));
    const orphans = Object.keys(PORTS).filter((n) => !diskNames.has(n));
    assert.deepEqual(orphans, [], `orphan PORTS entries: ${orphans.join(', ')}`);
  });

  test('ag-ui is NOT in the registry (exception)', () => {
    assert.equal(AGUI_EXCEPTION in PORTS, false);
  });

  test('every entry has angular + langgraph as positive integers', () => {
    for (const [name, p] of Object.entries(PORTS)) {
      assert.equal(typeof p.angular, 'number', `${name}.angular not number`);
      assert.equal(typeof p.langgraph, 'number', `${name}.langgraph not number`);
      assert.ok(p.angular > 0 && p.langgraph > 0, `${name} has non-positive port`);
    }
  });

  test('port ranges: angular ∈ [4000, 5000), langgraph ∈ [5000, 6000), langgraph = angular + 1000', () => {
    for (const [name, p] of Object.entries(PORTS)) {
      assert.ok(p.angular >= 4000 && p.angular < 5000, `${name}.angular out of range: ${p.angular}`);
      assert.ok(p.langgraph >= 5000 && p.langgraph < 6000, `${name}.langgraph out of range: ${p.langgraph}`);
      assert.equal(p.langgraph, p.angular + 1000, `${name}: langgraph (${p.langgraph}) != angular (${p.angular}) + 1000`);
    }
  });

  test('no duplicate ports', () => {
    const seen = new Set();
    for (const [name, p] of Object.entries(PORTS)) {
      for (const port of [p.angular, p.langgraph]) {
        assert.ok(!seen.has(port), `duplicate port ${port} (${name})`);
        seen.add(port);
      }
    }
  });

  test('each cap python/project.json --port matches PORTS[name].langgraph', () => {
    const mismatches = [];
    for (const { name, dir } of projects) {
      if (name === AGUI_EXCEPTION) continue;
      const pyProjectJson = join(dir, '..', 'python', 'project.json');
      if (!existsSync(pyProjectJson)) {
        mismatches.push(`${name}: missing python/project.json at ${pyProjectJson}`);
        continue;
      }
      const meta = JSON.parse(readFileSync(pyProjectJson, 'utf8'));
      const cmd = String(meta?.targets?.serve?.options?.command ?? '');
      const m = cmd.match(/--port[= ](\d+)/);
      if (!m) {
        mismatches.push(`${name}: no --port in python/project.json serve command`);
        continue;
      }
      const literal = Number(m[1]);
      const expected = PORTS[name]?.langgraph;
      if (literal !== expected) {
        mismatches.push(`${name}: python --port ${literal} != registry ${expected}`);
      }
    }
    assert.deepEqual(mismatches, []);
  });

  test('each active-e2e cap playwright.config.ts baseURL port matches PORTS[name].angular', () => {
    const mismatches = [];
    for (const { name, dir } of projects) {
      if (name === AGUI_EXCEPTION) continue;
      const pwConfig = join(dir, 'e2e', 'playwright.config.ts');
      if (!existsSync(pwConfig)) continue; // 7 caps without e2e are fine
      const text = readFileSync(pwConfig, 'utf8');
      const m = text.match(/baseURL:\s*[`'"]http:\/\/localhost:(\d+)[`'"/]/);
      if (!m) continue; // skip if no literal baseURL (might use import already)
      const literal = Number(m[1]);
      const expected = PORTS[name]?.angular;
      if (literal !== expected) {
        mismatches.push(`${name}: playwright baseURL :${literal} != registry :${expected}`);
      }
    }
    assert.deepEqual(mismatches, []);
  });
});
```

- [ ] **Step 2: Create minimal registry (will fail tests intentionally)**

Create `cockpit/ports.mjs`:

```js
// SPDX-License-Identifier: MIT

/**
 * @typedef {{ angular: number; langgraph: number }} CapPorts
 * @typedef {Record<string, CapPorts>} PortsRegistry
 */

/**
 * Single source of truth for cockpit cap port allocation.
 *
 * Excludes cockpit-ag-ui-streaming-angular — uses a non-LangGraph
 * backend (Node ag-ui server on :3000, /agent proxy). Single-cap
 * exception; left as a literal in its own files.
 *
 * Port ranges:
 *   - angular: [4000, 5000)
 *   - langgraph: [5000, 6000)
 *   - Convention: langgraph = angular + 1000
 *
 * The CI verifier (scripts/cockpit-ports.spec.mjs) asserts this
 * registry matches the literal --port values in each cap's
 * python/project.json + baseURL in playwright.config.ts.
 *
 * @type {PortsRegistry}
 */
export const PORTS = Object.freeze({});

/**
 * Look up ports for a cap by its Nx angular project name.
 * Throws if the name isn't in the registry — caller crash for
 * fast diagnosis.
 *
 * @param {string} cap
 * @returns {CapPorts}
 */
export function portsFor(cap) {
  const p = PORTS[cap];
  if (!p) throw new Error(`No port allocation for ${cap}`);
  return p;
}
```

- [ ] **Step 3: Run tests, verify the "covers every cap" test fails**

Run: `node --test scripts/cockpit-ports.spec.mjs`

Expected: at least the first test ("covers every cockpit-*-angular project") fails with a list of missing entries (31 names). Other tests may pass vacuously on the empty registry.

- [ ] **Step 4: Commit**

```bash
git add scripts/cockpit-ports.spec.mjs cockpit/ports.mjs
git commit -m "feat(ci): cockpit ports registry + verifier spec (skeleton)

Registry starts empty; the verifier spec tests both the registry
shape (positive int ports, no duplicates, range/convention checks)
and cross-file invariants (python --port + playwright baseURL match
registry). Empty registry intentionally fails the 'covers every
cap' test until Task 2 populates it.

Spec: docs/superpowers/specs/2026-05-27-cockpit-port-registry-design.md"
```

---

### Task 2: Populate the registry from existing on-disk ports

**Files:**
- Modify: `cockpit/ports.mjs`

- [ ] **Step 1: Extract existing port assignments**

Run this helper from the worktree root to enumerate the existing port pairs:

```bash
node - <<'EOF'
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = 'cockpit';
const out = {};
function walk(d) {
  let entries; try { entries = readdirSync(d); } catch { return; }
  for (const n of entries) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const f = `${d}/${n}`;
    if (n === 'angular') {
      const pj = `${f}/project.json`;
      if (!existsSync(pj)) continue;
      const meta = JSON.parse(readFileSync(pj, 'utf8'));
      if (typeof meta.name !== 'string' || !meta.name.endsWith('-angular')) continue;
      if (meta.name === 'cockpit-ag-ui-streaming-angular') continue;
      // langgraph port from proxy.conf.json target
      const proxyJson = `${f}/proxy.conf.json`;
      let langgraph = null;
      if (existsSync(proxyJson)) {
        const proxy = JSON.parse(readFileSync(proxyJson, 'utf8'));
        for (const v of Object.values(proxy)) {
          const m = String(v.target ?? '').match(/localhost:(\d+)/);
          if (m) { langgraph = Number(m[1]); break; }
        }
      }
      // angular port from playwright.config.ts baseURL (if e2e exists)
      let angular = null;
      const pw = `${f}/e2e/playwright.config.ts`;
      if (existsSync(pw)) {
        const m = readFileSync(pw, 'utf8').match(/baseURL:\s*[`'"]http:\/\/localhost:(\d+)/);
        if (m) angular = Number(m[1]);
      }
      // fall back to langgraph - 1000 for non-e2e caps
      if (angular === null && langgraph !== null) angular = langgraph - 1000;
      out[meta.name] = { angular, langgraph };
      continue;
    }
    walk(f);
  }
}
walk(ROOT);
const sorted = Object.keys(out).sort().reduce((acc, k) => (acc[k] = out[k], acc), {});
for (const [k, v] of Object.entries(sorted)) {
  console.log(`  '${k}': { angular: ${v.angular}, langgraph: ${v.langgraph} },`);
}
EOF
```

Expected: 31 lines printed (every LangGraph cockpit angular project except ag-ui), each with both ports.

Save the output for Step 2.

- [ ] **Step 2: Paste the entries into `cockpit/ports.mjs`**

Replace `export const PORTS = Object.freeze({});` with `export const PORTS = Object.freeze({ ... });` populated from Step 1's output. The 31 entries go inside the braces, alphabetically by key (the helper already sorts).

- [ ] **Step 3: Run tests, verify shape tests pass**

Run: `node --test scripts/cockpit-ports.spec.mjs`

Expected: tests "covers every cap", "no orphan entries", "ag-ui not in registry", "positive integers", "port ranges", "no duplicates" all PASS. The two cross-file verifier tests (python `--port`, playwright `baseURL`) also PASS because we populated FROM those existing values.

If a port-range or convention test fails: one or more existing port assignments don't follow the `angular + 1000 = langgraph` convention. Surface the cap, decide whether to:
- Update the existing literal to match the convention (preferred — fix drift)
- OR widen the test's tolerance (only if intentional)

- [ ] **Step 4: Commit**

```bash
git add cockpit/ports.mjs
git commit -m "feat(ci): populate cockpit ports registry from on-disk values

31 entries, extracted from each cap's proxy.conf.json target +
playwright.config.ts baseURL (or langgraph - 1000 for non-e2e caps).
Verifier confirms the registry round-trips cleanly against every
python/project.json --port literal."
```

---

### Task 3: Sweep proxy.conf.json → proxy.conf.mjs (×31)

**Files:**
- For each of 31 caps:
  - Create: `cockpit/<x>/<y>/angular/proxy.conf.mjs`
  - Delete: `cockpit/<x>/<y>/angular/proxy.conf.json`
  - Modify: `cockpit/<x>/<y>/angular/project.json` (`serve.options.proxyConfig` extension)

- [ ] **Step 1: Write a sweep script (does NOT commit; just runs)**

Create `/tmp/sweep-proxy.mjs` (not committed; throwaway):

```js
import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const ROOT = process.cwd();
const COCKPIT = `${ROOT}/cockpit`;

// List of (capName, angularDir, langgraphPort) tuples
const caps = [];
function walk(d) {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const f = `${d}/${n}`;
    if (n === 'angular') {
      const pj = `${f}/project.json`;
      if (!existsSync(pj)) continue;
      const meta = JSON.parse(readFileSync(pj, 'utf8'));
      if (typeof meta.name !== 'string' || !meta.name.endsWith('-angular')) continue;
      if (meta.name === 'cockpit-ag-ui-streaming-angular') continue;
      caps.push({ name: meta.name, dir: f });
      continue;
    }
    let stat; try { stat = readFileSync(`${f}/project.json`); } catch { walk(f); continue; }
    walk(f);
  }
}
walk(COCKPIT);

for (const cap of caps) {
  const proxyJson = `${cap.dir}/proxy.conf.json`;
  const proxyMjs = `${cap.dir}/proxy.conf.mjs`;
  if (!existsSync(proxyJson)) {
    console.error(`SKIP ${cap.name}: no proxy.conf.json`);
    continue;
  }
  const old = JSON.parse(readFileSync(proxyJson, 'utf8'));
  // Compute relative import path from <cap>/angular/ to cockpit/ports.mjs.
  // <cap>/angular/ is 4 levels deep relative to repo root (cockpit/<topic>/<cap>/angular/).
  // From there, ../../../../cockpit/ports.mjs would resolve.
  // But cockpit/render/<cap>/angular is also 4 deep. Same for chat, deep-agents, langgraph.
  // So we always need ../../../../cockpit/ports.mjs (4 ups).
  const relImport = '../../../../cockpit/ports.mjs';

  // Build new .mjs content. Preserve the route key + secure/changeOrigin opts.
  const routes = Object.entries(old).map(([route, conf]) => {
    const target = `\`http://localhost:\${langgraph}\``;
    const otherOpts = Object.entries(conf)
      .filter(([k]) => k !== 'target')
      .map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`)
      .join('\n');
    return `  ${JSON.stringify(route)}: {
    target: ${target},
${otherOpts}
  }`;
  }).join(',\n');

  const content = `// SPDX-License-Identifier: MIT
import { portsFor } from '${relImport}';

const { langgraph } = portsFor('${cap.name}');

export default {
${routes},
};
`;
  writeFileSync(proxyMjs, content);
  unlinkSync(proxyJson);
  console.log(`OK ${cap.name}`);

  // Also update project.json's proxyConfig extension.
  const angularProjectJson = `${cap.dir}/project.json`;
  const meta = JSON.parse(readFileSync(angularProjectJson, 'utf8'));
  const opts = meta.targets?.serve?.options;
  if (opts?.proxyConfig?.endsWith('proxy.conf.json')) {
    opts.proxyConfig = opts.proxyConfig.replace(/\.json$/, '.mjs');
    writeFileSync(angularProjectJson, JSON.stringify(meta, null, 2) + '\n');
  }
}
console.log(`Total: ${caps.length} caps swept`);
```

Run: `node /tmp/sweep-proxy.mjs`

Expected: "OK <name>" for 31 caps, "Total: 31 caps swept".

- [ ] **Step 2: Spot-check the result**

Run:
```bash
cat cockpit/chat/messages/angular/proxy.conf.mjs
ls cockpit/chat/messages/angular/proxy.conf.json && echo "STILL EXISTS — BUG" || echo "deleted OK"
grep proxyConfig cockpit/chat/messages/angular/project.json
```

Expected:
- `proxy.conf.mjs` exists, imports from `'../../../../cockpit/ports.mjs'`, exports a default object with `/api → http://localhost:${langgraph}`
- `proxy.conf.json` is deleted
- `project.json` has `"proxyConfig": "cockpit/chat/messages/angular/proxy.conf.mjs"`

If the spot-check fails on any cap, run the sweep again after fixing the script — it's idempotent enough (creates `.mjs`, deletes `.json`).

- [ ] **Step 3: Verify the registry tests still pass**

Run: `node --test scripts/cockpit-ports.spec.mjs`

Expected: all tests still pass. The verifier doesn't yet check proxy.conf.mjs content (that's behavioral, not literal-port drift), so the sweep is a no-op from its perspective.

- [ ] **Step 4: Smoke-test one cap dev server**

Run: `npx nx serve cockpit-chat-messages-angular --port 9999 &` then `curl -s http://localhost:9999/ -o /dev/null -w '%{http_code}'`

Expected: `200`. Angular dev-server loads `proxy.conf.mjs` without error. Kill the server: `pkill -f 'cockpit-chat-messages-angular'`.

If Angular complains about `.mjs` proxy config: check Angular version. The repo uses Angular 22+, which natively supports `.mjs` proxy configs. If older, fall back to `.cjs`.

- [ ] **Step 5: Commit**

```bash
git add cockpit/
git commit -m "refactor(cockpit): 31 proxy.conf.json → proxy.conf.mjs (import ports registry)

Every cockpit cap's proxy.conf.json is replaced with proxy.conf.mjs
that imports portsFor(capName) from cockpit/ports.mjs and templates
the langgraph port into the target URL. Each angular/project.json's
serve.options.proxyConfig is updated to point at the .mjs file.

cockpit/ag-ui/streaming is excluded — non-LangGraph backend, kept
as proxy.conf.json with its /agent → :3000 literal."
```

---

### Task 4: Sweep `e2e/global-setup-impl.ts` + `e2e/playwright.config.ts` (×24)

**Files:**
- For each of the 24 active e2e caps:
  - Modify: `cockpit/<x>/<y>/angular/e2e/global-setup-impl.ts`
  - Modify: `cockpit/<x>/<y>/angular/e2e/playwright.config.ts`

- [ ] **Step 1: Write a sweep script**

Create `/tmp/sweep-e2e.mjs`:

```js
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = process.cwd();
const COCKPIT = `${ROOT}/cockpit`;

const caps = [];
function walk(d) {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const f = `${d}/${n}`;
    if (n === 'angular') {
      const pj = `${f}/project.json`;
      if (!existsSync(pj)) continue;
      const meta = JSON.parse(readFileSync(pj, 'utf8'));
      if (typeof meta.name !== 'string' || !meta.name.endsWith('-angular')) continue;
      if (meta.name === 'cockpit-ag-ui-streaming-angular') continue;
      const setup = `${f}/e2e/global-setup-impl.ts`;
      const pwCfg = `${f}/e2e/playwright.config.ts`;
      if (existsSync(setup) && existsSync(pwCfg)) caps.push({ name: meta.name, dir: f });
      continue;
    }
    let stat; try { stat = readFileSync(`${f}/project.json`); } catch { walk(f); continue; }
    walk(f);
  }
}
walk(COCKPIT);

// Relative import from <cap>/angular/e2e/ to cockpit/ports.mjs:
// e2e is 5 deep (cockpit/<topic>/<cap>/angular/e2e/), so 5 ups.
const REL_IMPORT = '../../../../../cockpit/ports.mjs';

for (const cap of caps) {
  // global-setup-impl.ts: insert import + portsFor() lookup; replace literal port lines.
  const setupPath = `${cap.dir}/e2e/global-setup-impl.ts`;
  let setup = readFileSync(setupPath, 'utf8');
  if (!setup.includes('cockpit/ports.mjs')) {
    const importLine = `import { portsFor } from '${REL_IMPORT}';`;
    // Insert the import after the first existing import line.
    setup = setup.replace(
      /(^import [^\n]+;\n)/,
      `$1${importLine}\n`,
    );
    // Insert `const ports = portsFor(...)` immediately before the default export.
    setup = setup.replace(
      /(export default createGlobalSetup\(\{)/,
      `const ports = portsFor('${cap.name}');\n\n$1`,
    );
    // Replace the two literal port lines with registry references.
    setup = setup.replace(/langgraphPort:\s*\d+,/, 'langgraphPort: ports.langgraph,');
    setup = setup.replace(/angularPort:\s*\d+,/, 'angularPort: ports.angular,');
    writeFileSync(setupPath, setup);
  }

  // playwright.config.ts: replace baseURL literal port.
  const pwCfgPath = `${cap.dir}/e2e/playwright.config.ts`;
  let pwCfg = readFileSync(pwCfgPath, 'utf8');
  if (!pwCfg.includes('cockpit/ports.mjs')) {
    const importLine = `import { portsFor } from '${REL_IMPORT}';`;
    pwCfg = pwCfg.replace(
      /(^import [^\n]+;\n)/,
      `$1${importLine}\n`,
    );
    // Insert const decl near the top of the config (after imports).
    pwCfg = pwCfg.replace(
      /(\nexport default )/,
      `\nconst { angular: angularPort } = portsFor('${cap.name}');\n\n$1`,
    );
    // Replace literal baseURL port.
    pwCfg = pwCfg.replace(
      /baseURL:\s*[`'"]http:\/\/localhost:\d+[`'"/]/,
      'baseURL: `http://localhost:${angularPort}`',
    );
    writeFileSync(pwCfgPath, pwCfg);
  }

  console.log(`OK ${cap.name}`);
}
console.log(`Total: ${caps.length} caps swept`);
```

Run: `node /tmp/sweep-e2e.mjs`

Expected: "OK <name>" for 24 caps.

- [ ] **Step 2: Spot-check the result**

```bash
head -20 cockpit/chat/messages/angular/e2e/global-setup-impl.ts
head -20 cockpit/chat/messages/angular/e2e/playwright.config.ts
```

Expected:
- `global-setup-impl.ts` starts with the original imports plus `import { portsFor } from '...';`, has a `const ports = portsFor('cockpit-chat-messages-angular');` line, and the two `*Port:` keys reference `ports.angular` / `ports.langgraph`.
- `playwright.config.ts` has the new import + `const { angular: angularPort } = portsFor('...');`, and `baseURL: \`http://localhost:${angularPort}\``.

If any cap looks broken, manually fix it; the sweep is best-effort textual.

- [ ] **Step 3: TypeScript compile sanity-check**

Run one cap's e2e tsconfig:
```bash
cd cockpit/chat/messages/angular/e2e && npx tsc --noEmit && cd $OLDPWD
```

Expected: clean. If `portsFor` returns `unknown` or there's a path resolution error, the tsconfig's `paths`/`baseUrl` may need an additional entry. Check what alias `@ngaf-internal/e2e-harness` resolves to (from PR #515) and follow the same pattern.

- [ ] **Step 4: Run the verifier**

Run: `node --test scripts/cockpit-ports.spec.mjs`

Expected: all tests still pass. The "playwright baseURL" verifier regex matches the templated form too because the regex only kicks in when the baseURL is a literal localhost URL; templates use `${angularPort}` and are skipped (no false positives).

Wait — the verifier regex IS `match(/baseURL:\s*[`'"]http:\/\/localhost:(\d+)[`'"/]/)`. With the new templated form `baseURL: \`http://localhost:${angularPort}\``, the regex won't match (no digit between `:` and the closing backtick). The test then skips the cap. **The test no longer verifies post-sweep playwright config**, but that's fine: the value is now imported from the registry directly, so drift is impossible.

- [ ] **Step 5: Commit**

```bash
git add cockpit/
git commit -m "refactor(cockpit): 24 e2e configs import ports from registry

Each cap's e2e/global-setup-impl.ts now imports portsFor() and reads
angular/langgraph ports from the registry instead of literal numbers.
playwright.config.ts is updated similarly for baseURL.

The verifier's playwright-baseURL check now skips templated configs
(its regex only matches literal URLs); drift is impossible because
the value imports directly from the registry."
```

---

### Task 5: Wire spec into ci.yml

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Find the existing test line**

Run: `grep -n "ci-scope.spec.mjs" .github/workflows/ci.yml`

Expected: one match, currently reading:
```yaml
      - name: Test CI scope classifier
        run: node --test scripts/ci-scope.spec.mjs scripts/cockpit-matrix.spec.mjs
```

- [ ] **Step 2: Append the new spec**

Edit that line to:
```yaml
      - name: Test CI scope classifier
        run: node --test scripts/ci-scope.spec.mjs scripts/cockpit-matrix.spec.mjs scripts/cockpit-ports.spec.mjs
```

- [ ] **Step 3: YAML lint**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`

Expected: no output, exit 0.

- [ ] **Step 4: Run the combined test suite locally**

Run: `node --test scripts/ci-scope.spec.mjs scripts/cockpit-matrix.spec.mjs scripts/cockpit-ports.spec.mjs`

Expected: all tests across all three files pass (15 ci-scope + 7 cockpit-matrix + 7 cockpit-ports = 29 tests).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: gate cockpit-ports.spec.mjs in ci-scope test job

Appends the new verifier spec to the existing node --test invocation
so registry drift is caught at PR time."
```

---

### Task 6: Push, open PR, monitor first CI run

**Files:** none modified.

- [ ] **Step 1: Push branch**

```bash
git push -u origin claude/cockpit-ports
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(cockpit): centralize port allocation behind cockpit/ports.mjs registry" --body "$(cat <<'EOF'
## Summary

Centralizes cockpit cap port allocation. 31 LangGraph caps now import ports from \`cockpit/ports.mjs\`; the 4-place per-cap edit reduces to 1 line in the registry (+ literal verification on PR).

### Touched
- **NEW** \`cockpit/ports.mjs\` — registry (31 entries, ag-ui excluded by design)
- **NEW** \`scripts/cockpit-ports.spec.mjs\` — verifier (7 tests, wired into ci-scope job)
- **REFACTOR** 31 × \`cockpit/<x>/<y>/angular/proxy.conf.json\` → \`proxy.conf.mjs\` (imports registry)
- **MODIFY** 31 × \`cockpit/<x>/<y>/angular/project.json\` — \`proxyConfig\` extension \`.json → .mjs\`
- **MODIFY** 24 × \`cockpit/<x>/<y>/angular/e2e/global-setup-impl.ts\` — import registry
- **MODIFY** 24 × \`cockpit/<x>/<y>/angular/e2e/playwright.config.ts\` — \`baseURL\` from registry
- **UNCHANGED** 31 × \`cockpit/<x>/<y>/python/project.json\` — literal \`--port\`, verified

### Excluded
\`cockpit/ag-ui/streaming\` — non-LangGraph backend (Node ag-ui on :3000 with /agent path). Kept as literals; one-line allowlist in the verifier.

## Test plan

- [x] 7/7 cockpit-ports spec tests pass locally
- [x] Combined \`node --test\` of all 3 specs (29 tests) green
- [x] One cap dev server smoke (proxy.conf.mjs loads)
- [ ] CI: all 24 cockpit-e2e shards green
- [ ] CI: ci-scope job runs the new spec

Spec: \`docs/superpowers/specs/2026-05-27-cockpit-port-registry-design.md\`
Plan: \`docs/superpowers/plans/2026-05-27-cockpit-port-registry.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Monitor**

```bash
gh pr checks $(gh pr view --json number --jq .number)
```

Expected: 24 cockpit-e2e shards + summary green. If any cap fails to boot, suspect:
- proxy.conf.mjs path resolution: the cap's `project.json` `proxyConfig` field still points at `.json` (sweep missed it)
- portsFor() throws because registry name doesn't match: typo in PORTS key or in the cap's project.json `name`
- ESM resolution: Node version too old (workflow uses Node 22, fine)

- [ ] **Step 4: Hand off to user**

Plan ends here. User decides when to admin-merge.

---

## Verification checklist (entire plan)

After all tasks:

- ✅ `cockpit/ports.mjs` exports `PORTS` (31 entries, frozen) + `portsFor(name)`
- ✅ `cockpit/ag-ui/streaming-angular` NOT in `PORTS`; its files unchanged
- ✅ Every cap's `proxy.conf.mjs` imports + templates langgraph port
- ✅ Every cap's `angular/project.json` `proxyConfig` ends in `.mjs`
- ✅ 24 × `global-setup-impl.ts` import registry; no literal port digits remain
- ✅ 24 × `playwright.config.ts` baseURL uses `${angularPort}` template
- ✅ All `python/project.json` `--port` literals match registry
- ✅ `scripts/cockpit-ports.spec.mjs` gates PRs via ci-scope job
- ✅ All 24 cockpit-e2e shards green on the PR

If any item is unchecked, return to the task that owns it before requesting review.
