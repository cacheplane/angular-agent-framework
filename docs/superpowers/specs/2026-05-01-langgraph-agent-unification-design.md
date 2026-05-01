# LangGraph `agent()` Unification Design

## Goal

Eliminate the two-step `agent({...}); toAgent(stream)` pattern by having `agent({...})` return a single unified `LangGraphAgent` type that satisfies both the runtime-neutral `Agent`/`AgentWithHistory` contract AND preserves all of `AgentRef`'s public surface. Remove `toAgent()` entirely. Refactor all consumers (~23 cockpit components, ~20 website docs).

## Motivation

The current pattern looks redundant in the simplest demos:

```ts
protected readonly stream = agent({ apiUrl, assistantId });
protected readonly chatAgent = toAgent(this.stream);
```

Two related-but-different objects, two field initializers, friction at every entry point. The two-step exists today because:
- `AgentRef` (returned by `agent()`) uses LangGraph types (`BaseMessage`, `ResourceStatus`, `ThreadState`).
- `Agent` (consumed by `<chat>`) uses runtime-neutral types (`Message`, `AgentStatus`, `AgentCheckpoint`).
- `toAgent` translates types and wraps signals.

Users pay this cost in every component. Most don't need direct `AgentRef` access — they just want one object that drives `<chat>` and exposes LangGraph extras when needed.

The fix: bake the type translation into `agent()`. The returned object IS-A `Agent` (chat-consumable) AND has the LangGraph-specific surface as additional methods/signals.

## Architecture

### `LangGraphAgent` interface

Lives in `@ngaf/langgraph`. Extends `AgentWithHistory` (from `@ngaf/chat`). Adds the LangGraph-specific surface.

```ts
import type {
  AgentWithHistory, Message, AgentCheckpoint, AgentStatus,
  AgentInterrupt, Subagent, AgentSubmitInput, AgentSubmitOptions, AgentEvent,
} from '@ngaf/chat';
import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { BaseMessage } from '@langchain/core/messages';
import type {
  Interrupt, ToolProgress, ToolCallWithResult,
  MessageMetadata, CoreAIMessage, CustomStreamEvent,
} from '@langchain/langgraph-sdk';
import type { ThreadState, BagTemplate, SubagentStreamRef } from './agent.types';

/**
 * Unified LangGraph agent surface. Returned by `agent({...})`.
 *
 * Extends `AgentWithHistory` (chat-consumable) with the full LangGraph-
 * specific API (branch, switchThread, joinStream, raw BaseMessage access,
 * etc.). One object drives both `<chat>` and any LangGraph-specific demo.
 */
export interface LangGraphAgent<T = unknown, ResolvedBag extends BagTemplate = BagTemplate>
  extends AgentWithHistory {
  // ── AgentWithHistory inherited (runtime-neutral types) ──────────────
  // messages: Signal<Message[]>;
  // status: Signal<AgentStatus>;
  // isLoading: Signal<boolean>;
  // error: Signal<unknown>;
  // toolCalls: Signal<ToolCall[]>;
  // state: Signal<Record<string, unknown>>;
  // interrupt?: Signal<AgentInterrupt | undefined>;
  // subagents?: Signal<Map<string, Subagent>>;
  // events$: Observable<AgentEvent>;
  // history: Signal<AgentCheckpoint[]>;
  // submit(input: AgentSubmitInput, opts?: AgentSubmitOptions): Promise<void>;
  // stop(): Promise<void>;

  // ── LangGraph-specific extras (preserved from AgentRef) ─────────────
  /** Raw LangChain BaseMessage list. Use this when you need LangChain-typed
   *  messages (e.g., to call `.toJSON()` or pattern-match by type). For
   *  rendering through chat primitives, use `messages` instead. */
  langGraphMessages: Signal<BaseMessage[]>;

  /** Current agent state values (raw, untyped per the type parameter T). */
  value: Signal<T>;

  /** True once at least one value or message has been received. */
  hasValue: Signal<boolean>;

  /** Re-submit the last input to restart the stream. */
  reload: () => void;

  /** All interrupts received during the current run (raw LangGraph shape). */
  langGraphInterrupts: Signal<Interrupt<ResolvedBag['InterruptType']>[]>;

  /** Progress updates for currently executing tools. */
  toolProgress: Signal<ToolProgress[]>;

  /** Raw LangGraph tool calls (with run-state distinct from runtime-neutral
   *  ToolCallStatus). Use `toolCalls` for chat rendering. */
  langGraphToolCalls: Signal<ToolCallWithResult[]>;

  /** Filtered list of subagents with status 'running'. */
  activeSubagents: Signal<SubagentStreamRef[]>;

  /** Raw custom events stream (signal of array). The runtime-neutral
   *  `events$` Observable is derived from this. */
  customEvents: Signal<CustomStreamEvent[]>;

  /** Current branch identifier for time-travel navigation. */
  branch: Signal<string>;

  /** Set the active branch for time-travel navigation. */
  setBranch: (branch: string) => void;

  /** Raw LangGraph history (signal of ThreadState[]). Use `history` for
   *  the runtime-neutral AgentCheckpoint[]. */
  langGraphHistory: Signal<ThreadState<T>[]>;

  /** True while a thread switch is loading state from the server. */
  isThreadLoading: Signal<boolean>;

  /** Switch to a different thread, resetting derived state. */
  switchThread: (threadId: string | null) => void;

  /** Join an already-running stream by run ID. */
  joinStream: (runId: string, lastEventId?: string) => Promise<void>;

  /** Get metadata for a specific message by index. */
  getMessagesMetadata: (msg: BaseMessage, idx?: number) => MessageMetadata<Record<string, unknown>> | undefined;

  /** Get tool call results associated with an AI message (LangGraph types). */
  getToolCalls: (msg: CoreAIMessage) => ToolCallWithResult[];
}
```

### `agent({...})` returns `LangGraphAgent`

Currently returns `AgentRef<T, BagTemplate>`. After this design: returns `LangGraphAgent<T, ResolvedBag>`.

Implementation: keep the existing internal AgentRef construction (it's the LangGraph SDK plumbing). Adapt the return value to the unified shape — fold in the runtime-neutral signal projections (`messages` → `Message[]`, `status` → `AgentStatus`, `history` → `AgentCheckpoint[]`, etc.) AND expose the original raw signals under prefixed names (`langGraphMessages`, `langGraphHistory`, etc.).

### `toAgent()` deletion

`toAgent(ref: AgentRef)` is removed entirely from `@ngaf/langgraph`. No deprecation period — the project is at `0.0.x` and breaking changes are acceptable.

`AgentRef` itself is removed from the public API. Internally the implementation may still use the `AgentRef`-shaped intermediate (or it may be refactored further), but consumers no longer see it.

### AG-UI side stays the same

`@ngaf/ag-ui` continues to export `toAgent(source: AbstractAgent): Agent` as the adapter primitive (users subclass `AbstractAgent` for custom transports). The asymmetry — LangGraph has `agent()` factory, AG-UI has `provideAgUiAgent()` provider + `toAgent()` primitive — is acknowledged and accepted.

## Type-level Tension

`AgentRef.messages: Signal<BaseMessage[]>` (LangChain type) collides with `Agent.messages: Signal<Message[]>` (runtime-neutral). Cannot have both signatures on a single interface.

**Resolution:** the unified `messages` signal returns `Message[]` (runtime-neutral; satisfies the `Agent` contract). Users who need raw `BaseMessage[]` access read `langGraphMessages: Signal<BaseMessage[]>` (additional signal).

Same pattern applied to other LangGraph-typed signals where the unified shape needs runtime-neutral types:
- `messages` → runtime-neutral `Message[]`. Raw: `langGraphMessages: BaseMessage[]`.
- `toolCalls` → runtime-neutral `ToolCall[]`. Raw: `langGraphToolCalls: ToolCallWithResult[]`.
- `history` → runtime-neutral `AgentCheckpoint[]`. Raw: `langGraphHistory: ThreadState<T>[]`.
- `interrupts` → not on the runtime-neutral surface; the unified type only exposes `langGraphInterrupts` and the runtime-neutral `interrupt?: Signal<AgentInterrupt | undefined>` (single-current-interrupt projection).
- `customEvents` (Signal<CustomStreamEvent[]>) is exposed alongside the runtime-neutral `events$: Observable<AgentEvent>`.

This is a deliberate type-level decision: the framework name decisions don't carry. Users get one object, two-naming-scheme:
- Runtime-neutral names (`messages`, `history`, `toolCalls`, `events$`) for chat consumption.
- `langGraph*`-prefixed names for raw access.

## Cockpit Migration

23 cockpit components today follow this pattern:

```ts
// before
protected readonly stream = agent({...});
protected readonly chatAgent = toAgent(this.stream);
// uses this.stream.setBranch(...), this.chatAgent in templates
```

After migration:

```ts
// after
protected readonly agent = agent({...});
// uses this.agent.setBranch(...), this.agent in templates
```

The variable name change (`stream` + `chatAgent` → `agent`) is part of the migration. Field initializers collapse to one line. Any code that was reading from `this.stream.someAgentRefMethod()` now reads `this.agent.someAgentRefMethod()` — the methods are preserved on the unified type.

For methods that touched LangGraph-typed signals (e.g., `this.stream.messages()` returning `BaseMessage[]`):
- If the use was rendering through chat primitives → switch to `this.agent.messages()` (returns `Message[]`).
- If the use was reading LangChain-specific message internals → switch to `this.agent.langGraphMessages()`.

Audit each component's usage during migration.

## Cockpit Demos Affected

23 angular cockpit demos (from grep audit):
- All `cockpit/chat/**/angular/` (input, messages, threads, tool-calls, theming, generative-ui, debug, timeline, interrupts, subagents, a2ui, etc.) — most use `toAgent` for the chat surface.
- `cockpit/deep-agents/**/angular/` (filesystem, memory, planning, sandboxes, skills, subagents) — same pattern.
- `cockpit/langgraph/**/angular/` (streaming, interrupts, persistence, etc.) — these may use the `AgentRef`-specific surface more heavily.

Per-component review needed during migration.

## Website / Docs Migration

~20 website doc files reference `AgentRef`:
- `apps/website/content/docs/agent/api/api-docs.json` — generated; regenerated automatically.
- `apps/website/content/docs/agent/concepts/angular-signals.mdx` — manual; update prose.
- `apps/website/content/docs/chat/components/*.mdx` — code samples reference `AgentRef`; update to `LangGraphAgent`.
- `apps/website/content/docs/render/a2ui/overview.mdx` — manual; update.
- Whitepapers (`apps/website/public/whitepapers/*.html`) — generated; regenerate as part of this work.
- `apps/website/src/components/landing/chat-landing/ChatLandingCodeShowcase.tsx` — code samples; update.

Audit during plan execution; the doc generation scripts (`generate-api-docs.ts`, etc.) cover most of it after the lib changes.

## Tests

- `libs/langgraph/src/lib/to-agent.spec.ts` — delete (toAgent gone).
- `libs/langgraph/src/lib/to-agent.conformance.spec.ts` — delete (toAgent gone).
- New: `libs/langgraph/src/lib/agent.fn.spec.ts` (or similar) covers the `agent({...})` factory's runtime-neutral surface — runs `runAgentWithHistoryConformance` against the result.
- `libs/langgraph/src/lib/testing/mock-agent-ref.ts` → renamed/refactored to produce a `LangGraphAgent` mock instead of an `AgentRef`. Keeps the same value to test consumers.

## Out of Scope

- Renaming `agent` (the function) itself. Stays `agent({...})`.
- Adding a `provideLangGraphAgent({...})` DI helper for symmetry with AG-UI. Asymmetry is accepted.
- Re-exposing AgentRef as a public type. Removed entirely.
- Backward-compat aliases for old method names. Project is at `0.0.x`.
- AG-UI adapter changes. AG-UI side remains as-is (`provideAgUiAgent` + `toAgent(source)`).

## Risk

- **Big consumer-side migration** (~23 cockpit components, ~20 docs). Mechanical but tedious; possible to miss a usage of `langGraphMessages` semantics.
- **Tests covering AgentRef directly** (mock-agent-ref tests, conformance specs) need rewriting against the unified type.
- **`getMessagesMetadata(msg: BaseMessage, ...)` signature** — its first arg type stays `BaseMessage`, which means consumers calling it from runtime-neutral `Message`-typed code can't pass directly. They'd need `agent.langGraphMessages()` to get a `BaseMessage` to pass back in. Acceptable — this method is genuinely LangGraph-specific.
- **Internal `AgentRef`-shaped object** still exists during the refactor (the implementation hasn't been rewritten to remove it; it just stops being public). Means the LangGraph SDK plumbing in `agent.fn.ts` continues working unchanged; only the boundary changes.

## When to Revisit

- If a third runtime adapter is built and the `LangGraph*` naming for raw signals starts to look idiosyncratic vs. a more general "raw access" pattern.
- If `getMessagesMetadata` and similar `BaseMessage`-typed methods get heavy use from chat primitives (today they're LangGraph-demo-specific).
- If users start reaching into `AgentRef`-internals beyond the documented public surface — that signals more methods need promoting onto `LangGraphAgent`.
