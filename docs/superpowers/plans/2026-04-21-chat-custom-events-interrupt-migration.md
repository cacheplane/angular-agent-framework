# Chat Custom Events + Interrupt Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the runtime-decoupling by migrating `chat-interrupt` to `ChatAgent` and adding an observable `customEvents$` surface to `ChatAgent`, so the `chat` composition can drop its temporary `langgraphRef` escape hatch — which breaks the `chat ↔ langgraph` circular package dependency.

**Architecture:**
- `chat-interrupt` is mechanically swapped from `AgentRef<any,any>` input to `ChatAgent` input, reading `agent.interrupt()` which already exists in the contract.
- `ChatAgent` gains an optional `customEvents$?: Observable<ChatCustomEvent>`. `ChatCustomEvent` is a loose-discriminator shape: `{ readonly type: string; readonly [key: string]: unknown }`. This lets AG-UI events pass through natively, a2ui/json-render namespace their own event types, and only requires `toChatAgent` to alias `name → type` when adapting LangGraph's `CustomStreamEvent`.
- `toChatAgent` converts LangGraph's `Signal<CustomStreamEvent[]>` into `Observable<ChatCustomEvent>` by watching the signal via `effect()` and emitting only newly-appended events through a `Subject`.
- `chat.component.ts` replaces its `langgraphRef`-based `effect()` with a `takeUntilDestroyed()` subscription on `agent.customEvents$` and deletes the `langgraphRef` input entirely. Once that import is gone, `libs/chat/package.json` can drop its `@cacheplane/langgraph` peer-dep, completing the decoupling.

**Tech Stack:** Angular 20 signals + `rxjs-interop`, RxJS `Subject`/`Observable`, Nx monorepo, Jest, `@langchain/langgraph-sdk`, `@cacheplane/chat`, `@cacheplane/langgraph`.

---

## File Structure

**New files:**
- `libs/chat/src/lib/agent/chat-custom-event.ts` — `ChatCustomEvent` type definition
- `libs/chat/src/lib/agent/chat-custom-event.spec.ts` — type/shape tests

**Modified files:**
- `libs/chat/src/lib/agent/chat-agent.ts` — add `customEvents$?` field
- `libs/chat/src/lib/agent/index.ts` — export `ChatCustomEvent`
- `libs/chat/src/lib/testing/mock-chat-agent.ts` — wire optional `customEvents$` option
- `libs/chat/src/lib/testing/chat-agent-conformance.ts` — conformance check for `customEvents$` when present
- `libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.ts` — `ref: AgentRef` → `agent: ChatAgent`
- `libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.spec.ts` — update tests
- `libs/chat/src/lib/compositions/chat/chat.component.ts` — drop `langgraphRef`, swap effect for subscription
- `libs/chat/src/lib/compositions/chat/chat.component.spec.ts` — update / add tests as applicable
- `libs/chat/package.json` — remove `@cacheplane/langgraph` peer-dep
- `libs/langgraph/src/lib/to-chat-agent.ts` — implement `customEvents$` in adapter
- `libs/langgraph/src/lib/to-chat-agent.spec.ts` — add tests for `customEvents$`
- `libs/langgraph/src/lib/to-chat-agent.conformance.spec.ts` — add customEvents$ to fixture if conformance requires it

**Deleted:**
- None

---

## Task 1: Define `ChatCustomEvent` type and add to contract

**Files:**
- Create: `libs/chat/src/lib/agent/chat-custom-event.ts`
- Create: `libs/chat/src/lib/agent/chat-custom-event.spec.ts`
- Modify: `libs/chat/src/lib/agent/chat-agent.ts`
- Modify: `libs/chat/src/lib/agent/index.ts`

- [ ] **Step 1: Write failing test for ChatCustomEvent type**

Create `libs/chat/src/lib/agent/chat-custom-event.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChatCustomEvent } from './chat-custom-event';

describe('ChatCustomEvent', () => {
  it('accepts a minimal { type } event', () => {
    const event: ChatCustomEvent = { type: 'state_update' };
    expect(event.type).toBe('state_update');
  });

  it('accepts arbitrary additional fields via index signature', () => {
    const event: ChatCustomEvent = {
      type: 'a2ui.surface',
      surfaceId: 'main',
      payload: { foo: 'bar' },
      timestamp: 1234567890,
    };
    expect(event['surfaceId']).toBe('main');
    expect(event['payload']).toEqual({ foo: 'bar' });
  });

  it('allows AG-UI-shaped events to pass through without remapping', () => {
    const agUiEvent: ChatCustomEvent = {
      type: 'TEXT_MESSAGE_START',
      messageId: 'msg-1',
      role: 'assistant',
    };
    expect(agUiEvent.type).toBe('TEXT_MESSAGE_START');
    expect(agUiEvent['messageId']).toBe('msg-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat --test-path-pattern=chat-custom-event`
Expected: FAIL with "Cannot find module './chat-custom-event'".

- [ ] **Step 3: Create `ChatCustomEvent` type**

Create `libs/chat/src/lib/agent/chat-custom-event.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Runtime-neutral custom event shape flowing through `ChatAgent.customEvents$`.
 *
 * The only required field is `type` — a string discriminator consumers switch
 * on. All other fields pass through verbatim from the source runtime, which
 * lets AG-UI, LangGraph, a2ui, and json-render emit their own event shapes
 * without the core contract owning their union.
 *
 * Adapters are responsible for normalising their native shape to include a
 * `type` field (e.g., `toChatAgent` aliases LangGraph's `name` to `type`).
 */
export interface ChatCustomEvent {
  readonly type: string;
  readonly [key: string]: unknown;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test chat --test-path-pattern=chat-custom-event`
Expected: PASS — 3 tests.

- [ ] **Step 5: Add `customEvents$` to `ChatAgent` contract**

Modify `libs/chat/src/lib/agent/chat-agent.ts`. Add import and field:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ChatMessage } from './chat-message';
import type { ChatToolCall } from './chat-tool-call';
import type { ChatStatus } from './chat-status';
import type { ChatInterrupt } from './chat-interrupt';
import type { ChatSubagent } from './chat-subagent';
import type { ChatCustomEvent } from './chat-custom-event';
import type { ChatSubmitInput, ChatSubmitOptions } from './chat-submit';

/**
 * Runtime-neutral contract chat primitives consume.
 *
 * Implementations are produced by adapters (e.g. `@cacheplane/langgraph`,
 * `@cacheplane/ag-ui`) or by user code for custom backends.
 *
 * `interrupt`, `subagents`, and `customEvents$` are optional: runtimes that
 * do not support these concepts should leave them undefined, and primitives
 * that need them check presence and render a neutral fallback when absent.
 */
export interface ChatAgent {
  // Core state
  messages:  Signal<ChatMessage[]>;
  status:    Signal<ChatStatus>;
  isLoading: Signal<boolean>;
  error:     Signal<unknown>;
  toolCalls: Signal<ChatToolCall[]>;
  state:     Signal<Record<string, unknown>>;

  // Actions
  submit: (input: ChatSubmitInput, opts?: ChatSubmitOptions) => Promise<void>;
  stop:   () => Promise<void>;

  // Extended (optional; absent when runtime does not support)
  interrupt?:     Signal<ChatInterrupt | undefined>;
  subagents?:     Signal<Map<string, ChatSubagent>>;
  customEvents$?: Observable<ChatCustomEvent>;
}
```

- [ ] **Step 6: Re-export `ChatCustomEvent` from chat agent barrel**

Modify `libs/chat/src/lib/agent/index.ts` — add alongside existing exports:

```ts
export type { ChatCustomEvent } from './chat-custom-event';
```

(Preserve every existing export in that file; only add this one line.)

- [ ] **Step 7: Verify chat builds and tests pass**

Run: `npx nx test chat`
Expected: PASS — all tests (existing + 3 new).

Run: `npx nx build chat`
Expected: SUCCESS (the chat↔langgraph circular dep is still present from Phase-1, but build will emit warnings, not hard-fail; record output).

- [ ] **Step 8: Commit**

```bash
git add libs/chat/src/lib/agent/chat-custom-event.ts \
        libs/chat/src/lib/agent/chat-custom-event.spec.ts \
        libs/chat/src/lib/agent/chat-agent.ts \
        libs/chat/src/lib/agent/index.ts
git commit -m "feat(chat): add ChatCustomEvent type and optional customEvents\$ to ChatAgent"
```

---

## Task 2: Extend testing helpers with `customEvents$` support

**Files:**
- Modify: `libs/chat/src/lib/testing/mock-chat-agent.ts`
- Modify: `libs/chat/src/lib/testing/chat-agent-conformance.ts`

- [ ] **Step 1: Add `customEvents$` option to mockChatAgent and conformance check**

First read `libs/chat/src/lib/testing/mock-chat-agent.ts` fully to preserve existing options and return shape. Then modify `MockChatAgentOptions` to include an optional `customEvents$` field and pass it through to the returned object.

Patch the options interface (near the top of the file) to add:

```ts
import type { Observable } from 'rxjs';
import type { ChatCustomEvent } from '../agent/chat-custom-event';

// ... inside existing MockChatAgentOptions interface:
customEvents$?: Observable<ChatCustomEvent>;
```

Patch the returned object construction to pass `customEvents$` through when provided:

```ts
return {
  // ... existing fields
  ...(opts.customEvents$ ? { customEvents$: opts.customEvents$ } : {}),
  submit: async (input, submitOpts) => { submitCalls.push({ input, opts: submitOpts }); },
  stop: async () => { stopCount++; },
  // ... existing trailing fields
};
```

- [ ] **Step 2: Add conformance test for customEvents$ presence**

Modify `libs/chat/src/lib/testing/chat-agent-conformance.ts`. Inside the existing `describe(${label} — ChatAgent conformance)` block, add this `it` at the end:

```ts
it('if customEvents$ is present, it is an Observable-like with .subscribe', () => {
  const agent = factory();
  if (agent.customEvents$ !== undefined) {
    expect(typeof agent.customEvents$.subscribe).toBe('function');
  } else {
    expect(agent.customEvents$).toBeUndefined();
  }
});
```

- [ ] **Step 3: Run tests**

Run: `npx nx test chat`
Expected: PASS — all existing tests still pass, new conformance case runs in both paths (present/absent).

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/testing/mock-chat-agent.ts \
        libs/chat/src/lib/testing/chat-agent-conformance.ts
git commit -m "test(chat): extend mock + conformance for customEvents\$"
```

---

## Task 3: Implement `customEvents$` in `toChatAgent`

**Files:**
- Modify: `libs/langgraph/src/lib/to-chat-agent.ts`
- Modify: `libs/langgraph/src/lib/to-chat-agent.spec.ts`
- Modify: `libs/langgraph/src/lib/to-chat-agent.conformance.spec.ts`

- [ ] **Step 1: Write failing test for customEvents$**

Open `libs/langgraph/src/lib/to-chat-agent.spec.ts` and add a new test near the existing tests (do not delete existing tests). Append inside the existing `describe` block:

```ts
it('exposes customEvents$ that emits newly-appended events with type aliased from name', async () => {
  const TestBed_ = TestBed; // alias to keep import stable
  const customSig = signal<CustomStreamEvent[]>([]);
  const ref = {
    messages:        signal<BaseMessage[]>([]),
    toolCalls:       signal<ToolCallWithResult[]>([]),
    status:          signal<ResourceStatus>(ResourceStatus.Idle),
    isLoading:       signal<boolean>(false),
    error:           signal<unknown>(null),
    value:           signal<unknown>(null),
    interrupt:       signal<Interrupt<unknown> | undefined>(undefined),
    subagents:       signal(new Map()),
    customEvents:    customSig,
    submit: async () => undefined,
    stop:   async () => undefined,
  } as unknown as AgentRef<unknown, unknown>;

  let adapter!: ChatAgent;
  TestBed_.runInInjectionContext(() => {
    adapter = toChatAgent(ref);
  });

  const received: ChatCustomEvent[] = [];
  adapter.customEvents$!.subscribe((e) => received.push(e));

  TestBed_.runInInjectionContext(() => {
    customSig.set([{ name: 'state_update', data: { counter: 1 } }]);
    TestBed_.flushEffects();
  });

  expect(received).toEqual([
    { type: 'state_update', data: { counter: 1 } },
  ]);

  TestBed_.runInInjectionContext(() => {
    customSig.set([
      { name: 'state_update', data: { counter: 1 } },
      { name: 'a2ui.surface', data: { surfaceId: 'main' } },
    ]);
    TestBed_.flushEffects();
  });

  expect(received).toEqual([
    { type: 'state_update', data: { counter: 1 } },
    { type: 'a2ui.surface', data: { surfaceId: 'main' } },
  ]);
});
```

If the spec file does not already import `signal`, `TestBed`, `ChatCustomEvent`, or `ChatAgent`, add:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ChatAgent, ChatCustomEvent } from '@cacheplane/chat';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test langgraph --test-path-pattern=to-chat-agent`
Expected: FAIL — `adapter.customEvents$` is `undefined`.

- [ ] **Step 3: Implement customEvents$ in the adapter**

Modify `libs/langgraph/src/lib/to-chat-agent.ts`. Replace the full file with:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { computed, effect, Signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import type { BaseMessage } from '@langchain/core/messages';
import type { ToolCallWithResult, Interrupt } from '@langchain/langgraph-sdk';
import type {
  ChatAgent,
  ChatCustomEvent,
  ChatMessage,
  ChatRole,
  ChatStatus,
  ChatToolCall,
  ChatToolCallStatus,
  ChatInterrupt,
  ChatSubagent,
  ChatSubmitInput,
  ChatSubmitOptions,
} from '@cacheplane/chat';
import type { AgentRef, CustomStreamEvent, SubagentStreamRef } from './agent.types';
import { ResourceStatus } from './agent.types';

/**
 * Adapts a LangGraph AgentRef to the runtime-neutral ChatAgent contract.
 * The returned object is a live view; it reads from the same signals and
 * writes back via AgentRef.submit / AgentRef.stop.
 *
 * Must be called within an Angular injection context (uses `computed` and
 * `effect`).
 */
export function toChatAgent<T>(ref: AgentRef<T, any>): ChatAgent {
  const messages = computed<ChatMessage[]>(() =>
    ref.messages().map(toChatMessage),
  );

  const toolCalls = computed<ChatToolCall[]>(() =>
    ref.toolCalls().map(toChatToolCall),
  );

  const status = computed<ChatStatus>(() => mapStatus(ref.status()));

  const state = computed<Record<string, unknown>>(() => {
    const v = ref.value();
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  });

  const interrupt = computed<ChatInterrupt | undefined>(() => {
    const ix = ref.interrupt();
    return ix ? toChatInterrupt(ix) : undefined;
  });

  const subagents = computed<Map<string, ChatSubagent>>(() => {
    const src = ref.subagents();
    const out = new Map<string, ChatSubagent>();
    src.forEach((sa, key) => out.set(key, toChatSubagent(sa)));
    return out;
  });

  const customEvents$ = buildCustomEvents$(ref);

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
    submit: (input: ChatSubmitInput, opts?: ChatSubmitOptions) =>
      ref.submit(buildSubmitPayload(input), opts ? { signal: opts.signal } as never : undefined),
    stop: () => ref.stop(),
  };
}

/**
 * Build an Observable<ChatCustomEvent> that bridges LangGraph's
 * `Signal<CustomStreamEvent[]>` (append-only array) into a stream of newly
 * emitted events. Each effect firing compares against a cursor tracking the
 * previously-seen length and emits only the tail slice.
 */
function buildCustomEvents$(
  ref: AgentRef<unknown, unknown>,
): Observable<ChatCustomEvent> {
  const subject = new Subject<ChatCustomEvent>();
  let seen = 0;
  effect(() => {
    const all = ref.customEvents();
    if (all.length < seen) {
      // Stream reset (new session, thread switch, etc.). Rewind cursor.
      seen = 0;
    }
    for (let i = seen; i < all.length; i++) {
      subject.next(toChatCustomEvent(all[i]));
    }
    seen = all.length;
  });
  return subject.asObservable();
}

function toChatCustomEvent(e: CustomStreamEvent): ChatCustomEvent {
  return { type: e.name, data: e.data };
}

function mapStatus(s: ResourceStatus): ChatStatus {
  switch (s) {
    case ResourceStatus.Error: return 'error';
    case ResourceStatus.Loading:
    case ResourceStatus.Reloading:
      return 'running';
    default:
      return 'idle';
  }
}

function toChatMessage(m: BaseMessage): ChatMessage {
  const raw = m as unknown as Record<string, unknown>;
  const typeVal = typeof m._getType === 'function'
    ? m._getType()
    : (raw['type'] as string | undefined) ?? 'ai';
  const role: ChatRole =
    typeVal === 'human' ? 'user' :
    typeVal === 'tool'  ? 'tool' :
    typeVal === 'system' ? 'system' :
    'assistant';
  return {
    id: (m.id as string | undefined) ?? (raw['id'] as string | undefined) ?? randomId(),
    role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    toolCallId: raw['tool_call_id'] as string | undefined,
    name: raw['name'] as string | undefined,
    extra: raw,
  };
}

function toChatToolCall(tc: ToolCallWithResult): ChatToolCall {
  const stateMap: Record<string, ChatToolCallStatus> = {
    pending: 'pending',
    completed: 'complete',
    error: 'error',
  };
  const status: ChatToolCallStatus = stateMap[tc.state] ?? 'running';
  const result = tc.result as (Record<string, unknown> | undefined);
  return {
    id: tc.id,
    name: tc.call.name,
    args: tc.call.args,
    status,
    result: result?.['content'],
    error: tc.state === 'error' ? result?.['content'] : undefined,
  };
}

function toChatInterrupt(ix: Interrupt<unknown>): ChatInterrupt {
  const raw = ix as unknown as Record<string, unknown>;
  return {
    id: (raw['id'] as string | undefined) ?? randomId(),
    value: raw['value'] ?? ix,
    resumable: true,
  };
}

function toChatSubagent(sa: SubagentStreamRef): ChatSubagent {
  return {
    toolCallId: sa.toolCallId,
    status: sa.status,
    messages: computed(() => sa.messages().map(toChatMessage)) as Signal<ChatMessage[]>,
    state: sa.values as Signal<Record<string, unknown>>,
  };
}

function buildSubmitPayload(input: ChatSubmitInput): unknown {
  if (input.resume !== undefined) return { __resume__: input.resume };
  if (input.message !== undefined) {
    const content = typeof input.message === 'string'
      ? input.message
      : input.message.map((b) => (b.type === 'text' ? b.text : JSON.stringify(b))).join('');
    return { messages: [{ role: 'human', content }], ...(input.state ?? {}) };
  }
  return input.state ?? {};
}

function randomId(): string {
  return Math.random().toString(36).slice(2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test langgraph --test-path-pattern=to-chat-agent`
Expected: PASS — new test plus existing tests.

- [ ] **Step 5: Commit**

```bash
git add libs/langgraph/src/lib/to-chat-agent.ts \
        libs/langgraph/src/lib/to-chat-agent.spec.ts
git commit -m "feat(langgraph): bridge customEvents signal to Observable in toChatAgent"
```

---

## Task 4: Migrate `chat-interrupt` primitive to `ChatAgent`

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.spec.ts`

- [ ] **Step 1: Update spec to use mockChatAgent and `agent` input**

First read the existing `chat-interrupt.component.spec.ts` fully to preserve test names and scaffolding. Then rewrite the body so each test builds a `ChatAgent` via `mockChatAgent({ interrupt: signal(<value>) })` and binds it to the component's new `agent` input. For example, the smallest test body should be:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatInterruptComponent, getInterrupt } from './chat-interrupt.component';
import { mockChatAgent } from '../../testing/mock-chat-agent';
import type { ChatInterrupt } from '../../agent/chat-interrupt';

describe('ChatInterruptComponent', () => {
  it('getInterrupt returns the agent interrupt signal value', () => {
    const ix: ChatInterrupt = { id: 'ix-1', value: 'Need approval', resumable: true };
    const agent = mockChatAgent({ interrupt: signal<ChatInterrupt | undefined>(ix) });
    expect(getInterrupt(agent)).toEqual(ix);
  });

  it('getInterrupt returns undefined when runtime does not expose interrupt', () => {
    const agent = mockChatAgent({}); // no interrupt option
    expect(getInterrupt(agent)).toBeUndefined();
  });

  it('renders the template with the current interrupt', async () => {
    const ix: ChatInterrupt = { id: 'ix-1', value: 'Need approval', resumable: true };
    const agent = mockChatAgent({ interrupt: signal<ChatInterrupt | undefined>(ix) });
    TestBed.configureTestingModule({ imports: [ChatInterruptComponent] });
    const fixture = TestBed.createComponent(ChatInterruptComponent);
    fixture.componentRef.setInput('agent', agent);
    // Preserve any existing template-projection assertion from the old spec
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBeDefined();
  });
});
```

If the existing spec has additional assertions (template projection specifics, resumable handling), **keep them** — only the agent-wiring lines change from `ref` to `agent`.

If `mockChatAgent` does not yet accept an `interrupt` option, open `libs/chat/src/lib/testing/mock-chat-agent.ts` and confirm it does — this was established in Workstream B. If the option is missing, add it the same way Task 2 added `customEvents$`: an optional `interrupt?: Signal<ChatInterrupt | undefined>` on `MockChatAgentOptions`, spread into the return object conditionally.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat --test-path-pattern=chat-interrupt.component`
Expected: FAIL — `agent` input doesn't exist yet, or `getInterrupt` signature mismatches.

- [ ] **Step 3: Rewrite the component**

Replace `libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.ts` with:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  contentChild,
  input,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { ChatAgent } from '../../agent';
import type { ChatInterrupt } from '../../agent/chat-interrupt';

/**
 * Retrieves the current interrupt value from a ChatAgent, or undefined when
 * the runtime does not expose interrupts.
 * Exported for unit testing without DOM rendering.
 */
export function getInterrupt(agent: ChatAgent): ChatInterrupt | undefined {
  return agent.interrupt?.();
}

@Component({
  selector: 'chat-interrupt',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (interrupt(); as currentInterrupt) {
      @if (templateRef()) {
        <ng-container
          [ngTemplateOutlet]="templateRef()!"
          [ngTemplateOutletContext]="{ $implicit: currentInterrupt }"
        />
      }
    }
  `,
})
export class ChatInterruptComponent {
  readonly agent = input.required<ChatAgent>();

  readonly templateRef = contentChild(TemplateRef);

  readonly interrupt = computed(() => getInterrupt(this.agent()));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test chat --test-path-pattern=chat-interrupt.component`
Expected: PASS.

- [ ] **Step 5: Full chat test run**

Run: `npx nx test chat`
Expected: PASS — all tests. (The `chat.component.ts` composition still passes `[ref]="langgraphRef()"` to `<chat-interrupt>`, which will now fail type-check; that is fixed in Task 5. If the build is run between tasks it will fail — tests should still pass because they don't exercise the composition's template binding for interrupt.)

If the composition template referencing the now-removed `ref` input causes a type-check failure during test compilation, skip Step 5 here and re-run after Task 5. Record the outcome.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.ts \
        libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.spec.ts \
        libs/chat/src/lib/testing/mock-chat-agent.ts
git commit -m "refactor(chat): migrate chat-interrupt from AgentRef to ChatAgent"
```

(If `mock-chat-agent.ts` was not touched, omit it from the `git add`.)

---

## Task 5: Migrate `chat.component.ts` — drop `langgraphRef`, subscribe to `customEvents$`

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.spec.ts` (if a spec file exists for this composition)

- [ ] **Step 1: Add a failing test for customEvents$ routing**

Open `libs/chat/src/lib/compositions/chat/chat.component.spec.ts` (create if it does not exist — use the import style from the existing `chat-interrupt.component.spec.ts`). Add this test inside the existing `describe` or a new one:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ChatComponent } from './chat.component';
import { mockChatAgent } from '../../testing/mock-chat-agent';
import type { ChatCustomEvent } from '../../agent/chat-custom-event';
import { signalStateStore } from '@cacheplane/render';

describe('ChatComponent customEvents$', () => {
  it('routes state_update customEvents to the resolved render store', () => {
    const events$ = new Subject<ChatCustomEvent>();
    const agent = mockChatAgent({ customEvents$: events$.asObservable() });
    const store = signalStateStore({});

    TestBed.configureTestingModule({ imports: [ChatComponent] });
    const fixture = TestBed.createComponent(ChatComponent);
    fixture.componentRef.setInput('agent', agent);
    fixture.componentRef.setInput('store', store);
    fixture.detectChanges();

    events$.next({ type: 'state_update', data: { counter: 7 } });

    expect(store.snapshot()).toMatchObject({ counter: 7 });
  });

  it('ignores non-state_update events and events with non-object data', () => {
    const events$ = new Subject<ChatCustomEvent>();
    const agent = mockChatAgent({ customEvents$: events$.asObservable() });
    const store = signalStateStore({ initial: true });

    TestBed.configureTestingModule({ imports: [ChatComponent] });
    const fixture = TestBed.createComponent(ChatComponent);
    fixture.componentRef.setInput('agent', agent);
    fixture.componentRef.setInput('store', store);
    fixture.detectChanges();

    events$.next({ type: 'a2ui.surface', data: { surfaceId: 'main' } });
    events$.next({ type: 'state_update', data: 'not-an-object' });

    expect(store.snapshot()).toEqual({ initial: true });
  });
});
```

If `signalStateStore().snapshot()` is not the actual public API for reading the store, replace `store.snapshot()` with whatever accessor the existing `customEventEffect` writes back to (check `libs/render` exports). If only `store.update()` exists, read the store's underlying signal via whatever getter the store exposes — do not invent one.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat --test-path-pattern=chat.component.spec`
Expected: FAIL — `customEventEffect` still reads from `langgraphRef()`, so the subject events are never routed.

- [ ] **Step 3: Rewrite the composition**

Modify `libs/chat/src/lib/compositions/chat/chat.component.ts`. Apply these specific changes:

**3a.** Remove imports that are no longer used:

```diff
-import type { AgentRef } from '@cacheplane/langgraph';
```

**3b.** Add RxJS interop + DestroyRef imports at the top of the file:

```ts
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
```

(`DestroyRef` and `inject` may already be imported — merge, don't duplicate.)

**3c.** Delete the `langgraphRef` input block:

```diff
-  /**
-   * TEMPORARY escape hatch for Phase-1: primitives not yet migrated
-   * (chat-interrupt, chat-subagents, a2ui surfaces relying on customEvents)
-   * still require an AgentRef. Pass the same underlying LangGraph ref alongside
-   * `agent`. Remove once Phase-2 migrates these primitives.
-   * TODO(phase-2): remove langgraphRef input once chat-interrupt and
-   * customEvents are migrated to the ChatAgent contract.
-   */
-  readonly langgraphRef = input<AgentRef<any, any> | undefined>(undefined);
```

**3d.** Replace the `customEventEffect` block with a subscription-based implementation driven by `agent.customEvents$`. Replace:

```ts
  // TODO(phase-2): move state_update events onto the ChatAgent custom-event surface
  /**
   * Route `state_update` custom events from the agent stream to the render
   * state store so that components bound to `$state` paths reactively update.
   */
  protected readonly customEventEffect = effect(() => {
    const ref = this.langgraphRef();
    if (!ref) return;
    const events = ref.customEvents();
    const store = this.resolvedStore();
    if (!store || events.length === 0) return;

    for (const event of events) {
      if (event.name === 'state_update' && event.data && typeof event.data === 'object') {
        store.update(event.data as Record<string, unknown>);
      }
    }
  });
```

with a subscription bootstrapped from inside the constructor's existing `effect()` pattern. Add a `destroyRef` field at the top of the class:

```ts
  private readonly destroyRef = inject(DestroyRef);
  private customEventsSubscribed = false;
```

Then in the `constructor()` body (alongside the existing auto-scroll `effect`), add a second effect that subscribes once the agent resolves:

```ts
    // Route `state_update` custom events from the agent stream to the render
    // state store so components bound to `$state` paths reactively update.
    // customEvents$ is optional — runtimes without custom-event support leave
    // it undefined and this wiring becomes a no-op after the first effect run.
    effect(() => {
      if (this.customEventsSubscribed) return;
      const stream$ = this.agent().customEvents$;
      this.customEventsSubscribed = true;
      if (!stream$) return;
      stream$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
        if (event.type !== 'state_update') return;
        const data = event['data'];
        if (!data || typeof data !== 'object') return;
        const store = this.resolvedStore();
        if (!store) return;
        store.update(data as Record<string, unknown>);
      });
    });
```

Rationale: required inputs cannot be read from class field initialisers (they throw before Angular sets the input), so the read must happen inside a reactive context. The `customEventsSubscribed` guard ensures we subscribe exactly once; the effect tracks `this.agent()` so if Angular ever rebinds the input it will re-run, but in practice the agent input is treated as stable by the rest of the composition.

**3e.** Update the interrupt template binding:

```diff
-        @if (langgraphRef()) {
-          <chat-interrupt [ref]="langgraphRef()!">
+        @if (agent().interrupt) {
+          <chat-interrupt [agent]="agent()">
             <ng-template let-interrupt>
               <div class="px-5 py-3 border-t" style="background: var(--chat-warning-bg); border-color: var(--chat-border);">
                 <p class="text-sm m-0" style="color: var(--chat-warning-text);">Agent paused: {{ interrupt.value }}</p>
               </div>
             </ng-template>
           </chat-interrupt>
         }
```

**3f.** Remove `effect` from the `@angular/core` import list if no other `effect()` usage remains (the constructor still has one for auto-scroll — keep `effect` in that case). Do not remove it blindly; grep the file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat`
Expected: PASS — new subscription tests plus all existing.

- [ ] **Step 5: Verify no stray AgentRef/langgraph imports remain in the composition**

Run (use the Grep tool, not shell `grep`): search for `AgentRef|@cacheplane/langgraph|langgraphRef` in `libs/chat/src/lib/compositions/chat/`.
Expected: zero matches.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts \
        libs/chat/src/lib/compositions/chat/chat.component.spec.ts
git commit -m "refactor(chat): replace langgraphRef with ChatAgent.customEvents\$ subscription"
```

---

## Task 6: Remove `@cacheplane/langgraph` peer-dep from chat package

**Files:**
- Modify: `libs/chat/package.json`

- [ ] **Step 1: Audit that no chat sources import from `@cacheplane/langgraph`**

Run (use the Grep tool): search for `@cacheplane/langgraph` in `libs/chat/src/`.
Expected: zero matches. If any match remains, STOP and fix it before editing package.json.

- [ ] **Step 2: Read current package.json**

Read `libs/chat/package.json` in full to capture the exact `peerDependencies` (and/or `dependencies`) block containing `@cacheplane/langgraph`.

- [ ] **Step 3: Remove the peer-dep entry**

Remove only the `"@cacheplane/langgraph": "..."` line from the relevant dependency block. Preserve every other key. If the containing block becomes empty after removal, remove the empty block as well.

- [ ] **Step 4: Verify chat builds without the dep**

Run: `npx nx build chat`
Expected: SUCCESS — no "chat → langgraph → chat" circular build warning.

Run: `npx nx build langgraph`
Expected: SUCCESS — langgraph still builds (it imports types from `@cacheplane/chat`, which is the intended one-way direction).

- [ ] **Step 5: Full test sweep**

Run: `npx nx test chat`
Run: `npx nx test langgraph`
Expected: PASS for both.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/package.json
git commit -m "chore(chat): drop @cacheplane/langgraph peer-dep — circular dep resolved"
```

---

## Task 7: Update consumers that pass `langgraphRef` to `<chat>`

**Files:**
- Search for any consumer of `<chat [langgraphRef]>` and update.

- [ ] **Step 1: Find all consumers of `langgraphRef`**

Run (Grep tool): search for `langgraphRef` across the whole worktree.
Expected matches: example apps, documentation, and story/demo files that previously passed the ref alongside `agent`.

- [ ] **Step 2: For each match, remove the `[langgraphRef]="..."` binding**

For every file that has `<chat ... [langgraphRef]="foo">`, delete only the `[langgraphRef]="..."` attribute. The `[agent]` binding stays. If a file has a reference (`const foo = toChatAgent(ref)` or similar) whose sole purpose was powering `langgraphRef`, remove the now-unused local as well (check by grep within the file — do not delete if it has other uses).

Do not change any file that does not contain `langgraphRef`.

- [ ] **Step 3: Re-run test sweep across affected projects**

Run: `npx nx run-many -t test -p chat,langgraph`
Expected: PASS.

For any updated app/demo project, run its own test/build target:
Run: `npx nx run-many -t test,build --projects=chat,langgraph` plus any project names surfaced in Step 1.
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: drop langgraphRef binding from <chat> consumers"
```

If Step 1 found no consumers (the input was only used in internal tests already covered by prior commits), skip Steps 2–4 and record "no external consumers".

---

## Task 8: Final verification and circular-dep smoke test

**Files:** None (verification only).

- [ ] **Step 1: Full workspace test run**

Run: `npx nx run-many -t test -p chat,langgraph`
Expected: PASS.

- [ ] **Step 2: Full workspace build**

Run: `npx nx run-many -t build -p chat,langgraph`
Expected: PASS with no circular-dep warnings.

- [ ] **Step 3: Lint**

Run: `npx nx lint chat`
Run: `npx nx lint langgraph`
Expected: PASS (no new errors; pre-existing warnings OK).

- [ ] **Step 4: Confirm dep direction**

Run (Grep tool): `@cacheplane/chat` in `libs/langgraph/src/` — expect matches (one-way dep is fine).
Run (Grep tool): `@cacheplane/langgraph` in `libs/chat/src/` — expect **zero** matches.

- [ ] **Step 5: No commit needed**

Verification only. If anything failed, diagnose and address in a follow-up commit before declaring Phase-1 complete.

---

## Phase-1 completion note

After Task 8 passes cleanly:
- `chat` is fully runtime-neutral.
- `chat → langgraph` import edge is eliminated.
- `langgraph → chat` remains (for `toChatAgent`), which is the intended direction.
- `chat-subagents`, `chat-timeline`, `chat-timeline-slider`, `chat-debug` still carry `TODO(phase-2)` / `TODO(phase-3)` markers and continue to consume `AgentRef`. These are out of scope here and do not block Phase-1 closure because the generic `chat` composition no longer imports them in a way that forces a chat→langgraph edge.
