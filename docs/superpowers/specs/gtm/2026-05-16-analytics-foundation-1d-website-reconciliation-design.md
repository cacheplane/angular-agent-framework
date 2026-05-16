---
workstream: analytics-foundation-1d-website-reconciliation
status: approved
owner: brian
phase: 0
spec: docs/superpowers/specs/gtm/2026-05-16-analytics-foundation-1d-website-reconciliation-design.md
plan: docs/superpowers/plans/gtm/2026-05-16-analytics-foundation-1d-website-reconciliation.md
parent: docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md
---

# Analytics Foundation 1D — Website Reconciliation (Design)

> Spec 1D of the Cacheplane GTM motion. Routes every first-party event through a per-app proxy so ad-blockers can't drop telemetry, and deduplicates the analytics guard logic shared by `apps/website` and `apps/cockpit`.

## 1. Goal

Two outcomes:

1. **First-party ingest end-to-end.** Every `marketing:*`, `docs:*`, `cockpit:*`, and `ngaf:*` event reaches PostHog via a same-origin Next.js route on a `*.cacheplane.ai` subdomain. The browser sees only `cacheplane.ai/api/ingest` or `cockpit.cacheplane.ai/api/ingest` — never `*.posthog.com` — so network-level ad-blockers stop dropping our telemetry.
2. **One source of truth for the capture guard.** `shouldCaptureAnalytics`, `isLocalhost`, and the shared helpers move into `@ngaf/telemetry`. The duplicate copies in `apps/website` and `apps/cockpit` get deleted.

## 2. Context

- Parent: `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md` §7 names 1D's deliverables as "audit complete; `marketing:lead_qualified` server enrichment ships; `/api/ingest` proxy live."
- The original meta-spec text scoped two additional items into 1D — the audit/drift guard and `marketing:lead_qualified` server enrichment. Both have been deliberately split out of 1D and will land in a separate follow-up spec. 1D's scope is therefore the proxy work plus the consolidation cleanup.
- The website's existing `/api/ingest` route (Spec 1B) is a **dedicated endpoint for `libs/telemetry/browser`** — consumer apps post a custom envelope (`{key, distinctId, event, properties}`) via raw `fetch()` and the route forwards via `posthog-node`. That path stays unchanged in 1D.
- `apps/website` and `apps/cockpit` use **`posthog-js`** directly, which posts PostHog's own batched/gzipped format to `/e/`, `/flags/`, `/static/array.js`, etc. — a different payload shape than the `libs/telemetry/browser` envelope. Routing posthog-js through the existing `/api/ingest` is not feasible without re-parsing PostHog's wire format.
- The correct ad-blocker-bypass pattern for posthog-js is **Next.js rewrites** that transparently forward `/ingest/*` to PostHog Cloud. This is PostHog's officially documented Next.js proxy pattern. It's a `next.config.js` change plus an `api_host` change in the posthog-js init call — no route handlers, no custom envelope, no allowlist filtering (PostHog Cloud rejects unknown event names server-side anyway).
- Spec 1C smoke (PR #357) confirmed end-to-end event capture works with direct ingest. 1D is the production-hardening step: route through first-party so ad-blockers don't silently corrupt the funnel.
- The cockpit iframe Angular apps are pure static builds (no server-side). They post cross-origin to the cockpit shell's `/ingest/*` rewrite endpoint. CORS headers are added in `next.config.js` via the `headers()` API.

## 3. Scope

**In scope:**

- Add `/ingest/*` rewrites to `apps/website/next.config.ts` forwarding to `us.i.posthog.com` and `us-assets.i.posthog.com` (for posthog-js's static asset fetch).
- Add `/ingest/*` rewrites to `apps/cockpit/next.config.ts` (same pattern) plus CORS headers on `/ingest/:path*` via the `headers()` config (allowlist `https://examples.cacheplane.ai` and `http://localhost:*`).
- Configure `posthog-js` in both shells to use the rewrite path:
  - `apps/website/instrumentation-client.ts` adds `api_host: '/ingest'`.
  - `apps/cockpit/instrumentation-client.ts` and `apps/cockpit/src/components/analytics-bootstrap.tsx` add `api_host: '/ingest'` and `ui_host: 'https://us.posthog.com'` so PostHog's session-replay/toolbar links still point at the real UI.
- Update `apps/cockpit/src/components/run-mode/run-mode.tsx` so the `cockpit_host` URL param defaults to the cockpit shell's `/ingest` (absolute URL, env-driven for prod, current origin for dev) instead of `https://us.i.posthog.com`. Iframes pick this up via the existing `cockpit_host` URL param channel and pass it to `posthog.init({ api_host })`.
- `apps/website/src/app/api/ingest/route.ts` is **unchanged**. It continues to serve `libs/telemetry/browser`'s custom envelope from consumer apps. The two proxy paths (`/api/ingest` for ngaf envelope; `/ingest/*` for posthog-js) live side-by-side, serving different contracts.
- Move `shouldCaptureAnalytics`, `isLocalhost` into `libs/telemetry/src/browser/properties.ts`. Move `toSafeAnalyticsString`, `getEmailDomain`, `normalizePostHogHost`, `getSourcePage` into `libs/telemetry/src/shared/properties.ts` (already exists). Export from the respective `public-api.ts`.
- Both apps update imports to consume from `@ngaf/telemetry/browser` (or `@ngaf/telemetry/shared`). The duplicated `apps/website/src/lib/analytics/properties.ts` and `apps/cockpit/src/lib/analytics/properties.ts` files are deleted in the same PR (no transitional shim — all consumers update at once). The remaining app-specific surfaces in `apps/<x>/src/lib/analytics/` (`client.ts`, `events.ts`, `distinct-id.ts`, etc.) are unchanged.
- New tests:
  - `apps/cockpit/next-config.spec.ts` (or `next.config.test.ts`) — vitest test that imports the config and verifies the rewrites + headers shape (paths, destinations, CORS allowlist).
  - Same for `apps/website/next-config.spec.ts`.
  - The moved `properties.spec.ts` tests follow the code into `libs/telemetry`.
  - Existing `apps/website/src/app/api/ingest/route.ts` tests are untouched.
- `.env.example` documents new env vars: `NEXT_PUBLIC_COCKPIT_INGEST_HOST` (the cockpit proxy's absolute URL for iframes to target — defaults to current origin in dev). Existing `NEXT_PUBLIC_COCKPIT_POSTHOG_HOST` remains for backward compatibility but is no longer set by default.

**Out of scope:**

- Audit/drift guard between taxonomy and code fire sites. Deferred to a follow-up spec.
- `marketing:lead_qualified` server enrichment and qualification rules. Deferred to a follow-up spec.
- Server-side event signing or per-tenant proxy keys. The shared `PUBLIC_INGEST_KEY` constant stays as a soft anti-abuse measure; defense against determined attackers is not a goal.
- Changes to the consumer-facing `@ngaf/telemetry` trust contract or its README.
- Dashboard or insight changes (no taxonomy churn in this spec).

**Success criteria:**

- DevTools network panel on `cacheplane.ai` and `cockpit.cacheplane.ai` shows no requests to `*.posthog.com` for `marketing:*`, `docs:*`, or `cockpit:*` events. All capture traffic goes to `*.cacheplane.ai/api/ingest`.
- DevTools network panel on `examples.cacheplane.ai` (cockpit iframes) shows cross-origin POSTs to `cockpit.cacheplane.ai/api/ingest`, returning 200 with proper `Access-Control-Allow-Origin`.
- `apps/website/src/lib/analytics/properties.ts` and `apps/cockpit/src/lib/analytics/properties.ts` are deleted (or shrunk to a thin re-export shim if a transitional period is needed).
- All existing event captures still land in PostHog with the same event names, properties, and distinct_id (cross-frame correlation unchanged).
- `npx nx run-many -t test -p website,cockpit,telemetry` is green.

## 4. Architecture

```
Browser (cacheplane.ai)                Browser (cockpit.cacheplane.ai)        Browser (examples.cacheplane.ai, iframe)
  │  posthog-js                           │  posthog-js                          │  posthog-js
  │  api_host: '/ingest'                  │  api_host: '/ingest'                 │  api_host: <cockpit_host URL param>
  │                                       │                                      │
  ▼                                       ▼                                      ▼  (cross-origin → CORS-allowed)
cacheplane.ai/ingest/:path*            cockpit.cacheplane.ai/ingest/:path*    cockpit.cacheplane.ai/ingest/:path*
  next.config.ts rewrite                  next.config.ts rewrite                 (same as middle column)
       │                                       │                                  ▲
       ▼                                       ▼                                  │
   us.i.posthog.com/:path*                us.i.posthog.com/:path*                 │
       (and us-assets.i.posthog.com for /static/)                                 │
       │                                       │                                  │
       └───────────────────┬───────────────────┘──────────────────────────────────┘
                           │
                           ▼
                    PostHog Cloud  (server-side; never visible to ad-blockers)

Side channel (unchanged):
Consumer apps using libs/telemetry/browser
  │  raw fetch POST
  ▼
cacheplane.ai/api/ingest    →    posthog-node.capture()    →    PostHog Cloud
  (custom envelope path, ngaf:* only, Spec 1B)
```

## 5. Components

### 5.1 `libs/telemetry/src/browser/properties.ts` (new)

Exports the two functions both shells need:

```typescript
export interface ShouldCaptureInput {
  token: string | undefined;
  captureLocal: boolean;
  host: string | undefined;
}

export function shouldCaptureAnalytics(input: ShouldCaptureInput): boolean { ... }
export function isLocalhost(host: string | undefined): boolean { ... }
```

Re-exported from `libs/telemetry/src/browser/public-api.ts` so both shells consume via `import { shouldCaptureAnalytics } from '@ngaf/telemetry/browser';`. Tests move from the apps into `libs/telemetry/src/browser/properties.spec.ts` (jsdom). No new tests required beyond the relocation — the existing 4 cockpit + 5 website tests cover the matrix.

### 5.2 `libs/telemetry/src/shared/properties.ts` (extend)

The shared subpath already exists. Move the cross-runtime helpers here:

```typescript
export function toSafeAnalyticsString(value: unknown, maxLength = 200): string | undefined { ... }
export function getEmailDomain(email: unknown): string | null { ... }
export function getSourcePage(value: unknown): string { ... }
export function normalizePostHogHost(host: string | undefined): string { ... }
```

The website's server-side code (`apps/website/src/lib/analytics/server.ts`, `apps/website/src/app/api/leads/route.ts`, etc.) updates imports to `@ngaf/telemetry/shared`.

### 5.3 `apps/cockpit/next.config.ts` (modified)

Add `rewrites()` and `headers()` to the existing config:

```typescript
const nextConfig: WithNxOptions = {
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
```

For prod, `NEXT_PUBLIC_COCKPIT_IFRAME_ORIGIN=https://examples.cacheplane.ai`. For dev, the env var is unset and the wildcard `*` is acceptable for local smoke. (Next.js's `headers()` config doesn't support runtime-derived origin reflection — for stricter per-request origin matching we'd need a middleware, which we defer to a follow-up if multi-origin support becomes necessary.)

### 5.4 `apps/website/next.config.ts` (modified)

Same rewrites pattern. No CORS — the website serves no cross-origin consumers of `/ingest`:

```typescript
const nextConfig: WithNxOptions = {
  nx: {},
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/:path*',        destination: 'https://us.i.posthog.com/:path*' },
    ];
  },
  skipTrailingSlashRedirect: true,
};
```

The existing `/api/ingest` route handler is untouched.

### 5.5 PostHog client config

**`apps/website/instrumentation-client.ts`:**

```typescript
posthog.init(token!, {
  api_host: '/ingest',
  ui_host: 'https://us.posthog.com',
  defaults: '2026-01-30',
  capture_pageview: true,
  person_profiles: 'always',
});
```

**`apps/cockpit/instrumentation-client.ts` + `apps/cockpit/src/components/analytics-bootstrap.tsx`:**

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

### 5.6 `apps/cockpit/src/components/run-mode/run-mode.tsx`

`buildIframeSrc` currently sets `cockpit_host` from `NEXT_PUBLIC_COCKPIT_POSTHOG_HOST`. Update to use `NEXT_PUBLIC_COCKPIT_INGEST_HOST` (new env var), falling back to the current origin's `/ingest` for dev:

```typescript
const ingestHost =
  process.env.NEXT_PUBLIC_COCKPIT_INGEST_HOST
    ?? `${window.location.origin}/ingest`;
if (ingestHost) url.searchParams.set('cockpit_host', ingestHost);
```

The Angular harness (`libs/cockpit-telemetry/src/lib/distinct-id.ts:readCockpitConfigFromIframe` and `cockpit-telemetry.service.ts`) already plumbs `posthogHost` to `posthog.init({ api_host })`. No library-side change needed.

## 6. Data flow

For a single `cockpit:chat_first_message` event fired from an iframe:

1. User submits first chat message in `examples.cacheplane.ai/streaming` (iframe).
2. `CockpitTelemetryService` observes `CHAT_LIFECYCLE.firstMessageSent` flip and calls `posthog.capture('cockpit:chat_first_message', { capability: 'streaming' })`.
3. `posthog-js` POSTs to `${cockpit_host}/e/` — where `cockpit_host` is `https://cockpit.cacheplane.ai/ingest` (read from URL param at init).
4. Next.js rewrites the request server-side to `https://us.i.posthog.com/e/`, preserving the body, headers, and gzip compression. CORS headers are attached to the response from `headers()` config.
5. Event lands in PostHog with `distinct_id: cockpit_<uuid>` matching the parent shell's session.

For a `marketing:cta_click` from the website:

1. User clicks tracked CTA on `cacheplane.ai/pricing`.
2. `track('marketing:cta_click', {...})` invokes `posthog.capture(...)`.
3. `posthog-js` POSTs to `/ingest/e/` (relative URL, same-origin).
4. Next.js rewrites to `https://us.i.posthog.com/e/`.
5. Event lands in PostHog.

For posthog-js's initial bootstrap (config + flags + array.js):

1. `posthog-js` fetches `${api_host}/static/array.js` and `${api_host}/flags/?…`.
2. Next.js rewrites: `/ingest/static/:path*` → `us-assets.i.posthog.com/static/:path*`, `/ingest/:path*` → `us.i.posthog.com/:path*`.
3. Bootstrap completes; subsequent captures use the same rewrite chain.

## 7. Error handling

- **Rewrites are transparent.** Next.js forwards the request as-is and returns PostHog Cloud's response as-is. Any 4xx/5xx from PostHog (rate limiting, bad token, etc.) reaches the client unchanged.
- **PostHog cloud down:** posthog-js has its own retry/queue. The rewrite layer adds nothing.
- **CORS on cockpit's `/ingest`:** unknown origins still get the configured `Access-Control-Allow-Origin`. The current spec uses a single allowlisted origin (or `*` for dev); stricter per-request origin matching would require middleware, deferred unless multi-origin support becomes necessary.
- **Silent fail at the source:** the `client.ts` `track()` wrapper in each app already wraps `posthog.capture()` in `try/catch`. No change.

## 8. Testing strategy

- **Unit (jsdom):** properties tests move with the code into `libs/telemetry`. Same matrix as today.
- **Config (vitest):** for each `next.config.ts`:
  - Import the config module.
  - Assert `rewrites()` returns the two expected `{ source, destination }` pairs with `us.i.posthog.com` / `us-assets.i.posthog.com`.
  - Cockpit-only: assert `headers()` returns the CORS shape with the four expected headers.
- **Integration (manual, post-deploy):** load each cockpit + website page, open DevTools network, confirm no `*.posthog.com` requests appear and `*.cacheplane.ai/ingest/*` requests return 200.

## 9. Risks

- **Rewrites run at the edge.** Vercel rewrites are essentially free at the platform level — no per-request lambda invocation. Latency is minimal (a few ms). Scaling concerns negligible.
- **PostHog SDK assumes paths it can append.** posthog-js fetches `/static/array.js` from the api_host's static subpath. The two-rewrite pattern (`/ingest/static/*` first, `/ingest/*` second) covers this. If PostHog ever adds new top-level paths (rare), the rewrite chain may need updating.
- **CORS coverage.** Cockpit's `/ingest/*` allows a single origin by env var. If we add additional iframe origins (e.g., `staging.examples.cacheplane.ai`), we need either a middleware-based origin reflection or comma-separated allowlist. Out of scope for v1.
- **Existing PostHog dashboards keep working** because the events land identically in PostHog regardless of routing. No taxonomy or insight change needed.

## 10. Phases

1. **Phase 0 — Consolidate `properties.ts`.** Move helpers into `libs/telemetry`. Update both apps to import from there. Delete duplicate sources. Tests follow. (~6 commits.)
2. **Phase 1 — Website `/ingest` rewrites + posthog-js config.** Add rewrites to `apps/website/next.config.ts`. Configure `posthog-js` with `api_host: '/ingest'`. Add config tests. (~3 commits.)
3. **Phase 2 — Cockpit `/ingest` rewrites + CORS + posthog-js config.** Add rewrites + headers to `apps/cockpit/next.config.ts`. Configure `posthog-js`. Update `run-mode.tsx` to point iframes at the rewrite path. Add config tests. (~4 commits.)
4. **Phase 3 — `.env.example` + dev docs.** Document `NEXT_PUBLIC_COCKPIT_INGEST_HOST` and `NEXT_PUBLIC_COCKPIT_IFRAME_ORIGIN`. Update cockpit's smoke procedure to use the rewrite path. (~2 commits.)

## 11. Deliverables

- ☐ `libs/telemetry/src/browser/properties.ts` + spec
- ☐ `libs/telemetry/src/shared/properties.ts` extended + spec
- ☐ `apps/website/next.config.ts` rewrites + config test
- ☐ `apps/website/instrumentation-client.ts` updated to `api_host: '/ingest'`
- ☐ `apps/cockpit/next.config.ts` rewrites + headers + config test
- ☐ `apps/cockpit/instrumentation-client.ts` + `analytics-bootstrap.tsx` updated
- ☐ `apps/cockpit/src/components/run-mode/run-mode.tsx` env-driven `cockpit_host` defaults to `/ingest`
- ☐ `apps/website/src/lib/analytics/properties.ts` deleted
- ☐ `apps/cockpit/src/lib/analytics/properties.ts` deleted
- ☐ Server-side imports updated to consume from `@ngaf/telemetry/shared` (`apps/website/src/lib/analytics/server.ts`, `apps/website/src/app/api/leads/route.ts`, etc.)
- ☐ `.env.example` documents `NEXT_PUBLIC_COCKPIT_INGEST_HOST` + `NEXT_PUBLIC_COCKPIT_IFRAME_ORIGIN`
- ☐ All affected projects' tests green
- ☐ `apps/website/src/app/api/ingest/route.ts` is **unchanged** (libs/telemetry/browser path stays as-is)
