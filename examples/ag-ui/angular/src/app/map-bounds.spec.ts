// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { computeBounds } from './map-bounds';

describe('computeBounds', () => {
  it('returns null for an empty list', () => {
    expect(computeBounds([])).toBeNull();
  });

  it('returns null when no stop has coordinates', () => {
    expect(computeBounds([{ lat: null, lng: null }, { lat: undefined, lng: undefined }])).toBeNull();
  });

  it('returns a degenerate box for a single stop', () => {
    expect(computeBounds([{ lat: 48.86, lng: 2.35 }])).toEqual({
      north: 48.86, south: 48.86, east: 2.35, west: 2.35,
    });
  });

  it('returns min/max extents for multiple stops', () => {
    const b = computeBounds([
      { lat: 48.86, lng: 2.35 },
      { lat: 48.80, lng: 2.40 },
      { lat: 48.90, lng: 2.30 },
    ]);
    expect(b).toEqual({ north: 48.90, south: 48.80, east: 2.40, west: 2.30 });
  });

  it('ignores stops missing coordinates', () => {
    const b = computeBounds([
      { lat: 48.86, lng: 2.35 },
      { lat: null, lng: null },
      { lat: 48.90, lng: 2.40 },
    ]);
    expect(b).toEqual({ north: 48.90, south: 48.86, east: 2.40, west: 2.35 });
  });
});
