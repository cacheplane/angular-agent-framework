# Streaming Markdown Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make partial-Markdown events and visible roots share one canonical projected graph, and make Angular finalize Markdown synchronously from authoritative per-message lifecycle metadata instead of a 600 ms silence timer.

**Architecture:** Cacheplane will reconcile committed and projected AST nodes into one stable public mirror and derive all events from that mirror. Angular adapters will attach required delivery metadata to every neutral message; chat will convert message content and delivery atomically into a `StreamingMarkdownDocument`, whose generation and phase drive one parser session without timers or global-loading inference.

**Tech Stack:** TypeScript, Vitest, fast-check, Angular signals, Nx, LangGraph SDK, AG-UI events, Playwright, aimock, npm OIDC trusted publishing, Chrome MCP.

---

## Repository Workspaces

- Angular implementation worktree: `/Users/blove/repos/angular-agent-framework/.worktrees/streaming-markdown-lifecycle`
- Cacheplane implementation worktree: `/Users/blove/.config/superpowers/worktrees/cacheplane/partial-markdown-canonical-events`
- Angular branch: `blove/streaming-markdown-lifecycle`
- Cacheplane branch: `blove/partial-markdown-canonical-events`

## File Structure

### Cacheplane

- Modify `packages/partial-markdown/src/parser.ts`: replace the synthetic pending-text path and disposable open-line projection with stable projected-mirror reconciliation.
- Modify `packages/partial-markdown/src/types.ts`: clarify public event lifecycle guarantees if comments/types require it.
- Modify `packages/partial-markdown/src/parser.test.ts`: pin event reachability, ordering, and projection-to-commit identity.
- Modify `packages/partial-markdown/src/__tests__/streaming-invariants.test.ts`: add block-type and event/root partition invariants.
- Modify `packages/partial-markdown/src/materialize.test.ts`: pin structural sharing across projected updates if reconciliation changes cache behavior.
- Modify `packages/partial-markdown/README.md`: document canonical root/event semantics.
- Modify `packages/partial-markdown/package.json`: set release candidate/final version `0.5.8`.
- Modify `packages/partial-markdown/CHANGELOG.md`: describe canonical projected events and removed synthetic IDs.

### Angular Agent Framework

- Modify `libs/chat/src/lib/agent/message.ts`: add discriminated `MessageDelivery` and require it on neutral messages.
- Create `libs/chat/src/lib/agent/message-delivery.ts`: central constructors and transition helpers for static, streaming, and terminal delivery states.
- Modify `libs/chat/src/lib/agent/index.ts` and `libs/chat/src/public-api.ts`: export the new public types and renderer document type.
- Modify `libs/chat/src/lib/streaming/streaming-markdown.component.ts`: accept one atomic document input and implement the explicit generation/phase state machine.
- Modify `libs/chat/src/lib/streaming/streaming-markdown.*.spec.ts`: migrate fixtures and test lifecycle ordering, identity, invalid transitions, and removed timers.
- Modify `libs/chat/src/lib/compositions/chat/chat.component.ts`: derive renderer documents only from message delivery metadata.
- Modify `libs/chat/src/lib/primitives/chat-reasoning/chat-reasoning.component.ts`: pass an atomic reasoning document with an independent generation suffix.
- Modify `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts`: pass each subagent message's delivery metadata.
- Modify `libs/langgraph/src/lib/agent.fn.ts`: assign and finalize attempt generations in the runtime-neutral projection.
- Modify `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`: expose deterministic run/attempt terminal state and mark restored messages complete.
- Modify `libs/langgraph/src/lib/internals/subagent-tracker.ts`: assign subagent delivery state.
- Modify `libs/ag-ui/src/lib/reducer.ts`: attach and transition message delivery metadata from run/message events and snapshots.
- Modify `libs/ag-ui/src/lib/to-agent.ts`: allocate generations at run start and finalize success/error/abort outcomes, including subagents.
- Modify `libs/chat/src/lib/testing/mock-agent.ts`, `libs/langgraph/src/lib/testing/mock-langgraph-agent.ts`, and `libs/ag-ui/src/lib/testing/fake-agent.ts`: produce valid lifecycle metadata in test utilities.
- Modify affected adapter and chat specs discovered by `rg "Message\s*[=>:]|role: ['\"](user|assistant|system|tool)" libs examples`: add explicit delivery metadata rather than compatibility defaults.
- Modify `examples/chat/angular/e2e/markdown-surfaces.spec.ts`: sample transient blockquote/table DOM and add thematic-break coverage.
- Modify `examples/chat/angular/e2e/fixtures/streaming-markdown.json`: provide deterministic slow fixtures for those assertions.
- Modify root `package.json`, `libs/chat/package.json`, and `package-lock.json`: consume the packed candidate, then registry `0.5.8`.

## Task 1: Create the Cacheplane Worktree and Confirm Baseline

- [ ] **Step 1: Create the isolated upstream branch**

Run from `/Users/blove/repos/cacheplane`:

```bash
mkdir -p /Users/blove/.config/superpowers/worktrees/cacheplane
git worktree add /Users/blove/.config/superpowers/worktrees/cacheplane/partial-markdown-canonical-events -b blove/partial-markdown-canonical-events origin/main
```

Expected: worktree at `origin/main`, branch tracks no unrelated changes.

- [ ] **Step 2: Install and verify the baseline**

```bash
pnpm install --frozen-lockfile
pnpm --filter @cacheplane/partial-markdown test
pnpm --filter @cacheplane/partial-markdown typecheck
```

Expected: 381 existing parser tests pass and typecheck exits 0.

## Task 2: Pin Canonical Event/Root Invariants Upstream

**Files:**
- Modify: `packages/partial-markdown/src/parser.test.ts`
- Modify: `packages/partial-markdown/src/__tests__/streaming-invariants.test.ts`

- [ ] **Step 1: Write the failing structural event test**

Add a table-driven test that pushes open prefixes for paragraph, ATX heading, thematic breaks (`---`, `***`, `___`), indented code, fenced code, blockquote, nested list, table, display math, and HTML. Walk `parser.root` to collect reachable IDs and assert:

```ts
for (const event of events) {
  const isRemovedCompletion = event.type === 'node-completed'
    && !reachableNodes(parser.root).has(event.node);
  if (!isRemovedCompletion) {
    expect(reachableIds(parser.root)).toContain(event.node.id);
  }
  expect(event.node.id).toBeGreaterThanOrEqual(0);
}
```

For an unreachable completion, assert the exact node object was reachable from the root immediately before the operation and was removed by that operation. For a retained streaming-to-complete transition, assert the exact node object remains reachable and receives exactly one completion event. Also assert thematic-break pushes never emit a text event containing the delimiter.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
pnpm --filter @cacheplane/partial-markdown exec vitest run src/parser.test.ts src/__tests__/streaming-invariants.test.ts
```

Expected: FAIL because thematic breaks emit synthetic `id: -1` text nodes and projected nodes are not event-reconciled.

- [ ] **Step 3: Add failing identity and ordering assertions**

Pin these behaviors:

```ts
const projected = parser.root!.children[0];
const commitEvents = parser.push('\n');
expect(parser.root!.children[0]).toBe(projected);
expect(commitEvents.filter(e => e.type === 'node-created')).toEqual([]);
expect(projected.status).toBe('complete');
```

For replacement, assert old descendants complete post-order before new nodes are created pre-order. For representative chunk partitions, replay events into an ID-indexed model and compare it with normalized `parser.root`.

Assert the complete per-operation order explicitly: removed descendants complete post-order; replacement nodes are created pre-order; scalar updates and status transitions follow in pre-order. Model lifecycle by node incarnation, where an incarnation is the public object identity plus `(id, type, parent ID, sibling index)`. Reject duplicate creation, updates while non-live, or duplicate completion for the same incarnation. Permit a reused numeric ID only for an explicit grammar-reinterpretation replacement within the same reconciliation operation: the old incarnation must be removed and completed before the replacement is created at a different type or position. Track that replacement as a distinct incarnation; reject numeric-ID reuse in every other circumstance.

Add a fast-check property using the existing adversarial Markdown corpus plus generated text. For every input, compare a one-chunk push with character-by-character pushes. Normalized roots must have identical IDs, types, values, statuses, and hierarchy. Normalized lifecycle summaries must have one creation and at most one completion per incarnation, updates only while that incarnation is live, and exactly one completion whenever a retained node transitions from streaming to complete. `delta` segmentation and event batch boundaries are intentionally ignored.

- [ ] **Step 4: Re-run and confirm the new assertions fail for the intended reasons**

Expected: projection identity changes between pushes and event replay cannot reconstruct the projected root.

## Task 3: Implement the Canonical Projected Mirror

**Files:**
- Modify: `packages/partial-markdown/src/parser.ts`
- Modify: `packages/partial-markdown/src/types.ts`
- Modify: `packages/partial-markdown/src/materialize.test.ts`

- [ ] **Step 1: Remove the synthetic pending-text implementation**

Delete `PENDING_TEXT_ID`, `pendingTextNode`, `pendingTextLen`, `syncPendingText`, `retirePendingText`, `shouldEmitSyntheticPendingText`, `isInsideBlockquote`, and `isProjectedStructuralOpenLine`.

- [ ] **Step 2: Add projected reconciliation state**

Maintain a public-node map for the currently visible projected AST and reconcile using `(id, kind, parentId, siblingIndex)`. Implement focused helpers in `parser.ts`:

```ts
type VisibleKey = `${number}:${AstNodeKind}:${number | 'root'}:${number}`;

function reconcileVisibleRoot(
  previous: MarkdownDocumentNode | null,
  preview: InternalState,
): { root: MarkdownDocumentNode | null; events: ParseEvent[] };
```

Reuse matched objects, mutate scalar/status fields, rebuild child arrays with reused objects, complete removed subtrees post-order, and create replacements pre-order. Preserve the committed root object across open-line projections.

- [ ] **Step 3: Route `push`, `finish`, `root`, and `getByPath` through the reconciled root**

Each mutation builds one preview state, reconciles once, stores the resulting root, and returns those events. `root` becomes a stable read with no lazy disposable projection.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
pnpm --filter @cacheplane/partial-markdown exec vitest run src/parser.test.ts src/__tests__/streaming-invariants.test.ts src/materialize.test.ts
```

Expected: all focused tests pass; no public event has a negative ID.

- [ ] **Step 5: Run full upstream verification**

```bash
pnpm --filter @cacheplane/partial-markdown test
pnpm --filter @cacheplane/partial-markdown typecheck
pnpm --filter @cacheplane/partial-markdown build
pnpm --filter @cacheplane/partial-markdown publint
pnpm --filter @cacheplane/partial-markdown attw
```

- [ ] **Step 6: Commit the parser architecture**

```bash
git add packages/partial-markdown/src
git commit -m "fix: unify projected markdown events"
```

## Task 4: Document and Pack the 0.5.8 Candidate

**Files:**
- Modify: `packages/partial-markdown/package.json`
- Modify: `packages/partial-markdown/CHANGELOG.md`
- Modify: `packages/partial-markdown/README.md`

- [ ] **Step 1: Set version and document behavior**

Set `version` to `0.5.8`. Add changelog and README text stating that `root` and events share one projected graph, projection-to-commit preserves identity, and negative synthetic IDs are removed.

- [ ] **Step 2: Verify packaging**

```bash
pnpm --filter @cacheplane/partial-markdown build
pnpm --filter @cacheplane/partial-markdown publint
pnpm --filter @cacheplane/partial-markdown attw
npm pack --workspace packages/partial-markdown --pack-destination /tmp
```

Expected: `/tmp/cacheplane-partial-markdown-0.5.8.tgz` exists and contains `dist`, README, LICENSE, and package metadata.

- [ ] **Step 3: Commit release preparation without tagging**

```bash
git add packages/partial-markdown/package.json packages/partial-markdown/CHANGELOG.md packages/partial-markdown/README.md
git commit -m "chore(release): prepare partial-markdown 0.5.8"
```

## Task 4A: Establish Browser-Level RED Before Angular Implementation

**Files:**
- Modify: `examples/chat/angular/e2e/markdown-surfaces.spec.ts`
- Modify: `examples/chat/angular/e2e/fixtures/streaming-markdown.json`

- [ ] **Step 1: Add transient boundary tests before changing Angular production code**

For blockquote followed by table, collect samples throughout the stream and assert every table-visible sample has exactly one table, no rows/cells outside it, no raw pipe paragraphs, and the table is a sibling after the blockquote. Add a long inter-chunk-pause fixture whose header arrives before its delimiter row, with latency greater than the existing 600 ms heuristic. Add a streamed thematic-break fixture and assert delimiter text never coexists with the projected `<hr>`.

- [ ] **Step 2: Run the focused tests and verify RED against the current implementation**

```bash
AIMOCK_FIXTURE=fixtures/streaming-markdown.json npx nx e2e examples-chat-angular --grep "long pause|blockquote followed by table|thematic break"
```

Expected: at least the long-pause lifecycle test fails because elapsed silence can finalize an open table before the authoritative stream ends. Confirm the failure is an observed raw-pipe/detached-table state, not fixture or server startup failure.

- [ ] **Step 3: Commit only the failing browser regression test and fixture**

```bash
git add examples/chat/angular/e2e/markdown-surfaces.spec.ts examples/chat/angular/e2e/fixtures/streaming-markdown.json
git commit -m "test(chat): reproduce timer-driven markdown finalization"
```

Do not make this commit the PR head until Tasks 8-10 turn it green.

## Task 5: Add the Required Neutral Message Delivery Contract

**Files:**
- Create: `libs/chat/src/lib/agent/message-delivery.ts`
- Modify: `libs/chat/src/lib/agent/message.ts`
- Modify: `libs/chat/src/lib/agent/index.ts`
- Modify: `libs/chat/src/public-api.ts`
- Test: `libs/chat/src/lib/agent/message.spec.ts`

- [ ] **Step 1: Write failing type/runtime tests**

Test the discriminated union and constructors:

```ts
expect(streamingDelivery('attempt-1')).toEqual({ generation: 'attempt-1', phase: 'streaming' });
expect(completeDelivery('attempt-1', 'aborted')).toEqual({
  generation: 'attempt-1', phase: 'complete', outcome: 'aborted',
});
expect(staticDelivery('m1')).toEqual({
  generation: 'm1', phase: 'complete', outcome: 'success',
});
```

Add `expectTypeOf` coverage proving `outcome` is required for complete and unavailable for streaming.

- [ ] **Step 2: Run RED**

```bash
npx nx test chat --testFile=libs/chat/src/lib/agent/message.spec.ts
```

Expected: FAIL because delivery types/helpers do not exist.

- [ ] **Step 3: Implement and export the delivery contract**

Implement the exact discriminated type from the approved spec and pure constructors. Add required `delivery: MessageDelivery` to `Message`.

- [ ] **Step 4: Run the focused test and typecheck**

```bash
npx nx test chat --testFile=libs/chat/src/lib/agent/message.spec.ts
npx nx type-tests chat
```

Expected: focused behavior passes; typecheck reports every remaining message producer that must migrate.

- [ ] **Step 5: Commit the contract**

```bash
git add libs/chat/src/lib/agent libs/chat/src/public-api.ts
git commit -m "feat(chat): add authoritative message delivery state"
```

## Task 6: Populate Delivery State in LangGraph

**Files:**
- Modify: `libs/langgraph/src/lib/agent.fn.ts`
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`
- Modify: `libs/langgraph/src/lib/internals/subagent-tracker.ts`
- Modify: `libs/langgraph/src/lib/agent.fn.spec.ts`
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`
- Modify: `libs/langgraph/src/lib/testing/mock-langgraph-agent.ts`

- [ ] **Step 1: Write failing lifecycle projection tests**

Cover restored/static messages, first chunk, normal completion, explicit error, transport interruption after a chunk, abort, pause, resume, retry, regeneration, tool-loop step completion, and subagent completion. Assert every new attempt gets a distinct generation and every terminal message has a mandatory outcome.

- [ ] **Step 2: Run RED**

```bash
npx nx test langgraph --testFile=libs/langgraph/src/lib/agent.fn.spec.ts
npx nx test langgraph --testFile=libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts
```

- [ ] **Step 3: Implement attempt ownership at the stream manager boundary**

Allocate an opaque attempt generation when `submit`, `retry`, `regenerate`, or resume starts. Track whether any chunk was seen. Expose per-message delivery metadata alongside reasoning timing. Mark prior tool-loop steps complete before projecting the next assistant step. Restored checkpoint messages are complete/success.

- [ ] **Step 4: Project delivery in `messagesNeutral` and subagents**

Extend `toMessage`/`toSubagent` projection so every neutral message receives the manager-owned delivery state. Never derive it from `isLoading` plus tail position.

- [ ] **Step 5: Verify LangGraph**

```bash
npx nx test langgraph
npx nx build langgraph
```

- [ ] **Step 6: Commit**

```bash
git add libs/langgraph
git commit -m "feat(langgraph): project message delivery lifecycle"
```

## Task 7: Populate Delivery State in AG-UI and Test Utilities

**Files:**
- Modify: `libs/ag-ui/src/lib/reducer.ts`
- Modify: `libs/ag-ui/src/lib/to-agent.ts`
- Modify: `libs/ag-ui/src/lib/reducer.spec.ts`
- Modify: `libs/ag-ui/src/lib/to-agent.spec.ts`
- Modify: `libs/ag-ui/src/lib/to-agent.conformance.spec.ts`
- Modify: `libs/ag-ui/src/lib/testing/fake-agent.ts`
- Modify: `libs/chat/src/lib/testing/mock-agent.ts`
- Modify: affected `Message` fixtures under `libs/chat`, `libs/ag-ui`, `libs/langgraph`, and `examples`

- [ ] **Step 1: Write failing AG-UI outcome tests**

Pin RUN_STARTED generation allocation, text chunks as streaming, RUN_FINISHED success, RUN_ERROR error, user abort aborted, snapshot restoration complete/success, and AG-UI subagent delivery.

- [ ] **Step 2: Run RED**

```bash
npx nx test ag-ui --testFile=libs/ag-ui/src/lib/reducer.spec.ts
npx nx test ag-ui --testFile=libs/ag-ui/src/lib/to-agent.spec.ts
```

- [ ] **Step 3: Implement reducer and adapter lifecycle transitions**

Keep generation allocation in `to-agent.ts`, pass the active generation into reducer state, and finalize all messages belonging to the active run on terminal callbacks. Deduplicate duplicate RUN_ERROR/onRunFailed delivery without changing the terminal outcome.

- [ ] **Step 4: Migrate static and test message producers**

Use `staticDelivery(id)` for restored/static fixtures and explicit streaming/complete helpers for lifecycle tests. Do not add an optional fallback to `Message.delivery`.

- [ ] **Step 5: Verify affected libraries**

```bash
npx nx test ag-ui
npx nx build ag-ui
npx nx test chat
npx nx type-tests chat
```

- [ ] **Step 6: Commit**

```bash
git add libs/ag-ui libs/chat/src/lib/testing libs/chat/src/lib/agent/message.spec.ts
git commit -m "feat(ag-ui): project message delivery lifecycle"
```

## Task 8: Replace the Angular Timer with an Atomic Renderer State Machine

**Files:**
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.component.ts`
- Modify: `libs/chat/src/public-api.ts`
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.component.spec.ts`
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.table-stream.spec.ts`
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.integration.spec.ts`
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.identity.spec.ts`
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.ng0956.spec.ts`
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.torture.spec.ts`
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.variants.spec.ts`

- [ ] **Step 1: Install the upstream candidate tarball**

```bash
npm install /tmp/cacheplane-partial-markdown-0.5.8.tgz --save-exact
```

Apply the same exact dependency to root and `libs/chat/package.json`; confirm the lockfile resolves the local tarball during candidate testing.

- [ ] **Step 2: Rewrite component tests against `[document]` and verify RED**

Use a host with one signal:

```ts
document = signal<StreamingMarkdownDocument>({
  generation: 'g1', phase: 'streaming', content: '',
});
```

Add assertions for final-delta-before-finish, exactly-once finish, repeated complete no-op, generation reset, same-generation complete-to-streaming rejection, changed completed content rejection, and divergent streaming content rejection. Test development throws and production recovery via an injected/testable contract-violation policy rather than global environment mutation.

Cover every transition row independently in both development and production policy modes: `none -> streaming`, `none -> complete`, append-only `streaming -> streaming`, `streaming -> complete`, identical `complete -> complete`, new generation into streaming, new generation into complete, invalid `complete -> streaming`, invalid changed completed content, invalid shrinking content, and invalid divergent content. For each production recovery case, assert the rebuilt parser exactly matches the supplied atomic snapshot.

- [ ] **Step 3: Implement the state machine**

Replace `content`, `streaming`, `FINALIZE_DEBOUNCE_MS`, timer effects, `finished`, and `finalizeTick` with `document = input.required<StreamingMarkdownDocument>()` and synchronous transition processing. Keep only one parser, prior snapshot, and materialized root per generation.

- [ ] **Step 4: Prove timers and inference are absent**

```bash
rg -n "FINALIZE_DEBOUNCE|setTimeout|isLoading|messages\(\)\.length - 1" libs/chat/src/lib/streaming/streaming-markdown.component.ts
```

Expected: no matches.

- [ ] **Step 5: Run all streaming renderer tests**

```bash
npx nx test chat --testFile=libs/chat/src/lib/streaming
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json libs/chat/package.json libs/chat/src/lib/streaming libs/chat/src/public-api.ts
git commit -m "refactor(chat): finalize markdown from explicit lifecycle"
```

## Task 9: Migrate Chat, Reasoning, and Subagent Call Sites

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.spec.ts`
- Modify: `libs/chat/src/lib/primitives/chat-reasoning/chat-reasoning.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-reasoning/chat-reasoning.component.spec.ts`
- Modify: `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.spec.ts`

- [ ] **Step 1: Add failing derivation tests**

Assert chat creates `{ generation, phase, content }` from `message.delivery`; reasoning uses `${generation}:reasoning`; subagents use each nested message's delivery. Assert global `agent.isLoading` and message index do not affect Markdown documents.

- [ ] **Step 2: Run RED**

```bash
npx nx test chat --testFile=libs/chat/src/lib/compositions/chat/chat.component.spec.ts
npx nx test chat --testFile=libs/chat/src/lib/primitives/chat-reasoning/chat-reasoning.component.spec.ts
npx nx test chat --testFile=libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.spec.ts
```

- [ ] **Step 3: Implement pure document derivation**

Add a small exported/internal pure helper near the streaming component:

```ts
export function markdownDocument(
  content: string,
  delivery: MessageDelivery,
  suffix = '',
): StreamingMarkdownDocument;
```

Bind `[document]` at every call site and remove Markdown-specific loading/tail inference.

- [ ] **Step 4: Verify chat**

```bash
npx nx test chat
npx nx type-tests chat
npx nx build chat
```

- [ ] **Step 5: Commit**

```bash
git add libs/chat
git commit -m "refactor(chat): bind markdown to message delivery"
```

## Task 10: Turn Canonical Browser Regressions Green

**Files:**
- Modify: `examples/chat/angular/e2e/markdown-surfaces.spec.ts`
- Modify: `examples/chat/angular/e2e/fixtures/streaming-markdown.json`

- [ ] **Step 1: Review the preimplementation tests from Task 4A**

Confirm no assertions or fixtures were weakened while implementing the explicit lifecycle contract.

- [ ] **Step 2: Run focused Playwright against the candidate and verify GREEN**

```bash
AIMOCK_FIXTURE=fixtures/streaming-markdown.json npx nx e2e examples-chat-angular --grep "long pause|blockquote followed by table|thematic break"
```

Expected: the exact tests observed failing in Task 4A now pass against the packed parser and explicit lifecycle implementation.

- [ ] **Step 3: Verify canonical example build and E2E**

```bash
npx nx build examples-chat-angular
AIMOCK_FIXTURE=fixtures/streaming-markdown.json npx nx e2e examples-chat-angular --grep "streaming"
```

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/e2e
git commit -m "test(chat): cover transient markdown boundaries"
```

## Task 11: Candidate Integration and Chrome MCP Gate

- [ ] **Step 1: Run complete local verification against the tarball**

Cacheplane:

```bash
pnpm --filter @cacheplane/partial-markdown test
pnpm --filter @cacheplane/partial-markdown typecheck
pnpm --filter @cacheplane/partial-markdown build
```

Angular:

```bash
npx nx test chat
npx nx type-tests chat
npx nx build chat
npx nx test langgraph
npx nx build langgraph
npx nx test ag-ui
npx nx build ag-ui
npx nx build examples-chat-angular
```

- [ ] **Step 2: Start aimock-backed canonical servers on free ports**

Use the existing E2E harness or explicit free ports if `4200`/`2024` are occupied. Do not expose secrets in command output.

- [ ] **Step 3: Verify with Chrome MCP**

Inspect these prompts during and after streaming:

```text
Show me a markdown table comparing Angular signals, RxJS, and zone.js — three columns: name, mental model, when to use. Keep it concise.
Give me a blockquote with two lines, then a markdown table with columns issue, expected behavior, verification.
Give me a TypeScript code block, then a thematic break, then one concise sentence.
```

Confirm one table, attached rows, correct blockquote/table sibling boundary, no raw closing fence, no visible thematic delimiter, no console errors, immediate terminal finalization, and correct regeneration.

- [ ] **Step 4: Stop all local servers**

Confirm no listeners remain on the selected Angular, LangGraph, or aimock ports.

## Task 12: Publish Upstream, Consume Registry Artifact, and Reverify

- [ ] **Step 1: Push Cacheplane and open a ready PR**

```bash
git push -u origin blove/partial-markdown-canonical-events
gh pr create --repo cacheplane/cacheplane --title "fix: unify projected markdown events" --body-file <prepared-body>
```

- [ ] **Step 2: Wait for green and merge**

Require workspace and partial-markdown package jobs green. Merge without bypassing failures.

- [ ] **Step 3: Tag the merged release commit**

```bash
git tag partial-markdown-v0.5.8 <merged-main-sha>
git push origin partial-markdown-v0.5.8
```

Expected: OIDC publish workflow succeeds and `npm view @cacheplane/partial-markdown version` returns `0.5.8`.

- [ ] **Step 4: Replace the tarball with registry `0.5.8`**

```bash
npm install @cacheplane/partial-markdown@0.5.8 --save-exact
```

Update both root and chat package manifests; assert no `file:` tarball reference remains in `package-lock.json`.

- [ ] **Step 5: Repeat focused Angular verification and Chrome MCP smoke**

Run chat tests/build, adapter tests, focused Playwright, and the three Chrome prompts against the registry artifact.

- [ ] **Step 6: Run the credential-conditional real-LLM Chrome smoke**

Without printing or shell-expanding the key, check whether root `.env` defines a non-empty `OPENAI_API_KEY`. When available, start the canonical LangGraph server without aimock using that environment, start Angular on free ports, and run the table, blockquote/table, and code-fence/thematic-break prompts through Chrome MCP. Record that the responses came from the real LLM path and verify the same transient/final DOM invariants. When the key is absent, report this gate as skipped with the exact reason; do not substitute a mock and call it real-LLM verification.

- [ ] **Step 7: Commit the registry resolution**

```bash
git add package.json libs/chat/package.json package-lock.json
git commit -m "chore: consume partial-markdown 0.5.8"
```

## Task 13: Publish Angular Changes

- [ ] **Step 1: Review final diff and status**

```bash
git diff origin/main...HEAD --check
git status --short
git log --oneline origin/main..HEAD
```

- [ ] **Step 2: Push and create the Angular PR**

```bash
git push -u origin blove/streaming-markdown-lifecycle
gh pr create --repo cacheplane/angular-agent-framework --title "refactor(chat): make markdown streaming lifecycle explicit" --body-file <prepared-body>
```

- [ ] **Step 3: Monitor checks, address actionable review, and merge on green**

Require all mandatory checks green. After merge, verify `origin/main` contains the registry dependency and no debounce heuristic.

- [ ] **Step 4: Clean up worktrees and local branches**

Use `git worktree remove` only after both PRs are merged and each worktree is clean. Delete local feature branches only after confirming their commits are reachable from `origin/main`.
