# PostHog GTM Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable website pageview, CTA, content, and lead conversion tracking for the AI startup GTM funnel using PostHog.

**Architecture:** Initialize PostHog once in the Next.js app with `instrumentation-client.ts`, expose a small typed tracking layer for client events, and capture business-critical conversions from API routes with `posthog-node`. Use automatic `$pageview` for route traffic, static custom event names for GTM actions, and PostHog dashboards/funnels for activation analysis.

**Tech Stack:** Next.js App Router, React 19, Nx, `posthog-js`, `posthog-node`, PostHog Cloud or self-hosted PostHog, Playwright for smoke coverage.

---

## Research Summary

- PostHog's current Next.js guide recommends `posthog-js` client setup in `instrumentation-client.ts`, `NEXT_PUBLIC_POSTHOG_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`, and `defaults: '2026-01-30'`.
- PostHog recommends a reverse proxy for better delivery because tracking blockers can intercept direct PostHog requests.
- PostHog's server-side Next.js guidance uses `posthog-node`, `flushAt: 1`, `flushInterval: 0`, and `await posthog.shutdown()` in short-lived server functions.
- PostHog recommends installing tracking on both marketing site and product app to follow a user from first visit through product use.
- PostHog best practices recommend lowercase snake_case event/property names, static event names, careful `distinct_id` design, and backend tracking when conversion accuracy matters.
- Current npm versions checked on 2026-05-02: `posthog-js@1.372.6`, `posthog-node@5.33.0`, `@posthog/react@1.9.0`.

Sources:
- https://posthog.com/docs/libraries/next-js
- https://posthog.com/docs/libraries/js
- https://posthog.com/docs/product-analytics/best-practices

## Current Repo Findings

- Website app: `apps/website`, Next.js `~16.1.6`, React `^19.0.0`, App Router.
- Global layout: `apps/website/src/app/layout.tsx`.
- No existing PostHog, GA, Segment, or Plausible integration found.
- Conversion APIs already exist:
  - `apps/website/src/app/api/leads/route.ts`
  - `apps/website/src/app/api/whitepaper-signup/route.ts`
  - `apps/website/src/app/api/newsletter/route.ts`
- GTM surfaces found:
  - Top nav, footer, and mobile menu links.
  - Landing page CTAs to docs, pilot, whitepapers, GitHub, npm, and cockpit.
  - Whitepaper gates/downloads for overview, angular, render, and chat papers.
  - Pricing enterprise lead form.
  - Docs search, copy prompt/code actions, tabs, and sidebar navigation.

## Analytics Scope

Track the website funnel from anonymous visitor to qualified lead:

1. Acquisition: pageviews, UTM/referrer preservation, landing page/category.
2. Engagement: docs search, docs copy, CTA clicks, external product interest clicks, whitepaper download intent.
3. Conversion: whitepaper signup, enterprise lead submission, newsletter signup.
4. Qualification: company, email domain, paper/product interest, source page, landing page, campaign properties.
5. Product handoff: outbound clicks to cockpit, npm, GitHub, and docs as intent signals.

Out of scope for the first implementation:

- Session replay default enablement.
- Heatmaps.
- A/B experiments or feature flags.
- Tracking inside cockpit/product app unless a matching PostHog token and domain plan are defined.
- Consent banner work beyond opt-out support unless legal requirements demand it.

## Event Taxonomy

Use static event names and variable properties.

Core PostHog event:

- `$pageview`: automatic pageview tracking.

Custom GTM events:

- `marketing:cta_click`
- `marketing:external_link_click`
- `marketing:whitepaper_download_click`
- `marketing:whitepaper_signup_submit`
- `marketing:whitepaper_signup_success`
- `marketing:whitepaper_signup_fail`
- `marketing:lead_form_submit`
- `marketing:lead_form_success`
- `marketing:lead_form_fail`
- `marketing:newsletter_signup_submit`
- `marketing:newsletter_signup_success`
- `marketing:newsletter_signup_fail`
- `docs:search_submit`
- `docs:search_result_click`
- `docs:copy_prompt_click`
- `docs:copy_code_click`
- `docs:tab_select`
- `docs:sidebar_section_toggle`

Shared properties:

- `source_page`: current pathname.
- `source_section`: stable section/component id where known.
- `destination_url`: clicked URL where applicable.
- `cta_id`: stable CTA id, e.g. `nav_get_started`, `hero_docs`, `footer_npm`.
- `cta_text`: visible label where stable.
- `surface`: `nav`, `mobile_nav`, `footer`, `home`, `pricing`, `docs`, `library_landing`, `solution`, `toast`.
- `library`: `agent`, `render`, `chat`, or `unknown`.
- `paper`: `overview`, `angular`, `render`, or `chat`.
- `email_domain`: extracted server-side for conversion events, never raw email in generic click events.
- `company`: only server-side on lead conversion events if acceptable for GTM reporting.
- `is_success`: boolean for submit results if a generic event wrapper is preferred.

Person and group properties:

- Use anonymous tracking for pageviews and clicks.
- On whitepaper/newsletter/lead success, call `identify` or server-side `capture` with email only if the team accepts email as the stable marketing identity. Otherwise use a generated lead id and set `email_domain`.
- Avoid sending free-form `message` to PostHog. It may contain sensitive customer data.
- Consider PostHog group analytics later for `company`, but do not add it in phase 1 unless company identity rules are clear.

## File Structure

- Create `apps/website/instrumentation-client.ts`
  - Initializes browser PostHog once, skips local/dev capture unless explicitly enabled, and sets core config.

- Create `apps/website/src/lib/analytics/events.ts`
  - Defines event name constants, property types, and allowed CTA/surface ids.

- Create `apps/website/src/lib/analytics/client.ts`
  - Exports `track`, `trackCtaClick`, `trackExternalLinkClick`, `trackWhitepaperDownloadClick`, and helpers that no-op safely when PostHog is unavailable.

- Create `apps/website/src/lib/analytics/server.ts`
  - Exports `captureServerEvent`, `captureLeadConversion`, `captureWhitepaperConversion`, and `captureNewsletterConversion`.
  - Wraps `posthog-node` and always calls `shutdown()`.

- Create `apps/website/src/lib/analytics/properties.ts`
  - Shared sanitizers for email domain, URL/path, paper id, UTM/campaign fields, and safe string truncation.

- Modify `apps/website/.env.example`
  - Add `NEXT_PUBLIC_POSTHOG_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`, and `NEXT_PUBLIC_POSTHOG_CAPTURE_LOCAL=false`.

- Modify `apps/website/package.json`
  - Add `posthog-js` and `posthog-node`.

- Modify high-value client components first:
  - `apps/website/src/components/shared/Nav.tsx`
  - `apps/website/src/components/shared/Footer.tsx`
  - `apps/website/src/components/shared/AnnouncementToast.tsx`
  - `apps/website/src/components/pricing/LeadForm.tsx`
  - `apps/website/src/components/landing/WhitePaperSection.tsx`
  - `apps/website/src/components/landing/WhitePaperGate.tsx`
  - `apps/website/src/components/landing/angular/AngularWhitePaperGate.tsx`
  - `apps/website/src/components/landing/render/RenderWhitePaperGate.tsx`
  - `apps/website/src/components/landing/chat-landing/ChatLandingWhitePaperGate.tsx`
  - `apps/website/src/components/docs/DocsSearch.tsx`
  - `apps/website/src/components/docs/CopyPromptButton.tsx`
  - `apps/website/src/components/docs/mdx/CodeBlock.tsx`

- Modify conversion API routes:
  - `apps/website/src/app/api/leads/route.ts`
  - `apps/website/src/app/api/whitepaper-signup/route.ts`
  - `apps/website/src/app/api/newsletter/route.ts`

- Test files:
  - Add unit tests for analytics property helpers if website test setup is available.
  - Add Playwright request interception assertions in `apps/website/e2e/website.spec.ts` for no crashes and event attempts when env is configured.

## Implementation Tasks

### Task 1: Add PostHog Dependencies and Environment Contract

**Files:**
- Modify: `apps/website/package.json`
- Modify: `apps/website/.env.example`
- Modify: root lockfile

- [ ] Add `posthog-js` and `posthog-node` to the website package dependencies.
- [ ] Run `npm install` from the repo root.
- [ ] Add env examples:
  - `NEXT_PUBLIC_POSTHOG_TOKEN=`
  - `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`
  - `NEXT_PUBLIC_POSTHOG_CAPTURE_LOCAL=false`
- [ ] Decide production host:
  - Direct: `https://us.i.posthog.com` or EU equivalent.
  - Preferred follow-up: reverse proxy path, e.g. `/ingest`, once hosting rules are known.
- [ ] Verify lockfile diff only contains dependency changes.

Run:

```bash
npm install
npx nx build website
```

Expected:

- Build succeeds.
- No analytics events are sent without token configuration.

### Task 2: Add Browser Initialization

**Files:**
- Create: `apps/website/instrumentation-client.ts`

- [ ] Create `instrumentation-client.ts`.
- [ ] Import `posthog-js`.
- [ ] Guard initialization behind `NEXT_PUBLIC_POSTHOG_TOKEN`.
- [ ] Skip localhost/127.0.0.1 unless `NEXT_PUBLIC_POSTHOG_CAPTURE_LOCAL=true`.
- [ ] Configure `api_host`, `defaults: '2026-01-30'`, and conservative capture settings.
- [ ] Leave pageview autocapture enabled for route/page tracking.
- [ ] Do not enable session replay by default in this phase.

Verification:

```bash
npx nx build website
```

Expected:

- Build succeeds.
- Generated client bundle contains no server-only env references.

### Task 3: Add Typed Client Tracking Layer

**Files:**
- Create: `apps/website/src/lib/analytics/events.ts`
- Create: `apps/website/src/lib/analytics/client.ts`
- Create: `apps/website/src/lib/analytics/properties.ts`

- [ ] Define event constants from the taxonomy above.
- [ ] Define TypeScript property types for shared GTM properties.
- [ ] Implement `track(event, properties)` that imports `posthog-js` and no-ops if unavailable.
- [ ] Implement helper wrappers for common click events.
- [ ] Implement safe helpers for path, destination URL, CTA ids, and paper ids.
- [ ] Avoid dynamic event names.

Verification:

```bash
npx nx build website
```

Expected:

- TypeScript accepts all event/property definitions.

### Task 4: Instrument Global Navigation and Footer

**Files:**
- Modify: `apps/website/src/components/shared/Nav.tsx`
- Modify: `apps/website/src/components/shared/Footer.tsx`

- [ ] Track desktop nav clicks with stable `cta_id`.
- [ ] Track mobile menu open/close only if needed; otherwise track final link clicks, not every drawer interaction.
- [ ] Track external links to GitHub, npm, and cockpit using `marketing:external_link_click`.
- [ ] Track `Get Started` with `marketing:cta_click`.
- [ ] Include `surface`, `source_page`, `destination_url`, and `cta_id`.

Verification:

```bash
npx nx build website
npx nx e2e website -- --grep "navigation"
```

Expected:

- Existing navigation still works.
- No hydration errors.

### Task 5: Instrument Lead and Whitepaper Client Flows

**Files:**
- Modify: `apps/website/src/components/pricing/LeadForm.tsx`
- Modify: `apps/website/src/components/shared/AnnouncementToast.tsx`
- Modify: `apps/website/src/components/landing/WhitePaperSection.tsx`
- Modify: `apps/website/src/components/landing/WhitePaperGate.tsx`
- Modify: `apps/website/src/components/landing/angular/AngularWhitePaperGate.tsx`
- Modify: `apps/website/src/components/landing/render/RenderWhitePaperGate.tsx`
- Modify: `apps/website/src/components/landing/chat-landing/ChatLandingWhitePaperGate.tsx`

- [ ] Track submit attempt before `fetch`.
- [ ] Track client-side success/fail after API result.
- [ ] Track direct PDF download clicks.
- [ ] Include `paper`, `surface`, `source_page`, and `cta_id`.
- [ ] Do not send raw email, name, company, or free-form message from client events.

Verification:

```bash
npx nx build website
```

Expected:

- Forms still submit.
- Failed requests still show existing UI errors.

### Task 6: Capture Server-Side Conversion Events

**Files:**
- Create: `apps/website/src/lib/analytics/server.ts`
- Modify: `apps/website/src/app/api/leads/route.ts`
- Modify: `apps/website/src/app/api/whitepaper-signup/route.ts`
- Modify: `apps/website/src/app/api/newsletter/route.ts`

- [ ] Add server PostHog client wrapper using `posthog-node`.
- [ ] Return early when token/host is missing.
- [ ] Capture conversion success after validation and persistence.
- [ ] Capture failure events only for validation or pipeline errors that help GTM analysis.
- [ ] Include `email_domain`, `company` for leads if approved, `paper`, and `source` fields.
- [ ] Never send lead `message` content.
- [ ] Always call `await posthog.shutdown()` after capture.

Verification:

```bash
npx nx build website
```

Expected:

- API routes compile.
- Routes continue to return existing response shapes.

### Task 7: Instrument Docs Intent Events

**Files:**
- Modify: `apps/website/src/components/docs/DocsSearch.tsx`
- Modify: `apps/website/src/components/docs/CopyPromptButton.tsx`
- Modify: `apps/website/src/components/docs/mdx/CodeBlock.tsx`
- Modify: `apps/website/src/components/docs/mdx/Tabs.tsx`
- Modify: `apps/website/src/components/docs/DocsSidebar.tsx`

- [ ] Track docs searches with query length, result count, and active library, not raw query by default.
- [ ] Track result clicks with destination path and library/section.
- [ ] Track prompt/code copy events with doc path, language, and block id if available.
- [ ] Track tab selection and sidebar toggles only when useful for content analysis.

Verification:

```bash
npx nx build website
```

Expected:

- No raw query/content is sent unless explicitly approved.
- Build succeeds with docs instrumentation in client components.

### Task 8: Add E2E Smoke Coverage

**Files:**
- Modify: `apps/website/e2e/website.spec.ts`

- [ ] Add a smoke test with PostHog env vars enabled against a harmless test token placeholder or mocked route.
- [ ] Intercept PostHog ingest host or reverse proxy path.
- [ ] Visit `/`, `/pricing`, and one docs page.
- [ ] Click one nav CTA and one docs copy/search action.
- [ ] Assert the app stays usable and attempted analytics payloads include expected event names.
- [ ] Avoid depending on real PostHog network in CI.

Run:

```bash
npx nx e2e website
```

Expected:

- E2E passes with network interception.

### Task 9: Configure PostHog Project for GTM Use

**Files:**
- No code changes unless dashboard definitions are stored later.

- [ ] Create PostHog project for website/product analytics.
- [ ] Add production token and host to deployment environment.
- [ ] Configure allowed domains.
- [ ] Configure data retention appropriate to GTM reporting.
- [ ] Decide whether person profiles are enabled for anonymous visitors or only identified leads.
- [ ] Add dashboards:
  - Website acquisition: pageviews, unique visitors, source/medium, landing page.
  - Funnel: `$pageview` -> CTA click -> whitepaper signup -> lead form success.
  - Content intent: docs pageviews, docs searches, copy events, library landing engagement.
  - Outbound product intent: cockpit, GitHub, npm clicks.
- [ ] Add saved funnels:
  - Homepage to lead.
  - Library landing to whitepaper signup.
  - Docs to external install/repo click.
  - Pricing to lead submission.

### Task 10: Release and Monitoring

**Files:**
- Modify docs only if deployment runbook exists.

- [ ] Deploy with token/host configured.
- [ ] Open PostHog Live Events.
- [ ] Visit production pages and trigger one safe test conversion if acceptable.
- [ ] Confirm `$pageview`, CTA, download, and server conversion events appear.
- [ ] Check event properties for accidental PII.
- [ ] Create a short analytics taxonomy note if the team wants future contributors to follow it.
- [ ] If docs/package guidance changes as part of the work, decide whether `npm run generate-agent-context` is needed. For analytics-only code, it should not be needed.

## Privacy and Compliance Notes

- Do not track raw form `message`, raw docs search query, or copied code content by default.
- Treat email, name, company, and free-form customer text as sensitive.
- If operating under stricter consent requirements, initialize with `opt_out_capturing_by_default: true` and wire a consent UI before sending events.
- If the site targets EU users materially, choose EU PostHog host or document the data transfer decision.
- Use backend conversion events for GTM truth; use frontend events for journey and interaction trends.

## Recommended First Milestone

Ship the smallest useful slice:

1. PostHog client initialization.
2. Automatic pageviews.
3. Nav/footer/primary CTA clicks.
4. Server-side lead, whitepaper, and newsletter conversion captures.
5. One funnel dashboard in PostHog.

This gives enough signal for GTM decisions without instrumenting every docs interaction on day one.
