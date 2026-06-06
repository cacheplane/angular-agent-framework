// scripts/upstash-rate-limit.ts
// SPDX-License-Identifier: MIT
/**
 * Per-IP token-bucket rate limit backed by Upstash Redis, shaped to the
 * createProxyHandler `checkRateLimit` contract. Sibling to the Neon-backed
 * scripts/rate-limit.ts — same interface, different backend. Used by the
 * threadplane-examples langgraph proxy; the ag-ui proxy on the same project
 * uses the same Upstash creds.
 *
 * Fail-open: if UPSTASH_* env is unset at module load, or the limit call
 * throws, returns { allowed: true } so a misconfigured deploy never bricks
 * the runtime. Bundled into the examples Vercel function by esbuild.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSec: number;
  readonly count: number;
}

const WINDOW_SECONDS = 60;
const ALLOW_PASSTHROUGH: RateLimitResult = { allowed: true, retryAfterSec: 0, count: 0 };

let limiter: Ratelimit | null = null;
function getLimiter(): Ratelimit | null {
  if (limiter) return limiter;
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) {
    console.warn('[upstash-rate-limit] UPSTASH_* not set; rate limiting disabled');
    return null;
  }
  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.tokenBucket(10, `${WINDOW_SECONDS} s`, 10),
    analytics: false,
    prefix: 'examples-langgraph',
  });
  return limiter;
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const rl = getLimiter();
  if (!rl) return ALLOW_PASSTHROUGH;
  try {
    const v = await rl.limit(ip);
    return { allowed: v.success, retryAfterSec: WINDOW_SECONDS, count: v.limit - v.remaining };
  } catch (err) {
    console.warn('[upstash-rate-limit] check failed, failing open:', (err as Error).message);
    return ALLOW_PASSTHROUGH;
  }
}
