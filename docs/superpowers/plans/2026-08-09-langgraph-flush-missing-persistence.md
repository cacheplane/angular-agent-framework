# LangGraph Flush Missing-Persistence Error Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LangGraph `flush()` reject when staged client-tool results cannot be persisted, while preserving empty-buffer no-op behavior and the next-submit fallback.

**Architecture:** Keep the behavior inside `createClientToolsCapability`, the only unit that sees both the staged buffer and optional persistence function. Add capability and agent-seam regression coverage before changing production code, then update the user-facing transport warning. Preserve every existing batching, failure-restaging, concurrency, and thread-switch path.

**Tech Stack:** TypeScript, Angular signals, Vitest, Nx, MDX.

**Design:** `docs/superpowers/specs/2026-08-09-langgraph-flush-missing-persistence-design.md`

---

## File Map

- Modify `libs/langgraph/src/lib/client-tools.spec.ts`: define the internal capability contract for empty and non-empty flushes without persistence.
- Modify `libs/langgraph/src/lib/agent.fn.spec.ts`: verify the public LangGraph agent seam rejects and still drains on the next ordinary submit.
- Modify `libs/langgraph/src/lib/client-tools.ts`: implement the missing-persistence rejection without taking ownership of the buffer.
- Modify `libs/langgraph/src/lib/agent.fn.ts`: keep the transport-wiring comment aligned with the observable rejection and retained fallback.
- Modify `apps/website/content/docs/chat/guides/client-tools.mdx`: document the observable rejection and retained fallback.

No API or narrative-doc generator is required: no public type/JSDoc surface changes, and the edited guide is source MDX rather than generated content. `generate-agent-context` is also unnecessary because it reads `CLAUDE.md.template` and `AGENTS.md.template`, neither of which changes.

### Task 1: Reproduce the false-success contract at both LangGraph seams

**Files:**
- Modify: `libs/langgraph/src/lib/client-tools.spec.ts:433-457`
- Modify: `libs/langgraph/src/lib/agent.fn.spec.ts:1377-1396`

- [ ] **Step 1: Add the empty-buffer capability test**

Extend the existing empty-buffer case so it covers an omitted persistence function as well as a configured one:

```ts
it('resolves without persistence when the buffer is empty', async () => {
  const { cap } = setup(undefined);

  await expect(cap.flush?.()).resolves.toBeUndefined();
});
```

Keep the existing configured-persistence empty-buffer test because it separately proves that no server call is made.

- [ ] **Step 2: Replace the silent-success capability test with the rejected contract**

Replace `keeps the buffer when no persist function is supplied` with:

```ts
it('rejects and keeps the buffer when staged results have no persistence function', async () => {
  const { cap } = setup(undefined);
  cap.settle?.('t1', { ok: true, value: 'a' });
  cap.settle?.('t2', { ok: true, value: 'b' });

  await expect(cap.flush?.()).rejects.toThrow(
    'Custom LangGraph transports using terminal client tools must implement updateState().',
  );
  expect(cap.drainToolMessages()).toEqual([
    { type: 'tool', role: 'tool', tool_call_id: 't1', content: 'a' },
    { type: 'tool', role: 'tool', tool_call_id: 't2', content: 'b' },
  ]);
});
```

- [ ] **Step 3: Make the agent-wiring fallback test expect rejection before recovery**

In `submit drains staged tool messages ahead of the payload messages`, change the flush assertion to:

```ts
cap.settle('tc-1', { ok: true, value: 'sunny' });
await expect(cap.flush()).rejects.toThrow(
  'Custom LangGraph transports using terminal client tools must implement updateState().',
);
ref.submit({ message: 'and tomorrow?' });
```

Keep the payload-order and exact-once assertions. They prove the rejection does not destroy the fallback buffer.

- [ ] **Step 4: Run the focused tests and verify RED**

Run:

```bash
npx nx test langgraph --skip-nx-cache -- -t "flush|submit drains staged"
```

Expected: FAIL because both staged-result cases resolve instead of rejecting. The new empty-buffer case must pass, proving the failure is specific to buffered data.

### Task 2: Implement the minimal capability-level rejection

**Files:**
- Modify: `libs/langgraph/src/lib/client-tools.ts:266-299`
- Modify: `libs/langgraph/src/lib/agent.fn.ts:436-442`

- [ ] **Step 1: Move the missing-persistence decision behind the empty-buffer check**

Change the start of `runFlush()` to inspect the buffer before deciding whether persistence is required:

```ts
function runFlush(): Promise<void> {
  if (toolMessageBuffer.length === 0) return Promise.resolve();
  if (!persistFn) {
    return Promise.reject(
      new Error(
        'Cannot flush staged client tool results. ' +
          'Custom LangGraph transports using terminal client tools must implement updateState().',
      ),
    );
  }

  const staged = takeStagedForCurrentThread();
  if (staged.length === 0) return Promise.resolve();
```

Remove the early `if (!persistFn) return Promise.resolve();` from `flush()` so every non-concurrent call reaches `runFlush()`:

```ts
flush(): Promise<void> {
  if (flushInFlight) {
    // existing chaining logic unchanged
  }
  return runFlush();
},
```

The rejection occurs before `takeStagedForCurrentThread()`, so the buffer is unchanged and remains available to the next-submit fallback.

- [ ] **Step 2: Update the factory contract comment**

Replace the claim that an absent `persistFn` merely degrades silently. State that a non-empty flush rejects and retains the buffer for an explicit recovery through a later submit.

- [ ] **Step 3: Update the agent transport-wiring comment**

Keep `agent.fn.ts` aligned with the capability contract:

```ts
// When persistFn is undefined, a non-empty flush() rejects and keeps the
// buffer staged; the submit wrapper below can still drain it into the next run.
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
npx nx test langgraph --skip-nx-cache -- -t "flush|submit drains staged"
```

Expected: PASS. Confirm the missing-persistence cases reject, the empty-buffer case resolves, and existing flush concurrency/failure tests remain green.

### Task 3: Document the runtime contract

**Files:**
- Modify: `apps/website/content/docs/chat/guides/client-tools.mdx:128-130`

- [ ] **Step 1: Update the custom-transport warning**

Revise the warning to say:

```mdx
<Callout type="warning" title="Your transport must support durable writes">
  A terminal group has no follow-up run to carry its results, so the adapter writes them to the server directly. On `@threadplane/langgraph` that uses the transport's `updateState`. If a **custom transport does not implement `updateState`**, `flush()` rejects when terminal results are staged. The results stay buffered and an ordinary next message can still carry them, but a reload first loses them and leaves the server thread with an unanswered tool call. If you supply your own transport and use terminal tools, implement `updateState`.
</Callout>
```

- [ ] **Step 2: Verify the guide compiles**

Run:

```bash
npx nx build website --skip-nx-cache
```

Expected: PASS with the updated MDX compiled into the site.

### Task 4: Full scoped verification and one logical commit

**Files:**
- Review all modified files from Tasks 1-3.

- [ ] **Step 1: Run LangGraph tests**

Run:

```bash
npx nx test langgraph --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 2: Run LangGraph lint**

Run:

```bash
npx nx lint langgraph --skip-nx-cache
```

Expected: PASS with zero errors.

- [ ] **Step 3: Build the LangGraph package**

Run:

```bash
npx nx build langgraph --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 4: Review repository state and diff**

Run:

```bash
git status --short
git diff --check
git diff --stat
git diff
```

Expected: only the two LangGraph test files, `client-tools.ts`, the aligned comment in `agent.fn.ts`, the client-tools guide, and this plan are changed after the already-committed design spec; no whitespace errors or generated dependency changes.

- [ ] **Step 5: Commit the completed implementation once**

The repository contributor guide forbids mid-task commits, so group the finished code, tests, docs, and plan in one logical commit:

```bash
git add \
  libs/langgraph/src/lib/client-tools.ts \
  libs/langgraph/src/lib/client-tools.spec.ts \
  libs/langgraph/src/lib/agent.fn.ts \
  libs/langgraph/src/lib/agent.fn.spec.ts \
  apps/website/content/docs/chat/guides/client-tools.mdx \
  docs/superpowers/plans/2026-08-09-langgraph-flush-missing-persistence.md
git commit -m "fix(langgraph): reject non-durable client tool flushes"
```
