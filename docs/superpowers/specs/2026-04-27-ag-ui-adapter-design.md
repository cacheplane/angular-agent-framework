# `@cacheplane/ag-ui` Adapter Design

## Goal

Build a runtime adapter that projects an AG-UI `AbstractAgent`'s event stream into the `@cacheplane/chat` `Agent` contract. Proves the chat-runtime decoupling end-to-end: the same chat UI primitives can be driven by AG-UI as well as LangGraph.

## Motivation

Phases 1–2 plus the rename and `events$` contract work made `@cacheplane/chat` runtime-neutral. AG-UI is the most strategic second adapter:

- **Industry standard.** AG-UI is a CopilotKit-led protocol with broad ecosystem support — LangGraph Platform, CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, Google Agent SDK. One adapter unlocks all of them.
- **Event-stream native.** AG-UI is fundamentally an `Observable<BaseEvent>` model. Mapping into our signals + `events$` contract is direct.
- **Validates the abstraction.** Without a second adapter, the `Agent` contract is "LangGraph types with the LangGraph filed off." AG-UI exposes whether the abstraction holds in practice.

This is the originating motivation behind the chat-decoupling work; AG-UI is the demand-side it was always pointing at.

## Architecture

### Package

New package `@cacheplane/ag-ui` at `libs/ag-ui/`.

**Dependencies:**
- `@cacheplane/chat` (peer dep)
- `@cacheplane/licensing` (peer dep — same as other libs)
- `@ag-ui/client` (peer dep)
- `@angular/core`, `rxjs` (peer deps)

`@cacheplane/chat` does NOT depend on `@cacheplane/ag-ui`. The dep graph stays one-way: `ag-ui → chat`. Symmetric with `langgraph → chat`.

### Public API

```ts
// libs/ag-ui/src/public-api.ts (sketch)

// Primitive — wraps any AbstractAgent subclass (custom transports, mocks).
export function toAgent(source: AbstractAgent): Agent;

// Ergonomic — instantiates HttpAgent under the hood for the common case.
export function provideAgUiAgent(cfg: AgUiAgentConfig): Provider[];

// Re-exports for convenience.
export type { AgUiAgentConfig } from './lib/provide-ag-ui-agent';
```

```ts
export interface AgUiAgentConfig {
  url: string;
  agentId?: string;
  threadId?: string;
  headers?: Record<string, string>;
}
```

### Naming

`toAgent` matches the LangGraph adapter's export name. Consumers importing both packages alias at the import site:

```ts
import { toAgent as toAgUiAgent } from '@cacheplane/ag-ui';
import { toAgent as toLangGraphAgent } from '@cacheplane/langgraph';
```

Same naming convention agreed during the rename design — see `docs/superpowers/specs/2026-04-24-agent-rename-design.md`.

### Wrapping strategy

`toAgent(source: AbstractAgent)` is the primitive — works with any `AbstractAgent` subclass, including user-written ones with custom transports. Most users go through `provideAgUiAgent({ url })` which constructs an `HttpAgent` (the SSE/HTTP transport `@ag-ui/client` ships) and threads it through `toAgent`.

This combo gives custom transports (subclass `AbstractAgent`, hand to `toAgent`) and ergonomic defaults (`provideAgUiAgent({ url })`) in one package.

## Event → Contract Mapping

Scope B: messages + lifecycle + tool calls + state. No interrupt, no subagents, no history.

| AG-UI event | Agent contract effect |
|---|---|
| `RunStarted` | `status: 'running'`, `isLoading: true`, `error: null` |
| `RunFinished` | `status: 'idle'`, `isLoading: false` |
| `RunError` | `status: 'error'`, `isLoading: false`, `error: event.message` |
| `TextMessageStart` | append `Message { role: 'assistant', content: '' }` |
| `TextMessageContent` | replace in-flight assistant message content with accumulated delta |
| `TextMessageEnd` | finalize (no signal change) |
| `ToolCallStart` | append `ToolCall { id, name, args: {}, status: 'running' }` |
| `ToolCallArgs` | replace `args` on the in-flight tool call (full-replace, not JSON-merge) |
| `ToolCallEnd` | mark `status: 'complete'` |
| `ToolCallResult` | set `result` on the matching tool call |
| `StateSnapshot` | replace `state` signal wholesale |
| `StateDelta` | apply JSON-Patch (RFC 6902) to `state` |
| `MessagesSnapshot` | replace `messages` signal (thread restore) |
| `CustomEvent` | emit on `events$`. If `name === 'state_update'` and `data` is `Record<string, unknown>`, emit `{ type: 'state_update', data }`; otherwise emit `{ type: 'custom', name, data }` |

### Submit / stop

`submit({ message })`:
1. Optimistically append the user message to `messages` signal (so the UI echoes immediately, matching the LangGraph adapter's behavior).
2. Build `runAgent` parameters: `{ messages: messages(), state: state() }`.
3. Call `source.runAgent(params, { signal: abortController.signal })`.
4. The reducer drives subsequent events into signals.

`stop()`:
- Aborts the in-flight `AbortController` if any. The underlying `runAgent` rejects with an abort error, which is swallowed (already represented in `error` signal if `RunError` fires).

### State store

The adapter owns:
- `WritableSignal<Message[]>` for `messages`
- `WritableSignal<AgentStatus>` for `status`
- `WritableSignal<boolean>` for `isLoading`
- `WritableSignal<unknown>` for `error`
- `WritableSignal<ToolCall[]>` for `toolCalls`
- `WritableSignal<Record<string, unknown>>` for `state`
- `Subject<AgentEvent>` for `events$`
- `AbortController | undefined` for `stop()`
- A subscription handle to `source.agent()` (cleaned up on caller's destroy via injection context, or by replacing the subscription in subsequent `submit` calls)

### Reducer extraction

The mapping logic lives in a pure function `reduceEvent(event, store)` in `libs/ag-ui/src/lib/reducer.ts`. Trivially unit-testable: drive events through, assert signal contents.

`toAgent` wires the reducer to the source agent's event stream:

```ts
source.agent().subscribe((evt) => reduceEvent(evt, store));
```

## Initial State for Late Subscribers

Not a problem. AG-UI emits `MessagesSnapshot` and `StateSnapshot` events natively when a session bootstraps. Primitives mounting mid-conversation read current signal values, which the reducer populated from those snapshots.

`events$` carries only `state_update` and `custom` events per the contract invariant — snapshots are state-bearing and flow through signals, not `events$`. No replay machinery needed.

## Testing Strategy

### Unit (`libs/ag-ui/src/lib/reducer.spec.ts`)

Table-driven tests, one per event kind, hitting the right signal updates. Pure-function reducer means tests are fast and deterministic.

### Integration (`libs/ag-ui/src/lib/to-agent.spec.ts`)

Stub `AbstractAgent` exposing a `Subject<BaseEvent>` the test controls. Drive events through the stub; assert on the resulting `Agent` signals.

```ts
class StubAgent extends AbstractAgent {
  readonly events$ = new Subject<BaseEvent>();
  agent() { return this.events$.asObservable(); }
  // ...minimal runAgent / abortRun stubs
}
```

### Conformance (`libs/ag-ui/src/lib/to-agent.conformance.spec.ts`)

Runs `runAgentConformance(label, factory)` from `@cacheplane/chat/testing` against an `Agent` built from a stub source. Validates the AG-UI adapter passes the same contract conformance suite as `toAgent` from `@cacheplane/langgraph`.

### Out of scope

- Real-network HTTP testing of `provideAgUiAgent` — manual cockpit-demo verification only.
- AG-UI protocol-version pinning tests — relies on `@ag-ui/client`'s own contract.

## Cockpit Demo

One new app: `cockpit/ag-ui/streaming/angular/`. Mirrors `cockpit/langgraph/streaming/angular/` structurally:

- `app.config.ts` calls `provideAgUiAgent({ url: environment.agUiUrl })`.
- `streaming.component.ts` uses the standard `<chat>` composition from `@cacheplane/chat`.
- Demonstrates: same chat UI, different runtime.

If no public AG-UI backend is reachable from CI, the cockpit app builds but is env-flagged like other secret-gated demos.

## Out of Scope (Phase-1 of AG-UI adapter)

- `interrupt`, `subagents`, `history` signals on the produced `Agent`. Returns plain `Agent`, not `AgentWithHistory`. AG-UI debug/timeline UIs deferred until a future phase translates the relevant AG-UI concepts.
- Tool-call streaming with incremental JSON-merge of `args`. First pass treats `ToolCallArgs` as full-replace.
- Custom transports beyond `HttpAgent` for `provideAgUiAgent`. Custom-transport users go through `toAgent(customAgent)`.
- Auth/headers beyond `headers?: Record<string, string>`.
- Thread switching beyond construction-time `threadId` — `Agent` contract has no `switchThread` method.
- Translation of AG-UI's interrupt model to `AgentInterrupt`. Different shape; deferred.
- Shared adapter reducer infrastructure. AG-UI ships its own bespoke reducer; cross-adapter extraction comes after we've seen both reducers in production.

## Risk

- **AG-UI protocol churn.** `@ag-ui/client` is pre-1.0 and may break across versions. Mitigation: pin to a stable point release in `package.json`; document the version in this spec when implementing.
- **`StateDelta` JSON-Patch dependency.** AG-UI uses RFC 6902 for partial state updates. We need a JSON-Patch implementation; `fast-json-patch` is the standard. Adds a runtime dep — flag if undesirable.
- **Cockpit demo backend availability.** A public AG-UI demo URL may not exist that's stable enough for CI. Mitigation: env-flag the demo wiring; fall back to a stub backend in CI.
- **Subscription lifetime.** `source.agent().subscribe(...)` inside `toAgent` runs without an injection context. The subscription must be cleaned up — either by tying it to a passed `DestroyRef`, or by exposing a `dispose()` on the produced `Agent` (NOT on the contract). Need to decide during implementation; documenting risk here.

## When to Revisit

- A second AG-UI demo backend lands and the JSON-Patch dependency is exercised — confirm `fast-json-patch` choice or replace.
- AG-UI 1.0 ships and breaks our adapter — refresh the protocol version pin.
- Real consumers ask for `interrupt` / `subagents` / `history` on the AG-UI adapter — design the translation in a follow-up.
- The shared adapter reducer is extracted (after we've seen both LangGraph and AG-UI reducers in practice) — refactor `reduceEvent` to drive the shared reducer.
