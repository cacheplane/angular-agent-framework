# LangGraph Identity-Based Delta Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the messages-tuple merge from silently dropping streamed delta chunks (proven: bare `|` tokens in tables) by merging according to declared event kind instead of string-prefix heuristics.

**Architecture:** `mergeMessages`/`accumulateContent` in `stream-manager.bridge.ts` gain a `mode` parameter. Tuple events (`event.messageMetadata`) merge as **deltas**: unconditional append, no prefix guards, plus a `canonicalMessageIds` backstop (ids whose final text is known are immune to late deltas). `messages/partial` and values-sync keep today's **snapshot** semantics unchanged (mutual-prefix reconcile — correct for snapshot-shaped payloads, including lagging mid-run values events). One file changes; TDD through the existing bridge spec harness; a live Chrome MCP gate verifies wire==accumulation before the PR.

**Tech Stack:** TypeScript, Vitest (`MockAgentTransport` harness), Angular workspace lib `libs/langgraph`; Chrome MCP for the live gate.

**Spec:** [docs/superpowers/specs/2026-07-06-langgraph-delta-merge-identity-design.md](../specs/2026-07-06-langgraph-delta-merge-identity-design.md)

**Branch:** create `fix/langgraph-delta-merge-identity` off main. NOTE: `libs/langgraph/src/lib/transport/fetch-stream.transport.ts` currently carries an uncommitted TEMP DEBUG recorder block (added during diagnosis) — keep it in the working tree until Task 4's live gate passes, then revert it in Task 4 before the PR. Do not commit it.

---

## File Structure

- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.ts` — mode threading, delta path, canonical-id set.
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts` — new `describe` block, 6 tests.
- Revert (Task 4): `libs/langgraph/src/lib/transport/fetch-stream.transport.ts` — remove the TEMP DEBUG recorder.

## Current-code anchors (verify before editing; line numbers approximate)

- `processEvent` messages branch, tuple/partial merge call (~503): `if (event.type === 'messages/partial' || event.messageMetadata) { subjects.messages$.next(mergeMessages(subjects.messages$.value, normalized, reasoningTimingMap)); … }`
- values-sync merge call (~572): `subjects.messages$.next(mergeMessages(subjects.messages$.value, remapped, reasoningTimingMap));`
- `runStream` per-run reset block (~388-397): `subjects.custom$.next([]); subjects.toolProgress$.next([]); toolProgressMap.clear();`
- `mergeMessages` (~1032): signature `(existing, incoming, reasoningTimingMap?)`; merge body computes `accumulatedContent = accumulateContent(existing.content, incomingRaw['content'])`.
- `accumulateContent` (~1169): the two `startsWith` guards + `isFinalCanonicalReasoningContent` + append.
- Thread switch: `switchThread` clears per-thread state (find `function switchThread` / the `threadId$` subscription that resets state).

---

### Task 1: Failing tests — delta merge preserves every chunk

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts` (append a new describe block)

- [ ] **Step 1: Create the branch**

```bash
cd ~/repos/angular-agent-framework
git stash push -m tmp-recorder libs/langgraph/src/lib/transport/fetch-stream.transport.ts
git checkout main && git pull --ff-only
git checkout -b fix/langgraph-delta-merge-identity
git stash pop
```
(The stash carries the uncommitted TEMP DEBUG recorder onto the new branch's working tree without committing it.)

- [ ] **Step 2: Write the failing tests**

Append to `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts` (reuse the file's existing `makeSubjects()` and `MockAgentTransport` imports; tuple events are emitted post-normalization as `{ type: 'messages', data: [chunk, metadata], messageMetadata: metadata }` — mirror how existing tests in this file construct events, and confirm the exact tuple shape by reading a passing `messageMetadata` test in the file before writing):

```ts
describe('identity-based delta merge (messages-tuple)', () => {
  const META = { langgraph_node: 'chatbot' };

  function setup() {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    return { transport, subjects, destroy$, bridge };
  }

  function tupleEvent(id: string, content: unknown) {
    return {
      type: 'messages',
      data: [{ id, type: 'ai', content }, META],
      messageMetadata: META,
    } as any;
  }

  function lastAiContent(subjects: ReturnType<typeof makeSubjects>): string {
    const msgs = subjects.messages$.value as Array<{ content?: unknown }>;
    const last = msgs[msgs.length - 1];
    return typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content);
  }

  it('preserves every delta chunk, including ones that prefix the message (table pipes)', async () => {
    const { transport, subjects, destroy$, bridge } = setup();
    bridge.submit({});
    const deltas = ['|', ' Gem', ' |', ' Color', ' |', '\n', '|', '---', '|', '---', '|', '\n', '|', ' Ruby', ' |', ' red', ' |'];
    for (const d of deltas) transport.emit([tupleEvent('ai-1', d)]);
    transport.close();
    await new Promise(r => setTimeout(r, 10));
    expect(lastAiContent(subjects)).toBe(deltas.join(''));
    destroy$.next();
  });

  it('appends a multi-char delta that begins with the accumulated text', async () => {
    const { transport, subjects, destroy$, bridge } = setup();
    bridge.submit({});
    transport.emit([tupleEvent('ai-1', '|')]);
    transport.emit([tupleEvent('ai-1', '| Gem')]); // delta, NOT a superset echo
    transport.close();
    await new Promise(r => setTimeout(r, 10));
    expect(lastAiContent(subjects)).toBe('|| Gem');
    destroy$.next();
  });

  it('final canonical reasoning+text array replaces the accumulation and blocks late deltas', async () => {
    const { transport, subjects, destroy$, bridge } = setup();
    bridge.submit({});
    transport.emit([tupleEvent('ai-1', '| a |')]);
    transport.emit([tupleEvent('ai-1', ' | b |')]);
    // authoritative final shape: reasoning + text blocks in one array
    transport.emit([tupleEvent('ai-1', [
      { type: 'reasoning', text: 'thought' },
      { type: 'text', text: '| a | | b | done' },
    ])]);
    // straggler token after the canonical content landed — must be ignored
    transport.emit([tupleEvent('ai-1', '|')]);
    transport.close();
    await new Promise(r => setTimeout(r, 10));
    expect(lastAiContent(subjects)).toBe('| a | | b | done');
    destroy$.next();
  });

  it('a new run resets canonical marking (same-id deltas accumulate again)', async () => {
    const { transport, subjects, destroy$, bridge } = setup();
    bridge.submit({});
    transport.emit([tupleEvent('ai-1', [
      { type: 'reasoning', text: 'r' },
      { type: 'text', text: 'final one' },
    ])]);
    transport.close();
    await new Promise(r => setTimeout(r, 10));
    // second run: same transport mock, fresh runStream
    bridge.submit({});
    transport.emit([tupleEvent('ai-2', 'fresh')]);
    transport.emit([tupleEvent('ai-2', ' text')]);
    transport.close();
    await new Promise(r => setTimeout(r, 10));
    expect(lastAiContent(subjects)).toBe('fresh text');
    destroy$.next();
  });

  it('messages/partial snapshots still reconcile by prefix (regression)', async () => {
    const { transport, subjects, destroy$, bridge } = setup();
    bridge.submit({});
    const partial = (content: string) => ({
      type: 'messages/partial',
      data: [{ id: 'ai-1', type: 'ai', content }],
    } as any);
    transport.emit([partial('| Gem')]);
    transport.emit([partial('| Gem | Color |')]); // superset → replace
    transport.emit([partial('| Gem')]);            // stale shorter snapshot → keep longer
    transport.close();
    await new Promise(r => setTimeout(r, 10));
    expect(lastAiContent(subjects)).toBe('| Gem | Color |');
    destroy$.next();
  });

  it('values-sync mid-run keeps snapshot semantics (lagging state does not rewind)', async () => {
    const { transport, subjects, destroy$, bridge } = setup();
    bridge.submit({});
    transport.emit([tupleEvent('ai-1', '| a | b |')]);
    transport.emit([tupleEvent('ai-1', ' | c |')]);
    // lagging values event: state.messages carries a shorter version of ai-1
    transport.emit([{
      type: 'values',
      data: { messages: [
        { id: 'h-1', type: 'human', content: 'hi' },
        { id: 'ai-1', type: 'ai', content: '| a | b |' },
      ] },
    } as any]);
    transport.close();
    await new Promise(r => setTimeout(r, 10));
    expect(lastAiContent(subjects)).toBe('| a | b | | c |');
    destroy$.next();
  });
});
```

- [ ] **Step 3: Run to verify the right ones fail**

Run: `npx vitest run --config libs/langgraph/vite.config.mts stream-manager.bridge 2>&1 | tail -20` (or `npx nx test langgraph -- stream-manager.bridge` — check `libs/langgraph/project.json` for the test target config first).
Expected: tests 1 and 2 FAIL on current code (bare `|` deltas dropped → `'| Gem | Color |\n|---…'` missing pipes; `'| Gem'` replaces instead of appending → `'| Gem'` not `'|| Gem'`). Test 3's straggler assertion may pass accidentally today (the old guard drops it) — fine. Tests 5 and 6 must PASS today (regression baselines). If test 6 fails on current code, STOP and report — the values-sync baseline assumption is wrong and the plan needs revision, not force-fitting.

- [ ] **Step 4: Commit the red tests**

```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts
git commit -m "test(langgraph): red tests — delta merge must preserve prefix-coinciding chunks"
```

---

### Task 2: Implement mode-aware merge + canonical-id backstop

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`

- [ ] **Step 1: Add the mode type + canonical set**

Near the top of `createStreamManagerBridge` (beside the other per-run state like `toolProgressMap` — find `const toolProgressMap` and declare alongside):

```ts
  // Message ids whose content is known-final (installed by a canonical
  // replacement). Late streamed deltas for these ids are stale stragglers and
  // are ignored — decided by identity, never by comparing text to text.
  const canonicalMessageIds = new Set<string>();
```

In `runStream`, in the per-run reset block (immediately after `toolProgressMap.clear();`):

```ts
    canonicalMessageIds.clear();
```

Also clear it wherever thread switching resets per-thread state (the same place other maps are cleared in `switchThread`/the thread-change path — read that function and mirror it).

- [ ] **Step 2: Thread the mode through the two call sites**

Define the type near `mergeMessages`:

```ts
type MergeMode = 'delta' | 'snapshot';
```

At the tuple/partial call site (~503), split by event kind:

```ts
      if (event.type === 'messages/partial' || event.messageMetadata) {
        const mode: MergeMode = event.messageMetadata ? 'delta' : 'snapshot';
        subjects.messages$.next(mergeMessages(subjects.messages$.value, normalized, reasoningTimingMap, mode, canonicalMessageIds));
```

At the values-sync call site (~572), keep snapshot semantics explicitly:

```ts
            subjects.messages$.next(mergeMessages(subjects.messages$.value, remapped, reasoningTimingMap, 'snapshot', canonicalMessageIds));
```

- [ ] **Step 3: Extend `mergeMessages`**

Change the signature:

```ts
function mergeMessages(
  existing: BaseMessage[],
  incoming: BaseMessage[],
  reasoningTimingMap?: Map<string, { startedAt: number; endedAt?: number }>,
  mode: MergeMode = 'snapshot',
  canonicalMessageIds?: Set<string>,
): BaseMessage[] {
```

Inside the `if (idx >= 0)` merge branch, BEFORE computing `accumulatedContent`, add the identity backstop:

```ts
      const targetId = (existingId ?? incomingRaw['id']) as string | undefined;
      // Identity backstop: once a message's content is known-final, late
      // streamed deltas for it are stale stragglers — ignore them outright.
      if (mode === 'delta' && targetId && canonicalMessageIds?.has(targetId)
          && !isFinalCanonicalReasoningContent(incomingRaw['content'])) {
        continue;
      }
```

Pass the mode into the content merge:

```ts
      const accumulatedContent = accumulateContent(
        existing.content as unknown,
        incomingRaw['content'],
        mode,
      );
```

And after computing it, mark canonical when the final shape just landed:

```ts
      if (targetId && isFinalCanonicalReasoningContent(incomingRaw['content'])) {
        canonicalMessageIds?.add(targetId);
      }
```

(NOTE: `existingId` is already declared in this branch — reuse it; do not redeclare. Adjust placement so `targetId` is defined once before both uses.)

- [ ] **Step 4: Make `accumulateContent` mode-aware**

```ts
function accumulateContent(existing: unknown, incoming: unknown, mode: MergeMode = 'snapshot'): string {
  const existingText = extractText(existing);
  const incomingText = extractText(incoming);

  if (existingText.length === 0) return incomingText;
  if (incomingText.length === 0) return existingText;
  // Final-canonical detection applies in both modes: the authoritative
  // "reasoning + text" array replaces whatever was accumulated.
  if (isFinalCanonicalReasoningContent(incoming)) return incomingText;
  if (mode === 'delta') {
    // Tuple chunks are declared deltas. Append unconditionally — any
    // text-comparison "dedupe" here can silently drop legitimate tokens
    // that coincide with the message prefix (e.g. every bare "|" in a
    // markdown table). Staleness is handled by identity in mergeMessages.
    return existingText + incomingText;
  }
  // Snapshot mode (messages/partial, values-sync): payloads carry the
  // message-so-far, so mutual prefix comparison picks the longer state and
  // ignores stale shorter snapshots.
  if (incomingText.startsWith(existingText)) return incomingText;
  if (existingText.startsWith(incomingText)) return existingText;
  return existingText + incomingText;
}
```

(Keep the existing doc comment above the function, updating it to describe the two modes. Note the `isFinalCanonicalReasoningContent` check moved BEFORE the prefix guards — verify no existing test depended on the old ordering; the suite run in Step 5 confirms.)

- [ ] **Step 5: Run the new suite + full lib**

Run: `npx nx test langgraph --skip-nx-cache 2>&1 | tail -6`
Expected: all 6 new tests pass; zero regressions in the existing bridge/agent suites. If an existing test fails, read it before touching anything — it encodes a behavior decision; reconcile deliberately (most likely candidates: tests exercising the old guard's replacement ordering).

- [ ] **Step 6: Lint + chat suite (consumer)**

Run: `npx nx lint langgraph && npx nx test chat --skip-nx-cache 2>&1 | tail -4`
Expected: lint 0 errors; chat suite green.

- [ ] **Step 7: Commit**

```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.ts
git commit -m "fix(langgraph): merge streamed chunks by declared event kind, not text prefixes

Tuple events are deltas: append unconditionally. The old prefix-based dedupe
guard dropped any delta that coincidentally prefixed the accumulated message —
every bare pipe token in a streamed markdown table — silently corrupting
content mid-stream (wire had 48 pipes, accumulation 35; replaying captured
events through the guard reproduced the corruption byte-identically).
Snapshot payloads (messages/partial, values-sync) keep prefix reconciliation.
Stale post-final stragglers are now suppressed by canonical message id, not
by comparing text to text.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Cross-suite gates

- [ ] **Step 1: Full affected suites**

Run: `npx nx run-many -t test -p langgraph chat ag-ui --skip-nx-cache 2>&1 | tail -8`
Expected: all green (ag-ui included as a sibling consumer of @threadplane/chat contracts).

- [ ] **Step 2: Builds**

Run: `npx nx run-many -t build -p langgraph chat 2>&1 | tail -4`
Expected: both build clean.

---

### Task 4: Live Chrome MCP verification gate (controller-run, REQUIRED)

Performed by the controller session (needs Chrome MCP + OPENAI key). The TEMP DEBUG recorder in `fetch-stream.transport.ts` is still in the working tree — it powers this gate.

- [ ] **Step 1: Serve the fix** — kill stale servers on :4200/:2024, then start backend and frontend as separate detached daemons (double-fork pattern): `(cd examples/chat/python && nohup uv run langgraph dev --port 2024 --no-browser > /tmp/lg-backend.log 2>&1 &)` and `(nohup npx nx run examples-chat-angular:serve --port 4200 > /tmp/ng-frontend.log 2>&1 &)`. Clear `.angular/cache/*/examples-chat-angular/vite` first so the dep cache can't serve stale lib code; wait for `Application bundle generation complete` AND port 200s.

- [ ] **Step 2: Run ≥6 live table prompts** via Chrome MCP at `http://localhost:4200/embed` with the 3-layer capture: `window.__lgEvents` (SDK recorder), content progression via `ng.getComponent(<chat-streaming-md>).content()` on MutationObserver, DOM table/paragraph counts.

- [ ] **Step 3: Assert per run** — `sdkPipes === accumPipes` (wire == accumulation), no non-prefix content divergence at stream end, zero frames where the table collapses to raw-pipe paragraphs (excluding the pre-first-closed-cell frame). If ANY run fails: STOP, capture the progression, return to root-cause — do not proceed to the PR.

- [ ] **Step 4: Revert the temp recorder**

```bash
git checkout -- libs/langgraph/src/lib/transport/fetch-stream.transport.ts
git status --porcelain   # expect: clean except committed work
```

- [ ] **Step 5: Shut down the servers** — kill by PID from `lsof -ti :4200 :2024`; verify both ports free (kill children repeatedly if the process tree respawns).

---

### Task 5: PR + merge on green

- [ ] **Step 1: Push + PR**

```bash
git push -u origin fix/langgraph-delta-merge-identity
gh pr create --title "fix(langgraph): stop streamed chunks being dropped by prefix-based dedupe" --fill
```
Body: root cause (prefix guard vs. delta semantics), the byte-identical replay proof, the identity-based design, unit + live-gate evidence (numbers from Task 4). End with the standard Claude Code attribution. No external project references.

- [ ] **Step 2: Merge on green**

```bash
gh pr checks <PR#> --watch    # required: Vercel – threadplane; also confirm Library + chat e2e advisory
gh pr merge <PR#> --squash --delete-branch
```
Admin fallback (`--admin`) only for the known stale-cache/behind quirk with green head checks.

- [ ] **Step 3: Verify main** — `git checkout main && git pull --ff-only && gh run list --branch main --limit 3` (ignore the pre-existing non-required PostHog red).

---

## Out of scope (do not implement)

- `subagent-tracker.ts`'s `mergeMessages` (append/id-based already).
- Stream resumability, SDK retry tuning, server changes.
- Any partial-markdown or chat rendering changes.
