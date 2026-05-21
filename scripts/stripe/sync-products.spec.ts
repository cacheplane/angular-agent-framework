// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { syncProducts } from './sync-products';

function stubStripe(opts: {
  productSearch?: Stripe.Product[];
  priceList?: Stripe.Price[];
} = {}): Stripe {
  const products = {
    search: vi.fn().mockResolvedValue({ data: opts.productSearch ?? [] }),
    create: vi.fn().mockImplementation(({ name }: { name: string }) =>
      Promise.resolve({ id: `prod_new_${name.replace(/\W+/g, '_')}`, name, active: true })),
    update: vi.fn().mockImplementation((id: string, body: Stripe.ProductUpdateParams) =>
      Promise.resolve({ id, ...body, active: true })),
  };
  const prices = {
    list: vi.fn().mockResolvedValue({ data: opts.priceList ?? [] }),
    create: vi.fn().mockImplementation((body: Stripe.PriceCreateParams) =>
      Promise.resolve({ id: `price_new_${body.unit_amount}`, ...body })),
    update: vi.fn().mockImplementation((id: string) => Promise.resolve({ id, active: false })),
  };
  return { products, prices } as unknown as Stripe;
}

describe('syncProducts', () => {
  it('creates a new product and price when none exist', async () => {
    const stripe = stubStripe();
    const ids = await syncProducts(stripe);
    expect(Object.keys(ids).sort()).toEqual(['app_deployment', 'developer_seat', 'indie']);
    expect(ids.indie.startsWith('price_new_14900')).toBe(true);
  });

  it('reuses an existing product and matching active price', async () => {
    const existingIndieProduct = {
      id: 'prod_existing_indie',
      name: 'Indie Commercial',
      active: true,
    } as Stripe.Product;
    const existingIndiePrice = {
      id: 'price_existing_indie',
      product: 'prod_existing_indie',
      unit_amount: 14900,
      currency: 'usd',
      type: 'one_time',
      active: true,
    } as Stripe.Price;
    const stripe = stubStripe({
      productSearch: [existingIndieProduct],
      priceList: [existingIndiePrice],
    });
    const ids = await syncProducts(stripe);
    expect(ids.indie).toBe('price_existing_indie');
  });

  it('archives a stale price when unit_amount no longer matches and creates a new one', async () => {
    const staleIndiePrice = {
      id: 'price_stale_indie',
      product: 'prod_existing_indie',
      unit_amount: 9900,
      currency: 'usd',
      type: 'one_time',
      active: true,
    } as Stripe.Price;
    const existingIndieProduct = {
      id: 'prod_existing_indie',
      name: 'Indie Commercial',
      active: true,
    } as Stripe.Product;
    const stripe = stubStripe({
      productSearch: [existingIndieProduct],
      priceList: [staleIndiePrice],
    });
    const ids = await syncProducts(stripe);
    expect(ids.indie.startsWith('price_new_14900')).toBe(true);
    // @ts-expect-error vitest mock typing
    expect(stripe.prices.update).toHaveBeenCalledWith('price_stale_indie', { active: false });
  });
});
