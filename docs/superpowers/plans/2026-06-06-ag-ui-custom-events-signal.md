# AG-UI `customEvents` Signal Implementation Plan (PR 1 of examples/ag-ui)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `customEvents` Signal to the `@threadplane/ag-ui` adapter so live/progressive a2ui streaming renders over AG-UI (closing the one parity gap found in the spike).

**Architecture:** The reducer already computes `{name, data}` for every non-interrupt `CUSTOM` AG-UI event. We accumulate those into a new `customEvents` `WritableSignal` on the reducer store (reset on `RUN_STARTED`), expose it on the agent returned by `toAgent`, and widen that return type to `AgUiAgent` (mirrors langgraph's `LangGraphAgent`). `chat.component.ts:551` already duck-types for `agent.customEvents()` to feed the a2ui partial-args bridge — no chat changes needed.

**Tech Stack:** TypeScript, Angular signals, RxJS, `@ag-ui/client`, vitest, Nx.

**Spec:** `docs/superpowers/specs/2026-06-06-examples-ag-ui-standalone-design.md` (Part 1)

---

## Background facts (verified)

- `chat.component.ts:548-564` feature-detects `customEvents?: () => readonly { name: string; data: unknown }[]` and processes entries where `name === 'a2ui-partial'` (`data = { tool_call_id, args_so_far }`). It's the ONLY consumer; no chat changes required.
- `libs/ag-ui/src/lib/reducer.ts` `CUSTOM` case: after an `on_interrupt` early-return, it computes `parsedValue` and emits `{type:'custom'|'state_update', ...}` on `events$`. We add accumulation here.
- `ReducerStore` (reducer.ts) is the signal bundle; `to-agent.ts` builds it and returns the neutral `Agent`. `customEvents` is NOT part of the neutral `Agent` type, so the return type must widen.
- Tests use vitest; run with `npx nx test ag-ui`.

---

## File Structure

**Modified:**
- `libs/ag-ui/src/lib/reducer.ts` — export `CustomStreamEvent`; add `customEvents` to `ReducerStore`; reset on `RUN_STARTED`; accumulate in `CUSTOM`.
- `libs/ag-ui/src/lib/reducer.spec.ts` — extend `makeStore()`; add accumulation/reset tests.
- `libs/ag-ui/src/lib/to-agent.ts` — init `customEvents` in store; return it; widen return type to `AgUiAgent`.
- `libs/ag-ui/src/lib/to-agent.spec.ts` — assert `customEvents` exposure.
- `libs/ag-ui/src/public-api.ts` — export `CustomStreamEvent`, `AgUiAgent`.
- `apps/website/content/docs/ag-ui/api/api-docs.json` — regenerated.
- `apps/website/content/docs/ag-ui/concepts/architecture.mdx` — short note on live a2ui via `customEvents`.

---

## Task 1: Reducer — `customEvents` accumulator (TDD)

**Files:**
- Modify: `libs/ag-ui/src/lib/reducer.ts`
- Modify: `libs/ag-ui/src/lib/reducer.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `libs/ag-ui/src/lib/reducer.spec.ts`, first extend `makeStore()` to include the new signal. Change the `makeStore` return object to add the `customEvents` line (keep all existing lines):

```ts
function makeStore(): ReducerStore {
  return {
    messages:  signal<Message[]>([]),
    status:    signal<AgentStatus>('idle'),
    isLoading: signal(false),
    error:     signal<unknown>(null),
    toolCalls: signal<ToolCall[]>([]),
    state:     signal<Record<string, unknown>>({}),
    interrupt: signal(undefined),
    events$:   new Subject<AgentEvent>(),
    customEvents: signal<CustomStreamEvent[]>([]),
  };
}
```

Add the import at the top of the spec (alongside the existing `reduceEvent` import):

```ts
import { reduceEvent, type ReducerStore, type CustomStreamEvent } from './reducer';
```

Then add this `describe` block at the end of the file:

```ts
describe('reduceEvent — customEvents accumulation', () => {
  it('accumulates non-interrupt CUSTOM events as {name, data} in order', () => {
    const store = makeStore();
    reduceEvent({ type: 'CUSTOM', name: 'a2ui-partial', value: { tool_call_id: 't1', args_so_far: '{' } } as any, store);
    reduceEvent({ type: 'CUSTOM', name: 'a2ui-partial', value: { tool_call_id: 't1', args_so_far: '{"a":1' } } as any, store);
    expect(store.customEvents()).toEqual([
      { name: 'a2ui-partial', data: { tool_call_id: 't1', args_so_far: '{' } },
      { name: 'a2ui-partial', data: { tool_call_id: 't1', args_so_far: '{"a":1' } },
    ]);
  });

  it('parses JSON-string CUSTOM values before storing', () => {
    const store = makeStore();
    reduceEvent({ type: 'CUSTOM', name: 'a2ui-partial', value: '{"tool_call_id":"t1","args_so_far":"{"}' } as any, store);
    expect(store.customEvents()).toEqual([
      { name: 'a2ui-partial', data: { tool_call_id: 't1', args_so_far: '{' } },
    ]);
  });

  it('does NOT accumulate on_interrupt CUSTOM events (those drive the interrupt signal)', () => {
    const store = makeStore();
    reduceEvent({ type: 'CUSTOM', name: 'on_interrupt', value: { foo: 'bar' } } as any, store);
    expect(store.customEvents()).toEqual([]);
    expect(store.interrupt()).toMatchObject({ value: { foo: 'bar' } });
  });

  it('RUN_STARTED resets customEvents for the new run', () => {
    const store = makeStore();
    reduceEvent({ type: 'CUSTOM', name: 'a2ui-partial', value: { tool_call_id: 't1', args_so_far: '{' } } as any, store);
    expect(store.customEvents()).toHaveLength(1);
    reduceEvent({ type: 'RUN_STARTED' } as any, store);
    expect(store.customEvents()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test ag-ui`
Expected: FAIL — `CustomStreamEvent` not exported / `customEvents` missing on `ReducerStore` (compile error) and the new assertions fail.

- [ ] **Step 3: Implement in reducer.ts**

In `libs/ag-ui/src/lib/reducer.ts`:

(a) Add the exported type just above the `ReducerStore` interface:

```ts
/**
 * A custom event surfaced to consumers via the agent's `customEvents` signal.
 * Mirrors the LangGraph adapter's CustomStreamEvent shape so the chat
 * a2ui partial-args bridge consumes both transports identically.
 */
export interface CustomStreamEvent {
  /** Event name set by the backend (e.g. 'a2ui-partial', 'state_update'). */
  name: string;
  /** Arbitrary payload from the backend (JSON-string values are parsed). */
  data: unknown;
}
```

(b) Add `customEvents` to the `ReducerStore` interface (after the `events$` line):

```ts
export interface ReducerStore {
  messages:  WritableSignal<Message[]>;
  status:    WritableSignal<AgentStatus>;
  isLoading: WritableSignal<boolean>;
  error:     WritableSignal<unknown>;
  toolCalls: WritableSignal<ToolCall[]>;
  state:     WritableSignal<Record<string, unknown>>;
  interrupt: WritableSignal<AgentInterrupt | undefined>;
  events$:   Subject<AgentEvent>;
  customEvents: WritableSignal<CustomStreamEvent[]>;
}
```

(c) In the `RUN_STARTED` case, add the reset (after `store.interrupt.set(undefined);`):

```ts
    case 'RUN_STARTED': {
      store.status.set('running');
      store.isLoading.set(true);
      store.error.set(null);
      store.interrupt.set(undefined);
      store.customEvents.set([]);
      return;
    }
```

(d) In the `CUSTOM` case, accumulate after the `on_interrupt` early-return (so on_interrupt is excluded). The case becomes:

```ts
    case 'CUSTOM': {
      const e = event as unknown as { name: string; value: unknown };
      // ag_ui_langgraph serializes interrupt payloads as JSON strings.
      // Parse the value if it arrives as a string so downstream consumers
      // (e.g. ChatApprovalCardComponent) receive a plain object, not a string.
      const parsedValue = typeof e.value === 'string' ? safeParseJson(e.value) : e.value;
      if (e.name === 'on_interrupt') {
        store.interrupt.set({ id: randomId(), value: parsedValue, resumable: true });
        return;
      }
      // Surface every other custom event on the customEvents signal so the
      // chat a2ui partial-args bridge (which reads agent.customEvents()) lights
      // up live/progressive a2ui rendering — parity with the LangGraph adapter.
      store.customEvents.update((prev) => [...prev, { name: e.name, data: parsedValue }]);
      if (e.name === 'state_update' && isRecord(parsedValue)) {
        store.events$.next({ type: 'state_update', data: parsedValue });
      } else {
        store.events$.next({ type: 'custom', name: e.name, data: parsedValue });
      }
      return;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test ag-ui`
Expected: PASS (all reducer tests, including the 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add libs/ag-ui/src/lib/reducer.ts libs/ag-ui/src/lib/reducer.spec.ts
git commit -m "feat(ag-ui): accumulate non-interrupt CUSTOM events into a customEvents store signal"
```

---

## Task 2: Expose `customEvents` on the agent (TDD)

**Files:**
- Modify: `libs/ag-ui/src/lib/to-agent.ts`
- Modify: `libs/ag-ui/src/lib/to-agent.spec.ts`
- Modify: `libs/ag-ui/src/public-api.ts`

- [ ] **Step 1: Write the failing test**

In `libs/ag-ui/src/lib/to-agent.spec.ts`, add a test that builds an agent and asserts `customEvents` is exposed and reactive. Use the existing test's pattern for constructing a fake `AbstractAgent` source (mirror whatever harness the file already uses to drive `onEvent`). Add:

```ts
it('exposes a customEvents signal that reflects reduced CUSTOM events', () => {
  // `source` is the fake AbstractAgent used elsewhere in this file; it must
  // let the test push events into the subscriber's onEvent callback.
  const agent = toAgent(source) as import('./to-agent').AgUiAgent;
  expect(typeof agent.customEvents).toBe('function');
  expect(agent.customEvents()).toEqual([]);

  emit({ type: 'CUSTOM', name: 'a2ui-partial', value: { tool_call_id: 't1', args_so_far: '{' } });

  expect(agent.customEvents()).toEqual([
    { name: 'a2ui-partial', data: { tool_call_id: 't1', args_so_far: '{' } },
  ]);
});
```

> If `to-agent.spec.ts` already defines a helper to create `source` + an `emit(event)` function that invokes the registered `onEvent`, reuse it. If it does not, model `emit` on how the existing tests deliver events (find the `source.subscribe` capture in the file's setup and expose the captured `onEvent`). Do not invent a new harness if one exists.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test ag-ui`
Expected: FAIL — `AgUiAgent` not exported / `customEvents` missing on the returned object.

- [ ] **Step 3: Implement in to-agent.ts**

(a) Update the imports. Change the `@angular/core` import to also bring `Signal`, and the reducer import to bring the new type:

```ts
import { signal, type Signal } from '@angular/core';
```
```ts
import { reduceEvent, type ReducerStore, type CustomStreamEvent } from './reducer';
```

(b) Add an exported return-type interface just above `export function toAgent(...)`:

```ts
/**
 * The neutral Agent contract, widened with the AG-UI adapter's optional
 * `customEvents` signal (the chat composition feature-detects it to enable
 * live a2ui streaming). Mirrors langgraph's LangGraphAgent extension.
 */
export interface AgUiAgent extends Agent {
  customEvents: Signal<CustomStreamEvent[]>;
}
```

(c) Add `customEvents` to the store initialization (after the `events$` line):

```ts
  const store: ReducerStore = {
    messages:  signal<Message[]>([]),
    status:    signal<AgentStatus>('idle'),
    isLoading: signal<boolean>(false),
    error:     signal<unknown>(null),
    toolCalls: signal<ToolCall[]>([]),
    state:     signal<Record<string, unknown>>({}),
    interrupt: signal<AgentInterrupt | undefined>(undefined),
    events$:   new Subject<AgentEvent>(),
    customEvents: signal<CustomStreamEvent[]>([]),
  };
```

(d) Change the function return type from `: Agent` to `: AgUiAgent`:

```ts
export function toAgent(source: AbstractAgent, options: ToAgentOptions = {}): AgUiAgent {
```

(e) Add `customEvents` to the returned object (after the `events$:` line in the `return { ... }`):

```ts
    events$:   store.events$.asObservable(),
    customEvents: store.customEvents,
```

- [ ] **Step 4: Export the new types from the public API**

In `libs/ag-ui/src/public-api.ts`, extend the to-agent export line and add the reducer type:

```ts
export { toAgent } from './lib/to-agent';
export type { ToAgentOptions, AgUiAgent } from './lib/to-agent';
export type { CustomStreamEvent } from './lib/reducer';
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx nx test ag-ui`
Expected: PASS (including the new to-agent test).

Run: `npx nx build ag-ui`
Expected: builds cleanly (confirms the widened return type + exports compile and the public API surface is valid).

- [ ] **Step 6: Commit**

```bash
git add libs/ag-ui/src/lib/to-agent.ts libs/ag-ui/src/lib/to-agent.spec.ts libs/ag-ui/src/public-api.ts
git commit -m "feat(ag-ui): expose customEvents signal on toAgent (AgUiAgent) for live a2ui streaming"
```

---

## Task 3: Docs — regenerate API reference + architecture note

**Files:**
- Modify: `apps/website/content/docs/ag-ui/api/api-docs.json` (generated)
- Modify: `apps/website/content/docs/ag-ui/concepts/architecture.mdx`

- [ ] **Step 1: Regenerate the API docs**

Run: `npm run generate-api-docs`
Then confirm the ag-ui reference picked up the new symbols:

Run: `grep -c "customEvents\|AgUiAgent\|CustomStreamEvent" apps/website/content/docs/ag-ui/api/api-docs.json`
Expected: a non-zero count (the new exports appear in the generated reference).

> If `npm run generate-api-docs` regenerates other products' `api-docs.json` too, only stage the `ag-ui` one (Step 4) — leave unrelated regenerated files out of this commit unless they are also stale on main.

- [ ] **Step 2: Add a short note to the architecture doc**

Read `apps/website/content/docs/ag-ui/concepts/architecture.mdx`. Find the section that discusses events/state or the agent surface (where `events$`, interrupts, or state are described). Append this subsection at a sensible spot (end of the relevant section):

```mdx
## Live a2ui streaming via `customEvents`

The adapter exposes a `customEvents` signal on the agent returned by
`toAgent` / `injectAgent`, accumulating every non-`on_interrupt` `CUSTOM`
AG-UI event for the current run (reset on each `RUN_STARTED`). The chat
composition feature-detects this signal to drive **progressive** a2ui
surface rendering — token-by-token, as the backend streams `a2ui-partial`
events — matching the LangGraph adapter. Without it, a2ui still renders from
the final tool-call surface; with it, surfaces build up live.
```

- [ ] **Step 3: Verify the website still builds the MDX**

Run: `npx nx build website 2>&1 | tail -5`
Expected: builds (or at minimum, no error referencing `architecture.mdx`). If a full website build is too slow/heavy in this environment, instead validate the MDX parses by confirming no syntax error: `npx tsx -e "require('fs').readFileSync('apps/website/content/docs/ag-ui/concepts/architecture.mdx','utf8')"` and visually confirm the fenced block is balanced.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs/ag-ui/api/api-docs.json apps/website/content/docs/ag-ui/concepts/architecture.mdx
git commit -m "docs(ag-ui): document customEvents signal + live a2ui streaming; regen API reference"
```

---

## Task 4: PR + merge

- [ ] **Step 1: Push the branch**

Run: `git push -u origin claude/ag-ui-custom-events-signal`

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat(ag-ui): customEvents signal for live a2ui streaming parity" --body "$(cat <<'EOF'
## Summary

Adds a `customEvents` signal to the `@threadplane/ag-ui` adapter, closing the one gap that prevented live/progressive a2ui streaming over AG-UI (found via the examples/ag-ui spike).

- Reducer accumulates every non-`on_interrupt` `CUSTOM` event as `{name, data}` into a new store signal; resets on `RUN_STARTED`.
- `toAgent` exposes it (return type widened to `AgUiAgent`, mirroring langgraph's `LangGraphAgent`). `chat.component.ts` already feature-detects `agent.customEvents()` — no chat changes.
- New public exports: `AgUiAgent`, `CustomStreamEvent`.
- Docs: regenerated ag-ui API reference + architecture note.

Without this, a2ui renders from the final tool-call surface (fallback); with it, surfaces build up token-by-token. Part 1 of the `examples/ag-ui` design (`docs/superpowers/specs/2026-06-06-examples-ag-ui-standalone-design.md`).

## Test plan

- [x] Unit: reducer accumulation/reset/JSON-parse/on_interrupt-exclusion; toAgent exposure.
- [ ] CI green; `nx build ag-ui` clean.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Arm auto-merge**

Run: `gh pr merge <PR_NUMBER> --squash --auto --delete-branch`

- [ ] **Step 4: Wait for green + merge**

Poll until merged. If the `Vercel – threadplane` preview fails on a transient npm-registry 404 (known flake this session), redeploy that preview via the Vercel API rather than treating it as a real failure.

---

## Self-Review

- [ ] **Spec coverage (Part 1):** `customEvents` signal → Tasks 1-2. Unit tests → Tasks 1-2. API-docs regen + signal docs → Task 3. Lifecycle (reset per run) → Task 1 RUN_STARTED test.
- [ ] **No placeholders:** every step has literal code/commands.
- [ ] **Type consistency:** `CustomStreamEvent { name, data }` defined in reducer.ts (Task 1), imported in to-agent (Task 2), exported in public-api (Task 2). `AgUiAgent extends Agent { customEvents: Signal<CustomStreamEvent[]> }` consistent between to-agent return (Task 2) and the test cast (Task 2). `customEvents` is a `WritableSignal` in the store, exposed as `Signal` on the agent — assignable.
- [ ] **No chat changes:** confirmed `chat.component.ts:551` duck-types structurally; returning the signal (callable, returns `CustomStreamEvent[]` ⊆ `readonly {name,data}[]`) satisfies it.
