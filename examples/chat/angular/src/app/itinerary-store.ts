// SPDX-License-Identifier: MIT
import { computed, signal } from '@angular/core';

export interface ItineraryStop {
  id: string;
  day: number;
  place: string;
  note?: string;
  lat?: number;
  lng?: number;
}

export interface MutationOptions {
  source?: 'user' | 'agent';
  coords?: { lat: number; lng: number };
}

const PULSE_MS = 1600;

/** Working copy of the itinerary: the user edits it in the panel, the agent
 *  edits it through client tools. Both write the same signals, so either's
 *  changes render immediately. The graph checkpoint is the durable record —
 *  the shell calls `hydrate()` from a server state snapshot on thread switch. */
export class ItineraryStore {
  readonly stops = signal<ItineraryStop[]>([]);
  readonly days = computed(() => {
    const byDay = new Map<number, ItineraryStop[]>();
    for (const s of this.stops()) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
    return [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, stops]) => ({ day, stops }));
  });
  readonly recentlyChangedId = signal<string | null>(null);
  readonly focusedStopId = signal<string | null>(null);
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;

  focus(id: string | null): void {
    this.focusedStopId.set(id);
  }

  add(day: number, place: string, note?: string, opts?: MutationOptions): ItineraryStop {
    const stop: ItineraryStop = {
      id: crypto.randomUUID(),
      day,
      place,
      ...(note ? { note } : {}),
      ...(opts?.coords ? { lat: opts.coords.lat, lng: opts.coords.lng } : {}),
    };
    this.update([...this.stops(), stop]);
    this.flagChanged(stop.id, opts);
    return stop;
  }

  move(place: string, toDay: number, opts?: MutationOptions): ItineraryStop | undefined {
    const target = this.stops().find((s) => s.place.toLowerCase() === place.toLowerCase());
    if (!target) return undefined;
    const moved = { ...target, day: toDay };
    this.update(this.stops().map((s) => (s.id === target.id ? moved : s)));
    this.flagChanged(moved.id, opts);
    return moved;
  }

  reorder(stopId: string, toDay: number, toIndex: number, opts?: MutationOptions): void {
    const current = this.stops();
    const target = current.find((s) => s.id === stopId);
    if (!target) return;
    const without = current.filter((s) => s.id !== stopId);
    const dayStops = without.filter((s) => s.day === toDay);
    const others = without.filter((s) => s.day !== toDay);
    const clampedIndex = Math.max(0, Math.min(toIndex, dayStops.length));
    const newDayStops = [
      ...dayStops.slice(0, clampedIndex),
      { ...target, day: toDay },
      ...dayStops.slice(clampedIndex),
    ];
    this.update([...others, ...newDayStops]);
    this.flagChanged(stopId, opts);
  }

  remove(id: string, opts?: MutationOptions): void {
    this.update(this.stops().filter((s) => s.id !== id));
    this.flagChanged(id, opts);
  }

  clearDay(day: number, opts?: MutationOptions): number {
    const removed = this.stops().filter((s) => s.day === day).length;
    this.update(this.stops().filter((s) => s.day !== day));
    if (removed > 0) this.flagChanged(null, opts);
    return removed;
  }

  reset(opts?: MutationOptions): void {
    this.update([]);
    this.flagChanged(null, opts);
  }

  private flagChanged(id: string | null, opts?: MutationOptions): void {
    if (opts?.source === 'user') return;
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    this.recentlyChangedId.set(id);
    if (id !== null) {
      this.pulseTimer = setTimeout(() => {
        this.recentlyChangedId.set(null);
        this.pulseTimer = null;
      }, PULSE_MS);
    }
  }

  /** Replace the working copy from a server state snapshot (thread switch /
   *  values stream). Public — the shell calls it when agent.values() changes. */
  hydrate(stops: ItineraryStop[]): void {
    this.stops.set(stops ?? []);
  }

  private update(next: ItineraryStop[]): void {
    this.stops.set(next);
  }
}
