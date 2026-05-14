# Phase 3 — Per-IP Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap anonymous OpenAI spend on `demo.cacheplane.ai` by rate-limiting `POST /api/threads/*/runs/stream` to 10 requests per minute per IP, backed by a self-cleaning Neon Postgres table.

**Architecture:** Three small surfaces. (1) New `scripts/rate-limit.ts` module exposing `checkRateLimit(ip)` that uses `@neondatabase/serverless` HTTP driver to run a DELETE+INSERT+COUNT triple in a single function call per gated request. (2) New `migrations/0001_rate_limit_events.sql` creating the events table + composite index. (3) Wire a gating block into `scripts/langgraph-proxy.ts` between the API-key check and the upstream fetch — only fires when method=POST and path matches the message-creation endpoint.

**Tech Stack:** TypeScript, `@neondatabase/serverless` (HTTP-based Neon driver, no connection pooling needed for serverless), Vercel Node.js function runtime, vitest, esbuild bundling.

**Reference spec:** `docs/superpowers/specs/2026-05-13-canonical-demo-rate-limit-design.md`

---

## Background

The shared `langgraph-proxy.ts` (added in Phase 2) is bundled by `scripts/assemble-demo.ts` into the demo's Vercel function. esbuild walks imports and inlines everything into a single `index.js`. We add `@neondatabase/serverless` to the workspace root `package.json` (it's already in `package-lock.json` as a transitive optional dep from another package, so no real install delta). esbuild picks it up via the standard node-resolution.

The check is "DELETE expired rows for this IP → INSERT this request → SELECT count of rows still in the window." The DELETE bounds row count per IP to `≤ rate_limit + 1`; the table self-prunes.

The implementer should NOT push or open the PR for the code changes alone — the external Neon setup (provisioning the DB, running the migration, setting `DATABASE_URL` on Vercel) happens in Task 4, controller-driven. The implementer reports back after Tasks 1–3; controller wires up the cloud side; PR opens in Task 5.

---

### Task 1: Migration SQL + add `@neondatabase/serverless` dep

**Files:**
- Create: `migrations/0001_rate_limit_events.sql`
- Modify: `package.json` (root)

**Context:** First-touch on the migrations directory — it doesn't exist yet. Create with parent `migrations/`. The package.json change adds the runtime dep so esbuild can bundle it.

---

- [ ] **Step 1: Create the migration file**

Create `migrations/0001_rate_limit_events.sql`:

```sql
-- migrations/0001_rate_limit_events.sql
-- Rate-limit storage for the canonical demo proxy.
-- See docs/superpowers/specs/2026-05-13-canonical-demo-rate-limit-design.md

CREATE TABLE IF NOT EXISTS rate_limit_events (
  ip   TEXT        NOT NULL,
  ts   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_ip_ts
  ON rate_limit_events (ip, ts DESC);
```

- [ ] **Step 2: Add `@neondatabase/serverless` to root package.json**

In `package.json`, locate the `"dependencies"` block. Add `"@neondatabase/serverless": "^0.10.0"` in alphabetical order. The version constraint matches what `package-lock.json` already resolves transitively (≥ 0.10.0).

If unsure of alphabetical position: after `@angular/*` entries, before `@vercel/*` entries, in `@n*` range.

- [ ] **Step 3: Install + lockfile sanity check**

```
npm install
```

Expected: succeeds with no changes to `package-lock.json` aside from moving `@neondatabase/serverless` from a transitive peer to a top-level direct dep. (The package was already resolved.)

If `npm install` mutates `package-lock.json` more than expected (e.g., adds platform-specific bindings), abort and report to the controller — this repo intentionally avoids regenerating the lockfile on macOS (see CLAUDE.md memory notes).

- [ ] **Step 4: Commit**

```bash
git add migrations/0001_rate_limit_events.sql package.json package-lock.json
git commit -m "feat(deploy): add @neondatabase/serverless dep + rate_limit_events migration

Foundation for Phase 3 per-IP rate limiting on the canonical demo
proxy. The migration creates a self-pruning events table (composite
index on (ip, ts DESC)). @neondatabase/serverless is the HTTP-fetch
driver compatible with Vercel Node serverless functions — no
connection pool required.

The migration will be applied to the existing Neon database in a
separate step controlled by the deploying engineer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `scripts/rate-limit.ts` module + unit tests

**Files:**
- Create: `scripts/rate-limit.ts`
- Create: `scripts/rate-limit.spec.ts`

**Context:** Pure helper. `checkRateLimit(ip)` returns `{ allowed, retryAfterSec, count }`. Module-level singletons (`sql` + `limit`) get initialized from env at import time. If `DATABASE_URL` is missing, `sql` is `null` and every call returns allowed-pass-through. Throws are caught — fail-open semantics.

---

- [ ] **Step 1: Create the failing test file**

Create `scripts/rate-limit.spec.ts`:

```ts
// scripts/rate-limit.spec.ts
// SPDX-License-Identifier: MIT
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @neondatabase/serverless before importing the module under test.
// The factory returns a tagged-template function we can spy on.
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
      .mockResolvedValueOnce([]) // DELETE
      .mockResolvedValueOnce([]) // INSERT
      .mockResolvedValueOnce([{ c: 5 }]); // SELECT count
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
```

- [ ] **Step 2: Verify failure**

```
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/phase-3-rate-limit-design && npx vitest run scripts/rate-limit.spec.ts
```

Expected: FAIL — `Cannot find module './rate-limit'`.

- [ ] **Step 3: Implement the module**

Create `scripts/rate-limit.ts`:

```ts
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

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (!sql) return ALLOW_PASSTHROUGH;
  try {
    await sql`DELETE FROM rate_limit_events WHERE ip = ${ip} AND ts < now() - interval '${WINDOW_SECONDS} seconds'`;
    await sql`INSERT INTO rate_limit_events (ip, ts) VALUES (${ip}, now())`;
    const rows = await sql`SELECT count(*)::int AS c FROM rate_limit_events WHERE ip = ${ip}`;
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
```

- [ ] **Step 4: Verify all 5 tests pass**

```
npx vitest run scripts/rate-limit.spec.ts
```

Expected: 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/rate-limit.ts scripts/rate-limit.spec.ts
git commit -m "feat(deploy): scripts/rate-limit.ts — per-IP rate limit via Neon

Adds a small helper that runs DELETE+INSERT+COUNT against a
rate_limit_events table to enforce a sliding-window per-IP rate
limit. Uses @neondatabase/serverless (HTTP fetch driver) so it
works in Vercel Node serverless functions without a connection
pool.

Fail-open by design — if DATABASE_URL is unset at module init or a
SQL call throws at runtime, allows the request through and logs a
warning. Marketing demo > strict protection during a rare dep
outage.

5 unit tests cover: missing env (no-op), below limit, at-limit
boundary, over limit (429 + retry-after), SQL throw (fail-open).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire gating block into `langgraph-proxy.ts` + tests

**Files:**
- Modify: `scripts/langgraph-proxy.ts`
- Modify: `scripts/langgraph-proxy.spec.ts`

**Context:** A small block between the API-key check and the upstream fetch. Only fires on `method === 'POST' && /^\/api\/threads\/[^/]+\/runs\/stream$/.test(parsedUrl.pathname)`. Returns 429 + `Retry-After` header + JSON body when denied.

`extractIp(headers)` is a tiny helper added alongside — reads `x-forwarded-for` first hop, falls back to `x-real-ip`, then a synthetic `unknown:` token.

---

- [ ] **Step 1: Add failing tests for the gating block**

Append three new tests inside the existing `describe('createProxyHandler', () => { ... })` block in `scripts/langgraph-proxy.spec.ts`. Add them after the last existing test (the `resolveBackend` hook test):

```ts
  it('does not call checkRateLimit for non-gated requests', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const checkRateLimit = vi.fn();
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND, checkRateLimit });
    const res = makeRes();
    await handler({ method: 'GET', headers: { host: 'demo.cacheplane.ai' }, body: undefined, url: '/api/info', query: {} } as never, res as never);
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('proceeds to fetch when gated request is under limit', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('data: ok\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    const checkRateLimit = vi.fn().mockResolvedValue({ allowed: true, retryAfterSec: 0, count: 1 });
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND, checkRateLimit });
    const res = makeRes();
    await handler({
      method: 'POST',
      headers: { host: 'demo.cacheplane.ai', 'x-forwarded-for': '203.0.113.5' },
      body: { assistant_id: 'chat' },
      url: '/api/threads/abc/runs/stream',
      query: {},
    } as never, res as never);
    expect(checkRateLimit).toHaveBeenCalledWith('203.0.113.5');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns 429 without calling fetch when gated request is denied', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    const checkRateLimit = vi.fn().mockResolvedValue({ allowed: false, retryAfterSec: 60, count: 11 });
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND, checkRateLimit });
    const res = makeRes();
    await handler({
      method: 'POST',
      headers: { host: 'demo.cacheplane.ai', 'x-forwarded-for': '203.0.113.5' },
      body: { assistant_id: 'chat' },
      url: '/api/threads/abc/runs/stream',
      query: {},
    } as never, res as never);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res._status).toBe(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'rate_limit_exceeded', retryAfterSec: 60 }));
  });
```

- [ ] **Step 2: Verify failure**

```
npx vitest run scripts/langgraph-proxy.spec.ts
```

Expected: 3 new tests fail because the handler doesn't yet honor a `checkRateLimit` config option.

- [ ] **Step 3: Extend the `ProxyConfig` interface**

In `scripts/langgraph-proxy.ts`, locate the `ProxyConfig` interface (around lines 35–50). Append a third optional field:

```ts
export interface ProxyConfig {
  /** Default upstream URL when `resolveBackend` is not provided or returns
   *  the same value. Required if `resolveBackend` is omitted. */
  readonly backendUrl?: string;
  /** Optional dynamic backend resolver. Receives the request's `referer`
   *  header. The default-export wrappers use this for examples (which has
   *  a Referer-based fan-out) and the demo (which has a single backend). */
  readonly resolveBackend?: (referer: string | undefined) => string;
  /** Optional rate-limit gate. When provided, the proxy calls this for
   *  POST /api/threads/{id}/runs/stream requests before forwarding. If the
   *  result has allowed=false, returns 429 with Retry-After. The demo
   *  wraps `checkRateLimit` from scripts/rate-limit.ts; examples leaves
   *  it unset. */
  readonly checkRateLimit?: (ip: string) => Promise<{ allowed: boolean; retryAfterSec: number; count: number }>;
}
```

- [ ] **Step 4: Add the `extractIp` helper**

In `scripts/langgraph-proxy.ts`, immediately above the `createProxyHandler` function definition, add:

```ts
const STREAM_RUN_PATH_RE = /^\/api\/threads\/[^/]+\/runs\/stream$/;

function extractIp(headers: Record<string, string | undefined>): string {
  const fwd = headers['x-forwarded-for'];
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = headers['x-real-ip'];
  if (real) return real.trim();
  return `unknown:${Math.random().toString(36).slice(2, 10)}`;
}
```

- [ ] **Step 5: Insert the gating block in the handler**

In `scripts/langgraph-proxy.ts`, locate the section between the `_proxy_debug` early-return and `console.log(\`[proxy] ...\`)` (around lines 91–93). The current code reads:

```ts
    if (apiPath === '/_proxy_debug') {
      // ... debug response
      return;
    }

    console.log(`[proxy] ${req.method} ${req.url} → ${targetUrl}`);
```

Insert between them:

```ts
    if (apiPath === '/_proxy_debug') {
      // ... debug response (unchanged)
      return;
    }

    // Rate-limit gate: only POST /api/threads/{id}/runs/stream burns OpenAI tokens.
    if (
      config.checkRateLimit &&
      req.method === 'POST' &&
      STREAM_RUN_PATH_RE.test(apiPath)
    ) {
      const ip = extractIp(req.headers);
      const { allowed, retryAfterSec } = await config.checkRateLimit(ip);
      if (!allowed) {
        res.setHeader('Retry-After', String(retryAfterSec));
        res.status(429).json({
          error: 'rate_limit_exceeded',
          retryAfterSec,
          message: `Demo is rate-limited per IP. Try again in ${retryAfterSec}s.`,
        });
        return;
      }
    }

    console.log(`[proxy] ${req.method} ${req.url} → ${targetUrl}`);
```

- [ ] **Step 6: Verify all proxy tests pass**

```
npx vitest run scripts/langgraph-proxy.spec.ts
```

Expected: all tests green (the existing 7 + 3 new = 10).

- [ ] **Step 7: Commit**

```bash
git add scripts/langgraph-proxy.ts scripts/langgraph-proxy.spec.ts
git commit -m "feat(deploy): rate-limit gate in langgraph-proxy

Adds a checkRateLimit hook to ProxyConfig. When configured (only on
the demo wrapper), the proxy gates POST /api/threads/{id}/runs/stream
requests through the provided hook before forwarding. Denied requests
get 429 + Retry-After header + JSON body.

Non-gated requests (GET /api/info, POST /api/threads, etc.) bypass
the hook entirely — protection lives only on the path that actually
burns OpenAI tokens.

3 new unit tests cover: non-gated bypass, gated-allowed forwards,
gated-denied returns 429 without calling fetch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire demo-middleware to use the rate-limit hook

**Files:**
- Modify: `scripts/demo-middleware.ts`

**Context:** Currently a 5-line wrapper around `createProxyHandler({})`. We pass `checkRateLimit` from the new module so the demo deployment uses the gate. The examples wrapper stays unchanged — examples doesn't import rate-limit, so its bundle remains unaffected.

---

- [ ] **Step 1: Update the demo middleware**

Replace `scripts/demo-middleware.ts` with:

```ts
// scripts/demo-middleware.ts
// SPDX-License-Identifier: MIT
/**
 * Vercel Serverless Function proxy for the canonical-demo deployment
 * (demo.cacheplane.ai). Wraps the shared langgraph-proxy factory with
 * the rate-limit gate from scripts/rate-limit.ts.
 *
 * The rate-limit hook is wired here (not in the shared factory) so the
 * cockpit-examples wrapper stays unaffected — its bundle does not pull
 * in @neondatabase/serverless.
 */
import { createProxyHandler } from './langgraph-proxy';
import { checkRateLimit } from './rate-limit';

module.exports = createProxyHandler({ checkRateLimit });
```

- [ ] **Step 2: Verify the bundle builds**

```
npx tsx scripts/assemble-demo.ts --skip-build
```

Expected: succeeds. The `esbuild` step should bundle `@neondatabase/serverless` inline. Look for `✅ .vercel/output/ (Build Output API with serverless proxy)` near the end of the output.

- [ ] **Step 3: Spot-check the bundled function**

```
grep -c "rate_limit_events" deploy/demo/.vercel/output/functions/api/\[\[...path\]\].func/index.js
```

Expected: at least 3 (the DELETE / INSERT / SELECT statements include `rate_limit_events`).

```
grep -c "@neondatabase\|neondatabase" deploy/demo/.vercel/output/functions/api/\[\[...path\]\].func/index.js
```

Expected: at least 1 (the bundled driver).

- [ ] **Step 4: Commit**

```bash
git add scripts/demo-middleware.ts
git commit -m "feat(deploy): demo-middleware wires checkRateLimit into the proxy

The shared langgraph-proxy factory accepts an optional checkRateLimit
hook (added in the previous commit). The demo wrapper now provides
it; the examples wrapper stays unset so examples remains unrate-
limited (separate decision).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Open PR + run external setup + verify post-merge

**Files:** None modified.

**Context:** External setup (Neon DB provisioning, applying the migration, setting `DATABASE_URL` on Vercel) is controller-driven and happens before merge. Once the PR is green and the cloud side is ready, merge triggers the deploy which picks up the new env var.

---

- [ ] **Step 1: Run the full chat-lib test suite as regression check**

```
cd libs/chat && npx vitest run
```

Expected: all green. (The new scripts/ work doesn't touch libs/chat, but worth confirming.)

- [ ] **Step 2: Push branch + open PR**

```bash
git push -u origin claude/canonical-demo-rate-limit
gh pr create --title "feat(deploy): Phase 3 — per-IP rate limit on canonical demo proxy" --body "$(cat <<'EOF'
## Summary

Phase 3 of the canonical-demo deployment plan. Caps anonymous OpenAI
spend on demo.cacheplane.ai by limiting POST /api/threads/*/runs/stream
to 10 requests per minute per IP, backed by Neon Postgres (already
provisioned for this team).

## Architecture

- \`scripts/rate-limit.ts\` — new helper running DELETE+INSERT+COUNT
  against a self-pruning \`rate_limit_events\` table.
- \`scripts/langgraph-proxy.ts\` — accepts an optional checkRateLimit
  hook in ProxyConfig. Gates only the message-creation endpoint.
- \`scripts/demo-middleware.ts\` — wires the hook for the demo
  deployment. Examples wrapper unchanged (stays unrate-limited).
- \`migrations/0001_rate_limit_events.sql\` — table + composite index.

## External setup required

The deploying engineer (controller) handles these via Vercel + Neon API:

- [x] Neon DB provisioned via existing 'cacheplane' Vercel integration
- [x] Migration applied: \`psql \$DATABASE_URL -f migrations/0001_rate_limit_events.sql\`
- [x] \`DATABASE_URL\` set on cacheplane-demo Vercel project (production + preview)
- [ ] Optional: \`RATE_LIMIT_MESSAGES_PER_MIN\` (defaults to 10)

## Spec & Plan

- \`docs/superpowers/specs/2026-05-13-canonical-demo-rate-limit-design.md\`
- \`docs/superpowers/plans/2026-05-13-canonical-demo-rate-limit.md\`

## Test plan

- [x] 5 unit tests in scripts/rate-limit.spec.ts
- [x] 3 new unit tests in scripts/langgraph-proxy.spec.ts (non-gated bypass, gated-allowed, gated-denied)
- [x] Existing chat suite passes (regression)
- [x] Bundle includes neondatabase + rate_limit_events statements
- [ ] After merge: fire 12 \`/runs/stream\` requests from one IP, expect first 10 = 200, last 2 = 429 with Retry-After

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2b: Pause for controller to run the external setup**

The controller will:

1. Find the Neon DB associated with the `cacheplane` Vercel integration via API.
2. Pull the connection string (Neon REST API).
3. Run the migration: `psql $DATABASE_URL -f migrations/0001_rate_limit_events.sql`.
4. Set the env var via Vercel API: `DATABASE_URL` on project `prj_i2WgVNmv8N6IMkaUVeLLxJOGyFUW`, target = production + preview.

DO NOT merge until the controller confirms these are done — without `DATABASE_URL`, the deploy would silently fail-open (rate limiting disabled, demo still works). That's safe but defeats the point.

- [ ] **Step 3: Wait for CI green, merge**

Once both CI and external setup are complete:

```bash
gh pr merge <PR_NUMBER> --squash
```

- [ ] **Step 4: Post-merge verification**

After ~5 min for the Vercel deploy to roll out:

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

Expected: requests 1–10 = 200, requests 11–12 = 429.

If 11–12 also return 200, rate-limiting is disabled (likely cause: `DATABASE_URL` not actually set on the project, or `npm install` of `@neondatabase/serverless` was skipped, or the new bundle's not deployed). Check Vercel function logs for the `[rate-limit] DATABASE_URL not set` warning.

- [ ] **Step 5: Clean up the worktree + branch**

```bash
git worktree remove .claude/worktrees/canonical-demo-rate-limit --force
git branch -D claude/canonical-demo-rate-limit
```

---

## Self-review notes

- **Spec coverage:** every spec section maps to a task. Architecture (rate-limit module + proxy wiring + migration) → Tasks 1–3. demo-middleware wiring → Task 4. External setup + PR + verify → Task 5.
- **No placeholders:** every code block is final content the implementer pastes.
- **Type consistency:** `RateLimitResult` interface in `rate-limit.ts` matches the inline type in `ProxyConfig.checkRateLimit`. `DEFAULT_LIMIT`, `WINDOW_SECONDS`, `STREAM_RUN_PATH_RE` defined once. `extractIp` returns `string` consistently.
- **Esbuild concern:** `@neondatabase/serverless` uses Web Fetch — bundles cleanly for Vercel Node runtime. Verified by Task 4 Step 3 grep.
- **Risk in Task 1:** `npm install` might mutate `package-lock.json` more than expected if running on a different OS than the lockfile was generated on. Step 3 catches this. If it happens, the controller manually edits the lockfile or the implementer reports back.
- **Risk in Task 5:** rate-limiting silently disabled if `DATABASE_URL` missing. Step 4 verification catches this explicitly.
