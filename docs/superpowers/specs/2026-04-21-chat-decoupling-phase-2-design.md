# Chat Decoupling Phase-2 Design

## Goal

Complete the chat-runtime decoupling started in Phase-1 by removing the last `AgentRef` dependencies from the LangGraph-hosted compositions (`ChatDebugComponent`, `ChatTimelineComponent`, `ChatTimelineSliderComponent`). They become runtime-neutral consumers of a new `ChatAgentWithHistory` sub-contract and move back to `@cacheplane/chat`.

## Motivation

Phase-1 broke the circular `@cacheplane/chat ↔ @cacheplane/langgraph` build-graph edge by migrating all primitives and most compositions to the runtime-neutral `ChatAgent` contract. Three compositions were relocated to `@cacheplane/langgraph` because they still read `AgentRef.history()` / `ThreadState` and the Phase-1 scope didn't cover extending the `ChatAgent` contract.

Phase-2 finishes the story: a non-LangGraph adapter (AG-UI, custom runtime, etc.) that exposes a history-like surface can power the same debug/timeline UI. The compositions live where they belong — in the chat library.

## Architecture

Add a sub-contract in `@cacheplane/chat`:

```ts
export interface ChatCheckpoint {
  id?:    string;                    // adapter-opaque ID
  label?: string;                    // human label (e.g., next node name)
  values: Record<string, unknown>;   // state snapshot
}

export interface ChatAgentWithHistory extends ChatAgent {
  history: Signal<ChatCheckpoint[]>;
}
```

`toChatAgent(ref)` in `@cacheplane/langgraph` widens its return type to `ChatAgentWithHistory` and translates `ThreadState[]` → `ChatCheckpoint[]` (`next[0]`→`label`, `checkpoint.checkpoint_id`→`id`, `values` passthrough).

The three compositions stop depending on `AgentRef` / `ThreadState` and read only the neutral sub-contract.

## Sub-Contract Design

**Read-only.** Replay/fork stay as composition outputs emitting the opaque `ChatCheckpoint.id`. The parent app calls whatever runtime-specific API it wants. This preserves the current division of labor and avoids making the contract opinionated about time-travel semantics.

**Extends, not embeds.** `ChatAgentWithHistory extends ChatAgent`. A plain `ChatAgent` never gains a `history` field — compositions that need history take the richer type explicitly. This keeps the capability visible in the type system and prevents adapters that can't supply history from silently returning empty arrays.

**Minimal neutral shape.** `ChatCheckpoint` has only the fields actually read by the compositions today. No `extra` passthrough — runtime-neutrality is strict. If future compositions need adapter-specific data, we'll grow the neutral shape or add sibling sub-contracts rather than leaking opaque state.

## File Movement

**Move from `libs/langgraph/src/lib/` → `libs/chat/src/lib/`:**

| Current | New |
|---|---|
| `primitives/chat-timeline/chat-timeline.component.ts` | `primitives/chat-timeline/chat-timeline.component.ts` |
| `primitives/chat-timeline/chat-timeline.component.spec.ts` | `primitives/chat-timeline/chat-timeline.component.spec.ts` |
| `compositions/chat-timeline-slider/chat-timeline-slider.component.ts` | `compositions/chat-timeline-slider/chat-timeline-slider.component.ts` |
| `compositions/chat-timeline-slider/chat-timeline-slider.component.spec.ts` | `compositions/chat-timeline-slider/chat-timeline-slider.component.spec.ts` |
| `compositions/chat-debug/chat-debug.component.ts` | `compositions/chat-debug/chat-debug.component.ts` |
| `compositions/chat-debug/chat-debug.component.spec.ts` | `compositions/chat-debug/chat-debug.component.spec.ts` |
| `compositions/chat-debug/debug-timeline.component.ts` | (same) |
| `compositions/chat-debug/debug-detail.component.ts` | (same) |
| `compositions/chat-debug/debug-controls.component.ts` | (same) |
| `compositions/chat-debug/debug-summary.component.ts` | (same) |
| `compositions/chat-debug/debug-checkpoint-card.component.ts` | (same) |
| `compositions/chat-debug/debug-state-inspector.component.ts` | (same) |
| `compositions/chat-debug/debug-state-diff.component.ts` | (same) |
| `compositions/chat-debug/debug-utils.ts` | (same, rewired to `ChatCheckpoint`) |
| `compositions/chat-debug/state-diff.ts` | (same) |

`debug-utils.ts` simplifies: `toDebugCheckpoint(cp: ChatCheckpoint, i)` reads `cp.label ?? \`Step ${i+1}\`` and `cp.id` directly. `extractStateValues` takes `ChatCheckpoint | undefined` and returns `cp?.values ?? {}`.

## Public API

**`@cacheplane/chat/public-api.ts`:**
- Add: `ChatAgentWithHistory`, `ChatCheckpoint` (types); `ChatTimelineComponent`, `ChatTimelineSliderComponent`, `ChatDebugComponent` (components).

**`@cacheplane/langgraph/public-api.ts`:**
- Remove: `ChatTimelineComponent`, `ChatTimelineSliderComponent`, `ChatDebugComponent`, and the debug sub-component exports added in Phase-1.
- Keep: `toChatAgent` (now typed to return `ChatAgentWithHistory`).

## Cockpit Consumers

**Affected apps** (per Phase-1 grep): `cockpit/chat/debug/angular`, `cockpit/chat/timeline/angular`.

Today they pass `[ref]="stream"` to the debug/timeline compositions. After Phase-2 they pass `[agent]="chatAgent"` where `chatAgent: ChatAgentWithHistory = toChatAgent(stream)` — already assigned in Phase-1 code for the chat primitives. Net change: template-only.

The `replayRequested` / `forkRequested` output handlers in those apps remain runtime-specific (they call LangGraph's checkpoint APIs on `stream`). No API surface change there.

## Testing & Mocks

- `mockChatAgent()` in `@cacheplane/chat/testing` grows an optional `history?: ChatCheckpoint[]`. When supplied, the return type widens to `ChatAgentWithHistory`.
- New `runChatAgentWithHistoryConformance(label, factory)` helper layers on top of the existing `runChatAgentConformance` — asserts `ChatAgent` contract plus `history()` emission and shape.
- `toChatAgent` gains a unit test covering the `ThreadState` → `ChatCheckpoint` translation (next→label, checkpoint_id→id, values passthrough, empty/partial states).
- Composition specs that currently use `createMockAgentRef` switch to `mockChatAgent({ history: [...] })`.

## Dep Graph

No change: `langgraph → chat` remains one-way. `nx graph` verification is part of the final build-check step.

## Out of Scope

- Replay/fork methods on the sub-contract (rejected — parent-handled outputs are sufficient).
- `extra` passthrough on `ChatCheckpoint` (rejected — runtime-neutrality is strict).
- Moving `toChatAgent` itself (stays in `@cacheplane/langgraph`).
- Cockpit app refactors beyond the template-one-liner switch.

## When to Revisit

Triggers that would reopen these decisions:

- A second adapter (AG-UI, custom) needs to power `chat-debug` or `chat-timeline` — likely fine under current design; validate on first attempt.
- A composition appears that genuinely needs adapter-specific fields — reopen the `extra` passthrough decision before adding it.
- Parent apps start duplicating replay/fork handler code across runtimes — reopen whether replay/fork belongs on the contract.
