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
            metadata: { cacheplane_tier: 'developer-seat' },
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
        tier: 'developer-seat',
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
        tier: 'developer-seat',
        seats: 1,
        lastToken: 'mock.token',
      }),
    );
    expect(deps.sendLicenseEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@example.com',
        to: 'buyer@example.com',
        vars: expect.objectContaining({ tier: 'developer-seat', seats: 1, token: 'mock.token' }),
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
