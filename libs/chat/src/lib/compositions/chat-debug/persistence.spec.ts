// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { createPersistence } from './persistence';

describe('createPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads undefined when no key set', () => {
    const p = createPersistence('test');
    expect(p.read('dock')).toBeUndefined();
  });

  it('round-trips a string value under the namespaced key', () => {
    const p = createPersistence('test');
    p.write('dock', 'bottom');
    expect(p.read('dock')).toBe('bottom');
    expect(localStorage.getItem('test:dock')).toBe('"bottom"');
  });

  it('round-trips a number value', () => {
    const p = createPersistence('test');
    p.write('size', 480);
    expect(p.read('size')).toBe(480);
  });

  it('round-trips a boolean value', () => {
    const p = createPersistence('test');
    p.write('open', true);
    expect(p.read('open')).toBe(true);
  });

  it('returns undefined when stored JSON is malformed', () => {
    localStorage.setItem('test:dock', '{not-json');
    const p = createPersistence('test');
    expect(p.read('dock')).toBeUndefined();
  });

  it('isolates by prefix', () => {
    const a = createPersistence('a');
    const b = createPersistence('b');
    a.write('open', true);
    expect(b.read('open')).toBeUndefined();
  });
});
