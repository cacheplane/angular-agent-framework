# PR A: AG-UI Adapter SUBAGENT_* Consumption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@threadplane/ag-ui` consumes the protocol's `SUBAGENT_STARTED/FINISHED/ERROR` events and `subagentRunId`-attributed text/tool events, populating the existing `subagents()` signal.

**Architecture:** Normalize the new events into the EXISTING `ActivityEntry` shape (`activityType: 'subagent'`, content signal holding `{toolCallId, name, status, messages, toolCalls}`). The projection in `to-agent.ts:342-410` already renders exactly that shape, so it does not change at all. The reducer gains (1) three new cases and (2) an attribution intercept: text/tool events carrying `subagentRunId` route into the child's entry and never touch the parent transcript — the same structural rule the LangGraph adapter enforces for namespaced events. Legacy `ACTIVITY_*`-convention behavior stays byte-identical.

**Tech Stack:** TypeScript, vitest (`npx nx test ag-ui`), `@ag-ui/core` 0.0.59 event schemas (verified: `SubagentStartedEventSchema {subagentRunId, name, description?, parentSubagentRunId?, parentToolCallId?, parentMessageId?}`, `SubagentFinishedEventSchema {subagentRunId, result?, outcome?: {type:'success'} | {type:'suspended', interruptIds?}}`, `SubagentErrorEventSchema {subagentRunId, message, code?}` — all passthrough objects; `subagentRunId` is an optional field on ~30 content-event schemas).

**Spec:** `docs/superpowers/specs/2026-09-01-runtime-subagents-design.md` §1.

**Branching:** cut `blove/agui-subagent-events` from a freshly fetched `origin/main` (`git fetch origin main && git checkout -b blove/agui-subagent-events origin/main`). Run `npm ci` if node_modules predates the branch point.

---

### Task 1: Reducer spec — lifecycle + attribution (failing first)

**Files:**
- Create: `libs/ag-ui/src/lib/reducer.subagent.spec.ts`
- Reference: find the existing reducer spec for store-construction helpers: `ls libs/ag-ui/src/lib/*.spec.ts` and read the one covering `reduceEvent` (mirror its `makeStore()`/store-bootstrap idiom, including how it establishes a `deliveryRun` — TEXT events are dropped by `ownAssistantMessage` without an active run, so every test below must first reduce a `RUN_STARTED` the way the existing spec does).

- [ ] **Step 1: Write the spec** (adapt the store-construction lines to the existing idiom; the assertions below are the contract):

```typescript
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import type { BaseEvent } from '@ag-ui/core';
import { reduceEvent } from './reducer';
// + the same store-construction import/helper the existing reducer spec uses

const ev = (e: Record<string, unknown>) => e as unknown as BaseEvent;

describe('reduceEvent SUBAGENT_* lifecycle', () => {
  it('SUBAGENT_STARTED creates a running subagent activity entry', () => {
    const store = makeStore(); // with an active delivery run, per existing idiom
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher', parentToolCallId: 'call-9' }), store);
    const entry = store.activities().get('sa-1');
    expect(entry?.activityType).toBe('subagent');
    expect(entry?.content()['status']).toBe('running');
    expect(entry?.content()['name']).toBe('researcher');
    expect(entry?.content()['toolCallId']).toBe('call-9');
  });

  it('SUBAGENT_STARTED without parentToolCallId keys the card by subagentRunId', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-2', name: 'forecaster' }), store);
    expect(store.activities().get('sa-2')?.content()['toolCallId']).toBe('sa-2');
  });

  it('attributed TEXT_MESSAGE events feed the child entry and never the transcript', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher' }), store);
    reduceEvent(ev({ type: 'TEXT_MESSAGE_START', messageId: 'm-1', role: 'assistant', subagentRunId: 'sa-1' }), store);
    reduceEvent(ev({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: 'Checking ', subagentRunId: 'sa-1' }), store);
    reduceEvent(ev({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: 'flights', subagentRunId: 'sa-1' }), store);
    const msgs = store.activities().get('sa-1')?.content()['messages'] as Array<Record<string, unknown>>;
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ id: 'm-1', role: 'assistant', content: 'Checking flights' });
    expect(store.messages().some((m) => m.id === 'm-1')).toBe(false); // structural rule
  });

  it('attributed TOOL_CALL events feed the child, not the parent toolCalls signal', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher' }), store);
    reduceEvent(ev({ type: 'TOOL_CALL_START', toolCallId: 't-1', toolCallName: 'web_search', subagentRunId: 'sa-1' }), store);
    reduceEvent(ev({ type: 'TOOL_CALL_ARGS', toolCallId: 't-1', delta: '{"q":"x"}', subagentRunId: 'sa-1' }), store);
    reduceEvent(ev({ type: 'TOOL_CALL_END', toolCallId: 't-1', subagentRunId: 'sa-1' }), store);
    const calls = store.activities().get('sa-1')?.content()['toolCalls'] as Array<Record<string, unknown>>;
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: 't-1', name: 'web_search', status: 'complete', args: { q: 'x' } });
    expect(store.toolCalls()).toHaveLength(0);
  });

  it('an attributed event before SUBAGENT_STARTED creates the entry instead of dropping (buffer-not-drop)', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'TEXT_MESSAGE_START', messageId: 'm-1', role: 'assistant', subagentRunId: 'sa-late' }), store);
    reduceEvent(ev({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: 'early', subagentRunId: 'sa-late' }), store);
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-late', name: 'researcher' }), store);
    const content = store.activities().get('sa-late')!.content();
    expect(content['name']).toBe('researcher'); // STARTED fills identity in
    const msgs = content['messages'] as Array<Record<string, unknown>>;
    expect(msgs[0]).toMatchObject({ content: 'early' }); // ...without resetting buffered content
  });

  it('SUBAGENT_FINISHED success completes; suspended stays running; re-announce after suspend does not duplicate', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher' }), store);
    reduceEvent(ev({ type: 'SUBAGENT_FINISHED', subagentRunId: 'sa-1', outcome: { type: 'suspended', interruptIds: ['i-1'] } }), store);
    expect(store.activities().get('sa-1')?.content()['status']).toBe('running');
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher' }), store); // resume re-announce
    expect(store.activities().size).toBe(1);
    reduceEvent(ev({ type: 'SUBAGENT_FINISHED', subagentRunId: 'sa-1', outcome: { type: 'success' }, result: 'booked' }), store);
    expect(store.activities().get('sa-1')?.content()['status']).toBe('complete');
  });

  it('SUBAGENT_ERROR marks the entry error and records the message', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher' }), store);
    reduceEvent(ev({ type: 'SUBAGENT_ERROR', subagentRunId: 'sa-1', message: 'rate limited', code: '429' }), store);
    const content = store.activities().get('sa-1')!.content();
    expect(content['status']).toBe('error');
    expect((content['state'] as Record<string, unknown>)['error']).toBe('rate limited');
  });

  it('unattributed events behave exactly as before (regression)', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'TEXT_MESSAGE_START', messageId: 'm-1', role: 'assistant' }), store);
    reduceEvent(ev({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: 'hello' }), store);
    expect(store.messages().find((m) => m.id === 'm-1')?.content).toBe('hello');
    expect(store.activities().size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `cd libs/ag-ui && npx vitest run reducer.subagent`
Expected: all lifecycle/attribution tests FAIL (unknown event types fall through the switch; attributed events land in the transcript); the regression test PASSES.

- [ ] **Step 3: Commit**

```bash
git add libs/ag-ui/src/lib/reducer.subagent.spec.ts
git commit -m "test(ag-ui): specify SUBAGENT_* lifecycle and subagentRunId attribution routing"
```

---

### Task 2: Reducer implementation

**Files:**
- Modify: `libs/ag-ui/src/lib/reducer.ts` (switch at `reduceEvent`, `:137`; ACTIVITY_SNAPSHOT at `:473-492` is the pattern for entry creation + generation allocation — read it first and reuse its exact generation-allocation call)

- [ ] **Step 1: Add the attribution intercept** at the TOP of `reduceEvent`, before the switch:

```typescript
  // A subagentRunId on a content event means the child produced it: route it
  // into that subagent's activity entry and never into the parent transcript —
  // the same structural rule @threadplane/langgraph applies to namespaced
  // events. Scope: text + tool events (what our emitters produce). Reasoning/
  // step attribution is deliberately not routed yet (YAGNI).
  const subagentRunId = (event as { subagentRunId?: string }).subagentRunId;
  if (subagentRunId && SUBAGENT_ROUTED_TYPES.has(event.type as string)) {
    routeSubagentContentEvent(subagentRunId, event, store);
    return;
  }
```

with, at module scope:

```typescript
const SUBAGENT_ROUTED_TYPES = new Set([
  'TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_END',
  'TOOL_CALL_START', 'TOOL_CALL_ARGS', 'TOOL_CALL_END', 'TOOL_CALL_RESULT',
]);
```

- [ ] **Step 2: Add the entry helper + router** (module scope, near the ACTIVITY handlers). `ensureSubagentEntry` mirrors ACTIVITY_SNAPSHOT's entry creation (same generation allocation, `activityType: 'subagent'`); content starts `{ toolCallId: <parentToolCallId ?? id>, name: '', status: 'running', messages: [], toolCalls: [] }`. The router updates the entry's content signal immutably:

```typescript
function routeSubagentContentEvent(subagentRunId: string, event: BaseEvent, store: ReducerStore): void {
  const entry = ensureSubagentEntry(subagentRunId, store); // buffer-not-drop: creates on first sight
  const e = event as unknown as Record<string, unknown>;
  entry.content.update((c) => {
    const messages = [...((c['messages'] as Array<Record<string, unknown>>) ?? [])];
    const toolCalls = [...((c['toolCalls'] as Array<Record<string, unknown>>) ?? [])];
    switch (event.type as string) {
      case 'TEXT_MESSAGE_START': {
        const id = e['messageId'] as string;
        if (!messages.some((m) => m['id'] === id)) messages.push({ id, role: 'assistant', content: '' });
        return { ...c, messages };
      }
      case 'TEXT_MESSAGE_CONTENT': {
        const id = e['messageId'] as string;
        const idx = messages.findIndex((m) => m['id'] === id);
        if (idx < 0) messages.push({ id, role: 'assistant', content: e['delta'] ?? '' });
        else messages[idx] = { ...messages[idx], content: `${messages[idx]['content'] ?? ''}${e['delta'] ?? ''}` };
        return { ...c, messages };
      }
      case 'TEXT_MESSAGE_END':
        return c;
      case 'TOOL_CALL_START':
        toolCalls.push({ id: e['toolCallId'], name: e['toolCallName'], args: {}, status: 'running' });
        return { ...c, toolCalls };
      case 'TOOL_CALL_ARGS': {
        // Same accumulated-buffer rule as the parent handler (reducer.ts:284-300):
        // deltas are JSON fragments; parse the accumulation, keep last-good args.
        const buffers = (store.argsBuffers ??= new Map<string, string>());
        const key = `subagent:${e['toolCallId']}`;
        const buffer = (buffers.get(key) ?? '') + ((e['delta'] as string) ?? '');
        buffers.set(key, buffer);
        const args = tryParseArgs(buffer);
        return args === undefined ? c : { ...c, toolCalls: toolCalls.map((t) => t['id'] === e['toolCallId'] ? { ...t, args } : t) };
      }
      case 'TOOL_CALL_END': {
        store.argsBuffers?.delete(`subagent:${e['toolCallId']}`);
        return { ...c, toolCalls: toolCalls.map((t) => t['id'] === e['toolCallId'] ? { ...t, status: 'complete' } : t) };
      }
      case 'TOOL_CALL_RESULT':
        return { ...c, toolCalls: toolCalls.map((t) => t['id'] === e['toolCallId'] ? { ...t, result: e['content'] } : t) };
      default:
        return c;
    }
  });
  store.activities.update((m) => new Map(m)); // notify consumers of the entry mutation
}
```

(If the existing ACTIVITY_DELTA handler notifies differently — check `:494-508` — use ITS notification idiom instead of the final `activities.update`; consistency wins.)

- [ ] **Step 3: Add the three lifecycle cases** to the switch, adjacent to ACTIVITY_SNAPSHOT:

```typescript
    case 'SUBAGENT_STARTED': {
      const e = event as unknown as { subagentRunId: string; name: string; description?: string; parentToolCallId?: string };
      const entry = ensureSubagentEntry(e.subagentRunId, store);
      // Fills identity in without resetting content a pre-STARTED attributed
      // event already buffered; a post-suspend re-announce is a no-op update.
      entry.content.update((c) => ({
        ...c,
        name: e.name,
        ...(e.description !== undefined ? { description: e.description } : {}),
        ...(e.parentToolCallId !== undefined ? { toolCallId: e.parentToolCallId } : {}),
        status: 'running',
      }));
      store.activities.update((m) => new Map(m));
      return;
    }
    case 'SUBAGENT_FINISHED': {
      const e = event as unknown as { subagentRunId: string; result?: unknown; outcome?: { type: 'success' | 'suspended' } };
      const entry = store.activities().get(e.subagentRunId);
      if (!entry) return;
      // Suspended keeps the card running: the run resumes with the same id,
      // and the interrupt itself surfaces through the interrupt signal.
      const status = e.outcome?.type === 'suspended' ? 'running' : 'complete';
      entry.content.update((c) => ({
        ...c,
        status,
        ...(e.result !== undefined ? { state: { ...((c['state'] as Record<string, unknown>) ?? {}), result: e.result } } : {}),
      }));
      store.activities.update((m) => new Map(m));
      return;
    }
    case 'SUBAGENT_ERROR': {
      const e = event as unknown as { subagentRunId: string; message: string };
      const entry = store.activities().get(e.subagentRunId);
      if (!entry) return;
      entry.content.update((c) => ({
        ...c,
        status: 'error',
        state: { ...((c['state'] as Record<string, unknown>) ?? {}), error: e.message },
      }));
      store.activities.update((m) => new Map(m));
      return;
    }
```

- [ ] **Step 4: Run the new spec, then the full lib**

Run: `cd libs/ag-ui && npx vitest run reducer.subagent && npx vitest run`
Expected: new spec fully green; full suite green (regression: existing activity/reducer/projection tests unchanged).

- [ ] **Step 5: Projection sanity** — NO change to `to-agent.ts` is expected: entries are ActivityEntries with `activityType: 'subagent'`, so `subagents()` (`to-agent.ts:398-410`) and the wrapper (`:345-386`, `toolCallId` fallback at `:350`, messages array mapping at `:362-374`) already render them. Verify by adding ONE projection test to the new spec file: reduce STARTED + attributed TEXT events through a real `toAgent(...)` instance (mirror however the existing to-agent spec constructs one) and assert `agent.subagents().get('sa-1')` yields `name === 'researcher'` and one assistant message with the accumulated content. If the existing to-agent spec makes this awkward, put the test beside its peers in that spec file instead.

- [ ] **Step 6: Lint + commit**

Run: `npx nx lint ag-ui && npx nx test ag-ui`

```bash
git add libs/ag-ui/src/lib/reducer.ts libs/ag-ui/src/lib/reducer.subagent.spec.ts
git commit -m "feat(ag-ui): consume SUBAGENT_* lifecycle events and route subagentRunId-attributed content"
```

---

### Task 3: Runtime transcript fixture

**Files:**
- Create: `libs/ag-ui/fixtures/runtime-transcripts/subagent-lifecycle.json`
- Reference: read one existing file in that directory first and MATCH its envelope format exactly (the 8 existing files define the schema; do not invent one).

- [ ] **Step 1:** Write the transcript: RUN_STARTED → parent TEXT_MESSAGE → TOOL_CALL_START (`call-9`, the delegation tool) → SUBAGENT_STARTED (`sa-1`, name `researcher`, parentToolCallId `call-9`) → two attributed TEXT_MESSAGE_CONTENT deltas → SUBAGENT_FINISHED success → TOOL_CALL_RESULT → parent TEXT_MESSAGE → RUN_FINISHED.
- [ ] **Step 2:** Add the replay test wherever the existing runtime transcripts are replayed (grep `runtime-transcripts` under `libs/ag-ui/src` to find the harness spec) asserting: transcript has 2 parent messages, `subagents()` has one complete entry named `researcher` keyed under `call-9`, and the child's text never appears in the parent transcript.
- [ ] **Step 3:** `npx nx test ag-ui` → green. Commit: `test(ag-ui): subagent lifecycle runtime transcript`.

---

### Task 4: Final verification + PR

- [ ] `npx nx lint ag-ui 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -cE ' error '` → 0; `npx nx test ag-ui` → green.
- [ ] Public API check: if `libs/ag-ui/src/public-api.ts` (or index barrel) changed, run `npm run generate-api-docs` and commit. (Expected: no barrel change — everything lands inside existing modules.)
- [ ] Run one existing AG-UI e2e in replay to prove no regression: `npx playwright test --config cockpit/ag-ui/subagents/angular/e2e/playwright.config.ts` (free its ports first via `cockpit/ports.mjs`; the legacy ACTIVITY path must still drive the cards). Expected: green.
- [ ] Open PR: base main, title `feat(ag-ui): consume the protocol's SUBAGENT_* events and subagentRunId attribution`. Body notes back-compat (ACTIVITY convention untouched) and that per-runtime emitters land in follow-up PRs. Address AI review comments; arm auto-merge (`CI — required` + Vercel gate).
