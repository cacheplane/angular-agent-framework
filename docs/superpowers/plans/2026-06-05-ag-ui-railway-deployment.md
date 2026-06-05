# AG-UI Runtime Hosting on Railway — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Host the cockpit AG-UI FastAPI runtimes on Railway so the cockpit "Run" tab reaches them in production, with defense-in-depth (Vercel edge middleware + Railway internal-token middleware).

**Architecture:** A single Railway-hosted FastAPI app aggregates every `cockpit/ag-ui/*/python/` topic at `/agent/<topic>`. The app's `server.py`, `requirements.txt`, and `deps/` tree are generated from `apps/cockpit/scripts/capability-registry.ts` by a TypeScript script that mirrors `scripts/generate-shared-deployment-config.ts`. CI drift-checks the generated files and runs `railway up`. Each cockpit AG-UI Angular example gets a `vercel.json` rewrite forwarding `/agent/:path*` to Railway, plus a Vercel edge `middleware.ts` enforcing origin allowlist + Upstash rate limit + injecting an `X-Internal-Token` header that the Railway middleware verifies.

**Tech Stack:** Python 3.12 + FastAPI + `ag-ui-langgraph` + uvicorn; Docker (multi-stage Python-slim); Railway; Vercel Edge Functions + `@upstash/ratelimit` + `@upstash/redis`; TypeScript (`tsx`) for the generator; GitHub Actions; Playwright for smoke tests.

**Spec:** `docs/superpowers/specs/2026-06-05-ag-ui-railway-deployment-design.md`

---

## File Structure

**New (hand-written):**
- `deployments/ag-ui-dev/README.md` — one-page operator guide
- `deployments/ag-ui-dev/Dockerfile` — multi-stage Python 3.12-slim
- `deployments/ag-ui-dev/entrypoint.sh` — uvicorn + watchdog
- `deployments/ag-ui-dev/railway.json` — healthcheck + restart policy
- `deployments/ag-ui-dev/.gitignore` — exclude `.env`
- `deployments/ag-ui-dev/server.py.template` — Mustache-style template the generator fills in
- `scripts/generate-ag-ui-deployment-config.ts` — generator
- `scripts/generate-ag-ui-deployment-config.spec.ts` — generator tests
- `.github/workflows/deploy-ag-ui.yml` — CI deploy
- `cockpit/ag-ui/interrupts/angular/middleware.ts` — edge: origin + rate-limit + token
- `cockpit/ag-ui/streaming/angular/middleware.ts` — same shape

**Modified:**
- `cockpit/ag-ui/interrupts/angular/vercel.json` — add `rewrites`
- `cockpit/ag-ui/streaming/angular/vercel.json` — add `rewrites`
- `cockpit/ag-ui/interrupts/angular/package.json` — add `@upstash/ratelimit`, `@upstash/redis`, `@vercel/edge`
- `cockpit/ag-ui/streaming/angular/package.json` — same
- `apps/cockpit/e2e/production-smoke.spec.ts` — two new tests
- `.gitignore` — ignore Railway log artifacts if any

**Generated (committed, drift-checked):**
- `deployments/ag-ui-dev/server.py`
- `deployments/ag-ui-dev/requirements.txt`
- `deployments/ag-ui-dev/deps/interrupts/` (full copy of `cockpit/ag-ui/interrupts/python`)
- `deployments/ag-ui-dev/deps/streaming/` (full copy of `cockpit/ag-ui/streaming/python`)

---

## Pre-flight (one-time, manual)

These are user-driven steps that happen *outside* the codebase. Document and confirm before starting Task 1.

- [ ] **Pre-flight 1: Create Railway project + service**
  - In Railway dashboard, create project `ag-ui-dev`.
  - Add a service named `ag-ui-dev` (same name as the project; Railway CLI references it).
  - Note the public domain (default: `ag-ui-dev.up.railway.app`).
  - Generate a project token (Project Settings → Tokens). Add it to GitHub repo secrets as `RAILWAY_TOKEN`.

- [ ] **Pre-flight 2: Configure Railway env vars (on the service)**
  - `OPENAI_API_KEY` — same key already used by langgraph deployments.
  - `AG_UI_INTERNAL_TOKEN` — generate with `openssl rand -hex 32`. Copy the value.
  - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — created in Pre-flight 3.

- [ ] **Pre-flight 3: Create Upstash Redis database**
  - Sign up at `upstash.com` (free tier).
  - Create a Redis database (region: `us-east-1` to keep latency low to Vercel/Railway US-East).
  - Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

- [ ] **Pre-flight 4: Add Vercel project env vars (each ag-ui example)**
  - For each Vercel project that hosts an ag-ui cockpit example (`cockpit-ag-ui-interrupts-angular`, `cockpit-ag-ui-streaming-angular`):
    - `AG_UI_INTERNAL_TOKEN` — same value as Railway.
    - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — same as Pre-flight 3.

- [ ] **Pre-flight 5: Set OpenAI project spending cap**
  - In OpenAI dashboard, set a project-level hard limit of `$50/mo` on the project whose key powers `OPENAI_API_KEY`.

- [ ] **Pre-flight 6: Confirm `RAILWAY_TOKEN` in repo `.env`**
  - User confirmed: `RAILWAY_TOKEN` exists in `/Users/blove/repos/angular-agent-framework/.env`. This is for local `railway` CLI invocations during testing. CI uses the GitHub Actions secret separately.

---

## Task 1: Generator script — tests first

**Files:**
- Create: `scripts/generate-ag-ui-deployment-config.spec.ts`
- Create: `scripts/generate-ag-ui-deployment-config.ts` (stub only — implementation in Task 2)

- [ ] **Step 1: Write the failing tests**

Create `scripts/generate-ag-ui-deployment-config.spec.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { generateAgUiDeployment } from './generate-ag-ui-deployment-config';

const REPO_ROOT = resolve(__dirname, '..');

describe('generateAgUiDeployment', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'ag-ui-deploy-'));
  });

  it('stages each ag-ui python tree under deps/<topic>/', () => {
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    expect(statSync(join(outDir, 'deps/interrupts/src/graph.py')).isFile()).toBe(true);
    expect(statSync(join(outDir, 'deps/streaming/src/graph.py')).isFile()).toBe(true);
  });

  it('writes server.py with GENERATED header and one endpoint per topic', () => {
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    const server = readFileSync(join(outDir, 'server.py'), 'utf8');
    expect(server).toMatch(/^# GENERATED/);
    expect(server).toContain('from deps.interrupts.src.graph import graph as interrupts_graph');
    expect(server).toContain('from deps.streaming.src.graph import graph as streaming_graph');
    expect(server).toContain('path="/agent/interrupts"');
    expect(server).toContain('path="/agent/streaming"');
    expect(server).toContain('@app.get("/ok")');
  });

  it('server.py enforces X-Internal-Token on /agent/*', () => {
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    const server = readFileSync(join(outDir, 'server.py'), 'utf8');
    expect(server).toContain('AG_UI_INTERNAL_TOKEN');
    expect(server).toContain('x-internal-token');
    // Health route must NOT require token
    expect(server).toMatch(/if request\.url\.path == "\/ok":\s*\n\s*return await call_next\(request\)/);
  });

  it('writes requirements.txt with GENERATED header and union of example deps', () => {
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    const reqs = readFileSync(join(outDir, 'requirements.txt'), 'utf8');
    expect(reqs).toMatch(/^# GENERATED/);
    expect(reqs).toContain('ag-ui-langgraph==');
    expect(reqs).toContain('fastapi==');
    expect(reqs).toContain('uvicorn==');
    // No `-e .` self-references should leak from per-example requirements
    expect(reqs).not.toMatch(/^-e \./m);
  });

  it('produces byte-identical output across runs (idempotent)', () => {
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    const firstServer = readFileSync(join(outDir, 'server.py'), 'utf8');
    const firstReqs = readFileSync(join(outDir, 'requirements.txt'), 'utf8');
    generateAgUiDeployment({ repoRoot: REPO_ROOT, outDir });
    expect(readFileSync(join(outDir, 'server.py'), 'utf8')).toBe(firstServer);
    expect(readFileSync(join(outDir, 'requirements.txt'), 'utf8')).toBe(firstReqs);
  });
});
```

Create the stub `scripts/generate-ag-ui-deployment-config.ts`:

```ts
export interface GenerateOptions {
  repoRoot: string;
  outDir: string;
}

export function generateAgUiDeployment(_options: GenerateOptions): void {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/generate-ag-ui-deployment-config.spec.ts`
Expected: 5 failures with "not implemented".

- [ ] **Step 3: Commit failing tests**

```bash
git add scripts/generate-ag-ui-deployment-config.spec.ts scripts/generate-ag-ui-deployment-config.ts
git commit -m "test(scripts): failing tests for ag-ui deployment generator"
```

---

## Task 2: Generator script — implementation

**Files:**
- Modify: `scripts/generate-ag-ui-deployment-config.ts`

- [ ] **Step 1: Implement the generator**

Replace the contents of `scripts/generate-ag-ui-deployment-config.ts`:

```ts
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { capabilities } from '../apps/cockpit/scripts/capability-registry';

const GENERATED_HEADER = '# GENERATED — do not edit. Source: scripts/generate-ag-ui-deployment-config.ts';

export interface GenerateOptions {
  repoRoot: string;
  outDir: string;
}

interface AgUiTopic {
  topic: string;
  pythonDir: string;
}

function collectTopics(): AgUiTopic[] {
  const topics = capabilities
    .filter((c) => c.product === 'ag-ui' && c.pythonDir)
    .map<AgUiTopic>((c) => ({ topic: c.topic, pythonDir: c.pythonDir! }));
  topics.sort((a, b) => a.topic.localeCompare(b.topic));
  if (topics.length === 0) {
    throw new Error('No ag-ui topics with pythonDir found in capability registry');
  }
  return topics;
}

function stageDeps(repoRoot: string, outDir: string, topics: AgUiTopic[]): void {
  const depsDir = resolve(outDir, 'deps');
  rmSync(depsDir, { recursive: true, force: true });
  mkdirSync(depsDir, { recursive: true });
  for (const topic of topics) {
    const src = resolve(repoRoot, topic.pythonDir);
    const dst = resolve(depsDir, topic.topic);
    cpSync(src, dst, {
      recursive: true,
      filter: (s) => !s.includes('.venv') && !s.includes('__pycache__') && !s.endsWith('.pyc'),
    });
  }
}

function buildServerPy(topics: AgUiTopic[]): string {
  const imports = topics
    .map((t) => `from deps.${t.topic}.src.graph import graph as ${t.topic.replace(/-/g, '_')}_graph`)
    .join('\n');
  const mounts = topics
    .map(
      (t) =>
        `add_langgraph_fastapi_endpoint(\n` +
        `    app,\n` +
        `    LangGraphAgent(name="${t.topic}", graph=${t.topic.replace(/-/g, '_')}_graph),\n` +
        `    path="/agent/${t.topic}",\n` +
        `)`,
    )
    .join('\n');
  return `${GENERATED_HEADER}
# Multi-topic AG-UI FastAPI server. Aggregates each cockpit/ag-ui/*/python topic
# at /agent/<topic>. Health route /ok is unauthenticated; /agent/* requires
# X-Internal-Token matching the AG_UI_INTERNAL_TOKEN env var.
import os
from fastapi import FastAPI, Request, HTTPException
from ag_ui_langgraph import add_langgraph_fastapi_endpoint, LangGraphAgent

${imports}

AG_UI_INTERNAL_TOKEN = os.environ["AG_UI_INTERNAL_TOKEN"]

app = FastAPI(title="ag-ui-dev")


@app.middleware("http")
async def require_internal_token(request: Request, call_next):
    if request.url.path == "/ok":
        return await call_next(request)
    if request.headers.get("x-internal-token") != AG_UI_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="unauthorized")
    return await call_next(request)


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}


${mounts}
`;
}

function buildRequirementsTxt(repoRoot: string, topics: AgUiTopic[]): string {
  // Parse each example's requirements.txt, take the union, take the highest version per package.
  const versions = new Map<string, string>();
  for (const topic of topics) {
    const reqPath = resolve(repoRoot, topic.pythonDir, 'requirements.txt');
    const content = readFileSync(reqPath, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('-e ')) continue;
      // Strip uv "# via" inline comments and platform markers after ';'
      const semi = line.indexOf(';');
      const beforeMarker = semi >= 0 ? line.slice(0, semi).trim() : line;
      const match = beforeMarker.match(/^([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+-]+)$/);
      if (!match) continue;
      const [, name, version] = match;
      const existing = versions.get(name);
      if (!existing || compareVersions(version, existing) > 0) {
        versions.set(name, version);
      }
    }
  }
  const sortedNames = [...versions.keys()].sort();
  const lines = sortedNames.map((n) => `${n}==${versions.get(n)}`);
  return `${GENERATED_HEADER}\n${lines.join('\n')}\n`;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((s) => parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => parseInt(s, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export function generateAgUiDeployment(options: GenerateOptions): void {
  const topics = collectTopics();
  mkdirSync(options.outDir, { recursive: true });
  stageDeps(options.repoRoot, options.outDir, topics);
  writeFileSync(resolve(options.outDir, 'server.py'), buildServerPy(topics));
  writeFileSync(resolve(options.outDir, 'requirements.txt'), buildRequirementsTxt(options.repoRoot, topics));
}

if (require.main === module) {
  const repoRoot = resolve(__dirname, '..');
  const outDir = resolve(repoRoot, 'deployments/ag-ui-dev');
  generateAgUiDeployment({ repoRoot, outDir });
  console.log('Generated deployments/ag-ui-dev/{server.py,requirements.txt,deps/}');
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run scripts/generate-ag-ui-deployment-config.spec.ts`
Expected: all 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-ag-ui-deployment-config.ts
git commit -m "feat(scripts): ag-ui deployment generator (server.py, requirements.txt, deps/)"
```

---

## Task 3: Run the generator and commit generated output

**Files:**
- Create: `deployments/ag-ui-dev/server.py` (generated)
- Create: `deployments/ag-ui-dev/requirements.txt` (generated)
- Create: `deployments/ag-ui-dev/deps/interrupts/` (generated)
- Create: `deployments/ag-ui-dev/deps/streaming/` (generated)
- Create: `deployments/ag-ui-dev/.gitignore`

- [ ] **Step 1: Write `.gitignore`**

Create `deployments/ag-ui-dev/.gitignore`:

```
.env
*.log
```

- [ ] **Step 2: Run the generator**

Run: `npx tsx scripts/generate-ag-ui-deployment-config.ts`
Expected stdout: `Generated deployments/ag-ui-dev/{server.py,requirements.txt,deps/}`

- [ ] **Step 3: Verify generated files exist**

Run: `ls deployments/ag-ui-dev/`
Expected to see: `.gitignore  deps  requirements.txt  server.py`

Run: `head -1 deployments/ag-ui-dev/server.py`
Expected: `# GENERATED — do not edit. Source: scripts/generate-ag-ui-deployment-config.ts`

- [ ] **Step 4: Commit**

```bash
git add deployments/ag-ui-dev/.gitignore deployments/ag-ui-dev/server.py deployments/ag-ui-dev/requirements.txt deployments/ag-ui-dev/deps/
git commit -m "chore(ag-ui-dev): commit generated server.py + requirements.txt + deps/"
```

---

## Task 4: Dockerfile + entrypoint.sh + railway.json

**Files:**
- Create: `deployments/ag-ui-dev/Dockerfile`
- Create: `deployments/ag-ui-dev/entrypoint.sh`
- Create: `deployments/ag-ui-dev/railway.json`

- [ ] **Step 1: Write `Dockerfile`**

Create `deployments/ag-ui-dev/Dockerfile`:

```dockerfile
# Multi-stage build for the ag-ui-dev FastAPI runtime.
# Stage 1 installs Python deps into a user-site so we can copy them
# into a slim runner without build tooling.
FROM python:3.12-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.12-slim
WORKDIR /app

# curl is needed by entrypoint.sh's watchdog.
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

- [ ] **Step 2: Write `entrypoint.sh`**

Create `deployments/ag-ui-dev/entrypoint.sh`:

```bash
#!/usr/bin/env bash
# Starts uvicorn and runs a watchdog that polls /ok every 30s after a 180s
# startup grace. Three consecutive failures kill uvicorn so Railway's
# restart-policy can recover.
set -euo pipefail

PORT="${PORT:-8000}"
uvicorn server:app --host 0.0.0.0 --port "${PORT}" &
UVICORN_PID=$!

sleep 180  # startup grace — let imports + first OpenAI warm-up settle
STRIKES=0
while kill -0 "${UVICORN_PID}" 2>/dev/null; do
  sleep 30
  if curl -fsS "http://127.0.0.1:${PORT}/ok" >/dev/null; then
    STRIKES=0
  else
    STRIKES=$((STRIKES + 1))
    echo "watchdog: strike ${STRIKES}/3" >&2
    if [ "${STRIKES}" -ge 3 ]; then
      echo "watchdog: 3 strikes, killing uvicorn (pid ${UVICORN_PID})" >&2
      kill "${UVICORN_PID}" || true
      exit 1
    fi
  fi
done
wait "${UVICORN_PID}"
```

- [ ] **Step 3: Write `railway.json`**

Create `deployments/ag-ui-dev/railway.json`:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/ok",
    "healthcheckTimeout": 60,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

- [ ] **Step 4: Verify docker build works locally**

Run: `cd deployments/ag-ui-dev && docker build -t ag-ui-dev:test .`
Expected: build completes successfully. (If Docker isn't available locally, skip this step — CI will catch failures.)

- [ ] **Step 5: Commit**

```bash
git add deployments/ag-ui-dev/Dockerfile deployments/ag-ui-dev/entrypoint.sh deployments/ag-ui-dev/railway.json
git commit -m "feat(ag-ui-dev): Dockerfile + entrypoint watchdog + railway.json"
```

---

## Task 5: README for the deployment

**Files:**
- Create: `deployments/ag-ui-dev/README.md`

- [ ] **Step 1: Write README**

Create `deployments/ag-ui-dev/README.md`:

```markdown
# ag-ui-dev

Multi-topic FastAPI app hosting the cockpit `ag-ui/*` runtimes on Railway.

## What's in here

| File / dir | Source | Edit? |
| --- | --- | --- |
| `Dockerfile`, `entrypoint.sh`, `railway.json`, `README.md` | hand-written | yes |
| `server.py`, `requirements.txt`, `deps/` | generated by `scripts/generate-ag-ui-deployment-config.ts` | no |

The generator reads `apps/cockpit/scripts/capability-registry.ts`, filters to
`product === 'ag-ui'` entries with a `pythonDir`, stages each into `deps/<topic>/`,
and writes one `add_langgraph_fastapi_endpoint(..., path="/agent/<topic>")` per
topic in `server.py`.

## Regenerate locally

```bash
npx tsx scripts/generate-ag-ui-deployment-config.ts
```

CI runs `git diff --exit-code deployments/ag-ui-dev/` after regenerating, so a
stale commit fails the deploy workflow.

## Local dev story

`deployments/ag-ui-dev/` is the deployment artifact, not the dev surface. To
run a topic locally, use its own uvicorn entrypoint:

```bash
cd cockpit/ag-ui/interrupts/python
uv run uvicorn src.app:app --port 5320
```

## Required env vars (on Railway)

| Var | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | LLM calls inside the graphs |
| `AG_UI_INTERNAL_TOKEN` | Must match the Vercel edge middleware's injected `X-Internal-Token` header |
| `PORT` | Provided by Railway automatically |

## Rotating `AG_UI_INTERNAL_TOKEN`

The token lives in two places: Railway (this service) and each Vercel project
that hosts a cockpit ag-ui example. Rotation order:

1. Generate a new token: `openssl rand -hex 32`.
2. Update the Vercel env var on every ag-ui cockpit project. Redeploy each.
3. Update the Railway env var. Redeploy the service.

Tokens valid in both places overlap briefly during step 2.
```

- [ ] **Step 2: Commit**

```bash
git add deployments/ag-ui-dev/README.md
git commit -m "docs(ag-ui-dev): operator README"
```

---

## Task 6: Vercel rewrites for each cockpit ag-ui Angular example

**Files:**
- Modify: `cockpit/ag-ui/interrupts/angular/vercel.json`
- Modify: `cockpit/ag-ui/streaming/angular/vercel.json`

- [ ] **Step 1: Update interrupts `vercel.json`**

Replace `cockpit/ag-ui/interrupts/angular/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npx nx build cockpit-ag-ui-interrupts-angular",
  "outputDirectory": "dist/cockpit/ag-ui/interrupts/angular/browser",
  "framework": null,
  "rewrites": [
    {
      "source": "/agent/:path*",
      "destination": "https://ag-ui-dev.up.railway.app/agent/interrupts/:path*"
    }
  ]
}
```

- [ ] **Step 2: Update streaming `vercel.json`**

Replace `cockpit/ag-ui/streaming/angular/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npx nx build cockpit-ag-ui-streaming-angular",
  "outputDirectory": "dist/cockpit/ag-ui/streaming/angular/browser",
  "framework": null,
  "rewrites": [
    {
      "source": "/agent/:path*",
      "destination": "https://ag-ui-dev.up.railway.app/agent/streaming/:path*"
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add cockpit/ag-ui/interrupts/angular/vercel.json cockpit/ag-ui/streaming/angular/vercel.json
git commit -m "feat(cockpit/ag-ui): add vercel rewrites to ag-ui-dev railway backend"
```

---

## Task 7: Vercel edge middleware — interrupts example

**Files:**
- Create: `cockpit/ag-ui/interrupts/angular/middleware.ts`
- Modify: `cockpit/ag-ui/interrupts/angular/package.json`

- [ ] **Step 1: Add npm dependencies**

Read `cockpit/ag-ui/interrupts/angular/package.json`. Add these to the `dependencies` block (preserve other entries; merge alphabetically):

```json
"@upstash/ratelimit": "^2.0.5",
"@upstash/redis": "^1.34.3",
"@vercel/edge": "^1.2.1"
```

If the file has no `dependencies` key, add one. Do NOT touch `devDependencies`.

- [ ] **Step 2: Install (single workspace)**

Run from repo root: `npm install --workspace=cockpit-ag-ui-interrupts-angular`
Expected: completes without errors.

> If npm complains about the workspace name, look up the actual name in `cockpit/ag-ui/interrupts/angular/package.json` and use that.

- [ ] **Step 3: Write the middleware**

Create `cockpit/ag-ui/interrupts/angular/middleware.ts`:

```ts
// Vercel edge middleware for the cockpit ag-ui/interrupts example.
//
// Runs at the edge BEFORE the rewrite to Railway. Enforces:
//   1. Origin allowlist — request must come from a known threadplane host.
//   2. Per-IP rate limit (10 req/min, token bucket via Upstash).
//   3. Injects X-Internal-Token header that the Railway FastAPI middleware
//      verifies against AG_UI_INTERNAL_TOKEN.
//
// Returns 401/403/429 before the request ever touches the OpenAI-backed
// Railway service.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { next } from '@vercel/edge';

export const config = {
  matcher: '/agent/:path*',
};

const ALLOWED_ORIGINS = new Set<string>([
  'https://examples.threadplane.ai',
  'https://cockpit.threadplane.ai',
  'http://localhost:4320',
  'http://localhost:4321',
]);

const redis = new Redis({
  url: process.env['UPSTASH_REDIS_REST_URL']!,
  token: process.env['UPSTASH_REDIS_REST_TOKEN']!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(10, '60 s', 10),
  analytics: false,
  prefix: 'ag-ui-dev:interrupts',
});

export default async function middleware(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return new Response(JSON.stringify({ error: 'forbidden origin' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
  const verdict = await ratelimit.limit(ip);
  if (!verdict.success) {
    return new Response(JSON.stringify({ error: 'rate limit exceeded' }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }

  const internalToken = process.env['AG_UI_INTERNAL_TOKEN'];
  if (!internalToken) {
    return new Response(JSON.stringify({ error: 'misconfigured: missing internal token' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const headers = new Headers(request.headers);
  headers.set('x-internal-token', internalToken);
  return next({ headers });
}
```

- [ ] **Step 4: Verify middleware compiles**

Run: `npx tsc --noEmit -p cockpit/ag-ui/interrupts/angular/tsconfig.app.json`
Expected: no errors. (If the project's tsconfig excludes `middleware.ts`, add it to the include list — Vercel needs to find it at the project root regardless of tsconfig.)

If the tsconfig doesn't include the root file, add a minimal `tsconfig.middleware.json` next to it:

```json
{
  "extends": "./tsconfig.json",
  "include": ["middleware.ts"],
  "compilerOptions": { "noEmit": true, "module": "esnext", "moduleResolution": "bundler" }
}
```

and run `npx tsc --noEmit -p cockpit/ag-ui/interrupts/angular/tsconfig.middleware.json`.

- [ ] **Step 5: Commit**

```bash
git add cockpit/ag-ui/interrupts/angular/middleware.ts cockpit/ag-ui/interrupts/angular/package.json package-lock.json
git commit -m "feat(cockpit/ag-ui/interrupts): vercel edge middleware (origin + rate limit + token)"
```

> Note: `package-lock.json` updates only — do NOT regenerate the lockfile from scratch. Per repo memory, that strips Linux `@next/swc-*` bindings and breaks CI.

---

## Task 8: Vercel edge middleware — streaming example

**Files:**
- Create: `cockpit/ag-ui/streaming/angular/middleware.ts`
- Modify: `cockpit/ag-ui/streaming/angular/package.json`

This is the same shape as Task 7 with `interrupts` → `streaming`.

- [ ] **Step 1: Add npm dependencies**

Add to `cockpit/ag-ui/streaming/angular/package.json` (same versions as Task 7):

```json
"@upstash/ratelimit": "^2.0.5",
"@upstash/redis": "^1.34.3",
"@vercel/edge": "^1.2.1"
```

- [ ] **Step 2: Install**

Run from repo root: `npm install --workspace=cockpit-ag-ui-streaming-angular`
Expected: completes without errors.

- [ ] **Step 3: Write the middleware**

Create `cockpit/ag-ui/streaming/angular/middleware.ts`:

```ts
// Vercel edge middleware for the cockpit ag-ui/streaming example.
// See cockpit/ag-ui/interrupts/angular/middleware.ts for the canonical
// commentary — this file mirrors that shape with a different prefix.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { next } from '@vercel/edge';

export const config = {
  matcher: '/agent/:path*',
};

const ALLOWED_ORIGINS = new Set<string>([
  'https://examples.threadplane.ai',
  'https://cockpit.threadplane.ai',
  'http://localhost:4320',
  'http://localhost:4321',
]);

const redis = new Redis({
  url: process.env['UPSTASH_REDIS_REST_URL']!,
  token: process.env['UPSTASH_REDIS_REST_TOKEN']!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(10, '60 s', 10),
  analytics: false,
  prefix: 'ag-ui-dev:streaming',
});

export default async function middleware(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return new Response(JSON.stringify({ error: 'forbidden origin' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
  const verdict = await ratelimit.limit(ip);
  if (!verdict.success) {
    return new Response(JSON.stringify({ error: 'rate limit exceeded' }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }

  const internalToken = process.env['AG_UI_INTERNAL_TOKEN'];
  if (!internalToken) {
    return new Response(JSON.stringify({ error: 'misconfigured: missing internal token' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const headers = new Headers(request.headers);
  headers.set('x-internal-token', internalToken);
  return next({ headers });
}
```

- [ ] **Step 4: Verify middleware compiles**

Same as Task 7 Step 4 with `interrupts` → `streaming`.

- [ ] **Step 5: Commit**

```bash
git add cockpit/ag-ui/streaming/angular/middleware.ts cockpit/ag-ui/streaming/angular/package.json package-lock.json
git commit -m "feat(cockpit/ag-ui/streaming): vercel edge middleware (origin + rate limit + token)"
```

---

## Task 9: CI workflow — deploy on push to main

**Files:**
- Create: `.github/workflows/deploy-ag-ui.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/deploy-ag-ui.yml`:

```yaml
name: Deploy AG-UI Railway

on:
  push:
    branches: [main]
    paths:
      - 'cockpit/ag-ui/**/python/**'
      - 'apps/cockpit/scripts/capability-registry.ts'
      - 'scripts/generate-ag-ui-deployment-config.ts'
      - 'deployments/ag-ui-dev/**'
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: read

env:
  DO_NOT_TRACK: '1'

jobs:
  deploy:
    name: Deploy ag-ui-dev to Railway
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2

      - uses: actions/setup-node@v6.3.0
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Regenerate deployment artifacts
        run: npx tsx scripts/generate-ag-ui-deployment-config.ts

      - name: Drift check — committed artifacts must match regeneration
        run: |
          if ! git diff --exit-code -- deployments/ag-ui-dev/; then
            echo "::error::deployments/ag-ui-dev/ is out of sync. Run 'npx tsx scripts/generate-ag-ui-deployment-config.ts' locally and commit the result."
            exit 1
          fi

      - name: Install Railway CLI
        run: npm install -g @railway/cli@4

      - name: Deploy
        working-directory: deployments/ag-ui-dev
        run: railway up --service ag-ui-dev --detach
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

- [ ] **Step 2: Validate the workflow file**

Run: `npx js-yaml .github/workflows/deploy-ag-ui.yml > /dev/null`
Expected: parses cleanly. (If `js-yaml` isn't a dep, run `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-ag-ui.yml'))"` instead.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-ag-ui.yml
git commit -m "ci: deploy ag-ui-dev to Railway on push to main"
```

---

## Task 10: Production smoke tests

**Files:**
- Modify: `apps/cockpit/e2e/production-smoke.spec.ts`

- [ ] **Step 1: Read the existing smoke spec**

Run: `cat apps/cockpit/e2e/production-smoke.spec.ts`
Note the existing structure — `test.describe` blocks, where new tests should slot in (after the chat-capability iframe checks; before any `test.afterAll`).

- [ ] **Step 2: Append two new tests at the end of the file, just before the last closing brace**

Insert this `test.describe` block:

```ts
test.describe('ag-ui Railway runtime', () => {
  const RAILWAY_URL = process.env['AG_UI_RAILWAY_URL'] ?? 'https://ag-ui-dev.up.railway.app';

  test('healthcheck /ok responds 200', async ({ request }) => {
    const res = await request.get(`${RAILWAY_URL}/ok`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  test('examples.threadplane.ai/ag-ui/interrupts is reachable', async ({ page }) => {
    const res = await page.goto(`${EXAMPLES_URL}/ag-ui/interrupts/`);
    expect(res?.status()).toBeLessThan(400);
  });

  test('examples.threadplane.ai/ag-ui/streaming is reachable', async ({ page }) => {
    const res = await page.goto(`${EXAMPLES_URL}/ag-ui/streaming/`);
    expect(res?.status()).toBeLessThan(400);
  });
});
```

> Note: we deliberately do NOT POST to `/agent/<topic>` from CI — the middleware would block the request (no allowlisted origin from the GH Actions runner) and we'd need to plumb the internal token through CI for a real call. Reaching the static Angular SPA is enough to catch the broken-deploy case; a real round-trip can be tested manually.

- [ ] **Step 3: Verify the file still parses + types**

Run: `npx tsc --noEmit -p apps/cockpit/e2e/tsconfig.json 2>&1 | head -20`
(If no e2e tsconfig exists, use `npx tsc --noEmit apps/cockpit/e2e/production-smoke.spec.ts` — expect existing errors only, no new ones.)

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/e2e/production-smoke.spec.ts
git commit -m "test(smoke): probe ag-ui-dev railway healthcheck + examples routes"
```

---

## Task 11: Local smoke — manual `railway up` from worktree

This task is a manual checkpoint. It verifies the Railway service can boot from our committed artifacts before we let CI do it on every push.

- [ ] **Step 1: Source `RAILWAY_TOKEN` from root `.env`**

Run: `export $(grep -E '^RAILWAY_TOKEN=' /Users/blove/repos/angular-agent-framework/.env | xargs)`
Verify: `echo "${RAILWAY_TOKEN:0:8}..."` shows a non-empty token prefix.

- [ ] **Step 2: Install Railway CLI locally (if not already)**

Run: `npx --yes @railway/cli@4 --version`
Expected: prints a version number.

- [ ] **Step 3: Trigger a one-off deploy**

Run: `cd deployments/ag-ui-dev && npx --yes @railway/cli@4 up --service ag-ui-dev --detach`
Expected: deploy uploaded; CLI prints a deployment URL or build status.

- [ ] **Step 4: Watch the build in Railway dashboard**

Visit the Railway dashboard for the `ag-ui-dev` service. Build should complete; deploy should go live. Healthcheck (`/ok`) should pass.

- [ ] **Step 5: Curl the healthcheck**

Run: `curl -fsS https://ag-ui-dev.up.railway.app/ok`
Expected: `{"ok":true}`

- [ ] **Step 6: Curl `/agent/interrupts` without the token (should 401)**

Run: `curl -sS -o /dev/null -w '%{http_code}\n' https://ag-ui-dev.up.railway.app/agent/interrupts`
Expected: `401`

If any step fails, fix the underlying issue (Dockerfile, requirements, server.py template, etc.) and re-run the generator + redeploy. Do NOT proceed to Task 12 until the healthcheck and 401 both pass.

---

## Task 12: PR + merge

- [ ] **Step 1: Push branch**

Run: `git push -u origin claude/ag-ui-railway-deployment`

- [ ] **Step 2: Open PR**

Run:

```bash
gh pr create --title "feat(ag-ui): host runtimes on Railway via ag-ui-dev deployment" --body "$(cat <<'EOF'
## Summary

- New `deployments/ag-ui-dev/` Railway deployment that hosts every `cockpit/ag-ui/*/python/` topic at `/agent/<topic>` from one FastAPI app.
- Generated by `scripts/generate-ag-ui-deployment-config.ts` (mirrors `generate-shared-deployment-config.ts`); CI drift-checks `deployments/ag-ui-dev/`.
- Defense in depth: Vercel edge middleware (origin allowlist + Upstash rate-limit + `X-Internal-Token` injection) on each ag-ui example; Railway FastAPI middleware verifies the same token.
- Healthcheck on `/ok`; production smoke tests probe it.

## Test plan

- [ ] CI: `Deploy AG-UI Railway` workflow runs the drift check + deploy on merge to main.
- [ ] CI: production smoke tests probe `ag-ui-dev.up.railway.app/ok` and the two Vercel ag-ui routes.
- [ ] Manual (pre-merge): `railway up` from the worktree booted the service; `/ok` returned 200; `/agent/interrupts` without token returned 401.
- [ ] Manual (post-merge): open the cockpit `ag-ui/interrupts` "Run" tab and verify a turn completes end-to-end.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI green**

Watch the PR's CI checks. The `Deploy AG-UI Railway` workflow will only fire after merge (push to main trigger). Other CI checks (lint, build, tests) must pass.

- [ ] **Step 4: Merge**

Once green, merge via `gh pr merge --squash --auto` (or wait for user approval if branch protection requires).

- [ ] **Step 5: Verify post-merge deploy**

After merge:
- The `Deploy AG-UI Railway` workflow runs on `main`.
- The production smoke tests fire (whatever workflow runs them — usually a separate scheduled or post-deploy job).
- Manually open `https://cockpit.threadplane.ai/ag-ui/interrupts/...` → Run tab → trigger an approval interrupt → confirm refund flow completes.

---

## Self-Review Checklist

After implementing all 12 tasks, verify:

- [ ] `npx tsx scripts/generate-ag-ui-deployment-config.ts` is idempotent (running twice produces no `git diff`).
- [ ] `deployments/ag-ui-dev/server.py` first line is the `# GENERATED` header.
- [ ] `deployments/ag-ui-dev/deps/` contains exactly the topics whose `product === 'ag-ui'` in `capability-registry.ts` (interrupts, streaming).
- [ ] Both Vercel `middleware.ts` files use distinct `prefix:` values (`ag-ui-dev:interrupts` vs `ag-ui-dev:streaming`) so rate-limit buckets don't merge.
- [ ] `Dockerfile` does not include any of `cockpit/ag-ui/*/python/.venv` (the `cpSync` filter in the generator excludes them).
- [ ] `railway.json` `healthcheckPath` matches the unauthenticated route in `server.py` (`/ok`).
- [ ] CI workflow path-filters cover the same set as the generator's inputs.
