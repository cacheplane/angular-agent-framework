// scripts/rate-limit.spec.ts
// SPDX-License-Identifier: MIT
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.fn();
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => sqlMock),
}));

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.resetModules();
    sqlMock.mockReset();
  });

  it('returns allowed=true and skips network when DATABASE_URL is unset', async () => {
    delete process.env['DATABASE_URL'];
    const { checkRateLimit } = await import('./rate-limit');
    const result = await checkRateLimit('1.2.3.4');
    expect(result).toEqual({ allowed: true, retryAfterSec: 0, count: 0 });
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('returns allowed=true when count is below the limit', async () => {
    process.env['DATABASE_URL'] = 'postgres://test';
    process.env['RATE_LIMIT_MESSAGES_PER_MIN'] = '10';
    sqlMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ c: 5 }]);
    const { checkRateLimit } = await import('./rate-limit');
    const result = await checkRateLimit('1.2.3.4');
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(5);
  });

  it('returns allowed=true at exactly the limit (boundary)', async () => {
    process.env['DATABASE_URL'] = 'postgres://test';
    process.env['RATE_LIMIT_MESSAGES_PER_MIN'] = '10';
    sqlMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ c: 10 }]);
    const { checkRateLimit } = await import('./rate-limit');
    const result = await checkRateLimit('1.2.3.4');
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(10);
  });

  it('returns allowed=false with retryAfterSec=60 when over the limit', async () => {
    process.env['DATABASE_URL'] = 'postgres://test';
    process.env['RATE_LIMIT_MESSAGES_PER_MIN'] = '10';
    sqlMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ c: 11 }]);
    const { checkRateLimit } = await import('./rate-limit');
    const result = await checkRateLimit('1.2.3.4');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBe(60);
    expect(result.count).toBe(11);
  });

  it('fails open when SQL throws', async () => {
    process.env['DATABASE_URL'] = 'postgres://test';
    sqlMock.mockRejectedValueOnce(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { checkRateLimit } = await import('./rate-limit');
    const result = await checkRateLimit('1.2.3.4');
    expect(result.allowed).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
