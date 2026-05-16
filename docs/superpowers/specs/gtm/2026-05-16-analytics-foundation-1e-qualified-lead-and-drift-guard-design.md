---
workstream: analytics-foundation-1e-qualified-lead-and-drift-guard
status: approved
owner: brian
phase: 0
spec: docs/superpowers/specs/gtm/2026-05-16-analytics-foundation-1e-qualified-lead-and-drift-guard-design.md
plan: docs/superpowers/plans/gtm/2026-05-16-analytics-foundation-1e-qualified-lead-and-drift-guard.md
parent: docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md
---

# Analytics Foundation 1E — Qualified-Lead + Drift Guard (Design)

> Spec 1E closes analytics-foundation. Two deliverables that were carved out of Spec 1D: the server-side `marketing:lead_qualified` event with a qualification gate, and a CI guard that fails when code fires a PostHog event whose name isn't documented in `docs/gtm/taxonomy.md`.

## 1. Goal

1. **Fire `marketing:lead_qualified` server-side** when a lead-form submission passes the enterprise qualification gate (non-personal email domain + non-empty company). The `gtm.md` north-star metric for the enterprise track depends on this event.
2. **Add a code → taxonomy drift guard** — a CI test that scans `apps/` + `libs/` for event-name literals fired via `posthog.capture(...)`, `track(...)`, `captureServerEvent({ event: '...' })`, or `analyticsEvents.<key>`, and asserts every name is documented in `docs/gtm/taxonomy.md`. Mirrors the existing insights → taxonomy guard at `tools/posthog/taxonomy.spec.ts`.

## 2. Context

- Parent: `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md`. Spec 1D was scoped down during brainstorming to deliver only the proxies and the `properties.ts` consolidation. The two items here (qualified lead + audit/drift guard) were deliberately deferred to 1E to keep 1D shippable.
- Qualified-lead criteria are defined in `gtm.md` §4: *"Fired on `lead_form_success`; criteria are non-personal `email_domain`, non-empty `company`, and `track=enterprise`."* The existing `LeadForm` lives on enterprise-track pages (pricing/contact), so `track=enterprise` is implicit from form location and stamped as a property rather than collected as a UI field.
- The existing `apps/website/src/app/api/leads/route.ts` already calls `captureLeadConversion` after every successful lead submission, which fires `marketing:lead_form_success`. The new call site for `captureLeadQualified` is one line below it.
- The existing drift guard (`tools/posthog/taxonomy.spec.ts`) only catches the case where a dashboard insight references an event missing from the taxonomy. It does NOT catch the opposite direction (code fires an event not in taxonomy). The Spec 1C rename of `cockpit:recipe_start` → `cockpit:recipe_opened` was only caught because a dashboard insight still referenced the old name. Pure code drift would slip through.
- The `@ngaf/telemetry/shared` subpath gained the analytics helpers in Spec 1D. The personal-email blocklist is a natural addition to that surface.

## 3. Scope

**In scope:**

- **`libs/telemetry/src/shared/personal-email-domains.ts`** — `PERSONAL_EMAIL_DOMAINS: ReadonlySet<string>` (lowercase) plus `isPersonalEmailDomain(domain: string | null | undefined): boolean`. Domains: `gmail.com`, `yahoo.com`, `hotmail.com`, `outlook.com`, `live.com`, `icloud.com`, `me.com`, `mac.com`, `proton.me`, `protonmail.com`, `aol.com`, `gmx.com`, `mail.com`, `yandex.com`, `fastmail.com`, `msn.com`, `qq.com`, `163.com`, `126.com`. Predicate is case-insensitive.
- Spec + test for the predicate.
- Export from `@ngaf/telemetry/shared` (extend `libs/telemetry/src/shared/public-api.ts`).
- **`apps/website/src/lib/analytics/events.ts`** — append `marketingLeadQualified: 'marketing:lead_qualified'` to the `analyticsEvents` const.
- **`apps/website/src/lib/analytics/server.ts`** — new exported `captureLeadQualified({ email, company, sourcePage })` function. Returns early when `getEmailDomain(email)` is null, when `isPersonalEmailDomain(domain)` is true, or when `toSafeAnalyticsString(company, 200)` is undefined. Otherwise fires `marketing:lead_qualified` via `captureServerEvent` with properties `{ email_domain, company, source_page, track: 'enterprise' }`. Uses `getHashedEmailDistinctId(email)` for the distinct id (matches `captureLeadConversion`'s pattern).
- **`apps/website/src/app/api/leads/route.ts`** — one new `await captureLeadQualified({...})` call immediately after the existing `captureLeadConversion` call. Same input fields.
- **`apps/website/src/lib/analytics/server.spec.ts`** (new or extended) — unit tests for `captureLeadQualified` with `captureServerEvent` mocked: personal-domain email → no fire; missing company → no fire; both gates pass → exactly one fire with the right event name + properties.
- **`tools/posthog/code-taxonomy.spec.ts`** (new) — drift scanner. Walks the scan roots enumerated in §5.5. Uses regexes (not AST) to extract event-name literals. Resolves `analyticsEvents.<key>` references back to their literal via the events.ts map. Asserts every discovered name appears in `docs/gtm/taxonomy.md`'s namespaced-event regex. Test target stays `posthog-tools:test`.
- `tools/posthog/code-taxonomy.spec.ts` adheres to the same scan-and-assert shape as the existing `tools/posthog/taxonomy.spec.ts`. Both tests run in the same `posthog-tools:test` invocation.

**Out of scope:**

- Adding a `track` field to the `LeadForm` UI. The form's location (pricing/contact pages) implies enterprise. If a developer-track lead form ships later, the qualifier branches need a `track` parameter — call that out as a known follow-up.
- Notifications beyond the PostHog event. Resend + Loops already fire on every lead submission; no `[QUALIFIED]` tag, no Slack webhook in this scope.
- Disposable-email-domain detection (e.g. `disposable-email-domains` npm package) or Clearbit-style enrichment.
- Reverse-direction drift guard (taxonomy → code) — orphaned taxonomy entries are tolerated for staging.
- AST-based scanning. Regex is sufficient to catch >95% of real drift; if false negatives ever bite, we revisit.
- PostHog dashboard tiles / insights for qualified-lead conversion rate. The event needs to fire and accumulate data before a tile is useful; tile work belongs to a later spec.
- Per-event property schema validation. The taxonomy documents what properties an event can carry; this spec doesn't enforce that.

**Success criteria:**

- A submitted `LeadForm` with `email=jane@acme.com, company=Acme` produces both `marketing:lead_form_success` and `marketing:lead_qualified` in PostHog.
- The same form with `email=jane@gmail.com, company=Acme` produces only `marketing:lead_form_success` (no qualified).
- The same form with `email=jane@acme.com` and empty company produces only `marketing:lead_form_success`.
- Running `nx run posthog-tools:test` covers both the insights→taxonomy guard (existing) and the new code→taxonomy guard.
- Renaming any event name in code without updating taxonomy.md fails the new guard with a clear diff message.

## 4. Architecture

```
POST /api/leads {name, email, company, message}
  │
  ├─ NDJSON write + Resend email + Loops + audience              (existing, unchanged)
  │
  ├─ await captureLeadConversion({ email, company, sourcePage }) (existing)
  │      └─▶ marketing:lead_form_success
  │
  └─ await captureLeadQualified({ email, company, sourcePage })  (NEW)
         │
         ├─ getEmailDomain(email) → null         ─▶ return
         ├─ isPersonalEmailDomain(domain) === true ─▶ return
         ├─ toSafeAnalyticsString(company, 200) === undefined ─▶ return
         │
         └─▶ marketing:lead_qualified
             properties: { email_domain, company, source_page, track: 'enterprise' }
             distinctId: getHashedEmailDistinctId(email)

CI guard:
  nx run posthog-tools:test
    ├─ taxonomy.spec.ts            (existing — insights → taxonomy)
    └─ code-taxonomy.spec.ts       (NEW — code → taxonomy)
        ├─ scan apps/website/src
        ├─ scan apps/cockpit/src + instrumentation files
        ├─ scan libs/
        ├─ resolve analyticsEvents.<key> via events.ts
        └─ assert no name missing from taxonomy.md
```

## 5. Components

### 5.1 `libs/telemetry/src/shared/personal-email-domains.ts` (new)

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

Exported from `libs/telemetry/src/shared/public-api.ts` so `@ngaf/telemetry/shared` exposes both.

### 5.2 `apps/website/src/lib/analytics/events.ts` (modified)

```typescript
export const analyticsEvents = {
  // ...existing entries...
  marketingLeadQualified: 'marketing:lead_qualified',
} as const;
```

### 5.3 `apps/website/src/lib/analytics/server.ts` (modified)

Add an import:

```typescript
import { isPersonalEmailDomain } from '@ngaf/telemetry/shared';
```

Add a new exported function below `captureLeadConversion`:

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

### 5.4 `apps/website/src/app/api/leads/route.ts` (modified)

One-line addition immediately after the existing `captureLeadConversion` call:

```typescript
await captureLeadConversion({ email, company, sourcePage });
await captureLeadQualified({ email, company, sourcePage });   // NEW
```

Update the import at the top:

```typescript
import { captureLeadConversion, captureLeadQualified } from '../../../lib/analytics/server';
```

### 5.5 `tools/posthog/code-taxonomy.spec.ts` (new)

The scanner reads files, extracts event-name literals via four regex patterns, and resolves the `analyticsEvents.<key>` references through the events.ts map.

Patterns:
- `posthog.capture\(\s*['"]([^'"]+)['"]` — direct calls
- `\btrack\(\s*['"]([^'"]+)['"]` — wrapper calls
- `captureServerEvent\(\s*\{\s*[^}]*event:\s*['"]([^'"]+)['"]` — server-side
- `analyticsEvents\.([a-zA-Z]+)` — symbolic refs, resolved via the events map

The map is loaded by parsing `apps/website/src/lib/analytics/events.ts` (regex-extract the `analyticsEvents = {...}` literal — simpler than running TS).

Scan roots:
- `apps/website/src` (recursive)
- `apps/website/instrumentation-client.ts`
- `apps/cockpit/src` (recursive)
- `apps/cockpit/instrumentation-client.ts`
- `libs/cockpit-telemetry/src`
- `libs/telemetry/src` (for `@ngaf/telemetry/browser` and node service captures)

Excludes:
- `*.spec.ts`, `*.spec.tsx` — tests reference event names freely as fixtures
- `.next/`, `dist/`, `node_modules/`

The test asserts the difference set is empty with a clear message: `Events fired in code but missing from docs/gtm/taxonomy.md:\n<one per line>`.

## 6. Data flow

For a qualified lead:

1. User submits `LeadForm` with `email=jane@acme.com, company=Acme, message=…`.
2. `POST /api/leads` runs through the existing pipeline (NDJSON, Resend, Loops).
3. `captureLeadConversion` fires `marketing:lead_form_success` with `distinct_id: email_sha256:<hash>`.
4. `captureLeadQualified` runs:
   - `getEmailDomain('jane@acme.com')` → `'acme.com'`.
   - `isPersonalEmailDomain('acme.com')` → `false`.
   - `toSafeAnalyticsString('Acme', 200)` → `'Acme'`.
   - `getHashedEmailDistinctId('jane@acme.com')` → `email_sha256:<same hash>`.
   - Fires `marketing:lead_qualified` with the four properties.
5. PostHog Live Events shows both events for the same `distinct_id`. The taxonomy is happy.

For a personal-email lead:

1. User submits with `email=jane@gmail.com, company=Acme`.
2. Lead form pipeline runs identically up to step 3.
3. `captureLeadQualified` runs:
   - `getEmailDomain` → `'gmail.com'`.
   - `isPersonalEmailDomain('gmail.com')` → `true`. Return.
4. Only `marketing:lead_form_success` fires.

For the drift guard:

1. Developer adds `posthog.capture('marketing:newest_event', {...})` in `apps/website/src/components/foo.tsx` without updating taxonomy.md.
2. `nx run posthog-tools:test` runs.
3. `code-taxonomy.spec.ts` scans the file, finds `marketing:newest_event` not in taxonomy.md, fails the test with: `Events fired in code but missing from docs/gtm/taxonomy.md:\nmarketing:newest_event`.
4. Developer adds the row to taxonomy.md; test passes.

## 7. Error handling

- `captureLeadQualified` swallows all errors from `captureServerEvent` (which already does its own try/catch on `posthog-node`). No exceptions bubble out of the route handler.
- Empty / malformed input is handled by the early returns. The function is a no-op when called with bad data.
- The drift scanner reads file contents synchronously via `node:fs/promises.readFile`. If a scan root doesn't exist (e.g. file removed), the test skips it gracefully and only fails when an undocumented event is fired.

## 8. Testing strategy

- **Personal-email predicate:** unit tests cover blocklist hits (lowercase + uppercase), explicit non-personal domain, empty / null / undefined inputs. 5–6 assertions.
- **`captureLeadQualified`:** vitest with `captureServerEvent` mocked via `vi.fn()`. Cases:
  1. Personal domain → no call to `captureServerEvent`.
  2. Missing company → no call.
  3. Empty company string → no call.
  4. Both gates pass → exactly one call with the expected event name + properties (`track: 'enterprise'`).
  5. Distinct id pattern matches `email_sha256:<64 hex chars>`.
- **Drift scanner:** smoke test that the test runs cleanly against the current repo (i.e. there's no pre-existing drift after Spec 1D). Plus a synthetic-input table test where the scanner is called against a small in-memory file map — assert it correctly extracts and reports undocumented names.

## 9. Risks

- **Regex-based scanner has false negatives.** Event names built from template literals (e.g. `` posthog.capture(`marketing:${kind}_click`) ``) won't be caught. Such patterns are an anti-pattern per taxonomy.md ("Static event names. Vary via properties, not event names.") — flag them in code review.
- **Personal-email blocklist will need maintenance.** New free-mail providers emerge occasionally; each addition is a one-line PR.
- **Implicit `track: 'enterprise'`** — if a future developer-track lead form ships, the qualifier needs a `track` parameter. Documented as a follow-up.
- **The drift guard adds friction to renames.** Any event name change now requires updating taxonomy.md in the same PR. That's the point of the guard, but worth flagging for contributors.

## 10. Phases

1. **Phase 0 — Personal-email blocklist.** Create `personal-email-domains.{ts,spec.ts}`, export from `@ngaf/telemetry/shared`. (~3 commits.)
2. **Phase 1 — `captureLeadQualified` + wiring.** Add to `events.ts`, implement in `server.ts`, wire from `/api/leads/route.ts`, unit tests. (~3 commits.)
3. **Phase 2 — Drift guard.** New `tools/posthog/code-taxonomy.spec.ts` + tests. (~2 commits.)
4. **Phase 3 — Verification.** Run the full affected test suite and confirm no drift hits land. (No commit.)

## 11. Deliverables

- ☐ `libs/telemetry/src/shared/personal-email-domains.ts` + spec
- ☐ `libs/telemetry/src/shared/public-api.ts` exports the new function + constant
- ☐ `apps/website/src/lib/analytics/events.ts` gains `marketingLeadQualified`
- ☐ `apps/website/src/lib/analytics/server.ts` gains `captureLeadQualified`
- ☐ `apps/website/src/app/api/leads/route.ts` calls `captureLeadQualified`
- ☐ `apps/website/src/lib/analytics/server.spec.ts` (new or extended) covers the qualifier matrix
- ☐ `tools/posthog/code-taxonomy.spec.ts` + passes against current repo
- ☐ `nx run-many -t test -p telemetry,website,posthog-tools` green
