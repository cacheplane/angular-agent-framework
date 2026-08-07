// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
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

  it('declares show_trip_summary as a terminal view tool (followUp: false)', () => {
    const registry = TestBed.runInInjectionContext(() => itineraryClientTools());
    const summary = (registry as Record<string, { kind: string; followUp?: boolean }>)
      .show_trip_summary;
    expect(summary).toBeDefined();
    expect(summary.kind).toBe('view');
    expect(summary.followUp).toBe(false);
  });
});
