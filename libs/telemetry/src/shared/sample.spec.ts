import { describe, test, expect } from 'vitest';
import { shouldSample } from './sample';

describe('shouldSample', () => {
  test('rate=1.0 always samples', () => {
    expect(shouldSample(1.0, 'anon_x')).toBe(true);
    expect(shouldSample(1.0, 'anon_y')).toBe(true);
  });

  test('rate=0 never samples', () => {
    expect(shouldSample(0, 'anon_x')).toBe(false);
  });

  test('deterministic for a given (rate, id) pair', () => {
    const a = shouldSample(0.5, 'anon_x');
    const b = shouldSample(0.5, 'anon_x');
    expect(a).toBe(b);
  });

  test('rate clamps to [0, 1]', () => {
    expect(shouldSample(1.5, 'anon_x')).toBe(true);
    expect(shouldSample(-1, 'anon_x')).toBe(false);
  });

  test('different ids can produce different results at rate=0.5', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `anon_${i}`);
    const sampled = ids.filter((id) => shouldSample(0.5, id)).length;
    expect(sampled).toBeGreaterThan(20);
    expect(sampled).toBeLessThan(80);
  });
});
