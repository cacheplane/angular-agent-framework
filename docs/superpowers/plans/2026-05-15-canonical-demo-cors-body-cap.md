# Phase 4 — CORS Allowlist + Prompt-Length Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CORS-allowlist enforcement and a request-body byte cap to the demo proxy. Both gates fire before rate-limit and upstream fetch, so they're cost-free defenses.

**Architecture:** Extend `ProxyConfig` with two optional fields (`allowedOrigins`, `maxBodyBytes`). The CORS block at the start of the handler conditionally echoes the matched origin (or returns 403). A new body-size check sits between the `_proxy_debug` early-return and the rate-limit gate. `scripts/demo-middleware.ts` reads `ALLOWED_ORIGINS` and `MAX_PROMPT_BYTES` from env and passes them in; `scripts/examples-middleware.ts` doesn't pass them (legacy `*` CORS and no body cap preserved).

**Tech Stack:** TypeScript, Vercel Node.js function runtime, vitest, esbuild bundling.

**Reference spec:** `docs/superpowers/specs/2026-05-15-canonical-demo-cors-body-cap-design.md`

---

## Background for the implementer

The Phase 2 proxy lives at `scripts/langgraph-proxy.ts` and exports `createProxyHandler(config: ProxyConfig)`. The Phase 3 PR (#315) added a `checkRateLimit?` hook with a similar shape. We mirror that pattern for the two new gates.

The shared proxy is consumed by two wrappers:

- `scripts/demo-middleware.ts` — runs on `demo.cacheplane.ai`. We extend it to read the new env vars and pass them in.
- `scripts/examples-middleware.ts` — runs on `examples.cacheplane.ai`. We **do NOT** touch it. By not passing the new fields, its behavior stays exactly as today (`*` CORS, no body cap).

The CI demo-deploy gating regex was extended in PR #317 to include `scripts/rate-limit.ts`. Our changes touch `scripts/langgraph-proxy.ts` and `scripts/demo-middleware.ts` — both already in the regex. The Phase 4 PR will retrigger a demo redeploy automatically.

---

### Task 1: Extend `ProxyConfig` + CORS allowlist enforcement

**Files:**
- Modify: `scripts/langgraph-proxy.ts`
- Modify: `scripts/langgraph-proxy.spec.ts`

**Context:** The current handler always sets `access-control-allow-origin: *`. We add a per-request decision: if `config.allowedOrigins` is configured, echo only the matching Origin (or 403). If unset, legacy `*` behavior preserved.

The match is exact-string equality on the full origin (`https://demo.cacheplane.ai`). No wildcards, no protocol-stripping.

If `Origin` header is absent (server-to-server clients like curl), we skip the CORS check entirely and don't set any `access-control-allow-origin` header. Browsers won't make a request without an Origin in cross-origin scenarios anyway.

---

- [ ] **Step 1: Write the 5 failing CORS tests**

Append the following tests at the END of the existing `describe('createProxyHandler', () => { ... })` block in `scripts/langgraph-proxy.spec.ts`, after the rate-limit tests:

```ts
  // === CORS allowlist ===

  it('echoes matching Origin when allowedOrigins is configured', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({
      backendUrl: DEFAULT_BACKEND,
      allowedOrigins: ['https://demo.cacheplane.ai'],
    });
    const res = makeRes();
    await handler({
      method: 'GET',
      headers: { host: 'demo.cacheplane.ai', origin: 'https://demo.cacheplane.ai' },
      body: undefined,
      url: '/api/info',
      query: {},
    } as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith('access-control-allow-origin', 'https://demo.cacheplane.ai');
    expect(res.setHeader).toHaveBeenCalledWith('vary', 'origin');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns 403 when Origin is not in allowlist', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    const handler = createProxyHandler({
      backendUrl: DEFAULT_BACKEND,
      allowedOrigins: ['https://demo.cacheplane.ai'],
    });
    const res = makeRes();
    await handler({
      method: 'GET',
      headers: { host: 'demo.cacheplane.ai', origin: 'https://malicious.example' },
      body: undefined,
      url: '/api/info',
      query: {},
    } as never, res as never);
    expect(res._status).toBe(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'origin_not_allowed' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows requests without an Origin header when allowedOrigins is configured', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({
      backendUrl: DEFAULT_BACKEND,
      allowedOrigins: ['https://demo.cacheplane.ai'],
    });
    const res = makeRes();
    await handler({
      method: 'GET',
      headers: { host: 'demo.cacheplane.ai' },
      body: undefined,
      url: '/api/info',
      query: {},
    } as never, res as never);
    expect(fetchMock).toHaveBeenCalled();
    // No access-control-allow-origin should be set when no Origin was sent.
    const calls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls;
    const corsCall = calls.find(([k]) => k === 'access-control-allow-origin');
    expect(corsCall).toBeUndefined();
  });

  it('OPTIONS preflight with allowed Origin returns 204 with echoed Origin', async () => {
    const handler = createProxyHandler({
      backendUrl: DEFAULT_BACKEND,
      allowedOrigins: ['https://demo.cacheplane.ai'],
    });
    const res = makeRes();
    await handler({
      method: 'OPTIONS',
      headers: { origin: 'https://demo.cacheplane.ai' },
      body: undefined,
      url: '/api/info',
      query: {},
    } as never, res as never);
    expect(res._status).toBe(204);
    expect(res.setHeader).toHaveBeenCalledWith('access-control-allow-origin', 'https://demo.cacheplane.ai');
  });

  it('preserves wildcard CORS when allowedOrigins is undefined (legacy examples behavior)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({
      method: 'GET',
      headers: { host: 'demo.cacheplane.ai', origin: 'https://anywhere.example' },
      body: undefined,
      url: '/api/info',
      query: {},
    } as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith('access-control-allow-origin', '*');
  });
```

- [ ] **Step 2: Verify all 5 fail**

```
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/canonical-demo-cors-body-cap && npx vitest run scripts/langgraph-proxy.spec.ts
```

Expected: the 5 new tests fail. The "preserves wildcard" test may pass (existing behavior); the other 4 fail because no allowlist logic exists yet.

- [ ] **Step 3: Extend `ProxyConfig`**

In `scripts/langgraph-proxy.ts`, locate the `ProxyConfig` interface (around lines 35–50). After the `checkRateLimit` field, add:

```ts
  /** Origins to allow via CORS. If undefined, legacy wildcard `*` behavior
   *  preserved (used by cockpit-examples). Each entry is a full origin
   *  string, e.g. `https://demo.cacheplane.ai`. Match is exact-string. */
  readonly allowedOrigins?: readonly string[];
  /** Maximum request body size in bytes. If undefined, no cap (legacy
   *  behavior). Checked against Content-Length first, falls back to
   *  JSON.stringify(req.body).length. */
  readonly maxBodyBytes?: number;
```

(The `maxBodyBytes` field will be used in Task 2; declaring both now keeps the interface change in one commit.)

- [ ] **Step 4: Add the CORS allowlist logic in the handler**

In `scripts/langgraph-proxy.ts`, locate the `return async function handler(req, res) { ... }` block. The current top of the handler reads:

```ts
  return async function handler(req, res) {
    // CORS preflight (Phase 4 will tighten the origin allowlist).
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type, x-api-key, authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
```

Replace with:

```ts
  return async function handler(req, res) {
    // CORS — echo matching Origin when allowedOrigins is configured;
    // otherwise legacy * behavior preserved for cockpit-examples.
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type, x-api-key, authorization');

    const origin = req.headers.origin;
    if (config.allowedOrigins) {
      if (origin) {
        if (config.allowedOrigins.includes(origin)) {
          res.setHeader('access-control-allow-origin', origin);
          res.setHeader('vary', 'origin');
        } else {
          res.status(403).json({ error: 'origin_not_allowed' });
          return;
        }
      }
      // No Origin header → server-to-server client, skip CORS headers.
    } else {
      res.setHeader('access-control-allow-origin', '*');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
```

- [ ] **Step 5: Verify all 10+5 = 15 proxy tests pass**

```
npx vitest run scripts/langgraph-proxy.spec.ts
```

Expected: all 15 tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/langgraph-proxy.ts scripts/langgraph-proxy.spec.ts
git commit -m "feat(deploy): CORS allowlist enforcement on the demo proxy

Extends ProxyConfig with optional allowedOrigins and maxBodyBytes
fields (the latter wired in the next commit). When allowedOrigins
is configured, the handler echoes a matching Origin (with vary:
origin) or returns 403 for a mismatch. Requests without an Origin
header (server-to-server) are passed through with no CORS headers
set — CORS only matters in browser context.

When allowedOrigins is undefined (cockpit-examples), the handler
keeps the legacy access-control-allow-origin: * behavior. No change
for examples.

5 new unit tests cover: matching origin echoed, mismatch returns
403, missing Origin allowed without CORS headers, OPTIONS preflight
echoes, and the wildcard-preserved-when-unset legacy path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Body-size cap

**Files:**
- Modify: `scripts/langgraph-proxy.ts`
- Modify: `scripts/langgraph-proxy.spec.ts`

**Context:** Check `Content-Length` header first; fall back to `JSON.stringify(req.body).length` if it's absent. The check fires after the `_proxy_debug` early-return and before the rate-limit gate. When `maxBodyBytes` is undefined, the check is skipped (preserving legacy behavior for examples).

---

- [ ] **Step 1: Write 3 failing body-cap tests**

Append after the CORS tests in `scripts/langgraph-proxy.spec.ts`:

```ts
  // === Body-size cap ===

  it('returns 413 when body length exceeds maxBodyBytes (via JSON.stringify)', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND, maxBodyBytes: 100 });
    const res = makeRes();
    const bigBody = { content: 'x'.repeat(200) };
    await handler({
      method: 'POST',
      headers: { host: 'demo.cacheplane.ai', 'content-type': 'application/json' },
      body: bigBody,
      url: '/api/threads',
      query: {},
    } as never, res as never);
    expect(res._status).toBe(413);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'payload_too_large',
      maxBytes: 100,
    }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 413 when Content-Length header exceeds maxBodyBytes (short-circuit)', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND, maxBodyBytes: 100 });
    const res = makeRes();
    await handler({
      method: 'POST',
      headers: {
        host: 'demo.cacheplane.ai',
        'content-type': 'application/json',
        'content-length': '500',
      },
      body: { ok: true }, // small enough by stringify but content-length says 500
      url: '/api/threads',
      query: {},
    } as never, res as never);
    expect(res._status).toBe(413);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'payload_too_large',
      maxBytes: 100,
      actualBytes: 500,
    }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not enforce cap when maxBodyBytes is undefined (legacy examples behavior)', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({
      method: 'POST',
      headers: { host: 'demo.cacheplane.ai', 'content-type': 'application/json', 'content-length': '999999' },
      body: { content: 'x'.repeat(50000) },
      url: '/api/threads',
      query: {},
    } as never, res as never);
    expect(fetchMock).toHaveBeenCalled();
    expect(res._status).toBe(200);
  });
```

- [ ] **Step 2: Verify failure**

```
npx vitest run scripts/langgraph-proxy.spec.ts
```

Expected: the first two new tests fail. The third "legacy unset" test passes.

- [ ] **Step 3: Add the body-cap check**

In `scripts/langgraph-proxy.ts`, locate the `_proxy_debug` early-return block. The current code immediately after it reads:

```ts
    // Debug endpoint — confirms the proxy is wired without hitting the upstream.
    if (apiPath === '/_proxy_debug') {
      res.status(200).json({
        // ...
      });
      return;
    }

    // Rate-limit gate: only POST /api/threads/{id}/runs/stream burns OpenAI tokens.
    if (
      config.checkRateLimit &&
      req.method === 'POST' &&
      STREAM_RUN_PATH_RE.test(apiPath)
    ) {
```

Insert the body-cap check BETWEEN the `_proxy_debug` block and the rate-limit gate:

```ts
    // Debug endpoint — confirms the proxy is wired without hitting the upstream.
    if (apiPath === '/_proxy_debug') {
      res.status(200).json({
        // ... (unchanged)
      });
      return;
    }

    // Body-size cap. Fast-fail before rate-limit + upstream fetch.
    if (config.maxBodyBytes !== undefined) {
      const cl = req.headers['content-length'];
      const clNum = cl !== undefined ? Number(cl) : NaN;
      let actualBytes: number;
      if (Number.isFinite(clNum) && clNum >= 0) {
        actualBytes = clNum;
      } else {
        // Vercel parses the body before our handler; stringify gives an
        // upper bound on the original byte length.
        actualBytes = JSON.stringify(req.body ?? '').length;
      }
      if (actualBytes > config.maxBodyBytes) {
        res.status(413).json({
          error: 'payload_too_large',
          maxBytes: config.maxBodyBytes,
          actualBytes,
        });
        return;
      }
    }

    // Rate-limit gate: only POST /api/threads/{id}/runs/stream burns OpenAI tokens.
    if (
      config.checkRateLimit &&
      req.method === 'POST' &&
      STREAM_RUN_PATH_RE.test(apiPath)
    ) {
```

- [ ] **Step 4: Verify all 18 proxy tests pass**

```
npx vitest run scripts/langgraph-proxy.spec.ts
```

Expected: 18 green (10 from before + 5 CORS + 3 body-cap).

- [ ] **Step 5: Commit**

```bash
git add scripts/langgraph-proxy.ts scripts/langgraph-proxy.spec.ts
git commit -m "feat(deploy): request-body byte cap in the demo proxy

Adds an optional maxBodyBytes check between the _proxy_debug
endpoint and the rate-limit gate. Checks Content-Length first
(short-circuit); falls back to JSON.stringify(req.body).length.
Returns 413 with { error: 'payload_too_large', maxBytes,
actualBytes } when over the cap.

Skipped entirely when maxBodyBytes is undefined (cockpit-examples).

3 new unit tests cover the JSON.stringify path, Content-Length
short-circuit, and the legacy-unset path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire env-driven config in demo-middleware

**Files:**
- Modify: `scripts/demo-middleware.ts`

**Context:** Read `ALLOWED_ORIGINS` (comma-separated) and `MAX_PROMPT_BYTES` from env at module load, with sensible defaults. Pass to `createProxyHandler` alongside the existing `checkRateLimit`.

---

- [ ] **Step 1: Update demo-middleware**

Replace `scripts/demo-middleware.ts` contents with:

```ts
// scripts/demo-middleware.ts
// SPDX-License-Identifier: MIT
/**
 * Vercel Serverless Function proxy for the canonical-demo deployment
 * (demo.cacheplane.ai). Wraps the shared langgraph-proxy factory with:
 *   - the rate-limit gate from scripts/rate-limit.ts (Phase 3)
 *   - CORS allowlist + body-byte cap from env (Phase 4)
 *
 * Note: changes to scripts/rate-limit.ts MUST trigger a redeploy of this
 * function. The ci.yml `Check if demo changed` step watches
 * scripts/(assemble-demo|demo-middleware|langgraph-proxy|rate-limit)\.ts.
 * Keep that regex in sync if you split rate-limit into multiple files.
 */
import { createProxyHandler } from './langgraph-proxy';
import { checkRateLimit } from './rate-limit';

const DEFAULT_ALLOWED_ORIGINS = ['https://demo.cacheplane.ai'];
const DEFAULT_MAX_BODY_BYTES = 8192;

const allowedOrigins = (() => {
  const raw = process.env['ALLOWED_ORIGINS'];
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  const parsed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
})();

const maxBodyBytes = (() => {
  const raw = process.env['MAX_PROMPT_BYTES'];
  const parsed = raw ? Number(raw) : DEFAULT_MAX_BODY_BYTES;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BODY_BYTES;
})();

module.exports = createProxyHandler({
  checkRateLimit,
  allowedOrigins,
  maxBodyBytes,
});
```

- [ ] **Step 2: Re-bundle to verify**

```
npx tsx scripts/assemble-demo.ts --skip-build
```

Expected: succeeds. The bundled function at `deploy/demo/.vercel/output/functions/api/[[...path]].func/index.js` should contain the new logic.

- [ ] **Step 3: Spot-check the bundle**

```
grep -c "origin_not_allowed\|payload_too_large\|ALLOWED_ORIGINS\|MAX_PROMPT_BYTES" "deploy/demo/.vercel/output/functions/api/[[...path]].func/index.js"
```

Expected: at least 3 (one per error key + at least one env-var reference).

- [ ] **Step 4: Commit**

```bash
git add scripts/demo-middleware.ts
git commit -m "feat(deploy): demo-middleware reads ALLOWED_ORIGINS and MAX_PROMPT_BYTES

Reads two new env vars at module load and passes them to
createProxyHandler:
  - ALLOWED_ORIGINS (comma-separated; default: https://demo.cacheplane.ai)
  - MAX_PROMPT_BYTES (integer; default: 8192)

The cockpit-examples wrapper does not pass these fields, so its
behavior stays exactly as today (* CORS, no body cap).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: PR + external Vercel env vars + post-merge smoke

**Context:** External setup (Vercel env vars on `cacheplane-demo`) is controller-driven and done before merge. The PR's CI lint/test/build runs; once green and external setup is complete, merge triggers the deploy which picks up the new env vars.

---

- [ ] **Step 1: Run the full chat suite as a sanity check**

```
cd libs/chat && npx vitest run
```

Expected: all green. The new scripts/ work doesn't touch libs/chat, but worth confirming.

- [ ] **Step 2: Push branch + open PR**

```bash
git push -u origin claude/canonical-demo-cors-body-cap
gh pr create --title "feat(deploy): Phase 4 — CORS allowlist + prompt-length cap on canonical demo proxy" --body "$(cat <<'EOF'
## Summary

Phase 4 of the canonical-demo deployment plan. Two new defensive gates on the demo proxy:

1. **CORS allowlist** replacing the current \`*\` wildcard. Default allowlist: \`https://demo.cacheplane.ai\`. Configurable via \`ALLOWED_ORIGINS\` (comma-separated).
2. **Request-body byte cap.** Default 8192 bytes. Configurable via \`MAX_PROMPT_BYTES\`. Returns 413 fast-fail before rate-limit + upstream fetch.

Both gates skip entirely when their config field is undefined, so \`scripts/examples-middleware.ts\` (cockpit-examples) is unaffected — it never passes these fields.

## Architecture

- Extends \`ProxyConfig\` in \`scripts/langgraph-proxy.ts\` with optional \`allowedOrigins\` and \`maxBodyBytes\`.
- CORS block at handler top: echoes matching Origin (with \`vary: origin\`) or returns 403. Missing Origin → no CORS headers (server-to-server).
- Body check between \`_proxy_debug\` early-return and rate-limit gate: \`Content-Length\` short-circuit, then \`JSON.stringify\` fallback.
- \`scripts/demo-middleware.ts\` reads env vars + passes them in.

## External setup (controller-driven)

- [x] Vercel env \`ALLOWED_ORIGINS=https://demo.cacheplane.ai\` on cacheplane-demo (production + preview)
- [x] Vercel env \`MAX_PROMPT_BYTES=8192\` on cacheplane-demo (production + preview)

## Spec & Plan

- \`docs/superpowers/specs/2026-05-15-canonical-demo-cors-body-cap-design.md\`
- \`docs/superpowers/plans/2026-05-15-canonical-demo-cors-body-cap.md\`

## Test plan

- [x] 5 new CORS tests + 3 new body-cap tests in scripts/langgraph-proxy.spec.ts
- [x] Existing 10 proxy tests still pass (regression check)
- [x] Demo bundle includes the new error keys and env-var references
- [ ] Post-merge browser smoke:
  - \`curl -I https://demo.cacheplane.ai/api/info -H "Origin: https://demo.cacheplane.ai"\` → 200 with echoed origin
  - \`curl -I https://demo.cacheplane.ai/api/info -H "Origin: https://malicious.example"\` → 403
  - \`curl -I https://demo.cacheplane.ai/api/info\` (no Origin) → 200 with no CORS headers
  - 10 KB POST body → 413 with payload_too_large
- [ ] examples.cacheplane.ai still serves \`access-control-allow-origin: *\` (no regression)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2b: Controller sets the env vars while CI runs**

The controller (operator merging the PR) sets two env vars on the `cacheplane-demo` Vercel project via API before merging:

- `ALLOWED_ORIGINS=https://demo.cacheplane.ai`
- `MAX_PROMPT_BYTES=8192`

Both target = production + preview. If either is absent at runtime, the demo-middleware falls back to sensible defaults — but we want them visible in the dashboard for tunability.

- [ ] **Step 3: Wait for CI green, merge**

```bash
gh pr merge <PR_NUMBER> --squash
```

- [ ] **Step 4: Post-merge smoke (controller-driven)**

After ~5 min for the Vercel deploy:

```bash
# CORS allowed → 200 with echoed Origin
curl -s -i https://demo.cacheplane.ai/api/info -H "Origin: https://demo.cacheplane.ai" | grep -i 'access-control-allow-origin\|^HTTP'

# CORS disallowed → 403
curl -s -o /dev/null -w "%{http_code}\n" https://demo.cacheplane.ai/api/info -H "Origin: https://malicious.example"

# No Origin (curl default) → 200
curl -s -o /dev/null -w "%{http_code}\n" https://demo.cacheplane.ai/api/info

# Body cap → 413
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://demo.cacheplane.ai/api/threads \
  -H "content-type: application/json" \
  -d "$(python3 -c 'print("{\"data\":\"" + "x" * 10000 + "\"}")')"

# examples.cacheplane.ai still wildcard
curl -s -i https://examples.cacheplane.ai/api/info -H "Origin: https://anywhere.example" | grep -i 'access-control-allow-origin'
```

Expected output:
- `200`, with `access-control-allow-origin: https://demo.cacheplane.ai`
- `403`
- `200`, with NO `access-control-allow-origin` header
- `413`
- `access-control-allow-origin: *` on examples (legacy preserved)

- [ ] **Step 5: Clean up worktree + branch**

```bash
git worktree remove .claude/worktrees/canonical-demo-cors-body-cap --force
git branch -D claude/canonical-demo-cors-body-cap
```

---

## Self-review notes

- **Spec coverage:** every spec section maps to a task. CORS architecture → Task 1. Body cap → Task 2. demo-middleware env wiring → Task 3. External Vercel env + PR + verify → Task 4.
- **No placeholders:** every code block is final content the implementer pastes verbatim.
- **Type consistency:** `allowedOrigins?: readonly string[]` and `maxBodyBytes?: number` consistent across Tasks 1, 2, and 3.
- **Risk in Task 2 Step 3:** the body-cap check sits between `_proxy_debug` and the rate-limit gate. The plan calls out the EXACT insertion point so the implementer can't accidentally place it before `apiPath` is computed (which would break path-based decisions) or after rate-limit (which would let oversized bodies hit Neon unnecessarily).
- **Risk in Task 1 Step 4:** the new CORS block precedes the OPTIONS preflight handling. Test #4 ensures OPTIONS still returns 204 with the right echoed Origin.
