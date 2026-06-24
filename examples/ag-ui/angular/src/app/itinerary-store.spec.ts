// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ItineraryStore, ITINERARY_STORAGE_KEY } from './itinerary-store';

describe('ItineraryStore', () => {
  beforeEach(() => localStorage.clear());

  it('seeds the Paris trip when storage is empty', () => {
    const s = new ItineraryStore();
    expect(s.stops().length).toBe(3);
    expect(s.days()[0].day).toBe(1);
  });

  it('add appends a stop and persists it', () => {
    const s = new ItineraryStore();
    s.add(2, 'Sainte-Chapelle', 'morning');
    expect(s.stops().some((x) => x.place === 'Sainte-Chapelle')).toBe(true);
    expect(localStorage.getItem(ITINERARY_STORAGE_KEY)).toContain('Sainte-Chapelle');
  });

  it('move matches place case-insensitively and returns the stop', () => {
    const s = new ItineraryStore();
    const moved = s.move('louvre', 2);
    expect(moved?.day).toBe(2);
    expect(s.move('atlantis', 1)).toBeUndefined();
  });

  it('clearDay removes only stops for that day', () => {
    const s = new ItineraryStore();
    // seed has 2 stops on day 1, 1 stop on day 2
    const removed = s.clearDay(1);
    expect(removed).toBe(2);
    expect(s.stops().every((x) => x.day !== 1)).toBe(true);
    // day 2 stop still exists
    expect(s.stops().some((x) => x.day === 2)).toBe(true);
  });

  it('remove deletes the stop with the given id', () => {
    const s = new ItineraryStore();
    const first = s.stops()[0];
    s.remove(first.id);
    expect(s.stops().find((x) => x.id === first.id)).toBeUndefined();
    expect(s.stops().length).toBe(2);
  });

  it('reset restores the seed stops', () => {
    const s = new ItineraryStore();
    s.add(3, 'Versailles');
    s.reset();
    expect(s.stops().length).toBe(3);
    expect(s.stops().every((x) => x.id.startsWith('seed-'))).toBe(true);
  });

  it('hydrates from pre-populated localStorage', () => {
    const stored = [{ id: 'test-1', day: 5, place: 'Arc de Triomphe', note: 'sunset' }];
    localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(stored));
    const s = new ItineraryStore();
    expect(s.stops().length).toBe(1);
    expect(s.stops()[0].place).toBe('Arc de Triomphe');
    expect(s.stops()[0].day).toBe(5);
  });
});

describe('reorder', () => {
  beforeEach(() => localStorage.clear());

  it('moves a stop to a new index within the same day', () => {
    const s = new ItineraryStore();
    // seed: day 1 has [Louvre, Eiffel]
    const eiffel = s.stops().find((x) => x.place === 'Eiffel Tower')!;
    s.reorder(eiffel.id, 1, 0);
    const day1 = s.days().find((g) => g.day === 1)!;
    expect(day1.stops.map((x) => x.place)).toEqual(['Eiffel Tower', 'Louvre']);
  });

  it('moves a stop across days at a specific index', () => {
    const s = new ItineraryStore();
    const orsay = s.stops().find((x) => x.place === "Musée d'Orsay")!;
    s.reorder(orsay.id, 1, 0);
    const day1 = s.days().find((g) => g.day === 1)!;
    expect(day1.stops[0].place).toBe("Musée d'Orsay");
    expect(day1.stops[0].day).toBe(1);
  });

  it('reorder by unknown id is a no-op', () => {
    const s = new ItineraryStore();
    const before = s.stops();
    s.reorder('does-not-exist', 1, 0);
    expect(s.stops()).toEqual(before);
  });
});

describe('recentlyChangedId', () => {
  beforeEach(() => localStorage.clear());

  it('is null initially', () => {
    const s = new ItineraryStore();
    expect(s.recentlyChangedId()).toBeNull();
  });

  it('is set after an agent-source add', () => {
    const s = new ItineraryStore();
    const added = s.add(3, 'Sacré-Cœur');
    expect(s.recentlyChangedId()).toBe(added.id);
  });

  it('is NOT set after a user-source add', () => {
    const s = new ItineraryStore();
    s.add(3, 'Sacré-Cœur', undefined, { source: 'user' });
    expect(s.recentlyChangedId()).toBeNull();
  });

  it('clears 1600ms after the change', async () => {
    vi.useFakeTimers();
    const s = new ItineraryStore();
    s.add(3, 'Sacré-Cœur');
    expect(s.recentlyChangedId()).not.toBeNull();
    vi.advanceTimersByTime(1600);
    expect(s.recentlyChangedId()).toBeNull();
    vi.useRealTimers();
  });
});

describe('focus', () => {
  beforeEach(() => localStorage.clear());
  it('focus sets and clears focusedStopId', () => {
    const s = new ItineraryStore();
    expect(s.focusedStopId()).toBeNull();
    s.focus('seed-1');
    expect(s.focusedStopId()).toBe('seed-1');
    s.focus(null);
    expect(s.focusedStopId()).toBeNull();
  });
});

describe('coordinates', () => {
  beforeEach(() => localStorage.clear());

  it('seed stops carry Paris coords', () => {
    const s = new ItineraryStore();
    const louvre = s.stops().find((x) => x.place === 'Louvre')!;
    expect(louvre.lat).toBeCloseTo(48.8606, 3);
    expect(louvre.lng).toBeCloseTo(2.3376, 3);
  });

  it('add accepts optional lat/lng via opts.coords', () => {
    const s = new ItineraryStore();
    const added = s.add(2, 'Sacré-Cœur', undefined, {
      coords: { lat: 48.8867, lng: 2.3431 },
    });
    expect(added.lat).toBeCloseTo(48.8867, 3);
    expect(added.lng).toBeCloseTo(2.3431, 3);
  });

  it('add without coords leaves lat/lng undefined', () => {
    const s = new ItineraryStore();
    const added = s.add(2, 'Somewhere');
    expect(added.lat).toBeUndefined();
    expect(added.lng).toBeUndefined();
  });
});
