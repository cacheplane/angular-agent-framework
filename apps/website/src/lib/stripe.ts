// SPDX-License-Identifier: MIT
import Stripe from 'stripe';

/**
 * Returns a configured Stripe client.
 *
 * Refuses to load if STRIPE_SECRET_KEY is missing or doesn't begin with
 * `sk_` (the Stripe convention for secret keys; `sk_test_` for test mode,
 * `sk_live_` for live mode). This is the only Stripe environment check we
 * do — the key itself encodes test vs live.
 */
export function getStripe(): Stripe {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  if (!key.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY does not look like a Stripe secret key (must begin with "sk_")');
  }
  // apiVersion omitted so the bundled lib version's default is used.
  // Pinning a literal breaks across stripe@22.0.x ↔ 22.1.x where the
  // type narrows to different LatestApiVersion strings.
  return new Stripe(key);
}
