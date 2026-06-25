// SPDX-License-Identifier: MIT
/// <reference types="google.maps" />
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { GoogleMap, MapInfoWindow, MapAdvancedMarker, MapPolyline } from '@angular/google-maps';
import { ItineraryStop, ItineraryStore } from './itinerary-store';
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
  protected readonly center = signal<google.maps.LatLngLiteral>(PARIS_CENTER);
  protected readonly zoom = signal<number>(12);
  // A mapId is REQUIRED for advanced markers; a mapId map ignores inline JSON
  // `styles`, so the dark theme is a cloud-based map style tied to this id.
  // DEMO_MAP_ID lets a fresh clone run (light map) with no Console setup.
  protected readonly mapId = environment.googleMapsMapId || 'DEMO_MAP_ID';
  protected readonly mapOptions: google.maps.MapOptions = {
    mapId: this.mapId,
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
  };

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
