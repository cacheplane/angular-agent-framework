# Deploy Chat & Render Examples to Production

## Problem

All 17 chat and render Angular examples are broken in production at `examples.cacheplane.ai`. The cockpit "Run" tab embeds these via iframe, but the Python backends were never deployed to LangGraph Cloud, the proxy middleware doesn't route their API calls, and there are no production smoke tests to catch this.

The 14 LangGraph and Deep Agents examples work because they have all three pieces: deployment, proxy routing, and health verification.

## Affected Examples

### Chat (11)

| Topic | Graph Name | Proxy Key |
|-------|-----------|-----------|
| a2ui | c-a2ui | c-a2ui |
| debug | c-debug | c-debug |
| generative-ui | c-generative-ui | c-generative-ui |
| input | c-input | c-input |
| interrupts | c-interrupts | c-interrupts |
| messages | c-messages | c-messages |
| subagents | c-subagents | c-subagents |
| theming | c-theming | c-theming |
| threads | c-threads | c-threads |
| timeline | c-timeline | c-timeline |
| tool-calls | c-tool-calls | c-tool-calls |

### Render (6)

| Topic | Graph Name | Proxy Key |
|-------|-----------|-----------|
| computed-functions | r-computed-functions | r-computed-functions |
| element-rendering | r-element-rendering | r-element-rendering |
| registry | r-registry | r-registry |
| repeat-loops | r-repeat-loops | r-repeat-loops |
| spec-rendering | r-spec-rendering | r-spec-rendering |
| state-management | r-state-management | r-state-management |

## Solution

### 1. CI Deployment (`deploy-langgraph.yml`)

Add 17 matrix entries for chat/render backends. Each uses `langgraph deploy --name <graph-name>`. Naming convention: `c-` prefix for chat, `r-` prefix for render (avoids collisions with existing names like `memory`, `interrupts`, `subagents`).

### 2. Deployment URLs (`deployment-urls.json`)

After first deploy, add all 17 URLs. Use `PENDING_DEPLOYMENT` as placeholder until URLs are known — `verify-langgraph-deployments.ts` already skips these.

### 3. Proxy Routing (`scripts/examples-middleware.ts`)

Add entries to `DEPLOYMENT_URLS` and `PATH_TO_KEY` maps for all 17 examples. The proxy resolves the backend from the `Referer` header path (e.g., `chat/a2ui` maps to `c-a2ui`).

### 4. Production Smoke Test (`apps/cockpit/e2e/production-smoke.spec.ts`)

Add all 17 chat/render capabilities to the `CAPABILITIES` array so their Angular apps are verified in production.

### 5. E2E Test Focus: A2UI

The A2UI e2e test should verify the full flow: app loads, chat renders, user can send a message, and an AI response (with A2UI surface) appears. This requires the backend to be deployed and healthy.

## Files Changed

| File | Change |
|------|--------|
| `.github/workflows/deploy-langgraph.yml` | Add 17 matrix entries |
| `deployment-urls.json` | Add 17 entries (PENDING_DEPLOYMENT initially) |
| `scripts/examples-middleware.ts` | Add 17 DEPLOYMENT_URLS + PATH_TO_KEY entries |
| `apps/cockpit/e2e/production-smoke.spec.ts` | Add 17 capabilities to CAPABILITIES array |

## Out of Scope

- Changing the Angular example code (already correct)
- Changing the Python graph code (already correct)
- Library changes (none needed)
