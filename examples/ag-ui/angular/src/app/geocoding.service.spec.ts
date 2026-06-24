// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GeocodingService } from './geocoding.service';

beforeEach(() => {
  (globalThis as any).google = {
    maps: {
      Geocoder: class {
        async geocode({ address }: { address: string }) {
          if (address === 'fail') throw new Error('boom');
          if (address === 'empty') return { results: [] };
          return {
            results: [
              { geometry: { location: { lat: () => 48.85, lng: () => 2.35 } } },
            ],
          };
        }
      },
    },
  };
});

afterEach(() => {
  delete (globalThis as any).google;
});

describe('GeocodingService', () => {
  it('resolves an address to { lat, lng }', async () => {
    const svc = TestBed.inject(GeocodingService);
    expect(await svc.geocode('Louvre')).toEqual({ lat: 48.85, lng: 2.35 });
  });

  it('returns null when geocoding throws', async () => {
    const svc = TestBed.inject(GeocodingService);
    expect(await svc.geocode('fail')).toBeNull();
  });

  it('returns null when there are no results', async () => {
    const svc = TestBed.inject(GeocodingService);
    expect(await svc.geocode('empty')).toBeNull();
  });

  it('returns null when google.maps is not loaded', async () => {
    delete (globalThis as any).google;
    const svc = TestBed.inject(GeocodingService);
    expect(await svc.geocode('Louvre')).toBeNull();
  });
});
