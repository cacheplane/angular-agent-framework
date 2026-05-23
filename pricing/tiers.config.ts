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
  /** Short suffix rendered inline after the price, e.g. "/dev/yr". */
  readonly displayPeriod: string;
  /** Subtitle under the price; replaces the standalone period gray subline. */
  readonly subtitle: string;
  readonly features: readonly string[];
  /** Short one-liner shown in its own row below the features. */
  readonly bestFor: string;
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
    name: 'Community',
    priceCents: null,
    displayPrice: 'Free',
    displayPeriod: '',
    subtitle: 'forever',
    features: [
      'Personal, OSS, demos',
      'Source access',
      '30-day commercial eval',
    ],
    bestFor: 'Tinkering, OSS projects, students',
    stripeBuyable: false,
    highlight: false,
  },
  {
    slug: 'indie',
    name: 'Indie',
    priceCents: 14900,
    displayPrice: '$149',
    displayPeriod: '/yr',
    subtitle: 'one app · one dev',
    features: [
      '1 developer',
      '1 commercial app',
      'Unlimited end users',
    ],
    bestFor: 'Solo founders, indie SaaS',
    stripeBuyable: true,
    highlight: false,
  },
  {
    slug: 'developer_seat',
    name: 'Developer Seat',
    priceCents: 29900,
    displayPrice: '$299',
    displayPeriod: '/dev/yr',
    subtitle: 'per developer',
    features: [
      'Per developer seat',
      'Unlimited apps',
      'Dev · staging · prod',
    ],
    bestFor: 'Startups, in-house teams',
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
    displayPeriod: '/app/yr',
    subtitle: 'per production app',
    features: [
      'Unlimited developers',
      '1 production app',
      'Procurement-friendly',
    ],
    bestFor: 'Agencies, CI/CD-heavy teams',
    stripeBuyable: true,
    highlight: false,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    priceCents: null,
    displayPrice: 'Custom',
    displayPeriod: '',
    subtitle: 'annual contract',
    features: [
      'Multi-app licensing',
      'SLA + security review',
      'Private support channel',
    ],
    bestFor: 'Procurement-led orgs',
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
