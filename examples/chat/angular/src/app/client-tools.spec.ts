// SPDX-License-Identifier: MIT
import { TestBed } from '@angular/core/testing';
import { ItineraryStore } from './itinerary-store';
import { GeocodingService } from './geocoding.service';
import { itineraryClientTools } from './client-tools';

describe('itineraryClientTools (langgraph demo)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [ItineraryStore, GeocodingService] }));

  it('exposes mutation tools but NOT get_itinerary', () => {
    const registry = TestBed.runInInjectionContext(() => itineraryClientTools());
    const names = Object.keys(registry as Record<string, unknown>);
    expect(names).toContain('add_stop');
    expect(names).toContain('clear_day');
    expect(names).not.toContain('get_itinerary');
  });
});
