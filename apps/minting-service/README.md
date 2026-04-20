# @cacheplane/minting-service

License minting service for Cacheplane. Receives Stripe webhooks, signs
Ed25519 license tokens via `@cacheplane/licensing`, persists them to
Postgres via `@cacheplane/db`, and emails them to customers via Resend.

**Design spec:** `docs/superpowers/specs/2026-04-20-minting-service-design.md`

## What this service does

- Handles Stripe events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Mints a signed license token per active subscription.
- Emails the token to the customer.
- Stores license state keyed on `stripe_subscription_id`.

## What this service does NOT do

- No customer portal / self-service resend (run the CLI — see below).
- No pricing/checkout UI (handled on the website — Plan 3).
- No automated key rotation (requires library republish).

## Local development

1. Install Docker (for local Postgres) and the Stripe CLI.
2. From the repo root:
   ```bash
   docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16
   cp apps/minting-service/.env.example apps/minting-service/.env
   # Edit .env with local values; for LICENSE_SIGNING_PRIVATE_KEY_HEX
   # generate a keypair (see "Generating a signing key" below).
   DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres npx nx run db:db:migrate
   cd apps/minting-service && vercel dev
   ```
3. In another terminal:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe-webhook
   # Copy the printed whsec_... into apps/minting-service/.env as STRIPE_WEBHOOK_SECRET
   ```
4. Trigger events:
   ```bash
   stripe trigger checkout.session.completed
   ```

## Generating a signing key

```bash
node -e "import('@noble/ed25519').then(async (e) => {
  const sk = e.utils.randomPrivateKey();
  const pk = await e.getPublicKeyAsync(sk);
  console.log('priv (LICENSE_SIGNING_PRIVATE_KEY_HEX):', Buffer.from(sk).toString('hex'));
  console.log('pub  (LICENSE_PUBLIC_KEY in @cacheplane/licensing):', Buffer.from(pk).toString('hex'));
});"
```

Store the private key in the Vercel env as `LICENSE_SIGNING_PRIVATE_KEY_HEX`
marked "Sensitive". Back up to a password manager. The **public** key must be
baked into `libs/licensing/src/lib/license-public-key.generated.ts` and the
lib republished.

## Environment variables

All listed in `.env.example`. Validated at process start by `src/lib/env.ts`.
Missing/malformed vars throw with a descriptive message.

## Deployment

1. Ensure schema is up to date:
   ```bash
   DATABASE_URL=<prod-url> npx nx run db:db:migrate
   ```
2. Push. Vercel deploys from `main` automatically for production and per PR
   for previews.
3. Smoke test preview:
   ```bash
   curl https://<preview>.vercel.app/api/health   # {"ok":true}
   stripe trigger checkout.session.completed      # (against preview webhook endpoint)
   ```

## Operator runbook

### Re-mint a license

```bash
nx run minting-service:remint --sub=sub_1234 [--dry-run] [--to=new@email.com] [--new-token]
```

- `--sub=<stripe_subscription_id>` (required): which license to resend.
- `--dry-run`: print what would be sent; don't call Resend.
- `--to=<email>`: override destination (use after an email bounce).
- `--new-token`: re-sign a fresh token (updates `last_token` + `issued_at`).
  Default is to re-send the existing `last_token`.

Revoked licenses are refused.

### Look up a customer's license

```bash
psql $DATABASE_URL -c "SELECT * FROM licenses WHERE customer_email = 'x@y.z'"
```

### Manually revoke

```sql
UPDATE licenses SET revoked_at = now() WHERE stripe_subscription_id = 'sub_xxx';
```

Prefer canceling the Stripe subscription — this bypasses the normal webhook
flow and won't un-revoke on a new subscription.

### Un-revoke after accidental revoke

```sql
UPDATE licenses SET revoked_at = NULL WHERE stripe_subscription_id = 'sub_xxx';
```

Then `nx run minting-service:remint --sub=sub_xxx --new-token` to issue a
fresh token.

### Retry a failed webhook

1. In the Stripe dashboard → Developers → Webhooks, find the failed event `evt_xxx`.
2. Check if we recorded it:
   ```sql
   SELECT * FROM processed_events WHERE stripe_event_id = 'evt_xxx';
   ```
3. If present: `DELETE FROM processed_events WHERE stripe_event_id = 'evt_xxx';`
4. Click "Resend" on the event in Stripe.

### Rotate the signing key (manual, v1)

Current design requires a library republish (no multi-key verification).
Steps:

1. Generate new keypair (see "Generating a signing key").
2. Update `libs/licensing/src/lib/license-public-key.generated.ts` with the new public key.
3. Republish `@cacheplane/licensing` (minor version bump).
4. Update `LICENSE_SIGNING_PRIVATE_KEY_HEX` in Vercel env.
5. Deploy minting service.
6. Batch-remint all active licenses:
   ```bash
   # Example: loop over all non-revoked subs and re-mint with fresh tokens
   psql $DATABASE_URL -t -c "SELECT stripe_subscription_id FROM licenses WHERE revoked_at IS NULL" | \
     xargs -I{} nx run minting-service:remint --sub={} --new-token
   ```

All existing tokens become unverifiable once customers upgrade the library.

## Why this repo is public

The private signing key lives only in Vercel env. Everything else — schema,
webhook logic, re-mint flow — is plumbing. Possession of the key is the only
thing that matters. Documenting the process openly is a transparency plus.
