# Decision: LangGraph-specific chat primitives live in `@cacheplane/langgraph`, not `@cacheplane/chat`

**Status:** Accepted
**Date:** 2026-04-21
**Context:** Phase-1 chat runtime decoupling completion (see `docs/superpowers/plans/2026-04-21-chat-custom-events-interrupt-migration.md`)

## Problem

Several primitives in `libs/chat/` render UI that depends on LangGraph-specific concepts — checkpoint history, checkpoint IDs, and `ThreadState` internals:

- `chat-timeline` (primitive)
- `chat-timeline-slider` (composition)
- `chat-debug` + `debug-controls` + `debug-summary` + `debug-utils` (composition + helpers)

These components consume `ref.history(): ThreadState<any>[]` and display checkpoint metadata (checkpoint IDs, values snapshots, fork/replay affordances) that do not exist in other runtimes (AG-UI, custom backends). Leaving them in `@cacheplane/chat` kept the package importing from `@cacheplane/langgraph` even after the core composition was decoupled, preserving the circular dependency `chat ↔ langgraph`.

## Options considered

**A1. Extend `ChatAgent` with optional `history?: Signal<ChatCheckpoint[]>`**

Add a runtime-neutral `ChatCheckpoint` type to the `ChatAgent` contract. `toChatAgent` would populate it from `ref.history()`. Other adapters would leave it undefined.

Rejected: the concept of a replay-able checkpoint with a checkpoint ID is fundamentally LangGraph-shaped. Other runtimes would be forced to either (a) leave `history` empty, rendering the timeline unusable, or (b) invent synthetic checkpoints that don't correspond to anything real. Either way the contract grows a concept that serves exactly one runtime. The "runtime-neutral" framing would be false advertising.

**A2. Move the langgraph-specific primitives into `libs/langgraph/` (CHOSEN)**

Relocate the six files into `libs/langgraph/src/lib/primitives/` (and `compositions/`). They continue to import `AgentRef` — now as a sibling module rather than a peer-dep. Consumers import `ChatTimelineComponent`, `ChatDebugComponent`, etc. from `@cacheplane/langgraph` rather than `@cacheplane/chat`.

Chosen because: (a) these components are honest about their LangGraph coupling — the source location matches the semantic truth; (b) `@cacheplane/chat` becomes pristinely runtime-neutral, which is the stated Phase-1 goal; (c) breaks the circular build-graph edge without inventing new contract surface.

**A3. New sibling package `@cacheplane/chat-langgraph`**

Rejected earlier in the brainstorming for this phase (see conversation 2026-04-21 — user declined to add a new package).

## Consequences

- **Breaking change** for any consumer importing `ChatTimelineComponent`, `ChatTimelineSliderComponent`, `ChatDebugComponent`, `DebugControlsComponent`, `DebugSummaryComponent`, or timeline/debug helpers from `@cacheplane/chat`. After the move, they must import from `@cacheplane/langgraph`.
- `@cacheplane/chat` no longer imports from `@cacheplane/langgraph`. The `@cacheplane/langgraph` peer-dep can be dropped from `libs/chat/package.json`.
- Dependency direction becomes strictly one-way: `@cacheplane/langgraph → @cacheplane/chat` (for `ChatAgent` types and `toChatAgent`).
- `mock-agent-ref.ts` in `libs/chat/src/lib/testing/` is deleted (no longer consumed after Group 1 migrations; it was always a LangGraph-shaped mock).

## When to revisit

Revisit this decision if any of the following become true:

1. **A second runtime adapter gains a meaningful checkpoint/history concept** (e.g. AG-UI adds branching checkpoints, or a user-written adapter wraps a stateful backend with comparable replay semantics). If more than one adapter has real history, a runtime-neutral `ChatCheckpoint` shape becomes tractable — at that point, promote `chat-timeline` / `chat-debug` back to `@cacheplane/chat` and extend the `ChatAgent` contract with `history?: Signal<ChatCheckpoint[]>`.

2. **The distinction between "generic chat primitive" and "langgraph-specific observability primitive" erodes** in practice. For example, if users start reaching for `ChatTimelineComponent` to render non-langgraph event sequences, or if the timeline UI proves useful for streams that aren't checkpoint-based, the primitive is no longer adapter-specific and should move back.

3. **A third language/framework adapter materialises** (e.g. a Python/LangChain-JS adapter that mirrors LangGraph's checkpoint shape). At three adapters with converging history models, the cost of duplicating observability UI per adapter outweighs the cost of a contract extension.

4. **The `@cacheplane/langgraph` package grows primitives unrelated to langgraph semantics**, which would suggest a separate `@cacheplane/chat-langgraph` package (option A3) is warranted after all.

Any revisit should start from re-reading this record and confirming which of the above triggered the reconsideration.
