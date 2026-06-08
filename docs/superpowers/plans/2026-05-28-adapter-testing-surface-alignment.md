# Adapter Testing-Surface Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `@threadplane/langgraph` and `@threadplane/ag-ui` symmetric test doubles — a one-call `provideFakeAgent({tokens,…})` on both (shared `FakeAgentConfig`), and `mockLangGraphAgent` built on the neutral `mockAgent` — plus a test-double selection guide.

**Architecture:** `FakeAgentConfig` becomes a single canonical type in `@threadplane/chat/testing`. langgraph gains a `provideFakeAgent` backed by a new **auto-emitting** `FakeStreamTransport` (the existing `MockAgentTransport` is passive/manual and stays the advanced escape hatch). `mockLangGraphAgent` is refactored to call chat's `mockAgent()` for the shared neutral signal bag, layering LangGraph-specific writable signals on top. Docs get a three-layer test-double selection table. No backwards-compat / re-exports — breaking changes accepted. Uniform patch bump `0.0.48 → 0.0.49` across all publishable libs.

**Tech Stack:** Nx monorepo · Angular 20 (libs) · Vitest + Angular TestBed · MDX (docs).

**Reference spec:** [docs/superpowers/specs/2026-05-28-adapter-testing-surface-alignment-design.md](../specs/2026-05-28-adapter-testing-surface-alignment-design.md)

> **Spec refinement (internal-only):** The spec's §2b says langgraph `provideFakeAgent` wraps `new MockAgentTransport(script)`. During planning we confirmed `MockAgentTransport` is **passive** — its `stream()` waits for manual `emit()`/`nextBatch()` and won't auto-stream a constructor script. So `provideFakeAgent` is instead backed by a new **auto-emitting** `FakeStreamTransport` (parallels ag-ui's auto-emitting `FakeAgent`). The public API (`provideFakeAgent({tokens, reasoningTokens, delayMs})` and its behavior) is identical to the spec; only the private backing transport differs.

---

## File structure

- **Create** `libs/chat/testing/fake-agent-config.ts` — the canonical `FakeAgentConfig` interface.
- **Modify** `libs/chat/testing/public-api.ts` — export `FakeAgentConfig`.
- **Modify** `libs/ag-ui/src/lib/testing/provide-fake-agent.ts` — delete local `FakeAgentConfig`, import from `@threadplane/chat/testing`.
- **Modify** `libs/ag-ui/src/public-api.ts` — stop exporting `FakeAgentConfig` (no re-export).
- **Create** `libs/langgraph/src/lib/testing/fake-stream.transport.ts` — auto-emitting `FakeStreamTransport implements AgentTransport`.
- **Create** `libs/langgraph/src/lib/testing/provide-fake-agent.ts` — `provideFakeAgent(config)`.
- **Modify** `libs/langgraph/src/public-api.ts` — export `provideFakeAgent`.
- **Modify** `libs/langgraph/src/lib/testing/mock-langgraph-agent.ts` — refactor to extend chat's `mockAgent`.
- **Docs:** `apps/website/content/docs/langgraph/guides/testing.mdx`, `apps/website/content/docs/ag-ui/guides/testing.mdx`, `apps/website/content/docs/choosing-an-adapter/index.mdx`, `libs/langgraph/README.md`, `libs/ag-ui/README.md`.
- **Version:** all seven publishable `libs/*/package.json`.

---

## Task 1: Canonical `FakeAgentConfig` in `@threadplane/chat/testing`

**Files:**
- Create: `libs/chat/testing/fake-agent-config.ts`
- Modify: `libs/chat/testing/public-api.ts`

- [ ] **Step 1: Create the type**

```ts
// libs/chat/testing/fake-agent-config.ts
// SPDX-License-Identifier: MIT

/**
 * Shared config for the adapters' `provideFakeAgent()` helpers
 * (@threadplane/langgraph and @threadplane/ag-ui). Drives an in-process
 * fake backend that streams a canned assistant reply.
 */
export interface FakeAgentConfig {
  /** Assistant reply, streamed token-by-token. */
  tokens?: string[];
  /** Optional reasoning chunks emitted before the text reply. */
  reasoningTokens?: string[];
  /** Milliseconds between successive token emissions. */
  delayMs?: number;
}
```

- [ ] **Step 2: Export it**

In `libs/chat/testing/public-api.ts`, add:

```ts
export type { FakeAgentConfig } from './fake-agent-config';
```

- [ ] **Step 3: Build chat**

Run: `npx nx build chat`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/testing/fake-agent-config.ts libs/chat/testing/public-api.ts
git commit -m "feat(chat): add shared FakeAgentConfig to chat/testing"
```

## Task 2: ag-ui imports `FakeAgentConfig` from chat/testing

**Files:**
- Modify: `libs/ag-ui/src/lib/testing/provide-fake-agent.ts`
- Modify: `libs/ag-ui/src/public-api.ts`

- [ ] **Step 1: Replace the local interface with an import**

In `libs/ag-ui/src/lib/testing/provide-fake-agent.ts`, delete the local `export interface FakeAgentConfig { … }` block and add at the top (with the other imports):

```ts
import type { FakeAgentConfig } from '@threadplane/chat/testing';
```

Keep the rest of the file (the `provideFakeAgent` function and its `FakeAgent` usage) unchanged — it already references `FakeAgentConfig` by name.

- [ ] **Step 2: Remove the `FakeAgentConfig` re-export from ag-ui public-api**

In `libs/ag-ui/src/public-api.ts`, delete the line:

```ts
export type { FakeAgentConfig } from './lib/testing/provide-fake-agent';
```

Keep `provideAgent`, `injectAgent`, `AgentConfig`, `provideFakeAgent`, `FakeAgent`, `toAgent`, `bridgeCitationsState`.

- [ ] **Step 3: Run ag-ui tests + build**

Run: `npx nx run-many -t test build --projects=ag-ui`
Expected: PASS (existing `provide-fake-agent.spec.ts` still green — it constructs `provideFakeAgent({tokens,…})` which is unchanged).

- [ ] **Step 4: Confirm `@threadplane/chat/testing` resolves from ag-ui**

If the build fails on the deep import path, check `libs/ag-ui/tsconfig*.json` / root `tsconfig.base.json` `paths` for a `@threadplane/chat/testing` entry. The `generate-api-docs.ts` config already lists `libs/chat/testing/public-api.ts` as an entry point, so the path mapping should exist; if not, add it mirroring the `@threadplane/chat` mapping with a `/testing` suffix pointing at `libs/chat/testing/public-api.ts`.

- [ ] **Step 5: Commit**

```bash
git add libs/ag-ui/src/lib/testing/provide-fake-agent.ts libs/ag-ui/src/public-api.ts
git commit -m "refactor(ag-ui): import shared FakeAgentConfig from chat/testing"
```

## Task 3: langgraph auto-emitting `FakeStreamTransport`

**Files:**
- Create: `libs/langgraph/src/lib/testing/fake-stream.transport.ts`
- Create: `libs/langgraph/src/lib/testing/fake-stream.transport.spec.ts`

The transport implements `AgentTransport` (same interface `MockAgentTransport` implements) but its `stream()` **auto-emits** synthesized events with `delayMs` spacing, then completes. The canonical streaming event shape (from `agent.fn.spec.ts`) is `{ type: 'messages', messages: [{ id, type: 'ai', content }] }`, where `content` is the cumulative text so far.

- [ ] **Step 1: Write the failing test**

```ts
// libs/langgraph/src/lib/testing/fake-stream.transport.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { FakeStreamTransport } from './fake-stream.transport';
import type { StreamEvent } from '../agent.types';

async function collect(transport: FakeStreamTransport): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  const ac = new AbortController();
  for await (const ev of transport.stream('a', null, {}, ac.signal)) {
    out.push(ev);
  }
  return out;
}

describe('FakeStreamTransport', () => {
  it('auto-streams tokens as cumulative assistant message events', async () => {
    const transport = new FakeStreamTransport({ tokens: ['Hello', ' world'], delayMs: 0 });
    const events = await collect(transport);
    // Last message event carries the full concatenated reply.
    const messageEvents = events.filter((e) => e.type === 'messages');
    expect(messageEvents.length).toBeGreaterThan(0);
    const last = messageEvents[messageEvents.length - 1] as StreamEvent & {
      messages: Array<{ type: string; content: string }>;
    };
    expect(last.messages[0].type).toBe('ai');
    expect(last.messages[0].content).toBe('Hello world');
  });

  it('completes (stream ends) after emitting all tokens', async () => {
    const transport = new FakeStreamTransport({ tokens: ['x'], delayMs: 0 });
    const events = await collect(transport);
    // collect() only resolves if the async iterator completes.
    expect(events.length).toBeGreaterThan(0);
  });

  it('uses default tokens when none provided', async () => {
    const transport = new FakeStreamTransport({ delayMs: 0 });
    const events = await collect(transport);
    expect(events.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test langgraph -- --testFile=fake-stream.transport.spec.ts` (or `npx nx test langgraph` and locate the file)
Expected: FAIL — "Cannot find module './fake-stream.transport'".

- [ ] **Step 3: Implement the transport**

```ts
// libs/langgraph/src/lib/testing/fake-stream.transport.ts
// SPDX-License-Identifier: MIT
import type {
  AgentQueueEntry,
  AgentTransport,
  LangGraphSubmitOptions,
  StreamEvent,
} from '../agent.types';
import type { ThreadState } from '@langchain/langgraph-sdk';
import type { FakeAgentConfig } from '@threadplane/chat/testing';

const DEFAULT_TOKENS = ['Hello', ' from', ' the', ' fake', ' LangGraph', ' agent.'];

/**
 * In-process AgentTransport that auto-streams a canned assistant reply.
 *
 * Backs `provideFakeAgent()`. Unlike `MockAgentTransport` (which is passive and
 * driven manually from specs), this transport emits its tokens automatically on
 * `stream()`, then completes — suitable for offline demos and integration tests.
 *
 * NOT for production use.
 */
export class FakeStreamTransport implements AgentTransport {
  private readonly tokens: string[];
  private readonly reasoningTokens: string[];
  private readonly delayMs: number;

  constructor(config: FakeAgentConfig = {}) {
    this.tokens = config.tokens ?? DEFAULT_TOKENS;
    this.reasoningTokens = config.reasoningTokens ?? [];
    this.delayMs = config.delayMs ?? 0;
  }

  async *stream(
    _assistantId: string,
    _threadId: string | null,
    _payload: unknown,
    signal: AbortSignal,
    _options?: LangGraphSubmitOptions,
  ): AsyncIterable<StreamEvent> {
    const id = 'fake-ai-1';

    // Reasoning chunks first, if any. Cumulative content on additional_kwargs
    // mirrors how the adapter surfaces reasoning; see reasoning-fixture.ts for
    // the canonical shape and adjust if a richer event type is required.
    let reasoning = '';
    for (const chunk of this.reasoningTokens) {
      if (signal.aborted) return;
      reasoning += chunk;
      yield {
        type: 'messages',
        messages: [
          { id, type: 'ai', content: '', additional_kwargs: { reasoning_content: reasoning } },
        ],
      } as unknown as StreamEvent;
      if (this.delayMs > 0) await delay(this.delayMs);
    }

    // Assistant text reply, cumulative.
    let content = '';
    for (const tok of this.tokens) {
      if (signal.aborted) return;
      content += tok;
      yield {
        type: 'messages',
        messages: [{ id, type: 'ai', content }],
      } as unknown as StreamEvent;
      if (this.delayMs > 0) await delay(this.delayMs);
    }
  }

  async createQueuedRun(
    _assistantId: string,
    threadId: string,
    payload: unknown,
    _signal: AbortSignal,
    options?: LangGraphSubmitOptions,
  ): Promise<AgentQueueEntry> {
    return {
      id: 'fake-queued-run',
      threadId,
      values: payload,
      options: { ...options, multitaskStrategy: 'enqueue' },
      createdAt: new Date(),
    };
  }

  async cancelRun(_threadId: string, _runId: string, _signal: AbortSignal): Promise<void> {}

  async getHistory(_threadId: string, _signal: AbortSignal): Promise<ThreadState[]> {
    return [];
  }

  async *joinStream(): AsyncIterable<StreamEvent> {
    // No queued-run replay in the fake.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

Note: the `as unknown as StreamEvent` casts cover the inline message-literal shape (the same `{ id, type: 'ai', content }` literal used in `agent.fn.spec.ts:464`). If `AgentTransport`'s method signatures differ from what's shown (e.g. additional required methods), read the `AgentTransport` interface in `agent.types.ts` and `MockAgentTransport` for the exact contract, and implement every required member — `MockAgentTransport` is the reference for the full method set.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test langgraph`
Expected: the three `FakeStreamTransport` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/langgraph/src/lib/testing/fake-stream.transport.ts libs/langgraph/src/lib/testing/fake-stream.transport.spec.ts
git commit -m "feat(langgraph): add auto-emitting FakeStreamTransport for provideFakeAgent"
```

## Task 4: langgraph `provideFakeAgent`

**Files:**
- Create: `libs/langgraph/src/lib/testing/provide-fake-agent.ts`
- Create: `libs/langgraph/src/lib/testing/provide-fake-agent.spec.ts`
- Modify: `libs/langgraph/src/public-api.ts`

- [ ] **Step 1: Write the failing test**

```ts
// libs/langgraph/src/lib/testing/provide-fake-agent.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideFakeAgent } from './provide-fake-agent';
import { injectAgent } from '../inject-agent';

describe('provideFakeAgent (langgraph)', () => {
  it('provides an agent that streams the canned tokens into messages()', async () => {
    TestBed.configureTestingModule({
      providers: [provideFakeAgent({ tokens: ['Hi', ' there'], delayMs: 0 })],
    });
    const agent = TestBed.runInInjectionContext(() => injectAgent());
    await TestBed.runInInjectionContext(async () => {
      await agent.submit({ message: 'hello' });
    });
    // Let the auto-emit stream flush.
    await new Promise((r) => setTimeout(r, 20));
    const msgs = agent.messages();
    const assistant = msgs.find((m) => m.role === 'assistant');
    expect(assistant?.content).toContain('Hi there');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test langgraph`
Expected: FAIL — "Cannot find module './provide-fake-agent'".

- [ ] **Step 3: Implement `provideFakeAgent`**

```ts
// libs/langgraph/src/lib/testing/provide-fake-agent.ts
// SPDX-License-Identifier: MIT
import { type Provider } from '@angular/core';
import type { FakeAgentConfig } from '@threadplane/chat/testing';
import { provideAgent } from '../agent.provider';
import { FakeStreamTransport } from './fake-stream.transport';

/**
 * Wire an in-process fake LangGraph agent into Angular DI.
 *
 * Streams a canned assistant reply (see FakeAgentConfig) with no backend —
 * the symmetric counterpart to @threadplane/ag-ui's provideFakeAgent(). For
 * advanced manual scripting (tool calls, interrupts, multi-batch), provide
 * the agent yourself with `provideAgent({ transport: new MockAgentTransport(...) })`.
 */
export function provideFakeAgent(config: FakeAgentConfig = {}): Provider[] {
  return provideAgent({
    assistantId: 'fake',
    transport: new FakeStreamTransport(config),
  });
}
```

(`provideAgent` returns `Provider[]`; return it directly.)

- [ ] **Step 4: Export from public-api**

In `libs/langgraph/src/public-api.ts`, near the other testing exports (after `mockLangGraphAgent`), add:

```ts
export { provideFakeAgent } from './lib/testing/provide-fake-agent';
```

- [ ] **Step 5: Run test + build**

Run: `npx nx run-many -t test build --projects=langgraph`
Expected: PASS. If the streamed assistant message doesn't appear in `messages()`, inspect the `messages`-event shape the adapter expects (compare to `agent.fn.spec.ts:462-469`) and adjust `FakeStreamTransport`'s emitted literal — the test is the gate.

- [ ] **Step 6: Commit**

```bash
git add libs/langgraph/src/lib/testing/provide-fake-agent.ts libs/langgraph/src/lib/testing/provide-fake-agent.spec.ts libs/langgraph/src/public-api.ts
git commit -m "feat(langgraph): add provideFakeAgent mirroring ag-ui"
```

## Task 5: Refactor `mockLangGraphAgent` to extend `mockAgent`

**Files:**
- Modify: `libs/langgraph/src/lib/testing/mock-langgraph-agent.ts`

The neutral writable signals (`messages`, `status`, `isLoading`, `error`, `toolCalls`, `state`, `interrupt`, `subagents`, `history`, lifecycle stub, `events$`, `submit`/`stop`/`regenerate` + `submitCalls`/`stopCount`) come from chat's `mockAgent`. `mockLangGraphAgent` calls it (forcing `withInterrupt`/`withSubagents`/`history` on, since `MockLangGraphAgent` declares them non-optional), then layers the LangGraph-specific writable signals.

- [ ] **Step 1: Read the current file end-to-end**

Read `libs/chat/src/lib/testing/mock-agent.ts` (the base: `mockAgent`, `MockAgent`, `MockAgentOptions`) and the full current `libs/langgraph/src/lib/testing/mock-langgraph-agent.ts` to enumerate which signals are neutral (delegate to `mockAgent`) vs LangGraph-specific (keep).

- [ ] **Step 2: Change the `MockLangGraphAgent` type to extend `MockAgent`**

```ts
import type { MockAgent, MockAgentOptions } from '@threadplane/chat';

/**
 * A LangGraphAgent mock with writable signals for easy test control.
 * Extends the neutral MockAgent (from @threadplane/chat) with the
 * LangGraph-specific writable signals.
 */
export interface MockLangGraphAgent extends MockAgent, LangGraphAgent<any, any> {
  // LangGraph-specific writable signals (neutral ones come from MockAgent):
  langGraphMessages: WritableSignal<BaseMessage[]>;
  hasValue: WritableSignal<boolean>;
  value: WritableSignal<any>;
  langGraphInterrupts: WritableSignal<Interrupt<any>[]>;
  langGraphToolCalls: WritableSignal<ToolCallWithResult[]>;
  toolProgress: WritableSignal<ToolProgress[]>;
  queue: WritableSignal<AgentQueue>;
  branch: WritableSignal<string>;
  langGraphHistory: WritableSignal<ThreadState<any>[]>;
  experimentalBranchTree: WritableSignal<AgentBranchTree<any>>;
  isThreadLoading: WritableSignal<boolean>;
  activeSubagents: WritableSignal<SubagentStreamRef[]>;
  customEvents: WritableSignal<CustomStreamEvent[]>;
}
```

(If `MockAgent` + `LangGraphAgent` have conflicting member variance, prefer `extends MockAgent` and re-declare any LangGraph members that need a writable type — the existing file already lists the full set, so this is a reconciliation, not new design. Resolve type conflicts by keeping the `WritableSignal<…>` declarations.)

- [ ] **Step 3: Rewrite `mockLangGraphAgent` to delegate the neutral bag to `mockAgent`**

```ts
import { mockAgent } from '@threadplane/chat';

export function mockLangGraphAgent(
  initial: MockAgentOptions & {
    langGraphMessages?: BaseMessage[];
    isThreadLoading?: boolean;
    hasValue?: boolean;
  } = {},
): MockLangGraphAgent {
  const base = mockAgent({
    ...initial,
    withInterrupt: true,
    withSubagents: true,
    history: initial.history ?? [],
  });

  // LangGraph-specific writable signals.
  const langGraphMessages = signal<BaseMessage[]>(initial.langGraphMessages ?? []);
  const hasValue = signal<boolean>(initial.hasValue ?? false);
  const value = signal<any>(undefined);
  const langGraphInterrupts = signal<Interrupt<any>[]>([]);
  const langGraphToolCalls = signal<ToolCallWithResult[]>([]);
  const toolProgress = signal<ToolProgress[]>([]);
  const queue = signal<AgentQueue>(/* existing default from current file */ undefined as unknown as AgentQueue);
  const branch = signal<string>('');
  const langGraphHistory = signal<ThreadState<any>[]>([]);
  const experimentalBranchTree = signal<AgentBranchTree<any>>(/* existing default */ undefined as unknown as AgentBranchTree<any>);
  const isThreadLoading = signal<boolean>(initial.isThreadLoading ?? false);
  const activeSubagents = signal<SubagentStreamRef[]>([]);
  const customEvents = signal<CustomStreamEvent[]>([]);

  return {
    ...base,
    langGraphMessages,
    hasValue,
    value,
    langGraphInterrupts,
    langGraphToolCalls,
    toolProgress,
    queue,
    branch,
    langGraphHistory,
    experimentalBranchTree,
    isThreadLoading,
    activeSubagents,
    customEvents,
  } as MockLangGraphAgent;
}
```

Use the **exact default values** for `queue` and `experimentalBranchTree` from the current file (don't invent them — copy the existing initializers). The current file's `initial` parameter fields and per-signal defaults are the source of truth; preserve them so existing callers behave identically.

- [ ] **Step 4: Run the langgraph suite**

Run: `npx nx test langgraph`
Expected: PASS — **all existing specs that consume `mockLangGraphAgent` must remain green**. This is the regression gate.

- [ ] **Step 5: Add a spec asserting the neutral-shape relationship**

Append to an existing mock spec (or create `mock-langgraph-agent.spec.ts` if none):

```ts
import { mockLangGraphAgent } from './mock-langgraph-agent';

describe('mockLangGraphAgent extends mockAgent', () => {
  it('exposes the neutral MockAgent writable signals', () => {
    const m = mockLangGraphAgent({ status: 'running' });
    expect(m.status()).toBe('running');     // neutral signal, set via mockAgent
    m.messages.set([]);                     // writable neutral signal
    expect(m.submitCalls).toEqual([]);      // neutral submit tracking
    // LangGraph-specific signal still present:
    m.branch.set('main');
    expect(m.branch()).toBe('main');
  });
});
```

- [ ] **Step 6: Run + build**

Run: `npx nx run-many -t test build --projects=langgraph`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/langgraph/src/lib/testing/mock-langgraph-agent.ts libs/langgraph/src/lib/testing/mock-langgraph-agent.spec.ts
git commit -m "refactor(langgraph): mockLangGraphAgent extends neutral mockAgent"
```

## Task 6: Docs — testing guides + selection table + READMEs

**Files:**
- Modify: `apps/website/content/docs/langgraph/guides/testing.mdx`
- Create/Modify: `apps/website/content/docs/ag-ui/guides/testing.mdx`
- Modify: `apps/website/content/docs/choosing-an-adapter/index.mdx`
- Modify: `libs/langgraph/README.md`, `libs/ag-ui/README.md`

- [ ] **Step 1: Add the test-double selection table to Choosing-an-adapter**

In `apps/website/content/docs/choosing-an-adapter/index.mdx`, add a `## Testing` section with this table:

```markdown
## Testing

Three layers of test doubles, smallest scope first:

| Layer | Use | What's real | When |
|---|---|---|---|
| **Contract mock** | `mockAgent()` (chat) / `mockLangGraphAgent()` (langgraph) | nothing — you set `messages()`, `status()` directly | component/unit tests |
| **Fake backend** | `provideFakeAgent({ tokens })` (both adapters) | the real adapter pipeline; canned wire events | adapter-integration tests, in-browser, no server |
| **LLM fixture replay** | aimock (cockpit/examples e2e) | the whole stack incl. a real graph; only the LLM is replayed | full end-to-end |

Reach for the smallest layer that covers your test. Don't stand up aimock when a `mockAgent` unit test suffices; don't hand-roll a transport when `provideFakeAgent` exists.
```

- [ ] **Step 2: Update the langgraph testing guide**

In `apps/website/content/docs/langgraph/guides/testing.mdx`, document:
- `provideFakeAgent({ tokens, reasoningTokens, delayMs })` — one-call fake backend; show `provideFakeAgent({ tokens: ['Hello', ' world'] })` in `app.config.ts` then `injectAgent()`.
- `mockLangGraphAgent(initial)` — writable-signal mock (extends the neutral `mockAgent`); show setting `m.messages.set([...])` / `m.status.set('running')` in a component test.
- A link to the selection table: `See [Choosing an adapter → Testing](/docs/choosing-an-adapter#testing).`
Replace any references to manually constructing `MockAgentTransport` for the simple case with `provideFakeAgent`; keep `MockAgentTransport` documented as the advanced manual-scripting escape hatch.

- [ ] **Step 3: Create/update the ag-ui testing guide**

`apps/website/content/docs/ag-ui/guides/testing.mdx` — if it doesn't exist, create it and add it to `apps/website/src/lib/docs-config.ts` under the `ag-ui` library's guides section (mirror an existing guide entry). Document:
- `provideFakeAgent({ tokens, reasoningTokens, delayMs })` — same call shape as langgraph.
- Using the neutral `mockAgent()` from `@threadplane/chat` for component tests (ag-ui's agent is the neutral contract — no ag-ui-specific mock needed).
- Link to the selection table.

- [ ] **Step 4: Add Testing subsections to both lib READMEs**

`libs/langgraph/README.md` and `libs/ag-ui/README.md` — add a short `## Testing` subsection:

````markdown
## Testing

```ts
// Fake backend — streams canned tokens, no server:
import { provideFakeAgent } from '@threadplane/langgraph'; // or '@threadplane/ag-ui'
providers: [provideFakeAgent({ tokens: ['Hello', ' world'] })];
```

For component/unit tests, use the writable-signal mock: `mockLangGraphAgent()`
(langgraph) or `mockAgent()` from `@threadplane/chat` (ag-ui). See
[Choosing an adapter → Testing](https://threadplane.ai/docs/choosing-an-adapter#testing).
````

(Use `@threadplane/ag-ui` and `mockAgent()` in the ag-ui README.)

- [ ] **Step 5: Build the website**

Run: `npx nx build website`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/website/content/docs/ apps/website/src/lib/docs-config.ts libs/langgraph/README.md libs/ag-ui/README.md
git commit -m "docs: testing guides + test-double selection table"
```

## Task 7: Uniform version bump + final verification

**Files:**
- Modify: all seven `libs/{chat,langgraph,ag-ui,render,a2ui,licensing,telemetry}/package.json`

- [ ] **Step 1: Bump every publishable lib `0.0.48` → `0.0.49`**

```bash
for lib in chat langgraph ag-ui render a2ui licensing telemetry; do
  sed -i '' 's/"version": "0.0.48"/"version": "0.0.49"/' "libs/$lib/package.json"
done
```

- [ ] **Step 2: Verify uniform versions**

Run: `node scripts/verify-release-versions.mjs`
Expected: `Release group "publishable" is atomic at 0.0.49: …` (exit 0).

- [ ] **Step 3: Full affected verification**

Run: `npx nx run-many -t lint test build --projects=chat,langgraph,ag-ui,website`
Expected: all green.

- [ ] **Step 4: Confirm no stale local `FakeAgentConfig` definition remains**

Run: `git grep -n "interface FakeAgentConfig" -- libs/`
Expected: exactly one hit — `libs/chat/testing/fake-agent-config.ts`.

- [ ] **Step 5: Confirm symmetric public surface**

Run: `git grep -n "provideFakeAgent" -- libs/langgraph/src/public-api.ts libs/ag-ui/src/public-api.ts`
Expected: both adapters export `provideFakeAgent`.

- [ ] **Step 6: Commit**

```bash
git add libs/*/package.json
git commit -m "chore: bump publishable libs to 0.0.49 for testing-surface alignment"
```

---

## Final verification matrix

| Check | Command | Expected |
|---|---|---|
| Shared config single source | `git grep -n "interface FakeAgentConfig" -- libs/` | one hit (chat/testing) |
| Symmetric provider | `git grep -n "provideFakeAgent" -- libs/*/src/public-api.ts` | langgraph + ag-ui both export it |
| langgraph mock extends neutral | `mockLangGraphAgent()` test asserts neutral `MockAgent` signals present | PASS |
| Uniform versions | `node scripts/verify-release-versions.mjs` | atomic at 0.0.49 |
| Build/test/lint | `npx nx run-many -t lint test build --projects=chat,langgraph,ag-ui,website` | all green |
| Docs build | `npx nx build website` | PASS |

## Risk reminders

- **`MockAgentTransport` is passive** — do not wire `provideFakeAgent` through it. Use the new auto-emitting `FakeStreamTransport`.
- **`mockLangGraphAgent` regression gate**: every existing spec consuming it must stay green after the refactor. Copy the current per-signal default values verbatim (especially `queue`, `experimentalBranchTree`).
- **Uniform version bump** across all seven publishable libs, or CI's `verify-release-versions.mjs` fails (`feedback_uniform_publishable_versions.md`).
- **No re-exports** — moved `FakeAgentConfig` is imported from `@threadplane/chat/testing`; breaking import changes are accepted.
- **`@threadplane/chat/testing` path mapping** must resolve from both adapter libs (Task 2 Step 4).
