# Decoupling `@cacheplane/chat` from the LangGraph Runtime

**Date:** 2026-04-21
**Status:** Draft for review
**Scope:** Library architecture — chat, agent/langgraph, new ag-ui adapter

## Problem

`@cacheplane/chat` imports `AgentRef`, `SubagentStreamRef`, `Interrupt`, `ThreadState`, `ToolCallWithResult`, and `ResourceStatus` from `@cacheplane/langgraph` across nearly every primitive and composition. `@cacheplane/langgraph` is a LangGraph SDK adapter — its types are LangGraph-shaped (`BaseMessage` from `@langchain/core`, `Interrupt`/`ThreadState` from `@langchain/langgraph-sdk`). Consequently, chat's public API is LangGraph-specific: a user cannot drive chat primitives from CopilotKit's AG-UI runtime, Mastra, CrewAI, Microsoft Agent Framework, or a custom backend without re-implementing `AgentRef`.

`@cacheplane/render` has **no** dependency on `@cacheplane/langgraph` and is already decoupled from the agent runtime (though it remains coupled to the Angular framework — out of scope for this spec).

## Goal

Chat primitives accept a runtime-neutral `ChatAgent` contract. Existing LangGraph users are served by an adapter. A new optional adapter lets any AG-UI-compatible backend (LangGraph Platform, CrewAI, Mastra, Microsoft AF, AG2, Pydantic AI, AWS Strands, CopilotKit runtime) drive chat without changes to chat itself. The AG-UI package is optional — chat does not depend on it.

## Non-goals

- Decoupling `@cacheplane/render` from Angular the framework.
- Supporting React consumers of chat primitives.
- History/time-travel across runtimes. Thread checkpoints are LangGraph-specific; the `chat-timeline`, `chat-timeline-slider`, and `chat-debug` primitives remain LangGraph-only.
- Redesigning transport or licensing.

## Architecture

```
@cacheplane/chat  ──────────────►  ChatAgent (contract, owned here)
      ▲                                 ▲
      │                                 │ produced by
      │                          ┌──────┴────────────┐
      │                          │                   │
      │                 @cacheplane/langgraph   @cacheplane/ag-ui
      │                 (renamed from           (new, optional)
      │                  @cacheplane/langgraph)
      │                          │                   │
      └── user code              ▼                   ▼
                            @langchain/*         @ag-ui/client
                            langgraph-sdk
```

### Package roles

- **`@cacheplane/chat`** — owns `ChatAgent` and all neutral data types; owns all primitives and compositions. Peer deps: Angular, `@cacheplane/render`, `@cacheplane/licensing`, `@cacheplane/a2ui`, `@cacheplane/partial-json`. **No dependency on any agent runtime.**
- **`@cacheplane/langgraph`** — renamed from `@cacheplane/langgraph`. Wraps the LangGraph SDK; exports `agent()`, `AgentRef`, transports, and `toChatAgent(agentRef) → ChatAgent`. Keeps today's surface for users who want raw LangGraph access plus the adapter for chat.
- **`@cacheplane/ag-ui`** — new. Wraps `@ag-ui/client`'s `AbstractAgent` Observable into `ChatAgent` signals. Exports `toChatAgent(agent: AbstractAgent)` and a convenience `provideAgUiAgent({ url, agentId })`.
- **User-written adapter** — any custom backend (Vercel AI SDK direct, homegrown SSE, etc.) implements `ChatAgent` without a library.

## The `ChatAgent` contract

Data shapes mirror AG-UI's event/data model structurally (same field names and semantics) but are declared in `@cacheplane/chat`. No runtime or type import from `@ag-ui/*` leaks into chat.

```ts
// In @cacheplane/chat

export type ChatStatus = 'idle' | 'running' | 'error';

export type ChatContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'tool_use'; id: string; name: string; args: unknown }
  | { type: 'tool_result'; toolCallId: string; result: unknown; isError?: boolean };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ChatContentBlock[];
  toolCallId?: string;   // for role: 'tool'
  name?: string;
}

export interface ChatToolCall {
  id: string;
  name: string;
  args: unknown;         // streamed; may be partial
  status: 'pending' | 'running' | 'complete' | 'error';
  result?: unknown;
}

export interface ChatInterrupt {
  id: string;
  value: unknown;        // opaque payload the app renders
  resumable: boolean;
}

export interface ChatSubagent {
  toolCallId: string;
  status: Signal<'pending' | 'running' | 'complete' | 'error'>;
  messages: Signal<ChatMessage[]>;
  state: Signal<Record<string, unknown>>;
}

export interface ChatSubmitInput {
  message?: string | ChatContentBlock[];
  resume?: unknown;      // for interrupt resumption
  state?: Record<string, unknown>;
}

export interface ChatSubmitOptions {
  signal?: AbortSignal;
}

export interface ChatAgent {
  // Phase 1 — core
  messages:  Signal<ChatMessage[]>;
  status:    Signal<ChatStatus>;
  isLoading: Signal<boolean>;
  error:     Signal<unknown>;
  toolCalls: Signal<ChatToolCall[]>;
  state:     Signal<Record<string, unknown>>;

  submit: (input: ChatSubmitInput, opts?: ChatSubmitOptions) => Promise<void>;
  stop:   () => Promise<void>;

  // Phase 2 — extended (optional; absent when runtime does not support)
  interrupt?: Signal<ChatInterrupt | undefined>;
  subagents?: Signal<Map<string, ChatSubagent>>;
}
```

**Optionality policy.** Advanced capabilities (`interrupt`, `subagents`) are optional on the contract. Primitives that need them check presence and render nothing (or a neutral fallback) when absent. This is simpler than layered capability interfaces and matches how AG-UI models these as add-on event categories.

**History/time-travel** is intentionally absent. Primitives needing it import directly from `@cacheplane/langgraph`.

## Adapter design

### `@cacheplane/langgraph` adapter

```ts
export function toChatAgent<T>(ref: AgentRef<T, BagTemplate>): ChatAgent;
```

Translates:
- `BaseMessage[]` → `ChatMessage[]` (role/content extraction).
- `ToolCallWithResult[]` → `ChatToolCall[]`.
- `Interrupt` → `ChatInterrupt`.
- `Map<string, SubagentStreamRef>` → `Map<string, ChatSubagent>`.
- `ResourceStatus` → `ChatStatus` (simplify to idle/running/error; loading/reloading collapse to running).

### `@cacheplane/ag-ui` adapter

Subscribes to `AbstractAgent.run(...).subscribe(...)` and reduces events into signals:
- `TEXT_MESSAGE_*` → append/update `messages`.
- `TOOL_CALL_*`, `TOOL_CALL_RESULT` → append/update `toolCalls`.
- `STATE_SNAPSHOT` / `STATE_DELTA` (JSON Patch) → `state`.
- `RUN_STARTED` / `RUN_FINISHED` / `RUN_ERROR` → `status`, `isLoading`, `error`.
- Sub-agent composition events → `subagents`.
- Interrupt meta-events → `interrupt`.

Reducer is a plain function so it can be unit-tested without Angular.

## Migration (clean break, pre-1.0)

All libs are currently at 0.0.1. A breaking change is acceptable.

- Rename `@cacheplane/langgraph` → `@cacheplane/langgraph`. Update all internal consumers.
- Primitive inputs change from `AgentRef`-flavored types to `ChatAgent` types. No transitional overloads.
- Publish a tombstone `@cacheplane/langgraph` (or README redirect) pointing to the new package.
- CHANGELOG entries per phase documenting the import path and shape changes.
- Website and docs updated in lockstep with each phase (see Website & docs section).

## Phased delivery

Each phase ships as its own spec → implementation plan → PR set.

### Phase 1 — Core contract + rename
Primitives migrated: `provide-chat`, `chat-input`, `chat-messages`, `chat-tool-calls`, `chat-error`, `chat-typing-indicator`, `chat` composition (core path).

- Introduce `ChatAgent`, `ChatMessage`, `ChatToolCall`, `ChatSubmitInput`, `ChatStatus` in `@cacheplane/chat`.
- Rename `@cacheplane/langgraph` → `@cacheplane/langgraph`; add `toChatAgent()`.
- Ship `@cacheplane/ag-ui` covering lifecycle, message, tool-call, state events.
- Update affected tests; introduce `mockChatAgent()` helper under `@cacheplane/chat/testing`.

### Phase 2 — Interrupts and subagents
Primitives migrated: `chat-interrupt`, `chat-interrupt-panel`, `chat-subagents`, `chat-subagent-card`, `chat-generative-ui` surface.

- Extend contract with optional `interrupt` and `subagents` signals.
- Extend LangGraph adapter.
- Extend AG-UI adapter; accept that meta-event / sub-agent composition events in AG-UI are still maturing and may need version pinning.

### Phase 3 — LangGraph-only features documented
- `chat-timeline`, `chat-timeline-slider`, `chat-debug` keep direct imports from `@cacheplane/langgraph`.
- Docs page: capability matrix of primitives × runtimes.

## Website & docs

Treat documentation as a first-class deliverable of each phase, not a follow-up:

- **Architecture diagram** (the three-box diagram above) replaces any existing runtime-coupled diagram on the website.
- **Getting started** guides bifurcate: LangGraph path (`@cacheplane/langgraph`) and AG-UI path (`@cacheplane/ag-ui`), both ending in `toChatAgent()` fed to `<cp-chat>`.
- **Capability matrix** — a table listing each primitive/composition and which runtimes it supports (core / interrupts / subagents / history).
- **Migration guide** — dedicated page for the `@cacheplane/langgraph` → `@cacheplane/langgraph` rename plus primitive input changes.
- **API reference** — `ChatAgent`, `ChatMessage`, etc. documented with examples for each adapter.
- **Examples repo / apps/website demos** — at least one AG-UI-driven demo (e.g., against a Mastra or CopilotKit backend) to prove the decoupling end-to-end.

Website updates ship with each phase's PR; no phase is considered complete until docs are aligned.

## Testing

- **Contract conformance suite** lives in `@cacheplane/chat` and can be invoked by any adapter's test harness.
- LangGraph adapter keeps existing unit tests; adds `toChatAgent()` shape tests.
- AG-UI adapter drives its reducer with a fake event Observable (no network); integration test uses `@ag-ui/client` mock agent.
- Chat primitive tests migrate from `MockAgentRef` → `mockChatAgent()`.

## Risks

- **AG-UI protocol churn.** Draft events (MetaEvent, extended run events) are moving. Mitigate by pinning Phase 1 to stable core events only; Phase 2 accepts the risk of AG-UI adapter churn without affecting chat or LangGraph adapter.
- **Interrupt semantic divergence.** AG-UI's interrupt model is not 1:1 with LangGraph's. The `ChatInterrupt` shape must be broad enough for both; Phase 2 spec locks this down.
- **Naming break.** `@cacheplane/langgraph` → `@cacheplane/langgraph` forces import updates. Acceptable pre-1.0; migration guide mitigates.
- **Hidden LangGraph assumptions in primitives.** Some primitives may rely on `BaseMessage`-specific fields (e.g., `additional_kwargs`). Phase 1 audit surfaces these and folds them into `ChatMessage` or explicit escape hatches.

## Open questions for reviewer

1. Confirm the `@cacheplane/langgraph` → `@cacheplane/langgraph` rename (vs. keeping the old name).
2. Confirm that history / time-travel stays LangGraph-only and is not part of the contract.
3. Any appetite for a `@cacheplane/vercel-ai` or `@cacheplane/mastra` adapter in a later phase, or is AG-UI enough for non-LangGraph coverage?
