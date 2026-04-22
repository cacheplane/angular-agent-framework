# Streaming Example — Chat UI Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the cockpit `langgraph/streaming/angular` example to correctly consume `@cacheplane/chat` and `@cacheplane/langgraph`, making it buildable and serveable as a standalone Angular app against a real LangGraph backend.

**Architecture:** Standalone Angular app bootstrapped with `bootstrapApplication()`. Uses `provideAgent()` for global API URL, `provideChat()` for chat config. `StreamingComponent` creates a `agent()` ref and passes it to `<chat-ui [ref]>`. Proxied to LangGraph dev server on port 8123 via `/api`.

**Tech Stack:** Angular 21, `@cacheplane/chat`, `@cacheplane/langgraph`, `@angular-devkit/build-angular`, Tailwind CSS

---

## Context

The streaming example has two problems:

1. **Wrong API usage:** `StreamingComponent` uses `<cp-chat [messages] [isLoading] (sendMessage)>` — none of these exist. The actual `ChatComponent` has selector `chat-ui` and accepts `[ref]` (a `AgentRef`).

2. **Duplicate entry points:** Two app components exist (`src/app.component.ts` and `src/app/streaming.component.ts`) from different branches being merged. Need to consolidate to one.

3. **No Angular CLI build target:** `project.json` uses `@nx/js:tsc` (library build) instead of `@angular-devkit/build-angular:application` (app build). Can't serve the app.

## File Structure

```
cockpit/langgraph/streaming/angular/
├── src/
│   ├── app/
│   │   ├── streaming.component.ts   # REWRITE — use chat-ui with [ref]
│   │   └── app.config.ts            # UPDATE — add provideChat
│   ├── environments/
│   │   ├── environment.ts           # VERIFY — production config
│   │   └── environment.development.ts # UPDATE — use /api proxy
│   ├── main.ts                      # REWRITE — bootstrap StreamingComponent
│   ├── index.html                   # UPDATE — proper Angular app HTML
│   ├── styles.css                   # VERIFY — Tailwind setup
│   ├── index.ts                     # KEEP — module descriptor for cockpit
│   ├── app.component.ts             # DELETE — duplicate
│   └── app.config.ts                # DELETE — duplicate
├── project.json                     # REWRITE — Angular CLI build/serve targets
├── tsconfig.app.json                # UPDATE — Angular CLI compatible
├── proxy.conf.json                  # KEEP — proxies /api to localhost:8123
├── package.json                     # KEEP
└── prompts/streaming.md             # KEEP
```

---

### Task 1: Clean Up Duplicate Files

**Files:**
- Delete: `cockpit/langgraph/streaming/angular/src/app.component.ts`
- Delete: `cockpit/langgraph/streaming/angular/src/app.config.ts`

- [ ] **Step 1: Delete duplicate entry point**

```bash
rm cockpit/langgraph/streaming/angular/src/app.component.ts
rm cockpit/langgraph/streaming/angular/src/app.config.ts
```

- [ ] **Step 2: Commit**

```bash
git add -A cockpit/langgraph/streaming/angular/src/
git commit -m "chore(cockpit): remove duplicate streaming entry points"
```

---

### Task 2: Rewrite StreamingComponent with Correct Chat API

**Files:**
- Modify: `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts`

- [ ] **Step 1: Rewrite the component**

The component must use `chat-ui` selector (the actual ChatComponent selector) with `[ref]` input. Call `agent()` as a field initializer (valid injection context — no need for `runInInjectionContext`).

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { agent } from '@cacheplane/langgraph';
import { environment } from '../environments/environment';

/**
 * Streaming demo — simplest possible @cacheplane/chat integration.
 *
 * Creates a agent ref and passes it to the prebuilt <chat-ui>
 * composition. The composition handles message rendering, input, typing
 * indicator, and error display internally.
 */
@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat-ui [ref]="stream" class="block h-screen" />`,
})
export class StreamingComponent {
  protected readonly stream = agent({
    assistantId: environment.streamingAssistantId,
  });
}
```

- [ ] **Step 2: Verify the import resolves**

Run: `npx nx build cockpit-langgraph-streaming-angular --dry-run` (or just check TypeScript compilation)

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/angular/src/app/streaming.component.ts
git commit -m "feat(cockpit): rewrite streaming component with correct chat-ui API"
```

---

### Task 3: Update App Config and Bootstrap

**Files:**
- Modify: `cockpit/langgraph/streaming/angular/src/app/app.config.ts`
- Modify: `cockpit/langgraph/streaming/angular/src/main.ts`
- Modify: `cockpit/langgraph/streaming/angular/src/environments/environment.development.ts`

- [ ] **Step 1: Update app.config.ts to include provideChat**

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@cacheplane/langgraph';
import { provideChat } from '@cacheplane/chat';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: environment.langGraphApiUrl }),
    provideChat({}),
  ],
};
```

- [ ] **Step 2: Update main.ts to bootstrap StreamingComponent**

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { StreamingComponent } from './app/streaming.component';

bootstrapApplication(StreamingComponent, appConfig).catch(console.error);
```

- [ ] **Step 3: Update development environment to use proxy**

```typescript
export const environment = {
  production: false,
  langGraphApiUrl: '/api',
  streamingAssistantId: 'streaming',
};
```

The `/api` path is rewritten to `http://localhost:8123` by `proxy.conf.json`.

- [ ] **Step 4: Commit**

```bash
git add cockpit/langgraph/streaming/angular/src/
git commit -m "feat(cockpit): update streaming app config and bootstrap"
```

---

### Task 4: Add Angular CLI Build and Serve Targets

**Files:**
- Modify: `cockpit/langgraph/streaming/angular/project.json`
- Modify: `cockpit/langgraph/streaming/angular/tsconfig.app.json`
- Modify: `cockpit/langgraph/streaming/angular/src/index.html`
- Verify: `cockpit/langgraph/streaming/angular/src/styles.css`

- [ ] **Step 1: Rewrite project.json with Angular CLI targets**

Replace the `@nx/js:tsc` build target with `@angular-devkit/build-angular:application` and add a `serve` target:

```json
{
  "name": "cockpit-langgraph-streaming-angular",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/langgraph/streaming/angular/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@angular-devkit/build-angular:application",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/cockpit/langgraph/streaming/angular",
        "index": "cockpit/langgraph/streaming/angular/src/index.html",
        "browser": "cockpit/langgraph/streaming/angular/src/main.ts",
        "tsConfig": "cockpit/langgraph/streaming/angular/tsconfig.app.json",
        "styles": ["cockpit/langgraph/streaming/angular/src/styles.css"]
      },
      "configurations": {
        "production": {
          "outputHashing": "all"
        },
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true
        }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "executor": "@angular-devkit/build-angular:dev-server",
      "options": {
        "port": 4300,
        "proxyConfig": "cockpit/langgraph/streaming/angular/proxy.conf.json"
      },
      "configurations": {
        "production": {
          "buildTarget": "cockpit-langgraph-streaming-angular:build:production"
        },
        "development": {
          "buildTarget": "cockpit-langgraph-streaming-angular:build:development"
        }
      },
      "defaultConfiguration": "development"
    },
    "smoke": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "cockpit/langgraph/streaming/angular",
        "command": "npx tsx -e \"import { langgraphStreamingAngularModule } from './src/index.ts'; const module = langgraphStreamingAngularModule; if (module.id !== 'langgraph-streaming-angular' || module.title !== 'LangGraph Streaming (Angular)') { throw new Error('Unexpected module shape for ' + module.id); }\""
      }
    }
  }
}
```

- [ ] **Step 2: Update tsconfig.app.json for Angular CLI**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc",
    "types": []
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts"]
}
```

- [ ] **Step 3: Update index.html**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>LangGraph Streaming — Angular</title>
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body class="bg-gray-950 text-gray-100 h-screen">
  <app-streaming></app-streaming>
</body>
</html>
```

- [ ] **Step 4: Verify styles.css has Tailwind**

Check that `src/styles.css` contains Tailwind directives. If not, add them:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Also verify that a `tailwind.config.js` or equivalent exists at the example root, or that Tailwind is configured at the workspace level. If Tailwind isn't set up for this project, use the CDN script in `index.html` as a fallback:

```html
<script src="https://cdn.tailwindcss.com"></script>
```

- [ ] **Step 5: Build the app**

Run: `npx nx build cockpit-langgraph-streaming-angular`

Expected: Build succeeds, output in `dist/cockpit/langgraph/streaming/angular/`.

- [ ] **Step 6: Serve the app**

Run: `npx nx serve cockpit-langgraph-streaming-angular`

Expected: Dev server starts on `http://localhost:4300`.

- [ ] **Step 7: Commit**

```bash
git add cockpit/langgraph/streaming/angular/
git commit -m "feat(cockpit): add Angular CLI build and serve targets for streaming example"
```

---

### Task 5: End-to-End Verification

- [ ] **Step 1: Start the LangGraph backend**

In a separate terminal:
```bash
cd cockpit/langgraph/streaming/python
langgraph dev
```

Expected: LangGraph dev server starts on `http://localhost:8123`.

- [ ] **Step 2: Serve the Angular app**

```bash
npx nx serve cockpit-langgraph-streaming-angular
```

Expected: Dev server on `http://localhost:4300`.

- [ ] **Step 3: Test in browser**

Open `http://localhost:4300`:
- Chat UI renders (message list, input, typing indicator)
- Type a message and submit
- Verify streaming response renders token by token
- Verify typing indicator shows during streaming
- Verify human messages appear right-aligned (blue)
- Verify AI messages appear left-aligned (gray)

- [ ] **Step 4: Test error handling**

Stop the LangGraph backend and submit a message. Verify the error component renders.

- [ ] **Step 5: Run library tests to verify no regressions**

```bash
npx nx test render && npx nx test chat && npx nx test angular
```

- [ ] **Step 6: Document any issues found**

If the chat or render libraries have bugs discovered during integration testing, document them for follow-up fixes.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Clean up duplicate files | Delete 2 files |
| 2 | Rewrite StreamingComponent | 1 file |
| 3 | Update config and bootstrap | 3 files |
| 4 | Add Angular CLI build/serve targets | 4 files |
| 5 | End-to-end verification | Manual testing |
