# Phase 3 — Per-IP Rate Limiting on Canonical Demo Proxy — Design

**Status:** Approved
**Date:** 2026-05-13
**Goal:** Cap anonymous OpenAI spend on `demo.cacheplane.ai` by limiting how many message-creation requests a single IP can fire per minute through the proxy.

## Why now

The canonical demo (deployed in Phase 2) accepts anonymous requests and forwards them to the shared `cockpit-dev` LangGraph Cloud assistant, which calls OpenAI on every chat message. Without protection, a scraper or runaway script could drain the team's OpenAI budget in minutes. This phase adds the minimum sufficient rate limit to make the demo safe to link from marketing (Phase 5).

## Decisions Locked

| Decision | Choice |
|---|---|
| Scope of rate limit | Only `POST /api/threads/*/runs/stream` (the message-creation path that costs OpenAI tokens) |
| Default limit | 10 messages per minute per IP, configurable via `RATE_LIMIT_MESSAGES_PER_MIN` env var |
| Failure mode | Fail-open — log warning if Postgres unreachable, allow the request through |
| Storage backend | Neon Postgres (already provisioned for this team via Vercel integration) — not Upstash |
| Cleanup strategy | Inline DELETE+INSERT+COUNT per request — self-pruning, no cron, no extension |
| Window algorithm | Sliding window via timestamp filter — 60-second rolling window |
| IP source | `x-forwarded-for` first hop → `x-real-ip` → synthetic `unknown:*` fallback |
| Scope of deployment | `cacheplane-demo` Vercel project only; cockpit-examples stays unrate-limited |

## Why Neon over Upstash

We have both available. Trade-offs:

| | Neon Postgres | Upstash Redis |
|---|---|---|
| Already provisioned | ✅ Yes (Vercel integration `cacheplane`) | ❌ Would add new vendor |
| Latency per check | ~50–150ms cold, ~20ms warm | ~5–10ms |
| Library | `@neondatabase/serverless` (HTTP), 3 lines | `@upstash/ratelimit` (drop-in) |
| TTL semantics | Inline DELETE keeps table bounded | Built-in `EXPIRE` |
| Operational overhead | One vendor | Two |

Latency cost is invisible relative to the 3-second AI streaming response we're gating. Avoiding a second vendor is worth the ~40 extra lines for the inline-cleanup helper. The free Neon tier is generous (5GB storage); our worst-case usage is bounded by `active_ips × rate_limit` ≈ a few hundred rows steady-state.

## Architecture

All work lands in three places:

1. **`scripts/langgraph-proxy.ts`** — add a `checkRateLimit(req)` step before the API-key injection + fetch. Returns `{ allowed, retryAfterSec }`. Skipped unless `method === 'POST'` and pathname matches `/^\/api\/threads\/[^/]+\/runs\/stream$/`. On 429, return `Retry-After` header + JSON body.

2. **`scripts/rate-limit.ts`** (new) — thin module exposing `checkRateLimit(ip: string): Promise<{ allowed: boolean; retryAfterSec: number; count: number }>`. Uses `@neondatabase/serverless`'s `neon(connectionString)` HTTP driver. Returns `{ allowed: true }` on any error (fail-open). Reads `DATABASE_URL` and `RATE_LIMIT_MESSAGES_PER_MIN` from env. If `DATABASE_URL` is missing at module load, logs once and returns a no-op handler.

3. **Migration `migrations/0001_rate_limit_events.sql`** (new) — creates the `rate_limit_events` table on Neon. Single statement.

## Configuration surface

Vercel env vars on `cacheplane-demo` (already provisioned during Phase 2 setup):

| Env var | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Neon Postgres connection (HTTP-compatible) | required for rate-limiting; missing = disabled |
| `RATE_LIMIT_MESSAGES_PER_MIN` | Tunable cap | `10` |

`LANGSMITH_API_KEY` etc. unchanged.

## Schema

```sql
CREATE TABLE IF NOT EXISTS rate_limit_events (
  ip   TEXT        NOT NULL,
  ts   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_ip_ts
  ON rate_limit_events (ip, ts DESC);
```

The composite index on `(ip, ts DESC)` lets both the DELETE and the COUNT use the same index efficiently.

## The check (TypeScript)

```ts
// scripts/rate-limit.ts (sketch — full code lives in the implementation plan)
import { neon } from '@neondatabase/serverless';

const url = process.env['DATABASE_URL'];
const sql = url ? neon(url) : null;
const limit = Number(process.env['RATE_LIMIT_MESSAGES_PER_MIN'] ?? '10');

if (!url) console.warn('[rate-limit] DATABASE_URL not set; rate limiting disabled');

export async function checkRateLimit(ip: string): Promise<{
  allowed: boolean;
  retryAfterSec: number;
  count: number;
}> {
  if (!sql) return { allowed: true, retryAfterSec: 0, count: 0 };
  try {
    await sql`DELETE FROM rate_limit_events WHERE ip = ${ip} AND ts < now() - interval '60 seconds'`;
    await sql`INSERT INTO rate_limit_events (ip, ts) VALUES (${ip}, now())`;
    const rows = await sql`SELECT count(*)::int AS c FROM rate_limit_events WHERE ip = ${ip}`;
    const count = rows[0].c;
    return {
      allowed: count <= limit,
      retryAfterSec: 60,
      count,
    };
  } catch (err) {
    console.warn('[rate-limit] check failed, failing open:', (err as Error).message);
    return { allowed: true, retryAfterSec: 0, count: 0 };
  }
}
```

Three queries per gated request — bounded growth, no cron, no race-condition concerns within the 60-second window (each IP's events grow until they age out).

## Wiring into `langgraph-proxy.ts`

A small block inserted between the API-key check and the `fetch()` call:

```ts
// Gate: only POST /api/threads/*/runs/stream is rate-limited.
const isGated =
  req.method === 'POST' &&
  /^\/api\/threads\/[^/]+\/runs\/stream$/.test(parsedUrl.pathname);

if (isGated) {
  const ip = extractIp(req.headers);
  const { allowed, retryAfterSec } = await checkRateLimit(ip);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      error: 'rate_limit_exceeded',
      retryAfterSec,
      message: `Demo is rate-limited to ${limit} messages per minute per IP.`,
    });
    return;
  }
}
```

`extractIp` reads `x-forwarded-for` first hop, falls back to `x-real-ip`, then `unknown:${randomId}`.

## Error handling

| Failure | Behavior |
|---|---|
| `DATABASE_URL` missing at module init | Log once. `checkRateLimit` returns `{ allowed: true }` always. Pass-through. |
| Postgres query throws mid-request | Catch, log warning, return `{ allowed: true }`. Pass-through. |
| Rate limit exceeded | 429 with `Retry-After: 60` + JSON body. |
| Method/path doesn't match streaming endpoint | Skip check entirely. Pass-through. |
| `RATE_LIMIT_MESSAGES_PER_MIN` non-numeric | Parse fails → `NaN`. Default to 10 via `Number(...) || 10`. |

## Data flow

```
1. POST /api/threads/{id}/runs/stream arrives at the proxy.
2. Proxy CORS preflight (OPTIONS handled separately).
3. Proxy reads LANGSMITH_API_KEY from env. (Missing → 500.)
4. Proxy decides: method = POST? path matches /api/threads/.../runs/stream? → gated.
5. extractIp(req) → "203.0.113.5"
6. checkRateLimit("203.0.113.5")
   a. DELETE old events for this IP (> 60s ago)
   b. INSERT new event row
   c. SELECT count(*) for this IP within window
   d. allowed = (count <= 10)
7a. If allowed: proceed to fetch() against cockpit-dev. Stream response back. ✅
7b. If !allowed: 429 with Retry-After. ❌
```

## Testing

### Unit tests in `scripts/rate-limit.spec.ts` (new)

1. **No DATABASE_URL → returns allowed=true always.** Skip the network entirely. Mock `neon` is never called.
2. **First request below limit → allowed=true.** Mock `sql` returns count=1.
3. **Request at-limit → still allowed=true.** count=10, limit=10, allowed=true (the boundary).
4. **Request over limit → allowed=false with retryAfterSec=60.** count=11, allowed=false.
5. **SQL throws → fail-open.** Mock `sql` rejects. Returns allowed=true, logs warning.

### Unit tests in `scripts/langgraph-proxy.spec.ts` (extend)

6. **Non-gated request bypasses rate limit.** GET /api/info, POST /api/threads (no `/runs/stream`), etc. Spy on `checkRateLimit` — never called.
7. **Gated request, allowed → proceeds to fetch.** Mock `checkRateLimit` returns allowed=true. Spy on `fetch` — called once.
8. **Gated request, denied → 429 with Retry-After.** Mock returns allowed=false. Spy on `fetch` — NEVER called. Response has 429 + Retry-After header + JSON body with `error: 'rate_limit_exceeded'`.

### Manual (post-deploy)

```bash
THREAD=$(curl -s -X POST https://demo.cacheplane.ai/api/threads \
  -H 'content-type: application/json' -d '{}' | jq -r .thread_id)

for i in {1..12}; do
  curl -s -o /dev/null -w "Request $i: HTTP %{http_code}\n" \
    -X POST "https://demo.cacheplane.ai/api/threads/$THREAD/runs/stream" \
    -H 'content-type: application/json' \
    -d '{"assistant_id":"chat","input":{"messages":[{"role":"human","content":"hi"}]},"stream_mode":["values"]}' \
    --max-time 5
done
```

Expected: requests 1–10 = 200 (stream successful), 11–12 = 429.

## Components touched

| File | Change |
|---|---|
| `scripts/rate-limit.ts` | NEW — `checkRateLimit(ip)` helper using `@neondatabase/serverless` |
| `scripts/rate-limit.spec.ts` | NEW — 5 unit tests |
| `scripts/langgraph-proxy.ts` | Add gating block between API-key check and fetch. Add `extractIp(headers)` helper. |
| `scripts/langgraph-proxy.spec.ts` | Add 3 new tests covering the gating block |
| `package.json` (root) | Add `@neondatabase/serverless` runtime dep |
| `migrations/0001_rate_limit_events.sql` | NEW — table + index DDL |
| Vercel `cacheplane-demo` env (external) | Add `DATABASE_URL` from the Neon integration + optionally `RATE_LIMIT_MESSAGES_PER_MIN` |

## External setup

These run via Vercel API in the implementation step:

1. Find or create the Neon database via the existing `cacheplane` integration.
2. Pull the connection string (Neon exposes it as `DATABASE_URL`).
3. Apply the migration once (`psql $DATABASE_URL -f migrations/0001_rate_limit_events.sql`).
4. Set `DATABASE_URL` on the `cacheplane-demo` Vercel project (production + preview).

## Out of scope

- Per-user (vs per-IP) limiting — no auth, no users.
- Daily / per-IP budget caps — Phase 4 candidate if needed.
- Rate-limiting on cockpit-examples — separate decision.
- Rate-limit analytics dashboard — `console.warn` is enough for V1.
- Token-bucket / leaky-bucket / burst allowances — sliding window is the right default.

## References

- `scripts/langgraph-proxy.ts` — existing proxy module from Phase 2 (refactored from `examples-middleware.ts`)
- `@neondatabase/serverless` — Neon's HTTP-fetch-based driver, ideal for Vercel serverless functions
- Vercel team integration `cacheplane` (configuration includes Neon as a provider)
