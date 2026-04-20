// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type Stripe from 'stripe';
import type {
  Db,
  License,
  UpsertLicenseInput,
} from '@cacheplane/db';
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
  getLicense: (db: Db, subId: string) => Promise<License | null>;
  revokeLicense: (db: Db, subId: string) => Promise<License | null>;
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
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, deps);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, deps);
        break;
      default:
        return;
    }
  } catch (err) {
    await deps.deleteProcessedEvent(deps.db, event.id);
    throw err;
  }
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  deps: HandlerDeps,
): Promise<void> {
  const expanded = await deps.stripe.checkout.sessions.retrieve(session.id, {
    expand: ['line_items.data.price'],
  });
  const lineItem = expanded.line_items?.data?.[0];
  if (!lineItem) {
    throw new Error(`handleCheckoutCompleted: session ${session.id} has no line items`);
  }
  const priceMetadata = (lineItem.price?.metadata ?? {}) as Record<string, string>;
  const tier = extractTier(priceMetadata);
  const seats = computeSeats(tier, lineItem.quantity);

  const subId = typeof expanded.subscription === 'string'
    ? expanded.subscription
    : expanded.subscription?.id;
  if (!subId) {
    throw new Error(`handleCheckoutCompleted: session ${session.id} has no subscription`);
  }
  const sub = await deps.stripe.subscriptions.retrieve(subId);
  const expiresAt = (sub as any).current_period_end
    ? new Date((sub as any).current_period_end * 1000)
    : new Date(Date.now() + deps.defaultTtlDays * 24 * 60 * 60 * 1000);

  const customerId = typeof expanded.customer === 'string' ? expanded.customer : expanded.customer?.id;
  if (!customerId) {
    throw new Error(`handleCheckoutCompleted: session ${session.id} has no customer`);
  }
  const email = expanded.customer_details?.email;
  if (!email) {
    throw new Error(`handleCheckoutCompleted: session ${session.id} has no customer email`);
  }

  const token = await deps.mintToken(
    { stripeCustomerId: customerId, tier, seats, expiresAt },
    deps.privateKeyHex,
  );

  await deps.upsertLicense(deps.db, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subId,
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

export async function handleSubscriptionUpdated(
  _sub: Stripe.Subscription,
  _deps: HandlerDeps,
): Promise<void> {
  throw new Error('handleSubscriptionUpdated: not yet implemented');
}

export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  deps: HandlerDeps,
): Promise<void> {
  await deps.revokeLicense(deps.db, sub.id);
}
