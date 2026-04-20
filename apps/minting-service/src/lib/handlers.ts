// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type Stripe from 'stripe';
import type {
  Db,
  License,
  UpsertLicenseInput,
} from '@cacheplane/db';
import type { MintInput } from './sign.js';
import type { LicenseEmailVars } from './email.js';

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
  _session: Stripe.Checkout.Session,
  _deps: HandlerDeps,
): Promise<void> {
  throw new Error('handleCheckoutCompleted: not yet implemented');
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
