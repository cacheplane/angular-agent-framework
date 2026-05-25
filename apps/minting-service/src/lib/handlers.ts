// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type Stripe from 'stripe';
import type {
  Db,
  License,
  UpsertLicenseInput,
} from '@ngaf/db';
import type { MintInput } from './sign.js';
import type { LicenseEmailVars, RevocationEmailVars } from './email.js';
import { extractTier, computeSeats, type MintableTier } from './tier.js';

/**
 * All external collaborators are injected so handlers are unit-testable.
 */
export interface HandlerDeps {
  db: Db;
  stripe: Stripe;
  markEventProcessed: (db: Db, id: string, type: string) => Promise<boolean>;
  deleteProcessedEvent: (db: Db, id: string) => Promise<void>;
  upsertLicense: (db: Db, input: UpsertLicenseInput) => Promise<License>;
  getLicense: (db: Db, stripeSubscriptionId: string) => Promise<License | null>;
  getLicensesByCustomerId: (db: Db, customerId: string) => Promise<License[]>;
  revokeLicense: (db: Db, stripeSubscriptionId: string) => Promise<License | null>;
  mintToken: (input: MintInput, privateKeyHex: string) => Promise<string>;
  sendLicenseEmail: (args: {
    resendApiKey: string;
    from: string;
    to: string;
    vars: LicenseEmailVars;
  }) => Promise<{ resendId: string }>;
  sendRevocationEmail: (args: {
    resendApiKey: string;
    from: string;
    to: string;
    vars: RevocationEmailVars;
  }) => Promise<{ resendId: string }>;
  privateKeyHex: string;
  resendApiKey: string;
  emailFrom: string;
}

export async function handleEvent(event: Stripe.Event, deps: HandlerDeps): Promise<void> {
  const firstTime = await deps.markEventProcessed(deps.db, event.id, event.type);
  if (!firstTime) return;

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription, deps);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, deps);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, deps);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge, deps);
        break;
      default:
        return;
    }
  } catch (err) {
    await deps.deleteProcessedEvent(deps.db, event.id);
    throw err;
  }
}

interface SubscriptionLineFacts {
  tier: MintableTier;
  seats: number;
  quantity: number;
}

function readSubscriptionFacts(subscription: Stripe.Subscription): SubscriptionLineFacts {
  const item = subscription.items?.data?.[0];
  if (!item) {
    throw new Error(`subscription ${subscription.id} has no line items`);
  }
  const subMetadata = (subscription.metadata ?? {}) as Record<string, string>;
  const priceMetadata = (item.price?.metadata ?? {}) as Record<string, string>;
  const merged: Record<string, string> = {
    ...priceMetadata,
    ...(subMetadata['ngaf_tier_slug'] ? { ngaf_tier_slug: subMetadata['ngaf_tier_slug'] } : {}),
  };
  const tier = extractTier(merged);
  const quantity = item.quantity ?? 1;
  const seats = computeSeats(tier, quantity);
  return { tier, seats, quantity };
}

function readCustomerId(subscription: Stripe.Subscription): string {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;
  if (!customerId) {
    throw new Error(`subscription ${subscription.id} has no customer`);
  }
  return customerId;
}

function periodEnd(subscription: Stripe.Subscription): Date {
  // current_period_end is unix seconds. As of Stripe API 2026-04-22, it moved
  // off the subscription object and onto each subscription item. Read item
  // first, fall back to the legacy subscription-level field for older API
  // versions or replayed historical events.
  const subRecord = subscription as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const itemEpoch = subRecord.items?.data?.[0]?.current_period_end;
  const subEpoch = subRecord.current_period_end;
  const epoch = itemEpoch ?? subEpoch;
  if (!epoch) {
    throw new Error(`subscription ${subscription.id} has no current_period_end`);
  }
  return new Date(epoch * 1000);
}

async function resolveCustomerEmail(
  subscription: Stripe.Subscription,
  deps: HandlerDeps,
): Promise<string> {
  const customer = subscription.customer;
  if (customer && typeof customer !== 'string') {
    const email = (customer as Stripe.Customer).email;
    if (email) return email;
  }
  const customerId = readCustomerId(subscription);
  const fetched = await deps.stripe.customers.retrieve(customerId);
  if ('deleted' in fetched && fetched.deleted) {
    throw new Error(`subscription ${subscription.id}: customer ${customerId} is deleted`);
  }
  const email = (fetched as Stripe.Customer).email;
  if (!email) {
    throw new Error(`subscription ${subscription.id}: customer ${customerId} has no email`);
  }
  return email;
}

async function mintAndEmail(
  subscription: Stripe.Subscription,
  deps: HandlerDeps,
  opts: { email?: string } = {},
): Promise<void> {
  const { tier, seats } = readSubscriptionFacts(subscription);
  const customerId = readCustomerId(subscription);
  const expiresAt = periodEnd(subscription);
  const email = opts.email ?? (await resolveCustomerEmail(subscription, deps));

  const token = await deps.mintToken(
    { stripeCustomerId: customerId, tier, seats, expiresAt },
    deps.privateKeyHex,
  );

  await deps.upsertLicense(deps.db, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
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
    vars: { tier, seats, token, expiresAt, stripeCustomerId: customerId },
  });
}

/**
 * Mint a license on a brand-new subscription.
 */
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  deps: HandlerDeps,
): Promise<void> {
  await mintAndEmail(subscription, deps);
}

/**
 * Re-mint when seats or status changes. Status transitions to canceled/unpaid
 * do NOT immediately revoke — the license expires naturally at
 * current_period_end.
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  deps: HandlerDeps,
): Promise<void> {
  const existing = await deps.getLicense(deps.db, subscription.id);
  if (!existing) {
    // We never saw a `customer.subscription.created` for this one; treat as
    // a fresh mint so we don't drop the customer on the floor.
    await mintAndEmail(subscription, deps);
    return;
  }

  const facts = readSubscriptionFacts(subscription);
  const seatsChanged = facts.seats !== existing.seats;
  const expiresAtNew = periodEnd(subscription);
  const periodChanged = expiresAtNew.getTime() !== existing.expiresAt.getTime();

  if (seatsChanged || periodChanged) {
    await mintAndEmail(subscription, deps, { email: existing.customerEmail });
  }
  // Other status transitions (active <-> past_due, canceled-at-period-end)
  // are no-ops: the existing license stays valid through its expires_at.
}

/**
 * On a renewal invoice (`billing_reason: subscription_cycle`), re-mint with
 * the new period_end and email the new token. Skip non-subscription invoices
 * and the first-time `subscription_create` invoice (handled by
 * customer.subscription.created).
 */
export async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  deps: HandlerDeps,
): Promise<void> {
  if (invoice.billing_reason !== 'subscription_cycle') {
    return;
  }
  const subscriptionRef = (invoice as unknown as {
    subscription?: string | Stripe.Subscription | null;
  }).subscription;
  const subscriptionId = typeof subscriptionRef === 'string'
    ? subscriptionRef
    : subscriptionRef?.id;
  if (!subscriptionId) {
    console.log(`handleInvoicePaid: invoice ${invoice.id} has no subscription`);
    return;
  }

  const subscription = await deps.stripe.subscriptions.retrieve(subscriptionId);
  await mintAndEmail(subscription, deps);
}

/**
 * Revoke any active license owned by the customer behind this charge.
 *
 * One-time payments are gone, so we can't key the license directly off
 * the charge's payment_intent. Instead we look up the customer and revoke
 * every non-revoked license they own. The customer can re-subscribe to
 * re-issue.
 */
export async function handleChargeRefunded(
  charge: Stripe.Charge,
  deps: HandlerDeps,
): Promise<void> {
  const customerId = typeof charge.customer === 'string'
    ? charge.customer
    : charge.customer?.id;
  if (!customerId) {
    console.log(`handleChargeRefunded: charge ${charge.id} has no customer`);
    return;
  }

  const licenses = await deps.getLicensesByCustomerId(deps.db, customerId);
  const active = licenses.filter((l) => !l.revokedAt);
  if (active.length === 0) {
    console.log(`handleChargeRefunded: no active licenses for customer ${customerId}`);
    return;
  }

  for (const license of active) {
    const revoked = await deps.revokeLicense(deps.db, license.stripeSubscriptionId);
    if (!revoked) continue;
    await deps.sendRevocationEmail({
      resendApiKey: deps.resendApiKey,
      from: deps.emailFrom,
      to: license.customerEmail,
      vars: { tier: license.tier as 'developer_seat' | 'team' },
    });
  }
}
