# Examples LangGraph Proxy Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add origin allowlist + per-IP Upstash rate limit + 64 KB body cap to the `threadplane-examples` LangGraph proxy, reusing the existing `createProxyHandler` config surface.

**Architecture:** A new `scripts/upstash-rate-limit.ts` provides a `checkRateLimit(ip)` function matching the factory contract (token bucket via `@upstash/ratelimit`, fail-open). `scripts/examples-middleware.ts` passes it plus `allowedOrigins` and `maxBodyBytes` into the unchanged `createProxyHandler`. The CI `examples_changed` filter is widened so proxy-source edits redeploy.

**Tech Stack:** TypeScript, `@upstash/ratelimit` + `@upstash/redis` (already in root deps), esbuild (Vercel Build Output bundling), vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-06-06-examples-langgraph-proxy-hardening-design.md`

---

## File Structure

**New:**
- `scripts/upstash-rate-limit.ts` — Upstash-backed `checkRateLimit(ip): Promise<RateLimitResult>`, fail-open. Sibling to the Neon `scripts/rate-limit.ts`.
- `scripts/upstash-rate-limit.spec.ts` — vitest unit test (fail-open + shape).

**Modified:**
- `scripts/examples-middleware.ts` — pass `allowedOrigins`, `maxBodyBytes`, `checkRateLimit` to `createProxyHandler`.
- `.github/workflows/ci.yml` — widen the `examples_changed` source glob.

---

## Task 1: Upstash rate-limit adapter (TDD)

**Files:**
- Create: `scripts/upstash-rate-limit.spec.ts`
- Create: `scripts/upstash-rate-limit.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/upstash-rate-limit.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/upstash-rate-limit.spec.ts`
Expected: FAIL — `Cannot find module './upstash-rate-limit'` (or `checkRateLimit is not a function`).

- [ ] **Step 3: Write the implementation**

Create `scripts/upstash-rate-limit.ts`:

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

> Note: `limiter` is module-level memoized. The test deletes env vars in `beforeEach` and the first call caches `null` (fail-open). Because vitest runs this spec in a fresh module context, the memo starts unset. Do not add logic to re-read env per call — fail-open-once is the intended behavior, matching `scripts/rate-limit.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/upstash-rate-limit.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify it bundles with esbuild**

Run: `npx esbuild scripts/upstash-rate-limit.ts --bundle --format=cjs --platform=node --outfile=/tmp/upstash-rl.test.js`
Expected: completes, prints output size, no errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/upstash-rate-limit.ts scripts/upstash-rate-limit.spec.ts
git commit -m "feat(scripts): Upstash-backed checkRateLimit adapter for proxy hardening"
```

---

## Task 2: Wire hardening into examples-middleware

**Files:**
- Modify: `scripts/examples-middleware.ts`

- [ ] **Step 1: Read the current file**

Run: `cat scripts/examples-middleware.ts`

Confirm the final line is exactly:

```ts
module.exports = createProxyHandler({ resolveBackend, backendUrl: SHARED_DEPLOYMENT_URL });
```

and the top import is:

```ts
import { createProxyHandler } from './langgraph-proxy';
```

- [ ] **Step 2: Add the rate-limit import**

Replace the import line:

```ts
import { createProxyHandler } from './langgraph-proxy';
```

with:

```ts
import { createProxyHandler } from './langgraph-proxy';
import { checkRateLimit } from './upstash-rate-limit';
```

- [ ] **Step 3: Add the allowlist constant**

Immediately after the `SHARED_DEPLOYMENT_URL` declaration (the line `const SHARED_DEPLOYMENT_URL = '...';`), insert:

```ts

const ALLOWED_ORIGINS = [
  'https://examples.threadplane.ai',
  'https://cockpit.threadplane.ai',
  'http://localhost:4320',
  'http://localhost:4321',
] as const;
```

- [ ] **Step 4: Replace the handler export**

Replace:

```ts
module.exports = createProxyHandler({ resolveBackend, backendUrl: SHARED_DEPLOYMENT_URL });
```

with:

```ts
module.exports = createProxyHandler({
  resolveBackend,
  backendUrl: SHARED_DEPLOYMENT_URL,
  allowedOrigins: ALLOWED_ORIGINS,
  maxBodyBytes: 65536,
  checkRateLimit,
});
```

> `allowedOrigins` on the factory is typed `readonly string[]`; `as const` produces `readonly [...]` which is assignable. If TypeScript complains about the tuple literal, drop `as const` and annotate `const ALLOWED_ORIGINS: readonly string[] = [...]` instead.

- [ ] **Step 5: Typecheck the file**

Run: `npx tsc --noEmit scripts/examples-middleware.ts 2>&1 | grep -v "node_modules/@types/mdx" | grep -v "@upstash/redis/error" | head -20`
Expected: no errors referencing `examples-middleware.ts` or `upstash-rate-limit.ts`. (Pre-existing `@types/mdx` JSX and `@upstash/redis` ErrorOptions noise from the repo's tsconfig are filtered out and are unrelated.)

- [ ] **Step 6: Verify it bundles (this is what Vercel actually runs)**

Run: `npx esbuild scripts/examples-middleware.ts --bundle --format=cjs --platform=node --outfile=/tmp/examples-mw.test.js`
Expected: completes without errors; bundle includes the Upstash code (size jumps vs. the un-hardened bundle, ~200 KB+).

- [ ] **Step 7: Commit**

```bash
git add scripts/examples-middleware.ts
git commit -m "feat(examples-proxy): origin allowlist + Upstash rate limit + 64KB body cap"
```

---

## Task 3: Widen the CI examples-deploy trigger

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Locate the current glob**

Run: `grep -n "vercel\.examples\.json|scripts/assemble-examples" .github/workflows/ci.yml`
Expected: one match inside the `examples_changed` step, of the form:

```bash
if printf '%s\n' "$changed_files" | grep -E '^(vercel\.examples\.json|scripts/assemble-examples\.ts)$' >/dev/null; then
```

- [ ] **Step 2: Replace the glob**

Replace that single line's regex so it also matches the proxy source files. The new line:

```bash
          if printf '%s\n' "$changed_files" | grep -E '^(vercel\.examples\.json|scripts/(assemble-examples|examples-middleware|langgraph-proxy|upstash-rate-limit)\.ts)$' >/dev/null; then
```

(Preserve the leading indentation that the surrounding `run: |` block uses — match the existing line's whitespace exactly.)

- [ ] **Step 3: Validate the workflow YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('OK')"`
Expected: prints `OK`.

- [ ] **Step 4: Sanity-check the regex matches the intended files**

Run:
```bash
for f in scripts/examples-middleware.ts scripts/langgraph-proxy.ts scripts/upstash-rate-limit.ts scripts/assemble-examples.ts vercel.examples.json scripts/demo-middleware.ts; do
  echo "$f" | grep -E '^(vercel\.examples\.json|scripts/(assemble-examples|examples-middleware|langgraph-proxy|upstash-rate-limit)\.ts)$' >/dev/null && echo "MATCH   $f" || echo "no      $f";
done
```
Expected: MATCH for the first five; `no` for `scripts/demo-middleware.ts` (demo has its own trigger).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: redeploy examples when proxy source (middleware/langgraph-proxy/upstash) changes"
```

---

## Task 4: PR + merge

- [ ] **Step 1: Push the branch**

Run: `git push -u origin claude/examples-proxy-hardening`

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat(examples-proxy): harden langgraph proxy (origin + rate limit + body cap)" --body "$(cat <<'EOF'
## Summary

Backports the demo proxy's defense-in-depth onto the threadplane-examples LangGraph proxy, which had none (relied only on LangSmith billing).

- New \`scripts/upstash-rate-limit.ts\` — \`checkRateLimit(ip)\` token bucket (10/min) via Upstash, fail-open. Sibling to the Neon \`scripts/rate-limit.ts\`.
- \`scripts/examples-middleware.ts\` — pass \`allowedOrigins\` (examples + cockpit + localhost), \`maxBodyBytes: 65536\`, \`checkRateLimit\` into the unchanged \`createProxyHandler\`.
- \`.github/workflows/ci.yml\` — widen \`examples_changed\` so proxy-source edits actually redeploy (pre-existing gap).

Reuses the existing factory config surface; zero changes to \`scripts/langgraph-proxy.ts\`. Keeps the examples project on one rate-limit backend (Upstash) and hardcoded config, matching the adjacent \`ag-ui-proxy.ts\`.

Spec: \`docs/superpowers/specs/2026-06-06-examples-langgraph-proxy-hardening-design.md\`

## Test plan

- [ ] Unit: \`upstash-rate-limit.spec.ts\` (fail-open + shape) green.
- [ ] CI green; the widened trigger redeploys examples on merge.
- [ ] Post-merge: \`langgraph/streaming\` still runs in the cockpit Run tab (Origin examples.threadplane.ai passes).
- [ ] Post-merge: forbidden Origin → 403; >10 stream-runs/min → 429; >64KB body → 413; non-stream GET not throttled.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Arm auto-merge**

Run: `gh pr merge --squash --auto --delete-branch <PR_NUMBER>`

- [ ] **Step 4: Wait for green + merge**

Poll until merged. If the `Vercel – threadplane` website preview fails on a transient npm-registry 404 (a known flake — see this session's history), redeploy that preview via the Vercel API rather than assuming a real failure.

---

## Task 5: Post-merge production validation

Run after the post-merge `Deploy → Vercel` job completes and the examples deploy is live.

- [ ] **Step 1: Legitimate run still works (allowed origin)**

```bash
curl -sS --max-time 30 -X POST "https://examples.threadplane.ai/langgraph/streaming/api/threads/$(uuidgen)/runs/stream" \
  -H "Origin: https://examples.threadplane.ai" -H "content-type: application/json" \
  -d '{"assistant_id":"streaming","input":{"messages":[{"role":"user","content":"hi"}]}}' \
  -o /dev/null -w 'allowed_origin_run=%{http_code}\n'
```
Expected: `200` (or `2xx`). If the exact body shape is rejected by LangGraph Cloud, that's fine — anything other than `403/429/413` proves the proxy let it through to the backend.

- [ ] **Step 2: Forbidden origin → 403**

```bash
curl -sS -X POST "https://examples.threadplane.ai/langgraph/streaming/api/threads/$(uuidgen)/runs/stream" \
  -H "Origin: https://evil.example.com" -H "content-type: application/json" -d '{}' \
  -o /dev/null -w 'forbidden_origin=%{http_code}\n'
```
Expected: `403`.

- [ ] **Step 3: Oversized body → 413**

```bash
python3 -c "print('{\"x\":\"' + 'A'*70000 + '\"}')" > /tmp/big.json
curl -sS -X POST "https://examples.threadplane.ai/langgraph/streaming/api/threads/$(uuidgen)/runs/stream" \
  -H "Origin: https://examples.threadplane.ai" -H "content-type: application/json" --data @/tmp/big.json \
  -o /dev/null -w 'oversized_body=%{http_code}\n'
```
Expected: `413`.

- [ ] **Step 4: Rate limit → 429 after ~10/min**

```bash
for i in $(seq 1 14); do
  curl -sS --max-time 8 -X POST "https://examples.threadplane.ai/langgraph/streaming/api/threads/rl-$i/runs/stream" \
    -H "Origin: https://examples.threadplane.ai" -H "content-type: application/json" \
    -d '{"assistant_id":"streaming","input":{"messages":[]}}' -o /dev/null -w '%{http_code}\n' &
done
wait
```
Expected: a mix — several `429` once the bucket drains (exact count depends on prior traffic in the window).

- [ ] **Step 5: Non-stream GET is not throttled**

```bash
curl -sS "https://examples.threadplane.ai/langgraph/streaming/" -o /dev/null -w 'spa=%{http_code}\n'
```
Expected: `200` (the SPA; rate limit only applies to `POST .../runs/stream`).

---

## Self-Review

- [ ] **Spec coverage:** §Decisions (Upstash, hardcoded, 64KB) → Tasks 1-2. §Components/files → Tasks 1-3. §Testing → Task 1 + Task 2 bundle check. §Validation → Task 5. CI gap → Task 3.
- [ ] **No placeholders:** every code/command step has literal content.
- [ ] **Type consistency:** `RateLimitResult` (Task 1) matches the factory's `{allowed, retryAfterSec, count}`; `checkRateLimit` exported in Task 1, imported in Task 2; `ALLOWED_ORIGINS`/`maxBodyBytes: 65536` consistent with spec's 64 KB.
