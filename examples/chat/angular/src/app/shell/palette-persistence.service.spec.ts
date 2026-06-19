import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PalettePersistence } from './palette-persistence.service';

const KEY = 'threadplane-chat-demo:palette';

describe('PalettePersistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('model')).toBeNull();
    expect(svc.read('effort')).toBeNull();
    expect(svc.read('drawerOpen')).toBeNull();
  });

  it('round-trips a string value', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    svc.write('model', 'gpt-5-mini');
    expect(svc.read('model')).toBe('gpt-5-mini');
  });

  it('round-trips effort', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    svc.write('effort', 'high');
    expect(svc.read('effort')).toBe('high');
  });

  it('round-trips a boolean value', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    svc.write('drawerOpen', true);
    expect(svc.read('drawerOpen')).toBe(true);
    svc.write('drawerOpen', false);
    expect(svc.read('drawerOpen')).toBe(false);
  });

  it('clearing a key with null removes it from storage', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    svc.write('selectedProjectId', 'abc');
    expect(svc.read('selectedProjectId')).toBe('abc');
    svc.write('selectedProjectId', null);
    expect(svc.read('selectedProjectId')).toBeNull();
  });

  it('survives malformed storage (returns null and does not throw)', () => {
    localStorage.setItem(KEY, 'not-valid-json');
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('model')).toBeNull();
  });

  // ── Validate-on-read: enum fields ─────────────────────────────────────────

  it('returns null for a stale model value not in the allowed set', () => {
    localStorage.setItem(KEY, JSON.stringify({ model: 'gpt-4-turbo' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('model')).toBeNull();
  });

  it('returns a valid model value unchanged', () => {
    localStorage.setItem(KEY, JSON.stringify({ model: 'gpt-5' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('model')).toBe('gpt-5');
  });

  it('returns null for a stale effort value not in the allowed set', () => {
    localStorage.setItem(KEY, JSON.stringify({ effort: 'ultra' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('effort')).toBeNull();
  });

  it('returns a valid effort value unchanged', () => {
    localStorage.setItem(KEY, JSON.stringify({ effort: 'medium' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('effort')).toBe('medium');
  });

  it('returns null for a stale genUiMode value not in the allowed set', () => {
    localStorage.setItem(KEY, JSON.stringify({ genUiMode: 'legacy-render' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('genUiMode')).toBeNull();
  });

  it('returns a valid genUiMode value unchanged', () => {
    localStorage.setItem(KEY, JSON.stringify({ genUiMode: 'json-render' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('genUiMode')).toBe('json-render');
  });

  it('returns null for a stale theme value not in the allowed set', () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: 'ocean-blue' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('theme')).toBeNull();
  });

  it('returns a valid theme value unchanged', () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: 'material-dark' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('theme')).toBe('material-dark');
  });

  it('returns null for a stale colorScheme value not in the allowed set', () => {
    localStorage.setItem(KEY, JSON.stringify({ colorScheme: 'system' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('colorScheme')).toBeNull();
  });

  it('returns a valid colorScheme value unchanged', () => {
    localStorage.setItem(KEY, JSON.stringify({ colorScheme: 'light' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('colorScheme')).toBe('light');
  });

  it('returns null for a stale sidenavMode value not in the allowed set', () => {
    localStorage.setItem(KEY, JSON.stringify({ sidenavMode: 'mini' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('sidenavMode')).toBeNull();
  });

  it('returns a valid sidenavMode value unchanged', () => {
    localStorage.setItem(KEY, JSON.stringify({ sidenavMode: 'expanded' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('sidenavMode')).toBe('expanded');
  });

  // ── Non-enum fields pass through without validation ───────────────────────

  it('passes selectedProjectId through without validation', () => {
    localStorage.setItem(KEY, JSON.stringify({ selectedProjectId: 'any-arbitrary-id-123' }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('selectedProjectId')).toBe('any-arbitrary-id-123');
  });

  it('passes drawerOpen boolean through without validation', () => {
    localStorage.setItem(KEY, JSON.stringify({ drawerOpen: true }));
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('drawerOpen')).toBe(true);
  });
});
