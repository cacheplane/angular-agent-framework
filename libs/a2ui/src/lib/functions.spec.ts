// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { executeFunction } from './functions';

const model = { name: 'Alice', price: 1234.5, date: '2026-04-09', count: 1 };

describe('executeFunction', () => {
  it('formatNumber with grouping', () => {
    expect(executeFunction('formatNumber', { value: 1234, grouping: true }, model)).toMatch(/1.234/);
  });

  it('formatNumber with precision', () => {
    expect(executeFunction('formatNumber', { value: 1234.5, precision: 2 }, model)).toBe('1234.50');
  });

  it('pluralize singular', () => {
    expect(executeFunction('pluralize', { count: 1, singular: 'item', plural: 'items' }, model)).toBe('item');
  });

  it('pluralize plural', () => {
    expect(executeFunction('pluralize', { count: 3, singular: 'item', plural: 'items' }, model)).toBe('items');
  });

  it('and returns true when all truthy', () => {
    expect(executeFunction('and', { a: true, b: true }, model)).toBe(true);
  });

  it('and returns false when any falsy', () => {
    expect(executeFunction('and', { a: true, b: false }, model)).toBe(false);
  });

  it('or returns true when any truthy', () => {
    expect(executeFunction('or', { a: false, b: true }, model)).toBe(true);
  });

  it('not inverts boolean', () => {
    expect(executeFunction('not', { value: true }, model)).toBe(false);
  });

  it('returns null for unknown function', () => {
    expect(executeFunction('unknownFn', {}, model)).toBeNull();
  });
});
