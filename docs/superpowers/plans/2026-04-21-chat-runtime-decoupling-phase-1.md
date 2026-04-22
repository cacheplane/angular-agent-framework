# Chat Runtime Decoupling — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a runtime-neutral `ChatAgent` contract in `@cacheplane/chat`, adapt LangGraph to it, rename `@cacheplane/langgraph` → `@cacheplane/langgraph`, ship an optional `@cacheplane/ag-ui` adapter, and migrate the core chat primitives to consume `ChatAgent`. Website and docs aligned in lockstep.

**Architecture:** Chat owns `ChatAgent` and its data types (AG-UI-shaped but chat-owned). Two adapter packages produce `ChatAgent`: `@cacheplane/langgraph` (wrapping LangGraph SDK, was `@cacheplane/langgraph`) and new `@cacheplane/ag-ui` (wrapping `@ag-ui/client`'s `AbstractAgent`). Chat primitives depend only on `ChatAgent`. Clean break pre-1.0.

**Tech Stack:** TypeScript, Angular 20+, Nx monorepo, Jest/Vitest for unit tests, RxJS (AG-UI adapter only), `@langchain/langgraph-sdk`, `@ag-ui/client`, `@ag-ui/core`.

**Spec reference:** `docs/superpowers/specs/2026-04-21-chat-runtime-decoupling-design.md`

---

## Workstream layout

- **A — Contract** (`@cacheplane/chat`): define `ChatAgent` and data types. Additive; no consumer changes yet.
- **B — Test harness** (`@cacheplane/chat`): `mockChatAgent()` and conformance suite. Enables TDD for migrations.
- **C — LangGraph adapter** (`@cacheplane/langgraph`): add `toChatAgent()`. Additive; existing API untouched.
- **D — Primitive migration** (`@cacheplane/chat`): switch 6 primitives + `chat` composition from `AgentRef` to `ChatAgent`. Breaking.
- **E — Package rename** (`@cacheplane/langgraph` → `@cacheplane/langgraph`). Breaking.
- **F — AG-UI adapter** (new `@cacheplane/ag-ui`): reducer + signals wrapper for `AbstractAgent`.
- **G — Website & docs**: arch diagram, migration guide, capability matrix, AG-UI demo.

Execute A → B → C in order. D, E, F can proceed in parallel once C is merged. G follows D+E+F.

---

## Workstream A — Contract types in `@cacheplane/chat`

### Task A1: Define core `ChatAgent` data types

**Files:**
- Create: `libs/chat/src/lib/agent/chat-message.ts`
- Create: `libs/chat/src/lib/agent/chat-tool-call.ts`
- Create: `libs/chat/src/lib/agent/chat-content-block.ts`
- Create: `libs/chat/src/lib/agent/chat-status.ts`
- Test: `libs/chat/src/lib/agent/chat-message.spec.ts`

- [ ] **Step 1: Write failing test for message type guards**

```ts
// libs/chat/src/lib/agent/chat-message.spec.ts
import { isUserMessage, isAssistantMessage, type ChatMessage } from './chat-message';

describe('ChatMessage', () => {
  it('isUserMessage narrows role', () => {
    const msg: ChatMessage = { id: '1', role: 'user', content: 'hi' };
    expect(isUserMessage(msg)).toBe(true);
    expect(isAssistantMessage(msg)).toBe(false);
  });

  it('isAssistantMessage narrows role', () => {
    const msg: ChatMessage = { id: '2', role: 'assistant', content: 'hello' };
    expect(isAssistantMessage(msg)).toBe(true);
    expect(isUserMessage(msg)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx nx test chat --test-path-pattern=chat-message
```
Expected: FAIL — cannot find module `./chat-message`.

- [ ] **Step 3: Create `chat-content-block.ts`**

```ts
// libs/chat/src/lib/agent/chat-content-block.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export type ChatContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'tool_use'; id: string; name: string; args: unknown }
  | { type: 'tool_result'; toolCallId: string; result: unknown; isError?: boolean };
```

- [ ] **Step 4: Create `chat-status.ts`**

```ts
// libs/chat/src/lib/agent/chat-status.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export type ChatStatus = 'idle' | 'running' | 'error';
```

- [ ] **Step 5: Create `chat-message.ts`**

```ts
// libs/chat/src/lib/agent/chat-message.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChatContentBlock } from './chat-content-block';

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** Plain text, or a list of structured content blocks. */
  content: string | ChatContentBlock[];
  /** Present when role === 'tool'. */
  toolCallId?: string;
  /** Optional display/author name. */
  name?: string;
  /** Runtime-specific extras; do not rely on shape in portable code. */
  extra?: Record<string, unknown>;
}

export function isUserMessage(m: ChatMessage): m is ChatMessage & { role: 'user' } {
  return m.role === 'user';
}

export function isAssistantMessage(m: ChatMessage): m is ChatMessage & { role: 'assistant' } {
  return m.role === 'assistant';
}

export function isToolMessage(m: ChatMessage): m is ChatMessage & { role: 'tool' } {
  return m.role === 'tool';
}

export function isSystemMessage(m: ChatMessage): m is ChatMessage & { role: 'system' } {
  return m.role === 'system';
}
```

- [ ] **Step 6: Create `chat-tool-call.ts`**

```ts
// libs/chat/src/lib/agent/chat-tool-call.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export type ChatToolCallStatus = 'pending' | 'running' | 'complete' | 'error';

export interface ChatToolCall {
  id: string;
  name: string;
  /** Arguments. May be partial while streaming (`status !== 'complete'`). */
  args: unknown;
  status: ChatToolCallStatus;
  /** Present when status === 'complete' or 'error'. */
  result?: unknown;
  /** Optional error payload when status === 'error'. */
  error?: unknown;
}
```

- [ ] **Step 7: Run tests and verify pass**

```bash
npx nx test chat --test-path-pattern=chat-message
```
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add libs/chat/src/lib/agent/
git commit -m "feat(chat): add ChatAgent data types (message, tool call, content block, status)"
```

---

### Task A2: Define `ChatInterrupt`, `ChatSubagent`, submit types

**Files:**
- Create: `libs/chat/src/lib/agent/chat-interrupt.ts`
- Create: `libs/chat/src/lib/agent/chat-subagent.ts`
- Create: `libs/chat/src/lib/agent/chat-submit.ts`

- [ ] **Step 1: Create `chat-interrupt.ts`**

```ts
// libs/chat/src/lib/agent/chat-interrupt.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export interface ChatInterrupt {
  /** Stable identifier for this interrupt instance. */
  id: string;
  /** Opaque payload the app renders. Runtime-specific shape. */
  value: unknown;
  /** True when the runtime supports resuming via `submit({ resume })`. */
  resumable: boolean;
}
```

- [ ] **Step 2: Create `chat-subagent.ts`**

```ts
// libs/chat/src/lib/agent/chat-subagent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Signal } from '@angular/core';
import type { ChatMessage } from './chat-message';

export type ChatSubagentStatus = 'pending' | 'running' | 'complete' | 'error';

export interface ChatSubagent {
  /** Tool call ID that spawned this subagent. */
  toolCallId: string;
  /** Optional human-readable name. */
  name?: string;
  status: Signal<ChatSubagentStatus>;
  messages: Signal<ChatMessage[]>;
  state: Signal<Record<string, unknown>>;
}
```

- [ ] **Step 3: Create `chat-submit.ts`**

```ts
// libs/chat/src/lib/agent/chat-submit.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChatContentBlock } from './chat-content-block';

export interface ChatSubmitInput {
  /** New user message to append. Mutually compatible with `resume` and `state`. */
  message?: string | ChatContentBlock[];
  /** Resume payload for an active interrupt. */
  resume?: unknown;
  /** State patch to merge before submitting (runtime-interpreted). */
  state?: Record<string, unknown>;
}

export interface ChatSubmitOptions {
  signal?: AbortSignal;
}
```

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/agent/
git commit -m "feat(chat): add ChatInterrupt, ChatSubagent, submit input/options types"
```

---

### Task A3: Define `ChatAgent` interface

**Files:**
- Create: `libs/chat/src/lib/agent/chat-agent.ts`
- Test: `libs/chat/src/lib/agent/chat-agent.spec.ts`

- [ ] **Step 1: Write compile-time conformance test**

```ts
// libs/chat/src/lib/agent/chat-agent.spec.ts
import { signal } from '@angular/core';
import type { ChatAgent } from './chat-agent';

describe('ChatAgent interface', () => {
  it('accepts a minimal implementation without optional capabilities', () => {
    const agent: ChatAgent = {
      messages: signal([]),
      status: signal('idle'),
      isLoading: signal(false),
      error: signal(null),
      toolCalls: signal([]),
      state: signal({}),
      submit: async () => {},
      stop: async () => {},
    };
    expect(agent.status()).toBe('idle');
  });

  it('accepts an implementation with interrupts and subagents', () => {
    const agent: ChatAgent = {
      messages: signal([]),
      status: signal('idle'),
      isLoading: signal(false),
      error: signal(null),
      toolCalls: signal([]),
      state: signal({}),
      interrupt: signal(undefined),
      subagents: signal(new Map()),
      submit: async () => {},
      stop: async () => {},
    };
    expect(agent.interrupt?.()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

```bash
npx nx test chat --test-path-pattern=chat-agent
```
Expected: FAIL — cannot find module `./chat-agent`.

- [ ] **Step 3: Create `chat-agent.ts`**

```ts
// libs/chat/src/lib/agent/chat-agent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Signal } from '@angular/core';
import type { ChatMessage } from './chat-message';
import type { ChatToolCall } from './chat-tool-call';
import type { ChatStatus } from './chat-status';
import type { ChatInterrupt } from './chat-interrupt';
import type { ChatSubagent } from './chat-subagent';
import type { ChatSubmitInput, ChatSubmitOptions } from './chat-submit';

/**
 * Runtime-neutral contract chat primitives consume.
 *
 * Implementations are produced by adapters (e.g. `@cacheplane/langgraph`,
 * `@cacheplane/ag-ui`) or by user code for custom backends.
 *
 * `interrupt` and `subagents` are optional: runtimes that do not support
 * these concepts should leave them undefined, and primitives that need them
 * check presence and render a neutral fallback when absent.
 */
export interface ChatAgent {
  // ── Core state ─────────────────────────────────────────────────────────
  messages:  Signal<ChatMessage[]>;
  status:    Signal<ChatStatus>;
  isLoading: Signal<boolean>;
  error:     Signal<unknown>;
  toolCalls: Signal<ChatToolCall[]>;
  state:     Signal<Record<string, unknown>>;

  // ── Actions ────────────────────────────────────────────────────────────
  submit: (input: ChatSubmitInput, opts?: ChatSubmitOptions) => Promise<void>;
  stop:   () => Promise<void>;

  // ── Extended (optional; absent when runtime does not support) ──────────
  interrupt?: Signal<ChatInterrupt | undefined>;
  subagents?: Signal<Map<string, ChatSubagent>>;
}
```

- [ ] **Step 4: Run test and verify pass**

```bash
npx nx test chat --test-path-pattern=chat-agent
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/agent/
git commit -m "feat(chat): define ChatAgent runtime-neutral contract"
```

---

### Task A4: Create `agent/index.ts` barrel and export from `public-api.ts`

**Files:**
- Create: `libs/chat/src/lib/agent/index.ts`
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Create barrel**

```ts
// libs/chat/src/lib/agent/index.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export type { ChatAgent } from './chat-agent';
export type { ChatMessage, ChatRole } from './chat-message';
export { isUserMessage, isAssistantMessage, isToolMessage, isSystemMessage } from './chat-message';
export type { ChatContentBlock } from './chat-content-block';
export type { ChatToolCall, ChatToolCallStatus } from './chat-tool-call';
export type { ChatStatus } from './chat-status';
export type { ChatInterrupt } from './chat-interrupt';
export type { ChatSubagent, ChatSubagentStatus } from './chat-subagent';
export type { ChatSubmitInput, ChatSubmitOptions } from './chat-submit';
```

- [ ] **Step 2: Add to `public-api.ts`**

Append to `libs/chat/src/public-api.ts` after the "Shared types" section:

```ts
// ChatAgent contract (runtime-neutral)
export type {
  ChatAgent,
  ChatMessage,
  ChatRole,
  ChatContentBlock,
  ChatToolCall,
  ChatToolCallStatus,
  ChatStatus,
  ChatInterrupt,
  ChatSubagent,
  ChatSubagentStatus,
  ChatSubmitInput,
  ChatSubmitOptions,
} from './lib/agent';
export {
  isUserMessage,
  isAssistantMessage,
  isToolMessage,
  isSystemMessage,
} from './lib/agent';
```

- [ ] **Step 3: Build the library to verify exports**

```bash
npx nx build chat
```
Expected: SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/agent/index.ts libs/chat/src/public-api.ts
git commit -m "feat(chat): export ChatAgent contract from public-api"
```

---

### Task A5: Document contract in `libs/chat/README.md`

**Files:**
- Modify: `libs/chat/README.md`

- [ ] **Step 1: Add a new section "Runtime adapters" near the top**

Insert after the existing introduction paragraph:

```markdown
## Runtime adapters

Chat primitives consume a runtime-neutral `ChatAgent` contract. Two adapters ship today:

- **`@cacheplane/langgraph`** — for LangGraph / LangGraph Platform backends.
- **`@cacheplane/ag-ui`** — for any AG-UI-compatible backend (LangGraph, CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, CopilotKit runtime).

Custom backends can implement `ChatAgent` directly with no library dependency.

See the capability matrix in the docs site for which primitives require which runtime capabilities.
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/README.md
git commit -m "docs(chat): document runtime-neutral ChatAgent and adapters"
```

---

## Workstream B — Test harness

### Task B1: Create `mockChatAgent()` helper

**Files:**
- Create: `libs/chat/src/lib/testing/mock-chat-agent.ts`
- Test: `libs/chat/src/lib/testing/mock-chat-agent.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
// libs/chat/src/lib/testing/mock-chat-agent.spec.ts
import { mockChatAgent } from './mock-chat-agent';

describe('mockChatAgent', () => {
  it('starts in idle state with empty messages', () => {
    const agent = mockChatAgent();
    expect(agent.status()).toBe('idle');
    expect(agent.isLoading()).toBe(false);
    expect(agent.messages()).toEqual([]);
    expect(agent.toolCalls()).toEqual([]);
    expect(agent.state()).toEqual({});
  });

  it('exposes writable signals for test control', () => {
    const agent = mockChatAgent();
    agent.messages.set([{ id: '1', role: 'user', content: 'hi' }]);
    expect(agent.messages().length).toBe(1);
  });

  it('records submit calls', async () => {
    const agent = mockChatAgent();
    await agent.submit({ message: 'hello' });
    expect(agent.submitCalls).toEqual([{ input: { message: 'hello' }, opts: undefined }]);
  });

  it('accepts initial state overrides', () => {
    const agent = mockChatAgent({
      status: 'running',
      messages: [{ id: '1', role: 'user', content: 'hi' }],
    });
    expect(agent.status()).toBe('running');
    expect(agent.messages().length).toBe(1);
  });

  it('provides interrupt and subagents signals when requested', () => {
    const agent = mockChatAgent({ withInterrupt: true, withSubagents: true });
    expect(agent.interrupt).toBeDefined();
    expect(agent.subagents).toBeDefined();
    expect(agent.interrupt!()).toBeUndefined();
    expect(agent.subagents!().size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx nx test chat --test-path-pattern=mock-chat-agent
```
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the helper**

```ts
// libs/chat/src/lib/testing/mock-chat-agent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal, WritableSignal } from '@angular/core';
import type {
  ChatAgent,
  ChatMessage,
  ChatStatus,
  ChatToolCall,
  ChatInterrupt,
  ChatSubagent,
  ChatSubmitInput,
  ChatSubmitOptions,
} from '../agent';

export interface MockChatAgent extends ChatAgent {
  messages:  WritableSignal<ChatMessage[]>;
  status:    WritableSignal<ChatStatus>;
  isLoading: WritableSignal<boolean>;
  error:     WritableSignal<unknown>;
  toolCalls: WritableSignal<ChatToolCall[]>;
  state:     WritableSignal<Record<string, unknown>>;
  interrupt?: WritableSignal<ChatInterrupt | undefined>;
  subagents?: WritableSignal<Map<string, ChatSubagent>>;
  /** Captured calls to submit() in order. */
  submitCalls: Array<{ input: ChatSubmitInput; opts?: ChatSubmitOptions }>;
  /** Count of stop() invocations. */
  stopCount: number;
}

export interface MockChatAgentOptions {
  messages?: ChatMessage[];
  status?: ChatStatus;
  isLoading?: boolean;
  error?: unknown;
  toolCalls?: ChatToolCall[];
  state?: Record<string, unknown>;
  withInterrupt?: boolean;
  withSubagents?: boolean;
}

export function mockChatAgent(opts: MockChatAgentOptions = {}): MockChatAgent {
  const messages  = signal<ChatMessage[]>(opts.messages ?? []);
  const status    = signal<ChatStatus>(opts.status ?? 'idle');
  const isLoading = signal<boolean>(opts.isLoading ?? false);
  const error     = signal<unknown>(opts.error ?? null);
  const toolCalls = signal<ChatToolCall[]>(opts.toolCalls ?? []);
  const state     = signal<Record<string, unknown>>(opts.state ?? {});

  const interrupt = opts.withInterrupt
    ? signal<ChatInterrupt | undefined>(undefined)
    : undefined;
  const subagents = opts.withSubagents
    ? signal<Map<string, ChatSubagent>>(new Map())
    : undefined;

  const submitCalls: MockChatAgent['submitCalls'] = [];
  let stopCount = 0;

  const agent: MockChatAgent = {
    messages, status, isLoading, error, toolCalls, state,
    ...(interrupt ? { interrupt } : {}),
    ...(subagents ? { subagents } : {}),
    submit: async (input, opts) => { submitCalls.push({ input, opts }); },
    stop: async () => { stopCount++; },
    submitCalls,
    get stopCount() { return stopCount; },
  };

  return agent;
}
```

- [ ] **Step 4: Run tests and verify pass**

```bash
npx nx test chat --test-path-pattern=mock-chat-agent
```
Expected: PASS (5 tests).

- [ ] **Step 5: Export from `public-api.ts`**

Modify `libs/chat/src/public-api.ts` — replace the "Test utilities" section:

```ts
// Test utilities
export { createMockAgentRef } from './lib/testing/mock-agent-ref';
export { mockChatAgent } from './lib/testing/mock-chat-agent';
export type { MockChatAgent, MockChatAgentOptions } from './lib/testing/mock-chat-agent';
```

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/testing/mock-chat-agent.ts libs/chat/src/lib/testing/mock-chat-agent.spec.ts libs/chat/src/public-api.ts
git commit -m "feat(chat): add mockChatAgent() test helper"
```

---

### Task B2: Add `ChatAgent` conformance suite

**Files:**
- Create: `libs/chat/src/lib/testing/chat-agent-conformance.ts`
- Test: `libs/chat/src/lib/testing/chat-agent-conformance.spec.ts`

- [ ] **Step 1: Write the conformance suite**

```ts
// libs/chat/src/lib/testing/chat-agent-conformance.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChatAgent } from '../agent';

/**
 * Runs a suite of contract conformance assertions against a factory that
 * produces a fresh ChatAgent. Adapter packages should call this in their
 * own test suites to verify the contract is satisfied.
 */
export function runChatAgentConformance(
  label: string,
  factory: () => ChatAgent,
): void {
  describe(`${label} — ChatAgent conformance`, () => {
    it('exposes required core signals', () => {
      const a = factory();
      expect(typeof a.messages).toBe('function');
      expect(typeof a.status).toBe('function');
      expect(typeof a.isLoading).toBe('function');
      expect(typeof a.error).toBe('function');
      expect(typeof a.toolCalls).toBe('function');
      expect(typeof a.state).toBe('function');
    });

    it('messages() returns an array', () => {
      expect(Array.isArray(factory().messages())).toBe(true);
    });

    it('toolCalls() returns an array', () => {
      expect(Array.isArray(factory().toolCalls())).toBe(true);
    });

    it('state() returns a plain object', () => {
      const v = factory().state();
      expect(typeof v).toBe('object');
      expect(v).not.toBeNull();
    });

    it('status() returns one of the allowed values', () => {
      expect(['idle', 'running', 'error']).toContain(factory().status());
    });

    it('isLoading() is true only when status === "running"', () => {
      const a = factory();
      if (a.isLoading()) {
        expect(a.status()).toBe('running');
      }
    });

    it('submit() returns a Promise', () => {
      const result = factory().submit({ message: 'test' });
      expect(result).toBeInstanceOf(Promise);
    });

    it('stop() returns a Promise', () => {
      const result = factory().stop();
      expect(result).toBeInstanceOf(Promise);
    });
  });
}
```

- [ ] **Step 2: Write a test that runs the suite against `mockChatAgent()`**

```ts
// libs/chat/src/lib/testing/chat-agent-conformance.spec.ts
import { runChatAgentConformance } from './chat-agent-conformance';
import { mockChatAgent } from './mock-chat-agent';

runChatAgentConformance('mockChatAgent', () => mockChatAgent());
```

- [ ] **Step 3: Run tests**

```bash
npx nx test chat --test-path-pattern=chat-agent-conformance
```
Expected: PASS (8 tests).

- [ ] **Step 4: Export from `public-api.ts`**

Add to the "Test utilities" section:

```ts
export { runChatAgentConformance } from './lib/testing/chat-agent-conformance';
```

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/testing/chat-agent-conformance.ts libs/chat/src/lib/testing/chat-agent-conformance.spec.ts libs/chat/src/public-api.ts
git commit -m "feat(chat): add ChatAgent conformance test suite"
```

---

## Workstream C — LangGraph adapter (`toChatAgent()` in current `@cacheplane/langgraph`)

### Task C1: Add `toChatAgent()` translation function

**Files:**
- Create: `libs/langgraph/src/lib/to-chat-agent.ts`
- Test: `libs/langgraph/src/lib/to-chat-agent.spec.ts`

- [ ] **Step 1: Add peer/runtime dep on `@cacheplane/chat`**

Modify `libs/langgraph/package.json` — add to `peerDependencies`:

```json
"@cacheplane/chat": "^0.0.1"
```

Note: this introduces a reverse coupling which we accept temporarily; the production shape is that chat does not depend on the adapter. The adapter can safely peer-depend on chat because they ship together.

- [ ] **Step 2: Write the failing test**

```ts
// libs/langgraph/src/lib/to-chat-agent.spec.ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { AgentRef } from './agent.types';
import { ResourceStatus } from './agent.types';
import { toChatAgent } from './to-chat-agent';

function stubAgentRef(overrides: Partial<AgentRef<unknown, any>> = {}): AgentRef<unknown, any> {
  return {
    value:           signal<unknown>(null),
    status:          signal<ResourceStatus>(ResourceStatus.Idle),
    isLoading:       signal(false),
    error:           signal<unknown>(null),
    hasValue:        signal(false),
    reload:          () => {},
    messages:        signal([]),
    interrupt:       signal(undefined),
    interrupts:      signal([]),
    toolProgress:    signal([]),
    toolCalls:       signal([]),
    branch:          signal(''),
    history:         signal([]),
    isThreadLoading: signal(false),
    subagents:       signal(new Map()),
    activeSubagents: signal([]),
    customEvents:    signal([]),
    submit:          async () => {},
    stop:            async () => {},
    switchThread:    () => {},
    joinStream:      async () => {},
    setBranch:       () => {},
    getMessagesMetadata: () => undefined,
    getToolCalls:    () => [],
    ...overrides,
  } as AgentRef<unknown, any>;
}

describe('toChatAgent (LangGraph adapter)', () => {
  it('translates HumanMessage to role: user', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({ messages: signal([new HumanMessage({ content: 'hi', id: 'm1' })]) });
      const chat = toChatAgent(ref);
      expect(chat.messages()).toEqual([
        { id: 'm1', role: 'user', content: 'hi', extra: expect.any(Object) },
      ]);
    });
  });

  it('translates AIMessage to role: assistant', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({ messages: signal([new AIMessage({ content: 'hello', id: 'm2' })]) });
      const chat = toChatAgent(ref);
      expect(chat.messages()[0].role).toBe('assistant');
    });
  });

  it('maps ResourceStatus.Loading to ChatStatus "running" and sets isLoading', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({
        status: signal(ResourceStatus.Loading),
        isLoading: signal(true),
      });
      const chat = toChatAgent(ref);
      expect(chat.status()).toBe('running');
      expect(chat.isLoading()).toBe(true);
    });
  });

  it('maps ResourceStatus.Error to ChatStatus "error"', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({ status: signal(ResourceStatus.Error) });
      const chat = toChatAgent(ref);
      expect(chat.status()).toBe('error');
    });
  });

  it('delegates submit to AgentRef.submit with messages[] payload', async () => {
    let captured: unknown = null;
    TestBed.runInInjectionContext(async () => {
      const ref = stubAgentRef({ submit: async (v) => { captured = v; } });
      const chat = toChatAgent(ref);
      await chat.submit({ message: 'hello' });
      expect(captured).toEqual({ messages: [{ role: 'human', content: 'hello' }] });
    });
  });

  it('delegates stop to AgentRef.stop', async () => {
    let stopped = false;
    TestBed.runInInjectionContext(async () => {
      const ref = stubAgentRef({ stop: async () => { stopped = true; } });
      const chat = toChatAgent(ref);
      await chat.stop();
      expect(stopped).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Run test to confirm failure**

```bash
npx nx test langgraph --test-path-pattern=to-chat-agent
```
Expected: FAIL.

- [ ] **Step 4: Implement `toChatAgent()`**

```ts
// libs/langgraph/src/lib/to-chat-agent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { computed, Signal } from '@angular/core';
import type { BaseMessage } from '@langchain/core/messages';
import type { ToolCallWithResult, Interrupt } from '@langchain/langgraph-sdk';
import type {
  ChatAgent,
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
import type { AgentRef, SubagentStreamRef } from './agent.types';
import { ResourceStatus } from './agent.types';

/**
 * Adapts a LangGraph AgentRef to the runtime-neutral ChatAgent contract.
 * The returned object is a live view; it reads from the same signals and
 * writes back via AgentRef.submit / AgentRef.stop.
 *
 * Must be called within an Angular injection context (uses `computed`).
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

  return {
    messages,
    status,
    isLoading: ref.isLoading,
    error:     ref.error,
    toolCalls,
    state,
    interrupt,
    subagents,
    submit: (input: ChatSubmitInput, opts?: ChatSubmitOptions) =>
      ref.submit(buildSubmitPayload(input), opts ? { signal: opts.signal } as never : undefined),
    stop: () => ref.stop(),
  };
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
    id: (m.id as string | undefined) ?? (raw['id'] as string | undefined) ?? cryptoRandom(),
    role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    toolCallId: raw['tool_call_id'] as string | undefined,
    name: raw['name'] as string | undefined,
    extra: raw,
  };
}

function toChatToolCall(tc: ToolCallWithResult): ChatToolCall {
  const hasResult = tc.result !== undefined;
  const status: ChatToolCallStatus = hasResult ? 'complete' : 'running';
  return {
    id: tc.id ?? cryptoRandom(),
    name: tc.name,
    args: tc.args,
    status,
    result: tc.result,
  };
}

function toChatInterrupt(ix: Interrupt<unknown>): ChatInterrupt {
  const raw = ix as unknown as Record<string, unknown>;
  return {
    id: (raw['id'] as string | undefined) ?? 'interrupt',
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

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2);
}
```

Note: the exact `__resume__` key used to carry interrupt resumption through `AgentRef.submit` is a LangGraph-adapter-internal detail. If your current code uses a different convention, substitute it here and document in the adapter's README. For Phase 1 (pre-interrupt-migration) this branch is not exercised.

- [ ] **Step 5: Run tests and verify pass**

```bash
npx nx test langgraph --test-path-pattern=to-chat-agent
```
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add libs/langgraph/src/lib/to-chat-agent.ts libs/langgraph/src/lib/to-chat-agent.spec.ts libs/langgraph/package.json
git commit -m "feat(agent): add toChatAgent() adapter to runtime-neutral ChatAgent contract"
```

---

### Task C2: Export `toChatAgent` from agent package

**Files:**
- Modify: `libs/langgraph/src/public-api.ts`

- [ ] **Step 1: Add export**

Append to `libs/langgraph/src/public-api.ts`:

```ts
// Chat adapter
export { toChatAgent } from './lib/to-chat-agent';
```

- [ ] **Step 2: Build**

```bash
npx nx build langgraph
```
Expected: SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add libs/langgraph/src/public-api.ts
git commit -m "feat(agent): export toChatAgent"
```

---

### Task C3: Run conformance suite against `toChatAgent()`

**Files:**
- Create: `libs/langgraph/src/lib/to-chat-agent.conformance.spec.ts`

- [ ] **Step 1: Write the conformance test**

```ts
// libs/langgraph/src/lib/to-chat-agent.conformance.spec.ts
import { TestBed } from '@angular/core/testing';
import { runChatAgentConformance } from '@cacheplane/chat';
import { toChatAgent } from './to-chat-agent';
import { signal } from '@angular/core';
import { ResourceStatus } from './agent.types';
import type { AgentRef } from './agent.types';

function minimalRef(): AgentRef<unknown, any> {
  return {
    value:           signal<unknown>({}),
    status:          signal<ResourceStatus>(ResourceStatus.Idle),
    isLoading:       signal(false),
    error:           signal<unknown>(null),
    hasValue:        signal(false),
    reload:          () => {},
    messages:        signal([]),
    interrupt:       signal(undefined),
    interrupts:      signal([]),
    toolProgress:    signal([]),
    toolCalls:       signal([]),
    branch:          signal(''),
    history:         signal([]),
    isThreadLoading: signal(false),
    subagents:       signal(new Map()),
    activeSubagents: signal([]),
    customEvents:    signal([]),
    submit:          async () => {},
    stop:            async () => {},
    switchThread:    () => {},
    joinStream:      async () => {},
    setBranch:       () => {},
    getMessagesMetadata: () => undefined,
    getToolCalls:    () => [],
  } as AgentRef<unknown, any>;
}

runChatAgentConformance('toChatAgent', () => {
  let agent!: ReturnType<typeof toChatAgent>;
  TestBed.runInInjectionContext(() => {
    agent = toChatAgent(minimalRef());
  });
  return agent;
});
```

- [ ] **Step 2: Run test**

```bash
npx nx test langgraph --test-path-pattern=to-chat-agent.conformance
```
Expected: PASS (8 tests).

- [ ] **Step 3: Commit**

```bash
git add libs/langgraph/src/lib/to-chat-agent.conformance.spec.ts
git commit -m "test(agent): verify toChatAgent satisfies ChatAgent conformance"
```

---

## Workstream D — Primitive migration

> Strategy: migrate primitives one at a time. Each primitive keeps its old `ref: AgentRef` input path removed and swaps to `agent: ChatAgent`. Tests update from `createMockAgentRef()` to `mockChatAgent()`. Commit after each primitive.

### Task D1: Migrate `chat-input`

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-input/chat-input.component.spec.ts`

- [ ] **Step 1: Update the test to use `mockChatAgent()`**

Replace `createMockAgentRef()` usage with `mockChatAgent()` throughout. Update expectations: `ref.submit(...)` → `agent.submitCalls[0].input` shape `{ message: string }`.

- [ ] **Step 2: Run test — expect failure**

```bash
npx nx test chat --test-path-pattern=chat-input
```
Expected: FAIL — component still uses `AgentRef` type.

- [ ] **Step 3: Update the component**

Replace imports and input in `chat-input.component.ts`:

```ts
import type { ChatAgent } from '@cacheplane/chat';
// remove: import type { AgentRef } from '@cacheplane/langgraph';

export function submitMessage(agent: ChatAgent, text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  void agent.submit({ message: trimmed });
  return trimmed;
}
```

And on the component class, rename the input and update its type:

```ts
readonly agent = input.required<ChatAgent>();
// remove the old `ref` input
```

Note: the component must import from its own package's public entry only when cross-package. Since `chat-input` lives inside chat, use a relative import: `import type { ChatAgent } from '../../agent';`.

- [ ] **Step 4: Update all call sites inside the template / class**

Replace `this.ref()` references with `this.agent()`. Replace `isLoading` / `isThreadLoading` reads with `agent().isLoading()` (thread loading is LangGraph-only; remove any dependency, or gate behind a separate input if the primitive actually needed it — audit during this step).

- [ ] **Step 5: Run test — expect PASS**

```bash
npx nx test chat --test-path-pattern=chat-input
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-input/
git commit -m "refactor(chat): migrate chat-input to ChatAgent contract"
```

---

### Task D2: Migrate `chat-messages`

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-messages/chat-messages.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-messages/chat-messages.component.spec.ts`

- [ ] **Step 1: Update the spec** — replace `createMockAgentRef()` → `mockChatAgent()` and change message fixtures from `new HumanMessage(...)` to plain `ChatMessage` objects: `{ id, role: 'user', content }`.

- [ ] **Step 2: Update `getMessageType()`**

```ts
// libs/chat/src/lib/primitives/chat-messages/chat-messages.component.ts
import type { ChatMessage } from '../../agent';
import type { MessageTemplateType } from '../../chat.types';

export function getMessageType(message: ChatMessage): MessageTemplateType {
  switch (message.role) {
    case 'user':      return 'human';
    case 'assistant': return 'ai';
    case 'tool':      return 'tool';
    case 'system':    return 'system';
    default:          return 'ai';
  }
}
```

- [ ] **Step 3: Update component input**

```ts
readonly agent = input.required<ChatAgent>();

readonly messages = computed(() => this.agent().messages());
```

And update the template to iterate `messages()`.

- [ ] **Step 4: Delete the LangChain `BaseMessage` import** from this file.

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx nx test chat --test-path-pattern=chat-messages
```

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-messages/
git commit -m "refactor(chat): migrate chat-messages to ChatAgent contract"
```

---

### Task D3: Migrate `chat-tool-calls`

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.spec.ts`

- [ ] **Step 1: Update spec** — replace mocks, replace `ToolCallWithResult` fixtures with `ChatToolCall`.

- [ ] **Step 2: Update component**

```ts
// libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts
import type { ChatAgent, ChatMessage, ChatToolCall } from '../../agent';

export class ChatToolCallsComponent {
  readonly agent = input.required<ChatAgent>();
  readonly message = input<ChatMessage | undefined>(undefined);

  readonly templateRef = contentChild(TemplateRef);

  readonly toolCalls = computed((): ChatToolCall[] => {
    const msg = this.message();
    if (msg && msg.role === 'assistant' && Array.isArray(msg.content)) {
      // Filter tool-use blocks embedded in the message (AG-UI style)
      const blocks = msg.content.filter(b => b.type === 'tool_use') as Array<{
        type: 'tool_use'; id: string; name: string; args: unknown;
      }>;
      const all = this.agent().toolCalls();
      return blocks
        .map(b => all.find(tc => tc.id === b.id))
        .filter((x): x is ChatToolCall => !!x);
    }
    return this.agent().toolCalls();
  });
}
```

Remove imports of `AIMessage`, `BaseMessage`, `ToolCallWithResult`, `AgentRef`.

- [ ] **Step 3: Run tests**

```bash
npx nx test chat --test-path-pattern=chat-tool-calls
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-tool-calls/
git commit -m "refactor(chat): migrate chat-tool-calls to ChatAgent contract"
```

---

### Task D4: Migrate `chat-typing-indicator`

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.spec.ts`

- [ ] **Step 1: Update spec** to use `mockChatAgent()`. The `isTyping()` logic depends on `status === 'running' && messages.length > 0 && last-is-user-or-empty-assistant`.

- [ ] **Step 2: Update the `isTyping(agent: ChatAgent): boolean` helper** — take `ChatAgent` instead of `AgentRef`. Use `agent.isLoading()` and `agent.messages()`.

- [ ] **Step 3: Update the component's input from `ref` to `agent`** and all consumers within.

- [ ] **Step 4: Run tests and commit**

```bash
npx nx test chat --test-path-pattern=chat-typing-indicator
git add libs/chat/src/lib/primitives/chat-typing-indicator/
git commit -m "refactor(chat): migrate chat-typing-indicator to ChatAgent contract"
```

---

### Task D5: Migrate `chat-error`

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-error/chat-error.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-error/chat-error.component.spec.ts`

- [ ] **Step 1: Update spec** to use `mockChatAgent({ status: 'error', error: new Error('boom') })`.

- [ ] **Step 2: Update component** — replace `readonly ref = input.required<AgentRef<any, any>>()` with `readonly agent = input.required<ChatAgent>()`; replace `ref().error()` with `agent().error()`.

- [ ] **Step 3: Run tests and commit**

```bash
npx nx test chat --test-path-pattern=chat-error
git add libs/chat/src/lib/primitives/chat-error/
git commit -m "refactor(chat): migrate chat-error to ChatAgent contract"
```

---

### Task D6: Migrate `chat` composition (core path only)

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.spec.ts` (if present)
- Modify: `libs/chat/src/lib/compositions/chat/chat-render-event.ts`

- [ ] **Step 1: Update `chat.component.ts`**

Replace the `ref` input with `agent`:

```ts
import type { ChatAgent } from '../../agent';

@Component({ /* ... */ })
export class ChatComponent {
  readonly agent = input.required<ChatAgent>();
  // retain render registry + other inputs unchanged
}
```

Pass `[agent]="agent()"` down to the migrated child primitives in the template. For `chat-interrupt` and `chat-subagents` (not yet migrated), keep the old `[ref]="...internalLangGraphRef"` pathway behind a capability check; these will be handled in Phase 2.

Because Phase 2 hasn't landed, the easiest approach is: the `chat` composition accepts `agent: ChatAgent` AND an optional escape-hatch input `langgraphRef?: AgentRef` used only to drive the not-yet-migrated interrupt/subagent slots. Add a TODO comment referencing the Phase 2 spec to remove `langgraphRef` later.

- [ ] **Step 2: Update `chat-render-event.ts`** — the `RenderEvent` type already comes from `@cacheplane/render` and does not reference AgentRef; verify no LangGraph imports remain and remove any that do.

- [ ] **Step 3: Run existing chat composition tests**

```bash
npx nx test chat --test-path-pattern=compositions/chat
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/
git commit -m "refactor(chat): migrate chat composition core path to ChatAgent"
```

---

### Task D7: Audit remaining primitives for stray `AgentRef` imports in Phase-1 scope

**Files:**
- Read across `libs/chat/src/`.

- [ ] **Step 1: Find remaining usages**

```bash
npx nx lint chat
```

Then:

```bash
rg --no-heading "@cacheplane/langgraph|AgentRef|BaseMessage" libs/chat/src/lib/primitives/chat-input libs/chat/src/lib/primitives/chat-messages libs/chat/src/lib/primitives/chat-tool-calls libs/chat/src/lib/primitives/chat-typing-indicator libs/chat/src/lib/primitives/chat-error libs/chat/src/lib/compositions/chat
```
Expected: no matches.

If any match is found, extract it into a follow-up task before proceeding. Interrupt, subagents, timeline, debug, generative-ui primitives are out of Phase 1 and may still import `@cacheplane/langgraph` — document this in the composition's file header with a `TODO(phase-2)` or `TODO(phase-3)` comment.

- [ ] **Step 2: Full chat test run**

```bash
npx nx test chat
```
Expected: PASS.

- [ ] **Step 3: Build**

```bash
npx nx build chat
```
Expected: SUCCESS.

- [ ] **Step 4: Commit any follow-up cleanups**

```bash
git add -u libs/chat/
git commit -m "chore(chat): mark remaining primitives as phase-2/phase-3 migration"
```

---

## Workstream E — Rename `@cacheplane/langgraph` → `@cacheplane/langgraph`

### Task E1: Rename the package identifier

**Files:**
- Modify: `libs/langgraph/package.json`
- Modify: `libs/langgraph/project.json`
- Modify: `libs/langgraph/ng-package.json`
- Modify: `libs/langgraph/README.md`

- [ ] **Step 1: Update `package.json`** — set `"name": "@cacheplane/langgraph"`.

- [ ] **Step 2: Update `project.json`** — update any `name` field from `agent` to `langgraph` if Nx project naming should match. Also update `output-path` references accordingly.

- [ ] **Step 3: Update `ng-package.json`** — adjust `dest` path to match renamed package.

- [ ] **Step 4: Update `libs/langgraph/src/lib/agent.provider.ts`**

```ts
const PACKAGE_NAME = '@cacheplane/langgraph';
```

And update `__CACHEPLANE_AGENT_VERSION__` define if present in `vite.config.mts` to `__CACHEPLANE_LANGGRAPH_VERSION__`.

- [ ] **Step 5: Update `libs/langgraph/README.md`** — rename heading and all `@cacheplane/langgraph` references.

- [ ] **Step 6: Do NOT rename the directory** (`libs/langgraph/`) in this task — Nx project paths are stable. Directory rename, if desired, is a separate cleanup follow-up.

- [ ] **Step 7: Commit**

```bash
git add libs/langgraph/package.json libs/langgraph/project.json libs/langgraph/ng-package.json libs/langgraph/README.md libs/langgraph/src/lib/agent.provider.ts
git commit -m "refactor(langgraph): rename @cacheplane/langgraph to @cacheplane/langgraph"
```

---

### Task E2: Update TS path aliases

**Files:**
- Modify: `tsconfig.base.json`

- [ ] **Step 1: Update the path alias**

Replace:
```json
"@cacheplane/langgraph": ["libs/langgraph/src/public-api.ts"]
```
with:
```json
"@cacheplane/langgraph": ["libs/langgraph/src/public-api.ts"]
```

Keep `@cacheplane/langgraph` as an alias pointing to the same entry for one migration tick, OR remove immediately for a clean break (preferred). Choose clean break:

```bash
rg -n '"@cacheplane/langgraph"' tsconfig.base.json
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.base.json
git commit -m "build: retarget @cacheplane/langgraph alias to @cacheplane/langgraph"
```

---

### Task E3: Update all internal imports

**Files:** everything that imports `@cacheplane/langgraph`.

- [ ] **Step 1: Find all internal callers**

```bash
rg -l "@cacheplane/langgraph" libs apps
```

- [ ] **Step 2: Perform the replacement** (manually or via sed with review)

For each matching file, replace `@cacheplane/langgraph` with `@cacheplane/langgraph`:

```bash
rg -l "@cacheplane/langgraph" libs apps | xargs sed -i '' 's|@cacheplane/langgraph|@cacheplane/langgraph|g'
```

- [ ] **Step 3: Verify no matches remain**

```bash
rg "@cacheplane/langgraph" libs apps
```
Expected: no matches (outside of spec/plan docs and historical CHANGELOG entries).

- [ ] **Step 4: Build all affected projects**

```bash
npx nx run-many -t build -p chat agent website
```
Expected: SUCCESS.

- [ ] **Step 5: Test all affected projects**

```bash
npx nx run-many -t test -p chat agent
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "refactor: replace @cacheplane/langgraph imports with @cacheplane/langgraph"
```

---

### Task E4: Update licensing telemetry package string

**Files:**
- Modify: `libs/licensing/README.md`

- [ ] **Step 1: Replace `@cacheplane/langgraph` mentions with `@cacheplane/langgraph`** in the README.

- [ ] **Step 2: Note** — licensing specs test arbitrary package name strings and do not need code changes.

- [ ] **Step 3: Commit**

```bash
git add libs/licensing/README.md
git commit -m "docs(licensing): update consumer list to @cacheplane/langgraph"
```

---

### Task E5: Add a tombstone-package README redirect

**Files:**
- Create: `.changeset/chat-runtime-decoupling.md` (or `CHANGELOG.md` entry in affected libs)

- [ ] **Step 1: Add a repo-level migration note**

Create or append to `docs/migrations/2026-04-21-cacheplane-angular-to-langgraph.md`:

```markdown
# Migration: `@cacheplane/langgraph` → `@cacheplane/langgraph`

**Date:** 2026-04-21

The LangGraph adapter package has been renamed. Replace all imports:

```ts
// before
import { agent, provideAgent } from '@cacheplane/langgraph';

// after
import { agent, provideAgent } from '@cacheplane/langgraph';
```

`@cacheplane/langgraph` is no longer published. The rename reflects the package's actual role (LangGraph SDK adapter) and makes room for additional framework-level packages.

In the same release, chat primitives migrated from `AgentRef` to the runtime-neutral `ChatAgent` contract. Use `toChatAgent(agentRef)` to adapt:

```ts
import { agent } from '@cacheplane/langgraph';
import { toChatAgent } from '@cacheplane/langgraph';

const ref = agent({ apiUrl, assistantId });
const chatAgent = toChatAgent(ref);
// pass chatAgent to <cp-chat [agent]="chatAgent()">
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/migrations/
git commit -m "docs: add migration guide for @cacheplane/langgraph rename"
```

---

## Workstream F — New `@cacheplane/ag-ui` adapter package

### Task F1: Scaffold the Nx library

**Files:**
- Create: `libs/ag-ui/` (Nx scaffolded)

- [ ] **Step 1: Generate the library**

```bash
npx nx g @nx/angular:library --name=ag-ui --directory=libs/ag-ui --buildable --publishable --importPath=@cacheplane/ag-ui --standalone --skipTests=false --style=none
```

- [ ] **Step 2: Update `package.json` peer deps**

```json
{
  "name": "@cacheplane/ag-ui",
  "version": "0.0.1",
  "peerDependencies": {
    "@angular/core": "^20.0.0 || ^21.0.0",
    "@cacheplane/chat": "^0.0.1",
    "@cacheplane/licensing": "^0.0.1",
    "@ag-ui/client": "^0.0.1",
    "@ag-ui/core": "^0.0.1",
    "rxjs": "~7.8.0"
  },
  "license": "PolyForm-Noncommercial-1.0.0",
  "sideEffects": false
}
```

(Pin to the current `@ag-ui/client` / `@ag-ui/core` versions available on npm; update the ranges accordingly.)

- [ ] **Step 3: Install**

```bash
npm install
```

- [ ] **Step 4: Commit scaffold**

```bash
git add libs/ag-ui/ tsconfig.base.json package.json package-lock.json
git commit -m "chore(ag-ui): scaffold @cacheplane/ag-ui adapter package"
```

---

### Task F2: Implement the event reducer (pure function, no Angular)

**Files:**
- Create: `libs/ag-ui/src/lib/reducer/ag-ui-state.ts`
- Create: `libs/ag-ui/src/lib/reducer/reduce-event.ts`
- Test: `libs/ag-ui/src/lib/reducer/reduce-event.spec.ts`

- [ ] **Step 1: Define the reducer state shape**

```ts
// libs/ag-ui/src/lib/reducer/ag-ui-state.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ChatMessage, ChatToolCall, ChatStatus } from '@cacheplane/chat';

export interface AgUiReducerState {
  messages: ChatMessage[];
  toolCalls: ChatToolCall[];
  state: Record<string, unknown>;
  status: ChatStatus;
  error: unknown;
}

export function initialAgUiState(): AgUiReducerState {
  return {
    messages: [],
    toolCalls: [],
    state: {},
    status: 'idle',
    error: null,
  };
}
```

- [ ] **Step 2: Write the failing reducer test**

```ts
// libs/ag-ui/src/lib/reducer/reduce-event.spec.ts
import { initialAgUiState } from './ag-ui-state';
import { reduceEvent } from './reduce-event';

describe('reduceEvent', () => {
  it('RUN_STARTED sets status to running', () => {
    const s = reduceEvent(initialAgUiState(), { type: 'RUN_STARTED' } as never);
    expect(s.status).toBe('running');
    expect(s.error).toBeNull();
  });

  it('RUN_FINISHED sets status to idle', () => {
    const s1 = reduceEvent(initialAgUiState(), { type: 'RUN_STARTED' } as never);
    const s2 = reduceEvent(s1, { type: 'RUN_FINISHED' } as never);
    expect(s2.status).toBe('idle');
  });

  it('RUN_ERROR sets status to error and captures error', () => {
    const s = reduceEvent(initialAgUiState(), { type: 'RUN_ERROR', error: 'boom' } as never);
    expect(s.status).toBe('error');
    expect(s.error).toBe('boom');
  });

  it('TEXT_MESSAGE_START appends an empty assistant message', () => {
    const s = reduceEvent(initialAgUiState(), { type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' } as never);
    expect(s.messages).toEqual([{ id: 'm1', role: 'assistant', content: '' }]);
  });

  it('TEXT_MESSAGE_CONTENT appends delta to matching message', () => {
    const s1 = reduceEvent(initialAgUiState(), { type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' } as never);
    const s2 = reduceEvent(s1, { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Hello' } as never);
    const s3 = reduceEvent(s2, { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: ' world' } as never);
    expect(s3.messages[0].content).toBe('Hello world');
  });

  it('TOOL_CALL_START registers a running tool call', () => {
    const s = reduceEvent(initialAgUiState(), {
      type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search',
    } as never);
    expect(s.toolCalls).toEqual([{ id: 't1', name: 'search', args: undefined, status: 'running' }]);
  });

  it('TOOL_CALL_RESULT completes the matching tool call', () => {
    const s1 = reduceEvent(initialAgUiState(), {
      type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search',
    } as never);
    const s2 = reduceEvent(s1, {
      type: 'TOOL_CALL_RESULT', toolCallId: 't1', result: { hits: 3 },
    } as never);
    expect(s2.toolCalls[0].status).toBe('complete');
    expect(s2.toolCalls[0].result).toEqual({ hits: 3 });
  });

  it('STATE_SNAPSHOT replaces state', () => {
    const s = reduceEvent(initialAgUiState(), {
      type: 'STATE_SNAPSHOT', snapshot: { a: 1 },
    } as never);
    expect(s.state).toEqual({ a: 1 });
  });
});
```

- [ ] **Step 3: Run test — expect failure**

```bash
npx nx test ag-ui --test-path-pattern=reduce-event
```
Expected: FAIL.

- [ ] **Step 4: Implement the reducer**

```ts
// libs/ag-ui/src/lib/reducer/reduce-event.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { BaseEvent } from '@ag-ui/core';
import type { AgUiReducerState } from './ag-ui-state';

/**
 * Pure reducer: fold an AG-UI event into the accumulator state.
 *
 * Phase 1 handles lifecycle + text messages + tool calls + state events.
 * Reasoning, interrupts, and sub-agents ship in Phase 2.
 */
export function reduceEvent(s: AgUiReducerState, ev: BaseEvent): AgUiReducerState {
  const e = ev as unknown as Record<string, unknown>;
  switch (ev.type) {
    case 'RUN_STARTED':
      return { ...s, status: 'running', error: null };
    case 'RUN_FINISHED':
      return { ...s, status: 'idle' };
    case 'RUN_ERROR':
      return { ...s, status: 'error', error: e['error'] ?? e['message'] ?? null };

    case 'TEXT_MESSAGE_START': {
      const id = String(e['messageId']);
      const role = (e['role'] as 'assistant' | 'user' | 'tool' | 'system') ?? 'assistant';
      return { ...s, messages: [...s.messages, { id, role, content: '' }] };
    }
    case 'TEXT_MESSAGE_CONTENT': {
      const id = String(e['messageId']);
      const delta = String(e['delta'] ?? '');
      return {
        ...s,
        messages: s.messages.map(m =>
          m.id === id && typeof m.content === 'string'
            ? { ...m, content: m.content + delta }
            : m,
        ),
      };
    }
    case 'TEXT_MESSAGE_END':
      return s;

    case 'TOOL_CALL_START': {
      const id = String(e['toolCallId']);
      const name = String(e['toolCallName'] ?? e['name'] ?? '');
      return { ...s, toolCalls: [...s.toolCalls, { id, name, args: undefined, status: 'running' }] };
    }
    case 'TOOL_CALL_ARGS': {
      const id = String(e['toolCallId']);
      const delta = String(e['delta'] ?? '');
      return {
        ...s,
        toolCalls: s.toolCalls.map(tc =>
          tc.id === id ? { ...tc, args: appendArgs(tc.args, delta) } : tc,
        ),
      };
    }
    case 'TOOL_CALL_END':
      return s;
    case 'TOOL_CALL_RESULT': {
      const id = String(e['toolCallId']);
      const result = e['result'];
      return {
        ...s,
        toolCalls: s.toolCalls.map(tc =>
          tc.id === id ? { ...tc, status: 'complete', result } : tc,
        ),
      };
    }

    case 'STATE_SNAPSHOT':
      return { ...s, state: (e['snapshot'] as Record<string, unknown>) ?? {} };
    case 'STATE_DELTA': {
      const patch = (e['delta'] as Array<{ op: string; path: string; value?: unknown }>) ?? [];
      return { ...s, state: applyJsonPatch(s.state, patch) };
    }

    default:
      return s;
  }
}

function appendArgs(current: unknown, delta: string): unknown {
  const prev = typeof current === 'string' ? current : '';
  return prev + delta;
}

function applyJsonPatch(
  target: Record<string, unknown>,
  patch: Array<{ op: string; path: string; value?: unknown }>,
): Record<string, unknown> {
  // Minimal patch implementation sufficient for Phase 1 snapshots/deltas.
  // Replace with a battle-tested library (e.g. `fast-json-patch`) in Phase 2.
  const out = structuredClone(target);
  for (const p of patch) {
    const segs = p.path.split('/').filter(Boolean);
    if (p.op === 'replace' || p.op === 'add') {
      setAt(out, segs, p.value);
    } else if (p.op === 'remove') {
      removeAt(out, segs);
    }
  }
  return out;
}

function setAt(obj: Record<string, unknown>, segs: string[], value: unknown): void {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    if (typeof cur[seg] !== 'object' || cur[seg] === null) cur[seg] = {};
    cur = cur[seg] as Record<string, unknown>;
  }
  cur[segs[segs.length - 1]] = value;
}

function removeAt(obj: Record<string, unknown>, segs: string[]): void {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const next = cur[segs[i]];
    if (typeof next !== 'object' || next === null) return;
    cur = next as Record<string, unknown>;
  }
  delete cur[segs[segs.length - 1]];
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npx nx test ag-ui --test-path-pattern=reduce-event
```

- [ ] **Step 6: Commit**

```bash
git add libs/ag-ui/src/lib/reducer/
git commit -m "feat(ag-ui): add event reducer for Phase 1 event set"
```

---

### Task F3: Implement `toChatAgent(abstractAgent)`

**Files:**
- Create: `libs/ag-ui/src/lib/to-chat-agent.ts`
- Test: `libs/ag-ui/src/lib/to-chat-agent.spec.ts`

- [ ] **Step 1: Write failing test with a fake Observable agent**

```ts
// libs/ag-ui/src/lib/to-chat-agent.spec.ts
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { toChatAgent } from './to-chat-agent';

function fakeAgent(events$: Subject<unknown>) {
  return {
    messages: [],
    state: {},
    agentId: 'a',
    threadId: 't',
    run: () => events$ as unknown as Observable<unknown>,
    runAgent: (_input: unknown) => events$.asObservable(),
  };
}

describe('toChatAgent (AG-UI adapter)', () => {
  it('accumulates text message content across events', async () => {
    const subj = new Subject<any>();
    let agent!: ReturnType<typeof toChatAgent>;
    TestBed.runInInjectionContext(() => {
      agent = toChatAgent(fakeAgent(subj) as never);
    });
    await agent.submit({ message: 'hi' });
    subj.next({ type: 'RUN_STARTED' });
    subj.next({ type: 'TEXT_MESSAGE_START', messageId: 'm', role: 'assistant' });
    subj.next({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'Hi ' });
    subj.next({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'there' });
    subj.next({ type: 'RUN_FINISHED' });
    expect(agent.messages().find(m => m.id === 'm')?.content).toContain('Hi there');
    expect(agent.status()).toBe('idle');
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx nx test ag-ui --test-path-pattern=to-chat-agent
```

- [ ] **Step 3: Implement**

```ts
// libs/ag-ui/src/lib/to-chat-agent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal, computed } from '@angular/core';
import type { AbstractAgent } from '@ag-ui/client';
import type { BaseEvent } from '@ag-ui/core';
import type { ChatAgent, ChatSubmitInput, ChatSubmitOptions } from '@cacheplane/chat';
import { initialAgUiState, type AgUiReducerState } from './reducer/ag-ui-state';
import { reduceEvent } from './reducer/reduce-event';
import type { Subscription } from 'rxjs';

/**
 * Adapt an `@ag-ui/client` AbstractAgent to the ChatAgent contract.
 * Must be called within an Angular injection context.
 */
export function toChatAgent(source: AbstractAgent): ChatAgent {
  const state$ = signal<AgUiReducerState>(initialAgUiState());
  let currentSub: Subscription | null = null;

  const messages  = computed(() => state$().messages);
  const toolCalls = computed(() => state$().toolCalls);
  const agentState = computed(() => state$().state);
  const status    = computed(() => state$().status);
  const error     = computed(() => state$().error);
  const isLoading = computed(() => state$().status === 'running');

  return {
    messages, status, isLoading, error, toolCalls,
    state: agentState,

    submit: async (input: ChatSubmitInput, opts?: ChatSubmitOptions) => {
      currentSub?.unsubscribe();
      if (input.message !== undefined) {
        const text = typeof input.message === 'string'
          ? input.message
          : input.message.map(b => (b.type === 'text' ? b.text : '')).join('');
        source.messages.push({ role: 'user', content: text } as never);
      }
      const obs = source.runAgent({
        runId: crypto.randomUUID(),
        tools: [],
        context: [],
      } as never);
      currentSub = obs.subscribe({
        next: (ev: BaseEvent) => state$.update(s => reduceEvent(s, ev)),
        error: (err: unknown) =>
          state$.update(s => ({ ...s, status: 'error', error: err })),
        complete: () => {
          if (state$().status === 'running') {
            state$.update(s => ({ ...s, status: 'idle' }));
          }
        },
      });
      if (opts?.signal) {
        opts.signal.addEventListener('abort', () => currentSub?.unsubscribe(), { once: true });
      }
    },

    stop: async () => {
      currentSub?.unsubscribe();
      currentSub = null;
      state$.update(s => s.status === 'running' ? { ...s, status: 'idle' } : s);
    },
  };
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx nx test ag-ui --test-path-pattern=to-chat-agent
```

- [ ] **Step 5: Commit**

```bash
git add libs/ag-ui/src/lib/to-chat-agent.ts libs/ag-ui/src/lib/to-chat-agent.spec.ts
git commit -m "feat(ag-ui): implement toChatAgent(abstractAgent)"
```

---

### Task F4: Add convenience `provideAgUiAgent()` DI helper

**Files:**
- Create: `libs/ag-ui/src/lib/provide-ag-ui-agent.ts`
- Test: `libs/ag-ui/src/lib/provide-ag-ui-agent.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
// libs/ag-ui/src/lib/provide-ag-ui-agent.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideAgUiAgent, AG_UI_CHAT_AGENT } from './provide-ag-ui-agent';

describe('provideAgUiAgent', () => {
  it('registers an injectable ChatAgent backed by an HttpAgent', () => {
    TestBed.configureTestingModule({
      providers: [provideAgUiAgent({ url: 'http://localhost:4000/agent' })],
    });
    const agent = TestBed.inject(AG_UI_CHAT_AGENT);
    expect(typeof agent.submit).toBe('function');
    expect(agent.status()).toBe('idle');
  });
});
```

- [ ] **Step 2: Implement**

```ts
// libs/ag-ui/src/lib/provide-ag-ui-agent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, makeEnvironmentProviders, inject, runInInjectionContext, EnvironmentInjector } from '@angular/core';
import { HttpAgent } from '@ag-ui/client';
import type { ChatAgent } from '@cacheplane/chat';
import { toChatAgent } from './to-chat-agent';

export interface AgUiAgentConfig {
  url: string;
  agentId?: string;
  threadId?: string;
  headers?: Record<string, string>;
}

export const AG_UI_CHAT_AGENT = new InjectionToken<ChatAgent>('AG_UI_CHAT_AGENT');

export function provideAgUiAgent(config: AgUiAgentConfig) {
  return makeEnvironmentProviders([
    {
      provide: AG_UI_CHAT_AGENT,
      useFactory: () => {
        const injector = inject(EnvironmentInjector);
        const http = new HttpAgent({
          url: config.url,
          agentId: config.agentId,
          threadId: config.threadId,
          headers: config.headers,
        } as never);
        return runInInjectionContext(injector, () => toChatAgent(http));
      },
    },
  ]);
}
```

- [ ] **Step 3: Run test — PASS**

```bash
npx nx test ag-ui --test-path-pattern=provide-ag-ui-agent
```

- [ ] **Step 4: Commit**

```bash
git add libs/ag-ui/src/lib/provide-ag-ui-agent.ts libs/ag-ui/src/lib/provide-ag-ui-agent.spec.ts
git commit -m "feat(ag-ui): add provideAgUiAgent DI helper"
```

---

### Task F5: Export public API and run conformance against AG-UI adapter

**Files:**
- Modify: `libs/ag-ui/src/public-api.ts` (or `index.ts`)
- Create: `libs/ag-ui/src/lib/to-chat-agent.conformance.spec.ts`

- [ ] **Step 1: Write public API**

```ts
// libs/ag-ui/src/public-api.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
export { toChatAgent } from './lib/to-chat-agent';
export { provideAgUiAgent, AG_UI_CHAT_AGENT } from './lib/provide-ag-ui-agent';
export type { AgUiAgentConfig } from './lib/provide-ag-ui-agent';
export { reduceEvent } from './lib/reducer/reduce-event';
export { initialAgUiState } from './lib/reducer/ag-ui-state';
export type { AgUiReducerState } from './lib/reducer/ag-ui-state';
```

- [ ] **Step 2: Conformance test**

```ts
// libs/ag-ui/src/lib/to-chat-agent.conformance.spec.ts
import { TestBed } from '@angular/core/testing';
import { runChatAgentConformance } from '@cacheplane/chat';
import { Subject } from 'rxjs';
import { toChatAgent } from './to-chat-agent';

const fake = () => ({
  messages: [], state: {}, agentId: 'a', threadId: 't',
  run: () => new Subject(), runAgent: () => new Subject(),
});

runChatAgentConformance('toChatAgent(AG-UI)', () => {
  let agent!: ReturnType<typeof toChatAgent>;
  TestBed.runInInjectionContext(() => { agent = toChatAgent(fake() as never); });
  return agent;
});
```

- [ ] **Step 3: Run**

```bash
npx nx test ag-ui
```
Expected: all tests PASS.

- [ ] **Step 4: Build**

```bash
npx nx build ag-ui
```
Expected: SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add libs/ag-ui/src/public-api.ts libs/ag-ui/src/lib/to-chat-agent.conformance.spec.ts
git commit -m "feat(ag-ui): export public API and verify conformance"
```

---

### Task F6: Write `libs/ag-ui/README.md`

**Files:**
- Create/Modify: `libs/ag-ui/README.md`

- [ ] **Step 1: Write README**

```markdown
# @cacheplane/ag-ui

Adapts `@ag-ui/client`'s `AbstractAgent` to the runtime-neutral `ChatAgent` contract consumed by `@cacheplane/chat` primitives.

Use this package when your backend speaks the AG-UI protocol — LangGraph Platform, CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, or any other AG-UI-compatible runtime.

## Install

```bash
npm install @cacheplane/ag-ui @cacheplane/chat @ag-ui/client
```

## Usage

```ts
import { provideAgUiAgent, AG_UI_CHAT_AGENT } from '@cacheplane/ag-ui';

bootstrapApplication(AppComponent, {
  providers: [
    provideChat({ ... }),
    provideAgUiAgent({ url: 'https://my-agent.example.com' }),
  ],
});

// In a component:
readonly agent = inject(AG_UI_CHAT_AGENT);
// <cp-chat [agent]="agent" />
```

Or adapt an existing agent instance:

```ts
import { toChatAgent } from '@cacheplane/ag-ui';
import { HttpAgent } from '@ag-ui/client';

const http = new HttpAgent({ url: '...' });
const chat = toChatAgent(http); // call inside an injection context
```

## What's covered

Phase 1 maps these AG-UI events:

- `RUN_STARTED` / `RUN_FINISHED` / `RUN_ERROR` → `status`, `error`
- `TEXT_MESSAGE_START` / `_CONTENT` / `_END` → `messages`
- `TOOL_CALL_START` / `_ARGS` / `_END` / `_RESULT` → `toolCalls`
- `STATE_SNAPSHOT` / `STATE_DELTA` (JSON Patch) → `state`

Interrupts, sub-agents, and reasoning events are handled in Phase 2.
```

- [ ] **Step 2: Commit**

```bash
git add libs/ag-ui/README.md
git commit -m "docs(ag-ui): add README"
```

---

## Workstream G — Website & docs

### Task G1: Update architecture diagram on the website

**Files:**
- Audit: `apps/website/src/` for existing arch diagrams.

- [ ] **Step 1: Locate existing architecture pages**

```bash
rg -l "architecture|@cacheplane/langgraph" apps/website/src
```

- [ ] **Step 2: Replace or add the three-box diagram** (see spec) as SVG or Mermaid in the architecture page. Include the three packages (chat / langgraph / ag-ui) and the `ChatAgent` contract in the center.

Mermaid source:

```mermaid
graph LR
  User[User code] --> Chat
  Chat[@cacheplane/chat<br/>owns ChatAgent] --> Contract((ChatAgent))
  LG[@cacheplane/langgraph] -- produces --> Contract
  AG[@cacheplane/ag-ui<br/>optional] -- produces --> Contract
  LG --> LGSDK[@langchain/* + langgraph-sdk]
  AG --> AGSDK[@ag-ui/client]
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/
git commit -m "docs(website): update architecture diagram for ChatAgent contract"
```

---

### Task G2: Add migration guide page

**Files:**
- Create: `apps/website/src/app/docs/migrations/2026-04-21-chat-runtime-decoupling.md` (or TS route following website conventions)

- [ ] **Step 1: Create migration guide page** mirroring content in `docs/migrations/2026-04-21-cacheplane-angular-to-langgraph.md`. Add before/after snippets for:
  - Package rename
  - `AgentRef` → `ChatAgent` primitive inputs
  - `toChatAgent()` call site
  - New AG-UI path via `provideAgUiAgent`

- [ ] **Step 2: Link from the website sidebar / TOC** per existing routing conventions.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/
git commit -m "docs(website): add Phase 1 migration guide"
```

---

### Task G3: Add capability matrix

**Files:**
- Create: `apps/website/src/app/docs/runtimes/capability-matrix.md`

- [ ] **Step 1: Write the matrix**

```markdown
# Primitive × Runtime Capability Matrix

| Primitive / Composition      | Core | LangGraph | AG-UI (Phase 1) |
|------------------------------|:---:|:---------:|:---------------:|
| `<cp-chat-input>`            |  ✅  |    ✅     |       ✅        |
| `<cp-chat-messages>`         |  ✅  |    ✅     |       ✅        |
| `<cp-chat-tool-calls>`       |  ✅  |    ✅     |       ✅        |
| `<cp-chat-typing-indicator>` |  ✅  |    ✅     |       ✅        |
| `<cp-chat-error>`            |  ✅  |    ✅     |       ✅        |
| `<cp-chat>` (core path)      |  ✅  |    ✅     |       ✅        |
| `<cp-chat-interrupt>`        | Phase 2 | Phase 2 | Phase 2 |
| `<cp-chat-subagents>`        | Phase 2 | Phase 2 | Phase 2 |
| `<cp-chat-timeline>`         | LangGraph-only | ✅ | ❌ |
| `<cp-chat-debug>`            | LangGraph-only | ✅ | ❌ |
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/
git commit -m "docs(website): add primitive × runtime capability matrix"
```

---

### Task G4: Add an AG-UI demo in the website app

**Files:**
- Create: `apps/website/src/app/demos/ag-ui-chat/` (follow existing demo pattern)

- [ ] **Step 1: Audit existing demo structure**

```bash
ls apps/website/src/app/demos/ 2>/dev/null
```

Follow the pattern of an existing LangGraph demo. If none exists, co-locate per website conventions.

- [ ] **Step 2: Write an AG-UI demo component**

```ts
import { Component, inject } from '@angular/core';
import { ChatComponent, provideChat } from '@cacheplane/chat';
import { provideAgUiAgent, AG_UI_CHAT_AGENT } from '@cacheplane/ag-ui';

@Component({
  standalone: true,
  imports: [ChatComponent],
  providers: [
    provideChat({}),
    provideAgUiAgent({ url: 'https://demo-ag-ui.cacheplane.dev/agent' }),
  ],
  template: `<cp-chat [agent]="agent"></cp-chat>`,
})
export class AgUiChatDemoComponent {
  protected readonly agent = inject(AG_UI_CHAT_AGENT);
}
```

The demo URL can be a mock/echo endpoint maintained in the repo or a hosted sample. If unavailable at first, mark the demo page as "coming soon" with a working local mock using `fromEvent` stubs.

- [ ] **Step 3: Add to website routes** per existing conventions.

- [ ] **Step 4: Verify build**

```bash
npx nx build website
```

- [ ] **Step 5: Smoke test in browser**

```bash
npx nx serve website
```

Navigate to the AG-UI demo route. Confirm that the chat surface renders and that a local mock exchange works end-to-end. Document any runtime issues and fix before proceeding.

- [ ] **Step 6: Commit**

```bash
git add apps/website/
git commit -m "docs(website): add AG-UI chat demo"
```

---

## Final integration checks

### Task H1: Cross-project build and test

- [ ] **Step 1: Full build**

```bash
npx nx run-many -t build -p chat langgraph ag-ui website
```
Expected: SUCCESS across all four projects.

- [ ] **Step 2: Full test**

```bash
npx nx run-many -t test -p chat langgraph ag-ui
```
Expected: PASS.

- [ ] **Step 3: Lint**

```bash
npx nx run-many -t lint -p chat langgraph ag-ui website
```
Expected: PASS.

- [ ] **Step 4: Affected-project check against main**

```bash
npx nx affected -t build test lint
```
Expected: no unexpected affected projects outside the ones above.

- [ ] **Step 5: Open PR**

Title: `feat: decouple @cacheplane/chat from LangGraph runtime (Phase 1)`

Description: link to spec and plan; summarize workstreams A–G; include migration guide link; note Phase 2 will add interrupts and subagents.

---

## Self-review notes (for implementer)

- Every file path above is absolute to repo root. Don't introduce new path aliases beyond the one `@cacheplane/ag-ui` entry.
- `toChatAgent()` must be called inside an Angular injection context because it uses `computed()`; tests use `TestBed.runInInjectionContext`.
- Do not modify the not-yet-migrated primitives (`chat-interrupt`, `chat-subagents`, `chat-timeline`, `chat-debug`, `chat-generative-ui`, `chat-thread-list`) in Phase 1 — they continue to import from `@cacheplane/langgraph` until Phase 2/3.
- The `@cacheplane/langgraph` → `@cacheplane/langgraph` rename does not rename the `libs/langgraph/` directory; that's a mechanical cleanup deferred to keep this PR reviewable.
- If `@ag-ui/client` / `@ag-ui/core` versions drift during implementation, pin the adapter to the versions you tested against and update the `peerDependencies` range accordingly.
