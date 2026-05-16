# Analytics Foundation 1D — Website Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every first-party event through per-app Next.js `/ingest/*` rewrites so ad-blockers can't drop telemetry, and consolidate the analytics capture-guard helpers into `@ngaf/telemetry` for one source of truth.

**Architecture:** Two parallel proxy paths per Next.js app — `/api/ingest` keeps serving `libs/telemetry/browser`'s custom envelope (Spec 1B, unchanged), and a new `/ingest/*` rewrites chain transparently forwards `posthog-js` traffic to `us.i.posthog.com` and `us-assets.i.posthog.com`. Cockpit adds CORS headers so iframe Angular apps can POST cross-origin. `@ngaf/telemetry/browser` and `@ngaf/telemetry/shared` absorb the shared `properties.ts` helpers; the two app-local copies are deleted.

**Tech Stack:** Next.js 16 (App Router) with the `@nx/next` plugin; TypeScript; Vitest; `posthog-js` (browser, via `api_host: '/ingest'`); `posthog-node` (server, for the existing `/api/ingest` route only).

---

## Context for the implementer

- **Spec:** `docs/superpowers/specs/gtm/2026-05-16-analytics-foundation-1d-website-reconciliation-design.md` — read §§3–6 before starting.
- **Two distinct paths, do not conflate:**
  - `/api/ingest` (existing, unchanged) — `libs/telemetry/browser` posts a custom JSON envelope via raw `fetch()`; the route forwards via `posthog-node`. Only `ngaf:*` events.
  - `/ingest/*` (new) — `posthog-js` posts PostHog's native batched/gzipped format. Next.js rewrites transparently forward to `us.i.posthog.com` and `us-assets.i.posthog.com`. No application-level filtering.
- **The cockpit iframe path** routes through `cockpit.cacheplane.ai/ingest/*` cross-origin from `examples.cacheplane.ai`. CORS headers in `apps/cockpit/next.config.ts:headers()` make the response readable.
- **Test runner:** Vitest. The Next.js `next.config.ts` is a TS module exporting a default config — vitest can import it directly and assert the shape.
- **TDD discipline:** every code-change task writes the test first, watches it fail, implements, watches it pass, commits.
- **Commit format:** conventional commits. Examples: `refactor(telemetry): move shouldCaptureAnalytics to @ngaf/telemetry/browser`, `feat(website): /ingest rewrites for posthog-js`, `feat(cockpit): /ingest rewrites + CORS for iframe posthog-js`.
- **One task = one commit.**
- **Worktree:** plan executes on branch `gtm-spec-1d-website-reconciliation` (already created from `origin/main`).

## File structure (locked)

```
NEW
├── libs/telemetry/src/browser/properties.ts          # Phase 0
├── libs/telemetry/src/browser/properties.spec.ts     # Phase 0
├── libs/telemetry/src/shared/properties.ts           # Phase 0 (new file in existing shared/ dir)
├── libs/telemetry/src/shared/properties.spec.ts      # Phase 0
├── apps/website/next.config.spec.ts                  # Phase 1 (vitest config test)
├── apps/cockpit/next.config.spec.ts                  # Phase 2

MODIFIED
├── libs/telemetry/src/browser/public-api.ts          # Phase 0 — add properties exports
├── libs/telemetry/src/shared/public-api.ts           # Phase 0 — create if missing OR add to ./index.ts
├── apps/website/next.config.ts                        # Phase 1 — rewrites()
├── apps/website/instrumentation-client.ts             # Phase 1 — api_host: '/ingest'
├── apps/website/src/lib/analytics/server.ts           # Phase 0 — import from @ngaf/telemetry/shared
├── apps/website/src/app/api/leads/route.ts            # Phase 0 — import from @ngaf/telemetry/shared
├── apps/website/src/app/api/ingest/route.ts           # Phase 0 — import from @ngaf/telemetry/shared
├── apps/website/src/app/api/whitepaper-signup/route.ts# Phase 0 — verify imports
├── apps/cockpit/next.config.ts                        # Phase 2 — rewrites() + headers()
├── apps/cockpit/instrumentation-client.ts             # Phase 2 — api_host: '/ingest'
├── apps/cockpit/src/components/analytics-bootstrap.tsx# Phase 2 — api_host: '/ingest'
├── apps/cockpit/src/components/run-mode/run-mode.tsx  # Phase 2 — cockpit_host default
├── .env.example                                       # Phase 3 — new vars
│
DELETED
├── apps/website/src/lib/analytics/properties.ts       # Phase 0
├── apps/website/src/lib/analytics/properties.spec.ts  # Phase 0 (moved to lib)
├── apps/cockpit/src/lib/analytics/properties.ts       # Phase 0
├── apps/cockpit/src/lib/analytics/properties.spec.ts  # Phase 0 (moved to lib)
```

---

## Phase 0 — Consolidate `properties.ts` into `@ngaf/telemetry`

Two homes for the helpers: `browser` (DOM-dependent guards) and `shared` (cross-runtime string + URL utilities used by both Node and browser code).

### Task 0.1: Create `libs/telemetry/src/shared/properties.ts`

**Files:**
- Create: `libs/telemetry/src/shared/properties.ts`
- Create: `libs/telemetry/src/shared/properties.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/telemetry/src/shared/properties.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import {
  getEmailDomain,
  getSourcePage,
  normalizePostHogHost,
  toSafeAnalyticsString,
} from './properties';

describe('shared properties', () => {
  it('truncates safe analytics strings and drops blank values', () => {
    expect(toSafeAnalyticsString('  hello  ')).toBe('hello');
    expect(toSafeAnalyticsString('abcdef', 3)).toBe('abc');
    expect(toSafeAnalyticsString('   ')).toBeUndefined();
    expect(toSafeAnalyticsString(42)).toBeUndefined();
  });

  it('extracts a normalized email domain', () => {
    expect(getEmailDomain('Jane.Smith@Example.COM ')).toBe('example.com');
    expect(getEmailDomain('not-an-email')).toBeNull();
    expect(getEmailDomain('')).toBeNull();
  });

  it('normalizes source URLs to path, query, and hash only', () => {
    expect(getSourcePage('https://ngaf.example/docs?utm_source=x#intro')).toBe('/docs?utm_source=x#intro');
    expect(getSourcePage('/pricing')).toBe('/pricing');
    expect(getSourcePage('not a url')).toBe('/');
  });

  it('uses the PostHog US ingest host as the default', () => {
    expect(normalizePostHogHost(undefined)).toBe('https://us.i.posthog.com');
    expect(normalizePostHogHost('https://eu.i.posthog.com/')).toBe('https://eu.i.posthog.com');
  });
});
```

- [ ] **Step 2: Run, see fail**

```bash
npx nx run telemetry:test -- --testPathPattern=shared/properties.spec
```

Expected: fails with `Cannot find module './properties'`.

- [ ] **Step 3: Implement**

Create `libs/telemetry/src/shared/properties.ts`:

```typescript
// SPDX-License-Identifier: MIT
const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

export function toSafeAnalyticsString(value: unknown, maxLength = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

export function getEmailDomain(email: unknown): string | null {
  const value = toSafeAnalyticsString(email, 320);
  if (!value) return null;

  const atIndex = value.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === value.length - 1) return null;

  const domain = value.slice(atIndex + 1).toLowerCase();
  return domain.includes('.') ? domain : null;
}

export function getSourcePage(value: unknown): string {
  const source = toSafeAnalyticsString(value, 2000);
  if (!source) return '/';

  if (source.startsWith('/')) return source;

  try {
    const url = new URL(source);
    return `${url.pathname}${url.search}${url.hash}` || '/';
  } catch {
    return '/';
  }
}

export function normalizePostHogHost(host: unknown): string {
  const value = toSafeAnalyticsString(host, 500);
  if (!value) return DEFAULT_POSTHOG_HOST;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
```

- [ ] **Step 4: Run, see pass**

```bash
npx nx run telemetry:test -- --testPathPattern=shared/properties.spec
```

Expected: 4 tests passing.

- [ ] **Step 5: Export from shared/public-api.ts**

Open `libs/telemetry/src/shared/public-api.ts`. If it doesn't exist, check what file currently exports `NgafNodeEvent` etc. — likely `libs/telemetry/src/shared/events.ts` is exported via `libs/telemetry/src/index.ts`.

Add to whatever the shared barrel is (most likely add to `libs/telemetry/src/shared/public-api.ts` or create it; if `index.ts` is the only entry, add a line there):

```typescript
export { getEmailDomain, getSourcePage, normalizePostHogHost, toSafeAnalyticsString } from './shared/properties';
```

- [ ] **Step 6: Confirm `@ngaf/telemetry/shared` subpath resolves**

```bash
npx nx run telemetry:build
```

Expected: build succeeds. The `dist/libs/telemetry/shared.d.ts` (or equivalent) now exports the 4 functions.

- [ ] **Step 7: Commit**

```bash
git add libs/telemetry/src/shared/properties.ts libs/telemetry/src/shared/properties.spec.ts libs/telemetry/src/shared/public-api.ts libs/telemetry/src/index.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): add shared properties helpers (toSafeAnalyticsString, getEmailDomain, getSourcePage, normalizePostHogHost)

Moved from apps/website/src/lib/analytics/properties.ts so both shells +
server-side code can consume one source of truth via @ngaf/telemetry/shared.
Tests follow the code.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 0.2: Create `libs/telemetry/src/browser/properties.ts`

**Files:**
- Create: `libs/telemetry/src/browser/properties.ts`
- Create: `libs/telemetry/src/browser/properties.spec.ts`
- Modify: `libs/telemetry/src/browser/public-api.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/telemetry/src/browser/properties.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { isLocalAnalyticsHost, shouldCaptureAnalytics } from './properties';

describe('browser properties', () => {
  it('detects local hosts for opt-in development capture', () => {
    expect(isLocalAnalyticsHost('localhost:3000')).toBe(true);
    expect(isLocalAnalyticsHost('127.0.0.1:3000')).toBe(true);
    expect(isLocalAnalyticsHost('::1')).toBe(true);
    expect(isLocalAnalyticsHost('ngaf.example')).toBe(false);
    expect(isLocalAnalyticsHost(undefined)).toBe(false);
  });

  it('requires a token and skips local capture unless explicitly enabled', () => {
    expect(shouldCaptureAnalytics({ token: '', captureLocal: false, host: 'ngaf.example' })).toBe(false);
    expect(shouldCaptureAnalytics({ token: 'ph_test', captureLocal: false, host: 'localhost:3000' })).toBe(false);
    expect(shouldCaptureAnalytics({ token: 'ph_test', captureLocal: true, host: 'localhost:3000' })).toBe(true);
    expect(shouldCaptureAnalytics({ token: 'ph_test', captureLocal: false, host: 'ngaf.example' })).toBe(true);
  });
});
```

- [ ] **Step 2: Run, see fail**

```bash
npx nx run telemetry:test -- --testPathPattern=browser/properties.spec
```

Expected: fails with `Cannot find module './properties'`.

- [ ] **Step 3: Implement**

Create `libs/telemetry/src/browser/properties.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { toSafeAnalyticsString } from '../shared/properties';

export type CaptureConfig = {
  token?: string;
  captureLocal?: boolean;
  host?: string;
};

export function isLocalAnalyticsHost(host: unknown): boolean {
  const value = toSafeAnalyticsString(host, 300)?.toLowerCase();
  if (!value) return false;

  const hostname = value.split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function shouldCaptureAnalytics({ token, captureLocal = false, host }: CaptureConfig): boolean {
  if (!toSafeAnalyticsString(token, 500)) return false;
  if (isLocalAnalyticsHost(host) && !captureLocal) return false;
  return true;
}
```

- [ ] **Step 4: Run, see pass**

```bash
npx nx run telemetry:test -- --testPathPattern=browser/properties.spec
```

Expected: 2 tests passing (5 assertions total).

- [ ] **Step 5: Export from browser/public-api.ts**

Open `libs/telemetry/src/browser/public-api.ts` and append:

```typescript
export { isLocalAnalyticsHost, shouldCaptureAnalytics } from './properties';
export type { CaptureConfig } from './properties';
```

- [ ] **Step 6: Build**

```bash
npx nx run telemetry:build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add libs/telemetry/src/browser/properties.ts libs/telemetry/src/browser/properties.spec.ts libs/telemetry/src/browser/public-api.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): add browser shouldCaptureAnalytics + isLocalAnalyticsHost

Moved from apps/website/src/lib/analytics/properties.ts so apps/website
and apps/cockpit consume the same capture guard via
@ngaf/telemetry/browser. apps/cockpit's variant (which lacked the
toSafeAnalyticsString hardening) is dropped in favor of this stricter
implementation.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 0.3: Update `apps/website` imports to `@ngaf/telemetry/shared`

**Files:**
- Modify: `apps/website/src/lib/analytics/server.ts`
- Modify: `apps/website/src/app/api/leads/route.ts`
- Modify: `apps/website/src/app/api/ingest/route.ts`
- Modify: `apps/website/src/app/api/whitepaper-signup/route.ts` (if it imports from properties)
- Modify: any other file under `apps/website/` that imports from `analytics/properties`

- [ ] **Step 1: Find every importer**

```bash
grep -rln "from.*analytics/properties" apps/website/src 2>/dev/null
```

Expected: list of 5–8 files. Note them.

- [ ] **Step 2: Update each file's imports**

For every file in the grep output, change the import from:

```typescript
import { toSafeAnalyticsString, normalizePostHogHost, /* etc. */ } from '../../lib/analytics/properties';
```

(or whatever relative path) to:

```typescript
import { toSafeAnalyticsString, normalizePostHogHost, /* etc. */ } from '@ngaf/telemetry/shared';
```

For the **server-side** files (`server.ts`, `api/leads/route.ts`, `api/ingest/route.ts`, `api/whitepaper-signup/route.ts`) the helpers used are: `toSafeAnalyticsString`, `getEmailDomain`, `getSourcePage`, `normalizePostHogHost`. All four live in `@ngaf/telemetry/shared`.

- [ ] **Step 3: Run website tests + build**

```bash
npx nx run website:test
npx nx run website:build
```

Expected: both green. (The website's tests previously imported from `./properties`; those still work because Task 0.5 hasn't deleted the file yet.)

- [ ] **Step 4: Commit**

```bash
git add apps/website/src
git commit -m "$(cat <<'EOF'
refactor(website): import shared analytics helpers from @ngaf/telemetry/shared

Switches server.ts + the four API routes that use toSafeAnalyticsString,
getEmailDomain, getSourcePage, normalizePostHogHost to consume them from
the published lib instead of the app-local copy. Local file stays until
Task 0.5 deletes it.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 0.4: Update `apps/website` browser-side imports + `instrumentation-client.ts`

**Files:**
- Modify: `apps/website/instrumentation-client.ts`
- Modify: any other browser-side file importing `shouldCaptureAnalytics` or `isLocalAnalyticsHost`

- [ ] **Step 1: Find browser-side importers**

```bash
grep -rln "shouldCaptureAnalytics\|isLocalAnalyticsHost" apps/website/src apps/website/*.ts 2>/dev/null | grep -v ".spec."
```

Expected: at least `apps/website/instrumentation-client.ts`.

- [ ] **Step 2: Update each file's import to `@ngaf/telemetry/browser`**

For `apps/website/instrumentation-client.ts`, change:

```typescript
import { normalizePostHogHost, shouldCaptureAnalytics } from './src/lib/analytics/properties';
```

to:

```typescript
import { normalizePostHogHost } from '@ngaf/telemetry/shared';
import { shouldCaptureAnalytics } from '@ngaf/telemetry/browser';
```

- [ ] **Step 3: Run + commit**

```bash
npx nx run website:build
git add apps/website/instrumentation-client.ts
git commit -m "$(cat <<'EOF'
refactor(website): import shouldCaptureAnalytics from @ngaf/telemetry/browser

instrumentation-client.ts now sources the capture guard from the shared
lib. Local properties.ts retains its remaining consumers (the test file
itself) until Task 0.5.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 0.5: Delete `apps/website/src/lib/analytics/properties.ts` + spec

**Files:**
- Delete: `apps/website/src/lib/analytics/properties.ts`
- Delete: `apps/website/src/lib/analytics/properties.spec.ts`

- [ ] **Step 1: Confirm no remaining importers**

```bash
grep -rln "from.*analytics/properties" apps/website 2>/dev/null
```

Expected: empty.

- [ ] **Step 2: Delete the files**

```bash
git rm apps/website/src/lib/analytics/properties.ts apps/website/src/lib/analytics/properties.spec.ts
```

- [ ] **Step 3: Run tests + build**

```bash
npx nx run website:test
npx nx run website:build
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(website): delete duplicated analytics/properties.ts

All consumers now import from @ngaf/telemetry/{shared,browser}. Tests
moved to libs/telemetry in Tasks 0.1 and 0.2.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 0.6: Update `apps/cockpit` imports + delete local `properties.ts`

**Files:**
- Modify: `apps/cockpit/instrumentation-client.ts`
- Modify: `apps/cockpit/src/components/analytics-bootstrap.tsx`
- Modify: any other file under `apps/cockpit/src` importing from `analytics/properties`
- Delete: `apps/cockpit/src/lib/analytics/properties.ts`
- Delete: `apps/cockpit/src/lib/analytics/properties.spec.ts`

- [ ] **Step 1: Find importers**

```bash
grep -rln "from.*analytics/properties" apps/cockpit 2>/dev/null
```

Expected: 3–4 files.

- [ ] **Step 2: Update each importer**

`apps/cockpit/instrumentation-client.ts`:

```typescript
// before
import { shouldCaptureAnalytics } from './src/lib/analytics/properties';

// after
import { shouldCaptureAnalytics } from '@ngaf/telemetry/browser';
```

`apps/cockpit/src/components/analytics-bootstrap.tsx`:

```typescript
// before
import { shouldCaptureAnalytics } from '../lib/analytics/properties';

// after
import { shouldCaptureAnalytics } from '@ngaf/telemetry/browser';
```

For any other importer, mirror the same swap. The cockpit's `CaptureGuardInput` type isn't exported anywhere; the `@ngaf/telemetry/browser` `CaptureConfig` type covers the same shape with optional `captureLocal`.

- [ ] **Step 3: Delete the local files**

```bash
git rm apps/cockpit/src/lib/analytics/properties.ts apps/cockpit/src/lib/analytics/properties.spec.ts
```

- [ ] **Step 4: Run tests + build**

```bash
npx nx run cockpit:test
npx nx run cockpit:build
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add -A apps/cockpit
git commit -m "$(cat <<'EOF'
refactor(cockpit): consume shouldCaptureAnalytics from @ngaf/telemetry/browser

Drops the cockpit-local properties.ts duplicate in favor of the
website's stricter implementation now living in @ngaf/telemetry/browser.
Both shells share one capture guard.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 — Website `/ingest` rewrites + posthog-js config

### Task 1.1: Add `/ingest/*` rewrites to `apps/website/next.config.ts`

**Files:**
- Modify: `apps/website/next.config.ts`
- Create: `apps/website/next.config.spec.ts`

- [ ] **Step 1: Write the failing config test**

Create `apps/website/next.config.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import config from './next.config';

describe('website next.config rewrites', () => {
  it('exposes posthog-js rewrites under /ingest', async () => {
    expect(typeof config.rewrites).toBe('function');
    const rewrites = await config.rewrites!();
    const list = Array.isArray(rewrites) ? rewrites : rewrites.beforeFiles ?? [];
    const sources = list.map((r: { source: string }) => r.source);
    expect(sources).toContain('/ingest/static/:path*');
    expect(sources).toContain('/ingest/:path*');
    const staticRule = list.find((r: { source: string }) => r.source === '/ingest/static/:path*');
    expect(staticRule.destination).toBe('https://us-assets.i.posthog.com/static/:path*');
    const apiRule = list.find((r: { source: string }) => r.source === '/ingest/:path*');
    expect(apiRule.destination).toBe('https://us.i.posthog.com/:path*');
  });
});
```

- [ ] **Step 2: Run, see fail**

```bash
cd apps/website && npx vitest run next.config.spec.ts
```

Expected: fails — `config.rewrites` is undefined.

- [ ] **Step 3: Implement**

Open `apps/website/next.config.ts`. The existing file looks like:

```typescript
import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';

const nextConfig: WithNxOptions = {
  // existing options...
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
```

The test imports `./next.config` and expects a config object with `rewrites`. Because `composePlugins(...)(nextConfig)` returns a function returning the resolved config, exporting that result directly won't expose `rewrites` to vitest cleanly. Solution: export both — keep the default (for Next.js) and a named export for testing.

Replace the file with:

```typescript
import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';

export const nextConfig: WithNxOptions = {
  // ...keep all the existing options (nx, etc.)...
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/:path*',        destination: 'https://us.i.posthog.com/:path*' },
    ];
  },
  skipTrailingSlashRedirect: true,
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
```

Update the spec to import the named export:

```typescript
import { nextConfig as config } from './next.config';
```

- [ ] **Step 4: Run, see pass**

```bash
cd apps/website && npx vitest run next.config.spec.ts
```

Expected: 1 test passing.

- [ ] **Step 5: Verify build still works**

```bash
npx nx run website:build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/website/next.config.ts apps/website/next.config.spec.ts
git commit -m "$(cat <<'EOF'
feat(website): /ingest rewrites for first-party posthog-js proxy

Adds Next.js rewrites that forward /ingest/static/* to
us-assets.i.posthog.com and /ingest/* to us.i.posthog.com. posthog-js
configured with api_host: '/ingest' in Task 1.2 will route through this,
surviving ad-blockers that block *.posthog.com.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: Point `apps/website` posthog-js at `/ingest`

**Files:**
- Modify: `apps/website/instrumentation-client.ts`

- [ ] **Step 1: Read current state**

```bash
cat apps/website/instrumentation-client.ts
```

Note the current `posthog.init(...)` call — it passes `api_host: normalizePostHogHost(process.env.NEXT_PUBLIC_POSTHOG_HOST)`.

- [ ] **Step 2: Replace api_host**

Edit `apps/website/instrumentation-client.ts`. Change:

```typescript
posthog.init(token!, {
  api_host: normalizePostHogHost(process.env.NEXT_PUBLIC_POSTHOG_HOST),
  defaults: '2026-01-30',
  capture_pageview: true,
  person_profiles: 'always',
});
```

to:

```typescript
posthog.init(token!, {
  api_host: '/ingest',
  ui_host: 'https://us.posthog.com',
  defaults: '2026-01-30',
  capture_pageview: true,
  person_profiles: 'always',
});
```

The `normalizePostHogHost` import can be removed if it's no longer used elsewhere in the file. Check with:

```bash
grep -c "normalizePostHogHost" apps/website/instrumentation-client.ts
```

If 1, drop the import.

- [ ] **Step 3: Verify build**

```bash
npx nx run website:build
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/website/instrumentation-client.ts
git commit -m "$(cat <<'EOF'
feat(website): point posthog-js at /ingest first-party proxy

api_host: '/ingest' routes all browser captures through the same-origin
rewrite path added in Task 1.1. ui_host preserves PostHog UI links for
session-replay / toolbar features.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Cockpit `/ingest` rewrites + CORS + posthog-js config

### Task 2.1: Add `/ingest/*` rewrites + CORS to `apps/cockpit/next.config.ts`

**Files:**
- Modify: `apps/cockpit/next.config.ts`
- Create: `apps/cockpit/next.config.spec.ts`

- [ ] **Step 1: Write the failing config test**

Create `apps/cockpit/next.config.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { nextConfig as config } from './next.config';

describe('cockpit next.config', () => {
  it('exposes posthog-js rewrites under /ingest', async () => {
    expect(typeof config.rewrites).toBe('function');
    const rewrites = await config.rewrites!();
    const list = Array.isArray(rewrites) ? rewrites : rewrites.beforeFiles ?? [];
    const sources = list.map((r: { source: string }) => r.source);
    expect(sources).toContain('/ingest/static/:path*');
    expect(sources).toContain('/ingest/:path*');
    const staticRule = list.find((r: { source: string }) => r.source === '/ingest/static/:path*');
    expect(staticRule.destination).toBe('https://us-assets.i.posthog.com/static/:path*');
    const apiRule = list.find((r: { source: string }) => r.source === '/ingest/:path*');
    expect(apiRule.destination).toBe('https://us.i.posthog.com/:path*');
  });

  it('attaches CORS headers to /ingest/* responses', async () => {
    expect(typeof config.headers).toBe('function');
    const rules = await config.headers!();
    const ingestRule = rules.find((r: { source: string }) => r.source === '/ingest/:path*');
    expect(ingestRule).toBeDefined();
    const headerKeys = ingestRule.headers.map((h: { key: string }) => h.key);
    expect(headerKeys).toContain('Access-Control-Allow-Origin');
    expect(headerKeys).toContain('Access-Control-Allow-Methods');
    expect(headerKeys).toContain('Access-Control-Allow-Headers');
    expect(headerKeys).toContain('Access-Control-Max-Age');
    const methods = ingestRule.headers.find((h: { key: string }) => h.key === 'Access-Control-Allow-Methods');
    expect(methods.value).toBe('POST, OPTIONS');
  });
});
```

- [ ] **Step 2: Run, see fail**

```bash
cd apps/cockpit && npx vitest run next.config.spec.ts
```

Expected: fails.

- [ ] **Step 3: Implement**

Replace `apps/cockpit/next.config.ts` with:

```typescript
import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';

export const nextConfig: WithNxOptions = {
  nx: {},
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/:path*',        destination: 'https://us.i.posthog.com/:path*' },
    ];
  },
  async headers() {
    return [{
      source: '/ingest/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin',  value: process.env.NEXT_PUBLIC_COCKPIT_IFRAME_ORIGIN ?? '*' },
        { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        { key: 'Access-Control-Max-Age',       value: '86400' },
      ],
    }];
  },
  skipTrailingSlashRedirect: true,
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
```

- [ ] **Step 4: Run, see pass**

```bash
cd apps/cockpit && npx vitest run next.config.spec.ts
```

Expected: 2 tests passing.

- [ ] **Step 5: Verify build**

```bash
npx nx run cockpit:build
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add apps/cockpit/next.config.ts apps/cockpit/next.config.spec.ts
git commit -m "$(cat <<'EOF'
feat(cockpit): /ingest rewrites + CORS for cross-origin iframe posthog-js

Adds rewrites mirroring the website's Phase 1 work, plus CORS headers
on /ingest/* so iframe Angular apps on examples.cacheplane.ai can POST
cross-origin. Origin is env-driven (NEXT_PUBLIC_COCKPIT_IFRAME_ORIGIN)
with wildcard fallback for local dev.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: Point `apps/cockpit` posthog-js at `/ingest`

**Files:**
- Modify: `apps/cockpit/instrumentation-client.ts`
- Modify: `apps/cockpit/src/components/analytics-bootstrap.tsx`

- [ ] **Step 1: Update instrumentation-client.ts**

Edit `apps/cockpit/instrumentation-client.ts`. Find the `posthog.init(...)` block. Change:

```typescript
posthog.init(token!, {
  api_host: process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_HOST ?? 'https://us.i.posthog.com',
  persistence: 'memory',
  bootstrap: { distinctID: getCockpitSessionId() },
  autocapture: false,
  capture_pageview: false,
  defaults: '2026-01-30',
});
```

to:

```typescript
posthog.init(token!, {
  api_host: '/ingest',
  ui_host: 'https://us.posthog.com',
  persistence: 'memory',
  bootstrap: { distinctID: getCockpitSessionId() },
  autocapture: false,
  capture_pageview: false,
  defaults: '2026-01-30',
});
```

- [ ] **Step 2: Update analytics-bootstrap.tsx**

Edit `apps/cockpit/src/components/analytics-bootstrap.tsx`. Find the `posthog.init(...)` block inside the useEffect. Apply the same change as above.

- [ ] **Step 3: Run cockpit tests**

```bash
npx nx run cockpit:test
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/instrumentation-client.ts apps/cockpit/src/components/analytics-bootstrap.tsx
git commit -m "$(cat <<'EOF'
feat(cockpit): point shell posthog-js at /ingest rewrite path

Both the instrumentation-client.ts (intent-only, may not run reliably in
turbopack dev) and the AnalyticsBootstrap client component now use
api_host: '/ingest' so events route through the rewrite added in Task 2.1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.3: Update `run-mode.tsx` to default `cockpit_host` at `/ingest`

**Files:**
- Modify: `apps/cockpit/src/components/run-mode/run-mode.tsx`

- [ ] **Step 1: Update buildIframeSrc**

Edit `apps/cockpit/src/components/run-mode/run-mode.tsx`. Find:

```typescript
const host = process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_HOST;
if (host) url.searchParams.set('cockpit_host', host);
```

Replace with:

```typescript
const ingestHost =
  process.env.NEXT_PUBLIC_COCKPIT_INGEST_HOST
    ?? (typeof window !== 'undefined' ? `${window.location.origin}/ingest` : undefined);
if (ingestHost) url.searchParams.set('cockpit_host', ingestHost);
```

This keeps `NEXT_PUBLIC_COCKPIT_POSTHOG_HOST` working as a fallback only when explicitly set (operators can still override). For prod, `NEXT_PUBLIC_COCKPIT_INGEST_HOST=https://cockpit.cacheplane.ai/ingest`. For dev, the function falls back to the current origin's `/ingest`.

- [ ] **Step 2: Verify existing tests still pass**

```bash
npx nx run cockpit:test -- --testPathPattern=run-mode
```

Expected: green (the test mocks getCockpitSessionId but doesn't depend on the host source).

- [ ] **Step 3: Build**

```bash
npx nx run cockpit:build
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/run-mode/run-mode.tsx
git commit -m "$(cat <<'EOF'
feat(cockpit): iframe cockpit_host defaults to /ingest rewrite

buildIframeSrc now passes the cockpit shell's /ingest URL as the iframe's
PostHog api_host instead of us.i.posthog.com. Iframes inside Angular
examples will route their cockpit:* events through the cockpit shell's
ad-blocker-resistant proxy.

NEXT_PUBLIC_COCKPIT_INGEST_HOST env var pins the absolute URL for prod
(https://cockpit.cacheplane.ai/ingest); dev falls back to the runtime
origin.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Env docs

### Task 3.1: Update `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Append new vars under the cockpit section**

Find the "Cockpit shell analytics" section in `.env.example`. Add below the existing `NEXT_PUBLIC_COCKPIT_*` entries:

```bash
# Cockpit iframe → cockpit-shell /ingest proxy. Production: full absolute URL.
# Leave empty in dev to let RunMode derive it from window.location.origin.
NEXT_PUBLIC_COCKPIT_INGEST_HOST=

# CORS origin allowed to POST to cockpit's /ingest. Production:
# https://examples.cacheplane.ai. Leave empty in dev — wildcard '*' is used.
NEXT_PUBLIC_COCKPIT_IFRAME_ORIGIN=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
docs(env): document NEXT_PUBLIC_COCKPIT_INGEST_HOST + NEXT_PUBLIC_COCKPIT_IFRAME_ORIGIN

Two new env vars introduced by Spec 1D:
- NEXT_PUBLIC_COCKPIT_INGEST_HOST — absolute URL of the cockpit shell's
  /ingest proxy, written into the iframe URL's cockpit_host param.
- NEXT_PUBLIC_COCKPIT_IFRAME_ORIGIN — CORS-allowed iframe origin for
  the cockpit's /ingest rewrite.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.2: Final verification across affected projects

This is a verification-only task — no commit unless something needs fixing.

- [ ] **Step 1: Run the full affected test suite**

```bash
npx nx run-many -t test -p telemetry,website,cockpit
```

Expected: all green.

- [ ] **Step 2: Run builds**

```bash
npx nx run-many -t build -p telemetry,website,cockpit
```

Expected: all green.

- [ ] **Step 3: Confirm no stale `analytics/properties` references**

```bash
grep -rln "from.*analytics/properties" apps libs 2>/dev/null
```

Expected: empty.

- [ ] **Step 4: Confirm no posthog-js still points at us.i.posthog.com directly**

```bash
grep -rn "us.i.posthog.com" apps libs 2>/dev/null | grep -v "shared/properties\|node_modules\|.env\|README\|spec\|\.md" | head
```

Expected: only references inside the rewrite destinations (`apps/{website,cockpit}/next.config.ts`) and the lib's `DEFAULT_POSTHOG_HOST` constant.

- [ ] **Step 5: Done**

If all four checks pass, Spec 1D is implementation-complete. Proceed to PR.

---

## Self-Review

**1. Spec coverage:**

| Spec deliverable | Task |
|---|---|
| `libs/telemetry/src/browser/properties.ts` + spec | 0.2 |
| `libs/telemetry/src/shared/properties.ts` extended + spec | 0.1 |
| `apps/website/next.config.ts` rewrites | 1.1 |
| `apps/website/instrumentation-client.ts` updated | 1.2 |
| `apps/cockpit/next.config.ts` rewrites + headers | 2.1 |
| `apps/cockpit/instrumentation-client.ts` + analytics-bootstrap.tsx | 2.2 |
| `apps/cockpit/src/components/run-mode/run-mode.tsx` env-driven cockpit_host | 2.3 |
| `apps/website/src/lib/analytics/properties.ts` deleted | 0.5 |
| `apps/cockpit/src/lib/analytics/properties.ts` deleted | 0.6 |
| Server-side imports updated to @ngaf/telemetry/shared | 0.3 |
| `.env.example` documents new vars | 3.1 |
| All affected tests green | 3.2 |
| `/api/ingest` unchanged | ✓ (no task touches it) |

All deliverables covered.

**2. Placeholder scan:** No TBDs, no "add error handling" without code, no "similar to Task N" without repeating content. ✓

**3. Type consistency:**

- `CaptureConfig` (Task 0.2) ← used by `shouldCaptureAnalytics`. ✓
- `toSafeAnalyticsString`, `normalizePostHogHost`, `getEmailDomain`, `getSourcePage` (Task 0.1) — all four referenced by name in 0.3 and 0.4. ✓
- `isLocalAnalyticsHost` (Task 0.2) — referenced in 0.4 grep + 0.6 import swap. ✓
- env var names: `NEXT_PUBLIC_COCKPIT_INGEST_HOST` (Tasks 2.3, 3.1) + `NEXT_PUBLIC_COCKPIT_IFRAME_ORIGIN` (Tasks 2.1, 3.1) — consistent. ✓
- `api_host: '/ingest'` consistent across Tasks 1.2, 2.2. ✓
- Rewrite destinations `https://us.i.posthog.com/:path*` and `https://us-assets.i.posthog.com/static/:path*` identical in 1.1, 2.1, and their tests. ✓
