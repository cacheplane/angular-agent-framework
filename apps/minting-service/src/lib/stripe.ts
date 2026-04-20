// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import Stripe from 'stripe';

let client: Stripe | null = null;

/**
 * Lazy-init a Stripe SDK client. Lives in its own module so tests can
 * replace it via module mocks without the full env being loaded.
 */
export function getStripe(apiKey: string): Stripe {
  if (!client) {
    client = new Stripe(apiKey, { apiVersion: '2024-06-20' });
  }
  return client;
}
