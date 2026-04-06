# Cockpit Examples Validation & Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement capability-specific sidebars for all 9 incomplete cockpit examples, validating that the chat and stream-resource libraries fully support every LangGraph and Deep Agent capability. Each example is a minimal, isolated Angular app that uses the libs — changes discovered here feed back into the libs.

**Architecture:** Each example follows the pattern: `streamResource()` → `<chat [ref]="stream">` + custom sidebar derived from `stream.value()` or `stream.messages()`. Sidebars are built directly in each example's component using Tailwind classes and the chat theme CSS vars. No new library components needed — the sidebars are example-specific UI, not reusable primitives.

**Tech Stack:** Angular 20+, `@cacheplane/chat`, `@cacheplane/stream-resource`, Tailwind CSS v4

**Parallelism:** Tasks 1-4 (LangGraph examples) are independent. Tasks 5-8 (Deep Agent examples) are independent. All can run in parallel within their group.

**Verification:** Each task ends with `npx nx build <project>` to verify the example compiles. Full E2E testing requires running the Python backend, which is out of scope — the focus is on Angular compilation and correct library usage.

---

## File Structure

Each task modifies ONE file — the example's main component. All sidebar UI is co-located in the component (small, focused, example-specific).

### Modified files (9 examples needing sidebars)

| Task | File | Sidebar Feature |
|------|------|----------------|
| 1 | `cockpit/langgraph/persistence/angular/src/app/persistence.component.ts` | Thread picker list |
| 2 | `cockpit/langgraph/time-travel/angular/src/app/time-travel.component.ts` | Checkpoint timeline |
| 3 | `cockpit/langgraph/durable-execution/angular/src/app/durable-execution.component.ts` | Step progress pipeline |
| 4 | `cockpit/deep-agents/planning/angular/src/app/planning.component.ts` | Plan step checklist |
| 5 | `cockpit/deep-agents/filesystem/angular/src/app/filesystem.component.ts` | File operations log |
| 6 | `cockpit/deep-agents/subagents/angular/src/app/subagents.component.ts` | Delegation tracker |
| 7 | `cockpit/deep-agents/memory/angular/src/app/memory.component.ts` | Learned facts sidebar |
| 8 | `cockpit/deep-agents/skills/angular/src/app/skills.component.ts` | Skill invocations log |
| 9 | `cockpit/deep-agents/sandboxes/angular/src/app/sandboxes.component.ts` | Execution output log |

### Already complete (5 examples — verify only)
- `cockpit/langgraph/streaming/angular/` — basic streaming ✓
- `cockpit/langgraph/interrupts/angular/` — interrupt panel ✓
- `cockpit/langgraph/memory/angular/` — facts sidebar ✓
- `cockpit/langgraph/subgraphs/angular/` — subagent sidebar ✓
- `cockpit/langgraph/deployment-runtime/angular/` — production config ✓

---

## Shared Sidebar Pattern

Every sidebar follows this template. Subagents should reference this when implementing:

```typescript
// Layout: chat (flex-1) + aside sidebar
template: `
  <div class="flex h-screen">
    <chat [ref]="stream" class="flex-1 min-w-0" />
    <aside
      class="w-72 border-l overflow-y-auto p-4 flex flex-col gap-3 shrink-0"
      style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
    >
      <h2
        class="text-[11px] font-semibold uppercase tracking-wider m-0"
        style="color: var(--chat-text-muted);"
      >Sidebar Title</h2>
      <!-- Sidebar content using computed() signals from stream.value() -->
    </aside>
  </div>
`
```

Key rules:
- Import `ChatComponent` from `@cacheplane/chat`
- Use `streamResource()` from `@cacheplane/stream-resource`
- Derive sidebar state with `computed()` from `stream.value()` or `stream.messages()`
- Use Tailwind + chat theme CSS vars for styling
- The `<chat>` component handles all message rendering, input, typing, errors internally

---

## Task 1: Persistence — Thread Picker Sidebar

**Files:**
- Modify: `cockpit/langgraph/persistence/angular/src/app/persistence.component.ts`

**Capability:** Thread-based conversation persistence. Users can create new threads and switch between them.

- [ ] **Step 1: Read the current component**

Read `cockpit/langgraph/persistence/angular/src/app/persistence.component.ts` to understand current state.

- [ ] **Step 2: Implement thread picker sidebar**

Replace the component with a layout that has chat + thread sidebar:

```typescript
import { Component, signal, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

interface ThreadEntry {
  id: string;
  createdAt: string;
}

@Component({
  selector: 'app-persistence',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat
        [ref]="stream"
        [threads]="threads()"
        [activeThreadId]="activeThreadId()"
        (threadSelected)="switchThread($event)"
        class="flex-1 min-w-0"
      />
      <aside
        class="w-56 border-l overflow-y-auto flex flex-col shrink-0"
        style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
      >
        <div class="p-3 border-b flex items-center justify-between" style="border-color: var(--chat-border);">
          <h2 class="text-[11px] font-semibold uppercase tracking-wider m-0" style="color: var(--chat-text-muted);">Threads</h2>
          <button
            class="text-xs px-2 py-1 rounded border-0 cursor-pointer"
            style="background: var(--chat-bg-hover); color: var(--chat-text);"
            (click)="newThread()"
          >+ New</button>
        </div>
        @for (thread of threadList(); track thread.id) {
          <button
            class="w-full text-left px-3 py-2 text-sm border-0 cursor-pointer transition-colors duration-150"
            [style.background]="thread.id === activeThreadId() ? 'var(--chat-bg-hover)' : 'transparent'"
            [style.color]="'var(--chat-text)'"
            [style.fontWeight]="thread.id === activeThreadId() ? '500' : '400'"
            (click)="switchThread(thread.id)"
          >
            <div class="truncate">{{ thread.id.substring(0, 8) }}...</div>
            <div class="text-[11px] mt-0.5" style="color: var(--chat-text-muted);">{{ thread.createdAt }}</div>
          </button>
        } @empty {
          <p class="text-xs p-3 m-0" style="color: var(--chat-text-muted);">No threads yet.</p>
        }
      </aside>
    </div>
  `,
})
export class PersistenceComponent {
  readonly activeThreadId = signal<string>('');
  readonly threadList = signal<ThreadEntry[]>([]);

  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.persistenceAssistantId,
    onThreadId: (id: string) => {
      this.activeThreadId.set(id);
      if (!this.threadList().find(t => t.id === id)) {
        this.threadList.update(list => [
          { id, createdAt: new Date().toLocaleTimeString() },
          ...list,
        ]);
      }
    },
  });

  readonly threads = computed(() =>
    this.threadList().map(t => ({ id: t.id }))
  );

  switchThread(threadId: string): void {
    this.activeThreadId.set(threadId);
    this.stream.switchThread(threadId);
  }

  newThread(): void {
    this.activeThreadId.set('');
    this.stream.switchThread(null);
  }
}
```

- [ ] **Step 3: Build to verify compilation**

```bash
npx nx build cockpit-langgraph-persistence-angular
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add cockpit/langgraph/persistence/angular/src/app/persistence.component.ts
git commit -m "feat(cockpit): add thread picker sidebar to persistence example"
```

---

## Task 2: Time-Travel — Checkpoint Timeline Sidebar

**Files:**
- Modify: `cockpit/langgraph/time-travel/angular/src/app/time-travel.component.ts`

**Capability:** Navigate conversation history checkpoints, replay or fork from any point.

- [ ] **Step 1: Read the current component**

Read `cockpit/langgraph/time-travel/angular/src/app/time-travel.component.ts`.

- [ ] **Step 2: Implement checkpoint timeline sidebar**

```typescript
import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-time-travel',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside
        class="w-72 border-l overflow-y-auto flex flex-col shrink-0"
        style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
      >
        <div class="p-3 border-b" style="border-color: var(--chat-border);">
          <h2 class="text-[11px] font-semibold uppercase tracking-wider m-0" style="color: var(--chat-text-muted);">
            Timeline ({{ checkpoints().length }})
          </h2>
        </div>
        @for (cp of checkpoints(); track $index; let i = $index) {
          <div
            class="px-3 py-2 border-b flex items-start gap-2"
            style="border-color: var(--chat-border-light);"
          >
            <div
              class="w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold shrink-0 mt-0.5"
              style="background: var(--chat-bg-hover); color: var(--chat-text-muted);"
            >{{ i + 1 }}</div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium m-0 truncate" style="color: var(--chat-text);">
                Checkpoint {{ i + 1 }}
              </p>
              @if (cp.checkpoint?.checkpoint_id) {
                <p class="text-[11px] font-mono m-0 truncate" style="color: var(--chat-text-muted);">
                  {{ cp.checkpoint.checkpoint_id.substring(0, 12) }}...
                </p>
              }
              <div class="flex gap-1 mt-1">
                <button
                  class="text-[11px] px-1.5 py-0.5 rounded border-0 cursor-pointer"
                  style="background: var(--chat-bg-hover); color: var(--chat-text);"
                  (click)="replay(cp)"
                >Replay</button>
                <button
                  class="text-[11px] px-1.5 py-0.5 rounded border-0 cursor-pointer"
                  style="background: var(--chat-bg-hover); color: var(--chat-text);"
                  (click)="fork(cp)"
                >Fork</button>
              </div>
            </div>
          </div>
        } @empty {
          <p class="text-xs p-3 m-0" style="color: var(--chat-text-muted);">Send a message to create checkpoints.</p>
        }
      </aside>
    </div>
  `,
})
export class TimeTravelComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.timeTravelAssistantId,
  });

  readonly checkpoints = computed(() => this.stream.history());

  replay(state: any): void {
    if (state.checkpoint?.checkpoint_id) {
      this.stream.setBranch(state.checkpoint.checkpoint_id);
    }
  }

  fork(state: any): void {
    if (state.checkpoint?.checkpoint_id) {
      this.stream.setBranch(state.checkpoint.checkpoint_id);
    }
  }
}
```

- [ ] **Step 3: Build to verify**

```bash
npx nx build cockpit-langgraph-time-travel-angular
```

- [ ] **Step 4: Commit**

```bash
git add cockpit/langgraph/time-travel/angular/src/app/time-travel.component.ts
git commit -m "feat(cockpit): add checkpoint timeline sidebar to time-travel example"
```

---

## Task 3: Durable Execution — Step Progress Sidebar

**Files:**
- Modify: `cockpit/langgraph/durable-execution/angular/src/app/durable-execution.component.ts`

**Capability:** Multi-step pipeline (analyze → plan → generate) with checkpoint recovery.

- [ ] **Step 1: Read the current component**

Read `cockpit/langgraph/durable-execution/angular/src/app/durable-execution.component.ts`.

- [ ] **Step 2: Implement step progress sidebar**

```typescript
import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

const PIPELINE_STEPS = ['analyze', 'plan', 'generate'] as const;

@Component({
  selector: 'app-durable-execution',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside
        class="w-64 border-l overflow-y-auto flex flex-col shrink-0"
        style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
      >
        <div class="p-3 border-b" style="border-color: var(--chat-border);">
          <h2 class="text-[11px] font-semibold uppercase tracking-wider m-0" style="color: var(--chat-text-muted);">Pipeline</h2>
        </div>
        <div class="p-3 flex flex-col gap-2">
          @for (step of steps; track step) {
            <div class="flex items-center gap-2">
              <div
                class="w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold"
                [style.background]="stepStatus(step) === 'complete' ? 'var(--chat-success)' : stepStatus(step) === 'active' ? 'var(--chat-warning-text)' : 'var(--chat-bg-hover)'"
                [style.color]="stepStatus(step) === 'complete' || stepStatus(step) === 'active' ? '#fff' : 'var(--chat-text-muted)'"
              >
                @if (stepStatus(step) === 'complete') {
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2.5 6L5 8.5L9.5 3.5"/></svg>
                } @else {
                  {{ steps.indexOf(step) + 1 }}
                }
              </div>
              <span
                class="text-sm capitalize"
                [style.color]="stepStatus(step) === 'pending' ? 'var(--chat-text-muted)' : 'var(--chat-text)'"
                [style.fontWeight]="stepStatus(step) === 'active' ? '500' : '400'"
              >{{ step }}</span>
            </div>
            @if (steps.indexOf(step) < steps.length - 1) {
              <div class="w-0.5 h-3 ml-[9px]" style="background: var(--chat-border);"></div>
            }
          }
        </div>
        @if (stream.isLoading()) {
          <div class="px-3 pb-3">
            <p class="text-xs m-0" style="color: var(--chat-text-muted);">Processing...</p>
          </div>
        }
      </aside>
    </div>
  `,
})
export class DurableExecutionComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.durableExecutionAssistantId,
  });

  readonly steps = [...PIPELINE_STEPS];

  private readonly currentStep = computed(() => {
    const val = this.stream.value() as Record<string, unknown>;
    return (val?.['step'] as string) ?? '';
  });

  stepStatus(step: string): 'pending' | 'active' | 'complete' {
    const current = this.currentStep();
    if (!current) return 'pending';
    const currentIdx = this.steps.indexOf(current);
    const stepIdx = this.steps.indexOf(step);
    if (stepIdx < currentIdx) return 'complete';
    if (stepIdx === currentIdx) return this.stream.isLoading() ? 'active' : 'complete';
    return 'pending';
  }
}
```

- [ ] **Step 3: Build to verify**

```bash
npx nx build cockpit-langgraph-durable-execution-angular
```

- [ ] **Step 4: Commit**

```bash
git add cockpit/langgraph/durable-execution/angular/src/app/durable-execution.component.ts
git commit -m "feat(cockpit): add step progress sidebar to durable-execution example"
```

---

## Task 4: Planning — Plan Step Checklist Sidebar

**Files:**
- Modify: `cockpit/deep-agents/planning/angular/src/app/planning.component.ts`

**Capability:** Agent decomposes tasks into ordered steps, executes them sequentially.

- [ ] **Step 1: Read the current component**

Read `cockpit/deep-agents/planning/angular/src/app/planning.component.ts`.

- [ ] **Step 2: Implement plan checklist sidebar**

```typescript
import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

interface PlanStep {
  title: string;
  status: 'pending' | 'in_progress' | 'complete';
}

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside
        class="w-72 border-l overflow-y-auto flex flex-col shrink-0"
        style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
      >
        <div class="p-3 border-b" style="border-color: var(--chat-border);">
          <h2 class="text-[11px] font-semibold uppercase tracking-wider m-0" style="color: var(--chat-text-muted);">
            Plan ({{ planSteps().length }} steps)
          </h2>
        </div>
        <div class="p-3 flex flex-col gap-1.5">
          @for (step of planSteps(); track $index; let i = $index) {
            <div class="flex items-start gap-2 py-1">
              @if (step.status === 'complete') {
                <svg class="w-4 h-4 shrink-0 mt-0.5" style="color: var(--chat-success);" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8L6.5 11.5L13 4.5"/></svg>
              } @else if (step.status === 'in_progress') {
                <div class="w-4 h-4 shrink-0 mt-0.5 rounded-full border-2 border-t-transparent animate-spin" style="border-color: var(--chat-warning-text); border-top-color: transparent;"></div>
              } @else {
                <div class="w-4 h-4 shrink-0 mt-0.5 rounded-full border" style="border-color: var(--chat-border);"></div>
              }
              <span
                class="text-sm"
                [style.color]="step.status === 'pending' ? 'var(--chat-text-muted)' : 'var(--chat-text)'"
              >{{ step.title }}</span>
            </div>
          } @empty {
            <p class="text-xs m-0" style="color: var(--chat-text-muted);">Send a task to generate a plan.</p>
          }
        </div>
      </aside>
    </div>
  `,
})
export class PlanningComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.planningAssistantId,
  });

  readonly planSteps = computed((): PlanStep[] => {
    const val = this.stream.value() as Record<string, unknown>;
    const plan = val?.['plan'];
    if (!Array.isArray(plan)) return [];
    return plan.map((s: any) => ({
      title: s.title ?? s.description ?? String(s),
      status: s.status ?? 'pending',
    }));
  });
}
```

- [ ] **Step 3: Build to verify**

```bash
npx nx build cockpit-deep-agents-planning-angular
```

- [ ] **Step 4: Commit**

```bash
git add cockpit/deep-agents/planning/angular/src/app/planning.component.ts
git commit -m "feat(cockpit): add plan checklist sidebar to planning example"
```

---

## Task 5: Filesystem — File Operations Log Sidebar

**Files:**
- Modify: `cockpit/deep-agents/filesystem/angular/src/app/filesystem.component.ts`

**Capability:** Agent reads/writes files via tool calls.

- [ ] **Step 1: Read the current component**

Read `cockpit/deep-agents/filesystem/angular/src/app/filesystem.component.ts`.

- [ ] **Step 2: Implement file operations sidebar**

Derive file operations from `stream.messages()` by filtering for tool call messages with `read_file` or `write_file` names.

```typescript
import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

interface FileOp {
  operation: string;
  path: string;
  result: string;
}

@Component({
  selector: 'app-filesystem',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside
        class="w-72 border-l overflow-y-auto flex flex-col shrink-0"
        style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
      >
        <div class="p-3 border-b" style="border-color: var(--chat-border);">
          <h2 class="text-[11px] font-semibold uppercase tracking-wider m-0" style="color: var(--chat-text-muted);">File Operations</h2>
        </div>
        @for (op of fileOps(); track $index) {
          <div class="px-3 py-2 border-b" style="border-color: var(--chat-border-light);">
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-mono px-1 rounded" style="background: var(--chat-bg-hover); color: var(--chat-text-muted);">{{ op.operation }}</span>
              <span class="text-xs font-mono truncate" style="color: var(--chat-text);">{{ op.path }}</span>
            </div>
            @if (op.result) {
              <p class="text-[11px] font-mono mt-1 m-0 truncate" style="color: var(--chat-text-muted);">{{ op.result }}</p>
            }
          </div>
        } @empty {
          <p class="text-xs p-3 m-0" style="color: var(--chat-text-muted);">No file operations yet.</p>
        }
      </aside>
    </div>
  `,
})
export class FilesystemComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.filesystemAssistantId,
  });

  readonly fileOps = computed((): FileOp[] => {
    const messages = this.stream.messages();
    const ops: FileOp[] = [];
    for (const msg of messages) {
      const tc = (msg as any).tool_calls;
      if (Array.isArray(tc)) {
        for (const call of tc) {
          if (call.name === 'read_file' || call.name === 'write_file') {
            ops.push({
              operation: call.name.replace('_', ' '),
              path: call.args?.path ?? call.args?.file_path ?? '(unknown)',
              result: '',
            });
          }
        }
      }
      // Tool result messages have name + content
      if ((msg as any).type === 'tool' && (msg as any).name) {
        const lastOp = ops[ops.length - 1];
        if (lastOp) {
          lastOp.result = typeof (msg as any).content === 'string'
            ? (msg as any).content.substring(0, 100)
            : '';
        }
      }
    }
    return ops;
  });
}
```

- [ ] **Step 3: Build to verify**

```bash
npx nx build cockpit-deep-agents-filesystem-angular
```

- [ ] **Step 4: Commit**

```bash
git add cockpit/deep-agents/filesystem/angular/src/app/filesystem.component.ts
git commit -m "feat(cockpit): add file operations sidebar to filesystem example"
```

---

## Task 6: Subagents (DA) — Delegation Tracker Sidebar

**Files:**
- Modify: `cockpit/deep-agents/subagents/angular/src/app/subagents.component.ts`

**Capability:** Orchestrator delegates to specialist subagents.

- [ ] **Step 1: Read the current component**

Read `cockpit/deep-agents/subagents/angular/src/app/subagents.component.ts`.

- [ ] **Step 2: Implement delegation tracker sidebar**

```typescript
import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

interface Delegation {
  agent: string;
  status: string;
}

@Component({
  selector: 'app-subagents',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside
        class="w-72 border-l overflow-y-auto flex flex-col shrink-0"
        style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
      >
        <div class="p-3 border-b" style="border-color: var(--chat-border);">
          <h2 class="text-[11px] font-semibold uppercase tracking-wider m-0" style="color: var(--chat-text-muted);">Delegations</h2>
        </div>
        @for (d of delegations(); track $index) {
          <div class="px-3 py-2 border-b flex items-center gap-2" style="border-color: var(--chat-border-light);">
            <div
              class="w-2 h-2 rounded-full shrink-0"
              [style.background]="d.status === 'complete' ? 'var(--chat-success)' : d.status === 'error' ? 'var(--chat-error-text)' : 'var(--chat-warning-text)'"
            ></div>
            <div class="flex-1 min-w-0">
              <p class="text-sm m-0 font-medium truncate" style="color: var(--chat-text);">{{ d.agent }}</p>
              <p class="text-[11px] m-0 capitalize" style="color: var(--chat-text-muted);">{{ d.status }}</p>
            </div>
          </div>
        } @empty {
          <p class="text-xs p-3 m-0" style="color: var(--chat-text-muted);">No delegations yet.</p>
        }
      </aside>
    </div>
  `,
})
export class SubagentsComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.subagentsAssistantId,
  });

  readonly delegations = computed((): Delegation[] => {
    const messages = this.stream.messages();
    const delegations: Delegation[] = [];
    for (const msg of messages) {
      const tc = (msg as any).tool_calls;
      if (Array.isArray(tc)) {
        for (const call of tc) {
          delegations.push({
            agent: call.name?.replace(/_/g, ' ') ?? 'unknown',
            status: 'running',
          });
        }
      }
      if ((msg as any).type === 'tool') {
        const last = delegations[delegations.length - 1];
        if (last) last.status = 'complete';
      }
    }
    return delegations;
  });
}
```

- [ ] **Step 3: Build to verify**

```bash
npx nx build cockpit-deep-agents-subagents-angular
```

- [ ] **Step 4: Commit**

```bash
git add cockpit/deep-agents/subagents/angular/src/app/subagents.component.ts
git commit -m "feat(cockpit): add delegation tracker sidebar to subagents example"
```

---

## Task 7: Memory (DA) — Learned Facts Sidebar

**Files:**
- Modify: `cockpit/deep-agents/memory/angular/src/app/memory.component.ts`

**Capability:** Agent extracts and remembers facts from conversations.

- [ ] **Step 1: Read the current component**

Read `cockpit/deep-agents/memory/angular/src/app/memory.component.ts`.

- [ ] **Step 2: Implement learned facts sidebar**

Same pattern as the LangGraph memory example but using `agent_memory` state field:

```typescript
import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-memory',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside
        class="w-72 border-l overflow-y-auto flex flex-col shrink-0"
        style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
      >
        <div class="p-3 border-b" style="border-color: var(--chat-border);">
          <h2 class="text-[11px] font-semibold uppercase tracking-wider m-0" style="color: var(--chat-text-muted);">
            Learned Facts ({{ memoryEntries().length }})
          </h2>
        </div>
        @for (entry of memoryEntries(); track entry[0]) {
          <div class="px-3 py-2 border-b" style="border-color: var(--chat-border-light);">
            <p class="text-xs font-semibold m-0" style="color: var(--chat-text);">{{ entry[0] }}</p>
            <p class="text-xs mt-0.5 m-0" style="color: var(--chat-text-muted);">{{ entry[1] }}</p>
          </div>
        } @empty {
          <p class="text-xs p-3 m-0" style="color: var(--chat-text-muted);">No facts learned yet.</p>
        }
      </aside>
    </div>
  `,
})
export class MemoryComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.memoryAssistantId,
  });

  readonly memoryEntries = computed((): [string, string][] => {
    const val = this.stream.value() as Record<string, unknown>;
    const memory = val?.['agent_memory'] ?? val?.['memory'];
    if (!memory || typeof memory !== 'object') return [];
    return Object.entries(memory as Record<string, string>);
  });
}
```

- [ ] **Step 3: Build to verify**

```bash
npx nx build cockpit-deep-agents-memory-angular
```

- [ ] **Step 4: Commit**

```bash
git add cockpit/deep-agents/memory/angular/src/app/memory.component.ts
git commit -m "feat(cockpit): add learned facts sidebar to memory example"
```

---

## Task 8: Skills — Skill Invocations Log Sidebar

**Files:**
- Modify: `cockpit/deep-agents/skills/angular/src/app/skills.component.ts`

**Capability:** Agent uses multiple skills (calculator, word_count, summarize).

- [ ] **Step 1: Read the current component**

Read `cockpit/deep-agents/skills/angular/src/app/skills.component.ts`.

- [ ] **Step 2: Implement skill invocations sidebar**

```typescript
import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

interface SkillInvocation {
  name: string;
  input: string;
  output: string;
}

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside
        class="w-72 border-l overflow-y-auto flex flex-col shrink-0"
        style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
      >
        <div class="p-3 border-b" style="border-color: var(--chat-border);">
          <h2 class="text-[11px] font-semibold uppercase tracking-wider m-0" style="color: var(--chat-text-muted);">Skills Used</h2>
        </div>
        @for (skill of skillInvocations(); track $index) {
          <div class="px-3 py-2 border-b" style="border-color: var(--chat-border-light);">
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-mono px-1 rounded" style="background: var(--chat-bg-hover); color: var(--chat-text);">{{ skill.name }}</span>
            </div>
            <p class="text-[11px] font-mono mt-1 m-0" style="color: var(--chat-text-muted);">in: {{ skill.input }}</p>
            @if (skill.output) {
              <p class="text-[11px] font-mono m-0" style="color: var(--chat-text-muted);">out: {{ skill.output }}</p>
            }
          </div>
        } @empty {
          <p class="text-xs p-3 m-0" style="color: var(--chat-text-muted);">No skills invoked yet.</p>
        }
      </aside>
    </div>
  `,
})
export class SkillsComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.skillsAssistantId,
  });

  readonly skillInvocations = computed((): SkillInvocation[] => {
    const messages = this.stream.messages();
    const invocations: SkillInvocation[] = [];
    for (const msg of messages) {
      const tc = (msg as any).tool_calls;
      if (Array.isArray(tc)) {
        for (const call of tc) {
          invocations.push({
            name: call.name ?? 'unknown',
            input: JSON.stringify(call.args ?? {}).substring(0, 60),
            output: '',
          });
        }
      }
      if ((msg as any).type === 'tool') {
        const last = invocations[invocations.length - 1];
        if (last) {
          last.output = typeof (msg as any).content === 'string'
            ? (msg as any).content.substring(0, 60)
            : '';
        }
      }
    }
    return invocations;
  });
}
```

- [ ] **Step 3: Build to verify**

```bash
npx nx build cockpit-deep-agents-skills-angular
```

- [ ] **Step 4: Commit**

```bash
git add cockpit/deep-agents/skills/angular/src/app/skills.component.ts
git commit -m "feat(cockpit): add skill invocations sidebar to skills example"
```

---

## Task 9: Sandboxes — Execution Output Log Sidebar

**Files:**
- Modify: `cockpit/deep-agents/sandboxes/angular/src/app/sandboxes.component.ts`

**Capability:** Agent generates and executes Python code.

- [ ] **Step 1: Read the current component**

Read `cockpit/deep-agents/sandboxes/angular/src/app/sandboxes.component.ts`.

- [ ] **Step 2: Implement execution output sidebar**

```typescript
import { Component, computed } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

interface CodeExecution {
  code: string;
  stdout: string;
  stderr: string;
  exitStatus: number;
}

@Component({
  selector: 'app-sandboxes',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside
        class="w-80 border-l overflow-y-auto flex flex-col shrink-0"
        style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
      >
        <div class="p-3 border-b" style="border-color: var(--chat-border);">
          <h2 class="text-[11px] font-semibold uppercase tracking-wider m-0" style="color: var(--chat-text-muted);">Executions</h2>
        </div>
        @for (exec of executions(); track $index) {
          <div class="px-3 py-2 border-b" style="border-color: var(--chat-border-light);">
            <pre class="text-[11px] font-mono m-0 p-2 rounded overflow-x-auto whitespace-pre-wrap" style="background: var(--chat-bg); color: var(--chat-text);">{{ exec.code }}</pre>
            @if (exec.stdout) {
              <div class="mt-1">
                <span class="text-[10px] font-semibold uppercase" style="color: var(--chat-text-muted);">stdout</span>
                <pre class="text-[11px] font-mono m-0 mt-0.5 p-1.5 rounded" style="background: var(--chat-bg); color: var(--chat-success);">{{ exec.stdout }}</pre>
              </div>
            }
            @if (exec.stderr) {
              <div class="mt-1">
                <span class="text-[10px] font-semibold uppercase" style="color: var(--chat-text-muted);">stderr</span>
                <pre class="text-[11px] font-mono m-0 mt-0.5 p-1.5 rounded" style="background: var(--chat-error-bg); color: var(--chat-error-text);">{{ exec.stderr }}</pre>
              </div>
            }
          </div>
        } @empty {
          <p class="text-xs p-3 m-0" style="color: var(--chat-text-muted);">No code executed yet.</p>
        }
      </aside>
    </div>
  `,
})
export class SandboxesComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.sandboxesAssistantId,
  });

  readonly executions = computed((): CodeExecution[] => {
    const messages = this.stream.messages();
    const execs: CodeExecution[] = [];
    for (const msg of messages) {
      const tc = (msg as any).tool_calls;
      if (Array.isArray(tc)) {
        for (const call of tc) {
          if (call.name === 'run_code') {
            execs.push({
              code: call.args?.code ?? '',
              stdout: '',
              stderr: '',
              exitStatus: 0,
            });
          }
        }
      }
      if ((msg as any).type === 'tool' && (msg as any).name === 'run_code') {
        const last = execs[execs.length - 1];
        if (last) {
          try {
            const result = JSON.parse((msg as any).content);
            last.stdout = result.stdout ?? '';
            last.stderr = result.stderr ?? '';
            last.exitStatus = result.exit_status ?? 0;
          } catch {
            last.stdout = typeof (msg as any).content === 'string' ? (msg as any).content : '';
          }
        }
      }
    }
    return execs;
  });
}
```

- [ ] **Step 3: Build to verify**

```bash
npx nx build cockpit-deep-agents-sandboxes-angular
```

- [ ] **Step 4: Commit**

```bash
git add cockpit/deep-agents/sandboxes/angular/src/app/sandboxes.component.ts
git commit -m "feat(cockpit): add execution output sidebar to sandboxes example"
```

---

## Task 10: Build All & Final Verification

- [ ] **Step 1: Build all 14 cockpit examples**

```bash
npx nx run-many -t build --projects='cockpit-*-angular'
```

Expected: All 14 examples build successfully.

- [ ] **Step 2: Run library tests**

```bash
npx nx test chat && npx nx test render && npx nx test stream-resource
```

Expected: All tests pass.

- [ ] **Step 3: Commit any final fixes**

If any builds fail, fix the compilation errors and commit.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(cockpit): complete sidebar implementations for all 14 capability examples"
```
