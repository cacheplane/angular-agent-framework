# Cockpit port registry — design

**Status:** Approved
**Date:** 2026-05-27
**Goal:** Single source of truth for cockpit cap port allocation. A new cap currently requires updating 4 separate files (`angular/proxy.conf.json`, `angular/e2e/global-setup-impl.ts`, `python/project.json`, `angular/project.json`). This centralizes the angular + e2e references behind an importable registry and adds a CI verifier that asserts the literal `project.json` values match.

## Why now

The audit found port allocation lives in 4 disconnected sites per cap with no drift detection. The convention `angular_port + 1000 = langgraph_port` actually holds across the 31 LangGraph caps, but nothing enforces it — and a new cap requires hunting for the right places to edit.

## Approach

Three of the 4 sites can reference a shared TS/ESM module at runtime:
- `proxy.conf.mjs` (replaces `proxy.conf.json`) — Angular dev-server natively loads .mjs proxy configs
- `e2e/global-setup-impl.ts` — already TS, can import directly

The remaining 2 sites are static JSON:
- `python/project.json` — `nx:run-commands` executor needs a literal command string
- `angular/project.json` — Angular serve target needs literal `serve.options.port`

For these, keep the literals and add a CI verifier that asserts they match the registry. New caps follow the same convention; the verifier catches mistakes at PR time.

## Architecture

```
cockpit/ports.mjs (NEW — single source of truth, 31 caps)
   │
   ├── imported by 31 × cockpit/<x>/<y>/angular/proxy.conf.mjs (NEW; replaces .json)
   ├── imported by 24 × cockpit/<x>/<y>/angular/e2e/global-setup-impl.ts (MODIFIED)
   │
   └── verified-against:
       — 31 × cockpit/<x>/<y>/python/project.json `--port <N>` literal
       — 31 × cockpit/<x>/<y>/angular/project.json `serve.options.port` literal
       via scripts/cockpit-ports.spec.mjs (NEW)
```

**Exclusion:** `cockpit/ag-ui/streaming` is NOT in the registry. It uses a non-LangGraph backend (Node ag-ui server on port 3000) with a `/agent` proxy path rather than `/api`. Single-cap exception; not worth generalizing.

## Components

### 1. `cockpit/ports.mjs` (NEW)

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
 * python/project.json + angular/project.json.
 *
 * @type {PortsRegistry}
 */
export const PORTS = Object.freeze({
  // 31 entries here, alphabetical by cap name
});

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

### 2. `cockpit/<x>/<y>/angular/proxy.conf.mjs` (NEW, replaces `.json`, ×31)

Each cap's proxy config becomes:

```js
// SPDX-License-Identifier: MIT
import { portsFor } from '../../../../cockpit/ports.mjs';

const { langgraph } = portsFor('cockpit-chat-messages-angular');

export default {
  '/api': {
    target: `http://localhost:${langgraph}`,
    secure: false,
    changeOrigin: true,
  },
};
```

The cap's `angular/project.json` `serve.proxyConfig` field is updated from `proxy.conf.json` → `proxy.conf.mjs`. Both file extensions are valid for Angular's dev-server.

### 3. `cockpit/<x>/<y>/angular/e2e/global-setup-impl.ts` (MODIFIED, ×24 active e2e caps only)

Each global-setup-impl.ts replaces literal port values with imports:

```ts
import { resolve } from 'node:path';
import { createGlobalSetup } from '@ngaf-internal/e2e-harness';
import { portsFor } from '../../../../../cockpit/ports.mjs';

const ports = portsFor('cockpit-chat-messages-angular');

export default createGlobalSetup({
  langgraphCwd: 'cockpit/chat/messages/python',
  langgraphPort: ports.langgraph,
  angularProject: 'cockpit-chat-messages-angular',
  angularPort: ports.angular,
  fixturesDir: resolve(__dirname, 'fixtures'),
});
```

The 7 caps without e2e (6 render + c-debug) are NOT touched here — they have no `e2e/global-setup-impl.ts`.

### 4. `cockpit/<x>/<y>/python/project.json` + `cockpit/<x>/<y>/angular/project.json` (UNCHANGED literals, ×31 each)

Keep `--port 5501` and `"port": 4501` as literals. Static JSON can't import from .mjs without restructuring the Nx executor schema (out of scope per the brainstorm constraints).

### 5. `scripts/cockpit-ports.spec.mjs` (NEW)

`node:test` + `node:assert/strict` suite. 6 tests:

1. **Registry covers all on-disk LangGraph caps** — walk all `cockpit/<x>/<y>/angular/project.json` files; for each project name except `cockpit-ag-ui-streaming-angular`, assert it appears as a key in `PORTS`.
2. **No orphan registry entries** — every key in `PORTS` has a matching `cockpit/<x>/<y>/angular/project.json` on disk.
3. **python `--port <N>` matches `PORTS[name].langgraph`** — for each registry entry, find the cap's python sibling, parse its `serve.options.command` field with regex `--port[ =](\d+)`, assert match.
4. **angular `serve.options.port` matches `PORTS[name].angular`** — parse each cap's `angular/project.json`, assert `targets.serve.options.port === PORTS[name].angular`.
5. **No duplicate ports** — each `angular` and `langgraph` value appears once across all entries.
6. **Port ranges sane** — angular ∈ [4000, 5000), langgraph ∈ [5000, 6000), langgraph === angular + 1000.

### 6. `.github/workflows/ci.yml` (MODIFIED, 1-line change)

The existing `ci-scope` job already runs:

```yaml
- name: Test CI scope classifier
  run: node --test scripts/ci-scope.spec.mjs scripts/cockpit-matrix.spec.mjs
```

Append the new spec:

```yaml
- name: Test CI scope classifier
  run: node --test scripts/ci-scope.spec.mjs scripts/cockpit-matrix.spec.mjs scripts/cockpit-ports.spec.mjs
```

## Data flow per scenario

| Trigger | What happens |
|---|---|
| `nx serve <cap>-angular` | Angular dev-server loads `proxy.conf.mjs` → imports `portsFor(cap)` → returns config with target port. Angular binds on the literal port from its own `project.json`. |
| `nx serve <cap>-python` | `nx:run-commands` invokes the literal `uv run langgraph dev --port <N>`. No registry read at runtime. Verifier ensures N matches the registry. |
| `nx e2e <cap>-angular` | Playwright loads `e2e/global-setup-impl.ts` → imports `portsFor(cap)` → passes to `createGlobalSetup`. e2e-harness spawns Angular + LangGraph on those ports. |
| New cap added | 1 line in `cockpit/ports.mjs`, scaffold the 4 files (proxy.conf.mjs + global-setup-impl.ts import by name; project.jsons get literals matching the registry). Verifier asserts on PR. |
| Existing port reassigned | Edit the registry. Edit 2 literal project.json values. Run `node --test scripts/cockpit-ports.spec.mjs` locally; CI also asserts. |

## Error handling

- `portsFor('<unknown>')` throws — fast crash for diagnosis.
- Verifier fails CI with specific mismatched cap + expected vs actual port.
- Registry is `Object.freeze`'d to prevent accidental mutation by importers.

## Out of scope

- Generator script for new caps (verifier catches mistakes today; can add scaffolder later).
- Port range rebalancing — existing assignments preserved verbatim.
- Runtime port-conflict resolution (e.g. dev machine has 5501 in use).
- ag-ui migration — excluded by design; one-line allowlist in the verifier.
- Angular `serve.options.port` being read from the registry — kept literal, verified.

## Risks

- **Angular dev-server `.mjs` support**: well-documented and stable since Angular 17+. Repo uses Angular 22. No risk.
- **Static analyzers / IDEs**: some tooling may not understand `.mjs` imports across the Nx workspace. Mitigated: project.json target paths use the new `.mjs` extension explicitly.
- **Drift between the 5th `e2e/global-setup-impl.ts` arg `langgraphCwd` and the python project location**: existing convention `cockpit/<x>/<y>/python`. Not part of this design — out of scope; covered by `cockpit-e2e-wiring.spec.ts` drift-guard.

## Test plan (post-merge validation)

1. `nx serve cockpit-chat-messages-angular` — Angular boots, proxy works against running langgraph.
2. `nx e2e cockpit-chat-messages-angular` — full e2e runs against same ports as before.
3. CI green on the migration PR with all 24 cockpit-e2e shards.
4. Intentionally edit `cockpit/chat/messages/python/project.json` to mismatch the registry — verifier should fail with a clear diagnostic. Revert.

## References

- Audit: `2026-05-25` repo health audit (in-session research, not committed).
- Existing pattern: `scripts/ci-scope.mjs` (pure classifier + spec test wired into CI).
- Angular proxy.conf documentation: supports `.json`, `.js`, `.mjs`, `.cjs`.
