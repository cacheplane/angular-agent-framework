# Client-tools view/ask streaming lifecycle — schema-readiness gate + destroy-safe emit

**Date:** 2026-06-17
**Status:** Design — awaiting review
**Author:** Brian Love (with Claude)
**Source:** live published-stack audit (`docs/superpowers/audits/2026-06-17-published-stack-audit.md`)

## Goal

Eliminate the client-tools **view/ask streaming-lifecycle** error class found in the live audit, at the framework layer, so any consumer can write an idiomatic Angular view component (including `input.required()`) backed by a Standard Schema and have it render safely while the model streams tool args:

- **NG0950** — a view component (`day_card`) throws *"Input 'day' is required but no value is available yet"* 6× during streaming, because it is mounted before its required args have streamed in.
- **NG0953** — an `ask` component emits a value on a destroyed `OutputRef` during teardown.

Functional behavior is already correct (cards render, panels update, asks resolve); this removes the runtime errors that flood the console and would hard-fail apps with strict error handling.

## Root cause (confirmed in code)

The client-tools view/ask path differs from the json-render dashboard path:

1. `libs/chat/.../chat-tool-views.component.ts` wraps each tool call into a synthetic one-element render spec with `props: { ...args, ...result, status }` and renders it through `chat-generative-ui → RenderElementComponent`.
2. `RenderElementComponent` (`libs/render`) already has a readiness gate — `notReady` mounts the per-type **fallback** (a shimmer `DefaultFallbackComponent`) and latches to the real component via `mountedReal` once ready. **But `notReady` only fires on _undefined-valued_ props.** While a tool call streams, `args` is often empty `{}`, so the required props (`day`, `places`) are **absent entirely** — there are no undefined *values*, just missing keys. `notReady` returns `false`, the real `DayCardComponent` mounts, and `input.required()` throws NG0950.
3. `RenderViewEntry.schema` (the view's Standard Schema) **already exists on every `view()` entry** — but its own doc comment says it is *"NOT enforced on mount."* That non-enforcement is precisely the gap.
4. NG0953: when an `ask` resolves, the emitted result flows `RenderElementComponent.host.result → ctx.emitEvent → chat-tool-views (events) output`. The resolution also triggers a re-render that can destroy the element in the same cycle; a late emit then hits a destroyed `OutputRef`.

**Cross-framework note (informing the design, not referenced in code):** the most-similar reference framework gates the real-component mount on *schema-resolved readiness* (fallback skeleton until the typed value resolves) — the same idea as this design, expressed via streaming JSON-AST. A second reference renders progressively with a `status` flag and makes the component handle `Partial<T>` (no runtime-required inputs), and for HITL transitions status **in place** rather than unmounting — which is the cure pattern for NG0953.

## Design

This is a **targeted refactor of the render lib's readiness/registry architecture**, not a bolt-on — chosen after reviewing the current code (see "Why refactor"). No backwards compatibility is required. Three changes; the first two are the refactor, the third is a one-line guard. All reuse `DefaultFallbackComponent`, the `mountedReal` latch, and the `~standard.validate` surface already used in `client-tools/execute.ts`. **No consumer API change.**

### Why refactor (not bolt-on)

- **The registry silently drops the schema.** `define-angular-registry.ts` normalizes every entry to `{ component, fallback }` — `RenderViewEntry.schema` (and `description`) are discarded at registration, so a bolt-on `getSchema` would have nothing to read. The registry must preserve the entry regardless.
- **Parallel accessors don't scale.** `AngularRegistry` exposes `get` + `getFallback`; adding `getSchema` extends a smell. A single entry accessor is cleaner and future-proof.
- **Readiness is an ad-hoc heuristic inside a 330-line god-component.** `notReady` = "any undefined prop," buried in `RenderElementComponent` alongside element lookup, visibility, prop/binding resolution, repeat, host, and lifecycle. Adding a second rule inline deepens the tangle; readiness deserves to be a pure, isolated, testable unit.

### 1. Registry preserves the full entry (refactor)

- Normalization keeps all fields: `NormalizedEntry = { component, fallback, schema?, description? }` — stop discarding `schema`/`description`.
- Replace the parallel `get`/`getFallback` on `AngularRegistry` with a single **`getEntry(name): NormalizedEntry | undefined`** (+ `names()`). Callers read `getEntry(t)?.component` / `?.fallback` / `?.schema`. New entry metadata never needs a new accessor again.
- Update the call sites: `render-element.component.ts` (`get`/`getFallback` → `getEntry`), the empty-fallback registry literal in `render-spec.component.ts`, `define-angular-registry.ts`, `toRenderRegistry`.

### 2. Readiness as a first-class, pure policy (refactor — fixes NG0950)

Extract readiness out of `RenderElementComponent` into a pure, independently tested module:

```ts
// libs/render/src/lib/internals/element-readiness.ts
import { isPromise } from '../standard-schema';
import type { NormalizedEntry } from '../render.types';

/** Decide whether the REAL component may mount, or the fallback should show.
 *  Pure: no Angular, no signals — trivially unit-testable. */
export function isElementReady(
  entry: NormalizedEntry | undefined,
  resolvedProps: Record<string, unknown>,
): boolean {
  // undefined-valued prop → pending (json-render state binding still loading)
  for (const v of Object.values(resolvedProps)) {
    if (v === undefined) return false;
  }
  // schema-declared contract → pending until the streamed props validate.
  // SYNC only — render is synchronous; an async (Promise) result cannot gate a
  // sync mount, so we treat it as ready (documented: view schemas should be sync; Zod is).
  const schema = entry?.schema;
  if (schema) {
    const out = schema['~standard'].validate(resolvedProps);
    if (!isPromise(out) && out.issues !== undefined) return false;
  }
  return true;
}
```

`RenderElementComponent` collapses its readiness to a thin consumer (latch unchanged):

```ts
readonly notReady = computed<boolean>(() => {
  if (this.mountedReal()) return false;                 // monotonic latch unchanged
  const el = this.element();
  if (!el) return false;
  const entry = this.ctx.registry.getEntry(el.type);
  return !isElementReady(entry, resolveElementProps(el.props ?? {}, this.propCtx()));
});
```

- `notReady === true` → `mountClass()` returns the entry's **fallback** (shimmer skeleton) — same code path.
- Once props are ready, the real component mounts and the existing `mountedReal` effect latches it.
- **Behavioral note (no back-compat needed, but preserved anyway):** schemaless elements keep the undefined-prop behavior; async schemas mount immediately (documented).

**Streaming timeline (day_card):**
```
args {}                                   → validate ✗ (day, places missing) → fallback skeleton
args {"day":2                             → validate ✗ (places missing)       → fallback skeleton
args {"day":2,"places":["Eiffel","Colos"]} ✓                                  → mount DayCardComponent, latch
```
No NG0950: the real component is never mounted without the props its schema requires.

**Consumer experience:** unchanged. They write `view(desc, zodSchema, Component)` and a normal component with `input.required()`; the framework makes streaming safe. Optional: a custom skeleton via the existing `fallback` on the registry entry.

### 3. Destroy-safe result emission (fixes NG0953)

Guard the result/event emission so a resolved-then-unmounting element cannot emit on a destroyed `OutputRef`.

**The emitting `OutputRef` is entirely in `libs/render`.** `RENDER_CONTEXT.emitEvent` is implemented in `render-spec.component.ts` (`private emitEvent = (e) => { …; this.events.emit(e); }`), and `this.events` is `RenderSpecComponent`'s own `output<RenderEvent>()`. The `libs/chat` components (`chat-generative-ui`, `chat-tool-views`) only *forward* it via `(events)="events.emit($event)"`. So guarding the source covers the whole chain — **no `libs/chat` change for the emit guard.** (The schema-propagation fix in `client-tools-coordinator.ts` is a separate, required `libs/chat` change — see Files touched.)

- In `RenderSpecComponent` (`render-spec.component.ts`), track destroyed state via the existing `DestroyRef` and make `emitEvent`/`this.events.emit(...)` a no-op once destroyed.
- In `RenderElementComponent`, likewise guard `host.result` / `host.emit` / the lifecycle `emitEvent` calls when the element is destroyed (belt-and-suspenders at the call site).

This matches the "transition status in place, don't emit across teardown" pattern; combined with the existing FU2 freeze (resolved ask re-renders in place), the ask lifecycle becomes error-free.

## Files touched — entirely within `libs/render`

Registry refactor (entry preservation + unified accessor):
- `libs/render/src/lib/render.types.ts` — `AngularRegistry`: replace `get`/`getFallback` with `getEntry(name): NormalizedEntry | undefined`; export the `NormalizedEntry` type (`{ component, fallback, schema?, description? }`).
- `libs/render/src/lib/define-angular-registry.ts` — `normalize` preserves `schema`/`description`; return `{ getEntry, names }`.
- `libs/render/src/lib/views.ts` (`toRenderRegistry`) — passthrough (unchanged signature).

Readiness policy (extraction) + gate:
- `libs/render/src/lib/internals/element-readiness.ts` **(new)** — pure `isElementReady(entry, resolvedProps)`.
- `libs/render/src/lib/render-element.component.ts` — `notReady` collapses to `!isElementReady(getEntry(type), resolvedProps)`; `mountClass`/fallback read via `getEntry`; destroyed-guard on `host.*`.
- `libs/render/src/lib/standard-schema.ts` — small `isPromise` helper (or inline in element-readiness).

Destroy-safe emit:
- `libs/render/src/lib/render-spec.component.ts` — empty-fallback registry literal uses `getEntry`; destroyed-guard in `emitTapped` (the single tap point / NG0953 `OutputRef`).

One `libs/chat` change — **required**, surfaced by the live smoke (see correction below):
- `libs/chat/src/lib/client-tools/client-tools-coordinator.ts` — `viewComponents` must map each `view`/`ask` tool to a `RenderViewEntry { component, schema }` (previously it returned the bare component `Type`, which dropped the schema). Without this the registry's `getEntry(name).schema` is `undefined`, the readiness gate never engages, and NG0950 persists in production despite green render-lib unit tests.

> **Live-smoke correction:** an earlier draft of this spec claimed "no `libs/chat` change." That was wrong. The render-lib unit tests built a registry *with* a schema directly, so the gate fired in tests — but production builds the view registry through the coordinator's `viewComponents`, which was discarding the schema. The fix is the one-line `viewComponents` change above. No `@threadplane/chat` `view()/ask()` public signatures change, and no demo component changes.

- **Explicitly NOT in scope** (unrelated cleanups, noted for a future pass): splitting `RenderElementComponent`'s repeat vs non-repeat paths, extracting the inline `host` object, restructuring prop resolution.

## Error handling & edge cases

- **Async schema:** not gated (sync-only); documented. Zod's Standard Schema validate is synchronous.
- **No schema:** current undefined-prop behavior preserved (json-render dashboards).
- **Partial-but-valid args:** if a schema marks fields optional, the component mounts as soon as the required subset validates (progressive-friendly).
- **Validation cost:** runs only while `!mountedReal` (i.e., during streaming, then never again per instance); views are small. Negligible.
- **Result/value props:** `{ ...args, ...result }` — the schema validates the merged props; `result`/`status` are extra keys the schema ignores (Standard Schema validate on a superset object passes for object schemas that don't `.strict()`). Confirm the demo schemas are non-strict (they are: plain `z.object`).

## Testing

**Unit (`libs/render`, vitest):**
- `isElementReady` (pure, the bulk of coverage): ready when no undefined props + no schema; pending on any undefined prop; pending when a sync schema's validate returns issues; ready when it validates; ready when no schema; ready (not gated) for an async/Promise-returning schema; result/status extra keys don't break validation of a non-strict object schema.
- `defineAngularRegistry` / `getEntry`: preserves `component`/`fallback`/`schema`/`description`; bare-`Type` entries get the default fallback and `schema: undefined`; `getEntry` returns undefined for unregistered names.
- `RenderElementComponent`: `notReady` reflects `isElementReady` against the registered entry + resolved props; fallback shows while pending, real component mounts + latches once ready.
- Destroyed-guard: `host.result`/`emit` and `emitTapped` no-op after `DestroyRef` fires.

**Integration / e2e (examples/ag-ui):**
- Drive `day_card` (e.g. "Add X to day 2") and assert **zero NG0950** in the console during streaming, fallback skeleton appears, then the real card renders with correct props.
- Drive an `ask` resolve (cockpit ag-ui/langgraph client-tools `confirm_booking`) and assert **zero NG0953** on resolve + freeze.

**Live-LLM smoke (standing gate):** re-run the audit's D1/D3 flows against the published backends; confirm a clean console (the audit's primary regression signal).

## Out of scope (separate follow-ups)

- **TypeScript DX / intellisense audit** of the `@threadplane/*` public surface (hover types, generic inference, JSDoc accuracy/readability) — Brian wants this next, as its own brainstorm→spec.
- **Backend-failure error UX** (bare "HTTP 500:", ~20s timeout, no retry) — separate spec.
- **Thread-persistence consistency** across demos — separate, larger product decision.
- Progressive (mid-stream partial) reveal of view components — the gate enables it, but this design only requires fallback-until-ready.

## Success criteria

- examples/ag-ui `day_card` streaming render: **0× NG0950**; skeleton→card transition; correct final props.
- client-tools `ask` resolve/freeze: **0× NG0953**.
- json-render dashboards and all existing render/chat unit + e2e suites: unchanged/green.
- No change required to any consumer's `view()/ask()` declaration or component code.
