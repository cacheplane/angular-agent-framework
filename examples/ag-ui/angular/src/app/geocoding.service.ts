// SPDX-License-Identifier: MIT
/// <reference types="google.maps" />
import { Injectable } from '@angular/core';

/**
 * Wraps the Google Maps Geocoder to resolve a place string to coordinates.
 * Returns null on any failure — Maps not loaded, no results, or a thrown
 * error — so callers can add a stop with no pin rather than break.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private geocoder: google.maps.Geocoder | null = null;

  async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    const g = (globalThis as { google?: typeof google }).google;
    if (!g?.maps?.Geocoder) return null;
    try {
      this.geocoder ??= new g.maps.Geocoder();
      const { results } = await this.geocoder.geocode({ address });
      const first = results?.[0];
      if (!first) return null;
      return { lat: first.geometry.location.lat(), lng: first.geometry.location.lng() };
    } catch {
      return null;
    }
  }
}
