// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { extractTier, computeSeats } from './tier.js';

describe('extractTier', () => {
  it('returns developer_seat from price metadata', () => {
    expect(extractTier({ ngaf_tier_slug: 'developer_seat' })).toBe('developer_seat');
  });

  it('returns team from price metadata', () => {
    expect(extractTier({ ngaf_tier_slug: 'team' })).toBe('team');
  });

  it('throws when ngaf_tier_slug is missing', () => {
    expect(() => extractTier({})).toThrow(/ngaf_tier_slug/);
  });

  it('throws when ngaf_tier_slug is an unknown value', () => {
    expect(() => extractTier({ ngaf_tier_slug: 'bogus' })).toThrow(/bogus/);
  });

  it('throws when metadata is null', () => {
    expect(() => extractTier(null)).toThrow(/metadata/);
  });
});

describe('computeSeats', () => {
  it('returns the Stripe quantity for developer_seat', () => {
    expect(computeSeats('developer_seat', 5)).toBe(5);
  });

  it('returns 5 for team regardless of quantity', () => {
    expect(computeSeats('team', 1)).toBe(5);
    expect(computeSeats('team', 10)).toBe(5);
  });

  it('defaults developer_seat to 1 when quantity is null', () => {
    expect(computeSeats('developer_seat', null)).toBe(1);
  });
});
