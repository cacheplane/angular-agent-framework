---
workstream: positioning-and-risks
status: approved
owner: brian
phase: 1
spec: docs/superpowers/specs/gtm/2026-05-16-positioning-and-risks-design.md
plan: docs/superpowers/plans/gtm/2026-05-16-positioning-and-risks.md
parent: docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md
---

# Spec 2 — Positioning & Risks (Design)

> Replaces the homepage hero with the locked Direction-A copy, stands up the `/contact` enterprise CTA destination, applies four risk-cleanup copy changes, and wires the two CTA tracks so the developer/enterprise funnel split becomes measurable in PostHog.

## 1. Goal

Deliver Phase 1's developer-clarity foundation:

1. Homepage hero communicates the durable category claim ("Agent UI for Angular") in 30 seconds with a working CTA fork (developer / enterprise).
2. `/contact` exists as the enterprise CTA destination per the locked Direction A.v2 spec.
3. The four risk-cleanup copy changes are deployed everywhere they appear: telemetry phrasing, real Angular compatibility matrix, A2UI v0.9, "Angular Agent Framework" → "Agent UI for Angular" category sweep.
4. Both CTA tracks emit `marketing:cta_click` with a stable `cta_id` so the developer-funnel and enterprise-funnel dashboards from Spec 1A populate.

## 2. Context

- Parent: `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md` §6 (Phase 1 critical path: 0 → 1 → 2 → 3 → 4).
- Locked content lives in `docs/gtm/messaging.md`:
  - **Positioning statement** (durable).
  - **Hero copy** (H1, subhead, primary CTA, secondary CTA, proof row, subline) — locked.
  - **Contact page (Direction A.v2)** — locked.
  - **Risk-cleanup copy changes (Spec 2)** — 4 items, locked.
- The current Hero in `apps/website/src/components/landing/Hero.tsx` reads "Build fullstack agentic Angular apps" — superseded by the locked H1.
- The `/contact` route does not exist. The existing `LeadForm` lives on `/pricing` and reuses the `/api/leads` route handler.
- Spec 1E shipped `captureLeadQualified` server-side. `/api/leads` already calls it after `captureLeadConversion`. Spec 2's contact form will POST to the same endpoint.
- The repo's "Chat" memory note (`feedback_chat_prefix_substring_overlap.md`) warns against blind `replace_all` on overlapping substrings; "Angular Agent Framework" is a longer unique phrase, so the same risk does not apply — but a per-file review remains the right discipline.

### Deviation from messaging.md (call-out)

`docs/gtm/messaging.md` Contact page §"Fields" locks: *"email + free-text body. No stack dropdown, no company size, no 'how did you hear.'"* This spec **expands** the field list to **email (required) + name, company, message (all optional)** so Spec 1E's `captureLeadQualified` gate (which requires `company` to fire) still works for contact-form submissions. The form remains a single short block — no progressive disclosure, no qualification dropdowns — but the optional fields, when filled, feed enterprise qualification. The messaging.md doc gets updated in this PR to reflect the new locked field set.

## 3. Scope

**In:**

- **Hero rewrite** (`apps/website/src/components/landing/Hero.tsx`):
  - Eyebrow: `Agent UI for Angular · MIT` (replaces `Angular Agent Framework · MIT`).
  - H1: `Ship production agent UIs in Angular.`
  - Subhead: `Signal-native chat, threads, interrupts, tool progress, and generative UI for LangGraph, AG-UI, and A2UI. MIT-licensed, self-hostable, app telemetry off by default, no React rewrite.`
  - Primary CTA: button label `Install @ngaf/chat`; click copies `npm install @ngaf/chat` to clipboard and fires `marketing:cta_click` with `cta_id: 'hero_install'`, `track: 'developer'`, `surface: 'home'`. Brief visual confirmation on copy (existing `Pill`/toast pattern if available, otherwise a label flip for ~1.5s).
  - Secondary CTA: button label `Talk to our engineers`; routes to `/contact?source=home_hero&track=enterprise` and fires `marketing:cta_click` with `cta_id: 'hero_talk_to_engineers'`, `track: 'enterprise'`, `surface: 'home'`.
  - Proof row: `MIT · Angular-native Signals · LangGraph + AG-UI · A2UI-compatible · Self-hostable · App telemetry off by default`.
  - Subline under proof row: `Not another backend agent runtime. Keep LangGraph, Genkit, Mastra, CrewAI, or your own service. Cacheplane solves the Angular UI layer.`

- **New `/contact` route** (`apps/website/src/app/contact/page.tsx`):
  - Server component. Page metadata (title, OG, twitter).
  - Headline: `Talk to an engineer.`
  - Subhead: `Tell us what you're shipping. We'll reply within one business day — usually with code, not a calendar invite.`
  - SLA card: `Brian or someone on the team replies personally — from a real inbox, not noreply@. We read every message.`
  - `<ContactForm />` (new client component): email (required) + name (optional) + company (optional) + message (optional, textarea) + hidden attribution fields populated from URL params + `document.referrer`. POSTs to `/api/leads`.
  - `<GitHubStarsPill />` (new server component): fetches `https://api.github.com/repos/cacheplane/angular-agent-framework` once per build / 24h ISR; renders a pill with the star count + link. Graceful fallback to a "GitHub" pill (no count) on fetch failure.
  - Alt-channel row below form: `docs · GitHub issues · Discord` (three links).
  - On successful submit: inline success message; no redirect.

- **Loosen `/api/leads` validation** (`apps/website/src/app/api/leads/route.ts`):
  - Require email only. `name`, `company`, `message` all optional.
  - Existing `LeadForm` on `/pricing` continues to send `name`; new contact form sends what users fill in.
  - Resend notification body adapts: when `name` absent, subject becomes `New lead: <email>` instead of `New lead: <name> at <company>`. Body still shows whichever fields are present.

- **Four risk-cleanup copy changes (full-repo sweep):**
  - **Telemetry phrasing.** Sweep `apps/website` + `gtm.md` + `libs/*/README.md` for "No telemetry" (and close variants) → `App telemetry off by default` with a link to `libs/telemetry/README.md`. Per-file review, no blind replace.
  - **Compatibility matrix.** Replace the "All Angular versions" claim on `/pricing` with a new `<CompatibilityMatrix />` component:
    - Supported: Angular 20, 21 (matches `peerDependencies: "^20.0.0 || ^21.0.0"`)
    - Experimental: (none — empty row labeled "—")
    - Planned: Angular 22 (next major)
    - Unsupported: Angular ≤19
  - **A2UI v0.9 sweep.** "A2UI v1" → "A2UI v0.9-compatible" everywhere across the full repo. Includes website copy, MDX docs, READMEs, `gtm.md`, package descriptions.
  - **Category sweep.** "Angular Agent Framework" → "Agent UI for Angular" across the full repo. Excludes CHANGELOG.md and release-note files (historical record). Excludes class/identifier names (none exist). Per-file review.

- **`marketing:cta_click` `cta_id` typing:** export a `CtaId` string union from `apps/website/src/lib/analytics/events.ts` and tighten `AnalyticsProperties.cta_id` to that union. Initial members: `'hero_install' | 'hero_talk_to_engineers'`. Future CTAs extend this list.

- **`docs/gtm/messaging.md` update:** the Contact page §"Fields" line gets updated from "email + free-text body" to "email (required) + name, company, message (all optional)". The locked status remains; the field set is the only revision.

**Out:**

- Comparison pages (Spec 3).
- Cockpit activation recipes (Spec 4).
- New events. The `cta_id` property does the slicing on the existing `marketing:cta_click`.
- Adding a hero CTA tracking insight to PostHog. The dashboards-as-code pipeline (Spec 1A) handles tile-level work; this spec only ensures the underlying event property lands cleanly.
- Replacing or styling other landing sections (proof rows below hero, differentiator section, etc.). Codex PR #352 polished those; we keep them.
- Repo rename or README badge updates beyond the category-sweep text replacements already enumerated.

## 4. Components

### 4.1 Hero (`apps/website/src/components/landing/Hero.tsx`)

Replace H1, subhead, eyebrow, both buttons, proof row, and add the subline. Layout, grid, and right-column collage from PR #352 stay intact.

```tsx
'use client';
import { useCallback, useState } from 'react';
import { track } from '../../lib/analytics/client';
import { analyticsEvents } from '../../lib/analytics/events';
// ...existing imports

function PrimaryInstallButton() {
  const [copied, setCopied] = useState(false);
  const onClick = useCallback(async () => {
    track(analyticsEvents.marketingCtaClick, {
      cta_id: 'hero_install',
      track: 'developer',
      surface: 'home',
    });
    try {
      await navigator.clipboard?.writeText('npm install @ngaf/chat');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silent fail — focus stays on event firing
    }
  }, []);
  return (
    <Button variant="primary" size="lg" onClick={onClick}>
      {copied ? 'Copied ✓' : 'Install @ngaf/chat'}
    </Button>
  );
}
```

Secondary CTA is a plain `<Button href="/contact?…">` with the same `track(...)` call.

### 4.2 `/contact` route (`apps/website/src/app/contact/page.tsx`)

Server component:

```tsx
import { ContactForm } from '../../components/contact/ContactForm';
import { GitHubStarsPill } from '../../components/contact/GitHubStarsPill';

export const metadata = {
  title: 'Talk to an engineer — Cacheplane',
  description: "Tell us what you're shipping. We'll reply within one business day.",
};

export default function ContactPage() {
  return (
    <Section surface="canvas">
      <Container>
        <h1>Talk to an engineer.</h1>
        <p>Tell us what you're shipping. We'll reply within one business day — usually with code, not a calendar invite.</p>
        <SlaCard>Brian or someone on the team replies personally — from a real inbox, not noreply@. We read every message.</SlaCard>
        <ContactForm />
        <GitHubStarsPill />
        <AltChannelRow />
      </Container>
    </Section>
  );
}
```

### 4.3 `ContactForm` (`apps/website/src/components/contact/ContactForm.tsx`)

Client component. Reads URL params via `useSearchParams()` and `document.referrer`. Posts JSON to `/api/leads`. Fields:

- `email` — required, type=email
- `name` — optional, type=text, placeholder "Optional"
- `company` — optional, type=text, placeholder "Optional — helps us route your request"
- `message` — optional, textarea, placeholder "What are you shipping?"

Hidden attribution fields included in the POST body:
- `source_page` (= `useSearchParams().get('source') ?? 'contact_direct'`)
- `track` (= `useSearchParams().get('track') ?? 'enterprise'`)
- `cta_id` (= `useSearchParams().get('cta_id') ?? null`)
- `paper` (= `useSearchParams().get('paper') ?? null`)
- `referrer_host` (= sanitized hostname from `document.referrer`)

On submit, fire `marketing:lead_form_submit` then POST; on 2xx, fire `marketing:lead_form_success` and show inline success block. On non-2xx, fire `marketing:lead_form_fail` and show error.

### 4.4 `GitHubStarsPill` (`apps/website/src/components/contact/GitHubStarsPill.tsx`)

Server component (`async function`). Fetches via the helper `getGitHubStars()` (next §). Renders:

- `<Pill>★ {count} on GitHub</Pill>` when count available.
- `<Pill>GitHub</Pill>` (no number) on fetch failure.

Both link to `https://github.com/cacheplane/angular-agent-framework`.

### 4.5 `getGitHubStars` helper (`apps/website/src/lib/github.ts`)

```typescript
export async function getGitHubStars(repo = 'cacheplane/angular-agent-framework'): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      next: { revalidate: 86400 }, // 24h ISR
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = await res.json() as { stargazers_count?: number };
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null;
  } catch {
    return null;
  }
}
```

### 4.6 `CompatibilityMatrix` (`apps/website/src/components/pricing/CompatibilityMatrix.tsx`)

Pure-render component, no props (initial v1). Four-row table with the conservative content from Q1. Renders inside an Eyebrow-labeled card on `/pricing`, replacing the "All Angular versions" claim.

### 4.7 `cta_id` typing (`apps/website/src/lib/analytics/events.ts`)

Add:

```typescript
export type CtaId =
  | 'hero_install'
  | 'hero_talk_to_engineers';
```

Tighten `AnalyticsProperties.cta_id`:

```typescript
cta_id?: CtaId;
```

(Existing callers using bare strings will fail typecheck; the only caller today is the toast/footer/landing-CTA pattern — we update those to use the union or extend the union with their values.)

### 4.8 `/api/leads` loosening

Change the validation at the top of `POST`:

```typescript
// before
if (!name || !email) {
  return NextResponse.json({ error: 'name and email required' }, { status: 400 });
}

// after
if (!email) {
  return NextResponse.json({ error: 'email required' }, { status: 400 });
}
```

Resend notification subject becomes `New lead: ${name || email}${company ? ` at ${company}` : ''}`. The email body template handles missing optional fields gracefully.

## 5. Data flow

Developer track:

1. User on `/` clicks `Install @ngaf/chat` in the hero.
2. `marketing:cta_click` fires with `{cta_id: 'hero_install', track: 'developer', surface: 'home'}`.
3. `npm install @ngaf/chat` copies to clipboard; button label flips to "Copied ✓" for 1.5s.
4. PostHog filters `marketing:cta_click` by `cta_id=hero_install` to count developer-track entries.

Enterprise track:

1. User on `/` clicks `Talk to our engineers`.
2. `marketing:cta_click` fires with `{cta_id: 'hero_talk_to_engineers', track: 'enterprise', surface: 'home'}`.
3. Browser navigates to `/contact?source=home_hero&track=enterprise`.
4. `ContactForm` reads those params, includes them as hidden fields.
5. User submits with `email=jane@acme.com, company=Acme`.
6. POST `/api/leads` → existing pipeline (Resend, Loops, NDJSON) → `captureLeadConversion` fires `marketing:lead_form_success` → `captureLeadQualified` fires `marketing:lead_qualified` (Spec 1E, gate passes).
7. Enterprise-funnel dashboard tile populates.

## 6. Error handling

- **Clipboard API absent or denied:** the event still fires; only the visual confirmation is skipped. The user can fall back to the docs page where the install command is also shown.
- **GitHub stars fetch failure:** pill renders as "GitHub" (no count); build does not fail.
- **Contact form submit failure:** form shows an inline error with a retry button; `marketing:lead_form_fail` fires with the HTTP status.
- **Bot submissions:** the `/api/leads` route stays as-is; existing rate-limiting / abuse mitigations apply at the platform layer (Vercel) for v1.

## 7. Testing

- **Vitest unit tests:**
  - `Hero.spec.tsx` — primary CTA fires the expected event + copies the install command (clipboard mocked); secondary CTA fires its event and the href matches.
  - `ContactForm.spec.tsx` — happy-path submit (email-only minimum), full-fields submit (event payload includes hidden attribution fields), submit failure path (network error fires `marketing:lead_form_fail`).
  - `getGitHubStars.spec.ts` — happy-path returns number; non-2xx returns null; thrown fetch returns null.
  - `CompatibilityMatrix.spec.tsx` — renders four buckets with the conservative content.
- **No new code → taxonomy drift** — `cta_id` is a property not an event; the drift guard (Spec 1E) doesn't need to know about it. The taxonomy.md "Shared properties" section already documents `cta_id` as a stable string; we tighten the type in code without changing taxonomy.
- **No new dashboards.** The existing developer-funnel + enterprise-funnel dashboards from Spec 1A consume `marketing:cta_click` and `marketing:lead_qualified` — both already wired.
- **Pre-existing e2e tests** on the landing page rely on stable section ids (PR #358 fix); copy changes don't break them.

## 8. Risks

- **Locked copy may need a tweak after seeing it in context.** The hero subhead is long; if it visually crowds the layout, accept a 1-line word reflow but preserve the literal words. Any actual copy change re-routes through messaging.md.
- **Category sweep blast radius.** "Angular Agent Framework" appears in ~10–20 files. Per-file review is the discipline; `replace_all` is forbidden. Worst-case mistake: a sentence reads awkwardly post-replacement. Mitigated by reading each diff hunk.
- **CHANGELOG / release notes** must NOT be swept (historical record). The grep step excludes `CHANGELOG.md` and `release-notes/`.
- **`/api/leads` validation change** is API-breaking in the sense that callers expecting the 400-on-missing-name will see successes. The only known caller is the existing `LeadForm`, which always sends a name — so no behavioral change in practice.
- **Spec 1E qualification gate still requires company.** Contact-form leads without a company will fire `marketing:lead_form_success` but NOT `marketing:lead_qualified`. That's the explicit trade-off (see §3 deviation call-out).

## 9. Phases

1. **Phase 0 — Sweeps.** Three commits, one per sweep theme (telemetry phrasing, A2UI v0.9, category rename). Mechanical, per-file review.
2. **Phase 1 — Hero.** `cta_id` typing → new `Hero` content + clipboard CTA + tracking + unit tests (~4 commits).
3. **Phase 2 — `/contact` route.** ContactForm + GitHubStarsPill + `getGitHubStars` helper + alt-channel row + page composition + unit tests (~5 commits).
4. **Phase 3 — Pricing matrix.** `CompatibilityMatrix` + pricing-page edit + unit tests (~2 commits).
5. **Phase 4 — `/api/leads` loosen + messaging.md update + verification.** Loosen validation, update Resend subject template, update messaging.md to reflect the new contact-form field set (~2 commits).
6. **Phase 5 — Verification** (no commit). Full test sweep, manual smoke that both CTAs fire correctly via PostHog Live Events.

## 10. Deliverables

- ☐ Hero rewritten with locked copy + two tracked CTAs + clipboard primary CTA
- ☐ `/contact` route live with ContactForm (email required; name, company, message optional) + hidden attribution fields
- ☐ `GitHubStarsPill` + `getGitHubStars` with ISR + fetch-failure fallback
- ☐ `CompatibilityMatrix` on `/pricing` with conservative content (20, 21 supported; 22 planned; ≤19 unsupported)
- ☐ Three full-repo sweeps applied per-file: telemetry phrasing, A2UI v0.9, category sweep
- ☐ `CtaId` type union exported; `AnalyticsProperties.cta_id` tightened
- ☐ `/api/leads` validates email only
- ☐ Resend subject template handles missing name
- ☐ `docs/gtm/messaging.md` Contact page §Fields updated
- ☐ All affected projects' tests green
- ☐ Manual smoke: both hero CTAs fire `marketing:cta_click` with correct `cta_id` + `track` properties in PostHog Live Events
