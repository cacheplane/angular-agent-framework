// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const stripeCreate = vi.fn();

vi.mock('../../../../lib/stripe', () => ({
  getStripe: () => ({ checkout: { sessions: { create: stripeCreate } } }),
}));

vi.mock('../../../../../../../pricing/tiers.generated', () => ({
  STRIPE_PRICE_IDS: {
    developer_seat: { monthly: 'price_seat_monthly', annual: 'price_seat_annual' },
    team: { monthly: 'price_team_monthly', annual: 'price_team_annual' },
  },
}));

import { POST } from './route';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/checkout/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/checkout/session', () => {
  beforeEach(() => {
    stripeCreate.mockReset();
    stripeCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_abc' });
  });

  it('returns 400 for unknown tier', async () => {
    const res = await POST(makeReq({ tier: 'bogus' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for community tier (not Stripe-buyable)', async () => {
    const res = await POST(makeReq({ tier: 'community' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for enterprise tier (not Stripe-buyable)', async () => {
    const res = await POST(makeReq({ tier: 'enterprise' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid billing_cycle', async () => {
    const res = await POST(makeReq({ tier: 'developer_seat', billing_cycle: 'weekly' }));
    expect(res.status).toBe(400);
  });

  it('defaults to annual billing cycle when omitted', async () => {
    await POST(makeReq({ tier: 'developer_seat' }));
    const args = stripeCreate.mock.calls[0]?.[0];
    expect(args.mode).toBe('subscription');
    expect(args.line_items[0].price).toBe('price_seat_annual');
    expect(args.metadata.ngaf_billing_cycle).toBe('annual');
  });

  it('routes to the monthly price when billing_cycle=monthly', async () => {
    await POST(makeReq({ tier: 'developer_seat', billing_cycle: 'monthly' }));
    const args = stripeCreate.mock.calls[0]?.[0];
    expect(args.line_items[0].price).toBe('price_seat_monthly');
    expect(args.metadata.ngaf_billing_cycle).toBe('monthly');
  });

  it('routes Team to the team annual price by default', async () => {
    await POST(makeReq({ tier: 'team' }));
    const args = stripeCreate.mock.calls[0]?.[0];
    expect(args.line_items[0].price).toBe('price_team_annual');
    expect(args.metadata.ngaf_tier_slug).toBe('team');
  });

  it('enables adjustable_quantity only for developer_seat', async () => {
    await POST(makeReq({ tier: 'developer_seat', quantity: 3 }));
    const args = stripeCreate.mock.calls[0]?.[0];
    expect(args.line_items[0].quantity).toBe(3);
    expect(args.line_items[0].adjustable_quantity).toEqual({ enabled: true, minimum: 1, maximum: 100 });
  });

  it('clamps quantity to [1, 100]', async () => {
    await POST(makeReq({ tier: 'developer_seat', quantity: 9999 }));
    expect(stripeCreate.mock.calls[0]?.[0].line_items[0].quantity).toBe(100);

    stripeCreate.mockClear();
    await POST(makeReq({ tier: 'developer_seat', quantity: 0 }));
    expect(stripeCreate.mock.calls[0]?.[0].line_items[0].quantity).toBe(1);
  });

  it('returns 502 if Stripe returns no URL', async () => {
    stripeCreate.mockResolvedValueOnce({ url: null });
    const res = await POST(makeReq({ tier: 'developer_seat' }));
    expect(res.status).toBe(502);
  });
});
