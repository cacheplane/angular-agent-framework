# LangSmith Deployment + Angular Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Angular streaming example to use `streamResource()` from `@cacheplane/stream-resource`, add environment config for LangGraph Cloud, and create a CI workflow that deploys the LangGraph backend on merge to main (with manual dispatch for testing).

**Architecture:** Delete the hand-rolled `StreamingService`, replace with `streamResource()` Signal-based API. Add Angular environment files for dev/prod LangGraph URLs. Create a GitHub Action that runs `langgraph deploy` from the capability's python directory. Update `app.config.ts` to use `provideStreamResource()`.

**Tech Stack:** Angular 19+ (standalone), `@cacheplane/stream-resource`, `@langchain/langgraph-sdk`, `@langchain/core`, GitHub Actions, `langgraph-cli`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Delete | `cockpit/langgraph/streaming/angular/src/app/streaming.service.ts` | Remove hand-rolled EventSource service |
| Modify | `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts` | Use `streamResource()` with Signals |
| Modify | `cockpit/langgraph/streaming/angular/src/app/app.config.ts` | Use `provideStreamResource()` |
| Modify | `cockpit/langgraph/streaming/angular/package.json` | Add stream-resource + LangGraph deps |
| Create | `cockpit/langgraph/streaming/angular/src/environments/environment.ts` | Prod LangGraph Cloud URL |
| Create | `cockpit/langgraph/streaming/angular/src/environments/environment.development.ts` | Local dev URL |
| Create | `.github/workflows/deploy-langgraph.yml` | CI deployment workflow |
| Modify | `cockpit/langgraph/streaming/python/src/index.ts` | Remove streaming.service.ts from codeAssetPaths |

---

### Task 1: Delete StreamingService and add environment config

**Files:**
- Delete: `cockpit/langgraph/streaming/angular/src/app/streaming.service.ts`
- Create: `cockpit/langgraph/streaming/angular/src/environments/environment.ts`
- Create: `cockpit/langgraph/streaming/angular/src/environments/environment.development.ts`

- [ ] **Step 1: Delete the streaming service**

```bash
rm cockpit/langgraph/streaming/angular/src/app/streaming.service.ts
```

- [ ] **Step 2: Create production environment file**

```ts
// cockpit/langgraph/streaming/angular/src/environments/environment.ts

/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: 'https://stream-resource-streaming.langgraph.app',
  streamingAssistantId: 'streaming',
};
```

- [ ] **Step 3: Create development environment file**

```ts
// cockpit/langgraph/streaming/angular/src/environments/environment.development.ts

/**
 * Development environment configuration.
 *
 * Points to a local LangGraph server started with:
 *   cd cockpit/langgraph/streaming/python && langgraph dev
 */
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:8123',
  streamingAssistantId: 'streaming',
};
```

- [ ] **Step 4: Commit**

```bash
git add -A cockpit/langgraph/streaming/angular/src/app/streaming.service.ts cockpit/langgraph/streaming/angular/src/environments/
git commit -m "refactor(cockpit): remove StreamingService, add environment config"
```

---

### Task 2: Add stream-resource dependencies

**Files:**
- Modify: `cockpit/langgraph/streaming/angular/package.json`

- [ ] **Step 1: Update package.json with stream-resource and LangGraph deps**

```json
{
  "name": "cockpit-langgraph-streaming-angular",
  "version": "0.0.1",
  "private": true,
  "dependencies": {
    "@cacheplane/stream-resource": "^0.0.1",
    "@langchain/core": "^0.3.0",
    "@langchain/langgraph-sdk": "^0.0.36"
  }
}
```

- [ ] **Step 2: Run npm install**

Run: `npm install`

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/angular/package.json package-lock.json
git commit -m "chore(cockpit): add stream-resource and LangGraph SDK deps to Angular example"
```

---

### Task 3: Rewrite app.config.ts to use provideStreamResource

**Files:**
- Modify: `cockpit/langgraph/streaming/angular/src/app/app.config.ts`

- [ ] **Step 1: Replace app.config.ts**

```ts
// cockpit/langgraph/streaming/angular/src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideStreamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * Application configuration for the LangGraph Streaming demo.
 *
 * Uses `provideStreamResource()` to set the global LangGraph API URL.
 * All `streamResource()` calls in this app inherit this URL unless
 * overridden at the call site.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideStreamResource({
      apiUrl: environment.langGraphApiUrl,
    }),
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/langgraph/streaming/angular/src/app/app.config.ts
git commit -m "feat(cockpit): configure provideStreamResource in Angular app"
```

---

### Task 4: Rewrite StreamingComponent to use streamResource()

**Files:**
- Modify: `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts`

- [ ] **Step 1: Replace streaming.component.ts with streamResource-based implementation**

```ts
// cockpit/langgraph/streaming/angular/src/app/streaming.component.ts
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { streamResource, ResourceStatus } from '@cacheplane/stream-resource';
import type { BaseMessage } from '@langchain/core/messages';
import { environment } from '../environments/environment';

/**
 * StreamingComponent demonstrates real-time LLM streaming with `streamResource()`.
 *
 * This standalone Angular component provides a chat interface that sends
 * messages to a LangGraph backend deployed on LangSmith Cloud. The response
 * streams in token-by-token, updating the UI reactively via Angular Signals.
 *
 * Key integration points:
 * - `streamResource()` creates a Signal-based streaming ref
 * - `stream.messages()` provides reactive access to the conversation
 * - `stream.submit()` fires a message to the LangGraph backend
 * - `stream.isLoading()` tracks whether a response is in progress
 * - No manual subscriptions — the template binds directly to Signals
 */
@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="chat-container">
      <div class="messages">
        @for (msg of stream.messages(); track $index) {
          <div [class]="'message message--' + msg.getType()">
            <span class="message__role">{{ msg.getType() }}</span>
            <p class="message__content">{{ msg.content }}</p>
          </div>
        }
      </div>
      <form class="input-bar" (ngSubmit)="send()">
        <input
          [(ngModel)]="prompt"
          name="prompt"
          placeholder="Type a message..."
          [disabled]="stream.isLoading()"
        />
        <button type="submit" [disabled]="stream.isLoading() || !prompt().trim()">
          {{ stream.isLoading() ? 'Streaming...' : 'Send' }}
        </button>
      </form>
      @if (stream.error()) {
        <p class="error">{{ stream.error() }}</p>
      }
    </div>
  `,
  styles: [`
    .chat-container {
      display: grid;
      grid-template-rows: 1fr auto;
      height: 100vh;
      max-width: 640px;
      margin: 0 auto;
      padding: 1rem;
      gap: 1rem;
    }
    .messages {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .message {
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
    }
    .message--human {
      background: rgba(125, 211, 252, 0.15);
      align-self: flex-end;
      max-width: 80%;
    }
    .message--ai {
      background: rgba(255, 255, 255, 0.05);
      align-self: flex-start;
      max-width: 80%;
    }
    .message__role {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.5;
    }
    .message__content {
      margin: 0.25rem 0 0;
      white-space: pre-wrap;
    }
    .input-bar {
      display: flex;
      gap: 0.5rem;
    }
    .input-bar input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 1px solid rgba(138, 170, 214, 0.18);
      border-radius: 0.5rem;
      background: rgba(15, 27, 45, 0.9);
      color: #edf3ff;
      font: inherit;
    }
    .input-bar button {
      padding: 0.75rem 1.5rem;
      border: 1px solid rgba(125, 211, 252, 0.35);
      border-radius: 0.5rem;
      background: linear-gradient(180deg, rgba(56, 189, 248, 0.28), rgba(56, 189, 248, 0.14));
      color: #edf3ff;
      font: inherit;
      cursor: pointer;
    }
    .input-bar button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error {
      color: #ff6b6b;
      font-size: 0.85rem;
    }
  `],
})
export class StreamingComponent {
  /**
   * The streaming resource ref — connects to the LangGraph Cloud backend.
   *
   * `streamResource()` must be called in an injection context (component
   * constructor or field initializer). It returns a ref with Signals for
   * messages, status, errors, and thread management.
   *
   * The `assistantId` maps to the graph name in `langgraph.json`.
   * The `apiUrl` is inherited from `provideStreamResource()` in app.config.ts.
   */
  protected readonly stream = streamResource({
    assistantId: environment.streamingAssistantId,
  });

  /** The current user input. Uses Angular's `signal()` for reactivity. */
  prompt = signal('');

  /**
   * Submits the user's message to the LangGraph streaming endpoint.
   *
   * Calls `stream.submit()` which opens a streaming connection to the
   * LangGraph backend. As tokens arrive, `stream.messages()` updates
   * reactively — the template re-renders automatically.
   *
   * The submit payload uses LangGraph's message format:
   * `{ messages: [{ role: 'human', content: '...' }] }`
   */
  send(): void {
    const text = this.prompt().trim();
    if (!text || this.stream.isLoading()) return;
    this.prompt.set('');
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
```

Key changes from the old component:
- Removed `StreamingService` import — `streamResource()` replaces it entirely
- Uses `@for` control flow instead of `*ngFor` (Angular 19+)
- Uses `@if` instead of `*ngIf`
- `prompt` is now a `signal()` instead of a plain string
- `stream.messages()` returns `BaseMessage[]` — uses `msg.getType()` for role
- Message CSS classes are `message--human` / `message--ai` (LangChain types)
- No manual subscribe — template binds directly to Signals
- Error display via `stream.error()`

- [ ] **Step 2: Commit**

```bash
git add cockpit/langgraph/streaming/angular/src/app/streaming.component.ts
git commit -m "feat(cockpit): rewrite StreamingComponent to use streamResource()"
```

---

### Task 5: Update capability module codeAssetPaths

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/index.ts`

- [ ] **Step 1: Remove streaming.service.ts from codeAssetPaths (it was deleted)**

Read the file. The `codeAssetPaths` array currently includes `streaming.service.ts`. Remove it since the file no longer exists. The paths should be:

```ts
codeAssetPaths: [
  'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts',
  'cockpit/langgraph/streaming/angular/src/app/app.config.ts',
],
```

Note: `streaming.service.ts` is removed. `app.config.ts` is added because it shows `provideStreamResource()` — important for developers to see.

- [ ] **Step 2: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/index.ts
git commit -m "fix(cockpit): update codeAssetPaths after StreamingService removal"
```

---

### Task 6: Create LangGraph deployment GitHub Action

**Files:**
- Create: `.github/workflows/deploy-langgraph.yml`

- [ ] **Step 1: Create the workflow**

```yaml
# .github/workflows/deploy-langgraph.yml
name: Deploy LangGraph

on:
  push:
    branches: [main]
    paths:
      - 'cockpit/**/python/**'
  workflow_dispatch:
    inputs:
      capability:
        description: 'Capability path (e.g., langgraph/streaming)'
        required: false
        type: string

jobs:
  deploy:
    name: Deploy to LangGraph Cloud
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - name: langgraph-streaming
            path: cockpit/langgraph/streaming/python
    steps:
      - uses: actions/checkout@v6.0.2

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install langgraph-cli
        run: pip install langgraph-cli

      - name: Deploy ${{ matrix.name }}
        if: |
          github.event_name == 'workflow_dispatch' && (inputs.capability == '' || inputs.capability == 'langgraph/streaming')
          || github.event_name == 'push'
        working-directory: ${{ matrix.path }}
        run: langgraph deploy
        env:
          LANGSMITH_API_KEY: ${{ secrets.LANGSMITH_API_KEY }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy-langgraph.yml
git commit -m "ci: add LangGraph Cloud deployment workflow"
```

---

### Task 7: Run cockpit tests and fix any breakage

**Files:**
- Possibly modify: test files if codeAssetPaths changes cause failures

- [ ] **Step 1: Run full cockpit test suite**

Run: `npx nx test cockpit -- --run --reporter=verbose`

- [ ] **Step 2: Fix any failures**

The `codeAssetPaths` changed (removed `streaming.service.ts`, added `app.config.ts`). Tests that assert on the specific asset paths from `getCapabilityPresentation()` may need updating.

- [ ] **Step 3: Run tests again**

Run: `npx nx test cockpit -- --run --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 4: Commit any fixes**

```bash
git add apps/cockpit/src
git commit -m "test(cockpit): update tests for streamResource migration"
```
