---
workstream: analytics-foundation-1b-ngaf-telemetry
status: approved
owner: brian
phase: 0
spec: docs/superpowers/specs/gtm/2026-05-15-analytics-foundation-1b-ngaf-telemetry-design.md
plan: docs/superpowers/plans/gtm/2026-05-15-analytics-foundation-1b-ngaf-telemetry.md
parent: docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md
---

# Analytics Foundation 1B — `@ngaf/telemetry` (Design)

> Spec 1B of the Cacheplane GTM motion. Implements the `@ngaf/telemetry` library: Node opt-out + browser opt-in surfaces, postinstall ping, Angular DI provider, all gated by the trust contract already published at `libs/telemetry/README.md`.

## 1. Goal

Ship a single `@ngaf/telemetry` library that surfaces three entry points (`@ngaf/telemetry`, `@ngaf/telemetry/node`, `@ngaf/telemetry/browser`) so that `@ngaf/*` consumers and our own server adapters can emit `ngaf:*` events to PostHog without violating the public trust contract — Node opt-out, browser opt-in, no end-user telemetry by default, no vendor key shipped, silent-fail.

## 2. Context

- Parent: `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md` §7.5 defines the architecture and mounting rules.
- The trust contract is already public at `libs/telemetry/README.md`. This spec implements that contract; it does not re-author it. If implementation forces a contract change, update the README in the same PR with a `BREAKING` callout.
- Spec 1A (`tools/posthog/`) shipped the dashboards-as-code pipeline. The `package-telemetry` dashboard from `gtm.md §5` is a follow-up that will consume the `ngaf:*` events this library fires.
- Spec 1D will ship the `/api/ingest` reverse proxy on the website. Until that lands, Node telemetry's default ingest URL (`https://cacheplane.dev/api/ingest`) 404s; silent-fail absorbs it. When Spec 1D ships, telemetry flows without any consumer action.

## 3. Scope

**In scope:**

- New Nx Angular library project at `libs/telemetry/` named `telemetry`.
- Three subpath exports in published `package.json`:
  - `@ngaf/telemetry` (shared utilities)
  - `@ngaf/telemetry/node` (Node opt-out runtime)
  - `@ngaf/telemetry/browser` (Angular `provideNgafTelemetry()`)
- Hybrid build: `@nx/js:tsc` for shared + node, `@nx/angular:package` for browser.
- Env detection helpers: `DO_NOT_TRACK`, `NGAF_TELEMETRY_DISABLED`, CI auto-detect, `NGAF_TELEMETRY_SAMPLE_RATE`, `NGAF_TELEMETRY_INGEST_URL`.
- SHA-256 one-way hashing helper for sensitive identifiers.
- Anonymous-id strategy: per-process UUID prefix (`anon_<uuid>`), regenerated each boot, no persistence.
- Node surfaces: `posthog-node` wrapper, `postinstall` script (fires once per `npm install` of `@ngaf/telemetry`), adapter helpers (`captureRuntimeInstanceCreated`, `captureStreamStarted`, `captureStreamEnded`, `captureStreamErrored`).
- Browser surfaces: `provideNgafTelemetry({ enabled, posthogKey, posthogHost, sampleRate })` returning `EnvironmentProviders`. Lazy `posthog-js` import gated on `enabled: true` — when off, zero network calls and zero `posthog-js` import side effects.
- Unit tests + the **permanent browser silence test** that confirms no network call is made when `provideNgafTelemetry({ enabled: true })` is never called.
- Add `telemetry` to the `publishable` group in `nx.json`. The fixed-group version (currently ~0.0.30) becomes telemetry's starting version on next publish; do not set 0.0.1.
- `.env.example` documents `NGAF_TELEMETRY_INGEST_URL` (for self-hosters) and `NGAF_TELEMETRY_SAMPLE_RATE`.
- `libs/telemetry/README.md` minor updates if implementation surfaces force them.

**Out of scope:**

- Dashboards consuming `ngaf:*` events (deferred `dashboards-content` spec).
- Website `/api/ingest` reverse proxy (Spec 1D).
- Cockpit instrumentation (Spec 1C).
- Postinstall hooks added to *other* `@ngaf/*` packages — runtime adapter calls are the primary signal. We accept this scope reduction to avoid coordinated re-publishes.
- Session replay, group analytics, feature flag SDK integration.
- Browser `provideNgafTelemetry` with `enabled: true` actually firing useful events — wiring real events from `@ngaf/chat`, `@ngaf/agent` etc. requires updating those packages and lives in their own follow-ups.

## 4. Architecture

### 4.1 Three-entry layout

```
libs/telemetry/
├── README.md                         # already exists; the trust contract
├── package.json                      # CREATE — name @ngaf/telemetry, peer deps, exports map
├── project.json                      # CREATE — Nx project with build:node + build:browser + test + lint
├── tsconfig.json                     # CREATE — base
├── tsconfig.lib.json                 # CREATE — node/shared entry build (tsc)
├── tsconfig.lib.browser.json         # CREATE — Angular ng-packagr config
├── ng-package.json                   # CREATE — Angular package config for browser entry
├── eslint.config.mjs                 # CREATE
├── jest.config.ts                    # CREATE — or vitest, matching repo pattern
├── ngaf-telemetry.api-md             # (none — no API extractor needed at this scale)
├── src/
│   ├── index.ts                      # public re-exports of shared API
│   ├── shared/
│   │   ├── env.ts                    # DO_NOT_TRACK / NGAF_TELEMETRY_DISABLED / CI detect
│   │   ├── env.spec.ts
│   │   ├── hash.ts                   # SHA-256 one-way (Web Crypto + node:crypto)
│   │   ├── hash.spec.ts
│   │   ├── anon-id.ts                # Per-process UUID generator
│   │   ├── sample.ts                 # Sample-rate gate
│   │   ├── sample.spec.ts
│   │   └── events.ts                 # Typed event names (ngaf:* only)
│   ├── node/
│   │   ├── index.ts                  # @ngaf/telemetry/node entrypoint
│   │   ├── client.ts                 # posthog-node wrapper, flushAt:1, flushInterval:0
│   │   ├── client.spec.ts
│   │   ├── postinstall.ts            # one-shot ping; suppressed in CI
│   │   ├── postinstall.spec.ts
│   │   ├── adapter.ts                # captureRuntimeInstanceCreated, captureStream{Started,Ended,Errored}
│   │   ├── adapter.spec.ts
│   │   └── disable.ts                # disableTelemetry() programmatic kill switch
│   └── browser/
│       ├── public-api.ts             # @ngaf/telemetry/browser entrypoint
│       ├── provide.ts                # provideNgafTelemetry() — EnvironmentProviders
│       ├── provide.spec.ts
│       ├── service.ts                # NgafTelemetryService (lazy posthog-js loader)
│       ├── service.spec.ts
│       ├── tokens.ts                 # NGAF_TELEMETRY_CONFIG InjectionToken
│       └── browser-silence.spec.ts   # permanent contract test
```

### 4.2 Layered separation (mirrors Spec 1A)

```
┌────────────────────────────────────────────────────────────────────┐
│ PUBLIC API  src/index.ts  src/node/index.ts  src/browser/public-api.ts │
└────────────────────────┬───────────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────────┐
│ SHARED (no node/browser deps)                                      │
│ env.ts · hash.ts · anon-id.ts · sample.ts · events.ts              │
└────────────────────────┬───────────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────────┐
│ TRANSPORT (per entry)                                              │
│ node/client.ts (posthog-node) │ browser/service.ts (posthog-js)    │
└────────────────────────────────────────────────────────────────────┘
```

`shared/` has zero runtime dependencies (uses `crypto.subtle` in browser, `node:crypto` in Node via a thin adapter). `node/` depends only on `posthog-node` + `shared/`. `browser/` depends on `@angular/core` (peer) + `shared/`, and lazy-loads `posthog-js` only when `enabled: true`.

### 4.3 Subpath exports

```jsonc
// libs/telemetry/package.json (excerpt)
{
  "name": "@ngaf/telemetry",
  "version": "0.0.0",                       // bumped to fixed-group version on publish
  "sideEffects": false,
  "type": "module",
  "exports": {
    ".": {
      "types": "./index.d.ts",
      "default": "./fesm2022/ngaf-telemetry.mjs"
    },
    "./node": {
      "types": "./node/index.d.ts",
      "default": "./node/index.mjs"
    },
    "./browser": {
      "types": "./browser/index.d.ts",
      "default": "./fesm2022/ngaf-telemetry-browser.mjs"
    },
    "./postinstall": {
      "types": "./node/postinstall.d.ts",
      "default": "./node/postinstall.mjs"
    }
  },
  "peerDependencies": {
    "@angular/core": "^20.0.0 || ^21.0.0"
  },
  "peerDependenciesMeta": {
    "@angular/core": { "optional": true }    // Node-only consumers don't need Angular
  },
  "dependencies": {
    "posthog-js": "^1.372.0",
    "posthog-node": "^5.20.0"
  },
  "scripts": {
    "postinstall": "node ./node/postinstall.mjs || true"
  }
}
```

`peerDependenciesMeta.optional: true` lets Node-only consumers install `@ngaf/telemetry/node` without an Angular peer warning. Browser users still get a peer-dep check.

## 5. Trust contract — how implementation enforces it

The README is the public contract. The implementation enforces it via these mechanisms:

### 5.1 Browser silence (the most important guarantee)

`@ngaf/telemetry/browser` MUST NOT import `posthog-js` at module load. Tree-shaking and dynamic import together guarantee this:

```typescript
// browser/service.ts
@Injectable({ providedIn: 'root' })
export class NgafTelemetryService {
  private postHog: Promise<typeof import('posthog-js') | null> | null = null;

  constructor(@Optional() @Inject(NGAF_TELEMETRY_CONFIG) private config: NgafTelemetryConfig | null) {}

  async capture(event: NgafBrowserEvent, properties?: Record<string, unknown>): Promise<void> {
    if (!this.config?.enabled || !this.config.posthogKey) return;
    if (!this.postHog) {
      // Lazy-load posthog-js only when enabled AND key present.
      this.postHog = import('posthog-js').then((mod) => {
        mod.default.init(this.config!.posthogKey!, {
          api_host: this.config!.posthogHost ?? 'https://us.i.posthog.com',
        });
        return mod.default;
      });
    }
    const ph = await this.postHog;
    ph?.capture(event, properties);
  }
}
```

The permanent **`browser-silence.spec.ts`** asserts no network call occurs when `provideNgafTelemetry()` is not called OR called with `enabled: false`. This test stays green permanently.

### 5.2 Node opt-out

`node/client.ts` constructor short-circuits on:

1. `DO_NOT_TRACK === '1' || === 'true'`
2. `NGAF_TELEMETRY_DISABLED === '1' || === 'true'`
3. `CI`, `GITHUB_ACTIONS`, or other CI sentinels (`CONTINUOUS_INTEGRATION`, `BUILDKITE`, `CIRCLECI`)
4. `disableTelemetry()` called programmatically (sets a module-level flag)
5. `NGAF_TELEMETRY_INGEST_URL` unset AND no key — silent no-op (the proxy default kicks in before this gate, but if both are unset we no-op)

All five paths produce a `NoOpClient` that satisfies the same interface. Callers can't tell the difference.

### 5.3 Hashing

`shared/hash.ts` exports `sha256(input: string): Promise<string>` using Web Crypto in browser and `node:crypto` in Node via a tiny `globalThis.crypto.subtle` check. All sensitive identifiers (LangGraph keys, model API keys, internal endpoint URLs) MUST be hashed before becoming event properties.

### 5.4 Sample-rate

`shared/sample.ts` returns a deterministic `shouldSample(rate, anonId)` so a given anonymous id either always samples or never samples within a process. Stamps `sample_weight: 1/rate` on every event for query-time de-sampling.

### 5.5 Anonymous id

`shared/anon-id.ts` generates `anon_<uuid>` once per process and caches it in module state. No filesystem persistence. Browser uses the same helper, generating per-page-load.

## 6. Public API surfaces

### 6.1 `@ngaf/telemetry` (shared)

```typescript
export { isTelemetryDisabled, getDisableReason } from './shared/env.js';
export { sha256 } from './shared/hash.js';
export { getAnonId } from './shared/anon-id.js';
export { shouldSample } from './shared/sample.js';
export type { NgafEvent, NgafNodeEvent, NgafBrowserEvent } from './shared/events.js';
```

### 6.2 `@ngaf/telemetry/node`

```typescript
export { disableTelemetry } from './disable.js';
export { capturePostinstall } from './postinstall.js';      // for invocation from postinstall script
export {
  captureRuntimeInstanceCreated,
  captureStreamStarted,
  captureStreamEnded,
  captureStreamErrored,
} from './adapter.js';
export type { RuntimeInstanceTelemetry, StreamTelemetry } from './adapter.js';
```

Adapter helpers are zero-arg-friendly (`captureStreamStarted({ provider, model })`) and silently no-op when telemetry is disabled. Always `flushAt: 1, flushInterval: 0` so short-lived Node functions flush before exit; callers can `await shutdown()` if they want strict order, but the default is fire-and-forget with a 3s timeout.

### 6.3 `@ngaf/telemetry/browser`

```typescript
export { provideNgafTelemetry } from './provide.js';
export { NgafTelemetryService } from './service.js';        // injectable for advanced use
export type { NgafTelemetryConfig } from './tokens.js';
export { NGAF_TELEMETRY_CONFIG } from './tokens.js';
```

`provideNgafTelemetry`:

```typescript
export interface NgafTelemetryConfig {
  enabled: boolean;                            // default behavior is OFF; must opt in
  posthogKey?: string;                         // consumer's PostHog project key
  posthogHost?: string;                        // default 'https://us.i.posthog.com'
  sampleRate?: number;                         // default 1.0
}

export function provideNgafTelemetry(config: NgafTelemetryConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: NGAF_TELEMETRY_CONFIG, useValue: config },
    NgafTelemetryService,
  ]);
}
```

When `enabled: false` (or `posthogKey` omitted), the service is still provided but no-ops on every method. The browser silence test pins this.

## 7. Postinstall behavior

`libs/telemetry/src/node/postinstall.ts` is invoked from the published `package.json` `scripts.postinstall`:

```typescript
import { capturePostinstall } from './client.js';
import { isTelemetryDisabled } from '../shared/env.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

async function main() {
  if (isTelemetryDisabled()) return;
  try {
    // Walk up from the installed package to find package.json (we ARE in node_modules/@ngaf/telemetry/node/postinstall.mjs).
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    await capturePostinstall({ pkg: pkg.name, version: pkg.version });
    if (!process.env.CI) {
      process.stdout.write(
        `@ngaf/telemetry: sent install ping (${pkg.name}@${pkg.version}). Disable: DO_NOT_TRACK=1 or NGAF_TELEMETRY_DISABLED=1. See https://github.com/cacheplane/angular-agent-framework/blob/main/libs/telemetry/README.md\n`,
      );
    }
  } catch {
    // Silent fail — never break npm install.
  }
}

main();
```

The published `package.json` uses `node ./node/postinstall.mjs || true` so a failed postinstall never blocks `npm install`.

## 8. Build + publish pipeline

### 8.1 Two-target build

```jsonc
// libs/telemetry/project.json (targets excerpt)
{
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "dependsOn": ["build:node", "build:browser"],
      "options": { "command": "true" }
    },
    "build:node": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/libs/telemetry/node"],
      "options": {
        "outputPath": "dist/libs/telemetry",
        "main": "libs/telemetry/src/index.ts",
        "additionalEntryPoints": [
          "libs/telemetry/src/node/index.ts",
          "libs/telemetry/src/node/postinstall.ts"
        ],
        "tsConfig": "libs/telemetry/tsconfig.lib.json"
      }
    },
    "build:browser": {
      "executor": "@nx/angular:package",
      "outputs": ["{workspaceRoot}/dist/libs/telemetry/browser"],
      "options": {
        "project": "libs/telemetry/ng-package.json",
        "tsConfig": "libs/telemetry/tsconfig.lib.browser.json"
      }
    },
    "test": { "executor": "@nx/jest:jest", "options": { "jestConfig": "libs/telemetry/jest.config.ts" } },
    "lint": { "executor": "@nx/eslint:lint" }
  }
}
```

A small post-build step in `build:node` copies the published `package.json` (with the exports map) into `dist/libs/telemetry/`. Browser build's ng-packagr output then merges into the same `dist` so subpath exports resolve correctly.

### 8.2 Publish

`telemetry` is added to the `publishable` group in `nx.json`:

```jsonc
"release": {
  "groups": {
    "publishable": {
      "projects": [
        "chat", "langgraph", "ag-ui", "render", "a2ui", "partial-json", "licensing", "telemetry"
      ],
      "projectsRelationship": "fixed"
    }
  },
  "version": {
    "preVersionCommand": "npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,partial-json,licensing,telemetry"
  }
}
```

Telemetry's first published version matches the fixed-group's next bump (e.g. if chat is at 0.0.30, the next release publishes telemetry@0.0.31 alongside chat@0.0.31). Per user memory: never bump to 0.1.0; always increment patch even for breaking changes.

## 9. Testing strategy

| Surface | File | Approx tests |
|---------|------|--------------|
| Env detection (5 opt-out paths) | `shared/env.spec.ts` | 8 |
| Hashing | `shared/hash.spec.ts` | 3 |
| Sampling math | `shared/sample.spec.ts` | 5 |
| Anonymous id | `shared/anon-id.spec.ts` | 3 |
| Node client | `node/client.spec.ts` | 6 |
| Adapter helpers | `node/adapter.spec.ts` | 5 |
| Postinstall | `node/postinstall.spec.ts` | 4 |
| Browser provide() | `browser/provide.spec.ts` | 4 |
| Browser service | `browser/service.spec.ts` | 5 |
| **Permanent browser silence test** | `browser/browser-silence.spec.ts` | 1 |
| **Total** | | **~44 tests** |

### 9.1 The permanent browser silence test

```typescript
test('no network call occurs when provideNgafTelemetry is never called', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  const importSpy = vi.fn();
  vi.doMock('posthog-js', importSpy);

  // Bootstrap a minimal Angular app without provideNgafTelemetry().
  const app = await bootstrapApplication(NoOpComponent, { providers: [] });

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(importSpy).not.toHaveBeenCalled();
});

test('no network call when provideNgafTelemetry({ enabled: false }) is called', async () => {
  // Same setup but with provideNgafTelemetry({ enabled: false }) — same assertions.
});
```

This stays green permanently. Any future change that violates the trust contract — even a stray top-level `import 'posthog-js'` — fails the build immediately.

### 9.2 What we deliberately don't test

- Real PostHog network calls (covered by Spec 1A's manual round-trip verification pattern).
- Cross-package postinstall propagation (out of scope; runtime adapters are the primary signal).
- Browser e2e against a real PostHog project (manual verification step, not CI).

## 10. Risks & non-goals

### 10.1 Risks

| # | Risk | Mitigation |
|--:|------|------------|
| 1 | Default ingest URL points at a 404 until Spec 1D ships | Silent-fail principle absorbs it. Telemetry data is opt-out anyway — losing it for the gap between 1B and 1D is acceptable. README's "Reporting an issue" link gives users a path if they notice. |
| 2 | Lazy `posthog-js` import bypassed by stray top-level import | Permanent browser silence test fails the build immediately if anyone adds a top-level `import 'posthog-js'`. |
| 3 | Postinstall fails on locked-down npm runners (no network, strict perms) | Script wrapped in `\|\| true` in package.json. Postinstall NEVER fails `npm install`. |
| 4 | Sample rate stamping miscomputed at query time | `sample_weight` stamped per event; PostHog dashboards multiply by weight when de-sampling. Unit tests on `shouldSample()` cover edge cases (rate=0, rate=1, rate>1, rate<0). |
| 5 | Angular peer dep version drift | Same `^20.0.0 \|\| ^21.0.0` range as other `@ngaf/*` libs. Future Angular major version triggers a coordinated bump across the fixed group. |
| 6 | `@nx/js:tsc` doesn't natively handle `additionalEntryPoints` cleanly | Verified during scaffolding (Task 2). If it doesn't, fall back to two separate Nx projects under one published package — last resort. |

### 10.2 Non-goals (Spec 1B)

- No browser auto-init. `provideNgafTelemetry()` MUST be called explicitly with `enabled: true`.
- No tracking of which `@ngaf/*` packages installed alongside this one. Runtime adapter calls cover that signal.
- No PII collection. Email, names, message content, prompts, completions, project paths — never.
- No persistent identifier (no localStorage, no cookies, no filesystem). Per-process UUIDs only.
- No automatic sample-rate adjustment. Operator-controlled via env var.
- No bundle-size SLA enforcement. (Future hardening; not blocking.)

## 11. Deliverables of this spec

The plan at `docs/superpowers/plans/gtm/2026-05-15-analytics-foundation-1b-ngaf-telemetry.md` will check off:

- [ ] `libs/telemetry/{package,project,tsconfig,tsconfig.lib,tsconfig.lib.browser,ng-package,eslint.config,jest.config}.json/.mjs/.ts`
- [ ] `libs/telemetry/src/index.ts` + `shared/` module (env, hash, anon-id, sample, events) with tests
- [ ] `libs/telemetry/src/node/` module (client, postinstall, adapter, disable) with tests
- [ ] `libs/telemetry/src/browser/` module (provide, service, tokens, public-api) with tests
- [ ] Permanent browser silence test (`browser-silence.spec.ts`)
- [ ] `nx.json` updated: `telemetry` added to `publishable` group + preVersionCommand build list
- [ ] `.env.example` updated with `NGAF_TELEMETRY_INGEST_URL` + `NGAF_TELEMETRY_SAMPLE_RATE`
- [ ] `libs/telemetry/README.md` minor implementation alignment (env-var precedence, exports map docs)
- [ ] Verification: `nx run telemetry:build` (both targets), `nx run telemetry:test` (~44 tests pass), `nx run telemetry:lint`
- [ ] Verification: built `dist/libs/telemetry/package.json` has correct exports map; pack tarball with `npm pack ./dist/libs/telemetry` and inspect.

## 12. References

- Parent: [docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md](2026-05-13-gtm-meta-design.md)
- Sibling 1A (shipped): [docs/superpowers/specs/gtm/2026-05-14-analytics-foundation-1a-dashboards-as-code-design.md](2026-05-14-analytics-foundation-1a-dashboards-as-code-design.md)
- Trust contract: [libs/telemetry/README.md](../../../../libs/telemetry/README.md)
- Taxonomy: [docs/gtm/taxonomy.md](../../../gtm/taxonomy.md) (`ngaf:*` events)
- Cowork skill that consumes this library's events: [cowork/gtm/SKILL.md](../../../../cowork/gtm/SKILL.md)
- PostHog Node client: https://github.com/PostHog/posthog-js-lite
- Angular `EnvironmentProviders`: https://angular.dev/api/core/EnvironmentProviders
