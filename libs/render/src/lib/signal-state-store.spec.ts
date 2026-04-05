// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signalStateStore } from './signal-state-store';

describe('signalStateStore', () => {
  it('should implement StateStore interface with get/set', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ name: 'test', count: 0 });
      expect(store.get('/name')).toBe('test');
      expect(store.get('/count')).toBe(0);
      store.set('/count', 5);
      expect(store.get('/count')).toBe(5);
    });
  });

  it('should return full state snapshot via getSnapshot', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ a: 1, b: 2 });
      expect(store.getSnapshot()).toEqual({ a: 1, b: 2 });
    });
  });

  it('should batch updates via update()', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ x: 0, y: 0 });
      store.update({ '/x': 10, '/y': 20 });
      expect(store.get('/x')).toBe(10);
      expect(store.get('/y')).toBe(20);
    });
  });

  it('should notify subscribers on state change', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ val: 'a' });
      const listener = vi.fn();
      const unsub = store.subscribe(listener);
      store.set('/val', 'b');
      expect(listener).toHaveBeenCalled();
      unsub();
    });
  });

  it('should handle nested paths', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ user: { name: 'Alice', age: 30 } });
      expect(store.get('/user/name')).toBe('Alice');
      store.set('/user/name', 'Bob');
      expect(store.get('/user/name')).toBe('Bob');
      expect(store.getSnapshot()).toEqual({ user: { name: 'Bob', age: 30 } });
    });
  });

  it('should handle array paths', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ items: ['a', 'b', 'c'] });
      expect(store.get('/items/0')).toBe('a');
      store.set('/items/1', 'B');
      expect(store.get('/items/1')).toBe('B');
    });
  });

  it('should preserve array type when setting by index', () => {
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ items: ['a', 'b', 'c'] });
      store.set('/items/1', 'B');
      const snapshot = store.getSnapshot();
      expect(Array.isArray(snapshot['items'])).toBe(true);
      expect(snapshot['items']).toEqual(['a', 'B', 'c']);
    });
  });
});
