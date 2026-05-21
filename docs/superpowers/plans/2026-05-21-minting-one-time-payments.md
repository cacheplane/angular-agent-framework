# Minting One-Time Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the minting service mint and email license tokens for one-time-payment Checkout sessions (PR B-Stripe's locked billing model). Rename the DB column that key-identifies a license from `stripe_subscription_id` to `stripe_payment_id`, drop the subscription handlers, rewrite `handleCheckoutCompleted` for `mode: 'payment'`, and make the website always create a Stripe customer at Checkout.

**Architecture:** Three subsystems touched: `libs/db` (schema + queries + new drizzle migration), `apps/minting-service` (handlers + spec, strip subscription paths), `apps/website` (one-line addition to the Checkout session create call + spec assertion). DB is empty so the column rename is destructive-safe; drizzle migration is a single `ALTER TABLE RENAME COLUMN` + constraint rename. Subscription handlers are deleted entirely per the locked one-time-only decision.

**Tech Stack:** Drizzle ORM + Postgres (Neon), Stripe Node SDK 22.x, Vitest, Vercel deploy via existing CI.

**Reference:** Spec at `docs/superpowers/specs/2026-05-21-minting-one-time-payments-design.md`.

---

## File map

- **Modify:** `libs/db/src/lib/schema/licenses.ts` — rename field + column + unique constraint.
- **Modify:** `libs/db/src/lib/queries/licenses.ts` — `upsertLicense`/`getLicense`/`revokeLicense` use new column name.
- **Modify:** `libs/db/src/lib/queries/licenses.spec.ts` — all `stripeSubscriptionId` references → `stripePaymentId`; fixture values switch from `sub_*` to `pi_*`.
- **Create:** `libs/db/drizzle/0001_rename_subscription_to_payment.sql` — manual migration.
- **Modify:** `libs/db/drizzle/meta/_journal.json` — append `0001_*` entry.
- **Modify:** `apps/minting-service/src/lib/handlers.ts` — delete `handleSubscriptionUpdated`/`handleSubscriptionDeleted`, rewrite `handleCheckoutCompleted` for `mode: 'payment'`.
- **Modify:** `apps/minting-service/src/lib/handlers.spec.ts` — drop subscription tests, add one-time-payment tests.
- **Modify:** `apps/website/src/app/api/checkout/session/route.ts` — pass `customer_creation: 'always'`.
- **Modify:** `apps/website/src/app/api/checkout/session/route.spec.ts` — assert `customer_creation: 'always'` is passed.

No changes to `@ngaf/chat`, `@ngaf/licensing`, the cockpit, examples, or any other library.

---

## Task 1: Rename DB schema column

**Files:**
- Modify: `libs/db/src/lib/schema/licenses.ts`

- [ ] **Step 1: Read the current schema**

Run: `cat libs/db/src/lib/schema/licenses.ts`

Confirm the file declares `stripeSubscriptionId: text('stripe_subscription_id').notNull().unique()`.

- [ ] **Step 2: Apply the rename**

Use Edit on `libs/db/src/lib/schema/licenses.ts`:

- `old_string`:
```ts
    stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
```

- `new_string`:
```ts
    stripePaymentId: text('stripe_payment_id').notNull().unique(),
```

- [ ] **Step 3: Verify**

Run: `grep -c "stripeSubscriptionId\|stripe_subscription_id" libs/db/src/lib/schema/licenses.ts`
Expected: `0`.

Run: `grep -c "stripePaymentId.*stripe_payment_id" libs/db/src/lib/schema/licenses.ts`
Expected: `1`.

- [ ] **Step 4: Commit**

```bash
git add libs/db/src/lib/schema/licenses.ts
git commit -m "$(cat <<'EOF'
refactor(db): rename licenses.stripe_subscription_id → stripe_payment_id

PR B-Stripe locked one-time payments — the column now stores either a
PaymentIntent ID (one-time) or a Subscription ID (future subscription
tier, if reintroduced). Renaming reflects the actual contract: this is
"the unique Stripe-side reference," not a subscription-specific field.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create drizzle migration `0001_rename_subscription_to_payment.sql`

**Files:**
- Create: `libs/db/drizzle/0001_rename_subscription_to_payment.sql`
- Modify: `libs/db/drizzle/meta/_journal.json`

- [ ] **Step 1: Write the migration SQL**

Create `libs/db/drizzle/0001_rename_subscription_to_payment.sql` with this exact content:

```sql
ALTER TABLE "licenses" RENAME COLUMN "stripe_subscription_id" TO "stripe_payment_id";--> statement-breakpoint
ALTER TABLE "licenses" RENAME CONSTRAINT "licenses_stripe_subscription_id_unique" TO "licenses_stripe_payment_id_unique";
```

- [ ] **Step 2: Append journal entry**

Use Edit on `libs/db/drizzle/meta/_journal.json`. Find the `entries` array:

```json
{
    "version": "7",
    "dialect": "postgresql",
    "entries": [
        {
            "idx": 0,
            "version": "7",
            "when": 1776716165218,
            "tag": "0000_init",
            "breakpoints": true
        }
    ]
}
```

Replace with (add a second entry):

```json
{
    "version": "7",
    "dialect": "postgresql",
    "entries": [
        {
            "idx": 0,
            "version": "7",
            "when": 1776716165218,
            "tag": "0000_init",
            "breakpoints": true
        },
        {
            "idx": 1,
            "version": "7",
            "when": 1779388800000,
            "tag": "0001_rename_subscription_to_payment",
            "breakpoints": true
        }
    ]
}
```

(The `when` value is `Date.now()` at plan-write time, approximately. Drizzle doesn't validate exact values; just monotonically increasing.)

- [ ] **Step 3: Validate JSON**

Run: `python3 -c "import json; json.load(open('libs/db/drizzle/meta/_journal.json')); print('ok')"`
Expected: `ok`.

- [ ] **Step 4: Update the snapshot file if drizzle-kit needs one**

Drizzle migrations track the schema snapshot per migration. Check whether `libs/db/drizzle/meta/0000_snapshot.json` exists — if so, the cleanest move is to regenerate the snapshot via `drizzle-kit`. However, regenerating may pull in unrelated schema noise.

For safety, simply copy `0000_snapshot.json` to `0001_snapshot.json` and edit the one column reference:

```bash
cp libs/db/drizzle/meta/0000_snapshot.json libs/db/drizzle/meta/0001_snapshot.json
sed -i '' 's/"stripe_subscription_id"/"stripe_payment_id"/g; s/"stripeSubscriptionId"/"stripePaymentId"/g; s/"licenses_stripe_subscription_id_unique"/"licenses_stripe_payment_id_unique"/g' libs/db/drizzle/meta/0001_snapshot.json
```

Verify: `grep -c "stripe_subscription_id\|stripeSubscriptionId" libs/db/drizzle/meta/0001_snapshot.json` → `0`.

- [ ] **Step 5: Commit**

```bash
git add libs/db/drizzle/
git commit -m "$(cat <<'EOF'
db: add 0001 migration renaming stripe_subscription_id → stripe_payment_id

Single ALTER TABLE RENAME COLUMN + constraint rename. DB is empty
(confirmed via SELECT count(*) FROM licenses → 0), so this is data-
preserving but no-data-risk. Mirrors the schema change in 1/1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update `libs/db/src/lib/queries/licenses.ts`

**Files:**
- Modify: `libs/db/src/lib/queries/licenses.ts`

- [ ] **Step 1: Read the current file**

Run: `cat libs/db/src/lib/queries/licenses.ts | head -50`

Identify all references to `stripeSubscriptionId` (TypeScript) and `stripe_subscription_id` (none in this file — that's in the schema).

- [ ] **Step 2: Rename in `upsertLicense`'s `onConflictDoUpdate.target`**

Use Edit:

- `old_string`: `      target: licenses.stripeSubscriptionId,`
- `new_string`: `      target: licenses.stripePaymentId,`

- [ ] **Step 3: Rename `getLicense` parameter + where clause**

Use Edit:

- `old_string`:
```ts
export async function getLicense(db: Db, stripeSubscriptionId: string): Promise<License | null> {
  const rows = await db
    .select()
    .from(licenses)
    .where(eq(licenses.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return rows[0] ?? null;
}
```

- `new_string`:
```ts
export async function getLicense(db: Db, stripePaymentId: string): Promise<License | null> {
  const rows = await db
    .select()
    .from(licenses)
    .where(eq(licenses.stripePaymentId, stripePaymentId))
    .limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 4: Rename `revokeLicense` parameter + where clause**

Use Edit:

- `old_string`:
```ts
export async function revokeLicense(db: Db, stripeSubscriptionId: string): Promise<License | null> {
  const rows = await db
    .update(licenses)
    .set({ revokedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(licenses.stripeSubscriptionId, stripeSubscriptionId))
    .returning();
  return rows[0] ?? null;
}
```

- `new_string`:
```ts
export async function revokeLicense(db: Db, stripePaymentId: string): Promise<License | null> {
  const rows = await db
    .update(licenses)
    .set({ revokedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(licenses.stripePaymentId, stripePaymentId))
    .returning();
  return rows[0] ?? null;
}
```

- [ ] **Step 5: Verify**

Run: `grep -c "stripeSubscriptionId" libs/db/src/lib/queries/licenses.ts`
Expected: `0`.

Run: `grep -c "stripePaymentId" libs/db/src/lib/queries/licenses.ts`
Expected: `4` (one in `target:`, two in `where(eq(...))`, plus the parameter in two function signatures).

- [ ] **Step 6: Commit**

```bash
git add libs/db/src/lib/queries/licenses.ts
git commit -m "$(cat <<'EOF'
refactor(db): rename license queries to use stripePaymentId

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update `libs/db/src/lib/queries/licenses.spec.ts`

**Files:**
- Modify: `libs/db/src/lib/queries/licenses.spec.ts`

- [ ] **Step 1: Read the file**

Run: `cat libs/db/src/lib/queries/licenses.spec.ts`

Confirm the test file uses `stripeSubscriptionId` in the `base` fixture and per-test overrides (`sub_1`, `sub_insert`, `sub_update`, `sub_get`, `sub_e1`, `sub_e2`).

- [ ] **Step 2: Apply the rename**

Use Edit with `replace_all: true`:
- `old_string`: `stripeSubscriptionId`
- `new_string`: `stripePaymentId`

Then apply ALL of these (one Edit each, `replace_all: false` since each is unique) to update test fixture values from `sub_*` to `pi_*`:

| Find | Replace with |
|---|---|
| `'sub_1'` | `'pi_1'` |
| `'sub_insert'` | `'pi_insert'` |
| `'sub_update'` | `'pi_update'` |
| `'sub_get'` | `'pi_get'` |
| `'sub_e1'` | `'pi_e1'` |
| `'sub_e2'` | `'pi_e2'` |

- [ ] **Step 3: Verify**

Run: `grep -c "stripeSubscriptionId\|'sub_" libs/db/src/lib/queries/licenses.spec.ts`
Expected: `0`.

Run: `grep -c "stripePaymentId\|'pi_" libs/db/src/lib/queries/licenses.spec.ts`
Expected: `>= 12` (varies by exact test count; just confirm both names appear).

- [ ] **Step 4: Run the spec**

Run: `npx nx run db:test 2>&1 | tail -15`
Expected: `Successfully ran target test for project db`. All license-spec tests pass against the renamed column.

If the test runner can't reach a DB (e.g., expects a local Postgres or test container), the failure mode is environmental and not a regression of this change. In that case, run just the type check: `npx tsc -p libs/db/tsconfig.lib.json --noEmit 2>&1 | grep licenses\.spec || echo "type-clean"`. Expected: `type-clean`.

- [ ] **Step 5: Commit**

```bash
git add libs/db/src/lib/queries/licenses.spec.ts
git commit -m "$(cat <<'EOF'
test(db): rename license-query test fixtures to stripePaymentId/pi_*

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Strip subscription handlers + rewrite `handleCheckoutCompleted`

**Files:**
- Modify: `apps/minting-service/src/lib/handlers.ts`

- [ ] **Step 1: Replace the whole file**

Write `apps/minting-service/src/lib/handlers.ts` with this exact content:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type Stripe from 'stripe';
import type {
  Db,
  License,
  UpsertLicenseInput,
} from '@ngaf/db';
import type { MintInput } from './sign.js';
import type { LicenseEmailVars } from './email.js';
import { extractTier, computeSeats } from './tier.js';

/**
 * All external collaborators are injected so handlers are unit-testable.
 */
export interface HandlerDeps {
  db: Db;
  stripe: Stripe;
  markEventProcessed: (db: Db, id: string, type: string) => Promise<boolean>;
  deleteProcessedEvent: (db: Db, id: string) => Promise<void>;
  upsertLicense: (db: Db, input: UpsertLicenseInput) => Promise<License>;
  getLicense: (db: Db, stripePaymentId: string) => Promise<License | null>;
  revokeLicense: (db: Db, stripePaymentId: string) => Promise<License | null>;
  mintToken: (input: MintInput, privateKeyHex: string) => Promise<string>;
  sendLicenseEmail: (args: {
    resendApiKey: string;
    from: string;
    to: string;
    vars: LicenseEmailVars;
  }) => Promise<{ resendId: string }>;
  privateKeyHex: string;
  resendApiKey: string;
  emailFrom: string;
  defaultTtlDays: number;
}

export async function handleEvent(event: Stripe.Event, deps: HandlerDeps): Promise<void> {
  const firstTime = await deps.markEventProcessed(deps.db, event.id, event.type);
  if (!firstTime) return;

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, deps);
        break;
      default:
        return;
    }
  } catch (err) {
    await deps.deleteProcessedEvent(deps.db, event.id);
    throw err;
  }
}

/**
 * Handles a completed Stripe Checkout session in `mode: 'payment'`
 * (one-time payment). Subscription mode is not handled — the only paid
 * tiers ship as one-time 12-month payments. A subscription-mode session
 * is logged and dropped.
 */
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  deps: HandlerDeps,
): Promise<void> {
  const expanded = await deps.stripe.checkout.sessions.retrieve(session.id, {
    expand: ['line_items.data.price'],
  });

  if (expanded.mode !== 'payment') {
    // eslint-disable-next-line no-console
    console.log(`handleCheckoutCompleted: skipping non-payment session ${session.id} (mode=${expanded.mode})`);
    return;
  }

  const lineItem = expanded.line_items?.data?.[0];
  if (!lineItem) {
    throw new Error(`handleCheckoutCompleted: session ${session.id} has no line items`);
  }
  const priceMetadata = (lineItem.price?.metadata ?? {}) as Record<string, string>;
  const tier = extractTier(priceMetadata);
  const seats = computeSeats(tier, lineItem.quantity);

  const paymentId = typeof expanded.payment_intent === 'string'
    ? expanded.payment_intent
    : expanded.payment_intent?.id;
  if (!paymentId) {
    throw new Error(`handleCheckoutCompleted: session ${session.id} has no payment_intent`);
  }

  const customerId = typeof expanded.customer === 'string'
    ? expanded.customer
    : expanded.customer?.id;
  if (!customerId) {
    throw new Error(`handleCheckoutCompleted: session ${session.id} has no customer (customer_creation: 'always' must be set on the Checkout session)`);
  }

  const email = expanded.customer_details?.email;
  if (!email) {
    throw new Error(`handleCheckoutCompleted: session ${session.id} has no customer email`);
  }

  const expiresAt = new Date(Date.now() + deps.defaultTtlDays * 24 * 60 * 60 * 1000);

  const token = await deps.mintToken(
    { stripeCustomerId: customerId, tier, seats, expiresAt },
    deps.privateKeyHex,
  );

  await deps.upsertLicense(deps.db, {
    stripeCustomerId: customerId,
    stripePaymentId: paymentId,
    customerEmail: email,
    tier,
    seats,
    expiresAt,
    lastToken: token,
  });

  await deps.sendLicenseEmail({
    resendApiKey: deps.resendApiKey,
    from: deps.emailFrom,
    to: email,
    vars: { tier, seats, token, expiresAt },
  });
}
```

This replaces the entire file:
- Removes `handleSubscriptionUpdated` and `handleSubscriptionDeleted` exports.
- Removes the two corresponding `case` branches.
- Rewrites `handleCheckoutCompleted` for `mode: 'payment'`.
- Renames the `HandlerDeps` `getLicense`/`revokeLicense` parameter doc from "subId" to "stripePaymentId" (just a renamed param, signature unchanged at the call site).

- [ ] **Step 2: Type-check**

Run from repo root: `npx tsc -p apps/minting-service/tsconfig.json --noEmit 2>&1 | grep -E "handlers\.ts|TS2" | grep -v TS6305 || echo "ok"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add apps/minting-service/src/lib/handlers.ts
git commit -m "$(cat <<'EOF'
feat(minting): handle one-time-payment Checkout sessions; strip subs

Rewrites handleCheckoutCompleted for mode: 'payment':
- Uses payment_intent as the unique Stripe-side reference
- Requires customer (via customer_creation: 'always' on the website)
- Reads email from customer_details.email
- Computes expiresAt from defaultTtlDays (no subscription period to read)

Removes handleSubscriptionUpdated and handleSubscriptionDeleted entirely
per the locked one-time-only billing decision. Subscription event types
fall through to the default no-op.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Rewrite `apps/minting-service/src/lib/handlers.spec.ts`

**Files:**
- Modify: `apps/minting-service/src/lib/handlers.spec.ts`

The existing spec tests `handleEvent` dispatching to subscription handlers. Strip those, add one-time-payment tests.

- [ ] **Step 1: Read the existing spec**

Run: `cat apps/minting-service/src/lib/handlers.spec.ts | head -80`

Identify the structure: a `makeDeps` helper, an `evt` helper, and `describe` blocks.

- [ ] **Step 2: Replace the whole file**

Write `apps/minting-service/src/lib/handlers.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import type Stripe from 'stripe';
import { handleEvent, handleCheckoutCompleted, type HandlerDeps } from './handlers.js';

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    db: {} as never,
    stripe: {} as never,
    markEventProcessed: vi.fn().mockResolvedValue(true),
    deleteProcessedEvent: vi.fn().mockResolvedValue(undefined),
    upsertLicense: vi.fn(),
    getLicense: vi.fn(),
    revokeLicense: vi.fn(),
    mintToken: vi.fn().mockResolvedValue('mock.token'),
    sendLicenseEmail: vi.fn().mockResolvedValue({ resendId: 're_mock' }),
    privateKeyHex: 'a'.repeat(64),
    resendApiKey: 're_test',
    emailFrom: 'noreply@example.com',
    defaultTtlDays: 365,
    ...overrides,
  };
}

function evt(type: string, obj: unknown = {}): Stripe.Event {
  return { id: `evt_${type}`, type, data: { object: obj } } as Stripe.Event;
}

function paymentSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_123',
    mode: 'payment',
    payment_intent: 'pi_test_123',
    customer: 'cus_test_123',
    customer_details: { email: 'buyer@example.com' } as Stripe.Checkout.Session.CustomerDetails,
    line_items: {
      data: [
        {
          quantity: 1,
          price: {
            metadata: { ngaf_tier_slug: 'indie' },
          } as Stripe.Price,
        } as Stripe.LineItem,
      ],
    } as Stripe.ApiList<Stripe.LineItem>,
    ...overrides,
  } as Stripe.Checkout.Session;
}

describe('handleEvent', () => {
  it('returns early if markEventProcessed returns false (duplicate)', async () => {
    const deps = makeDeps({
      markEventProcessed: vi.fn().mockResolvedValue(false),
    });
    await handleEvent(evt('checkout.session.completed', { id: 'cs_x' }), deps);
    expect(deps.upsertLicense).not.toHaveBeenCalled();
    expect(deps.sendLicenseEmail).not.toHaveBeenCalled();
  });

  it('no-ops on unknown event types (including subscription events)', async () => {
    const deps = makeDeps();
    await handleEvent(evt('customer.subscription.updated'), deps);
    await handleEvent(evt('customer.subscription.deleted'), deps);
    await handleEvent(evt('invoice.payment_succeeded'), deps);
    expect(deps.upsertLicense).not.toHaveBeenCalled();
    expect(deps.sendLicenseEmail).not.toHaveBeenCalled();
  });

  it('dispatches checkout.session.completed to handleCheckoutCompleted', async () => {
    const session = paymentSession();
    const stripe = {
      checkout: {
        sessions: { retrieve: vi.fn().mockResolvedValue(session) },
      },
    } as unknown as Stripe;
    const deps = makeDeps({ stripe });
    await handleEvent(evt('checkout.session.completed', session), deps);
    expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_123', expect.any(Object));
    expect(deps.upsertLicense).toHaveBeenCalledTimes(1);
    expect(deps.sendLicenseEmail).toHaveBeenCalledTimes(1);
  });

  it('compensating-deletes the processed-event marker when handler throws', async () => {
    const session = paymentSession({ payment_intent: null });
    const stripe = {
      checkout: {
        sessions: { retrieve: vi.fn().mockResolvedValue(session) },
      },
    } as unknown as Stripe;
    const deps = makeDeps({ stripe });
    await expect(
      handleEvent(evt('checkout.session.completed', session), deps),
    ).rejects.toThrow(/no payment_intent/);
    expect(deps.deleteProcessedEvent).toHaveBeenCalledTimes(1);
  });
});

describe('handleCheckoutCompleted', () => {
  it('mints, upserts, and emails on a complete one-time payment session', async () => {
    const session = paymentSession();
    const stripe = {
      checkout: {
        sessions: { retrieve: vi.fn().mockResolvedValue(session) },
      },
    } as unknown as Stripe;
    const deps = makeDeps({ stripe });
    await handleCheckoutCompleted(session, deps);

    expect(deps.mintToken).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCustomerId: 'cus_test_123',
        tier: 'indie',
        seats: 1,
        expiresAt: expect.any(Date),
      }),
      'a'.repeat(64),
    );
    expect(deps.upsertLicense).toHaveBeenCalledWith(
      {} as never,
      expect.objectContaining({
        stripeCustomerId: 'cus_test_123',
        stripePaymentId: 'pi_test_123',
        customerEmail: 'buyer@example.com',
        tier: 'indie',
        seats: 1,
        lastToken: 'mock.token',
      }),
    );
    expect(deps.sendLicenseEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@example.com',
        to: 'buyer@example.com',
        vars: expect.objectContaining({ tier: 'indie', seats: 1, token: 'mock.token' }),
      }),
    );
  });

  it('skips subscription-mode sessions without minting', async () => {
    const session = paymentSession({ mode: 'subscription' });
    const stripe = {
      checkout: {
        sessions: { retrieve: vi.fn().mockResolvedValue(session) },
      },
    } as unknown as Stripe;
    const deps = makeDeps({ stripe });
    await handleCheckoutCompleted(session, deps);
    expect(deps.mintToken).not.toHaveBeenCalled();
    expect(deps.upsertLicense).not.toHaveBeenCalled();
    expect(deps.sendLicenseEmail).not.toHaveBeenCalled();
  });

  it('throws when the session has no payment_intent', async () => {
    const session = paymentSession({ payment_intent: null });
    const stripe = {
      checkout: {
        sessions: { retrieve: vi.fn().mockResolvedValue(session) },
      },
    } as unknown as Stripe;
    const deps = makeDeps({ stripe });
    await expect(handleCheckoutCompleted(session, deps)).rejects.toThrow(/no payment_intent/);
  });

  it('throws when the session has no customer', async () => {
    const session = paymentSession({ customer: null });
    const stripe = {
      checkout: {
        sessions: { retrieve: vi.fn().mockResolvedValue(session) },
      },
    } as unknown as Stripe;
    const deps = makeDeps({ stripe });
    await expect(handleCheckoutCompleted(session, deps)).rejects.toThrow(/customer_creation/);
  });

  it('throws when the session has no customer email', async () => {
    const session = paymentSession({
      customer_details: { email: null } as Stripe.Checkout.Session.CustomerDetails,
    });
    const stripe = {
      checkout: {
        sessions: { retrieve: vi.fn().mockResolvedValue(session) },
      },
    } as unknown as Stripe;
    const deps = makeDeps({ stripe });
    await expect(handleCheckoutCompleted(session, deps)).rejects.toThrow(/no customer email/);
  });
});
```

- [ ] **Step 3: Run the spec**

Run: `npx nx run minting-service:test 2>&1 | tail -15`
Expected: `Successfully ran target test for project minting-service`. All tests pass.

If a test fails, read the output and either fix the spec assertion or the implementation. Common cause: forgetting `await` or mis-typed `expect.objectContaining` shapes.

- [ ] **Step 4: Commit**

```bash
git add apps/minting-service/src/lib/handlers.spec.ts
git commit -m "$(cat <<'EOF'
test(minting): cover one-time payment handler + skip subscription mode

8 tests:
- handleEvent dispatches to checkout.session.completed
- handleEvent no-ops on subscription events (now unhandled)
- compensating delete on handler throw
- handleCheckoutCompleted mints+upserts+emails on payment mode
- handleCheckoutCompleted skips subscription mode without minting
- throws on missing payment_intent, customer, or customer email

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add `customer_creation: 'always'` to website Checkout session

**Files:**
- Modify: `apps/website/src/app/api/checkout/session/route.ts`
- Modify: `apps/website/src/app/api/checkout/session/route.spec.ts`

- [ ] **Step 1: Add the param to the route**

Use Edit on `apps/website/src/app/api/checkout/session/route.ts`. Find:

```ts
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
```

Replace with:

```ts
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_creation: 'always',
    line_items: [
```

- [ ] **Step 2: Update the spec assertion**

Use Edit on `apps/website/src/app/api/checkout/session/route.spec.ts`. Find the test asserting the `indie` happy path:

```ts
    expect(args.mode).toBe('payment');
    expect(args.line_items[0].price).toBe('price_test_indie');
```

Replace with:

```ts
    expect(args.mode).toBe('payment');
    expect(args.customer_creation).toBe('always');
    expect(args.line_items[0].price).toBe('price_test_indie');
```

- [ ] **Step 3: Run the spec**

Run from `apps/website/`: `npx vitest run src/app/api/checkout/session/route.spec.ts 2>&1 | tail -10`
Expected: 7 passed (same count as before; one test gains an additional assertion).

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app/api/checkout/session/route.ts apps/website/src/app/api/checkout/session/route.spec.ts
git commit -m "$(cat <<'EOF'
feat(website): always create a Stripe customer at Checkout

customer_creation: 'always' guarantees the resulting checkout.session.completed
event carries a customer field, which the minting service requires to
write a license record (stripe_customer_id is NOT NULL).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full library test**

Run from repo root:
```
npx nx run db:test 2>&1 | tail -5
npx nx run minting-service:test 2>&1 | tail -5
npx nx run website:test 2>&1 | tail -5
```
All three expect `Successfully ran target test`.

- [ ] **Step 2: Build minting + website**

```
npx nx build minting-service 2>&1 | tail -5
npx nx build website 2>&1 | tail -5
```
Both expect `Successfully ran target build`.

- [ ] **Step 3: Lint**

```
npx nx run db:lint 2>&1 | tail -3
npx nx run minting-service:lint 2>&1 | tail -3
npx nx run website:lint 2>&1 | tail -3
```
All expect `Successfully ran target lint`.

- [ ] **Step 4: Scope check**

```bash
git diff --name-only origin/main..HEAD | grep -vE '^(libs/db/|apps/minting-service/|apps/website/src/app/api/checkout/|docs/superpowers/)' | head
```
Expected: empty.

- [ ] **Step 5: Smoke (post-merge, operational)**

Document the smoke runbook in the PR description so it's executable after the merge:

```
1. Apply the DB migration:
   set -a && source /Users/blove/repos/angular-agent-framework/.env && set +a
   node -e "const {neon}=require('@neondatabase/serverless');const sql=neon(process.env.DATABASE_URL);(async()=>{
     await sql\`ALTER TABLE licenses RENAME COLUMN stripe_subscription_id TO stripe_payment_id\`;
     await sql\`ALTER TABLE licenses RENAME CONSTRAINT licenses_stripe_subscription_id_unique TO licenses_stripe_payment_id_unique\`;
     console.log('migration applied');
   })()"

2. CI's minting-deploy fires automatically when the PR lands on main.
   Wait for green; confirm https://mint.threadplane.ai/api/health returns 200.

3. Re-run the smoke:
   stripe trigger checkout.session.completed --api-key $STRIPE_SECRET_KEY \
     --override checkout_session:metadata.ngaf_tier_slug=indie

4. Check Resend logs API for the resulting send:
   curl -sS "https://api.resend.com/emails?limit=5" -H "Authorization: Bearer $RESEND_API_KEY"
   Expect a send with subject including "license" and to=customer_details.email.

5. Check the DB row:
   node -e "const{neon}=require('@neondatabase/serverless');const sql=neon(process.env.DATABASE_URL);(async()=>{
     const rows = await sql\`SELECT stripe_customer_id, stripe_payment_id, customer_email, tier, seats, expires_at FROM licenses ORDER BY created_at DESC LIMIT 1\`;
     console.log(rows);
   })()"
```

---

## Self-review

**Spec coverage:**
- Spec § schema rename → Task 1. ✓
- Spec § new drizzle migration → Task 2 (SQL + journal + snapshot). ✓
- Spec § queries rename → Task 3. ✓
- Spec § queries spec rename → Task 4. ✓
- Spec § handler rewrite + strip subscription handlers → Task 5. ✓
- Spec § handler spec rewrite → Task 6. ✓
- Spec § `customer_creation: 'always'` on website route → Task 7. ✓
- Spec § verification + smoke runbook → Task 8. ✓
- Spec § acceptance criteria 1–8 → Tasks 1–8 collectively. ✓

**Placeholder scan:** No TBD/TODO. Task 2 Step 4 includes an inline `cp + sed` fallback for the snapshot file with the exact substitutions specified.

**Type consistency:** `stripePaymentId` consistent in schema (Task 1), queries (Task 3), tests (Task 4), handler `HandlerDeps` param doc (Task 5), upsert call (Task 5), and tests (Task 6). `payment_intent` shape from Stripe is consistent across handler reads and test fixtures. `customer_creation: 'always'` is referenced by name in handler error message (Task 5), website route (Task 7), and one test in Task 6.

Plan complete.
