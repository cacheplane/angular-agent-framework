# Client Tool Abort Signal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `AbortSignal` to function client-tool handler context and prevent aborted executions from resolving or starting a continuation.

**Architecture:** Keep the change in `@threadplane/chat`, where client-tool declaration and execution already live. `action()` and `FunctionToolDef` gain an additive second handler argument, `executeFunctionTool()` passes a context through, and `startClientToolExecutor()` owns one `AbortController` per in-flight function-tool call. Abort is triggered by `agent.stop()` and Angular injector teardown; resolved results are ignored when the signal is aborted.

**Tech Stack:** Angular signals/effects, Vitest, Zod v4 Standard Schema, Nx, generated API docs.

---

## Source Of Truth

- Spec: `docs/superpowers/specs/2026-07-07-client-tool-continuation-architecture-design.md` §5b and milestone M2.
- Contract: `handler(args, { signal })` is additive; existing one-argument handlers keep working.
- Abort behavior: an aborted handler must not call `resolve()` and therefore must not start a continuation run.
- Scope: M2 only. Do not implement `settle()`, batching, durable dedup, or max-turns in this phase.

## File Structure

- Modify: `libs/chat/src/lib/client-tools/tool-def.ts`
  - Add `FunctionToolHandlerContext`.
  - Add the second handler parameter to `FunctionToolDef` and `AnyFunctionToolDef`.
- Modify: `libs/chat/src/lib/client-tools/tools.ts`
  - Accept the additive handler context in `action()`.
  - Update API docs comments.
- Modify: `libs/chat/src/lib/client-tools/execute.ts`
  - Accept optional handler context.
  - Pass `{ signal }` to the handler after argument validation.
- Modify: `libs/chat/src/lib/client-tools/client-tool-executor.ts`
  - Create one `AbortController` per in-flight function tool.
  - Abort in-flight tools on `agent.stop()` and injector teardown.
  - Suppress `cap.resolve()` when a controller has been aborted.
- Modify: `libs/chat/src/lib/client-tools/index.ts`
  - Re-export the new context type.
- Modify: `libs/chat/src/public-api.ts`
  - Re-export the new context type.
- Modify: `apps/website/content/docs/chat/api/api-docs.json`
  - Regenerate after public API change.
- Test: `libs/chat/src/lib/client-tools/execute.spec.ts`
  - Verify `executeFunctionTool()` passes `signal` to the handler.
- Test: `libs/chat/src/lib/client-tools/client-tool-executor.spec.ts`
  - Verify executor passes a non-aborted signal.
  - Verify `stop()` aborts in-flight work and suppresses `resolve()`.
  - Verify injector teardown aborts in-flight work.
- Test: `libs/chat/src/lib/client-tools/tools.type-spec.ts`
  - Verify inferred handler context type while preserving existing argument and return inference.

---

### Task 1: Handler Context Type And Direct Execution

**Files:**
- Modify: `libs/chat/src/lib/client-tools/tool-def.ts`
- Modify: `libs/chat/src/lib/client-tools/tools.ts`
- Modify: `libs/chat/src/lib/client-tools/execute.ts`
- Modify: `libs/chat/src/lib/client-tools/index.ts`
- Modify: `libs/chat/src/public-api.ts`
- Test: `libs/chat/src/lib/client-tools/execute.spec.ts`
- Test: `libs/chat/src/lib/client-tools/tools.type-spec.ts`

- [x] **Step 1: Write failing direct-execution test**

Add to `execute.spec.ts`:

```ts
it('passes the handler context signal to the handler', async () => {
  const controller = new AbortController();
  const handler = vi.fn(async (_args: { city: string }, context: { signal: AbortSignal }) => {
    expect(context.signal).toBe(controller.signal);
    return 'ok';
  });
  const def = action('ctx', z.object({ city: z.string() }), handler);

  const result = await executeFunctionTool(def, { city: 'SF' }, { signal: controller.signal });

  expect(result).toEqual({ ok: true, value: 'ok' });
  expect(handler).toHaveBeenCalledOnce();
});
```

- [x] **Step 2: Write failing type assertion**

Update `tools.type-spec.ts`:

```ts
import type { FunctionToolDef, ClientToolDef, FunctionToolHandlerContext } from './tool-def';

type _ctxInfer = Expect<Equal<Parameters<typeof moveAction.handler>[1], FunctionToolHandlerContext>>;
```

Expected: the focused chat type/test run fails because the second handler parameter does not exist yet.

- [x] **Step 3: Run focused tests to verify red**

Run from `libs/chat`:

```bash
npx vitest run src/lib/client-tools/execute.spec.ts src/lib/client-tools/tools.type-spec.ts --config vite.config.mts
```

Expected: FAIL because handler context is not typed/passed.

- [x] **Step 4: Implement minimal context plumbing**

Add `FunctionToolHandlerContext` in `tool-def.ts`:

```ts
export interface FunctionToolHandlerContext {
  readonly signal: AbortSignal;
}
```

Update `FunctionToolDef`, `AnyFunctionToolDef`, and `action()` handler types to accept `(args, context)`.

Update `executeFunctionTool()` to accept an optional context:

```ts
const defaultSignal = new AbortController().signal;

export async function executeFunctionTool(
  def: AnyFunctionToolDef,
  rawArgs: unknown,
  context: FunctionToolHandlerContext = { signal: defaultSignal },
): Promise<ClientToolResult> {
  // validate first, then call:
  const value = await def.handler((v as { value: unknown }).value as never, context);
}
```

Export `FunctionToolHandlerContext` from `libs/chat/src/lib/client-tools/index.ts` and `libs/chat/src/public-api.ts`.

- [x] **Step 5: Run focused tests to verify green**

Run from `libs/chat`:

```bash
npx vitest run src/lib/client-tools/execute.spec.ts src/lib/client-tools/tools.type-spec.ts --config vite.config.mts
```

Expected: PASS.

---

### Task 2: Executor Abort Semantics

**Files:**
- Modify: `libs/chat/src/lib/client-tools/client-tool-executor.ts`
- Test: `libs/chat/src/lib/client-tools/client-tool-executor.spec.ts`

- [x] **Step 1: Write failing signal delivery test**

Add to `client-tool-executor.spec.ts`:

```ts
it('passes a non-aborted signal to function tool handlers', async () => {
  const seen: AbortSignal[] = [];
  const registry = tools({
    read: action('read', z.object({}), async (_args, context) => {
      seen.push(context.signal);
      return 'done';
    }),
  });
  const { pending, capability } = makeFakeCapability();
  const agent = makeFakeAgent(capability);

  TestBed.runInInjectionContext(() => {
    startClientToolExecutor(agent, registry);
  });

  pending.set([{ id: 's1', name: 'read', args: {}, status: 'complete' }]);
  TestBed.flushEffects();
  await drainMicrotasks();

  expect(seen).toHaveLength(1);
  expect(seen[0].aborted).toBe(false);
});
```

- [x] **Step 2: Write failing stop-abort test**

Add to `client-tool-executor.spec.ts`:

```ts
it('aborts in-flight function tools on stop and does not resolve them', async () => {
  let complete!: (value: string) => void;
  const completion = new Promise<string>((resolve) => {
    complete = resolve;
  });
  const seen: AbortSignal[] = [];
  const registry = tools({
    slow: action('slow', z.object({}), async (_args, context) => {
      seen.push(context.signal);
      return completion;
    }),
  });
  const { pending, resolve, capability } = makeFakeCapability();
  const agent = makeFakeAgent(capability);

  TestBed.runInInjectionContext(() => {
    startClientToolExecutor(agent, registry);
  });

  pending.set([{ id: 'slow-1', name: 'slow', args: {}, status: 'complete' }]);
  TestBed.flushEffects();
  await drainMicrotasks();

  await agent.stop();
  expect(seen[0].aborted).toBe(true);

  complete('late result');
  await drainMicrotasks();

  expect(resolve).not.toHaveBeenCalled();
});
```

- [x] **Step 3: Write failing injector-teardown test**

Add to `client-tool-executor.spec.ts`:

```ts
it('aborts in-flight function tools when the injection context is destroyed', async () => {
  const seen: AbortSignal[] = [];
  const registry = tools({
    slow: action('slow', z.object({}), async (_args, context) => {
      seen.push(context.signal);
      return new Promise(() => undefined);
    }),
  });
  const { pending, capability } = makeFakeCapability();
  const agent = makeFakeAgent(capability);

  TestBed.runInInjectionContext(() => {
    startClientToolExecutor(agent, registry);
  });

  pending.set([{ id: 'slow-2', name: 'slow', args: {}, status: 'complete' }]);
  TestBed.flushEffects();
  await drainMicrotasks();

  TestBed.resetTestingModule();

  expect(seen[0].aborted).toBe(true);
});
```

- [x] **Step 4: Run executor tests to verify red**

Run from `libs/chat`:

```bash
npx vitest run src/lib/client-tools/client-tool-executor.spec.ts --config vite.config.mts
```

Expected: FAIL because executor does not pass context or abort in-flight work.

- [x] **Step 5: Implement minimal executor abort behavior**

In `client-tool-executor.ts`:

```ts
const destroyRef = inject(DestroyRef);
const inFlight = new Map<string, AbortController>();

const abortAll = (): void => {
  for (const controller of inFlight.values()) {
    controller.abort();
  }
};

const originalStop = agent.stop.bind(agent);
agent.stop = async () => {
  abortAll();
  await originalStop();
};

destroyRef.onDestroy(abortAll);
```

For each function tool call, create a controller, pass `{ signal: controller.signal }`, and resolve only if `!controller.signal.aborted`.

- [x] **Step 6: Run executor tests to verify green**

Run from `libs/chat`:

```bash
npx vitest run src/lib/client-tools/client-tool-executor.spec.ts --config vite.config.mts
```

Expected: PASS.

---

### Task 3: Public API Docs And Verification

**Files:**
- Modify: `apps/website/content/docs/chat/api/api-docs.json`

- [x] **Step 1: Regenerate API docs**

Run:

```bash
npm run generate-api-docs
```

Expected: generated chat API docs include `FunctionToolHandlerContext`.

- [x] **Step 2: Run project tests**

Run:

```bash
npx nx test chat
```

Expected: PASS.

- [x] **Step 3: Run focused adapter smoke tests**

Run:

```bash
npx nx test ag-ui
npx nx test langgraph
```

Expected: PASS, proving the additive handler type did not break adapter test suites.

- [x] **Step 4: Run lint and count errors**

Run:

```bash
npx nx lint chat 2>&1 | tee /tmp/threadplane-chat-m2-lint.log; grep -cE ' error ' /tmp/threadplane-chat-m2-lint.log
npx nx lint ag-ui 2>&1 | tee /tmp/threadplane-ag-ui-m2-lint.log; grep -cE ' error ' /tmp/threadplane-ag-ui-m2-lint.log
npx nx lint langgraph 2>&1 | tee /tmp/threadplane-langgraph-m2-lint.log; grep -cE ' error ' /tmp/threadplane-langgraph-m2-lint.log
```

Expected: each grep count is `0`.

- [x] **Step 5: Diff audit**

Run:

```bash
git diff --check
git diff --name-only
(git diff --name-only; git ls-files --others --exclude-standard) | rg -v '^docs/superpowers/' | xargs rg -n "hashbrown|copilotkit|chatgpt|claude" || true
```

Expected: no whitespace errors; changed files match M2 scope; forbidden external names are absent from changed code and generated docs except spec/plan markdown where allowed.
