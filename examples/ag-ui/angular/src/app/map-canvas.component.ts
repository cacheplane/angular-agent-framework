// SPDX-License-Identifier: MIT
/// <reference types="google.maps" />
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GoogleMap, MapMarker, MapPolyline } from '@angular/google-maps';
import { ItineraryStop, ItineraryStore } from './itinerary-store';

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
];

const DAY_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const PARIS_CENTER: google.maps.LatLngLiteral = { lat: 48.8566, lng: 2.3522 };

@Component({
  selector: 'app-map-canvas',
  standalone: true,
  imports: [GoogleMap, MapMarker, MapPolyline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <google-map
      width="100%"
      height="100%"
      [center]="center()"
      [zoom]="zoom()"
      [options]="mapOptions"
    >
      @for (s of stopsWithCoords(); track s.id) {
        <map-marker [position]="{ lat: s.lat!, lng: s.lng! }" [options]="markerOptions(s)" />
      }
      @for (line of polylines(); track line.day) {
        <map-polyline [path]="line.path" [options]="polylineOptions(line.day)" />
      }
    </google-map>
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
})
export class MapCanvasComponent {
  protected readonly store = inject(ItineraryStore);
  protected readonly center = signal<google.maps.LatLngLiteral>(PARIS_CENTER);
  protected readonly zoom = signal<number>(12);
  protected readonly mapOptions: google.maps.MapOptions = {
    styles: DARK_STYLE,
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
  };

  protected readonly stopsWithCoords = computed(() =>
    this.store.stops().filter((s) => s.lat != null && s.lng != null),
  );

  protected readonly polylines = computed(() => {
    const byDay = new Map<number, ItineraryStop[]>();
    for (const s of this.stopsWithCoords()) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
    return [...byDay.entries()]
      .filter(([, stops]) => stops.length >= 2)
      .map(([day, stops]) => ({ day, path: stops.map((s) => ({ lat: s.lat!, lng: s.lng! })) }));
  });

  protected markerOptions(s: ItineraryStop): google.maps.MarkerOptions {
    return {
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: DAY_COLORS[(s.day - 1) % DAY_COLORS.length],
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
        scale: 8,
      },
      title: s.place,
    };
  }

  protected polylineOptions(day: number): google.maps.PolylineOptions {
    return {
      strokeColor: DAY_COLORS[(day - 1) % DAY_COLORS.length],
      strokeOpacity: 0.7,
      strokeWeight: 3,
    };
  }
}
