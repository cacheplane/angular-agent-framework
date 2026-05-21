# PR B-Stripe — Stripe Checkout for Paid Tiers

**Status:** Design approved, ready for implementation plan.
**Owner:** apps/website + apps/minting-service (the webhook handler that already exists there)
**Affects:** `apps/website/` (pricing page CTAs + new Checkout API route + thanks page + new `tiers.config.ts`), `scripts/stripe/` (new idempotent products/prices sync script), env config (Stripe keys), Stripe Dashboard webhook config.

## Goal

Replace the placeholder `/contact?source=pricing_tier_<slug>` CTAs that PR B shipped with real Stripe-hosted Checkout. A buyer who clicks "Buy indie license" lands on `stripe.com/c/pay/...`, completes payment, and is redirected to a thank-you page that tells them their license token will arrive via email (sent by the already-existing minting service in `apps/minting-service/`).

This PR does **not** mint or deliver license tokens. The minting service's `apps/minting-service/handlers/stripe-webhook.ts` already does that — but it's not yet deployed to a live URL. The deployment + production wiring happens in PR C. **A Stripe Checkout completion can succeed in PR B-Stripe with no token delivery; that gap closes when PR C lands.** That ordering is deliberate: sales can begin (manual fulfillment) before runtime verification is fully wired.

## Out of scope

- License-token minting / Resend emails — done by the existing minting service; PR C deploys it.
- Webhook signature verification logic — already in `apps/minting-service/handlers/stripe-webhook.ts`.
- Token signing keys (handled in PR C).
- Subscriptions / renewals. Per the brainstorm, **all paid tiers are one-time 12-month payments.** Renewal nag at exp-30d is a follow-up PR.
- Pricing copy / tier definitions — locked by PR B; this PR reads them.
- Origin-allowlist field collection at checkout — deferred (see PR C spec).

## Decisions locked from brainstorm

| Topic | Decision |
|---|---|
| Checkout flow shape | **Stripe-hosted Checkout** (POST to `/api/checkout/session` → 303 redirect to Stripe URL → return to `/thanks?session_id=...`) |
| Billing model | **One-time payments**, all paid tiers. License token TTL = 365 days, set by minting service. |
| Webhook → token minting | Out of scope here; the existing webhook handler in `apps/minting-service/` already covers it. |
| Products / prices config | **Idempotent script** `scripts/stripe/sync-products.ts` reading `pricing/tiers.config.ts` as source of truth. |
| Test vs. live | Ship with test mode keys; live mode is enabled by setting the production secret in Vercel after smoke-testing. |

## Pricing source of truth

New file: `pricing/tiers.config.ts` (repo root, importable by both website and sync script).

```ts
// pricing/tiers.config.ts
export interface TierConfig {
  /** Stable identifier; used in URL params, CtaIds, Stripe product metadata. */
  readonly slug: 'community' | 'indie' | 'developer_seat' | 'app_deployment' | 'enterprise';
  /** Display name on /pricing. */
  readonly name: string;
  /** USD price in cents. null for free / custom. */
  readonly priceCents: number | null;
  /** Display "$149" — derived from priceCents for paid tiers, "Free"/"Custom" otherwise. */
  readonly displayPrice: string;
  /** Display "/year" or "/developer/year" etc. */
  readonly displayPeriod: string;
  /** Pricing-grid feature bullets. */
  readonly features: readonly string[];
  /** Should the tier go through Stripe? false → community (npm) + enterprise (sales). */
  readonly stripeBuyable: boolean;
  /** Whether the line item allows quantity adjustment (Developer Seat). */
  readonly adjustableQuantity?: boolean;
}

export const TIERS: readonly TierConfig[] = [ /* 5 entries matching PR B's PricingGrid */ ];
```

The script reads this file as the source of truth, creates/updates one Stripe product per `stripeBuyable` tier, one price per product, and writes the resulting Stripe IDs to `pricing/tiers.generated.ts` (committed; small, human-auditable).

```ts
// pricing/tiers.generated.ts (script output, committed)
export const STRIPE_PRICE_IDS: Record<'indie' | 'developer_seat' | 'app_deployment', string> = {
  indie: 'price_1Abc...',
  developer_seat: 'price_1Def...',
  app_deployment: 'price_1Ghi...',
};
```

**Why two files:** the config is intent (human-editable); the generated file is the contract between Stripe Dashboard state and our app. Separating them means accidental Stripe-side changes don't silently break us; the script is idempotent so re-running rebuilds the generated file from current Stripe state.

## File map

- **Create:** `pricing/tiers.config.ts` — source of truth.
- **Create:** `pricing/tiers.generated.ts` — script output; Stripe price IDs.
- **Create:** `scripts/stripe/sync-products.ts` — idempotent product/price sync via `stripe.products.list` / `stripe.products.create` / `stripe.products.update`, then `stripe.prices.list` / `stripe.prices.create`. Identifies products by metadata key `ngaf_tier_slug`.
- **Create:** `apps/website/src/app/api/checkout/session/route.ts` — Next.js Route Handler. POST `{ tier: 'indie' | 'developer_seat' | 'app_deployment', quantity?: number }` → `303 Location: <stripe checkout url>`. Builds the session with `mode: 'payment'`, `line_items: [{ price: STRIPE_PRICE_IDS[tier], quantity, adjustable_quantity: tier === 'developer_seat' ? { enabled: true, minimum: 1, maximum: 100 } : undefined }]`, `success_url: '<origin>/thanks?session_id={CHECKOUT_SESSION_ID}'`, `cancel_url: '<origin>/pricing'`, `metadata: { ngaf_tier_slug: tier }`, `payment_intent_data: { metadata: { ngaf_tier_slug: tier } }`.
- **Create:** `apps/website/src/app/thanks/page.tsx` — server component that renders "Payment received. Your license token will be emailed within a few minutes." Reads `?session_id=` for analytics; uses `Stripe-hosted` posture so we don't need to call back to Stripe for confirmation (the webhook handles fulfillment).
- **Modify:** `apps/website/src/components/pricing/PricingGrid.tsx` — paid-tier CTAs replace `href="/contact?source=..."` with a small form `<form action="/api/checkout/session" method="post"><input type="hidden" name="tier" value="..."><button>...</button></form>` so the click POSTs and gets a 303. Click still fires `trackCtaClick`. Community keeps the npm link; Enterprise keeps the `/contact` link.
- **Modify:** `apps/website/src/lib/analytics/events.ts` — extend `EventType` with `marketing:checkout_started` and `marketing:checkout_succeeded` (or reuse existing CTA events; final decision in plan).
- **Modify:** `.github/workflows/ci.yml` — no change yet. Stripe is server-side; sync script runs locally.
- **Modify:** `.env.example` (repo root + `apps/website/.env.example`) — document `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` env names (no values).

No changes to `libs/chat`, `libs/licensing`, `apps/minting-service`, the cockpit, or any example app. All other libraries stay untouched.

## Stripe configuration (operational, done before merge)

These actions happen in the Stripe Dashboard and on Vercel — they aren't code:

1. **Run `node scripts/stripe/sync-products.ts` locally with `STRIPE_SECRET_KEY` (test mode).** Creates the three buyable products + prices in Stripe test mode. Writes `pricing/tiers.generated.ts`. The script is idempotent so reruns are safe.
2. **In Stripe Dashboard, point the webhook endpoint at the minting service URL.** Test mode: `https://threadplane-minting-service.vercel.app/api/stripe-webhook` (current preview-style URL; gets a custom prod domain in PR C). Production: same path on the prod minting domain. Webhook signing secret goes into the minting service's `STRIPE_WEBHOOK_SECRET` Vercel env (test mode value first; live mode value when ready).
3. **Vercel `threadplane` (website) project gets `STRIPE_SECRET_KEY`** (test mode now). This is the only Stripe secret the website needs; the public/test publishable key isn't required because we don't use Elements.

## Acceptance criteria

1. `node scripts/stripe/sync-products.ts` exits 0 and writes a `pricing/tiers.generated.ts` containing 3 `price_*` strings. Rerunning is a no-op.
2. POST `/api/checkout/session` with `{ tier: 'indie' }` returns `303 Location: https://checkout.stripe.com/c/pay/cs_test_...`.
3. POST `/api/checkout/session` with `{ tier: 'developer_seat', quantity: 3 }` produces a Checkout session with `quantity=3` and `adjustable_quantity` enabled.
4. POST `/api/checkout/session` with `{ tier: 'enterprise' }` or `{ tier: 'community' }` returns `400` (those tiers don't go through Stripe).
5. Completing test-mode Checkout with card `4242 4242 4242 4242` redirects to `/thanks?session_id=cs_test_...` and renders the thank-you page.
6. The Stripe Dashboard shows the resulting `payment_intent` with `metadata.ngaf_tier_slug` set correctly.
7. The minting service webhook receives a `checkout.session.completed` event (verify via the minting service's Vercel logs).
8. The pricing page UI looks unchanged except the paid-tier buttons now submit a form instead of navigating; analytics events still fire.
9. `npx nx run website:lint` + `npx nx run website:test` + `npx nx build website` all succeed.

## Verification / smoke test runbook (operational, not committed)

Run after merge with Stripe in test mode. **All temporary changes get reverted before the smoke-test session ends.** See PR C's spec for the consolidated end-to-end smoke that combines Stripe Checkout + license-token issuance + verification in the chat demo.

PR-B-Stripe-specific smoke:

- [ ] Run `node scripts/stripe/sync-products.ts` locally. Confirm 3 prices appear in the Stripe Dashboard test mode.
- [ ] Boot `apps/website` dev server. Open `http://localhost:3000/pricing` in a real browser (Chrome MCP).
- [ ] Click "Buy indie license". Confirm browser lands on `checkout.stripe.com` with the right price + product name.
- [ ] Pay with `4242 4242 4242 4242` + any future expiry + any 3-digit CVC.
- [ ] Confirm redirect to `/thanks?session_id=cs_test_...` and "Your license token will be emailed" copy renders.
- [ ] Repeat for Developer Seat — confirm the quantity stepper works and the price scales.
- [ ] Repeat for App Deployment.
- [ ] Stripe Dashboard → Events → confirm `checkout.session.completed` was sent to the minting webhook URL (the deployed preview URL is fine for this PR; live domain comes in PR C).
- [ ] Cancel a session mid-flow; confirm we return to `/pricing` cleanly.

## Risks

- **Token won't actually arrive in PR B-Stripe.** The minting service receives the webhook and tries to mint; PR C is the one that wires its prod public key into `@ngaf/chat` and assigns the prod domain. The thank-you page text deliberately says "within a few minutes" to leave room for manual fulfillment if the automation isn't end-to-end yet.
- **Idempotency edge cases.** The sync script needs to match products by `metadata.ngaf_tier_slug`, not by name (names change). The plan locks the metadata key explicitly.
- **CSRF on POST /api/checkout/session.** Since the redirect is to Stripe, there's no real damage from a forged POST — worst case a Stripe session URL gets fetched. Acceptable; the route still verifies `tier` is in the allowlist.
- **Test/live mode mixup.** The same `STRIPE_SECRET_KEY` env var holds whichever mode. Mitigation: prefix the test-mode key with `sk_test_` (Stripe's convention); add a runtime check that errors if `STRIPE_SECRET_KEY` doesn't start with `sk_` and refuses to load. We do NOT add explicit mode detection — Stripe's key already encodes it.
