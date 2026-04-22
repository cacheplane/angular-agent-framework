# Chat Decoupling Phase-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the chat-runtime decoupling by moving `ChatTimelineComponent`, `ChatTimelineSliderComponent`, and `ChatDebugComponent` back to `@cacheplane/chat` and retargeting them from `AgentRef` to a new `ChatAgentWithHistory` sub-contract.

**Architecture:** Add `ChatCheckpoint` + `ChatAgentWithHistory` to `@cacheplane/chat`. Widen `toChatAgent` return type and have it translate `ThreadState[]` → `ChatCheckpoint[]`. Move the three compositions back to chat, retargeting all `ref()` reads to the neutral sub-contract.

**Tech Stack:** Angular 21 (signals, zoneless-compatible), RxJS, Nx, Vitest, ng-packagr.

**Spec:** `docs/superpowers/specs/2026-04-21-chat-decoupling-phase-2-design.md`

---

## File Structure

### New in `@cacheplane/chat`

- `libs/chat/src/lib/agent/chat-checkpoint.ts` — `ChatCheckpoint` interface
- `libs/chat/src/lib/agent/chat-agent-with-history.ts` — `ChatAgentWithHistory` interface
- `libs/chat/src/lib/testing/chat-agent-with-history-conformance.ts` — conformance helper

### Moved into `@cacheplane/chat` (from `@cacheplane/langgraph`)

- `libs/chat/src/lib/primitives/chat-timeline/` (2 files)
- `libs/chat/src/lib/compositions/chat-timeline-slider/` (2 files)
- `libs/chat/src/lib/compositions/chat-debug/` (15 files)

### Modified in `@cacheplane/chat`

- `libs/chat/src/lib/agent/index.ts` — export new types
- `libs/chat/src/public-api.ts` — export new types + moved components
- `libs/chat/src/lib/testing/mock-chat-agent.ts` — add optional `history` option

### Modified in `@cacheplane/langgraph`

- `libs/langgraph/src/lib/to-chat-agent.ts` — widen return to `ChatAgentWithHistory`, translate history
- `libs/langgraph/src/lib/to-chat-agent.spec.ts` — add translation test
- `libs/langgraph/src/public-api.ts` — drop moved-out component exports

### Modified in cockpit

- `cockpit/chat/debug/angular/src/app/debug.component.ts` — `[ref]` → `[agent]`
- `cockpit/chat/timeline/angular/src/app/timeline.component.ts` — `[ref]` → `[agent]`

---

### Task 1: Add `ChatCheckpoint` + `ChatAgentWithHistory` types

**Files:**
- Create: `libs/chat/src/lib/agent/chat-checkpoint.ts`
- Create: `libs/chat/src/lib/agent/chat-agent-with-history.ts`
- Modify: `libs/chat/src/lib/agent/index.ts`
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Add `ChatCheckpoint`**

```ts
// libs/chat/src/lib/agent/chat-checkpoint.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Runtime-neutral snapshot of a point in an agent's execution history.
 *
 * Consumed by time-travel / debug UIs. `id` is adapter-opaque — UIs emit
 * it back to the parent app on replay/fork, and the parent app dispatches
 * to the underlying runtime.
 */
export interface ChatCheckpoint {
  /** Adapter-opaque checkpoint identifier (e.g. LangGraph checkpoint_id). */
  id?: string;
  /** Human-friendly label for the checkpoint (e.g. next node name). */
  label?: string;
  /** State snapshot at this checkpoint. */
  values: Record<string, unknown>;
}
```

- [ ] **Step 2: Add `ChatAgentWithHistory`**

```ts
// libs/chat/src/lib/agent/chat-agent-with-history.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Signal } from '@angular/core';
import type { ChatAgent } from './chat-agent';
import type { ChatCheckpoint } from './chat-checkpoint';

/**
 * Extends ChatAgent with a required `history` signal.
 *
 * Compositions that need time-travel / checkpoint data (chat-timeline,
 * chat-debug) take this richer contract. Adapters that cannot supply
 * history should return plain ChatAgent instead of stubbing an empty array.
 */
export interface ChatAgentWithHistory extends ChatAgent {
  history: Signal<ChatCheckpoint[]>;
}
```

- [ ] **Step 3: Re-export from `agent/index.ts`**

```ts
// libs/chat/src/lib/agent/index.ts — add:
export type { ChatCheckpoint } from './chat-checkpoint';
export type { ChatAgentWithHistory } from './chat-agent-with-history';
```

- [ ] **Step 4: Re-export from `public-api.ts`**

Add `ChatCheckpoint, ChatAgentWithHistory` to the existing `export type { ... } from './lib/agent';` block.

- [ ] **Step 5: Run chat lint + test + build**

```bash
npx nx run-many -t lint,test,build -p chat
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/agent/chat-checkpoint.ts \
        libs/chat/src/lib/agent/chat-agent-with-history.ts \
        libs/chat/src/lib/agent/index.ts \
        libs/chat/src/public-api.ts
git commit -m "feat(chat): add ChatAgentWithHistory sub-contract and ChatCheckpoint"
```

---

### Task 2: Extend `mockChatAgent` with optional `history`

**Files:**
- Modify: `libs/chat/src/lib/testing/mock-chat-agent.ts`
- Create: `libs/chat/src/lib/testing/mock-chat-agent.spec.ts` (if not present; else extend)

- [ ] **Step 1: Write failing test**

```ts
// libs/chat/src/lib/testing/mock-chat-agent.spec.ts — add:
import { describe, it, expect } from 'vitest';
import { mockChatAgent } from './mock-chat-agent';
import type { ChatAgentWithHistory } from '../agent';

describe('mockChatAgent with history', () => {
  it('exposes history signal when history option supplied', () => {
    const agent = mockChatAgent({ history: [{ id: 'c1', label: 'start', values: {} }] });
    const withHistory = agent as ChatAgentWithHistory;
    expect(typeof withHistory.history).toBe('function');
    expect(withHistory.history()).toEqual([{ id: 'c1', label: 'start', values: {} }]);
  });

  it('omits history when option absent', () => {
    const agent = mockChatAgent({});
    expect((agent as Partial<ChatAgentWithHistory>).history).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx nx test chat --testNamePattern="mockChatAgent with history"
```
Expected: FAIL (history option not yet accepted).

- [ ] **Step 3: Extend `MockChatAgentOptions` and `MockChatAgent`**

In `libs/chat/src/lib/testing/mock-chat-agent.ts`:

Imports — add `ChatCheckpoint`:
```ts
import type {
  ChatAgent, ChatMessage, ChatStatus, ChatToolCall,
  ChatInterrupt, ChatSubagent, ChatSubmitInput, ChatSubmitOptions,
  ChatCheckpoint,
} from '../agent';
```

Add to `MockChatAgent` interface:
```ts
  history?: WritableSignal<ChatCheckpoint[]>;
```

Add to `MockChatAgentOptions`:
```ts
  history?: ChatCheckpoint[];
```

In the `mockChatAgent` function body, after the `subagents` block:
```ts
  const history = opts.history
    ? signal<ChatCheckpoint[]>(opts.history)
    : undefined;
```

In the returned object spread:
```ts
    ...(history ? { history } : {}),
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx nx test chat --testNamePattern="mockChatAgent with history"
```
Expected: PASS.

- [ ] **Step 5: Run full chat test suite**

```bash
npx nx test chat
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/testing/mock-chat-agent.ts \
        libs/chat/src/lib/testing/mock-chat-agent.spec.ts
git commit -m "feat(chat): extend mockChatAgent with optional history"
```

---

### Task 3: Add `runChatAgentWithHistoryConformance` helper

**Files:**
- Create: `libs/chat/src/lib/testing/chat-agent-with-history-conformance.ts`
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Create conformance helper**

```ts
// libs/chat/src/lib/testing/chat-agent-with-history-conformance.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import type { ChatAgentWithHistory, ChatCheckpoint } from '../agent';
import { runChatAgentConformance } from './chat-agent-conformance';

/**
 * Conformance suite for ChatAgentWithHistory implementations.
 *
 * Runs the base ChatAgent conformance suite, then verifies the history
 * signal is present and returns an array of ChatCheckpoint-shaped entries.
 */
export function runChatAgentWithHistoryConformance(
  label: string,
  factory: (seed?: { history?: ChatCheckpoint[] }) => ChatAgentWithHistory,
): void {
  runChatAgentConformance(label, () => factory());

  describe(`${label} — history`, () => {
    it('exposes a history signal', () => {
      const agent = factory();
      expect(typeof agent.history).toBe('function');
      expect(Array.isArray(agent.history())).toBe(true);
    });

    it('reflects seeded checkpoints', () => {
      const seed: ChatCheckpoint[] = [
        { id: 'c1', label: 'Step 1', values: { foo: 1 } },
        { id: 'c2', label: 'Step 2', values: { foo: 2 } },
      ];
      const agent = factory({ history: seed });
      const entries = agent.history();
      expect(entries).toHaveLength(2);
      expect(entries[0].id).toBe('c1');
      expect(entries[1].values).toEqual({ foo: 2 });
    });
  });
}
```

- [ ] **Step 2: Export from public-api**

Add to `libs/chat/src/public-api.ts` (testing section):
```ts
export { runChatAgentWithHistoryConformance } from './lib/testing/chat-agent-with-history-conformance';
```

- [ ] **Step 3: Run chat build to verify exports typecheck**

```bash
npx nx build chat
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/testing/chat-agent-with-history-conformance.ts \
        libs/chat/src/public-api.ts
git commit -m "test(chat): add ChatAgentWithHistory conformance helper"
```

---

### Task 4: Widen `toChatAgent` return type + translate history

**Files:**
- Modify: `libs/langgraph/src/lib/to-chat-agent.ts`
- Modify: `libs/langgraph/src/lib/to-chat-agent.spec.ts`

- [ ] **Step 1: Write failing test**

Add to `libs/langgraph/src/lib/to-chat-agent.spec.ts` inside the existing describe block:

```ts
  it('translates ThreadState history into ChatCheckpoint[]', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({
        history: signal([
          { values: { step: 1 }, next: ['nodeA'], checkpoint: { checkpoint_id: 'ck1' } },
          { values: { step: 2 }, next: [],         checkpoint: { checkpoint_id: 'ck2' } },
          { values: { step: 3 }, next: ['nodeC'], checkpoint: undefined },
        ] as any),
      });
      const chat = toChatAgent(ref);
      expect(chat.history()).toEqual([
        { id: 'ck1', label: 'nodeA', values: { step: 1 } },
        { id: 'ck2', label: undefined, values: { step: 2 } },
        { id: undefined, label: 'nodeC', values: { step: 3 } },
      ]);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx nx test langgraph --testNamePattern="translates ThreadState history"
```
Expected: FAIL (`chat.history is not a function` or equivalent).

- [ ] **Step 3: Update `toChatAgent` implementation**

In `libs/langgraph/src/lib/to-chat-agent.ts`:

Update imports:
```ts
import type {
  ChatAgentWithHistory, ChatCheckpoint, ChatCustomEvent,
  ChatMessage, ChatRole, ChatStatus, ChatToolCall, ChatToolCallStatus,
  ChatInterrupt, ChatSubagent, ChatSubmitInput, ChatSubmitOptions,
} from '@cacheplane/chat';
```

Change signature:
```ts
export function toChatAgent<T>(ref: AgentRef<T, any>): ChatAgentWithHistory {
```

Inside the function, before `return {`, add:
```ts
  const history = computed<ChatCheckpoint[]>(() =>
    ref.history().map(toChatCheckpoint),
  );
```

Add `history` to the returned object:
```ts
  return {
    messages,
    status,
    isLoading: ref.isLoading,
    error:     ref.error,
    toolCalls,
    state,
    interrupt,
    subagents,
    customEvents$,
    history,
    submit: /* unchanged */,
    stop: /* unchanged */,
  };
```

At bottom of file, add:
```ts
function toChatCheckpoint(state: ThreadState<unknown>): ChatCheckpoint {
  return {
    id:    state.checkpoint?.checkpoint_id ?? undefined,
    label: state.next?.[0] ?? undefined,
    values: isRecord(state.values) ? state.values : {},
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
```

Import `ThreadState`:
```ts
import type { AgentRef, CustomStreamEvent, SubagentStreamRef, ThreadState } from './agent.types';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx nx test langgraph --testNamePattern="translates ThreadState history"
```
Expected: PASS.

- [ ] **Step 5: Run full langgraph test + build**

```bash
npx nx run-many -t lint,test,build -p langgraph
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/langgraph/src/lib/to-chat-agent.ts \
        libs/langgraph/src/lib/to-chat-agent.spec.ts
git commit -m "feat(langgraph): widen toChatAgent to ChatAgentWithHistory, translate history"
```

---

### Task 5: Move `chat-timeline` primitive to `@cacheplane/chat`

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-timeline/chat-timeline.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-timeline/chat-timeline.component.spec.ts`
- Delete: `libs/langgraph/src/lib/primitives/chat-timeline/chat-timeline.component.ts`
- Delete: `libs/langgraph/src/lib/primitives/chat-timeline/chat-timeline.component.spec.ts`
- Modify: `libs/chat/src/public-api.ts` — export `ChatTimelineComponent`
- Modify: `libs/langgraph/src/public-api.ts` — drop `ChatTimelineComponent`

- [ ] **Step 1: Write the new (runtime-neutral) chat-timeline test**

```ts
// libs/chat/src/lib/primitives/chat-timeline/chat-timeline.component.spec.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatTimelineComponent } from './chat-timeline.component';
import { mockChatAgent } from '../../testing/mock-chat-agent';

@Component({
  standalone: true,
  imports: [ChatTimelineComponent],
  template: `
    <chat-timeline [agent]="agent">
      <ng-template let-state let-i="index">{{ i }}:{{ state.label }}</ng-template>
    </chat-timeline>
  `,
})
class HostComponent {
  agent = mockChatAgent({
    history: [{ id: 'a', label: 'nodeA', values: {} }, { id: 'b', label: 'nodeB', values: {} }],
  }) as any;
}

describe('ChatTimelineComponent', () => {
  it('renders a template for each checkpoint', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent.replace(/\s+/g, '');
    expect(text).toBe('0:nodeA1:nodeB');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx nx test chat --testNamePattern="ChatTimelineComponent"
```
Expected: FAIL (component not in this lib yet).

- [ ] **Step 3: Create the retargeted component**

```ts
// libs/chat/src/lib/primitives/chat-timeline/chat-timeline.component.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component, computed, contentChild, input, output,
  TemplateRef, ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { ChatAgentWithHistory, ChatCheckpoint } from '../../agent';

@Component({
  selector: 'chat-timeline',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (cp of history(); track $index) {
      @if (templateRef()) {
        <ng-container
          [ngTemplateOutlet]="templateRef()!"
          [ngTemplateOutletContext]="{ $implicit: cp, index: $index }"
        />
      }
    }
  `,
})
export class ChatTimelineComponent {
  readonly agent = input.required<ChatAgentWithHistory>();

  readonly checkpointSelected = output<ChatCheckpoint>();

  readonly templateRef = contentChild(TemplateRef);

  readonly history = computed<ChatCheckpoint[]>(() => this.agent().history());

  selectCheckpoint(cp: ChatCheckpoint): void {
    this.checkpointSelected.emit(cp);
  }
}
```

- [ ] **Step 4: Delete old files in langgraph**

```bash
rm libs/langgraph/src/lib/primitives/chat-timeline/chat-timeline.component.ts \
   libs/langgraph/src/lib/primitives/chat-timeline/chat-timeline.component.spec.ts
rmdir libs/langgraph/src/lib/primitives/chat-timeline
rmdir libs/langgraph/src/lib/primitives  # if now empty
```

- [ ] **Step 5: Update public APIs**

In `libs/chat/src/public-api.ts`, add in the primitives section:
```ts
export { ChatTimelineComponent } from './lib/primitives/chat-timeline/chat-timeline.component';
```

In `libs/langgraph/src/public-api.ts`, remove the `ChatTimelineComponent` export.

- [ ] **Step 6: Run test to verify it passes**

```bash
npx nx test chat --testNamePattern="ChatTimelineComponent"
```
Expected: PASS.

- [ ] **Step 7: Build both libs**

```bash
npx nx run-many -t lint,test,build -p chat,langgraph
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-timeline/ \
        libs/chat/src/public-api.ts \
        libs/langgraph/src/public-api.ts
git add -u libs/langgraph/src/lib/primitives  # picks up deletions
git commit -m "refactor(chat,langgraph): move chat-timeline primitive to chat, retarget to ChatAgentWithHistory"
```

---

### Task 6: Move `chat-timeline-slider` composition to `@cacheplane/chat`

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-timeline-slider/chat-timeline-slider.component.ts`
- Create: `libs/chat/src/lib/compositions/chat-timeline-slider/chat-timeline-slider.component.spec.ts`
- Delete: `libs/langgraph/src/lib/compositions/chat-timeline-slider/*`
- Modify: `libs/chat/src/public-api.ts`, `libs/langgraph/src/public-api.ts`

- [ ] **Step 1: Write the new test**

```ts
// libs/chat/src/lib/compositions/chat-timeline-slider/chat-timeline-slider.component.spec.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { ChatTimelineSliderComponent } from './chat-timeline-slider.component';
import { mockChatAgent } from '../../testing/mock-chat-agent';

@Component({
  standalone: true,
  imports: [ChatTimelineSliderComponent],
  template: `<chat-timeline-slider [agent]="agent" (replayRequested)="lastReplay = $event" />`,
})
class HostComponent {
  agent = mockChatAgent({
    history: [
      { id: 'ck1', label: 'nodeA', values: {} },
      { id: 'ck2', label: 'nodeB', values: {} },
    ],
  }) as any;
  lastReplay: string | undefined;
  slider = viewChild.required(ChatTimelineSliderComponent);
}

describe('ChatTimelineSliderComponent', () => {
  it('lists each checkpoint', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('2 checkpoint');
    expect(text).toContain('ck1');
    expect(text).toContain('ck2');
  });

  it('emits replayRequested with checkpoint id', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.componentInstance.slider().replay({ id: 'ck2', values: {} } as any);
    expect(fixture.componentInstance.lastReplay).toBe('ck2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx nx test chat --testNamePattern="ChatTimelineSliderComponent"
```
Expected: FAIL (component missing).

- [ ] **Step 3: Create retargeted component**

```ts
// libs/chat/src/lib/compositions/chat-timeline-slider/chat-timeline-slider.component.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component, computed, input, output, signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { ChatAgentWithHistory, ChatCheckpoint } from '../../agent';

@Component({
  selector: 'chat-timeline-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-xs font-semibold text-[var(--chat-text-muted)] uppercase tracking-wide">Timeline</h3>
        <span class="text-xs text-[var(--chat-text-muted)]">{{ history().length }} checkpoint(s)</span>
      </div>

      @if (history().length === 0) {
        <p class="text-xs text-[var(--chat-text-muted)] text-center py-4">No checkpoints yet.</p>
      }

      <div class="space-y-1">
        @for (cp of history(); track $index; let i = $index) {
          <div
            class="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors"
            [class]="i === selectedIndex() ? 'border-[var(--chat-input-focus-border)] bg-[var(--chat-bg-hover)]' : 'border-[var(--chat-border)] bg-[var(--chat-bg)] hover:bg-[var(--chat-bg-hover)]'"
          >
            <span
              class="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold"
              [class]="i === selectedIndex() ? 'bg-[var(--chat-send-bg)] text-[var(--chat-send-text)]' : 'bg-[var(--chat-bg-alt)] text-[var(--chat-text-muted)]'"
            >
              {{ i + 1 }}
            </span>

            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-[var(--chat-text)] truncate">
                {{ cp.label ?? 'Step ' + (i + 1) }}
              </p>
              @if (cp.id) {
                <p class="text-xs text-[var(--chat-text-muted)] font-mono truncate">{{ cp.id }}</p>
              }
            </div>

            <div class="flex gap-1 shrink-0">
              <button
                class="px-2 py-1 text-xs rounded bg-[var(--chat-bg-alt)] text-[var(--chat-text)] hover:bg-[var(--chat-bg-hover)] transition-colors"
                title="Replay from this checkpoint"
                (click)="replay(cp)"
              >Replay</button>
              <button
                class="px-2 py-1 text-xs rounded bg-[var(--chat-bg-alt)] text-[var(--chat-text)] hover:bg-[var(--chat-bg-hover)] transition-colors"
                title="Fork from this checkpoint"
                (click)="fork(cp, i)"
              >Fork</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class ChatTimelineSliderComponent {
  readonly agent = input.required<ChatAgentWithHistory>();

  readonly selectedIndex = signal<number>(-1);

  readonly history = computed<ChatCheckpoint[]>(() => this.agent().history());

  readonly replayRequested = output<string>();
  readonly forkRequested = output<string>();

  replay(cp: ChatCheckpoint): void {
    if (cp.id) this.replayRequested.emit(cp.id);
  }

  fork(cp: ChatCheckpoint, index: number): void {
    this.selectedIndex.set(index);
    if (cp.id) this.forkRequested.emit(cp.id);
  }
}
```

- [ ] **Step 4: Delete old files**

```bash
rm libs/langgraph/src/lib/compositions/chat-timeline-slider/chat-timeline-slider.component.ts \
   libs/langgraph/src/lib/compositions/chat-timeline-slider/chat-timeline-slider.component.spec.ts
rmdir libs/langgraph/src/lib/compositions/chat-timeline-slider
```

- [ ] **Step 5: Update public APIs**

In `libs/chat/src/public-api.ts`, add in the compositions section:
```ts
export { ChatTimelineSliderComponent } from './lib/compositions/chat-timeline-slider/chat-timeline-slider.component';
```

Remove from `libs/langgraph/src/public-api.ts`.

- [ ] **Step 6: Verify test passes**

```bash
npx nx test chat --testNamePattern="ChatTimelineSliderComponent"
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-timeline-slider/ \
        libs/chat/src/public-api.ts \
        libs/langgraph/src/public-api.ts
git add -u libs/langgraph/src/lib/compositions
git commit -m "refactor(chat,langgraph): move chat-timeline-slider to chat, retarget to ChatAgentWithHistory"
```

---

### Task 7: Move `chat-debug` composition tree and rewire to `ChatCheckpoint`

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-debug/` (15 files, moved)
- Delete: `libs/langgraph/src/lib/compositions/chat-debug/*`
- Modify: public-apis

- [ ] **Step 1: Copy files into chat**

```bash
mkdir -p libs/chat/src/lib/compositions/chat-debug
cp libs/langgraph/src/lib/compositions/chat-debug/*.{ts} \
   libs/chat/src/lib/compositions/chat-debug/
```

- [ ] **Step 2: Rewire `debug-utils.ts`**

```ts
// libs/chat/src/lib/compositions/chat-debug/debug-utils.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChatCheckpoint } from '../../agent';
import type { DebugCheckpoint } from './debug-checkpoint-card.component';

export function toDebugCheckpoint(cp: ChatCheckpoint, index: number): DebugCheckpoint {
  return {
    node: cp.label ?? `Step ${index + 1}`,
    checkpointId: cp.id,
  };
}

export function extractStateValues(cp: ChatCheckpoint | undefined): Record<string, unknown> {
  return cp?.values ?? {};
}
```

- [ ] **Step 3: Rewire `chat-debug.component.ts`**

In `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`:

- Remove: `TODO(phase-3)` header comment.
- Remove: `import type { AgentRef } from '../../agent.types';`
- Remove: `import { toChatAgent } from '../../to-chat-agent';`
- Update co-located chat imports to use the local path `'../../agent'` + primitive paths within chat (no cross-lib import needed now).
- Change the input:

```ts
  readonly agent = input.required<ChatAgentWithHistory>();
```

- Drop `chatAgent` computed wrapper (agent is already the ChatAgent contract):

```ts
  // was: protected readonly chatAgent = computed(() => toChatAgent(this.ref()));
  // now: use this.agent() directly
```

- Replace all `this.ref().` reads:
  - `this.ref().history()` → `this.agent().history()`
  - `this.ref().messages()` → `this.agent().messages()`
  - `this.ref().isLoading()` → `this.agent().isLoading()`

- Replace all `[agent]="chatAgent()"` in template with `[agent]="agent()"`.

- `selectedState` / `previousState` computeds take `ChatCheckpoint` directly:

```ts
  readonly selectedState = computed((): Record<string, unknown> => {
    const idx = this.selectedCheckpointIndex();
    const history = this.agent().history();
    return extractStateValues(history[idx]);
  });

  readonly previousState = computed((): Record<string, unknown> => {
    const idx = this.selectedCheckpointIndex();
    const history = this.agent().history();
    if (idx <= 0) return {};
    return extractStateValues(history[idx - 1]);
  });
```

- `checkpoints` computed:

```ts
  readonly checkpoints = computed((): DebugCheckpoint[] =>
    this.agent().history().map((cp, i) => toDebugCheckpoint(cp, i)),
  );
```

- Convert the `@cacheplane/chat` imports block to relative imports, matching the convention used by sibling composition `libs/chat/src/lib/compositions/chat/chat.component.ts`:

```ts
import { ChatMessagesComponent } from '../../primitives/chat-messages/chat-messages.component';
import { MessageTemplateDirective } from '../../primitives/chat-messages/message-template.directive';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { messageContent } from '../shared/message-utils';
import { CHAT_THEME_STYLES } from '../../styles/chat-theme';
import { CHAT_MARKDOWN_STYLES, renderMarkdown } from '../../styles/chat-markdown';
```

- Add type import:

```ts
import type { ChatAgentWithHistory } from '../../agent';
```

- [ ] **Step 4: Rewire spec to use `mockChatAgent` + `history`**

In `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts`:

Replace `createMockAgentRef` imports with:
```ts
import { mockChatAgent } from '../../testing/mock-chat-agent';
import type { ChatAgentWithHistory } from '../../agent';
```

Replace usages:
```ts
const agent = mockChatAgent({
  history: [
    { id: 'ck1', label: 'nodeA', values: { step: 1 } },
    { id: 'ck2', label: 'nodeB', values: { step: 2 } },
  ],
}) as unknown as ChatAgentWithHistory;
```

Replace `[ref]="agent"` with `[agent]="agent"` in any template strings in the spec.

- [ ] **Step 5: Delete old files**

```bash
rm -r libs/langgraph/src/lib/compositions/chat-debug
```

- [ ] **Step 6: Update public APIs**

In `libs/chat/src/public-api.ts`, add:
```ts
export { ChatDebugComponent } from './lib/compositions/chat-debug/chat-debug.component';
```

In `libs/langgraph/src/public-api.ts`, remove:
- `ChatDebugComponent`
- All debug sub-component re-exports added in Phase-1 (keep only what langgraph itself still needs — at this point none).

- [ ] **Step 7: Run chat lint + test + build**

```bash
npx nx run-many -t lint,test,build -p chat
```
Expected: PASS.

- [ ] **Step 8: Run langgraph lint + test + build**

```bash
npx nx run-many -t lint,test,build -p langgraph
```
Expected: PASS. (May surface unused `toChatAgent` imports or similar — clean up.)

- [ ] **Step 9: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/ \
        libs/chat/src/public-api.ts \
        libs/langgraph/src/public-api.ts
git add -u libs/langgraph/src/lib/compositions
git commit -m "refactor(chat,langgraph): move chat-debug composition tree to chat, retarget to ChatCheckpoint"
```

---

### Task 8: Update cockpit consumers

**Files:**
- Modify: `cockpit/chat/debug/angular/src/app/debug.component.ts`
- Modify: `cockpit/chat/timeline/angular/src/app/timeline.component.ts`

- [ ] **Step 1: Update `cockpit/chat/debug/angular/src/app/debug.component.ts`**

Template change:
```html
<chat-debug [agent]="chatAgent" (replayRequested)="onReplay($event)" />
```
(was `[ref]="stream"`)

The import switches from `@cacheplane/langgraph` to `@cacheplane/chat` for `ChatDebugComponent`.

The component already does `protected readonly chatAgent = toChatAgent(this.stream);` from Phase-1. Type now widens to `ChatAgentWithHistory` automatically.

Keep replay/fork handlers (they still call `this.stream.*` LangGraph APIs).

- [ ] **Step 2: Update `cockpit/chat/timeline/angular/src/app/timeline.component.ts`**

Same pattern — template `[ref]="stream"` → `[agent]="chatAgent"`, switch `ChatTimelineSliderComponent` import from `@cacheplane/langgraph` to `@cacheplane/chat`.

- [ ] **Step 3: Build and e2e-light-test the apps**

```bash
npx nx run-many -t build -p cockpit-chat-debug-angular,cockpit-chat-timeline-angular
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add cockpit/chat/debug/angular/src/app/debug.component.ts \
        cockpit/chat/timeline/angular/src/app/timeline.component.ts
git commit -m "refactor(cockpit): rebind chat-debug and chat-timeline demos to @cacheplane/chat"
```

---

### Task 9: Final verification

- [ ] **Step 1: Verify nx graph — langgraph → chat only**

```bash
npx nx graph --file=/tmp/nxgraph.json && \
  jq '.graph.dependencies["@cacheplane/chat"], .graph.dependencies["@cacheplane/langgraph"]' /tmp/nxgraph.json
```

Expected: `@cacheplane/chat` does NOT depend on `@cacheplane/langgraph`. `@cacheplane/langgraph` depends on `@cacheplane/chat`.

- [ ] **Step 2: Full affected lint + test + build**

```bash
npx nx run-many -t lint,test,build -p chat,langgraph
npx nx affected -t build --base=origin/main
```

Expected: all pass.

- [ ] **Step 3: Grep for stale references**

```bash
rg "AgentRef" libs/chat/src
rg "ThreadState" libs/chat/src
rg "TODO\\(phase-[23]\\)" libs/
```

Expected: zero hits in `libs/chat/src`; no `TODO(phase-2)` or `TODO(phase-3)` markers remain in either lib.

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin feat/chat-runtime-decoupling-phase-2
gh pr create --title "feat(chat): complete runtime decoupling — compositions back to @cacheplane/chat" --body "$(cat <<'EOF'
## Summary
- Adds `ChatAgentWithHistory` sub-contract and `ChatCheckpoint` neutral shape to `@cacheplane/chat`.
- Moves `chat-timeline`, `chat-timeline-slider`, and `chat-debug` back into `@cacheplane/chat`, retargeted to the sub-contract.
- Widens `toChatAgent` to return `ChatAgentWithHistory`; it translates `ThreadState[]` → `ChatCheckpoint[]`.
- Cockpit debug/timeline demos rebind via one-line template edit.

## Test Plan
- [ ] `nx run-many -t lint,test,build -p chat,langgraph` passes
- [ ] `nx affected -t build` passes
- [ ] Cockpit chat-debug demo renders checkpoints and replay/fork still function
- [ ] Cockpit chat-timeline demo renders checkpoints
- [ ] `nx graph` shows langgraph → chat only (no reverse edge)
EOF
)"
```

---

## Out of Scope

- Replay/fork methods on the sub-contract (design: parent-handled outputs).
- `extra` passthrough on `ChatCheckpoint`.
- Non-LangGraph adapter implementation (separate future effort).
