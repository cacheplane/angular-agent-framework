# LangGraph Capability Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all 8 LangGraph capability examples with Angular apps, Python backends, tutorial docs, and e2e tests — plus a shared `@cacheplane/chat` Angular component library.

**Architecture:** Each capability follows the established streaming example pattern: Angular standalone component using `agent()`, Python LangGraph `StateGraph`, tutorial guide.md with component tags, Playwright e2e tests. The `@cacheplane/chat` library extracts the shared chat UI. All capabilities register in `route-resolution.ts` for cockpit rendering.

**Tech Stack:** Angular 21, `@cacheplane/angular`, `@cacheplane/chat` (new), LangGraph (Python), Shiki, Playwright, Vitest

---

## Phase Overview

| Phase | Task | Deliverable |
|-------|------|-------------|
| 1 | Task 1 | `@cacheplane/chat` — shared Angular chat component library |
| 2 | Task 2 | Persistence example (thread switching, conversation history) |
| 3 | Task 3 | Interrupts example (human-in-the-loop approval) |
| 4 | Task 4 | Memory example (cross-thread persistent context) |
| 5 | Task 5 | Durable Execution example (fault tolerance, retry) |
| 6 | Task 6 | Subgraphs example (nested agent delegation) |
| 7 | Task 7 | Time Travel example (replay, branching) |
| 8 | Task 8 | Deployment Runtime example (production patterns) |
| 9 | Task 9 | Wire all modules into cockpit route-resolution |
| 10 | Task 10 | Migrate streaming example to use @cacheplane/chat |
| 11 | Task 11 | Full test suite + CI verification |

---

### Task 1: Create @cacheplane/chat Angular library

**Files:**
- Create: `libs/chat/project.json`
- Create: `libs/chat/package.json`
- Create: `libs/chat/ng-package.json`
- Create: `libs/chat/tsconfig.json`
- Create: `libs/chat/tsconfig.lib.json`
- Create: `libs/chat/src/index.ts`
- Create: `libs/chat/src/lib/chat.component.ts`
- Create: `libs/chat/src/lib/chat-message.component.ts`
- Create: `libs/chat/src/lib/chat-input.component.ts`
- Create: `libs/chat/src/lib/chat.types.ts`
- Modify: `tsconfig.base.json` (add `@cacheplane/chat` path)

- [ ] **Step 1: Scaffold the Angular library**

Create `libs/chat/project.json` following the `libs/angular/project.json` pattern but for an Angular library:

```json
{
  "name": "chat",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/chat/src",
  "projectType": "library",
  "tags": ["scope:shared", "type:lib"],
  "targets": {
    "build": {
      "executor": "@nx/angular:package",
      "outputs": ["{workspaceRoot}/dist/libs/chat"],
      "options": {
        "project": "libs/chat/ng-package.json"
      }
    }
  }
}
```

`libs/chat/package.json`:
```json
{
  "name": "@cacheplane/chat",
  "version": "0.0.1",
  "license": "PolyForm-Noncommercial-1.0.0",
  "peerDependencies": {
    "@angular/core": "^21.0.0",
    "@angular/common": "^21.0.0",
    "@angular/forms": "^21.0.0"
  }
}
```

`libs/chat/ng-package.json`:
```json
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/libs/chat",
  "lib": {
    "entryFile": "src/index.ts"
  }
}
```

`libs/chat/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "experimentalDecorators": true
  }
}
```

`libs/chat/tsconfig.lib.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

Add to `tsconfig.base.json` paths: `"@cacheplane/chat": ["libs/chat/src/index.ts"]`

- [ ] **Step 2: Create the chat component**

`libs/chat/src/lib/chat.types.ts`:
```ts
export interface ChatMessage {
  type: 'human' | 'ai';
  content: string;
}
```

`libs/chat/src/lib/chat-message.component.ts`:
```ts
import { Component, Input } from '@angular/core';

/**
 * Renders a single chat message bubble.
 * Human messages align right with accent background.
 * AI messages align left with subtle background.
 */
@Component({
  selector: 'cp-chat-message',
  standalone: true,
  template: `
    <div [class]="'cp-message cp-message--' + type">
      <span class="cp-message__role">{{ type }}</span>
      <p class="cp-message__content">{{ content }}</p>
    </div>
  `,
  styles: [`
    .cp-message { padding: 0.75rem 1rem; border-radius: 0.5rem; max-width: 80%; }
    .cp-message--human { background: rgba(0, 64, 144, 0.1); align-self: flex-end; }
    .cp-message--ai { background: rgba(0, 0, 0, 0.03); align-self: flex-start; }
    .cp-message__role { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.5; }
    .cp-message__content { margin: 0.25rem 0 0; white-space: pre-wrap; }
  `],
})
export class ChatMessageComponent {
  @Input({ required: true }) type!: 'human' | 'ai';
  @Input({ required: true }) content!: string;
}
```

`libs/chat/src/lib/chat-input.component.ts`:
```ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Chat input bar with text field and send button.
 * Emits sendMessage when the user submits.
 */
@Component({
  selector: 'cp-chat-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="cp-input" (ngSubmit)="onSend()">
      <input [(ngModel)]="text" name="prompt" [placeholder]="placeholder" [disabled]="disabled" />
      <button type="submit" [disabled]="disabled || !text.trim()">
        {{ disabled ? 'Streaming...' : 'Send' }}
      </button>
    </form>
  `,
  styles: [`
    .cp-input { display: flex; gap: 0.5rem; }
    .cp-input input { flex: 1; padding: 0.75rem 1rem; border: 1px solid rgba(0,64,144,0.15); border-radius: 0.5rem; background: rgba(255,255,255,0.7); color: #1a1a2e; font: inherit; }
    .cp-input button { padding: 0.75rem 1.5rem; border: 1px solid rgba(0,64,144,0.2); border-radius: 0.5rem; background: #004090; color: #fff; font: inherit; cursor: pointer; }
    .cp-input button:disabled { opacity: 0.5; cursor: not-allowed; }
  `],
})
export class ChatInputComponent {
  @Input() placeholder = 'Type a message...';
  @Input() disabled = false;
  @Output() sendMessage = new EventEmitter<string>();

  text = '';

  onSend(): void {
    const msg = this.text.trim();
    if (!msg || this.disabled) return;
    this.sendMessage.emit(msg);
    this.text = '';
  }
}
```

`libs/chat/src/lib/chat.component.ts`:
```ts
import { Component, Input, Output, EventEmitter, ContentChild, TemplateRef } from '@angular/core';
import { ChatMessageComponent } from './chat-message.component';
import { ChatInputComponent } from './chat-input.component';

/**
 * Headful chat component for angular demos.
 *
 * Renders a message list, input bar, and optional sidebar.
 * Used by all LangGraph cockpit examples.
 *
 * @example
 * ```html
 * <cp-chat
 *   [messages]="stream.messages()"
 *   [isLoading]="stream.isLoading()"
 *   [error]="stream.error()"
 *   (sendMessage)="stream.submit({ messages: [{ role: 'human', content: $event }] })">
 * </cp-chat>
 * ```
 */
@Component({
  selector: 'cp-chat',
  standalone: true,
  imports: [ChatMessageComponent, ChatInputComponent],
  template: `
    <div class="cp-chat">
      <div class="cp-chat__main">
        <div class="cp-chat__messages">
          @for (msg of messages; track $index) {
            <cp-chat-message [type]="msg.type" [content]="msg.content" />
          }
        </div>
        @if (error) {
          <p class="cp-chat__error">{{ error }}</p>
        }
        <cp-chat-input [disabled]="isLoading" (sendMessage)="sendMessage.emit($event)" />
      </div>
      @if (sidebarTemplate) {
        <aside class="cp-chat__sidebar">
          <ng-container [ngTemplateOutlet]="sidebarTemplate" />
        </aside>
      }
    </div>
  `,
  styles: [`
    .cp-chat { display: grid; grid-template-columns: 1fr; gap: 1rem; height: 100%; }
    .cp-chat:has(.cp-chat__sidebar) { grid-template-columns: 1fr 280px; }
    .cp-chat__main { display: grid; grid-template-rows: 1fr auto; gap: 1rem; max-width: 640px; margin: 0 auto; padding: 1rem; height: 100%; }
    .cp-chat__messages { overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; }
    .cp-chat__error { color: #ef4444; font-size: 0.85rem; }
    .cp-chat__sidebar { padding: 1rem; border-left: 1px solid rgba(0,64,144,0.1); overflow-y: auto; }
    @media (max-width: 768px) { .cp-chat:has(.cp-chat__sidebar) { grid-template-columns: 1fr; } .cp-chat__sidebar { border-left: none; border-top: 1px solid rgba(0,64,144,0.1); } }
  `],
})
export class ChatComponent {
  @Input() messages: Array<{ type: string; content: string }> = [];
  @Input() isLoading = false;
  @Input() error: unknown = null;
  @Output() sendMessage = new EventEmitter<string>();
  @ContentChild('sidebar') sidebarTemplate?: TemplateRef<unknown>;
}
```

`libs/chat/src/index.ts`:
```ts
export { ChatComponent } from './lib/chat.component';
export { ChatMessageComponent } from './lib/chat-message.component';
export { ChatInputComponent } from './lib/chat-input.component';
export type { ChatMessage } from './lib/chat.types';
```

- [ ] **Step 3: Commit**

```bash
git add libs/chat/ tsconfig.base.json
git commit -m "feat(chat): create @cacheplane/chat Angular component library"
```

---

### Task 2: Build Persistence example

This is the first full example after Streaming. It demonstrates `stream.switchThread()` and `stream.history()`.

**Files to create** (follow the streaming example directory structure exactly):

#### Angular app: `cockpit/langgraph/persistence/angular/`
- `project.json` — same pattern as streaming, port 4301
- `package.json` — deps: `@cacheplane/angular`, `@cacheplane/chat`, `@langchain/core`, `@langchain/langgraph-sdk`
- `tsconfig.json`, `tsconfig.app.json` — same as streaming
- `proxy.conf.json` — proxy /api to localhost:8124
- `src/index.html`, `src/main.ts`, `src/styles.css` — same pattern
- `src/environments/environment.ts` — apiUrl: `http://localhost:4301/api`
- `src/environments/environment.development.ts` — same
- `src/app/app.config.ts` — `provideAgent({ apiUrl })`
- `src/app/persistence.component.ts` — Uses `ChatComponent` from `@cacheplane/chat` with a thread picker sidebar

#### Python backend: `cockpit/langgraph/persistence/python/`
- `pyproject.toml` — same deps as streaming
- `langgraph.json` — graph name: "persistence"
- `.env` → symlink to root `.env`
- `.gitignore` — same as streaming
- `src/graph.py` — LangGraph StateGraph with `MemorySaver` checkpointer
- `prompts/persistence.md` — system prompt about persistence

#### Docs + Module:
- `docs/guide.md` — Tutorial with Steps, code blocks, callouts
- `src/index.ts` — Updated module with real asset paths, devPort: 4301

#### E2E:
- `e2e/persistence.spec.ts` — Playwright test

- [ ] **Step 1: Create all files following the exact streaming example pattern**

The persistence component uses `@cacheplane/chat` with a sidebar showing thread history:

```typescript
@Component({
  selector: 'app-persistence',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)">
      <ng-template #sidebar>
        <h3 style="font-size: 0.8rem; font-weight: 600; margin-bottom: 0.5rem;">Threads</h3>
        @for (id of threadIds; track id) {
          <button (click)="stream.switchThread(id)"
                  [style.color]="id === currentThreadId ? '#004090' : '#555770'"
                  style="display: block; width: 100%; text-align: left; padding: 4px 8px; border: none; background: none; cursor: pointer; font-size: 0.8rem; border-radius: 4px;">
            {{ id.substring(0, 8) }}...
          </button>
        }
        <button (click)="newThread()" style="margin-top: 0.5rem; padding: 4px 8px; border: 1px solid rgba(0,64,144,0.15); border-radius: 4px; background: none; cursor: pointer; font-size: 0.75rem; color: #004090;">
          + New Thread
        </button>
      </ng-template>
    </cp-chat>
  `,
})
export class PersistenceComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
    onThreadId: (id) => {
      this.currentThreadId = id;
      if (!this.threadIds.includes(id)) this.threadIds.push(id);
    },
  });

  threadIds: string[] = [];
  currentThreadId = '';

  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }

  newThread(): void {
    this.stream.switchThread(null);
    this.currentThreadId = '';
  }
}
```

The Python graph uses `MemorySaver` (in-memory checkpointer for dev):
```python
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI

checkpointer = MemorySaver()

def build_persistence_graph():
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        response = await llm.ainvoke(state["messages"])
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)
    return graph.compile(checkpointer=checkpointer)

graph = build_persistence_graph()
```

- [ ] **Step 2: Run e2e test**

```bash
npx playwright test cockpit/langgraph/persistence/angular/e2e/persistence.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/persistence/
git commit -m "feat(cockpit): add Persistence example (thread switching, conversation history)"
```

---

### Tasks 3-8: Remaining capabilities

Each follows the EXACT same pattern as Task 2. The only differences per capability are:

| Task | Capability | Port | Graph Pattern | Component Extension |
|------|-----------|------|---------------|-------------------|
| 3 | Interrupts | 4302 | `interrupt()` + approval node | Interrupt dialog overlay |
| 4 | Memory | 4303 | `InMemoryStore` + store read/write | Memory sidebar panel |
| 5 | Durable Execution | 4304 | `RetryPolicy` + checkpointer | Status timeline + retry |
| 6 | Subgraphs | 4305 | Parent graph + child subgraph | Subagent activity panel |
| 7 | Time Travel | 4306 | Checkpointer + checkpoint querying | History/branch selector |
| 8 | Deployment Runtime | 4307 | Standard graph + deployment config | Deployment info panel |

For each task, the subagent must:
1. Create the full directory structure (angular/ + python/ files)
2. Implement the component using `@cacheplane/chat` with a capability-specific sidebar
3. Implement the Python graph with the correct LangGraph pattern
4. Write the tutorial guide.md
5. Write the Playwright e2e test
6. Update the capability module's `src/index.ts` with real asset paths
7. Commit

**IMPORTANT**: Each subagent gets the FULL task description with all file contents — do NOT reference "similar to Task 2". Each task must be self-contained.

---

### Task 9: Wire all modules into cockpit route-resolution

**Files:**
- Modify: `apps/cockpit/src/lib/route-resolution.ts`

- [ ] **Step 1: Import all 8 capability modules and register them**

Add imports for all 7 new modules (streaming is already imported):

```ts
import { langgraphStreamingPythonModule } from '@cacheplane/cockpit-registry'; // or from the capability module
import { langgraphPersistencePythonModule } from '../../../../cockpit/langgraph/persistence/python/src/index';
import { langgraphInterruptsPythonModule } from '../../../../cockpit/langgraph/interrupts/python/src/index';
import { langgraphMemoryPythonModule } from '../../../../cockpit/langgraph/memory/python/src/index';
import { langgraphDurableExecutionPythonModule } from '../../../../cockpit/langgraph/durable-execution/python/src/index';
import { langgraphSubgraphsPythonModule } from '../../../../cockpit/langgraph/subgraphs/python/src/index';
import { langgraphTimeTravelPythonModule } from '../../../../cockpit/langgraph/time-travel/python/src/index';
import { langgraphDeploymentRuntimePythonModule } from '../../../../cockpit/langgraph/deployment-runtime/python/src/index';

const capabilityModules = [
  langgraphStreamingPythonModule,
  langgraphPersistencePythonModule,
  langgraphInterruptsPythonModule,
  langgraphMemoryPythonModule,
  langgraphDurableExecutionPythonModule,
  langgraphSubgraphsPythonModule,
  langgraphTimeTravelPythonModule,
  langgraphDeploymentRuntimePythonModule,
];
```

- [ ] **Step 2: Run cockpit tests**

Run: `npx nx test cockpit -- --run`

- [ ] **Step 3: Build cockpit**

Run: `npx nx build cockpit --skip-nx-cache`

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/lib/route-resolution.ts
git commit -m "feat(cockpit): register all 8 LangGraph capability modules"
```

---

### Task 10: Migrate streaming example to @cacheplane/chat

**Files:**
- Modify: `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts`
- Modify: `cockpit/langgraph/streaming/angular/package.json`

- [ ] **Step 1: Replace inline chat UI with ChatComponent**

Add `@cacheplane/chat` to the streaming package.json deps. Rewrite the component to use `<cp-chat>` instead of the inline template. Remove the ~100 lines of inline styles.

- [ ] **Step 2: Run streaming e2e test**

```bash
npx playwright test cockpit/langgraph/streaming/angular/e2e/streaming.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/angular/
git commit -m "refactor(cockpit): migrate streaming example to @cacheplane/chat"
```

---

### Task 11: Full test suite + CI verification

- [ ] **Step 1: Run all cockpit unit tests**

```bash
npx nx test cockpit -- --run --reporter=verbose
```

- [ ] **Step 2: Build cockpit**

```bash
npx nx build cockpit --skip-nx-cache
```

- [ ] **Step 3: Run all capability e2e tests** (requires backends running)

For each capability that has a running backend:
```bash
npx playwright test cockpit/langgraph/*/angular/e2e/*.spec.ts
```

- [ ] **Step 4: Push**

```bash
git push
```

---

## Subagent Execution Notes

When dispatching subagents for Tasks 2-8 (capability examples), each subagent needs:

1. **The complete streaming example** as a reference pattern (all file contents)
2. **The capability-specific details** from the research (graph pattern, agent features, component extension)
3. **The port assignment** and capability name
4. **The guide.md template** following the streaming guide's component tag structure

Each subagent should:
- Create ALL files for the capability (angular/ + python/ + docs + e2e)
- Follow the streaming example's exact directory structure
- Use the `@cacheplane/chat` ChatComponent
- Write a real Python graph (not a stub)
- Write a real guide.md with Steps, code blocks, callouts
- Write a Playwright e2e test that sends a message and checks for a response
- Commit with a descriptive message

Tasks 2-8 can be dispatched **sequentially** (each builds on patterns from the previous) or **in parallel** (each is independent). Sequential is safer for the first pass.
