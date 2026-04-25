# `events$` on `Agent` Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the optional, free-form `Agent.customEvents$` with a required, structured `events$: Observable<AgentEvent>`, where `AgentEvent` is a discriminated union of `AgentStateUpdateEvent | AgentCustomEvent`.

**Architecture:** Single-file new type module (`agent-event.ts`) replaces `agent-custom-event.ts`. `Agent` field renamed and made required. LangGraph adapter rewires the existing `buildCustomEvents$` bridge to emit the new union and discriminate `state_update` from generic custom events. Mock + conformance helpers updated. Sole production consumer (`chat.component.ts`) gets a cleaner subscribe block.

**Tech Stack:** Angular 21 (signals + RxJS), Vitest, Nx.

**Spec:** `docs/superpowers/specs/2026-04-25-events-on-agent-contract-design.md`

---

## File Structure

### New / renamed

- Renamed: `libs/chat/src/lib/agent/agent-custom-event.ts` → `agent-event.ts` (content fully rewritten)
- Renamed: `libs/chat/src/lib/agent/agent-custom-event.spec.ts` → `agent-event.spec.ts` (content updated)

### Modified

- `libs/chat/src/lib/agent/agent.ts` — `customEvents$?: Observable<AgentCustomEvent>` → `events$: Observable<AgentEvent>` (required)
- `libs/chat/src/lib/agent/index.ts` — re-export `AgentEvent`, `AgentStateUpdateEvent`, `AgentCustomEvent` (structured); drop old free-form `AgentCustomEvent`
- `libs/chat/src/public-api.ts` — same export delta
- `libs/chat/src/lib/testing/mock-agent.ts` — `events$?: Observable<AgentEvent>` option (defaults to `EMPTY`); drop `customEvents$` option
- `libs/chat/src/lib/testing/mock-agent.spec.ts` — adjust tests
- `libs/chat/src/lib/testing/agent-conformance.ts` — unconditional `events$.subscribe` assertion
- `libs/chat/src/lib/compositions/chat/chat.component.ts` — subscribe to `agent.events$`, narrow on `event.type === 'state_update'`
- `libs/chat/src/lib/compositions/chat/chat.component.spec.ts` — any `customEvents$` references updated
- `libs/langgraph/src/lib/to-agent.ts` — emit `AgentEvent`, discriminate `state_update`, rename helper
- `libs/langgraph/src/lib/to-agent.spec.ts` — translation tests
- `libs/langgraph/src/lib/to-agent.conformance.spec.ts` — adjust if it touches custom events

---

### Task 1: Replace `agent-custom-event.ts` with `agent-event.ts` and update Agent contract

**Files:**
- Rename: `libs/chat/src/lib/agent/agent-custom-event.ts` → `agent-event.ts`
- Rename: `libs/chat/src/lib/agent/agent-custom-event.spec.ts` → `agent-event.spec.ts`
- Modify: `libs/chat/src/lib/agent/agent.ts`
- Modify: `libs/chat/src/lib/agent/index.ts`
- Modify: `libs/chat/src/public-api.ts`
- Modify: `libs/chat/src/lib/testing/mock-agent.ts` (+ spec)
- Modify: `libs/chat/src/lib/testing/agent-conformance.ts`
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts` (+ spec)

(All bundled because intermediate steps break the build; commit once at end of Task 1.)

- [ ] **Step 1: `git mv` and rewrite the type file**

```bash
cd libs/chat/src/lib/agent
git mv agent-custom-event.ts agent-event.ts
git mv agent-custom-event.spec.ts agent-event.spec.ts
cd ../../../../..
```

Replace `libs/chat/src/lib/agent/agent-event.ts` content with:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Render-state-store sync event. Adapters emit this when the runtime
 * publishes a state-snapshot intended for the chat library's render store
 * (used by generative UI and a2ui surfaces).
 */
export interface AgentStateUpdateEvent {
  readonly type: 'state_update';
  readonly data: Record<string, unknown>;
}

/**
 * Escape hatch for runtime-specific or user-defined events that do not
 * (yet) have a well-known structured variant. `name` carries the runtime
 * event name; `data` carries the payload verbatim.
 */
export interface AgentCustomEvent {
  readonly type: 'custom';
  readonly name: string;
  readonly data: unknown;
}

/**
 * Discriminated union of events flowing on `Agent.events$`.
 *
 * Invariant: state lives on signals (`messages`, `status`, `toolCalls`,
 * `state`, `interrupt`, `subagents`, `history`); events on `events$`
 * carry only things that are not derivable from signals. New variants
 * are added purely additively when patterns prove necessary.
 */
export type AgentEvent = AgentStateUpdateEvent | AgentCustomEvent;
```

- [ ] **Step 2: Rewrite the spec file**

`libs/chat/src/lib/agent/agent-event.spec.ts`:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import type {
  AgentEvent,
  AgentStateUpdateEvent,
  AgentCustomEvent,
} from './agent-event';

describe('AgentEvent', () => {
  it('narrows AgentStateUpdateEvent by type discriminator', () => {
    const e: AgentEvent = { type: 'state_update', data: { foo: 1 } };
    if (e.type === 'state_update') {
      expect(e.data.foo).toBe(1);
    }
  });

  it('narrows AgentCustomEvent by type discriminator', () => {
    const e: AgentEvent = { type: 'custom', name: 'tick', data: 42 };
    if (e.type === 'custom') {
      expect(e.name).toBe('tick');
      expect(e.data).toBe(42);
    }
  });

  it('AgentStateUpdateEvent.data is Record-shaped', () => {
    const e: AgentStateUpdateEvent = { type: 'state_update', data: {} };
    expect(typeof e.data).toBe('object');
  });

  it('AgentCustomEvent.data is unknown', () => {
    const e: AgentCustomEvent = { type: 'custom', name: 'x', data: null };
    expect(e.data).toBeNull();
  });
});
```

- [ ] **Step 3: Update `Agent` contract**

In `libs/chat/src/lib/agent/agent.ts`:

Replace this import:
```ts
import type { AgentCustomEvent } from './agent-custom-event';
```

with:
```ts
import type { AgentEvent } from './agent-event';
```

Inside the `Agent` interface, replace:
```ts
  customEvents$?: Observable<AgentCustomEvent>;
```

with:
```ts
  events$: Observable<AgentEvent>;
```

Remove the `customEvents$ are optional` paragraph from the class docstring; replace with a one-liner noting the no-duplication invariant:

```ts
/**
 * ...existing top of comment...
 *
 * Invariant: state lives on signals; `events$` carries only things that
 * are not derivable from signals.
 */
```

- [ ] **Step 4: Update `agent/index.ts`**

Replace:
```ts
export type { AgentCustomEvent } from './agent-custom-event';
```

with:
```ts
export type {
  AgentEvent,
  AgentStateUpdateEvent,
  AgentCustomEvent,
} from './agent-event';
```

- [ ] **Step 5: Update `public-api.ts`**

In the `export type { ... } from './lib/agent'` block, replace `AgentCustomEvent` with `AgentEvent, AgentStateUpdateEvent, AgentCustomEvent`. (The new structured `AgentCustomEvent` reuses the symbol name; the old free-form one is gone.)

- [ ] **Step 6: Update `mock-agent.ts`**

In `libs/chat/src/lib/testing/mock-agent.ts`:

Update imports:
```ts
import { EMPTY, type Observable } from 'rxjs';
import type {
  Agent, Message, AgentStatus, ToolCall,
  AgentInterrupt, Subagent, AgentSubmitInput, AgentSubmitOptions,
  AgentCheckpoint,
  AgentEvent,
} from '../agent';
```
(Drop the standalone `import type { AgentCustomEvent } from '../agent/agent-custom-event';` line if present.)

In `MockAgent` interface: replace `customEvents$?: Observable<AgentCustomEvent>;` with no field — but the actual returned object has `events$` (required). The `MockAgent` interface should declare:
```ts
  events$: Observable<AgentEvent>;
```

In `MockAgentOptions`: replace `customEvents$?: Observable<AgentCustomEvent>;` with `events$?: Observable<AgentEvent>;`.

In the function body, replace the customEvents$ spread with:
```ts
    events$: opts.events$ ?? EMPTY,
```
in the returned object (no longer conditional).

- [ ] **Step 7: Update `mock-agent.spec.ts`**

Find any references to `customEvents$` in tests; rename to `events$`. The shape of test data may need adjusting if specs construct `AgentCustomEvent`-shaped events; switch to the structured variants:
```ts
const evt: AgentEvent = { type: 'custom', name: 'foo', data: 1 };
```

- [ ] **Step 8: Update `agent-conformance.ts`**

Replace the conditional block:
```ts
it('if customEvents$ is present, it is an Observable-like with .subscribe', () => {
  const agent = factory();
  if (agent.customEvents$ !== undefined) {
    expect(typeof agent.customEvents$.subscribe).toBe('function');
  } else {
    expect(agent.customEvents$).toBeUndefined();
  }
});
```

with:
```ts
it('events$ is an Observable-like with .subscribe', () => {
  const agent = factory();
  expect(typeof agent.events$.subscribe).toBe('function');
});
```

If `agent-conformance.spec.ts` (the meta-test of the conformance helper) references `customEvents$`, update analogously.

- [ ] **Step 9: Update `chat.component.ts`**

Find the existing constructor effect that subscribes to `agent.customEvents$` (lines ~272–301). Replace the entire effect with:

```ts
constructor() {
  // Route state_update events from the agent to the render state store
  // so components bound to $state paths reactively update.
  effect(() => {
    if (this.eventsSubscribed) return;
    let agent: ReturnType<typeof this.agent>;
    try {
      agent = this.agent();
    } catch {
      // Required input not yet available — skip; effect will retry.
      return;
    }
    this.eventsSubscribed = true;
    agent.events$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event.type !== 'state_update') return;
      const store = this.resolvedStore();
      if (!store) return;
      store.update(event.data);
    });
  });

  // ...auto-scroll effect unchanged...
}
```

(Rename the private flag `customEventsSubscribed` → `eventsSubscribed` for consistency.)

- [ ] **Step 10: Update `chat.component.spec.ts`**

Find any test fixture that constructs a fake agent or supplies `customEvents$`; rename to `events$`. Adjust event payloads to the structured shape.

- [ ] **Step 11: Run chat lint + test + build**

```bash
npx nx run-many -t lint,test,build -p chat
```

Expected: PASS. (Pre-existing `vitest` peer-dep warning is OK.)

If failures:
- "Property 'customEvents$' does not exist on type 'Agent'" — missed find/replace in a spec or component.
- "Type 'AgentCustomEvent' has no exported member 'X'" — old import path `./agent-custom-event`; switch to `./agent-event`.

Fix and re-run before committing.

- [ ] **Step 12: Commit**

```bash
git add libs/chat/
git commit -m "feat(chat): require events\$ on Agent contract with structured AgentEvent union

Replaces optional customEvents\$: Observable<AgentCustomEvent> with
required events\$: Observable<AgentEvent>. AgentEvent discriminates
state_update from generic custom events. Codifies invariant: state on
signals, events on events\$, no duplication.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Update LangGraph adapter to emit `AgentEvent`

**Files:**
- Modify: `libs/langgraph/src/lib/to-agent.ts`
- Modify: `libs/langgraph/src/lib/to-agent.spec.ts`
- Modify: `libs/langgraph/src/lib/to-agent.conformance.spec.ts` (only if it references `customEvents$`)

- [ ] **Step 1: Write a failing test**

Add to `libs/langgraph/src/lib/to-agent.spec.ts` inside the existing describe block:

```ts
it('translates a state_update CustomStreamEvent into AgentStateUpdateEvent', async () => {
  TestBed.runInInjectionContext(() => {
    const customEvents = signal<any[]>([]);
    const ref = stubAgentRef({ customEvents } as any);
    const chat = toAgent(ref);

    const received: any[] = [];
    chat.events$.subscribe((e) => received.push(e));

    customEvents.set([{ name: 'state_update', data: { count: 1 } }]);
    TestBed.flushEffects();

    expect(received).toEqual([{ type: 'state_update', data: { count: 1 } }]);
  });
});

it('wraps non-state_update CustomStreamEvent as AgentCustomEvent', async () => {
  TestBed.runInInjectionContext(() => {
    const customEvents = signal<any[]>([]);
    const ref = stubAgentRef({ customEvents } as any);
    const chat = toAgent(ref);

    const received: any[] = [];
    chat.events$.subscribe((e) => received.push(e));

    customEvents.set([{ name: 'tick', data: 42 }]);
    TestBed.flushEffects();

    expect(received).toEqual([{ type: 'custom', name: 'tick', data: 42 }]);
  });
});
```

- [ ] **Step 2: Run; expect FAIL**

```bash
npx nx test langgraph --testNamePattern="state_update CustomStreamEvent|non-state_update CustomStreamEvent"
```
Expected: FAIL (`events$ is not defined` or current implementation emits the old free-form shape).

- [ ] **Step 3: Update `to-agent.ts`**

In imports:
```ts
import type {
  Agent, AgentWithHistory, AgentCheckpoint, AgentEvent,
  Message, Role, ToolCall, ToolCallStatus, AgentStatus,
  AgentInterrupt, Subagent, AgentSubmitInput, AgentSubmitOptions,
} from '@cacheplane/chat';
```
(Drop `AgentCustomEvent` from the import block; it's now subsumed by `AgentEvent`.)

In `toAgent()`'s body, rename:
```ts
const events$ = buildEvents$(ref);
```
(was: `customEvents$ = buildCustomEvents$(ref)`.)

In the returned object, replace `customEvents$` with `events$`.

Replace the helper function:

```ts
function buildEvents$(
  ref: AgentRef<unknown, any>,
): Observable<AgentEvent> {
  const subject = new Subject<AgentEvent>();
  let seen = 0;
  effect(() => {
    const all = ref.customEvents();
    if (all.length < seen) seen = 0;
    for (let i = seen; i < all.length; i++) {
      subject.next(toAgentEvent(all[i]));
    }
    seen = all.length;
  });
  return subject.asObservable();
}

function toAgentEvent(e: CustomStreamEvent): AgentEvent {
  if (e.name === 'state_update' && isRecord(e.data)) {
    return { type: 'state_update', data: e.data };
  }
  return { type: 'custom', name: e.name, data: e.data };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
```

(Remove the old `toCustomEvent` helper.)

- [ ] **Step 4: Run; expect PASS**

```bash
npx nx test langgraph --testNamePattern="state_update CustomStreamEvent|non-state_update CustomStreamEvent"
```

- [ ] **Step 5: Update `to-agent.conformance.spec.ts` if needed**

Run:
```bash
rg "customEvents\\\$" libs/langgraph/src/lib/to-agent.conformance.spec.ts
```

If matches, update to `events$` and adjust the minimal-ref fixture to provide an Observable. The minimal stub returns `agent.events$` from `toAgent(ref)`, so it should already work — but re-verify by running the conformance suite.

- [ ] **Step 6: Run full langgraph lint + test + build**

```bash
npx nx run-many -t lint,test,build -p langgraph
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/langgraph/
git commit -m "feat(langgraph): translate CustomStreamEvents into structured AgentEvent

toAgent(ref) now emits events\$: Observable<AgentEvent>. Translates
state_update events into AgentStateUpdateEvent (with data: Record),
all others into the structured AgentCustomEvent escape hatch.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Final verification, push, PR

- [ ] **Step 1: Verify no stale references**

```bash
rg "customEvents\\\$" libs/ cockpit/
```
Expected: zero hits.

```bash
rg "from '\\./agent-custom-event'" libs/
```
Expected: zero hits.

- [ ] **Step 2: Full lint/test/build**

```bash
npx nx run-many -t lint,test,build -p chat,langgraph
npx nx affected -t build --base=origin/main
```
Expected: all pass.

- [ ] **Step 3: Push**

```bash
git push -u origin feat/agent-events-contract
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "feat(chat): require events\$ on Agent contract with structured AgentEvent union" --body "$(cat <<'EOF'
## Summary
- Replaces optional `customEvents\$: Observable<AgentCustomEvent>` (free-form) with required `events\$: Observable<AgentEvent>` (structured discriminated union).
- `AgentEvent = AgentStateUpdateEvent | AgentCustomEvent`. The `state_update` variant is type-narrowed; `custom` is the escape hatch carrying `{ name, data }`.
- LangGraph adapter translates `CustomStreamEvent` → `AgentEvent`, discriminating `state_update` when `data` is a Record.
- Codifies invariant: state on signals, events on events\$, no duplication.

## Test Plan
- [x] \`nx run-many -t lint,test,build -p chat,langgraph\` passes
- [x] \`nx affected -t build\` passes
- [x] No residual \`customEvents\$\` references
- [ ] Cockpit demos still render (no consumers of \`customEvents\$\` outside chat.component.ts)

## Design + plan
- Spec: \`docs/superpowers/specs/2026-04-25-events-on-agent-contract-design.md\`
- Plan: \`docs/superpowers/plans/2026-04-25-events-on-agent-contract.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of Scope

- Backwards-compat alias `customEvents$` on `Agent`.
- Replay/snapshot semantics for late `events$` subscribers.
- Renaming `state_update` to a chat-library-specific name.
- Adding new well-known event types beyond `state_update` and `custom`.
