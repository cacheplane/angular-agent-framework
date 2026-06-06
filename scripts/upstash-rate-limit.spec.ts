import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { checkRateLimit } from './upstash-rate-limit';

describe('upstash-rate-limit checkRateLimit', () => {
  const savedUrl = process.env['UPSTASH_REDIS_REST_URL'];
  const savedToken = process.env['UPSTASH_REDIS_REST_TOKEN'];

  beforeEach(() => {
    delete process.env['UPSTASH_REDIS_REST_URL'];
    delete process.env['UPSTASH_REDIS_REST_TOKEN'];
  });

  afterEach(() => {
    if (savedUrl === undefined) delete process.env['UPSTASH_REDIS_REST_URL'];
    else process.env['UPSTASH_REDIS_REST_URL'] = savedUrl;
    if (savedToken === undefined) delete process.env['UPSTASH_REDIS_REST_TOKEN'];
    else process.env['UPSTASH_REDIS_REST_TOKEN'] = savedToken;
  });

  it('fails open when UPSTASH env is unset', async () => {
    const result = await checkRateLimit('1.2.3.4');
    expect(result).toEqual({ allowed: true, retryAfterSec: 0, count: 0 });
  });

  it('returns a RateLimitResult-shaped object', async () => {
    const result = await checkRateLimit('5.6.7.8');
    expect(typeof result.allowed).toBe('boolean');
    expect(typeof result.retryAfterSec).toBe('number');
    expect(typeof result.count).toBe('number');
  });
});
