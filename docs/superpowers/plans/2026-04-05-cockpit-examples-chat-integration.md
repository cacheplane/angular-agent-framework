# Cockpit Angular Examples — Chat Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all 13 remaining cockpit Angular examples to correctly consume `@cacheplane/chat`, making each a buildable standalone Angular app.

**Architecture:** Each example follows the streaming reference pattern: standalone Angular app with `bootstrapApplication()`, `provideStreamResource()` + `provideChat()`, Angular CLI build/serve targets, proxy to LangGraph backend. LangGraph examples use `<chat>`, deep-agents examples use `<chat-debug>`.

**Tech Stack:** Angular 21, `@cacheplane/chat`, `@cacheplane/stream-resource`, `@angular-devkit/build-angular`

**Spec:** `docs/superpowers/specs/2026-04-05-cockpit-examples-chat-integration.md`

---

## Reference Pattern

The streaming example (`cockpit/langgraph/streaming/angular/`) is the proven pattern. Each of the 13 remaining examples gets the same treatment.

### Files changed per example:
1. **Delete** `src/app.component.ts` (duplicate)
2. **Delete** `src/app.config.ts` (duplicate at root level)
3. **Rewrite** `src/app/{capability}.component.ts` — use `<chat [ref]>` or `<chat-debug [ref]>`
4. **Rewrite** `src/app/app.config.ts` — `provideStreamResource` + `provideChat`
5. **Rewrite** `src/main.ts` — bootstrap correct component
6. **Rewrite** `project.json` — `@angular-devkit/build-angular:application` + `dev-server`
7. **Update** `tsconfig.app.json` — add `lib`, `emitDeclarationOnly`
8. **Update** `src/index.html` — add `<base href="/">`
9. **Update** `src/environments/environment.development.ts` — use `/api` proxy path

---

### Task 1: LangGraph Examples (7 examples)

**Examples:** persistence, interrupts, memory, time-travel, subgraphs, durable-execution, deployment-runtime

Each LangGraph example component uses `<chat [ref]="stream" class="block h-screen" />` as the template. The component creates `streamResource()` with the capability-specific `assistantId`.

**Configuration per example:**

| Example | Selector | AssistantId | Port | Proxy Target |
|---|---|---|---|---|
| persistence | `app-persistence` | `persistence` | 4301 | localhost:8124 |
| interrupts | `app-interrupts` | `interrupts` | 4302 | localhost:8125 |
| memory | `app-memory` | `memory` | 4303 | localhost:8126 |
| time-travel | `app-time-travel` | `time-travel` | 4304 | localhost:8127 |
| subgraphs | `app-subgraphs` | `subgraphs` | 4305 | localhost:8128 |
| durable-execution | `app-durable-execution` | `durable-execution` | 4306 | localhost:8129 |
| deployment-runtime | `app-deployment-runtime` | `deployment-runtime` | 4307 | localhost:8130 |

**For each example, apply these changes:**

- [ ] **Step 1: Delete duplicate files**

```bash
rm cockpit/langgraph/{topic}/angular/src/app.component.ts
rm cockpit/langgraph/{topic}/angular/src/app.config.ts
```

- [ ] **Step 2: Rewrite capability component**

Each component follows this template (replace `{Topic}`, `{topic}`, `{selector}`):

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

@Component({
  selector: '{selector}',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="stream" class="block h-screen" />`,
})
export class {Topic}Component {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.{topic}AssistantId,
  });
}
```

Where each example uses its existing environment config keys (e.g., `environment.persistenceAssistantId`). Check what the existing environment file exports and match it.

- [ ] **Step 3: Rewrite app.config.ts**

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ApplicationConfig } from '@angular/core';
import { provideStreamResource } from '@cacheplane/stream-resource';
import { provideChat } from '@cacheplane/chat';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStreamResource({ apiUrl: environment.langGraphApiUrl }),
    provideChat({}),
  ],
};
```

- [ ] **Step 4: Rewrite main.ts**

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { {Topic}Component } from './app/{topic}.component';

bootstrapApplication({Topic}Component, appConfig).catch(console.error);
```

- [ ] **Step 5: Rewrite project.json**

Replace with Angular CLI application pattern. Use the correct project name, paths, port, and smoke test values for each example. Pattern:

```json
{
  "name": "cockpit-langgraph-{topic}-angular",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/langgraph/{topic}/angular/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@angular-devkit/build-angular:application",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/cockpit/langgraph/{topic}/angular",
        "index": "cockpit/langgraph/{topic}/angular/src/index.html",
        "browser": "cockpit/langgraph/{topic}/angular/src/main.ts",
        "tsConfig": "cockpit/langgraph/{topic}/angular/tsconfig.app.json",
        "styles": ["cockpit/langgraph/{topic}/angular/src/styles.css"]
      },
      "configurations": {
        "production": { "outputHashing": "all" },
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true,
          "fileReplacements": [{
            "replace": "cockpit/langgraph/{topic}/angular/src/environments/environment.ts",
            "with": "cockpit/langgraph/{topic}/angular/src/environments/environment.development.ts"
          }]
        }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "executor": "@angular-devkit/build-angular:dev-server",
      "options": {
        "port": {port},
        "proxyConfig": "cockpit/langgraph/{topic}/angular/proxy.conf.json"
      },
      "configurations": {
        "production": { "buildTarget": "cockpit-langgraph-{topic}-angular:build:production" },
        "development": { "buildTarget": "cockpit-langgraph-{topic}-angular:build:development" }
      },
      "defaultConfiguration": "development"
    },
    "smoke": { ... existing smoke target ... }
  }
}
```

- [ ] **Step 6: Update tsconfig.app.json**

Ensure it has:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc",
    "lib": ["es2022", "dom"],
    "types": [],
    "emitDeclarationOnly": false
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 7: Update index.html**

Add `<base href="/">` and correct body classes:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>LangGraph {Topic} — Angular</title>
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 text-gray-100 h-screen">
  <{selector}></{selector}>
</body>
</html>
```

- [ ] **Step 8: Update environment.development.ts**

Ensure it uses `/api` proxy (not full URL):
```typescript
export const environment = {
  production: false,
  langGraphApiUrl: '/api',
  {topic}AssistantId: '{topic}',
};
```

- [ ] **Step 9: Update proxy.conf.json target port**

Each example's proxy should point to its backend port:
```json
{ "/api": { "target": "http://localhost:{backendPort}", "secure": false, "changeOrigin": true, "pathRewrite": { "^/api": "" }, "ws": true } }
```

- [ ] **Step 10: Build all 7 examples**

```bash
npx nx build cockpit-langgraph-persistence-angular
npx nx build cockpit-langgraph-interrupts-angular
npx nx build cockpit-langgraph-memory-angular
npx nx build cockpit-langgraph-time-travel-angular
npx nx build cockpit-langgraph-subgraphs-angular
npx nx build cockpit-langgraph-durable-execution-angular
npx nx build cockpit-langgraph-deployment-runtime-angular
```

Fix any build errors.

- [ ] **Step 11: Commit**

```bash
git add cockpit/langgraph/
git commit -m "feat(cockpit): wire 7 LangGraph Angular examples to @cacheplane/chat"
```

---

### Task 2: Deep Agents Examples (6 examples)

**Examples:** planning, filesystem, subagents, memory, skills, sandboxes

Each deep-agents example uses `<chat-debug [ref]="stream" class="block h-screen" />` instead of `<chat>`.

**Configuration per example:**

| Example | Selector | AssistantId | Port | Proxy Target |
|---|---|---|---|---|
| planning | `app-planning` | `planning` | 4310 | localhost:8140 |
| filesystem | `app-filesystem` | `filesystem` | 4311 | localhost:8141 |
| subagents | `app-subagents` | `subagents` | 4312 | localhost:8142 |
| memory | `app-da-memory` | `memory` | 4313 | localhost:8143 |
| skills | `app-skills` | `skills` | 4314 | localhost:8144 |
| sandboxes | `app-sandboxes` | `sandboxes` | 4315 | localhost:8145 |

**Same steps as Task 1, except:**

- Component imports `ChatDebugComponent` instead of `ChatComponent`
- Template uses `<chat-debug [ref]="stream" class="block h-screen" />`
- `app.config.ts` also includes `provideRender({})` from `@cacheplane/render`
- `$schema` path is 6 levels deep: `../../../../../../node_modules/nx/schemas/project-schema.json`
- All paths use `cockpit/deep-agents/{topic}/angular/` instead of `cockpit/langgraph/{topic}/angular/`
- Project names: `cockpit-deep-agents-{topic}-angular`

Component template:
```typescript
import { ChatDebugComponent } from '@cacheplane/chat';
// ...
template: `<chat-debug [ref]="stream" class="block h-screen" />`,
```

- [ ] **Steps 1-9: Same as Task 1** but for deep-agents paths and ChatDebugComponent

- [ ] **Step 10: Build all 6 examples**

```bash
npx nx build cockpit-deep-agents-planning-angular
npx nx build cockpit-deep-agents-filesystem-angular
npx nx build cockpit-deep-agents-subagents-angular
npx nx build cockpit-deep-agents-memory-angular
npx nx build cockpit-deep-agents-skills-angular
npx nx build cockpit-deep-agents-sandboxes-angular
```

- [ ] **Step 11: Commit**

```bash
git add cockpit/deep-agents/
git commit -m "feat(cockpit): wire 6 Deep Agents Angular examples to @cacheplane/chat"
```

---

### Task 3: Full Verification

- [ ] **Step 1: Run library tests**

```bash
npx nx test render && npx nx test chat && npx nx test stream-resource
```

Expected: All pass.

- [ ] **Step 2: Build all 14 examples (including streaming)**

```bash
npx nx run-many -t build --projects='cockpit-*-angular'
```

Expected: All 14 build.

- [ ] **Step 3: Commit any fixes**

---

## Summary

| Task | Description | Examples |
|------|-------------|---------|
| 1 | LangGraph examples → `<chat>` | 7 examples |
| 2 | Deep Agents examples → `<chat-debug>` | 6 examples |
| 3 | Full verification | All 14 |
