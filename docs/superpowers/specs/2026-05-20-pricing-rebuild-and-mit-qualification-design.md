# PR B — Pricing rebuild + sitewide MIT-claim qualification

**Status:** Design approved, ready for implementation plan.
**Owner:** apps/website + root docs
**Affects:** `/pricing` page, hero eyebrow, footer link, root `README.md`, root `COMMERCIAL.md`. No library code.

## Goal

After PR A (`@ngaf/chat` relicense) merged, the public posture lags: the homepage hero still says "Agent UI for Angular · MIT," the footer Resources column links a "MIT License" item, the `/pricing` page claims "MIT-licensed libraries are free forever," and root `README.md`/`COMMERCIAL.md` both state the whole framework is MIT. This PR closes that gap in a single coordinated public-posture sweep.

Two intertwined deliverables:

1. **Pricing-page rebuild.** Replace the existing 2-tier (Open Source / Enterprise) `PricingGrid` with the user-defined 5-tier model (Community / Indie Commercial / Developer Seat / App Deployment / Enterprise). New page header, subheader, commercial-use note, evaluation note, OSS clarification, FAQ section. Comparison matrix updated to the new tiers.
2. **Sitewide MIT-claim qualification.** Hero eyebrow text. Footer Resources column link and bottom-bar text. Root `README.md` lines that say "all libraries MIT." Root `COMMERCIAL.md` rewrite to lead with chat as the dual-licensed exception.

## Out of scope

- **Stripe Checkout.** Tier CTAs route to `/contact?source=pricing_tier_<slug>` so the page can ship before billing infrastructure exists. Real Stripe products + Checkout + webhook entitlement lives in a separate parallel brainstorm + PR ("PR B-Stripe").
- **Verification runtime.** Boot-time enforcement, prod public-key in CI, nag UI — that's PR C.
- **Per-library README updates** for libraries that stay MIT (`@ngaf/render`, etc.) — they don't need to change; they're still MIT and their READMEs say so accurately.
- **New `/licensing` route.** Inline qualification only. The pricing page + root `COMMERCIAL.md` carry the canonical explanation.
- **Docs MDX content updates.** No content/docs/* files change. (Audit didn't flag any docs MDX MIT claims that need updating.)

## Content

### /pricing page

**Header (h1):** `Pricing for production AI chat interfaces`

**Subheader (body-lg):** `@ngaf/chat is free for noncommercial use. Commercial production use requires a Threadplane license. Other libraries in the framework remain MIT.`

**Tier cards (in order, left-to-right or top-to-bottom on mobile):**

| # | Name | Price | Period | CTA label | CTA href | Highlight? |
|---|---|---|---|---|---|---|
| 1 | Community / Noncommercial | Free | forever | Start free | `https://www.npmjs.com/package/@ngaf/chat` (external) | no |
| 2 | Indie Commercial | $149 | /year | Buy indie license | `/contact?source=pricing_tier_indie` | no |
| 3 | Developer Seat | $299 | /developer/year | Buy developer seat | `/contact?source=pricing_tier_developer_seat` | yes |
| 4 | App Deployment | $1,499 | /app/year | License an app | `/contact?source=pricing_tier_app_deployment` | no |
| 5 | Enterprise | Custom | starting at $10k/year | Contact sales | `/contact?source=pricing_tier_enterprise` | no |

**Tier feature lists** (4–5 bullets each, derived verbatim from the user's brief):

- **Community:** Personal, student, academic, nonprofit, demo · Source access · Noncommercial use · Commercial evaluation (30 days) · License: PolyForm Noncommercial 1.0.0
- **Indie:** 1 developer · 1 commercial app · Unlimited end users · Commercial license · Best for: solo devs, indie products, consultants with one app
- **Developer Seat:** Commercial use · Unlimited end users · Dev / staging / production · Apps owned by your org · Best for: startups & growing teams
- **App Deployment:** Unlimited developers · 1 production app · Unlimited end users · Procurement-friendly · Best for: agencies, CI/CD-heavy teams
- **Enterprise:** Custom contract & SLA · Procurement support · Security review · Multi-app licensing · Priority + private support channel

**Commercial-use note (small text, below grid):**

> A license is required when `@ngaf/chat` is used in a commercial product, SaaS app, internal business tool, paid client project, or production application operated by or for a for-profit entity.

**Evaluation note (small text, between tier grid and FAQ):**

> Commercial evaluation is free for 30 days. A paid license is required before production deployment.

**OSS clarification (small text, footer-adjacent):**

> Because commercial use requires a license, `@ngaf/chat` is source-available rather than OSI open source. Threadplane keeps ecosystem packages (`@ngaf/render`, `@ngaf/agent`, `@ngaf/langgraph`, `@ngaf/ag-ui`, `@ngaf/a2ui`, `@ngaf/licensing`, `@ngaf/telemetry`, `@ngaf/design-tokens`) permissively MIT-licensed.

**FAQ section** — 7 Q&A items verbatim from the user's brief. Plain expandable-list style (no accordion JS — semantic `<details>`/`<summary>` keeps the page accessible without client interactivity). Each Q is the `<summary>`, each A is the body. Questions:

1. Is `@ngaf/chat` open source?
2. Can I use it for free?
3. Can I use it at work?
4. Do my end users need licenses?
5. Can I modify the source?
6. Can I redistribute it?
7. What happens to older MIT versions?

Answers verbatim from the brief.

**Comparison matrix:** Replaces the existing `CompareTable` row set. New rows compare across 5 tiers (Community / Indie / Developer Seat / App Deployment / Enterprise) on these dimensions:

- License model
- Commercial production use
- Developers
- Apps covered
- End users
- Environments (dev/staging/prod)
- Support
- SLA
- Security review

Same `CompareTable` component, new data. `CompatibilityMatrix` is unchanged (it describes ecosystem capability, not licensing).

**Lead form + Final CTA:** Both unchanged.

### Sitewide MIT qualification

**Hero eyebrow** (`apps/website/src/components/landing/Hero.tsx:80`):

From `Agent UI for Angular · MIT` to `Agent UI for Angular · MIT framework` (one-word add). Conveys that the framework as a whole is permissive while leaving room for the chat exception to be discoverable on `/pricing`.

**Footer Resources column** (`apps/website/src/components/shared/Footer.tsx`):

The current `MIT License` link (line 286-298) — relabel to `Licensing`, href changes from `https://github.com/cacheplane/angular-agent-framework/blob/main/LICENSE` to `/pricing#faq`. Tracking `cta_id` updated to `footer_licensing`.

**Footer bottom bar** (`apps/website/src/components/shared/Footer.tsx`):

Currently reads: `MIT License · Pricing`. Replace with: `Licensing · Pricing` where "Licensing" links to `/pricing#faq`. Tracking `cta_id` updated to `footer_licensing_bottom`.

**Root `README.md`:**

- **Line 18 (MIT badge):** Drop the badge entirely. The qualified license paragraph below it (next bullet) carries the full posture; one badge can't accurately capture a per-library split, and shields.io variants are fragile.
- **Lines 135-137** (the "all libraries MIT" paragraph): rewrite to:

  > Most libraries in this repository (`@ngaf/render`, `@ngaf/agent`, `@ngaf/langgraph`, `@ngaf/ag-ui`, `@ngaf/a2ui`, `@ngaf/licensing`, `@ngaf/telemetry`, `@ngaf/design-tokens`) are released under the **MIT License** — free for any use, including commercial, with attribution.
  >
  > **`@ngaf/chat`** is the exception. Future versions are licensed under **PolyForm Noncommercial 1.0.0 OR a Threadplane commercial license**. Historical npm releases remain MIT. See [`libs/chat/LICENSE.md`](./libs/chat/LICENSE.md), [`libs/chat/COMMERCIAL-USE.md`](./libs/chat/COMMERCIAL-USE.md), and [`COMMERCIAL.md`](./COMMERCIAL.md) for details.

**Root `COMMERCIAL.md`** (rewrite the whole 13-line file):

```markdown
# Licensing

Most libraries in this repository — `@ngaf/render`, `@ngaf/agent`, `@ngaf/langgraph`, `@ngaf/ag-ui`, `@ngaf/a2ui`, `@ngaf/licensing`, `@ngaf/telemetry`, `@ngaf/design-tokens` — are released under the **MIT License**. Free for any use, commercial or noncommercial, with attribution. See [`LICENSE`](./LICENSE).

## `@ngaf/chat`

Starting with the next published version, `@ngaf/chat` is dual-licensed:

- **PolyForm Noncommercial 1.0.0** for free noncommercial use (personal, hobby, student, academic, nonprofit, public demos, OSI-licensed open source, 30-day commercial evaluation).
- **Threadplane commercial license** for commercial production use.

Historical MIT releases of `@ngaf/chat` remain under their original terms.

See [`libs/chat/LICENSE.md`](./libs/chat/LICENSE.md), [`libs/chat/LICENSE-COMMERCIAL.md`](./libs/chat/LICENSE-COMMERCIAL.md), and [`libs/chat/COMMERCIAL-USE.md`](./libs/chat/COMMERCIAL-USE.md) for the full terms.

## Minting Service

The ThreadPlane minting service (`apps/minting-service/`) is a proprietary internal service and is not covered by the MIT License. See `apps/minting-service/LICENSE` for its terms.

## Questions

- Website: <https://threadplane.ai>
- Pricing: <https://threadplane.ai/pricing>
- Sales: <https://threadplane.ai/contact>
```

## File map

- **Modify:** `apps/website/src/app/pricing/page.tsx` — metadata + header + subhead + add FAQ section + add commercial/evaluation/OSS notes
- **Modify:** `apps/website/src/components/pricing/PricingGrid.tsx` — 2 plans → 5 tiers
- **Modify:** `apps/website/src/components/pricing/CompareTable.tsx` — new row set for 5-tier comparison
- **Create:** `apps/website/src/components/pricing/PricingFAQ.tsx` — `<details>`/`<summary>` list of 7 Q&A
- **Create:** `apps/website/src/components/pricing/PricingFAQ.spec.tsx` — covers FAQ render + linkability
- **Modify:** `apps/website/src/components/landing/Hero.tsx` — eyebrow text
- **Modify:** `apps/website/src/components/shared/Footer.tsx` — Resources column link + bottom bar text + new `cta_id`s
- **Modify:** `apps/website/src/lib/analytics/events.ts` — add `footer_licensing` and `footer_licensing_bottom` to `CtaId` union; also extend it with the new `pricing_tier_*` cta_ids if the pricing CTAs are click-tracked (they are; using existing `footer_*` pattern won't fit). Actually they're plain anchor clicks on the pricing grid — tracked via the existing `trackCtaClick({ surface: 'pricing', cta_id: 'pricing_tier_indie', ... })` pattern; we'll add 5 new cta_id literals.
- **Modify:** `README.md` (root) — line 18 badge + lines 135-137 paragraph
- **Modify:** `COMMERCIAL.md` (root) — full rewrite

Total: 9 files modified, 2 created.

## Acceptance criteria

1. `/pricing` renders 5 tier cards in the order Community → Indie → Developer Seat → App Deployment → Enterprise. Developer Seat is highlighted.
2. Each tier CTA links to either `npmjs.com/package/@ngaf/chat` (Community) or `/contact?source=pricing_tier_<slug>` (paid tiers). All paid-tier CTA clicks fire `trackCtaClick` with `cta_id: 'pricing_tier_<slug>'`.
3. `/pricing` page contains the literal copy: header, subheader, commercial-use note, evaluation note, OSS clarification — exactly as written in this spec.
4. `/pricing` contains a FAQ section with 7 `<details>`/`<summary>` items. Each `<summary>` is a question from the user's brief and the body is its verbatim answer.
5. `CompareTable` rows compare across 5 tiers on the 9 dimensions listed in this spec.
6. Hero eyebrow reads `Agent UI for Angular · MIT framework`.
7. Footer Resources column has a `Licensing` link to `/pricing#faq`. Footer bottom bar reads `Licensing · Pricing` with the licensing link going to `/pricing#faq`. Both fire their respective new `cta_id`s.
8. Root `README.md` no longer claims the whole repo is MIT in its license-summary paragraph (lines ~135-137). The new paragraph explicitly names chat as the exception.
9. Root `COMMERCIAL.md` leads with the dual-license model for chat, preserves the minting-service section, and updates the contact links.
10. Existing tests (`Hero.spec.tsx`, `Differentiator.spec.tsx`, `site-metadata.spec.ts`, `docs.spec.ts`) still pass. `PricingFAQ.spec.tsx` is new and green.
11. `npx nx run website:lint` is green. `npx vitest run` from `apps/website/` reports the same baseline plus the new FAQ spec.

## Verification

- `cd apps/website && npx vitest run`
- `cd apps/website && npx nx run website:lint`
- Visual check: dev server at `http://localhost:3000/pricing` at 1280×820 and at mobile preset 375×812.
- DOM check: confirm each tier CTA `href` and `cta_id` match the table above.
- DOM check: hero eyebrow shows `Agent UI for Angular · MIT framework`.
- DOM check: footer link inventory matches the spec.

## Risks

- **Pricing CTAs route to a contact form, not Checkout.** Anyone clicking "Buy indie license" lands on the lead form. Mitigation: append `source=pricing_tier_<slug>` query param so the lead form can capture intent; the PR-B-Stripe followup replaces the hrefs with Stripe Checkout URLs once products exist.
- **Public posture briefly diverges between merging PR A and this PR.** PR A landed without a public pricing page that explains the dual model; this PR closes that gap. Merge order: this PR ships immediately after PR A.
- **Compare table can grow unwieldy.** With 5 tiers and 9 rows, the matrix is 45 cells. The plan uses a single full table with horizontal scroll on mobile (`overflow-x: auto` on the wrapper) — the existing `CompareTable` component already supports this pattern; no responsive rewrite needed.
