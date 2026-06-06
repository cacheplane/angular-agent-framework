# AG-UI Runtime Hosting on Railway — Design

**Status:** Draft
**Date:** 2026-06-05
**Owner:** Brian Love

## Problem

PR #567 added two cockpit AG-UI topics (`ag-ui/interrupts`, `ag-ui/streaming`), and PR #576 wired them into the cockpit sidebar. The cockpit "Run" tab resolves runtime URLs via the pattern `https://examples.threadplane.ai/<runtimeUrl>` (see `apps/cockpit/src/lib/content-bundle.ts`), but the AG-UI examples have no backend hosted at those paths. Today they show "No runtime available."

The AG-UI examples are uvicorn-hosted FastAPI apps that wrap a LangGraph compiled graph via `ag-ui-langgraph`'s `LangGraphAgent` + `add_langgraph_fastapi_endpoint`. They cannot deploy to LangGraph Cloud the way the `cockpit/langgraph/**` examples do — LangGraph Cloud hosts compiled graphs, not arbitrary FastAPI apps.

We need somewhere to host the FastAPI surface so the cockpit "Run" tab works for AG-UI examples in production.

## Goals

- Host the AG-UI FastAPI runtimes at a stable URL the cockpit can rewrite to.
- Deploy automatically from `main` when AG-UI Python files change.
- Defend the runtime against abuse — it has an OpenAI key.
- Mirror the structural pattern of `scripts/generate-shared-deployment-config.ts` + `.github/workflows/deploy-langgraph.yml` so future contributors find what they expect.

## Non-Goals

See **Out of Scope** below.

## Design

### 1. Repo layout

New top-level directory `deployments/ag-ui-dev/`:

```
deployments/ag-ui-dev/
├── README.md           # hand-written, brief
├── Dockerfile          # hand-written
├── entrypoint.sh       # hand-written
├── railway.json        # hand-written
├── requirements.txt    # GENERATED
├── server.py           # GENERATED — multi-topic FastAPI app
└── deps/               # GENERATED — staged copies of each example's python tree
    ├── interrupts/
    └── streaming/
```

Generated files carry a `# GENERATED — do not edit. Source: scripts/generate-ag-ui-deployment-config.ts` header. The CI workflow drift-checks them with `git diff --exit-code`.

The name `ag-ui-dev` mirrors the langgraph deployment alias (`cockpit-dev`) — "dev" signals "demo runtime for cockpit," not a hardened production tier.

### 2. Generated FastAPI server

`server.py` is one FastAPI app that mounts each AG-UI topic at `/agent/<topic>`:

```python
# GENERATED — do not edit.
from fastapi import FastAPI, Request, HTTPException
from ag_ui_langgraph import add_langgraph_fastapi_endpoint, LangGraphAgent
import os

# Imports staged into deps/<topic>/
from deps.interrupts.src.graph import graph as interrupts_graph
from deps.streaming.src.graph import graph as streaming_graph

app = FastAPI()

INTERNAL_TOKEN = os.environ["AG_UI_INTERNAL_TOKEN"]

@app.middleware("http")
async def require_internal_token(request: Request, call_next):
    if request.url.path == "/ok":
        return await call_next(request)
    if request.headers.get("x-internal-token") != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="unauthorized")
    return await call_next(request)

@app.get("/ok")
def ok():
    return {"ok": True}

add_langgraph_fastapi_endpoint(
    app,
    LangGraphAgent(name="interrupts", graph=interrupts_graph),
    path="/agent/interrupts",
)
add_langgraph_fastapi_endpoint(
    app,
    LangGraphAgent(name="streaming", graph=streaming_graph),
    path="/agent/streaming",
)
```

`/ok` is unauthenticated so Railway's healthcheck and our smoke test can hit it without holding the token.

### 3. Container

**`Dockerfile`** (multi-stage, Python-only — no Node):

```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
COPY . .
EXPOSE 8000
CMD ["./entrypoint.sh"]
```

**`entrypoint.sh`** — watchdog with startup grace, polls `/ok`, three-strike kill:

```bash
#!/usr/bin/env bash
set -e
uvicorn server:app --host 0.0.0.0 --port "${PORT:-8000}" &
UVICORN_PID=$!

sleep 180  # startup grace — let imports + warm-up settle
STRIKES=0
while kill -0 "$UVICORN_PID" 2>/dev/null; do
  sleep 30
  if curl -fsS "http://127.0.0.1:${PORT:-8000}/ok" >/dev/null; then
    STRIKES=0
  else
    STRIKES=$((STRIKES + 1))
    if [ "$STRIKES" -ge 3 ]; then
      echo "watchdog: 3 strikes, killing uvicorn" >&2
      kill "$UVICORN_PID"
      exit 1
    fi
  fi
done
wait "$UVICORN_PID"
```

**`railway.json`**:

```json
{
  "deploy": {
    "healthcheckPath": "/ok",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### 4. Generator script

`scripts/generate-ag-ui-deployment-config.ts` mirrors the structure of `scripts/generate-shared-deployment-config.ts`:

- Imports `capabilities` from `apps/cockpit/scripts/capability-registry.ts`.
- Filters to entries where `product === 'ag-ui'`.
- For each capability, reads `pythonDir`, copies the tree into `deployments/ag-ui-dev/deps/<topic>/`.
- Emits `requirements.txt` as the union of every example's `requirements.txt` (deduped, version-pinned to the highest).
- Emits `server.py` from a template, one import + one `add_langgraph_fastapi_endpoint` call per topic.
- All emitted files carry the GENERATED header.

The script is idempotent and produces byte-identical output across runs (sorted keys, sorted imports).

### 5. Vercel-side integration via `scripts/assemble-examples.ts`

`examples.threadplane.ai` is served by a single Vercel project (`threadplane-examples`) populated via Vercel's Build Output API. `scripts/assemble-examples.ts` builds all cockpit examples, stages them under `deploy/examples/<product>/<topic>/`, and generates a unified `.vercel/output/config.json` that routes traffic. There are NO per-example Vercel projects, and per-example `vercel.json` files are not consumed by the production deploy.

Changes required:

1. **Add the two ag-ui topics to the `capabilities` list** in `assemble-examples.ts` so their Angular builds get staged.
2. **Add `ag-ui` to the SPA route regex** so `examples.threadplane.ai/ag-ui/<topic>/` returns the static index.html.
3. **Add a route ABOVE the filesystem handle** that proxies AG-UI runtime traffic:
   ```json
   { "src": "^/ag-ui/([^/]+)/agent(/.*)?$", "dest": "/api/ag-ui-proxy/$1$2", "check": true }
   ```
4. **Bundle a new serverless function** at `.vercel/output/functions/api/ag-ui-proxy/[[...path]].func` from `scripts/ag-ui-proxy.ts`.

### 5b. ag-ui-proxy.ts — security hardening at the proxy layer

The proxy runs in Node 20 on Vercel and provides defense-in-depth before any request reaches the OpenAI-backed Railway service:

- **Origin allowlist:** `examples.threadplane.ai`, `cockpit.threadplane.ai`, plus `localhost:4320/4321` for dev. Other origins get 403.
- **Per-IP token-bucket rate limit** via Upstash (`@upstash/ratelimit` + `@upstash/redis`): 10 req/min, prefix `ag-ui-dev:<topic>`. The proxy fails-open if Upstash creds are missing (rather than bricking the runtime) — origin check and token still apply.
- **`X-Internal-Token` injection:** Reads `AG_UI_INTERNAL_TOKEN` from Vercel env, sets it on every upstream request. The Railway FastAPI middleware verifies and returns 401 on mismatch.
- **Streaming-aware forwarding:** AG-UI uses SSE; the proxy pipes the upstream body chunk-by-chunk via `response.body.getReader()`.

**Railway FastAPI middleware** (in `server.py`, generated):
- Returns `JSONResponse(status_code=401)` if `X-Internal-Token` is missing/wrong. (We initially tried `raise HTTPException` but that bubbles past FastAPI's handler inside Starlette `BaseHTTPMiddleware` and surfaces as 500 — caught during T11 smoke.)

**OpenAI account hard cap:** $50/mo project-level spending limit, set in OpenAI dashboard.

**Vercel env vars** required on the `threadplane-examples` project:
- `AG_UI_INTERNAL_TOKEN` (matches Railway)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

This is materially stronger than the existing langgraph proxy (which has no rate limit, no origin check, no token, and relies on LangSmith billing limits). Backporting to langgraph is tracked in Out of Scope.

### 6. CI deploy workflow

`.github/workflows/deploy-ag-ui.yml`:

- Triggers on push to `main` with path filters:
  - `cockpit/ag-ui/**/python/**`
  - `apps/cockpit/scripts/capability-registry.ts`
  - `scripts/generate-ag-ui-deployment-config.ts`
  - `deployments/ag-ui-dev/**`
- Steps:
  1. Checkout, setup Node, install root deps.
  2. Run generator: `npx tsx scripts/generate-ag-ui-deployment-config.ts`.
  3. Drift check: `git diff --exit-code deployments/ag-ui-dev/` — fails CI if generated files are stale.
  4. Install Railway CLI.
  5. `railway up --service ag-ui-dev --detach` (uses `RAILWAY_TOKEN` from CI secrets).
- `OPENAI_API_KEY` and `AG_UI_INTERNAL_TOKEN` live on Railway as service env vars, not in CI.

### 7. Validation & smoke testing

**Layer 1 — Railway health check (continuous):** `healthcheckPath: "/ok"` in `railway.json`. Railway probes during and after deploy; failed checks roll back.

**Layer 2 — Production smoke (every push to main):** Extend `apps/website-e2e/src/production-smoke.spec.ts`:

```ts
test('ag-ui-dev railway service is reachable', async ({ request }) => {
  const res = await request.get('https://ag-ui-dev.up.railway.app/ok');
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true });
});

test('ag-ui examples rewrite to railway backend', async ({ request }) => {
  const res = await request.post(
    'https://examples.threadplane.ai/ag-ui/interrupts/agent/interrupts',
    {
      headers: { Origin: 'https://examples.threadplane.ai' },
      data: { /* minimal AG-UI run-agent payload */ },
    }
  );
  expect([200, 202]).toContain(res.status());
});
```

The second test exercises the full Vercel-rewrite → middleware → Railway → FastAPI path — the one that catches real breakage.

**Layer 3 — Local dev (unchanged):** `apps/cockpit/.env` symlinks to root `.env`. For local Python:

```bash
cd cockpit/ag-ui/interrupts/python
uv run uvicorn src.app:app --port 5320
```

`deployments/ag-ui-dev/` is the deployment artifact, not the dev surface. `deployments/ag-ui-dev/README.md` says so.

### 8. Out of Scope

1. **Backporting hardening to the langgraph proxy.** Same middleware pattern, separate PR after this proves out.
2. **`examples/chat/ag-ui-*` website examples.** Cockpit-only here; website examples are a separate effort.
3. **Multi-region / autoscaling.** Single Railway region/replica is enough for demo traffic.
4. **Custom domain (`ag-ui-dev.threadplane.ai`).** Railway subdomain is fine since end users hit the Vercel hostname.
5. **Observability beyond Railway logs.** `print()` + `PYTHONUNBUFFERED` + Railway's log pane.
6. **Automated secret rotation.** Manual rotation via Railway dashboard.
7. **Spend alerting beyond OpenAI's hard cap.** Project-level $50/mo cap is the backstop.

## Risks

- **Railway free tier eviction.** Hobby plan can sleep services. If demos start cold-failing, upgrade to a paid plan.
- **Generator drift.** If a contributor edits generated files instead of the template, CI's `git diff --exit-code` catches it. The GENERATED header is the only thing pointing them to the right file.
- **Rate limit false positives.** 10 req/min per IP is fine for solo cockpit users; office/shared NATs may need a bump.
- **Token rotation coordination.** `AG_UI_INTERNAL_TOKEN` lives in both Vercel and Railway; rotating requires updating both. Document in `deployments/ag-ui-dev/README.md`.

## Files Touched

**New:**
- `deployments/ag-ui-dev/{README.md,Dockerfile,entrypoint.sh,railway.json}`
- `scripts/generate-ag-ui-deployment-config.ts`
- `.github/workflows/deploy-ag-ui.yml`
- `apps/website/src/examples/ag-ui/interrupts/vercel.json`
- `apps/website/src/examples/ag-ui/streaming/vercel.json`
- Vercel edge middleware (per ag-ui example)

**Modified:**
- `apps/website-e2e/src/production-smoke.spec.ts` (two new tests)

**Generated (committed, drift-checked):**
- `deployments/ag-ui-dev/{requirements.txt,server.py,deps/}`
