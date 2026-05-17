# c-* Per-Capability Backend Cleanup — Design

**Date:** 2026-05-16
**Status:** Spec — pending implementation plan

## Goal

Make every `cockpit/chat/<name>/python/` a real, runnable, self-contained example backend that:

1. Starts via `nx serve cockpit-chat-<name>-python` on a predictable per-cap port
2. Is the actual dev-loop target for the matching `cockpit-chat-<name>-angular`
3. Serves as documentation of "minimal single-capability LangGraph backend"
4. Currently matches what umbrella's `c-<topic>` graph emits in production

**Production deploy stays unchanged.** Umbrella (`cockpit/langgraph/streaming/python/`) remains the canonical source for the shared LangGraph Cloud deployment `cockpit-dev` (built by `scripts/generate-shared-deployment-config.ts` from `capability-registry.ts`). Per-cap copies are intentionally maintained parallel artifacts — dev-loop convenience + standalone examples.

Out of scope:
- Refactoring per-cap copies into shared-package imports (explicitly rejected: user prefers full copies for example clarity)
- Production deploy changes
- Frontend (Angular) graph code changes — only env + proxy files touched
- New nx serve target for umbrella

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Production source | Unchanged — umbrella drives the shared deploy. Per-cap copies are dev-only. |
| 2 | Code sharing | Each per-cap python/ keeps its **own full copy** of graph code + tools (no umbrella imports). Drift maintenance accepted. |
| 3 | Port scheme | Each per-cap python backend runs on `<angular_port> + 1000`. Captured as `pythonPort` field in `capability-registry.ts`. |
| 4 | nx serve | Each per-cap python/ gets a `project.json` with `serve` (runs `langgraph dev --port`) + `build` targets. |
| 5 | Content drift | In-scope — per-cap python/graph.py audited and synced to match what umbrella's `c-<topic>` emits today (post-PR1-2-3-4). |

## Port assignments

Source of truth: `apps/cockpit/scripts/capability-registry.ts` extended with `pythonPort` per cap.

| Cap | Angular `port` | New `pythonPort` |
|---|---|---|
| c-messages | 4501 | 5501 |
| c-input | 4502 | 5502 |
| c-interrupts | 4503 | 5503 |
| c-tool-calls | 4504 | 5504 |
| c-subagents | 4505 | 5505 |
| c-threads | 4506 | 5506 |
| c-timeline | 4507 | 5507 |
| c-generative-ui | 4508 | 5508 |
| c-debug | 4509 | 5509 |
| c-theming | 4510 | 5510 |
| c-a2ui | 4511 | 5511 |

Note: generative-ui's `environment.development.ts` currently says `4310`; registry says `4508`. Registry is canonical — env gets fixed to `/api`.

## Wiring fixes (every cap, 4 files each)

### 1. `cockpit/chat/<name>/python/project.json` (NEW for all 11)

```json
{
  "name": "cockpit-chat-<name>-python",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/chat/<name>/python/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/cockpit/chat/<name>/python"],
      "options": {
        "outputPath": "dist/cockpit/chat/<name>/python",
        "main": "cockpit/chat/<name>/python/src/index.ts",
        "tsConfig": "cockpit/chat/<name>/python/tsconfig.json"
      }
    },
    "serve": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "cockpit/chat/<name>/python",
        "command": "uv run langgraph dev --port 55<XX> --no-browser"
      }
    }
  }
}
```

Some per-cap dirs may already have a `tsconfig.json`; if not, add a minimal one. The `build` target mirrors umbrella's `cockpit/langgraph/streaming/python` pattern so that the TS module export (`src/index.ts`) compiles cleanly. `serve` uses `langgraph dev` exclusively for the Python graph runtime.

### 2. `cockpit/chat/<name>/python/langgraph.json` outliers

```diff
- "generative_ui": "./src/graph.py:graph"
+ "c-generative-ui": "./src/graph.py:graph"
```
```diff
- "a2ui_form": "./src/graph.py:graph"
+ "c-a2ui": "./src/graph.py:graph"
```
All other 9 caps already use `c-<topic>` — no change needed.

### 3. `cockpit/chat/<name>/angular/src/environments/environment.development.ts`

All 11 caps — replace `http://localhost:4XXX/api` with `/api`, ensure `*AssistantId` value is `c-<topic>`:

```ts
export const environment = {
  production: false,
  langGraphApiUrl: '/api',
  <fieldName>AssistantId: 'c-<topic>',
};
```

Field name (`streamingAssistantId` / `generativeUiAssistantId` / `a2uiAssistantId`) stays as-is per cap because the matching Angular component reads that specific property. Only the value (`c-<topic>`) is what we standardize.

### 4. `cockpit/chat/<name>/angular/proxy.conf.json`

```json
{
  "/api": {
    "target": "http://localhost:55<XX>",
    "secure": false,
    "changeOrigin": true,
    "pathRewrite": { "^/api": "" },
    "ws": true
  }
}
```

All 11 caps — target = per-cap pythonPort. Fixes the 2 outliers (subagents was `8125`, tool-calls was `8124`) and the 9 that all targeted `8123`.

### 5. `apps/cockpit/scripts/capability-registry.ts`

Add `pythonPort: <port> + 1000` to each chat cap entry. Type update:

```ts
type Capability = {
  // ...existing fields...
  port: number;        // Angular dev server
  pythonPort?: number; // Per-cap langgraph dev server (chat caps only)
  pythonDir: string;
  graphName: string;
};
```

Verify generative-ui port in the registry is `4508` (it is) and that the dev env stops drifting to `4310`. Production deploy script (`scripts/generate-shared-deployment-config.ts`) does NOT use `pythonPort` — it still uses `pythonDir` which still points at umbrella. So the registry change is additive.

## Content sync (per-cap graph.py)

Each per-cap python/graph.py and prompts/<name>.md should match what umbrella's `c-<topic>` graph emits today. Audit + sync per the table below.

| Cap | Current size | Expected source pattern | Action |
|---|---|---|---|
| messages, input, debug, interrupts, theming, threads, timeline (7 caps) | 37-57 lines each | Single-node `system_prompt + LLM` via `_build_prompt_graph(prompt_file)` factory (PR 2 pattern) | Verify graph.py matches umbrella's factory output; verify prompt files match PR 2 aviation prompts. Fix if drifted. |
| tool-calls | 75 lines | Real LLM bound with `[lookup_flight, get_airport_info, find_routes]` (PR 1 aviation tools); standard ToolNode agent loop | Replace stub with full PR 1 implementation. Inline `aviation_tools` module (same pattern as a2ui standalone). |
| subagents | 63 lines | Orchestrator LLM with `task(role, task_description)` tool dispatching to 3 internal subagent functions (research/booking/itinerary) (PR 1) | Replace stub with full PR 1 implementation. Inline `aviation_tools`. |
| generative-ui | 176 lines (PR 3 dashboard) | Match `dashboard_graph.py` from umbrella post-PR3 + post-PR-A (get_stream_writer fix) + post-PR-E (gpt-5 planner) | Verify; expected in sync (was already synced in PR 3 + bug-fix PRs touched both copies). |
| a2ui | 505 lines (PR 4) | Match umbrella's a2ui_graph.py post-PR4 | Verify; expected in sync (PR 4 mirrored at every step). |

**Inlining policy.** When a per-cap graph needs tools or data fixtures, inline them directly into `python/src/` (e.g. `python/src/aviation_tools.py`, inline `_FLIGHTS` list) instead of importing from umbrella. This keeps each per-cap a true self-contained example — exactly the pattern PR 4 used for a2ui and PR 3 used for generative-ui standalone.

## Frontend changes — NONE

The Angular apps' component code (e.g. `MessagesComponent`, `A2uiComponent`) read `environment.<fieldName>AssistantId` directly. Field NAMES stay; only values + the URL get fixed. No template changes.

## Files modified summary

| Type | Count | Notes |
|---|---|---|
| NEW `cockpit/chat/<name>/python/project.json` | 11 | One per cap |
| Modified `cockpit/chat/<name>/python/langgraph.json` | 2 | generative-ui, a2ui outlier graph names |
| Modified `cockpit/chat/<name>/python/src/graph.py` | up to 11 | After content audit; expected 9 (skip generative-ui + a2ui if verified in sync) |
| Modified `cockpit/chat/<name>/python/prompts/<name>.md` | up to 7 | Only the 7 prompt-only caps; only if drifted from PR 2 prompts |
| NEW `cockpit/chat/<name>/python/src/aviation_tools.py` | 2 | tool-calls + subagents need inlined aviation tools (matches a2ui's inline FLIGHTS pattern) |
| Modified `cockpit/chat/<name>/angular/src/environments/environment.development.ts` | 11 | URL + assistantId value |
| Modified `cockpit/chat/<name>/angular/proxy.conf.json` | 11 | Target = pythonPort |
| Modified `apps/cockpit/scripts/capability-registry.ts` | 1 | Add `pythonPort` field per chat cap |
| (Optional) NEW `cockpit/chat/<name>/python/tsconfig.json` | up to 11 | Add if missing; mirror umbrella's |

## Testing

**Build:**
- `pnpm nx run-many -t build --projects='cockpit-chat-*-python'` — every per-cap python build is green
- `pnpm nx run-many -t build --projects='cockpit-chat-*-angular'` — every Angular build is green

**Boot smoke (automated):**
For each cap, in a temporary scripted loop:
1. `nx serve cockpit-chat-<name>-python` in background
2. Wait for `Application started up` in log (or 60s timeout)
3. `curl -fs http://localhost:55XX/ok` — backend healthy
4. Kill backend, continue

This confirms every per-cap backend boots without import errors and listens on its assigned port. Failure = the per-cap graph.py has a bug (missing import, syntax error, missing prompt file).

**Manual chrome MCP smoke (3 spot checks):**
- `c-messages` — simplest prompt-only cap
- `c-tool-calls` — verifies the full aviation tools graph in a per-cap context
- `c-a2ui` — verifies the most complex per-cap graph still works against its own backend (rather than the umbrella we've been using)

For each: start matched `nx serve` pair, exercise via chrome MCP, capture screenshot.

**Production deploy unaffected:**
- `npx tsx scripts/generate-shared-deployment-config.ts` runs clean
- Generated `deployments/shared-dev/langgraph.json` is byte-identical to current main (umbrella source unchanged)

## Risks and mitigations

- **PR is broad** (~33-44 small file edits). Mitigation: structured into wiring tasks (Tasks 1-5 of the plan) and content-sync tasks (Tasks 6-12 of the plan). Reviewer can spot-check by category.
- **Stale prompts in per-cap caps.** If a prompt drifted from PR 2's aviation rewrite, audit catches it. Mitigation: explicit per-cap audit task in the plan.
- **uv/langgraph dev port conflicts when running batch boot smoke.** Mitigation: kill the previous before starting the next; never run more than one at a time during the boot smoke.
- **The `pythonDir` field still points at umbrella for production.** This is intentional — production source of truth doesn't change. Mitigation: explicit assertion in plan + spec.
- **chrome MCP hydration race.** Already known; use JS-injected input as in PR 4.

## Out-of-scope follow-ups

- Refactor to shared-package imports (rejected for this round — full copies preferred for example clarity)
- Add CI check that prevents per-cap copies from drifting (could be a future automated diff/snapshot test)
- Document the per-cap example pattern in the cockpit docs (separate doc PR)
- Add nx serve target for umbrella (currently has only build + smoke; not blocking since per-cap covers dev needs after this PR)
