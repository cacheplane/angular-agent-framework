# Minting Service Design

**Date:** 2026-04-20
**Status:** Design approved
**Author:** Brian Love (with Claude)
**Depends on:** `libs/licensing` (`@cacheplane/licensing`) — provides `signLicense` / `verifyLicense` primitives and the published public key.
**Followed by:** Plan 3 — Stripe Checkout + website integration (pricing page, customer-facing purchase flow).

---

## 1. System Overview

A single Nx app at `apps/minting-service/`, deployed as one Vercel project.

- `api/stripe-webhook.ts` — the Node serverless function Stripe posts to.
- `api/health.ts` — trivial readiness probe.
- `src/lib/` — pure functions: tier extraction, token signing (wraps `@cacheplane/licensing`'s `signLicense`), email rendering, orchestration. All unit-testable without a live Stripe / DB / Resend.
- Dependencies: `stripe` (official SDK), `resend` (email), `drizzle-orm` (via `@cacheplane/db`), `@cacheplane/licensing` (workspace, for signing), `@cacheplane/db` (workspace, for DB access).

The service is stateless. Stripe events drive all state changes. Postgres is the source of truth for issued licenses.

---

## 2. Component Decomposition

### New lib: `libs/db/` (`@cacheplane/db`)

Shared DB infrastructure so the website can reuse schema + queries later (e.g., when it adds license management UI for authenticated customers).

```
libs/db/
  src/
    index.ts                    — barrel: schema types, client factory, queries
    lib/
      schema/
        licenses.ts             — Drizzle table def + inferred types
        processed-events.ts
        index.ts                — re-exports all tables
      client.ts                 — createDb(connectionString) → DrizzleClient
      queries/
        licenses.ts             — upsertLicense, revokeLicense, getLicense, getLicensesByCustomerEmail, updateLicenseToken
        processed-events.ts     — markEventProcessed, deleteProcessedEvent (compensating)
  drizzle.config.ts
  drizzle/                      — generated migration SQL files (checked in)
  project.json                  — nx targets: build, test, db:generate, db:migrate
```

### Minting service: `apps/minting-service/`

```
apps/minting-service/
  api/
    stripe-webhook.ts           — Stripe webhook entry point (raw-body, signature verify, dispatch)
    health.ts                   — returns { ok: true }
  src/
    lib/
      env.ts                    — validates all env vars at module load; throws with missing-var list
      tier.ts                   — extractTier(priceMetadata), computeSeats(tier, quantity)
      sign.ts                   — mintToken(claims) wraps @cacheplane/licensing's signLicense
      email.ts                  — renderLicenseEmail (pure) + sendLicenseEmail (Resend wrapper)
      handlers.ts               — handleEvent + handleCheckoutCompleted + handleSubscriptionUpdated + handleSubscriptionDeleted
  scripts/
    remint.ts                   — manual re-mint CLI (see Section 8)
  vercel.json
  README.md                     — operator runbook (see Section 8)
  package.json
  project.json
  tsconfig.app.json
  tsconfig.spec.json
```

**Rationale:**
- API routes stay thin adapters (~30 lines); all logic lives in pure `src/lib/` modules.
- Each `src/lib/*.ts` has one responsibility and a small surface.
- `handlers.ts` is the only place that composes DB + sign + email — everything else is leaves in the tree.
- Schema lives in `@cacheplane/db` because the website will consume the same tables in later plans.

### Migration runner

Migrations run from `@cacheplane/db` via `nx run db:migrate`. Operator runs it manually (or from a GitHub Action) against prod DB before deploying the minting service. Serverless + auto-migrate is a known foot-gun; keeping migrations an explicit pre-deploy step is safer.

---

## 3. Data Model

### `licenses` table

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` primary key, default `gen_random_uuid()` | internal ID, also used as `jti` in the signed token |
| `stripe_customer_id` | `text not null` | for lookups by customer |
| `stripe_subscription_id` | `text not null unique` | **the natural key** — UPSERT target |
| `customer_email` | `text not null` | captured at checkout; where license emails go |
| `tier` | `text not null` | `'dev-seat'` or `'app-deployment'` (enforced by app, not DB — easy to extend) |
| `seats` | `integer not null` | dev-seat: Stripe line-item quantity; app-deployment: 1 |
| `issued_at` | `timestamptz not null default now()` | last time we minted/rotated the token for this row |
| `expires_at` | `timestamptz not null` | matches `exp` claim in the signed token |
| `revoked_at` | `timestamptz` | null = active; set on `customer.subscription.deleted` |
| `last_token` | `text not null` | most recently issued signed JWT — enables manual re-mint without re-signing |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | bumped by UPSERT |

Indexes: `unique(stripe_subscription_id)`, `index(stripe_customer_id)`, `index(customer_email)`.

### `processed_events` table (idempotency)

| Column | Type | Notes |
|---|---|---|
| `stripe_event_id` | `text primary key` | Stripe's `evt_...` |
| `event_type` | `text not null` | for debugging/metrics |
| `processed_at` | `timestamptz not null default now()` | |

Usage: `INSERT ... ON CONFLICT (stripe_event_id) DO NOTHING RETURNING stripe_event_id`. If `RETURNING` produces a row, this is first-time processing. If empty, it's a Stripe retry — return 200 and skip.

**Retention:** `processed_events` grows unbounded. Not a near-term problem (low webhook volume). Future cleanup cron deferred to a later plan.

**Key-rotation column:** deliberately omitted. Rotation currently requires library republish (see Q6 in brainstorm). If that changes, add `signing_key_version` via migration.

---

## 4. Webhook Flow

### Entry point — `api/stripe-webhook.ts`

```ts
export const config = { api: { bodyParser: false } }; // Stripe needs raw body

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await readRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).send('invalid signature');
  }

  try {
    await handleEvent(event);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('webhook error', { eventId: event.id, type: event.type, err });
    return res.status(500).send('internal error'); // Stripe will retry
  }
}
```

### Orchestrator — `handlers.ts`

```ts
export async function handleEvent(event: Stripe.Event): Promise<void> {
  // 1. Idempotency check — first writer wins.
  const firstTime = await markEventProcessed(event.id, event.type);
  if (!firstTime) return; // Stripe retry, already processed.

  // 2. Dispatch. On error, compensating-delete the event row so Stripe retry can proceed.
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        return; // Unknown type — already marked processed, no-op.
    }
  } catch (err) {
    await deleteProcessedEvent(event.id);
    throw err;
  }
}
```

### `handleCheckoutCompleted`

1. Expand line items: `stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items.data.price'] })`.
2. Extract tier from `line_items[0].price.metadata.cacheplane_tier`. Throw if missing/invalid.
3. Compute `seats` from `line_items[0].quantity` per tier rules (dev-seat: quantity; app-deployment: 1).
4. Pre-generate `id = crypto.randomUUID()` for the row (so we can use it as `jti` in the token).
5. Retrieve the subscription to get `current_period_end` → `expires_at`.
6. `mintToken({ sub: stripe_customer_id, tier, seats, exp: expires_at, jti: id })`.
7. `upsertLicense({ id, stripe_customer_id, stripe_subscription_id, customer_email, tier, seats, issued_at: now, expires_at, last_token })`.
8. `sendLicenseEmail({ to: customer_email, tier, token, expiresAt })`.

### `handleSubscriptionUpdated`

Same flow, keyed on `stripe_subscription_id`. **Email is sent only if the token materially changed** — specifically if `tier`, `seats`, or `expires_at` differs from the existing row. Stripe fires `subscription.updated` for many reasons (card change, metadata edit); we don't want to spam customers.

```ts
const existing = await getLicense(sub.id);
const newClaims = { tier, seats, expires_at };
if (existing && sameClaims(existing, newClaims)) {
  await upsertLicense({ ...existing, ...newClaims, last_token: existing.last_token });
  return;
}
// claims changed → mint + email
const token = mintToken({ ... });
await upsertLicense({ ..., last_token: token, issued_at: now });
await sendLicenseEmail({ ... });
```

### `handleSubscriptionDeleted`

1. `revokeLicense(sub.id)` — sets `revoked_at = now()`.
2. No email. No token rotation.

### Events explicitly not handled in v1

- `invoice.payment_failed` — Stripe's dunning flow handles customer messaging; subscription eventually transitions to `canceled` (which we handle).
- `customer.subscription.paused` / `trialing` — not enabled in v1 product.
- Refunds — manual process.

### Error taxonomy

| Error | HTTP | Stripe behavior | Operator action |
|---|---|---|---|
| Invalid signature | 400 | No retry | None (likely bad config or bad actor) |
| Tier missing from price metadata | 500 | Retries for 3 days | Fix `metadata.cacheplane_tier` in Stripe dashboard → retry succeeds |
| DB/Resend transient error | 500 | Retries for 3 days | None — self-heals |
| Resend hard bounce | 200 | No retry | License is stored; use re-mint CLI with `--to=<corrected>` |

Logging fails the webhook ack when it should — don't 200 a malformed price, or we silently ship no license.

---

## 5. Email Content

### Transport

Resend SDK. `EMAIL_FROM` is a Resend-verified domain (e.g., `licenses@cacheplane.dev` — actual domain registered with Resend as part of setup).

### `renderLicenseEmail(vars)` — pure function in `email.ts`

Returns `{ subject, html, text }`. Testable without hitting Resend.

**Subject:**
```
Your Cacheplane license — {{tier}} ({{seats}} seat{{s}})
```

**Text body (primary):**
```
Thanks for subscribing to Cacheplane.

Your license token is below. Set it as the CACHEPLANE_LICENSE
environment variable in your application:

-----BEGIN CACHEPLANE LICENSE-----
{{token}}
-----END CACHEPLANE LICENSE-----

Tier: {{tier}}
Seats: {{seats}}
Expires: {{expiresAtISO}}

Installation:
  export CACHEPLANE_LICENSE="<paste token above>"

Or in a .env file:
  CACHEPLANE_LICENSE=<paste token above>

Docs: https://cacheplane.dev/docs/licensing
Questions: reply to this email.

-- The Cacheplane team
```

**HTML body:** same content with minimal styling. Token wrapped in `<pre style="white-space:pre-wrap;word-break:break-all;font-family:monospace;font-size:12px;background:#f4f4f4;padding:12px;border-radius:4px">`. No images, no tracking pixels, no marketing footer — this is transactional credential delivery.

### Design decisions

- **Token inline, not attached / not linked.** Attachments get stripped by corporate mail gateways; download links create a "who else clicked?" problem. Inline text is boring and reliable.
- **BEGIN/END CACHEPLANE LICENSE delimiters** — mirrors PEM convention; visually obvious what to copy.
- **`expiresAtISO`** — ISO 8601 UTC (`2027-04-20T00:00:00Z`). Unambiguous across locales.
- **No "click here to activate"** — token IS the license, no server round-trip.
- **Subject shows tier + seats** — customers with multiple subscriptions can tell at a glance which arrived.

### Re-mint email

Identical template, same subject. No "this is a resend" banner — customers don't need to know. Support can confirm from `licenses.updated_at` / Resend logs if it matters.

### Error handling

Resend call wrapped in try/catch. Success → log `{ eventId, licenseId, resendId }`. Failure → log + rethrow → webhook returns 500 → compensating `deleteProcessedEvent` (from Section 4) runs so Stripe retry reprocesses.

---

## 6. Environment Variables

Validated in `src/lib/env.ts` at module load.

| Var | Required | Purpose | Format |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | yes | Stripe API calls (expanding line items) | `sk_live_...` / `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | yes | Verify webhook signatures | `whsec_...` |
| `DATABASE_URL` | yes | Vercel Postgres connection string | `postgres://...?sslmode=require` |
| `RESEND_API_KEY` | yes | Send license emails | `re_...` |
| `EMAIL_FROM` | yes | `From:` header on license emails | `licenses@cacheplane.dev` |
| `LICENSE_SIGNING_PRIVATE_KEY_HEX` | yes | Ed25519 private key for `signLicense` | 64-char hex (32 bytes) |
| `LICENSE_DEFAULT_TTL_DAYS` | no | Fallback `exp` if subscription has no `current_period_end` | integer, defaults to `365` |

### `env.ts`

```ts
const REQUIRED = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'DATABASE_URL',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'LICENSE_SIGNING_PRIVATE_KEY_HEX',
] as const;

function loadEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  const keyHex = process.env['LICENSE_SIGNING_PRIVATE_KEY_HEX']!;
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error('LICENSE_SIGNING_PRIVATE_KEY_HEX must be 64 hex chars (32 bytes)');
  }
  return {
    STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY']!,
    STRIPE_WEBHOOK_SECRET: process.env['STRIPE_WEBHOOK_SECRET']!,
    DATABASE_URL: process.env['DATABASE_URL']!,
    RESEND_API_KEY: process.env['RESEND_API_KEY']!,
    EMAIL_FROM: process.env['EMAIL_FROM']!,
    LICENSE_SIGNING_PRIVATE_KEY_HEX: keyHex,
    LICENSE_DEFAULT_TTL_DAYS: Number(process.env['LICENSE_DEFAULT_TTL_DAYS'] ?? 365),
  };
}

export const env = loadEnv();
```

### Vercel env scoping

- **Production:** live Stripe keys (`sk_live_`, webhook secret from live endpoint), prod DB, prod Resend key, prod signing key.
- **Preview:** test Stripe keys (`sk_test_`, webhook secret from test endpoint), separate preview DB, test Resend audience, **a distinct preview signing key** (a leaked preview key must not mint valid prod licenses).
- **Development (local `.env`):** same shape as Preview. `.env` gitignored. `.env.example` in app root lists every var name with a placeholder.

### Secret handling

- `LICENSE_SIGNING_PRIVATE_KEY_HEX` is the crown jewel. Generate once, store in Vercel env as "Sensitive" (write-only), back up to password manager.
- `STRIPE_WEBHOOK_SECRET` differs between test-mode and live-mode endpoints — don't cross-wire.
- Key-generation one-liner (documented in `libs/licensing/README.md`):
  ```
  node -e "import('@noble/ed25519').then(e => { const sk = e.utils.randomPrivateKey(); console.log('priv:', Buffer.from(sk).toString('hex')); e.getPublicKey(sk).then(pk => console.log('pub:', Buffer.from(pk).toString('hex'))); })"
  ```

---

## 7. Deployment & Monorepo Integration

### Nx app setup

- Generator: `nx g @nx/node:app minting-service`.
- `project.json` targets:
  - `build` — `@nx/js:tsc` producing `dist/apps/minting-service/`.
  - `test` — `@nx/jest:jest`.
  - `lint` — `@nx/eslint:lint`.
  - `serve` — local dev via `vercel dev` (not `nx serve`).
  - `remint` — manual re-mint CLI (see Section 8).

### TypeScript config

`tsconfig.app.json`:
- `module: NodeNext`, `moduleResolution: NodeNext`, `target: ES2022`.
- `.js` extensions in relative imports (same constraint as `@cacheplane/licensing` — required for Node ESM on Vercel).

### Vercel project

- One Vercel project rooted at `apps/minting-service/`.
- `apps/minting-service/vercel.json`:
  ```json
  {
    "buildCommand": "cd ../.. && npx nx build minting-service",
    "outputDirectory": "../../dist/apps/minting-service",
    "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
    "framework": null,
    "functions": {
      "api/*.ts": {
        "runtime": "nodejs20.x",
        "maxDuration": 10
      }
    }
  }
  ```
- Vercel project root in dashboard set to `apps/minting-service`.
- Git-integration deploys from `main`. Preview deploys from every PR branch (using test env vars per Section 6).

### Local development

- `vercel dev` from `apps/minting-service/` — emulates serverless runtime, picks up `api/*.ts`, loads `.env`.
- Stripe webhook → local: `stripe listen --forward-to localhost:3000/api/stripe-webhook` (prints a local webhook secret for `.env`).
- Local Postgres: `docker run -p 5432:5432 postgres:16`.

### Workspace wiring

- `apps/minting-service/package.json` declares:
  - `"@cacheplane/licensing": "workspace:*"`
  - `"@cacheplane/db": "workspace:*"`
- Nx resolves to `dist/libs/...` at build. pnpm workspace resolution handles the Vercel install step.
- `nx.json` `targetDefaults.build.dependsOn: ["^build"]` ensures libs build before the app.

### CI

- Existing monorepo CI (`nx affected -t lint test build`) covers the service automatically.
- Migrations: run `DATABASE_URL=<prod-url> nx run db:migrate` from operator's laptop or a GitHub Action *before* `vercel deploy` for schema changes. Not in v1 CI automation.

### File map recap

| Path | Purpose |
|---|---|
| `libs/licensing/` | **Existing.** Signing & verification primitives. |
| `libs/db/` | **New.** Drizzle schema, migrations, client, domain queries. |
| `apps/minting-service/` | **New.** Vercel serverless app. Webhook + handlers + email + re-mint CLI. |

---

## 8. Manual Re-mint CLI

### Why it exists

- Customer's license email got lost / spam-filtered / deleted.
- Resend hard-bounced the original send; operator retries after fixing the address.
- Support needs to hand a specific license token to a customer over a support channel.

None of these justify a customer-facing "resend" button in v1 (that's Plan 3+ territory — needs auth and a web UI). A CLI run by the operator against prod DB is the minimum viable operational tool.

### Invocation

```
nx run minting-service:remint --sub=sub_1234 [--to=<email>] [--dry-run] [--new-token]
```

Or directly:
```
DATABASE_URL=<prod> RESEND_API_KEY=<prod> EMAIL_FROM=<prod> tsx apps/minting-service/scripts/remint.ts --sub=sub_1234
```

### `project.json` target

```json
"remint": {
  "executor": "nx:run-commands",
  "options": {
    "command": "tsx apps/minting-service/scripts/remint.ts",
    "cwd": "{projectRoot}"
  }
}
```

### Flags

| Flag | Required | Purpose |
|---|---|---|
| `--sub=<stripe_subscription_id>` | yes | Which license to re-send |
| `--to=<email>` | no | Override destination email. Defaults to `licenses.customer_email`. |
| `--dry-run` | no | Print what would be sent; don't call Resend |
| `--new-token` | no | Re-sign a fresh token (updates `last_token` + `issued_at`). Default: re-send existing `last_token`. |

### Logic

```ts
const args = parseArgs();
const license = await getLicense(args.sub);
if (!license) die(`No license found for subscription ${args.sub}`);
if (license.revoked_at) die(`License is revoked (revoked_at=${license.revoked_at}). Refusing to resend.`);

let token = license.last_token;
if (args.newToken) {
  token = mintToken({
    sub: license.stripe_customer_id,
    tier: license.tier,
    seats: license.seats,
    exp: license.expires_at,
    jti: license.id,
  });
  await updateLicenseToken(license.id, token); // bumps last_token + issued_at
}

const to = args.to ?? license.customer_email;

if (args.dryRun) {
  console.log(renderLicenseEmail({ to, tier: license.tier, token, expiresAt: license.expires_at }));
  return;
}

await sendLicenseEmail({ to, tier: license.tier, token, expiresAt: license.expires_at });
console.log(`Sent to ${to} for subscription ${args.sub}`);
```

### Safety rails

- **Refuses to resend revoked licenses** — `revoked_at IS NOT NULL` is a hard stop. Operator must flip it in SQL explicitly if they really mean to.
- **Logs to stdout, not to DB.** Reuses Resend's delivery log + `licenses.updated_at` (bumped only if `--new-token`). Keeping the CLI stateless makes it reversible.
- **`--dry-run` is the default recommendation in the README.** Operator previews before sending.
- **Reuses `renderLicenseEmail` + `sendLicenseEmail`** from `src/lib/email.ts` — zero duplication.

### What this CLI is not

- Not a way to mint licenses for non-paying customers — requires an existing `licenses` row.
- Not a way to change tier / seats / expiry — those come from Stripe.
- Not a customer portal — Plan 3+.

### Operator documentation

`apps/minting-service/README.md` is a public-repo operator runbook. Public repo is fine because the threat model is: **possession of the private key is the only thing that matters.** Everything else (schema, webhook logic, re-mint flow) is just plumbing. Contents:

1. **Overview** — what this service does, what it doesn't do.
2. **Architecture** — pointer to this design spec.
3. **Local development** — `vercel dev` + `stripe listen` + local Postgres.
4. **Environment variables** — full list from Section 6; key-generation one-liner.
5. **Deployment** — Vercel project config, how to run migrations before deploy.
6. **Operator runbook:**
   - **Re-mint a license:** `nx run minting-service:remint --sub=sub_xxx [--dry-run] [--to=new@email.com] [--new-token]` — flag-by-flag examples.
   - **Look up a customer's license:** `psql $DATABASE_URL -c "SELECT * FROM licenses WHERE customer_email = 'x@y.z'"`.
   - **Manually revoke:** `UPDATE licenses SET revoked_at = now() WHERE stripe_subscription_id = 'sub_xxx'`. Warning: prefer canceling the Stripe subscription instead — this bypasses the normal flow.
   - **Un-revoke after accidental revoke:** `UPDATE licenses SET revoked_at = NULL WHERE ...` then run `remint --new-token`.
   - **Handle a failed webhook:** check Stripe dashboard event log → find `evt_xxx` → `SELECT * FROM processed_events WHERE stripe_event_id = 'evt_xxx'`. If present, re-trigger from Stripe dashboard after `DELETE FROM processed_events ...`; if absent, just re-trigger.
   - **Rotate the signing key:** requires library republish (current Q6 decision). Steps: generate new keypair → update `LICENSE_PUBLIC_KEY` in `libs/licensing` → republish libs → update `LICENSE_SIGNING_PRIVATE_KEY_HEX` in Vercel → batch-run `remint --new-token` over all active licenses.
7. **Common failure modes** — log-line → meaning → operator action vs. self-healing Stripe retry.

---

## 9. Testing Strategy

### Unit tests (`nx test minting-service`, Jest, no network / no DB)

- `tier.spec.ts` — `extractTier` happy path + throw-on-missing + throw-on-invalid; `computeSeats` for both tiers.
- `sign.spec.ts` — round-trip: mint a token with a fixture keypair, verify with `@cacheplane/licensing`'s `verifyLicense`. Test claim shape (`sub`, `tier`, `seats`, `exp`, `jti`).
- `email.spec.ts` — `renderLicenseEmail` returns expected subject/text/html for each tier + seat count. Snapshot-test rendered text body.
- `handlers.spec.ts` — `handleEvent` with mocked `@cacheplane/db` + mocked `sendLicenseEmail` + mocked `stripe.checkout.sessions.retrieve`:
  - Idempotency: second call with same `event.id` is a no-op.
  - `checkout.session.completed` happy path: upserts + emails.
  - `customer.subscription.updated` with identical claims: upserts (touches `updated_at`) but does NOT email.
  - `customer.subscription.updated` with changed tier: upserts + emails.
  - `customer.subscription.deleted`: revokes, no email.
  - Unknown event type: no-op.
  - Handler throws → verify compensating `deleteProcessedEvent` is called.
- `env.spec.ts` — throws on missing vars, throws on bad hex format, loads successfully with all vars present. Uses `jest.isolateModules` per test.

### Integration tests (`nx test minting-service --testPathPattern=integration`, Jest + real Postgres)

- Spin up `postgres:16` via `testcontainers` (Jest global setup/teardown).
- Run Drizzle migrations against it.
- Test real query functions from `@cacheplane/db`: `upsertLicense`, `markEventProcessed`, `revokeLicense`, `getLicense`, `updateLicenseToken`, `deleteProcessedEvent`.
- Test `handleEvent` end-to-end with real DB + mocked Stripe SDK + mocked Resend. Verifies idempotency actually works at the DB level (not just mocked).

### Manual smoke test (documented in README, run once per deploy to preview)

1. `stripe trigger checkout.session.completed` against preview webhook URL.
2. Verify row: `SELECT * FROM licenses ORDER BY created_at DESC LIMIT 1`.
3. Verify email arrives at a test address (Resend test mode).
4. Copy token → paste into a test app with `CACHEPLANE_LICENSE=<token>` → verify `runLicenseCheck` reports `active`.
5. `stripe trigger customer.subscription.deleted` → verify `revoked_at` is set.
6. `nx run minting-service:remint --sub=<that-sub> --dry-run` → verify it refuses (revoked).

### Not tested

- Stripe's own webhook delivery / signature logic — trust the SDK.
- Resend's email internals — trust their API.
- End-to-end against live Stripe in CI — too flaky, too expensive. Preview manual smoke covers it.

---

## 10. Out of Scope (deferred to later plans)

### Customer-facing features
- Customer portal / license dashboard (viewing, downloading, resending from a web UI). Requires auth, which pulls in user accounts.
- Self-service "resend my license email" flow.
- In-app license management (upgrading tier, adding seats) outside Stripe's own customer portal.
- Showing license status on the marketing site.

### Sales / checkout
- Stripe Checkout integration on the website (`cacheplane.dev/pricing` → checkout). **This is Plan 3.**
- Free trials, coupons, custom pricing — handled entirely in Stripe, outside this service.
- Annual vs. monthly toggle — Stripe price config, no service changes.

### Licensing model extensions
- Offline license files (signed JSON as downloaded file instead of email token). Schema supports it.
- Per-environment licenses (dev/staging/prod).
- License usage telemetry (reporting seat usage to a server). `@cacheplane/licensing` has telemetry hooks but no receiving endpoint. Separate plan.
- Floating / concurrent-user licenses — current design is seat-count.

### Operations
- `processed_events` retention cron.
- Automated migration runs in CI (manual for v1).
- Alerting on webhook failures (Vercel log drains → Sentry/Datadog).
- Admin UI for browsing licenses (use `psql` for v1).
- Automated signing-key rotation — requires library republish or a `kid` field for multi-key verification. Deliberately punted.

### Stripe event coverage
- `invoice.payment_failed` — rely on Stripe dunning + eventual `customer.subscription.deleted`.
- `customer.subscription.paused`, `trialing` — not enabled in v1 product.
- Refunds — manual.
- Metered/usage-based pricing — product is flat subscription for v1.

### Security hardening
- Signing key stored in Vercel env var, not a KMS (AWS KMS / GCP KMS). Later plan if threat model justifies it.
- No rate limiting on the webhook beyond Vercel defaults — Stripe is the only caller.
- No audit log of re-mint invocations. A `remint_log` table is a later addition if needed for compliance.
