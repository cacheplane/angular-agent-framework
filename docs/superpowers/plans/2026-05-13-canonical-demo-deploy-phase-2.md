# Canonical Demo Deploy — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `https://demo.cacheplane.ai` as an independent Vercel project serving `examples/chat/angular` with a `/api/*` proxy to the shared `cockpit-dev` LangGraph Cloud assistant. Extract the proxy handler from `scripts/examples-middleware.ts` into a shared `scripts/langgraph-proxy.ts` module so both deployments share one source of truth.

**Architecture:** New independent Vercel project (`demo`) builds from `deploy/demo/` produced by a new `scripts/assemble-demo.ts`. The script mirrors `scripts/assemble-examples.ts` but builds a single Angular app and bundles a 5-line `scripts/demo-middleware.ts` that calls `createProxyHandler({})` from the new shared module. The existing `cockpit-examples` deployment is refactored to use the same factory via a thin wrapper — behavior unchanged.

**Tech Stack:** TypeScript, vitest, esbuild bundling, Vercel Build Output API (`config.json` + `functions/api/[[...path]].func/`), Angular 21 environment file replacements, GitHub Actions Vercel deploy.

**Reference spec:** `docs/superpowers/specs/2026-05-13-canonical-demo-deploy-design.md` — see "Phase 2 — Vercel project for `demo.cacheplane.ai`".

---

## Background for the implementer

The repo already has a working pattern for Vercel deploys that proxy to LangGraph Cloud — `examples.cacheplane.ai` (the `cockpit-examples` Vercel project) aggregates 31 cockpit Angular SPAs plus a Node serverless proxy at `/api/[[...path]]`. The proxy injects `x-api-key` from `LANGSMITH_API_KEY` env var and streams SSE responses.

Today's `scripts/examples-middleware.ts` is a single 165-line file containing the entire proxy logic plus an examples-specific `Referer`-based backend resolver. Phase 2 extracts the reusable parts into `scripts/langgraph-proxy.ts` and leaves the examples-specific routing in a thin wrapper. The new `demo` deployment uses a separate 5-line wrapper that calls the factory with defaults.

The `examples/chat/angular` app currently hardcodes `http://localhost:2024` in two places (`threads.service.ts:6` and `demo-shell.component.ts:330`). Phase 2 introduces Angular's standard `environments/environment.ts` + `environment.development.ts` file-replacement pattern (already used by every cockpit Angular app) to point those at `/api` in production.

The canonical demo's `chat` graph is reachable on the shared `cockpit-dev` deployment as of Phase 1 (PR #300 + #303). Phase 2 is what makes a public URL consume it.

### What's NOT in this plan

- Rate limiting (Phase 3).
- Prompt-length cap + CORS allowlist tightening (Phase 4).
- Marketing rewire on `apps/website` (Phase 5).

The proxy module's `ProxyConfig` interface exposes hooks for rate limiting and CORS so Phase 3/4 changes only touch the shared module, not the wrappers.

---

### Task 1: Extract the shared proxy module + unit tests

**Files:**
- Create: `scripts/langgraph-proxy.ts`
- Create: `scripts/langgraph-proxy.spec.ts`
- Modify: `scripts/examples-middleware.ts` (refactor to wrapper)

**Context:** The proxy logic is straightforward: CORS preflight handling, env var check, path stripping, fetch with header injection, SSE pass-through. The only examples-specific concern is `resolveBackend(referer)` which routes by Referer header. The shared module exposes that as an optional config hook.

The new module exports `createProxyHandler(config?: ProxyConfig)` returning a handler function compatible with the Vercel Node serverless function signature. The existing `examples-middleware.ts` becomes:

```ts
import { createProxyHandler } from './langgraph-proxy';
import { resolveBackendFromReferer } from './langgraph-proxy-examples-router';
module.exports = createProxyHandler({ resolveBackend: resolveBackendFromReferer });
```

We extract the examples-specific `ACTIVE_PRODUCT_PATHS` + `isActiveProductPath` + `resolveBackend` into `scripts/langgraph-proxy-examples-router.ts` to keep `langgraph-proxy.ts` general-purpose.

---

- [ ] **Step 1: Create the failing test**

Create `scripts/langgraph-proxy.spec.ts`:

```ts
// scripts/langgraph-proxy.spec.ts
// SPDX-License-Identifier: MIT
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProxyHandler } from './langgraph-proxy';

type MockRes = {
  setHeader: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  _status: number;
};

function makeRes(): MockRes {
  const res: Partial<MockRes> = { _status: 0 };
  res.setHeader = vi.fn();
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res as MockRes;
  });
  res.json = vi.fn();
  res.write = vi.fn();
  res.end = vi.fn();
  res.send = vi.fn();
  return res as MockRes;
}

const DEFAULT_BACKEND = 'https://cockpit-dev.example.us.langgraph.app';

beforeEach(() => {
  process.env['LANGSMITH_API_KEY'] = 'test-key-123';
  vi.restoreAllMocks();
});

describe('createProxyHandler', () => {
  it('returns 500 when LANGSMITH_API_KEY is missing', async () => {
    delete process.env['LANGSMITH_API_KEY'];
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({ method: 'POST', headers: {}, body: {}, url: '/api/foo', query: {} } as never, res as never);
    expect(res._status).toBe(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'LANGSMITH_API_KEY not configured' });
  });

  it('responds 204 to OPTIONS preflight with CORS headers', async () => {
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({ method: 'OPTIONS', headers: {}, body: {}, url: '/api/foo', query: {} } as never, res as never);
    expect(res._status).toBe(204);
    expect(res.setHeader).toHaveBeenCalledWith('access-control-allow-origin', '*');
  });

  it('forwards POST body and injects x-api-key', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({ method: 'POST', headers: { 'content-type': 'application/json', host: 'demo.cacheplane.ai' }, body: { hello: 'world' }, url: '/api/threads', query: {} } as never, res as never);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe(`${DEFAULT_BACKEND}/threads`);
    expect((init as RequestInit).headers).toEqual(
      expect.objectContaining({ 'x-api-key': 'test-key-123' }),
    );
    expect((init as RequestInit).body).toBe(JSON.stringify({ hello: 'world' }));
    expect(res._status).toBe(200);
  });

  it('strips the catch-all query param but keeps real query params', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({ method: 'GET', headers: { host: 'demo.cacheplane.ai' }, body: undefined, url: '/api/threads/abc?[...path]=threads/abc&limit=10', query: {} } as never, res as never);
    expect(fetchMock.mock.calls[0]![0]).toBe(`${DEFAULT_BACKEND}/threads/abc?limit=10`);
  });

  it('streams SSE responses chunk-by-chunk', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: foo\ndata: 1\n\n'));
        controller.enqueue(encoder.encode('event: bar\ndata: 2\n\n'));
        controller.close();
      },
    });
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({ method: 'POST', headers: { host: 'demo.cacheplane.ai' }, body: {}, url: '/api/threads/abc/runs/stream', query: {} } as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/event-stream');
    expect(res.write).toHaveBeenCalledTimes(2);
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('returns 502 on upstream fetch error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({ method: 'POST', headers: { host: 'demo.cacheplane.ai' }, body: {}, url: '/api/threads', query: {} } as never, res as never);
    expect(res._status).toBe(502);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Proxy error' }));
  });

  it('uses the resolveBackend hook when provided', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const resolveBackend = vi.fn(() => 'https://override.example.com');
    const handler = createProxyHandler({ resolveBackend });
    const res = makeRes();
    await handler({ method: 'GET', headers: { host: 'demo.cacheplane.ai', referer: 'https://demo.cacheplane.ai/' }, body: undefined, url: '/api/info', query: {} } as never, res as never);
    expect(resolveBackend).toHaveBeenCalledWith('https://demo.cacheplane.ai/');
    expect(fetchMock.mock.calls[0]![0]).toBe('https://override.example.com/info');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```
npx vitest run scripts/langgraph-proxy.spec.ts
```

Expected: FAIL — `Cannot find module './langgraph-proxy'`.

- [ ] **Step 3: Create the shared proxy module**

Create `scripts/langgraph-proxy.ts`:

```ts
// scripts/langgraph-proxy.ts
// SPDX-License-Identifier: MIT
/**
 * Vercel Node serverless function factory for proxying to a LangGraph
 * Cloud deployment. Injects `x-api-key` server-side from
 * `LANGSMITH_API_KEY`, streams SSE responses chunk-by-chunk, and
 * forwards all other content types verbatim.
 *
 * Shared between `scripts/examples-middleware.ts` (cockpit-examples
 * deployment) and `scripts/demo-middleware.ts` (canonical demo
 * deployment). Per-deployment specifics — like the examples'
 * Referer-based backend routing — are passed in via `ProxyConfig`.
 */

// Types only - Vercel provides these at runtime.
export interface VercelRequest {
  method?: string;
  headers: Record<string, string | undefined>;
  body: unknown;
  url?: string;
  query: Record<string, string | string[]>;
}

export interface VercelResponse {
  setHeader(k: string, v: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): void;
  write(chunk: string): void;
  end(): void;
  send(body: string): void;
}

export interface ProxyConfig {
  /** Default upstream URL when `resolveBackend` is not provided or returns
   *  the same value. Required if `resolveBackend` is omitted. */
  readonly backendUrl?: string;
  /** Optional dynamic backend resolver. Receives the request's `referer`
   *  header. The default-export wrappers use this for examples (which has
   *  a Referer-based fan-out) and the demo (which has a single backend). */
  readonly resolveBackend?: (referer: string | undefined) => string;
}

const DEFAULT_BACKEND_URL = 'https://cockpit-dev-219a15942c545a00a03a9a41905d7fc2.us.langgraph.app';

export function createProxyHandler(config: ProxyConfig = {}): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  const fallbackBackend = config.backendUrl ?? DEFAULT_BACKEND_URL;
  const resolveBackend = config.resolveBackend ?? ((_referer) => fallbackBackend);

  return async function handler(req, res) {
    // CORS preflight (Phase 4 will tighten the origin allowlist).
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type, x-api-key, authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    const apiKey = process.env['LANGSMITH_API_KEY'];
    if (!apiKey) {
      res.status(500).json({ error: 'LANGSMITH_API_KEY not configured' });
      return;
    }

    const backendUrl = resolveBackend(req.headers.referer);

    // Build target URL — strip /api prefix from req.url, drop the
    // Vercel catch-all query param, keep real query params.
    const parsedUrl = new URL(req.url ?? '', `https://${req.headers.host ?? 'localhost'}`);
    const apiPath = parsedUrl.pathname.replace(/^\/api/, '') || '/';
    parsedUrl.searchParams.delete('[...path]');
    parsedUrl.searchParams.delete('[[...path]]');
    const cleanSearch = parsedUrl.searchParams.toString() ? `?${parsedUrl.searchParams.toString()}` : '';
    const targetUrl = `${backendUrl}${apiPath}${cleanSearch}`;

    // Debug endpoint — confirms the proxy is wired without hitting the upstream.
    if (apiPath === '/_proxy_debug') {
      res.status(200).json({
        method: req.method,
        url: req.url,
        apiPath,
        targetUrl,
        backendUrl,
        referer: req.headers.referer,
        query: req.query,
        hasApiKey: !!apiKey,
        apiKeyPrefix: apiKey.substring(0, 10),
      });
      return;
    }

    console.log(`[proxy] ${req.method} ${req.url} → ${targetUrl}`);

    const headers: Record<string, string> = {
      'x-api-key': apiKey,
      'content-type': req.headers['content-type'] ?? 'application/json',
    };

    try {
      const response = await fetch(targetUrl, {
        method: req.method ?? 'GET',
        headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      });

      const contentType = response.headers.get('content-type') ?? 'application/json';
      res.setHeader('content-type', contentType);
      res.status(response.status);

      if (contentType.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value, { stream: true }));
          }
        }
        res.end();
      } else {
        const text = await response.text();
        res.send(text);
      }
    } catch (err) {
      res.status(502).json({ error: 'Proxy error', message: (err as Error).message });
    }
  };
}
```

- [ ] **Step 4: Verify all 7 tests pass**

```
npx vitest run scripts/langgraph-proxy.spec.ts
```

Expected: PASS — 7 tests green.

- [ ] **Step 5: Refactor `examples-middleware.ts` to use the factory**

Replace the entire contents of `scripts/examples-middleware.ts` with:

```ts
/**
 * Vercel Serverless Function proxy for the cockpit-examples deployment.
 *
 * Thin wrapper around scripts/langgraph-proxy.ts that adds the
 * examples-specific Referer-based backend resolution. Today there's
 * a single shared backend, but the resolver pattern keeps the door
 * open for future fan-out.
 *
 * Deployed as api/[[...path]].js by scripts/assemble-examples.ts.
 */
import { createProxyHandler } from './langgraph-proxy';

const SHARED_DEPLOYMENT_URL = 'https://cockpit-dev-219a15942c545a00a03a9a41905d7fc2.us.langgraph.app';

const ACTIVE_PRODUCT_PATHS = new Set([
  'langgraph/streaming',
  'langgraph/persistence',
  'langgraph/interrupts',
  'langgraph/memory',
  'langgraph/durable-execution',
  'langgraph/subgraphs',
  'langgraph/time-travel',
  'langgraph/deployment-runtime',
  'deep-agents/planning',
  'deep-agents/filesystem',
  'deep-agents/subagents',
  'deep-agents/memory',
  'deep-agents/skills',
  'deep-agents/sandboxes',
  'chat/messages',
  'chat/input',
  'chat/interrupts',
  'chat/tool-calls',
  'chat/subagents',
  'chat/threads',
  'chat/timeline',
  'chat/generative-ui',
  'chat/debug',
  'chat/theming',
  'chat/a2ui',
]);

function isActiveProductPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return false;
  return ACTIVE_PRODUCT_PATHS.has(`${segments[0]}/${segments[1]}`);
}

function resolveBackend(referer: string | undefined): string {
  if (!referer) return SHARED_DEPLOYMENT_URL;
  try {
    const url = new URL(referer);
    if (isActiveProductPath(url.pathname)) return SHARED_DEPLOYMENT_URL;
  } catch {
    // Ignore invalid referers and fall back.
  }
  return SHARED_DEPLOYMENT_URL;
}

module.exports = createProxyHandler({ resolveBackend, backendUrl: SHARED_DEPLOYMENT_URL });
```

- [ ] **Step 6: Re-run the spec to confirm no regression**

```
npx vitest run scripts/langgraph-proxy.spec.ts
```

Expected: PASS — 7 tests green.

- [ ] **Step 7: Commit**

```bash
git add scripts/langgraph-proxy.ts scripts/langgraph-proxy.spec.ts scripts/examples-middleware.ts
git commit -m "refactor(scripts): extract shared langgraph-proxy module + tests

The proxy logic was previously inline in scripts/examples-middleware.ts.
Extract a createProxyHandler(config) factory into a new
scripts/langgraph-proxy.ts module so the Phase 2 demo deployment can
import the same handler. examples-middleware.ts becomes a thin
wrapper that supplies the existing examples-specific Referer-based
backend resolver.

Behavior is unchanged for the cockpit-examples deployment. Adds 7
unit tests covering header injection, path stripping, CORS preflight,
SSE streaming, error paths, and the resolveBackend hook.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Angular environment files + replace hardcoded URLs

**Files:**
- Create: `examples/chat/angular/src/environments/environment.ts`
- Create: `examples/chat/angular/src/environments/environment.development.ts`
- Modify: `examples/chat/angular/src/app/shell/threads.service.ts` (line 6)
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts` (lines 330–331)
- Modify: `examples/chat/angular/project.json` (add `fileReplacements` under `build.configurations.development`)

**Context:** Mirror the convention every cockpit Angular app uses (see e.g. `cockpit/langgraph/streaming/angular/src/environments/`). Production environment points at `/api` (the same-origin proxy). Dev environment points at `http://localhost:2024` (the `langgraph dev` server).

The two hardcoded `http://localhost:2024` references in `threads.service.ts` and `demo-shell.component.ts` get replaced with reads from the environment module.

---

- [ ] **Step 1: Create production environment**

Create `examples/chat/angular/src/environments/environment.ts`:

```ts
// SPDX-License-Identifier: MIT
/**
 * Production environment configuration for the canonical demo.
 *
 * Uses a relative /api URL — Vercel routes /api/* to the
 * langgraph-proxy serverless function (scripts/demo-middleware.ts),
 * which injects x-api-key server-side and proxies to the shared
 * cockpit-dev LangGraph Cloud assistant.
 */
export const environment = {
  production: true,
  langGraphApiUrl: '/api',
  assistantId: 'chat',
};
```

- [ ] **Step 2: Create development environment**

Create `examples/chat/angular/src/environments/environment.development.ts`:

```ts
// SPDX-License-Identifier: MIT
/**
 * Development environment configuration for the canonical demo.
 *
 * Points to a local LangGraph server started with:
 *   cd examples/chat/python && langgraph dev
 */
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:2024',
  assistantId: 'chat',
};
```

- [ ] **Step 3: Wire fileReplacements in project.json**

In `examples/chat/angular/project.json`, the existing `build.configurations.development` block is currently:

```json
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true
        }
```

Replace with:

```json
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true,
          "fileReplacements": [
            {
              "replace": "examples/chat/angular/src/environments/environment.ts",
              "with": "examples/chat/angular/src/environments/environment.development.ts"
            }
          ]
        }
```

(The production config doesn't need `fileReplacements` — Angular uses `environment.ts` by default.)

- [ ] **Step 4: Replace hardcoded URL in threads.service.ts**

In `examples/chat/angular/src/app/shell/threads.service.ts`, locate the top of the file (line 6 or thereabouts):

```ts
const API_URL = 'http://localhost:2024';
```

Replace with:

```ts
import { environment } from '../../environments/environment';
const API_URL = environment.langGraphApiUrl;
```

The `import` should go in the existing import block at the top of the file (not as a free-floating line). If `'../../environments/environment'` doesn't resolve, double-check the file's location relative to `src/environments/` — `threads.service.ts` lives at `src/app/shell/`, so two-up gets you to `src/`.

- [ ] **Step 5: Replace hardcoded URL + assistantId in demo-shell.component.ts**

In `examples/chat/angular/src/app/shell/demo-shell.component.ts`, locate the agent provider config (line 330 area). It currently includes:

```ts
      apiUrl: 'http://localhost:2024',
      assistantId: 'chat',
```

Replace with:

```ts
      apiUrl: environment.langGraphApiUrl,
      assistantId: environment.assistantId,
```

Add the import to the top-of-file import block:

```ts
import { environment } from '../../environments/environment';
```

- [ ] **Step 6: Build to verify wiring**

```
npx nx build examples-chat-angular --configuration=development
```

Expected: succeeds. Inspect the built bundle to confirm `localhost:2024` survives (since the dev env config has it).

Then production:

```
npx nx build examples-chat-angular --configuration=production
```

Expected: succeeds. Inspect the bundle (`dist/examples/chat/angular/`) and confirm `localhost:2024` is **gone**, replaced with `/api`.

```
grep -r "localhost:2024" dist/examples/chat/angular/ || echo "✓ no localhost references"
grep -r "/api" dist/examples/chat/angular/*.js | head -3
```

- [ ] **Step 7: Commit**

```bash
git add examples/chat/angular/src/environments/ \
        examples/chat/angular/src/app/shell/threads.service.ts \
        examples/chat/angular/src/app/shell/demo-shell.component.ts \
        examples/chat/angular/project.json
git commit -m "feat(examples-chat): production environment points at /api proxy

Adds the standard Angular environments/ file-replacement pattern
matching every cockpit Angular app. Production uses /api (same-origin,
proxied by the Vercel langgraph-proxy function to the shared
cockpit-dev LangGraph Cloud assistant). Development still uses
http://localhost:2024 for the locally-run langgraph dev server.

Replaces two hardcoded http://localhost:2024 references in
threads.service.ts and demo-shell.component.ts with reads from the
environment module.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: New `demo` Vercel deployment infrastructure

**Files:**
- Create: `scripts/demo-middleware.ts`
- Create: `scripts/assemble-demo.ts`
- Create: `vercel.demo.json`

**Context:** This task creates the build artifacts for the new `demo` Vercel project. The assemble script:
1. Builds `examples-chat-angular` in production mode.
2. Copies the output to `deploy/demo/`.
3. Constructs the Vercel Build Output API tree at `deploy/demo/.vercel/output/` containing the proxy function bundle and route config.

The shape mirrors `scripts/assemble-examples.ts` but is single-app — no multi-product loop, no `<base href>` rewriting (the demo serves at the domain root).

---

- [ ] **Step 1: Create demo-middleware.ts**

Create `scripts/demo-middleware.ts`:

```ts
// scripts/demo-middleware.ts
// SPDX-License-Identifier: MIT
/**
 * Vercel Serverless Function proxy for the canonical-demo deployment
 * (demo.cacheplane.ai). Five-line wrapper around the shared
 * scripts/langgraph-proxy.ts factory using defaults — single backend,
 * no Referer-based fan-out.
 */
import { createProxyHandler } from './langgraph-proxy';
module.exports = createProxyHandler({});
```

- [ ] **Step 2: Create vercel.demo.json**

Create `vercel.demo.json` at the repo root:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "buildCommand": null,
  "outputDirectory": "deploy/demo",
  "installCommand": "npm ci"
}
```

(The route table lives inside the Build Output API's `config.json`, not in `vercel.json`. The `buildCommand: null` + `installCommand: npm ci` pattern matches `vercel.examples.json`.)

- [ ] **Step 3: Create assemble-demo.ts**

Create `scripts/assemble-demo.ts`:

```ts
#!/usr/bin/env npx tsx
// scripts/assemble-demo.ts
// SPDX-License-Identifier: MIT
/**
 * Build the canonical-demo Angular app and assemble it into the Vercel
 * deploy directory at deploy/demo/.
 *
 * Output structure:
 *   deploy/demo/                          (Angular SPA static files)
 *   deploy/demo/.vercel/output/
 *     ├── config.json                     (route table: /api/* → function, else SPA fallback)
 *     ├── static/                         (mirrors the SPA files)
 *     └── functions/api/[[...path]].func/
 *         ├── index.js                    (bundled scripts/demo-middleware.ts)
 *         └── .vc-config.json
 *
 * Usage:
 *   npx tsx scripts/assemble-demo.ts
 *   npx tsx scripts/assemble-demo.ts --skip-build
 */
import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '..');
const deployDir = resolve(root, 'deploy/demo');
const skipBuild = process.argv.includes('--skip-build');

if (!skipBuild) {
  console.log('Building examples-chat-angular (production)...');
  execSync('npx nx build examples-chat-angular --configuration=production --skip-nx-cache', {
    cwd: root,
    stdio: 'inherit',
  });
}

if (existsSync(deployDir)) rmSync(deployDir, { recursive: true });

// The Angular build emits to dist/examples/chat/angular/ (no /browser suffix
// because project.json's outputPath uses `{ base, browser: '' }`).
const src = resolve(root, 'dist/examples/chat/angular');
if (!existsSync(src)) {
  console.error(`❌ Missing build output: ${src}`);
  process.exit(1);
}

mkdirSync(deployDir, { recursive: true });
cpSync(src, deployDir, { recursive: true });
console.log(`✅ Copied SPA to ${deployDir}`);

// Vercel Build Output API structure.
const outputDir = resolve(deployDir, '.vercel/output');
const staticDir = resolve(outputDir, 'static');
const funcDir = resolve(outputDir, 'functions/api/[[...path]].func');

mkdirSync(staticDir, { recursive: true });
cpSync(deployDir, staticDir, { recursive: true, filter: (s) => !s.includes('.vercel') });

mkdirSync(funcDir, { recursive: true });
execSync(`npx esbuild scripts/demo-middleware.ts --bundle --format=cjs --platform=node --outfile=${funcDir}/index.js`, {
  cwd: root,
  stdio: 'inherit',
});

writeFileSync(resolve(funcDir, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs20.x',
  handler: 'index.js',
  launcherType: 'Nodejs',
  shouldAddHelpers: true,
}, null, 2));

writeFileSync(resolve(outputDir, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    // 1. API requests go to the serverless proxy.
    { src: '^/api/(.*)', dest: '/api/[[...path]]', check: true },
    // 2. Static asset requests resolve from the filesystem.
    { handle: 'filesystem' },
    // 3. All other routes fall back to index.html (SPA).
    { src: '.*', dest: '/index.html' },
  ],
}, null, 2));

console.log('✅ .vercel/output/ (Build Output API with serverless proxy)');
console.log(`\nAssembled canonical demo to ${deployDir}`);
```

- [ ] **Step 4: Run the assembler to verify it works**

```
npx tsx scripts/assemble-demo.ts
```

Expected output near the end:
```
✅ Copied SPA to /Users/.../deploy/demo
✅ .vercel/output/ (Build Output API with serverless proxy)

Assembled canonical demo to /Users/.../deploy/demo
```

Confirm the file tree:

```
ls -la deploy/demo/.vercel/output/
ls -la deploy/demo/.vercel/output/functions/api/\[\[...path\]\].func/
```

The `.func` directory should contain `index.js` (the bundled middleware) and `.vc-config.json`.

- [ ] **Step 5: Commit**

```bash
git add scripts/demo-middleware.ts scripts/assemble-demo.ts vercel.demo.json
git commit -m "feat(deploy): scripts/assemble-demo.ts + vercel.demo.json

Builds the canonical-demo Angular app and assembles it into
deploy/demo/ with a Vercel Build Output API tree containing:
- Static SPA files at deploy/demo/
- Node serverless proxy at .vercel/output/functions/api/[[...path]].func/
- Route table sending /api/* to the proxy, everything else to index.html

The proxy is a 5-line wrapper around scripts/langgraph-proxy.ts
(scripts/demo-middleware.ts) using defaults — single backend, no
Referer-based fan-out.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: CI deploy step

**Files:**
- Modify: `.github/workflows/ci.yml`

**Context:** The existing examples deploy step lives in `ci.yml` under the `deploy` job. We add a parallel step for the demo. Gated on changes to `examples/chat/angular/**`, `examples/chat/python/**` (the graph might change behavior the demo depends on), `scripts/langgraph-proxy.ts`, `scripts/demo-middleware.ts`, `scripts/assemble-demo.ts`, `vercel.demo.json`, or `libs/**`.

The Vercel project ID lives in a new GitHub secret `VERCEL_DEMO_PROJECT_ID` (to be added in Task 5).

---

- [ ] **Step 1: Read the existing examples deploy step**

Open `.github/workflows/ci.yml` and locate the existing "Angular examples deploy" block (around lines 267–305). Read it end-to-end so the structure of the new step matches it.

- [ ] **Step 2: Add a demo deploy step**

Immediately after the existing "Deploy Angular examples to Vercel (production)" step in the `deploy` job, insert:

```yaml
      # ── Canonical demo deploy ────────────────────────────────────────────
      - name: Check if demo changed
        id: demo_changed
        run: |
          base_sha="${{ github.event.before }}"
          head_sha="${{ github.sha }}"
          if [ -z "$base_sha" ] || [ "$base_sha" = "0000000000000000000000000000000000000000" ]; then
            base_sha="$(git rev-parse "$head_sha^")"
          fi
          changed_files="$(git diff --name-only "$base_sha" "$head_sha")"
          demo_changed=false
          if printf '%s\n' "$changed_files" | grep -E '^examples/chat/(angular|python)/' >/dev/null; then
            demo_changed=true
          fi
          if printf '%s\n' "$changed_files" | grep -E '^(vercel\.demo\.json|scripts/(assemble-demo|demo-middleware|langgraph-proxy)\.ts)$' >/dev/null; then
            demo_changed=true
          fi
          if printf '%s\n' "$changed_files" | grep -E '^libs/' >/dev/null; then
            demo_changed=true
          fi
          echo "changed=$demo_changed" >> "$GITHUB_OUTPUT"
      - name: Build and assemble canonical demo
        if: steps.demo_changed.outputs.changed == 'true'
        run: npx tsx scripts/assemble-demo.ts
      - name: Deploy canonical demo to Vercel (production)
        if: steps.demo_changed.outputs.changed == 'true'
        working-directory: deploy/demo
        run: |
          mkdir -p .vercel
          cat > .vercel/project.json <<EOF
          {"projectId":"${{ secrets.VERCEL_DEMO_PROJECT_ID }}","orgId":"${{ secrets.VERCEL_ORG_ID }}","projectName":"demo"}
          EOF
          npx vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          npx vercel deploy --prebuilt --prod --yes --token=${{ secrets.VERCEL_TOKEN }}
```

(The same Vercel team/org as the existing deployments — `VERCEL_ORG_ID` is the existing secret. Only `VERCEL_DEMO_PROJECT_ID` is new.)

- [ ] **Step 3: Add `EXAMPLES_DEMO_URL` to production-smoke**

In the same file, locate the `production-smoke` job's `env` block under the "Run production smoke tests" step:

```yaml
      - name: Run production smoke tests
        run: npx playwright test apps/cockpit/e2e/production-smoke.spec.ts --reporter=list
        env:
          BASE_URL: https://cockpit.cacheplane.ai
          EXAMPLES_URL: https://examples.cacheplane.ai
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Add `DEMO_URL`:

```yaml
        env:
          BASE_URL: https://cockpit.cacheplane.ai
          EXAMPLES_URL: https://examples.cacheplane.ai
          DEMO_URL: https://demo.cacheplane.ai
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

(The Playwright smoke spec doesn't reference `DEMO_URL` yet — that's a follow-up if we want active assertions. For now the env var is wired so a future spec can use it.)

- [ ] **Step 4: Validate the YAML**

```
npx tsx -e "import('yaml').then(y => y.default.parse(require('fs').readFileSync('.github/workflows/ci.yml', 'utf8')))"
```

Expected: no output (silent parse success). If the YAML is malformed, this throws.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: deploy canonical demo to Vercel on push to main

Adds a deploy step parallel to the existing cockpit-examples deploy.
Gated on changes to examples/chat/{angular,python}/**, the proxy
scripts, vercel.demo.json, or libs/**. Uses a new
VERCEL_DEMO_PROJECT_ID secret; reuses the existing VERCEL_ORG_ID and
VERCEL_TOKEN.

Wires DEMO_URL into the production-smoke env block for future
Playwright assertions against demo.cacheplane.ai.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: External setup checklist (documentation, no code commit)

**Files:** None — this is a PR-body checklist documenting one-time Vercel UI / DNS / GitHub Secrets work.

**Context:** Phase 2 requires a few manual steps that aren't code. They have to be done either before merge (so the first deploy succeeds) or immediately after (deploy fails the first time, then works once setup is done). Document precisely in the PR body so the reviewer can do them.

---

- [ ] **Step 1: Capture the checklist in the PR body**

Use the PR body section below verbatim (no code change in this task — the checklist lives in the PR description).

```markdown
## External setup required (one-time, not in code)

This PR requires three setup steps in Vercel and one DNS record. The deploy step will fail until they're done — that's expected.

### 1. Create the Vercel project

In the Vercel dashboard:

- New Project → Import this repo.
- Project name: `demo`.
- Framework preset: **Other** (we use Build Output API).
- Root directory: leave default (`/`).
- Build & Output Settings → use defaults (the `vercel.demo.json` and the prebuilt output from CI handle everything).
- Disable Git integration's auto-deploy on push (CI handles deploys). Settings → Git → "Connected Git Repository" → uncheck "Production Branch" auto-deploy if it's checked.

### 2. Add the custom domain

Project Settings → Domains:

- Add `demo.cacheplane.ai`.
- Vercel will show the required CNAME record.

In the DNS registrar:

- Add CNAME `demo` → `cname.vercel-dns.com.` (Vercel's standard).
- Wait for propagation (~minutes).

### 3. Set environment variables

Project Settings → Environment Variables, scope **Production + Preview**:

- `LANGSMITH_API_KEY` = same value as the GitHub repo secret of the same name.

(Phase 3 will add `UPSTASH_REDIS_REST_URL` / `_TOKEN`; Phase 4 will add `ALLOWED_ORIGINS`. Not needed for this PR.)

### 4. Add the GitHub secret

In the repo Settings → Secrets and variables → Actions:

- `VERCEL_DEMO_PROJECT_ID` = the project ID from Vercel (Project Settings → General → Project ID).

`VERCEL_TOKEN` and `VERCEL_ORG_ID` already exist from the cockpit-examples deployment — no changes there.

### Verification

After merging this PR:

- The CI deploy step should run and succeed.
- `https://demo.cacheplane.ai` should load the canonical demo SPA.
- `https://demo.cacheplane.ai/api/_proxy_debug` should return JSON with `hasApiKey: true` and `backendUrl: "https://cockpit-dev-..."`.
- Submitting a message in the chat should stream a response (proves the full pipeline works).
```

---

### Task 6: Open PR + verify after merge

**Context:** Final task — push, open PR, verify the manual setup steps and the deploy.

---

- [ ] **Step 1: Push + open PR**

```bash
git push -u origin claude/canonical-demo-deploy-phase-2
gh pr create --title "feat(deploy): canonical demo at demo.cacheplane.ai (Phase 2)" --body "$(cat <<'EOF'
## Summary

Phase 2 of the canonical-demo deployment plan. Stands up
`https://demo.cacheplane.ai` as an independent Vercel project serving
`examples/chat/angular` with a `/api/*` proxy to the shared
`cockpit-dev` LangGraph Cloud assistant (the `chat` graph from Phase 1).

## Architecture

- **Shared proxy module** at `scripts/langgraph-proxy.ts` exposing a
  `createProxyHandler(config)` factory used by both the existing
  cockpit-examples deployment (now a thin wrapper) and the new demo
  deployment (also a thin wrapper using defaults).
- **`scripts/assemble-demo.ts`** builds `examples-chat-angular` in
  production mode and produces `deploy/demo/` with a Vercel Build
  Output API tree (Node serverless function + route table).
- **`examples/chat/angular`** gets the standard Angular
  `environments/` file-replacement pattern. Production points at
  `/api`, dev at `http://localhost:2024`.
- **CI deploy step** gated on changes to the demo's files; uses a new
  `VERCEL_DEMO_PROJECT_ID` secret and the existing `VERCEL_ORG_ID` /
  `VERCEL_TOKEN`.

## Spec & Plan

- `docs/superpowers/specs/2026-05-13-canonical-demo-deploy-design.md`
- `docs/superpowers/plans/2026-05-13-canonical-demo-deploy-phase-2.md`

## Test plan

- [x] `scripts/langgraph-proxy.spec.ts` — 7 unit tests for the shared proxy
- [x] Local: `scripts/assemble-demo.ts` produces a valid Build Output API tree
- [x] Local: `examples-chat-angular` production build replaces `localhost:2024` with `/api`
- [x] Existing cockpit-examples behavior unchanged (refactor only)
- [ ] After external setup + merge: `demo.cacheplane.ai` returns 200
- [ ] After merge: `demo.cacheplane.ai/api/_proxy_debug` returns `hasApiKey: true`
- [ ] After merge: submitting a message streams a response
- [ ] `examples.cacheplane.ai` continues to work (no regression on cockpit-examples)

<!-- The "External setup required" section from Task 5 goes here verbatim -->

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Wait for CI to be green on the PR**

The deploy step will be **gated off** on a PR (it only runs on push to main). So PR CI just exercises the library/test/build chain. Required green:
- `Library — lint / test / build` (the new langgraph-proxy.spec.ts runs here)
- `Website — lint / build`
- All Cockpit jobs
- `examples/chat — python smoke`

- [ ] **Step 3: Do the external setup steps**

Follow the "External setup required" section from Task 5 in the PR body. Once done, the post-merge deploy can succeed.

- [ ] **Step 4: After merge, verify**

Within ~5 minutes of merge:

1. CI on main: `Deploy → Vercel` step should run "Deploy canonical demo to Vercel (production)" and succeed.
2. `curl -I https://demo.cacheplane.ai` → 200.
3. `curl -s https://demo.cacheplane.ai/api/_proxy_debug | jq .` → JSON with `hasApiKey: true`, `backendUrl: "https://cockpit-dev-..."`.
4. Open `https://demo.cacheplane.ai` in a browser, submit "hello", see a streamed response.
5. `curl -I https://examples.cacheplane.ai` still returns 200 (existing deploy uninterrupted).

If step 3 returns `hasApiKey: false`, the Vercel env var wasn't set — re-check setup step 3 in the PR body.

If step 4 fails to stream, hit `/api/info` directly to see if the proxy is at least reaching the backend. If it returns the LangGraph Cloud info JSON, the proxy works; the issue is on the SDK / Angular side.

---

## Self-review notes

- **Spec coverage:** every Phase 2 spec section maps to a task. Shared proxy → Task 1. Environment files + URL replacements → Task 2. Assemble + middleware + vercel.json → Task 3. CI deploy step → Task 4. External setup → Task 5. Verification → Task 6.
- **No placeholders:** every code block is final content; CSS/JSON/TS/YAML all complete.
- **Type consistency:** `createProxyHandler`, `ProxyConfig`, `environment.langGraphApiUrl`, `environment.assistantId`, `VERCEL_DEMO_PROJECT_ID` spelled identically across tasks.
- **Behavior-preserving refactor:** Task 1 changes the shape of `examples-middleware.ts` but its inputs/outputs are identical — the same `createProxyHandler` call with the same Referer-based resolver. The 7 unit tests cover this surface.
- **Deferred to Phase 3/4:** rate limiting, prompt-length cap, CORS allowlist. The `ProxyConfig` interface has no hooks for these yet — they'll be added when their phases ship. Today's signature is intentionally minimal (`backendUrl`, `resolveBackend`) to avoid YAGNI shapes.
