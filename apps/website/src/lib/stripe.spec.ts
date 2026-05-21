// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getStripe } from './stripe';

describe('getStripe', () => {
  const originalKey = process.env['STRIPE_SECRET_KEY'];

  beforeEach(() => {
    delete process.env['STRIPE_SECRET_KEY'];
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env['STRIPE_SECRET_KEY'];
    else process.env['STRIPE_SECRET_KEY'] = originalKey;
  });

  it('throws when STRIPE_SECRET_KEY is not set', () => {
    expect(() => getStripe()).toThrow(/not set/);
  });

  it('throws when STRIPE_SECRET_KEY does not start with sk_', () => {
    process.env['STRIPE_SECRET_KEY'] = 'pk_test_garbage';
    expect(() => getStripe()).toThrow(/must begin with "sk_"/);
  });

  it('returns a Stripe client with a valid sk_test_ key', () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_1234567890abcdef';
    const stripe = getStripe();
    expect(stripe).toBeTruthy();
  });
});
