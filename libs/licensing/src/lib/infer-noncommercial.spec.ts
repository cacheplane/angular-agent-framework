// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { inferNoncommercial } from './infer-noncommercial.js';

describe('inferNoncommercial', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  let originalProcess: unknown;

  beforeEach(() => {
    originalProcess = g['process'];
  });

  afterEach(() => {
    if (typeof originalProcess === 'undefined') {
      delete g['process'];
    } else {
      g['process'] = originalProcess;
    }
  });

  it('returns false when process is undefined (browser-like)', () => {
    delete g['process'];
    expect(inferNoncommercial()).toBe(false);
  });

  it('returns false when NODE_ENV is "production"', () => {
    g['process'] = { env: { NODE_ENV: 'production' } };
    expect(inferNoncommercial()).toBe(false);
  });

  it('returns true when NODE_ENV is "development"', () => {
    g['process'] = { env: { NODE_ENV: 'development' } };
    expect(inferNoncommercial()).toBe(true);
  });

  it('returns true when NODE_ENV is unset', () => {
    g['process'] = { env: {} };
    expect(inferNoncommercial()).toBe(true);
  });
});
