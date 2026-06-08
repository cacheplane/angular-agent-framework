# examples/ag-ui Local-Runnable Example Implementation Plan (Part 2a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone, locally-runnable `examples/ag-ui/` — a single-conversation chat app fronted by the AG-UI adapter (`provideAgent`) talking to a duplicated a2ui LangGraph graph served over `ag-ui-langgraph` via uvicorn — demonstrating LangGraph↔AG-UI transport + a2ui parity.

**Architecture:** Fork the `examples/chat` Python graph verbatim (transport-agnostic). Build a *simplified* Angular app (single conversation, no thread sidebar — ag-ui has no thread-CRUD equivalent) that hosts `<chat>` via `provideAgent({ url: '/agent' })`. Add a `server.py` wrapping the graph with `add_langgraph_fastapi_endpoint(path='/agent')` + token-optional auth + `/ok` health. Dev: an Angular `proxy.conf` routes `/agent` → the uvicorn port.

**Tech Stack:** Angular (standalone, zoneless), `@threadplane/ag-ui`, `@threadplane/chat`, Nx; Python 3.12, LangGraph, `ag-ui-langgraph`, FastAPI, uvicorn; vitest/pytest.

**Spec:** `docs/superpowers/specs/2026-06-06-examples-ag-ui-standalone-design.md` (Part 2). **Scope refinement (this plan):** the shell is a simplified single-conversation chat, not a fork of `examples/chat`'s thread-managed `demo-shell` — `LangGraphThreadsAdapter` (thread CRUD) has no AG-UI equivalent. e2e/smoke = Part 2b; deploy = Part 3.

---

## File Structure

**New — `examples/ag-ui/python/`** (graph copied verbatim from `examples/chat/python`; server + config new):
- `src/graph.py`, `src/schemas/**`, `src/streaming/**` — verbatim copy (transport-agnostic a2ui graph).
- `src/server.py` — FastAPI app: `add_langgraph_fastapi_endpoint(graph, path='/agent')` + token-optional middleware + `/ok`.
- `pyproject.toml` — copy + add `ag-ui-langgraph`, `fastapi`, `uvicorn`.
- `requirements.txt` — uv-exported (for Part 3 Docker; generated here).
- `langgraph.json`, `.env.example`, `.python-version`, `project.json`, `README.md`.

**New — `examples/ag-ui/angular/`** (simplified single-conversation app):
- `src/app/app.config.ts` — `provideAgent({ url: '/agent' })` + `provideChat` + telemetry.
- `src/app/app.ts` + `src/app/app.html` — single-conversation `<chat>` host.
- `src/main.ts`, `src/index.html`, `src/styles.css`, `src/test-setup.ts`.
- `src/environments/environment.ts` + `environment.development.ts` — `agentUrl: '/agent'`.
- `proxy.conf.mjs` — dev: `/agent` → `http://localhost:8000`.
- `project.json`, `tsconfig.json`, `tsconfig.app.json`, `vite.config.mts`, `public/favicon.ico`.

**New — `examples/ag-ui/project.json`** — umbrella project (mirror `examples/chat/project.json`).

---

## Task 1: Python backend — copy graph + ag-ui server

**Files:** create `examples/ag-ui/python/**`

- [ ] **Step 1: Copy the chat Python tree (graph is transport-agnostic)**

```bash
mkdir -p examples/ag-ui/python
cp -R examples/chat/python/src examples/ag-ui/python/src
cp examples/chat/python/langgraph.json examples/chat/python/.python-version examples/ag-ui/python/
cp examples/chat/python/.env.example examples/ag-ui/python/.env.example
# Do NOT copy: .venv, .langgraph_api, .pytest_cache, uv.lock, tests/ (Part 2b), .env
rm -rf examples/ag-ui/python/src/__pycache__ examples/ag-ui/python/src/**/__pycache__ 2>/dev/null || true
```

Verify the graph entry exists:
```bash
grep -n "^graph = " examples/ag-ui/python/src/graph.py
```
Expected: `graph = _builder.compile()` (the importable `graph` symbol).

- [ ] **Step 2: Write `examples/ag-ui/python/src/server.py`**

```python
# SPDX-License-Identifier: MIT
"""Standalone AG-UI server for the examples/ag-ui demo.

Wraps the (transport-agnostic) chat graph with ag-ui-langgraph and serves it
over an AG-UI FastAPI endpoint at /agent. Mirrors the cockpit ag-ui pattern.

Auth is OPTIONAL for clone-and-run: the X-Internal-Token check is enforced
only when AG_UI_INTERNAL_TOKEN is set (production), so `uvicorn src.server:app`
works locally with no env beyond OPENAI_API_KEY.
"""
import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from ag_ui_langgraph import add_langgraph_fastapi_endpoint, LangGraphAgent

from .graph import graph

AG_UI_INTERNAL_TOKEN = os.environ.get("AG_UI_INTERNAL_TOKEN")

app = FastAPI(title="examples-ag-ui")


@app.middleware("http")
async def require_internal_token(request: Request, call_next):
    # /ok is always open (health). Token is enforced only when configured.
    if request.url.path == "/ok" or not AG_UI_INTERNAL_TOKEN:
        return await call_next(request)
    if request.headers.get("x-internal-token") != AG_UI_INTERNAL_TOKEN:
        return JSONResponse(status_code=401, content={"detail": "unauthorized"})
    return await call_next(request)


@app.get("/ok")
def ok() -> dict:
    return {"ok": True}


add_langgraph_fastapi_endpoint(app, LangGraphAgent(name="chat", graph=graph), path="/agent")
```

> Note the `JSONResponse(401)` (NOT `raise HTTPException`, which surfaces as 500 inside Starlette middleware — see repo memory).

- [ ] **Step 3: Write `examples/ag-ui/python/pyproject.toml`**

```toml
[project]
name = "examples-ag-ui-python"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "langgraph>=0.3",
    "langchain-openai>=0.3",
    "ag-ui-langgraph>=0.0.37",
    "fastapi>=0.115",
    "uvicorn>=0.30",
    "python-dotenv>=1.0",
]

[tool.uv]
dev-dependencies = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src"]

[tool.pytest.ini_options]
markers = [
    "smoke: smoke tests that run on every CI build",
]
asyncio_mode = "auto"
```

- [ ] **Step 4: Create the venv + lock + verify the server imports**

```bash
cd examples/ag-ui/python
uv venv && uv sync 2>&1 | tail -5
uv export --no-hashes -o requirements.txt 2>&1 | tail -2
uv run python -c "from src.server import app; print('server import OK:', app.title)"
```
Expected: `server import OK: examples-ag-ui` (confirms graph + ag-ui-langgraph wiring imports). Return to repo root afterward (`cd ../../..`).

> If `uv sync` fails resolving `ag-ui-langgraph`, check the exact version available (the cockpit ag-ui examples pin `ag-ui-langgraph==0.0.37`); align the constraint.

- [ ] **Step 5: Write `examples/ag-ui/python/project.json`**

```json
{
  "name": "examples-ag-ui-python",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "examples/ag-ui/python/src",
  "targets": {}
}
```

- [ ] **Step 6: Write `examples/ag-ui/python/README.md`**

```markdown
# examples/ag-ui — Python backend

The (duplicated) chat a2ui graph served over AG-UI via `ag-ui-langgraph`.

```bash
cd examples/ag-ui/python
uv venv && uv sync
OPENAI_API_KEY=sk-... uv run uvicorn src.server:app --port 8000
```

`/ok` is the health route; the agent is mounted at `/agent`. The graph is
duplicated from `examples/chat/python` (copy, don't import — standalone
examples convention); it is transport-agnostic and unchanged.
```

- [ ] **Step 7: Commit**

```bash
git add examples/ag-ui/python
git commit -m "feat(examples/ag-ui): python backend — duplicated a2ui graph served over ag-ui (uvicorn)"
```

---

## Task 2: Angular app — scaffold + transport-swapped config

**Files:** create `examples/ag-ui/angular/**`

- [ ] **Step 1: Copy the build scaffolding from examples/chat (configs only, not the shell)**

```bash
mkdir -p examples/ag-ui/angular/src/app examples/ag-ui/angular/src/environments examples/ag-ui/angular/public
cp examples/chat/angular/tsconfig.json examples/ag-ui/angular/tsconfig.json
cp examples/chat/angular/tsconfig.app.json examples/ag-ui/angular/tsconfig.app.json
cp examples/chat/angular/vite.config.mts examples/ag-ui/angular/vite.config.mts
cp examples/chat/angular/src/test-setup.ts examples/ag-ui/angular/src/test-setup.ts
cp examples/chat/angular/src/styles.css examples/ag-ui/angular/src/styles.css
cp examples/chat/angular/public/favicon.ico examples/ag-ui/angular/public/favicon.ico
cp examples/chat/angular/proxy.conf.mjs examples/ag-ui/angular/proxy.conf.mjs 2>/dev/null || true
```

- [ ] **Step 2: Write `examples/ag-ui/angular/project.json`**

Adapt `examples/chat/angular/project.json` with these path substitutions (replace every `examples/chat/angular` → `examples/ag-ui/angular`, `examples-chat-angular` → `examples-ag-ui-angular`, output `dist/examples/chat/angular` → `dist/examples/ag-ui/angular`). Keep the build/serve/test target shapes identical. Add a `serve` proxy option if examples/chat doesn't already point at `proxy.conf.mjs`:

```json
{
  "name": "examples-ag-ui-angular",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "examples/ag-ui/angular/src",
  "projectType": "application",
  "prefix": "app",
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "outputs": ["{options.outputPath.base}"],
      "options": {
        "outputPath": { "base": "dist/examples/ag-ui/angular", "browser": "" },
        "index": "examples/ag-ui/angular/src/index.html",
        "browser": "examples/ag-ui/angular/src/main.ts",
        "tsConfig": "examples/ag-ui/angular/tsconfig.app.json",
        "assets": [{ "glob": "**/*", "input": "examples/ag-ui/angular/public" }],
        "styles": ["examples/ag-ui/angular/src/styles.css"]
      },
      "configurations": {
        "production": {
          "budgets": [
            { "type": "initial", "maximumWarning": "500kb", "maximumError": "1.5mb" },
            { "type": "anyComponentStyle", "maximumWarning": "10kb", "maximumError": "16kb" }
          ],
          "outputHashing": "all"
        },
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true,
          "fileReplacements": [
            { "replace": "examples/ag-ui/angular/src/environments/environment.ts",
              "with": "examples/ag-ui/angular/src/environments/environment.development.ts" }
          ]
        }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "executor": "@angular/build:dev-server",
      "options": { "proxyConfig": "examples/ag-ui/angular/proxy.conf.mjs" },
      "configurations": {
        "development": { "buildTarget": "examples-ag-ui-angular:build:development" },
        "production": { "buildTarget": "examples-ag-ui-angular:build:production" }
      },
      "defaultConfiguration": "development"
    },
    "test": {
      "executor": "@nx/vite:test",
      "options": { "config": "examples/ag-ui/angular/vite.config.mts" }
    }
  }
}
```

> Read `examples/chat/angular/project.json` first and reconcile any target options that differ (e.g. polyfills, `inlineStyleLanguage`). Match its shape; only the paths/names/proxy change.

- [ ] **Step 3: Write `proxy.conf.mjs`** (dev routes `/agent` to the local uvicorn)

```js
// SPDX-License-Identifier: MIT
// Dev only: routes the relative /agent calls to the local uvicorn ag-ui server.
export default {
  '/agent': { target: 'http://localhost:8000', secure: false, changeOrigin: true, ws: true },
};
```

- [ ] **Step 4: Write the environments**

`examples/ag-ui/angular/src/environments/environment.ts`:
```ts
// SPDX-License-Identifier: MIT
export const environment = {
  production: true,
  agentUrl: '/agent',
  telemetry: { enabled: false, sampleRate: 1 },
  license: undefined as string | undefined,
};
```
`examples/ag-ui/angular/src/environments/environment.development.ts`:
```ts
// SPDX-License-Identifier: MIT
export const environment = {
  production: false,
  agentUrl: '/agent',
  telemetry: { enabled: false, sampleRate: 1 },
  license: undefined as string | undefined,
};
```

- [ ] **Step 5: Write `src/index.html` + `src/main.ts`**

`examples/ag-ui/angular/src/index.html` (mirror examples/chat's; set title):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>AG-UI Chat — Threadplane Example</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
```
`examples/ag-ui/angular/src/main.ts`:
```ts
// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

- [ ] **Step 6: Commit**

```bash
git add examples/ag-ui/angular
git commit -m "feat(examples/ag-ui): angular scaffold (project.json, env, proxy, index/main)"
```

---

## Task 3: Angular app — provideAgent config + single-conversation host

**Files:** create `examples/ag-ui/angular/src/app/{app.config.ts,app.ts,app.html}`

- [ ] **Step 1: Write `app.config.ts` (the transport swap — the heart of the parity demo)**

```ts
// SPDX-License-Identifier: MIT
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideThreadplaneTelemetry } from '@threadplane/telemetry/browser';
import { provideChat } from '@threadplane/chat';
import { provideAgent } from '@threadplane/ag-ui';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideThreadplaneTelemetry(environment.telemetry),
    // AG-UI transport: the entire difference from examples/chat is this line
    // (examples/chat uses LANGGRAPH_THREADS_CONFIG + @threadplane/langgraph).
    provideAgent({ url: environment.agentUrl }),
    provideChat({ license: environment.license }),
  ],
};
```

> Verify the exact `provideAgent` option key by reading `libs/ag-ui/src/lib/provide-agent.ts` (`AgentConfig`). The cockpit ag-ui examples call `provideAgent({ url: '/agent' })`. If `provideThreadplaneTelemetry` requires a different config shape than `environment.telemetry`, match `examples/chat/angular/src/app/app.config.ts`'s usage.

- [ ] **Step 2: Write the single-conversation host component `app.ts` + `app.html`**

`examples/ag-ui/angular/src/app/app.ts`:
```ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectAgent } from '@threadplane/ag-ui';
import { Chat } from '@threadplane/chat';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chat],
  templateUrl: './app.html',
})
export class App {
  protected readonly agent = injectAgent();
}
```

`examples/ag-ui/angular/src/app/app.html`:
```html
<main class="ag-ui-demo">
  <header class="ag-ui-demo__header">
    <h1>AG-UI Chat</h1>
    <p>The Threadplane chat UI over the AG-UI transport.</p>
  </header>
  <chat main [agent]="agent" class="ag-ui-demo__chat" />
</main>
```

> Verify the `<chat>` selector/inputs and the `Chat` export name against `libs/chat/src/public-api.ts` and how the cockpit ag-ui examples template it (`cockpit/ag-ui/streaming/angular/src/app/streaming.component.ts` uses `<chat main [agent]="agent" />`). Match that exactly. If `injectAgent`/`Chat` are imported from different entry points, fix the imports to match the cockpit ag-ui example.

- [ ] **Step 3: Add minimal layout styles to `src/styles.css`**

Append:
```css
.ag-ui-demo { display: flex; flex-direction: column; height: 100dvh; }
.ag-ui-demo__header { padding: 12px 16px; border-bottom: 1px solid var(--tp-border, #e5e7eb); }
.ag-ui-demo__header h1 { margin: 0; font-size: 1.1rem; }
.ag-ui-demo__header p { margin: 2px 0 0; font-size: 0.85rem; opacity: 0.7; }
.ag-ui-demo__chat { flex: 1 1 auto; min-height: 0; }
```

- [ ] **Step 4: Build the app**

Run: `npx nx build examples-ag-ui-angular`
Expected: builds successfully. If it fails on a missing import/selector, fix against the cockpit ag-ui example references noted above and rebuild. Do NOT introduce any `@threadplane/langgraph` import (that's the whole point — this app is langgraph-free).

- [ ] **Step 5: Confirm no langgraph coupling leaked in**

Run: `grep -rn "@threadplane/langgraph\|LANGGRAPH\|langGraphApiUrl\|LangGraphThreads" examples/ag-ui/angular/src || echo "clean: no langgraph references"`
Expected: `clean: no langgraph references`.

- [ ] **Step 6: Commit**

```bash
git add examples/ag-ui/angular/src/app examples/ag-ui/angular/src/styles.css
git commit -m "feat(examples/ag-ui): provideAgent config + single-conversation chat host"
```

---

## Task 4: Umbrella project + local end-to-end verification

**Files:** create `examples/ag-ui/project.json`

- [ ] **Step 1: Write `examples/ag-ui/project.json`**

Read `examples/chat/project.json` and mirror it, substituting `chat` → `ag-ui` in name/paths:
```json
{
  "name": "examples-ag-ui",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "library",
  "targets": {}
}
```
(If `examples/chat/project.json` has real targets, mirror their shape with paths adjusted.)

- [ ] **Step 2: Start the backend**

```bash
cd examples/ag-ui/python
OPENAI_API_KEY="$(grep -E '^OPENAI_API_KEY=' /Users/blove/repos/angular-agent-framework/.env | cut -d= -f2-)" uv run uvicorn src.server:app --port 8000 &
sleep 5
curl -fsS http://localhost:8000/ok && echo
cd ../../..
```
Expected: `{"ok":true}`.

- [ ] **Step 3: Drive one real run through the backend (a2ui path)**

```bash
curl -sS --max-time 45 -X POST http://localhost:8000/agent \
  -H "content-type: application/json" -H "accept: text/event-stream" \
  -d '{"threadId":"local","runId":"r1","messages":[{"id":"u1","role":"user","content":"show me the weather in Paris"}],"state":{},"tools":[],"context":[],"forwardedProps":{}}' \
  | grep -oE '"type":"[A-Z_]+"' | sort | uniq -c
```
Expected: AG-UI events including `RUN_STARTED`, `TEXT_MESSAGE_*` and/or `TOOL_CALL_*` (the a2ui `render_a2ui_surface` tool call) and `RUN_FINISHED`. This proves the duplicated graph emits a2ui over ag-ui.

> The exact prompt that triggers a2ui depends on the graph; if "weather" doesn't trigger a surface, read `examples/chat/python/src/graph.py` for the tool-triggering intent and use a matching prompt. The pass criterion is a completed AG-UI run with tool-call events, not a specific surface.

- [ ] **Step 4: Serve the Angular app + manual check (optional but recommended)**

```bash
npx nx serve examples-ag-ui-angular &
sleep 25
curl -sS -o /dev/null -w 'app http=%{http_code}\n' http://localhost:4200/
```
Expected: `200`. (Full visual a2ui-render confirmation is covered by Part 2b's e2e; this just confirms the app serves and proxies `/agent`.)

- [ ] **Step 5: Tear down the background servers**

```bash
pkill -f "uvicorn src.server:app" 2>/dev/null || true
pkill -f "nx serve examples-ag-ui-angular" 2>/dev/null || true
```

- [ ] **Step 6: Commit**

```bash
git add examples/ag-ui/project.json
git commit -m "feat(examples/ag-ui): umbrella project + local run verified (uvicorn /ok + a2ui run)"
```

---

## Task 5: PR

- [ ] **Step 1: Push + open PR**

```bash
git push -u origin claude/examples-ag-ui-local
gh pr create --title "feat(examples/ag-ui): local-runnable standalone ag-ui chat example (Part 2a)" --body "$(cat <<'EOF'
## Summary

Standalone `examples/ag-ui/` — a single-conversation chat app over the AG-UI transport + a uvicorn `ag-ui-langgraph` backend running the (duplicated) a2ui graph. Demonstrates LangGraph↔AG-UI transport + a2ui parity. Runnable via `nx serve` + `uvicorn`.

- `examples/ag-ui/python/` — chat a2ui graph duplicated verbatim (transport-agnostic) + `server.py` (ag-ui-langgraph, token-optional auth, `/ok`).
- `examples/ag-ui/angular/` — simplified single-conversation `<chat>` host via `provideAgent({ url: '/agent' })`. **No `@threadplane/langgraph`** — the entire delta from `examples/chat` is the transport provider.
- **Scope note:** simplified shell (no thread sidebar) — `LangGraphThreadsAdapter` (thread CRUD) has no AG-UI equivalent. Relies on the `customEvents` signal (#606) for live a2ui.

Part 2a of `docs/superpowers/specs/2026-06-06-examples-ag-ui-standalone-design.md`. e2e/smoke = Part 2b; deploy (Railway + `ag-ui-demo.threadplane.ai`) = Part 3.

## Test plan
- [x] `uvicorn src.server:app` → `/ok` 200; POST `/agent` streams an AG-UI a2ui run.
- [x] `nx build examples-ag-ui-angular` clean; no langgraph references.
- [ ] CI green.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Arm auto-merge**

```bash
gh pr merge <PR_NUMBER> --squash --auto --delete-branch
```

- [ ] **Step 3: Wait for green + merge.** If `Vercel – threadplane` preview fails on the known transient npm-registry 404, redeploy that preview via the Vercel API rather than treating it as a real failure.

---

## Self-Review

- [ ] **Spec coverage (Part 2, local subset):** angular app over provideAgent → Tasks 2-3. Duplicated graph + uvicorn server (token-optional) → Task 1. Local run parity → Task 4. e2e/smoke deferred to Part 2b (noted). Deploy deferred to Part 3 (noted).
- [ ] **No placeholders:** every file has full content or an exact copy+substitute instruction with the reference file named.
- [ ] **Type/name consistency:** `provideAgent`/`injectAgent` from `@threadplane/ag-ui`; `Chat` + `<chat main [agent]>` from `@threadplane/chat`; `environment.agentUrl`/`environment.telemetry`/`environment.license` consistent across app.config (Task 3) + environments (Task 2). Project names `examples-ag-ui-angular` / `examples-ag-ui-python` consistent across project.json + serve buildTarget.
- [ ] **Verify-against-reference notes:** Tasks 2-3 instruct reading `examples/chat/angular/project.json`, `libs/ag-ui/src/lib/provide-agent.ts`, `libs/chat/src/public-api.ts`, and `cockpit/ag-ui/streaming/angular` to pin exact selectors/option keys — these are real files, not placeholders.
