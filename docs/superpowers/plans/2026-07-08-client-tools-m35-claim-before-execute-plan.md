# Client Tool Claim Before Execute M3.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in Tier-2 claim-before-execute for browser function tools so guarded, non-idempotent handlers claim durably before running and fail closed on stale in-progress executions.

**Architecture:** Keep the runtime-neutral `Agent` contract intact and keep browser packages decoupled from `@threadplane/middleware`. `@threadplane/chat` owns a structural execution-guard boundary (`threadId` + store with `claim`/`record`/`lookup`), the function executor consults it only when supplied, and `action(..., { idempotent: true })` opts a handler out of the pre-execution round trip. Existing apps with no guard continue on the current fast path.

**Tech Stack:** TypeScript, Angular signals/effects, Vitest, Nx, generated API docs.

---

## Source Of Truth

- Spec: `docs/superpowers/specs/2026-07-07-client-tool-continuation-architecture-design.md` §7c, §7d, §7e, and milestone M3.5.
- M3 foundation: `@threadplane/middleware/langgraph` exports a compatible store interface and Postgres implementation. M3.5 must not import middleware from chat; the API stays structural so apps can bridge to a backend endpoint or reuse compatible types server-side.
- Tier 2 applies to browser-executed function tools. `view()` and `ask()` remain outside this PR because they do not run automatic browser side-effect handlers.
- No guard configured means Tier 0/Tier 1 behavior remains exactly as today.
- With a guard configured, function tools are fail-closed by default. `idempotent: true` opts out and uses the existing no-claim execution path.

## File Structure

- Create: `libs/chat/src/lib/client-tools/client-tool-execution-guard.ts`
  - Structural guard/store types, compatible with the M3 middleware store shape.
  - `defaultInterruptedClientToolResult()` and `clientToolGuardFailureResult()` helpers.
  - `shouldClaimBeforeExecute()` helper for function tool idempotency policy.
- Test: `libs/chat/src/lib/client-tools/client-tool-execution-guard.spec.ts`
  - Pure policy/result helper tests.
- Modify: `libs/chat/src/lib/client-tools/tool-def.ts`
  - Add `ClientToolExecutionOptions` with `idempotent?: boolean`.
  - Add `idempotent?: boolean` to function tool definitions.
- Modify: `libs/chat/src/lib/client-tools/tools.ts`
  - Add an optional fourth `options` parameter to `action()`.
- Modify: `libs/chat/src/lib/client-tools/client-tool-executor.ts`
  - Add optional `ClientToolExecutionGuard`.
  - Claim before executing guarded function tools.
  - Record successful or normalized error results before resolving.
  - Skip handler and resolve prior `done` results.
  - Skip handler, record an interrupted error, and resolve it for stale `executing`/unresolved `failed` records.
  - On claim/record failure, fail closed without running the handler.
- Test: `libs/chat/src/lib/client-tools/client-tool-executor.spec.ts`
  - Extend existing executor tests with M3.5 claim behavior.
- Modify: `libs/chat/src/lib/client-tools/client-tools-coordinator.ts`
  - Accept optional coordinator options and pass the execution guard to the executor.
- Test: `libs/chat/src/lib/client-tools/client-tools-coordinator.spec.ts`
  - Verify the coordinator forwards the guard and keeps unguarded behavior unchanged.
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
  - Add `clientToolExecutionGuard` input.
  - Include the guard in coordinator memoization.
- Test: `libs/chat/src/lib/compositions/chat/chat.component.client-tools.spec.ts`
  - Verify the chat composition wires the guard into function-tool execution.
- Modify: `libs/chat/src/lib/client-tools/index.ts`
  - Export new public guard and option types/helpers.
- Modify: `apps/website/content/docs/chat/api/api-docs.json`
  - Regenerate after public exports.

---

### Task 1: Guard Boundary And Idempotency Metadata

**Files:**
- Create: `libs/chat/src/lib/client-tools/client-tool-execution-guard.spec.ts`
- Create: `libs/chat/src/lib/client-tools/client-tool-execution-guard.ts`
- Modify: `libs/chat/src/lib/client-tools/tool-def.ts`
- Modify: `libs/chat/src/lib/client-tools/tools.ts`
- Modify: `libs/chat/src/lib/client-tools/index.ts`

- [x] **Step 1: Write failing guard/type tests**

Cover:
- `action(description, schema, handler, { idempotent: true })` preserves `idempotent: true`.
- `action(description, schema, handler)` leaves `idempotent` undefined.
- `shouldClaimBeforeExecute()` returns true for function tools unless `idempotent === true`.
- `defaultInterruptedClientToolResult()` returns an `ok:false` result mentioning the tool call id.
- `clientToolGuardFailureResult()` returns an `ok:false` result mentioning guard failure.

- [x] **Step 2: Run guard/type tests to verify red**

Run:

```bash
npx vitest run src/lib/client-tools/client-tool-execution-guard.spec.ts --config vite.config.mts
```

Expected: FAIL because the guard module/options do not exist.

- [x] **Step 3: Implement guard boundary and action options**

Add:

```ts
export interface ClientToolExecutionOptions {
  readonly idempotent?: boolean;
}

export interface ClientToolExecutionKey {
  readonly threadId: string;
  readonly toolCallId: string;
}

export type ClientToolExecutionRecord =
  | { readonly status: 'executing' }
  | { readonly status: 'done'; readonly result: ClientToolResult }
  | { readonly status: 'failed'; readonly result?: ClientToolResult };

export interface ClientToolExecutionStore {
  claim(key: ClientToolExecutionKey): Promise<'claimed' | ClientToolExecutionRecord>;
  record(key: ClientToolExecutionKey, result: ClientToolResult): Promise<void>;
  lookup(threadId: string, toolCallIds: readonly string[]): Promise<Record<string, ClientToolExecutionRecord>>;
}

export interface ClientToolExecutionGuard {
  readonly threadId: string;
  readonly store: ClientToolExecutionStore;
}
```

Add `idempotent?: boolean` to function tool definitions and copy options through `action()`.

- [x] **Step 4: Run guard/type tests to verify green**

Run:

```bash
npx vitest run src/lib/client-tools/client-tool-execution-guard.spec.ts --config vite.config.mts
```

Expected: PASS.

---

### Task 2: Function Executor Claim-Before-Execute

**Files:**
- Modify: `libs/chat/src/lib/client-tools/client-tool-executor.spec.ts`
- Modify: `libs/chat/src/lib/client-tools/client-tool-executor.ts`

- [x] **Step 1: Write failing executor tests**

Add focused tests:
- With no guard, existing execution path does not call any store.
- With guard and a non-idempotent action, `store.claim()` runs before the handler.
- On `'claimed'`, the handler runs, `store.record()` records the normalized result before `cap.resolve()`.
- On prior `{ status: 'done', result }`, the handler is not called and the stored result is resolved.
- On prior `{ status: 'executing' }`, the handler is not called, an interrupted error result is recorded, and that result is resolved.
- On `{ status: 'failed' }` without a result, the same fail-closed interrupted path is used.
- On guard claim failure, the handler is not called and a guard-failure error is resolved.
- On `idempotent: true`, the guard is bypassed and the handler runs on the existing path.
- If `agent.stop()` aborts before a delayed claim resolves, the handler is not called and no result is resolved.

- [x] **Step 2: Run executor tests to verify red**

Run:

```bash
npx vitest run src/lib/client-tools/client-tool-executor.spec.ts --config vite.config.mts
```

Expected: FAIL for missing options/guard behavior.

- [x] **Step 3: Implement minimal guarded execution**

Use one internal async helper per pending tool call:

```ts
if (!guard || !shouldClaimBeforeExecute(def)) {
  return executeAndResolveToday();
}

const key = { threadId: guard.threadId, toolCallId: tc.id };
const claim = await guard.store.claim(key);
if (signal.aborted) return;
if (claim === 'claimed') {
  const result = await executeFunctionTool(def, tc.args, { signal });
  if (signal.aborted) return;
  await guard.store.record(key, result);
  if (!signal.aborted) cap.resolve(tc.id, result);
  return;
}
if (claim.status === 'done') {
  cap.resolve(tc.id, claim.result);
  return;
}
const result = claim.status === 'failed' && claim.result
  ? claim.result
  : defaultInterruptedClientToolResult(tc.id);
await guard.store.record(key, result);
if (!signal.aborted) cap.resolve(tc.id, result);
```

On claim/record errors, fail closed with `clientToolGuardFailureResult()` and do not run the handler.

- [x] **Step 4: Run executor tests to verify green**

Run:

```bash
npx vitest run src/lib/client-tools/client-tool-executor.spec.ts --config vite.config.mts
```

Expected: PASS.

---

### Task 3: Coordinator And Chat Component Wiring

**Files:**
- Modify: `libs/chat/src/lib/client-tools/client-tools-coordinator.spec.ts`
- Modify: `libs/chat/src/lib/client-tools/client-tools-coordinator.ts`
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.client-tools.spec.ts`
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`

- [x] **Step 1: Write failing coordinator/component tests**

Cover:
- `createClientToolsCoordinator(registry, { executionGuard })` passes the guard to function-tool execution.
- Existing `createClientToolsCoordinator(registry)` still auto-executes unguarded actions.
- `ChatComponent` accepts a `clientToolExecutionGuard` input and guarded function tools claim before handler execution.

- [x] **Step 2: Run focused tests to verify red**

Run:

```bash
npx vitest run src/lib/client-tools/client-tools-coordinator.spec.ts src/lib/compositions/chat/chat.component.client-tools.spec.ts --config vite.config.mts
```

Expected: FAIL for missing coordinator options/component input.

- [x] **Step 3: Implement wiring**

Add:

```ts
export interface ClientToolsCoordinatorOptions {
  readonly executionGuard?: ClientToolExecutionGuard;
}
```

Pass `options.executionGuard` into `startClientToolExecutor()`. Add:

```ts
readonly clientToolExecutionGuard = input<ClientToolExecutionGuard | undefined>(undefined);
```

and include it when creating the coordinator.

- [x] **Step 4: Run focused tests to verify green**

Run:

```bash
npx vitest run src/lib/client-tools/client-tools-coordinator.spec.ts src/lib/compositions/chat/chat.component.client-tools.spec.ts --config vite.config.mts
```

Expected: PASS.

---

### Task 4: API Docs, Verification, And PR

**Files:**
- Modify: `apps/website/content/docs/chat/api/api-docs.json`
- Optional Modify: `libs/chat/README.md` only if an existing client-tools section is present and can be updated narrowly.

- [x] **Step 1: Regenerate API docs**

Run:

```bash
npm run generate-api-docs
```

Expected: chat API docs include the new public guard/options exports.

- [x] **Step 2: Run focused chat verification**

Run:

```bash
npx nx test chat
npx nx lint chat
npx nx build chat
```

Expected: tests, lint, and build complete without errors.

- [x] **Step 3: Run release-path guard**

Run:

```bash
npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,licensing,telemetry --configuration=production
node scripts/check-dx-coverage.mjs
```

Expected: library build guard and DX coverage pass.

- [x] **Step 4: Diff audit**

Run:

```bash
git diff --check
(git diff --name-only; git ls-files --others --exclude-standard) | rg -v '^docs/superpowers/' | xargs rg -n "hashbrown|copilotkit|chatgpt|claude" || true
```

Expected: no whitespace errors; changed non-plan files contain none of the forbidden external names.

- [ ] **Step 5: Commit and open PR**

Commit:

```bash
git add docs/superpowers/plans/2026-07-08-client-tools-m35-claim-before-execute-plan.md \
  libs/chat/src/lib/client-tools \
  libs/chat/src/lib/compositions/chat/chat.component.ts \
  libs/chat/src/lib/compositions/chat/chat.component.client-tools.spec.ts \
  apps/website/content/docs/chat/api/api-docs.json
git commit -m "feat: add client tool execution claims"
git push -u origin blove/client-tools-m35-claim-before-execute
```

Open a PR for M3.5 only. Enable auto-merge after checks are running, then merge on green before continuing to M4.
