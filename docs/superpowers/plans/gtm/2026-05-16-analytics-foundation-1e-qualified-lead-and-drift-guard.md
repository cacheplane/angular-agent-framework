# Analytics Foundation 1E — Qualified-Lead + Drift Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fire `marketing:lead_qualified` server-side when a lead submission passes the enterprise gate, and add a CI test that fails when code fires an event name not documented in `docs/gtm/taxonomy.md`.

**Architecture:** A `PERSONAL_EMAIL_DOMAINS` set and `isPersonalEmailDomain` predicate live in `@ngaf/telemetry/shared`. A `captureLeadQualified` server-side helper in `apps/website/src/lib/analytics/server.ts` reuses the existing posthog-node plumbing and gates on (non-personal domain) + (non-empty company). One new line in `/api/leads/route.ts` calls it after `captureLeadConversion`. The drift guard is a `node:test` script at `tools/posthog/code-taxonomy.spec.ts` that mirrors the existing insights guard's shape — regex over `apps/` + `libs/`, asserts no undocumented event names.

**Tech Stack:** TypeScript; node:test + node:assert/strict (matches existing `tools/posthog/taxonomy.spec.ts`); Vitest for unit tests in `libs/telemetry` and `apps/website`; `posthog-node` (existing).

---

## Context for the implementer

- **Spec:** `docs/superpowers/specs/gtm/2026-05-16-analytics-foundation-1e-qualified-lead-and-drift-guard-design.md` — read §§3–6 before starting.
- **`posthog-tools:test` uses node:test, NOT vitest.** The existing `tools/posthog/taxonomy.spec.ts` uses `node:test` and `node:assert/strict`. The new `code-taxonomy.spec.ts` must follow that pattern — the executor is `npx tsx --test tools/posthog/*.spec.ts`.
- **Unit tests inside libs/website use Vitest** (per `apps/website/vite.config.mts` and `libs/telemetry/vite.config.mts`). The captureLeadQualified test goes here.
- **`@ngaf/telemetry/shared`** is the published subpath (Spec 1D). The new `isPersonalEmailDomain` exports from there.
- **`server.ts` already imports from `@ngaf/telemetry/shared`** (post-Spec 1D refactor). Adding the new import is a one-line append.
- **Commit format:** conventional commits, one task = one commit.
- **TDD discipline:** every code-change task writes test → run-see-fail → implement → run-see-pass → commit.
- **Worktree:** plan executes on branch `gtm-spec-1e-qualified-lead-and-drift-guard` (already created from `origin/main` at `465f6d16`).

## File structure (locked)

```
NEW
├── libs/telemetry/src/shared/personal-email-domains.ts          # Phase 0
├── libs/telemetry/src/shared/personal-email-domains.spec.ts     # Phase 0
├── apps/website/src/lib/analytics/server.spec.ts                # Phase 1
├── tools/posthog/code-taxonomy.spec.ts                          # Phase 2

MODIFIED
├── libs/telemetry/src/shared/public-api.ts                      # Phase 0 — export new symbols
├── apps/website/src/lib/analytics/events.ts                     # Phase 1 — add marketingLeadQualified
├── apps/website/src/lib/analytics/server.ts                     # Phase 1 — add captureLeadQualified
├── apps/website/src/app/api/leads/route.ts                      # Phase 1 — call captureLeadQualified
```

No deletions.

---

## Phase 0 — Personal-email blocklist

### Task 0.1: Create `personal-email-domains.ts` + spec via TDD

**Files:**
- Create: `libs/telemetry/src/shared/personal-email-domains.ts`
- Create: `libs/telemetry/src/shared/personal-email-domains.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/telemetry/src/shared/personal-email-domains.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { PERSONAL_EMAIL_DOMAINS, isPersonalEmailDomain } from './personal-email-domains';

describe('personal email domains', () => {
  it('exposes a non-empty set of well-known free-mail domains', () => {
    expect(PERSONAL_EMAIL_DOMAINS.size).toBeGreaterThan(10);
    expect(PERSONAL_EMAIL_DOMAINS.has('gmail.com')).toBe(true);
    expect(PERSONAL_EMAIL_DOMAINS.has('proton.me')).toBe(true);
  });

  it('returns true for blocklisted domains (case-insensitive)', () => {
    expect(isPersonalEmailDomain('gmail.com')).toBe(true);
    expect(isPersonalEmailDomain('GMAIL.COM')).toBe(true);
    expect(isPersonalEmailDomain('Hotmail.Com')).toBe(true);
    expect(isPersonalEmailDomain('proton.me')).toBe(true);
    expect(isPersonalEmailDomain('163.com')).toBe(true);
  });

  it('returns false for unknown domains and falsy inputs', () => {
    expect(isPersonalEmailDomain('acme.com')).toBe(false);
    expect(isPersonalEmailDomain('cacheplane.ai')).toBe(false);
    expect(isPersonalEmailDomain('')).toBe(false);
    expect(isPersonalEmailDomain(null)).toBe(false);
    expect(isPersonalEmailDomain(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, see fail**

```bash
npx nx run telemetry:test -- --testPathPattern=personal-email-domains.spec
```

Expected: fails with `Cannot find module './personal-email-domains'`.

- [ ] **Step 3: Implement**

Create `libs/telemetry/src/shared/personal-email-domains.ts`:

```typescript
// SPDX-License-Identifier: MIT
export const PERSONAL_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'gmx.com',
  'mail.com',
  'yandex.com',
  'fastmail.com',
  'msn.com',
  'qq.com',
  '163.com',
  '126.com',
]);

export function isPersonalEmailDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return PERSONAL_EMAIL_DOMAINS.has(domain.toLowerCase());
}
```

- [ ] **Step 4: Run, see pass**

```bash
npx nx run telemetry:test -- --testPathPattern=personal-email-domains.spec
```

Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add libs/telemetry/src/shared/personal-email-domains.ts libs/telemetry/src/shared/personal-email-domains.spec.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): add PERSONAL_EMAIL_DOMAINS + isPersonalEmailDomain

19 free-mail domains in a ReadonlySet plus a case-insensitive predicate.
Used by the website's lead-qualification gate to filter out personal
email submissions before firing marketing:lead_qualified.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 0.2: Export from `@ngaf/telemetry/shared`

**Files:**
- Modify: `libs/telemetry/src/shared/public-api.ts`

- [ ] **Step 1: Append exports**

Open `libs/telemetry/src/shared/public-api.ts` and append:

```typescript
export { PERSONAL_EMAIL_DOMAINS, isPersonalEmailDomain } from './personal-email-domains';
```

The full file after edit:

```typescript
// SPDX-License-Identifier: MIT
export type { NgafEvent, NgafNodeEvent, NgafBrowserEvent } from './events';
export {
  getEmailDomain,
  getSourcePage,
  normalizePostHogHost,
  toSafeAnalyticsString,
} from './properties';
export { PERSONAL_EMAIL_DOMAINS, isPersonalEmailDomain } from './personal-email-domains';
```

- [ ] **Step 2: Build telemetry to confirm the export surface**

```bash
npx nx run telemetry:build
```

Expected: build succeeds; the `@ngaf/telemetry/shared` subpath now resolves `isPersonalEmailDomain`.

- [ ] **Step 3: Commit**

```bash
git add libs/telemetry/src/shared/public-api.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): export isPersonalEmailDomain from @ngaf/telemetry/shared

Both the website (lead-qualification gate, this PR) and any future
consumer can import the blocklist + predicate from the published lib.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 — `captureLeadQualified` + wiring

### Task 1.1: Add `marketingLeadQualified` to events.ts

**Files:**
- Modify: `apps/website/src/lib/analytics/events.ts`

- [ ] **Step 1: Append the entry**

Open `apps/website/src/lib/analytics/events.ts`. Locate the `analyticsEvents` object literal. Add `marketingLeadQualified` immediately after `marketingLeadFormFail`:

```typescript
export const analyticsEvents = {
  // ...existing entries unchanged...
  marketingLeadFormSubmit: 'marketing:lead_form_submit',
  marketingLeadFormSuccess: 'marketing:lead_form_success',
  marketingLeadFormFail: 'marketing:lead_form_fail',
  marketingLeadQualified: 'marketing:lead_qualified',   // NEW
  marketingNewsletterSignupSubmit: 'marketing:newsletter_signup_submit',
  // ...rest unchanged...
} as const;
```

- [ ] **Step 2: Run website tests + build**

```bash
npx nx run website:build
```

Expected: green. (No tests yet — the constant is consumed in Task 1.3.)

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/analytics/events.ts
git commit -m "$(cat <<'EOF'
feat(website): add marketingLeadQualified to analyticsEvents map

Symbolic ref for the new server-side event. Wiring lands in Tasks 1.2
and 1.3.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: TDD: tests for `captureLeadQualified`

**Files:**
- Create: `apps/website/src/lib/analytics/server.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/lib/analytics/server.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, beforeEach } from 'vitest';

const captureMock = vi.hoisted(() => vi.fn());
vi.mock('posthog-node', () => ({
  PostHog: vi.fn(() => ({
    capture: captureMock,
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

beforeEach(() => {
  captureMock.mockClear();
  process.env.NEXT_PUBLIC_POSTHOG_TOKEN = 'phc_test';
});

describe('captureLeadQualified', () => {
  it('fires marketing:lead_qualified when domain is non-personal and company is non-empty', async () => {
    const { captureLeadQualified } = await import('./server');
    await captureLeadQualified({
      email: 'jane@acme.com',
      company: 'Acme',
      sourcePage: '/pricing',
    });
    expect(captureMock).toHaveBeenCalledTimes(1);
    const call = captureMock.mock.calls[0][0];
    expect(call.event).toBe('marketing:lead_qualified');
    expect(call.properties).toMatchObject({
      email_domain: 'acme.com',
      company: 'Acme',
      source_page: '/pricing',
      track: 'enterprise',
    });
    expect(call.distinctId).toMatch(/^email_sha256:[a-f0-9]{64}$/);
  });

  it('skips when the email domain is personal', async () => {
    const { captureLeadQualified } = await import('./server');
    await captureLeadQualified({
      email: 'jane@gmail.com',
      company: 'Acme',
      sourcePage: '/pricing',
    });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('skips when company is missing', async () => {
    const { captureLeadQualified } = await import('./server');
    await captureLeadQualified({
      email: 'jane@acme.com',
      sourcePage: '/pricing',
    });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('skips when company is blank string', async () => {
    const { captureLeadQualified } = await import('./server');
    await captureLeadQualified({
      email: 'jane@acme.com',
      company: '   ',
      sourcePage: '/pricing',
    });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('skips when email is malformed', async () => {
    const { captureLeadQualified } = await import('./server');
    await captureLeadQualified({
      email: 'not-an-email',
      company: 'Acme',
    });
    expect(captureMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, see fail**

```bash
cd apps/website && npx vitest run src/lib/analytics/server.spec.ts
```

Expected: fails with `captureLeadQualified is not exported` (or similar).

- [ ] **Step 3: Verify the mock setup works for a known-existing function**

(Sanity check — skip if comfortable.) Add a temporary test for `captureLeadConversion` to confirm the posthog-node mock is wired correctly:

```typescript
it('sanity: captureLeadConversion fires marketing:lead_form_success', async () => {
  const { captureLeadConversion } = await import('./server');
  await captureLeadConversion({ email: 'jane@acme.com', company: 'Acme' });
  expect(captureMock).toHaveBeenCalled();
});
```

Run; expected pass. Then DELETE this sanity test before committing.

- [ ] **Step 4: No commit yet** (the test fails because `captureLeadQualified` doesn't exist — Task 1.3 implements it). Move on.

---

### Task 1.3: Implement `captureLeadQualified` + wire from route

**Files:**
- Modify: `apps/website/src/lib/analytics/server.ts`
- Modify: `apps/website/src/app/api/leads/route.ts`

- [ ] **Step 1: Update the import in server.ts**

Open `apps/website/src/lib/analytics/server.ts`. Find the existing import:

```typescript
import { getEmailDomain, normalizePostHogHost, toSafeAnalyticsString } from '@ngaf/telemetry/shared';
```

Replace with:

```typescript
import { getEmailDomain, isPersonalEmailDomain, normalizePostHogHost, toSafeAnalyticsString } from '@ngaf/telemetry/shared';
```

- [ ] **Step 2: Append `captureLeadQualified` to server.ts**

Add a new exported function below `captureLeadConversion` (and above `captureWhitepaperConversion`):

```typescript
export async function captureLeadQualified({
  email,
  company,
  sourcePage,
}: {
  email: string;
  company?: string;
  sourcePage?: string;
}) {
  const domain = getEmailDomain(email);
  if (!domain || isPersonalEmailDomain(domain)) return;

  const safeCompany = toSafeAnalyticsString(company, 200);
  if (!safeCompany) return;

  const distinctId = getHashedEmailDistinctId(email);
  if (!distinctId) return;

  await captureServerEvent({
    distinctId,
    event: analyticsEvents.marketingLeadQualified,
    properties: {
      email_domain: domain,
      company: safeCompany,
      source_page: sourcePage,
      track: 'enterprise',
    },
  });
}
```

- [ ] **Step 3: Run the spec from Task 1.2 — see pass**

```bash
cd apps/website && npx vitest run src/lib/analytics/server.spec.ts
```

Expected: 5 tests passing.

- [ ] **Step 4: Wire from `/api/leads/route.ts`**

Open `apps/website/src/app/api/leads/route.ts`. Find the import:

```typescript
import { captureLeadConversion } from '../../../lib/analytics/server';
```

Change to:

```typescript
import { captureLeadConversion, captureLeadQualified } from '../../../lib/analytics/server';
```

Find the existing `captureLeadConversion` call near the bottom of the `POST` handler:

```typescript
await captureLeadConversion({ email, company, sourcePage });
```

Append a new line immediately after:

```typescript
await captureLeadConversion({ email, company, sourcePage });
await captureLeadQualified({ email, company, sourcePage });
```

- [ ] **Step 5: Run website tests + build**

```bash
npx nx run website:build
cd apps/website && npx vitest run
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/lib/analytics/server.ts apps/website/src/lib/analytics/server.spec.ts apps/website/src/app/api/leads/route.ts
git commit -m "$(cat <<'EOF'
feat(website): fire marketing:lead_qualified server-side on enterprise leads

captureLeadQualified gates on getEmailDomain(email) being present,
isPersonalEmailDomain(domain) being false, and toSafeAnalyticsString
(company, 200) being non-empty. When all three pass, fires the event
with properties { email_domain, company, source_page, track: 'enterprise' }.

Wired from /api/leads/route.ts immediately after captureLeadConversion.
Five unit tests cover the gate matrix.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Drift guard (code → taxonomy)

### Task 2.1: Create `tools/posthog/code-taxonomy.spec.ts`

**Files:**
- Create: `tools/posthog/code-taxonomy.spec.ts`

- [ ] **Step 1: Write the scanner**

The file is a `node:test` script — same shape as the existing `tools/posthog/taxonomy.spec.ts`. It scans the workspace, extracts event-name literals via four regex patterns, resolves `analyticsEvents.<key>` references, and asserts every name is present in `docs/gtm/taxonomy.md`.

Create `tools/posthog/code-taxonomy.spec.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const TAXONOMY_PATH = join(REPO_ROOT, 'docs', 'gtm', 'taxonomy.md');

const SCAN_ROOTS = [
  'apps/website/src',
  'apps/website/instrumentation-client.ts',
  'apps/cockpit/src',
  'apps/cockpit/instrumentation-client.ts',
  'libs/cockpit-telemetry/src',
  'libs/telemetry/src',
];

const EVENT_NAME_RE = /^(?:\$pageview|(?:marketing|cockpit|ngaf|docs):[a-z_]+)$/;

const CAPTURE_PATTERNS: RegExp[] = [
  /posthog\.capture\(\s*['"]([^'"]+)['"]/g,
  /\btrack\(\s*['"]([^'"]+)['"]/g,
  /captureServerEvent\(\s*\{\s*[^}]*?event:\s*['"]([^'"]+)['"]/gs,
];

const ANALYTICS_EVENTS_REF_RE = /analyticsEvents\.([a-zA-Z]+)/g;

async function walk(path: string, files: string[]): Promise<void> {
  let info;
  try {
    info = await stat(path);
  } catch {
    return; // missing root — skip
  }
  if (info.isFile()) {
    files.push(path);
    return;
  }
  if (!info.isDirectory()) return;
  const entries = await readdir(path, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dist') continue;
    const full = join(path, e.name);
    if (e.isDirectory()) {
      await walk(full, files);
    } else if (
      (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) &&
      !e.name.endsWith('.spec.ts') &&
      !e.name.endsWith('.spec.tsx')
    ) {
      files.push(full);
    }
  }
}

async function loadAnalyticsEventsMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const path = join(REPO_ROOT, 'apps', 'website', 'src', 'lib', 'analytics', 'events.ts');
  let body: string;
  try {
    body = await readFile(path, 'utf8');
  } catch {
    return map;
  }
  // Match "keyName: 'event:name'," inside the analyticsEvents = { ... } block.
  const entryRe = /(\w+):\s*['"]([^'"]+)['"]/g;
  for (const m of body.matchAll(entryRe)) {
    map.set(m[1], m[2]);
  }
  return map;
}

test('every event fired in code appears in docs/gtm/taxonomy.md', async () => {
  // 1. Collect all candidate source files.
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    await walk(join(REPO_ROOT, root), files);
  }

  // 2. Load the analyticsEvents map so we can resolve symbolic refs.
  const aliasMap = await loadAnalyticsEventsMap();

  // 3. Scan every file for event name literals + analyticsEvents references.
  const referenced = new Set<string>();
  for (const file of files) {
    const body = await readFile(file, 'utf8');

    for (const pattern of CAPTURE_PATTERNS) {
      pattern.lastIndex = 0;
      for (const m of body.matchAll(pattern)) {
        const candidate = m[1];
        if (EVENT_NAME_RE.test(candidate)) referenced.add(candidate);
      }
    }

    ANALYTICS_EVENTS_REF_RE.lastIndex = 0;
    for (const m of body.matchAll(ANALYTICS_EVENTS_REF_RE)) {
      const key = m[1];
      const resolved = aliasMap.get(key);
      if (resolved && EVENT_NAME_RE.test(resolved)) referenced.add(resolved);
    }
  }

  // 4. Load taxonomy documented events.
  const taxonomy = await readFile(TAXONOMY_PATH, 'utf8');
  const documented = new Set<string>();
  for (const m of taxonomy.matchAll(/`(\$pageview|(?:marketing|cockpit|ngaf|docs):[a-z_]+)`/g)) {
    documented.add(m[1]);
  }

  // 5. Difference.
  const undocumented = [...referenced].filter((e) => !documented.has(e)).sort();
  assert.deepEqual(
    undocumented,
    [],
    `Events fired in code but missing from docs/gtm/taxonomy.md:\n${undocumented.join('\n')}\n\n` +
      `Add a row to taxonomy.md (Marketing / Cockpit / ngaf / Docs section as appropriate) ` +
      `so the dashboards-as-code guard knows the event is intentional.`,
  );
});
```

- [ ] **Step 2: Run the existing posthog-tools tests + the new one**

```bash
npx nx run posthog-tools:test
```

Expected: both `taxonomy.spec.ts` and `code-taxonomy.spec.ts` pass against the current repo (Spec 1D landed clean; no expected drift).

- [ ] **Step 3: Sanity — confirm the guard actually fails on a synthetic drift**

This is a one-shot verification (no commit). Temporarily add a fake call somewhere outside the spec scan exclusions to confirm the test fails:

```bash
# Add temporary line — DO NOT commit
echo "track('marketing:NEVER_EXISTS', {});" >> apps/website/src/lib/analytics/client.ts
npx nx run posthog-tools:test
```

Expected: test fails with `Events fired in code but missing from docs/gtm/taxonomy.md:\nmarketing:NEVER_EXISTS`.

Revert:

```bash
git checkout apps/website/src/lib/analytics/client.ts
npx nx run posthog-tools:test
```

Expected: green again.

- [ ] **Step 4: Commit**

```bash
git add tools/posthog/code-taxonomy.spec.ts
git commit -m "$(cat <<'EOF'
test(posthog): drift guard for code → taxonomy

New node:test script that scans apps/ + libs/ for event-name literals
fired via posthog.capture(...), track(...), captureServerEvent({event}),
or analyticsEvents.<key>. Asserts every name is documented in
docs/gtm/taxonomy.md. Mirror of the existing insights → taxonomy guard.

Catches the kind of drift that slipped through during Spec 1C
(cockpit:recipe_start → recipe_opened rename).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Verification

### Task 3.1: Full test sweep across affected projects (no commit)

- [ ] **Step 1: Run tests**

```bash
npx nx run-many -t test -p telemetry,website,posthog-tools
```

Expected: all three projects green.

- [ ] **Step 2: Run builds**

```bash
npx nx run-many -t build -p telemetry,website
```

Expected: green.

- [ ] **Step 3: Confirm no taxonomy drift**

```bash
npx nx run posthog-tools:test 2>&1 | grep -E "passed|failed"
```

Expected: both `taxonomy.spec.ts` and `code-taxonomy.spec.ts` pass.

- [ ] **Step 4: Done**

If all three checks pass, Spec 1E is implementation-complete. Proceed to PR.

---

## Self-Review

**1. Spec coverage:**

| Spec deliverable | Task |
|---|---|
| `libs/telemetry/src/shared/personal-email-domains.ts` + spec | 0.1 |
| `libs/telemetry/src/shared/public-api.ts` export | 0.2 |
| `apps/website/src/lib/analytics/events.ts` marketingLeadQualified | 1.1 |
| `apps/website/src/lib/analytics/server.ts` captureLeadQualified | 1.3 |
| `apps/website/src/app/api/leads/route.ts` calls captureLeadQualified | 1.3 |
| Unit tests for captureLeadQualified | 1.2 |
| `tools/posthog/code-taxonomy.spec.ts` | 2.1 |
| Drift guard passes against current repo | 2.1 (Step 2) |
| All affected tests green | 3.1 |

All deliverables covered.

**2. Placeholder scan:** No "TBD", no "implement later", no "similar to Task N" without showing the code. Every step has the actual code or command. ✓

**3. Type consistency:**

- `isPersonalEmailDomain(domain: string | null | undefined): boolean` — same signature in Task 0.1 (implementation) and Task 1.3 (consumer). ✓
- `PERSONAL_EMAIL_DOMAINS: ReadonlySet<string>` — defined in 0.1, exported in 0.2, never re-typed in consumers. ✓
- `captureLeadQualified({ email, company?, sourcePage? })` — same parameter shape in Task 1.2 test mocks, Task 1.3 implementation, and Task 1.3 route call. ✓
- `analyticsEvents.marketingLeadQualified` resolves to `'marketing:lead_qualified'` — added in 1.1, consumed in 1.3, scanned in 2.1. ✓
- The drift guard's `aliasMap` regex matches the `analyticsEvents` literal shape used in `apps/website/src/lib/analytics/events.ts`. ✓
- `EVENT_NAME_RE` and the taxonomy regex use the same allowed prefixes (`marketing`, `cockpit`, `ngaf`, `docs`) — match `$pageview` literal. ✓
