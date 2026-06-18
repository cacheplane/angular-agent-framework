# Render view/ask streaming lifecycle — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Subagents follow superpowers:test-driven-development.

**Goal:** Fix the client-tools view/ask streaming-lifecycle errors (NG0950 mount-before-args, NG0953 emit-on-teardown) via a targeted `libs/render` refactor — registry preserves the full entry behind a unified `getEntry`, readiness becomes a pure `isElementReady` policy, and the event emit is destroy-safe.

**Architecture:** All changes in `libs/render`. (1) `AngularRegistry` exposes `getEntry(name): NormalizedEntry | undefined` (preserving `component/fallback/schema/description`) instead of parallel `get`/`getFallback`. (2) A pure `isElementReady(entry, resolvedProps)` module replaces the ad-hoc undefined-prop heuristic in `RenderElementComponent.notReady`, adding sync Standard-Schema validation as the readiness gate. (3) A destroyed-guard in `RenderSpecComponent.emitTapped` (the single event tap point) + `RenderElementComponent.host.*`. No backwards compatibility; no `libs/chat`/consumer/demo changes.

**Tech Stack:** Angular 21 (signals, `input.required`, `computed`, `DestroyRef`), `@nx/vitest`, json-render, Standard Schema (vendored, types-only).

---

## Spec

`docs/superpowers/specs/2026-06-17-client-tools-view-ask-streaming-lifecycle-design.md`

## Background the engineer needs

- `RenderElementComponent` (`libs/render/src/lib/render-element.component.ts`) renders one json-render element. It chooses **real component vs. fallback skeleton** via a `notReady` computed, with a monotonic `mountedReal` latch (once real mounts, never reverts). It reads the registry off `RENDER_CONTEXT` (`this.ctx.registry`).
- `chat-tool-views` (libs/chat) wraps a streaming tool call into a synthetic one-element spec with `props: { ...args, ...result, status }` and renders it through `RenderSpecComponent` → `RenderElementComponent`. While streaming, `args` is often `{}`, so a view component's `input.required()` field is **absent** → NG0950. Today `notReady` only catches *undefined-valued* props, so the real component mounts anyway.
- `define-angular-registry.ts` normalizes entries to `{ component, fallback }` — it **drops `schema`/`description`** today (the root reason a readiness gate has nothing to read).
- The NG0953 `OutputRef` is `RenderSpecComponent.events`, emitted only through `emitTapped` (the single tap point). `libs/chat` components only forward it.
- **Standard Schema** (`libs/render/src/lib/standard-schema.ts`) is types-only; its `~standard.validate(value)` may return a result OR a Promise. Render is synchronous, so we only gate on sync results.
- The render lib tests with vitest: `npx nx test render`. Existing specs: `render-element.component.spec.ts`, `default-fallback.component.spec.ts`, `contexts/render-host.spec.ts`. Example prod build gate (catches `strict:false` issues per repo convention): `npx nx build examples-ag-ui-angular`.

## File map (all under `libs/render/src/lib/`)

- `render.types.ts` — **modify**: export `NormalizedEntry`; change `AngularRegistry` to `{ getEntry(name): NormalizedEntry | undefined; names(): string[] }`; update the `RenderViewEntry.schema` doc comment (now enforced as a mount-readiness gate).
- `internals/element-readiness.ts` — **create**: pure `isElementReady(entry, resolvedProps)` + inline `isPromise`.
- `internals/element-readiness.spec.ts` — **create**: unit tests.
- `define-angular-registry.ts` — **modify**: `normalize` preserves `schema`/`description`; return `{ getEntry, names }`.
- `define-angular-registry.spec.ts` — **create** (if absent) or extend: `getEntry` tests.
- `render-element.component.ts` — **modify**: add an `entry` computed; route the 4 `get`/`getFallback` sites through it; `notReady` delegates to `isElementReady`; destroyed-guard on `host.*`.
- `render-spec.component.ts` — **modify**: empty-fallback registry literal → `{ getEntry: () => undefined, names: () => [] }`; destroyed-guard in `emitTapped`.

---

## Task 0: Branch

- [ ] **Step 1: Create the branch from latest main**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/quirky-haslett-d443a4
git fetch origin
git checkout -b claude/render-view-ask-lifecycle origin/main
```

---

## Task 1: Registry preserves the full entry behind `getEntry`

**Files:**
- Modify: `libs/render/src/lib/render.types.ts`
- Modify: `libs/render/src/lib/define-angular-registry.ts`
- Create: `libs/render/src/lib/define-angular-registry.spec.ts`
- Modify (compile fix, same task): `libs/render/src/lib/render-element.component.ts`, `libs/render/src/lib/render-spec.component.ts`

- [ ] **Step 1: Write the failing registry test**

Create `libs/render/src/lib/define-angular-registry.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { Component } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { defineAngularRegistry } from './define-angular-registry';
import { DefaultFallbackComponent } from './default-fallback.component';

@Component({ selector: 'x-real', standalone: true, template: '' })
class RealComponent {}
@Component({ selector: 'x-fallback', standalone: true, template: '' })
class CustomFallback {}

describe('defineAngularRegistry / getEntry', () => {
  it('preserves component, fallback, schema, and description for object entries', () => {
    const schema = z.object({ day: z.number() });
    const reg = defineAngularRegistry({
      card: { component: RealComponent, fallback: CustomFallback, schema, description: 'a card' },
    });
    const entry = reg.getEntry('card');
    expect(entry?.component).toBe(RealComponent);
    expect(entry?.fallback).toBe(CustomFallback);
    expect(entry?.schema).toBe(schema);
    expect(entry?.description).toBe('a card');
  });

  it('bare Type entries get the default fallback and no schema', () => {
    const reg = defineAngularRegistry({ plain: RealComponent });
    const entry = reg.getEntry('plain');
    expect(entry?.component).toBe(RealComponent);
    expect(entry?.fallback).toBe(DefaultFallbackComponent);
    expect(entry?.schema).toBeUndefined();
  });

  it('returns undefined for an unregistered name; names() lists keys', () => {
    const reg = defineAngularRegistry({ a: RealComponent });
    expect(reg.getEntry('missing')).toBeUndefined();
    expect(reg.names()).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx nx test render -- define-angular-registry`
Expected: FAIL — `getEntry` does not exist on the registry.

- [ ] **Step 3: Update the types**

In `libs/render/src/lib/render.types.ts`, export `NormalizedEntry` and replace the `AngularRegistry` accessors:

```ts
/** A fully-normalized registry entry: real component + a guaranteed fallback,
 * plus the optional props schema (mount-readiness gate) and description. */
export interface NormalizedEntry {
  component: Type<unknown>;
  fallback: Type<unknown>;
  schema?: StandardSchemaV1;
  description?: string;
}

export interface AngularRegistry {
  /** The full normalized entry for a registered name, or undefined. The single
   * accessor — component, fallback, schema, and description all hang off it. */
  getEntry(name: string): NormalizedEntry | undefined;
  names(): string[];
}
```

Also update the `RenderViewEntry.schema` doc comment — replace *"Carried + exposed by the render lib but NOT enforced on mount"* with:

```ts
  /** Optional props contract (Zod/Valibot/ArkType via Standard Schema).
   * Enforced as a MOUNT-READINESS GATE: while a streaming tool call's props
   * do not yet validate against this schema, the element's fallback is shown
   * instead of the real component (sync validation only). Also used by
   * client-tools to advertise the component to a model. */
  schema?: StandardSchemaV1;
```

- [ ] **Step 4: Update `define-angular-registry.ts`**

Replace the file's `NormalizedEntry`/`normalize`/return with the entry-preserving form:

```ts
// SPDX-License-Identifier: MIT
import { Type } from '@angular/core';
import type { AngularRegistry, NormalizedEntry, RenderViewEntry } from './render.types';
import { DefaultFallbackComponent } from './default-fallback.component';

type RegistryInput = Record<string, Type<unknown> | RenderViewEntry>;

function normalize(entry: Type<unknown> | RenderViewEntry): NormalizedEntry {
  // Bare Type — register with the default fallback, no schema/description.
  if (typeof entry === 'function') {
    return { component: entry, fallback: DefaultFallbackComponent };
  }
  // Object form — preserve everything; default the fallback.
  return {
    component: entry.component,
    fallback: entry.fallback ?? DefaultFallbackComponent,
    schema: entry.schema,
    description: entry.description,
  };
}

export function defineAngularRegistry(componentMap: RegistryInput): AngularRegistry {
  const map = new Map<string, NormalizedEntry>();
  for (const [name, entry] of Object.entries(componentMap)) {
    map.set(name, normalize(entry));
  }
  return {
    getEntry: (name: string) => map.get(name),
    names: () => [...map.keys()],
  };
}
```

- [ ] **Step 5: Update the `libs/render` call sites (compile fix)**

In `render-element.component.ts`, add an `entry` computed near the other computeds and route the four `get`/`getFallback` reads through it:

```ts
/** The normalized registry entry for this element's type (component, fallback,
 * schema). Single source for all registry reads in this component. */
readonly entry = computed<NormalizedEntry | undefined>(() => {
  const el = this.element();
  return el ? this.ctx.registry.getEntry(el.type) : undefined;
});
```
Then:
- constructor effect (was `!this.notReady() && this.ctx.registry.get(el.type)`) → `if (!this.notReady() && this.entry()?.component)`
- `componentClass` (was `this.ctx.registry.get(el.type) ?? null`) → `return this.entry()?.component ?? null;`
- `mountClass`: `const real = this.entry()?.component ?? null;` and the fallback branch `return this.entry()?.fallback ?? null;`

Add `NormalizedEntry` to the `render.types` import. In `render-spec.component.ts`, change the empty-fallback literal:

```ts
// was: return { get: () => undefined, getFallback: () => undefined, names: () => [] };
return { getEntry: () => undefined, names: () => [] };
```

- [ ] **Step 6: Scan for any other `AngularRegistry` mock using `get`/`getFallback`**

Run: `grep -rn "getFallback\|registry.get\b" libs/render/src libs/chat/src | grep -v "templateRegistry\|Map<"`
Fix any test/mocks that construct an `AngularRegistry` with `get`/`getFallback` to use `getEntry` (return `{ component, fallback }` shaped entries). Map-based `.get` (chat-tool-calls) is unrelated — leave it.

- [ ] **Step 7: Run registry test + full render suite**

Run: `npx nx test render --skip-nx-cache`
Expected: the new `define-angular-registry` tests PASS; all existing render tests PASS (behavior unchanged — `getEntry` returns the same component/fallback the old accessors did).

- [ ] **Step 8: Commit**

```bash
git add libs/render/src/lib/render.types.ts libs/render/src/lib/define-angular-registry.ts libs/render/src/lib/define-angular-registry.spec.ts libs/render/src/lib/render-element.component.ts libs/render/src/lib/render-spec.component.ts
git commit -m "refactor(render): registry exposes getEntry (preserve schema/description); drop get/getFallback"
```

---

## Task 2: Pure `isElementReady` readiness policy

**Files:**
- Create: `libs/render/src/lib/internals/element-readiness.ts`
- Create: `libs/render/src/lib/internals/element-readiness.spec.ts`

- [ ] **Step 1: Write the failing readiness tests**

Create `libs/render/src/lib/internals/element-readiness.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { isElementReady } from './element-readiness';
import type { NormalizedEntry } from '../render.types';

const C = (() => {}) as never; // stand-in component Type for entries
const entry = (over: Partial<NormalizedEntry> = {}): NormalizedEntry =>
  ({ component: C, fallback: C, ...over });

describe('isElementReady', () => {
  it('ready when no schema and no undefined props', () => {
    expect(isElementReady(entry(), { a: 1, b: 'x' })).toBe(true);
  });

  it('not ready when any prop value is undefined (json-render state binding loading)', () => {
    expect(isElementReady(entry(), { a: 1, b: undefined })).toBe(false);
  });

  it('not ready while a sync schema does not validate (required keys absent during streaming)', () => {
    const schema = z.object({ day: z.number(), places: z.array(z.string()) });
    expect(isElementReady(entry({ schema }), { status: 'running' })).toBe(false);
    expect(isElementReady(entry({ schema }), { day: 2 })).toBe(false);
  });

  it('ready once a sync schema validates (extra status/result keys are ignored by non-strict object)', () => {
    const schema = z.object({ day: z.number(), places: z.array(z.string()) });
    expect(
      isElementReady(entry({ schema }), { day: 2, places: ['Eiffel'], status: 'complete', result: {} }),
    ).toBe(true);
  });

  it('ready when there is no schema regardless of which keys are present', () => {
    expect(isElementReady(entry(), { anything: true })).toBe(true);
  });

  it('ready (not gated) when the schema validates asynchronously (Promise result)', () => {
    const asyncSchema = {
      '~standard': { version: 1 as const, vendor: 'test', validate: () => Promise.resolve({ issues: [{ message: 'x' }] }) },
    };
    expect(isElementReady(entry({ schema: asyncSchema as never }), {})).toBe(true);
  });

  it('treats an undefined entry as having no schema (ready unless undefined props)', () => {
    expect(isElementReady(undefined, { a: 1 })).toBe(true);
    expect(isElementReady(undefined, { a: undefined })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx nx test render -- element-readiness`
Expected: FAIL — cannot find `./element-readiness`.

- [ ] **Step 3: Implement `element-readiness.ts`**

Create `libs/render/src/lib/internals/element-readiness.ts`:

```ts
// SPDX-License-Identifier: MIT
import type { NormalizedEntry } from '../render.types';

function isPromise(v: unknown): v is Promise<unknown> {
  return typeof (v as { then?: unknown } | null)?.then === 'function';
}

/**
 * Decide whether the REAL component may mount, or the fallback skeleton should
 * show. Pure (no Angular, no signals) so it is trivially unit-testable.
 *
 *  - Any undefined-valued prop → pending (a json-render state binding is still
 *    loading).
 *  - A schema-declared contract → pending until the (possibly streaming) props
 *    validate against it. SYNC validation only: render is synchronous, so an
 *    async (Promise) validate result cannot gate a sync mount and is treated as
 *    ready. View schemas should therefore be synchronous (Zod is).
 */
export function isElementReady(
  entry: NormalizedEntry | undefined,
  resolvedProps: Record<string, unknown>,
): boolean {
  for (const v of Object.values(resolvedProps)) {
    if (v === undefined) return false;
  }
  const schema = entry?.schema;
  if (schema) {
    const out = schema['~standard'].validate(resolvedProps);
    if (!isPromise(out) && out.issues !== undefined) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx nx test render -- element-readiness`
Expected: PASS (all 7 cases).

- [ ] **Step 5: Commit**

```bash
git add libs/render/src/lib/internals/element-readiness.ts libs/render/src/lib/internals/element-readiness.spec.ts
git commit -m "feat(render): pure isElementReady readiness policy (undefined-prop + sync schema gate)"
```

---

## Task 3: Wire `isElementReady` into `RenderElementComponent.notReady`

**Files:**
- Modify: `libs/render/src/lib/render-element.component.ts`
- Modify: `libs/render/src/lib/render-element.component.spec.ts`

- [ ] **Step 1: Write the failing component test**

Add to `libs/render/src/lib/render-element.component.spec.ts` (follow the file's existing harness for mounting `RenderSpecComponent`/`RenderElementComponent` with a registry + spec; mirror an existing test's setup). The test renders an element whose registry entry has a schema and asserts fallback-while-invalid → real-once-valid:

```ts
it('shows the fallback while streamed props fail the schema, then mounts the real component', async () => {
  // Registry: a view with a required schema + a distinguishable fallback.
  const schema = z.object({ day: z.number(), places: z.array(z.string()) });
  const registry = defineAngularRegistry({
    day_card: { component: DayCardStub, fallback: FallbackStub, schema },
  });

  // 1) streaming: props lack required keys → fallback mounted, no NG0950 thrown.
  const fixture = renderElement({ registry, props: { status: 'running' } }); // helper per existing spec
  expect(fixture.nativeElement.querySelector('fallback-stub')).toBeTruthy();
  expect(fixture.nativeElement.querySelector('day-card-stub')).toBeNull();

  // 2) args complete → real component mounts and latches.
  fixture.updateProps({ day: 2, places: ['Eiffel'], status: 'complete' });
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('day-card-stub')).toBeTruthy();
});
```

> NOTE to implementer: the exact harness (`renderElement`/`updateProps`) must match what `render-element.component.spec.ts` already uses to drive `notReady` with state-bound props — reuse that helper rather than inventing one. `DayCardStub` declares `day = input.required<number>()` to prove no NG0950; `FallbackStub` is a trivial standalone component with selector `fallback-stub`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx nx test render -- render-element`
Expected: FAIL — today the real `DayCardStub` mounts immediately (and its required input throws), so the fallback assertion fails / an NG0950 surfaces.

- [ ] **Step 3: Delegate `notReady` to `isElementReady`**

In `render-element.component.ts`, import `isElementReady` and replace the `notReady` body (keep the `mountedReal` latch):

```ts
import { isElementReady } from './internals/element-readiness';

readonly notReady = computed<boolean>(() => {
  if (this.mountedReal()) return false;
  const el = this.element();
  if (!el || !el.props) return false;
  const resolved = resolveElementProps(el.props, this.propCtx());
  return !isElementReady(this.entry(), resolved);
});
```

(Removes the inline `for (const v of resolved) …` loop — that logic now lives in `isElementReady`, which also applies the schema gate.)

- [ ] **Step 4: Run it to verify it passes**

Run: `npx nx test render -- render-element`
Expected: PASS — fallback while invalid, real component after, no NG0950.

- [ ] **Step 5: Commit**

```bash
git add libs/render/src/lib/render-element.component.ts libs/render/src/lib/render-element.component.spec.ts
git commit -m "fix(render): gate element mount on isElementReady (schema-aware) — fixes NG0950 for view tools"
```

---

## Task 4: Destroy-safe event emission

**Files:**
- Modify: `libs/render/src/lib/render-spec.component.ts`
- Modify: `libs/render/src/lib/render-element.component.ts`
- Modify: `libs/render/src/lib/render-spec.component.spec.ts` (or create if absent)

- [ ] **Step 1: Write the failing test**

Add to `render-spec.component.spec.ts` (mirror its existing harness for mounting `RenderSpecComponent` and capturing `(events)`):

```ts
it('does not emit events after the component is destroyed (NG0953 guard)', () => {
  const events: RenderEvent[] = [];
  const fixture = renderSpec({ /* spec + registry per existing harness */ });
  fixture.componentInstance.events.subscribe((e) => events.push(e));
  fixture.destroy();
  // Simulate a late emit from a torn-down child (e.g. an ask result resolving
  // during teardown). emitTapped must no-op rather than hit a destroyed OutputRef.
  expect(() => fixture.componentInstance['emitEvent']({ type: 'result', value: 1, elementKey: 'x' }))
    .not.toThrow();
  const before = events.length;
  expect(events.length).toBe(before); // no event delivered post-destroy
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx nx test render -- render-spec`
Expected: FAIL — `emitEvent` after destroy still calls `this.events.emit`, throwing/emitting on a destroyed `OutputRef`.

- [ ] **Step 3: Guard `emitTapped` in `render-spec.component.ts`**

Add a destroyed flag set in the existing `destroyRef.onDestroy` and short-circuit `emitTapped`:

```ts
private destroyed = false;
// in constructor, alongside the existing onDestroy lifecycle emit:
this.destroyRef.onDestroy(() => { this.destroyed = true; });

private readonly emitTapped = (event: RenderEvent): void => {
  if (this.destroyed) return;   // NG0953: never emit on a destroyed OutputRef
  this.events.emit(event);
  if (!this.lifecycle) return;
  // …unchanged switch…
};
```

> Ordering note: set `this.destroyed = true` in an `onDestroy` registered BEFORE the existing one that emits the `spec` `destroyed` lifecycle event — otherwise that final emit would be suppressed. Simplest: emit the `destroyed` lifecycle event directly via `this.events.emit(...)` in that handler (bypassing the guard) OR register the destroyed-flag handler last and keep the lifecycle emit first. Implement so the `spec` `destroyed` lifecycle event still fires exactly once.

- [ ] **Step 4: Guard `host.*` in `render-element.component.ts`**

Add a destroyed flag (the component already injects `DestroyRef`) and guard the host methods:

```ts
private destroyed = false;
// in the existing constructor destroyRef.onDestroy:
this.destroyRef.onDestroy(() => { this.destroyed = true; /* …existing lifecycle emit… */ });

readonly host: RenderHost = {
  set: (path, value) => { if (this.destroyed) return; this.ctx.store?.set(path, value); },
  emit: (event, payload) => { if (this.destroyed) return; this.invokeHandlers(event, payload); },
  result: (value) => { if (this.destroyed) return; this.ctx.emitEvent?.({ type: 'result', value, elementKey: this.elementKey() }); },
};
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx nx test render -- render-spec render-element`
Expected: PASS — no emit/throw post-destroy; existing event tests still green.

- [ ] **Step 6: Commit**

```bash
git add libs/render/src/lib/render-spec.component.ts libs/render/src/lib/render-element.component.ts libs/render/src/lib/render-spec.component.spec.ts
git commit -m "fix(render): destroy-safe event emission (emitTapped + host.*) — fixes NG0953 on ask teardown"
```

---

## Task 5: Full verification (suite + lint + example build + chat)

- [ ] **Step 1: Render lib green**

Run: `npx nx test render --skip-nx-cache && npx nx lint render && npx nx build render`
Expected: all PASS, 0 lint errors.

- [ ] **Step 2: Downstream consumers compile (no API break leaked)**

Run: `npx nx test chat --skip-nx-cache && npx nx build chat`
Expected: PASS — `@threadplane/chat` consumes the render registry; confirms the `getEntry` change didn't leak.

- [ ] **Step 3: Example prod build (strict:false gate)**

Run: `npx nx build examples-ag-ui-angular`
Expected: PASS — catches `strict:false` union-narrowing issues the unit tests can't (repo convention: always build one example before claiming a lib change green).

- [ ] **Step 4: Commit (only if any fix was needed)**

```bash
git add -A && git commit -m "chore(render): downstream + example build green"
```
(If nothing changed, skip.)

---

## Task 6: Live-LLM smoke (controller-run, manual gate)

> Not a subagent step — the executing controller drives Chrome (per the standing live-smoke gate). The published-stack audit's D3 flow is the regression signal.

- [ ] **Step 1: Serve examples/ag-ui** (python backend `:8000` with `OPENAI_API_KEY` + `AG_UI_INTERNAL_TOKEN=''`, angular `:4201`), open `http://localhost:4201/`.
- [ ] **Step 2: Drive the `day_card` view path** ("Add the Colosseum to day 2 of my trip"). Assert: a fallback skeleton appears during streaming, the day card renders with correct props, and **the console shows ZERO `NG0950`** during the streamed render.
- [ ] **Step 3: Drive an `ask` resolve** (consent-gated clear, or a cockpit client-tools `confirm_booking`) → Confirm/Cancel. Assert **ZERO `NG0953`** on resolve + freeze.
- [ ] **Step 4:** Record the result in the PR.

---

## Task 7: Open PR

- [ ] **Step 1: Push + PR**

```bash
git push -u origin claude/render-view-ask-lifecycle
gh pr create --base main --head claude/render-view-ask-lifecycle \
  --title "fix(render): view/ask streaming lifecycle — schema-readiness gate + destroy-safe emit" \
  --body "Fixes the client-tools view/ask lifecycle errors found in the live audit (NG0950 mount-before-args; NG0953 emit-on-teardown), via a libs/render refactor: registry preserves the full entry behind getEntry; readiness extracted to a pure isElementReady policy (sync Standard-Schema gate); destroy-safe emit at the single emitTapped tap point. No backwards compat; no libs/chat/consumer/demo changes. Spec: docs/superpowers/specs/2026-06-17-client-tools-view-ask-streaming-lifecycle-design.md.

Verified: render unit suite (incl. new isElementReady + getEntry + gate + destroy-guard tests), lint, render/chat builds, examples-ag-ui-angular prod build, and a live-LLM smoke (day_card streams a skeleton→card with zero NG0950; ask resolve/freeze with zero NG0953).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr merge --squash --auto claude/render-view-ask-lifecycle
```

---

## Self-review

- **Spec coverage:** registry getEntry/entry-preservation (Task 1) ✓; pure isElementReady incl. undefined/sync-schema/async/extra-keys (Task 2) ✓; notReady delegation + fallback-then-real (Task 3, fixes NG0950) ✓; destroy-safe emit at emitTapped + host (Task 4, fixes NG0953) ✓; back-compat for schemaless/async (covered by isElementReady tests) ✓; testing (unit + example build + live smoke) ✓; "no libs/chat change" honored (only Map-based chat-tool-calls `.get`, left alone) ✓; out-of-scope cleanups not touched ✓.
- **Placeholders:** the only soft spot is the test harness in Tasks 3/4 (`renderElement`/`renderSpec`/`updateProps`) — explicitly instructed to reuse the existing spec files' harness rather than invent one, because those helpers already exist and vary; the assertions and component stubs are concrete.
- **Type consistency:** `NormalizedEntry` (exported from render.types) is the single entry type used by `getEntry`, `isElementReady`, and the `entry` computed. `getEntry(name): NormalizedEntry | undefined` is consistent across registry, render-element, render-spec. `isElementReady(entry, resolvedProps): boolean` matches its call site.
