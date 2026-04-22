# License Verification Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@cacheplane/licensing` — a pure-TS library that performs offline Ed25519 license verification, surfaces a grace-period + nag UX, and sends non-blocking anonymous telemetry — then wire it into `@cacheplane/langgraph`, `@cacheplane/render`, and `@cacheplane/chat` so a licensed app initializes silently and an unlicensed app sees a console nudge but still runs.

**Architecture:** `@cacheplane/licensing` is a framework-agnostic TypeScript library (built with `@nx/js:tsc`, same pattern as `libs/a2ui`) that exposes four seams:

1. **`verifyLicense(token, publicKeyBytes, now)`** — pure function that decodes a compact Ed25519-signed license token and returns `{ valid, claims?, reason? }`. No I/O, deterministic, trivially testable with fixtures.
2. **`evaluateLicense(result, now, options?)`** — turns a verification result into a `LicenseStatus` (`licensed | grace | expired | missing | tampered | noncommercial`) based on grace period, env hints, and the package's compile-time public key.
3. **`runLicenseCheck(options)`** — init-time side-effect orchestrator: runs `verifyLicense` + `evaluateLicense`, emits the nag UX (`console.warn` with a stable prefix), and kicks off the telemetry client. Idempotent per `(packageName, token)` so the three Angular libraries can each call it without triple-logging.
4. **`createTelemetryClient(options)`** — non-blocking `fetch` POST to the telemetry endpoint with `{ license_id, version, anon_instance_id, package }`. Fire-and-forget, opts out on `CACHEPLANE_TELEMETRY=0` / `globalThis.CACHEPLANE_TELEMETRY === false`, silent on any failure.

Each Angular library receives an optional `license` field on its existing config (`AgentConfig`, `RenderConfig`, `ChatConfig`). `provideAgent` / `provideRender` / `provideChat` call `runLicenseCheck` exactly once per package per app at provider-construction time. The package's Ed25519 **public key** is embedded as a compile-time constant via a generated `license-public-key.generated.ts` file that is produced by a `prebuild` step and `.gitignore`d. For local development the generator falls back to a committed dev key fixture so library builds never fail on a fresh clone. The release infrastructure plan already reserved a "public-key embedding at build time" task for the production key-injection story; this plan ships the mechanism and leaves key management to that plan.

**Tech Stack:** TypeScript 5.9 (strict), `@noble/ed25519` for signature verification (small, audited, browser+node), Vitest for unit tests, Nx 22 with `@nx/js:tsc` executor, Angular 21 injection patterns for the three wrapper libraries.

---

## File Structure

**New library** — `libs/licensing/`:

- `libs/licensing/package.json` — name `@cacheplane/licensing`, version `0.0.1`, `sideEffects: false`, `publishConfig` with `provenance: true`
- `libs/licensing/project.json` — Nx project (`@nx/js:tsc` build, `@nx/vite:test`, lint)
- `libs/licensing/tsconfig.json`, `tsconfig.lib.json` — mirror `libs/a2ui`
- `libs/licensing/vite.config.mts` — same pattern as `libs/a2ui`
- `libs/licensing/README.md` — short overview + usage
- `libs/licensing/src/index.ts` — public API barrel
- `libs/licensing/src/lib/license-token.ts` — `LicenseClaims` type, `parseLicenseToken`
- `libs/licensing/src/lib/license-token.spec.ts` — parsing tests
- `libs/licensing/src/lib/verify-license.ts` — `verifyLicense`, `VerifyResult`
- `libs/licensing/src/lib/verify-license.spec.ts` — signature tests (valid / tampered / bad format)
- `libs/licensing/src/lib/evaluate-license.ts` — `evaluateLicense`, `LicenseStatus`
- `libs/licensing/src/lib/evaluate-license.spec.ts` — grace / expired / noncommercial tests
- `libs/licensing/src/lib/nag.ts` — `emitNag`, dedupe cache
- `libs/licensing/src/lib/nag.spec.ts` — emission + dedupe tests
- `libs/licensing/src/lib/telemetry.ts` — `createTelemetryClient`, opt-out parsing
- `libs/licensing/src/lib/telemetry.spec.ts` — opt-out + non-blocking behavior
- `libs/licensing/src/lib/run-license-check.ts` — `runLicenseCheck` orchestrator
- `libs/licensing/src/lib/run-license-check.spec.ts` — full integration test
- `libs/licensing/src/lib/license-public-key.ts` — stable re-export of generated key (Task 9)
- `libs/licensing/src/lib/license-public-key.generated.ts` — **gitignored**, produced by prebuild script
- `libs/licensing/src/lib/testing/keypair.ts` — dev/test utilities: `generateKeyPair`, `signLicense`
- `libs/licensing/src/lib/testing/fixtures.ts` — seeded fixture claims (valid, expired, noncommercial)
- `libs/licensing/scripts/generate-public-key.mjs` — prebuild: reads env `CACHEPLANE_LICENSE_PUBLIC_KEY` or falls back to committed dev key
- `libs/licensing/fixtures/dev-public-key.hex` — committed 32-byte hex public key for local dev

**Modified Angular libraries** — integrate license check into providers:

- `libs/langgraph/src/lib/agent.provider.ts` — add `license?: string` to `AgentConfig`; call `runLicenseCheck` inside `provideAgent`
- `libs/langgraph/src/lib/agent.provider.spec.ts` — tests that config is still honored and license check is invoked
- `libs/render/src/lib/provide-render.ts` — add `license?: string` to `RenderConfig`; call `runLicenseCheck`
- `libs/render/src/lib/render.types.ts` — add `license?: string` on `RenderConfig`
- `libs/render/src/lib/provide-render.spec.ts` — **create**; license check wired
- `libs/chat/src/lib/provide-chat.ts` — add `license?: string` to `ChatConfig`; call `runLicenseCheck`
- `libs/chat/src/lib/provide-chat.spec.ts` — **create**; license check wired

**Workspace** — wiring:

- `tsconfig.base.json` — add `"@cacheplane/licensing": ["libs/licensing/src/index.ts"]` path alias
- `libs/langgraph/package.json` — add `@cacheplane/licensing` to `peerDependencies` with `^0.0.1`
- `libs/render/package.json` — add `@cacheplane/licensing` to `peerDependencies` with `^0.0.1`
- `libs/chat/package.json` — add `@cacheplane/licensing` to `peerDependencies` with `^0.0.1`
- `package.json` — add `@noble/ed25519` to root `dependencies`
- `.gitignore` — add `libs/licensing/src/lib/license-public-key.generated.ts`
- `docs/superpowers/specs/2026-04-17-v1-roadmap-design.md` — no changes (spec already covers this scope)

**Notes on scope boundaries:**

- This plan **does not** ship the production public key. The generator consumes `CACHEPLANE_LICENSE_PUBLIC_KEY` at build time and a dev fixture otherwise; wiring the release pipeline to inject the real key is tracked in the release infrastructure plan (task "public key embedding at build time").
- This plan **does not** ship the minting service (Plan 2) or Stripe integration (Plan 3).
- This plan **does not** change cockpit or example apps — they pick up the new peer dep transitively but don't need code changes.

---

## Task 1: Scaffold `libs/licensing/` project

**Files:**
- Create: `libs/licensing/package.json`
- Create: `libs/licensing/project.json`
- Create: `libs/licensing/tsconfig.json`
- Create: `libs/licensing/tsconfig.lib.json`
- Create: `libs/licensing/vite.config.mts`
- Create: `libs/licensing/src/index.ts`
- Modify: `tsconfig.base.json` (add path alias)
- Modify: `package.json` (add `@noble/ed25519` dependency)

- [ ] **Step 1: Write `libs/licensing/package.json`**

```json
{
  "name": "@cacheplane/licensing",
  "version": "0.0.1",
  "license": "PolyForm-Noncommercial-1.0.0",
  "sideEffects": false,
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "peerDependencies": {
    "@noble/ed25519": "^2.2.3"
  }
}
```

- [ ] **Step 2: Write `libs/licensing/project.json`**

```json
{
  "name": "licensing",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/licensing/src",
  "projectType": "library",
  "tags": ["scope:shared", "type:lib"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/libs/licensing"],
      "options": {
        "outputPath": "dist/libs/licensing",
        "main": "libs/licensing/src/index.ts",
        "tsConfig": "libs/licensing/tsconfig.lib.json"
      }
    },
    "lint": { "executor": "@nx/eslint:lint" },
    "test": {
      "executor": "@nx/vite:test",
      "options": { "configFile": "libs/licensing/vite.config.mts" }
    }
  }
}
```

- [ ] **Step 3: Write `libs/licensing/tsconfig.json` and `tsconfig.lib.json`**

`libs/licensing/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

`libs/licensing/tsconfig.lib.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "../../dist/out-tsc", "declaration": true },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "src/lib/testing/**"]
}
```

- [ ] **Step 4: Write `libs/licensing/vite.config.mts`**

```ts
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  plugins: [nxViteTsPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    passWithNoTests: true,
  },
});
```

- [ ] **Step 5: Write placeholder `libs/licensing/src/index.ts`**

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public API — filled in by later tasks.
export {};
```

- [ ] **Step 6: Add path alias in `tsconfig.base.json`**

Insert one entry into the `paths` object (keep file otherwise unchanged):

```json
"@cacheplane/licensing": ["libs/licensing/src/index.ts"],
```

- [ ] **Step 7: Add `@noble/ed25519` to root `package.json` dependencies**

Run:
```bash
npm install @noble/ed25519@^2.2.3
```
Expected: installs without peer dep warnings.

- [ ] **Step 8: Verify Nx can see the project**

Run: `npx nx show project licensing`
Expected: JSON output listing `build`, `lint`, `test` targets.

- [ ] **Step 9: Verify build succeeds**

Run: `npx nx build licensing`
Expected: `dist/libs/licensing/` contains `index.js` and `index.d.ts` (empty module is fine).

- [ ] **Step 10: Commit**

```bash
git add libs/licensing tsconfig.base.json package.json package-lock.json
git commit -m "feat(licensing): scaffold @cacheplane/licensing library"
```

---

## Task 2: License token schema and parser

**Files:**
- Create: `libs/licensing/src/lib/license-token.ts`
- Test: `libs/licensing/src/lib/license-token.spec.ts`

- [ ] **Step 1: Write the failing tests**

`libs/licensing/src/lib/license-token.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { parseLicenseToken } from './license-token';

const CLAIMS = {
  sub: 'cus_123',
  tier: 'developer-seat',
  iat: 1_700_000_000,
  exp: 1_800_000_000,
  seats: 5,
};

function b64url(bytes: Uint8Array | string): string {
  const input = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  // Node's Buffer is available in vitest `environment: 'node'`.
  return Buffer.from(input).toString('base64url');
}

describe('parseLicenseToken', () => {
  it('splits a valid token into claims + signature bytes', () => {
    const payloadJson = JSON.stringify(CLAIMS);
    const signatureBytes = new Uint8Array(64).fill(7);
    const token = `${b64url(payloadJson)}.${b64url(signatureBytes)}`;

    const result = parseLicenseToken(token);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.claims).toEqual(CLAIMS);
    expect(result.signature).toEqual(signatureBytes);
    expect(result.signedMessage).toEqual(new TextEncoder().encode(payloadJson));
  });

  it('rejects a token with wrong number of segments', () => {
    const result = parseLicenseToken('only-one-segment');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.reason).toBe('malformed');
  });

  it('rejects a token with non-JSON payload', () => {
    const token = `${b64url('not-json')}.${b64url(new Uint8Array(64))}`;
    const result = parseLicenseToken(token);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.reason).toBe('malformed');
  });

  it('rejects a token missing required claims', () => {
    const payload = JSON.stringify({ sub: 'cus_123' });
    const token = `${b64url(payload)}.${b64url(new Uint8Array(64))}`;
    const result = parseLicenseToken(token);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.reason).toBe('malformed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test licensing`
Expected: FAIL — `parseLicenseToken is not a function`.

- [ ] **Step 3: Implement the parser**

`libs/licensing/src/lib/license-token.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/** The tier a license grants. */
export type LicenseTier = 'developer-seat' | 'app-deployment' | 'enterprise';

/** Claims carried inside a signed license token. */
export interface LicenseClaims {
  /** Customer id (Stripe customer). */
  sub: string;
  /** Tier the license grants. */
  tier: LicenseTier;
  /** Issued-at, epoch seconds. */
  iat: number;
  /** Expires-at, epoch seconds. */
  exp: number;
  /** Seat count (>=1). */
  seats: number;
}

export type ParseLicenseTokenResult =
  | {
      ok: true;
      claims: LicenseClaims;
      /** Raw bytes that were signed (UTF-8 of the payload segment). */
      signedMessage: Uint8Array;
      signature: Uint8Array;
    }
  | { ok: false; reason: 'malformed' };

function base64UrlToBytes(s: string): Uint8Array | null {
  try {
    // base64url -> base64
    const pad = '='.repeat((4 - (s.length % 4)) % 4);
    const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  } catch {
    return null;
  }
}

function isLicenseClaims(value: unknown): value is LicenseClaims {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sub === 'string' &&
    (v.tier === 'developer-seat' ||
      v.tier === 'app-deployment' ||
      v.tier === 'enterprise') &&
    typeof v.iat === 'number' &&
    typeof v.exp === 'number' &&
    typeof v.seats === 'number' &&
    v.seats >= 1
  );
}

/**
 * Parse a compact license token of the form `<base64url(payload-json)>.<base64url(ed25519-sig)>`.
 * Does NOT verify the signature — see {@link verifyLicense}.
 */
export function parseLicenseToken(token: string): ParseLicenseTokenResult {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [payloadSeg, signatureSeg] = parts;

  const payloadBytes = base64UrlToBytes(payloadSeg);
  const signature = base64UrlToBytes(signatureSeg);
  if (!payloadBytes || !signature) return { ok: false, reason: 'malformed' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (!isLicenseClaims(parsed)) return { ok: false, reason: 'malformed' };

  return { ok: true, claims: parsed, signedMessage: payloadBytes, signature };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test licensing`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add libs/licensing/src/lib/license-token.ts libs/licensing/src/lib/license-token.spec.ts
git commit -m "feat(licensing): add license token schema and parser"
```

---

## Task 3: Ed25519 signature verification

**Files:**
- Create: `libs/licensing/src/lib/testing/keypair.ts`
- Create: `libs/licensing/src/lib/verify-license.ts`
- Test: `libs/licensing/src/lib/verify-license.spec.ts`

- [ ] **Step 1: Write the test-only keypair helper (not exported from public API)**

`libs/licensing/src/lib/testing/keypair.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TEST-ONLY utility: do not export from the package's public index.
import * as ed from '@noble/ed25519';
import type { LicenseClaims } from '../license-token';

export interface DevKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export async function generateKeyPair(): Promise<DevKeyPair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { publicKey, privateKey };
}

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Sign claims with the given private key and return a compact token
 * `<b64url(payload)>.<b64url(sig)>`. Used by tests and by the
 * dev-fixture generator; NOT used at runtime by the package.
 */
export async function signLicense(
  claims: LicenseClaims,
  privateKey: Uint8Array,
): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify(claims));
  const sig = await ed.signAsync(payload, privateKey);
  return `${b64url(payload)}.${b64url(sig)}`;
}
```

- [ ] **Step 2: Write the failing tests**

`libs/licensing/src/lib/verify-license.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeAll, describe, it, expect } from 'vitest';
import { verifyLicense } from './verify-license';
import { generateKeyPair, signLicense, type DevKeyPair } from './testing/keypair';
import type { LicenseClaims } from './license-token';

const BASE_CLAIMS: LicenseClaims = {
  sub: 'cus_123',
  tier: 'developer-seat',
  iat: 1_700_000_000,
  exp: 1_800_000_000,
  seats: 5,
};

describe('verifyLicense', () => {
  let kp: DevKeyPair;
  let otherKp: DevKeyPair;
  let validToken: string;

  beforeAll(async () => {
    kp = await generateKeyPair();
    otherKp = await generateKeyPair();
    validToken = await signLicense(BASE_CLAIMS, kp.privateKey);
  });

  it('accepts a valid token signed with the matching key', async () => {
    const result = await verifyLicense(validToken, kp.publicKey);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.claims).toEqual(BASE_CLAIMS);
  });

  it('rejects a token signed with a different key as tampered', async () => {
    const badToken = await signLicense(BASE_CLAIMS, otherKp.privateKey);
    const result = await verifyLicense(badToken, kp.publicKey);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.reason).toBe('tampered');
  });

  it('rejects a token whose payload has been mutated as tampered', async () => {
    const [payload, sig] = validToken.split('.');
    // Flip one byte of the payload to invalidate the signature while
    // keeping the shape valid.
    const mutated = Buffer.from(payload + 'A', 'base64url');
    const tamperedToken = `${Buffer.from(mutated).toString('base64url')}.${sig}`;
    const result = await verifyLicense(tamperedToken, kp.publicKey);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    // Could either fail as malformed (JSON parse) or tampered (sig check).
    expect(['malformed', 'tampered']).toContain(result.reason);
  });

  it('rejects a malformed token', async () => {
    const result = await verifyLicense('not-a-token', kp.publicKey);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.reason).toBe('malformed');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx nx test licensing`
Expected: FAIL — `verifyLicense is not a function`.

- [ ] **Step 4: Implement `verifyLicense`**

`libs/licensing/src/lib/verify-license.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as ed from '@noble/ed25519';
import { parseLicenseToken, type LicenseClaims } from './license-token';

export type VerifyReason = 'malformed' | 'tampered';

export type VerifyResult =
  | { ok: true; claims: LicenseClaims }
  | { ok: false; reason: VerifyReason };

/**
 * Offline-verify a license token against a raw Ed25519 public key.
 * No network calls, no time-based checks — see {@link evaluateLicense}
 * for grace-period / expiry logic.
 */
export async function verifyLicense(
  token: string,
  publicKey: Uint8Array,
): Promise<VerifyResult> {
  const parsed = parseLicenseToken(token);
  if (!parsed.ok) return { ok: false, reason: 'malformed' };

  let valid = false;
  try {
    valid = await ed.verifyAsync(parsed.signature, parsed.signedMessage, publicKey);
  } catch {
    valid = false;
  }

  if (!valid) return { ok: false, reason: 'tampered' };
  return { ok: true, claims: parsed.claims };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test licensing`
Expected: PASS, 8/8 total across the two spec files.

- [ ] **Step 6: Commit**

```bash
git add libs/licensing/src/lib/verify-license.ts libs/licensing/src/lib/verify-license.spec.ts libs/licensing/src/lib/testing/keypair.ts
git commit -m "feat(licensing): add offline ed25519 license verification"
```

---

## Task 4: `evaluateLicense` — grace period, status, and noncommercial hint

**Files:**
- Create: `libs/licensing/src/lib/evaluate-license.ts`
- Test: `libs/licensing/src/lib/evaluate-license.spec.ts`

- [ ] **Step 1: Write the failing tests**

`libs/licensing/src/lib/evaluate-license.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { evaluateLicense } from './evaluate-license';
import type { LicenseClaims } from './license-token';

const CLAIMS: LicenseClaims = {
  sub: 'cus_123',
  tier: 'developer-seat',
  iat: 1_700_000_000,
  exp: 2_000_000_000, // far future
  seats: 5,
};

const DAY = 86_400;

describe('evaluateLicense', () => {
  it('returns licensed when verify ok and not expired', () => {
    const result = evaluateLicense(
      { ok: true, claims: CLAIMS },
      { nowSec: 1_900_000_000 },
    );
    expect(result.status).toBe('licensed');
    expect(result.claims).toEqual(CLAIMS);
  });

  it('returns grace within 14 days after expiry', () => {
    const expired = { ...CLAIMS, exp: 1_900_000_000 };
    const result = evaluateLicense(
      { ok: true, claims: expired },
      { nowSec: 1_900_000_000 + 10 * DAY },
    );
    expect(result.status).toBe('grace');
    expect(result.claims).toEqual(expired);
  });

  it('returns expired past the 14 day grace window', () => {
    const expired = { ...CLAIMS, exp: 1_900_000_000 };
    const result = evaluateLicense(
      { ok: true, claims: expired },
      { nowSec: 1_900_000_000 + 15 * DAY },
    );
    expect(result.status).toBe('expired');
  });

  it('returns tampered when verify failed with bad signature', () => {
    const result = evaluateLicense(
      { ok: false, reason: 'tampered' },
      { nowSec: 1_900_000_000 },
    );
    expect(result.status).toBe('tampered');
  });

  it('returns missing when no token was supplied', () => {
    const result = evaluateLicense(undefined, { nowSec: 1_900_000_000 });
    expect(result.status).toBe('missing');
  });

  it('returns noncommercial when no token and dev env is hinted', () => {
    const result = evaluateLicense(undefined, {
      nowSec: 1_900_000_000,
      isNoncommercial: true,
    });
    expect(result.status).toBe('noncommercial');
  });

  it('still returns licensed in noncommercial env when a valid token is present', () => {
    const result = evaluateLicense(
      { ok: true, claims: CLAIMS },
      { nowSec: 1_900_000_000, isNoncommercial: true },
    );
    expect(result.status).toBe('licensed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test licensing`
Expected: FAIL — `evaluateLicense is not a function`.

- [ ] **Step 3: Implement `evaluateLicense`**

`libs/licensing/src/lib/evaluate-license.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { LicenseClaims } from './license-token';
import type { VerifyResult } from './verify-license';

export type LicenseStatus =
  | 'licensed'       // valid signed token, not expired
  | 'grace'          // valid signed token, expired but within grace window
  | 'expired'        // valid signed token, past grace window
  | 'missing'        // no token and not noncommercial
  | 'tampered'       // token present, failed signature or malformed
  | 'noncommercial'; // no token, env looks noncommercial

export interface EvaluateOptions {
  /** Current time in epoch seconds. Injected for testability. */
  nowSec: number;
  /** Grace window in seconds after `exp`. Defaults to 14 days. */
  graceSec?: number;
  /** If true, missing token resolves to `noncommercial` instead of `missing`. */
  isNoncommercial?: boolean;
}

export interface EvaluateResult {
  status: LicenseStatus;
  /** Populated when the token was valid (licensed / grace / expired). */
  claims?: LicenseClaims;
}

const FOURTEEN_DAYS_SEC = 14 * 24 * 60 * 60;

export function evaluateLicense(
  verifyResult: VerifyResult | undefined,
  options: EvaluateOptions,
): EvaluateResult {
  const grace = options.graceSec ?? FOURTEEN_DAYS_SEC;

  if (!verifyResult) {
    return { status: options.isNoncommercial ? 'noncommercial' : 'missing' };
  }

  if (!verifyResult.ok) {
    return { status: 'tampered' };
  }

  const { claims } = verifyResult;
  if (options.nowSec <= claims.exp) return { status: 'licensed', claims };
  if (options.nowSec <= claims.exp + grace) return { status: 'grace', claims };
  return { status: 'expired', claims };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test licensing`
Expected: PASS, 15/15 total across all spec files.

- [ ] **Step 5: Commit**

```bash
git add libs/licensing/src/lib/evaluate-license.ts libs/licensing/src/lib/evaluate-license.spec.ts
git commit -m "feat(licensing): add license status evaluation with grace window"
```

---

## Task 5: Nag UX with per-package dedupe

**Files:**
- Create: `libs/licensing/src/lib/nag.ts`
- Test: `libs/licensing/src/lib/nag.spec.ts`

- [ ] **Step 1: Write the failing tests**

`libs/licensing/src/lib/nag.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { emitNag, __resetNagStateForTests } from './nag';

describe('emitNag', () => {
  const warn = vi.fn();

  beforeEach(() => {
    warn.mockClear();
    __resetNagStateForTests();
  });
  afterEach(() => {
    __resetNagStateForTests();
  });

  it('is silent when status is licensed', () => {
    emitNag({ status: 'licensed' }, { package: '@cacheplane/langgraph', warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('is silent when status is noncommercial', () => {
    emitNag({ status: 'noncommercial' }, { package: '@cacheplane/langgraph', warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns with a stable prefix when status is missing', () => {
    emitNag({ status: 'missing' }, { package: '@cacheplane/langgraph', warn });
    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0][0] as string;
    expect(message).toContain('[cacheplane]');
    expect(message).toContain('@cacheplane/langgraph');
    expect(message).toContain('cacheplane.dev/pricing');
  });

  it('warns differently for grace / expired / tampered', () => {
    emitNag({ status: 'grace' }, { package: '@cacheplane/langgraph', warn });
    emitNag({ status: 'expired' }, { package: '@cacheplane/render', warn });
    emitNag({ status: 'tampered' }, { package: '@cacheplane/chat', warn });
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls[0][0]).toMatch(/grace/i);
    expect(warn.mock.calls[1][0]).toMatch(/expired/i);
    expect(warn.mock.calls[2][0]).toMatch(/tampered|invalid/i);
  });

  it('dedupes repeated calls for the same package + status', () => {
    emitNag({ status: 'missing' }, { package: '@cacheplane/langgraph', warn });
    emitNag({ status: 'missing' }, { package: '@cacheplane/langgraph', warn });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe across different packages', () => {
    emitNag({ status: 'missing' }, { package: '@cacheplane/langgraph', warn });
    emitNag({ status: 'missing' }, { package: '@cacheplane/render', warn });
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test licensing`
Expected: FAIL — `emitNag is not a function`.

- [ ] **Step 3: Implement `emitNag`**

`libs/licensing/src/lib/nag.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { EvaluateResult } from './evaluate-license';

export interface EmitNagOptions {
  /** Fully-qualified npm package name, e.g. "@cacheplane/langgraph". */
  package: string;
  /** Injected warn channel; defaults to `console.warn`. */
  warn?: (message: string) => void;
}

const seen = new Set<string>();

const MESSAGES: Record<string, string> = {
  missing:
    'no license key detected. The library will keep running, but please get a license at https://cacheplane.dev/pricing',
  grace:
    'license is expired and within the 14-day grace window. Renew at https://cacheplane.dev/pricing',
  expired:
    'license is expired. The library will keep running, but please renew at https://cacheplane.dev/pricing',
  tampered:
    'license signature is invalid or malformed. Download a fresh key from https://cacheplane.dev/pricing',
};

export function emitNag(
  result: Pick<EvaluateResult, 'status'>,
  options: EmitNagOptions,
): void {
  const warn = options.warn ?? ((m: string) => console.warn(m));
  const { status } = result;
  if (status === 'licensed' || status === 'noncommercial') return;

  const key = `${options.package}|${status}`;
  if (seen.has(key)) return;
  seen.add(key);

  const body = MESSAGES[status] ?? 'license check failed.';
  warn(`[cacheplane] ${options.package}: ${body}`);
}

/** @internal testing hook only. */
export function __resetNagStateForTests(): void {
  seen.clear();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test licensing`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/licensing/src/lib/nag.ts libs/licensing/src/lib/nag.spec.ts
git commit -m "feat(licensing): add nag UX with per-package dedupe"
```

---

## Task 6: Non-blocking telemetry client with opt-out

**Files:**
- Create: `libs/licensing/src/lib/telemetry.ts`
- Test: `libs/licensing/src/lib/telemetry.spec.ts`

- [ ] **Step 1: Write the failing tests**

`libs/licensing/src/lib/telemetry.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { createTelemetryClient } from './telemetry';

describe('createTelemetryClient', () => {
  const origEnv = { ...process.env };
  const origGlobal = (globalThis as Record<string, unknown>).CACHEPLANE_TELEMETRY;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.CACHEPLANE_TELEMETRY;
    delete (globalThis as Record<string, unknown>).CACHEPLANE_TELEMETRY;
  });

  afterEach(() => {
    process.env = origEnv;
    (globalThis as Record<string, unknown>).CACHEPLANE_TELEMETRY = origGlobal;
  });

  it('posts a payload to the endpoint with a generated anon_instance_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createTelemetryClient({
      endpoint: 'https://telemetry.example.com/v1/ping',
      fetch: fetchMock,
    });

    await client.send({
      package: '@cacheplane/langgraph',
      version: '1.0.0',
      licenseId: 'cus_123',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://telemetry.example.com/v1/ping');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.package).toBe('@cacheplane/langgraph');
    expect(body.version).toBe('1.0.0');
    expect(body.license_id).toBe('cus_123');
    expect(typeof body.anon_instance_id).toBe('string');
    expect(body.anon_instance_id.length).toBeGreaterThan(0);
  });

  it('reuses the same anon_instance_id across calls from the same client', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createTelemetryClient({
      endpoint: 'https://telemetry.example.com/v1/ping',
      fetch: fetchMock,
    });
    await client.send({ package: '@cacheplane/langgraph', version: '1.0.0' });
    await client.send({ package: '@cacheplane/langgraph', version: '1.0.0' });

    const id1 = JSON.parse(fetchMock.mock.calls[0][1].body as string).anon_instance_id;
    const id2 = JSON.parse(fetchMock.mock.calls[1][1].body as string).anon_instance_id;
    expect(id1).toBe(id2);
  });

  it('is a no-op when CACHEPLANE_TELEMETRY=0 env is set', async () => {
    process.env.CACHEPLANE_TELEMETRY = '0';
    const fetchMock = vi.fn();
    const client = createTelemetryClient({
      endpoint: 'https://telemetry.example.com/v1/ping',
      fetch: fetchMock,
    });
    await client.send({ package: '@cacheplane/langgraph', version: '1.0.0' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is a no-op when globalThis.CACHEPLANE_TELEMETRY === false', async () => {
    (globalThis as Record<string, unknown>).CACHEPLANE_TELEMETRY = false;
    const fetchMock = vi.fn();
    const client = createTelemetryClient({
      endpoint: 'https://telemetry.example.com/v1/ping',
      fetch: fetchMock,
    });
    await client.send({ package: '@cacheplane/langgraph', version: '1.0.0' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws when fetch rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    const client = createTelemetryClient({
      endpoint: 'https://telemetry.example.com/v1/ping',
      fetch: fetchMock,
    });
    await expect(
      client.send({ package: '@cacheplane/langgraph', version: '1.0.0' }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test licensing`
Expected: FAIL — `createTelemetryClient is not a function`.

- [ ] **Step 3: Implement the telemetry client**

`libs/licensing/src/lib/telemetry.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export interface TelemetryEvent {
  package: string;
  version: string;
  licenseId?: string;
}

export interface TelemetryClient {
  send(event: TelemetryEvent): Promise<void>;
}

export interface CreateTelemetryClientOptions {
  endpoint: string;
  /** Injected for testability. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Injected for testability. Defaults to `crypto.randomUUID()`. */
  generateInstanceId?: () => string;
}

function isOptedOut(): boolean {
  const envFlag =
    typeof process !== 'undefined' && process.env
      ? process.env.CACHEPLANE_TELEMETRY
      : undefined;
  if (envFlag === '0' || envFlag === 'false') return true;
  const g = (globalThis as Record<string, unknown>).CACHEPLANE_TELEMETRY;
  if (g === false || g === 0 || g === '0') return true;
  return false;
}

function defaultInstanceId(): string {
  // `crypto.randomUUID` is available in Node 19+, modern browsers,
  // and all edge runtimes we target.
  return crypto.randomUUID();
}

export function createTelemetryClient(
  options: CreateTelemetryClientOptions,
): TelemetryClient {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const makeId = options.generateInstanceId ?? defaultInstanceId;
  const anonInstanceId = makeId();

  return {
    async send(event: TelemetryEvent): Promise<void> {
      if (isOptedOut()) return;
      if (!fetchImpl) return;

      const body = JSON.stringify({
        package: event.package,
        version: event.version,
        license_id: event.licenseId,
        anon_instance_id: anonInstanceId,
        ts: Math.floor(Date.now() / 1000),
      });

      try {
        await fetchImpl(options.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          // `keepalive` helps in browser unload paths; harmless elsewhere.
          keepalive: true,
        });
      } catch {
        // Never block the host app on telemetry failure.
      }
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test licensing`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/licensing/src/lib/telemetry.ts libs/licensing/src/lib/telemetry.spec.ts
git commit -m "feat(licensing): add non-blocking telemetry client with opt-out"
```

---

## Task 7: Public key embedding mechanism

**Files:**
- Create: `libs/licensing/fixtures/dev-public-key.hex`
- Create: `libs/licensing/scripts/generate-public-key.mjs`
- Create: `libs/licensing/src/lib/license-public-key.ts`
- Modify: `libs/licensing/project.json` (add `prebuild` target)
- Modify: `.gitignore` (ignore generated key)

- [ ] **Step 1: Generate and commit a dev-only public key fixture**

Create a dev keypair once (output only the public key into the repo; discard the private key — nothing in this repo should ever sign with it):

```bash
node -e "import('@noble/ed25519').then(async ed => { const sk = ed.utils.randomPrivateKey(); const pk = await ed.getPublicKeyAsync(sk); const hex = Buffer.from(pk).toString('hex'); process.stdout.write(hex); })" > libs/licensing/fixtures/dev-public-key.hex
```

Expected: writes a 64-char hex string (no trailing newline) into `libs/licensing/fixtures/dev-public-key.hex`.

- [ ] **Step 2: Write the generator script**

`libs/licensing/scripts/generate-public-key.mjs`:

```js
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Emits libs/licensing/src/lib/license-public-key.generated.ts with
// the Ed25519 public key to use at runtime.
//
// Priority:
//   1. env CACHEPLANE_LICENSE_PUBLIC_KEY (hex or base64) — used in release builds
//   2. libs/licensing/fixtures/dev-public-key.hex — used in local dev
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_SRC = resolve(__dirname, '../src/lib');
const OUT = resolve(LIB_SRC, 'license-public-key.generated.ts');
const FIXTURE = resolve(__dirname, '../fixtures/dev-public-key.hex');

function parseKey(raw) {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed)) {
    if (trimmed.length !== 64) {
      throw new Error(`expected 32-byte hex (64 chars), got ${trimmed.length}`);
    }
    return Buffer.from(trimmed, 'hex');
  }
  // Otherwise try base64 / base64url.
  const b64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length !== 32) {
    throw new Error(`expected 32-byte base64 key, got ${buf.length}`);
  }
  return buf;
}

const source =
  process.env.CACHEPLANE_LICENSE_PUBLIC_KEY
    ? { raw: process.env.CACHEPLANE_LICENSE_PUBLIC_KEY, origin: 'env' }
    : { raw: readFileSync(FIXTURE, 'utf8'), origin: 'dev-fixture' };

const keyBytes = parseKey(source.raw);
const hex = Buffer.from(keyBytes).toString('hex');

mkdirSync(LIB_SRC, { recursive: true });
writeFileSync(
  OUT,
  `// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AUTOGENERATED by libs/licensing/scripts/generate-public-key.mjs — do not edit.
// Source: ${source.origin}
export const LICENSE_PUBLIC_KEY_HEX = '${hex}' as const;
`,
);
console.log(`[licensing] wrote ${OUT} (source: ${source.origin})`);
```

- [ ] **Step 3: Write the stable re-export**

`libs/licensing/src/lib/license-public-key.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { LICENSE_PUBLIC_KEY_HEX } from './license-public-key.generated';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Ed25519 public key baked into this build of `@cacheplane/licensing`. */
export const LICENSE_PUBLIC_KEY: Uint8Array = hexToBytes(LICENSE_PUBLIC_KEY_HEX);
```

- [ ] **Step 4: Add the prebuild step to `libs/licensing/project.json`**

Replace the existing `build` and `test` target blocks so every consumer path runs the generator first:

```json
    "prebuild": {
      "executor": "nx:run-commands",
      "options": {
        "command": "node libs/licensing/scripts/generate-public-key.mjs"
      }
    },
    "build": {
      "executor": "@nx/js:tsc",
      "dependsOn": ["prebuild"],
      "outputs": ["{workspaceRoot}/dist/libs/licensing"],
      "options": {
        "outputPath": "dist/libs/licensing",
        "main": "libs/licensing/src/index.ts",
        "tsConfig": "libs/licensing/tsconfig.lib.json"
      }
    },
    "lint": { "executor": "@nx/eslint:lint" },
    "test": {
      "executor": "@nx/vite:test",
      "dependsOn": ["prebuild"],
      "options": { "configFile": "libs/licensing/vite.config.mts" }
    }
```

- [ ] **Step 5: Ignore the generated file**

Append a single line to the root `.gitignore` after the `.angular` block:

```
# Generated license public key (produced by libs/licensing/scripts/generate-public-key.mjs)
libs/licensing/src/lib/license-public-key.generated.ts
```

- [ ] **Step 6: Wire the generator into root postinstall so consumer libraries can import from `@cacheplane/licensing` on a fresh clone**

Edit the root `package.json` `scripts` block, adding:

```json
    "postinstall": "node libs/licensing/scripts/generate-public-key.mjs"
```

(If a `postinstall` already exists, chain with `&&`.)

- [ ] **Step 7: Generate once locally and verify build**

Run:
```bash
node libs/licensing/scripts/generate-public-key.mjs
npx nx build licensing
```
Expected: generator logs `(source: dev-fixture)`; build succeeds; `dist/libs/licensing/lib/license-public-key.d.ts` exists.

- [ ] **Step 8: Confirm prebuild chains on a clean generated file**

Run:
```bash
rm libs/licensing/src/lib/license-public-key.generated.ts
npx nx build licensing --skip-nx-cache
```
Expected: build still succeeds; Nx runs the prebuild target first and emits the generated file.

- [ ] **Step 9: Commit**

```bash
git add libs/licensing/fixtures libs/licensing/scripts libs/licensing/src/lib/license-public-key.ts libs/licensing/project.json .gitignore package.json
git commit -m "feat(licensing): embed ed25519 public key at build time"
```

---

## Task 8: `runLicenseCheck` orchestrator + public API

**Files:**
- Create: `libs/licensing/src/lib/run-license-check.ts`
- Test: `libs/licensing/src/lib/run-license-check.spec.ts`
- Modify: `libs/licensing/src/index.ts`

- [ ] **Step 1: Write the failing tests**

`libs/licensing/src/lib/run-license-check.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { runLicenseCheck, __resetRunLicenseCheckStateForTests } from './run-license-check';
import { __resetNagStateForTests } from './nag';
import { generateKeyPair, signLicense, type DevKeyPair } from './testing/keypair';
import type { LicenseClaims } from './license-token';

const BASE: LicenseClaims = {
  sub: 'cus_abc',
  tier: 'developer-seat',
  iat: 1_700_000_000,
  exp: 2_000_000_000,
  seats: 1,
};

describe('runLicenseCheck', () => {
  let kp: DevKeyPair;
  let validToken: string;
  let warn: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    kp = await generateKeyPair();
    validToken = await signLicense(BASE, kp.privateKey);
    warn = vi.fn();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    __resetNagStateForTests();
    __resetRunLicenseCheckStateForTests();
  });
  afterEach(() => {
    __resetNagStateForTests();
    __resetRunLicenseCheckStateForTests();
  });

  it('does not warn with a valid token and still fires telemetry', async () => {
    const status = await runLicenseCheck({
      package: '@cacheplane/langgraph',
      version: '1.0.0',
      token: validToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      telemetryEndpoint: 'https://t.example.com/v1',
      warn,
      fetch: fetchMock,
    });
    expect(status).toBe('licensed');
    expect(warn).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.license_id).toBe('cus_abc');
  });

  it('warns when token is missing', async () => {
    const status = await runLicenseCheck({
      package: '@cacheplane/langgraph',
      version: '1.0.0',
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      telemetryEndpoint: 'https://t.example.com/v1',
      warn,
      fetch: fetchMock,
    });
    expect(status).toBe('missing');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('is idempotent per (package, token) pair', async () => {
    await runLicenseCheck({
      package: '@cacheplane/langgraph',
      version: '1.0.0',
      token: validToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      telemetryEndpoint: 'https://t.example.com/v1',
      warn,
      fetch: fetchMock,
    });
    await runLicenseCheck({
      package: '@cacheplane/langgraph',
      version: '1.0.0',
      token: validToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      telemetryEndpoint: 'https://t.example.com/v1',
      warn,
      fetch: fetchMock,
    });
    // Second call is a no-op: no extra warn (already guarded by nag dedupe anyway),
    // and crucially no second telemetry POST.
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('re-runs when token changes (e.g., after key rotation in the host)', async () => {
    const otherToken = await signLicense({ ...BASE, sub: 'cus_xyz' }, kp.privateKey);
    await runLicenseCheck({
      package: '@cacheplane/langgraph',
      version: '1.0.0',
      token: validToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      telemetryEndpoint: 'https://t.example.com/v1',
      warn,
      fetch: fetchMock,
    });
    await runLicenseCheck({
      package: '@cacheplane/langgraph',
      version: '1.0.0',
      token: otherToken,
      publicKey: kp.publicKey,
      nowSec: 1_900_000_000,
      telemetryEndpoint: 'https://t.example.com/v1',
      warn,
      fetch: fetchMock,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test licensing`
Expected: FAIL — `runLicenseCheck is not a function`.

- [ ] **Step 3: Implement the orchestrator**

`libs/licensing/src/lib/run-license-check.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { verifyLicense } from './verify-license';
import { evaluateLicense, type LicenseStatus } from './evaluate-license';
import { emitNag } from './nag';
import { createTelemetryClient } from './telemetry';

export interface RunLicenseCheckOptions {
  /** Fully-qualified host package name. */
  package: string;
  /** Host package version (e.g., "1.0.0"). */
  version: string;
  /** User-supplied license token, or undefined. */
  token?: string;
  /** Ed25519 public key to verify against. */
  publicKey: Uint8Array;
  /** Telemetry endpoint URL. */
  telemetryEndpoint: string;
  /** Current time in epoch seconds. Defaults to now. Injected for testability. */
  nowSec?: number;
  /** Hint that the environment is noncommercial (e.g. NODE_ENV !== 'production'). */
  isNoncommercial?: boolean;
  /** Injected warn channel, defaults to console.warn. */
  warn?: (message: string) => void;
  /** Injected fetch, defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

const done = new Set<string>();

export async function runLicenseCheck(
  options: RunLicenseCheckOptions,
): Promise<LicenseStatus> {
  const key = `${options.package}|${options.token ?? ''}`;
  if (done.has(key)) {
    // Idempotent: re-running with identical inputs is a no-op.
    return 'licensed';
  }
  done.add(key);

  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const verify = options.token
    ? await verifyLicense(options.token, options.publicKey)
    : undefined;
  const evaluated = evaluateLicense(verify, {
    nowSec,
    isNoncommercial: options.isNoncommercial,
  });

  emitNag(evaluated, { package: options.package, warn: options.warn });

  const telemetry = createTelemetryClient({
    endpoint: options.telemetryEndpoint,
    fetch: options.fetch,
  });
  // Fire-and-forget; do not await the host's init on it.
  void telemetry.send({
    package: options.package,
    version: options.version,
    licenseId: evaluated.claims?.sub,
  });

  return evaluated.status;
}

/** @internal testing hook only. */
export function __resetRunLicenseCheckStateForTests(): void {
  done.clear();
}
```

- [ ] **Step 4: Update the public API barrel**

Replace `libs/licensing/src/index.ts` with:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export type { LicenseClaims, LicenseTier } from './lib/license-token';
export type { VerifyResult, VerifyReason } from './lib/verify-license';
export { verifyLicense } from './lib/verify-license';
export type { LicenseStatus, EvaluateResult, EvaluateOptions } from './lib/evaluate-license';
export { evaluateLicense } from './lib/evaluate-license';
export type { EmitNagOptions } from './lib/nag';
export { emitNag } from './lib/nag';
export type {
  TelemetryEvent,
  TelemetryClient,
  CreateTelemetryClientOptions,
} from './lib/telemetry';
export { createTelemetryClient } from './lib/telemetry';
export type { RunLicenseCheckOptions } from './lib/run-license-check';
export { runLicenseCheck } from './lib/run-license-check';
export { LICENSE_PUBLIC_KEY } from './lib/license-public-key';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test licensing`
Expected: PASS across all spec files.

- [ ] **Step 6: Verify build picks up the new surface**

Run: `npx nx build licensing`
Expected: `dist/libs/licensing/index.d.ts` exports `runLicenseCheck`, `verifyLicense`, `LICENSE_PUBLIC_KEY`, etc.

- [ ] **Step 7: Commit**

```bash
git add libs/licensing/src
git commit -m "feat(licensing): add runLicenseCheck orchestrator and public API"
```

---

## Task 9: README and license-check fixtures doc

**Files:**
- Create: `libs/licensing/README.md`
- Create: `libs/licensing/src/lib/testing/fixtures.ts`

- [ ] **Step 1: Write the fixture helper**

`libs/licensing/src/lib/testing/fixtures.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Shared test fixtures: helper to produce signed tokens against a freshly
// generated keypair. Not exported from the package's public index.
import { signLicense, generateKeyPair, type DevKeyPair } from './keypair';
import type { LicenseClaims } from '../license-token';

export interface FixturePack {
  kp: DevKeyPair;
  validToken: string;
  expiredToken: string;
  baseClaims: LicenseClaims;
}

export async function buildFixturePack(): Promise<FixturePack> {
  const kp = await generateKeyPair();
  const baseClaims: LicenseClaims = {
    sub: 'cus_fixture',
    tier: 'developer-seat',
    iat: 1_700_000_000,
    exp: 2_000_000_000,
    seats: 1,
  };
  const validToken = await signLicense(baseClaims, kp.privateKey);
  const expiredToken = await signLicense(
    { ...baseClaims, exp: 1_700_100_000 },
    kp.privateKey,
  );
  return { kp, validToken, expiredToken, baseClaims };
}
```

- [ ] **Step 2: Write a short README**

`libs/licensing/README.md`:

```markdown
# @cacheplane/licensing

Offline Ed25519 license verification + non-blocking telemetry for the Cacheplane
Angular framework libraries.

## Status

Private, pre-1.0. Consumed by `@cacheplane/langgraph`, `@cacheplane/render`, and
`@cacheplane/chat`. Not intended as a standalone import.

## Behavior

- `verifyLicense(token, publicKey)` — pure Ed25519 verification, no I/O.
- `evaluateLicense(result, { nowSec })` — returns one of
  `licensed | grace | expired | missing | tampered | noncommercial`.
- `runLicenseCheck(options)` — runs verification, emits a single
  `console.warn` with the `[cacheplane]` prefix when unlicensed, and fires a
  non-blocking telemetry POST.
- **Never throws from init** — every failure mode is reported via warn, never
  by throwing or blocking the host application's startup.
- **Opt out of telemetry** — set `CACHEPLANE_TELEMETRY=0` in the environment, or
  `globalThis.CACHEPLANE_TELEMETRY = false`.
```

- [ ] **Step 3: Commit**

```bash
git add libs/licensing/README.md libs/licensing/src/lib/testing/fixtures.ts
git commit -m "docs(licensing): add README and shared test fixtures"
```

---

## Task 10: Integrate license check into `@cacheplane/langgraph`

**Files:**
- Create: `libs/licensing/src/testing.ts`
- Modify: `tsconfig.base.json` (add `@cacheplane/licensing/testing` path)
- Modify: `libs/licensing/tsconfig.lib.json` (exclude `src/testing.ts`)
- Modify: `libs/langgraph/tsconfig.json` (remove `baseUrl: "."` override)
- Modify: `libs/langgraph/src/test-setup.ts` (scoped sha512 patch)
- Modify: `libs/langgraph/src/lib/agent.provider.ts`
- Modify: `libs/langgraph/src/lib/agent.provider.spec.ts`
- Modify: `libs/langgraph/package.json`

**Guardrails (read before starting):**

- **Do NOT commit any private key to the repo.** The only fixture under `libs/licensing/fixtures/` is `dev-public-key.hex`. There is no `dev-private-key.hex`. Do not create one. Every test must mint its keypair at runtime via `generateKeyPair()` from `@cacheplane/licensing/testing`.
- **Do NOT modify `libs/licensing/src/lib/testing/keypair.ts`** in this task. `generateKeyPair()` must stay non-deterministic.
- **Do NOT modify `libs/licensing/project.json`** or the prebuild wiring.
- **Architectural key:** the provider hardcodes `LICENSE_PUBLIC_KEY` in production, but `AgentConfig` gains an `@internal __licensePublicKey?: Uint8Array` escape hatch so tests can verify against an ephemeral pair without touching the compile-time constant. Mirror the shape of the existing `__licenseEnvHint` hook.
- **Testing helpers stay source-only.** A new `@cacheplane/licensing/testing` subpath maps via TS paths to `libs/licensing/src/testing.ts`. `src/testing.ts` is excluded from `tsconfig.lib.json` so testing helpers never ship in the published `dist/`. Downstream consumers cannot import `@cacheplane/licensing/testing`.

- [ ] **Step 1: Create the testing subpath entry**

Create `libs/licensing/src/testing.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Monorepo-internal test helpers. NOT part of the published package —
// excluded from `tsconfig.lib.json` so nothing here ships in dist.
// Downstream consumers cannot import `@cacheplane/licensing/testing`.
export { generateKeyPair, signLicense } from './lib/testing/keypair';
export type { DevKeyPair } from './lib/testing/keypair';
export { __resetRunLicenseCheckStateForTests } from './lib/run-license-check';
export { __resetNagStateForTests } from './lib/nag';
```

- [ ] **Step 1b: Register the path alias in `tsconfig.base.json`**

In the `compilerOptions.paths` block, add this line directly below `"@cacheplane/licensing"`:

```json
      "@cacheplane/licensing/testing": ["libs/licensing/src/testing.ts"],
```

- [ ] **Step 1c: Exclude `src/testing.ts` from the licensing lib build**

In `libs/licensing/tsconfig.lib.json`, add `"src/testing.ts"` to the existing exclude:

```json
  "exclude": ["src/**/*.spec.ts", "src/lib/testing/**", "src/testing.ts"]
```

- [ ] **Step 1d: Remove the `baseUrl` override from `libs/langgraph/tsconfig.json`**

`libs/langgraph/tsconfig.json` currently sets `"baseUrl": "."`, which shifts path resolution relative to the agent dir and prevents `@cacheplane/licensing` from resolving. Delete that line — the `chat` and `render` tsconfigs don't have it either.

- [ ] **Step 1e: Patch `sha512Async` in `libs/langgraph/src/test-setup.ts`**

`@noble/ed25519` defaults to `crypto.subtle.digest('sha-512', ...)`. jsdom's SubtleCrypto rejects TypedArrays from the Node realm with "2nd argument is not instance of ArrayBuffer" (cross-realm instanceof). Scope a Node-crypto replacement to the agent test env only:

```ts
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import * as ed from '@noble/ed25519';
import { createHash } from 'node:crypto';

// jsdom's SubtleCrypto rejects cross-realm TypedArrays. Route sha512 through
// Node's crypto module, which has no cross-realm constraints. Scoped to agent
// test-setup only — does not affect production code or the published package.
ed.etc.sha512Async = async (...messages: Uint8Array[]): Promise<Uint8Array> => {
  const hash = createHash('sha512');
  for (const m of messages) hash.update(m);
  return new Uint8Array(hash.digest());
};

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
  { teardown: { destroyAfterEach: true } },
);
```

- [ ] **Step 2: Replace `libs/langgraph/src/lib/agent.provider.spec.ts` with the updated test suite**

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAgent, AGENT_CONFIG } from './agent.provider';
import { MockAgentTransport } from './transport/mock-stream.transport';
import {
  signLicense,
  generateKeyPair,
  __resetRunLicenseCheckStateForTests,
  __resetNagStateForTests,
} from '@cacheplane/licensing/testing';

describe('provideAgent', () => {
  beforeEach(() => {
    __resetRunLicenseCheckStateForTests();
    __resetNagStateForTests();
  });

  it('provides AGENT_CONFIG token', () => {
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: 'https://api.example.com' })],
    });
    const config = TestBed.inject(AGENT_CONFIG);
    expect(config.apiUrl).toBe('https://api.example.com');
  });

  it('provides custom transport via config', () => {
    const transport = new MockAgentTransport();
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: '', transport })],
    });
    const config = TestBed.inject(AGENT_CONFIG);
    expect(config.transport).toBe(transport);
  });

  it('runs a silent license check when a valid license is supplied', async () => {
    const warn = vi.fn();
    globalThis.console.warn = warn;
    const kp = await generateKeyPair();
    const token = await signLicense(
      {
        sub: 'cus_test',
        tier: 'developer-seat',
        iat: 1_700_000_000,
        exp: 2_000_000_000,
        seats: 1,
      },
      kp.privateKey,
    );
    TestBed.configureTestingModule({
      providers: [
        provideAgent({
          apiUrl: '',
          license: token,
          // @internal hook — verifies against the ephemeral pair so the test
          // doesn't need to know/mint the production public key.
          __licensePublicKey: kp.publicKey,
        }),
      ],
    });
    TestBed.inject(AGENT_CONFIG);
    // Allow microtasks from the ed25519 verify + telemetry fire-and-forget.
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when license is missing and env is production-like', async () => {
    const warn = vi.fn();
    globalThis.console.warn = warn;
    TestBed.configureTestingModule({
      providers: [
        provideAgent({ apiUrl: '', __licenseEnvHint: { isNoncommercial: false } }),
      ],
    });
    TestBed.inject(AGENT_CONFIG);
    await new Promise((r) => setTimeout(r, 0));
    const calls = warn.mock.calls.map((c) => String(c[0]));
    expect(calls.some((m) => m.includes('[cacheplane] @cacheplane/langgraph'))).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx nx test agent`
Expected: FAIL — `license` / `__licensePublicKey` not known properties of `AgentConfig`, and `@cacheplane/licensing` doesn't yet export the reset helpers.

- [ ] **Step 4: Implement provider changes**

Replace `libs/langgraph/src/lib/agent.provider.ts` with:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, Provider } from '@angular/core';
import { runLicenseCheck, LICENSE_PUBLIC_KEY } from '@cacheplane/licensing';
import { AgentTransport } from './agent.types';

const PACKAGE_NAME = '@cacheplane/langgraph';
// Wired up by the release pipeline — imported lazily to avoid a hard build-time
// dependency on package.json.
declare const __CACHEPLANE_AGENT_VERSION__: string | undefined;
const PACKAGE_VERSION =
  typeof __CACHEPLANE_AGENT_VERSION__ !== 'undefined'
    ? __CACHEPLANE_AGENT_VERSION__
    : '0.0.0-dev';
const TELEMETRY_ENDPOINT =
  'https://telemetry.cacheplane.dev/v1/ping';

/**
 * Global configuration for agent instances.
 * Properties set here serve as defaults that can be overridden per-call.
 */
export interface AgentConfig {
  /** Base URL of the LangGraph Platform API (e.g., `'http://localhost:2024'`). */
  apiUrl?:    string;
  /** Custom transport implementation. Defaults to {@link FetchStreamTransport}. */
  transport?: AgentTransport;
  /** Signed license token from cacheplane.dev. Optional; omitted in dev. */
  license?: string;
  /**
   * @internal
   * Test-only env hint override. Not part of the stable API.
   */
  __licenseEnvHint?: { isNoncommercial: boolean };
  /**
   * @internal
   * Test-only public-key override. Defaults to the compile-time embedded
   * `LICENSE_PUBLIC_KEY`. Not part of the stable API.
   */
  __licensePublicKey?: Uint8Array;
}

export const AGENT_CONFIG = new InjectionToken<AgentConfig>('AGENT_CONFIG');

function inferNoncommercial(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = (globalThis as any)['process'];
  if (proc && proc.env) {
    return proc.env['NODE_ENV'] !== 'production';
  }
  return false;
}

/**
 * Angular provider factory that registers global defaults for all
 * agent instances in the application.
 */
export function provideAgent(config: AgentConfig): Provider {
  // Fire-and-forget license check. Never blocks DI resolution.
  void runLicenseCheck({
    package: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    token: config.license,
    publicKey: config.__licensePublicKey ?? LICENSE_PUBLIC_KEY,
    telemetryEndpoint: TELEMETRY_ENDPOINT,
    isNoncommercial:
      config.__licenseEnvHint?.isNoncommercial ?? inferNoncommercial(),
  });

  return { provide: AGENT_CONFIG, useValue: config };
}
```

- [ ] **Step 5: Add `@cacheplane/licensing` as a peer dependency**

Edit `libs/langgraph/package.json` — add to the `peerDependencies` block:

```json
    "@cacheplane/licensing": "^0.0.1",
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx nx test agent`
Expected: PASS — all 4 tests green.

**If tests fail:** stop and report the exact failure to the controller. Do not create a dev private-key fixture, do not alter `keypair.ts`, do not monkeypatch `sha512Async`, do not edit `tsconfig.base.json` or `libs/langgraph/tsconfig.json`.

- [ ] **Step 7: Verify agent still builds**

Run: `npx nx build agent`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add libs/licensing/src/testing.ts libs/licensing/tsconfig.lib.json \
  tsconfig.base.json \
  libs/langgraph/tsconfig.json libs/langgraph/src/test-setup.ts \
  libs/langgraph/src/lib/agent.provider.ts libs/langgraph/src/lib/agent.provider.spec.ts \
  libs/langgraph/package.json
git commit -m "feat(agent): run license check at provider init"
```

---

## Task 11: Integrate license check into `@cacheplane/render`

**Files:**
- Modify: `libs/render/tsconfig.json` (remove `baseUrl: "."` override, same reason as agent in T10)
- Modify: `libs/render/src/lib/provide-render.ts`
- Modify: `libs/render/src/lib/render.types.ts`
- Create: `libs/render/src/lib/provide-render.spec.ts`
- Modify: `libs/render/package.json`

**Guardrails:**

- Do not commit any private key to the repo. `libs/licensing/fixtures/` contains only `dev-public-key.hex`.
- Do not modify `libs/licensing/src/lib/testing/keypair.ts`, `libs/licensing/tsconfig.lib.json`, `libs/licensing/project.json`, or the `@cacheplane/licensing/testing` subpath wiring set up in T10.
- Mirror agent's `__licensePublicKey` override on `RenderConfig` for symmetry.
- The render test only covers the missing-license warn path (no ed25519 work), so no `sha512Async` patch is needed in `libs/render/src/test-setup.ts`.
- If tests or build fail in unexpected ways, stop and report to the controller.

- [ ] **Step 0: Remove the `baseUrl` override from `libs/render/tsconfig.json`**

Same as the agent fix in T10 Step 1d — `baseUrl: "."` in the per-lib tsconfig shifts path resolution and breaks `@cacheplane/licensing`. Delete the `"baseUrl": "."` line.

- [ ] **Step 1: Write the failing test**

`libs/render/src/lib/provide-render.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRender, RENDER_CONFIG } from './provide-render';
import {
  __resetRunLicenseCheckStateForTests,
  __resetNagStateForTests,
} from '@cacheplane/licensing/testing';

describe('provideRender', () => {
  beforeEach(() => {
    __resetRunLicenseCheckStateForTests();
    __resetNagStateForTests();
    globalThis.console.warn = vi.fn();
  });

  it('provides RENDER_CONFIG token', () => {
    TestBed.configureTestingModule({ providers: [provideRender({})] });
    const config = TestBed.inject(RENDER_CONFIG);
    expect(config).toBeDefined();
  });

  it('warns when license is missing in a production-like env', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRender({ __licenseEnvHint: { isNoncommercial: false } }),
      ],
    });
    TestBed.inject(RENDER_CONFIG);
    await new Promise((r) => setTimeout(r, 0));
    const warn = globalThis.console.warn as ReturnType<typeof vi.fn>;
    expect(
      warn.mock.calls.some((c) =>
        String(c[0]).includes('[cacheplane] @cacheplane/render'),
      ),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Extend the `RenderConfig` type**

In `libs/render/src/lib/render.types.ts`, add to the `RenderConfig` interface:

```ts
  /** Signed license token from cacheplane.dev. Optional; omitted in dev. */
  license?: string;
  /**
   * @internal
   * Test-only env hint override. Not part of the stable API.
   */
  __licenseEnvHint?: { isNoncommercial: boolean };
  /**
   * @internal
   * Test-only public-key override. Defaults to the compile-time embedded
   * `LICENSE_PUBLIC_KEY`. Not part of the stable API.
   */
  __licensePublicKey?: Uint8Array;
```

- [ ] **Step 3: Implement provider changes**

Replace `libs/render/src/lib/provide-render.ts` with:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { runLicenseCheck, LICENSE_PUBLIC_KEY } from '@cacheplane/licensing';
import type { RenderConfig } from './render.types';

const PACKAGE_NAME = '@cacheplane/render';
declare const __CACHEPLANE_RENDER_VERSION__: string | undefined;
const PACKAGE_VERSION =
  typeof __CACHEPLANE_RENDER_VERSION__ !== 'undefined'
    ? __CACHEPLANE_RENDER_VERSION__
    : '0.0.0-dev';
const TELEMETRY_ENDPOINT = 'https://telemetry.cacheplane.dev/v1/ping';

function inferNoncommercial(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = (globalThis as any)['process'];
  if (proc && proc.env) {
    return proc.env['NODE_ENV'] !== 'production';
  }
  return false;
}

export const RENDER_CONFIG = new InjectionToken<RenderConfig>('RENDER_CONFIG');

export function provideRender(config: RenderConfig) {
  void runLicenseCheck({
    package: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    token: config.license,
    publicKey: config.__licensePublicKey ?? LICENSE_PUBLIC_KEY,
    telemetryEndpoint: TELEMETRY_ENDPOINT,
    isNoncommercial:
      config.__licenseEnvHint?.isNoncommercial ?? inferNoncommercial(),
  });

  return makeEnvironmentProviders([
    { provide: RENDER_CONFIG, useValue: config },
  ]);
}
```

- [ ] **Step 4: Add the peer dependency**

Edit `libs/render/package.json` — add to the `peerDependencies` block:

```json
    "@cacheplane/licensing": "^0.0.1",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test render`
Expected: PASS — new spec green, existing render tests still green.

**If tests or build fail:** stop and report the exact failure to the controller.

- [ ] **Step 6: Verify render still builds**

Run: `npx nx build render`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add libs/render/tsconfig.json libs/render/src/lib/provide-render.ts libs/render/src/lib/provide-render.spec.ts libs/render/src/lib/render.types.ts libs/render/package.json
git commit -m "feat(render): run license check at provider init"
```

---

## Task 12: Integrate license check into `@cacheplane/chat`

**Files:**
- Modify: `libs/chat/src/lib/provide-chat.ts`
- Create: `libs/chat/src/lib/provide-chat.spec.ts`
- Modify: `libs/chat/package.json`

**Guardrails (same as T10; read before starting):**

- Do not commit any private key to the repo. `libs/licensing/fixtures/` contains only `dev-public-key.hex`.
- Do not modify `libs/licensing/src/lib/testing/keypair.ts`, `libs/licensing/tsconfig.lib.json`, or `libs/licensing/project.json`.
- Mirror agent's `__licensePublicKey` override on `ChatConfig` for symmetry.
- If tests or build fail due to jsdom/Nx issues, stop and report to the controller rather than patching `test-setup.ts` or `tsconfig.base.json` unilaterally.

- [ ] **Step 1: Write the failing test**

`libs/chat/src/lib/provide-chat.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideChat, CHAT_CONFIG } from './provide-chat';
import {
  __resetRunLicenseCheckStateForTests,
  __resetNagStateForTests,
} from '@cacheplane/licensing/testing';

describe('provideChat', () => {
  beforeEach(() => {
    __resetRunLicenseCheckStateForTests();
    __resetNagStateForTests();
    globalThis.console.warn = vi.fn();
  });

  it('provides CHAT_CONFIG token', () => {
    TestBed.configureTestingModule({ providers: [provideChat({})] });
    const config = TestBed.inject(CHAT_CONFIG);
    expect(config).toBeDefined();
  });

  it('warns when license is missing in a production-like env', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideChat({ __licenseEnvHint: { isNoncommercial: false } }),
      ],
    });
    TestBed.inject(CHAT_CONFIG);
    await new Promise((r) => setTimeout(r, 0));
    const warn = globalThis.console.warn as ReturnType<typeof vi.fn>;
    expect(
      warn.mock.calls.some((c) =>
        String(c[0]).includes('[cacheplane] @cacheplane/chat'),
      ),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Implement provider changes**

Replace `libs/chat/src/lib/provide-chat.ts` with:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { runLicenseCheck, LICENSE_PUBLIC_KEY } from '@cacheplane/licensing';
import type { AngularRegistry } from '@cacheplane/render';

const PACKAGE_NAME = '@cacheplane/chat';
declare const __CACHEPLANE_CHAT_VERSION__: string | undefined;
const PACKAGE_VERSION =
  typeof __CACHEPLANE_CHAT_VERSION__ !== 'undefined'
    ? __CACHEPLANE_CHAT_VERSION__
    : '0.0.0-dev';
const TELEMETRY_ENDPOINT = 'https://telemetry.cacheplane.dev/v1/ping';

function inferNoncommercial(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = (globalThis as any)['process'];
  if (proc && proc.env) {
    return proc.env['NODE_ENV'] !== 'production';
  }
  return false;
}

export interface ChatConfig {
  /** Default render registry for generative UI components. */
  renderRegistry?: AngularRegistry;
  /** Override the default AI avatar label (default: "A"). */
  avatarLabel?: string;
  /** Override the default assistant display name (default: "Assistant"). */
  assistantName?: string;
  /** Signed license token from cacheplane.dev. Optional; omitted in dev. */
  license?: string;
  /**
   * @internal
   * Test-only env hint override. Not part of the stable API.
   */
  __licenseEnvHint?: { isNoncommercial: boolean };
  /**
   * @internal
   * Test-only public-key override. Defaults to the compile-time embedded
   * `LICENSE_PUBLIC_KEY`. Not part of the stable API.
   */
  __licensePublicKey?: Uint8Array;
}

export const CHAT_CONFIG = new InjectionToken<ChatConfig>('CHAT_CONFIG');

export function provideChat(config: ChatConfig) {
  void runLicenseCheck({
    package: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    token: config.license,
    publicKey: config.__licensePublicKey ?? LICENSE_PUBLIC_KEY,
    telemetryEndpoint: TELEMETRY_ENDPOINT,
    isNoncommercial:
      config.__licenseEnvHint?.isNoncommercial ?? inferNoncommercial(),
  });

  return makeEnvironmentProviders([
    { provide: CHAT_CONFIG, useValue: config },
  ]);
}
```

- [ ] **Step 3: Add the peer dependency**

Edit `libs/chat/package.json` — add to the `peerDependencies` block:

```json
    "@cacheplane/licensing": "^0.0.1",
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat`
Expected: PASS — new spec green, existing chat tests still green.

**If tests or build fail:** stop and report the exact failure to the controller.

- [ ] **Step 5: Verify chat still builds**

Run: `npx nx build chat`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/provide-chat.ts libs/chat/src/lib/provide-chat.spec.ts libs/chat/package.json
git commit -m "feat(chat): run license check at provider init"
```

---

## Task 13: Sanity check — full monorepo build, test, and lint

**Files:** (no code changes; verification only)

- [ ] **Step 1: Run full test suite across affected projects**

Run: `npx nx run-many -t test -p licensing,agent,render,chat`
Expected: all tests pass.

- [ ] **Step 2: Run lint across affected projects**

Run: `npx nx run-many -t lint -p licensing,agent,render,chat`
Expected: no lint errors.

- [ ] **Step 3: Run build across affected projects**

Run: `npx nx run-many -t build -p licensing,agent,render,chat`
Expected: all four packages build; `dist/libs/licensing/index.d.ts` exports `runLicenseCheck`, and each of `dist/libs/{agent,render,chat}/` builds successfully with the new peer dep.

- [ ] **Step 4: Smoke the nag path in a real dev build**

Run:
```bash
node --input-type=module -e "
import { runLicenseCheck, LICENSE_PUBLIC_KEY } from './dist/libs/licensing/index.js';
const warn = console.warn;
let captured = '';
console.warn = (m) => { captured += m + '\n'; };
await runLicenseCheck({
  package: '@cacheplane/test',
  version: '1.0.0',
  publicKey: LICENSE_PUBLIC_KEY,
  telemetryEndpoint: 'https://telemetry.invalid/ping',
  isNoncommercial: false,
  nowSec: Math.floor(Date.now()/1000),
});
await new Promise(r => setTimeout(r, 10));
console.warn = warn;
console.log('---');
console.log(captured);
"
```
Expected: output contains `[cacheplane] @cacheplane/test:` and a pricing URL. Process exits 0 (telemetry failure is swallowed).

- [ ] **Step 5: Commit the plan into the repo if not already done**

No new source files should have changed in this task. If `git status` is clean, skip.

---

## Scope Out (explicitly not in this plan)

- **Minting service** — Stripe webhook handler + email delivery → Plan 2 (Minting & Telemetry Service).
- **Stripe Checkout wiring** — pricing page CTAs → Plan 3 (Stripe & Website Integration).
- **Public key rotation runbook** — documented in the v1 roadmap; lives in the minting plan once the rotation mechanism is real.
- **Legal texts** — `LICENSE-COMMERCIAL`, privacy policy updates → Plan 3.
- **Running the telemetry endpoint in production** → Plan 2.
- **Injecting the real production public key via CI** → already covered by the Release Infrastructure plan's "public key embedding at build time" task; this plan ships the mechanism (prebuild generator + env override), but the release pipeline is what sets the env in CI.

---

## Self-Review Notes

- **Spec coverage:** Every bullet under v1 roadmap §3 "Licensing & Billing / License key mechanism" is covered — Ed25519 signing (T3), customer id / tier / iat / exp / seats claims (T2), public key baked at build time (T7), offline verification (T3), nag mode (T5), non-blocking phone-home (T6), `{license_id, version, anon_instance_id}` payload (T6), init + daily behavior (init covered; daily POST deliberately deferred — the v1 spec says "init + daily" but a real 24h timer from inside a library is fragile; the minting service plan owns the daily heartbeat and we only ship init-time telemetry here, matching the spec's "Failure never blocks" contract).
- **Placeholder scan:** No TBDs or "implement later" markers; every code step has real code.
- **Type consistency:** `LicenseStatus` values are consistent across Tasks 4, 5, 8. `LicenseClaims` shape matches the parser in Task 2 and the signer in Task 3. `runLicenseCheck` signature matches the callers in Tasks 10–12.
- **Known trade-off:** `generateKeyPair` / `signLicense` / `DevKeyPair` are re-exported from the library's public index so the monorepo's own Angular specs can import them via the `@cacheplane/licensing` path alias. This leaks ~1KB of test utilities into the published bundle. The alternative — a `@cacheplane/licensing/testing` subpath with explicit `exports` wiring — is deferred because `@cacheplane/licensing` is a v1 transitive dependency, not one of the three documented v1 public packages, and the documented-as-internal helpers pay their weight by keeping the Angular-provider specs terse. Revisit when the library gets its own stabilization pass.
