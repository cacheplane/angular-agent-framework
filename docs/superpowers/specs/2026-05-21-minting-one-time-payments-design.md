# Minting Service — One-Time Payments

**Status:** Design approved, ready for implementation plan.
**Owner:** apps/minting-service + libs/db + apps/website (one-line change to Checkout session creation).
**Affects:** `libs/db/src/lib/{schema/licenses.ts, queries/licenses.ts, queries/licenses.spec.ts}`, a new drizzle migration, `apps/minting-service/src/lib/handlers.ts` + spec, `apps/minting-service/src/lib/handlers.spec.ts`, `apps/website/src/app/api/checkout/session/route.ts` (add `customer_creation: 'always'`).

## Problem

PR B-Stripe locked **one-time 12-month payments** for all paid tiers. The minting service's `handleCheckoutCompleted` was written assuming **subscription mode**: it throws `session ${id} has no subscription` for one-time payment sessions. End-to-end smoke confirmed this — webhook delivers, signature verifies, and the handler throws before minting.

The DB schema also reflects subscription assumptions: `stripe_subscription_id text NOT NULL UNIQUE`, with `upsertLicense` keying on it.

## Decision

Rename the DB column to a generic `stripe_payment_id` (since the column functions as "unique Stripe-side reference"). Rewrite `handleCheckoutCompleted` for one-time payments and **strip the subscription handlers** entirely — we're committing to one-time-only per the locked brainstorm decision. The DB is empty so a destructive rename migration is safe.

Update `/api/checkout/session` to set `customer_creation: 'always'` so Stripe always creates a customer for the buyer (necessary for the minting service to write a license record keyed on `stripe_customer_id`, which stays `NOT NULL` in the schema).

## File changes

### `libs/db/src/lib/schema/licenses.ts`
- Rename column field `stripeSubscriptionId` → `stripePaymentId` (TypeScript) and `stripe_subscription_id` → `stripe_payment_id` (SQL).
- Rename unique constraint accordingly.

### `libs/db/drizzle/0001_rename_subscription_to_payment.sql` (new migration)
Since the DB is empty, a single `ALTER TABLE ... RENAME COLUMN` plus constraint rename is the cleanest path. Drizzle generates this from the schema change; we commit the resulting SQL.

```sql
ALTER TABLE "licenses" RENAME COLUMN "stripe_subscription_id" TO "stripe_payment_id";
ALTER TABLE "licenses" RENAME CONSTRAINT "licenses_stripe_subscription_id_unique" TO "licenses_stripe_payment_id_unique";
```

### `libs/db/src/lib/queries/licenses.ts`
- `upsertLicense` `onConflictDoUpdate.target`: `licenses.stripeSubscriptionId` → `licenses.stripePaymentId`.
- `getLicense(db, stripePaymentId)` — rename parameter (semantic) and the where clause column.
- `revokeLicense(db, stripePaymentId)` — same rename.

### `libs/db/src/lib/queries/licenses.spec.ts`
- All references to `stripeSubscriptionId` → `stripePaymentId`. Test fixture values (`sub_1`, `sub_insert`, etc.) become `pi_1`, `pi_insert`, etc. — matches real Stripe IDs.

### `apps/minting-service/src/lib/handlers.ts`
- **Delete** `handleSubscriptionUpdated` and `handleSubscriptionDeleted` functions.
- **Delete** their `case` branches in the `handleEvent` switch.
- **Rewrite** `handleCheckoutCompleted`:
  - Expand `payment_intent` and `customer_details.email` on retrieve.
  - Require `expanded.mode === 'payment'`; if `'subscription'`, log + skip (defensive; we shouldn't be getting those events).
  - Extract `payment_intent` ID as the unique reference.
  - Extract `customer` ID (now guaranteed present thanks to `customer_creation: 'always'`).
  - Extract email from `expanded.customer_details?.email`.
  - Compute `expiresAt = Date.now() + defaultTtlDays * 24 * 60 * 60 * 1000`.
  - `mintToken({ stripeCustomerId, tier, seats, expiresAt }, privateKeyHex)`.
  - `upsertLicense({ stripeCustomerId, stripePaymentId: payment_intent, customerEmail, tier, seats, expiresAt, lastToken })`.
  - `sendLicenseEmail(...)` as before.

### `apps/minting-service/src/lib/handlers.spec.ts`
- Drop or update existing subscription-mode tests.
- Add tests for one-time payment path: fixture session with `mode: 'payment'`, `payment_intent: 'pi_...'`, `customer: 'cus_...'`, `customer_details: { email: 'buyer@example.com' }`.
- Assert: `mintToken` called with right args, `upsertLicense` called with `stripePaymentId: 'pi_...'`, `sendLicenseEmail` fired with the buyer's email.
- Negative test: `mode === 'subscription'` → handler returns early without minting (no token, no email).

### `apps/website/src/app/api/checkout/session/route.ts`
- Add `customer_creation: 'always'` to the `stripe.checkout.sessions.create({...})` call. One line.
- Update the unit spec (`route.spec.ts`) to assert the param is passed.

### `apps/minting-service/src/lib/env.ts` / handler signature
- No env changes.

## Out of scope

- Subscription tiers (parked).
- License key rotation, revocation UX.
- The `handleSubscriptionUpdated/Deleted` codepaths (deleted).
- Adding test mode and live mode separation in code (already encoded in the `sk_*` prefix).

## Acceptance criteria

1. `libs/db` schema has `stripe_payment_id` (no `stripe_subscription_id` anywhere).
2. Drizzle migration `0001_*.sql` exists; running it against an empty DB succeeds.
3. `npx nx run db:test` passes (existing licenses.spec runs against the renamed column).
4. `apps/minting-service/src/lib/handlers.ts` has only `handleCheckoutCompleted` exported (no subscription handlers). The `handleEvent` switch handles `checkout.session.completed` only (other event types fall through to default return).
5. `npx nx run minting-service:test` passes (new handler spec covers the one-time-payment path).
6. `apps/website/src/app/api/checkout/session/route.ts` passes `customer_creation: 'always'`. Existing route.spec passes; updated assertion verifies the new param.
7. End-to-end smoke (after deploy):
   - `stripe trigger checkout.session.completed` (or a real Checkout test transaction with 4242 4242 4242 4242) → webhook delivers → minting service handler runs → license row inserted → Resend send event recorded.
8. The minted token verifies in `examples/chat/angular/` when pasted into `environment.license`.

## Migration approach for live deploy

DB is empty (verified via `SELECT count(*) FROM licenses;` returned 0). Steps:
1. Apply `0001_*.sql` to the Neon DB via existing migration runner / drizzle-kit push.
2. Deploy the minting service code change.
3. Apply the column rename and deploy together (or rename first, then deploy — both orders work because no rows exist).

If a row existed, the rename would still be data-preserving (`ALTER TABLE RENAME COLUMN` keeps data); no migration risk.

## Verification

- `pnpm tsx scripts/stripe/sync-products.ts` (re-run safe, idempotent)
- `stripe trigger checkout.session.completed --api-key $STRIPE_SECRET_KEY --override checkout_session:metadata.ngaf_tier_slug=indie`
- Check Resend API for the resulting send event
- Inspect the DB row for the new license

## Risks

- **Resend send may fail** if `EMAIL_FROM` isn't verified in Resend's account. Surfaces as a 4xx in `sendLicenseEmail`. Pre-deploy check: confirm the configured `EMAIL_FROM` domain has SPF/DKIM set.
- **Stripe `customer_creation: 'always'` semantics**: Stripe always creates a customer record for the session, but only for `mode: 'payment'`. In `mode: 'subscription'`, the customer is created automatically. Setting `customer_creation` in subscription mode is silently ignored. Safe.
- **Token doesn't verify if prod key mismatch**: separate concern (covered by PR C operational checklist). Not a regression of this PR.
