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
  /** Period suffix shown inline after the price, e.g. "/developer/month". */
  readonly period: string;
}

export interface TierConfig {
  readonly slug: TierSlug;
  /** Existing Stripe product name. Kept separate from public marketing names. */
  readonly stripeProductName: string;
  readonly displayName: string;
  readonly stageLabel: string;
  readonly journeyLabel: string;
  readonly description: string;
  readonly prices: Record<BillingCycle, TierPrice>;
  /** Essential qualification displayed directly with the price. */
  readonly priceQualifier: string;
  readonly additionalQualifier?: string;
  readonly features: readonly string[];
  /** Short one-liner shown in its own row below the features. */
  readonly bestFor: string;
  /** false → community (npm), enterprise (sales). true → real Stripe product + price. */
  readonly stripeBuyable: boolean;
  /** Highlighted card / column in the pricing table. */
  readonly highlight: boolean;
  /** Checkout `adjustable_quantity` enabled. Only the individual-seat product today. */
  readonly adjustableQuantity?: boolean;
  /** Default quantity passed to Stripe Checkout when the buyer doesn't override. */
  readonly defaultQuantity?: number;
}

const FREE: TierPrice = { cents: null, display: 'Free', period: '' };

export const TIERS: readonly TierConfig[] = [
  {
    slug: 'community',
    stripeProductName: 'Community',
    displayName: 'Developer',
    stageLabel: 'Stage 01',
    journeyLabel: 'First prototype',
    description:
      'For individual learning, personal projects, student and academic work, nonprofit use, public demos, qualifying open-source applications, and commercial evaluation.',
    prices: { monthly: FREE, annual: FREE },
    priceQualifier: 'For permitted noncommercial use',
    additionalQualifier: 'Includes a 30-day commercial evaluation',
    features: [
      'All MIT-licensed Threadplane packages',
      '@threadplane/chat within permitted free-use scope',
      'Source access',
      'Public documentation, examples, and GitHub community support',
      'No registration required for the good-faith evaluation',
      'Unlimited contributors within permitted free-use scope',
    ],
    bestFor: 'Learning, personal projects, qualifying free use, and evaluation',
    stripeBuyable: false,
    highlight: false,
  },
  {
    slug: 'developer_seat',
    stripeProductName: 'Developer Seat',
    displayName: 'Pro',
    stageLabel: 'Stage 02',
    journeyLabel: 'Shipping commercially',
    description:
      'For solo developers and teams purchasing commercial developer seats individually.',
    prices: {
      monthly: { cents: 2900, display: '$29', period: '/developer/month' },
      annual: { cents: 29900, display: '$299', period: '/developer/year' },
    },
    priceQualifier: 'One developer seat per purchased quantity',
    features: [
      'Commercial production rights for @threadplane/chat',
      'Unlimited licensed applications and end users',
      'Development, staging, CI/CD, and production use',
      'Same package and core capabilities as every paid plan',
      'Offline signed license token',
      'GitHub support',
    ],
    bestFor: 'Solo developers and teams buying seats individually',
    stripeBuyable: true,
    highlight: false,
    adjustableQuantity: true,
    defaultQuantity: 1,
  },
  {
    slug: 'team',
    stripeProductName: 'Team',
    displayName: 'Team',
    stageLabel: 'Stage 03',
    journeyLabel: 'Whole team shipping',
    description:
      'For small teams that want one subscription, one renewal, five seats, and direct email support.',
    prices: {
      monthly: { cents: 14900, display: '$149', period: '/month' },
      annual: { cents: 149500, display: '$1,495', period: '/year' },
    },
    priceQualifier: '5 developer seats included',
    features: [
      'Commercial production rights for @threadplane/chat',
      'Unlimited licensed applications and end users',
      'Same package and core capabilities as Pro',
      'Offline signed license token',
      'Email support',
      'One procurement-friendly team subscription',
    ],
    bestFor: 'Small teams that want a single subscription',
    stripeBuyable: true,
    highlight: true,
  },
  {
    slug: 'enterprise',
    stripeProductName: 'Enterprise',
    displayName: 'Enterprise',
    stageLabel: 'Destination',
    journeyLabel: 'Production at scale',
    description:
      'For organizations requiring broader license scope, enterprise support, security review, contractual terms, and guided delivery.',
    // Enterprise is sales-led — same "From $4,000/mo" label regardless of cycle.
    prices: {
      monthly: { cents: null, display: 'From $4,000', period: '/month' },
      annual: { cents: null, display: 'From $4,000', period: '/month' },
    },
    priceQualifier: 'Annual contract',
    features: [
      'Custom or organization-wide developer coverage',
      'Multi-application commercial scope',
      'Custom contract and procurement support',
      'Private support channel and response SLA',
      'Security review assistance',
      'Pilot-to-Prod available as an optional engagement',
    ],
    bestFor: 'Organizations with custom support and contract requirements',
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
 * Compute the largest annual discount shown by a public paid tier. The UI
 * labels this as "save up to" so it does not imply one universal discount.
 */
export function annualDiscountPercent(): number {
  return Math.max(
    0,
    ...TIERS.map((tier) => {
      const monthly = tier.prices.monthly.cents;
      const annual = tier.prices.annual.cents;
      if (monthly == null || annual == null) return 0;
      return Math.round((1 - annual / (monthly * 12)) * 100);
    }),
  );
}
