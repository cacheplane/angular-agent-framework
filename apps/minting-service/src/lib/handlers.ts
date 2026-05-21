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
