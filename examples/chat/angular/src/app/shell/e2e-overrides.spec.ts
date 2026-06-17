// SPDX-License-Identifier: MIT
import { describe, it, expect, afterEach } from 'vitest';
import { e2eClientOptions } from './e2e-overrides';

const KEY = 'THREADPLANE_E2E_MAX_RETRIES';

describe('e2eClientOptions', () => {
  afterEach(() => localStorage.removeItem(KEY));

  it('returns undefined when the flag is absent (production default preserved)', () => {
    expect(e2eClientOptions()).toBeUndefined();
  });

  it('maps "0" to { maxRetries: 0 } (fail-fast under test)', () => {
    localStorage.setItem(KEY, '0');
    expect(e2eClientOptions()).toEqual({ maxRetries: 0 });
  });

  it('maps a positive integer string to that retry budget', () => {
    localStorage.setItem(KEY, '3');
    expect(e2eClientOptions()).toEqual({ maxRetries: 3 });
  });

  it('ignores non-integer / negative / garbage values', () => {
    for (const bad of ['', 'abc', '-1', '1.5', 'NaN']) {
      localStorage.setItem(KEY, bad);
      expect(e2eClientOptions()).toBeUndefined();
    }
  });
});
