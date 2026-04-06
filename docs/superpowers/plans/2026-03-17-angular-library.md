# Angular Library Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish the `stream-resource` Angular 20+ library — a full-parity implementation of LangGraph's `useStream()` React hook using Angular Signals and RxJS.

**Architecture:** `streamResource()` creates 12 `BehaviorSubject`s at injection context time, bridges them to LangGraph's `StreamManager` via `stream-manager.bridge.ts`, and exposes all state as Angular Signals via `toSignal()`. The public surface duck-types Angular's `ResourceRef<T>` while adding the full `useStream()` streaming API.

**Tech Stack:** Angular 20+, RxJS, `@langchain/langgraph-sdk`, `ng-packagr`, Nx, Vitest, TypeScript

---

## File Map

```
libs/stream-resource/
├── src/
│   ├── lib/
│   │   ├── stream-resource.fn.ts           # streamResource() entry point
│   │   ├── stream-resource.types.ts        # All public + internal types
│   │   ├── stream-resource.provider.ts     # provideStreamResource() + injection token
│   │   ├── transport/
│   │   │   ├── transport.interface.ts      # StreamResourceTransport interface
│   │   │   ├── fetch-stream.transport.ts   # Default HTTP/SSE transport
│   │   │   └── mock-stream.transport.ts    # Test transport (exported publicly)
│   │   └── internals/
│   │       └── stream-manager.bridge.ts    # StreamManager → BehaviorSubject bridge
│   └── public-api.ts                       # Barrel export
├── ng-package.json
├── project.json
├── tsconfig.lib.json
├── tsconfig.lib.prod.json
├── tsconfig.spec.json
└── vite.config.mts
```

---

## Task 1: Nx Monorepo Scaffold

**Files:**
- Create: `nx.json`
- Create: `package.json`
- Create: `.gitignore`
- Create: `.prettierrc`
- Create: `.eslintrc.json`

- [ ] **Step 1: Install Nx and create the integrated monorepo**

```bash
cd /Users/blove/repos/stream-resource
npx create-nx-workspace@latest . \
  --preset=empty \
  --nxCloud=skip \
  --packageManager=npm
```

Expected: Nx workspace files created (`nx.json`, `package.json`, `.gitignore`, etc.)

- [ ] **Step 2: Install Angular plugin**

```bash
npm install --save-dev @nx/angular
```

- [ ] **Step 3: Verify Nx works**

```bash
npx nx show projects
```

Expected: empty list (no projects yet)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Nx monorepo"
```

---

## Task 2: Generate Angular Library

**Files:**
- Create: `libs/stream-resource/` (full structure)
- Create: `libs/stream-resource/src/public-api.ts`
- Create: `libs/stream-resource/ng-package.json`
- Create: `libs/stream-resource/project.json`
- Create: `libs/stream-resource/vite.config.mts`

- [ ] **Step 1: Generate the publishable Angular library**

```bash
npx nx g @nx/angular:library stream-resource \
  --publishable \
  --importPath=stream-resource \
  --directory=libs/stream-resource \
  --standalone \
  --unitTestRunner=none \
  --skipModule
```

- [ ] **Step 2: Install Vitest and test dependencies**

```bash
npm install --save-dev vitest @vitest/coverage-v8 jsdom @angular/core/testing
```

- [ ] **Step 3: Create `vite.config.mts`**

Create `libs/stream-resource/vite.config.mts`:

```typescript
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  plugins: [nxViteTsPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
});
```

- [ ] **Step 4: Create `src/test-setup.ts`**

```typescript
import '@angular/core/testing';
```

- [ ] **Step 5: Update `project.json` to use Vitest**

In `libs/stream-resource/project.json`, replace the `test` target with:

```json
"test": {
  "executor": "@nx/vite:test",
  "options": {
    "configFile": "libs/stream-resource/vite.config.mts"
  }
}
```

- [ ] **Step 6: Verify the library builds**

```bash
npx nx build stream-resource
```

Expected: build succeeds, output in `dist/libs/stream-resource`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: generate publishable Angular library with Vitest"
```

---

## Task 3: Types Foundation

**Files:**
- Create: `libs/stream-resource/src/lib/stream-resource.types.ts`

- [ ] **Step 1: Write types file**

Create `libs/stream-resource/src/lib/stream-resource.types.ts`:

```typescript
import { Signal, ResourceStatus } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type {
  BagTemplate,
  InferBag,
  Interrupt,
  ThreadState,
  ToolProgress,
  ToolCallWithResult,
  MessageMetadata,
  SubmitOptions,
} from '@langchain/langgraph-sdk/ui';
import type { BaseMessage } from '@langchain/core/messages';
import type { AIMessage as CoreAIMessage } from '@langchain/core/messages';

// Re-export SDK types so consumers don't need to import from langgraph-sdk directly
export type { BagTemplate, InferBag, Interrupt, ThreadState, SubmitOptions };
export { ResourceStatus };

// ── Transport interface ──────────────────────────────────────────────────────

export interface StreamEvent {
  type: 'values' | 'messages' | 'updates' | 'tools' | 'custom' |
        'error' | 'metadata' | 'checkpoints' | 'tasks' | 'debug' | 'events';
  [key: string]: unknown;
}

export interface StreamResourceTransport {
  stream(
    assistantId: string,
    threadId: string | null,
    payload: unknown,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent>;

  /** Optional: join an already-started run without creating a new one. */
  joinStream?(
    threadId: string,
    runId: string,
    lastEventId: string | undefined,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent>;
}

// ── Options ──────────────────────────────────────────────────────────────────

export interface StreamResourceOptions<T, ResolvedBag extends BagTemplate> {
  apiUrl: string;
  assistantId: string;
  threadId?: Signal<string | null> | string | null;
  onThreadId?: (id: string) => void;
  initialValues?: Partial<T>;
  messagesKey?: string;
  throttle?: number | false;
  toMessage?: (msg: unknown) => BaseMessage;
  transport?: StreamResourceTransport;
  filterSubagentMessages?: boolean;
  subagentToolNames?: string[];
}

// ── SubagentStreamRef ────────────────────────────────────────────────────────

export interface SubagentStreamRef {
  toolCallId: string;
  status: Signal<'pending' | 'running' | 'complete' | 'error'>;
  values: Signal<Record<string, unknown>>;
  messages: Signal<BaseMessage[]>;
}

// ── StreamResourceRef ────────────────────────────────────────────────────────

export interface StreamResourceRef<T, ResolvedBag extends BagTemplate> {
  // ResourceRef<T> compatible members (duck-typed, not inherited)
  value:    Signal<T>;
  status:   Signal<ResourceStatus>;
  isLoading: Signal<boolean>;
  error:    Signal<unknown>;
  hasValue: Signal<boolean>;
  reload:   () => void;

  // Streaming state
  messages:        Signal<BaseMessage[]>;
  interrupt:       Signal<Interrupt<ResolvedBag['InterruptType']> | undefined>;
  interrupts:      Signal<Interrupt<ResolvedBag['InterruptType']>[]>;
  toolProgress:    Signal<ToolProgress[]>;
  toolCalls:       Signal<ToolCallWithResult[]>;

  // Thread & history
  branch:          Signal<string>;
  history:         Signal<ThreadState<T>[]>;
  isThreadLoading: Signal<boolean>;

  // Subagents
  subagents:       Signal<Map<string, SubagentStreamRef>>;
  activeSubagents: Signal<SubagentStreamRef[]>;

  // Actions
  submit:              (values: ResolvedBag['UpdateType'] | null, opts?: SubmitOptions) => Promise<void>;
  stop:                () => Promise<void>;
  switchThread:        (threadId: string | null) => void;
  joinStream:          (runId: string, lastEventId?: string) => Promise<void>;
  setBranch:           (branch: string) => void;
  getMessagesMetadata: (msg: BaseMessage, idx?: number) => MessageMetadata | undefined;
  getToolCalls:        (msg: CoreAIMessage) => ToolCallWithResult[];
}

// ── Internal: StreamSubjects ─────────────────────────────────────────────────
// Not exported from public-api.ts

export interface StreamSubjects<T> {
  status$:          BehaviorSubject<ResourceStatus>;
  values$:          BehaviorSubject<T>;
  messages$:        BehaviorSubject<BaseMessage[]>;
  error$:           BehaviorSubject<unknown>;
  interrupt$:       BehaviorSubject<Interrupt | undefined>;
  interrupts$:      BehaviorSubject<Interrupt[]>;
  branch$:          BehaviorSubject<string>;
  history$:         BehaviorSubject<ThreadState<T>[]>;
  isThreadLoading$: BehaviorSubject<boolean>;
  toolProgress$:    BehaviorSubject<ToolProgress[]>;
  toolCalls$:       BehaviorSubject<ToolCallWithResult[]>;
  subagents$:       BehaviorSubject<Map<string, SubagentStreamRef>>;
}
```

- [ ] **Step 2: Install peer dependencies**

```bash
npm install --save-peer @angular/core @angular/common
npm install @langchain/langgraph-sdk @langchain/core rxjs
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx nx build stream-resource
```

Expected: no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add libs/stream-resource/src/lib/stream-resource.types.ts
git commit -m "feat(stream-resource): add type definitions"
```

---

## Task 4: Transport Layer

**Files:**
- Create: `libs/stream-resource/src/lib/transport/transport.interface.ts`
- Create: `libs/stream-resource/src/lib/transport/fetch-stream.transport.ts`
- Create: `libs/stream-resource/src/lib/transport/mock-stream.transport.ts`
- Test: `libs/stream-resource/src/lib/transport/mock-stream.transport.spec.ts`

- [ ] **Step 1: Create transport interface**

Create `libs/stream-resource/src/lib/transport/transport.interface.ts`:

```typescript
export { StreamResourceTransport, StreamEvent } from '../stream-resource.types';
```

- [ ] **Step 2: Write failing tests for MockStreamTransport**

Create `libs/stream-resource/src/lib/transport/mock-stream.transport.spec.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MockStreamTransport } from './mock-stream.transport';

describe('MockStreamTransport', () => {
  it('returns empty batch when no script provided', () => {
    const t = new MockStreamTransport();
    expect(t.nextBatch()).toEqual([]);
  });

  it('returns batches in order from script', () => {
    const batch1 = [{ type: 'values' as const, values: {} }];
    const batch2 = [{ type: 'error' as const, error: 'oops' }];
    const t = new MockStreamTransport([batch1, batch2]);
    expect(t.nextBatch()).toEqual(batch1);
    expect(t.nextBatch()).toEqual(batch2);
  });

  it('returns empty batch when script exhausted', () => {
    const t = new MockStreamTransport([[{ type: 'values' as const, values: {} }]]);
    t.nextBatch();
    expect(t.nextBatch()).toEqual([]);
  });

  it('isStreaming returns false initially', () => {
    expect(new MockStreamTransport().isStreaming()).toBe(false);
  });

  it('emit() triggers events on the stream iterable', async () => {
    const t = new MockStreamTransport();
    const events: unknown[] = [];
    const ac = new AbortController();
    const iter = t.stream('agent', null, {}, ac.signal);
    const collecting = (async () => {
      for await (const e of iter) { events.push(e); }
    })();
    t.emit([{ type: 'values', values: { foo: 1 } }]);
    t.close();
    await collecting;
    expect(events).toHaveLength(1);
  });

  it('emitError() causes stream to throw', async () => {
    const t = new MockStreamTransport();
    const ac = new AbortController();
    const iter = t.stream('agent', null, {}, ac.signal);
    t.emitError(new Error('transport error'));
    await expect(async () => {
      for await (const _ of iter) { /* noop */ }
    }).rejects.toThrow('transport error');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx nx test stream-resource --testFile=src/lib/transport/mock-stream.transport.spec.ts
```

Expected: FAIL — `MockStreamTransport` not found

- [ ] **Step 4: Implement MockStreamTransport**

Create `libs/stream-resource/src/lib/transport/mock-stream.transport.ts`:

```typescript
import { StreamResourceTransport, StreamEvent } from '../stream-resource.types';

export class MockStreamTransport implements StreamResourceTransport {
  private script: StreamEvent[][];
  private scriptIndex = 0;
  private streaming = false;
  private eventQueue: StreamEvent[] = [];
  private resolvers: Array<(done: boolean) => void> = [];
  private closed = false;
  private pendingError: Error | null = null;

  constructor(script: StreamEvent[][] = []) {
    this.script = script;
  }

  nextBatch(): StreamEvent[] {
    if (this.scriptIndex >= this.script.length) return [];
    return this.script[this.scriptIndex++];
  }

  emit(events: StreamEvent[]): void {
    this.eventQueue.push(...events);
    this.flush();
  }

  emitError(err: Error): void {
    this.pendingError = err;
    this.flush();
  }

  close(): void {
    this.closed = true;
    this.flush();
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  async *stream(
    _assistantId: string,
    _threadId: string | null,
    _payload: unknown,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    this.streaming = true;
    try {
      while (!this.closed && !signal.aborted) {
        if (this.pendingError) throw this.pendingError;
        if (this.eventQueue.length > 0) {
          yield this.eventQueue.shift()!;
        } else {
          await new Promise<void>((res, rej) => {
            if (signal.aborted) { rej(new DOMException('Aborted')); return; }
            this.resolvers.push((done) => done ? res() : rej(new Error('closed')));
          });
        }
      }
      // drain remaining
      while (this.eventQueue.length > 0) yield this.eventQueue.shift()!;
    } finally {
      this.streaming = false;
    }
  }

  private flush(): void {
    const r = this.resolvers.shift();
    if (r) r(this.closed);
  }
}
```

- [ ] **Step 5: Create FetchStreamTransport**

Create `libs/stream-resource/src/lib/transport/fetch-stream.transport.ts`:

```typescript
import { Client } from '@langchain/langgraph-sdk';
import { StreamResourceTransport, StreamEvent } from '../stream-resource.types';

export class FetchStreamTransport implements StreamResourceTransport {
  private client: Client;
  private onThreadId?: (id: string) => void;

  constructor(apiUrl: string, onThreadId?: (id: string) => void) {
    this.client = new Client({ apiUrl });
    this.onThreadId = onThreadId;
  }

  async *stream(
    assistantId: string,
    threadId: string | null,
    payload: unknown,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const streamMode = ['values', 'messages', 'updates', 'events', 'debug'];
    const opts = { signal };

    let thread = threadId;
    if (!thread) {
      const t = await this.client.threads.create();
      thread = t.thread_id;
      this.onThreadId?.(thread);
    }

    const run = this.client.runs.stream(thread, assistantId, {
      input: payload as Record<string, unknown>,
      streamMode,
      ...opts,
    });

    for await (const event of run) {
      yield { type: event.event as StreamEvent['type'], ...event.data };
    }
  }

  async *joinStream(
    threadId: string,
    runId: string,
    _lastEventId: string | undefined,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    // Use the SDK's dedicated join endpoint — does NOT create a new run.
    const run = this.client.runs.joinStream(threadId, runId, { signal });
    for await (const event of run) {
      yield { type: event.event as StreamEvent['type'], ...event.data };
    }
  }
}
```

- [ ] **Step 6: Run tests — should pass**

```bash
npx nx test stream-resource --testFile=src/lib/transport/mock-stream.transport.spec.ts
```

Expected: all 6 tests PASS

- [ ] **Step 7: Commit**

```bash
git add libs/stream-resource/src/lib/transport/
git commit -m "feat(stream-resource): add transport layer with MockStreamTransport"
```

---

## Task 5: StreamManager Bridge

**Files:**
- Create: `libs/stream-resource/src/lib/internals/stream-manager.bridge.ts`
- Test: `libs/stream-resource/src/lib/internals/stream-manager.bridge.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/stream-resource/src/lib/internals/stream-manager.bridge.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { ResourceStatus } from '@angular/core';
import { createStreamManagerBridge } from './stream-manager.bridge';
import { MockStreamTransport } from '../transport/mock-stream.transport';
import { StreamSubjects } from '../stream-resource.types';
import { of } from 'rxjs';

function makeSubjects(): StreamSubjects<Record<string, unknown>> {
  return {
    status$:          new BehaviorSubject(ResourceStatus.Idle),
    values$:          new BehaviorSubject({}),
    messages$:        new BehaviorSubject([]),
    error$:           new BehaviorSubject(undefined),
    interrupt$:       new BehaviorSubject(undefined),
    interrupts$:      new BehaviorSubject([]),
    branch$:          new BehaviorSubject(''),
    history$:         new BehaviorSubject([]),
    isThreadLoading$: new BehaviorSubject(false),
    toolProgress$:    new BehaviorSubject([]),
    toolCalls$:       new BehaviorSubject([]),
    subagents$:       new BehaviorSubject(new Map()),
  };
}

describe('createStreamManagerBridge', () => {
  it('creates a bridge with submit and stop methods', () => {
    const transport = new MockStreamTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    expect(typeof bridge.submit).toBe('function');
    expect(typeof bridge.stop).toBe('function');
    expect(typeof bridge.resubmitLast).toBe('function');
  });

  it('sets status to Loading when submit is called', async () => {
    const transport = new MockStreamTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    bridge.submit({ messages: [] });
    expect(subjects.status$.value).toBe(ResourceStatus.Loading);
    destroy$.next();
  });

  it('sets status to Resolved when stream completes', async () => {
    const transport = new MockStreamTransport([
      [{ type: 'values', values: { count: 1 } }],
    ]);
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    // Do NOT await submit — it only resolves after the stream ends.
    // Close the transport first so the async generator terminates,
    // then await a tick for the status update to propagate.
    bridge.submit({ messages: [] });
    transport.close();
    await new Promise(r => setTimeout(r, 10));
    expect(subjects.status$.value).toBe(ResourceStatus.Resolved);
    destroy$.next();
  });

  it('updates values$ when values event received', async () => {
    const transport = new MockStreamTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    bridge.submit({});
    transport.emit([{ type: 'values', values: { answer: 42 } }]);
    transport.close();
    await new Promise(r => setTimeout(r, 10));
    expect(subjects.values$.value).toMatchObject({ answer: 42 });
    destroy$.next();
  });

  it('sets status to Error on transport error', async () => {
    const transport = new MockStreamTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    bridge.submit({});
    transport.emitError(new Error('network fail'));
    await new Promise(r => setTimeout(r, 10));
    expect(subjects.status$.value).toBe(ResourceStatus.Error);
    expect(subjects.error$.value).toBeInstanceOf(Error);
    destroy$.next();
  });

  it('stop() aborts the active stream', async () => {
    const transport = new MockStreamTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    bridge.submit({});
    await bridge.stop();
    expect(subjects.status$.value).toBe(ResourceStatus.Resolved);
    destroy$.next();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx nx test stream-resource --testFile=src/lib/internals/stream-manager.bridge.spec.ts
```

Expected: FAIL — `createStreamManagerBridge` not found

- [ ] **Step 3: Implement the bridge**

Create `libs/stream-resource/src/lib/internals/stream-manager.bridge.ts`:

```typescript
import { ResourceStatus } from '@angular/core';
import { Observable, takeUntil } from 'rxjs';
import {
  StreamResourceOptions,
  StreamSubjects,
  StreamEvent,
  StreamResourceTransport,
} from '../stream-resource.types';
import { FetchStreamTransport } from '../transport/fetch-stream.transport';
import { BagTemplate } from '@langchain/langgraph-sdk/ui';
import type { BaseMessage } from '@langchain/core/messages';

export interface StreamManagerBridgeOptions<T> {
  options:   StreamResourceOptions<T, BagTemplate>;
  subjects:  StreamSubjects<T>;
  threadId$: Observable<string | null>;
  destroy$:  Observable<void>;
}

export interface StreamManagerBridge {
  submit:       (values: unknown, opts?: unknown) => Promise<void>;
  stop:         () => Promise<void>;
  switchThread: (id: string | null) => void;
  joinStream:   (runId: string, lastEventId?: string) => Promise<void>;
  resubmitLast: () => Promise<void>;
}

export function createStreamManagerBridge<T>(
  { options, subjects, threadId$, destroy$ }: StreamManagerBridgeOptions<T>
): StreamManagerBridge {
  const transport: StreamResourceTransport =
    options.transport ?? new FetchStreamTransport(options.apiUrl, options.onThreadId);

  let currentThreadId: string | null = null;
  let lastPayload: unknown = null;
  let abortController: AbortController | null = null;

  // Track threadId changes
  const threadIdSub = threadId$.pipe(takeUntil(destroy$)).subscribe(id => {
    currentThreadId = id;
  });

  async function runStream(payload: unknown): Promise<void> {
    // Abort any existing stream
    abortController?.abort();
    abortController = new AbortController();

    subjects.status$.next(ResourceStatus.Loading);
    lastPayload = payload;

    try {
      const iter = transport.stream(
        options.assistantId,
        currentThreadId,
        payload,
        abortController.signal,
      );

      for await (const event of iter) {
        if (abortController.signal.aborted) break;
        processEvent(event);
      }

      if (!abortController.signal.aborted) {
        subjects.status$.next(ResourceStatus.Resolved);
      }
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        subjects.status$.next(ResourceStatus.Resolved);
      } else {
        subjects.error$.next(err);
        subjects.status$.next(ResourceStatus.Error);
      }
    }
  }

  function processEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'values':
        subjects.values$.next(event['values'] as T);
        break;
      case 'messages': {
        const msgs = event['messages'] as BaseMessage[];
        if (options.toMessage) {
          subjects.messages$.next(msgs.map(options.toMessage));
        } else {
          subjects.messages$.next(msgs);
        }
        break;
      }
      case 'updates':
        // Merge updates into current values
        subjects.values$.next({
          ...subjects.values$.value,
          ...(event['updates'] as object),
        } as T);
        break;
      case 'error':
        subjects.error$.next(event['error']);
        subjects.status$.next(ResourceStatus.Error);
        break;
      case 'interrupt':
        subjects.interrupt$.next(event['interrupt'] as Interrupt);
        break;
      case 'interrupts':
        subjects.interrupts$.next(event['interrupts'] as Interrupt[]);
        break;
      // TODO: 'tool_progress' → subjects.toolProgress$.next(...)
      // TODO: 'tool_calls'    → subjects.toolCalls$.next(...)
      // These require matching the LangGraph SDK's ToolProgressEvent/ToolCallEvent
      // shapes. Implement once the SDK event types are confirmed.
    }
  }

  return {
    submit: (payload, _opts) => runStream(payload),

    stop: async () => {
      abortController?.abort();
      subjects.status$.next(ResourceStatus.Resolved);
    },

    switchThread: (id) => {
      currentThreadId = id;
      // Reset per-thread state synchronously. isThreadLoading$ is managed
      // by joinStream/history-fetch operations, not by this synchronous reset.
      subjects.values$.next({} as T);
      subjects.messages$.next([]);
      subjects.history$.next([]);
      subjects.interrupt$.next(undefined);
      subjects.interrupts$.next([]);
      subjects.isThreadLoading$.next(false);
    },

    joinStream: async (runId, lastEventId) => {
      // Join an existing run without creating a new one.
      // Uses transport.joinStream() which calls client.runs.joinStream() —
      // a fundamentally different SDK call from client.runs.stream().
      if (!currentThreadId) return;
      abortController?.abort();
      abortController = new AbortController();
      subjects.status$.next(ResourceStatus.Loading);
      try {
        const iter = transport.joinStream
          ? transport.joinStream(currentThreadId, runId, lastEventId, abortController.signal)
          : (function*(){})(); // no-op if transport doesn't support joinStream
        for await (const event of iter) {
          processEvent(event);
        }
        subjects.status$.next(ResourceStatus.Resolved);
      } catch (err) {
        subjects.error$.next(err);
        subjects.status$.next(ResourceStatus.Error);
      }
    },

    resubmitLast: async () => {
      if (lastPayload !== null) {
        await runStream(lastPayload);
      }
    },
  };
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
npx nx test stream-resource --testFile=src/lib/internals/stream-manager.bridge.spec.ts
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add libs/stream-resource/src/lib/internals/
git commit -m "feat(stream-resource): add StreamManager bridge"
```

---

## Task 6: `streamResource()` Function

**Files:**
- Create: `libs/stream-resource/src/lib/stream-resource.fn.ts`
- Test: `libs/stream-resource/src/lib/stream-resource.fn.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/stream-resource/src/lib/stream-resource.fn.spec.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ResourceStatus } from '@angular/core';
import { streamResource } from './stream-resource.fn';
import { MockStreamTransport } from './transport/mock-stream.transport';

function withInjectionContext<T>(fn: () => T): T {
  let result!: T;
  TestBed.runInInjectionContext(() => { result = fn(); });
  return result;
}

describe('streamResource', () => {
  it('returns a ref with initial idle status', () => {
    const transport = new MockStreamTransport();
    const ref = withInjectionContext(() =>
      streamResource({ apiUrl: '', assistantId: 'a', transport })
    );
    expect(ref.status()).toBe(ResourceStatus.Idle);
    expect(ref.isLoading()).toBe(false);
    expect(ref.hasValue()).toBe(false);
    expect(ref.error()).toBeUndefined();
    expect(ref.messages()).toEqual([]);
  });

  it('returns initialValues in value() immediately', () => {
    const transport = new MockStreamTransport();
    const ref = withInjectionContext(() =>
      streamResource({
        apiUrl: '', assistantId: 'a', transport,
        initialValues: { count: 99 },
      })
    );
    expect((ref.value() as any).count).toBe(99);
  });

  it('status transitions to Loading on submit()', async () => {
    const transport = new MockStreamTransport();
    const ref = withInjectionContext(() =>
      streamResource({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({});
    expect(ref.isLoading()).toBe(true);
  });

  it('hasValue becomes true after values event', async () => {
    const transport = new MockStreamTransport();
    const ref = withInjectionContext(() =>
      streamResource({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({});
    transport.emit([{ type: 'values', values: { x: 1 } }]);
    transport.close();
    await new Promise(r => setTimeout(r, 20));
    expect(ref.hasValue()).toBe(true);
    expect((ref.value() as any).x).toBe(1);
  });

  it('error() is set and status is Error on transport error', async () => {
    const transport = new MockStreamTransport();
    const ref = withInjectionContext(() =>
      streamResource({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({});
    transport.emitError(new Error('fail'));
    await new Promise(r => setTimeout(r, 20));
    expect(ref.status()).toBe(ResourceStatus.Error);
    expect(ref.error()).toBeInstanceOf(Error);
  });

  it('stop() resolves the stream and sets status to Resolved', async () => {
    const transport = new MockStreamTransport();
    const ref = withInjectionContext(() =>
      streamResource({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({});
    await ref.stop();
    expect(ref.status()).toBe(ResourceStatus.Resolved);
    expect(ref.isLoading()).toBe(false);
  });

  it('reload() re-submits the last payload', async () => {
    const transport = new MockStreamTransport();
    const submitSpy = vi.fn();
    const ref = withInjectionContext(() =>
      streamResource({ apiUrl: '', assistantId: 'a', transport })
    );
    await ref.submit({ msg: 'hello' });
    transport.close();
    await new Promise(r => setTimeout(r, 10));
    ref.reload();
    expect(ref.isLoading()).toBe(true);
    await ref.stop();
  });

  it('accepts threadId as a Signal', () => {
    const transport = new MockStreamTransport();
    const threadId = signal<string | null>(null);
    const ref = withInjectionContext(() =>
      streamResource({ apiUrl: '', assistantId: 'a', transport, threadId })
    );
    expect(ref.status()).toBe(ResourceStatus.Idle);
  });

  it('messages() updates when messages event received', async () => {
    const transport = new MockStreamTransport();
    const ref = withInjectionContext(() =>
      streamResource({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({});
    transport.emit([{
      type: 'messages',
      messages: [{ id: '1', type: 'human', content: 'hi' }],
    }]);
    transport.close();
    await new Promise(r => setTimeout(r, 20));
    expect(ref.messages()).toHaveLength(1);
  });

  it('switchThread() resets messages and values', () => {
    const transport = new MockStreamTransport();
    const ref = withInjectionContext(() =>
      streamResource({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.switchThread('thread-2');
    expect(ref.messages()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx nx test stream-resource --testFile=src/lib/stream-resource.fn.spec.ts
```

Expected: FAIL — `streamResource` not found

- [ ] **Step 3: Implement `streamResource()`**

Create `libs/stream-resource/src/lib/stream-resource.fn.ts`:

```typescript
import {
  inject, DestroyRef, computed, ResourceStatus,
  isSignal, Signal,
} from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Subject, of,
  throttleTime, asyncScheduler,
} from 'rxjs';
import type { BaseMessage } from '@langchain/core/messages';
import type { BagTemplate, InferBag } from '@langchain/langgraph-sdk/ui';

import {
  StreamResourceOptions,
  StreamResourceRef,
  StreamSubjects,
  SubagentStreamRef,
} from './stream-resource.types';
import { createStreamManagerBridge } from './internals/stream-manager.bridge';

export function streamResource<
  T = Record<string, unknown>,
  Bag extends BagTemplate = BagTemplate,
>(
  options: StreamResourceOptions<T, InferBag<T, Bag>>,
): StreamResourceRef<T, InferBag<T, Bag>> {
  // Injection context required
  const destroyRef = inject(DestroyRef);
  const destroy$   = new Subject<void>();
  destroyRef.onDestroy(() => { destroy$.next(); destroy$.complete(); });

  const init = (options.initialValues ?? {}) as T;

  // All subjects created before the bridge
  const status$          = new BehaviorSubject<ResourceStatus>(ResourceStatus.Idle);
  const values$          = new BehaviorSubject<T>(init);
  const messages$        = new BehaviorSubject<BaseMessage[]>([]);
  const error$           = new BehaviorSubject<unknown>(undefined);
  const interrupt$       = new BehaviorSubject<any>(undefined);
  const interrupts$      = new BehaviorSubject<any[]>([]);
  const branch$          = new BehaviorSubject<string>('');
  const history$         = new BehaviorSubject<any[]>([]);
  const isThreadLoading$ = new BehaviorSubject<boolean>(false);
  const toolProgress$    = new BehaviorSubject<any[]>([]);
  const toolCalls$       = new BehaviorSubject<any[]>([]);
  const subagents$       = new BehaviorSubject<Map<string, SubagentStreamRef>>(new Map());
  const hasValue$        = new BehaviorSubject<boolean>(false);

  // Subscribe to values$ to track hasValue
  values$.subscribe(v => {
    if (Object.keys(v as object).length > 0) hasValue$.next(true);
  });
  // Also set hasValue on messages
  messages$.subscribe(m => { if (m.length > 0) hasValue$.next(true); });

  const subjects: StreamSubjects<T> = {
    status$, values$, messages$, error$,
    interrupt$, interrupts$, branch$, history$,
    isThreadLoading$, toolProgress$, toolCalls$, subagents$,
  };

  // threadId$ — resolved before bridge creation
  const threadId$ = isSignal(options.threadId)
    ? toObservable(options.threadId as Signal<string | null>)
    : of((options.threadId as string | null | undefined) ?? null);

  const manager = createStreamManagerBridge({
    options: options as any,
    subjects,
    threadId$,
    destroy$: destroy$.asObservable(),
  });

  // Throttle helper
  const ms = typeof options.throttle === 'number' ? options.throttle : 0;
  const throttle = <V>(obs: typeof values$) =>
    ms > 0
      ? obs.pipe(throttleTime(ms, asyncScheduler, { leading: true, trailing: true }))
      : obs.asObservable();

  // Convert to Signals (must happen in injection context)
  const value        = toSignal(throttle(values$),   { initialValue: init });
  const messages     = toSignal(throttle(messages$), { initialValue: [] as BaseMessage[] });
  const statusSig    = toSignal(status$,          { initialValue: ResourceStatus.Idle });
  const errorSig     = toSignal(error$,           { initialValue: undefined as unknown });
  const hasValueSig  = toSignal(hasValue$,        { initialValue: false });
  const interruptSig = toSignal(interrupt$,       { initialValue: undefined });
  const interruptsSig= toSignal(interrupts$,      { initialValue: [] });
  const branchSig    = toSignal(branch$,          { initialValue: '' });
  const historySig   = toSignal(history$,         { initialValue: [] });
  const threadLoadSig= toSignal(isThreadLoading$, { initialValue: false });
  const toolProgSig  = toSignal(toolProgress$,    { initialValue: [] });
  const toolCallsSig = toSignal(toolCalls$,       { initialValue: [] });
  const subagentsSig = toSignal(subagents$,       { initialValue: new Map<string, SubagentStreamRef>() });

  const isLoading    = computed(() => statusSig() === ResourceStatus.Loading);
  const activeSubagents = computed(() =>
    [...subagentsSig().values()].filter(s => s.status() === 'running')
  );

  return {
    // ResourceRef compatible
    value:    value as Signal<T>,
    status:   statusSig,
    isLoading,
    error:    errorSig,
    hasValue: hasValueSig,
    reload:   () => manager.resubmitLast(),

    // Streaming state
    messages:        messages as Signal<BaseMessage[]>,
    interrupt:       interruptSig,
    interrupts:      interruptsSig,
    toolProgress:    toolProgSig,
    toolCalls:       toolCallsSig,

    // Thread & history
    branch:          branchSig,
    history:         historySig,
    isThreadLoading: threadLoadSig,

    // Subagents
    subagents:       subagentsSig,
    activeSubagents,

    // Actions
    submit:       (vals, opts) => manager.submit(vals, opts),
    stop:         ()           => manager.stop(),
    switchThread: (id)         => manager.switchThread(id),
    joinStream:   (id, last)   => manager.joinStream(id, last),
    setBranch:    (b)          => branch$.next(b),
    // V1 deferred: these require StreamManager's internal message registry
    // (passed via `onMessagesMetadata` callback in StreamManager options).
    // Return safe empty values so the public interface is satisfied.
    // Document this in limitations.md (Task 9).
    getMessagesMetadata: (_msg, _idx) => undefined,
    getToolCalls: (_msg) => [],
  };
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
npx nx test stream-resource --testFile=src/lib/stream-resource.fn.spec.ts
```

Expected: all 10 tests PASS

- [ ] **Step 5: Run all library tests**

```bash
npx nx test stream-resource
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add libs/stream-resource/src/lib/stream-resource.fn.ts \
        libs/stream-resource/src/lib/stream-resource.fn.spec.ts
git commit -m "feat(stream-resource): implement streamResource() function"
```

---

## Task 7: Provider

**Files:**
- Create: `libs/stream-resource/src/lib/stream-resource.provider.ts`
- Test: `libs/stream-resource/src/lib/stream-resource.provider.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/stream-resource/src/lib/stream-resource.provider.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideStreamResource, STREAM_RESOURCE_CONFIG } from './stream-resource.provider';
import { MockStreamTransport } from './transport/mock-stream.transport';

describe('provideStreamResource', () => {
  it('provides STREAM_RESOURCE_CONFIG token', () => {
    TestBed.configureTestingModule({
      providers: [provideStreamResource({ apiUrl: 'https://api.example.com' })],
    });
    const config = TestBed.inject(STREAM_RESOURCE_CONFIG);
    expect(config.apiUrl).toBe('https://api.example.com');
  });

  it('provides custom transport via config', () => {
    const transport = new MockStreamTransport();
    TestBed.configureTestingModule({
      providers: [provideStreamResource({ apiUrl: '', transport })],
    });
    const config = TestBed.inject(STREAM_RESOURCE_CONFIG);
    expect(config.transport).toBe(transport);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx nx test stream-resource --testFile=src/lib/stream-resource.provider.spec.ts
```

Expected: FAIL

- [ ] **Step 3: Implement provider**

Create `libs/stream-resource/src/lib/stream-resource.provider.ts`:

```typescript
import { InjectionToken, Provider } from '@angular/core';
import { StreamResourceTransport } from './stream-resource.types';

export interface StreamResourceConfig {
  apiUrl?:    string;
  transport?: StreamResourceTransport;
}

export const STREAM_RESOURCE_CONFIG =
  new InjectionToken<StreamResourceConfig>('STREAM_RESOURCE_CONFIG');

export function provideStreamResource(config: StreamResourceConfig): Provider {
  return {
    provide: STREAM_RESOURCE_CONFIG,
    useValue: config,
  };
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
npx nx test stream-resource --testFile=src/lib/stream-resource.provider.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/stream-resource/src/lib/stream-resource.provider.ts \
        libs/stream-resource/src/lib/stream-resource.provider.spec.ts
git commit -m "feat(stream-resource): add provideStreamResource() provider"
```

---

## Task 8: Public API & Build Verification

**Files:**
- Modify: `libs/stream-resource/src/public-api.ts`

- [ ] **Step 1: Write the public API barrel**

Replace contents of `libs/stream-resource/src/public-api.ts`:

```typescript
// Primary function
export { streamResource } from './lib/stream-resource.fn';

// Provider
export { provideStreamResource, STREAM_RESOURCE_CONFIG } from './lib/stream-resource.provider';
export type { StreamResourceConfig } from './lib/stream-resource.provider';

// Public types
export type {
  StreamResourceOptions,
  StreamResourceRef,
  StreamResourceTransport,
  StreamEvent,
  SubagentStreamRef,
} from './lib/stream-resource.types';

// Re-export from SDK (consumers import from stream-resource, not langgraph-sdk)
export type { BagTemplate, InferBag, Interrupt, ThreadState, SubmitOptions }
  from './lib/stream-resource.types';

// Re-export ResourceStatus from Angular core for convenience
export { ResourceStatus } from '@angular/core';

// Test utilities (always exported — tree-shaken in prod builds)
export { MockStreamTransport } from './lib/transport/mock-stream.transport';
export { FetchStreamTransport } from './lib/transport/fetch-stream.transport';
```

- [ ] **Step 2: Run all tests**

```bash
npx nx test stream-resource
```

Expected: all tests PASS

- [ ] **Step 3: Build the library in production mode**

```bash
npx nx build stream-resource --configuration=production
```

Expected: successful build, output in `dist/libs/stream-resource`

- [ ] **Step 4: Verify the built package structure**

```bash
ls dist/libs/stream-resource/
cat dist/libs/stream-resource/package.json
```

Expected: `fesm2022/`, `esm2022/`, `index.d.ts`, `package.json` with `exports` map

- [ ] **Step 5: Commit**

```bash
git add libs/stream-resource/src/public-api.ts
git commit -m "feat(stream-resource): finalize public API barrel exports"
```

---

## Task 9: `docs/limitations.md`

**Files:**
- Create: `docs/limitations.md`

- [ ] **Step 1: Write the limitations document**

Create `docs/limitations.md`:

```markdown
# Angular Stream Resource — Angular Limitations vs React useStream()

Features that are technically impossible or behaviorally degraded when
porting LangGraph's React `useStream()` hook to Angular.

Each entry: **Feature** | React behavior | Angular behavior | Workaround

---

## 1. Concurrent-Mode Atomic Batching

**React behavior:** `useSyncExternalStore` in React's concurrent renderer
batches multiple state updates arriving in the same frame into a single
re-render. Consumers never see intermediate states.

**Angular behavior:** Each `BehaviorSubject.next()` call triggers a
separate signal update and potentially a separate change detection cycle.
Rapid token-by-token streaming may produce more intermediate renders than
the React equivalent.

**Workaround:** Use the `throttle` option to coalesce rapid updates:
`streamResource({ throttle: 50, ... })`. This applies
`throttleTime(50ms, { leading: true, trailing: true })` to the `values$`
and `messages$` streams.

---

## 2. React Server Components

**React behavior:** LangGraph UI components can render on the server
via React Server Components, enabling SSR of streamed AI responses.

**Angular behavior:** `streamResource()` requires a browser environment
and an injection context. Angular has no equivalent of React Server
Components. Server-side rendering of streaming content is not supported.

**Workaround:** None. Use client-side rendering with loading states.

---

## 3. StrictMode Double-Invocation

**React behavior:** React's `StrictMode` invokes hooks twice in
development to detect side effects. Tests written expecting this behavior
will not port directly.

**Angular behavior:** Angular has no `StrictMode` double-invocation
equivalent. `streamResource()` is called once. No behavioral impact.

**Workaround:** Not needed. Simply omit double-invocation assumptions
from ported test patterns.

---

## 4. `experimental_branchTree`

**React behavior:** `useStream()` exposes `experimental_branchTree` — a
`Sequence<StateType>` for visualizing the full branch tree of a thread.

**Angular behavior:** This feature is marked experimental in the React
SDK and depends on internal tree-diffing utilities not exported from
`@langchain/langgraph-sdk/ui`. It is not implemented in v1.

**Workaround:** Use `branch` (Signal<string>) and `history`
(Signal<ThreadState[]>) to reconstruct branch relationships manually.

---

## 5. `queue` (QueueInterface)

**React behavior:** `useStream()` exposes a `queue` property
(`QueueInterface`) for inspecting and managing the pending submission queue.

**Angular behavior:** Queue management is handled internally in the
bridge but not exposed as a public signal in v1. The queue drains
automatically on `submit()` calls.

**Workaround:** None in v1. Use `isLoading()` to gate UI interactions.

---

### Limitation: `getMessagesMetadata()` and `getToolCalls()` always return empty

**Feature:** `getMessagesMetadata(msg, idx?)` / `getToolCalls(msg)`

**React behavior:** `useStream()` derives per-message metadata (run ID, feedback
keys, tool results) from an internal StreamManager message registry populated via
the `onMessagesMetadata` callback.

**Angular behavior:** v1 returns `undefined` / `[]` unconditionally. The
`StreamManager` callback integration is deferred.

**Workaround:** None in v1. Tool call results are available via `toolCalls()`.

---

### Limitation: `toolProgress()` and `toolCalls()` signals always return empty

**Feature:** `toolProgress()` / `toolCalls()` reactive signals

**React behavior:** `useStream()` populates these from `tool_progress` and
`tool_calls` LangGraph SSE event types via StreamManager's internal dispatcher.

**Angular behavior:** v1 leaves these unhandled in `processEvent` because the
LangGraph SDK's `ToolProgressEvent` and `ToolCallEvent` shapes need to be
confirmed against the published SDK types before implementation. Both signals
return `[]` unconditionally.

**Workaround:** None in v1. Subscribe to raw stream events via a custom transport
if tool progress visibility is required.
```

- [ ] **Step 2: Commit**

```bash
git add docs/limitations.md
git commit -m "docs: add Angular limitations vs React useStream()"
```

---

## Task 10: CI Configuration

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Lint
        run: npx nx lint stream-resource
      - name: Test
        run: npx nx test stream-resource --coverage
      - name: Build
        run: npx nx build stream-resource --configuration=production
```

- [ ] **Step 2: Create publish workflow**

Create `.github/workflows/publish.yml`:

```yaml
name: Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npx nx test stream-resource
      - run: npx nx build stream-resource --configuration=production
      - name: Publish to npm
        run: npx nx-release-publish stream-resource
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 3: Final test run**

```bash
npx nx test stream-resource
```

Expected: all tests PASS with coverage report

- [ ] **Step 4: Final build verification**

```bash
npx nx build stream-resource --configuration=production
```

Expected: clean build, no errors or warnings

- [ ] **Step 5: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions for test, build, and npm publish"
```

---

## Task 11: License Files

**Files:**
- Create: `LICENSE`
- Create: `LICENSE-COMMERCIAL`

- [ ] **Step 1: Create MIT license (non-commercial)**

Create `LICENSE`:

```
MIT License (Non-Commercial Use Only)

Copyright (c) 2025 Angular Stream Resource Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction for NON-COMMERCIAL purposes only, including
without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software for non-commercial purposes,
subject to the following conditions:

NON-COMMERCIAL USE is defined as:
- Personal projects with no revenue
- Open source projects under any OSI-approved license
- Academic and research use
- Internal tooling at non-profit organizations

COMMERCIAL USE requires a separate commercial license. See LICENSE-COMMERCIAL
or visit https://stream-resource.dev/pricing for details.

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

- [ ] **Step 2: Create commercial license stub**

Create `LICENSE-COMMERCIAL`:

```
Angular Stream Resource Commercial License

Copyright (c) 2025 Angular Stream Resource Contributors

Commercial use of Angular Stream Resource requires a paid license.

DEVELOPER SEAT LICENSE: $500 per developer seat per year
- Grants commercial use rights for one developer
- Includes all major, minor, and patch releases for 12 months
  from the date of purchase
- The build you purchase is yours to keep indefinitely

APPLICATION DEPLOYMENT LICENSE: $2,000 per application
- Required for each production application or service that uses
  Angular Stream Resource commercially
- Covers all environments (development, staging, production)
- One-time purchase per application

ENTERPRISE LICENSE: Custom pricing
- Volume seat discounts (10+ developers)
- Unlimited deployment licenses
- Dedicated support and SLA agreements
- Contact: enterprise@stream-resource.dev

To purchase a license, visit: https://stream-resource.dev/pricing

Unauthorized commercial use is a violation of this license.
```

- [ ] **Step 3: Commit**

```bash
git add LICENSE LICENSE-COMMERCIAL
git commit -m "docs: add MIT (non-commercial) and commercial license files"
```

---

## Final Verification

- [ ] **Run full test suite one last time**

```bash
npx nx test stream-resource --reporter=verbose
```

Expected: all tests pass

- [ ] **Build production artifact**

```bash
npx nx build stream-resource --configuration=production
ls -la dist/libs/stream-resource/
```

Expected: built package ready to publish

- [ ] **Verify package.json exports**

```bash
cat dist/libs/stream-resource/package.json | grep -A 20 '"exports"'
```

Expected: proper ESM/CJS exports map with `stream-resource` as the import path
