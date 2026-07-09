# Client Tools M4 Settle Batching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the optional `settle()` client-tools capability and change coordinator-driven client-tool continuation from one run per resolved tool to one run per assistant-turn tool-call group.

**Architecture:** Adapters own transport-specific buffering: `settle(id, result)` records the local tool result and appends a buffered ToolMessage without issuing a run; `resolve(id, result)` delegates to `settle` and flushes all buffered ToolMessages in one continuation run. Chat owns orchestration: function/view/ask tools report settled results to a group tracker, and the tracker flushes once every non-terminal call in the current pending group has settled. `followUp:false` tools settle without forcing a continuation; a fully-terminal group issues no run.

**Tech Stack:** Angular signals/effects, Vitest, Nx, existing `@threadplane/chat`, `@threadplane/ag-ui`, and `@threadplane/langgraph` packages. No new dependencies.

---

## File Structure

- Modify: `libs/chat/src/lib/client-tools/client-tools-capability.ts`
  - Add optional `settle(toolCallId, result)` to the capability interface.
- Modify: `libs/chat/src/lib/client-tools/tool-def.ts`
  - Extend client-tool authoring options with `followUp?: boolean`.
  - Carry `followUp` on function, view, and ask definitions.
- Modify: `libs/chat/src/lib/client-tools/tools.ts`
  - Accept `followUp` options for `action`, `view`, and `ask`.
- Modify: `libs/chat/src/lib/client-tools/client-tool-executor.ts`
  - Add a settlement callback option so function-tool execution no longer directly chooses `resolve` for every call.
- Modify: `libs/chat/src/lib/client-tools/client-tools-coordinator.ts`
  - Add assistant-turn group tracking over `cap.pending()`.
  - Use `cap.settle` for intermediate/terminal results and `cap.resolve` for the group flush.
  - Warn and fall back to `resolve` when `followUp:false` is requested but a capability lacks `settle`.
- Modify: `libs/ag-ui/src/lib/client-tools.ts`
  - Implement `settle` and ToolMessage buffering; make `resolve` flush the buffer in one `runAgent`.
- Modify: `libs/langgraph/src/lib/client-tools.ts`
  - Implement `settle` and ToolMessage buffering; make `resolve` flush the buffer in one `submitFn`.
- Modify: `libs/chat/src/lib/client-tools/index.ts`
  - Export new public types/options if added.
- Modify: `libs/chat/src/public-api.ts`
  - Export new public types/options and capability shape changes.
- Regenerate: `apps/website/content/docs/chat/api/api-docs.json`
  - Required because public API changes.

---

### Task 1: Adapter `settle()` Contract and Buffering

**Files:**
- Test: `libs/ag-ui/src/lib/client-tools.spec.ts`
- Test: `libs/langgraph/src/lib/client-tools.spec.ts`
- Modify: `libs/chat/src/lib/client-tools/client-tools-capability.ts`
- Modify: `libs/ag-ui/src/lib/client-tools.ts`
- Modify: `libs/langgraph/src/lib/client-tools.ts`

- [x] **Step 1: Write failing adapter tests**

Add tests in both adapter specs:

```ts
it('settle records a local result without issuing a run', async () => {
  const sourceOrSubmit = makeSourceOrSubmit();
  const store = makeStore({ isLoading: false });
  const cap = createClientToolsCapability(sourceOrSubmit, store);
  cap.setCatalog([WEATHER_SPEC]);
  store.toolCallsSig.set([{ id: 'c1', name: 'get_weather', args: {}, status: 'complete' }]);

  cap.settle?.('c1', { ok: true, value: { temp: 70 } });
  await Promise.resolve();

  expect(cap.pending()).toHaveLength(0);
  expect(runSpy).not.toHaveBeenCalled();
});
```

Update the existing "resolving multiple pending calls issues one submit/run per resolve" characterization in both adapters to the new M4 behavior:

```ts
cap.settle?.('c1', { ok: true, value: { temp: 70 } });
cap.resolve('c2', { ok: true, value: { temp: 71 } });
await Promise.resolve();

expect(runSpy).toHaveBeenCalledOnce();
expect(flushedToolCallIds).toEqual(['c1', 'c2']);
```

- [x] **Step 2: Run adapter tests to verify RED**

Run:

```bash
npx vitest run src/lib/client-tools.spec.ts --config vite.config.mts
```

from `libs/ag-ui`, then from `libs/langgraph`.

Expected: FAIL because `settle` is missing and `resolve` still flushes one run per call.

- [x] **Step 3: Implement adapter buffering**

In both adapters:

- Add `settle` to `ClientToolsCapability`.
- Extract the local result write and ToolMessage construction from `resolve` into shared helpers.
- Keep a `toolMessageBuffer` array in the capability closure.
- `settle(id, result)`:
  - mark `resolvedIds`;
  - write the local result/error patch;
  - push the transport-specific ToolMessage into `toolMessageBuffer`;
  - issue no run.
- `resolve(id, result)`:
  - call `settle(id, result)`;
  - flush all buffered ToolMessages in one run;
  - clear the buffer after building the run payload.

- [x] **Step 4: Run adapter tests to verify GREEN**

Run:

```bash
npx vitest run src/lib/client-tools.spec.ts --config vite.config.mts
```

from `libs/ag-ui`, then from `libs/langgraph`.

Expected: PASS.

---

### Task 2: Authoring Options for `followUp`

**Files:**
- Test: `libs/chat/src/lib/client-tools/tools.spec.ts` or nearest existing authoring spec if present
- Modify: `libs/chat/src/lib/client-tools/tool-def.ts`
- Modify: `libs/chat/src/lib/client-tools/tools.ts`

- [x] **Step 1: Write failing authoring tests**

Add tests covering:

```ts
expect(action('x', z.object({}), async () => undefined, { followUp: false }).followUp).toBe(false);
expect(view('x', z.object({}), FakeComponent, { followUp: false }).followUp).toBe(false);
expect(ask('x', z.object({}), FakeComponent, { followUp: false }).followUp).toBe(false);
```

- [x] **Step 2: Run tests to verify RED**

Run:

```bash
npx vitest run src/lib/client-tools/tools.spec.ts --config vite.config.mts
```

Expected: FAIL because `view` and `ask` do not accept options and definitions do not carry `followUp`.

- [x] **Step 3: Implement minimal authoring API**

- Add `readonly followUp?: boolean` to function/view/ask definition types.
- Extend `ClientToolExecutionOptions` or introduce a shared `ClientToolContinuationOptions` so all tools can carry `followUp`.
- Keep `action`'s existing `idempotent` option intact.
- Add optional final `options` parameter to `view` and `ask`.

- [x] **Step 4: Run tests to verify GREEN**

Run:

```bash
npx vitest run src/lib/client-tools/tools.spec.ts --config vite.config.mts
```

Expected: PASS.

---

### Task 3: Coordinator Group Tracking and Flush Policy

**Files:**
- Test: `libs/chat/src/lib/client-tools/client-tool-executor.spec.ts`
- Test: `libs/chat/src/lib/client-tools/client-tools-coordinator.spec.ts`
- Test: `libs/chat/src/lib/compositions/chat/chat.component.client-tools.spec.ts`
- Modify: `libs/chat/src/lib/client-tools/client-tool-executor.ts`
- Modify: `libs/chat/src/lib/client-tools/client-tools-coordinator.ts`

- [x] **Step 1: Write failing coordinator/executor tests**

Add tests that prove:

- Two pending function tools in one `pending()` group call `settle` for the first result and `resolve` for the last result.
- A mixed group with `followUp:false` plus a default follow-up tool settles the terminal result and flushes both results in one final `resolve`.
- A fully-terminal group (`followUp:false` on every tool) calls only `settle` and never `resolve`.
- View auto-ack and ask render-result handling participate in the same group tracker.
- If `followUp:false` is requested and `cap.settle` is absent, the coordinator falls back to `resolve` and does not drop the result.
- Existing guard behavior still claims and records before group settlement.

- [x] **Step 2: Run chat tests to verify RED**

Run:

```bash
npx vitest run src/lib/client-tools/client-tool-executor.spec.ts src/lib/client-tools/client-tools-coordinator.spec.ts src/lib/compositions/chat/chat.component.client-tools.spec.ts --config vite.config.mts
```

Expected: FAIL because the executor and coordinator still call `resolve` per result.

- [x] **Step 3: Implement group tracker**

- Add an internal settlement callback option to `startClientToolExecutor`.
- Keep default executor behavior backward-compatible when no callback is supplied.
- In `createClientToolsCoordinator`, maintain the current pending group as a set of pending IDs from the same `cap.pending()` emission.
- Track settled IDs/results by tool call ID.
- For each completed result:
  - if every unsettled remaining call in the group is terminal, call `settle` for terminal calls and do not run;
  - if this is not the last follow-up call, call `settle`;
  - when the last follow-up call settles, call `resolve` for that call so the adapter flushes the buffered group once.
- Treat `followUp !== false` as default follow-up.
- Preserve ask lookup by `elementKey` and view auto-ack idempotence.

- [x] **Step 4: Run chat tests to verify GREEN**

Run:

```bash
npx vitest run src/lib/client-tools/client-tool-executor.spec.ts src/lib/client-tools/client-tools-coordinator.spec.ts src/lib/compositions/chat/chat.component.client-tools.spec.ts --config vite.config.mts
```

Expected: PASS.

---

### Task 4: Public API Docs and Verification

**Files:**
- Modify: `libs/chat/src/lib/client-tools/index.ts`
- Modify: `libs/chat/src/public-api.ts`
- Regenerate: `apps/website/content/docs/chat/api/api-docs.json`

- [x] **Step 1: Export public API changes**

Export any new option types and the updated capability contract through the package's existing public surfaces. Do not export the internal coordinator factory publicly.

- [x] **Step 2: Regenerate API docs**

Run:

```bash
npm run generate-api-docs
```

Expected: succeeds and updates chat API docs.

- [x] **Step 3: Run focused and package verification**

Run:

```bash
npx nx test chat
npx nx test ag-ui
npx nx test langgraph
npx nx lint chat
npx nx lint ag-ui
npx nx lint langgraph
npx nx build chat
npx nx build ag-ui
npx nx build langgraph
npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,licensing,telemetry --configuration=production
node scripts/check-dx-coverage.mjs
git diff --check
```

Expected: all commands exit 0. Lint warnings are acceptable only if there are zero lint errors.

- [x] **Step 4: Scan for forbidden external names outside approved docs**

Run:

```bash
(git diff --name-only; git ls-files --others --exclude-standard) | rg -v '^docs/superpowers/' | xargs rg -n 'hashbrown|copilotkit|chatgpt|claude' || true
```

Expected: no output.

- [x] **Step 5: Review diff and commit**

Run:

```bash
git status --short
git diff --stat
git diff -- libs/chat/src/lib/client-tools libs/ag-ui/src/lib/client-tools.ts libs/langgraph/src/lib/client-tools.ts
git add docs/superpowers/plans/2026-07-08-client-tools-m4-settle-batching-plan.md libs/chat/src libs/ag-ui/src/lib/client-tools.ts libs/ag-ui/src/lib/client-tools.spec.ts libs/langgraph/src/lib/client-tools.ts libs/langgraph/src/lib/client-tools.spec.ts apps/website/content/docs/chat/api/api-docs.json
git commit -m "feat: batch client tool continuations"
```

Expected: commit succeeds with no external framework references in the commit message.

---

## Acceptance Checklist

- [ ] `ClientToolsCapability.settle?` exists and is optional.
- [ ] AG-UI `settle` records a local result and buffers a ToolMessage without a run.
- [ ] LangGraph `settle` records a local result and buffers a ToolMessage without a run.
- [ ] AG-UI `resolve` flushes all buffered ToolMessages in one run.
- [ ] LangGraph `resolve` flushes all buffered ToolMessages in one submit.
- [ ] Coordinator batches one assistant-turn pending group into one continuation run.
- [ ] `followUp:false` terminal tools do not force a continuation run.
- [ ] Fully-terminal groups issue no run.
- [ ] Missing `settle` capability falls back without dropping results.
- [ ] Guarded function tools still claim/record before settling or resolving.
- [ ] No new dependencies.
- [ ] API docs regenerated for public API changes.
- [ ] Verification commands above pass before PR creation.
