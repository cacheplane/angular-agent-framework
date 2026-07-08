// SPDX-License-Identifier: MIT
import { toDisplayText } from './to-display-text';

describe('toDisplayText', () => {
  it('returns strings unchanged', () => {
    expect(toDisplayText('Alice')).toBe('Alice');
    expect(toDisplayText('')).toBe('');
  });

  it('stringifies numbers (the bug: numeric $state bindings were dropped)', () => {
    expect(toDisplayText(30)).toBe('30');
    expect(toDisplayText(42.5)).toBe('42.5');
  });

  it('preserves zero (falsy but must display)', () => {
    expect(toDisplayText(0)).toBe('0');
  });

  it('stringifies booleans', () => {
    expect(toDisplayText(true)).toBe('true');
    expect(toDisplayText(false)).toBe('false');
  });

  it('returns empty string for null / undefined', () => {
    expect(toDisplayText(null)).toBe('');
    expect(toDisplayText(undefined)).toBe('');
  });

  it('returns empty string for objects and arrays (not display text)', () => {
    expect(toDisplayText({ a: 1 })).toBe('');
    expect(toDisplayText([1, 2])).toBe('');
  });

  it('never leaks "[object Object]" for any object-ish value (the headline bug)', () => {
    for (const v of [{ a: 1 }, [1, 2], new Date(), () => 0, { toString: () => 'x' }]) {
      expect(toDisplayText(v)).not.toContain('[object');
      expect(toDisplayText(v)).toBe('');
    }
  });

  it('stringifies bigint', () => {
    expect(toDisplayText(10n)).toBe('10');
  });
});
