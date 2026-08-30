import { describe, expect, it } from 'vitest';
import { TIERS } from '../../../../../pricing/tiers.config';

describe('pricing tier configuration', () => {
  it('separates public names from compatibility-sensitive identifiers', () => {
    expect(
      TIERS.map((tier) => ({
        slug: tier.slug,
        displayName: (tier as { displayName?: string }).displayName,
      })),
    ).toEqual([
      { slug: 'community', displayName: 'Developer' },
      { slug: 'developer_seat', displayName: 'Pro' },
      { slug: 'team', displayName: 'Team' },
      { slug: 'enterprise', displayName: 'Enterprise' },
    ]);
  });

  it('preserves every public price and billing interval exactly', () => {
    expect(
      TIERS.map((tier) => ({ slug: tier.slug, prices: tier.prices })),
    ).toEqual([
      {
        slug: 'community',
        prices: {
          monthly: { cents: null, display: 'Free', period: '' },
          annual: { cents: null, display: 'Free', period: '' },
        },
      },
      {
        slug: 'developer_seat',
        prices: {
          monthly: { cents: 2900, display: '$29', period: '/developer/month' },
          annual: { cents: 29900, display: '$299', period: '/developer/year' },
        },
      },
      {
        slug: 'team',
        prices: {
          monthly: { cents: 14900, display: '$149', period: '/month' },
          annual: { cents: 149500, display: '$1,495', period: '/year' },
        },
      },
      {
        slug: 'enterprise',
        prices: {
          monthly: { cents: null, display: 'From $4,000', period: '/month' },
          annual: { cents: null, display: 'From $4,000', period: '/month' },
        },
      },
    ]);
  });

  it('preserves buyability and individual-seat quantity behavior', () => {
    expect(
      TIERS.map(({ slug, stripeBuyable, adjustableQuantity, defaultQuantity }) => ({
        slug,
        stripeBuyable,
        adjustableQuantity: adjustableQuantity ?? false,
        defaultQuantity: defaultQuantity ?? null,
      })),
    ).toEqual([
      { slug: 'community', stripeBuyable: false, adjustableQuantity: false, defaultQuantity: null },
      { slug: 'developer_seat', stripeBuyable: true, adjustableQuantity: true, defaultQuantity: 1 },
      { slug: 'team', stripeBuyable: true, adjustableQuantity: false, defaultQuantity: null },
      { slug: 'enterprise', stripeBuyable: false, adjustableQuantity: false, defaultQuantity: null },
    ]);
  });
});
