// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
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
