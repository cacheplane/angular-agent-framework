// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { executeFunction } from './functions';

const model = { name: 'Alice', price: 1234.5, date: '2026-04-09', count: 1 };

describe('executeFunction', () => {
  // --- Validation functions ---
  it('required passes for non-empty string', () => {
    expect(executeFunction('required', { value: 'hello' }, model)).toBe(true);
  });

  it('required fails for empty string', () => {
    expect(executeFunction('required', { value: '' }, model)).toBe(false);
  });

  it('required fails for null', () => {
    expect(executeFunction('required', { value: null }, model)).toBe(false);
  });

  it('required fails for undefined', () => {
    expect(executeFunction('required', { value: undefined }, model)).toBe(false);
  });

  it('regex passes for matching pattern', () => {
    expect(executeFunction('regex', { value: 'abc123', pattern: '^[a-z]+\\d+$' }, model)).toBe(true);
  });

  it('regex fails for non-matching pattern', () => {
    expect(executeFunction('regex', { value: '!!!', pattern: '^\\w+$' }, model)).toBe(false);
  });

  it('length passes within range', () => {
    expect(executeFunction('length', { value: 'hello', min: 3, max: 10 }, model)).toBe(true);
  });

  it('length fails below min', () => {
    expect(executeFunction('length', { value: 'hi', min: 3 }, model)).toBe(false);
  });

  it('length fails above max', () => {
    expect(executeFunction('length', { value: 'toolong', max: 3 }, model)).toBe(false);
  });

  it('numeric passes in range', () => {
    expect(executeFunction('numeric', { value: 5, min: 0, max: 10 }, model)).toBe(true);
  });

  it('numeric fails out of range', () => {
    expect(executeFunction('numeric', { value: 20, min: 0, max: 10 }, model)).toBe(false);
  });

  it('numeric fails for NaN', () => {
    expect(executeFunction('numeric', { value: 'abc' }, model)).toBe(false);
  });

  it('email passes for valid email', () => {
    expect(executeFunction('email', { value: 'a@b.com' }, model)).toBe(true);
  });

  it('email fails for invalid email', () => {
    expect(executeFunction('email', { value: 'not-email' }, model)).toBe(false);
  });

  // --- Formatting functions ---
  it('formatString interpolates args', () => {
    expect(executeFunction('formatString', { template: 'Hello ${name}!', name: 'Alice' }, model)).toBe('Hello Alice!');
  });

  it('formatString handles missing args', () => {
    expect(executeFunction('formatString', { template: 'Hello ${name}!' }, model)).toBe('Hello !');
  });

  it('formatNumber with grouping', () => {
    expect(executeFunction('formatNumber', { value: 1234, grouping: true }, model)).toMatch(/1.234/);
  });

  it('formatNumber with precision', () => {
    expect(executeFunction('formatNumber', { value: 1234.5, precision: 2 }, model)).toBe('1234.50');
  });

  it('formatCurrency formats as USD by default', () => {
    const result = executeFunction('formatCurrency', { value: 9.99 }, model) as string;
    expect(result).toContain('9.99');
  });

  it('formatDate returns a date string', () => {
    const result = executeFunction('formatDate', { value: '2026-04-09' }, model);
    expect(typeof result).toBe('string');
    expect(result).toBeTruthy();
  });

  it('pluralize singular', () => {
    expect(executeFunction('pluralize', { count: 1, singular: 'item', plural: 'items' }, model)).toBe('item');
  });

  it('pluralize plural', () => {
    expect(executeFunction('pluralize', { count: 3, singular: 'item', plural: 'items' }, model)).toBe('items');
  });

  // --- Logic functions ---
  it('and returns true when all truthy (object args)', () => {
    expect(executeFunction('and', { a: true, b: true }, model)).toBe(true);
  });

  it('and returns false when any falsy (object args)', () => {
    expect(executeFunction('and', { a: true, b: false }, model)).toBe(false);
  });

  it('and returns true for values array all truthy', () => {
    expect(executeFunction('and', { values: [true, true, true] }, model)).toBe(true);
  });

  it('and returns false for values array with falsy', () => {
    expect(executeFunction('and', { values: [true, false, true] }, model)).toBe(false);
  });

  it('or returns true when any truthy', () => {
    expect(executeFunction('or', { a: false, b: true }, model)).toBe(true);
  });

  it('or returns true for values array with any truthy', () => {
    expect(executeFunction('or', { values: [false, true, false] }, model)).toBe(true);
  });

  it('or returns false for values array all falsy', () => {
    expect(executeFunction('or', { values: [false, false] }, model)).toBe(false);
  });

  it('not inverts boolean', () => {
    expect(executeFunction('not', { value: true }, model)).toBe(false);
  });

  // --- Navigation ---
  it('openUrl returns null (no window in test)', () => {
    expect(executeFunction('openUrl', { url: 'https://example.com' }, model)).toBeNull();
  });

  // --- Unknown ---
  it('returns null for unknown function', () => {
    expect(executeFunction('unknownFn', {}, model)).toBeNull();
  });
});
