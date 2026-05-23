// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { LicenseTier } from '@ngaf/licensing';

export type MintableTier = Extract<LicenseTier, 'developer_seat' | 'team'>;

const VALID_TIERS: readonly MintableTier[] = ['developer_seat', 'team'] as const;
const METADATA_KEY = 'ngaf_tier_slug';

const TEAM_SEAT_COUNT = 5;

/**
 * Extract the tier slug from a Stripe price metadata bag.
 * Throws if the field is missing or holds an unknown value.
 */
export function extractTier(metadata: Record<string, string> | null | undefined): MintableTier {
  if (!metadata) {
    throw new Error('extractTier: price metadata is missing');
  }
  const raw = metadata[METADATA_KEY];
  if (!raw) {
    throw new Error(`extractTier: metadata.${METADATA_KEY} is missing`);
  }
  if (!VALID_TIERS.includes(raw as MintableTier)) {
    throw new Error(`extractTier: unknown ${METADATA_KEY} value: ${raw}`);
  }
  return raw as MintableTier;
}

/**
 * Compute the `seats` claim from the Stripe line-item quantity.
 * - developer_seat: tracks Stripe quantity (minimum 1).
 * - team: always 5 (the bundle size baked into the SKU).
 */
export function computeSeats(tier: MintableTier, quantity: number | null | undefined): number {
  if (tier === 'developer_seat') {
    return quantity && quantity > 0 ? quantity : 1;
  }
  if (tier === 'team') {
    return TEAM_SEAT_COUNT;
  }
  return 1;
}
