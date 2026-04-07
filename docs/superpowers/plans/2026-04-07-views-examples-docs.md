# Views Examples & Docs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update cockpit examples to demonstrate the `views()` API with inline generative UI, and add docs for the views system to the website.

**Architecture:** Each example that has tool calls or structured state gets view components registered via `views()`. The custom sidebars remain as secondary UI — the primary display moves inline. Docs go in the existing multi-library docs structure at `apps/website/content/docs-v2/`.

**Tech Stack:** Angular 20+, `@cacheplane/chat`, `@cacheplane/render`, Tailwind CSS v4

**Parallelism:** Tasks 1-5 (examples) are independent. Task 6 (docs) depends on examples being done for accurate code samples.

---

## File Structure

### Modified files (5 examples getting view components)

| Task | Example | View Components |
|------|---------|----------------|
| 1 | skills | CalculatorResultComponent, WordCountResultComponent |
| 2 | filesystem | FilePreviewComponent |
| 3 | sandboxes | CodeExecutionComponent |
| 4 | interrupts | ApprovalCardComponent |
| 5 | durable-execution | StepPipelineComponent |

### New docs files
| Task | File |
|------|------|
| 6 | `apps/website/content/docs-v2/render/views.mdx` |

---

## Task 1: Skills — Tool Result Views

**Files:**
- Create: `cockpit/deep-agents/skills/angular/src/app/views/calculator-result.component.ts`
- Create: `cockpit/deep-agents/skills/angular/src/app/views/word-count-result.component.ts`
- Modify: `cockpit/deep-agents/skills/angular/src/app/skills.component.ts`

- [ ] **Step 1: Create CalculatorResultComponent**

```typescript
// cockpit/deep-agents/skills/angular/src/app/views/calculator-result.component.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'calculator-result',
  standalone: true,
  template: `
    <div class="border rounded-lg p-3 my-2 inline-flex items-center gap-3"
         style="border-color: var(--chat-border); background: var(--chat-bg-alt);">
      <span class="text-xs font-mono px-2 py-0.5 rounded"
            style="background: var(--chat-success); color: white;">calculator</span>
      <span class="font-mono text-sm" style="color: var(--chat-text-muted);">{{ expression() }}</span>
      <span class="text-sm font-semibold" style="color: var(--chat-text);">= {{ result() }}</span>
    </div>
  `,
})
export class CalculatorResultComponent {
  readonly expression = input<string>('');
  readonly result = input<string>('');
}
```

- [ ] **Step 2: Create WordCountResultComponent**

```typescript
// cockpit/deep-agents/skills/angular/src/app/views/word-count-result.component.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'word-count-result',
  standalone: true,
  template: `
    <div class="border rounded-lg p-3 my-2 inline-flex items-center gap-3"
         style="border-color: var(--chat-border); background: var(--chat-bg-alt);">
      <span class="text-xs font-mono px-2 py-0.5 rounded"
            style="background: var(--chat-warning-text); color: white;">word_count</span>
      <span class="text-sm" style="color: var(--chat-text);">{{ count() }} words</span>
    </div>
  `,
})
export class WordCountResultComponent {
  readonly count = input<string>('');
  readonly text = input<string>('');
}
```

- [ ] **Step 3: Update SkillsComponent to register views**

Read the current file first, then update to import `views` from `@cacheplane/chat` and `signalStateStore` from `@cacheplane/render`, register the view components, and pass `[views]` and `[store]` to `<chat>`. Keep the existing sidebar.

```typescript
import { views } from '@cacheplane/chat';
import { signalStateStore } from '@cacheplane/render';
import { CalculatorResultComponent } from './views/calculator-result.component';
import { WordCountResultComponent } from './views/word-count-result.component';

// In class:
readonly ui = views({
  'calculator-result': CalculatorResultComponent,
  'word-count-result': WordCountResultComponent,
});
readonly uiStore = signalStateStore({});

// In template, update <chat> tag:
// <chat [ref]="stream" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
```

- [ ] **Step 4: Build to verify**

```bash
npx nx build cockpit-deep-agents-skills-angular
```

- [ ] **Step 5: Commit**

```bash
git add cockpit/deep-agents/skills/angular/src/app/
git commit -m "feat(cockpit): add tool result views to skills example"
```

---

## Task 2: Filesystem — File Preview View

**Files:**
- Create: `cockpit/deep-agents/filesystem/angular/src/app/views/file-preview.component.ts`
- Modify: `cockpit/deep-agents/filesystem/angular/src/app/filesystem.component.ts`

- [ ] **Step 1: Create FilePreviewComponent**

```typescript
// cockpit/deep-agents/filesystem/angular/src/app/views/file-preview.component.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'file-preview',
  standalone: true,
  template: `
    <div class="border rounded-lg overflow-hidden my-2"
         style="border-color: var(--chat-border);">
      <div class="flex items-center justify-between px-3 py-1.5 text-xs"
           style="background: var(--chat-bg-alt); border-bottom: 1px solid var(--chat-border);">
        <span class="font-mono" style="color: var(--chat-text);">{{ path() }}</span>
        <span style="color: var(--chat-text-muted);">{{ size() }}</span>
      </div>
      <pre class="px-3 py-2 m-0 text-xs font-mono overflow-x-auto"
           style="color: var(--chat-text); background: var(--chat-bg);">{{ content() }}</pre>
    </div>
  `,
})
export class FilePreviewComponent {
  readonly path = input<string>('');
  readonly content = input<string>('');
  readonly size = input<string>('');
}
```

- [ ] **Step 2: Update FilesystemComponent**

Read the current file, then add views registration alongside existing sidebar:

```typescript
import { views } from '@cacheplane/chat';
import { signalStateStore } from '@cacheplane/render';
import { FilePreviewComponent } from './views/file-preview.component';

readonly ui = views({ 'file-preview': FilePreviewComponent });
readonly uiStore = signalStateStore({});

// Update <chat> tag: <chat [ref]="stream" [views]="ui" [store]="uiStore" class="flex-1 min-w-0" />
```

- [ ] **Step 3: Build and commit**

```bash
npx nx build cockpit-deep-agents-filesystem-angular
git add cockpit/deep-agents/filesystem/angular/src/app/
git commit -m "feat(cockpit): add file preview view to filesystem example"
```

---

## Task 3: Sandboxes — Code Execution View

**Files:**
- Create: `cockpit/deep-agents/sandboxes/angular/src/app/views/code-execution.component.ts`
- Modify: `cockpit/deep-agents/sandboxes/angular/src/app/sandboxes.component.ts`

- [ ] **Step 1: Create CodeExecutionComponent**

```typescript
// cockpit/deep-agents/sandboxes/angular/src/app/views/code-execution.component.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'code-execution',
  standalone: true,
  template: `
    <div class="border rounded-lg overflow-hidden my-2"
         style="border-color: var(--chat-border);">
      <div class="px-3 py-1.5 text-[10px] font-semibold uppercase"
           style="background: var(--chat-bg-alt); color: var(--chat-text-muted); border-bottom: 1px solid var(--chat-border);">
        Code Execution
      </div>
      <pre class="px-3 py-2 m-0 text-xs font-mono overflow-x-auto"
           style="color: var(--chat-text); background: var(--chat-bg);">{{ code() }}</pre>
      @if (stdout()) {
        <div style="border-top: 1px solid var(--chat-border);">
          <div class="px-3 py-1 text-[10px] font-semibold uppercase" style="color: var(--chat-success);">stdout</div>
          <pre class="px-3 py-1 m-0 text-xs font-mono" style="color: var(--chat-success);">{{ stdout() }}</pre>
        </div>
      }
      @if (stderr()) {
        <div style="border-top: 1px solid var(--chat-border);">
          <div class="px-3 py-1 text-[10px] font-semibold uppercase" style="color: var(--chat-error-text);">stderr</div>
          <pre class="px-3 py-1 m-0 text-xs font-mono" style="color: var(--chat-error-text);">{{ stderr() }}</pre>
        </div>
      }
    </div>
  `,
})
export class CodeExecutionComponent {
  readonly code = input<string>('');
  readonly stdout = input<string>('');
  readonly stderr = input<string>('');
}
```

- [ ] **Step 2: Update SandboxesComponent with views registration, build, commit**

Same pattern as Tasks 1-2. Register `'code-execution': CodeExecutionComponent` via `views()`.

```bash
npx nx build cockpit-deep-agents-sandboxes-angular
git add cockpit/deep-agents/sandboxes/angular/src/app/
git commit -m "feat(cockpit): add code execution view to sandboxes example"
```

---

## Task 4: Interrupts — Approval Card View

**Files:**
- Create: `cockpit/langgraph/interrupts/angular/src/app/views/approval-card.component.ts`
- Modify: `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts`

- [ ] **Step 1: Create ApprovalCardComponent**

```typescript
// cockpit/langgraph/interrupts/angular/src/app/views/approval-card.component.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'approval-card',
  standalone: true,
  template: `
    <div class="border rounded-lg p-4 my-2"
         style="border-color: var(--chat-border); background: var(--chat-bg-alt);">
      <div class="text-xs font-semibold uppercase mb-2" style="color: var(--chat-warning-text);">
        Requires Approval
      </div>
      <p class="text-sm mb-3" style="color: var(--chat-text);">{{ description() }}</p>
      <div class="flex gap-2">
        <button class="px-3 py-1.5 text-xs font-medium rounded border-0 cursor-pointer"
                style="background: var(--chat-success); color: white;"
                (click)="emit()('approve')">Approve</button>
        <button class="px-3 py-1.5 text-xs font-medium rounded border cursor-pointer"
                style="background: var(--chat-bg); color: var(--chat-text); border-color: var(--chat-border);"
                (click)="emit()('edit')">Edit</button>
        <button class="px-3 py-1.5 text-xs rounded border-0 cursor-pointer"
                style="background: transparent; color: var(--chat-text-muted);"
                (click)="emit()('cancel')">Cancel</button>
      </div>
    </div>
  `,
})
export class ApprovalCardComponent {
  readonly description = input<string>('');
  readonly emit = input<(event: string) => void>(() => {});
}
```

- [ ] **Step 2: Update InterruptsComponent with views registration, build, commit**

```bash
npx nx build cockpit-langgraph-interrupts-angular
git add cockpit/langgraph/interrupts/angular/src/app/
git commit -m "feat(cockpit): add approval card view to interrupts example"
```

---

## Task 5: Durable Execution — Step Pipeline View

**Files:**
- Create: `cockpit/langgraph/durable-execution/angular/src/app/views/step-pipeline.component.ts`
- Modify: `cockpit/langgraph/durable-execution/angular/src/app/durable-execution.component.ts`

- [ ] **Step 1: Create StepPipelineComponent**

```typescript
// cockpit/langgraph/durable-execution/angular/src/app/views/step-pipeline.component.ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'step-pipeline',
  standalone: true,
  template: `
    <div class="border rounded-lg p-3 my-2"
         style="border-color: var(--chat-border); background: var(--chat-bg-alt);">
      <div class="text-xs font-semibold uppercase mb-2" style="color: var(--chat-text-muted);">Pipeline Progress</div>
      <div class="flex items-center gap-2">
        @for (step of steps(); track $index) {
          <div class="flex items-center gap-1.5">
            @if (step.status === 'complete') {
              <div class="w-5 h-5 rounded-full flex items-center justify-center"
                   style="background: var(--chat-success);">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2.5"><path d="M2.5 6L5 8.5L9.5 3.5"/></svg>
              </div>
            } @else if (step.status === 'active') {
              <div class="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                   style="border-color: var(--chat-warning-text); border-top-color: transparent;"></div>
            } @else {
              <div class="w-5 h-5 rounded-full" style="background: var(--chat-bg-hover);"></div>
            }
            <span class="text-xs" [style.color]="step.status === 'pending' ? 'var(--chat-text-muted)' : 'var(--chat-text)'"
                  [style.fontWeight]="step.status === 'active' ? '500' : '400'">{{ step.label }}</span>
          </div>
          @if ($index < steps().length - 1) {
            <div class="w-4 h-0.5" [style.background]="step.status === 'complete' ? 'var(--chat-success)' : 'var(--chat-border)'"></div>
          }
        }
      </div>
    </div>
  `,
})
export class StepPipelineComponent {
  readonly steps = input<Array<{ label: string; status: 'pending' | 'active' | 'complete' }>>([]);
}
```

- [ ] **Step 2: Update DurableExecutionComponent with views registration, build, commit**

```bash
npx nx build cockpit-langgraph-durable-execution-angular
git add cockpit/langgraph/durable-execution/angular/src/app/
git commit -m "feat(cockpit): add step pipeline view to durable-execution example"
```

---

## Task 6: Views Documentation

**Files:**
- Create: `apps/website/content/docs-v2/render/views.mdx`

- [ ] **Step 1: Create views documentation page**

```mdx
---
title: Views
description: Expose Angular components to the agent for generative UI rendering
---

# Views

Views are Angular components that the agent can render inline in the chat. Register views with the `views()` function, and the agent produces JSON specs that render as interactive UI.

## Quick Start

```typescript
import { views } from '@cacheplane/render';
import { ChatComponent } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';

const ui = views({
  'plan-checklist': PlanChecklistComponent,
  'file-preview': FilePreviewComponent,
});

@Component({
  template: `<chat [ref]="stream" [views]="ui" />`,
  imports: [ChatComponent],
})
export class MyComponent {
  stream = agent({ apiUrl: '/api', assistantId: 'my-agent' });
  ui = ui;
}
```

## API

### `views(map)`

Creates an immutable view registry from a name → component map.

```typescript
const ui = views({
  'calculator': CalculatorComponent,
  'chart': ChartComponent,
});
```

### `withViews(base, additions)`

Adds views without overwriting existing entries.

```typescript
const extended = withViews(base, {
  'new-widget': NewWidgetComponent,
});
```

### `withoutViews(base, ...names)`

Removes views by name.

```typescript
const restricted = withoutViews(base, 'dangerous-widget');
```

### `provideViews(registry)`

Provides views globally via Angular DI.

```typescript
// app.config.ts
providers: [provideViews(ui)]
```

## Composition

Compose registries via object spread:

```typescript
import { thirdPartyViews } from '@acme/agent-ui';

const all = views({
  ...thirdPartyViews,   // third-party views
  ...myViews,           // your views
  'chart': MyChart,     // override specific entries
});
```

## How It Works

1. Register views with `views()`
2. Pass to `<chat [views]="ui" />`
3. Agent produces a JSON spec with `ui` field in tool results or state
4. Chat detects the spec and renders via `<render-spec>`
5. Views receive props as Angular `input()` signals
```

- [ ] **Step 2: Build website to verify**

```bash
npx nx build website
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs-v2/render/views.mdx
git commit -m "docs(website): add views API documentation"
```

---

## Task 7: Build All + Final Verification

- [ ] **Step 1: Run all tests**

```bash
npx nx test render && npx nx test chat
```

- [ ] **Step 2: Build all cockpit examples**

```bash
npx nx run-many -t build --projects='cockpit-*-angular'
```

- [ ] **Step 3: Commit any fixes**
