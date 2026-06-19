// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PalettePersistence } from './palette-persistence.service';

const KEY = 'threadplane-ag-ui-demo:palette';

describe('PalettePersistence (ag-ui)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── Baseline behavior ─────────────────────────────────────────────────────

  it('returns null when nothing is stored', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('model')).toBeNull();
    expect(svc.read('effort')).toBeNull();
    expect(svc.read('genUiMode')).toBeNull();
    expect(svc.read('theme')).toBeNull();
    expect(svc.read('colorScheme')).toBeNull();
  });

  it('round-trips a valid model value', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    svc.write('model', 'gpt-5-mini');
    expect(svc.read('model')).toBe('gpt-5-mini');
  });

  it('round-trips a valid effort value', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    svc.write('effort', 'high');
    expect(svc.read('effort')).toBe('high');
  });

  it('survives malformed storage (returns null and does not throw)', () => {
    localStorage.setItem(KEY, 'not-valid-json');
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('model')).toBeNull();
  });

  it('clearing a key with null removes it from storage', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    svc.write('model', 'gpt-5-mini');
    expect(svc.read('model')).toBe('gpt-5-mini');
    svc.write('model', null);
    expect(svc.read('model')).toBeNull();
  });

  // ── Validate-on-read: enum fields ─────────────────────────────────────────

  it('returns null for a stale model value not in the allowed set', () => {
    localStorage.setItem(KEY, JSON.stringify({ model: 'gpt-4-turbo' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('model')).toBeNull();
  });

  it('returns a valid model value (gpt-5-nano) unchanged', () => {
    localStorage.setItem(KEY, JSON.stringify({ model: 'gpt-5-nano' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('model')).toBe('gpt-5-nano');
  });

  it('returns null for a stale effort value not in the allowed set', () => {
    localStorage.setItem(KEY, JSON.stringify({ effort: 'turbo' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('effort')).toBeNull();
  });

  it('returns a valid effort value (low) unchanged', () => {
    localStorage.setItem(KEY, JSON.stringify({ effort: 'low' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('effort')).toBe('low');
  });

  it('returns null for a stale genUiMode value not in the allowed set', () => {
    localStorage.setItem(KEY, JSON.stringify({ genUiMode: 'legacy-render' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('genUiMode')).toBeNull();
  });

  it('returns a valid genUiMode value (a2ui) unchanged', () => {
    localStorage.setItem(KEY, JSON.stringify({ genUiMode: 'a2ui' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('genUiMode')).toBe('a2ui');
  });

  it('returns null for a stale theme value not in the allowed set', () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: 'ocean-blue' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('theme')).toBeNull();
  });

  it('returns a valid theme value (material-light) unchanged', () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: 'material-light' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('theme')).toBe('material-light');
  });

  it('returns null for a stale colorScheme value not in the allowed set', () => {
    localStorage.setItem(KEY, JSON.stringify({ colorScheme: 'system' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('colorScheme')).toBeNull();
  });

  it('returns a valid colorScheme value (dark) unchanged', () => {
    localStorage.setItem(KEY, JSON.stringify({ colorScheme: 'dark' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('colorScheme')).toBe('dark');
  });
});
