// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { LicenseTier } from '@cacheplane/licensing';

export type MintableTier = Extract<LicenseTier, 'developer-seat' | 'app-deployment'>;

const VALID_TIERS: readonly MintableTier[] = ['developer-seat', 'app-deployment'] as const;

/**
 * Extract the Cacheplane tier from a Stripe price metadata bag.
 * Throws if the field is missing or holds an unknown value.
 */
export function extractTier(metadata: Record<string, string> | null | undefined): MintableTier {
  if (!metadata) {
    throw new Error('extractTier: price metadata is missing');
  }
  const raw = metadata['cacheplane_tier'];
  if (!raw) {
    throw new Error('extractTier: metadata.cacheplane_tier is missing');
  }
  if (!VALID_TIERS.includes(raw as MintableTier)) {
    throw new Error(`extractTier: unknown cacheplane_tier value: ${raw}`);
  }
  return raw as MintableTier;
}

/**
 * Compute the `seats` claim from the Stripe line-item quantity.
 * - developer-seat: tracks Stripe quantity (minimum 1).
 * - app-deployment: always 1.
 */
export function computeSeats(tier: MintableTier, quantity: number | null | undefined): number {
  if (tier === 'app-deployment') return 1;
  return quantity && quantity > 0 ? quantity : 1;
}
