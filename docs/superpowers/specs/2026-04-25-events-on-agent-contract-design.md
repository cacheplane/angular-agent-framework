# `events$` on `Agent` Contract Design

## Goal

Replace the optional, free-form `customEvents$?: Observable<AgentCustomEvent>` on the `Agent` contract with a required, structured `events$: Observable<AgentEvent>` carrying a discriminated union. Codify the invariant: **state lives on signals, events live on `events$`, neither duplicates the other.**

## Motivation

The current `customEvents$` is the only event-shaped concern on the contract today. It is:

- **Optional** — adapters may omit it, forcing every consumer to null-check before subscribing.
- **Free-form** — `{ type: string; [key: string]: unknown }` lets any field name flow through, but provides no type-narrowing for known event types like `state_update`.
- **Single example, no growth path** — the addition of more event-shaped concerns has been informally proposed (e.g., as part of broader course-correction discussions on AG-UI alignment). Without a structured union, each addition would either be a string-literal convention buried in handler code or a separate optional Observable on the contract.

Codifying `events$` as required + structured does three things:

1. **Removes optionality friction.** Every consumer can subscribe directly with no presence check.
2. **Makes well-known event types type-safe.** The current `chat.component.ts` handler does `if (event.type === 'state_update') { ... }` and trusts the payload shape; with the structured union, TypeScript narrows the variant.
3. **Establishes the duplication invariant.** State-bearing concerns (`messages`, `toolCalls`, `status`, `interrupt`, `subagents`, `state`, `history`) stay on signals. Events on `events$` carry only things that are not derivable from signals.

## Architecture

### Contract change

```ts
// libs/chat/src/lib/agent/agent-event.ts (new file)
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Render-state-store sync event. Adapters emit this when the runtime
 * publishes a state-snapshot intended for the chat library's render store
 * (used by generative UI and a2ui surfaces).
 */
export interface AgentStateUpdateEvent {
  readonly type: 'state_update';
  readonly data: Record<string, unknown>;
}

/**
 * Escape hatch for runtime-specific or user-defined events that do not
 * (yet) have a well-known structured variant. `name` carries the runtime
 * event name; `data` carries the payload verbatim.
 */
export interface AgentCustomEvent {
  readonly type: 'custom';
  readonly name: string;
  readonly data: unknown;
}

export type AgentEvent = AgentStateUpdateEvent | AgentCustomEvent;
```

```ts
// libs/chat/src/lib/agent/agent.ts (delta)
import type { Observable } from 'rxjs';
import type { AgentEvent } from './agent-event';

export interface Agent {
  // ...all existing signals unchanged...
  events$: Observable<AgentEvent>;   // required; replaces customEvents$
  // ...submit, stop unchanged...
}
```

### Removed types

- `AgentCustomEvent` (the previous free-form `{type: string, [k]: unknown}`) is **deleted**. The new `AgentCustomEvent` (structured `{type: 'custom', name, data}`) reuses the symbol — semantically the escape-hatch case is what the old one always was, but typed.

The collision in name is intentional: the structured variant **is** the spiritual successor. Any consumer that imported `AgentCustomEvent` updates their usage from `event.type === 'foo'` (free) to `event.type === 'custom' && event.name === 'foo'` (structured).

### File renames

- `libs/chat/src/lib/agent/agent-custom-event.ts` → `agent-event.ts`
- `libs/chat/src/lib/agent/agent-custom-event.spec.ts` → `agent-event.spec.ts`

### Required vs optional

Required. Adapters that have no event source pass `EMPTY` from RxJS:

```ts
import { EMPTY } from 'rxjs';

const agent: Agent = {
  // ...
  events$: EMPTY,
  // ...
};
```

This is preferable to optionality because:
- `EMPTY` is a one-line, free idiom for "this stream produces nothing".
- Consumers never write `if (agent.events$) ...`.
- Future event types added to the union benefit every adapter automatically; an adapter that wants to opt out of a specific event type just doesn't emit it.

### Adapter behavior

**LangGraph adapter (`libs/langgraph/src/lib/to-agent.ts`):**

The existing `buildCustomEvents$(ref)` helper translates LangGraph's `CustomStreamEvent[]` signal into the new `AgentEvent` stream. The translation:

```ts
function toAgentEvent(e: CustomStreamEvent): AgentEvent {
  if (e.name === 'state_update' && isRecord(e.data)) {
    return { type: 'state_update', data: e.data };
  }
  return { type: 'custom', name: e.name, data: e.data };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
```

The bridge subject + cursor pattern (effect-driven, append-only-array → Observable) is preserved. Rename the helper to `buildEvents$` to match the new contract field name.

**Mock helper (`libs/chat/src/lib/testing/mock-agent.ts`):**

```ts
export interface MockAgentOptions {
  // ...other options unchanged...
  events$?: Observable<AgentEvent>;   // optional input; defaults to EMPTY
  // (drop) customEvents$
}

export function mockAgent(opts: MockAgentOptions = {}): MockAgent {
  // ...
  return {
    // ...existing fields...
    events$: opts.events$ ?? EMPTY,
    // ...
  };
}
```

**Conformance helper (`libs/chat/src/lib/testing/agent-conformance.ts`):**

Replace the conditional `if (agent.customEvents$ !== undefined) ...` block with an unconditional assertion:

```ts
it('events$ is an Observable-like with .subscribe', () => {
  const agent = factory();
  expect(typeof agent.events$.subscribe).toBe('function');
});
```

### Consumer migration

Only one consumer in production: `libs/chat/src/lib/compositions/chat/chat.component.ts`. Today:

```ts
const stream$ = agent.customEvents$;
if (!stream$) return;
stream$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
  if (event.type !== 'state_update') return;
  const data = event['data'];
  if (!data || typeof data !== 'object') return;
  // ...store.update(data as Record<string, unknown>);
});
```

After:

```ts
agent.events$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
  if (event.type !== 'state_update') return;
  // event.data is Record<string, unknown> — narrowed by the discriminator
  const store = this.resolvedStore();
  if (!store) return;
  store.update(event.data);
});
```

Cleaner: no presence check, no untyped index access, no manual shape guard.

### Public API

`libs/chat/src/public-api.ts`:
- Remove: `AgentCustomEvent` (old free-form) export
- Add: `AgentEvent`, `AgentStateUpdateEvent`, `AgentCustomEvent` (new structured) exports

```ts
export type {
  // ...other types unchanged...
  AgentEvent,
  AgentStateUpdateEvent,
  AgentCustomEvent,   // now the structured escape-hatch variant
} from './lib/agent';
```

## What's deliberately NOT in the union

- **`tool_call_started/finished`** — already in `toolCalls: Signal<ToolCall[]>`; the array length and per-call `status` reflect lifecycle.
- **`interrupt_raised/resolved`** — already in `interrupt?: Signal<AgentInterrupt | undefined>`; presence change reflects the lifecycle.
- **`run_started/finished/errored`** — already in `status: Signal<AgentStatus>` and `error: Signal<unknown>`.
- **`message_streamed`** — already in `messages: Signal<Message[]>`; partial deltas are reflected as in-place message content updates.
- **`subagent_spawned`** — already in `subagents?: Signal<Map<string, Subagent>>`.

Adding events for any of these would violate the no-duplication invariant. If a consumer needs "happened-once" semantics for one of these (e.g., "fire a toast when a tool call finishes"), they derive it from the signal via an Angular `effect` that compares previous/current values.

## When to add new structured event types

Triggers:
- A second adapter (AG-UI) reveals an event pattern that isn't state-shaped (i.e., not a snapshot or current-value of any concern), and is used by enough consumers to deserve type narrowing.
- A chat-library convention emerges (similar to `state_update`) that crosses the runtime/library boundary.

Each addition is purely additive to the `AgentEvent` union — existing adapters that don't emit the new variant remain conformant.

## Out of Scope

- Backwards-compat alias `customEvents$` on `Agent`. Migration breaks compilation; consumers update at the same time.
- Snapshot/replay semantics for late subscribers. State signals already carry current values; `events$` is delta-only.
- Renaming `state_update` to a more chat-library-specific name. The convention is established and runtime-agnostic.
- Adding non-event-shaped concerns (history, threads, etc.) to `events$`.
- Renaming the bridge helper beyond `buildCustomEvents$` → `buildEvents$`.

## Risk

- **Breaking change to `customEvents$` shape and name.** Any external code subscribing to `agent.customEvents$` won't compile. Mitigated by the fact that only one production consumer exists today (`chat.component.ts`); the rest are tests and conformance helpers.
- **`state_update` heuristic in LangGraph translation.** The `e.name === 'state_update'` branch is a string-literal convention — if a runtime emits `state_update` with non-`Record` data, we fall through to `custom`. Documented in the translator helper.
