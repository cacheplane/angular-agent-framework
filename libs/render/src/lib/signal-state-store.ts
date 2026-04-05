// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal } from '@angular/core';
import type { StateStore, StateModel } from '@json-render/core';

function parsePointer(path: string): string[] {
  if (!path || path === '/') return [];
  return path.split('/').filter((_, i) => i > 0).map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function getByPath(obj: unknown, segments: string[]): unknown {
  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

function setByPath(obj: unknown, segments: string[], value: unknown): unknown {
  if (segments.length === 0) return value;
  const [head, ...rest] = segments;

  if (Array.isArray(obj)) {
    const index = Number(head);
    const clone = [...obj];
    clone[index] = setByPath(clone[index], rest, value);
    return clone;
  }

  const record = (obj != null && typeof obj === 'object')
    ? { ...obj as Record<string, unknown> }
    : {} as Record<string, unknown>;
  record[head] = setByPath(record[head], rest, value);
  return record;
}

export function signalStateStore(initialState: StateModel = {}): StateStore {
  const state = signal<StateModel>(initialState);
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  return {
    get(path: string): unknown {
      return getByPath(state(), parsePointer(path));
    },
    set(path: string, value: unknown): void {
      const segments = parsePointer(path);
      const current = getByPath(state(), segments);
      if (current === value) return;
      state.set(setByPath(state(), segments, value) as StateModel);
      notify();
    },
    update(updates: Record<string, unknown>): void {
      let current = state();
      let changed = false;
      for (const [path, value] of Object.entries(updates)) {
        const segments = parsePointer(path);
        const existing = getByPath(current, segments);
        if (existing !== value) {
          current = setByPath(current, segments, value) as StateModel;
          changed = true;
        }
      }
      if (changed) {
        state.set(current);
        notify();
      }
    },
    getSnapshot(): StateModel {
      return state();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
