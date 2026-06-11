// SPDX-License-Identifier: MIT
import { computed, signal } from '@angular/core';

export interface ItineraryStop {
  id: string;
  day: number;
  place: string;
  note?: string;
}

export const ITINERARY_STORAGE_KEY = 'ag-ui-demo:itinerary';

const SEED: ItineraryStop[] = [
  { id: 'seed-1', day: 1, place: 'Louvre', note: 'book tickets' },
  { id: 'seed-2', day: 1, place: 'Eiffel Tower' },
  { id: 'seed-3', day: 2, place: "Musée d'Orsay" },
];

/** Frontend-owned demo state: the user edits it in the panel, the agent edits
 *  it through client tools. Both write the same signals, so either's changes
 *  render immediately. Persisted to localStorage so it survives reload. */
export class ItineraryStore {
  readonly stops = signal<ItineraryStop[]>(this.hydrate());
  readonly days = computed(() => {
    const byDay = new Map<number, ItineraryStop[]>();
    for (const s of this.stops()) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
    return [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, stops]) => ({ day, stops }));
  });

  add(day: number, place: string, note?: string): ItineraryStop {
    const stop: ItineraryStop = {
      id: crypto.randomUUID(),
      day,
      place,
      ...(note ? { note } : {}),
    };
    this.update([...this.stops(), stop]);
    return stop;
  }

  move(place: string, toDay: number): ItineraryStop | undefined {
    const target = this.stops().find((s) => s.place.toLowerCase() === place.toLowerCase());
    if (!target) return undefined;
    const moved = { ...target, day: toDay };
    this.update(this.stops().map((s) => (s.id === target.id ? moved : s)));
    return moved;
  }

  remove(id: string): void {
    this.update(this.stops().filter((s) => s.id !== id));
  }

  clearDay(day: number): number {
    const removed = this.stops().filter((s) => s.day === day).length;
    this.update(this.stops().filter((s) => s.day !== day));
    return removed;
  }

  reset(): void {
    this.update([...SEED]);
  }

  private update(next: ItineraryStop[]): void {
    this.stops.set(next);
    try {
      localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }

  private hydrate(): ItineraryStop[] {
    try {
      const raw = localStorage.getItem(ITINERARY_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ItineraryStop[];
    } catch {
      /* fall through to seed */
    }
    return [...SEED];
  }
}
