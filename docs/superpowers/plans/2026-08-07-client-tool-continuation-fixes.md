# Client-Tool Continuation Correctness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five defects in the shipped client-tool continuation stack so the server thread never holds a client tool call without a result.

**Architecture:** Add an optional `flush()` to `ClientToolsCapability` meaning "make staged results durable without continuing the run." AG-UI implements it as a no-op (its `settle()` already calls `addMessage`); LangGraph implements it as one batched `threads.updateState` write, falling back to draining into the next `submit()` when `updateState` is unavailable. The coordinator and executor then route the `followUp:false`, abort, and max-turns paths through settle-then-flush.

**Tech Stack:** Angular 21 signals, Nx monorepo, Vitest, LangGraph SDK, `@ag-ui/client`, Postgres (tagged-template SQL).

**Spec:** `docs/superpowers/specs/2026-08-07-client-tool-continuation-fixes-design.md`

---

## File Structure

**Modify:**
- `libs/chat/src/lib/client-tools/client-tools-capability.ts` — add `flush?()` to the contract
- `libs/chat/src/lib/client-tools/client-tools-coordinator.ts` — terminal-group flush (defect 1), max-turns settle+flush (defect 3)
- `libs/chat/src/lib/client-tools/client-tool-executor.ts` — abort settles+flushes+records (defect 2), idempotent stop patch (defect 4)
- `libs/chat/src/lib/client-tools/index.ts` — export new types
- `libs/ag-ui/src/lib/client-tools.ts` — no-op `flush()`
- `libs/langgraph/src/lib/client-tools.ts` — batched `flush()`, `drainToolMessages()`
- `libs/langgraph/src/lib/agent.fn.ts` — supply `persistFn`, drain buffer into `submit()`
- `libs/middleware/src/langgraph/postgres-client-tool-execution-store.ts` — tenant isolation (defect 5)
- `examples/chat/angular/src/app/client-tools.ts` — demo terminal tool

**Test:** each module's adjacent `.spec.ts`.

---

### Task 1: Add `flush()` to the capability contract, AG-UI no-op

**Files:**
- Modify: `libs/chat/src/lib/client-tools/client-tools-capability.ts`
- Modify: `libs/ag-ui/src/lib/client-tools.ts`
- Test: `libs/ag-ui/src/lib/client-tools.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `libs/ag-ui/src/lib/client-tools.spec.ts` inside the top-level `describe`:

```ts
  it('exposes a no-op flush that does not start a run', async () => {
    const source = { addMessage: vi.fn() };
    const store = makeStore();
    const continueRun = vi.fn(async () => undefined);
    const cap = createClientToolsCapability(source, store, continueRun);
    cap.setCatalog([{ name: 'get_weather', description: 'w', parameters: {} }]);

    cap.settle?.('t1', { ok: true, value: 'sunny' });
    await cap.flush?.();

    expect(source.addMessage).toHaveBeenCalledTimes(1);
    expect(continueRun).not.toHaveBeenCalled();
  });
```

Use the same `makeStore()` helper the surrounding tests already use. If the file has no such helper, build the store inline exactly as the neighbouring `pending()` tests do.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test ag-ui -- -t "no-op flush"`
Expected: FAIL — `cap.flush is not a function`.

- [ ] **Step 3: Add `flush` to the contract**

In `libs/chat/src/lib/client-tools/client-tools-capability.ts`, add below `settle?`:

```ts
  /**
   * Make every result recorded via {@link settle} durable on the server
   * WITHOUT continuing the run. No-op for adapters whose settle() is already
   * durable. Adapters that buffer locally MUST clear their buffer only on a
   * successful write, so a failure degrades to a later flush or submit.
   */
  flush?(): void | Promise<void>;
```

- [ ] **Step 4: Implement the AG-UI no-op**

In `libs/ag-ui/src/lib/client-tools.ts`, add to the `clientTools` object literal after `settle`:

```ts
    // AG-UI's settle() already calls source.addMessage(), which places the
    // ToolMessage in the outgoing message list. Nothing further is needed to
    // make it durable — the next run carries it.
    flush(): void {
      /* no-op: settle() is already durable */
    },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test ag-ui -- -t "no-op flush"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/client-tools/client-tools-capability.ts libs/ag-ui/src/lib/client-tools.ts libs/ag-ui/src/lib/client-tools.spec.ts
git commit -m "feat(chat): add flush() to ClientToolsCapability"
```

---

### Task 2: LangGraph batched `flush()` with fallback drain

**Files:**
- Modify: `libs/langgraph/src/lib/client-tools.ts`
- Modify: `libs/langgraph/src/lib/agent.fn.ts:414-457`
- Test: `libs/langgraph/src/lib/client-tools.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `libs/langgraph/src/lib/client-tools.spec.ts`:

```ts
describe('flush', () => {
  const spec = { name: 'get_weather', description: 'w', parameters: {} };

  function setup(persist?: (m: readonly unknown[]) => Promise<void>) {
    const submitFn = vi.fn(async () => undefined);
    const applied: Array<[string, unknown]> = [];
    const store = {
      toolCalls: signal([] as readonly ToolCall[]),
      isLoading: signal(false),
      applyClientResult: (id: string, patch: unknown) => { applied.push([id, patch]); },
    };
    const cap = createClientToolsCapability(submitFn, store, persist);
    cap.setCatalog([spec]);
    return { cap, submitFn };
  }

  it('writes all buffered messages in a single persist call', async () => {
    const persist = vi.fn(async () => undefined);
    const { cap, submitFn } = setup(persist);

    cap.settle?.('t1', { ok: true, value: 'a' });
    cap.settle?.('t2', { ok: true, value: 'b' });
    await cap.flush?.();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0]).toEqual([
      { type: 'tool', role: 'tool', tool_call_id: 't1', content: 'a' },
      { type: 'tool', role: 'tool', tool_call_id: 't2', content: 'b' },
    ]);
    expect(submitFn).not.toHaveBeenCalled();
  });

  it('makes no call when the buffer is empty', async () => {
    const persist = vi.fn(async () => undefined);
    const { cap } = setup(persist);
    await cap.flush?.();
    expect(persist).not.toHaveBeenCalled();
  });

  it('keeps the buffer when persist fails so a later drain retries', async () => {
    const persist = vi.fn(async () => { throw new Error('boom'); });
    const { cap } = setup(persist);

    cap.settle?.('t1', { ok: true, value: 'a' });
    await cap.flush?.();

    expect(cap.drainToolMessages()).toEqual([
      { type: 'tool', role: 'tool', tool_call_id: 't1', content: 'a' },
    ]);
  });

  it('keeps the buffer when no persist function is supplied', async () => {
    const { cap } = setup(undefined);
    cap.settle?.('t1', { ok: true, value: 'a' });
    await cap.flush?.();
    expect(cap.drainToolMessages()).toHaveLength(1);
  });

  it('drainToolMessages empties the buffer', async () => {
    const { cap } = setup(undefined);
    cap.settle?.('t1', { ok: true, value: 'a' });
    cap.drainToolMessages();
    expect(cap.drainToolMessages()).toEqual([]);
  });
});
```

Ensure `signal` from `@angular/core` and `ToolCall` from `@threadplane/chat` are imported at the top of the spec; add them if absent.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test langgraph -- -t "flush"`
Expected: FAIL — `cap.flush is not a function`.

- [ ] **Step 3: Implement in `libs/langgraph/src/lib/client-tools.ts`**

Add the exported payload type above `createClientToolsCapability`:

```ts
/** Wire shape for a settled client-tool result awaiting durability. */
export interface BufferedToolMessage {
  readonly type: 'tool';
  readonly role: 'tool';
  readonly tool_call_id: string;
  readonly content: string;
}

/** Writes settled tool messages into server thread state without starting a run. */
export type PersistToolMessagesFn = (
  messages: readonly BufferedToolMessage[],
) => Promise<void>;
```

Change the factory signature to accept the persister:

```ts
export function createClientToolsCapability(
  submitFn: SubmitFn,
  store: ClientToolsStore,
  persistFn?: PersistToolMessagesFn,
): ClientToolsCapability & {
  catalog: Signal<readonly ClientToolSpec[]>;
  drainToolMessages(): BufferedToolMessage[];
} {
```

Add an in-flight guard beside the buffer declaration:

```ts
  let flushInFlight: Promise<void> | undefined;
```

Add these members to the returned `capability` object:

```ts
    /** Remove and return every buffered tool message. */
    drainToolMessages(): BufferedToolMessage[] {
      const drained = [...toolMessageBuffer];
      toolMessageBuffer.length = 0;
      return drained;
    },

    flush(): Promise<void> {
      if (flushInFlight) return flushInFlight;
      if (toolMessageBuffer.length === 0) return Promise.resolve();
      if (!persistFn) return Promise.resolve();

      // Snapshot first: the buffer is cleared ONLY after a successful write, so
      // a failure leaves the results staged for the next flush or submit drain.
      const batch = [...toolMessageBuffer];
      flushInFlight = persistFn(batch)
        .then(() => {
          toolMessageBuffer.splice(0, batch.length);
        })
        .catch((err: unknown) => {
          console.warn(
            `Client tool flush failed; ${batch.length} result(s) remain staged for the next run.`,
            err,
          );
        })
        .finally(() => {
          flushInFlight = undefined;
        });
      return flushInFlight;
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test langgraph -- -t "flush"`
Expected: PASS (5 tests)

- [ ] **Step 5: Wire the persister and submit-drain in `agent.fn.ts`**

Replace the `createClientToolsCapability(...)` call at `libs/langgraph/src/lib/agent.fn.ts:419-427` with:

```ts
  const clientToolsCap = createClientToolsCapability(
    (payload, opts) => manager.submit(payload, opts),
    {
      toolCalls: toolCallsNeutral,
      isLoading,
      applyClientResult: (id, patch) =>
        clientResultOverrides.update((m) => new Map(m).set(id, patch)),
    },
    // Durable write without a run. Absent asNode: add_messages appends and the
    // graph's resume point is untouched. Undefined when the transport has no
    // updateState — flush() then keeps the buffer for the submit drain below.
    manager.updateState
      ? async (messages) => {
          const threadId = lastThreadId;
          if (!threadId) throw new Error('no threadId for client tool flush');
          await manager.updateState!(
            threadId,
            { messages: [...messages] },
            new AbortController().signal,
          );
        }
      : undefined,
  );
```

Then replace the payload construction inside `submit` at line 455 with:

```ts
      // Drain any results settled but not yet made durable (flush unavailable
      // or a prior flush failed) so they ride along with this run.
      const staged = clientToolsCap.drainToolMessages();
      const withStaged = staged.length > 0
        ? mergeStagedToolMessages(request.payload, staged)
        : request.payload;
      const payload = mergeClientTools(withStaged, clientToolsCap.catalog());
      return manager.submit(payload, request.options);
```

Add this helper to `libs/langgraph/src/lib/client-tools.ts` and export it:

```ts
/**
 * Prepend staged tool messages to a run payload's message list.
 *
 * Mirrors mergeClientTools: a null payload signals a no-input resume and must
 * stay null, so staged messages cannot ride along and are left buffered.
 */
export function mergeStagedToolMessages(
  payload: unknown,
  staged: readonly BufferedToolMessage[],
): unknown {
  if (staged.length === 0) return payload;
  if (payload === null || payload === undefined) return payload;
  if (typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const record = payload as Record<string, unknown>;
  const existing = Array.isArray(record['messages']) ? record['messages'] : [];
  return { ...record, messages: [...staged, ...existing] };
}
```

Import `mergeStagedToolMessages` alongside `mergeClientTools` at `agent.fn.ts:70`.

**Note:** when `payload` is null the staged messages are returned to the buffer by design — `drainToolMessages()` already emptied it, so guard the drain:

```ts
      const staged = request.payload === null || request.payload === undefined
        ? []
        : clientToolsCap.drainToolMessages();
```

Use that guarded form instead of the unguarded drain above.

- [ ] **Step 6: Add the submit-drain test**

Append to `libs/langgraph/src/lib/client-tools.spec.ts`:

```ts
describe('mergeStagedToolMessages', () => {
  const staged = [
    { type: 'tool', role: 'tool', tool_call_id: 't1', content: 'a' },
  ] as const;

  it('prepends staged messages ahead of the payload messages', () => {
    const out = mergeStagedToolMessages({ messages: [{ type: 'human', content: 'hi' }] }, staged);
    expect(out).toEqual({
      messages: [
        { type: 'tool', role: 'tool', tool_call_id: 't1', content: 'a' },
        { type: 'human', content: 'hi' },
      ],
    });
  });

  it('leaves a null payload unchanged', () => {
    expect(mergeStagedToolMessages(null, staged)).toBeNull();
  });

  it('returns the payload unchanged when nothing is staged', () => {
    const payload = { messages: [] };
    expect(mergeStagedToolMessages(payload, [])).toBe(payload);
  });
});
```

Add `mergeStagedToolMessages` to the spec's import from `./client-tools`.

- [ ] **Step 7: Run the full langgraph suite**

Run: `npx nx test langgraph`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add libs/langgraph/src/lib/client-tools.ts libs/langgraph/src/lib/client-tools.spec.ts libs/langgraph/src/lib/agent.fn.ts
git commit -m "feat(langgraph): batched flush() with submit-drain fallback"
```

---

### Task 3: Coordinator flushes terminal groups (defect 1)

**Files:**
- Modify: `libs/chat/src/lib/client-tools/client-tools-coordinator.ts:149-176`
- Test: `libs/chat/src/lib/client-tools/client-tools-coordinator.spec.ts`

- [ ] **Step 1: Write the failing test**

Replace the existing `it('settles a fully-terminal group without resolving', ...)` test body's assertions by appending a new test after it:

```ts
  it('flushes a fully-terminal group so results reach the server', () => {
    const registry = tools({
      terminal_card: view(
        'Show terminal card',
        z.object({ city: z.string() }),
        FakeViewComponent as never,
        { followUp: false },
      ),
    });
    const { pending, settle, resolve, flush, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);
    const coordinator = createClientToolsCoordinator(registry);

    TestBed.runInInjectionContext(() => {
      coordinator.connect(agent);
    });

    pending.set([{ id: 'v1', name: 'terminal_card', args: { city: 'LA' }, status: 'running' }]);
    TestBed.flushEffects();

    expect(settle).toHaveBeenCalledWith('v1', { ok: true, value: { shown: true } });
    expect(flush).toHaveBeenCalledTimes(1);
    expect(resolve).not.toHaveBeenCalled();
  });
```

Update `makeFakeCapability()` in this spec so the returned capability includes `flush: vi.fn()` and the helper returns it alongside `settle`/`resolve`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat -- -t "flushes a fully-terminal group"`
Expected: FAIL — `flush` called 0 times.

- [ ] **Step 3: Implement**

In `client-tools-coordinator.ts`, replace the tail of `settleClientToolCall` (the block from `if (groupComplete && group.hasFollowUp)` to the end) with:

```ts
    if (groupComplete && group.hasFollowUp) {
      cap.resolve(tc.id, result);
      currentGroup = undefined;
      return;
    }

    cap.settle(tc.id, result);
    if (groupComplete) {
      // Terminal group: nothing will continue the run, so make the settled
      // results durable ourselves or the server keeps an unanswered tool call.
      flushSettledResults(cap);
      currentGroup = undefined;
    }
```

Add above `settleClientToolCall`:

```ts
  function flushSettledResults(cap: ClientToolsCapability): void {
    if (!cap.flush) {
      console.warn(
        'Client tool group settled with no follow-up, but the agent capability does not implement flush(); results may not reach the server.',
      );
      return;
    }
    void Promise.resolve(cap.flush()).catch((err: unknown) => {
      console.error('Client tool flush failed', err);
    });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test chat -- -t "flushes a fully-terminal group"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/client-tools/client-tools-coordinator.ts libs/chat/src/lib/client-tools/client-tools-coordinator.spec.ts
git commit -m "fix(chat): flush terminal client-tool groups to the server"
```

---

### Task 4: Max-turns settles and flushes without discarding results (defect 3)

**Files:**
- Modify: `libs/chat/src/lib/client-tools/client-tools-coordinator.ts:139-176`
- Test: `libs/chat/src/lib/client-tools/client-tools-coordinator.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it('settles blocked calls with a limit error and preserves real ask results', () => {
    const registry = tools({
      confirm: ask('Confirm', z.object({ q: z.string() }), FakeAskComponent as never),
    });
    const { pending, settle, resolve, flush, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);
    const coordinator = createClientToolsCoordinator(registry, {
      continuationPolicy: { maxTurns: 1 },
    });

    TestBed.runInInjectionContext(() => {
      coordinator.connect(agent);
    });

    // Turn 1 consumes the single allowed continuation.
    pending.set([{ id: 'a1', name: 'confirm', args: { q: 'x' }, status: 'running' }]);
    TestBed.flushEffects();
    coordinator.handleRenderEvent(agent, {
      type: 'result', elementKey: 'confirm', value: { confirmed: true },
    } as never);

    settle.mockClear();
    resolve.mockClear();
    flush.mockClear();

    // Turn 2 exceeds maxTurns: the user's answer must still be recorded.
    pending.set([{ id: 'a2', name: 'confirm', args: { q: 'y' }, status: 'running' }]);
    TestBed.flushEffects();
    coordinator.handleRenderEvent(agent, {
      type: 'result', elementKey: 'confirm', value: { confirmed: false },
    } as never);

    expect(settle).toHaveBeenCalledWith('a2', { ok: true, value: { confirmed: false } });
    expect(flush).toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat -- -t "preserves real ask results"`
Expected: FAIL — `settle` not called (current code returns early on `!group.allowed`).

- [ ] **Step 3: Implement**

In `settleClientToolCall`, replace `if (!group.allowed) return;` with:

```ts
    // Over the continuation limit: still record the result so the server never
    // keeps an unanswered tool call, but never continue the run.
    if (!group.allowed) {
      if (group.settledIds.has(tc.id)) return;
      group.settledIds.add(tc.id);
      if (cap.settle) {
        cap.settle(tc.id, result);
        flushSettledResults(cap);
      }
      return;
    }
```

Then make blocked function tools settle with an explicit limit error. In `connect()`, change the executor wiring so a blocked call is settled rather than silently skipped — replace the `shouldExecuteToolCall` option with:

```ts
        shouldExecuteToolCall: (tc) => {
          if (shouldHandleClientToolCall(agent, cap, tc)) return true;
          // Blocked before executing: record why, so the model sees a reason
          // instead of an unanswered tool call.
          settleClientToolCall(cap, agent, tc, {
            ok: false,
            error: `client tool continuation limit reached; ${tc.name} was not executed`,
          });
          return false;
        },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test chat -- -t "preserves real ask results"`
Expected: PASS

- [ ] **Step 5: Run the full coordinator spec**

Run: `npx nx test chat -- -t "createClientToolsCoordinator"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/client-tools/client-tools-coordinator.ts libs/chat/src/lib/client-tools/client-tools-coordinator.spec.ts
git commit -m "fix(chat): record results when the continuation limit stops a group"
```

---

### Task 5: Abort settles, flushes, and records (defect 2)

**Files:**
- Modify: `libs/chat/src/lib/client-tools/client-tool-executor.ts:80-157`
- Test: `libs/chat/src/lib/client-tools/client-tool-executor.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it('settles an aborted handler so it cannot re-execute', async () => {
    const settled: Array<[string, unknown]> = [];
    let release!: () => void;
    const registry = tools({
      slow: action('Slow', z.object({}), async () => {
        await new Promise<void>((r) => { release = r; });
        return 'done';
      }),
    });
    const pending = signal([
      { id: 's1', name: 'slow', args: {}, status: 'running' },
    ] as readonly ToolCall[]);
    const agent = makeAgentWithPending(pending, (id, result) => settled.push([id, result]));

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry, {
        settleToolCall: (tc, result) => settled.push([tc.id, result]),
      });
    });
    TestBed.flushEffects();

    await agent.stop();
    release();
    await drainMicrotasks();

    expect(settled).toHaveLength(1);
    expect(settled[0][0]).toBe('s1');
    expect((settled[0][1] as { ok: boolean }).ok).toBe(false);
  });
```

Build `makeAgentWithPending` following the existing helpers in this spec file; it must expose `clientTools.pending`, a `resolve`/`settle` pair, and a real `stop()` returning a promise.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat -- -t "cannot re-execute"`
Expected: FAIL — `settled` is empty (aborted path returns without settling).

- [ ] **Step 3: Add the cancelled-result helper**

In `libs/chat/src/lib/client-tools/client-tool-execution-guard.ts`, add:

```ts
/** Result recorded when the user stops a run while a client tool is running. */
export function cancelledClientToolResult(toolCallId: string): ClientToolResult {
  return {
    ok: false,
    error: `client tool execution cancelled before completion: ${toolCallId}`,
  };
}
```

Export it from `libs/chat/src/lib/client-tools/index.ts` alongside the other guard helpers.

- [ ] **Step 4: Implement the abort path**

In `client-tool-executor.ts`, replace every bare `if (signal.aborted) return;` and `if (!signal.aborted) settleToolCall(...)` guard in `runFunctionTool` and `recordOrResolveGuardFailure` so an abort settles instead of dropping. Concretely, in `runFunctionTool` replace the no-guard branch:

```ts
  if (!executionGuard || !shouldClaimBeforeExecute(def)) {
    const result = await executeFunctionTool(def, rawArgs, { signal });
    settleToolCall(toolCall, signal.aborted ? cancelledClientToolResult(toolCallId) : result);
    return;
  }
```

the post-claim branch:

```ts
  if (claim === 'claimed') {
    const result = await executeFunctionTool(def, rawArgs, { signal });
    const finalResult = signal.aborted ? cancelledClientToolResult(toolCallId) : result;
    await recordOrResolveGuardFailure(
      executionGuard, key, finalResult, toolCall, toolCallId, settleToolCall,
    );
    return;
  }
```

and the pre-claim abort check:

```ts
  if (signal.aborted) {
    settleToolCall(toolCall, cancelledClientToolResult(toolCallId));
    return;
  }
```

In `recordOrResolveGuardFailure`, drop the `signal` parameter and the `!signal.aborted` conditions so the guard is always recorded:

```ts
async function recordOrResolveGuardFailure(
  executionGuard: ClientToolExecutionGuard,
  key: ClientToolExecutionKey,
  result: ClientToolResult,
  toolCall: ToolCall,
  toolCallId: string,
  settleToolCall: (toolCall: ToolCall, result: ClientToolResult) => void,
): Promise<void> {
  try {
    await executionGuard.store.record(key, result);
  } catch (err) {
    settleToolCall(toolCall, clientToolGuardFailureResult(toolCallId, err));
    return;
  }
  settleToolCall(toolCall, result);
}
```

Update both call sites to drop the `signal` argument. Import `cancelledClientToolResult`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test chat -- -t "cannot re-execute"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/client-tools/client-tool-executor.ts libs/chat/src/lib/client-tools/client-tool-execution-guard.ts libs/chat/src/lib/client-tools/index.ts libs/chat/src/lib/client-tools/client-tool-executor.spec.ts
git commit -m "fix(chat): settle aborted client tools instead of leaving them pending"
```

---

### Task 6: Idempotent, reversible `agent.stop` patch (defect 4)

**Files:**
- Modify: `libs/chat/src/lib/client-tools/client-tool-executor.ts:37-50`
- Test: `libs/chat/src/lib/client-tools/client-tool-executor.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it('wraps agent.stop once across repeated executor starts', () => {
    const registry = tools({ noop: action('n', z.object({}), async () => 'x') });
    const pending = signal([] as readonly ToolCall[]);
    const agent = makeAgentWithPending(pending, () => undefined);
    const original = agent.stop;

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
      startClientToolExecutor(agent, registry);
    });

    expect(agent.stop).not.toBe(original);
    const afterFirstWrap = agent.stop;
    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
    });
    expect(agent.stop).toBe(afterFirstWrap);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat -- -t "wraps agent.stop once"`
Expected: FAIL — each start installs a new wrapper.

- [ ] **Step 3: Implement**

In `client-tool-executor.ts`, add above `startClientToolExecutor`:

```ts
/** Agents whose stop() this module has already wrapped. */
const patchedAgents = new WeakSet<Agent>();
```

Replace the patch block with:

```ts
  // The stop button lives in chat-input, which has no coordinator reference,
  // so wrapping agent.stop is the only interception seam. Wrap at most once
  // per agent and restore on destroy — agents often outlive components.
  if (!patchedAgents.has(agent)) {
    patchedAgents.add(agent);
    const originalStop = agent.stop.bind(agent);
    agent.stop = async (): Promise<void> => {
      abortAll();
      await originalStop();
    };
    destroyRef.onDestroy(() => {
      agent.stop = originalStop;
      patchedAgents.delete(agent);
    });
  }
  destroyRef.onDestroy(abortAll);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test chat -- -t "wraps agent.stop once"`
Expected: PASS

- [ ] **Step 5: Run the full chat client-tools suite**

Run: `npx nx test chat`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/client-tools/client-tool-executor.ts libs/chat/src/lib/client-tools/client-tool-executor.spec.ts
git commit -m "fix(chat): wrap agent.stop once and restore it on destroy"
```

---

### Task 7: Postgres tenant isolation (defect 5)

**Files:**
- Modify: `libs/middleware/src/langgraph/postgres-client-tool-execution-store.ts`
- Test: `libs/middleware/src/postgres-client-tool-execution-store.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('isolates identical thread/tool ids across tenants', async () => {
  const rows: Array<Record<string, unknown>> = [];
  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    rows.push({ text: strings.join('?'), values });
    return [];
  }) as never;

  const storeA = createPostgresClientToolExecutionStore(sql, { tenantId: 'a' });
  await storeA.lookup('thread-1', ['tc-1']);

  const last = rows[rows.length - 1];
  expect(String(last['text'])).toContain('tenant_id');
  expect(last['values']).toContain('a');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test middleware -- -t "isolates identical thread"`
Expected: FAIL — `lookup` emits no `tenant_id` predicate.

- [ ] **Step 3: Implement**

Replace the schema constant:

```ts
export const THREADPLANE_CLIENT_TOOL_EXECUTIONS_SCHEMA = `
CREATE TABLE IF NOT EXISTS threadplane_client_tool_executions (
  tenant_id     text        NOT NULL DEFAULT '',
  thread_id     text        NOT NULL,
  tool_call_id  text        NOT NULL,
  status        text        NOT NULL,
  result        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, thread_id, tool_call_id)
);
`;
```

Change the tenant default to a non-null empty string:

```ts
  const tenantId = opts.tenantId ?? '';
```

Add `tenant_id` to every conflict target and predicate:

```ts
        ON CONFLICT (tenant_id, thread_id, tool_call_id) DO NOTHING
```

```ts
        WHERE tenant_id = ${tenantId}
          AND thread_id = ${key.threadId}
          AND tool_call_id = ${key.toolCallId}
```

```ts
        WHERE tenant_id = ${tenantId}
          AND thread_id = ${threadId}
          AND tool_call_id = ANY(${[...toolCallIds]})
```

and in `record`, update the conflict target to `(tenant_id, thread_id, tool_call_id)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test middleware -- -t "isolates identical thread"`
Expected: PASS

- [ ] **Step 5: Run the full middleware suite**

Run: `npx nx test middleware`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/middleware/src/langgraph/postgres-client-tool-execution-store.ts libs/middleware/src/postgres-client-tool-execution-store.spec.ts
git commit -m "fix(middleware): enforce tenant isolation in the execution store"
```

---

### Task 8: Demo terminal tool in examples/chat

**Files:**
- Modify: `examples/chat/angular/src/app/client-tools.ts`

- [ ] **Step 1: Read the existing registry**

Read `examples/chat/angular/src/app/client-tools.ts` in full and match its import style, schema conventions, and component patterns before adding anything.

- [ ] **Step 2: Add a terminal view tool**

Add one `view` tool declared with `{ followUp: false }` that renders a short trip-summary card from the itinerary the demo already models. Reuse an existing card component if one fits; otherwise create a sibling standalone component following `day-card.component.ts`'s structure exactly (signal inputs, encapsulated CSS on `--ds-*` tokens — utility classes do not compile in example apps).

Register it in the exported `tools({ ... })` map with a name the graph can call, e.g. `show_trip_summary`.

- [ ] **Step 3: Verify the example builds**

Run: `npx nx build examples-chat --configuration=production`
Expected: SUCCESS. (Production config carries a bundle budget that dev builds do not.)

If the project name differs, discover it with `npx nx show projects | grep chat`.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/src/app
git commit -m "feat(examples): add terminal client tool to the chat demo"
```

---

### Task 9: Regenerate API docs and run the full verification gate

**Files:**
- Modify: generated API docs

- [ ] **Step 1: Regenerate**

Run: `npm run generate-api-docs`

- [ ] **Step 2: Lint the touched projects**

Run: `npx nx run-many -t lint -p chat ag-ui langgraph middleware 2>&1 | grep -cE ' error '`
Expected: `0`. Warnings are tolerated by CI; errors are not.

- [ ] **Step 3: Test the touched projects**

Run: `npx nx run-many -t test -p chat ag-ui langgraph middleware`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: regenerate API docs for flush() capability"
```

---

### Task 10: Live browser verification

**Files:** none (verification only)

- [ ] **Step 1: Serve the demo with a real key**

Export **only** the model API key. Sourcing root `.env` also exports an internal token that switches on auth middleware and produces a misleading 401. Confirm no dev server already holds the ports before starting.

- [ ] **Step 2: Terminal tool does not continue**

Drive the chat in Chrome until the model calls `show_trip_summary`. Confirm the card renders and **no** follow-up assistant turn begins. Then fetch `GET /threads/{threadId}/state` and confirm a `ToolMessage` with the matching `tool_call_id` is present.

- [ ] **Step 3: The decisive test — reload and continue**

Reload the page, then send another message. Expected: a normal assistant reply, **no** provider 400. Before this change this step fails.

- [ ] **Step 4: Abort does not re-execute**

Trigger a slow client tool, press Stop mid-execution, then send a new message. Confirm the tool does not run a second time and the thread has no unanswered tool call.

- [ ] **Step 5: Max-turns stops cleanly**

Configure a low `maxTurns`, drive a loop until the guard fires, then send another message. Expected: clean stop, no 400.

- [ ] **Step 6: Record the evidence**

Capture console output and the thread-state JSON for the PR description. Do not claim any step passed without the observed output.

---

## Self-Review

**Spec coverage:** Defect 1 → Tasks 1–3. Defect 2 → Task 5. Defect 3 → Task 4. Defect 4 → Task 6. Defect 5 → Task 7. `flush()` contract → Task 1. LangGraph fallback drain → Task 2. Behavior-change callouts → PR description (Task 10 evidence). Live verification → Task 10. Demo surface → Task 8.

**Type consistency:** `flush?()` is declared optional in Task 1 and every call site guards on `cap.flush`. `BufferedToolMessage`, `PersistToolMessagesFn`, `mergeStagedToolMessages`, and `drainToolMessages()` are defined in Task 2 and used consistently in Tasks 2 and 3. `cancelledClientToolResult` is defined in Task 5 Step 3 before its Step 4 use. `recordOrResolveGuardFailure`'s signature loses `signal` in Task 5 and both call sites are updated in the same step.

**Known risk:** Task 4's `shouldExecuteToolCall` change makes a predicate perform a side effect. Verify in review that it is invoked exactly once per blocked call; if the effect re-runs, move the settle into the executor loop instead.
