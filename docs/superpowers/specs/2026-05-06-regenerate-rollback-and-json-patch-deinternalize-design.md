# `@ngaf 0.0.27` — Regenerate proper rollback + drop `fast-json-patch` dep

**Status:** Approved
**Date:** 2026-05-06

## Two scoped fixes shipped together

### Fix 1 — Regenerate proper rollback (real replace-semantics)

**Background:** 0.0.26 added `Agent.regenerate(index)` but the LangGraph adapter only truncated the local `messages$` buffer and then `manager.submit({messages: [user]})` re-appended the user message — LangGraph thread state was never rolled back server-side. Smoke confirmed: `regenerate` still produces 2u/2a from 1u/1a. The fix is functionally inert.

**The pattern, learned from prior art** (paraphrased; architecture independently arrived at):

A correct regenerate flow is:
1. Truncate the local message buffer **inclusive of the preceding user message** (`slice(0, userIdx + 1)`) — keeps the user message, drops the assistant + everything after.
2. Synchronize that truncation server-side so the runtime sees the same state.
3. Re-run the agent against the trimmed state **with no new input** — the runtime treats the trailing user message as the active prompt.

**LangGraph adaptation:**

LangGraph's `add_messages` reducer doesn't replace state; it appends. To truncate server-side, emit `RemoveMessage` instances (from `@langchain/core/messages`) for each message at index > userIdx, send via `client.threads.updateState(threadId, { values: { messages: removeList } })`. The reducer recognizes RemoveMessage by id and removes those from state. Then run the graph with `input: null` (or empty messages array) — LangGraph re-runs from current truncated state without appending.

**ag-ui adaptation:**

ag-ui has no separate server-side state — its messages live in the local thread state. The current local-truncation works correctly, but should be made consistent with LangGraph's: truncate **inclusive** of user, then re-dispatch the run with the trimmed messages array as the input (which becomes the new state). The current ag-ui regenerate (post-0.0.26) appends the user message AGAIN before runAgent — fix is to NOT append, just dispatch.

**Implementation outline (LangGraph):**

```ts
regenerate: async (assistantMessageIndex: number) => {
  if (isLoading()) throw new Error('...');
  const msgs = messagesNeutral();
  const target = msgs[assistantMessageIndex];
  if (!target || target.role !== 'assistant') throw new Error('...');

  // Find user index
  const userIdx = msgs.slice(0, assistantMessageIndex)
    .map((m, i) => ({ m, i }))
    .reverse()
    .find(({ m }) => m.role === 'user')?.i;
  if (userIdx === undefined) throw new Error('No user message before target');

  // Local mirror — truncate inclusive of user
  const trimmedRaw = messages$.value.slice(0, userIdx + 1);
  messages$.next(trimmedRaw);

  // Server state — RemoveMessage for each dropped message
  const droppedRaw = messages$.value.slice(userIdx + 1).concat(
    messages$.value.slice(assistantMessageIndex), // ensure assistant + tail
  );
  const removeList = msgs.slice(userIdx + 1).map(m =>
    new RemoveMessage({ id: m.id })
  );
  await client.threads.updateState(threadId(), {
    values: { messages: removeList },
  });

  // Run with no new input — LangGraph re-runs from current state
  await manager.submit({ messages: [] }, undefined);
}
```

Adjustments may be needed based on the manager's `submit` signature; if `{ messages: [] }` doesn't trigger a re-run, fall back to `{ input: null }` or use `client.runs.stream` directly bypassing the manager.

**Implementation outline (ag-ui):**

```ts
regenerate: async (assistantMessageIndex: number) => {
  if (agent.isLoading()) throw new Error('...');
  const msgs = agent.messages();
  const target = msgs[assistantMessageIndex];
  if (!target || target.role !== 'assistant') throw new Error('...');

  const userIdx = msgs.slice(0, assistantMessageIndex)
    .map((m, i) => ({ m, i }))
    .reverse()
    .find(({ m }) => m.role === 'user')?.i;
  if (userIdx === undefined) throw new Error('...');

  const trimmed = msgs.slice(0, userIdx + 1);
  agent.messages.set(trimmed);
  await agent.submit({ messages: trimmed }); // run from trimmed state, no append
}
```

**Tests:**
- Unit: assert messagesNeutral after regenerate has length === userIdx + 1 (no duplicate user)
- Live Chrome: send 1 prompt → click regenerate → confirm DOM stays at 1u/1a (with new content)

### Fix 2 — Drop `fast-json-patch` dep in `@ngaf/ag-ui`

**Background:** `@ngaf/ag-ui` depends on `fast-json-patch` (CommonJS) for STATE_DELTA application. In Vite/vitest ESM contexts this surfaces as `Named export 'applyPatch' not found... CommonJS module`. The smoke harness in `~/tmp/ngaf` hits this on `extract-citations.smoke.spec.ts` — blocks adapter testing in any ESM-strict environment.

**Fix:** replace `fast-json-patch.applyPatch(...)` calls in `libs/ag-ui/src/lib/reducer.ts` with a tiny local pure-TS implementation. The actual operations needed are:
- `add` at a JSON Pointer path
- `replace` at a JSON Pointer path
- `remove` at a JSON Pointer path

A ~50-line `apply-patch.ts` covering RFC-6902 ops (with `getByPointer`/`setByPointer`/`unsetByPointer` helpers similar to `@ngaf/a2ui`'s pointer.ts) suffices. The `fast-json-patch` package supports more — `move`, `copy`, `test` — but those aren't used by the adapter (audit step in implementation: confirm via grep).

**Tests:**
- Unit tests in `apply-patch.spec.ts` covering each op + edge cases (root path, missing path, array element)
- Update existing `reducer.spec.ts` tests to confirm behavior unchanged
- Smoke harness: `extract-citations.smoke.spec.ts` should now load and run cleanly

## Versioning

`@ngaf/* 0.0.26` → `0.0.27`:
- `@ngaf/langgraph`: `regenerate` does proper rollback
- `@ngaf/ag-ui`: `regenerate` corrected; `fast-json-patch` removed from deps
- All 16 libs synchronized

## Out of scope

- LangGraph backend graph reducer changes (server-side cooperation). The fix uses standard `add_messages` + `RemoveMessage` semantics that any LangGraph-compatible backend supports.
- Branching / multi-version timeline.
- Coverage thresholds in CI.
- Any architectural changes beyond the two fixes above.
