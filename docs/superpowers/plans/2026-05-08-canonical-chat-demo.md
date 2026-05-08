# Canonical `examples/chat` Demo — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the canonical full-stack demo for `@ngaf/chat` at `examples/chat/` (workspace-linked Angular app + tiny Python LangGraph backend + interactive smoke CLI), and remove the stale `examples/chat-agent/`.

**Architecture:** Three sibling subdirectories (`angular/`, `python/`, `smoke/`) under `examples/chat/`. The Angular app is a workspace-linked Nx project that exercises the three chat compositions (embed, popup, sidebar) via path-based routes, framed by a floating control palette (mode + model + debug + new-conversation). The Python graph is a single-node `__start__ → generate → __end__` LangGraph that streams from `ChatOpenAI` with the model selected by the demo. The smoke CLI scaffolds a fresh, npm-installed consumer at `~/tmp/ngaf` (overridable) by combining a frozen scaffold template with a copy of the demo's `src/app/`.

**Tech Stack:** Angular 21 (workspace `*` deps), `@ngaf/chat`, `@ngaf/langgraph`, `@ngaf/render`, RxJS 7, Nx; Python 3.12 (uv), `langgraph`, `langchain-openai`; Node 22 ESM (`node:readline/promises`, `node:fs/promises`, `node:child_process`).

**Spec:** `docs/superpowers/specs/2026-05-08-canonical-chat-demo-design.md`

**Branch:** `claude/examples-chat-canonical-demo`, branched from `origin/main`.

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commits, PR bodies, or docs. The architecture is independently arrived at.

---

## File Structure

```
examples/chat/
├── README.md                        # dual-audience runbook (Phase 6)
├── project.json                     # aggregate Nx project (`serve` runs both)
│
├── angular/                         # Phases 0,2,3
│   ├── project.json                 # Nx Angular project
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.spec.json
│   ├── public/
│   │   └── favicon.ico
│   └── src/
│       ├── main.ts
│       ├── styles.css
│       ├── index.html
│       └── app/
│           ├── app.config.ts
│           ├── app.routes.ts
│           ├── app.ts                              # root <router-outlet/>
│           ├── app.html
│           ├── shell/
│           │   ├── shell-tokens.ts
│           │   ├── palette-persistence.service.ts
│           │   ├── palette-persistence.service.spec.ts
│           │   ├── demo-shell.component.ts
│           │   ├── demo-shell.component.html
│           │   ├── demo-shell.component.css
│           │   ├── demo-shell.component.spec.ts
│           │   ├── control-palette.component.ts
│           │   ├── control-palette.component.html
│           │   └── control-palette.component.css
│           └── modes/
│               ├── welcome-suggestions.ts          # shared list (DRY)
│               ├── embed-mode.component.ts
│               ├── embed-mode.component.spec.ts
│               ├── popup-mode.component.ts
│               └── sidebar-mode.component.ts
│
├── python/                          # Phase 1
│   ├── project.json
│   ├── pyproject.toml
│   ├── langgraph.json
│   ├── .env.example
│   ├── .python-version
│   ├── README.md
│   ├── src/
│   │   ├── __init__.py
│   │   └── graph.py
│   └── tests/
│       ├── __init__.py
│       └── test_graph_smoke.py
│
└── smoke/                           # Phase 4
    ├── project.json
    ├── README.md
    ├── CHECKLIST.md
    ├── cli.mjs
    └── template/
        ├── package.json
        ├── angular.json
        ├── tsconfig.json
        ├── tsconfig.app.json
        ├── .gitignore
        ├── public/
        │   └── favicon.ico
        └── src/
            ├── main.ts
            ├── styles.css
            └── index.html
```

**Cleanup (Phase 5):** delete `examples/chat-agent/`, update `.github/workflows/{ci,e2e}.yml`, rename + update `e2e/agent-e2e/src/chat-agent.e2e.spec.ts`.

**Root edits (Phase 0):** append `.superpowers/` to root `.gitignore` if missing.

---

# Phase 0 — Scaffolding

### Task 0.1: Create branch + .gitignore entry

**Files:**
- Modify: `.gitignore` (append `.superpowers/` if missing)

- [ ] **Step 1: Branch from origin/main**

```bash
cd /Users/blove/repos/angular-agent-framework
git fetch origin main
git checkout -b claude/examples-chat-canonical-demo origin/main
```

- [ ] **Step 2: Add .gitignore entry**

Run:
```bash
grep -q '^\.superpowers/' .gitignore || printf '\n# superpowers brainstorming output\n.superpowers/\n' >> .gitignore
```

- [ ] **Step 3: Verify**

Run: `tail -3 .gitignore`
Expected: shows `.superpowers/` block.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore .superpowers/ brainstorming output"
```

### Task 0.2: Create top-level `examples/chat/project.json`

**Files:**
- Create: `examples/chat/project.json`

- [ ] **Step 1: Create the aggregate Nx project**

```json
{
  "name": "examples-chat",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "examples/chat",
  "targets": {
    "serve": {
      "executor": "nx:run-commands",
      "options": {
        "commands": [
          "npx nx run examples-chat-python:serve",
          "npx nx run examples-chat-angular:serve"
        ],
        "parallel": true
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/chat/project.json
git commit -m "chore(examples-chat): scaffold aggregate project.json"
```

---

# Phase 1 — Python LangGraph backend

### Task 1.1: Python project files (pyproject, langgraph.json, env)

**Files:**
- Create: `examples/chat/python/pyproject.toml`
- Create: `examples/chat/python/langgraph.json`
- Create: `examples/chat/python/.env.example`
- Create: `examples/chat/python/.python-version`
- Create: `examples/chat/python/README.md`

- [ ] **Step 1: pyproject.toml**

```toml
[project]
name = "examples-chat-python"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "langgraph>=0.3",
    "langchain-openai>=0.3",
    "langgraph-api>=0.8.7",
    "python-dotenv>=1.0",
]

[tool.uv]
dev-dependencies = [
    "langgraph-cli[inmem]>=0.1",
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

- [ ] **Step 2: langgraph.json**

```json
{
  "graphs": {
    "chat": "./src/graph.py:graph"
  },
  "dependencies": ["."],
  "python_version": "3.12",
  "env": ".env"
}
```

- [ ] **Step 3: .env.example**

```
# Copy to .env and fill in your key. Required for the demo to make
# real LLM calls against the OpenAI API.
OPENAI_API_KEY=sk-...
```

- [ ] **Step 4: .python-version**

```
3.12
```

- [ ] **Step 5: README.md**

```markdown
# examples/chat/python

Tiny LangGraph backend for the canonical `@ngaf/chat` demo. Single-node
graph that streams from a `ChatOpenAI` model selected by the client.

## Setup

```bash
cp .env.example .env
# Edit .env to add your OPENAI_API_KEY

uv sync
```

## Run

```bash
uv run langgraph dev --port 2024 --no-browser
```

Or from the repo root: `npx nx run examples-chat-python:serve`.

## Test

```bash
uv run pytest -q          # all tests
uv run pytest -q -m smoke # smoke only
```
```

- [ ] **Step 6: Commit**

```bash
git add examples/chat/python/pyproject.toml \
        examples/chat/python/langgraph.json \
        examples/chat/python/.env.example \
        examples/chat/python/.python-version \
        examples/chat/python/README.md
git commit -m "feat(examples-chat): add python project metadata + langgraph manifest"
```

### Task 1.2: Failing test for graph

**Files:**
- Create: `examples/chat/python/tests/__init__.py` (empty)
- Create: `examples/chat/python/tests/test_graph_smoke.py`

- [ ] **Step 1: empty `tests/__init__.py`**

Run: `touch examples/chat/python/tests/__init__.py`

- [ ] **Step 2: write the failing test**

Path: `examples/chat/python/tests/test_graph_smoke.py`

```python
"""Smoke tests for the examples/chat backend graph.

These tests intentionally do not invoke the LLM — they verify only that
the graph imports cleanly and exposes the expected state shape.
Live-LLM behavior is exercised by the Angular smoke checklist.
"""

import pytest


@pytest.mark.smoke
def test_graph_imports():
    from src.graph import graph
    assert graph is not None


@pytest.mark.smoke
def test_state_shape_includes_messages_and_model():
    from src.graph import State
    annotations = State.__annotations__
    assert "messages" in annotations, "State must have a `messages` channel"
    assert "model" in annotations, "State must have a `model` channel"
```

- [ ] **Step 3: Sync uv deps**

Run: `cd examples/chat/python && uv sync`
Expected: succeeds, creates `.venv/`.

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd examples/chat/python && uv run pytest -q -m smoke`
Expected: FAIL — `ModuleNotFoundError: No module named 'src'` or `ImportError: cannot import name 'graph' from 'src.graph'`.

### Task 1.3: Implement the graph to make the test pass

**Files:**
- Create: `examples/chat/python/src/__init__.py` (empty)
- Create: `examples/chat/python/src/graph.py`

- [ ] **Step 1: empty `src/__init__.py`**

Run: `touch examples/chat/python/src/__init__.py`

- [ ] **Step 2: implement `graph.py`**

Path: `examples/chat/python/src/graph.py`

```python
"""Single-node streaming chat graph.

State the client may send via the LangGraph `submit`'s `state` field:

  - ``model`` — OpenAI model name. Default: ``gpt-5-mini``.

The graph is intentionally minimal: ``__start__ → generate → __end__``.
This is the surface the demo's regenerate path exercises and the
backbone of the Phase 1 smoke checklist.
"""
from typing import Annotated, Optional
from typing_extensions import TypedDict

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage


SYSTEM_PROMPT = (
    "You are a helpful, concise assistant. "
    "Format responses with markdown when useful (headings, lists, code blocks, tables)."
)

# Reasoning-capable model prefixes. We only attach the ``reasoning``
# parameter when the model name suggests reasoning support; setting it
# on a non-reasoning model would be ignored anyway.
REASONING_PREFIXES = ("gpt-5", "o1", "o3", "o4")


def _is_reasoning_model(name: str) -> bool:
    return any(name.startswith(p) for p in REASONING_PREFIXES)


class State(TypedDict):
    messages: Annotated[list, add_messages]
    model: Optional[str]


async def generate(state: State) -> dict:
    model_name = state.get("model") or "gpt-5-mini"
    kwargs = {"model": model_name, "streaming": True}
    if _is_reasoning_model(model_name):
        # Force minimal effort so first-token latency stays low and
        # streaming is visible out of the box. Reasoning-effort tuning
        # is deferred to the reasoning-phase demo.
        kwargs["reasoning"] = {"effort": "minimal"}
    llm = ChatOpenAI(**kwargs)
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = await llm.ainvoke(messages)
    return {"messages": [response]}


_builder = StateGraph(State)
_builder.add_node("generate", generate)
_builder.set_entry_point("generate")
_builder.add_edge("generate", END)

# LangGraph API manages persistence for the deployed graph; keep the
# exported graph free of a custom checkpointer.
graph = _builder.compile()
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd examples/chat/python && uv run pytest -q -m smoke`
Expected: PASS — both tests pass.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/python/src/__init__.py \
        examples/chat/python/src/graph.py \
        examples/chat/python/tests/__init__.py \
        examples/chat/python/tests/test_graph_smoke.py
git commit -m "feat(examples-chat): single-node streaming graph + smoke tests"
```

### Task 1.4: Nx project file for python

**Files:**
- Create: `examples/chat/python/project.json`

- [ ] **Step 1: project.json**

```json
{
  "name": "examples-chat-python",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "examples/chat/python/src",
  "targets": {
    "serve": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "examples/chat/python",
        "command": "uv run langgraph dev --port 2024 --no-browser"
      },
      "continuous": true
    },
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "examples/chat/python",
        "command": "uv run pytest -q"
      }
    },
    "smoke": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "examples/chat/python",
        "command": "uv run pytest -q -m smoke"
      }
    }
  }
}
```

- [ ] **Step 2: Verify Nx picks up the project**

Run: `npx nx show project examples-chat-python --json | head -20`
Expected: shows targets `serve`, `test`, `smoke`.

- [ ] **Step 3: Run the smoke target end-to-end through Nx**

Run: `npx nx run examples-chat-python:smoke --skip-nx-cache`
Expected: pytest output, both smoke tests pass.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/python/project.json
git commit -m "chore(examples-chat-python): wire Nx targets (serve, test, smoke)"
```

---

# Phase 2 — Angular demo (bones, no agent yet)

### Task 2.1: Angular project skeleton (project.json, tsconfigs, index.html, main.ts, styles.css)

**Files:**
- Create: `examples/chat/angular/project.json`
- Create: `examples/chat/angular/tsconfig.json`
- Create: `examples/chat/angular/tsconfig.app.json`
- Create: `examples/chat/angular/tsconfig.spec.json`
- Create: `examples/chat/angular/src/main.ts`
- Create: `examples/chat/angular/src/styles.css`
- Create: `examples/chat/angular/src/index.html`
- Create: `examples/chat/angular/public/favicon.ico` (copy from existing repo)

- [ ] **Step 1: project.json**

```json
{
  "name": "examples-chat-angular",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "examples/chat/angular/src",
  "projectType": "application",
  "prefix": "app",
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "outputs": ["{options.outputPath.base}"],
      "options": {
        "outputPath": {
          "base": "dist/examples/chat/angular",
          "browser": ""
        },
        "index": "examples/chat/angular/src/index.html",
        "browser": "examples/chat/angular/src/main.ts",
        "tsConfig": "examples/chat/angular/tsconfig.app.json",
        "assets": [
          { "glob": "**/*", "input": "examples/chat/angular/public" }
        ],
        "styles": ["examples/chat/angular/src/styles.css"]
      },
      "configurations": {
        "production": {
          "budgets": [
            { "type": "initial", "maximumWarning": "500kb", "maximumError": "1.5mb" },
            { "type": "anyComponentStyle", "maximumWarning": "4kb", "maximumError": "16kb" }
          ],
          "outputHashing": "all"
        },
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true
        }
      },
      "defaultConfiguration": "development"
    },
    "serve": {
      "continuous": true,
      "executor": "@angular/build:dev-server",
      "options": {
        "port": 4200
      },
      "configurations": {
        "production": { "buildTarget": "examples-chat-angular:build:production" },
        "development": { "buildTarget": "examples-chat-angular:build:development" }
      },
      "defaultConfiguration": "development"
    },
    "test": {
      "executor": "@nx/vite:test",
      "options": {
        "config": "examples/chat/angular/vite.config.mts"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  },
  "tags": ["scope:examples", "type:app"]
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "noPropertyAccessFromIndexSignature": false,
    "experimentalDecorators": true,
    "module": "preserve",
    "emitDeclarationOnly": false,
    "composite": false,
    "lib": ["es2022", "dom"],
    "skipLibCheck": true,
    "strict": false
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": false,
    "strictInputAccessModifiers": false,
    "strictTemplates": false
  },
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.app.json" }
  ]
}
```

- [ ] **Step 3: tsconfig.app.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "lib": ["es2022", "dom"],
    "types": [],
    "emitDeclarationOnly": false
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: tsconfig.spec.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "types": ["vitest/globals", "node"]
  },
  "include": ["src/**/*.spec.ts", "src/**/*.test.ts", "src/**/*.d.ts"]
}
```

- [ ] **Step 5: src/main.ts**

```ts
// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

- [ ] **Step 6: src/styles.css**

```css
/* @ngaf/chat ships its own component styles via this stylesheet. */
@import '@ngaf/chat/chat.css';

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: system-ui, -apple-system, sans-serif;
  background: #0f1116;
  color: #e6e9ef;
}
```

- [ ] **Step 7: src/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>NGAF chat — canonical demo</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
```

- [ ] **Step 8: copy favicon**

```bash
mkdir -p examples/chat/angular/public
cp apps/cockpit/public/favicon.ico examples/chat/angular/public/favicon.ico 2>/dev/null \
  || cp /Users/blove/tmp/ngaf/public/favicon.ico examples/chat/angular/public/favicon.ico
```

- [ ] **Step 9: Verify Nx picks up the project**

Run: `npx nx show project examples-chat-angular --json | head -10`
Expected: lists `build`, `serve`, `test`, `lint` targets.

- [ ] **Step 10: Commit**

```bash
git add examples/chat/angular/project.json \
        examples/chat/angular/tsconfig.json \
        examples/chat/angular/tsconfig.app.json \
        examples/chat/angular/tsconfig.spec.json \
        examples/chat/angular/src/main.ts \
        examples/chat/angular/src/styles.css \
        examples/chat/angular/src/index.html \
        examples/chat/angular/public/favicon.ico
git commit -m "feat(examples-chat-angular): scaffold Angular project (project.json, tsconfigs, bootstrap)"
```

### Task 2.2: Vite test config for the Angular project

**Files:**
- Create: `examples/chat/angular/vite.config.mts`

- [ ] **Step 1: Find a reference vite config in the workspace**

Run: `find . -name "vite.config.mts" -not -path "*/node_modules/*" -not -path "*/.angular/*" -not -path "*/dist/*" 2>/dev/null | head -5`

- [ ] **Step 2: Create vite.config.mts mirroring an existing Angular project test config**

Path: `examples/chat/angular/vite.config.mts`

```ts
/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/examples-chat-angular',
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
```

- [ ] **Step 3: Verify by running an empty test**

Add a placeholder `examples/chat/angular/src/__placeholder__.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('placeholder', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npx nx run examples-chat-angular:test --skip-nx-cache`
Expected: 1 test passes.

- [ ] **Step 4: Remove placeholder + commit**

```bash
rm examples/chat/angular/src/__placeholder__.spec.ts
git add examples/chat/angular/vite.config.mts
git commit -m "chore(examples-chat-angular): vitest config for component specs"
```

### Task 2.3: Empty root App component (just renders router-outlet)

**Files:**
- Create: `examples/chat/angular/src/app/app.ts`
- Create: `examples/chat/angular/src/app/app.html`

- [ ] **Step 1: app.ts**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {}
```

- [ ] **Step 2: app.html**

```html
<router-outlet />
```

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/app.ts \
        examples/chat/angular/src/app/app.html
git commit -m "feat(examples-chat-angular): root App component (router-outlet host)"
```

### Task 2.4: Routes (default redirect to /embed, three children, wildcard fallback)

**Files:**
- Create: `examples/chat/angular/src/app/app.routes.ts`

- [ ] **Step 1: app.routes.ts (mode components don't exist yet — placeholders inline)**

```ts
// SPDX-License-Identifier: MIT
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'embed' },
  {
    path: '',
    loadComponent: () =>
      import('./shell/demo-shell.component').then((m) => m.DemoShell),
    children: [
      {
        path: 'embed',
        loadComponent: () =>
          import('./modes/embed-mode.component').then((m) => m.EmbedMode),
      },
      {
        path: 'popup',
        loadComponent: () =>
          import('./modes/popup-mode.component').then((m) => m.PopupMode),
      },
      {
        path: 'sidebar',
        loadComponent: () =>
          import('./modes/sidebar-mode.component').then((m) => m.SidebarMode),
      },
    ],
  },
  { path: '**', redirectTo: 'embed' },
];
```

- [ ] **Step 2: Commit (build will fail until Tasks 2.5+ ship — that's expected)**

```bash
git add examples/chat/angular/src/app/app.routes.ts
git commit -m "feat(examples-chat-angular): app.routes (embed/popup/sidebar children)"
```

### Task 2.5: app.config.ts (provideRouter, provideAgent, browser globals)

**Files:**
- Create: `examples/chat/angular/src/app/app.config.ts`

- [ ] **Step 1: app.config.ts**

```ts
// SPDX-License-Identifier: MIT
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAgent } from '@ngaf/langgraph';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideAgent({ apiUrl: 'http://localhost:2024' }),
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add examples/chat/angular/src/app/app.config.ts
git commit -m "feat(examples-chat-angular): app.config (provideRouter + provideAgent)"
```

### Task 2.6: Failing test for `PalettePersistence` service

**Files:**
- Create: `examples/chat/angular/src/app/shell/palette-persistence.service.spec.ts`

- [ ] **Step 1: Failing test**

Path: `examples/chat/angular/src/app/shell/palette-persistence.service.spec.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PalettePersistence } from './palette-persistence.service';

const KEY = 'ngaf-chat-demo:palette';

describe('PalettePersistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('model')).toBeNull();
    expect(svc.read('debug')).toBeNull();
    expect(svc.read('threadId')).toBeNull();
    expect(svc.read('collapsed')).toBeNull();
  });

  it('round-trips a string value', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    svc.write('model', 'gpt-5-mini');
    expect(svc.read('model')).toBe('gpt-5-mini');
  });

  it('round-trips a boolean value', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    svc.write('debug', true);
    expect(svc.read('debug')).toBe(true);
    svc.write('debug', false);
    expect(svc.read('debug')).toBe(false);
  });

  it('clearing a key with null removes it from storage', () => {
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    svc.write('threadId', 'abc');
    expect(svc.read('threadId')).toBe('abc');
    svc.write('threadId', null);
    expect(svc.read('threadId')).toBeNull();
  });

  it('survives malformed storage (returns null and does not throw)', () => {
    localStorage.setItem(KEY, 'not-valid-json');
    const svc = TestBed.runInInjectionContext(() => new PalettePersistence());
    expect(svc.read('model')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx run examples-chat-angular:test --skip-nx-cache`
Expected: FAIL — `Cannot find module './palette-persistence.service'`.

### Task 2.7: Implement `PalettePersistence`

**Files:**
- Create: `examples/chat/angular/src/app/shell/palette-persistence.service.ts`

- [ ] **Step 1: Implementation**

Path: `examples/chat/angular/src/app/shell/palette-persistence.service.ts`

```ts
// SPDX-License-Identifier: MIT
import { Injectable } from '@angular/core';

const KEY = 'ngaf-chat-demo:palette';

interface PaletteState {
  model?: string | null;
  debug?: boolean | null;
  threadId?: string | null;
  collapsed?: boolean | null;
}

type PaletteKey = keyof PaletteState;

/**
 * Tiny localStorage-backed persistence for control-palette state. Single
 * JSON object under `ngaf-chat-demo:palette` so reads/writes are
 * atomic-per-key. Survives malformed JSON by returning `null` and
 * silently overwriting on next write.
 */
@Injectable({ providedIn: 'root' })
export class PalettePersistence {
  read<K extends PaletteKey>(key: K): PaletteState[K] | null {
    const raw = this.load();
    return (raw[key] as PaletteState[K] | undefined) ?? null;
  }

  write<K extends PaletteKey>(key: K, value: PaletteState[K] | null): void {
    const current = this.load();
    if (value === null || value === undefined) {
      delete current[key];
    } else {
      current[key] = value;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      // Storage may be full or unavailable (private mode). Silently drop;
      // the demo continues to work, just without persistence.
    }
  }

  private load(): PaletteState {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? (parsed as PaletteState) : {};
    } catch {
      return {};
    }
  }
}
```

- [ ] **Step 2: Run tests to verify pass**

Run: `npx nx run examples-chat-angular:test --skip-nx-cache`
Expected: 5 PalettePersistence tests pass.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/shell/palette-persistence.service.ts \
        examples/chat/angular/src/app/shell/palette-persistence.service.spec.ts
git commit -m "feat(examples-chat-angular): PalettePersistence service + spec"
```

### Task 2.8: Shell DI tokens

**Files:**
- Create: `examples/chat/angular/src/app/shell/shell-tokens.ts`

- [ ] **Step 1: Inspect the agent return shape**

Run: `grep -n "export.*function agent\|export type LangGraphAgent\|export interface LangGraphAgent" libs/langgraph/src/lib/agent.fn.ts libs/langgraph/src/lib/agent.types.ts | head -5`

- [ ] **Step 2: shell-tokens.ts**

Path: `examples/chat/angular/src/app/shell/shell-tokens.ts`

```ts
// SPDX-License-Identifier: MIT
import { InjectionToken, Signal } from '@angular/core';
import type { LangGraphAgent } from '@ngaf/langgraph';

/**
 * Shared agent provided by `DemoShell` and consumed by routed mode
 * components. Created once per shell mount; survives mode navigations
 * because the router never unmounts the shell.
 */
export const DEMO_AGENT = new InjectionToken<LangGraphAgent>('DEMO_AGENT');

/**
 * Writable signal carrying the currently-selected model. `DemoShell`
 * owns the source of truth; mode components can read it via two-way
 * binding into `<chat>` / `<chat-popup>` / `<chat-sidebar>`.
 */
export const DEMO_MODEL = new InjectionToken<Signal<string>>('DEMO_MODEL');
```

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/shell/shell-tokens.ts
git commit -m "feat(examples-chat-angular): DI tokens for shared agent + model"
```

### Task 2.9: Shared welcome-suggestions list

**Files:**
- Create: `examples/chat/angular/src/app/modes/welcome-suggestions.ts`

- [ ] **Step 1: welcome-suggestions.ts**

```ts
// SPDX-License-Identifier: MIT

/**
 * Welcome suggestion prompts shown in each mode's empty state. Kept in
 * one file so all three modes ship the same list — and so adding a
 * suggestion (e.g. one that exercises tables, code blocks, etc.) is a
 * single-file change.
 */
export interface WelcomeSuggestion {
  readonly label: string;
  readonly value: string;
}

export const WELCOME_SUGGESTIONS: readonly WelcomeSuggestion[] = [
  { label: 'Tell me about coral reefs', value: 'Tell me about coral reefs' },
  { label: 'Write a haiku about Angular', value: 'Write a haiku about Angular' },
  { label: 'List 5 productivity tips', value: 'List 5 productivity tips, in markdown bullets.' },
  {
    label: 'Compare Angular signals, RxJS, and zone.js',
    value:
      'Show me a table comparing Angular signals, RxJS, and zone.js — three columns: name, mental model, when to use.',
  },
  {
    label: 'Explain promises with code',
    value: 'Explain JavaScript promises with a fenced code block in TypeScript.',
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add examples/chat/angular/src/app/modes/welcome-suggestions.ts
git commit -m "feat(examples-chat-angular): shared welcome suggestion list"
```

### Task 2.10: Demo shell (no agent yet — mode signal from router URL)

**Files:**
- Create: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Create: `examples/chat/angular/src/app/shell/demo-shell.component.html`
- Create: `examples/chat/angular/src/app/shell/demo-shell.component.css`

- [ ] **Step 1: demo-shell.component.ts (placeholder agent — wired in Phase 3)**

```ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { ControlPalette } from './control-palette.component';
import { PalettePersistence } from './palette-persistence.service';

export type DemoMode = 'embed' | 'popup' | 'sidebar';

const MODES: readonly DemoMode[] = ['embed', 'popup', 'sidebar'] as const;

function modeFromUrl(url: string): DemoMode {
  const seg = url.split('?')[0].split('/').filter(Boolean)[0];
  return (MODES as readonly string[]).includes(seg) ? (seg as DemoMode) : 'embed';
}

@Component({
  selector: 'demo-shell',
  standalone: true,
  imports: [RouterOutlet, ControlPalette],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './demo-shell.component.html',
  styleUrl: './demo-shell.component.css',
})
export class DemoShell {
  private readonly router = inject(Router);
  private readonly persistence = inject(PalettePersistence);

  /** Read-side mode signal, derived from router URL. */
  protected readonly mode = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => modeFromUrl(e.urlAfterRedirects)),
      startWith(modeFromUrl(this.router.url)),
      takeUntilDestroyed(),
    ),
    { initialValue: modeFromUrl(this.router.url) },
  );

  protected readonly model = signal<string>(this.persistence.read('model') ?? 'gpt-5-mini');
  protected readonly debugOpen = signal<boolean>(this.persistence.read('debug') ?? false);
  protected readonly modelOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'gpt-5-nano', label: 'gpt-5-nano' },
  ]);

  protected onModeChange(next: DemoMode): void {
    void this.router.navigate(['/' + next]);
  }

  protected onModelChange(next: string): void {
    this.model.set(next);
    this.persistence.write('model', next);
  }

  protected onDebugChange(next: boolean): void {
    this.debugOpen.set(next);
    this.persistence.write('debug', next);
  }

  protected onNewConversation(): void {
    // Wired in Phase 3 — this no-op placeholder exists so the palette
    // emits cleanly during the bones-only phase. Phase 3 replaces it
    // with threadId reset.
  }
}
```

- [ ] **Step 2: demo-shell.component.html**

```html
<div class="demo-shell">
  <router-outlet />

  <app-control-palette
    [mode]="mode()"
    [model]="model()"
    [modelOptions]="modelOptions()"
    [debugOpen]="debugOpen()"
    (modeChange)="onModeChange($event)"
    (modelChange)="onModelChange($event)"
    (debugOpenChange)="onDebugChange($event)"
    (newConversation)="onNewConversation()"
  />
</div>
```

- [ ] **Step 3: demo-shell.component.css**

```css
:host {
  display: block;
  height: 100dvh;
}

.demo-shell {
  position: relative;
  display: block;
  height: 100%;
}
```

- [ ] **Step 4: Commit (will not build until 2.11 ships)**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts \
        examples/chat/angular/src/app/shell/demo-shell.component.html \
        examples/chat/angular/src/app/shell/demo-shell.component.css
git commit -m "feat(examples-chat-angular): demo-shell skeleton (mode signal from router URL)"
```

### Task 2.11: Control palette component

**Files:**
- Create: `examples/chat/angular/src/app/shell/control-palette.component.ts`
- Create: `examples/chat/angular/src/app/shell/control-palette.component.html`
- Create: `examples/chat/angular/src/app/shell/control-palette.component.css`

- [ ] **Step 1: control-palette.component.ts**

```ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  inject,
  effect,
} from '@angular/core';
import { PalettePersistence } from './palette-persistence.service';
import type { DemoMode } from './demo-shell.component';

@Component({
  selector: 'app-control-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './control-palette.component.html',
  styleUrl: './control-palette.component.css',
})
export class ControlPalette {
  private readonly persistence = inject(PalettePersistence);

  readonly mode = input.required<DemoMode>();
  readonly model = input.required<string>();
  readonly modelOptions = input.required<readonly { value: string; label: string }[]>();
  readonly debugOpen = input.required<boolean>();

  readonly modeChange = output<DemoMode>();
  readonly modelChange = output<string>();
  readonly debugOpenChange = output<boolean>();
  readonly newConversation = output<void>();

  protected readonly collapsed = signal<boolean>(this.persistence.read('collapsed') ?? false);

  constructor() {
    effect(() => {
      this.persistence.write('collapsed', this.collapsed());
    });
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((c) => !c);
  }

  protected pickMode(next: DemoMode): void {
    this.modeChange.emit(next);
  }

  protected pickModel(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.modelChange.emit(value);
  }

  protected toggleDebug(): void {
    this.debugOpenChange.emit(!this.debugOpen());
  }

  protected emitNewConversation(): void {
    this.newConversation.emit();
  }
}
```

- [ ] **Step 2: control-palette.component.html**

```html
@if (collapsed()) {
  <button
    type="button"
    class="palette palette--collapsed"
    aria-label="Expand control palette"
    (click)="toggleCollapsed()"
  >
    ⚙
  </button>
} @else {
  <div class="palette" role="region" aria-label="Demo control palette">
    <div class="palette__group palette__group--mode" role="tablist" aria-label="Chat mode">
      <button
        type="button"
        role="tab"
        [attr.aria-selected]="mode() === 'embed'"
        [class.is-active]="mode() === 'embed'"
        (click)="pickMode('embed')"
      >Embed</button>
      <button
        type="button"
        role="tab"
        [attr.aria-selected]="mode() === 'popup'"
        [class.is-active]="mode() === 'popup'"
        (click)="pickMode('popup')"
      >Popup</button>
      <button
        type="button"
        role="tab"
        [attr.aria-selected]="mode() === 'sidebar'"
        [class.is-active]="mode() === 'sidebar'"
        (click)="pickMode('sidebar')"
      >Sidebar</button>
    </div>

    <label class="palette__group palette__group--model">
      <span class="palette__label">Model</span>
      <select [value]="model()" (change)="pickModel($event)">
        @for (opt of modelOptions(); track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>
    </label>

    <button
      type="button"
      class="palette__toggle"
      [class.is-on]="debugOpen()"
      [attr.aria-pressed]="debugOpen()"
      (click)="toggleDebug()"
    >
      <span class="palette__toggle-dot"></span>
      <span>Debug {{ debugOpen() ? 'on' : 'off' }}</span>
    </button>

    <button
      type="button"
      class="palette__action"
      (click)="emitNewConversation()"
    >↻ New conversation</button>

    <button
      type="button"
      class="palette__collapse"
      aria-label="Collapse control palette"
      (click)="toggleCollapsed()"
    >⌃</button>
  </div>
}
```

- [ ] **Step 3: control-palette.component.css**

```css
:host {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 1000;
}

.palette {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #1a1d23;
  color: #e6e9ef;
  border: 1px solid #303540;
  border-radius: 10px;
  padding: 10px;
  font-size: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
  min-width: 220px;
}

.palette--collapsed {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #1a1d23;
  color: #e6e9ef;
  border: 1px solid #303540;
  cursor: pointer;
  font-size: 16px;
}

.palette__group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.palette__group--mode {
  background: #0f1116;
  border-radius: 6px;
  padding: 3px;
}
.palette__group--mode button {
  flex: 1;
  background: transparent;
  border: 0;
  color: inherit;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.palette__group--mode button.is-active {
  background: #2c313c;
}

.palette__group--model {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
}
.palette__label {
  opacity: 0.7;
  margin-right: 8px;
}
.palette__group--model select {
  background: #0f1116;
  color: inherit;
  border: 1px solid #303540;
  border-radius: 4px;
  padding: 4px 6px;
}

.palette__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid #303540;
  color: inherit;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}
.palette__toggle.is-on {
  border-color: #4f8df5;
}
.palette__toggle-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: #303540;
}
.palette__toggle.is-on .palette__toggle-dot {
  background: #4f8df5;
}

.palette__action {
  background: transparent;
  border: 1px solid #303540;
  color: inherit;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.palette__collapse {
  background: transparent;
  border: 0;
  color: #8a92a3;
  cursor: pointer;
  align-self: flex-end;
  font-size: 14px;
}
```

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/src/app/shell/control-palette.component.ts \
        examples/chat/angular/src/app/shell/control-palette.component.html \
        examples/chat/angular/src/app/shell/control-palette.component.css
git commit -m "feat(examples-chat-angular): floating control-palette component"
```

### Task 2.12: Three mode components (placeholders — agent inject in Phase 3)

**Files:**
- Create: `examples/chat/angular/src/app/modes/embed-mode.component.ts`
- Create: `examples/chat/angular/src/app/modes/popup-mode.component.ts`
- Create: `examples/chat/angular/src/app/modes/sidebar-mode.component.ts`

- [ ] **Step 1: embed-mode.component.ts**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ChatComponent, ChatWelcomeSuggestionComponent } from '@ngaf/chat';
import { DEMO_AGENT, DEMO_MODEL } from '../shell/shell-tokens';
import { WELCOME_SUGGESTIONS } from './welcome-suggestions';

@Component({
  selector: 'embed-mode',
  standalone: true,
  imports: [ChatComponent, ChatWelcomeSuggestionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <chat
      [agent]="agent"
      [modelOptions]="modelOptions()"
      [(selectedModel)]="model"
    >
      <div chatWelcomeSuggestions>
        @for (s of suggestions; track s.value) {
          <chat-welcome-suggestion
            [label]="s.label"
            [value]="s.value"
            (selected)="send($event)"
          />
        }
      </div>
    </chat>
  `,
  styles: [`
    :host { display: block; height: 100%; }
  `],
})
export class EmbedMode {
  protected readonly agent = inject(DEMO_AGENT);
  protected readonly model = inject(DEMO_MODEL) as ReturnType<typeof signal<string>>;
  protected readonly suggestions = WELCOME_SUGGESTIONS;
  protected readonly modelOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'gpt-5-nano', label: 'gpt-5-nano' },
  ]);

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
```

- [ ] **Step 2: popup-mode.component.ts**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ChatPopupComponent, ChatWelcomeSuggestionComponent } from '@ngaf/chat';
import { DEMO_AGENT, DEMO_MODEL } from '../shell/shell-tokens';
import { WELCOME_SUGGESTIONS } from './welcome-suggestions';

@Component({
  selector: 'popup-mode',
  standalone: true,
  imports: [ChatPopupComponent, ChatWelcomeSuggestionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="popup-mode__background">
      <p class="popup-mode__hint">
        Click the launcher button (bottom-right) to open the chat.
      </p>
    </div>
    <chat-popup [agent]="agent" [(selectedModel)]="model" [modelOptions]="modelOptions()">
      <div chatWelcomeSuggestions>
        @for (s of suggestions; track s.value) {
          <chat-welcome-suggestion
            [label]="s.label"
            [value]="s.value"
            (selected)="send($event)"
          />
        }
      </div>
    </chat-popup>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .popup-mode__background {
      display: grid;
      place-items: center;
      height: 100%;
      color: #8a92a3;
      font-size: 14px;
    }
  `],
})
export class PopupMode {
  protected readonly agent = inject(DEMO_AGENT);
  protected readonly model = inject(DEMO_MODEL) as ReturnType<typeof signal<string>>;
  protected readonly suggestions = WELCOME_SUGGESTIONS;
  protected readonly modelOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'gpt-5-nano', label: 'gpt-5-nano' },
  ]);

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
```

- [ ] **Step 3: sidebar-mode.component.ts**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ChatSidebarComponent, ChatWelcomeSuggestionComponent } from '@ngaf/chat';
import { DEMO_AGENT, DEMO_MODEL } from '../shell/shell-tokens';
import { WELCOME_SUGGESTIONS } from './welcome-suggestions';

@Component({
  selector: 'sidebar-mode',
  standalone: true,
  imports: [ChatSidebarComponent, ChatWelcomeSuggestionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sidebar-mode__background">
      <p class="sidebar-mode__hint">
        Click the launcher button (right edge) to slide in the chat panel.
      </p>
    </div>
    <chat-sidebar [agent]="agent" [(selectedModel)]="model" [modelOptions]="modelOptions()">
      <div chatWelcomeSuggestions>
        @for (s of suggestions; track s.value) {
          <chat-welcome-suggestion
            [label]="s.label"
            [value]="s.value"
            (selected)="send($event)"
          />
        }
      </div>
    </chat-sidebar>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .sidebar-mode__background {
      display: grid;
      place-items: center;
      height: 100%;
      color: #8a92a3;
      font-size: 14px;
    }
  `],
})
export class SidebarMode {
  protected readonly agent = inject(DEMO_AGENT);
  protected readonly model = inject(DEMO_MODEL) as ReturnType<typeof signal<string>>;
  protected readonly suggestions = WELCOME_SUGGESTIONS;
  protected readonly modelOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'gpt-5-nano', label: 'gpt-5-nano' },
  ]);

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }
}
```

- [ ] **Step 4: Commit (build still incomplete; Phase 3 wires DEMO_AGENT)**

```bash
git add examples/chat/angular/src/app/modes/embed-mode.component.ts \
        examples/chat/angular/src/app/modes/popup-mode.component.ts \
        examples/chat/angular/src/app/modes/sidebar-mode.component.ts
git commit -m "feat(examples-chat-angular): three mode components (embed, popup, sidebar)"
```

---

# Phase 3 — Wire shared agent + threadId persistence + model passthrough + debug overlay

### Task 3.1: Update `DemoShell` to create + provide the shared agent

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html`

- [ ] **Step 1: Replace `DemoShell` with the agent-providing version**

Path: `examples/chat/angular/src/app/shell/demo-shell.component.ts`

```ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
} from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { agent } from '@ngaf/langgraph';
import { ChatDebugComponent } from '@ngaf/chat';
import { ControlPalette } from './control-palette.component';
import { PalettePersistence } from './palette-persistence.service';
import { DEMO_AGENT, DEMO_MODEL } from './shell-tokens';

export type DemoMode = 'embed' | 'popup' | 'sidebar';

const MODES: readonly DemoMode[] = ['embed', 'popup', 'sidebar'] as const;

function modeFromUrl(url: string): DemoMode {
  const seg = url.split('?')[0].split('/').filter(Boolean)[0];
  return (MODES as readonly string[]).includes(seg) ? (seg as DemoMode) : 'embed';
}

@Component({
  selector: 'demo-shell',
  standalone: true,
  imports: [RouterOutlet, ControlPalette, ChatDebugComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './demo-shell.component.html',
  styleUrl: './demo-shell.component.css',
  providers: [
    { provide: DEMO_AGENT, useFactory: () => inject(DemoShell).agent },
    { provide: DEMO_MODEL, useFactory: () => inject(DemoShell).model },
  ],
})
export class DemoShell {
  private readonly router = inject(Router);
  private readonly persistence = inject(PalettePersistence);

  protected readonly mode = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => modeFromUrl(e.urlAfterRedirects)),
      startWith(modeFromUrl(this.router.url)),
      takeUntilDestroyed(),
    ),
    { initialValue: modeFromUrl(this.router.url) },
  );

  /** Source of truth for the model picker. Mode components read it via DEMO_MODEL. */
  readonly model = signal<string>(this.persistence.read('model') ?? 'gpt-5-mini');

  protected readonly debugOpen = signal<boolean>(this.persistence.read('debug') ?? false);

  protected readonly modelOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'gpt-5-nano', label: 'gpt-5-nano' },
  ]);

  /** Persisted thread id (null on first run). Reactive so reload reconnects to the same thread. */
  private readonly threadIdSignal = signal<string | null>(this.persistence.read('threadId') ?? null);

  /**
   * Shared agent instance. Patched submit injects state.model on every
   * submission so the graph picks up the latest model selection without
   * a reconnect.
   */
  readonly agent = (() => {
    const a = agent({
      apiUrl: 'http://localhost:2024',
      assistantId: 'chat',
      threadId: this.threadIdSignal,
      onThreadId: (id: string) => {
        this.threadIdSignal.set(id);
        this.persistence.write('threadId', id);
      },
    });
    const orig = a.submit.bind(a);
    (a as { submit: typeof a.submit }).submit = ((
      input: Parameters<typeof a.submit>[0],
      opts?: Parameters<typeof a.submit>[1],
    ) =>
      orig(
        { ...(input ?? {}), state: { ...((input as { state?: Record<string, unknown> })?.state ?? {}), model: this.model() } },
        opts,
      )) as typeof a.submit;
    return a;
  })();

  protected onModeChange(next: DemoMode): void {
    void this.router.navigate(['/' + next]);
  }

  protected onModelChange(next: string): void {
    this.model.set(next);
    this.persistence.write('model', next);
  }

  protected onDebugChange(next: boolean): void {
    this.debugOpen.set(next);
    this.persistence.write('debug', next);
  }

  /**
   * Clear persisted thread id and drop the signal. The next submit
   * causes the SDK to create a fresh thread server-side; onThreadId
   * fires and re-persists it.
   */
  protected onNewConversation(): void {
    this.persistence.write('threadId', null);
    this.threadIdSignal.set(null);
  }
}
```

- [ ] **Step 2: Update demo-shell.component.html to mount `<chat-debug>`**

```html
<div class="demo-shell">
  <router-outlet />

  <app-control-palette
    [mode]="mode()"
    [model]="model()"
    [modelOptions]="modelOptions()"
    [debugOpen]="debugOpen()"
    (modeChange)="onModeChange($event)"
    (modelChange)="onModelChange($event)"
    (debugOpenChange)="onDebugChange($event)"
    (newConversation)="onNewConversation()"
  />

  @if (debugOpen()) {
    <div class="demo-shell__debug" role="region" aria-label="Debug overlay">
      <chat-debug [agent]="agent" />
    </div>
  }
</div>
```

- [ ] **Step 3: Update demo-shell.component.css to position the debug drawer**

Path: `examples/chat/angular/src/app/shell/demo-shell.component.css`

```css
:host {
  display: block;
  height: 100dvh;
}

.demo-shell {
  position: relative;
  display: block;
  height: 100%;
}

.demo-shell__debug {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 30vh;
  background: #0f1116;
  border-top: 1px solid #303540;
  overflow: auto;
  z-index: 999;
}
```

- [ ] **Step 4: Run lint to catch type issues**

Run: `npx nx run examples-chat-angular:lint --skip-nx-cache`
Expected: passes (warnings OK; no errors).

- [ ] **Step 5: Run tests**

Run: `npx nx run examples-chat-angular:test --skip-nx-cache`
Expected: PalettePersistence tests still pass.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts \
        examples/chat/angular/src/app/shell/demo-shell.component.html \
        examples/chat/angular/src/app/shell/demo-shell.component.css
git commit -m "feat(examples-chat-angular): wire shared agent, threadId persistence, debug overlay"
```

### Task 3.2: Sanity-build the whole Angular app

- [ ] **Step 1: Build (development)**

Run: `npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development`
Expected: build succeeds. Bundle warnings about CommonJS deps are OK.

- [ ] **Step 2: If errors:** triage type imports (e.g. `ChatDebugComponent` may be exported under a different name — check `libs/chat/src/index.ts` if needed) and fix inline. Re-run build.

- [ ] **Step 3: Commit any inline fixes (if needed)**

```bash
git add -u examples/chat/angular/
git commit -m "fix(examples-chat-angular): build-time corrections from sanity build"
```
*(Skip if no fixes needed.)*

### Task 3.3: Spec for `DemoShell` — mode signal tracks router URL

**Files:**
- Create: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { DemoShell } from './demo-shell.component';

describe('DemoShell — mode signal', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: 'popup', component: DemoShell },
          { path: 'sidebar', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
        ]),
      ],
    });
  });

  it('defaults to "embed" when URL is /', async () => {
    const fixture = TestBed.createComponent(DemoShell);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { mode: () => string };
    expect(cmp.mode()).toBe('embed');
  });

  it('resolves "popup" when navigating to /popup', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/popup');
    const fixture = TestBed.createComponent(DemoShell);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { mode: () => string };
    expect(cmp.mode()).toBe('popup');
  });

  it('falls back to "embed" for unknown segments', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/bogus');
    const fixture = TestBed.createComponent(DemoShell);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { mode: () => string };
    expect(cmp.mode()).toBe('embed');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx nx run examples-chat-angular:test --skip-nx-cache`
Expected: 3 DemoShell tests pass + the existing PalettePersistence tests pass.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.spec.ts
git commit -m "test(examples-chat-angular): DemoShell mode-signal spec"
```

### Task 3.4: Live smoke — manual `npx nx run examples-chat:serve`

- [ ] **Step 1: Ensure `OPENAI_API_KEY` is in `examples/chat/python/.env`**

Run: `cat examples/chat/python/.env 2>/dev/null | head -1` — should show `OPENAI_API_KEY=sk-...`. If missing, copy from `.env.example` and fill.

- [ ] **Step 2: Sync python deps if not done**

Run: `cd examples/chat/python && uv sync && cd -`

- [ ] **Step 3: Start the aggregate target**

Run: `npx nx run examples-chat:serve`
Expected: Python on :2024 (`{"ok":true}` from /ok), Angular on :4200 (page loads, palette visible top-right).

- [ ] **Step 4: Manual sanity check** (browser at http://localhost:4200)
- Page redirects to `/embed`
- Palette is visible top-right
- Welcome suggestions render
- Click a suggestion — message streams
- Click "Regenerate response" — assistant replaced cleanly (1u/1a)
- Switch to /popup — same conversation visible inside popup
- Switch to /sidebar — same conversation visible inside sidebar
- Toggle Debug ON — overlay appears at bottom
- Click "↻ New conversation" — welcome state returns
- Reload page — agent reconnects (or fresh state if no conversation yet)

- [ ] **Step 5: Stop the serve target** (`Ctrl+C` in the terminal running it).

- [ ] **Step 6: Commit any sanity fixes** if anything broke (component selectors, imports, etc.).

---

# Phase 4 — Smoke CLI generator

### Task 4.1: Smoke template — Angular CLI scaffold (no `src/app/`)

**Files:**
- Create: `examples/chat/smoke/template/package.json`
- Create: `examples/chat/smoke/template/angular.json`
- Create: `examples/chat/smoke/template/tsconfig.json`
- Create: `examples/chat/smoke/template/tsconfig.app.json`
- Create: `examples/chat/smoke/template/.gitignore`
- Create: `examples/chat/smoke/template/public/favicon.ico`
- Create: `examples/chat/smoke/template/src/main.ts`
- Create: `examples/chat/smoke/template/src/styles.css`
- Create: `examples/chat/smoke/template/src/index.html`

- [ ] **Step 1: package.json (placeholder uses `"*"` — valid semver, replaced at gen-time)**

```json
{
  "name": "examples-chat-smoke-consumer",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development"
  },
  "packageManager": "npm@10.9.2",
  "dependencies": {
    "@angular/common": "^21.2.0",
    "@angular/compiler": "^21.2.0",
    "@angular/core": "^21.2.0",
    "@angular/forms": "^21.2.0",
    "@angular/platform-browser": "^21.2.0",
    "@angular/router": "^21.2.0",
    "@ngaf/ag-ui": "*",
    "@ngaf/chat": "*",
    "@ngaf/langgraph": "*",
    "@ngaf/render": "*",
    "@cacheplane/partial-markdown": "^0.3.0",
    "@cacheplane/partial-json": "^0.2.0",
    "@langchain/core": "^1.1.33",
    "marked": "^16.0.0",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0"
  },
  "devDependencies": {
    "@angular/build": "^21.2.9",
    "@angular/cli": "^21.2.9",
    "@angular/compiler-cli": "^21.2.0",
    "typescript": "~5.9.2"
  }
}
```

- [ ] **Step 2: angular.json**

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "cli": { "packageManager": "npm" },
  "newProjectRoot": "projects",
  "projects": {
    "smoke": {
      "projectType": "application",
      "schematics": {},
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "browser": "src/main.ts",
            "tsConfig": "tsconfig.app.json",
            "assets": [{ "glob": "**/*", "input": "public" }],
            "styles": ["src/styles.css"]
          },
          "configurations": {
            "production": {
              "budgets": [
                { "type": "initial", "maximumWarning": "500kB", "maximumError": "2MB" },
                { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "16kB" }
              ],
              "outputHashing": "all"
            },
            "development": {
              "optimization": false,
              "extractLicenses": false,
              "sourceMap": true
            }
          },
          "defaultConfiguration": "development"
        },
        "serve": {
          "builder": "@angular/build:dev-server",
          "configurations": {
            "production": { "buildTarget": "smoke:build:production" },
            "development": { "buildTarget": "smoke:build:development" }
          },
          "defaultConfiguration": "development"
        }
      }
    }
  }
}
```

- [ ] **Step 3: tsconfig.json**

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2022",
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": false
  },
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }]
}
```

- [ ] **Step 4: tsconfig.app.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": []
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 5: .gitignore (consumer-local)**

```
node_modules/
dist/
.angular/
out-tsc/
```

- [ ] **Step 6: src/main.ts**

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

- [ ] **Step 7: src/styles.css**

```css
@import '@ngaf/chat/chat.css';

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: system-ui, -apple-system, sans-serif;
  background: #0f1116;
  color: #e6e9ef;
}
```

- [ ] **Step 8: src/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>NGAF chat — smoke consumer</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
```

- [ ] **Step 9: Copy favicon**

```bash
mkdir -p examples/chat/smoke/template/public
cp examples/chat/angular/public/favicon.ico examples/chat/smoke/template/public/favicon.ico
```

- [ ] **Step 10: Commit**

```bash
git add examples/chat/smoke/template/
git commit -m "feat(examples-chat-smoke): scaffold consumer template (Angular CLI bones)"
```

### Task 4.2: CHECKLIST.md

**Files:**
- Create: `examples/chat/smoke/CHECKLIST.md`

- [ ] **Step 1: Write CHECKLIST.md** (full content from spec, verbatim)

```markdown
# NGAF chat smoke checklist

Scope: validates the **published** `@ngaf/*` packages render and behave
correctly in a fresh consumer. Run after any release or whenever
changes land in libs/chat, libs/langgraph, libs/render, libs/ag-ui.

## Pre-flight

- [ ] `OPENAI_API_KEY` present in `examples/chat/python/.env`
- [ ] `nx run examples-chat-python:serve` running on :2024 — `curl localhost:2024/ok` returns `{"ok":true}`
- [ ] Smoke consumer started — page loads at :4200
- [ ] No console errors on initial load (license warning OK, telemetry DNS failure OK)
- [ ] No 4xx/5xx in the network tab on initial load

## Initial render (welcome state)

- [ ] Default route redirects to `/embed`
- [ ] Welcome heading renders ("How can I help?")
- [ ] All declared welcome suggestion buttons render with their labels
- [ ] Control palette renders top-right, fully expanded by default
- [ ] Palette mode segmented control highlights "Embed"
- [ ] Palette model dropdown shows the default model
- [ ] Palette debug toggle shows "off"
- [ ] Send button disabled when input is empty

## Send & receive (basic streaming)

- [ ] Type any prompt, click Send — input clears, user message renders immediately
- [ ] Typing indicator appears between send and first token
- [ ] Tokens stream visibly into the assistant bubble (not all-at-once)
- [ ] Final message stays after stream completes
- [ ] Auto-scroll keeps the latest content visible during streaming
- [ ] Send button re-enables after stream completes

## Stop mid-stream

- [ ] Send a long prompt
- [ ] Mid-stream, Send button has flipped to "Stop generating"
- [ ] Click stop — stream halts, partial response remains rendered
- [ ] No console errors; agent returns to idle; Send button returns

## Markdown surfaces (the partial-markdown render path)

Send a prompt that asks for each of the following. Check that each
renders correctly both during streaming and after completion.

> **Known regressions** documented in the chat 0.0.20 partial-markdown
> swap: tables and task lists may not match the previous (marked-based)
> rendering exactly. If a check fails, file an issue against
> `libs/chat` rather than skipping — the smoke checklist is the
> canonical "what should work" list.

- [ ] **Headings** — `# H1`, `## H2`, `### H3` all render at distinct sizes
- [ ] **Paragraphs** with **bold**, *italic*, and `inline code`
- [ ] **Bullet lists** including nested (2+ levels)
- [ ] **Ordered lists** with correct numbering
- [ ] **Task lists** — `- [ ]` (unchecked) and `- [x]` (checked) render as checkboxes
- [ ] **Fenced code blocks** with language hint — preserved as `<pre><code>`
- [ ] **Tables** with header row + 2+ data rows — column alignment preserved
- [ ] **Blockquotes** — visually distinct
- [ ] **Links** — clickable, open in new tab
- [ ] **Horizontal rules** — render as a line
- [ ] No raw HTML escapes through (e.g. `<script>` displayed as text, not executed)

### Streaming-specific markdown checks

- [ ] Mid-stream, an incomplete fenced code block (open ``` no close) renders
      as a code block (does not flash to plain text)
- [ ] Mid-stream, an incomplete table row does not corrupt the table
- [ ] No visible flicker / layout shift as tokens arrive
- [ ] Long response keeps autoscrolling to bottom

## Regenerate

- [ ] After a response completes, hover the assistant message — actions row appears
- [ ] "Regenerate response" button is present and enabled
- [ ] Click regenerate — old assistant message is replaced (not appended)
- [ ] Typing indicator appears, then tokens stream into the new assistant slot
- [ ] After completion, exactly **1 user / 1 assistant** in the conversation
- [ ] Server-side state matches: `curl localhost:2024/threads/<id>/state`
      returns 2 messages with `next: []`
- [ ] Repeated regenerate (3 times in a row) keeps state at 1u/1a each time

## Cross-mode persistence

- [ ] In `/embed`, send a message
- [ ] Navigate to `/popup` — same conversation visible
- [ ] Open the popup — message history is intact
- [ ] Navigate to `/sidebar` — same conversation
- [ ] Open the sidebar — message history is intact
- [ ] Send from `/sidebar`, navigate back to `/embed` — new message present

## Mode switching (route + URL)

- [ ] `/embed` renders `<chat>` inline, full viewport
- [ ] `/popup` renders a launcher button; clicking opens a floating window
      with `role="dialog"`, contains the chat
- [ ] `/sidebar` renders a launcher; clicking slides in a panel with
      `role="complementary"`
- [ ] Browser back/forward navigates between modes correctly
- [ ] Direct deep-link to `/popup` works (no flash of `/embed` first)
- [ ] Unknown route (`/foo`) redirects to `/embed`
- [ ] Closing the popup does not navigate; URL stays `/popup`
- [ ] Same for sidebar close

## Model picker

- [ ] Palette dropdown lists the configured models
- [ ] Selecting a different model — palette text updates immediately
- [ ] Send a message — backend log shows the new model name
      (or check `/threads/<id>/state` `values.model` field)
- [ ] Selection persists across page reload
- [ ] Selection persists across mode switches

## Debug overlay

- [ ] Toggle Debug ON in palette
- [ ] `<chat-debug>` overlay appears (bottom drawer)
- [ ] Debug overlay shows current agent signals (status, message count, etc.)
- [ ] Debug overlay updates live as messages stream
- [ ] Toggle Debug OFF
- [ ] Overlay unmounts; no console errors; DOM has no `<chat-debug>` element

## Control palette UX

- [ ] Click collapse handle — palette shrinks to single icon
- [ ] Click icon — palette re-expands
- [ ] Collapsed/expanded state persists across reload
- [ ] Palette never overlaps the chat input (must remain accessible)
- [ ] Palette is positioned above any popup/sidebar in z-order

## Keyboard & accessibility

- [ ] Tab order reaches: input, send button, suggestions (when shown),
      palette controls, message actions (when hovered/focused)
- [ ] Enter in input — sends message
- [ ] Shift+Enter in input — inserts newline (does not send)
- [ ] Escape closes popup or sidebar (when open)
- [ ] Send button has accessible name "Send message"
- [ ] Stop button (mid-stream) has accessible name "Stop generating"
- [ ] Regenerate button has accessible name "Regenerate response"
- [ ] Copy button has accessible name "Copy to clipboard" → "Copied"
- [ ] Popup window has `role="dialog"`
- [ ] Sidebar panel has `role="complementary"` and `aria-hidden` toggles correctly

## Error handling

- [ ] Stop the Python server (`Ctrl+C` on :2024) and try sending — UI
      surfaces an error in `<chat-error>`, does not crash
- [ ] Restart Python server and send again — recovers without reload
- [ ] Send with `OPENAI_API_KEY` invalid — error surfaces; no infinite spinner

## Lifecycle

- [ ] Reload the page mid-conversation — agent reconnects, history reappears
      from server state (NOT fresh empty state)
- [ ] Click "New conversation" in palette — welcome state reappears, prior
      conversation is no longer attached (next submit creates a new thread server-side)
- [ ] Browser back navigates routes correctly
- [ ] Selecting a welcome suggestion sends and clears the welcome state

## Browser hygiene

- [ ] No `console.error` after smoke run completes
- [ ] No `Uncaught` promise rejections
- [ ] No memory leak across 10 mode-switch cycles (DevTools heap snapshot
      stable, no detached `<chat-message>` nodes)
- [ ] Network tab — no failed `localhost:2024` requests except the
      well-known `runs/stream` `ERR_ABORTED` (SSE terminus, expected)

## Visual polish

- [ ] Chat content readable at default zoom
- [ ] Layout responsive: viewport at 1440px, 1024px, 768px, 480px — no
      horizontal overflow, palette stays in viewport
- [ ] Markdown styles match the rest of the app's typography
- [ ] No flash of unstyled content on initial load

## Capture

- [ ] If anything failed, capture: `SMOKE_RUN.md` (auto-generated by CLI),
      console logs (last 100 lines), network tab HAR export, screenshot.

---

# Phase 2+ sections (intentionally empty in Phase 1)

## Reasoning blocks

## Tool calls

## Interrupts / human-in-the-loop

## Citations

## Generative UI / A2UI surfaces

## Subagents

## Time travel / timeline

## Multi-thread
```

- [ ] **Step 2: Commit**

```bash
git add examples/chat/smoke/CHECKLIST.md
git commit -m "docs(examples-chat-smoke): full Phase 1 smoke checklist"
```

### Task 4.3: cli.mjs (interactive smoke generator)

**Files:**
- Create: `examples/chat/smoke/cli.mjs`

- [ ] **Step 1: cli.mjs**

```js
#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/* eslint-disable no-console */

/**
 * Interactive smoke generator. Scaffolds a fresh, npm-installed
 * consumer of the canonical examples/chat demo so we can validate the
 * published @ngaf/* packages against the same UI the workspace dev
 * sees. Default target: ~/tmp/ngaf (overridable).
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output, exit } from 'node:process';
import {
  cp, mkdir, rm, writeFile, readFile, access, stat,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(SCRIPT_DIR, 'template');
const DEMO_APP_DIR = resolve(SCRIPT_DIR, '..', 'angular', 'src', 'app');
const CHECKLIST = join(SCRIPT_DIR, 'CHECKLIST.md');
const DEFAULT_TARGET = join(homedir(), 'tmp', 'ngaf');

const NGAF_PACKAGES = ['@ngaf/ag-ui', '@ngaf/chat', '@ngaf/langgraph', '@ngaf/render'];

async function main() {
  const rl = createInterface({ input, output });
  const ask = (q, def) => rl.question(def !== undefined ? `${q} (${def}) ` : `${q} `).then(v => v.trim() || def);

  console.log('\n📦 NGAF chat smoke generator\n');

  const target = resolve(await ask('Target directory:', DEFAULT_TARGET));
  let action = 'fresh';
  if (existsSync(target)) {
    const choice = await ask(
      `Directory exists. [r]efresh / [u]pdate in place / [c]ancel:`,
      'c',
    );
    const c = choice.toLowerCase();
    if (c.startsWith('c')) { console.log('Cancelled.'); rl.close(); exit(0); }
    if (c.startsWith('u')) { action = 'update'; }
    else if (c.startsWith('r')) { action = 'fresh'; }
    else { console.log('Unrecognised choice; cancelling.'); rl.close(); exit(1); }
  }

  let resolvedVersion;
  try {
    resolvedVersion = execSync('npm view @ngaf/chat version', { encoding: 'utf8' }).trim();
  } catch (e) {
    console.error('Could not resolve @ngaf/chat version from npm:', e.message);
    rl.close();
    exit(1);
  }
  const versionAnswer = await ask(`@ngaf version:`, resolvedVersion);
  const version = versionAnswer.replace(/^[v^~]+/, '');

  const installAnswer = await ask('Run `npm install` now? [Y/n]:', 'Y');
  const doInstall = !installAnswer.toLowerCase().startsWith('n');
  let doStart = false;
  if (doInstall) {
    const startAnswer = await ask('Run `npm start` after install? [Y/n]:', 'Y');
    doStart = !startAnswer.toLowerCase().startsWith('n');
  }

  rl.close();

  if (action === 'fresh') {
    console.log(`\n→ Removing ${target} ...`);
    await rm(target, { recursive: true, force: true });
    console.log(`→ Copying scaffold from ${TEMPLATE_DIR} ...`);
    await cp(TEMPLATE_DIR, target, { recursive: true });
    console.log(`→ Copying app code from ${DEMO_APP_DIR} ...`);
    await cp(DEMO_APP_DIR, join(target, 'src', 'app'), { recursive: true });
  } else {
    console.log(`\n→ Updating in place at ${target} (skipping scaffold copy) ...`);
  }

  // Pin version in package.json
  const pkgPath = join(target, 'package.json');
  const pkgRaw = await readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgRaw);
  for (const name of NGAF_PACKAGES) {
    if (pkg.dependencies && pkg.dependencies[name]) {
      pkg.dependencies[name] = `^${version}`;
    }
  }
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`→ Pinned ${NGAF_PACKAGES.join(', ')} to ^${version}`);

  // Copy CHECKLIST.md
  await cp(CHECKLIST, join(target, 'CHECKLIST.md'));

  // Write SMOKE_RUN.md capture
  const smokeRun = await buildSmokeRun({ target, version });
  await writeFile(join(target, 'SMOKE_RUN.md'), smokeRun);
  console.log('→ Wrote SMOKE_RUN.md');

  if (doInstall) {
    console.log('\n→ Running npm install ...');
    await runChild('npm', ['install'], { cwd: target });
  }

  console.log(`\n✓ Smoke consumer ready at ${target}`);
  console.log(`  Backend:  cd examples/chat/python && uv run langgraph dev --port 2024`);
  console.log(`  App:      cd ${target} && npm start`);
  console.log(`  URL:      http://localhost:4200`);
  console.log(`  Checklist: cat ${join(target, 'CHECKLIST.md')}\n`);

  if (doStart) {
    console.log('→ Starting `npm start` (Ctrl+C to stop) ...\n');
    await runChild('npm', ['start'], { cwd: target, foreground: true });
  }
}

async function buildSmokeRun({ target, version }) {
  const lines = [
    '# Smoke run capture',
    '',
    `- Timestamp: ${new Date().toISOString()}`,
    `- Target: ${target}`,
    `- @ngaf version (pinned): ^${version}`,
    `- Node: ${process.version}`,
    `- Platform: ${process.platform} ${process.arch}`,
  ];
  try {
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    lines.push(`- Workspace git SHA: ${sha}`);
  } catch { /* outside a repo, ignore */ }
  try {
    const npmV = execSync('npm --version', { encoding: 'utf8' }).trim();
    lines.push(`- npm: ${npmV}`);
  } catch { /* ignore */ }
  lines.push('', '## Resolved npm versions', '');
  for (const name of NGAF_PACKAGES) {
    try {
      const v = execSync(`npm view ${name}@^${version} version`, { encoding: 'utf8' }).trim();
      lines.push(`- ${name}@${v}`);
    } catch {
      lines.push(`- ${name}: (resolution failed)`);
    }
  }
  return lines.join('\n') + '\n';
}

function runChild(cmd, args, opts = {}) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => code === 0 ? resolveP() : rejectP(new Error(`${cmd} exited ${code}`)));
    child.on('error', rejectP);
  });
}

main().catch(err => {
  console.error('\n✖ Smoke generator failed:', err.message);
  exit(1);
});
```

- [ ] **Step 2: Make executable**

Run: `chmod +x examples/chat/smoke/cli.mjs`

- [ ] **Step 3: Commit**

```bash
git add examples/chat/smoke/cli.mjs
git commit -m "feat(examples-chat-smoke): interactive CLI generator"
```

### Task 4.4: smoke project.json + README.md

**Files:**
- Create: `examples/chat/smoke/project.json`
- Create: `examples/chat/smoke/README.md`

- [ ] **Step 1: project.json**

```json
{
  "name": "examples-chat-smoke",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "examples/chat/smoke",
  "targets": {
    "run": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "examples/chat/smoke",
        "command": "node cli.mjs"
      }
    }
  }
}
```

- [ ] **Step 2: README.md**

```markdown
# examples/chat/smoke

Interactive CLI that scaffolds a fresh, npm-installed Angular consumer
of the canonical `examples/chat` demo. Used to validate that the
published `@ngaf/*` packages still behave correctly in a clean
external consumer.

## Run

```bash
npx nx run examples-chat-smoke:run
# or, equivalently:
node examples/chat/smoke/cli.mjs
```

## Flow

1. Prompts for target directory (default: `~/tmp/ngaf`).
2. If the target exists, asks: refresh / update in place / cancel.
3. Resolves the latest `@ngaf/chat` version from npm; prompts to override.
4. Copies `template/` (Angular CLI scaffold sans `src/app/`) into the target.
5. Copies `examples/chat/angular/src/app/` into the target's `src/app/`.
6. Pins `@ngaf/*` deps to the resolved version, runs `npm install`.
7. Optionally runs `npm start`.
8. Drops `CHECKLIST.md` and `SMOKE_RUN.md` (capture metadata) in the target.

## What's in `template/`

The Angular CLI bones — `package.json`, `angular.json`, `tsconfig`s,
`src/main.ts`, `src/styles.css`, `src/index.html`, `public/favicon.ico`.
The actual app code (`src/app/`) is **not** in the template — it's
copied from the live demo at generate-time. Result: the generator's
reviewable surface is just the scaffold; the app body never drifts.

The placeholder `"@ngaf/chat": "*"` in `template/package.json` is a
valid semver range ("any version"); the CLI replaces it with the
explicit `^X.Y.Z` it resolved before writing.

## Don't run `npm install` directly in `template/`

`template/` is a template, not a runnable consumer. Use the CLI from
the workspace root.
```

- [ ] **Step 3: Verify Nx picks up the project**

Run: `npx nx show project examples-chat-smoke --json | head -10`
Expected: shows `run` target.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/smoke/project.json \
        examples/chat/smoke/README.md
git commit -m "chore(examples-chat-smoke): Nx project.json + README"
```

### Task 4.5: Update aggregate `examples/chat/project.json` to expose smoke target

**Files:**
- Modify: `examples/chat/project.json`

- [ ] **Step 1: Add smoke alias**

Replace the contents of `examples/chat/project.json`:

```json
{
  "name": "examples-chat",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "examples/chat",
  "targets": {
    "serve": {
      "executor": "nx:run-commands",
      "options": {
        "commands": [
          "npx nx run examples-chat-python:serve",
          "npx nx run examples-chat-angular:serve"
        ],
        "parallel": true
      }
    },
    "smoke": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx nx run examples-chat-smoke:run"
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/chat/project.json
git commit -m "chore(examples-chat): expose smoke target on aggregate project"
```

---

# Phase 5 — Cleanup (remove stale chat-agent + update CI/e2e references)

### Task 5.1: Remove `examples/chat-agent/`

- [ ] **Step 1: Confirm no in-tree references besides historical CHANGELOG/spec/plan files**

Run:
```bash
grep -rln "chat-agent" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.ts" --include="*.js" --include="*.mjs" \
  | grep -v node_modules | grep -v '\.nx/' | grep -v '\.angular/' | grep -v '/dist/' | grep -v '\.venv/'
```
Expected: only `examples/chat-agent/`, `.github/workflows/{ci,e2e}.yml`, and `e2e/agent-e2e/src/chat-agent.e2e.spec.ts`.

- [ ] **Step 2: Delete the directory**

```bash
rm -rf examples/chat-agent
```

- [ ] **Step 3: Commit**

```bash
git add -A examples/chat-agent
git commit -m "chore: remove stale examples/chat-agent (subsumed by examples/chat)"
```

### Task 5.2: Update `.github/workflows/ci.yml`

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Replace the `chat-agent-smoke` job with `examples-chat-smoke`**

Find the block (around line 110):

```yaml
  chat-agent-smoke:
    name: Chat Agent — smoke
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: actions/setup-node@v6.3.0
        with:
          node-version: 22
          cache: npm
      - name: Install uv
        uses: astral-sh/setup-uv@v8.0.0
        with:
          python-version: '3.12'
      - run: npm ci
      - working-directory: examples/chat-agent
        run: uv sync
      - run: npx nx run chat-agent:smoke --skip-nx-cache
```

Replace with:

```yaml
  examples-chat-smoke:
    name: examples/chat — python smoke
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: actions/setup-node@v6.3.0
        with:
          node-version: 22
          cache: npm
      - name: Install uv
        uses: astral-sh/setup-uv@v8.0.0
        with:
          python-version: '3.12'
      - run: npm ci
      - working-directory: examples/chat/python
        run: uv sync
      - run: npx nx run examples-chat-python:smoke --skip-nx-cache
```

- [ ] **Step 2: Update the deploy-gate job's `needs:` list**

Find (around line 165):

```yaml
        chat-agent-smoke,
```

Replace with:

```yaml
        examples-chat-smoke,
```

- [ ] **Step 3: Verify**

Run: `grep -n 'chat-agent\|examples-chat-smoke' .github/workflows/ci.yml`
Expected: only `examples-chat-smoke` references; no `chat-agent`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: rename chat-agent-smoke job to examples-chat-smoke (new path)"
```

### Task 5.3: Update `.github/workflows/e2e.yml`

**Files:**
- Modify: `.github/workflows/e2e.yml`

- [ ] **Step 1: Replace `examples/chat-agent` working-directories with `examples/chat/python`**

Find the two blocks:

```yaml
      - name: Install Python dependencies
        working-directory: examples/chat-agent
        run: uv sync

      - name: Start LangGraph dev server
        working-directory: examples/chat-agent
        run: uv run langgraph dev --no-browser &
```

Replace with:

```yaml
      - name: Install Python dependencies
        working-directory: examples/chat/python
        run: uv sync

      - name: Start LangGraph dev server
        working-directory: examples/chat/python
        run: uv run langgraph dev --no-browser &
```

- [ ] **Step 2: Verify**

Run: `grep -n 'chat-agent' .github/workflows/e2e.yml`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci: point e2e workflow at examples/chat/python (was examples/chat-agent)"
```

### Task 5.4: Rename and update e2e spec

**Files:**
- Rename: `e2e/agent-e2e/src/chat-agent.e2e.spec.ts` → `e2e/agent-e2e/src/examples-chat.e2e.spec.ts`
- Modify: contents (assistant id `chat_agent` → `chat`, header comments)

- [ ] **Step 1: Read the existing spec to know the assistant_id usages**

Run: `grep -n 'chat_agent\|chat-agent' e2e/agent-e2e/src/chat-agent.e2e.spec.ts`

- [ ] **Step 2: Rename the file**

```bash
git mv e2e/agent-e2e/src/chat-agent.e2e.spec.ts e2e/agent-e2e/src/examples-chat.e2e.spec.ts
```

- [ ] **Step 3: Update contents**

In the renamed file:
- Replace the docstring's `examples/chat-agent/` with `examples/chat/python/`.
- Replace the describe label `'chat-agent e2e'` with `'examples/chat e2e'`.
- Replace any `'chat_agent'` literal (the assistant id passed to `client.runs.stream`) with `'chat'`.

```bash
sed -i.bak \
  -e 's|examples/chat-agent/|examples/chat/python/|g' \
  -e "s|'chat-agent e2e'|'examples/chat e2e'|g" \
  -e "s|'chat_agent'|'chat'|g" \
  e2e/agent-e2e/src/examples-chat.e2e.spec.ts
rm e2e/agent-e2e/src/examples-chat.e2e.spec.ts.bak
```

Run: `grep -n 'chat-agent\|chat_agent' e2e/agent-e2e/src/examples-chat.e2e.spec.ts`
Expected: no matches.

- [ ] **Step 4: If the e2e project's project.json references the file path, update**

Run: `grep -rn 'chat-agent.e2e' e2e/agent-e2e/`
If matches found, replace with `examples-chat.e2e`.

- [ ] **Step 5: Commit**

```bash
git add e2e/agent-e2e
git commit -m "test(agent-e2e): rename chat-agent.e2e → examples-chat.e2e and target new graph"
```

### Task 5.5: Search for stragglers

- [ ] **Step 1: Final sweep**

Run:
```bash
grep -rln "chat-agent\|chat_agent" \
  --include="*.json" --include="*.yml" --include="*.yaml" \
  --include="*.ts" --include="*.js" --include="*.mjs" \
  --include="*.md" \
  | grep -v node_modules | grep -v '\.nx/' | grep -v '\.angular/' | grep -v '/dist/' | grep -v '\.venv/' \
  | grep -v 'docs/superpowers/'  # historical specs/plans are OK
```
Expected: no output (or only entries in `CHANGELOG.md` / website content that are historical).

- [ ] **Step 2: If any non-historical reference is found,** update it to point at `examples/chat/` and commit.

---

# Phase 6 — README + final smoke validation

### Task 6.1: `examples/chat/README.md`

**Files:**
- Create: `examples/chat/README.md`

- [ ] **Step 1: Write README.md**

```markdown
# examples/chat — canonical demo for `@ngaf/chat`

Full-stack demo of `@ngaf/chat` against a tiny LangGraph backend. Three
chat compositions (embed, popup, sidebar), regenerate, model picker,
debug overlay — all in one page, switchable via a floating control
palette.

This example serves two audiences:

- **External users** learning the framework — clone, run, see the
  major surfaces work end-to-end in five minutes.
- **Internal release validators** — run the smoke generator after a
  publish to confirm the published packages still behave correctly in
  a clean consumer.

## Quick start (5 minutes)

```bash
# 1. Clone & install workspace deps
git clone https://github.com/cacheplane/angular-agent-framework.git
cd angular-agent-framework
npm ci

# 2. Configure the backend
cp examples/chat/python/.env.example examples/chat/python/.env
# Edit .env to add your OPENAI_API_KEY

# 3. Sync python deps
(cd examples/chat/python && uv sync)

# 4. Start everything (Angular on :4200, Python on :2024)
npx nx run examples-chat:serve
```

Open http://localhost:4200, click a welcome suggestion, watch a markdown
response stream in. Use the floating palette top-right to switch between
embed / popup / sidebar modes, change the model, or open the debug overlay.

## Architecture

```
examples/chat/
├── angular/   # Workspace-linked dev demo (Angular 21)
├── python/    # Tiny LangGraph backend (uv + langgraph dev)
└── smoke/     # Interactive CLI: scaffolds an npm-installed consumer
```

The Angular app (`angular/`) consumes `@ngaf/*` via workspace TS paths
(fast iteration: edit a lib, demo reloads). The Python graph (`python/`)
is a single-node `__start__ → generate → __end__` LangGraph; the demo
sets `state.model` on every submit so the model picker takes effect
without reconnecting. The smoke generator (`smoke/cli.mjs`) creates a
**second** consumer at `~/tmp/ngaf` (default) with `@ngaf/*` resolved
from npm — used to validate the published packages match the workspace
behavior.

## Working on the demo

```bash
npx nx run examples-chat:serve         # both backend + frontend
npx nx run examples-chat-angular:test  # vitest specs
npx nx run examples-chat-angular:lint
npx nx run examples-chat-python:test
```

Edit `examples/chat/angular/src/app/`. The Angular dev server reloads
on save. The Python graph reloads when `langgraph dev` notices file
changes.

To add a new welcome suggestion: edit
`examples/chat/angular/src/app/modes/welcome-suggestions.ts`. All three
modes pick it up.

## Release smoke

After publishing a new `@ngaf/*` version, validate it in a fresh
consumer:

```bash
npx nx run examples-chat-smoke:run
# Default target: ~/tmp/ngaf
# Then in another terminal:
cd examples/chat/python && uv run langgraph dev --port 2024 --no-browser
# In a third:
cd ~/tmp/ngaf && npm start
# Open http://localhost:4200, walk through CHECKLIST.md
```

The CLI captures `SMOKE_RUN.md` in the generated dir — versions, git
SHA, node/npm — so a failure can be reported with one paste.

## Roadmap

Phase 1 (this version) covers: three chat compositions, regenerate,
markdown surfaces, model picker, debug overlay.

Later phases layer in: reasoning blocks, tool calls, interrupts,
citations, generative UI (A2UI), subagents, time travel, multi-thread.
Each lands as its own spec → plan → PR cycle. See
`docs/superpowers/specs/2026-05-08-canonical-chat-demo-design.md` for
the roadmap table.
```

- [ ] **Step 2: Commit**

```bash
git add examples/chat/README.md
git commit -m "docs(examples-chat): dual-audience README (external onboarding + release smoke)"
```

### Task 6.2: Validate the smoke generator end-to-end

- [ ] **Step 1: Ensure 0.0.x of `@ngaf/*` is published**

Run: `npm view @ngaf/chat version`
Expected: a real version (not 404).

- [ ] **Step 2: Stop any pre-existing `~/tmp/ngaf`'s `npm start`** (if running).

- [ ] **Step 3: Run the generator with `Refresh`**

Run: `npx nx run examples-chat-smoke:run`
- Target: `~/tmp/ngaf` (default — accept by pressing Enter)
- "Directory exists?" → `r` (refresh)
- Version → accept default (resolved from npm)
- `npm install` → Y
- `npm start` → N (we'll start manually so the CLI returns)

Expected: completes without error, prints "Smoke consumer ready", `~/tmp/ngaf/` populated.

- [ ] **Step 4: Verify the generated consumer**

```bash
ls ~/tmp/ngaf/src/app
cat ~/tmp/ngaf/SMOKE_RUN.md | head -20
grep '"@ngaf/chat"' ~/tmp/ngaf/package.json   # should be ^X.Y.Z (real version)
```
Expected: `src/app/` matches `examples/chat/angular/src/app/`; `package.json` has explicit version; `SMOKE_RUN.md` has timestamp + versions.

- [ ] **Step 5: Start backend + start the smoke consumer**

```bash
# Terminal 1
cd examples/chat/python && uv run langgraph dev --port 2024 --no-browser

# Terminal 2
cd ~/tmp/ngaf && npm start
```

Visit http://localhost:4200.

- [ ] **Step 6: Walk through `CHECKLIST.md` (in the generated dir)**

Run: `cat ~/tmp/ngaf/CHECKLIST.md`
Step through every checked item in a browser. Note which items pass/fail.

- [ ] **Step 7: If any items fail,** decide:
- Demo bug: fix in `examples/chat/angular/src/app/`, re-run the generator (`u` for update in place to skip scaffold copy if just app changes).
- Library bug: open an issue against `libs/chat`. The smoke is the canonical "what should work" — don't soften the checklist.

- [ ] **Step 8: Commit any demo-side fixes**

```bash
git add examples/chat/angular/
git commit -m "fix(examples-chat-angular): smoke-validation corrections"
```
*(Skip if no fixes needed.)*

### Task 6.3: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin claude/examples-chat-canonical-demo
```

- [ ] **Step 2: Open PR via gh**

```bash
gh pr create --title "feat(examples-chat): canonical @ngaf/chat demo + smoke generator (Phase 1)" --body "$(cat <<'EOF'
## Summary

- New canonical demo at \`examples/chat/\`, replacing the stale \`examples/chat-agent/\` (Python-only).
- Three peers: \`angular/\` (workspace-linked Angular 21 demo), \`python/\` (tiny LangGraph backend), \`smoke/\` (interactive CLI that scaffolds a fresh, npm-installed consumer at \`~/tmp/ngaf\`).
- Demo exercises: three chat compositions (embed/popup/sidebar) via path-based routes, floating control palette (mode + model + debug + new conversation), regenerate, markdown surfaces, threadId persistence across reloads.
- Smoke CLI's \`template/\` is a frozen Angular CLI scaffold *minus* \`src/app/\`; the demo's \`src/app/\` is copied in at generate-time so the smoke surface can never drift from what workspace dev sees.
- Comprehensive Phase 1 \`CHECKLIST.md\` (pre-flight, render, streaming, regenerate, cross-mode persistence, model picker, debug overlay, palette UX, a11y, error handling, lifecycle, browser hygiene, visual polish) with empty Phase 2+ sections to fill as features land.
- Removed \`examples/chat-agent/\`; updated CI workflows + e2e spec to point at \`examples/chat/python/\`.

Spec: \`docs/superpowers/specs/2026-05-08-canonical-chat-demo-design.md\`
Plan: \`docs/superpowers/plans/2026-05-08-canonical-chat-demo.md\`

## Test plan

- [ ] CI green
- [ ] \`npx nx run examples-chat-python:smoke\` passes
- [ ] \`npx nx run examples-chat-angular:test\` passes
- [ ] \`npx nx run examples-chat-angular:lint\` passes
- [ ] \`npx nx run examples-chat-angular:build\` succeeds
- [ ] \`npx nx run examples-chat:serve\` runs locally — :4200 + :2024 both up
- [ ] \`npx nx run examples-chat-smoke:run\` produces a working consumer at \`~/tmp/ngaf\`
- [ ] Walked through \`CHECKLIST.md\` against the generated consumer; any failures captured as separate issues
EOF
)"
```

- [ ] **Step 3: Wait for CI; address failures.**

- [ ] **Step 4: Merge once green.**

---

## Definition of done

All true:

1. PR merged with `examples/chat/{angular,python,smoke}/` introduced and `examples/chat-agent/` removed.
2. `nx run examples-chat:serve` works locally — Angular at :4200, Python at :2024, both reload on file save.
3. `nx run examples-chat-smoke:run` defaults to `~/tmp/ngaf`, generates a working consumer, the consumer's `npm start` succeeds against the workspace's Python backend.
4. The full Phase 1 checklist runs green against the generated smoke consumer (or any failures are filed as issues against `libs/chat`).
5. README explains both audiences clearly enough that a fresh contributor can get to step (2) without asking.
