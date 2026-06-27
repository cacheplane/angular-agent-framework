// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import type Stripe from 'stripe';
import {
  handleEvent,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleInvoicePaid,
  handleChargeRefunded,
  type HandlerDeps,
} from './handlers.js';

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    db: {} as never,
    stripe: {} as never,
    markEventProcessed: vi.fn().mockResolvedValue(true),
    deleteProcessedEvent: vi.fn().mockResolvedValue(undefined),
    upsertLicense: vi.fn(),
    getLicense: vi.fn(),
    getLicensesByCustomerId: vi.fn().mockResolvedValue([]),
    revokeLicense: vi.fn(),
    mintToken: vi.fn().mockResolvedValue('mock.token'),
    sendLicenseEmail: vi.fn().mockResolvedValue({ resendId: 're_mock' }),
    sendRevocationEmail: vi.fn().mockResolvedValue({ resendId: 're_revoke' }),
    privateKeyHex: 'a'.repeat(64),
    resendApiKey: 're_test',
    emailFrom: 'noreply@example.com',
    ...overrides,
  };
}

function evt(type: string, obj: unknown = {}): Stripe.Event {
  return { id: `evt_${type}`, type, data: { object: obj } } as Stripe.Event;
}

// 2027-01-01T00:00:00Z = 1798761600 (unix seconds)
const PERIOD_END_EPOCH = 1798761600;
const PERIOD_END_DATE = new Date(PERIOD_END_EPOCH * 1000);

function subscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: 'sub_test_123',
    customer: 'cus_test_123',
    status: 'active',
    current_period_end: PERIOD_END_EPOCH,
    metadata: {},
    items: {
      data: [
        {
          quantity: 1,
          price: {
            metadata: { tplane_tier_slug: 'developer_seat' },
          } as Stripe.Price,
        } as Stripe.SubscriptionItem,
      ],
    } as Stripe.ApiList<Stripe.SubscriptionItem>,
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function stripeWithCustomer(email: string | null = 'buyer@example.com'): Stripe {
  return {
    customers: {
      retrieve: vi.fn().mockResolvedValue({ id: 'cus_test_123', email, deleted: false } as Stripe.Customer),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  } as unknown as Stripe;
}

describe('handleEvent', () => {
  it('returns early if markEventProcessed returns false (duplicate)', async () => {
    const deps = makeDeps({
      markEventProcessed: vi.fn().mockResolvedValue(false),
      stripe: stripeWithCustomer(),
    });
    await handleEvent(evt('customer.subscription.created', subscription()), deps);
    expect(deps.upsertLicense).not.toHaveBeenCalled();
    expect(deps.sendLicenseEmail).not.toHaveBeenCalled();
  });

  it('no-ops on unknown event types (checkout, subscription.deleted, payment_succeeded)', async () => {
    const deps = makeDeps();
    await handleEvent(evt('checkout.session.completed'), deps);
    await handleEvent(evt('customer.subscription.deleted'), deps);
    await handleEvent(evt('invoice.payment_succeeded'), deps);
    expect(deps.upsertLicense).not.toHaveBeenCalled();
    expect(deps.sendLicenseEmail).not.toHaveBeenCalled();
  });

  it('dispatches customer.subscription.created to handleSubscriptionCreated', async () => {
    const sub = subscription();
    const deps = makeDeps({ stripe: stripeWithCustomer() });
    await handleEvent(evt('customer.subscription.created', sub), deps);
    expect(deps.upsertLicense).toHaveBeenCalledTimes(1);
    expect(deps.sendLicenseEmail).toHaveBeenCalledTimes(1);
  });

  it('compensating-deletes the processed-event marker when handler throws', async () => {
    const sub = subscription({ items: { data: [] } as unknown as Stripe.ApiList<Stripe.SubscriptionItem> });
    const deps = makeDeps({ stripe: stripeWithCustomer() });
    await expect(
      handleEvent(evt('customer.subscription.created', sub), deps),
    ).rejects.toThrow(/no line items/);
    expect(deps.deleteProcessedEvent).toHaveBeenCalledTimes(1);
  });
});

describe('handleSubscriptionCreated', () => {
  it('mints, upserts, and emails on a new subscription', async () => {
    const sub = subscription();
    const deps = makeDeps({ stripe: stripeWithCustomer() });
    await handleSubscriptionCreated(sub, deps);

    expect(deps.mintToken).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCustomerId: 'cus_test_123',
        tier: 'developer_seat',
        seats: 1,
        expiresAt: PERIOD_END_DATE,
      }),
      'a'.repeat(64),
    );
    expect(deps.upsertLicense).toHaveBeenCalledWith(
      {} as never,
      expect.objectContaining({
        stripeCustomerId: 'cus_test_123',
        stripeSubscriptionId: 'sub_test_123',
        customerEmail: 'buyer@example.com',
        tier: 'developer_seat',
        seats: 1,
        expiresAt: PERIOD_END_DATE,
        lastToken: 'mock.token',
      }),
    );
    expect(deps.sendLicenseEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.com',
        vars: expect.objectContaining({ tier: 'developer_seat', seats: 1, token: 'mock.token' }),
      }),
    );
  });

  it('reads tier from subscription.metadata.tplane_tier_slug, overriding price metadata', async () => {
    const sub = subscription({
      metadata: { tplane_tier_slug: 'team' },
      items: {
        data: [
          {
            quantity: 5,
            price: { metadata: { tplane_tier_slug: 'developer_seat' } } as Stripe.Price,
          } as Stripe.SubscriptionItem,
        ],
      } as Stripe.ApiList<Stripe.SubscriptionItem>,
    });
    const deps = makeDeps({ stripe: stripeWithCustomer() });
    await handleSubscriptionCreated(sub, deps);
    expect(deps.upsertLicense).toHaveBeenCalledWith(
      {} as never,
      expect.objectContaining({ tier: 'team', seats: 5 }),
    );
  });

  it('throws if subscription has no current_period_end', async () => {
    const sub = subscription({ current_period_end: undefined as unknown as number });
    const deps = makeDeps({ stripe: stripeWithCustomer() });
    await expect(handleSubscriptionCreated(sub, deps)).rejects.toThrow(/current_period_end/);
  });

  it('throws if the customer has no email', async () => {
    const sub = subscription();
    const deps = makeDeps({ stripe: stripeWithCustomer(null) });
    await expect(handleSubscriptionCreated(sub, deps)).rejects.toThrow(/no email/);
  });
});

describe('handleSubscriptionUpdated', () => {
  function existing(overrides: Partial<{ seats: number; expiresAt: Date }> = {}) {
    return {
      id: 'lic_1',
      stripeCustomerId: 'cus_test_123',
      stripeSubscriptionId: 'sub_test_123',
      customerEmail: 'existing@example.com',
      tier: 'developer_seat',
      seats: 1,
      expiresAt: PERIOD_END_DATE,
      lastToken: 'old.token',
      revokedAt: null,
      issuedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it('re-mints when seats change', async () => {
    const sub = subscription({
      items: {
        data: [
          {
            quantity: 3,
            price: { metadata: { tplane_tier_slug: 'developer_seat' } } as Stripe.Price,
          } as Stripe.SubscriptionItem,
        ],
      } as Stripe.ApiList<Stripe.SubscriptionItem>,
    });
    const deps = makeDeps({
      stripe: stripeWithCustomer(),
      getLicense: vi.fn().mockResolvedValue(existing({ seats: 1 })),
    });
    await handleSubscriptionUpdated(sub, deps);
    expect(deps.upsertLicense).toHaveBeenCalledWith(
      {} as never,
      expect.objectContaining({ seats: 3 }),
    );
    expect(deps.sendLicenseEmail).toHaveBeenCalledTimes(1);
  });

  it('re-mints when period_end changes', async () => {
    const sub = subscription({ current_period_end: PERIOD_END_EPOCH + 86400 });
    const deps = makeDeps({
      stripe: stripeWithCustomer(),
      getLicense: vi.fn().mockResolvedValue(existing()),
    });
    await handleSubscriptionUpdated(sub, deps);
    expect(deps.upsertLicense).toHaveBeenCalledTimes(1);
    expect(deps.sendLicenseEmail).toHaveBeenCalledTimes(1);
  });

  it('no-ops on status-only change with same seats/period (does not revoke immediately)', async () => {
    const sub = subscription({ status: 'unpaid' });
    const deps = makeDeps({
      stripe: stripeWithCustomer(),
      getLicense: vi.fn().mockResolvedValue(existing()),
    });
    await handleSubscriptionUpdated(sub, deps);
    expect(deps.upsertLicense).not.toHaveBeenCalled();
    expect(deps.sendLicenseEmail).not.toHaveBeenCalled();
    expect(deps.revokeLicense).not.toHaveBeenCalled();
  });

  it('mints fresh if no existing license is found', async () => {
    const sub = subscription();
    const deps = makeDeps({
      stripe: stripeWithCustomer(),
      getLicense: vi.fn().mockResolvedValue(null),
    });
    await handleSubscriptionUpdated(sub, deps);
    expect(deps.upsertLicense).toHaveBeenCalledTimes(1);
    expect(deps.sendLicenseEmail).toHaveBeenCalledTimes(1);
  });
});

describe('handleInvoicePaid', () => {
  function invoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
    return {
      id: 'in_test',
      billing_reason: 'subscription_cycle',
      subscription: 'sub_test_123',
      ...overrides,
    } as unknown as Stripe.Invoice;
  }

  it('re-mints on a renewal invoice (subscription_cycle)', async () => {
    const sub = subscription({ current_period_end: PERIOD_END_EPOCH + 30 * 86400 });
    const stripe = {
      customers: {
        retrieve: vi.fn().mockResolvedValue({ id: 'cus_test_123', email: 'buyer@example.com' } as Stripe.Customer),
      },
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue(sub),
      },
    } as unknown as Stripe;
    const deps = makeDeps({ stripe });
    await handleInvoicePaid(invoice(), deps);
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_test_123');
    expect(deps.upsertLicense).toHaveBeenCalledWith(
      {} as never,
      expect.objectContaining({
        stripeSubscriptionId: 'sub_test_123',
        expiresAt: new Date((PERIOD_END_EPOCH + 30 * 86400) * 1000),
      }),
    );
    expect(deps.sendLicenseEmail).toHaveBeenCalledTimes(1);
  });

  it('skips the first-time subscription_create invoice', async () => {
    const deps = makeDeps({ stripe: stripeWithCustomer() });
    await handleInvoicePaid(invoice({ billing_reason: 'subscription_create' }), deps);
    expect(deps.upsertLicense).not.toHaveBeenCalled();
  });

  it('skips invoices with no subscription', async () => {
    const deps = makeDeps({ stripe: stripeWithCustomer() });
    await handleInvoicePaid(
      invoice({ subscription: null } as unknown as Partial<Stripe.Invoice>),
      deps,
    );
    expect(deps.upsertLicense).not.toHaveBeenCalled();
  });
});

describe('handleChargeRefunded', () => {
  const charge = (overrides: Partial<Stripe.Charge> = {}): Stripe.Charge =>
    ({ id: 'ch_test', customer: 'cus_test_123', ...overrides }) as Stripe.Charge;

  it('revokes all active licenses for the customer and emails each', async () => {
    const licenses = [
      {
        stripeSubscriptionId: 'sub_a',
        customerEmail: 'buyer@example.com',
        tier: 'developer_seat',
        revokedAt: null,
      },
      {
        stripeSubscriptionId: 'sub_b',
        customerEmail: 'buyer@example.com',
        tier: 'team',
        revokedAt: null,
      },
    ];
    const deps = makeDeps({
      getLicensesByCustomerId: vi.fn().mockResolvedValue(licenses),
      revokeLicense: vi.fn().mockResolvedValue({}),
    });
    await handleChargeRefunded(charge(), deps);
    expect(deps.revokeLicense).toHaveBeenCalledTimes(2);
    expect(deps.revokeLicense).toHaveBeenCalledWith({} as never, 'sub_a');
    expect(deps.revokeLicense).toHaveBeenCalledWith({} as never, 'sub_b');
    expect(deps.sendRevocationEmail).toHaveBeenCalledTimes(2);
  });

  it('skips already-revoked licenses', async () => {
    const deps = makeDeps({
      getLicensesByCustomerId: vi.fn().mockResolvedValue([
        {
          stripeSubscriptionId: 'sub_a',
          customerEmail: 'buyer@example.com',
          tier: 'developer_seat',
          revokedAt: new Date(),
        },
      ]),
      revokeLicense: vi.fn().mockResolvedValue({}),
    });
    await handleChargeRefunded(charge(), deps);
    expect(deps.revokeLicense).not.toHaveBeenCalled();
    expect(deps.sendRevocationEmail).not.toHaveBeenCalled();
  });

  it('no-ops when the customer has no licenses', async () => {
    const deps = makeDeps({
      getLicensesByCustomerId: vi.fn().mockResolvedValue([]),
    });
    await handleChargeRefunded(charge(), deps);
    expect(deps.revokeLicense).not.toHaveBeenCalled();
    expect(deps.sendRevocationEmail).not.toHaveBeenCalled();
  });

  it('no-ops when charge has no customer', async () => {
    const deps = makeDeps();
    await handleChargeRefunded(charge({ customer: null }), deps);
    expect(deps.getLicensesByCustomerId).not.toHaveBeenCalled();
  });
});
