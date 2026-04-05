# Cockpit Chat Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update cockpit capability examples to consume `@cacheplane/chat` components, validating the library's API against real LangGraph and Deep Agent use cases.

**Architecture:** Each capability example is a standalone Angular app with its own backend and LangSmith deployment. Examples import `@cacheplane/chat` and `@cacheplane/stream-resource`. The cockpit (React/Next.js) embeds them via the existing embed strategy.

**Tech Stack:** Angular 21+, `@cacheplane/chat`, `@cacheplane/stream-resource`, Nx 22

**Spec:** `docs/superpowers/specs/2026-04-04-chat-component-library-design.md` — Deliverable 3

**Depends on:** `@cacheplane/chat` must be built first (Plan: `2026-04-04-cacheplane-chat.md`)

---

## File Structure

Each cockpit capability example follows the same pattern. New Angular examples are added alongside existing Python examples:

```
cockpit/
├── langgraph/
│   ├── streaming/angular/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── app.component.ts       # Uses <chat>
│   │   │   │   └── app.config.ts          # provideStreamResource + provideChat
│   │   │   ├── main.ts
│   │   │   └── index.html
│   │   ├── package.json
│   │   └── project.json
│   ├── persistence/angular/               # Uses <chat> + <chat-thread-list>
│   ├── interrupts/angular/                # Uses <chat> + <chat-interrupt-panel>
│   ├── memory/angular/                    # Uses <chat> + <chat-thread-list>
│   ├── time-travel/angular/               # Uses <chat> + <chat-timeline-slider>
│   ├── subgraphs/angular/                 # Uses <chat> + <chat-subagent-card>
│   ├── durable-execution/angular/         # Uses <chat> + <chat-error>
│   └── deployment-runtime/angular/        # Uses <chat>
└── deep-agents/
    ├── planning/angular/                  # Uses <chat-debug>
    ├── filesystem/angular/                # Uses <chat-debug>
    ├── subagents/angular/                 # Uses <chat-debug>
    ├── memory/angular/                    # Uses <chat-debug>
    ├── skills/angular/                    # Uses <chat-debug>
    └── sandboxes/angular/                 # Uses <chat-debug>
```

---

### Task 1: Streaming Capability Example

**Files:**
- Create: `cockpit/langgraph/streaming/angular/src/app/app.component.ts`
- Create: `cockpit/langgraph/streaming/angular/src/app/app.config.ts`
- Create: `cockpit/langgraph/streaming/angular/src/main.ts`
- Create: `cockpit/langgraph/streaming/angular/package.json`
- Create: `cockpit/langgraph/streaming/angular/project.json`

This is the reference example — all others follow this pattern.

- [ ] **Step 1: Create app.config.ts**

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ApplicationConfig } from '@angular/core';
import { provideStreamResource } from '@cacheplane/stream-resource';
import { provideChat } from '@cacheplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStreamResource({
      apiUrl: 'http://localhost:2024',
    }),
    provideChat({}),
  ],
};
```

- [ ] **Step 2: Create app.component.ts**

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, inject, Injector, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { streamResource } from '@cacheplane/stream-resource';
import { ChatComponent } from '@cacheplane/chat';
import type { BaseMessage } from '@langchain/core/messages';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="h-screen">
      <chat [ref]="chat" />
    </div>
  `,
})
export class AppComponent implements OnInit {
  private readonly injector = inject(Injector);
  chat!: ReturnType<typeof streamResource>;

  ngOnInit() {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource<{ messages: BaseMessage[] }>({
        assistantId: 'chat_agent',
      });
    });
  }
}
```

- [ ] **Step 3: Create main.ts and package.json**

Standard Angular bootstrap + package.json with peer deps on `@cacheplane/chat` and `@cacheplane/stream-resource`.

- [ ] **Step 4: Verify example builds**

Run: `npx nx build cockpit-langgraph-streaming-angular`

- [ ] **Step 5: Commit**

```bash
git add cockpit/langgraph/streaming/angular/
git commit -m "feat(cockpit): add streaming capability Angular example with @cacheplane/chat"
```

---

### Task 2: Persistence Capability Example

- [ ] **Step 1: Create app using `<chat>` with thread list**

Uses `ChatComponent` + `ChatMessagesComponent` with `ChatThreadList` primitive for thread persistence. Stores thread ID in localStorage via `onThreadId` callback.

- [ ] **Step 2: Commit**

---

### Task 3: Interrupts Capability Example

- [ ] **Step 1: Create app using `<chat>` with interrupt panel**

Uses `ChatComponent` + `ChatInterruptPanelComponent` for human-in-the-loop interrupt handling. Demonstrates accept/edit/respond/ignore actions.

- [ ] **Step 2: Commit**

---

### Task 4: Time Travel Capability Example

- [ ] **Step 1: Create app using `<chat>` with timeline**

Uses `ChatComponent` + `ChatTimelineComponent` for checkpoint navigation. Demonstrates `setBranch()` for forking.

- [ ] **Step 2: Commit**

---

### Task 5: Subgraphs Capability Example

- [ ] **Step 1: Create app using `<chat>` with subagent cards**

Uses `ChatComponent` + `ChatSubagentsComponent` + `ChatSubagentCardComponent` for nested agent visualization.

- [ ] **Step 2: Commit**

---

### Task 6: Deep Agents Planning Example

- [ ] **Step 1: Create app using `<chat-debug>`**

Uses `ChatDebugComponent` as the primary UI for deep agent debugging. Full debug panel with timeline, state inspector, state diff.

- [ ] **Step 2: Commit**

---

### Task 7: Remaining Deep Agent Examples

Repeat the `<chat-debug>` pattern for: filesystem, subagents, memory, skills, sandboxes.

- [ ] **Step 1: Create all remaining deep agent examples**
- [ ] **Step 2: Commit**

---

### Task 8: Update Cockpit Manifest

- [ ] **Step 1: Add Angular entries to manifest**

Update `libs/cockpit-registry/src/lib/manifest.ts` to include Angular language entries for each capability.

- [ ] **Step 2: Verify manifest validates**
- [ ] **Step 3: Commit**

---

### Task 9: Integration Verification

- [ ] **Step 1: Build all cockpit examples**

Run: `npx nx run-many -t build --projects='cockpit-*-angular'`

- [ ] **Step 2: Run cockpit with embedded Angular examples**

Verify each example renders correctly in the cockpit shell.

- [ ] **Step 3: Commit any fixes**

---

## Summary

| Task | Capability | Primary Components |
|------|-----------|-------------------|
| 1 | streaming | `<chat>` |
| 2 | persistence | `<chat>` + thread list |
| 3 | interrupts | `<chat>` + interrupt panel |
| 4 | time-travel | `<chat>` + timeline |
| 5 | subgraphs | `<chat>` + subagent cards |
| 6 | deep-agents/planning | `<chat-debug>` |
| 7 | deep-agents/* (remaining) | `<chat-debug>` |
| 8 | manifest update | Registry config |
| 9 | integration verification | Full build |
