// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { extractTier, computeSeats } from './tier.js';

describe('extractTier', () => {
  it('returns developer-seat from price metadata', () => {
    expect(extractTier({ cacheplane_tier: 'developer-seat' })).toBe('developer-seat');
  });

  it('returns app-deployment from price metadata', () => {
    expect(extractTier({ cacheplane_tier: 'app-deployment' })).toBe('app-deployment');
  });

  it('throws when cacheplane_tier is missing', () => {
    expect(() => extractTier({})).toThrow(/cacheplane_tier/);
  });

  it('throws when cacheplane_tier is an unknown value', () => {
    expect(() => extractTier({ cacheplane_tier: 'bogus' })).toThrow(/bogus/);
  });

  it('throws when metadata is null', () => {
    expect(() => extractTier(null)).toThrow(/metadata/);
  });
});

describe('computeSeats', () => {
  it('returns the Stripe quantity for developer-seat', () => {
    expect(computeSeats('developer-seat', 5)).toBe(5);
  });

  it('returns 1 for app-deployment regardless of quantity', () => {
    expect(computeSeats('app-deployment', 10)).toBe(1);
  });

  it('defaults developer-seat to 1 when quantity is null', () => {
    expect(computeSeats('developer-seat', null)).toBe(1);
  });
});
