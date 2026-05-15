# Phase 4 — CORS Allowlist + Prompt-Length Cap — Design

**Status:** Approved
**Date:** 2026-05-15
**Goal:** Add the last two defensive gates on the canonical demo proxy before linking it from the marketing site in Phase 5. Tighten CORS from wildcard to a single-origin allowlist (`demo.cacheplane.ai` only); reject oversized request bodies (default 8 KB cap).

## Why now

Phases 1–3 made `demo.cacheplane.ai` reachable, safe-by-API-key-isolation, and rate-limited. Two attack surfaces remain:

- **CORS is currently `access-control-allow-origin: *`.** Any third-party page can drive requests through the demo's `/api/*` from a user's browser (with the proxy's injected `x-api-key`). Origin tightening prevents drive-by abuse from third-party sites.
- **Body size is unbounded.** A malicious POST can include a multi-megabyte `messages[*].content` payload. The rate limit caps the rate but not the per-request size — so 10 RPM × 5 MB each is still 50 MB/min of input tokens. The body cap fail-fasts before the upstream OpenAI call.

These are the last gates before Phase 5 (marketing rewire) drives real anonymous traffic.

## Decisions Locked

| Decision | Choice |
|---|---|
| CORS allowlist | Only `https://demo.cacheplane.ai`. Tunable via env (`ALLOWED_ORIGINS` comma-separated) |
| Body-size cap default | 8192 bytes (8 KB). Tunable via env (`MAX_PROMPT_BYTES`) |
| What gets measured | Full request body byte length (envelope is ~150 bytes, dominated by message content) |
| Scope of gates | Demo wrapper only — examples-middleware does not pass these config fields |
| Origin-absent (curl) behavior | Allow through with no CORS headers (CORS only matters in browser context) |
| Method-of-allowlist-config | Via `ProxyConfig` fields, not direct env reads in the shared module |
| Failure mode | 403 for blocked origin, 413 for oversized body — both BEFORE rate-limit + upstream |

## Architecture

Two small additions to `scripts/langgraph-proxy.ts`. Both fire before the existing rate-limit gate, so they're cost-free defenses (no Postgres, no OpenAI).

### CORS allowlist

The current code unconditionally sets `access-control-allow-origin: *` at the start of every request. Replace with a per-request decision:

1. Read `req.headers.origin`.
2. If `config.allowedOrigins` is not provided → preserve legacy `*` behavior (examples-middleware stays unchanged).
3. If provided and `Origin` header is absent → no CORS headers; continue handling (server-to-server clients don't care).
4. If provided and `Origin` matches an entry → echo the matched origin in `access-control-allow-origin`; set `vary: origin`; continue.
5. If provided and `Origin` doesn't match → return 403 with `{ error: 'origin_not_allowed' }`. No CORS headers (browser blocks anyway).

The match is exact-string equality (no wildcards, no protocol-stripping). The allowlist holds full origins like `https://demo.cacheplane.ai`.

### Body-size cap

Before the rate-limit check, before the upstream fetch:

1. If `config.maxBodyBytes` is not provided → skip the check (examples-middleware stays unchanged).
2. Read `req.headers['content-length']`. If present and a parseable number > `maxBodyBytes` → return 413 with `{ error: 'payload_too_large', maxBytes, actualBytes }`.
3. Otherwise, fall back to `JSON.stringify(req.body).length`. (Vercel's body parser produces an object; we never see the raw bytes here. The stringified size is a tight upper bound on the original bytes for most JSON.)
4. If that exceeds `maxBodyBytes` → 413 same as above.
5. Otherwise continue.

Why both checks: `Content-Length` is sent by browsers and curl, but a malformed client could omit it. Falling back to stringify ensures the cap is enforced regardless.

## ProxyConfig extension

```ts
export interface ProxyConfig {
  readonly backendUrl?: string;
  readonly resolveBackend?: (referer: string | undefined) => string;
  readonly checkRateLimit?: (ip: string) => Promise<{ allowed: boolean; retryAfterSec: number; count: number }>;
  /** Origins to allow via CORS. If undefined, legacy wildcard `*` behavior
   *  preserved (used by cockpit-examples). Each entry is a full origin
   *  string, e.g. `https://demo.cacheplane.ai`. Match is exact-string. */
  readonly allowedOrigins?: readonly string[];
  /** Maximum request body size in bytes. If undefined, no cap (legacy
   *  behavior). Checked against Content-Length first, falls back to
   *  JSON.stringify(req.body).length. */
  readonly maxBodyBytes?: number;
}
```

## Demo wrapper

`scripts/demo-middleware.ts` becomes:

```ts
import { createProxyHandler } from './langgraph-proxy';
import { checkRateLimit } from './rate-limit';

const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? 'https://demo.cacheplane.ai')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const maxBodyBytes = (() => {
  const raw = process.env['MAX_PROMPT_BYTES'];
  const parsed = raw ? Number(raw) : 8192;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8192;
})();

module.exports = createProxyHandler({
  checkRateLimit,
  allowedOrigins,
  maxBodyBytes,
});
```

If the env vars are absent, defaults are sensible — `demo.cacheplane.ai` and 8 KB.

`scripts/examples-middleware.ts` is unchanged. It doesn't pass `allowedOrigins` or `maxBodyBytes`, so behavior on `examples.cacheplane.ai` stays identical to today.

## Configuration

Vercel env vars on `cacheplane-demo` (controller sets via API):

| Env var | Value | Optional? |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://demo.cacheplane.ai` | Yes — defaults to this if unset |
| `MAX_PROMPT_BYTES` | `8192` | Yes — defaults to 8192 if unset |

We're going to set both even though they match the defaults, so the values are visible in the Vercel dashboard and tunable without a deploy.

## Data flow

```
Request arrives at the Vercel function
  ↓
1. Read req.headers.origin
   - If config.allowedOrigins absent → legacy * behavior (skip steps 2-3)
   - If Origin absent → no CORS headers, continue
   - If Origin matches allowlist → echo, set vary: origin, continue
   - If Origin present, no match → 403, return
  ↓
2. If method === OPTIONS → 204 (CORS preflight handled)
  ↓
3. Check API key (existing). 500 if missing.
  ↓
4. Compute apiPath (strip /api).
  ↓
5. If apiPath === /_proxy_debug → return debug JSON
  ↓
6. Body size check (NEW)
   - If config.maxBodyBytes absent → skip
   - Else: check Content-Length first, then JSON.stringify(req.body).length
   - If > cap → 413, return
  ↓
7. Rate-limit gate (existing, on POST /threads/*/runs/stream)
  ↓
8. Upstream fetch + stream response
```

## Error handling

| Failure | Behavior |
|---|---|
| Origin not in allowlist | 403 `{ error: 'origin_not_allowed' }`. No CORS headers. |
| Body > cap | 413 `{ error: 'payload_too_large', maxBytes, actualBytes }`. |
| Body parse fails | Unreachable — Vercel handler runtime parses body before the proxy sees it. The proxy receives `req.body` as a parsed object. If it's a Buffer or string (raw mode), `JSON.stringify` on a non-object returns the original; the check still works on the original byte length. |
| Content-Length present and `maxBodyBytes` unconfigured | No cap applied (legacy behavior). |
| Content-Length absent + body fits | Stringify fallback under the cap → pass. |
| Both checks pass but body parses to undefined | `JSON.stringify(undefined)` returns the string `"undefined"`. Length 9. Under any reasonable cap. Pass. |

## Testing

### Unit tests in `scripts/langgraph-proxy.spec.ts`

Append 6 tests:

1. **Origin matches allowlist → echoes back, request proceeds.** Set `allowedOrigins: ['https://demo.cacheplane.ai']`. Send Origin = matching. Expect `access-control-allow-origin` echoed, `vary: origin` header, request proceeds to fetch.
2. **Origin doesn't match → 403, fetch not called.** Send Origin = `https://malicious.example`. Expect 403 + `{ error: 'origin_not_allowed' }`.
3. **Origin absent (curl) → allowed, no CORS headers.** Same `allowedOrigins` config; omit Origin header. Expect request proceeds to fetch (no 403, no echoed origin).
4. **OPTIONS preflight with allowed Origin → 204 + echoed.** Expect 204, `access-control-allow-origin` = matched value.
5. **`allowedOrigins` undefined → legacy wildcard preserved.** Don't pass `allowedOrigins`. Spy that `access-control-allow-origin` is set to `*` as before. Confirms cockpit-examples stays unaffected.
6. **Body > maxBodyBytes → 413.** Set `maxBodyBytes: 100`. Send a body whose `JSON.stringify().length > 100`. Expect 413 + `{ error: 'payload_too_large', maxBytes: 100 }`. Fetch not called.
7. **Body exactly at maxBodyBytes → allowed.** Boundary case. count == limit → pass through to next step.
8. **Content-Length over cap → 413 without stringifying.** Spy on `JSON.stringify` (or use a body type that throws on stringify) to confirm we short-circuit on `content-length` first.

### Manual smoke (post-deploy)

```bash
# CORS: allowed origin → 200
curl -s -I https://demo.cacheplane.ai/api/info -H "Origin: https://demo.cacheplane.ai" | grep -i access-control-allow-origin

# CORS: disallowed origin → 403
curl -s -o /dev/null -w "%{http_code}\n" https://demo.cacheplane.ai/api/info -H "Origin: https://malicious.example"

# CORS: no origin (curl default) → 200
curl -s -o /dev/null -w "%{http_code}\n" https://demo.cacheplane.ai/api/info

# Body cap: 10 KB body → 413
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://demo.cacheplane.ai/api/threads \
  -H "content-type: application/json" \
  -d "$(python3 -c 'print("{\"data\":\"" + "x" * 10000 + "\"}")')"
```

Expected: 200, 403, 200, 413.

## Components touched

| File | Change |
|---|---|
| `scripts/langgraph-proxy.ts` | Extend `ProxyConfig`. Add CORS-allowlist logic before existing CORS block. Add body-cap check between debug endpoint and rate-limit gate. |
| `scripts/langgraph-proxy.spec.ts` | Add 6 new unit tests covering both gates. |
| `scripts/demo-middleware.ts` | Read `ALLOWED_ORIGINS` + `MAX_PROMPT_BYTES` from env, pass to `createProxyHandler`. |
| `scripts/examples-middleware.ts` | Unchanged. |
| Vercel `cacheplane-demo` env (external) | Set `ALLOWED_ORIGINS=https://demo.cacheplane.ai`, `MAX_PROMPT_BYTES=8192`. |

## Out of scope

- Rate-limiting on cockpit-examples (different threat model).
- Per-IP cumulative byte tracking.
- Content filtering / prompt injection detection.
- Daily/total cost cap.
- Wildcard subdomain matching (e.g., `*.cacheplane.ai`) — YAGNI.
- Adding `cacheplane.ai` to the allowlist for iframe embedding — no iframe today; revisit when/if we add one.
- Vercel preview URLs in the allowlist — testing happens via curl + the Vercel-assigned preview URL (not `demo.cacheplane.ai`).

## References

- `scripts/langgraph-proxy.ts` — current proxy with Phase 3 rate-limit gate
- `scripts/demo-middleware.ts` — demo wrapper that adds new env-driven config
- Phase 3 spec: `docs/superpowers/specs/2026-05-13-canonical-demo-rate-limit-design.md` (for ProxyConfig precedent)
- Phase 2 spec: `docs/superpowers/specs/2026-05-13-canonical-demo-deploy-design.md` (for the overall deployment pattern)
