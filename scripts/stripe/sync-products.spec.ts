// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { syncProducts } from './sync-products';

function stubStripe(opts: {
  productsBySlug?: Record<string, Stripe.Product>;
  pricesByProduct?: Record<string, Stripe.Price[]>;
} = {}): Stripe {
  const products = {
    search: vi.fn().mockImplementation(({ query }: { query: string }) => {
      const slug = query.match(/:'([^']+)'/)?.[1] ?? '';
      const product = opts.productsBySlug?.[slug];
      return Promise.resolve({ data: product ? [product] : [] });
    }),
    create: vi.fn().mockImplementation(({ name, metadata }: Stripe.ProductCreateParams) =>
      Promise.resolve({
        id: `prod_${metadata?.['tplane_tier_slug']}`,
        name,
        metadata,
        active: true,
      })),
    update: vi.fn().mockImplementation((id: string, body: Stripe.ProductUpdateParams) =>
      Promise.resolve({ id, ...body, active: true })),
  };
  const prices = {
    list: vi.fn().mockImplementation(({ product }: { product: string }) =>
      Promise.resolve({ data: opts.pricesByProduct?.[product] ?? [] })),
    create: vi.fn().mockImplementation((body: Stripe.PriceCreateParams) =>
      Promise.resolve({
        id: `price_${String(body.product)}_${body.recurring?.interval}_${body.unit_amount}`,
        ...body,
      })),
    update: vi.fn().mockImplementation((id: string) => Promise.resolve({ id, active: false })),
  };
  return { products, prices } as unknown as Stripe;
}

describe('syncProducts', () => {
  it('creates the two buyable products with unchanged prices and billing intervals', async () => {
    const stripe = stubStripe();
    const ids = await syncProducts(stripe);

    expect(ids).toEqual({
      developer_seat: {
        monthly: 'price_prod_developer_seat_month_2900',
        annual: 'price_prod_developer_seat_year_29900',
      },
      team: {
        monthly: 'price_prod_team_month_14900',
        annual: 'price_prod_team_year_149500',
      },
    });
  });

  it('preserves existing Stripe product names when public display names differ', async () => {
    const developerProduct = {
      id: 'prod_existing_developer',
      name: 'Developer Seat',
      active: true,
      metadata: { tplane_tier_slug: 'developer_seat' },
    } as unknown as Stripe.Product;
    const teamProduct = {
      id: 'prod_existing_team',
      name: 'Team',
      active: true,
      metadata: { tplane_tier_slug: 'team' },
    } as unknown as Stripe.Product;
    const stripe = stubStripe({
      productsBySlug: { developer_seat: developerProduct, team: teamProduct },
    });

    await syncProducts(stripe);

    expect(stripe.products.update).not.toHaveBeenCalled();
    expect(stripe.products.create).not.toHaveBeenCalled();
  });

  it('reuses matching recurring prices without generating new IDs', async () => {
    const developerProduct = {
      id: 'prod_existing_developer',
      name: 'Developer Seat',
      active: true,
      metadata: { tplane_tier_slug: 'developer_seat' },
    } as unknown as Stripe.Product;
    const teamProduct = {
      id: 'prod_existing_team',
      name: 'Team',
      active: true,
      metadata: { tplane_tier_slug: 'team' },
    } as unknown as Stripe.Product;
    const recurringPrice = (
      id: string,
      product: string,
      unitAmount: number,
      interval: 'month' | 'year',
    ) => ({
      id,
      product,
      unit_amount: unitAmount,
      currency: 'usd',
      type: 'recurring',
      recurring: { interval },
      active: true,
    }) as Stripe.Price;
    const stripe = stubStripe({
      productsBySlug: { developer_seat: developerProduct, team: teamProduct },
      pricesByProduct: {
        prod_existing_developer: [
          recurringPrice('price_dev_month', 'prod_existing_developer', 2900, 'month'),
          recurringPrice('price_dev_year', 'prod_existing_developer', 29900, 'year'),
        ],
        prod_existing_team: [
          recurringPrice('price_team_month', 'prod_existing_team', 14900, 'month'),
          recurringPrice('price_team_year', 'prod_existing_team', 149500, 'year'),
        ],
      },
    });

    const ids = await syncProducts(stripe);

    expect(ids.developer_seat).toEqual({ monthly: 'price_dev_month', annual: 'price_dev_year' });
    expect(ids.team).toEqual({ monthly: 'price_team_month', annual: 'price_team_year' });
    expect(stripe.prices.create).not.toHaveBeenCalled();
    expect(stripe.prices.update).not.toHaveBeenCalled();
  });
});
