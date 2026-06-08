# examples/ag-ui Deploy Implementation Plan (Part 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the standalone `examples/ag-ui` demo to **`ag-ui.threadplane.ai`** — Angular SPA on a dedicated Vercel project, uvicorn `ag-ui-langgraph` backend on a dedicated Railway service, fronted by a hardened proxy. CI deploys on push to main.

**Architecture:** Mirrors the canonical-demo deploy (`scripts/assemble-demo.ts` + `scripts/demo-middleware.ts` + the `threadplane-demo` Vercel project) and the `ag-ui-dev` Railway pattern (`deployments/ag-ui-dev/{Dockerfile,entrypoint.sh,railway.json}`). The example's Docker artifacts live in `examples/ag-ui/python/` (self-contained). A new `scripts/ag-ui-demo-middleware.ts` proxies `/agent*` → the Railway service with origin allowlist + Upstash rate-limit + `X-Internal-Token` injection; `scripts/assemble-ag-ui-demo.ts` builds the SPA + Build Output config.

**Tech Stack:** Docker (python:3.12-slim), Railway, Vercel Build Output API, esbuild, `@upstash/ratelimit`/`@upstash/redis`, GitHub Actions. Reference patterns: `deployments/ag-ui-dev/*`, `scripts/{assemble-demo,demo-middleware,ag-ui-proxy}.ts`.

**Spec:** `docs/superpowers/specs/2026-06-06-examples-ag-ui-standalone-design.md` (Part 3). Branches off main (Parts 1/2a/2b + #616 merged). Domain: `ag-ui.threadplane.ai` (per user).

**Naming:** Railway service `ag-ui-demo`; Vercel project `threadplane-ag-ui-demo`; public domain `ag-ui.threadplane.ai`. (Distinct from the cockpit `ag-ui-dev` runtime service.)

---

## File Structure

**New:**
- `examples/ag-ui/python/{Dockerfile,entrypoint.sh,railway.json}` — Railway build (server.py + requirements.txt already exist from Part 2a).
- `scripts/ag-ui-demo-middleware.ts` — Vercel Node proxy → Railway `/agent`.
- `scripts/assemble-ag-ui-demo.ts` — build SPA + Build Output config + bundle the proxy.
- `.github/workflows/` change or `ci.yml` jobs — `examples/ag-ui — e2e`, `ag-ui demo → Vercel` deploy, production smoke probe.

**Provisioning (via API, by the controller — not a repo change):** Railway service + project deploy token (→ GitHub secret `AG_UI_DEMO_RAILWAY_TOKEN`) + env (`OPENAI_API_KEY`, `AG_UI_INTERNAL_TOKEN`); Vercel project `threadplane-ag-ui-demo` + custom domain `ag-ui.threadplane.ai` + env (`AG_UI_INTERNAL_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`); GitHub secrets for Vercel project id.

---

## Task 1: Docker artifacts for the Railway backend

**Files:** create `examples/ag-ui/python/{Dockerfile,entrypoint.sh,railway.json}`

- [ ] **Step 1: Copy + adapt the proven ag-ui-dev artifacts**

Read `deployments/ag-ui-dev/Dockerfile`, `entrypoint.sh`, `railway.json`. They build a python:3.12-slim image from a `requirements.txt` + run uvicorn with a watchdog on `/ok`. Adapt for the example's own tree:

`examples/ag-ui/python/Dockerfile`:
```dockerfile
# Multi-stage build for the ag-ui demo backend (examples/ag-ui).
FROM python:3.12-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
COPY . .
RUN chmod +x entrypoint.sh
EXPOSE 8000
CMD ["./entrypoint.sh"]
```
> The build context is `examples/ag-ui/python/` so `COPY . .` brings `src/` (graph + server.py), `requirements.txt`, etc. Confirm `requirements.txt` exists (committed in Part 2a) and includes `ag-ui-langgraph`, `fastapi`, `uvicorn`.

`examples/ag-ui/python/entrypoint.sh` (copy `deployments/ag-ui-dev/entrypoint.sh` verbatim — it runs `uvicorn server:app`... NOTE: the ag-ui-dev server module is `server` at repo root of the image; here the module is `src.server`). Adapt the uvicorn invocation to `src.server:app`:
```bash
#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-8000}"
uvicorn src.server:app --host 0.0.0.0 --port "${PORT}" &
UVICORN_PID=$!
sleep 180  # startup grace
STRIKES=0
while kill -0 "${UVICORN_PID}" 2>/dev/null; do
  sleep 30
  if curl -fsS "http://127.0.0.1:${PORT}/ok" >/dev/null; then
    STRIKES=0
  else
    STRIKES=$((STRIKES + 1))
    echo "watchdog: strike ${STRIKES}/3" >&2
    if [ "${STRIKES}" -ge 3 ]; then
      echo "watchdog: 3 strikes, killing uvicorn" >&2
      kill "${UVICORN_PID}" || true
      exit 1
    fi
  fi
done
wait "${UVICORN_PID}"
```

`examples/ag-ui/python/railway.json` (copy `deployments/ag-ui-dev/railway.json` verbatim):
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "healthcheckPath": "/ok",
    "healthcheckTimeout": 60,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

- [ ] **Step 2: chmod + verify**

```bash
git update-index --add --chmod=+x examples/ag-ui/python/entrypoint.sh 2>/dev/null || chmod +x examples/ag-ui/python/entrypoint.sh
grep -n "src.server:app" examples/ag-ui/python/entrypoint.sh
```
Expected: the uvicorn line targets `src.server:app`.

- [ ] **Step 3: Commit**

```bash
git add examples/ag-ui/python/Dockerfile examples/ag-ui/python/entrypoint.sh examples/ag-ui/python/railway.json
git commit -m "feat(examples/ag-ui): Railway Docker artifacts (Dockerfile + watchdog entrypoint + railway.json)"
```

---

## Task 2: Vercel proxy + assemble script

**Files:** create `scripts/ag-ui-demo-middleware.ts`, `scripts/assemble-ag-ui-demo.ts`

- [ ] **Step 1: Write `scripts/ag-ui-demo-middleware.ts`**

Mirror `scripts/ag-ui-proxy.ts` (origin allowlist + Upstash rate-limit fail-open + `X-Internal-Token` injection + streaming fetch) but single-backend: forward `/agent*` → `${RAILWAY}/agent*` (no topic parsing).

```ts
// scripts/ag-ui-demo-middleware.ts
// SPDX-License-Identifier: MIT
/**
 * Vercel Node serverless proxy for the examples/ag-ui demo
 * (ag-ui.threadplane.ai). Forwards /agent* to the Railway-hosted
 * ag-ui-langgraph backend with origin allowlist + Upstash rate-limit
 * (fail-open) + X-Internal-Token injection. Bundled by
 * scripts/assemble-ag-ui-demo.ts into functions/api/[[...path]].func.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const RAILWAY_BASE_URL =
  process.env['AG_UI_DEMO_RAILWAY_URL'] ?? 'https://ag-ui-demo-production.up.railway.app';

const ALLOWED_ORIGINS = new Set<string>([
  'https://ag-ui.threadplane.ai',
  'http://localhost:4201',
]);

let ratelimit: Ratelimit | null = null;
function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) return null;
  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.tokenBucket(10, '60 s', 10),
    analytics: false,
    prefix: 'ag-ui-demo',
  });
  return ratelimit;
}

interface VercelRequest { method?: string; headers: Record<string, string | string[] | undefined>; body: unknown; url?: string; }
interface VercelResponse { setHeader(k: string, v: string): void; status(c: number): VercelResponse; json(b: unknown): void; write(c: Buffer | string): void; end(): void; }

function header(headers: VercelRequest['headers'], k: string): string | undefined {
  const v = headers[k];
  return Array.isArray(v) ? v[0] : v;
}
function extractIp(headers: VercelRequest['headers']): string {
  const fwd = header(headers, 'x-forwarded-for');
  const first = fwd?.split(',')[0]?.trim();
  return first || header(headers, 'x-real-ip')?.trim() || `anon:${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');

  const origin = header(req.headers, 'origin');
  if (origin) {
    if (!ALLOWED_ORIGINS.has(origin)) { res.status(403).json({ error: 'origin_not_allowed' }); return; }
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'origin');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const internalToken = process.env['AG_UI_INTERNAL_TOKEN'];
  if (!internalToken) { res.status(500).json({ error: 'misconfigured', detail: 'AG_UI_INTERNAL_TOKEN unset' }); return; }

  // Vercel preserves the original request URL (/agent...) since the route
  // dest names the [[...path]] function.
  const u = new URL(req.url ?? '', 'http://placeholder');
  if (!u.pathname.startsWith('/agent')) { res.status(404).json({ error: 'not_found' }); return; }

  const rl = getRatelimit();
  if (rl) {
    const v = await rl.limit(extractIp(req.headers));
    if (!v.success) { res.setHeader('retry-after', '60'); res.status(429).json({ error: 'rate_limit_exceeded' }); return; }
  }

  const upstreamUrl = `${RAILWAY_BASE_URL}${u.pathname}${u.search}`;
  const headers: Record<string, string> = { 'x-internal-token': internalToken };
  const ct = header(req.headers, 'content-type'); if (ct) headers['content-type'] = ct;
  const acc = header(req.headers, 'accept'); if (acc) headers['accept'] = acc;
  let body: string | undefined;
  if (req.method && !['GET', 'HEAD'].includes(req.method)) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    if (!headers['content-type']) headers['content-type'] = 'application/json';
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { method: req.method ?? 'POST', headers, body });
  } catch (err) { res.status(502).json({ error: 'upstream_unreachable', detail: (err as Error).message }); return; }

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length'].includes(key.toLowerCase())) return;
    res.setHeader(key, value);
  });
  if (!upstream.body) { res.end(); return; }
  const reader = upstream.body.getReader();
  while (true) { const { done, value } = await reader.read(); if (done) break; res.write(Buffer.from(value)); }
  res.end();
};
```

- [ ] **Step 2: Write `scripts/assemble-ag-ui-demo.ts`** (mirror `scripts/assemble-demo.ts`)

Read `scripts/assemble-demo.ts` fully and mirror it with these swaps: build `examples-ag-ui-angular` (→ `dist/examples/ag-ui/angular`), deploy dir `deploy/ag-ui-demo`, bundle `scripts/ag-ui-demo-middleware.ts`. The route table forwards `/agent*` to the function:
```ts
writeFileSync(resolve(outputDir, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '^/agent(/.*)?$', dest: '/api/[[...path]]', check: true },
    { handle: 'filesystem' },
    { src: '.*', dest: '/index.html' },
  ],
}, null, 2));
```
Keep assemble-demo's `__build.json` metadata + static dir + `.vc-config.json` (nodejs20.x) structure identical; only the project name, paths, middleware file, and the `/agent` route differ.

- [ ] **Step 3: Verify both bundle/build locally**

```bash
npx esbuild scripts/ag-ui-demo-middleware.ts --bundle --format=cjs --platform=node --outfile=/tmp/ag-ui-demo-mw.js && echo "proxy bundles OK"
npx tsx scripts/assemble-ag-ui-demo.ts 2>&1 | tail -8
ls deploy/ag-ui-demo/.vercel/output/config.json deploy/ag-ui-demo/.vercel/output/functions/api/[[...path]].func/index.js
cat deploy/ag-ui-demo/.vercel/output/config.json
```
Expected: assemble completes; config.json has the `/agent` route; the function bundle exists. Add `deploy/` to `.gitignore` if not already ignored (it is, from the housekeeping PR).

- [ ] **Step 4: Commit**

```bash
git add scripts/ag-ui-demo-middleware.ts scripts/assemble-ag-ui-demo.ts
git commit -m "feat(examples/ag-ui): vercel proxy + assemble-ag-ui-demo (Build Output)"
```

---

## Task 3: CI — e2e + deploy + smoke

**Files:** modify `.github/workflows/ci.yml`

- [ ] **Step 1: Add an `examples/ag-ui — e2e` job**

Mirror the `examples/chat — e2e` job (read it in ci.yml). It must: checkout, setup node + uv + python, `npm ci`, `uv sync` in `examples/ag-ui/python`, `npx nx e2e examples-ag-ui-angular`. The harness auto-starts aimock + uvicorn + nx serve. Path-filter / scope it under the CI-scope mechanism if the repo uses one (mirror how examples-chat-e2e is gated). Wire it into the `CI — required` aggregation if examples-chat-e2e is.

- [ ] **Step 2: Add an `ag-ui demo → Vercel` deploy job**

Mirror the `Canonical demo → Vercel` job (read it). It must, on push to main when `examples/ag-ui/**` or the assemble/proxy scripts change:
1. Gate on the `examples/ag-ui — e2e` job succeeding (refuse-on-red, like the demo guard).
2. `npx tsx scripts/assemble-ag-ui-demo.ts`.
3. Deploy the SPA: `cd deploy/ag-ui-demo`, write `.vercel/project.json` with `secrets.VERCEL_AG_UI_DEMO_PROJECT_ID` + `secrets.VERCEL_ORG_ID`, `npx vercel pull --yes --environment=production --token=...`, `npx vercel deploy --prebuilt --prod --yes --token=...`.
4. Deploy the backend: `cd examples/ag-ui/python && npx --yes @railway/cli@4 up --service ag-ui-demo --detach` with `RAILWAY_TOKEN: secrets.AG_UI_DEMO_RAILWAY_TOKEN`.

- [ ] **Step 3: Add a production smoke probe** (to `apps/cockpit/e2e/production-smoke.spec.ts`)

```ts
test.describe('ag-ui demo (ag-ui.threadplane.ai)', () => {
  const DEMO = process.env['AG_UI_DEMO_URL'] ?? 'https://ag-ui.threadplane.ai';
  test('demo SPA is reachable', async ({ page }) => {
    const res = await page.goto(`${DEMO}/`);
    expect(res?.status()).toBeLessThan(400);
  });
  test('forbidden origin to /agent is rejected', async ({ request }) => {
    const res = await request.post(`${DEMO}/agent`, {
      headers: { Origin: 'https://evil.example.com', 'content-type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(403);
  });
});
```

- [ ] **Step 4: Validate YAML + commit**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('OK')"
git add .github/workflows/ci.yml apps/cockpit/e2e/production-smoke.spec.ts
git commit -m "ci: examples/ag-ui e2e + ag-ui demo deploy (Railway + Vercel) + smoke"
```

---

## Task 4: Provision cloud resources (controller, via API)

> This task is performed by the controller (not a subagent) using the Railway + Vercel + GitHub APIs, mirroring the ag-ui-dev provisioning. It is documented here for completeness.

- [ ] Railway: create project + service `ag-ui-demo`; generate domain; mint a project deploy token → GitHub secret `AG_UI_DEMO_RAILWAY_TOKEN`. Set service env: `OPENAI_API_KEY`, `AG_UI_INTERNAL_TOKEN` (reuse the existing one or mint a new one shared with Vercel). Capture the real domain → if not `ag-ui-demo-production.up.railway.app`, update the proxy default + smoke env.
- [ ] Vercel: create project `threadplane-ag-ui-demo` (org = cacheplane team); add custom domain `ag-ui.threadplane.ai`; set env `AG_UI_INTERNAL_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. GitHub secret `VERCEL_AG_UI_DEMO_PROJECT_ID`.
- [ ] OpenAI: confirm the $50/mo cap covers this project's key (reuse the ag-ui-dev key/cap).

---

## Task 5: PR + post-merge verification

- [ ] **Step 1:** Push branch, open PR (`feat(examples/ag-ui): deploy to ag-ui.threadplane.ai (Part 3)`), arm auto-merge.
- [ ] **Step 2:** After merge, the `ag-ui demo → Vercel` job runs. Verify:
  - `curl -fsS https://ag-ui-demo-production.up.railway.app/ok` → `{"ok":true}` (or the real domain).
  - `curl -sS -o /dev/null -w '%{http_code}' https://ag-ui.threadplane.ai/` → `200`.
  - `curl -sS -X POST https://ag-ui.threadplane.ai/agent -H 'Origin: https://evil.example.com' -d '{}' -w '%{http_code}'` → `403`.
  - Open `https://ag-ui.threadplane.ai/` in a browser, send "Demo: render a feedback form" → an a2ui surface renders (the full parity demo, live).

---

## Self-Review

- [ ] **Spec coverage (Part 3):** Railway Docker → Task 1. Vercel proxy + assemble → Task 2. CI e2e + deploy + smoke → Task 3. Provisioning → Task 4. Domain `ag-ui.threadplane.ai` used in proxy allowlist + smoke + Vercel domain.
- [ ] **No placeholders:** proxy + Dockerfile + entrypoint have full content; assemble + CI jobs are mirror-of-named-file with explicit swaps.
- [ ] **Consistency:** Railway service `ag-ui-demo`, Vercel project `threadplane-ag-ui-demo`, domain `ag-ui.threadplane.ai`, secret names `AG_UI_DEMO_RAILWAY_TOKEN`/`VERCEL_AG_UI_DEMO_PROJECT_ID` consistent across proxy/assemble/CI/provisioning. The `[[...path]]` function is named in the route dest (Build Output rule). entrypoint targets `src.server:app`.
- [ ] **Vercel Build Output lesson:** standalone project (no /api langgraph proxy), so `/agent → /api/[[...path]]` is safe; the function receives the original `/agent` URL.
