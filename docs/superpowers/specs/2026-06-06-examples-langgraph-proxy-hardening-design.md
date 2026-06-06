# Examples LangGraph Proxy Hardening — Design

**Status:** Draft
**Date:** 2026-06-06
**Owner:** Brian Love

## Problem

The `threadplane-examples` Vercel deployment serves every cockpit Run-tab example. Its LangGraph proxy (`scripts/examples-middleware.ts`) forwards `/api/...` traffic to the shared LangGraph Cloud deployment (`cockpit-dev`) with `LANGSMITH_API_KEY` injected server-side. That proxy currently has **no defense-in-depth**: no origin allowlist, no rate limit, no body-size cap. It relies solely on LangSmith's server-side billing limits.

Two sibling proxies already have hardening:
- `scripts/demo-middleware.ts` (demo.threadplane.ai): origin allowlist + Neon-backed rate limit + body cap, all env-gated.
- `scripts/ag-ui-proxy.ts` (examples, ag-ui topics): origin allowlist + Upstash rate limit + `X-Internal-Token` injection, hardcoded.

This brings the examples LangGraph proxy up to the same posture, reusing machinery that already exists.

## Goals

- Add origin allowlist, per-IP rate limit, and body-size cap to the examples LangGraph proxy.
- Reuse the existing `createProxyHandler` config surface (the factory already supports all three) — change zero factory code.
- Keep the `threadplane-examples` Vercel project on a single rate-limit backend (Upstash, already provisioned for the ag-ui proxy) and a single config style (hardcoded constants).
- Fix the latent CI gap where edits to the examples proxy source don't trigger a redeploy.

## Non-Goals

- Migrating the demo proxy from Neon to Upstash (it works; leave it).
- Any change to the `createProxyHandler` factory in `scripts/langgraph-proxy.ts`.
- Env-gated/tunable configuration (deliberately hardcoded — see Decisions).

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Rate-limit backend | **Upstash** | The examples project already has `UPSTASH_REDIS_REST_URL/TOKEN` (added for ag-ui). Keeps both examples proxies on one backend; no new env var; no Neon on this project. |
| Config style | **Hardcoded** | Matches the adjacent `ag-ui-proxy.ts`. Effective values stay visible in the repo. |
| Body cap | **64 KB** | The cap applies to ALL proxied requests (413 if exceeded). Multi-turn cockpit threads carry accumulated messages + state snapshots — far larger than the demo's 8 KB single-chat payloads. 64 KB clears legitimate traffic while still blocking giant-prompt abuse. |

## Design

### Architecture

All LLM-proxying surfaces flow through `createProxyHandler` (`scripts/langgraph-proxy.ts`), which already accepts `allowedOrigins`, `checkRateLimit`, and `maxBodyBytes`. The demo and examples-langgraph proxies share it directly; the ag-ui proxy is a separate function mirroring the same defense order. This change only turns on config that already exists — no factory edits.

Enforcement points in the factory (verified):
- **Origin:** when `allowedOrigins` is set, a request with a non-allowlisted `Origin` header → 403. A request with **no** `Origin` header (server-to-server) is allowed through. Same-origin browser POSTs (the cockpit Run-tab iframe is served from `examples.threadplane.ai`, so its example apps' API POSTs carry `Origin: https://examples.threadplane.ai`) pass.
- **Body cap:** checked on every request via `Content-Length` (falls back to `JSON.stringify(body).length`); over the cap → 413 `payload_too_large`.
- **Rate limit:** only on `POST /threads/{id}/runs/stream` (the path that burns LLM tokens); over the limit → 429 with `Retry-After`. Non-stream GETs (thread history, etc.) are not throttled.

### Components & files

**New — `scripts/upstash-rate-limit.ts`**

Exports `checkRateLimit(ip): Promise<RateLimitResult>` matching the factory contract `{ allowed, retryAfterSec, count }`. Sibling to the Neon-backed `scripts/rate-limit.ts` — same interface, different backend.

```ts
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
```

The `prefix: 'examples-langgraph'` keys these buckets separately from the ag-ui proxy's `ag-ui-dev:*` keys in the same Upstash DB — no cross-bleed.

**Modified — `scripts/examples-middleware.ts`**

Only the handler-export call changes; `SHARED_DEPLOYMENT_URL`, `ACTIVE_PRODUCT_PATHS`, `resolveBackend` are untouched.

```ts
import { createProxyHandler } from './langgraph-proxy';
import { checkRateLimit } from './upstash-rate-limit';

const ALLOWED_ORIGINS = [
  'https://examples.threadplane.ai',
  'https://cockpit.threadplane.ai',
  'http://localhost:4320',
  'http://localhost:4321',
] as const;

// ... existing resolveBackend / SHARED_DEPLOYMENT_URL / ACTIVE_PRODUCT_PATHS unchanged ...

module.exports = createProxyHandler({
  resolveBackend,
  backendUrl: SHARED_DEPLOYMENT_URL,
  allowedOrigins: ALLOWED_ORIGINS,
  maxBodyBytes: 65536,
  checkRateLimit,
});
```

**Modified — `.github/workflows/ci.yml`** (`examples_changed` step)

Extend the source-watch glob so proxy edits redeploy examples (closes a pre-existing gap):

```bash
if printf '%s\n' "$changed_files" | grep -E '^(vercel\.examples\.json|scripts/(assemble-examples|examples-middleware|langgraph-proxy|upstash-rate-limit)\.ts)$' >/dev/null; then
  examples_changed=true
fi
```

**No change to `scripts/assemble-examples.ts`** — it already esbuild-bundles `examples-middleware.ts`, which transitively pulls in the new module + `@upstash/*` (already in root deps from the ag-ui work).

### Testing

- **Unit** — `scripts/upstash-rate-limit.spec.ts` (vitest): with `UPSTASH_*` unset, `checkRateLimit('1.2.3.4')` returns `{ allowed: true, retryAfterSec: 0, count: 0 }` (fail-open) and the result conforms to `RateLimitResult`. Live Upstash limiting is not unit-tested (needs real Redis) — same stance as `rate-limit.ts` and `ag-ui-proxy.ts`.
- **Bundle check** — `npx esbuild scripts/examples-middleware.ts --bundle --format=cjs --platform=node --outfile=/tmp/x.js` succeeds.

### Validation (post-merge, against examples.threadplane.ai)

- A langgraph example runs end-to-end through the cockpit Run tab (Origin `examples.threadplane.ai` passes) — e.g. `langgraph/streaming`.
- `POST /langgraph/streaming/api/threads/<id>/runs/stream` with a forbidden Origin → 403.
- >10 stream-runs/min from one IP → 429.
- Body >64 KB → 413.
- Non-stream GET (thread history) is not rate-limited → confirms no over-throttling.

## Risks

- **Origin allowlist false-negative.** If a legitimate consumer hits the proxy with an unexpected `Origin`, it gets 403. Mitigations: the iframe Run-tab path is same-origin (verified), and no-Origin server-to-server calls are allowed through. If a missed consumer surfaces, add its origin to the hardcoded list (code + redeploy).
- **Body cap too tight.** 64 KB is a generous estimate. If a real multi-turn thread exceeds it (413), raise the constant. Cheap to adjust.
- **Shared Upstash free-tier quota.** Both examples proxies now share the one Upstash DB. Demo traffic is low; the free tier (10K cmds/day) is ample. Distinct key prefixes prevent bucket collisions.

## Files Touched

**New:**
- `scripts/upstash-rate-limit.ts`
- `scripts/upstash-rate-limit.spec.ts`

**Modified:**
- `scripts/examples-middleware.ts`
- `.github/workflows/ci.yml`
