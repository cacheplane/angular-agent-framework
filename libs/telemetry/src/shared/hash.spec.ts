import { describe, test, expect } from 'vitest';
import { sha256 } from './hash';

describe('sha256', () => {
  test('returns a 64-char hex digest', async () => {
    const out = await sha256('hello');
    expect(out).toMatch(/^[a-f0-9]{64}$/);
  });

  test('is deterministic', async () => {
    const a = await sha256('same input');
    const b = await sha256('same input');
    expect(a).toBe(b);
  });

  test('differs for different inputs', async () => {
    const a = await sha256('foo');
    const b = await sha256('bar');
    expect(a).not.toBe(b);
  });
});
