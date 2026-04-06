# Production Deployment — End-to-End Design

## Problem

The cockpit has 14 capability examples (8 LangGraph + 6 Deep Agents), each with an Angular frontend and a Python LangGraph backend. None are deployed to production. The Angular `environment.ts` files still point to `localhost`, the LangGraph Cloud deployments have never been triggered, and there is no hosting for the Angular apps. The cockpit at `https://cockpit.stream-resource.dev` deploys via Vercel but its Run mode iframes show nothing because the Angular apps aren't hosted anywhere.

## Goal

Deploy the full stack to production in three phases:
1. Deploy all 14 Python backends to LangGraph Cloud
2. Build and deploy all 14 Angular apps to Vercel as static sites
3. Wire the cockpit to the production Angular apps and verify end-to-end

After completion, a user visiting `https://cockpit.stream-resource.dev`, navigating to any capability, and switching to Run mode sees a working chat interface that sends messages to a production LangGraph Cloud backend and receives AI responses.

## Architecture Overview

```
cockpit.stream-resource.dev (Vercel / Next.js)
  └─ iframe src: examples.stream-resource.dev/{product}/{topic}/
       └─ Angular static app (Vercel)
            └─ API proxy → https://{org}-{name}.us.langgraph.app
                 └─ LangGraph Cloud (LangSmith-hosted Python backend)
```

Three deployment surfaces, three CI workflows, one verification pipeline.

## Phase 1: LangGraph Cloud — 14 Python Backends

### What exists

- `deploy-langgraph.yml` workflow with a 14-entry matrix
- Each capability has a `langgraph.json` in its `python/` directory
- `LANGSMITH_API_KEY` is already in GitHub Secrets
- Each backend uses `ChatOpenAI()` which requires `OPENAI_API_KEY`

### What needs to happen

1. **Set `OPENAI_API_KEY` in LangGraph Cloud** — each deployed backend reads environment variables from LangGraph Cloud's environment config, not from a local `.env` file. The `OPENAI_API_KEY` must be set in the LangSmith deployment environment (via the LangSmith UI or `langgraph` CLI environment config).

2. **Trigger the deployment** — run `workflow_dispatch` on `deploy-langgraph.yml` with no capability filter to deploy all 14. The workflow runs `langgraph deploy` from each capability's python directory.

3. **Capture deployment URLs** — after deployment, each backend gets a URL of the form `https://{deployment-id}.us.langgraph.app` (or similar). These URLs are needed for Phase 2. They can be retrieved from LangSmith UI or via `langgraph` CLI.

4. **Create a deployment URL registry** — store all 14 deployment URLs in a single file that the Angular environment files and CI verification scripts can reference. This becomes the source of truth for production backend URLs.

### Deployment URL Registry

Create `deployment-urls.json` at the workspace root:

```json
{
  "streaming": "https://cacheplane-streaming-abc123.us.langgraph.app",
  "persistence": "https://cacheplane-persistence-def456.us.langgraph.app",
  "interrupts": "https://cacheplane-interrupts-ghi789.us.langgraph.app",
  ...
}
```

This file is committed to the repo and referenced by:
- Angular `environment.ts` production files (via a build-time script or manual update)
- CI verification scripts

### Verification

For each of the 14 backends:
1. **Health check** — `GET /ok` returns `{"ok": true}`
2. **Smoke test** — create a thread, send "hello" via `/threads/{id}/runs/stream`, verify an AI response with `type: "ai"` appears in the stream

## Phase 2: Angular Example Apps — Vercel Static Hosting

### What exists

- 14 Angular apps, each built by `@angular/build:application` to `dist/cockpit/{product}/{topic}/angular/browser/`
- `cockpit/langgraph/streaming/angular/vercel.json` exists as a template for standalone Angular deployment
- `environment.ts` files have `langGraphApiUrl` pointing to localhost
- The cockpit uses `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL` to construct iframe URLs

### What needs to happen

1. **Create a Vercel project** for `examples.stream-resource.dev`. This is a static hosting project — no framework, just serves static files.

2. **Update Angular `environment.ts` production files** — replace `http://localhost:4XXX/api` with the LangGraph Cloud URL for each capability (from `deployment-urls.json`). The development files stay pointing to localhost for local dev.

3. **Build all 14 Angular apps** — `npx nx run-many -t build --projects='cockpit-*-angular'` produces static output in `dist/`.

4. **Assemble a deploy directory** — copy all 14 built apps into a single directory structure:
   ```
   deploy/examples/
   ├── langgraph/
   │   ├── streaming/     → dist/cockpit/langgraph/streaming/angular/browser/
   │   ├── persistence/   → dist/cockpit/langgraph/persistence/angular/browser/
   │   └── ...
   └── deep-agents/
       ├── planning/      → dist/cockpit/deep-agents/planning/angular/browser/
       └── ...
   ```

5. **Deploy to Vercel** — `vercel deploy --prod` from the assembled directory.

6. **Add CI deploy job** — a new job in `ci.yml` (or a separate workflow) that builds, assembles, and deploys all Angular apps on push to main.

7. **Set `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL`** — in the cockpit's Vercel project environment variables, set this to `https://examples.stream-resource.dev`. The cockpit's `content-bundle.ts` uses this to construct iframe URLs like `https://examples.stream-resource.dev/langgraph/streaming/`.

### Angular Proxy in Production

In local dev, the Angular apps use a proxy (`proxy.conf.json`) to forward `/api` requests to the LangGraph backend. In production, there is no proxy — the Angular app uses the full LangGraph Cloud URL directly via `environment.langGraphApiUrl`. The `@langchain/langgraph-sdk` `Client` constructor takes the full URL.

This means the production `environment.ts` should NOT use `/api` — it should use the full LangGraph Cloud URL:

```typescript
export const environment = {
  production: true,
  langGraphApiUrl: 'https://cacheplane-streaming-abc123.us.langgraph.app',
  streamingAssistantId: 'streaming',
};
```

### CORS

LangGraph Cloud backends need to allow requests from `examples.stream-resource.dev`. LangGraph Cloud typically allows CORS from any origin for the streaming API, but this should be verified. If CORS is restricted, the LangGraph deployment config may need a `cors_allowed_origins` setting.

### Verification

For each of the 14 Angular apps:
1. **Load test** — fetch the production URL, verify HTTP 200
2. **UI render** — Playwright: navigate to URL, verify `cp-chat` component is visible
3. **Send/receive** — Playwright: type "hello", click send, wait for AI response in `.cp-message--ai`

## Phase 3: Cockpit Verification

### What exists

- Cockpit deploys to `https://cockpit.stream-resource.dev` via Vercel
- CI deploy job already exists and runs on push to main
- Post-deploy smoke script already exists (`cockpit-deploy-smoke`)

### What needs to happen

1. **Set `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL`** in Vercel (done in Phase 2)
2. **Trigger cockpit redeploy** — the env var change requires a redeploy for Next.js to pick it up
3. **Verify the cockpit renders** — navigate to cockpit, confirm sidebar loads with all capabilities (no "overview" entries)
4. **Verify Run mode** — for each capability, switch to Run mode, confirm the iframe loads the Angular app from `examples.stream-resource.dev`
5. **End-to-end smoke** — for a representative subset (at minimum streaming, persistence, planning), send a message in Run mode and verify AI response

### CI Verification Pipeline

Add a post-deploy verification job that runs after the deploy job succeeds:

```yaml
production-smoke:
  name: Production smoke test
  needs: [deploy]
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6.0.2
    - uses: actions/setup-node@v6.3.0
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    - run: npx playwright test apps/cockpit/e2e/production-smoke.spec.ts
      env:
        BASE_URL: https://cockpit.stream-resource.dev
        EXAMPLES_URL: https://examples.stream-resource.dev
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

This test file verifies:
- Cockpit loads and sidebar renders
- Run mode iframes load Angular apps
- Chat send/receive works for representative capabilities

## File Map

| Action | File | Phase |
|--------|------|-------|
| Create | `deployment-urls.json` | 1 |
| Create | `scripts/verify-langgraph-backends.ts` | 1 |
| Modify | `cockpit/langgraph/*/angular/src/environments/environment.ts` (8) | 2 |
| Modify | `cockpit/deep-agents/*/angular/src/environments/environment.ts` (6) | 2 |
| Create | `scripts/assemble-examples.ts` | 2 |
| Create | `vercel.examples.json` | 2 |
| Modify | `.github/workflows/ci.yml` | 2, 3 |
| Create | `apps/cockpit/e2e/production-smoke.spec.ts` | 3 |

## Secrets Required

| Secret | Where | Purpose |
|--------|-------|---------|
| `LANGSMITH_API_KEY` | GitHub Actions | LangGraph Cloud deploy |
| `OPENAI_API_KEY` | LangGraph Cloud env | LLM calls in production |
| `OPENAI_API_KEY` | GitHub Actions | Production smoke tests |
| `VERCEL_TOKEN` | GitHub Actions | Vercel deploys (existing) |
| `VERCEL_ORG_ID` | GitHub Actions | Vercel org (existing) |
| `VERCEL_COCKPIT_PROJECT_ID` | GitHub Actions | Cockpit Vercel project (existing) |
| `VERCEL_EXAMPLES_PROJECT_ID` | GitHub Actions | New: examples Vercel project |

## Out of Scope

- Website deployment (already working)
- Chat library rebuild (separate effort)
- Custom domain SSL configuration (Vercel handles this)
- LangGraph Cloud auto-scaling or performance tuning
- Monitoring and alerting
