// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { isPathRef, isFunctionCall } from './guards';

describe('isPathRef', () => {
  it('returns true for a path reference object', () => {
    expect(isPathRef({ path: '/name' })).toBe(true);
  });

  it('returns false for a function call (has call property)', () => {
    expect(isPathRef({ path: '/name', call: 'format', args: {} })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPathRef(null)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isPathRef('hello')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isPathRef(42)).toBe(false);
  });
});

describe('isFunctionCall', () => {
  it('returns true for a function call object', () => {
    expect(isFunctionCall({ call: 'format', args: { value: 1 } })).toBe(true);
  });

  it('returns false for a path reference', () => {
    expect(isFunctionCall({ path: '/name' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFunctionCall(null)).toBe(false);
  });
});
