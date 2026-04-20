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
