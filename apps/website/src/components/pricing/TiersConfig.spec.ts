import { describe, expect, it } from 'vitest';
import { TIERS } from '../../../../../pricing/tiers.config';

describe('pricing tier configuration', () => {
  it('presents MIT software plus two service-led commercial paths', () => {
    expect(
      TIERS.map((tier) => ({
        slug: tier.slug,
        displayName: tier.displayName,
        price: tier.price,
      })),
    ).toEqual([
      { slug: 'community', displayName: 'Community', price: 'Free forever' },
      {
        slug: 'production_assurance',
        displayName: 'Production Assurance',
        price: 'Custom',
      },
      { slug: 'enterprise', displayName: 'Enterprise', price: 'Custom' },
    ]);
  });

  it('keeps all software capabilities available under MIT', () => {
    expect(TIERS.every((tier) => tier.softwareLicense === 'MIT')).toBe(true);
    expect(TIERS.some((tier) => tier.features.some((feature) => /seat|token/i.test(feature)))).toBe(false);
  });
});
