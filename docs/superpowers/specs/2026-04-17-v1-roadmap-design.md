# v1 Roadmap — `@cacheplane/angular`, `@cacheplane/render`, `@cacheplane/chat`

**Date:** 2026-04-17
**Status:** Approved design — ready for implementation plan

## Goal

Publish three production-ready npm packages at version `1.0.0`:

- `@cacheplane/angular` (source in `libs/agent`)
- `@cacheplane/render` (source in `libs/render`)
- `@cacheplane/chat` (source in `libs/chat`)

v1 is **scope-bounded, not time-bounded.** It ships when the scope below is done, sequenced `agent → render → chat`.

## Non-Negotiables

- **Polish bar** on all three packages: stable API, typed surface, tested, documented, with working examples.
- **API stabilization is the most critical** item. A breaking change after 1.0.0 means a 2.0.0; we pay the cost of getting it right now.
- **Cockpit is always stable on head.** Cockpit (`cockpit/chat/a2ui/*`) is part of the monorepo, public, published, documented. API changes in the three v1 libs include matching cockpit updates in the same PR.
- **Angular 20+ only.** No back-compat to 18/19.
- **Single commercial SKU** covering all three packages (pricing page already lists Community/Developer Seat/App Deployment/Enterprise tiers — all cover the full bundle).
- **Licensing enforced at init.** Packages ship with a license-check step; missing/expired keys trigger nag UX but never block runtime functionality.

## Structure

v1 breaks into four parallel-capable workstreams:

1. **Per-library stabilization** (agent, render, chat)
2. **Release infrastructure**
3. **Licensing & billing**
4. **Product & marketing**

Plus explicit out-of-scope and risks.

---

## 1. Per-Library v1 Breakdown

Each library follows the same checklist. Order: agent → render → chat.

### Common per-library checklist

- **API surface freeze** — review every exported symbol, rename/remove with intent, document stability guarantee
- **Type coverage** — no `any` in the public API; strict generics on core primitives
- **Known limitations resolved or documented** — `docs/limitations.md` entries either fixed or explicitly marked "v1.x"
- **Unit test coverage** — critical paths covered; snapshot tests where appropriate
- **README** — install, quickstart, link to full docs on cacheplane.dev
- **Migration notes** — if any 0.x → 1.0 breaking changes, documented
- **License check wired in** — init-time offline signature verification + nag UX (see §3)
- **Cockpit examples updated** — any API change lands with matching cockpit update in the same PR

### `@cacheplane/angular` (source: `libs/agent`)

- Primary API: agent primitives, signals, LangGraph SDK integration
- Most mature of the three; stabilization effort is reviewing + formalizing existing API
- Blocks `render` and `chat` (they consume it)

### `@cacheplane/render` (source: `libs/render`)

- Primary API: generative UI rendering (json-render, A2UI)
- Newest of the three; highest API-churn risk
- Gate via pre-launch reviewer program before marking 1.0 (see §4)

### `@cacheplane/chat` (source: `libs/chat`)

- Primary API: chat UI primitives, message handling, tool-call rendering
- Depends on `agent` + `render`
- Landing page already uses these primitives, so there's existing dogfooding

---

## 2. Release Infrastructure

Goal: `nx release` (single command) → tagged commits, changelogs, npm publish with provenance.

- **Nx Release** configured with per-package semver and independent version lines
- **Tag format:** `<pkg>@v<version>` (e.g., `@cacheplane/angular@v1.0.0`)
- **Changelog:** Keep-a-Changelog format, one `CHANGELOG.md` per library
- **Conventional commits** enforced in CI (commitlint) to drive changelog generation
- **npm publish with provenance** (`--provenance` flag, GitHub OIDC)
- **Prerequisite:** `NPM_TOKEN` in GitHub Actions secrets
- **Public key embedding:** each package build step embeds the current license-verification public key at compile time
- **License-test fixtures in CI:** valid/expired/tampered keys verified against the package's check logic on every PR
- **Release workflow:** GitHub Action triggered on `main` push or manual dispatch; runs `nx release`, pushes tags, publishes changed packages

---

## 3. Licensing & Billing

Goal: paid tiers on cacheplane.dev/pricing stop going to a lead form and start going to Stripe checkout, with keys minted and emailed automatically.

### License key mechanism

- **Format:** Ed25519-signed token (JWT-style), offline-verifiable
- **Payload:** customer id, tier, issued-at, expires-at, seat count
- **Public key** baked into each package at build time (see §2); private key in secrets manager
- **Verification flow:** package checks signature + expiry offline on init; if invalid/missing, enters nag mode
- **Phone-home telemetry:** separate, non-blocking. Packages POST `{license_id, version, anon_instance_id}` to telemetry endpoint on init + daily. Failure never blocks.

### Minting service

- Lightweight Node/Edge service (Vercel Functions)
- Stripe webhook handler: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- On purchase: issue key → email customer → record in DB
- On renewal: rotate key
- On cancellation: mark revoked (flagged in telemetry, not runtime-blocking)
- Idempotent handler + manual reconciliation tool for missed webhooks
- Customer portal link for re-downloading keys

### Stripe setup

- **Products:** single bundle SKU covering all three packages (not per-package)
- **Pricing:** already defined on cacheplane.dev/pricing
  - Community: Free (PolyForm Noncommercial 1.0.0)
  - Developer Seat: $500/seat/year
  - App Deployment: $2,000/app/year
  - Enterprise: Custom
- **Checkout:** Stripe-hosted (not custom)
- **Tax:** Stripe Tax enabled
- **Wire-up:** pricing page CTAs for paid tiers currently point to `#lead-form` — replace with Stripe Checkout Session URLs

### In-package UX

- **Valid license:** silent
- **Noncommercial (PolyForm):** silent if usage signals match (e.g., `NODE_ENV !== 'production'` or self-declared); otherwise nag
- **Missing/expired:** console warning with "Get a license at cacheplane.dev/pricing"
- **Grace period:** 14 days after expiry before full nag
- **Never blocks functionality** — no runtime errors in production apps

### Telemetry endpoint

- Anonymous, aggregate only — package version, Angular version, rough usage counts
- Documented in privacy policy + README
- `CACHEPLANE_TELEMETRY=0` env opt-out

### Legal

- **Source-available license:** PolyForm Noncommercial 1.0.0 for community tier (already listed on pricing)
- **Commercial EULA** for paid tiers, referenced in package README + website
- Both license texts in repo (`LICENSE`, `LICENSE-COMMERCIAL`)

### Public-key rotation runbook

- Document procedure for rotating private key in case of compromise
- Every active package version needs a patch release with new public key
- Private key stored in secrets manager (not repo, not laptop)

---

## 4. Product & Marketing

### SEO & discoverability (apps/website)

- `app/sitemap.ts` + `app/robots.ts` (currently absent)
- Per-page OG metadata for `/angular`, `/render`, `/chat`, `/solutions/*`, `/pricing`
- OG images via `next/og` — one shared template, rendered per route
- Vercel Analytics (`@vercel/analytics`) for post-launch traffic measurement

### GitHub hygiene

- `CONTRIBUTING.md` — Nx commands, monorepo setup, conventional commits
- `CODE_OF_CONDUCT.md` — Contributor Covenant
- `.github/ISSUE_TEMPLATE/` — bug, feature, question (scoped per library)
- `.github/PULL_REQUEST_TEMPLATE.md` — tests / changelog / affected libs checklist
- Repo **About** + topics — `angular`, `ai-agents`, `langgraph`, `generative-ui`, `llm`, `chat-ui`
- Pinned README badges — npm version, build status, license

### Launch artifacts (day-of)

- Blog post on cacheplane.dev (or `/blog`) announcing v1
- HN submission — "Show HN: Angular agent framework for LangGraph"
- Twitter/X thread — 4–5 posts, chat UI + code screenshots
- **Pre-launch access:** share `1.0.0-rc.0` with 3–5 trusted Angular/AI devs ~2 weeks before GA; required for render sign-off (see §6)

### Website polish

- Favicon + app icons (if missing)
- 404 page with useful CTA back to `/`
- Docs quality pass — spot-check `/angular`, `/render`, `/chat`, `/pricing` for stale pre-v1 references
- Pricing page CTAs wired to Stripe checkout (§3)

---

## 5. Out-of-scope for v1

- **`@cacheplane/mcp`** — stays in repo, not published for v1
- **Formal design-partner program** — informal pre-launch reviewer list only
- **Non-public libs** — remaining `libs/*` stay `0.x`, unpublished, no docs pages
- **Official starter template** — acknowledged gap, deferred post-v1
- **i18n** — English only
- **Enterprise features** — no SSO, no audit logs, no on-prem guide
- **Framework support beyond Angular** — no React/Vue ports

---

## 6. Risks

### API stability

- **`@cacheplane/render` churn** — newest lib, least external usage. **Mitigation:** gate 1.0 sign-off behind 3-reviewer approval via pre-launch program (§4).
- **LangGraph SDK churn** — `@langchain/langgraph-sdk` is pre-1.0 with history of breaking changes. **Mitigation:** pin a specific minor range in v1; document support policy.

### Licensing

- **Key leakage** — signed offline keys can be shared. **Mitigation:** phone-home telemetry surfaces anomalous usage (one key, many instance ids). Not blocking for v1.
- **Stripe webhook reliability** — missed webhook = paid customer with no key. **Mitigation:** idempotent handler, manual reconciliation tool, monitoring alert.
- **Public-key compromise** — requires patch release across all published versions. **Mitigation:** rotation runbook (§3).

### Delivery

- **Scope expansion** — new asks mid-flight. **Mitigation:** this roadmap is the contract. New items → v1.1 unless actual blockers.
- **Integration test infra** — no full LangGraph end-to-end harness today. **Mitigation:** v1 may ship with unit tests + manual QA; integration harness tracked as fast-follow.

---

## Next steps

1. User review of this spec
2. On approval: invoke `superpowers:writing-plans` to produce the implementation plan
