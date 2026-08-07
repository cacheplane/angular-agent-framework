# Client-Tool Continuation Correctness Fixes

**Date:** 2026-08-07
**Status:** Approved for implementation
**Supersedes nothing.** Builds on `2026-07-07-client-tool-continuation-architecture-design.md`, which shipped as PRs #782–#805.

## Problem

A code review of the shipped client-tool continuation stack found five defects. Four of them violate a single invariant that the architecture depends on but never states:

> **The server thread must never hold a client tool call without a corresponding tool result.**

When it is violated, the thread contains an `AIMessage(tool_calls=[…])` with no following `ToolMessage`. Most providers reject that history outright ("an assistant message with `tool_calls` must be followed by tool messages responding to each `tool_call_id`"), so the next user turn fails with a 400 and the thread is unusable.

### Defect 1 — `followUp: false` corrupts LangGraph threads

`client-tools-coordinator.ts` computes `hasFollowUp = calls.some(tc => registry[tc.name]?.followUp !== false)`. When every tool in a group is terminal, `hasFollowUp` is `false`, the `groupComplete && group.hasFollowUp` branch never fires, and only `settle()` is ever called — `resolve()` never is.

In `libs/langgraph/src/lib/client-tools.ts`, `settle()` pushes onto a local `toolMessageBuffer` that is drained **only inside `resolve()`**. So the tool messages accumulate in a volatile browser array and never reach the server.

AG-UI is unaffected: its `settle()` calls `source.addMessage(...)`, so the message lands in the outgoing list and rides along on the next `runAgent()`. This asymmetry is the root cause — `settle()`'s contract is under-specified, and the two adapters implemented different meanings.

Existing tests miss it because `client-tools-coordinator.spec.ts` asserts `expect(resolve).not.toHaveBeenCalled()` against a **fake** capability, making the adapter-level consequence invisible.

### Defect 2 — Aborted tool calls re-execute

`runFunctionTool` returns without settling when `signal.aborted`. The call keeps `result === undefined` and never enters `resolvedIds`, so it stays in `pending()`. After the next run ends, the executor re-dispatches it. Without the opt-in execution guard (the default), a side-effecting handler runs a second time.

### Defect 3 — The max-turns guard discards results

`settleClientToolCall` starts with `if (!group.allowed) return;`. An `ask` tool's user-supplied answer is silently dropped, and the pending calls are never settled — the same dangling-tool-call corruption.

### Defect 4 — `agent.stop` wrapper stacking

`startClientToolExecutor` reassigns `agent.stop` and never restores it. `chat.component.ts`'s guard is keyed on the **coordinator** (`connected === coord`), so a coordinator swap against a long-lived (root-provided) agent stacks wrappers without bound.

The patch itself is legitimate: the stop button lives in `chat-input.component.ts:169`, which has no coordinator reference, so intercepting `agent.stop` is the only available seam. The bug is that the patch is neither idempotent nor reversible.

### Defect 5 — Postgres `tenant_id` is never enforced

`postgres-client-tool-execution-store.ts` writes `tenant_id` on insert but omits it from `PRIMARY KEY (thread_id, tool_call_id)` and from every `WHERE` clause in `claim`/`lookup`. It provides no tenant isolation.

## Design

### The contract change

`ClientToolsCapability` gains one method, making the three settlement verbs distinct:

| Verb | Meaning |
|---|---|
| `settle(id, result)` | Record the result locally and stage it for durability. Never continues. |
| `flush()` | Make everything staged durable server-side. Never continues. |
| `resolve(id, result)` | `settle` + `flush` + continue, in a single run. |

This is a **public API change**. Both adapters ship in lockstep at `0.0.x` and no backward compatibility is required, per explicit direction. New public exports require `npm run generate-api-docs` to be run and committed.

### Adapter implementations

**AG-UI** — `settle()` unchanged (still `addMessage`, already durable in the outgoing list). `flush()` is a no-op. `resolve()` unchanged.

**LangGraph** — `settle()` buffers as today. `flush()` writes the entire buffer in one call:

```ts
manager.updateState(threadId, { messages: buffer })   // no asNode
```

No `asNode` is passed, so `add_messages` appends and the graph's resume point is untouched. Because `updateState` is **optional** on `AgentTransport` (`agent.types.ts:229`), when it is absent `flush()` retains the buffer and `submit()` drains it at the existing `mergeClientTools` seam (`agent.fn.ts:455`). That degradation path is a strictly weaker but still-correct fallback.

### Fix mapping

Every defect below resolves to the same shape — **settle, then flush, without continuing**.

1. **`followUp: false`** — on completion of an all-terminal group, the coordinator calls `flush()` instead of doing nothing.
2. **Abort** — settle with a cancelled error, flush, and `record()` the cancelled result to the execution guard. Entering `resolvedIds` also removes the call from `pending()`, which fixes re-execution.
3. **Max-turns** — settle every stopped call, then flush. Tools that produced a real result (an `ask` answer, a completed handler) settle with **that result**; only tools blocked *before executing* settle with a "continuation limit reached" error. Nothing is discarded.
4. **`agent.stop`** — keep the interception, add a `WeakSet` ownership marker so wrapping is idempotent, and restore the original in `destroyRef.onDestroy`.
5. **Postgres** — `tenant_id TEXT NOT NULL DEFAULT ''`, added to the primary key and to every `WHERE` in `claim`/`lookup`/`record`.

### Error handling

`flush()` failure must never lose data. The buffer is cleared **only on success**; on any failure the results stay staged and the next `flush()` or `submit()` drains them.

- **409 conflict** — by construction no run is in flight, but a concurrent user submit can still race. Retry once, then fall back to submit-drain. Only the 409 is retried, and the retry is capped.
- **Empty buffer** — no-op, no round-trip.
- **Concurrent `flush()`** — guarded by an in-flight promise so the write never duplicates.
- **Missing `threadId`** — keep buffering rather than failing.

### Behavior changes

Two changes go beyond bug fixing and should be called out in the PR description:

- Abort now **writes to the server** (a cancelled tool result) where it was previously a silent no-op.
- The max-turns guard now **writes to the server** where it previously dropped results.

Both are required to maintain the invariant, but both are observable.

## Testing

### Deterministic local tests

- **Coordinator** — all-terminal group produces N settles and one flush with `resolve` never called; mixed groups behave as today; max-turns preserves real results and errors only blocked calls.
- **Executor** — abort mid-handler settles cancelled, flushes, records to the guard, and the call does not reappear in `pending()`; the stop-patch is idempotent across two `connect()` calls and is restored on destroy.
- **LangGraph capability** — `flush()` issues exactly one `updateState`; the buffer clears only on success; both failure and missing-`updateState` fall through to submit-drain; an empty buffer makes no call.
- **AG-UI capability** — `flush()` is a no-op; `settle()` still calls `addMessage`.
- **Middleware** — two tenants sharing a `thread_id`/`tool_call_id` claim independently.

### Live browser verification

A unit test cannot prove the corruption is gone, because the failure is a provider rejection of persisted server state. `examples/chat` gains a terminal `followUp: false` view tool and a low `maxTurns` toggle, then, driven in Chrome against a real LLM:

1. Trigger the terminal tool → no follow-up run fires, and `GET /threads/{id}/state` shows the `ToolMessage` present.
2. **Reload, then send another message** → no provider 400. This is the decisive test.
3. Start a slow client tool → Stop → send a new message → the tool does not re-execute.
4. Low `maxTurns` → the forced loop stops cleanly and the next message does not 400.

Environment notes from prior runs: export only the API key rather than sourcing root `.env` (it sets an internal token that enables auth middleware and produces a misleading 401), and do not run e2e while a live serve holds the same ports.

## Out of scope

- Any change to the explicit continuation model itself. The protocol-visible `pending()`/`resolve()` contract stands.
- Migration tooling for the Postgres schema change; the table is recreated.
