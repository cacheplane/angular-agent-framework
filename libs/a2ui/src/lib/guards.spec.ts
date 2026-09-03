import { describe, expect, test } from 'vitest';
import { isPathRef, isFunctionCall } from './guards';

describe('a2ui v0.9 guards', () => {
  test('isPathRef', () => {
    expect(isPathRef({ path: '/x' })).toBe(true);
    expect(isPathRef({ call: 'formatString' })).toBe(false);
    expect(isPathRef(null)).toBe(false);
    expect(isPathRef('string')).toBe(false);
    expect(isPathRef(42)).toBe(false);
  });

  test('isFunctionCall', () => {
    expect(isFunctionCall({ call: 'formatDate' })).toBe(true);
    expect(isFunctionCall({ call: 'required', args: { value: { path: '/x' } } })).toBe(true);
    expect(isFunctionCall({ path: '/x' })).toBe(false);
    expect(isFunctionCall(null)).toBe(false);
    expect(isFunctionCall('formatDate')).toBe(false);
    expect(isFunctionCall({ call: 42 })).toBe(false);
  });
});
