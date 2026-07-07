// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
import { ItineraryStore } from './itinerary-store';

describe('ItineraryStore', () => {
  it('add appends a stop', () => {
    const s = new ItineraryStore();
    s.add(2, 'Sainte-Chapelle', 'morning');
    expect(s.stops().some((x) => x.place === 'Sainte-Chapelle')).toBe(true);
  });

  it('move matches place case-insensitively and returns the stop', () => {
    const s = new ItineraryStore();
    s.add(1, 'Louvre');
    const moved = s.move('louvre', 2);
    expect(moved?.day).toBe(2);
    expect(s.move('atlantis', 1)).toBeUndefined();
  });

  it('clearDay removes only stops for that day', () => {
    const s = new ItineraryStore();
    s.add(1, 'Louvre');
    s.add(1, 'Eiffel Tower');
    s.add(2, "Musée d'Orsay");
    const removed = s.clearDay(1);
    expect(removed).toBe(2);
    expect(s.stops().every((x) => x.day !== 1)).toBe(true);
    // day 2 stop still exists
    expect(s.stops().some((x) => x.day === 2)).toBe(true);
  });

  it('remove deletes the stop with the given id', () => {
    const s = new ItineraryStore();
    s.add(1, 'Louvre');
    s.add(1, 'Eiffel Tower');
    const first = s.stops()[0];
    s.remove(first.id);
    expect(s.stops().find((x) => x.id === first.id)).toBeUndefined();
    expect(s.stops().length).toBe(1);
  });

  it('reset clears all stops', () => {
    const s = new ItineraryStore();
    s.add(3, 'Versailles');
    s.reset();
    expect(s.stops().length).toBe(0);
  });
});

describe('ItineraryStore — server-state model', () => {
  it('starts empty (no seed)', () => {
    const store = new ItineraryStore();
    expect(store.stops()).toEqual([]);
    expect(store.days()).toEqual([]);
  });

  it('hydrates from a server itinerary snapshot', () => {
    const store = new ItineraryStore();
    store.hydrate([{ id: 'x', day: 1, place: 'Louvre' }]);
    expect(store.stops().map((s) => s.place)).toEqual(['Louvre']);
  });

  it('does not touch localStorage on update', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    const store = new ItineraryStore();
    store.add(1, 'Eiffel Tower');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('reorder', () => {
  it('moves a stop to a new index within the same day', () => {
    const s = new ItineraryStore();
    s.add(1, 'Louvre');
    s.add(1, 'Eiffel Tower');
    const eiffel = s.stops().find((x) => x.place === 'Eiffel Tower')!;
    s.reorder(eiffel.id, 1, 0);
    const day1 = s.days().find((g) => g.day === 1)!;
    expect(day1.stops.map((x) => x.place)).toEqual(['Eiffel Tower', 'Louvre']);
  });

  it('moves a stop across days at a specific index', () => {
    const s = new ItineraryStore();
    s.add(1, 'Louvre');
    s.add(1, 'Eiffel Tower');
    s.add(2, "Musée d'Orsay");
    const orsay = s.stops().find((x) => x.place === "Musée d'Orsay")!;
    s.reorder(orsay.id, 1, 0);
    const day1 = s.days().find((g) => g.day === 1)!;
    expect(day1.stops[0].place).toBe("Musée d'Orsay");
    expect(day1.stops[0].day).toBe(1);
  });

  it('reorder by unknown id is a no-op', () => {
    const s = new ItineraryStore();
    s.add(1, 'Louvre');
    const before = s.stops();
    s.reorder('does-not-exist', 1, 0);
    expect(s.stops()).toEqual(before);
  });
});

describe('recentlyChangedId', () => {
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
  it('focus sets and clears focusedStopId', () => {
    const s = new ItineraryStore();
    s.add(1, 'Louvre');
    const id = s.stops()[0].id;
    expect(s.focusedStopId()).toBeNull();
    s.focus(id);
    expect(s.focusedStopId()).toBe(id);
    s.focus(null);
    expect(s.focusedStopId()).toBeNull();
  });
});

describe('coordinates', () => {
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
