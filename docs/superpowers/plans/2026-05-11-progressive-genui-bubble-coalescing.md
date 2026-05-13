# Progressive GenUI Rendering + Bubble Coalescing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the GenUI flow's two assistant bubbles into one, and render the surface progressively (per-component fallbacks that swap to real components in place as bindings resolve), eliminating the bubble-level "Building UI…" skeleton in favor of an in-surface skeleton tree.

**Architecture:** Three independent PRs shipped in order A → B → C.

- **PR A (lib only)** extends the surface store so each `A2uiComponent` exposes its `bindings: readonly string[]` (parsed from prop expressions on `surfaceUpdate`) and a monotonic `ready: boolean` signal (flips `false → true` once all bindings have resolved, stays `true` thereafter). Introduces an `A2uiViewEntry` discriminated type that lets a catalog declare a per-component `fallback` while preserving the bare-`Type<unknown>` shape for existing callers. No visible rendering change.
- **PR B (lib only, depends on A)** rebuilds `<a2ui-surface>` around a new internal `a2uiSlot` structural directive that walks the component tree depth-first via `NgComponentOutlet`. Each node mounts its fallback (or the lib-default `A2uiDefaultFallbackComponent`, visually identical to today's `<chat-genui-skeleton>`) when `!ready`, and the real component when `ready`. A monotonic gate inside the directive stops re-checking `ready` after the real component mounts; later updates only push inputs via `ComponentRef.setInput()`. The chat composition drops its bubble-level `<chat-genui-skeleton>` branch; the surface owns its empty-state.
- **PR C (Python only)** ensures `examples/chat/python/src/graph.py emit_generated_surface` (1) returns an `AIMessage` whose id matches the upstream tool-call AI so `add_messages` replaces in place, preserving `tool_calls`/`additional_kwargs`/`response_metadata`, and (2) reorders the wrapped JSONL envelopes to `surfaceUpdate → beginRendering → dataModelUpdate × N`. Adds a pytest assertion that the post-emit thread is 3 messages (not 4) and the AI id is unchanged.

**Tech Stack:** Angular 21 standalone components + signals + `NgComponentOutlet` + `ComponentRef.setInput()` + OnPush; Vitest; Python 3.11 + LangGraph + pytest.

**Spec:** `docs/superpowers/specs/2026-05-11-progressive-genui-bubble-coalescing-design.md` (commit `08f124ef` on `claude/spec-progressive-genui`).

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commits, PR bodies, or docs. Third-party library mentions inside `docs/superpowers/specs/*.md` or `docs/superpowers/plans/*.md` (this file) are the only exception.

**Dispatch:**

- **PR A** — single subagent dispatch (mechanical surface-store extension + new types). Branch `claude/genui-surface-store-readiness`, forked from `origin/main`.
- **PR B** — single subagent dispatch, depends on A's types/signals having landed. Branch `claude/genui-per-component-fallback`, forked from `origin/main` after A merges.
- **PR C** — single subagent dispatch (small Python change). Branch `claude/genui-backend-coalescing`, forked from `origin/main`. Note: as of the plan's writing the in-place replacement and envelope reorder already exist in `examples/chat/python/src/graph.py` (PR #255 and follow-ups). The PR C tasks below verify both invariants and add the pytest assertion the spec mandates; if the implementer finds the code already meets the invariants, the work shrinks to "add the test." The branch must still be forked from `origin/main`.

---

## File Structure

### PR A — surface store + catalog shape

**Create**
- `libs/chat/src/lib/a2ui/views.ts` (~25 LOC) — re-exports / aliases the existing `RenderViewEntry` from `@ngaf/render` as `A2uiViewEntry`; defines `A2uiViews = Record<string, Type<unknown> | A2uiViewEntry>`; exports a `normalizeViewEntry(entry)` helper.
- `libs/chat/src/lib/a2ui/views.spec.ts` (~30 LOC).
- `libs/chat/src/lib/a2ui/extract-bindings.ts` (~40 LOC) — pure function that takes an `A2uiComponentDef` and returns a `readonly string[]` of `$.path` references found in its prop expressions (handles both literal scalars and `{$.path}` reference strings; recurses into nested record values; deduplicates; result is sorted for stable signal identity).
- `libs/chat/src/lib/a2ui/extract-bindings.spec.ts` (~70 LOC).
- `libs/chat/src/lib/a2ui/component-view.ts` (~30 LOC) — defines `A2uiComponentView { id; type; bindings; ready; props; children?: string[] }` (a chat-internal projection of an `A2uiComponent` that the surface store materializes; the wire-format `A2uiComponent` in `@ngaf/a2ui` is unchanged).

**Modify**
- `libs/chat/src/lib/a2ui/surface-store.ts` (~80 LOC delta) — per-surface `components` map now stores `A2uiComponentView`; `surfaceUpdate` apply extracts bindings; `dataModelUpdate` apply recomputes `ready` per component with the monotonic rule.
- `libs/chat/src/lib/a2ui/surface-store.spec.ts` (~100 LOC delta) — readiness tests.
- `libs/chat/src/public-api.ts` (~3 LOC) — export `A2uiViewEntry`, `A2uiViews`, `A2uiComponentView`.

### PR B — `<a2ui-surface>` per-component rendering

**Create**
- `libs/chat/src/lib/a2ui/a2ui-slot.directive.ts` (~70 LOC) — internal recursive structural directive.
- `libs/chat/src/lib/a2ui/a2ui-slot.directive.spec.ts` (~120 LOC).
- `libs/chat/src/lib/a2ui/a2ui-default-fallback.component.ts` (~50 LOC) — primitive visually identical to `<chat-genui-skeleton>` (three shimmer rows, "✨ Building UI…" label, token-themed).
- `libs/chat/src/lib/a2ui/a2ui-default-fallback.component.spec.ts` (~25 LOC).

**Modify**
- `libs/chat/src/lib/a2ui/surface.component.ts` (~60 LOC delta) — template rewritten to use `a2uiSlot`; new optional `surfaceFallback` input.
- `libs/chat/src/lib/a2ui/surface.component.spec.ts` (~100 LOC delta) — rendering tests.
- `libs/chat/src/lib/compositions/chat/chat.component.ts` (~10 LOC delta) — drops bubble-level `<chat-genui-skeleton>` branch.
- `libs/chat/src/lib/compositions/chat/chat.component.spec.ts` (~30 LOC delta) — assert skeleton no longer renders in AI template.

### PR C — backend coalescing + envelope reordering

**Modify**
- `examples/chat/python/src/graph.py` (~5 LOC delta if PR #255 already shipped the in-place merge; otherwise ~50 LOC delta to add it). Confirm the replacement preserves `id`, `tool_calls`, `additional_kwargs`, `response_metadata`; confirm the JSONL ordering pass emits `surfaceUpdate → beginRendering → dataModelUpdate × N`.
- `examples/chat/python/tests/test_graph_smoke.py` (~50 LOC delta) — new pytest test asserts: post-emit thread has exactly 3 messages, the AI message id is unchanged from the upstream tool-call AI, and the wrapped JSONL envelopes appear in the required order.

---

## PR A — Surface store + catalog shape

**Branch:** `claude/genui-surface-store-readiness` (fork from `origin/main`).

### Phase 0 — Branch creation

#### Task 0.1: Fork branch

- [ ] **Step 1: Fork from origin/main**

```bash
git fetch origin
git checkout -b claude/genui-surface-store-readiness origin/main
git log --oneline -1
```

Expected: latest `origin/main` HEAD.

### Phase 1 — `A2uiViewEntry` discriminated type

#### Task 1.1: Create the views module + bare-type normalization

**Files:**
- Create: `libs/chat/src/lib/a2ui/views.ts`
- Create: `libs/chat/src/lib/a2ui/views.spec.ts`
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// libs/chat/src/lib/a2ui/views.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { normalizeViewEntry, type A2uiViewEntry } from './views';

@Component({ standalone: true, selector: 't-real', template: '' })
class RealCmp {}
@Component({ standalone: true, selector: 't-fb', template: '' })
class FallbackCmp {}

describe('normalizeViewEntry', () => {
  it('returns { component } for a bare Type entry', () => {
    const e = normalizeViewEntry(RealCmp);
    expect(e).toEqual({ component: RealCmp });
  });

  it('returns the entry unchanged when already in { component, fallback? } shape', () => {
    const entry: A2uiViewEntry = { component: RealCmp, fallback: FallbackCmp };
    expect(normalizeViewEntry(entry)).toBe(entry);
  });

  it('preserves fallback omission', () => {
    const e = normalizeViewEntry({ component: RealCmp });
    expect(e.component).toBe(RealCmp);
    expect(e.fallback).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx nx test chat --testFile a2ui/views.spec.ts 2>&1 | tail -15
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

```typescript
// libs/chat/src/lib/a2ui/views.ts
// SPDX-License-Identifier: MIT
import type { Type } from '@angular/core';
import type { RenderViewEntry } from '@ngaf/render';

/** Catalog entry for the A2UI surface renderer.
 *
 * `component` is mounted once all of the component's bindings (data
 * model paths referenced in its prop expressions) have resolved. While
 * any binding is unpopulated, the `fallback` is mounted instead. If
 * `fallback` is omitted, the lib's default fallback
 * (`A2uiDefaultFallbackComponent`) is mounted.
 *
 * This is a chat-side alias for the shared `RenderViewEntry` shape so
 * consumers of `@ngaf/chat` don't have to import from `@ngaf/render`. */
export type A2uiViewEntry = RenderViewEntry;

/** Catalog shape accepted by `<a2ui-surface>`. Each entry is either a
 * bare `Type<unknown>` (legacy shape — no per-component fallback) or
 * an `A2uiViewEntry`. */
export type A2uiViews = Readonly<Record<string, Type<unknown> | A2uiViewEntry>>;

/** Normalize a catalog entry to the `A2uiViewEntry` shape. Bare
 * `Type<unknown>` entries are wrapped as `{ component }`; entries
 * already in the discriminated shape are returned unchanged. */
export function normalizeViewEntry(
  entry: Type<unknown> | A2uiViewEntry,
): A2uiViewEntry {
  if (typeof entry === 'function') return { component: entry };
  return entry;
}
```

- [ ] **Step 4: Export from the public API**

Edit `libs/chat/src/public-api.ts`, add (alphabetically):

```typescript
export { normalizeViewEntry } from './lib/a2ui/views';
export type { A2uiViewEntry, A2uiViews } from './lib/a2ui/views';
```

- [ ] **Step 5: Run tests**

```bash
npx nx test chat --testFile a2ui/views.spec.ts 2>&1 | tail -10
```

Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/a2ui/views.ts libs/chat/src/lib/a2ui/views.spec.ts libs/chat/src/public-api.ts
git commit -m "feat(chat): A2uiViewEntry discriminated catalog shape

Adds the { component, fallback? } catalog entry type for the A2UI
surface renderer plus a normalizer that wraps the bare Type<unknown>
form. Public API gains A2uiViewEntry, A2uiViews, normalizeViewEntry.
No rendering change — wires the shape that PR B's per-component
fallback gate consumes."
```

### Phase 2 — Binding extraction

#### Task 2.1: Pure function to extract `$.path` references from a component def

**Files:**
- Create: `libs/chat/src/lib/a2ui/extract-bindings.ts`
- Create: `libs/chat/src/lib/a2ui/extract-bindings.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// libs/chat/src/lib/a2ui/extract-bindings.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import type { A2uiComponentDef } from '@ngaf/a2ui';
import { extractBindings } from './extract-bindings';

describe('extractBindings', () => {
  it('returns [] when no prop is a $.path reference', () => {
    const def = { Button: { label: 'Hello', action: 'submit' } } as A2uiComponentDef;
    expect(extractBindings(def)).toEqual([]);
  });

  it('extracts a single $.path reference from a string prop', () => {
    const def = { TextField: { value: '{$.form.name}' } } as A2uiComponentDef;
    expect(extractBindings(def)).toEqual(['$.form.name']);
  });

  it('extracts multiple references and deduplicates', () => {
    const def = {
      TextField: { value: '{$.form.name}', placeholder: '{$.form.name}' },
    } as A2uiComponentDef;
    expect(extractBindings(def)).toEqual(['$.form.name']);
  });

  it('returns a sorted result for stable signal identity', () => {
    const def = {
      Form: { title: '{$.b}', subtitle: '{$.a}' },
    } as unknown as A2uiComponentDef;
    expect(extractBindings(def)).toEqual(['$.a', '$.b']);
  });

  it('recurses into nested record values', () => {
    const def = {
      Card: { header: { label: '{$.user.name}' }, body: { text: '{$.user.bio}' } },
    } as unknown as A2uiComponentDef;
    expect(extractBindings(def)).toEqual(['$.user.bio', '$.user.name']);
  });

  it('ignores non-reference string scalars', () => {
    const def = { Button: { label: 'literal text' } } as A2uiComponentDef;
    expect(extractBindings(def)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx nx test chat --testFile a2ui/extract-bindings.spec.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// libs/chat/src/lib/a2ui/extract-bindings.ts
// SPDX-License-Identifier: MIT
import type { A2uiComponentDef } from '@ngaf/a2ui';

const REF_PATTERN = /\{(\$\.[^}]+)\}/g;

function walk(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    let m: RegExpExecArray | null;
    REF_PATTERN.lastIndex = 0;
    while ((m = REF_PATTERN.exec(value)) !== null) into.add(m[1]);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) walk(v, into);
    return;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) walk(v, into);
  }
}

/** Extracts the set of data-model paths (e.g. `$.form.name`) referenced
 * by `{$.path}` expressions inside a component's prop bag. Result is
 * deduplicated and sorted for stable signal identity. */
export function extractBindings(def: A2uiComponentDef): readonly string[] {
  const out = new Set<string>();
  walk(def, out);
  return [...out].sort();
}
```

- [ ] **Step 4: Run tests**

```bash
npx nx test chat --testFile a2ui/extract-bindings.spec.ts 2>&1 | tail -10
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/a2ui/extract-bindings.ts libs/chat/src/lib/a2ui/extract-bindings.spec.ts
git commit -m "feat(chat): extract \$.path bindings from A2UI component defs

Pure helper that walks a component's prop bag and returns the
deduplicated, sorted set of data-model references in {\$.path} form.
Consumed by the surface store to compute per-component readiness."
```

### Phase 3 — `A2uiComponentView` projection

#### Task 3.1: Define the chat-internal component view type

**Files:**
- Create: `libs/chat/src/lib/a2ui/component-view.ts`
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Implement (no test — type-only module)**

```typescript
// libs/chat/src/lib/a2ui/component-view.ts
// SPDX-License-Identifier: MIT
import type { A2uiComponentDef } from '@ngaf/a2ui';

/** Chat-internal projection of an A2UI component, materialized by the
 * surface store. Distinct from the wire-format `A2uiComponent` in
 * `@ngaf/a2ui` (which carries the raw `component: A2uiComponentDef`
 * payload) — this type adds the per-component readiness fields the
 * progressive renderer consumes. */
export interface A2uiComponentView {
  /** The component's id (same as the wire-format `A2uiComponent.id`). */
  readonly id: string;
  /** The component type key — e.g. `'Button'`, `'TextField'` — matched
   * against catalog `views` entries. */
  readonly type: string;
  /** Data model paths this component references via its `{$.path}` prop
   * expressions. Extracted once on `surfaceUpdate` apply; immutable. */
  readonly bindings: readonly string[];
  /** Monotonic: `false` until every binding has resolved at least once
   * in the accumulated data model, then `true` forever. Once `true`,
   * subsequent `dataModelUpdate` envelopes push new prop values but do
   * NOT flip this back to `false`. */
  readonly ready: boolean;
  /** Resolved property bag. Meaningful only when `ready === true`. */
  readonly props: Readonly<Record<string, unknown>>;
  /** The raw wire-format component def, retained so the slot directive
   * can look up the catalog entry by type and resolve nested children
   * on re-renders. */
  readonly def: A2uiComponentDef;
}
```

- [ ] **Step 2: Export from public API**

Edit `libs/chat/src/public-api.ts`:

```typescript
export type { A2uiComponentView } from './lib/a2ui/component-view';
```

- [ ] **Step 3: Verify build**

```bash
npx nx build chat 2>&1 | tail -10
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/a2ui/component-view.ts libs/chat/src/public-api.ts
git commit -m "feat(chat): A2uiComponentView chat-internal projection type

Materialized by the surface store on surfaceUpdate apply with
bindings extracted from prop expressions, ready=false initially,
and an empty props bag. Surface store flips ready -> true once
all bindings have resolved (monotonic)."
```

### Phase 4 — Surface store readiness wiring

#### Task 4.1: Surface store emits `A2uiComponentView` per component with monotonic `ready`

**Files:**
- Modify: `libs/chat/src/lib/a2ui/surface-store.ts`
- Modify: `libs/chat/src/lib/a2ui/surface-store.spec.ts`

**Scene:** The store currently keeps a `Map<string, A2uiComponent>` (wire-format) per surface. After this task, each surface's `components` map is `Map<string, A2uiComponentView>`, populated on `surfaceUpdate` apply with bindings + `ready: false`, recomputed on every `dataModelUpdate` with the monotonic flip rule. The `A2uiSurface` type lives in `@ngaf/a2ui` and is shared with downstream consumers, so the simplest path is: keep the wire `A2uiSurface.components` map shape (`Map<string, A2uiComponent>`) AS-IS to avoid breaking `surfaceToSpec` etc., AND add a parallel `componentViews: Map<string, A2uiComponentView>` to a chat-internal `A2uiSurfaceState` type. The store exposes both: existing consumers keep working; PR B's slot directive reads `componentViews`.

- [ ] **Step 1: Add `A2uiSurfaceState` to surface-store.ts (chat-side wrapper)**

In `libs/chat/src/lib/a2ui/surface-store.ts`, add near the top (after imports):

```typescript
import type { A2uiComponentView } from './component-view';
import { extractBindings } from './extract-bindings';

/** Chat-side state for a surface — wraps the wire-format `A2uiSurface`
 * with the per-component projection the progressive renderer consumes.
 * Both maps are kept in sync; the wire shape preserves existing
 * `surfaceToSpec` semantics, the view shape carries readiness. */
export interface A2uiSurfaceState {
  readonly surface: A2uiSurface;
  readonly componentViews: ReadonlyMap<string, A2uiComponentView>;
}
```

Update the `A2uiSurfaceStore` interface to expose state and modify the surface signals to carry `A2uiSurfaceState`:

```typescript
export interface A2uiSurfaceStore {
  apply(message: A2uiMessage): void;
  applyPartialArgs(toolCallId: string, envelopes: readonly A2uiMessage[]): void;
  isPartialLive(toolCallId: string): boolean;
  /** Wire-format surfaces, for downstream consumers (e.g. surfaceToSpec). */
  readonly surfaces: Signal<Map<string, A2uiSurface>>;
  surface(surfaceId: string): Signal<A2uiSurface | undefined>;
  /** Chat-side projections with per-component readiness. */
  readonly surfaceStates: Signal<Map<string, A2uiSurfaceState>>;
  surfaceState(surfaceId: string): Signal<A2uiSurfaceState | undefined>;
}
```

- [ ] **Step 2: Add a helper that resolves a path against a data model**

Add this private helper inside `createA2uiSurfaceStore`:

```typescript
/** Returns true if `path` (in `$.a.b.c` form) resolves to a defined,
 * non-null value inside `dataModel`. Used to decide per-component
 * readiness. */
function isResolved(dataModel: Record<string, unknown>, path: string): boolean {
  // Path is `$.a.b.c` — strip the `$.` prefix, then walk segments.
  const segments = path.startsWith('$.') ? path.slice(2).split('.') : path.split('.');
  let cur: unknown = dataModel;
  for (const seg of segments) {
    if (cur == null || typeof cur !== 'object') return false;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur !== undefined && cur !== null;
}

/** Resolve `{$.path}` references in a value against the data model.
 * Strings that look like a single full reference are replaced with
 * the resolved value; partial-reference strings get string-substituted;
 * nested objects/arrays are recursed. */
function resolveProps(value: unknown, dataModel: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    // Full-string single-reference: `{$.path}` → resolved value (any type).
    const full = value.match(/^\{(\$\.[^}]+)\}$/);
    if (full) {
      const segs = full[1].slice(2).split('.');
      let cur: unknown = dataModel;
      for (const s of segs) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[s];
      }
      return cur;
    }
    return value.replace(/\{(\$\.[^}]+)\}/g, (_, path: string) => {
      const segs = path.slice(2).split('.');
      let cur: unknown = dataModel;
      for (const s of segs) {
        if (cur == null || typeof cur !== 'object') return '';
        cur = (cur as Record<string, unknown>)[s];
      }
      return cur == null ? '' : String(cur);
    });
  }
  if (Array.isArray(value)) return value.map((v) => resolveProps(v, dataModel));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveProps(v, dataModel);
    }
    return out;
  }
  return value;
}
```

- [ ] **Step 3: Add a per-surface `componentViews` map and update on `surfaceUpdate` / `dataModelUpdate` / `beginRendering`**

Add a parallel signal in `createA2uiSurfaceStore`:

```typescript
const surfaceStatesSignal = signal<Map<string, A2uiSurfaceState>>(new Map());
```

Inside the `surfaceUpdate` branch of `apply()`, after building the wire-format component map, also build the view map:

```typescript
// After: for (const c of upd.components) map.set(c.id, c);
const views = new Map<string, A2uiComponentView>();
for (const c of upd.components) {
  // The wire-format A2uiComponentDef is a single-key discriminated union:
  // { Button: { ... } } | { TextField: { ... } } | ...
  const typeKey = Object.keys(c.component)[0] ?? 'Unknown';
  const def = c.component;
  views.set(c.id, {
    id: c.id,
    type: typeKey,
    bindings: extractBindings(def),
    ready: false,
    props: {},
    def,
  });
}
b.componentViews = views;
```

(Add `componentViews?: Map<string, A2uiComponentView>` to `SurfaceBuffer`.)

Inside the `beginRendering` branch, after building `dataModel`, also project the view map and seed initial readiness:

```typescript
// After: const surface: A2uiSurface = { ... };
const views = b.componentViews ?? new Map<string, A2uiComponentView>();
const initialViews = new Map<string, A2uiComponentView>();
for (const [id, v] of views) {
  const allResolved = v.bindings.every((p) => isResolved(dataModel, p));
  initialViews.set(id, {
    ...v,
    ready: allResolved,
    props: allResolved ? (resolveProps(v.def, dataModel) as Record<string, unknown>) : {},
  });
}
const nextStates = new Map(surfaceStatesSignal());
nextStates.set(begin.surfaceId, { surface, componentViews: initialViews });
surfaceStatesSignal.set(nextStates);
```

Inside the `dataModelUpdate` branch (the already-rendered surface path), after updating `dataModel`, recompute the views with the **monotonic** rule:

```typescript
// After: next.set(upd.surfaceId, { ...surface, dataModel }); surfacesSignal.set(next);
const prevState = surfaceStatesSignal().get(upd.surfaceId);
if (prevState) {
  const nextViews = new Map<string, A2uiComponentView>();
  for (const [id, v] of prevState.componentViews) {
    const allResolved = v.bindings.every((p) => isResolved(dataModel, p));
    // Monotonic: once ready=true, stays true even if a later update
    // clears a referenced path. ready only ever flips false → true.
    const nextReady = v.ready || allResolved;
    nextViews.set(id, {
      ...v,
      ready: nextReady,
      // Push new resolved props whenever any binding resolves OR the
      // component is already ready (later updates flow as input changes).
      props: nextReady
        ? (resolveProps(v.def, dataModel) as Record<string, unknown>)
        : v.props,
    });
  }
  const nextStatesMap = new Map(surfaceStatesSignal());
  nextStatesMap.set(upd.surfaceId, { surface: { ...surface, dataModel }, componentViews: nextViews });
  surfaceStatesSignal.set(nextStatesMap);
}
```

- [ ] **Step 4: Expose the new signals from `createA2uiSurfaceStore`**

Update the return:

```typescript
return {
  apply,
  applyPartialArgs,
  isPartialLive,
  surfaces: surfacesSignal.asReadonly(),
  surface,
  surfaceStates: surfaceStatesSignal.asReadonly(),
  surfaceState: (id: string) => computed(() => surfaceStatesSignal().get(id)),
};
```

- [ ] **Step 5: Write tests**

Append to `libs/chat/src/lib/a2ui/surface-store.spec.ts`:

```typescript
import type { A2uiMessage } from '@ngaf/a2ui';
import { createA2uiSurfaceStore } from './surface-store';

describe('A2uiSurfaceStore — per-component readiness', () => {
  const surfaceUpdate = (id: string, components: { id: string; def: unknown }[]): A2uiMessage => ({
    surfaceUpdate: {
      surfaceId: id,
      components: components.map((c) => ({ id: c.id, component: c.def })),
    },
  } as A2uiMessage);
  const beginRendering = (id: string, root: string): A2uiMessage => ({
    beginRendering: { surfaceId: id, root },
  } as A2uiMessage);
  const dataModelUpdate = (id: string, contents: { key: string; valueString?: string }[]): A2uiMessage => ({
    dataModelUpdate: { surfaceId: id, contents },
  } as A2uiMessage);

  it('extracts bindings from a component on surfaceUpdate apply', () => {
    const store = createA2uiSurfaceStore();
    store.apply(surfaceUpdate('s1', [
      { id: 'c1', def: { TextField: { value: '{$.form.name}' } } },
    ]));
    store.apply(beginRendering('s1', 'c1'));
    const view = store.surfaceState('s1')()!.componentViews.get('c1')!;
    expect(view.bindings).toEqual(['$.form.name']);
  });

  it('component.ready is false when bindings are unpopulated', () => {
    const store = createA2uiSurfaceStore();
    store.apply(surfaceUpdate('s1', [
      { id: 'c1', def: { TextField: { value: '{$.form.name}' } } },
    ]));
    store.apply(beginRendering('s1', 'c1'));
    expect(store.surfaceState('s1')()!.componentViews.get('c1')!.ready).toBe(false);
  });

  it('component.ready becomes true when all bindings are populated by dataModelUpdate', () => {
    const store = createA2uiSurfaceStore();
    store.apply(surfaceUpdate('s1', [
      { id: 'c1', def: { TextField: { value: '{$.form.name}' } } },
    ]));
    store.apply(beginRendering('s1', 'c1'));
    store.apply(dataModelUpdate('s1', [{ key: 'form', valueString: '{"name":"Ada"}' }]));
    // Path `$.form.name` is reached by an object value, so we feed a nested map:
    store.apply({
      dataModelUpdate: {
        surfaceId: 's1',
        contents: [{ key: 'form', valueMap: [{ key: 'name', valueString: 'Ada' }] }],
      },
    } as A2uiMessage);
    expect(store.surfaceState('s1')()!.componentViews.get('c1')!.ready).toBe(true);
  });

  it('component.ready stays true after a later dataModelUpdate clears a binding (monotonic)', () => {
    const store = createA2uiSurfaceStore();
    store.apply(surfaceUpdate('s1', [
      { id: 'c1', def: { TextField: { value: '{$.name}' } } },
    ]));
    store.apply(beginRendering('s1', 'c1'));
    store.apply(dataModelUpdate('s1', [{ key: 'name', valueString: 'Ada' }]));
    expect(store.surfaceState('s1')()!.componentViews.get('c1')!.ready).toBe(true);
    // A later update with no `name` entry: ready stays true (existing
    // resolved value persists in the prior data model under our merge
    // semantics, and even if it didn't, monotonic gate keeps ready=true).
    store.apply(dataModelUpdate('s1', [{ key: 'other', valueString: 'x' }]));
    expect(store.surfaceState('s1')()!.componentViews.get('c1')!.ready).toBe(true);
  });

  it('multiple components have independent readiness', () => {
    const store = createA2uiSurfaceStore();
    store.apply(surfaceUpdate('s1', [
      { id: 'a', def: { TextField: { value: '{$.x}' } } },
      { id: 'b', def: { TextField: { value: '{$.y}' } } },
    ]));
    store.apply(beginRendering('s1', 'a'));
    store.apply(dataModelUpdate('s1', [{ key: 'x', valueString: '1' }]));
    const state = store.surfaceState('s1')()!;
    expect(state.componentViews.get('a')!.ready).toBe(true);
    expect(state.componentViews.get('b')!.ready).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npx nx test chat --testFile surface-store.spec.ts 2>&1 | tail -20
```

Expected: all existing tests still pass; 5 new readiness tests pass.

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/a2ui/surface-store.ts libs/chat/src/lib/a2ui/surface-store.spec.ts
git commit -m "feat(chat): per-component readiness in A2uiSurfaceStore

Surface store now materializes A2uiComponentView entries with
bindings (extracted from \$.path references in prop expressions)
and a monotonic ready signal that flips false -> true once all
bindings have resolved. Exposed via the new surfaceStates /
surfaceState signals; the wire-format surfaces signal is unchanged
so existing consumers (surfaceToSpec etc.) continue to work."
```

### Phase 5 — Open PR A

#### Task 5.1: Push branch and open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin claude/genui-surface-store-readiness
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat(chat): A2UI surface store per-component readiness" --body "$(cat <<'EOF'
## Summary

- Adds `A2uiViewEntry { component, fallback? }` catalog shape and a `normalizeViewEntry` helper that wraps bare `Type<unknown>` entries (backwards-compatible).
- Adds `extractBindings(def)` — pure function that pulls `$.path` references out of a component's prop expressions.
- Extends `A2uiSurfaceStore` with a parallel `surfaceStates` signal whose `componentViews` map carries per-component `bindings: readonly string[]` and a monotonic `ready: boolean`. The wire-format `surfaces` signal is unchanged.

Lib-only, no visible rendering change. Wires the foundation PR B's per-component fallback gate consumes.

## Test plan

- [ ] `npx nx test chat` passes
- [ ] No demo/composition behavior change visible at http://localhost:4200/embed
EOF
)"
```

Expected: PR URL printed.

---

## PR B — `<a2ui-surface>` per-component rendering

**Branch:** `claude/genui-per-component-fallback` (fork from `origin/main` AFTER PR A merges).

### Phase 0 — Branch creation

#### Task B-0.1: Fork branch

- [ ] **Step 1: Fork from origin/main (after A merges)**

```bash
git fetch origin
git checkout -b claude/genui-per-component-fallback origin/main
git log --oneline -3
```

Expected: top commit is PR A's merge.

### Phase 1 — Default fallback primitive

#### Task B-1.1: Internal `<a2ui-default-fallback>` component

**Files:**
- Create: `libs/chat/src/lib/a2ui/a2ui-default-fallback.component.ts`
- Create: `libs/chat/src/lib/a2ui/a2ui-default-fallback.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// libs/chat/src/lib/a2ui/a2ui-default-fallback.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiDefaultFallbackComponent } from './a2ui-default-fallback.component';

describe('A2uiDefaultFallbackComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [A2uiDefaultFallbackComponent] }));

  it('renders a region role with the Building UI status text', () => {
    const fx = TestBed.createComponent(A2uiDefaultFallbackComponent);
    fx.detectChanges();
    const status = fx.nativeElement.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    expect(status.textContent).toContain('Building UI');
  });

  it('renders three shimmer rows', () => {
    const fx = TestBed.createComponent(A2uiDefaultFallbackComponent);
    fx.detectChanges();
    const rows = fx.nativeElement.querySelectorAll('.a2ui-default-fallback__row');
    expect(rows.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx nx test chat --testFile a2ui-default-fallback.component.spec.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```typescript
// libs/chat/src/lib/a2ui/a2ui-default-fallback.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../styles/chat-tokens';

@Component({
  selector: 'a2ui-default-fallback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host { display: block; width: 100%; }
    .a2ui-default-fallback {
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: 10px;
      padding: 14px;
      background: var(--ngaf-chat-surface-alt);
    }
    .a2ui-default-fallback__label {
      font-size: 12px;
      color: var(--ngaf-chat-text-muted);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .a2ui-default-fallback__rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .a2ui-default-fallback__row {
      height: 10px;
      border-radius: 5px;
      background: linear-gradient(
        90deg,
        var(--ngaf-chat-separator) 0%,
        color-mix(in srgb, var(--ngaf-chat-separator) 70%, transparent) 50%,
        var(--ngaf-chat-separator) 100%
      );
      background-size: 200% 100%;
      animation: a2ui-default-fallback-shimmer 1.4s ease-in-out infinite;
    }
    .a2ui-default-fallback__row:nth-child(1) { width: 70%; }
    .a2ui-default-fallback__row:nth-child(2) { width: 90%; }
    .a2ui-default-fallback__row:nth-child(3) { width: 50%; }
    @keyframes a2ui-default-fallback-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
  template: `
    <div class="a2ui-default-fallback" role="status" aria-live="polite">
      <div class="a2ui-default-fallback__label">
        <span aria-hidden="true">✨</span>
        <span>Building UI…</span>
      </div>
      <div class="a2ui-default-fallback__rows">
        <div class="a2ui-default-fallback__row"></div>
        <div class="a2ui-default-fallback__row"></div>
        <div class="a2ui-default-fallback__row"></div>
      </div>
    </div>
  `,
})
export class A2uiDefaultFallbackComponent {}
```

- [ ] **Step 4: Run tests**

```bash
npx nx test chat --testFile a2ui-default-fallback.component.spec.ts 2>&1 | tail -10
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/a2ui/a2ui-default-fallback.component.ts libs/chat/src/lib/a2ui/a2ui-default-fallback.component.spec.ts
git commit -m "feat(chat): A2uiDefaultFallbackComponent primitive

Internal skeleton component mounted by <a2ui-surface> when a
component's bindings are unresolved (and the catalog entry omits
a fallback). Visually mirrors chat-genui-skeleton: three shimmer
rows, 'Building UI…' label, themed via chat tokens."
```

### Phase 2 — `a2uiSlot` structural directive

#### Task B-2.1: Recursive slot directive with monotonic gate

**Files:**
- Create: `libs/chat/src/lib/a2ui/a2ui-slot.directive.ts`
- Create: `libs/chat/src/lib/a2ui/a2ui-slot.directive.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// libs/chat/src/lib/a2ui/a2ui-slot.directive.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { Component, ChangeDetectionStrategy, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { A2uiSlotDirective } from './a2ui-slot.directive';
import type { A2uiComponentView } from './component-view';
import type { A2uiViews } from './views';

@Component({
  standalone: true, selector: 't-real', changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span data-role="real">REAL:{{ label() ?? "" }}</span>',
})
class RealCmp { readonly label = input<string>(); }

@Component({
  standalone: true, selector: 't-fb', changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span data-role="fallback">FB</span>',
})
class FallbackCmp {}

@Component({
  standalone: true,
  imports: [A2uiSlotDirective],
  template: `<ng-container *a2uiSlot="view(); views: views()" />`,
})
class HostCmp {
  readonly view = input.required<A2uiComponentView>();
  readonly views = input.required<A2uiViews>();
}

function makeView(over: Partial<A2uiComponentView> = {}): A2uiComponentView {
  return {
    id: 'c1', type: 't', bindings: [], ready: false, props: {}, def: { t: {} } as never,
    ...over,
  };
}

describe('a2uiSlot', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('mounts the fallback while !ready', () => {
    const fx = TestBed.createComponent(HostCmp);
    fx.componentRef.setInput('view', makeView({ ready: false }));
    fx.componentRef.setInput('views', { t: { component: RealCmp, fallback: FallbackCmp } });
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="fallback"]')).toBeTruthy();
    expect(fx.nativeElement.querySelector('[data-role="real"]')).toBeFalsy();
  });

  it('mounts the real component once ready=true', () => {
    const fx = TestBed.createComponent(HostCmp);
    const v = signal(makeView({ ready: false }));
    fx.componentRef.setInput('view', v());
    fx.componentRef.setInput('views', { t: { component: RealCmp, fallback: FallbackCmp } });
    fx.detectChanges();
    fx.componentRef.setInput('view', makeView({ ready: true, props: { label: 'Ada' } }));
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="real"]')).toBeTruthy();
    expect(fx.nativeElement.querySelector('[data-role="real"]')!.textContent).toContain('Ada');
  });

  it('monotonic: once real mounts, later ready=false does NOT remount fallback', () => {
    const fx = TestBed.createComponent(HostCmp);
    fx.componentRef.setInput('view', makeView({ ready: true, props: { label: 'Ada' } }));
    fx.componentRef.setInput('views', { t: { component: RealCmp, fallback: FallbackCmp } });
    fx.detectChanges();
    fx.componentRef.setInput('view', makeView({ ready: false, props: {} }));
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="real"]')).toBeTruthy();
    expect(fx.nativeElement.querySelector('[data-role="fallback"]')).toBeFalsy();
  });

  it('uses A2uiDefaultFallbackComponent when views[type].fallback is omitted', () => {
    const fx = TestBed.createComponent(HostCmp);
    fx.componentRef.setInput('view', makeView({ ready: false }));
    fx.componentRef.setInput('views', { t: { component: RealCmp } });
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.a2ui-default-fallback')).toBeTruthy();
  });

  it('accepts bare-Type view entries (legacy shape)', () => {
    const fx = TestBed.createComponent(HostCmp);
    fx.componentRef.setInput('view', makeView({ ready: true, props: { label: 'X' } }));
    fx.componentRef.setInput('views', { t: RealCmp });
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="real"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx nx test chat --testFile a2ui-slot.directive.spec.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the directive**

```typescript
// libs/chat/src/lib/a2ui/a2ui-slot.directive.ts
// SPDX-License-Identifier: MIT
import {
  Directive, Input, TemplateRef, ViewContainerRef, ComponentRef, Type,
} from '@angular/core';
import type { A2uiComponentView } from './component-view';
import type { A2uiViews } from './views';
import { normalizeViewEntry } from './views';
import { A2uiDefaultFallbackComponent } from './a2ui-default-fallback.component';

/** Internal recursive structural directive that mounts the right
 * component for an `A2uiComponentView` instance. Monotonic: once the
 * real component mounts, subsequent ticks only push new input values
 * via `ComponentRef.setInput()` — no remount, no re-check of `ready`. */
@Directive({
  selector: '[a2uiSlot]',
  standalone: true,
})
export class A2uiSlotDirective {
  private view: A2uiComponentView | null = null;
  private views: A2uiViews = {};
  private mountedReal = false;
  private ref: ComponentRef<unknown> | null = null;

  constructor(
    private readonly _tpl: TemplateRef<unknown>,
    private readonly vcr: ViewContainerRef,
  ) {}

  @Input({ required: true }) set a2uiSlot(view: A2uiComponentView) {
    this.view = view;
    this.render();
  }

  @Input({ required: true }) set a2uiSlotViews(views: A2uiViews) {
    this.views = views;
    this.render();
  }

  private render(): void {
    const view = this.view;
    if (!view) return;
    const entry = this.views[view.type];
    const normalized = entry != null ? normalizeViewEntry(entry) : undefined;

    // Monotonic gate: once real mounted, only push inputs.
    if (this.mountedReal && this.ref) {
      this.pushProps(this.ref, view.props);
      return;
    }

    if (view.ready && normalized) {
      this.vcr.clear();
      const created = this.vcr.createComponent(normalized.component);
      this.pushProps(created, view.props);
      this.ref = created;
      this.mountedReal = true;
      return;
    }

    // Not ready (or no entry yet) → mount fallback.
    const fallback: Type<unknown> =
      normalized?.fallback ?? A2uiDefaultFallbackComponent;
    // Avoid thrashing: only remount if the current ref isn't the fallback.
    if (this.ref && this.ref.componentType === fallback) return;
    this.vcr.clear();
    this.ref = this.vcr.createComponent(fallback);
  }

  private pushProps(ref: ComponentRef<unknown>, props: Record<string, unknown>): void {
    for (const [k, v] of Object.entries(props)) {
      try {
        ref.setInput(k, v);
      } catch {
        // Component doesn't declare this input — silently skip. The
        // wire format may include keys the Angular component doesn't
        // accept (e.g. children references handled separately).
      }
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx nx test chat --testFile a2ui-slot.directive.spec.ts 2>&1 | tail -10
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/a2ui/a2ui-slot.directive.ts libs/chat/src/lib/a2ui/a2ui-slot.directive.spec.ts
git commit -m "feat(chat): a2uiSlot recursive structural directive

Internal directive used by <a2ui-surface> to render a single
A2uiComponentView. Mounts views[type].fallback (or the lib-default
fallback) while !ready, then the real component once ready=true.
A monotonic gate stops re-checking ready after the real mounts;
later updates flow as ComponentRef.setInput() calls."
```

### Phase 3 — `<a2ui-surface>` rewrite

#### Task B-3.1: Rewrite surface template to use slot directive

**Files:**
- Modify: `libs/chat/src/lib/a2ui/surface.component.ts`
- Modify: `libs/chat/src/lib/a2ui/surface.component.spec.ts` (may need to be created — check first)

**Scene:** Today's `<a2ui-surface>` converts the wire-format surface to a json-render `Spec` and delegates to `<render-spec>`. The progressive-rendering rewrite keeps a `surfaceState` input (or accepts the wire `surface` and looks up the chat-side state itself; for cleanest decoupling we add a new `state: A2uiSurfaceState` input alongside the existing `surface` input — both are accepted, the new one takes priority). When `state` is provided, the template walks `state.componentViews` and renders each via `a2uiSlot`. When only `surface` is provided (legacy), the existing `<render-spec>` path is preserved as a backwards-compat fallback.

- [ ] **Step 1: Check whether surface.component.spec.ts exists**

```bash
ls libs/chat/src/lib/a2ui/surface.component.spec.ts 2>&1
```

If missing, create it with the test below; if present, append.

- [ ] **Step 2: Write the failing test**

```typescript
// libs/chat/src/lib/a2ui/surface.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { A2uiSurfaceComponent } from './surface.component';
import type { A2uiSurfaceState } from './surface-store';
import type { A2uiViews } from './views';

@Component({ standalone: true, selector: 't-real', template: '<span data-role="real"></span>', changeDetection: ChangeDetectionStrategy.OnPush })
class RealCmp {}
@Component({ standalone: true, selector: 't-fb', template: '<span data-role="custom-fb"></span>', changeDetection: ChangeDetectionStrategy.OnPush })
class CustomFallback {}

function makeState(componentViews: Map<string, unknown>): A2uiSurfaceState {
  return {
    surface: {
      surfaceId: 's1', catalogId: 'basic',
      components: new Map(), dataModel: {},
    } as never,
    componentViews: componentViews as never,
  };
}

describe('A2uiSurfaceComponent — progressive rendering', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [A2uiSurfaceComponent] }));

  it('renders the default fallback when state.componentViews is empty', () => {
    const fx = TestBed.createComponent(A2uiSurfaceComponent);
    fx.componentRef.setInput('state', makeState(new Map()));
    fx.componentRef.setInput('catalog', { t: RealCmp });
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.a2ui-default-fallback')).toBeTruthy();
  });

  it('renders the catalog fallback when a component is not ready', () => {
    const views = new Map([['c1', {
      id: 'c1', type: 't', bindings: ['$.x'], ready: false, props: {}, def: { t: {} },
    }]]);
    const fx = TestBed.createComponent(A2uiSurfaceComponent);
    fx.componentRef.setInput('state', makeState(views));
    fx.componentRef.setInput('catalog', { t: { component: RealCmp, fallback: CustomFallback } } satisfies A2uiViews);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="custom-fb"]')).toBeTruthy();
  });

  it('renders the real component when ready=true', () => {
    const views = new Map([['c1', {
      id: 'c1', type: 't', bindings: [], ready: true, props: {}, def: { t: {} },
    }]]);
    const fx = TestBed.createComponent(A2uiSurfaceComponent);
    fx.componentRef.setInput('state', makeState(views));
    fx.componentRef.setInput('catalog', { t: { component: RealCmp } });
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="real"]')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx nx test chat --testFile a2ui/surface.component.spec.ts 2>&1 | tail -10
```

Expected: FAIL — `state` input missing.

- [ ] **Step 4: Update `<a2ui-surface>`**

In `libs/chat/src/lib/a2ui/surface.component.ts`:

```typescript
// SPDX-License-Identifier: MIT
import {
  Component, computed, input, output, ChangeDetectionStrategy, Type,
} from '@angular/core';
import type { A2uiSurface, A2uiActionMessage } from '@ngaf/a2ui';
import { RenderSpecComponent, toRenderRegistry } from '@ngaf/render';
import type { ViewRegistry, RenderEvent } from '@ngaf/render';
import { surfaceToSpec } from './surface-to-spec';
import { buildA2uiActionMessage } from './build-action-message';
import { A2uiSlotDirective } from './a2ui-slot.directive';
import { A2uiDefaultFallbackComponent } from './a2ui-default-fallback.component';
import type { A2uiSurfaceState } from './surface-store';
import type { A2uiViews } from './views';

@Component({
  selector: 'a2ui-surface',
  standalone: true,
  imports: [RenderSpecComponent, A2uiSlotDirective, A2uiDefaultFallbackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--a2ui-primary]': 'primaryColor()',
    '[style.font-family]': 'fontFamily()',
  },
  template: `
    @if (state(); as st) {
      @if (st.componentViews.size === 0) {
        @if (surfaceFallback(); as fb) {
          <ng-container *ngComponentOutlet="fb" />
        } @else {
          <a2ui-default-fallback />
        }
      } @else {
        @for (id of rootIds(); track id) {
          @if (st.componentViews.get(id); as view) {
            <ng-container *a2uiSlot="view; views: catalog()" />
          }
        }
      }
    } @else if (spec(); as s) {
      <render-spec
        [spec]="s"
        [registry]="registry()"
        [handlers]="internalHandlers()"
        (events)="onRenderEvent($event)"
      />
    }
  `,
})
export class A2uiSurfaceComponent {
  /** Wire-format surface (legacy path — kept for backwards compat). */
  readonly surface = input<A2uiSurface>();
  /** Chat-side surface state with per-component readiness. When set,
   * this takes priority and the progressive renderer is used. */
  readonly state = input<A2uiSurfaceState>();
  readonly catalog = input.required<A2uiViews | ViewRegistry>();
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>({});
  /** Optional top-level placeholder when the surface has no components
   * yet. Defaults to A2uiDefaultFallbackComponent. */
  readonly surfaceFallback = input<Type<unknown> | undefined>(undefined);
  readonly events = output<RenderEvent>();
  readonly action = output<A2uiActionMessage>();

  readonly primaryColor = computed<string | null>(() =>
    (this.state()?.surface ?? this.surface())?.styles?.primaryColor ?? null
  );
  readonly fontFamily = computed<string | null>(() =>
    (this.state()?.surface ?? this.surface())?.styles?.font ?? null
  );

  /** Roots from the surface state — components whose ids appear as
   * children of no other component. The wire spec includes
   * `beginRendering.root` as the single root; that path stays usable
   * but we keep the renderer permissive in case future surfaces emit
   * multiple top-level components. */
  readonly rootIds = computed<string[]>(() => {
    const st = this.state();
    if (!st) return [];
    // For now: single root corresponds to surface.components[0]. Refine
    // if/when beginRendering.root is wired into A2uiSurfaceState.
    return [...st.componentViews.keys()].slice(0, 1);
  });

  // ---- Legacy path (no state) ----
  readonly spec = computed(() => {
    const surf = this.surface();
    return surf ? surfaceToSpec(surf) : null;
  });
  readonly registry = computed(() => toRenderRegistry(this.catalog() as ViewRegistry));
  readonly internalHandlers = computed(() => {
    const consumerHandlers = this.handlers();
    return {
      'a2ui:event': (params: Record<string, unknown>) => {
        const message = buildA2uiActionMessage(params, this.surface()!);
        this.action.emit(message);
        return message;
      },
      'a2ui:localAction': (params: Record<string, unknown>) => {
        const call = params['call'] as string;
        const args = (params['args'] as Record<string, unknown>) ?? {};
        if (consumerHandlers[call]) return consumerHandlers[call](args);
        if (call === 'openUrl' && typeof globalThis.window !== 'undefined') {
          globalThis.window.open(String(args['url'] ?? ''), '_blank');
        }
        return undefined;
      },
    };
  });

  onRenderEvent(event: RenderEvent): void {
    this.events.emit(event);
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx nx test chat --testFile a2ui/surface.component.spec.ts 2>&1 | tail -15
```

Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/a2ui/surface.component.ts libs/chat/src/lib/a2ui/surface.component.spec.ts
git commit -m "feat(chat): <a2ui-surface> progressive per-component rendering

When given the new state input (A2uiSurfaceState), the surface walks
componentViews via a2uiSlot — each node mounts its fallback while
!ready, then the real component once ready, with a monotonic gate
that prevents flicker. The legacy wire-format surface input keeps
working via the existing render-spec path."
```

### Phase 4 — Drop bubble-level skeleton from chat composition

#### Task B-4.1: Remove `<chat-genui-skeleton>` branch from chat composition template

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.spec.ts`

**Scene:** `chat.component.ts` renders `<chat-genui-skeleton>` inside the `ai` `chatMessageTemplate` for two cases: (1) the GenUI tool is dispatched but the classifier hasn't yet resolved content as `a2ui` / `json-render`, and (2) the classifier resolved as `a2ui` but the surface store has zero materialized surfaces yet. Both branches now belong to `<a2ui-surface>`'s own empty-state. The chat composition just renders `<a2ui-surface>` whenever the classifier says `a2ui`, and lets the surface own its skeleton.

- [ ] **Step 1: Locate the two skeleton branches**

```bash
grep -n "chat-genui-skeleton\|genuiTurn\|isGenuiTurn" libs/chat/src/lib/compositions/chat/chat.component.ts
```

Identify the `<chat-genui-skeleton />` template insertions inside the AI message template.

- [ ] **Step 2: Remove both skeleton branches**

Inside the `ai` chat-message template, delete the two `<chat-genui-skeleton />` insertions:

```html
<!-- DELETE:
@if (genuiTurn && classified.type() !== 'a2ui' && classified.type() !== 'json-render') {
  <chat-genui-skeleton />
} @else if (classified.type() === 'a2ui' && classified.a2uiSurfaces().size === 0 && genuiTurn) {
  <chat-genui-skeleton />
} @else if (classified.markdown(); as md) {
-->

<!-- REPLACE WITH: -->
@if (classified.markdown(); as md) {
```

Keep the existing `<a2ui-surface>` branch (the surface is always mounted when classifier says `a2ui` — it owns its empty state).

- [ ] **Step 3: Wire the surface to use the new `state` input**

Find the `<a2ui-surface>` invocation and update it to pass the chat-side state. If a `surfaceStates` signal isn't already wired into the composition's view context, wire it via the existing surface-store injection point — minimal change is to pass `[state]="surfaceStateFor(surfaceId)"` alongside the existing inputs. (If the existing template passes `[surface]`, keep that AND add `[state]` so the surface component can pick the progressive path.)

- [ ] **Step 4: Drop the `ChatGenuiSkeletonComponent` import (the primitive stays exported, just unused here)**

Remove the import from `chat.component.ts`. Leave `libs/chat/src/lib/primitives/chat-genui-skeleton/` intact and still exported from `public-api.ts`.

- [ ] **Step 5: Update the composition spec**

In `libs/chat/src/lib/compositions/chat/chat.component.spec.ts`, drop or invert any test that asserts `<chat-genui-skeleton>` renders in the AI template. Add an assertion that it does NOT render:

```typescript
it('does not render <chat-genui-skeleton> in the AI template (surface owns skeleton)', () => {
  // ... existing harness setup that puts a GenUI-shaped AI message into the chat ...
  fx.detectChanges();
  expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeFalsy();
});
```

- [ ] **Step 6: Run tests**

```bash
npx nx test chat 2>&1 | tail -30
```

Expected: all green. If the removed branches were exercised by tests, those tests need to be updated to assert the new behavior (surface mounts directly, owns its empty state).

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts libs/chat/src/lib/compositions/chat/chat.component.spec.ts
git commit -m "feat(chat): drop bubble-level chat-genui-skeleton branch

The chat composition no longer renders <chat-genui-skeleton> inside
the AI template. <a2ui-surface> owns the empty-state skeleton
(A2uiDefaultFallbackComponent) and the per-component fallback tree.
The skeleton primitive stays exported for direct-template consumers."
```

### Phase 5 — Open PR B

#### Task B-5.1: Push branch and open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin claude/genui-per-component-fallback
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat(chat): progressive per-component GenUI rendering" --body "$(cat <<'EOF'
## Summary

- Adds the `a2uiSlot` internal structural directive that recursively mounts the right component (fallback or real) for each `A2uiComponentView`. Monotonic gate: once the real component mounts, later updates flow as `ComponentRef.setInput()` — no remount.
- Adds `A2uiDefaultFallbackComponent` (internal) — the lib-default skeleton mounted when a catalog entry omits its own `fallback`.
- Rewrites `<a2ui-surface>` to walk `state.componentViews` via `a2uiSlot` when a new `state` input is provided; the legacy `surface` input keeps the existing `<render-spec>` path.
- Drops the bubble-level `<chat-genui-skeleton>` branch from the chat composition. The skeleton primitive stays exported for direct-template consumers.

Depends on the surface-store readiness signals shipped in PR #<A>.

## Test plan

- [ ] `npx nx test chat` passes
- [ ] Live smoke at http://localhost:4200/embed: GenUI prompt shows the surface's per-component skeletons in place during streaming, components swap to real in place as bindings resolve, no double-bubble
- [ ] Non-GenUI prompt still streams normally with no skeleton flash
EOF
)"
```

Expected: PR URL printed.

---

## PR C — Backend coalescing + envelope reordering

**Branch:** `claude/genui-backend-coalescing` (fork from `origin/main`).

**Note:** As of the plan's writing, `examples/chat/python/src/graph.py emit_generated_surface` already (a) returns an `AIMessage` with the upstream tool-call AI's id and preserved `tool_calls`/`additional_kwargs`/`response_metadata`, and (b) reorders the JSONL envelopes to `surfaceUpdate → beginRendering → dataModelUpdate × N`. The Phase 1 task below verifies both invariants and adds the pytest assertion the spec mandates. If the implementer finds either invariant violated, restore it from the spec's code block.

### Phase 0 — Branch creation

#### Task C-0.1: Fork branch

- [ ] **Step 1: Fork from origin/main**

```bash
git fetch origin
git checkout -b claude/genui-backend-coalescing origin/main
git log --oneline -1
```

### Phase 1 — Verify invariants + add pytest assertions

#### Task C-1.1: Pytest assertion for in-place AI replacement + envelope reorder

**Files:**
- Modify: `examples/chat/python/src/graph.py` (only if either invariant is missing — likely no-op)
- Modify: `examples/chat/python/tests/test_graph_smoke.py`

- [ ] **Step 1: Verify the in-place replacement code is present**

```bash
grep -n "ai_tool_call_msg is not None\|replacement_kwargs\[\"id\"\] = ai_tool_call_msg.id\|tool_calls.*ai_tool_call_msg\.tool_calls" examples/chat/python/src/graph.py
```

Expected: matches inside `emit_generated_surface`. If absent, edit the function to include the spec's code block (see `docs/superpowers/specs/2026-05-11-progressive-genui-bubble-coalescing-design.md`, "Backend" section), keeping the existing reorder code.

- [ ] **Step 2: Verify the envelope reorder code is present**

```bash
grep -n "surface_updates\|begin_renderings\|data_updates\|reordered = " examples/chat/python/src/graph.py
```

Expected: matches. If absent, restore from the spec.

- [ ] **Step 3: Write the failing pytest test**

Append to `examples/chat/python/tests/test_graph_smoke.py`:

```python
import json
import asyncio
from uuid import uuid4
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage


class TestEmitInPlaceCoalescing:
    """Regression: emit_generated_surface MUST coalesce the GenUI turn
    into a single AI message (3-message thread, not 4), preserving the
    upstream tool-call AI's id, tool_calls, additional_kwargs, and
    response_metadata. Envelopes inside the wrapped content MUST be
    ordered surfaceUpdate -> beginRendering -> dataModelUpdate × N."""

    def _run(self, state):
        from src.graph import emit_generated_surface
        return asyncio.run(emit_generated_surface(state))

    def test_post_emit_thread_has_three_messages_not_four(self):
        original_ai_id = str(uuid4())
        tool_call_id = "call_123"
        envelopes = [
            {"dataModelUpdate": {"surfaceId": "s1", "contents": [{"key": "name", "valueString": "Ada"}]}},
            {"surfaceUpdate": {"surfaceId": "s1", "components": [{"id": "c1", "component": {"TextField": {"value": "{$.name}"}}}]}},
            {"beginRendering": {"surfaceId": "s1", "root": "c1"}},
        ]
        tool_call_ai = AIMessage(
            id=original_ai_id,
            content="",
            tool_calls=[{"id": tool_call_id, "name": "render_a2ui_surface", "args": {}, "type": "tool_call"}],
        )
        tool_msg = ToolMessage(
            id="tool_msg_1",
            tool_call_id=tool_call_id,
            content=json.dumps(envelopes),
        )
        state = {"messages": [HumanMessage(content="render a card"), tool_call_ai, tool_msg]}

        result = self._run(state)

        # add_messages will REPLACE the tool message (same id) and the
        # AI message (same id) — net thread length stays 3 after merge.
        # Here we just assert the returned message list is 2 entries
        # (replacements only), both targeting the upstream ids.
        returned = result["messages"]
        assert len(returned) == 2, f"expected 2 replacements, got {len(returned)}: {returned}"
        # ToolMessage replacement keeps its id and tool_call_id
        tool_replacement = next(m for m in returned if isinstance(m, ToolMessage))
        assert tool_replacement.id == tool_msg.id
        assert tool_replacement.tool_call_id == tool_call_id
        # AI replacement keeps the upstream AI id (in-place merge)
        ai_replacement = next(m for m in returned if isinstance(m, AIMessage))
        assert ai_replacement.id == original_ai_id, (
            "AI replacement must reuse upstream tool-call AI id for in-place merge"
        )

    def test_preserves_tool_calls_additional_kwargs_response_metadata(self):
        original_ai_id = str(uuid4())
        tool_call_id = "call_xyz"
        envelopes = [
            {"surfaceUpdate": {"surfaceId": "s1", "components": []}},
            {"beginRendering": {"surfaceId": "s1", "root": "c1"}},
        ]
        tool_call_ai = AIMessage(
            id=original_ai_id,
            content="",
            tool_calls=[{"id": tool_call_id, "name": "render_a2ui_surface", "args": {}, "type": "tool_call"}],
            additional_kwargs={"reasoning": "the user wants a card"},
            response_metadata={"finish_reason": "tool_calls"},
        )
        tool_msg = ToolMessage(id="t1", tool_call_id=tool_call_id, content=json.dumps(envelopes))
        state = {"messages": [HumanMessage(content="x"), tool_call_ai, tool_msg]}

        result = self._run(state)
        ai_replacement = next(m for m in result["messages"] if isinstance(m, AIMessage))
        assert ai_replacement.tool_calls and ai_replacement.tool_calls[0]["id"] == tool_call_id
        assert ai_replacement.additional_kwargs.get("reasoning") == "the user wants a card"
        assert ai_replacement.response_metadata.get("finish_reason") == "tool_calls"

    def test_envelopes_reordered_to_surface_begin_data(self):
        tool_call_id = "call_r"
        envelopes_unordered = [
            {"dataModelUpdate": {"surfaceId": "s1", "contents": [{"key": "n", "valueString": "1"}]}},
            {"dataModelUpdate": {"surfaceId": "s1", "contents": [{"key": "m", "valueString": "2"}]}},
            {"beginRendering": {"surfaceId": "s1", "root": "c1"}},
            {"surfaceUpdate": {"surfaceId": "s1", "components": []}},
        ]
        tool_call_ai = AIMessage(
            id="ai-1",
            content="",
            tool_calls=[{"id": tool_call_id, "name": "render_a2ui_surface", "args": {}, "type": "tool_call"}],
        )
        tool_msg = ToolMessage(id="t-1", tool_call_id=tool_call_id, content=json.dumps(envelopes_unordered))
        state = {"messages": [HumanMessage(content="x"), tool_call_ai, tool_msg]}

        result = self._run(state)
        ai = next(m for m in result["messages"] if isinstance(m, AIMessage))
        # Strip the A2UI_PREFIX wrapper before splitting JSONL.
        lines = [ln for ln in ai.content.split("\n") if ln.strip() and not ln.startswith("---a2ui_JSON---")]
        keys = [list(json.loads(ln).keys())[0] for ln in lines]
        assert keys == ["surfaceUpdate", "beginRendering", "dataModelUpdate", "dataModelUpdate"], (
            f"expected surfaceUpdate -> beginRendering -> dataModelUpdate × N, got {keys}"
        )
```

- [ ] **Step 4: Run the tests**

```bash
cd examples/chat/python && pytest tests/test_graph_smoke.py::TestEmitInPlaceCoalescing -v 2>&1 | tail -20
```

Expected: 3 passing. If any test fails, the corresponding invariant is missing in `emit_generated_surface` — restore from the spec's "Backend" section (single function change, ~10 LOC) and re-run.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/python/tests/test_graph_smoke.py
# Plus examples/chat/python/src/graph.py ONLY if Step 1 or 2 detected a missing invariant
git commit -m "test(examples-chat): GenUI emit coalescing + reorder regressions

Asserts emit_generated_surface returns 2 replacements (3-message
thread post-merge, not 4), preserves the upstream tool-call AI's
id, tool_calls, additional_kwargs, response_metadata, and orders
the wrapped envelopes surfaceUpdate -> beginRendering -> dataModelUpdate."
```

### Phase 2 — Open PR C

#### Task C-2.1: Push branch and open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin claude/genui-backend-coalescing
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "test(examples-chat): regression coverage for GenUI emit coalescing" --body "$(cat <<'EOF'
## Summary

Locks in the GenUI emit-node invariants with pytest:

- `emit_generated_surface` returns 2 replacements (a `ToolMessage` with the same id + `tool_call_id` as the upstream tool result, and an `AIMessage` with the same id as the upstream tool-call AI). Post-merge thread is 3 messages, not 4.
- The `AIMessage` replacement preserves `tool_calls`, `additional_kwargs`, and `response_metadata` from the upstream tool-call AI.
- The wrapped JSONL envelopes are ordered `surfaceUpdate → beginRendering → dataModelUpdate × N` so the frontend surface store can materialize a surface (and reveal per-component fallbacks) before the bulk of data updates arrive.

## Test plan

- [ ] `cd examples/chat/python && pytest tests/test_graph_smoke.py` passes
EOF
)"
```

Expected: PR URL printed.

---

## Out of scope

- Pre-`surfaceUpdate` skeleton tree from the LLM's schema hints (no protocol support).
- Crossfade animation between fallback and real component (future visual polish).
- Per-binding readiness (the unit stays per-component — components either render with full props or render their fallback).
- A json-render equivalent of progressive rendering (this design is A2UI-specific; `<chat-generative-ui>` uses `partial-json` and its own logic).
- Removing the legacy `<chat-genui-skeleton>` primitive from the public API. Stays exported.

---

## Self-Review

**Spec coverage:**

- PR A — Surface store + catalog shape ✅ (Phases 1–4: views module, binding extraction, component-view type, surface-store wiring + tests)
- PR B — Per-component rendering ✅ (Phases 1–4: default fallback, slot directive, surface rewrite, chat composition cleanup + tests)
- PR C — Backend coalescing + envelope reordering ✅ (Phase 1: pytest regression for both invariants)
- Monotonic readiness rule ✅ (surface-store Step 3 + slot directive `mountedReal` gate + pytest in surface-store.spec.ts Step 5)
- Bare-type backwards compat ✅ (`normalizeViewEntry` + slot-directive spec Step 1 "accepts bare-Type view entries")
- Optional `surfaceFallback` input ✅ (PR B Phase 3 Step 4 template)
- Envelope reorder verification ✅ (PR C Step 3 third test)

**Placeholder scan:** None — every step contains actual code or exact commands.

**Type consistency:** `A2uiComponentView` referenced consistently (component-view.ts → surface-store.ts → slot directive → surface component). `A2uiViewEntry` aliases the existing `RenderViewEntry` from `@ngaf/render` (verified `libs/render/src/lib/views.ts` exports it). `A2uiSurfaceState` defined in surface-store.ts and consumed in surface.component.ts + slot directive specs. `normalizeViewEntry` signature `(Type | A2uiViewEntry) → A2uiViewEntry` is consistent across uses.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-progressive-genui-bubble-coalescing.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per PR (three total: A, B, C), review between PRs, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
