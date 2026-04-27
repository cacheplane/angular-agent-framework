# `@cacheplane/ag-ui` Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@cacheplane/ag-ui` — a runtime adapter wrapping `@ag-ui/client`'s `AbstractAgent` into the `Agent` contract. Scope B: messages + lifecycle + tool calls + state. Conformance-tested against `runAgentConformance`. Cockpit demo proves end-to-end decoupling.

**Architecture:** New Nx library `libs/ag-ui/`. Pure-function reducer (`reduceEvent(event, store)`) maps AG-UI events into signal updates. `toAgent(source: AbstractAgent): Agent` wires the reducer to `source.agent()`. `provideAgUiAgent({ url })` DI convenience instantiates `HttpAgent` and threads it through `toAgent`.

**Tech Stack:** Angular 21 (signals + RxJS), Nx, Vitest, ng-packagr, `@ag-ui/client`, `fast-json-patch` (RFC 6902 for `StateDelta`).

**Spec:** `docs/superpowers/specs/2026-04-27-ag-ui-adapter-design.md`

---

## File Structure

### New library `libs/ag-ui/`

```
libs/ag-ui/
├── eslint.config.mjs
├── ng-package.json
├── package.json
├── project.json
├── README.md
├── src/
│   ├── public-api.ts
│   └── lib/
│       ├── ag-ui-event.ts            # narrowed type aliases for AG-UI events we consume
│       ├── reducer.ts                 # pure function: (event, store) → void
│       ├── reducer.spec.ts
│       ├── to-agent.ts                # wraps AbstractAgent → Agent
│       ├── to-agent.spec.ts
│       ├── to-agent.conformance.spec.ts
│       ├── provide-ag-ui-agent.ts     # DI convenience
│       └── provide-ag-ui-agent.spec.ts
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.lib.prod.json
└── vite.config.mts
```

### New cockpit app `cockpit/ag-ui/streaming/angular/`

```
cockpit/ag-ui/streaming/angular/
├── project.json
├── src/
│   ├── app/
│   │   ├── app.config.ts
│   │   ├── streaming.component.ts
│   │   └── streaming.component.spec.ts
│   ├── environments/environment.ts
│   ├── index.html
│   └── main.ts
├── tsconfig.app.json
├── tsconfig.json
└── vite.config.mts
```

### Modified

- `tsconfig.base.json` — add path mapping for `@cacheplane/ag-ui`
- Workspace `package.json` — add `@ag-ui/client` and `fast-json-patch` to root deps if not already present
- `nx.json` — only if generator output requires it

---

### Task 1: Scaffold `libs/ag-ui/` library

Use the existing `libs/langgraph/` as a structural reference (peer-deps, ng-package.json, tsconfig, eslint, vite config, project.json shape).

- [ ] **Step 1: Generate the Angular library**

```bash
npx nx g @nx/angular:library libs/ag-ui --buildable --publishable --importPath=@cacheplane/ag-ui --skipTests=false --standalone=true
```

If the generator's output diverges from the existing `langgraph` shape, hand-edit to match: same `executor: '@nx/angular:package'` build target, same `prefix: 'lib'`, same `release.version` block, same `vite.config.mts` pattern.

- [ ] **Step 2: Update `libs/ag-ui/package.json`**

```json
{
  "name": "@cacheplane/ag-ui",
  "version": "0.0.1",
  "peerDependencies": {
    "@cacheplane/chat": "^0.0.1",
    "@cacheplane/licensing": "^0.0.1",
    "@angular/core": "^20.0.0 || ^21.0.0",
    "@ag-ui/client": "^0.0.30",
    "fast-json-patch": "^3.1.1",
    "rxjs": "~7.8.0"
  },
  "license": "PolyForm-Noncommercial-1.0.0",
  "sideEffects": false
}
```

(Pin `@ag-ui/client` to a stable point release. `^0.0.30` is illustrative — pick the latest stable at implementation time and document the version in a comment.)

- [ ] **Step 3: Update `libs/ag-ui/eslint.config.mjs`**

Mirror `libs/langgraph/eslint.config.mjs`. Selector prefix allowlist: `['ag-ui']`.

```js
prefix: ['ag-ui'],
```

Add `vitest` to `ignoredDependencies` in the `@nx/dependency-checks` block (matches `libs/chat/eslint.config.mjs`).

- [ ] **Step 4: Add path mapping in `tsconfig.base.json`**

```json
"paths": {
  // ...existing entries...
  "@cacheplane/ag-ui": ["libs/ag-ui/src/public-api.ts"]
}
```

- [ ] **Step 5: Initialize `libs/ag-ui/src/public-api.ts`**

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export { toAgent } from './lib/to-agent';
export { provideAgUiAgent } from './lib/provide-ag-ui-agent';
export type { AgUiAgentConfig } from './lib/provide-ag-ui-agent';
```

(File-level placeholders — implementations come in later tasks.)

- [ ] **Step 6: Stub the implementation files**

Create empty stubs so the build doesn't fail before later tasks fill them in:

```ts
// libs/ag-ui/src/lib/to-agent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { AbstractAgent } from '@ag-ui/client';
import type { Agent } from '@cacheplane/chat';

export function toAgent(source: AbstractAgent): Agent {
  void source;
  throw new Error('not implemented');
}
```

```ts
// libs/ag-ui/src/lib/provide-ag-ui-agent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Provider } from '@angular/core';

export interface AgUiAgentConfig {
  url: string;
  agentId?: string;
  threadId?: string;
  headers?: Record<string, string>;
}

export function provideAgUiAgent(config: AgUiAgentConfig): Provider[] {
  void config;
  throw new Error('not implemented');
}
```

- [ ] **Step 7: Verify scaffold builds**

```bash
npx nx run-many -t lint,build -p ag-ui
```

Expected: PASS (with lint pre-existing warnings if any). Tests are skipped at this stage because no spec files exist yet.

- [ ] **Step 8: Commit**

```bash
git add libs/ag-ui/ tsconfig.base.json
git commit -m "feat(ag-ui): scaffold @cacheplane/ag-ui library"
```

---

### Task 2: Implement the event reducer

**Files:**
- Create: `libs/ag-ui/src/lib/reducer.ts`
- Create: `libs/ag-ui/src/lib/reducer.spec.ts`

The reducer is a pure function `(event, store) => void`. The store is a bag of `WritableSignal<T>` handles plus a `Subject<AgentEvent>`. Lives in its own file so it's trivially unit-testable independent of `toAgent`'s wiring.

- [ ] **Step 1: Write the reducer signature and store interface**

```ts
// libs/ag-ui/src/lib/reducer.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { WritableSignal } from '@angular/core';
import type { Subject } from 'rxjs';
import type {
  Message, AgentStatus, ToolCall, AgentEvent,
} from '@cacheplane/chat';
import type { BaseEvent } from '@ag-ui/client';
import { applyPatch, type Operation } from 'fast-json-patch';

export interface ReducerStore {
  messages:  WritableSignal<Message[]>;
  status:    WritableSignal<AgentStatus>;
  isLoading: WritableSignal<boolean>;
  error:     WritableSignal<unknown>;
  toolCalls: WritableSignal<ToolCall[]>;
  state:     WritableSignal<Record<string, unknown>>;
  events$:   Subject<AgentEvent>;
}

/**
 * Pure function: applies a single AG-UI BaseEvent to the store. Caller
 * subscribes to source.agent() and forwards each event here. Designed
 * for testability — no side effects beyond the supplied store.
 */
export function reduceEvent(event: BaseEvent, store: ReducerStore): void {
  switch (event.type) {
    case 'RUN_STARTED': {
      store.status.set('running');
      store.isLoading.set(true);
      store.error.set(null);
      return;
    }
    case 'RUN_FINISHED': {
      store.status.set('idle');
      store.isLoading.set(false);
      return;
    }
    case 'RUN_ERROR': {
      store.status.set('error');
      store.isLoading.set(false);
      store.error.set((event as { message?: unknown }).message ?? event);
      return;
    }
    case 'TEXT_MESSAGE_START': {
      store.messages.update((prev) => [
        ...prev,
        { id: messageIdFrom(event), role: 'assistant', content: '' },
      ]);
      return;
    }
    case 'TEXT_MESSAGE_CONTENT': {
      const id = messageIdFrom(event);
      const delta = (event as { delta?: string }).delta ?? '';
      store.messages.update((prev) =>
        prev.map((m) => m.id === id ? { ...m, content: m.content + delta } : m),
      );
      return;
    }
    case 'TEXT_MESSAGE_END': {
      // No-op — message is finalized by virtue of TEXT_MESSAGE_CONTENT
      // having been applied. Reserved for future hooks.
      return;
    }
    case 'TOOL_CALL_START': {
      const e = event as { toolCallId: string; toolCallName: string };
      store.toolCalls.update((prev) => [
        ...prev,
        { id: e.toolCallId, name: e.toolCallName, args: {}, status: 'running' },
      ]);
      return;
    }
    case 'TOOL_CALL_ARGS': {
      const e = event as { toolCallId: string; delta: string };
      const args = safeParseArgs(e.delta);
      store.toolCalls.update((prev) =>
        prev.map((t) => t.id === e.toolCallId ? { ...t, args } : t),
      );
      return;
    }
    case 'TOOL_CALL_END': {
      const e = event as { toolCallId: string };
      store.toolCalls.update((prev) =>
        prev.map((t) => t.id === e.toolCallId ? { ...t, status: 'complete' } : t),
      );
      return;
    }
    case 'TOOL_CALL_RESULT': {
      const e = event as { toolCallId: string; content: unknown };
      store.toolCalls.update((prev) =>
        prev.map((t) => t.id === e.toolCallId ? { ...t, result: e.content } : t),
      );
      return;
    }
    case 'STATE_SNAPSHOT': {
      const e = event as { snapshot: Record<string, unknown> };
      store.state.set(e.snapshot ?? {});
      return;
    }
    case 'STATE_DELTA': {
      const e = event as { delta: Operation[] };
      const next = applyPatch(deepClone(store.state()), e.delta).newDocument;
      store.state.set(next);
      return;
    }
    case 'MESSAGES_SNAPSHOT': {
      const e = event as { messages: Message[] };
      store.messages.set(e.messages ?? []);
      return;
    }
    case 'CUSTOM': {
      const e = event as { name: string; value: unknown };
      if (e.name === 'state_update' && isRecord(e.value)) {
        store.events$.next({ type: 'state_update', data: e.value });
      } else {
        store.events$.next({ type: 'custom', name: e.name, data: e.value });
      }
      return;
    }
    default: {
      // Unknown event types are ignored; AG-UI may add new ones in
      // future protocol versions. We surface them as no-ops rather
      // than throwing, so a partial-version mismatch doesn't crash.
      return;
    }
  }
}

function messageIdFrom(event: BaseEvent): string {
  return (event as { messageId?: string }).messageId ?? 'unknown';
}

function safeParseArgs(delta: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(delta);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
```

(Type narrowing on `event` uses casts — `BaseEvent` from `@ag-ui/client` is a discriminated union but the per-type fields aren't always reachable via TS narrowing on `.type`. Cast-and-validate at each site.)

- [ ] **Step 2: Write the reducer spec**

```ts
// libs/ag-ui/src/lib/reducer.spec.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import type {
  Message, AgentStatus, ToolCall, AgentEvent,
} from '@cacheplane/chat';
import { reduceEvent, type ReducerStore } from './reducer';

function makeStore(): ReducerStore {
  return {
    messages:  signal<Message[]>([]),
    status:    signal<AgentStatus>('idle'),
    isLoading: signal(false),
    error:     signal<unknown>(null),
    toolCalls: signal<ToolCall[]>([]),
    state:     signal<Record<string, unknown>>({}),
    events$:   new Subject<AgentEvent>(),
  };
}

describe('reduceEvent', () => {
  it('RUN_STARTED sets status running, isLoading true, clears error', () => {
    const store = makeStore();
    store.error.set('previous');
    reduceEvent({ type: 'RUN_STARTED' } as any, store);
    expect(store.status()).toBe('running');
    expect(store.isLoading()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('RUN_FINISHED sets status idle, isLoading false', () => {
    const store = makeStore();
    store.status.set('running');
    store.isLoading.set(true);
    reduceEvent({ type: 'RUN_FINISHED' } as any, store);
    expect(store.status()).toBe('idle');
    expect(store.isLoading()).toBe(false);
  });

  it('RUN_ERROR sets status error, captures message', () => {
    const store = makeStore();
    reduceEvent({ type: 'RUN_ERROR', message: 'boom' } as any, store);
    expect(store.status()).toBe('error');
    expect(store.error()).toBe('boom');
  });

  it('TEXT_MESSAGE_START appends an empty assistant message', () => {
    const store = makeStore();
    reduceEvent({ type: 'TEXT_MESSAGE_START', messageId: 'm1' } as any, store);
    expect(store.messages()).toEqual([{ id: 'm1', role: 'assistant', content: '' }]);
  });

  it('TEXT_MESSAGE_CONTENT appends delta to in-flight message', () => {
    const store = makeStore();
    reduceEvent({ type: 'TEXT_MESSAGE_START', messageId: 'm1' } as any, store);
    reduceEvent({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'hi ' } as any, store);
    reduceEvent({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'there' } as any, store);
    expect(store.messages()[0].content).toBe('hi there');
  });

  it('TOOL_CALL_START appends a running tool call', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search' } as any, store);
    expect(store.toolCalls()).toEqual([{ id: 't1', name: 'search', args: {}, status: 'running' }]);
  });

  it('TOOL_CALL_ARGS replaces args on the matching tool call', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search' } as any, store);
    reduceEvent({ type: 'TOOL_CALL_ARGS', toolCallId: 't1', delta: '{"q":"hi"}' } as any, store);
    expect(store.toolCalls()[0].args).toEqual({ q: 'hi' });
  });

  it('TOOL_CALL_END marks the matching tool call complete', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search' } as any, store);
    reduceEvent({ type: 'TOOL_CALL_END', toolCallId: 't1' } as any, store);
    expect(store.toolCalls()[0].status).toBe('complete');
  });

  it('TOOL_CALL_RESULT sets the result on the matching call', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search' } as any, store);
    reduceEvent({ type: 'TOOL_CALL_RESULT', toolCallId: 't1', content: 'found' } as any, store);
    expect(store.toolCalls()[0].result).toBe('found');
  });

  it('STATE_SNAPSHOT replaces state wholesale', () => {
    const store = makeStore();
    store.state.set({ prior: true });
    reduceEvent({ type: 'STATE_SNAPSHOT', snapshot: { fresh: 1 } } as any, store);
    expect(store.state()).toEqual({ fresh: 1 });
  });

  it('STATE_DELTA applies JSON Patch operations', () => {
    const store = makeStore();
    store.state.set({ a: 1 });
    reduceEvent({
      type: 'STATE_DELTA',
      delta: [{ op: 'replace', path: '/a', value: 2 }, { op: 'add', path: '/b', value: 3 }],
    } as any, store);
    expect(store.state()).toEqual({ a: 2, b: 3 });
  });

  it('MESSAGES_SNAPSHOT replaces messages wholesale', () => {
    const store = makeStore();
    store.messages.set([{ id: 'old', role: 'user', content: 'old' }]);
    reduceEvent({
      type: 'MESSAGES_SNAPSHOT',
      messages: [{ id: 'new', role: 'assistant', content: 'fresh' }],
    } as any, store);
    expect(store.messages()).toEqual([{ id: 'new', role: 'assistant', content: 'fresh' }]);
  });

  it('CUSTOM with name=state_update emits AgentStateUpdateEvent', async () => {
    const store = makeStore();
    const events: AgentEvent[] = [];
    store.events$.subscribe((e) => events.push(e));
    reduceEvent({ type: 'CUSTOM', name: 'state_update', value: { count: 1 } } as any, store);
    expect(events).toEqual([{ type: 'state_update', data: { count: 1 } }]);
  });

  it('CUSTOM with other name emits AgentCustomEvent', async () => {
    const store = makeStore();
    const events: AgentEvent[] = [];
    store.events$.subscribe((e) => events.push(e));
    reduceEvent({ type: 'CUSTOM', name: 'tick', value: 42 } as any, store);
    expect(events).toEqual([{ type: 'custom', name: 'tick', data: 42 }]);
  });

  it('unknown event types are no-ops', () => {
    const store = makeStore();
    reduceEvent({ type: 'FUTURE_EVENT' } as any, store);
    expect(store.messages()).toEqual([]);
    expect(store.status()).toBe('idle');
  });
});
```

- [ ] **Step 3: Run the reducer spec**

```bash
npx nx test ag-ui
```

Expected: all reducer tests PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/ag-ui/src/lib/reducer.ts libs/ag-ui/src/lib/reducer.spec.ts
git commit -m "feat(ag-ui): pure-function reducer mapping AG-UI events to Agent signals"
```

---

### Task 3: Implement `toAgent`

**Files:**
- Modify: `libs/ag-ui/src/lib/to-agent.ts`
- Create: `libs/ag-ui/src/lib/to-agent.spec.ts`
- Create: `libs/ag-ui/src/lib/to-agent.conformance.spec.ts`

- [ ] **Step 1: Replace stub `to-agent.ts` with real implementation**

```ts
// libs/ag-ui/src/lib/to-agent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal, type WritableSignal } from '@angular/core';
import { Subject, type Subscription } from 'rxjs';
import type { AbstractAgent } from '@ag-ui/client';
import type {
  Agent, Message, AgentStatus, ToolCall, AgentEvent,
  AgentSubmitInput, AgentSubmitOptions,
} from '@cacheplane/chat';
import { reduceEvent, type ReducerStore } from './reducer';

/**
 * Wraps an AG-UI AbstractAgent into the runtime-neutral Agent contract.
 *
 * The adapter subscribes to source.agent() and reduces every event into
 * the produced Agent's signals. submit() optimistically appends the user
 * message and calls source.runAgent(); stop() aborts the in-flight run.
 *
 * Subscription cleanup: the returned Agent does NOT manage its own
 * lifetime. Callers using DI should rely on the provider's destroy hook;
 * direct callers of toAgent() should treat the returned object's
 * lifecycle as tied to the agent instance they constructed.
 */
export function toAgent(source: AbstractAgent): Agent {
  const store: ReducerStore = {
    messages:  signal<Message[]>([]),
    status:    signal<AgentStatus>('idle'),
    isLoading: signal<boolean>(false),
    error:     signal<unknown>(null),
    toolCalls: signal<ToolCall[]>([]),
    state:     signal<Record<string, unknown>>({}),
    events$:   new Subject<AgentEvent>(),
  };

  const subscription: Subscription = source.agent().subscribe({
    next: (evt) => reduceEvent(evt, store),
    // RxJS errors should not silently kill the subscription; surface as
    // a synthetic RUN_ERROR-equivalent.
    error: (err) => {
      store.status.set('error');
      store.isLoading.set(false);
      store.error.set(err);
    },
  });

  let abort: AbortController | undefined;

  return {
    messages:  store.messages,
    status:    store.status,
    isLoading: store.isLoading,
    error:     store.error,
    toolCalls: store.toolCalls,
    state:     store.state,
    events$:   store.events$.asObservable(),
    submit: async (input: AgentSubmitInput, opts?: AgentSubmitOptions) => {
      abort?.abort();
      abort = new AbortController();
      const linkedSignal = opts?.signal
        ? linkAbortSignals(abort.signal, opts.signal)
        : abort.signal;

      // Optimistic append of user message
      const userMsg = buildUserMessage(input);
      if (userMsg) {
        store.messages.update((prev) => [...prev, userMsg]);
      }

      try {
        await source.runAgent({
          messages: store.messages(),
          state:    store.state(),
        }, { signal: linkedSignal });
      } catch (err) {
        // If the abort came from us (stop()), we don't surface an error.
        if (linkedSignal.aborted) return;
        store.status.set('error');
        store.isLoading.set(false);
        store.error.set(err);
      }
    },
    stop: async () => {
      abort?.abort();
    },
  };

  // Returned Agent doesn't expose subscription cleanup. If the caller
  // needs deterministic teardown they unsubscribe via the source agent's
  // own lifecycle. Documented in the spec under "Subscription lifetime."
  void subscription;
}

function buildUserMessage(input: AgentSubmitInput): Message | undefined {
  if (input.message === undefined) return undefined;
  const content = typeof input.message === 'string'
    ? input.message
    : input.message.map((b) => b.type === 'text' ? b.text : JSON.stringify(b)).join('');
  return { id: randomId(), role: 'user', content };
}

function linkAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  if (a.aborted || b.aborted) {
    ctrl.abort();
    return ctrl.signal;
  }
  a.addEventListener('abort', () => ctrl.abort(), { once: true });
  b.addEventListener('abort', () => ctrl.abort(), { once: true });
  return ctrl.signal;
}

function randomId(): string {
  return Math.random().toString(36).slice(2);
}
```

- [ ] **Step 2: Write `to-agent.spec.ts`**

```ts
// libs/ag-ui/src/lib/to-agent.spec.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { Subject } from 'rxjs';
import type { AbstractAgent, BaseEvent } from '@ag-ui/client';
import { toAgent } from './to-agent';

class StubAgent {
  readonly events = new Subject<BaseEvent>();
  runAgent = vi.fn(async () => {});
  abortRun = vi.fn();
  agent() { return this.events.asObservable(); }
}

describe('toAgent', () => {
  it('reduces RUN_STARTED into running status', () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    stub.events.next({ type: 'RUN_STARTED' } as any);
    expect(a.status()).toBe('running');
    expect(a.isLoading()).toBe(true);
  });

  it('appends user message optimistically on submit', async () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    void a.submit({ message: 'hello' });
    expect(a.messages()[0]).toEqual(expect.objectContaining({ role: 'user', content: 'hello' }));
  });

  it('passes current messages and state to runAgent', async () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    stub.events.next({ type: 'STATE_SNAPSHOT', snapshot: { foo: 1 } } as any);
    await a.submit({ message: 'hi' });
    expect(stub.runAgent).toHaveBeenCalledWith(
      expect.objectContaining({ messages: expect.any(Array), state: { foo: 1 } }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('stop() aborts the in-flight run', async () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    let signal: AbortSignal | undefined;
    stub.runAgent = vi.fn(async (_params, opts) => {
      signal = (opts as { signal: AbortSignal }).signal;
      await new Promise((resolve) => signal!.addEventListener('abort', resolve));
    });
    void a.submit({ message: 'hi' });
    await a.stop();
    expect(signal?.aborted).toBe(true);
  });

  it('events$ emits state_update on CUSTOM with that name', () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    const seen: any[] = [];
    a.events$.subscribe((e) => seen.push(e));
    stub.events.next({ type: 'CUSTOM', name: 'state_update', value: { x: 1 } } as any);
    expect(seen).toEqual([{ type: 'state_update', data: { x: 1 } }]);
  });
});
```

- [ ] **Step 3: Write `to-agent.conformance.spec.ts`**

```ts
// libs/ag-ui/src/lib/to-agent.conformance.spec.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Subject } from 'rxjs';
import type { AbstractAgent, BaseEvent } from '@ag-ui/client';
import { runAgentConformance } from '@cacheplane/chat';
import { toAgent } from './to-agent';

class StubAgent {
  readonly events = new Subject<BaseEvent>();
  runAgent = async () => {};
  abortRun = () => {};
  agent() { return this.events.asObservable(); }
}

runAgentConformance('toAgent (AG-UI adapter)', () => {
  return toAgent(new StubAgent() as unknown as AbstractAgent);
});
```

- [ ] **Step 4: Run all ag-ui tests**

```bash
npx nx test ag-ui
```

Expected: PASS for reducer + to-agent + conformance.

- [ ] **Step 5: Commit**

```bash
git add libs/ag-ui/
git commit -m "feat(ag-ui): toAgent wraps AbstractAgent into Agent contract"
```

---

### Task 4: Implement `provideAgUiAgent`

**Files:**
- Modify: `libs/ag-ui/src/lib/provide-ag-ui-agent.ts`
- Create: `libs/ag-ui/src/lib/provide-ag-ui-agent.spec.ts`

- [ ] **Step 1: Implement the provider**

```ts
// libs/ag-ui/src/lib/provide-ag-ui-agent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, inject, Provider } from '@angular/core';
import { HttpAgent } from '@ag-ui/client';
import type { Agent } from '@cacheplane/chat';
import { toAgent } from './to-agent';

export interface AgUiAgentConfig {
  url: string;
  agentId?: string;
  threadId?: string;
  headers?: Record<string, string>;
}

export const AG_UI_AGENT = new InjectionToken<Agent>('AG_UI_AGENT');

export function provideAgUiAgent(config: AgUiAgentConfig): Provider[] {
  return [
    {
      provide: AG_UI_AGENT,
      useFactory: () => {
        const source = new HttpAgent({
          url: config.url,
          ...(config.agentId !== undefined ? { agentId: config.agentId } : {}),
          ...(config.threadId !== undefined ? { threadId: config.threadId } : {}),
          ...(config.headers !== undefined ? { headers: config.headers } : {}),
        });
        return toAgent(source);
      },
    },
  ];
}

/**
 * Convenience helper for components — `inject(AG_UI_AGENT)` directly works
 * the same way; this just exports the typed token.
 */
export function injectAgUiAgent(): Agent {
  return inject(AG_UI_AGENT);
}
```

(Adjust constructor field names — `agentId`, `threadId`, `headers` — to match the actual `HttpAgent` API at the pinned `@ag-ui/client` version. The illustrative shape above mirrors the spec; check the SDK and update.)

- [ ] **Step 2: Spec the provider**

```ts
// libs/ag-ui/src/lib/provide-ag-ui-agent.spec.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAgUiAgent, AG_UI_AGENT } from './provide-ag-ui-agent';

describe('provideAgUiAgent', () => {
  it('registers AG_UI_AGENT in the injector', () => {
    TestBed.configureTestingModule({
      providers: provideAgUiAgent({ url: 'http://example.test/agent' }),
    });
    const agent = TestBed.inject(AG_UI_AGENT);
    expect(agent).toBeDefined();
    expect(typeof agent.submit).toBe('function');
    expect(typeof agent.stop).toBe('function');
  });
});
```

(This test exercises only the DI wiring — no real HTTP. `HttpAgent` is constructed with a URL but no event loop runs.)

- [ ] **Step 3: Re-export from `public-api.ts`**

If not already there, ensure `libs/ag-ui/src/public-api.ts` exports `AG_UI_AGENT` and `injectAgUiAgent`:

```ts
export { provideAgUiAgent, AG_UI_AGENT, injectAgUiAgent } from './lib/provide-ag-ui-agent';
```

- [ ] **Step 4: Run all tests + build**

```bash
npx nx run-many -t lint,test,build -p ag-ui
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/ag-ui/
git commit -m "feat(ag-ui): provideAgUiAgent DI convenience for HttpAgent"
```

---

### Task 5: Cockpit demo

**Files:** new app `cockpit/ag-ui/streaming/angular/`

- [ ] **Step 1: Generate the cockpit Angular app**

Use `cockpit/langgraph/streaming/angular/` as the structural reference.

```bash
npx nx g @nx/angular:application cockpit/ag-ui/streaming/angular --standalone --routing=false --style=css --skipTests=false
```

Adjust the generated `project.json` to mirror the `cockpit-langgraph-streaming-angular` shape (build/serve targets, vite config, etc.).

- [ ] **Step 2: Implement `streaming.component.ts`**

```ts
// cockpit/ag-ui/streaming/angular/src/app/streaming.component.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, inject } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { AG_UI_AGENT } from '@cacheplane/ag-ui';

@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [agent]="agent" />`,
})
export class StreamingComponent {
  protected readonly agent = inject(AG_UI_AGENT);
}
```

- [ ] **Step 3: Wire `app.config.ts`**

```ts
// cockpit/ag-ui/streaming/angular/src/app/app.config.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ApplicationConfig } from '@angular/core';
import { provideAgUiAgent } from '@cacheplane/ag-ui';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgUiAgent({ url: environment.agUiUrl }),
  ],
};
```

- [ ] **Step 4: Add an environment file**

```ts
// cockpit/ag-ui/streaming/angular/src/environments/environment.ts
export const environment = {
  agUiUrl: 'http://localhost:3000/agent',  // demo backend URL; override per env
};
```

If a `.env`-style mechanism exists in the workspace, prefer that. Otherwise, the URL is documented for manual override.

- [ ] **Step 5: Build the cockpit app**

```bash
npx nx build cockpit-ag-ui-streaming-angular
```

Expected: PASS. (If lint complains about an unused `environment` field or a missing one, add a placeholder `production: false`.)

- [ ] **Step 6: Commit**

```bash
git add cockpit/ag-ui/
git commit -m "feat(cockpit): AG-UI streaming demo using @cacheplane/ag-ui"
```

---

### Task 6: Final verification, push, PR

- [ ] **Step 1: Verify no stale references**

```bash
rg "ChatAgent|customEvents\\\$" libs/ag-ui/ cockpit/ag-ui/
```

Expected: zero hits (these belong to old vocabulary).

- [ ] **Step 2: Full lint/test/build**

```bash
npx nx run-many -t lint,test,build -p chat,langgraph,ag-ui
npx nx affected -t build --base=origin/main
```

Expected: all pass.

- [ ] **Step 3: Verify dep graph**

```bash
npx nx graph --file=/tmp/nxgraph.json
jq '.graph.dependencies.chat, .graph.dependencies.langgraph, .graph.dependencies["ag-ui"]' /tmp/nxgraph.json
```

Expected: `chat` does NOT depend on `ag-ui` or `langgraph`. Both `langgraph` and `ag-ui` depend on `chat`.

- [ ] **Step 4: Push**

```bash
git push -u origin feat/ag-ui-adapter
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --title "feat(ag-ui): @cacheplane/ag-ui adapter wrapping @ag-ui/client" --body "$(cat <<'EOF'
## Summary
- New \`@cacheplane/ag-ui\` library providing \`toAgent(source: AbstractAgent): Agent\` and \`provideAgUiAgent({ url })\` DI convenience.
- Pure-function reducer maps AG-UI \`BaseEvent\`s into Agent contract signals + \`events\$\`. Conformance-tested against the shared \`runAgentConformance\` suite.
- Scope: messages + lifecycle + tool calls + state. \`interrupt\`, \`subagents\`, \`history\` deferred.
- Cockpit demo \`cockpit/ag-ui/streaming/angular/\` proves end-to-end decoupling — same \`<chat>\` composition, AG-UI runtime.

## Motivation
Validates the chat-runtime decoupling shipped in #131..#138 by adding a second adapter on a different protocol.

## Test Plan
- [x] \`nx run-many -t lint,test,build -p chat,langgraph,ag-ui\` passes
- [x] \`nx affected -t build\` passes
- [x] Dep graph: \`chat\` independent; \`ag-ui → chat\`, \`langgraph → chat\`
- [ ] Cockpit demo renders against a live AG-UI backend (manual)

## Design + plan
- Spec: \`docs/superpowers/specs/2026-04-27-ag-ui-adapter-design.md\`
- Plan: \`docs/superpowers/plans/2026-04-27-ag-ui-adapter.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of Scope

- `interrupt`, `subagents`, `history` translations from AG-UI events.
- Tool-call streaming with incremental JSON-merge of `args`.
- Custom transports beyond `HttpAgent` for `provideAgUiAgent`.
- Auth / headers configuration beyond `headers?: Record<string, string>`.
- Real-network CI tests for the cockpit demo.
- Shared adapter reducer extraction (deferred until both LangGraph and AG-UI reducers are live).
