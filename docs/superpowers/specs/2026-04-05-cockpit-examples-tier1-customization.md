# Cockpit Examples Tier 1 Customization

**Date:** 2026-04-05
**Status:** Draft
**Scope:** Customize 8 cockpit Angular examples using existing @cacheplane/chat components. No new library features needed.

---

## Overview

Tier 1 covers examples that work with existing `@cacheplane/chat` and `@cacheplane/stream-resource` APIs. Each gets a capability-specific component that goes beyond the generic `<chat [ref]>` to showcase what makes that capability unique.

## Tier Breakdown (for reference)

- **Tier 1 (this spec):** persistence, deployment-runtime, + 6 deep-agents (planning, filesystem, subagents, memory, skills, sandboxes)
- **Tier 2 (next):** memory (LG), subgraphs, interrupts — need custom sidebar content via template overrides
- **Tier 3 (later):** time-travel, durable-execution — need new library features

## Example Specifications

### 1. Persistence (`cockpit/langgraph/persistence/angular`)

**What it demonstrates:** Thread-based conversation persistence. Resume conversations by thread ID.

**Component:** Uses `<chat>` with thread management inputs.

```typescript
@Component({
  selector: 'app-persistence',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <chat
      [ref]="stream"
      [threads]="threads()"
      [activeThreadId]="activeThreadId()"
      (threadSelected)="onThreadSelected($event)"
      class="block h-screen"
    />
  `,
})
export class PersistenceComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
    threadId: null,  // auto-create
    onThreadId: (id) => this.trackThread(id),
  });

  protected readonly threads = signal<Thread[]>([]);
  protected readonly activeThreadId = signal<string>('');

  private trackThread(id: string): void {
    this.activeThreadId.set(id);
    // Add to thread list if new
    if (!this.threads().find(t => t.id === id)) {
      this.threads.update(list => [...list, { id }]);
    }
  }

  protected onThreadSelected(id: string): void {
    this.activeThreadId.set(id);
    this.stream.switchThread(id);
  }
}
```

**Key signals:** `stream.switchThread()`, `onThreadId` callback, `[threads]` input on `<chat>`.

---

### 2. Deployment Runtime (`cockpit/langgraph/deployment-runtime/angular`)

**What it demonstrates:** Production deployment config — different assistant ID, environment-based URL.

**Component:** Uses `<chat>` with no extras. The differentiation is in `environment.ts` pointing to a deployed endpoint.

```typescript
@Component({
  selector: 'app-deployment-runtime',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="stream" class="block h-screen" />`,
})
export class DeploymentRuntimeComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.deploymentRuntimeAssistantId,
  });
}
```

Minimal — same as streaming but with deployment-specific environment config.

---

### 3. Planning (`cockpit/deep-agents/planning/angular`)

**What it demonstrates:** Task decomposition — agent creates a plan with steps, then executes them.

**Component:** Uses `<chat-debug>` plus a computed signal deriving plan steps from `stream.value()`.

```typescript
@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="flex h-screen">
      <chat-debug [ref]="stream" class="flex-1" />
      @if (planSteps().length > 0) {
        <aside class="w-72 border-l overflow-y-auto p-4 space-y-2"
               style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717);">
          <h3 class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--chat-text-muted, #777);">Plan</h3>
          @for (step of planSteps(); track $index) {
            <div class="flex items-center gap-2 text-sm" style="color: var(--chat-text, #e0e0e0);">
              <span [style.color]="step.status === 'complete' ? 'var(--chat-success, #4ade80)' : 'var(--chat-text-muted, #777)'">
                {{ step.status === 'complete' ? '✓' : '○' }}
              </span>
              <span [style.text-decoration]="step.status === 'complete' ? 'line-through' : 'none'">
                {{ step.title }}
              </span>
            </div>
          }
        </aside>
      }
    </div>
  `,
})
export class PlanningComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly planSteps = computed(() => {
    const val = this.stream.value() as Record<string, unknown>;
    const plan = val?.['plan'];
    return Array.isArray(plan) ? plan : [];
  });
}
```

---

### 4. Filesystem (`cockpit/deep-agents/filesystem/angular`)

**What it demonstrates:** File read/write tool calls.

**Component:** `<chat-debug>` plus computed signal extracting tool calls from messages.

```typescript
// Same pattern as planning but derives file operations from stream.messages()
protected readonly fileOps = computed(() => {
  const messages = this.stream.messages();
  const ops: { name: string; path: string; status: string }[] = [];
  for (const msg of messages) {
    if ('tool_calls' in msg && Array.isArray((msg as any).tool_calls)) {
      for (const tc of (msg as any).tool_calls) {
        if (tc.name === 'read_file' || tc.name === 'write_file') {
          ops.push({ name: tc.name, path: tc.args?.path ?? '', status: 'done' });
        }
      }
    }
  }
  return ops;
});
```

Sidebar shows file operation log with read/write icons.

---

### 5. Subagents (`cockpit/deep-agents/subagents/angular`)

**What it demonstrates:** Orchestrator delegating to specialist subagents.

**Component:** `<chat-debug>` plus computed signal from `stream.subagents()` or tool calls.

```typescript
protected readonly subagentEntries = computed(() => {
  const messages = this.stream.messages();
  const entries: { name: string; status: string }[] = [];
  for (const msg of messages) {
    if ('tool_calls' in msg && Array.isArray((msg as any).tool_calls)) {
      for (const tc of (msg as any).tool_calls) {
        if (['research_agent', 'analysis_agent', 'summary_agent'].includes(tc.name)) {
          entries.push({ name: tc.name, status: 'done' });
        }
      }
    }
  }
  return entries;
});
```

Sidebar shows subagent delegation cards.

---

### 6. Memory (`cockpit/deep-agents/memory/angular`)

**What it demonstrates:** Persistent fact extraction across turns.

**Component:** `<chat-debug>` plus computed signal from `stream.value().agent_memory`.

```typescript
protected readonly memoryEntries = computed(() => {
  const val = this.stream.value() as Record<string, unknown>;
  const mem = val?.['agent_memory'];
  if (!mem || typeof mem !== 'object') return [];
  return Object.entries(mem as Record<string, string>);
});
```

Sidebar shows learned facts as key-value pairs.

---

### 7. Skills (`cockpit/deep-agents/skills/angular`)

**What it demonstrates:** Multi-skill tool selection (calculator, word_count, summarize).

**Component:** `<chat-debug>` plus computed signal extracting skill invocations from messages.

Same tool-call extraction pattern as filesystem, filtered for calculator/word_count/summarize.

---

### 8. Sandboxes (`cockpit/deep-agents/sandboxes/angular`)

**What it demonstrates:** Code execution via `run_code` tool.

**Component:** `<chat-debug>` plus computed signal extracting code execution results.

Sidebar shows execution logs with exit status badges and stdout output.

---

## Common Pattern

All 6 deep-agents examples follow the same structure:
1. `<chat-debug>` for the main chat + debug panel
2. An optional `<aside>` sidebar on the right showing capability-specific derived state
3. A `computed()` signal deriving the sidebar data from `stream.value()` or `stream.messages()`
4. Themed with CSS vars (same `var(--chat-*)` properties)

The 2 LangGraph examples (persistence, deployment-runtime) use `<chat>` directly with its existing inputs.
