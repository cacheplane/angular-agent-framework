// scripts/rate-limit.ts
// SPDX-License-Identifier: MIT
/**
 * Per-IP sliding-window rate limit backed by Neon Postgres.
 *
 * Each call runs three statements in sequence:
 *   1. DELETE expired rows for the IP
 *   2. INSERT this request
 *   3. SELECT count of rows still in the 60-second window
 *
 * The DELETE bounds per-IP row count, so the table self-prunes —
 * no cron, no extension required.
 *
 * Fail-open: if DATABASE_URL is unset at module load, or any SQL
 * call throws at runtime, returns { allowed: true } and logs once.
 *
 * Bundled into the canonical-demo Vercel function by
 * scripts/assemble-demo.ts (via esbuild). Used by
 * scripts/langgraph-proxy.ts on the message-creation endpoint only.
 */
import { neon } from '@neondatabase/serverless';

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSec: number;
  readonly count: number;
}

const DEFAULT_LIMIT = 10;
const WINDOW_SECONDS = 60;

const databaseUrl = process.env['DATABASE_URL'];
const limit = (() => {
  const raw = process.env['RATE_LIMIT_MESSAGES_PER_MIN'];
  const parsed = raw ? Number(raw) : DEFAULT_LIMIT;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT;
})();

const sql = databaseUrl ? neon(databaseUrl) : null;

if (!databaseUrl) {
  console.warn('[rate-limit] DATABASE_URL not set; rate limiting disabled');
}

const ALLOW_PASSTHROUGH: RateLimitResult = { allowed: true, retryAfterSec: 0, count: 0 };

// Pre-built `interval` literal. Splicing WINDOW_SECONDS via the tagged-template
// parameter machinery would emit `interval '$1 seconds'`, which Postgres rejects
// (parameters can't substitute inside string literals). The constant is hardcoded
// at module load instead.
const WINDOW_INTERVAL = `${WINDOW_SECONDS} seconds`;

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (!sql) return ALLOW_PASSTHROUGH;
  try {
    await sql`DELETE FROM rate_limit_events WHERE ip = ${ip} AND ts < now() - ${WINDOW_INTERVAL}::interval`;
    await sql`INSERT INTO rate_limit_events (ip, ts) VALUES (${ip}, now())`;
    const rows = await sql`SELECT count(*)::int AS c FROM rate_limit_events WHERE ip = ${ip} AND ts > now() - ${WINDOW_INTERVAL}::interval`;
    const count = (rows[0] as { c?: number } | undefined)?.c ?? 0;
    return {
      allowed: count <= limit,
      retryAfterSec: WINDOW_SECONDS,
      count,
    };
  } catch (err) {
    console.warn('[rate-limit] check failed, failing open:', (err as Error).message);
    return ALLOW_PASSTHROUGH;
  }
}
