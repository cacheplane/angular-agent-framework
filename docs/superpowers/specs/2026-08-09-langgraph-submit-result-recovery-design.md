---
status: approved
owner: brian
scope: libs/langgraph
---

# LangGraph Client-Tool Submit Recovery (Design)

## 1. Goal

Prevent settled client-tool results from being lost when a LangGraph run fails, is interrupted, is aborted, or is superseded after those results have been attached to a run payload.

The adapter must make result replay safe, retain results until a handoff succeeds, and preserve the existing public `Agent` and `ClientToolsCapability` contracts.

## 2. Problem

The LangGraph adapter currently keeps settled client-tool results in a local buffer until either:

- `flush()` writes them directly into thread state,
- `resolve()` starts a continuation with them, or
- an ordinary `submit()` prepends them to its payload as a fallback.

The ordinary-submit path calls `drainToolMessages()` before `manager.submit()`. That permanently removes the results before the run outcome is known.

This has two consequences:

1. A failed run leaves no staged result for a later ordinary submit.
2. The bridge usually reports transport failures through status and error signals rather than rejecting its promise, so a simple promise `catch` around `manager.submit()` cannot restore the batch.

`retry()` can resend the bridge's last payload, but that only protects the explicit retry path. A later new submission cannot recover the drained result.

The buffered wire message also has no stable message `id`. Replaying it after an ambiguous failure could therefore append a second ToolMessage for the same `tool_call_id`.

## 3. Invariants

1. A settled client-tool result remains recoverable until a server handoff succeeds.
2. Replaying the same result is idempotent at the graph-state reducer.
3. A result is acknowledged only when the operation that carried it succeeds.
4. A failed, interrupted, aborted, or superseded operation leaves its result available for retry or a later submission.
5. A successful retry acknowledges only the result batch present in the retried payload; results settled afterward remain staged.
6. No result survives a thread switch or lands on a thread other than the one that produced its tool call.
7. Public `submit()`, `retry()`, `resolve()`, `settle()`, and `flush()` signatures do not change.
8. Retry and reload acknowledgment is always associated with the exact payload the bridge will resubmit, never with a queued or newer batch.

## 4. Adapter Alignment

The AG-UI adapter records each settled result in its source-owned message list with a stable ID derived from the tool-call ID. Its continuation and retry paths reuse that list, so a failed run does not destroy the result.

The LangGraph adapter cannot use the same storage mechanism because server thread state is authoritative and outbound messages are incremental state updates. It can preserve the same semantics by:

- assigning each buffered ToolMessage a deterministic message ID,
- snapshotting staged results for an operation without forgetting them,
- acknowledging the snapshot only after success, and
- replaying an unacknowledged snapshot when recovery is needed.

LangGraph's required `add_messages` reducer updates an existing message when the same message ID is written again. Stable identity therefore makes an ambiguous replay safe without requiring the optional server-side client-tool execution guard. That guard remains defense-in-depth for deployments that enable it.

## 5. Scope

### In scope

- Stable IDs on LangGraph client-tool result messages.
- Snapshot-and-ack ownership for staged result batches.
- Outcome-aware ordinary submit, client-tool continuation, flush, and retry handoffs.
- Thread-generation protection for late completions.
- Regression coverage for failure, retry, replay, concurrency, and thread switching.
- Updating internal comments and adapter guidance affected by the ownership change.

### Out of scope

- Public API changes.
- Exactly-once execution of browser-side effects.
- Requiring or automatically installing a server-side execution store.
- Changing AG-UI behavior.
- Changing graph schemas that do not use `add_messages`; the adapter already relies on that reducer for incremental message updates.
- Persistence across a browser reload when a custom transport provides no `updateState()` implementation.

## 6. Design

### 6.1 Stable result identity

`BufferedToolMessage` gains a required `id` field. The ID is deterministic for the tool call, for example:

```ts
id: `client-tool-result-${toolCallId}`
```

The same tool call always produces the same ToolMessage ID for settle, flush, continuation, submit fallback, and retry. Thread state is already scoped by thread ID, so the same tool-call ID on another thread does not collide.

### 6.2 Staged batch snapshots

Replace destructive read semantics with an internal batch abstraction:

```ts
interface StagedToolMessageBatch {
  readonly generation: number;
  readonly messages: readonly BufferedToolMessage[];
  acknowledge(): void;
}
```

Creating a batch:

1. Removes entries proven stale for the current thread.
2. Captures the current buffer generation.
3. Copies the currently staged messages without deleting them.
4. Returns an `acknowledge()` closure that removes only the captured message IDs and only when the generation still matches.

New results settled after the snapshot are not part of the batch and cannot be removed by its acknowledgment.

Because messages remain staged until acknowledgment, overlapping operations may carry the same stable message. This is safe under `add_messages` and prevents a newer submission from missing a result owned by an older in-flight operation.

### 6.3 Flush

`flush()` snapshots the current batch, writes it through `persistFn`, and acknowledges it only after the write resolves.

- A missing persistence function still rejects for a non-empty batch.
- A rejected write leaves the snapshot staged; no explicit re-staging is needed.
- Concurrent flushes remain chained so a later caller's newly settled results receive their own write.
- A late successful or failed write after a thread switch cannot acknowledge or revive the old thread's results because its generation is stale.

### 6.4 Run outcomes

`StreamManagerBridge.submit()` returns the bridge's existing `CompleteOutcome` internally. `resubmitLast()` returns a dedicated internal result:

```ts
type ResubmitOutcome = CompleteOutcome | 'not-started';
```

`'not-started'` means the bridge has no non-null payload to resubmit. It is not success and must never acknowledge a staged batch.

The public adapter methods continue to resolve `Promise<void>`: they await the internal outcome, perform result acknowledgment, and return no value.

Outcome handling:

| Outcome | Staged result action |
|---|---|
| `success` | acknowledge the batch carried by that payload |
| `error` | retain |
| `interrupted` | retain |
| `aborted` | retain |
| `paused` | retain |

The adapter distinguishes the bridge branch actually taken, not merely the presence of an enqueue option:

```ts
const createsQueuedRun =
  request.options?.multitaskStrategy === 'enqueue' && isLoading();
```

This predicate is evaluated immediately before `manager.submit()` and mirrors the bridge's synchronous branch condition.

- When `createsQueuedRun` is true, successful queue creation counts as a successful handoff because the queued run owns the complete payload. Queue-creation errors retain the batch and continue to reject as they do today. The queued operation does not replace the bridge's retryable `lastPayload`, so it does not replace or clear the capability's retryable batch association.
- When `createsQueuedRun` is false, the bridge starts an immediate stream and replaces `lastPayload` even if the options contain `multitaskStrategy: 'enqueue'`. The capability must replace or clear its retryable batch association in step with that immediate-stream payload.

### 6.5 Ordinary submit

For a non-null payload, the adapter:

1. Snapshots the current staged batch.
2. Prepends the batch messages to the outgoing payload.
3. When `createsQueuedRun` is false, records that batch as the one carried by the bridge's latest retryable payload.
4. Awaits the bridge outcome.
5. Acknowledges the batch only on `success`.

When `createsQueuedRun` is true, the submission treats its batch as an independent operation: successful queue creation acknowledges it, while failure retains it without changing the previous retryable batch association.

Null or undefined payloads do not snapshot or carry staged messages. On the immediate-stream branch they clear the capability's retryable batch association in step with the bridge setting its last payload to null, so a later retry cannot acknowledge an older batch that is no longer present on the wire. On the queued branch they leave the prior association unchanged because queue creation does not mutate the bridge's `lastPayload`.

### 6.6 Client-tool continuation

`resolve()` settles the result, snapshots all staged results for the active thread, and starts one continuation with that batch.

The continuation acknowledges its batch only on `success`. All other outcomes retain it for recovery. The method remains fire-and-forget at the public capability boundary.

### 6.7 Retry

The capability tracks the exact staged batch associated with the bridge's latest non-null, non-enqueue run payload. Ordinary submit and client-tool continuation both update this association when they replace the bridge's last payload.

`retry()` and `reload()` use one shared internal resubmit helper:

1. Reuses the bridge's existing last payload, preserving current retry behavior.
2. Awaits the internal outcome.
3. Does nothing to staged state for `'not-started'`.
4. Acknowledges the recorded batch only on `success`.

Results settled after the failed attempt are not part of the recorded batch and remain staged. A later ordinary submit may carry both the retained failed batch and newer staged results.

`retry()` continues to return `Promise<void>` and awaits the helper. `reload()` remains a public `void` method and starts the same helper in the background.

### 6.8 Thread switching

The existing thread-switch clear remains authoritative:

- clear all staged messages,
- retire outgoing tool-call IDs,
- increment the buffer generation.
- clear the capability's retryable batch association, and
- clear the bridge's `lastPayload` and `lastOptions`.

Every late batch acknowledgment becomes a no-op after the generation changes. Late handlers continue to be rejected by the retired-tool-call guard. A retry or reload issued on the new thread returns `'not-started'` until that thread has submitted its own retryable payload.

## 7. Data Flow

### Failed run followed by a new submit

```text
settle result
  -> staged with stable message ID
  -> submit snapshots and sends it
  -> run fails
  -> snapshot remains staged
  -> later submit sends the same stable message ID
  -> run succeeds
  -> snapshot acknowledged and removed
```

### Ambiguous mid-stream failure followed by retry

```text
submit sends stable result message
  -> server may already have applied it
  -> stream is interrupted
  -> result remains staged
  -> retry sends the same message ID
  -> add_messages updates/reuses the existing logical message
  -> retry succeeds
  -> snapshot acknowledged
```

### Thread switch during an in-flight operation

```text
operation snapshots generation N
  -> switchThread clears results and advances to N+1
  -> old operation completes
  -> generation mismatch prevents acknowledgment or restoration
  -> retry/reload has no old payload or batch to resend
```

## 8. Testing

### Client-tools unit tests

- Settled ToolMessages receive deterministic IDs.
- A failed flush leaves its snapshot staged.
- A successful flush acknowledges only its snapshot.
- A result settled during an in-flight flush remains staged for the chained flush.
- Multiple snapshots of the same result use the same ID.
- A stale-generation acknowledgment after thread switch is a no-op.

### Agent integration tests

- A pre-stream submit failure retains the result for the next ordinary submit.
- A mid-stream failure retains the result with the same message ID.
- A successful ordinary submit removes the result so an unrelated later submit does not resend it.
- A successful retry acknowledges the failed run's result batch.
- A successful retry does not acknowledge a newer result that was absent from the retried payload.
- A successful reload acknowledges the failed run's result batch through the same helper.
- Retry and reload after a thread switch do not resubmit or acknowledge the old thread's batch.
- A null immediate-stream submission clears the prior retryable batch association and yields `'not-started'` on retry.
- A null queued submission leaves the prior retryable batch association unchanged.
- A failed client-tool continuation retains its result.
- A successful client-tool continuation acknowledges its result.
- A null submit does not snapshot or acknowledge staged results.
- A thread switch discards staged and in-flight snapshots.
- An enqueue-option submission while idle follows the immediate-stream rules and replaces the retryable batch association.
- An enqueue-option submission while loading acknowledges on successful queue creation and retains on queue-creation failure without replacing the prior retryable batch association.

### Bridge tests

- `submit()` returns each existing terminal outcome without changing status/error behavior.
- `resubmitLast()` returns the retried attempt's outcome or `'not-started'` when no non-null payload exists.
- Superseded and user-aborted attempts return their existing non-success outcomes.
- Successful queue creation reports success; queue creation failures still reject.
- Thread switching clears the retained payload and options.

## 9. Verification

Run the smallest surface first, then the complete project checks:

```text
npx nx test langgraph --skip-nx-cache
npx nx lint langgraph --skip-nx-cache
npx nx build langgraph --skip-nx-cache
npx nx build website --skip-nx-cache
```

Also run `git diff --check` and review the complete branch diff against `origin/main` before committing implementation work.

## 10. Compatibility

- No public types or method signatures change.
- Existing successful submit, resolve, flush, and retry behavior remains unchanged.
- Custom transports without `updateState()` retain their documented next-run fallback.
- Stable message IDs improve replay behavior for both Python and JavaScript LangGraph graphs using `add_messages`.
- The optional durable execution guard remains compatible and can still filter duplicate result delivery by `tool_call_id`.
