// SPDX-License-Identifier: MIT
/**
 * Single source of truth for /pricing tier display and Stripe product sync.
 * Read by:
 *   - apps/website/src/components/pricing/PricingGrid.tsx (display)
 *   - scripts/stripe/sync-products.ts (Stripe-side products + prices)
 *
 * Stripe products are identified by `metadata.ngaf_tier_slug = slug`. Never
 * rely on product name to match — names are display copy and may change.
 */
export type TierSlug =
  | 'community'
  | 'indie'
  | 'developer_seat'
  | 'app_deployment'
  | 'enterprise';

export interface TierConfig {
  readonly slug: TierSlug;
  readonly name: string;
  /** USD cents. null for free / custom. */
  readonly priceCents: number | null;
  readonly displayPrice: string;
  readonly displayPeriod: string;
  readonly features: readonly string[];
  /** false → community (npm), enterprise (sales). true → real Stripe product + price. */
  readonly stripeBuyable: boolean;
  /** Highlighted card in the PricingGrid. */
  readonly highlight: boolean;
  /** Checkout `adjustable_quantity` enabled. Only Developer Seat today. */
  readonly adjustableQuantity?: boolean;
  /** Default quantity passed to Stripe Checkout when the buyer doesn't override. */
  readonly defaultQuantity?: number;
}

export const TIERS: readonly TierConfig[] = [
  {
    slug: 'community',
    name: 'Community / Noncommercial',
    priceCents: null,
    displayPrice: 'Free',
    displayPeriod: 'forever',
    features: [
      'Personal, student, academic, nonprofit, demo',
      'Source access',
      'Noncommercial use',
      'Commercial evaluation (30 days)',
      'License: PolyForm Noncommercial 1.0.0',
    ],
    stripeBuyable: false,
    highlight: false,
  },
  {
    slug: 'indie',
    name: 'Indie',
    priceCents: 14900,
    displayPrice: '$149',
    displayPeriod: '/year',
    features: [
      '1 developer',
      '1 commercial app',
      'Unlimited end users',
      'ThreadPlane Commercial license',
      'Best for: solo devs, indie products, consultants with one app',
    ],
    stripeBuyable: true,
    highlight: false,
  },
  {
    slug: 'developer_seat',
    name: 'Developer Seat',
    priceCents: 29900,
    displayPrice: '$299',
    displayPeriod: '/developer/year',
    features: [
      'Unlimited apps owned by your org',
      'Unlimited end users',
      'Dev / staging / production',
      'ThreadPlane Commercial license',
      'Best for: startups & growing teams',
    ],
    stripeBuyable: true,
    highlight: true,
    adjustableQuantity: true,
    defaultQuantity: 1,
  },
  {
    slug: 'app_deployment',
    name: 'App Deployment',
    priceCents: 149900,
    displayPrice: '$1,499',
    displayPeriod: '/app/year',
    features: [
      'Unlimited developers',
      '1 production app',
      'Unlimited end users',
      'ThreadPlane Commercial license',
      'Best for: agencies, CI/CD-heavy teams',
    ],
    stripeBuyable: true,
    highlight: false,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    priceCents: null,
    displayPrice: 'Custom',
    displayPeriod: 'annual',
    features: [
      'Custom contract & SLA',
      'Procurement support',
      'Security review',
      'Multi-app licensing',
      'Priority + private support channel',
    ],
    stripeBuyable: false,
    highlight: false,
  },
];

export const BUYABLE_TIERS = TIERS.filter((t) => t.stripeBuyable);

export function getTier(slug: TierSlug): TierConfig {
  const t = TIERS.find((x) => x.slug === slug);
  if (!t) throw new Error(`Unknown tier slug: ${slug}`);
  return t;
}
