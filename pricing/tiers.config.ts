// SPDX-License-Identifier: MIT
/**
 * Single source of truth for /pricing tier display and Stripe product sync.
 * Read by:
 *   - apps/website/src/components/pricing/CompareTable.tsx (display)
 *   - scripts/stripe/sync-products.ts (Stripe-side products + prices)
 *
 * Stripe products are identified by `metadata.tplane_tier_slug = slug`. Never
 * rely on product name to match — names are display copy and may change.
 *
 * Pricing model: every paid tier has BOTH a monthly and an annual recurring
 * price. The annual price is a discount over 12 × monthly. The pricing page
 * exposes a Monthly | Annual toggle; default is Annual.
 */
export type TierSlug =
  | 'community'
  | 'developer_seat'
  | 'team'
  | 'enterprise';

export type BillingCycle = 'monthly' | 'annual';

export interface TierPrice {
  /** USD cents for this billing cycle. null for free / custom. */
  readonly cents: number | null;
  /** Display value, e.g. "$29" or "$299". */
  readonly display: string;
  /** Period suffix shown inline after the price, e.g. "/dev/mo" or "/dev/yr". */
  readonly period: string;
}

export interface TierConfig {
  readonly slug: TierSlug;
  readonly name: string;
  readonly prices: Record<BillingCycle, TierPrice>;
  /** Subtitle under the price; replaces the standalone period gray subline. */
  readonly subtitle: string;
  readonly features: readonly string[];
  /** Short one-liner shown in its own row below the features. */
  readonly bestFor: string;
  /** false → community (npm), enterprise (sales). true → real Stripe product + price. */
  readonly stripeBuyable: boolean;
  /** Highlighted card / column in the pricing table. */
  readonly highlight: boolean;
  /** Checkout `adjustable_quantity` enabled. Only Developer Seat today. */
  readonly adjustableQuantity?: boolean;
  /** Default quantity passed to Stripe Checkout when the buyer doesn't override. */
  readonly defaultQuantity?: number;
}

const FREE: TierPrice = { cents: null, display: 'Free', period: '' };

export const TIERS: readonly TierConfig[] = [
  {
    slug: 'community',
    name: 'Community',
    prices: { monthly: FREE, annual: FREE },
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
    slug: 'developer_seat',
    name: 'Developer Seat',
    prices: {
      monthly: { cents: 2900, display: '$29', period: '/dev/mo' },
      annual: { cents: 29900, display: '$299', period: '/dev/yr' },
    },
    subtitle: 'per developer',
    features: [
      'Per developer seat',
      'Unlimited apps',
      'GitHub support',
    ],
    bestFor: 'Solo devs, growing teams',
    stripeBuyable: true,
    highlight: false,
    adjustableQuantity: true,
    defaultQuantity: 1,
  },
  {
    slug: 'team',
    name: 'Team',
    prices: {
      monthly: { cents: 14900, display: '$149', period: '/mo' },
      annual: { cents: 149500, display: '$1,495', period: '/yr' },
    },
    subtitle: '5 developer seats',
    features: [
      '5 developer seats included',
      'Unlimited apps',
      'Email support',
    ],
    bestFor: 'Procurement-friendly small teams',
    stripeBuyable: true,
    highlight: true,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    // Enterprise is sales-led — same "From $4,000/mo" label regardless of cycle.
    prices: {
      monthly: { cents: null, display: 'From $4,000', period: '/mo' },
      annual: { cents: null, display: 'From $4,000', period: '/mo' },
    },
    subtitle: 'annual contract',
    features: [
      'Pilot-to-Prod engagement',
      'Slack Connect support',
      'SLA + private channel',
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

/**
 * Annual savings for a tier, in dollars (rounded). 0 if either price is null
 * or annual is not actually a discount.
 */
export function annualSavingsDollars(tier: TierConfig): number {
  const m = tier.prices.monthly.cents;
  const a = tier.prices.annual.cents;
  if (m == null || a == null) return 0;
  const annualizedMonthly = m * 12;
  const savings = annualizedMonthly - a;
  return savings > 0 ? Math.round(savings / 100) : 0;
}

/**
 * Compute the global "save N%" badge shown on the Annual toggle. We use the
 * Team tier as the canonical example since it's the highlighted plan.
 */
export function annualDiscountPercent(): number {
  const team = TIERS.find((t) => t.slug === 'team');
  if (!team) return 0;
  const m = team.prices.monthly.cents;
  const a = team.prices.annual.cents;
  if (m == null || a == null) return 0;
  const annualizedMonthly = m * 12;
  return Math.round((1 - a / annualizedMonthly) * 100);
}
