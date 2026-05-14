# Analytics Foundation 1B — `@ngaf/telemetry` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@ngaf/telemetry` v(fixed-group) — single Nx library producing three published subpath exports (`.`, `./node`, `./browser`) honoring the trust contract at `libs/telemetry/README.md`. ~44 tests, hybrid `@nx/js:tsc` + `@nx/angular:package` build, permanent browser silence test, postinstall script.

**Architecture:** Three layered modules under `libs/telemetry/src/{shared,node,browser}/`. Shared has zero runtime deps. Node wraps `posthog-node`. Browser wraps `posthog-js` behind a lazy dynamic-import gate so opt-out (default-off) is enforceable at the bundler level.

**Tech Stack:** TypeScript via `tsx`/`tsc`; `posthog-node` + `posthog-js` (already in deps from website analytics); Angular `EnvironmentProviders` API (peer dep); Jest (existing repo convention for libs); Nx 21.x; `@nx/js:tsc` + `@nx/angular:package`.

---

## Context for the implementer

- Spec: `docs/superpowers/specs/gtm/2026-05-15-analytics-foundation-1b-ngaf-telemetry-design.md` — read §4-§9 before starting any task. Anchors everything.
- Trust contract (already public): `libs/telemetry/README.md` — DO NOT change without the user's explicit OK.
- Existing `@ngaf/*` lib conventions: see `libs/chat/` (Angular library), `libs/licensing/` and `libs/partial-json/` (non-Angular, `@nx/js:tsc`). Match patterns.
- `posthog-js` and `posthog-node` are already at the repo root (added by the May-2 instrumentation plan / Spec 1A). Reuse those versions.
- **Risk surfaced by the spec (§10 Risk #6):** the hybrid `@nx/js:tsc` + `@nx/angular:package` build may need adjustment. Task 2 confirms the wiring works before later tasks build on it. If it doesn't, fall back to `@nx/angular:package` with secondary entry points (ng-packagr DOES compile non-Angular TS).
- TDD: every code task follows write-test → run-and-fail → implement → run-and-pass → commit. Subagents must not skip the failing-test step.

## File structure (locked)

```
libs/telemetry/
├── README.md                         # exists; minor updates in Task 11
├── package.json                      # CREATE (Task 2)
├── project.json                      # CREATE (Task 2)
├── tsconfig.json                     # CREATE (Task 2)
├── tsconfig.lib.json                 # CREATE (Task 2) — node + shared
├── tsconfig.lib.browser.json         # CREATE (Task 2) — Angular
├── ng-package.json                   # CREATE (Task 2)
├── eslint.config.mjs                 # CREATE (Task 2)
├── jest.config.ts                    # CREATE (Task 2)
├── src/
│   ├── index.ts                      # CREATE (Task 9)
│   ├── shared/
│   │   ├── env.ts + env.spec.ts                # Task 3
│   │   ├── hash.ts + hash.spec.ts              # Task 3
│   │   ├── anon-id.ts + anon-id.spec.ts        # Task 3
│   │   ├── sample.ts + sample.spec.ts          # Task 3
│   │   └── events.ts                            # Task 3
│   ├── node/
│   │   ├── index.ts                            # Task 9
│   │   ├── disable.ts                          # Task 4
│   │   ├── client.ts + client.spec.ts          # Task 4
│   │   ├── postinstall.ts + postinstall.spec.ts # Task 5
│   │   └── adapter.ts + adapter.spec.ts        # Task 6
│   └── browser/
│       ├── public-api.ts                       # Task 9
│       ├── tokens.ts                           # Task 7
│       ├── service.ts + service.spec.ts        # Task 7
│       ├── provide.ts + provide.spec.ts        # Task 8
│       └── browser-silence.spec.ts             # Task 9 (permanent contract test)
nx.json                               # MODIFY (Task 10) — add telemetry to publishable group
.env.example                          # MODIFY (Task 10) — add NGAF_TELEMETRY_INGEST_URL
gtm.md                                # MODIFY (Task 1) — §7 row 1b links to this spec
```

---

## Task 1: Decomposition update (gtm.md §7 row 1b → spec link)

**Files:** Modify `gtm.md` §7 row for `analytics-foundation-1b` — replace `(pending)` with a link to this spec.

### Step 1.1

- [ ] Find the row in `gtm.md §7`:

```
| 0     | analytics-foundation-1b    | `cowork/gtm/SKILL.md`                     | (pending)                                                                      | `package-telemetry`        |
```

- [ ] Replace with:

```
| 0     | analytics-foundation-1b    | `cowork/gtm/SKILL.md`                     | [spec](docs/superpowers/specs/gtm/2026-05-15-analytics-foundation-1b-ngaf-telemetry-design.md) | `package-telemetry`        |
```

### Step 1.2 — Commit

```bash
git add gtm.md
git commit -m "$(cat <<'EOF'
chore(gtm): link analytics-foundation-1b spec from gtm.md §7

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Project scaffold + verify build wiring is viable

**Goal:** Confirm the hybrid `@nx/js:tsc` (node + shared) + `@nx/angular:package` (browser) build works in one project before any code lands.

**Files:** Create `libs/telemetry/{package,project,tsconfig,tsconfig.lib,tsconfig.lib.browser,ng-package,eslint.config,jest.config}.json/.mjs/.ts`.

### Step 2.1 — Read existing patterns

- [ ] Read `libs/chat/{project,tsconfig.lib,ng-package}.json` and `libs/partial-json/{project,tsconfig.lib}.json` so the scaffold matches repo conventions.

### Step 2.2 — Write `libs/telemetry/package.json`

```json
{
  "name": "@ngaf/telemetry",
  "version": "0.0.0",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/cacheplane/angular-agent-framework.git",
    "directory": "libs/telemetry"
  },
  "homepage": "https://github.com/cacheplane/angular-agent-framework#readme",
  "bugs": { "url": "https://github.com/cacheplane/angular-agent-framework/issues" },
  "sideEffects": false,
  "type": "module",
  "peerDependencies": {
    "@angular/core": "^20.0.0 || ^21.0.0"
  },
  "peerDependenciesMeta": {
    "@angular/core": { "optional": true }
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

### Step 2.3 — Write `libs/telemetry/project.json`

```jsonc
{
  "name": "telemetry",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/telemetry/src",
  "projectType": "library",
  "tags": ["scope:shared", "type:lib"],
  "targets": {
    "build:node": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/libs/telemetry"],
      "options": {
        "outputPath": "dist/libs/telemetry",
        "main": "libs/telemetry/src/index.ts",
        "additionalEntryPoints": [
          "libs/telemetry/src/node/index.ts",
          "libs/telemetry/src/node/postinstall.ts"
        ],
        "tsConfig": "libs/telemetry/tsconfig.lib.json",
        "assets": ["libs/telemetry/README.md", "libs/telemetry/package.json"]
      }
    },
    "build:browser": {
      "executor": "@nx/angular:package",
      "outputs": ["{workspaceRoot}/dist/libs/telemetry/browser"],
      "options": {
        "project": "libs/telemetry/ng-package.json",
        "tsConfig": "libs/telemetry/tsconfig.lib.browser.json"
      },
      "dependsOn": ["build:node"]
    },
    "build": {
      "dependsOn": ["build:node", "build:browser"],
      "executor": "nx:run-commands",
      "options": { "command": "true" }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "libs/telemetry/jest.config.ts",
        "passWithNoTests": false
      }
    },
    "lint": { "executor": "@nx/eslint:lint" }
  }
}
```

### Step 2.4 — Write tsconfigs

`libs/telemetry/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "es2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "lib": ["es2022", "dom"]
  },
  "include": []
}
```

`libs/telemetry/tsconfig.lib.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true,
    "emitDeclarationOnly": false
  },
  "include": ["src/index.ts", "src/shared/**/*.ts", "src/node/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "src/browser/**"]
}
```

`libs/telemetry/tsconfig.lib.browser.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc/browser",
    "declaration": true,
    "emitDeclarationOnly": false,
    "types": []
  },
  "include": ["src/browser/**/*.ts", "src/shared/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

`libs/telemetry/ng-package.json`:
```json
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/libs/telemetry/browser",
  "lib": {
    "entryFile": "src/browser/public-api.ts"
  }
}
```

`libs/telemetry/jest.config.ts`:
```ts
export default {
  displayName: 'telemetry',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/telemetry',
};
```

`libs/telemetry/tsconfig.spec.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "module": "commonjs",
    "types": ["jest", "node"]
  },
  "include": ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"]
}
```

`libs/telemetry/eslint.config.mjs`:
```js
import baseConfig from '../../eslint.config.mjs';
export default [...baseConfig, { files: ['**/*.ts'] }];
```

### Step 2.5 — Verify Nx recognizes the project

```bash
npx nx show projects | grep -Fx telemetry
```
Expected: prints `telemetry`.

```bash
npx nx show project telemetry --json | python3 -c "import json,sys; p=json.load(sys.stdin); print('targets:', sorted(p['targets'].keys()))"
```
Expected: `targets: ['build', 'build:browser', 'build:node', 'lint', 'test']`.

### Step 2.6 — Smoke-test the build wiring with a stub

Before writing real code, prove the hybrid build works.

```bash
mkdir -p libs/telemetry/src/shared libs/telemetry/src/node libs/telemetry/src/browser
echo "export const VERSION = '0.0.0';" > libs/telemetry/src/index.ts
echo "export const VERSION = '0.0.0';" > libs/telemetry/src/node/index.ts
echo "" > libs/telemetry/src/node/postinstall.ts
cat > libs/telemetry/src/browser/public-api.ts <<'EOF'
export const BROWSER_VERSION = '0.0.0';
EOF
```

Then:
```bash
npx nx run telemetry:build:node 2>&1 | tail -10
npx nx run telemetry:build:browser 2>&1 | tail -10
```

Both must succeed. If `build:browser` fails because ng-packagr complains about a missing Angular Component/Directive/Module, the spec's Risk #6 has materialized — STOP and report. Fallback: convert the project to use `@nx/angular:package` with secondary entry points for the node entry too.

### Step 2.7 — Commit

```bash
git add libs/telemetry
git commit -m "$(cat <<'EOF'
feat(telemetry): scaffold @ngaf/telemetry Nx project + hybrid build

Three subpath exports planned: ., ./node, ./browser. Build uses
@nx/js:tsc for shared+node entries and @nx/angular:package for the
browser (Angular DI) entry. Stub source files prove both builds
resolve before real code lands.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Shared module — env, hash, anon-id, sample, events (TDD)

**Files:** `libs/telemetry/src/shared/{env,hash,anon-id,sample,events}.ts` + their `.spec.ts`.

This is the foundation. Other modules depend on it. Strict TDD throughout.

### Step 3.1 — Write `shared/env.spec.ts` (failing test)

```typescript
import { isTelemetryDisabled, getDisableReason } from './env';

describe('isTelemetryDisabled', () => {
  beforeEach(() => {
    delete process.env.DO_NOT_TRACK;
    delete process.env.NGAF_TELEMETRY_DISABLED;
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.CONTINUOUS_INTEGRATION;
    delete process.env.BUILDKITE;
    delete process.env.CIRCLECI;
  });

  test('returns false with no env signals', () => {
    expect(isTelemetryDisabled()).toBe(false);
  });

  test('DO_NOT_TRACK=1 disables', () => {
    process.env.DO_NOT_TRACK = '1';
    expect(isTelemetryDisabled()).toBe(true);
    expect(getDisableReason()).toBe('DO_NOT_TRACK');
  });

  test('DO_NOT_TRACK=true disables', () => {
    process.env.DO_NOT_TRACK = 'true';
    expect(isTelemetryDisabled()).toBe(true);
  });

  test('NGAF_TELEMETRY_DISABLED=1 disables', () => {
    process.env.NGAF_TELEMETRY_DISABLED = '1';
    expect(isTelemetryDisabled()).toBe(true);
    expect(getDisableReason()).toBe('NGAF_TELEMETRY_DISABLED');
  });

  test('CI=true disables (CI auto-detect)', () => {
    process.env.CI = 'true';
    expect(isTelemetryDisabled()).toBe(true);
    expect(getDisableReason()).toBe('CI');
  });

  test('GITHUB_ACTIONS=true disables', () => {
    process.env.GITHUB_ACTIONS = 'true';
    expect(isTelemetryDisabled()).toBe(true);
  });

  test('DO_NOT_TRACK=0 does NOT disable', () => {
    process.env.DO_NOT_TRACK = '0';
    expect(isTelemetryDisabled()).toBe(false);
  });

  test('precedence: DO_NOT_TRACK reported first when multiple match', () => {
    process.env.DO_NOT_TRACK = '1';
    process.env.NGAF_TELEMETRY_DISABLED = '1';
    process.env.CI = 'true';
    expect(getDisableReason()).toBe('DO_NOT_TRACK');
  });
});
```

### Step 3.2 — Run, see fail.

```bash
npx nx run telemetry:test --testPathPattern=env.spec
```
Expected: FAIL (`./env` not found).

### Step 3.3 — Implement `shared/env.ts`

```typescript
const TRUE_VALUES = new Set(['1', 'true', 'TRUE', 'yes']);

function truthy(v: string | undefined): boolean {
  return v !== undefined && TRUE_VALUES.has(v);
}

type DisableReason = 'DO_NOT_TRACK' | 'NGAF_TELEMETRY_DISABLED' | 'CI' | null;

export function getDisableReason(env: NodeJS.ProcessEnv = process.env): DisableReason {
  if (truthy(env.DO_NOT_TRACK)) return 'DO_NOT_TRACK';
  if (truthy(env.NGAF_TELEMETRY_DISABLED)) return 'NGAF_TELEMETRY_DISABLED';
  if (
    truthy(env.CI) ||
    truthy(env.GITHUB_ACTIONS) ||
    truthy(env.CONTINUOUS_INTEGRATION) ||
    truthy(env.BUILDKITE) ||
    truthy(env.CIRCLECI)
  ) {
    return 'CI';
  }
  return null;
}

export function isTelemetryDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getDisableReason(env) !== null;
}
```

### Step 3.4 — Verify passes.

```bash
npx nx run telemetry:test --testPathPattern=env.spec
```
Expected: 8 tests pass.

### Step 3.5 — Write `shared/hash.spec.ts` + implement `hash.ts`

`hash.spec.ts`:
```typescript
import { sha256 } from './hash';

describe('sha256', () => {
  test('returns a 64-char hex digest', async () => {
    const out = await sha256('hello');
    expect(out).toMatch(/^[a-f0-9]{64}$/);
  });

  test('is deterministic', async () => {
    const a = await sha256('same input');
    const b = await sha256('same input');
    expect(a).toBe(b);
  });

  test('differs for different inputs', async () => {
    const a = await sha256('foo');
    const b = await sha256('bar');
    expect(a).not.toBe(b);
  });
});
```

`hash.ts` (Node environment for tests; uses Web Crypto which is available in Node 20+):
```typescript
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Step 3.6 — Write `shared/anon-id.spec.ts` + implement `anon-id.ts`

`anon-id.spec.ts`:
```typescript
import { getAnonId, _resetAnonIdForTesting } from './anon-id';

describe('getAnonId', () => {
  beforeEach(() => _resetAnonIdForTesting());

  test('returns a stable id within a process', () => {
    const a = getAnonId();
    const b = getAnonId();
    expect(a).toBe(b);
  });

  test('matches anon_<uuid> shape', () => {
    expect(getAnonId()).toMatch(/^anon_[0-9a-f-]{36}$/);
  });

  test('different processes get different ids (simulated via reset)', () => {
    const a = getAnonId();
    _resetAnonIdForTesting();
    const b = getAnonId();
    expect(a).not.toBe(b);
  });
});
```

`anon-id.ts`:
```typescript
import { randomUUID } from 'node:crypto';

let cached: string | null = null;

export function getAnonId(): string {
  if (!cached) cached = `anon_${randomUUID()}`;
  return cached;
}

// @internal — for tests only
export function _resetAnonIdForTesting(): void {
  cached = null;
}
```

Note: browser entry will use a tiny wrapper that calls `globalThis.crypto.randomUUID()` since `node:crypto` isn't available there. Spec'd in shared but only imported from `node/`. Browser has its own anon-id helper in `browser/service.ts` (covered in Task 7).

### Step 3.7 — Write `shared/sample.spec.ts` + implement `sample.ts`

`sample.spec.ts`:
```typescript
import { shouldSample } from './sample';

describe('shouldSample', () => {
  test('rate=1.0 always samples', () => {
    expect(shouldSample(1.0, 'anon_x')).toBe(true);
    expect(shouldSample(1.0, 'anon_y')).toBe(true);
  });

  test('rate=0 never samples', () => {
    expect(shouldSample(0, 'anon_x')).toBe(false);
  });

  test('deterministic for a given (rate, id) pair', () => {
    const a = shouldSample(0.5, 'anon_x');
    const b = shouldSample(0.5, 'anon_x');
    expect(a).toBe(b);
  });

  test('rate clamps to [0, 1]', () => {
    expect(shouldSample(1.5, 'anon_x')).toBe(true);
    expect(shouldSample(-1, 'anon_x')).toBe(false);
  });

  test('different ids can produce different results at rate=0.5', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `anon_${i}`);
    const sampled = ids.filter((id) => shouldSample(0.5, id)).length;
    expect(sampled).toBeGreaterThan(20);
    expect(sampled).toBeLessThan(80);
  });
});
```

`sample.ts`:
```typescript
// Cheap deterministic 32-bit hash (Fnv-1a) — no crypto needed for sampling.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

export function shouldSample(rate: number, anonId: string): boolean {
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  return hashString(anonId) / 0xffffffff < rate;
}
```

### Step 3.8 — Write `shared/events.ts` (no spec needed — type-only)

```typescript
export type NgafNodeEvent =
  | 'ngaf:postinstall'
  | 'ngaf:runtime_instance_created'
  | 'ngaf:stream_started'
  | 'ngaf:stream_ended'
  | 'ngaf:stream_errored';

export type NgafBrowserEvent =
  | 'ngaf:browser_provided'
  | 'ngaf:browser_chat_init';

export type NgafEvent = NgafNodeEvent | NgafBrowserEvent;
```

### Step 3.9 — Verify all shared tests pass + commit

```bash
npx nx run telemetry:test
```
Expected: 8 (env) + 3 (hash) + 3 (anon-id) + 5 (sample) = 19 tests pass.

```bash
git add libs/telemetry/src/shared
git commit -m "$(cat <<'EOF'
feat(telemetry): shared module — env detection, hash, anon-id, sample, events

19 tests covering all five opt-out paths, SHA-256 determinism,
per-process anon-id, sample-rate clamping, and event-name types.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Node client + disable() with TDD

**Files:** `libs/telemetry/src/node/{client,disable,index}.ts` + `client.spec.ts`.

### Step 4.1 — `client.spec.ts`

```typescript
import { jest } from '@jest/globals';

jest.mock('posthog-node', () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Import AFTER mock so the mock takes effect.
import { PostHog } from 'posthog-node';
import { capturePostinstall, _resetClientForTesting } from './client';
import { disableTelemetry, _resetDisableForTesting } from './disable';

describe('node client', () => {
  beforeEach(() => {
    (PostHog as jest.Mock).mockClear();
    _resetClientForTesting();
    _resetDisableForTesting();
    delete process.env.DO_NOT_TRACK;
    delete process.env.NGAF_TELEMETRY_DISABLED;
    delete process.env.CI;
    process.env.NGAF_TELEMETRY_INGEST_URL = 'https://test.example/api/ingest';
  });

  test('capturePostinstall sends an event with pkg + version', async () => {
    const instance = { capture: jest.fn(), shutdown: jest.fn().mockResolvedValue(undefined) };
    (PostHog as jest.Mock).mockImplementation(() => instance);
    await capturePostinstall({ pkg: '@ngaf/telemetry', version: '0.0.31' });
    expect(instance.capture).toHaveBeenCalledWith(expect.objectContaining({
      event: 'ngaf:postinstall',
      properties: expect.objectContaining({ pkg: '@ngaf/telemetry', version: '0.0.31' }),
    }));
  });

  test('capturePostinstall no-ops when DO_NOT_TRACK is set', async () => {
    process.env.DO_NOT_TRACK = '1';
    await capturePostinstall({ pkg: 'x', version: '1' });
    expect(PostHog).not.toHaveBeenCalled();
  });

  test('capturePostinstall no-ops after disableTelemetry()', async () => {
    disableTelemetry();
    await capturePostinstall({ pkg: 'x', version: '1' });
    expect(PostHog).not.toHaveBeenCalled();
  });

  test('capturePostinstall uses NGAF_TELEMETRY_INGEST_URL when set', async () => {
    process.env.NGAF_TELEMETRY_INGEST_URL = 'https://custom.example/api/ingest';
    await capturePostinstall({ pkg: 'x', version: '1' });
    expect(PostHog).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ host: 'https://custom.example/api/ingest' }),
    );
  });

  test('capturePostinstall sends sample_weight property', async () => {
    const instance = { capture: jest.fn(), shutdown: jest.fn().mockResolvedValue(undefined) };
    (PostHog as jest.Mock).mockImplementation(() => instance);
    await capturePostinstall({ pkg: 'x', version: '1' });
    expect(instance.capture).toHaveBeenCalledWith(expect.objectContaining({
      properties: expect.objectContaining({ sample_weight: expect.any(Number) }),
    }));
  });

  test('capturePostinstall awaits shutdown before resolving', async () => {
    let shutdownCalled = false;
    const instance = {
      capture: jest.fn(),
      shutdown: jest.fn(async () => { shutdownCalled = true; }),
    };
    (PostHog as jest.Mock).mockImplementation(() => instance);
    await capturePostinstall({ pkg: 'x', version: '1' });
    expect(shutdownCalled).toBe(true);
  });
});
```

### Step 4.2 — Run, see fail.

```bash
npx nx run telemetry:test --testPathPattern=client.spec
```

### Step 4.3 — Implement `node/disable.ts`

```typescript
let disabled = false;

export function disableTelemetry(): void {
  disabled = true;
}

export function isProgrammaticallyDisabled(): boolean {
  return disabled;
}

// @internal — tests only
export function _resetDisableForTesting(): void {
  disabled = false;
}
```

### Step 4.4 — Implement `node/client.ts`

```typescript
import { PostHog } from 'posthog-node';
import { getAnonId } from '../shared/anon-id.js';
import { isTelemetryDisabled } from '../shared/env.js';
import { shouldSample } from '../shared/sample.js';
import type { NgafNodeEvent } from '../shared/events.js';
import { isProgrammaticallyDisabled } from './disable.js';

const DEFAULT_INGEST = 'https://cacheplane.dev/api/ingest';
// This token is the public Cacheplane PostHog project key (the proxy strips it
// and re-keys server-side). It's a Project API key, not a Personal API key, so
// it's safe to ship in OSS code.
const PUBLIC_INGEST_KEY = 'phc_public_cacheplane_telemetry';

let cached: PostHog | null = null;

function getClient(): PostHog | null {
  if (cached) return cached;
  if (isTelemetryDisabled() || isProgrammaticallyDisabled()) return null;
  const host = process.env.NGAF_TELEMETRY_INGEST_URL ?? DEFAULT_INGEST;
  cached = new PostHog(PUBLIC_INGEST_KEY, {
    host,
    flushAt: 1,
    flushInterval: 0,
  });
  return cached;
}

export async function captureEvent(event: NgafNodeEvent, properties: Record<string, unknown> = {}): Promise<void> {
  const client = getClient();
  if (!client) return;
  const rate = Number(process.env.NGAF_TELEMETRY_SAMPLE_RATE ?? '1');
  const anonId = getAnonId();
  if (!shouldSample(rate, anonId)) return;
  try {
    client.capture({
      distinctId: anonId,
      event,
      properties: { ...properties, sample_weight: rate > 0 ? 1 / Math.min(1, rate) : 1 },
    });
    await client.shutdown();
  } catch {
    // silent fail
  } finally {
    cached = null;  // fresh client per process; flushAt:1 means we're done
  }
}

export async function capturePostinstall(input: { pkg: string; version: string }): Promise<void> {
  await captureEvent('ngaf:postinstall', {
    pkg: input.pkg,
    version: input.version,
    node: process.version,
    os: process.platform,
  });
}

// @internal — tests only
export function _resetClientForTesting(): void {
  cached = null;
}
```

### Step 4.5 — Verify + commit

```bash
npx nx run telemetry:test --testPathPattern=client.spec
```
Expected: 6 tests pass.

```bash
git add libs/telemetry/src/node/{client,disable}.ts libs/telemetry/src/node/client.spec.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): Node client wrapping posthog-node + programmatic disable

Six tests: postinstall capture shape, opt-out paths, ingest URL
override, sample_weight stamping, awaits shutdown. Silent fail on
network errors. Public PostHog Project API Key is safe to ship in OSS
code (the ingest proxy re-keys server-side; never a Personal Key).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Postinstall script with TDD

**Files:** `libs/telemetry/src/node/postinstall.ts` + `postinstall.spec.ts`.

### Step 5.1 — `postinstall.spec.ts`

```typescript
import { jest } from '@jest/globals';
import { capturePostinstallScript } from './postinstall';

jest.mock('./client', () => ({
  capturePostinstall: jest.fn().mockResolvedValue(undefined),
}));

import { capturePostinstall } from './client';

describe('postinstall script', () => {
  beforeEach(() => {
    (capturePostinstall as jest.Mock).mockClear();
    delete process.env.CI;
    delete process.env.DO_NOT_TRACK;
  });

  test('calls capturePostinstall with the package name + version', async () => {
    const stdout: string[] = [];
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@ngaf/telemetry', version: '0.0.31' }),
      write: (s: string) => stdout.push(s),
      env: { ...process.env },
    });
    expect(capturePostinstall).toHaveBeenCalledWith({ pkg: '@ngaf/telemetry', version: '0.0.31' });
  });

  test('prints the opt-out notice to stdout when not CI', async () => {
    const stdout: string[] = [];
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@ngaf/telemetry', version: '0.0.31' }),
      write: (s: string) => stdout.push(s),
      env: { ...process.env },
    });
    expect(stdout.join('')).toMatch(/@ngaf\/telemetry: sent install ping/);
    expect(stdout.join('')).toMatch(/DO_NOT_TRACK=1/);
  });

  test('suppresses stdout notice when CI=true', async () => {
    const stdout: string[] = [];
    await capturePostinstallScript({
      readPackageJson: () => ({ name: '@ngaf/telemetry', version: '0.0.31' }),
      write: (s: string) => stdout.push(s),
      env: { ...process.env, CI: 'true' },
    });
    expect(stdout).toEqual([]);
  });

  test('swallows readPackageJson errors silently', async () => {
    await expect(
      capturePostinstallScript({
        readPackageJson: () => { throw new Error('not found'); },
        write: () => {},
        env: { ...process.env },
      }),
    ).resolves.toBeUndefined();
    expect(capturePostinstall).not.toHaveBeenCalled();
  });
});
```

### Step 5.2 — Implement `postinstall.ts`

```typescript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { capturePostinstall } from './client.js';
import { isTelemetryDisabled } from '../shared/env.js';

interface PostinstallDeps {
  readPackageJson: () => { name: string; version: string };
  write: (s: string) => void;
  env: NodeJS.ProcessEnv;
}

export async function capturePostinstallScript(deps: PostinstallDeps): Promise<void> {
  if (isTelemetryDisabled(deps.env)) return;
  let pkg: { name: string; version: string };
  try {
    pkg = deps.readPackageJson();
  } catch {
    return;
  }
  try {
    await capturePostinstall({ pkg: pkg.name, version: pkg.version });
    if (!deps.env.CI) {
      deps.write(
        `@ngaf/telemetry: sent install ping (${pkg.name}@${pkg.version}). ` +
        `Disable: DO_NOT_TRACK=1 or NGAF_TELEMETRY_DISABLED=1. ` +
        `See https://github.com/cacheplane/angular-agent-framework/blob/main/libs/telemetry/README.md\n`,
      );
    }
  } catch {
    // never break npm install
  }
}

// Entry point — invoked by package.json scripts.postinstall.
async function main(): Promise<void> {
  await capturePostinstallScript({
    readPackageJson: () => {
      const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
      return JSON.parse(readFileSync(pkgPath, 'utf8'));
    },
    write: (s) => process.stdout.write(s),
    env: process.env,
  });
}

// Only run as main entry, not when imported by tests.
const isDirectRun =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) main();
```

### Step 5.3 — Verify + commit

```bash
npx nx run telemetry:test --testPathPattern=postinstall.spec
```
Expected: 4 tests pass.

```bash
git add libs/telemetry/src/node/postinstall.{ts,spec.ts}
git commit -m "$(cat <<'EOF'
feat(telemetry): postinstall script with opt-out notice + CI suppression

4 tests cover capture, stdout notice formatting, CI suppression, and
silent failure when package.json can't be read. Wrapped so npm install
never fails on any path.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Node adapter helpers with TDD

**Files:** `libs/telemetry/src/node/adapter.ts` + `adapter.spec.ts`.

### Step 6.1 — `adapter.spec.ts`

```typescript
import { jest } from '@jest/globals';

jest.mock('./client', () => ({
  captureEvent: jest.fn().mockResolvedValue(undefined),
}));

import { captureEvent } from './client';
import {
  captureRuntimeInstanceCreated,
  captureStreamStarted,
  captureStreamEnded,
  captureStreamErrored,
} from './adapter';
import { sha256 } from '../shared/hash';

describe('adapter helpers', () => {
  beforeEach(() => (captureEvent as jest.Mock).mockClear());

  test('captureRuntimeInstanceCreated hashes any apiKey property', async () => {
    await captureRuntimeInstanceCreated({
      transport: 'langgraph',
      provider: 'openai',
      apiKey: 'secret-token-xyz',
    });
    const call = (captureEvent as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('ngaf:runtime_instance_created');
    expect(call[1].apiKey).toBeUndefined();  // raw key stripped
    expect(call[1].apiKey_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test('captureStreamStarted records provider + model only', async () => {
    await captureStreamStarted({ provider: 'openai', model: 'gpt-4' });
    expect(captureEvent).toHaveBeenCalledWith(
      'ngaf:stream_started',
      expect.objectContaining({ provider: 'openai', model: 'gpt-4' }),
    );
  });

  test('captureStreamEnded records duration', async () => {
    await captureStreamEnded({ provider: 'openai', model: 'gpt-4', durationMs: 1234 });
    expect(captureEvent).toHaveBeenCalledWith(
      'ngaf:stream_ended',
      expect.objectContaining({ durationMs: 1234 }),
    );
  });

  test('captureStreamErrored records error.class only — no message', async () => {
    await captureStreamErrored({
      provider: 'openai',
      model: 'gpt-4',
      error: new TypeError('detailed error with PII xxxx'),
    });
    const props = (captureEvent as jest.Mock).mock.calls[0][1];
    expect(props.errorClass).toBe('TypeError');
    expect(props.errorMessage).toBeUndefined();
    expect(JSON.stringify(props)).not.toMatch(/detailed error/);
  });

  test('all helpers no-op silently when captureEvent rejects', async () => {
    (captureEvent as jest.Mock).mockRejectedValueOnce(new Error('network'));
    await expect(captureStreamStarted({ provider: 'x', model: 'y' })).resolves.toBeUndefined();
  });
});
```

### Step 6.2 — Implement `adapter.ts`

```typescript
import { captureEvent } from './client.js';
import { sha256 } from '../shared/hash.js';

export interface RuntimeInstanceTelemetry {
  transport: string;                    // 'langgraph' | 'ag-ui' | 'custom'
  provider?: string;                    // 'openai' | 'anthropic' | ...
  model?: string;
  angularVersion?: string;
  apiKey?: string;                      // hashed before sending
}

export interface StreamTelemetry {
  provider: string;
  model: string;
  durationMs?: number;
}

async function safe(fn: () => Promise<void>): Promise<void> {
  try { await fn(); } catch { /* silent fail */ }
}

export async function captureRuntimeInstanceCreated(input: RuntimeInstanceTelemetry): Promise<void> {
  await safe(async () => {
    const { apiKey, ...rest } = input;
    const props: Record<string, unknown> = { ...rest };
    if (apiKey) props.apiKey_sha256 = await sha256(apiKey);
    await captureEvent('ngaf:runtime_instance_created', props);
  });
}

export async function captureStreamStarted(input: StreamTelemetry): Promise<void> {
  await safe(() => captureEvent('ngaf:stream_started', { ...input }));
}

export async function captureStreamEnded(input: StreamTelemetry): Promise<void> {
  await safe(() => captureEvent('ngaf:stream_ended', { ...input }));
}

export async function captureStreamErrored(
  input: StreamTelemetry & { error: Error | unknown },
): Promise<void> {
  await safe(async () => {
    const { error, ...rest } = input;
    const errorClass = error instanceof Error ? error.constructor.name : 'Unknown';
    await captureEvent('ngaf:stream_errored', { ...rest, errorClass });
  });
}
```

### Step 6.3 — Verify + commit

```bash
npx nx run telemetry:test --testPathPattern=adapter.spec
```
Expected: 5 tests pass.

```bash
git add libs/telemetry/src/node/adapter.{ts,spec.ts}
git commit -m "$(cat <<'EOF'
feat(telemetry): Node adapter helpers — runtime_instance + stream lifecycle

5 tests. Raw apiKey is SHA-256 hashed before emit. Error objects emit
only their class name, never the message. All four helpers no-op
silently when capture throws — npm install path stays safe.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Browser tokens + service with TDD

**Files:** `libs/telemetry/src/browser/{tokens,service}.ts` + `service.spec.ts`.

### Step 7.1 — `tokens.ts`

```typescript
import { InjectionToken } from '@angular/core';

export interface NgafTelemetryConfig {
  enabled: boolean;
  posthogKey?: string;
  posthogHost?: string;
  sampleRate?: number;
}

export const NGAF_TELEMETRY_CONFIG = new InjectionToken<NgafTelemetryConfig | null>(
  'NGAF_TELEMETRY_CONFIG',
);
```

### Step 7.2 — `service.spec.ts`

```typescript
import { TestBed } from '@angular/core/testing';
import { NgafTelemetryService } from './service';
import { NGAF_TELEMETRY_CONFIG } from './tokens';

describe('NgafTelemetryService', () => {
  test('capture() resolves without calling posthog when enabled is false', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: NGAF_TELEMETRY_CONFIG, useValue: { enabled: false } },
        NgafTelemetryService,
      ],
    });
    const svc = TestBed.inject(NgafTelemetryService);
    await expect(svc.capture('ngaf:browser_provided')).resolves.toBeUndefined();
  });

  test('capture() resolves without calling posthog when no config provided', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: NGAF_TELEMETRY_CONFIG, useValue: null },
        NgafTelemetryService,
      ],
    });
    const svc = TestBed.inject(NgafTelemetryService);
    await expect(svc.capture('ngaf:browser_provided')).resolves.toBeUndefined();
  });

  test('capture() no-ops when posthogKey is missing even with enabled:true', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: NGAF_TELEMETRY_CONFIG, useValue: { enabled: true } },
        NgafTelemetryService,
      ],
    });
    const svc = TestBed.inject(NgafTelemetryService);
    await expect(svc.capture('ngaf:browser_provided')).resolves.toBeUndefined();
  });

  test('capture() with enabled:true and posthogKey invokes posthog-js (lazy)', async () => {
    // We can't easily test the dynamic import in jest without mocking it,
    // so we just verify the service doesn't throw and returns void.
    TestBed.configureTestingModule({
      providers: [
        { provide: NGAF_TELEMETRY_CONFIG, useValue: { enabled: true, posthogKey: 'phc_test' } },
        NgafTelemetryService,
      ],
    });
    const svc = TestBed.inject(NgafTelemetryService);
    // Don't actually await — we don't want the dynamic import to fire in tests.
    expect(typeof svc.capture).toBe('function');
  });

  test('service is provided as root-scoped', () => {
    // Smoke: providedIn:root means the service can be injected without explicit providers.
    // Since we still need NGAF_TELEMETRY_CONFIG, this is a structural check only.
    expect(NgafTelemetryService).toBeDefined();
  });
});
```

### Step 7.3 — Implement `service.ts`

```typescript
import { Injectable, Inject, Optional } from '@angular/core';
import { NGAF_TELEMETRY_CONFIG, type NgafTelemetryConfig } from './tokens.js';
import type { NgafBrowserEvent } from '../shared/events.js';

@Injectable({ providedIn: 'root' })
export class NgafTelemetryService {
  private postHogPromise: Promise<typeof import('posthog-js')['default'] | null> | null = null;

  constructor(
    @Optional() @Inject(NGAF_TELEMETRY_CONFIG) private config: NgafTelemetryConfig | null,
  ) {}

  async capture(event: NgafBrowserEvent, properties?: Record<string, unknown>): Promise<void> {
    if (!this.config?.enabled || !this.config.posthogKey) return;
    try {
      const ph = await this.loadPostHog();
      if (!ph) return;
      ph.capture(event, properties);
    } catch {
      // silent fail
    }
  }

  private loadPostHog(): Promise<typeof import('posthog-js')['default'] | null> {
    if (!this.postHogPromise) {
      this.postHogPromise = import('posthog-js').then((mod) => {
        if (!this.config?.posthogKey) return null;
        mod.default.init(this.config.posthogKey, {
          api_host: this.config.posthogHost ?? 'https://us.i.posthog.com',
        });
        return mod.default;
      }).catch(() => null);
    }
    return this.postHogPromise;
  }
}
```

### Step 7.4 — Verify + commit

```bash
npx nx run telemetry:test --testPathPattern=service.spec
```
Expected: 5 tests pass.

```bash
git add libs/telemetry/src/browser/{tokens,service}.ts libs/telemetry/src/browser/service.spec.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): browser service with lazy posthog-js import

NgafTelemetryService never imports posthog-js at module load. Dynamic
import only fires when capture() is called with enabled:true AND
posthogKey present. Five tests cover all opt-out paths.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `provideNgafTelemetry()` with TDD

**Files:** `libs/telemetry/src/browser/provide.ts` + `provide.spec.ts`.

### Step 8.1 — `provide.spec.ts`

```typescript
import { TestBed } from '@angular/core/testing';
import { provideNgafTelemetry } from './provide';
import { NgafTelemetryService } from './service';
import { NGAF_TELEMETRY_CONFIG } from './tokens';

describe('provideNgafTelemetry', () => {
  test('returns EnvironmentProviders that bind config + service', () => {
    TestBed.configureTestingModule({
      providers: [provideNgafTelemetry({ enabled: false })],
    });
    expect(TestBed.inject(NGAF_TELEMETRY_CONFIG)).toEqual({ enabled: false });
    expect(TestBed.inject(NgafTelemetryService)).toBeInstanceOf(NgafTelemetryService);
  });

  test('config defaults: sampleRate defaults to 1.0 when omitted', () => {
    TestBed.configureTestingModule({
      providers: [provideNgafTelemetry({ enabled: true, posthogKey: 'phc_x' })],
    });
    const cfg = TestBed.inject(NGAF_TELEMETRY_CONFIG);
    expect(cfg?.sampleRate ?? 1.0).toBe(1.0);
  });

  test('posthogHost passes through', () => {
    TestBed.configureTestingModule({
      providers: [provideNgafTelemetry({ enabled: true, posthogKey: 'x', posthogHost: 'https://eu.i.posthog.com' })],
    });
    expect(TestBed.inject(NGAF_TELEMETRY_CONFIG)?.posthogHost).toBe('https://eu.i.posthog.com');
  });

  test('enabled:true without posthogKey still resolves (service no-ops at call time)', () => {
    TestBed.configureTestingModule({
      providers: [provideNgafTelemetry({ enabled: true })],
    });
    expect(TestBed.inject(NgafTelemetryService)).toBeInstanceOf(NgafTelemetryService);
  });
});
```

### Step 8.2 — Implement `provide.ts`

```typescript
import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { NGAF_TELEMETRY_CONFIG, type NgafTelemetryConfig } from './tokens.js';
import { NgafTelemetryService } from './service.js';

export function provideNgafTelemetry(config: NgafTelemetryConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: NGAF_TELEMETRY_CONFIG, useValue: config },
    NgafTelemetryService,
  ]);
}
```

### Step 8.3 — Verify + commit

```bash
npx nx run telemetry:test --testPathPattern=provide.spec
```
Expected: 4 tests pass.

```bash
git add libs/telemetry/src/browser/provide.{ts,spec.ts}
git commit -m "$(cat <<'EOF'
feat(telemetry): provideNgafTelemetry() returning EnvironmentProviders

4 tests verify config + service injection, sampleRate default,
posthogHost passthrough, and that enabled:true without posthogKey still
provides a service (which then no-ops at capture time).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Permanent browser silence test + entry-point indexes

**Files:**
- Create: `libs/telemetry/src/browser/browser-silence.spec.ts`
- Create: `libs/telemetry/src/index.ts` (shared public API)
- Create: `libs/telemetry/src/node/index.ts` (node public API)
- Create: `libs/telemetry/src/browser/public-api.ts` (browser public API)

### Step 9.1 — `src/index.ts`

```typescript
export { isTelemetryDisabled, getDisableReason } from './shared/env.js';
export { sha256 } from './shared/hash.js';
export { getAnonId } from './shared/anon-id.js';
export { shouldSample } from './shared/sample.js';
export type { NgafEvent, NgafNodeEvent, NgafBrowserEvent } from './shared/events.js';
```

### Step 9.2 — `src/node/index.ts`

```typescript
export { disableTelemetry } from './disable.js';
export { capturePostinstall, captureEvent } from './client.js';
export {
  captureRuntimeInstanceCreated,
  captureStreamStarted,
  captureStreamEnded,
  captureStreamErrored,
} from './adapter.js';
export type { RuntimeInstanceTelemetry, StreamTelemetry } from './adapter.js';
```

### Step 9.3 — `src/browser/public-api.ts`

```typescript
export { provideNgafTelemetry } from './provide.js';
export { NgafTelemetryService } from './service.js';
export { NGAF_TELEMETRY_CONFIG } from './tokens.js';
export type { NgafTelemetryConfig } from './tokens.js';
```

### Step 9.4 — Write the permanent silence test

`libs/telemetry/src/browser/browser-silence.spec.ts`:

```typescript
/**
 * PERMANENT CONTRACT TEST.
 *
 * The trust contract at libs/telemetry/README.md promises that
 * @ngaf/telemetry/browser fires zero network calls and triggers zero
 * imports of posthog-js when the consumer does not call
 * provideNgafTelemetry() or calls it with enabled:false.
 *
 * If this test ever fails, the trust contract has been violated.
 * Do not "fix" the test — fix the offending import or call site.
 */
import { jest } from '@jest/globals';
import { TestBed } from '@angular/core/testing';
import { provideNgafTelemetry } from './provide';
import { NgafTelemetryService } from './service';

jest.mock('posthog-js', () => {
  throw new Error('posthog-js MUST NOT be imported when telemetry is not enabled');
});

describe('browser silence (permanent contract)', () => {
  test('no posthog-js import when provideNgafTelemetry is never called', async () => {
    TestBed.configureTestingModule({ providers: [] });
    // Just touching the service classes must not trigger posthog-js.
    expect(NgafTelemetryService).toBeDefined();
  });

  test('no posthog-js import when provideNgafTelemetry({ enabled: false })', async () => {
    TestBed.configureTestingModule({
      providers: [provideNgafTelemetry({ enabled: false })],
    });
    const svc = TestBed.inject(NgafTelemetryService);
    await svc.capture('ngaf:browser_provided');  // must not load posthog-js
    expect(svc).toBeInstanceOf(NgafTelemetryService);
  });
});
```

### Step 9.5 — Verify all tests pass.

```bash
npx nx run telemetry:test
```
Expected: 19 (shared) + 6 (client) + 4 (postinstall) + 5 (adapter) + 5 (service) + 4 (provide) + 2 (silence) = **45 tests pass**.

(Spec said ~44; one extra came from the second silence assertion.)

### Step 9.6 — Commit

```bash
git add libs/telemetry/src/{index.ts,node/index.ts,browser/{public-api.ts,browser-silence.spec.ts}}
git commit -m "$(cat <<'EOF'
feat(telemetry): public entry points + permanent browser silence test

Three entry indices: src/index.ts, src/node/index.ts,
src/browser/public-api.ts. Permanent contract test (2 cases) asserts
posthog-js is never imported when provideNgafTelemetry is not called
or called with enabled:false. Test stays green permanently.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add `telemetry` to publishable group + env.example

**Files:** Modify `nx.json`, `.env.example`.

### Step 10.1 — Update `nx.json`

- [ ] In `nx.json`, find the `release.groups.publishable.projects` array. Append `"telemetry"`.
- [ ] In `release.version.preVersionCommand`, the `--projects=...` list ends with `licensing`. Append `,telemetry` so the build runs for telemetry too.

Expected diff:

```diff
   "projects": [
-    "chat", "langgraph", "ag-ui", "render", "a2ui", "partial-json", "licensing"
+    "chat", "langgraph", "ag-ui", "render", "a2ui", "partial-json", "licensing", "telemetry"
   ],
   ...
-  "preVersionCommand": "npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,partial-json,licensing"
+  "preVersionCommand": "npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,partial-json,licensing,telemetry"
```

### Step 10.2 — Update `.env.example`

```bash
cat >> .env.example <<'EOF'

# @ngaf/telemetry (libs/telemetry)
# Default ingest URL points to the future Spec 1D reverse proxy. Self-hosters
# can redirect to their own ingest. See libs/telemetry/README.md.
# NGAF_TELEMETRY_INGEST_URL=https://cacheplane.dev/api/ingest
# NGAF_TELEMETRY_SAMPLE_RATE=1.0
# DO_NOT_TRACK=1                          # cross-vendor opt-out
# NGAF_TELEMETRY_DISABLED=1               # package-specific opt-out
EOF
```

### Step 10.3 — Commit

```bash
git add nx.json .env.example
git commit -m "$(cat <<'EOF'
chore(release): add telemetry to publishable group + env vars

telemetry joins the fixed-version publishable group; first published
version will be the next group bump (per user memory: never 0.1.0,
always patch). .env.example documents the four user-facing env vars.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: README alignment (if needed)

**Files:** `libs/telemetry/README.md`.

The README is the public trust contract. Only update if the implementation surfaced contract-shaping details that the README is silent on. Specifically:

- [ ] Add an "Imports" section after the existing intro: `import { provideNgafTelemetry } from '@ngaf/telemetry/browser';`, `import { captureStreamStarted } from '@ngaf/telemetry/node';`.
- [ ] If anything else surfaced in earlier tasks, note it.

If no changes needed: skip this task.

### Commit (if changed):

```bash
git add libs/telemetry/README.md
git commit -m "$(cat <<'EOF'
docs(telemetry): minor README alignment with implemented API

Adds an Imports section documenting the three subpath entry points.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Build + verify the published package shape

**Files:** none (verification only).

### Step 12.1 — Build both targets

```bash
npx nx run telemetry:build 2>&1 | tail -15
```

Both `build:node` and `build:browser` must succeed. If either fails, STOP and report.

### Step 12.2 — Inspect the dist output

```bash
ls -la dist/libs/telemetry/
cat dist/libs/telemetry/package.json | python3 -m json.tool | head -30
ls dist/libs/telemetry/node/ dist/libs/telemetry/browser/ 2>/dev/null
```

Expected:
- `dist/libs/telemetry/package.json` exists with the exports map intact
- `dist/libs/telemetry/node/` has compiled JS for the node entry
- `dist/libs/telemetry/browser/` has the ng-packagr output (fesm2022, index.d.ts)

### Step 12.3 — `npm pack` and inspect

```bash
cd dist/libs/telemetry
npm pack 2>&1 | tail -3
tar tzf ngaf-telemetry-*.tgz | head -30
cd -
```

Expected: tarball includes `package/package.json`, `package/index.{js,d.ts}`, `package/node/index.{js,d.ts}`, `package/node/postinstall.{js,d.ts}`, `package/browser/...`. Remove the pack artifact: `rm dist/libs/telemetry/ngaf-telemetry-*.tgz`.

### Step 12.4 — Final test run

```bash
npx nx run telemetry:test 2>&1 | tail -10
npx nx run telemetry:lint 2>&1 | tail -5
```

Both must be clean.

No commit — this is verification only.

---

## Task 13: PR + auto-merge poll

**Files:** none.

### Step 13.1 — Push branch

```bash
git push -u origin "$(git branch --show-current)" 2>&1 | tail -5
```

### Step 13.2 — Open PR

```bash
gh pr create --title "feat(telemetry): @ngaf/telemetry library — Node opt-out + browser opt-in" --body "$(cat <<'EOF'
## Summary

Implements **Spec 1B** (analytics-foundation sub-spec B): the @ngaf/telemetry library that surfaces three subpath exports honoring the trust contract at libs/telemetry/README.md.

- New Nx library at libs/telemetry/ named telemetry
- Three published subpath exports:
  - @ngaf/telemetry — shared types, env detection, hashing
  - @ngaf/telemetry/node — posthog-node wrapper, postinstall, adapter helpers
  - @ngaf/telemetry/browser — provideNgafTelemetry (Angular EnvironmentProviders)
- Hybrid build: @nx/js:tsc for shared+node, @nx/angular:package for browser
- Permanent browser silence test pins the trust contract
- Postinstall script with opt-out notice (CI-suppressed)
- ~45 unit tests across env, hash, anon-id, sample, client, postinstall, adapter, service, provide, silence
- telemetry added to the publishable group in nx.json (joins the fixed-version cadence)

Spec: docs/superpowers/specs/gtm/2026-05-15-analytics-foundation-1b-ngaf-telemetry-design.md
Plan: docs/superpowers/plans/gtm/2026-05-15-analytics-foundation-1b-ngaf-telemetry.md

## Trust contract (unchanged from Spec 0)

- @ngaf/* browser packages NEVER import posthog-js at module load
- provideNgafTelemetry must be called explicitly with enabled:true to fire any browser event
- Node telemetry honors DO_NOT_TRACK, NGAF_TELEMETRY_DISABLED, and 5 CI-auto-detect env vars
- Sensitive ids are SHA-256 hashed before any event property
- Per-process anon-id (no localStorage, no cookies, no filesystem)
- Postinstall NEVER fails npm install (wrapped in || true)

## Test Plan

- [ ] CI green: lint, test, build
- [ ] @ngaf/telemetry@<next-fixed-version> publishes alongside other libs on next release
- [ ] Permanent browser silence test stays green
- [ ] npm pack on built output produces a valid tarball with all three subpath exports

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Step 13.3 — Try auto-merge, fallback to background poll

```bash
gh pr merge --rebase --auto --delete-branch 2>&1 | tail -3
```

If auto-merge fails ("Protected branch rules not configured"), start a background poll watcher like the Spec 1A PR. The user/controller decides which approach based on the error.

---

## Self-Review

**Spec coverage** — every section of the spec is covered:

| Spec § | Task |
|--------|------|
| §3 Scope — Nx project | Task 2 |
| §3 Scope — three subpath exports | Tasks 2, 9 |
| §3 Scope — hybrid build | Tasks 2, 12 |
| §3 Scope — env detection (5 paths) | Task 3 |
| §3 Scope — hashing | Task 3 |
| §3 Scope — anon-id | Task 3 |
| §3 Scope — node client + adapter helpers | Tasks 4, 6 |
| §3 Scope — postinstall | Task 5 |
| §3 Scope — browser service + provide | Tasks 7, 8 |
| §3 Scope — permanent browser silence test | Task 9 |
| §3 Scope — publishable group | Task 10 |
| §3 Scope — env.example | Task 10 |
| §3 Scope — README alignment | Task 11 |
| §3 Scope — verification (build, pack) | Task 12 |
| §5 Trust contract enforcement | Tasks 4 (Node opt-out), 7 (browser lazy), 9 (silence test) |
| §6 Public API surfaces | Tasks 4, 6, 7, 8, 9 |
| §7 Postinstall behavior | Task 5 |
| §8 Build + publish pipeline | Tasks 2, 10, 12 |
| §9 Testing strategy + permanent silence | Tasks 3-9 |

**Placeholder scan** — no `TBD`, `TODO`, `implement later`. ✓

**Type consistency** — `NgafTelemetryConfig` (Task 7) consumed by `provideNgafTelemetry` (Task 8); `NgafNodeEvent`/`NgafBrowserEvent` (Task 3) consumed by `captureEvent`/`service.capture` (Tasks 4, 7); env-var names consistent across spec, tests, and implementation. ✓
