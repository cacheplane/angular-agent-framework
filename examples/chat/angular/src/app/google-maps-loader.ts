// SPDX-License-Identifier: MIT
import { Injectable, signal } from '@angular/core';
import { environment } from '../environments/environment';

/**
 * Loads the Google Maps JS API on demand and exposes a `loaded` signal.
 *
 * Why this exists: `<google-map>` (from `@angular/google-maps`) THROWS in its
 * constructor when `window.google` is absent ("Namespace google not found…",
 * dev-mode only). The Maps script loads asynchronously, so rendering the map
 * before it resolves aborts the host component's change-detection pass — which
 * (on a fresh load with App mode persisted on) blanks the whole shell. The fix
 * is the documented `@angular/google-maps` contract: only render `<google-map>`
 * once the API is present. Consumers gate their template on `loaded()` and call
 * `ensureLoaded()` once.
 */
@Injectable({ providedIn: 'root' })
export class GoogleMapsLoader {
  /** Becomes true once `window.google.maps` is available. */
  readonly loaded = signal(false);
  private started = false;

  /** Idempotent: injects the Maps script once (if a key is present) and flips
   *  `loaded` when ready. Safe to call from multiple components. */
  ensureLoaded(): void {
    if (this.loaded() || this.started) return;
    const w = globalThis as { google?: { maps?: unknown }; document?: Document };
    if (w.google?.maps) {
      this.loaded.set(true);
      return;
    }
    this.started = true;

    const key = (environment.googleMapsApiKey as string) ?? '';
    if (!key) return; // No key → map stays gated off (the toolbar toggle is also disabled).

    const doc = w.document;
    if (!doc) return;

    const existing = doc.querySelector('script[data-google-maps]');
    if (existing) {
      // A load is already in flight (e.g. a prior instance). Poll for readiness.
      const poll = setInterval(() => {
        if ((globalThis as { google?: { maps?: unknown } }).google?.maps) {
          clearInterval(poll);
          this.loaded.set(true);
        }
      }, 100);
      return;
    }

    const script = doc.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geocoding,marker`;
    script.async = true;
    script.setAttribute('data-google-maps', '');
    script.addEventListener('load', () => this.loaded.set(true));
    doc.head.appendChild(script);
  }
}
