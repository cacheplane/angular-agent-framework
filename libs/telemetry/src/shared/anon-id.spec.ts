import { describe, test, expect, beforeEach } from 'vitest';
import { getAnonId, _resetAnonIdForTesting } from './anon-id';

describe('getAnonId', () => {
  beforeEach(() => _resetAnonIdForTesting());

  test('returns a stable id within a process', () => {
    const a = getAnonId();
    const b = getAnonId();
    expect(a).toBe(b);
  });

  test('matches anon_<uuid> shape', () => {
    expect(getAnonId()).toMatch(/^anon_[0-9a-f-]{36}$/);
  });

  test('different processes get different ids (simulated via reset)', () => {
    const a = getAnonId();
    _resetAnonIdForTesting();
    const b = getAnonId();
    expect(a).not.toBe(b);
  });
});
