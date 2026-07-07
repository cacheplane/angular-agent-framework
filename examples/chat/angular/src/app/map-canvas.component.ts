// SPDX-License-Identifier: MIT
/// <reference types="google.maps" />
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { GoogleMap, MapInfoWindow, MapAdvancedMarker, MapPolyline } from '@angular/google-maps';
import { ItineraryStop, ItineraryStore } from './itinerary-store';
import { computeBounds } from './map-bounds';
import { GoogleMapsLoader } from './google-maps-loader';
import { environment } from '../environments/environment';

const DAY_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const PARIS_CENTER: google.maps.LatLngLiteral = { lat: 48.8566, lng: 2.3522 };

@Component({
  selector: 'app-map-canvas',
  standalone: true,
  imports: [GoogleMap, MapInfoWindow, MapAdvancedMarker, MapPolyline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Render <google-map> ONLY after the Maps API has loaded. Its constructor
         throws "Namespace google not found" when window.google is absent, which
         would abort the host shell's render on a fresh load with App mode on. -->
    @if (loader.loaded()) {
      <google-map
        width="100%"
        height="100%"
        [center]="center()"
        [zoom]="zoom()"
        [options]="mapOptions"
      >
        @for (m of markerViews(); track m.id) {
          <map-advanced-marker
            #marker
            [position]="m.position"
            [content]="m.content"
            [title]="m.stop.place"
            [options]="advancedMarkerOptions"
            (mapClick)="onMarkerClick(m.stop)"
          />
        }
        @for (line of polylines(); track line.day) {
          <map-polyline [path]="line.path" [options]="polylineOptions(line.day)" />
        }
        <map-info-window>
          @if (focused(); as f) {
            <div class="info">
              <strong>{{ f.place }}</strong>
              @if (f.note) {
                <div class="info__note">{{ f.note }}</div>
              }
              <button type="button" class="info__remove" (click)="removeFocused()">Remove</button>
            </div>
          }
        </map-info-window>
      </google-map>
    }
  `,
  styles: [
    `
      :host { display: block; width: 100%; height: 100%; }
      .info { font-family: var(--tplane-chat-font-family, sans-serif); font-size: 0.85rem; color: #111; }
      .info__note { color: #555; margin: 4px 0 8px; }
      .info__remove {
        font: inherit; cursor: pointer; padding: 4px 10px;
        border: 1px solid #ddd; border-radius: 6px; background: #fff; color: #111;
      }
      .info__remove:hover { background: #f4f4f4; }
    `,
  ],
})
export class MapCanvasComponent {
  protected readonly store = inject(ItineraryStore);
  protected readonly loader = inject(GoogleMapsLoader);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly center = signal<google.maps.LatLngLiteral>(PARIS_CENTER);
  protected readonly zoom = signal<number>(12);
  // A mapId is REQUIRED for advanced markers. The dark theme is applied IN CODE
  // via `colorScheme: DARK` below — NOT a cloud-based map style — so there is no
  // Google Cloud Console style setup to maintain and ANY mapId works.
  // DEMO_MAP_ID lets a fresh clone run with no Console setup at all.
  protected readonly mapId = environment.googleMapsMapId || 'DEMO_MAP_ID';
  protected readonly mapOptions = {
    mapId: this.mapId,
    // Dark map in code — no cloud-style dependency. 'DARK' is the runtime value
    // of the google.maps.ColorScheme enum; kept as a plain string so this field
    // initializer holds no runtime `google.maps` reference (map-canvas builds
    // under jsdom in the shell specs, before the Maps API loads). The whole
    // literal is cast so it typechecks regardless of the installed
    // @types/google.maps version; the live Maps JS from Google's CDN honors it.
    colorScheme: 'DARK',
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
  } as google.maps.MapOptions;
  // AdvancedMarkerElement is NOT clickable by default (unlike the legacy
  // Marker) — without gmpClickable it never fires click/gmp-click, so the
  // wrapper's (mapClick) output stays silent and the info window can't open.
  protected readonly advancedMarkerOptions: google.maps.marker.AdvancedMarkerElementOptions = {
    gmpClickable: true,
  };

  private readonly googleMap = viewChild(GoogleMap);
  private readonly infoWindow = viewChild(MapInfoWindow);
  private readonly markers = viewChildren(MapAdvancedMarker);

  protected readonly stopsWithCoords = computed(() =>
    this.store.stops().filter((s) => s.lat != null && s.lng != null),
  );

  /** One marker view per coord'd stop. The pin <div> is built here (not in a
   *  template method) so it is recreated only when stops change — not on every
   *  change-detection pass (e.g. focus pans), which would cause flicker. */
  protected readonly markerViews = computed(() =>
    this.stopsWithCoords().map((s) => ({
      id: s.id,
      stop: s,
      position: { lat: s.lat!, lng: s.lng! },
      content: this.makePin(s.day),
    })),
  );

  protected readonly focused = computed(
    () => this.store.stops().find((s) => s.id === this.store.focusedStopId()) ?? null,
  );

  constructor() {
    this.loader.ensureLoaded();

    effect(() => {
      const f = this.focused();
      if (!f || f.lat == null || f.lng == null) return;
      const idx = this.stopsWithCoords().findIndex((s) => s.id === f.id);
      const marker = this.markers()[idx];
      const win = this.infoWindow();
      if (idx >= 0 && marker && win) {
        this.center.set({ lat: f.lat, lng: f.lng });
        win.open(marker);
      }
    });

    // Frame the map to all stops on structural change (add/remove/geocode).
    // Reads googleMap() so it re-runs once the map mounts behind the loader gate.
    // Keyed on stopsWithCoords() only — NOT focus — so panning to a focused stop
    // and reframing to all stops never fight (they fire on different signals).
    effect(() => {
      const map = this.googleMap();
      this.stopsWithCoords(); // re-frame on structural change (add/remove/geocode)
      if (map) this.frameToBounds(map); // null while <google-map> is behind the loader gate
    });

    // The map lives in the chat-sidebar's flex content slot, whose width changes
    // when the drawer pushes it (and on mode toggles). Google Maps caches its
    // viewport size at construction, so without a resize event the tiles render
    // grey and fitBounds frames the stale size. Re-sync on every container resize.
    afterNextRender(() => {
      const ro = new ResizeObserver(() => {
        const map = this.googleMap();
        if (!map?.googleMap) return;
        google.maps.event.trigger(map.googleMap, 'resize');
        this.frameToBounds(map);
      });
      ro.observe(this.hostRef.nativeElement);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  /** Frame the map to all coord'd stops (>=2: fitBounds; 1: center+zoom; 0: Paris). */
  private frameToBounds(map: GoogleMap): void {
    const stops = this.stopsWithCoords();
    if (stops.length === 0) {
      this.center.set(PARIS_CENTER);
      this.zoom.set(12);
      return;
    }
    if (stops.length === 1) {
      this.center.set({ lat: stops[0].lat!, lng: stops[0].lng! });
      this.zoom.set(13);
      return;
    }
    const b = computeBounds(stops);
    if (b) map.fitBounds(b, this.fitPadding());
  }

  /**
   * fitBounds padding (px per side) that reserves the App-mode panels floating
   * over the full-bleed map, so a stop never frames *underneath* them — the
   * reported bug was the rightmost marker hiding under the open chat rail.
   *
   * Measured live (not hardcoded) so it adapts to the chat drawer's open/closed
   * state and the responsive panel widths:
   *  - left  = our floating itinerary overlay card's footprint
   *  - right = the chat sidebar drawer's footprint (the gap its push leaves
   *            between `.chat-sidebar__content` and the map's right edge)
   * Falls back to a uniform base when the panels aren't present (unit tests,
   * non-App-mode layouts), preserving the prior behavior.
   */
  private fitPadding(): google.maps.Padding {
    const BASE = 48;
    const GAP = 24;
    const pad: google.maps.Padding = { top: BASE, right: BASE, bottom: BASE, left: BASE };
    const mapRect = this.hostRef.nativeElement.getBoundingClientRect();
    if (mapRect.width === 0) return pad; // not laid out (e.g. jsdom) — uniform

    const overlay = document.querySelector('.ag-ui-shell__itinerary-overlay');
    if (overlay) {
      const r = overlay.getBoundingClientRect();
      if (r.width > 0) pad.left = Math.max(BASE, Math.round(r.right - mapRect.left + GAP));
    }
    const content = document.querySelector('.chat-sidebar__content');
    if (content) {
      const occupied = mapRect.right - content.getBoundingClientRect().right;
      if (occupied > 1) pad.right = Math.max(BASE, Math.round(occupied + GAP));
    }
    return pad;
  }

  protected onMarkerClick(s: ItineraryStop): void {
    this.store.focus(s.id);
  }

  protected removeFocused(): void {
    const f = this.focused();
    if (!f) return;
    this.store.remove(f.id, { source: 'user' });
    this.store.focus(null);
    this.infoWindow()?.close();
  }

  protected readonly polylines = computed(() => {
    const byDay = new Map<number, ItineraryStop[]>();
    for (const s of this.stopsWithCoords()) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
    return [...byDay.entries()]
      .filter(([, stops]) => stops.length >= 2)
      .map(([day, stops]) => ({ day, path: stops.map((s) => ({ lat: s.lat!, lng: s.lng! })) }));
  });

  private makePin(day: number): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText =
      'width:16px;height:16px;border-radius:50%;border:2px solid #fff;' +
      `box-shadow:0 1px 3px rgba(0,0,0,.4);background:${DAY_COLORS[(day - 1) % DAY_COLORS.length]};`;
    return el;
  }

  protected polylineOptions(day: number): google.maps.PolylineOptions {
    return {
      strokeColor: DAY_COLORS[(day - 1) % DAY_COLORS.length],
      strokeOpacity: 0.7,
      strokeWeight: 3,
    };
  }
}
