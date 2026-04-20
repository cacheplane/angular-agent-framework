// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type Stripe from 'stripe';
import { handleEvent, type HandlerDeps } from './handlers.js';

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    db: {} as any,
    stripe: {} as any,
    markEventProcessed: vi.fn().mockResolvedValue(true),
    deleteProcessedEvent: vi.fn().mockResolvedValue(undefined),
    upsertLicense: vi.fn(),
    getLicense: vi.fn(),
    revokeLicense: vi.fn(),
    mintToken: vi.fn(),
    sendLicenseEmail: vi.fn(),
    privateKeyHex: 'a'.repeat(64),
    resendApiKey: 're_test',
    emailFrom: 'a@b.c',
    defaultTtlDays: 365,
    ...overrides,
  };
}

function evt(type: string, obj: unknown = {}): Stripe.Event {
  return { id: `evt_${type}`, type, data: { object: obj } } as Stripe.Event;
}

describe('handleEvent', () => {
  it('returns early if markEventProcessed returns false (duplicate)', async () => {
    const deps = makeDeps({
      markEventProcessed: vi.fn().mockResolvedValue(false),
    });
    await handleEvent(evt('customer.subscription.deleted', { id: 'sub_x' }), deps);
    expect(deps.revokeLicense).not.toHaveBeenCalled();
  });

  it('no-ops on unknown event types', async () => {
    const deps = makeDeps();
    await handleEvent(evt('invoice.payment_succeeded'), deps);
    expect(deps.revokeLicense).not.toHaveBeenCalled();
    expect(deps.upsertLicense).not.toHaveBeenCalled();
  });

  it('compensating-deletes the processed-event marker when handler throws', async () => {
    const boom = new Error('boom');
    const deps = makeDeps({
      revokeLicense: vi.fn().mockRejectedValue(boom),
    });
    await expect(
      handleEvent(evt('customer.subscription.deleted', { id: 'sub_boom' }), deps),
    ).rejects.toBe(boom);
    expect(deps.deleteProcessedEvent).toHaveBeenCalledWith(deps.db, 'evt_customer.subscription.deleted');
  });
});

describe('handleCheckoutCompleted', () => {
  function baseSession(overrides: any = {}): Stripe.Checkout.Session {
    return {
      id: 'cs_test',
      customer: 'cus_x',
      subscription: 'sub_x',
      customer_details: { email: 'a@b.c' },
      ...overrides,
    } as Stripe.Checkout.Session;
  }

  function baseDeps(): HandlerDeps {
    const lineItem = {
      data: [
        {
          quantity: 2,
          price: { metadata: { cacheplane_tier: 'developer-seat' } },
        },
      ],
    };
    const sub = { current_period_end: 1_800_000_000, id: 'sub_x' };
    const expandedSession = baseSession({ line_items: lineItem });

    return makeDeps({
      stripe: {
        checkout: {
          sessions: {
            retrieve: vi.fn().mockResolvedValue(expandedSession),
          },
        },
        subscriptions: {
          retrieve: vi.fn().mockResolvedValue(sub),
        },
      } as any,
      mintToken: vi.fn().mockResolvedValue('TOKEN.SIG'),
      upsertLicense: vi.fn().mockImplementation((_db, input) =>
        Promise.resolve({ ...input, id: 'lic_1', createdAt: new Date(), updatedAt: new Date(), issuedAt: new Date(), revokedAt: null }),
      ),
      sendLicenseEmail: vi.fn().mockResolvedValue({ resendId: 're_1' }),
    });
  }

  it('upserts a license row and sends an email', async () => {
    const deps = baseDeps();
    await handleEvent(
      { id: 'evt_co', type: 'checkout.session.completed', data: { object: baseSession() } } as Stripe.Event,
      deps,
    );
    expect(deps.upsertLicense).toHaveBeenCalledTimes(1);
    const upsertArg = (deps.upsertLicense as unknown as { mock: { calls: any[][] } }).mock.calls[0][1];
    expect(upsertArg.stripeSubscriptionId).toBe('sub_x');
    expect(upsertArg.tier).toBe('developer-seat');
    expect(upsertArg.seats).toBe(2);
    expect(upsertArg.customerEmail).toBe('a@b.c');
    expect(upsertArg.lastToken).toBe('TOKEN.SIG');
    expect(deps.sendLicenseEmail).toHaveBeenCalledTimes(1);
  });

  it('throws when cacheplane_tier is missing from price metadata', async () => {
    const deps = baseDeps();
    (deps.stripe.checkout.sessions.retrieve as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      baseSession({ line_items: { data: [{ quantity: 1, price: { metadata: {} } }] } }),
    );
    await expect(
      handleEvent(
        { id: 'evt_co2', type: 'checkout.session.completed', data: { object: baseSession() } } as Stripe.Event,
        deps,
      ),
    ).rejects.toThrow(/cacheplane_tier/);
    expect(deps.deleteProcessedEvent).toHaveBeenCalledWith(deps.db, 'evt_co2');
  });
});
