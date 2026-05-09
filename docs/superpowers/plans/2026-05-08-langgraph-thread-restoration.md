# `@ngaf/langgraph` Thread Restoration on Reconnect — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `agent({ threadId })` is created with a non-null thread id, restore the conversation: project the latest checkpoint's `values.messages` into `messages$` and the rest of `values` into `values$`. Reload-mid-conversation in the canonical demo will then reattach to the existing thread and the prior exchange will reappear.

**Architecture:** Single-function extension to `refreshHistory()` inside the bridge — after the existing `subjects.history$.next(history)` line, project the most recent checkpoint into `subjects.messages$` and `subjects.values$`. Guarded by `subjects.messages$.value.length === 0` so an optimistic local submit that beats history fetch is preserved.

**Tech Stack:** TypeScript (`libs/langgraph` + vitest), `@langchain/langgraph-sdk` ThreadState types.

**Spec:** `docs/superpowers/specs/2026-05-08-langgraph-thread-restoration-design.md`

**Branch:** `claude/langgraph-thread-restoration`, branched from `origin/main`.

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, commits, or PR titles/bodies.

---

## File Structure

```
libs/langgraph/src/lib/internals/
├── stream-manager.bridge.ts          # +12 LOC inside refreshHistory()
└── stream-manager.bridge.spec.ts     # +2 unit tests (~80 LOC including helpers)
```

Total ≈ 92 LOC. ~3 commits.

`MockAgentTransport` already has a public mutable `history: ThreadState[] = []` field (line 20 of `mock-stream.transport.ts`) and an implemented `getHistory()` method that returns it. We can either extend the mock with an optional `getHistoryDelayMs` field for the race test, or use the established inline-mock pattern (custom transport with a delayed `getHistory`) — the plan uses the inline-mock to keep the existing `MockAgentTransport` untouched.

---

## Phase 0 — Branch creation

### Task 0.1: Create implementation branch

- [ ] **Step 1: Branch from origin/main**

```bash
cd /Users/blove/repos/angular-agent-framework
git fetch origin main
git checkout -b claude/langgraph-thread-restoration origin/main
git rev-parse --abbrev-ref HEAD   # must echo claude/langgraph-thread-restoration
git log --oneline -1              # must be on origin/main HEAD
```

---

## Phase 1 — TDD: failing restore test

### Task 1.1: Add the failing test

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`

The spec file already imports `MockAgentTransport`, `makeSubjects()`, `makeThreadState()`, `BehaviorSubject`/`Subject`/`of` from rxjs, and `createStreamManagerBridge`. Locate the `describe('createStreamManagerBridge', () => {...})` block (around line 61) and the existing `it('loads history when initialized with a thread id', ...)` test inside it.

- [ ] **Step 1: Add a new test directly after the existing history test**

Insert this new `it` block immediately AFTER the existing `it('loads history when initialized with a thread id', ...)` test:

```ts
  it('populates messages$ and values$ from the latest checkpoint on initial connect', async () => {
    const transport = new MockAgentTransport();
    transport.history = [
      {
        values: {
          messages: [
            { type: 'human', id: 'u-1', content: 'previous question', _getType: () => 'human' },
            { type: 'ai',    id: 'a-1', content: 'previous answer',   _getType: () => 'ai' },
          ],
          model: 'gpt-5-mini',
          reasoning_effort: 'medium',
        },
        next: [],
        checkpoint: {
          thread_id: 'persisted-thread-1',
          checkpoint_ns: '',
          checkpoint_id: 'cp-1',
          checkpoint_map: null,
        },
        metadata: null,
        created_at: '2026-05-08T12:00:00.000Z',
        parent_checkpoint: null,
        tasks: [],
      } as never,
    ];

    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();

    createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'chat', transport },
      subjects,
      threadId$: of('persisted-thread-1'),
      destroy$: destroy$.asObservable(),
    });

    // Wait one microtask for the refreshHistory promise chain to resolve.
    await new Promise(r => setTimeout(r, 10));

    expect(subjects.messages$.value.length).toBe(2);
    expect((subjects.messages$.value[0] as { content: unknown }).content).toBe('previous question');
    expect((subjects.messages$.value[1] as { content: unknown }).content).toBe('previous answer');

    // values$ contains the rest of the thread state — but NOT a duplicate
    // `messages` field, since messages$ is the canonical surface.
    const values = subjects.values$.value as Record<string, unknown>;
    expect(values['model']).toBe('gpt-5-mini');
    expect(values['reasoning_effort']).toBe('medium');
    expect(values).not.toHaveProperty('messages');

    destroy$.next();
  });
```

- [ ] **Step 2: Run test to verify it FAILS**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run langgraph:test --skip-nx-cache 2>&1 | tail -15
```

Expected: 1 test fails — `populates messages$ and values$ from the latest checkpoint on initial connect`. The pre-existing `loads history when initialized with a thread id` still passes because it asserts only on `history$`. Pre-existing 53 tests still pass.

The failure should be `expected 0 to be 2` for `subjects.messages$.value.length`.

Do NOT commit yet — Phase 2 commits the test + implementation together.

---

## Phase 2 — Implement the `refreshHistory` extension

### Task 2.1: Project latest checkpoint into messages$ + values$

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`

Locate `refreshHistory()` (around line 143). The current relevant block:

```ts
    try {
      const history = await getHistory(threadId, controller.signal);
      if (!controller.signal.aborted && currentThreadId === threadId) {
        subjects.history$.next(history as ThreadState<T>[]);
      }
    } catch (err) {
```

- [ ] **Step 1: Add the projection inside the success branch**

Replace the inner `if` block with:

```ts
    try {
      const history = await getHistory(threadId, controller.signal);
      if (!controller.signal.aborted && currentThreadId === threadId) {
        subjects.history$.next(history as ThreadState<T>[]);

        // Project the latest checkpoint into messages$ + values$ on first
        // connect. The user expectation (per the canonical examples/chat
        // demo spec) is that reloading mid-conversation reattaches to the
        // existing thread and the history reappears in the chat UI. The
        // chat composition reads messages$ (not history$), so this
        // projection is the bridge between "we fetched the checkpoint"
        // and "the user can see the conversation".
        //
        // Guard: only populate when messages$ is currently empty, so we
        // don't overwrite optimistic local state if the user already
        // submitted a message in the gap between threadId-set and
        // history-fetched.
        const latest = history[0] as
          | { values?: { messages?: BaseMessage[] } & T }
          | undefined;
        if (latest?.values && subjects.messages$.value.length === 0) {
          const restoredMessages = latest.values.messages ?? [];
          const restoredValues = { ...(latest.values as T) };
          // Strip the `messages` field from values — messages$ is the
          // canonical surface for them; keeping a duplicate in values$
          // would confuse downstream consumers reading both subjects.
          delete (restoredValues as { messages?: unknown }).messages;
          subjects.messages$.next(restoredMessages);
          subjects.values$.next(restoredValues);
        }
      }
    } catch (err) {
```

- [ ] **Step 2: Run the test — must now PASS**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run langgraph:test --skip-nx-cache 2>&1 | tail -10
```

Expected: all langgraph tests pass — the previously-failing restore test now passes (54 total). Pre-existing tests still green.

- [ ] **Step 3: Lint**

```bash
npx nx run langgraph:lint --skip-nx-cache 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 4: Commit fix + restore test together**

```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.ts \
        libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts
git commit -m "fix(langgraph): restore messages$ and values$ from latest checkpoint on reconnect"
```

---

## Phase 3 — Race-guard test

### Task 3.1: Pin the optimistic-submit-beats-history-fetch behavior

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`

This test pins the guard added in Phase 2: if `messages$` already has content when history resolves, the projection is silently skipped. Uses an inline mock transport with a delayed `getHistory()` so the test can observe a state mutation between `threadId$` emission and history resolution.

- [ ] **Step 1: Add the test directly after the restore test from Phase 1**

```ts
  it('does not clobber local optimistic messages if a submit beats the history fetch', async () => {
    const historyFetched: ThreadState<Record<string, unknown>>[] = [
      {
        values: {
          messages: [
            { type: 'human', id: 'old-u', content: 'old prompt', _getType: () => 'human' },
          ],
        },
        next: [],
        checkpoint: {
          thread_id: 'persisted-thread-2',
          checkpoint_ns: '',
          checkpoint_id: 'cp-old',
          checkpoint_map: null,
        },
        metadata: null,
        created_at: '2026-05-08T12:00:00.000Z',
        parent_checkpoint: null,
        tasks: [],
      } as never,
    ];

    // Inline mock transport with a delayed getHistory so we can observe
    // a state mutation between threadId-set and history resolution.
    const transport: AgentTransport & {
      getHistory: (
        threadId: string,
        signal: AbortSignal,
      ) => Promise<ThreadState<Record<string, unknown>>[]>;
    } = {
      async *stream() {
        yield* [];
      },
      async getHistory(_threadId, _signal) {
        await new Promise(r => setTimeout(r, 50));
        return historyFetched;
      },
    };

    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();

    createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'chat', transport },
      subjects,
      threadId$: of('persisted-thread-2'),
      destroy$: destroy$.asObservable(),
    });

    // Synchronously simulate an optimistic local submit BEFORE history
    // resolves: the user clicks Send during the 50ms history fetch.
    subjects.messages$.next([
      { type: 'human', id: 'fresh', content: 'fresh prompt', _getType: () => 'human' },
    ] as never);

    // Wait past the history fetch delay.
    await new Promise(r => setTimeout(r, 80));

    // Local optimistic message preserved; history projection skipped.
    expect(subjects.messages$.value.length).toBe(1);
    expect((subjects.messages$.value[0] as { content: unknown }).content).toBe('fresh prompt');

    destroy$.next();
  });
```

- [ ] **Step 2: Run the test — must PASS**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run langgraph:test --skip-nx-cache 2>&1 | tail -5
```

Expected: all langgraph tests pass (55 total — 53 existing + restore + race-guard). The race-guard test passes immediately because the implementation from Phase 2 already has the `messages$.value.length === 0` guard.

If the test fails, the guard is broken — review Task 2.1 Step 1 and confirm the `if (latest?.values && subjects.messages$.value.length === 0)` guard exists exactly as written.

- [ ] **Step 3: Lint**

```bash
npx nx run langgraph:lint --skip-nx-cache 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts
git commit -m "test(langgraph): pin race-guard for optimistic submit during history fetch"
```

---

## Phase 4 — Verification + PR

### Task 4.1: Full local sweep

- [ ] **Step 1: Lint**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run langgraph:lint --skip-nx-cache 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 2: Test**

```bash
npx nx run langgraph:test --skip-nx-cache 2>&1 | tail -10
```

Expected: 55 tests pass (53 existing + 2 new).

- [ ] **Step 3: Confirm commit count**

```bash
git rev-list --count origin/main..HEAD
```

Expected: 2 commits.

### Task 4.2: Push + open PR

- [ ] **Step 1: Push**

```bash
git push -u origin claude/langgraph-thread-restoration 2>&1 | tail -3
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "fix(langgraph): restore conversation on reconnect to existing thread" --body "$(cat <<'EOF'
## Summary

Targets Finding D from the live smoke pass: after a page reload, the conversation is NOT restored even though the threadId is persisted in localStorage and passed to \`agent({ threadId })\`.

## Root cause

\`stream-manager.bridge.ts\` \`refreshHistory()\` populates \`history$\` from the transport's checkpoint history but does not project the latest checkpoint's \`values.messages\` into \`messages$\`. The chat composition reads \`messages$\` (not \`history$\`), so the user sees the welcome state instead of their prior conversation.

## Fix

After the existing \`subjects.history$.next(history)\` line, project the most recent checkpoint into \`messages$\` and \`values$\`. Guarded by \`messages$.value.length === 0\` so an optimistic local submit that beats the history fetch is preserved.

\`\`\`ts
const latest = history[0];
if (latest?.values && subjects.messages$.value.length === 0) {
  const restoredMessages = latest.values.messages ?? [];
  const restoredValues = { ...latest.values };
  delete restoredValues.messages;
  subjects.messages$.next(restoredMessages);
  subjects.values$.next(restoredValues);
}
\`\`\`

The \`messages\` field is stripped from \`values$\` so consumers reading both subjects don't see duplicates — \`messages$\` is the canonical surface.

## Test plan

### Verified locally
- [x] \`nx run langgraph:lint\` — 0 errors
- [x] \`nx run langgraph:test\` — 55 tests pass (53 existing + 2 new)
- [x] New test 1: populates messages$ and values$ from latest checkpoint on initial connect
- [x] New test 2: does not clobber local optimistic messages if a submit beats the history fetch

### Pending visual verification
- [ ] After merge: live smoke against the workspace examples/chat demo. Send a message → reload → conversation reappears with prior user/assistant exchange visible. No flash of welcome state.

Spec: \`docs/superpowers/specs/2026-05-08-langgraph-thread-restoration-design.md\`
Plan: \`docs/superpowers/plans/2026-05-08-langgraph-thread-restoration.md\`
EOF
)"
```

- [ ] **Step 3: Note the PR URL.**

- [ ] **Step 4: Wait for CI; address failures.**

- [ ] **Step 5: Merge once green.**

---

## Definition of done

1. PR merged.
2. CI green: `nx run langgraph:lint` and `nx run langgraph:test` (55 tests).
3. Live smoke (manual, post-merge): reload mid-conversation in the workspace `examples/chat` demo → conversation reappears with the prior user/assistant exchange.
4. The 2 new bridge unit tests pin both the restore path and the race-guard.
