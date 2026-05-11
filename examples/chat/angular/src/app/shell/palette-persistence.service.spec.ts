import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PalettePersistence } from './palette-persistence.service';

const KEY = 'ngaf-chat-demo:palette';

describe('PalettePersistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('model')).toBeNull();
    expect(svc.read('effort')).toBeNull();
    expect(svc.read('threadId')).toBeNull();
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
    svc.write('threadId', 'abc');
    expect(svc.read('threadId')).toBe('abc');
    svc.write('threadId', null);
    expect(svc.read('threadId')).toBeNull();
  });

  it('survives malformed storage (returns null and does not throw)', () => {
    localStorage.setItem(KEY, 'not-valid-json');
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('model')).toBeNull();
  });
});
