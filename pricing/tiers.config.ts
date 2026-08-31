// SPDX-License-Identifier: MIT

export type TierSlug = 'community' | 'production_assurance' | 'enterprise';

export interface TierConfig {
  readonly slug: TierSlug;
  readonly displayName: string;
  readonly stageLabel: string;
  readonly journeyLabel: string;
  readonly description: string;
  readonly price: string;
  readonly priceQualifier: string;
  readonly softwareLicense: 'MIT';
  readonly features: readonly string[];
  readonly bestFor: string;
  readonly highlight: boolean;
}

export const TIERS: readonly TierConfig[] = [
  {
    slug: 'community',
    displayName: 'Community',
    stageLabel: 'Build',
    journeyLabel: 'Start with the complete framework',
    description:
      'Use every Threadplane package in prototypes, internal tools, client work, and commercial products.',
    price: 'Free forever',
    priceQualifier: 'All packages are MIT-licensed',
    softwareLicense: 'MIT',
    features: [
      'Every published package and core capability',
      'Commercial and noncommercial use',
      'Modification and redistribution under MIT',
      'Public documentation, examples, and community support',
      'No registration, activation, or runtime checks',
    ],
    bestFor: 'Teams that can build and operate with community support',
    highlight: false,
  },
  {
    slug: 'production_assurance',
    displayName: 'Production Assurance',
    stageLabel: 'Ship',
    journeyLabel: 'Add expert support',
    description:
      'A support relationship for teams standardizing Threadplane in production without changing the software they run.',
    price: 'Custom',
    priceQualifier: 'Scoped to your support needs',
    softwareLicense: 'MIT',
    features: [
      'Everything in Community',
      'Architecture and implementation reviews',
      'Private support channel with response commitments',
      'Upgrade, migration, and release guidance',
      'Security and procurement assistance',
    ],
    bestFor: 'Production teams that want accountable expert support',
    highlight: true,
  },
  {
    slug: 'enterprise',
    displayName: 'Enterprise',
    stageLabel: 'Scale',
    journeyLabel: 'De-risk delivery',
    description:
      'A tailored engagement for organizations that need hands-on delivery, governance, or enterprise terms.',
    price: 'Custom',
    priceQualifier: 'Tailored engagement',
    softwareLicense: 'MIT',
    features: [
      'Everything in Production Assurance',
      'Pilot-to-Prod delivery engagement',
      'Design-system and runtime integration guidance',
      'Custom service levels and support workflows',
      'Organization-wide enablement and training',
    ],
    bestFor: 'Organizations moving an agent experience from pilot to production',
    highlight: false,
  },
];

export function getTier(slug: TierSlug): TierConfig {
  const tier = TIERS.find((candidate) => candidate.slug === slug);
  if (!tier) throw new Error(`Unknown tier slug: ${slug}`);
  return tier;
}
