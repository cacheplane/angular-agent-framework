// SPDX-License-Identifier: MIT
import { describe, expect, test } from 'vitest';
import { isPathRef, isLiteralString, isLiteralNumber, isLiteralBoolean } from './guards';

describe('a2ui v1 guards', () => {
  test('isPathRef', () => {
    expect(isPathRef({ path: '/x' })).toBe(true);
    expect(isPathRef({ literalString: 'x' })).toBe(false);
    expect(isPathRef(null)).toBe(false);
    expect(isPathRef('string')).toBe(false);
    expect(isPathRef(42)).toBe(false);
  });

  test('isLiteralString', () => {
    expect(isLiteralString({ literalString: 'x' })).toBe(true);
    expect(isLiteralString({ path: '/x' })).toBe(false);
    expect(isLiteralString(null)).toBe(false);
    expect(isLiteralString('x')).toBe(false);
  });

  test('isLiteralNumber', () => {
    expect(isLiteralNumber({ literalNumber: 7 })).toBe(true);
    expect(isLiteralNumber({ path: '/n' })).toBe(false);
    expect(isLiteralNumber(null)).toBe(false);
  });

  test('isLiteralBoolean', () => {
    expect(isLiteralBoolean({ literalBoolean: true })).toBe(true);
    expect(isLiteralBoolean({ literalBoolean: false })).toBe(true);
    expect(isLiteralBoolean({ path: '/b' })).toBe(false);
    expect(isLiteralBoolean(null)).toBe(false);
  });
});
