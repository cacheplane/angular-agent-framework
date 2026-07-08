# Client Tools M0 Test Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic client-tool continuation test infrastructure and characterization coverage for today's Threadplane behavior without changing production runtime code.

**Architecture:** Extend the existing AG-UI `FakeAgent` test double into a deterministic scriptable stream while keeping its default canned-token behavior unchanged. Characterization tests stay at the adapter capability and chat coordinator boundaries so later PRs can refactor or change behavior with red tests that prove the current contract.

**Tech Stack:** Angular signals, Vitest, RxJS, Nx (`npx nx test ag-ui`, `npx nx test langgraph`, `npx nx test chat`), existing Threadplane testing helpers.

---

## Scope Guard

PR 1 is M0 only. Allowed changes are `*.spec.ts` files and testing scaffolding under existing `testing/` surfaces. Do not edit runtime client-tool code such as `libs/chat/src/lib/client-tools/client-tools-coordinator.ts`, `libs/chat/src/lib/client-tools/client-tool-executor.ts`, `libs/chat/src/lib/client-tools/execute.ts`, `libs/ag-ui/src/lib/client-tools.ts`, or `libs/langgraph/src/lib/client-tools.ts`.

Characterize current behavior, including the known multi-tool behavior: multiple pending function tools currently issue one continuation run per `resolve()`.

## File Structure

- Modify: `libs/ag-ui/src/lib/testing/fake-agent.ts`
  - Add test-only script types and scripted event emission to the existing fake.
  - Preserve the no-script constructor path byte-for-byte in observable behavior: token stream, reasoning stream, cadence, cancellation, and public `FakeAgent` export remain compatible.
  - Add deterministic message ids for scripted events; avoid clocks and randomness when a script is supplied.
- Modify: `libs/ag-ui/src/lib/testing/fake-agent.spec.ts`
  - Add red/green tests for scripted `TOOL_CALL_START` / `TOOL_CALL_ARGS` / `TOOL_CALL_END`, `RUN_ERROR`, `STATE_SNAPSHOT`, `CUSTOM` `on_interrupt`, continuation branching on appended `role: 'tool'` history, and cancellation.
- Modify: `libs/ag-ui/src/lib/client-tools.spec.ts`
  - Add missing characterization cases for current adapter behavior: multiple pending -> N runs, resolving one leaves others pending, pending excludes server-resolved calls, and existing error/run behavior remains covered.
- Modify: `libs/langgraph/src/lib/client-tools.spec.ts`
  - Mirror the AG-UI characterization cases for LangGraph: multiple pending -> N submits, resolving one leaves others pending, pending excludes server-resolved calls, and existing error/run behavior remains covered.
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.client-tools.spec.ts`
  - Keep the existing hand-built capability tests as focused unit coverage.
  - Add one integration path using the scriptable fake-derived capability and the real coordinator to drive action, view auto-ack, and ask render-result resolution.

## Task 1: Scriptable AG-UI FakeAgent

**Files:**
- Modify: `libs/ag-ui/src/lib/testing/fake-agent.ts`
- Test: `libs/ag-ui/src/lib/testing/fake-agent.spec.ts`

- [x] **Step 1: Write failing tests for scripted tool-call emission**

Add tests that construct:

```ts
const agent = new FakeAgent({
  delayMs: 0,
  script: [{
    when: 'initial',
    events: [
      { type: 'TOOL_CALL_START', toolCallId: 'tool-1', toolCallName: 'get_weather', parentMessageId: 'assistant-1' },
      { type: 'TOOL_CALL_ARGS', toolCallId: 'tool-1', delta: '{"city":"SF"}' },
      { type: 'TOOL_CALL_END', toolCallId: 'tool-1' },
    ],
  }],
});
```

Assert the collected event types include `RUN_STARTED`, the three tool-call events, and `RUN_FINISHED` in order, with the input `threadId` and `runId` copied into run lifecycle events.

- [x] **Step 2: Run the red test**

Run: `npx nx test ag-ui --runInBand --testFile=libs/ag-ui/src/lib/testing/fake-agent.spec.ts`

Expected: fail because `script` is not supported by `FakeAgent`.

- [x] **Step 3: Implement the minimal script runner**

Extend `FakeAgent` constructor options with an optional `script` array. Add internal helpers that choose the matching script branch, wrap it with `RUN_STARTED` / `RUN_FINISHED`, and emit with the existing cancellable `setTimeout` cadence. Keep no-script behavior unchanged.

- [x] **Step 4: Run the green test**

Run: `npx nx test ag-ui --runInBand --testFile=libs/ag-ui/src/lib/testing/fake-agent.spec.ts`

Expected: pass.

- [x] **Step 5: Add red tests for continuation branching and non-tool events**

Add tests for:

```ts
const agent = new FakeAgent({
  delayMs: 0,
  script: [
    { when: 'initial', events: [{ type: 'TOOL_CALL_START', toolCallId: 'tool-1', toolCallName: 'get_weather' }, { type: 'TOOL_CALL_END', toolCallId: 'tool-1' }] },
    { when: { toolMessageFor: 'tool-1' }, events: [{ type: 'TEXT_MESSAGE_CONTENT', delta: 'continued' }] },
  ],
});
```

Also cover `RUN_ERROR`, `STATE_SNAPSHOT`, and `CUSTOM` with `name: 'on_interrupt'`.

- [x] **Step 6: Implement only the missing fake-agent script shapes**

Add conversion for the script event shapes to AG-UI `BaseEvent` objects. Do not add new production exports or new dependencies.

- [x] **Step 7: Re-run fake-agent tests**

Run: `npx nx test ag-ui --runInBand --testFile=libs/ag-ui/src/lib/testing/fake-agent.spec.ts`

Expected: pass.

## Task 2: Adapter Characterization Tests

**Files:**
- Modify: `libs/ag-ui/src/lib/client-tools.spec.ts`
- Modify: `libs/langgraph/src/lib/client-tools.spec.ts`

- [x] **Step 1: Add AG-UI red tests for current multiple-resolve behavior**

Use `createClientToolsCapability()` with two catalog-matching pending tool calls. Resolve both calls separately and assert `source.runAgent` is called twice. This intentionally locks current behavior, not planned batching.

- [x] **Step 2: Run the AG-UI red/characterization check**

Run: `npx nx test ag-ui --runInBand --testFile=libs/ag-ui/src/lib/client-tools.spec.ts`

Expected: if the current behavior is already present, the test may pass immediately; if it fails, inspect whether the assertion is incorrect before changing test-only code. Do not change runtime code.

- [x] **Step 3: Add missing AG-UI characterization tests**

Add or refine tests for resolving one call leaving the other pending, `pending()` returning empty while loading, and server-resolved calls being excluded by `result !== undefined`.

- [x] **Step 4: Mirror tests in LangGraph**

Use `createClientToolsCapability()` with `makeStore()` and `makeSubmitFn()`. Resolve two pending calls and assert two `submitFn` calls. Assert one resolved call leaves the other pending and server-resolved calls are excluded.

- [x] **Step 5: Run adapter tests**

Run:

```bash
npx nx test ag-ui --runInBand --testFile=libs/ag-ui/src/lib/client-tools.spec.ts
npx nx test langgraph --runInBand --testFile=libs/langgraph/src/lib/client-tools.spec.ts
```

Expected: pass.

## Task 3: Chat Component Coordinator Integration

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.client-tools.spec.ts`

- [x] **Step 1: Write a failing integration test using a fake-agent-backed capability**

Build a local test harness in the spec that exposes `pending`, `setCatalog`, and `resolve`, and drives pending calls from a script-like sequence. Connect it to `ChatComponent` with the real `clientToolRegistry`.

The test should:

1. Install registry with an `action`, a `view`, and an `ask`.
2. Emit a pending action tool and assert the coordinator resolves it with the handler result.
3. Emit a pending view tool and assert the coordinator auto-acks with `{ shown: true }`.
4. Emit a pending ask tool, call `onClientToolEvent({ type: 'result', elementKey: askName, value })`, and assert the coordinator resolves the ask.

- [x] **Step 2: Run the chat red/characterization check**

Run: `npx nx test chat --runInBand --testFile=libs/chat/src/lib/compositions/chat/chat.component.client-tools.spec.ts`

Expected: fail until the harness is wired correctly; no production changes are allowed.

- [x] **Step 3: Implement only the spec harness needed for the integration**

Add local spec helpers only. Do not move helpers to public API unless explicitly approved.

- [x] **Step 4: Run the chat integration test**

Run: `npx nx test chat --runInBand --testFile=libs/chat/src/lib/compositions/chat/chat.component.client-tools.spec.ts`

Expected: pass.

## Task 4: Full Verification and Diff Audit

**Files:**
- No new files beyond this plan unless a test-only helper is required.

- [x] **Step 1: Run project-scoped test targets**

Run:

```bash
npx nx test ag-ui
npx nx test langgraph
npx nx test chat
```

Expected: all pass.

- [x] **Step 2: Run relevant lint checks and count errors**

Run:

```bash
npx nx lint ag-ui 2>&1 | tee /tmp/threadplane-ag-ui-lint.log; grep -cE ' error ' /tmp/threadplane-ag-ui-lint.log
npx nx lint langgraph 2>&1 | tee /tmp/threadplane-langgraph-lint.log; grep -cE ' error ' /tmp/threadplane-langgraph-lint.log
npx nx lint chat 2>&1 | tee /tmp/threadplane-chat-lint.log; grep -cE ' error ' /tmp/threadplane-chat-lint.log
```

Expected: each grep count is `0`.

- [x] **Step 3: Audit diff scope**

Run:

```bash
git diff --name-only
git diff --stat
```

Expected: changed files are limited to `*.spec.ts`, testing scaffolding, and this plan markdown. No runtime client-tool implementation files are changed.

- [x] **Step 4: Stop for human review**

Report changed files, verification output, and any commands that could not run. Do not start M1.
