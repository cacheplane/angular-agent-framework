# A2UI Core Quality Pass Design Spec

## Overview

Quality pass over the A2UI implementation to address type safety, code organization, test coverage, public API exports, and DX issues identified in a post-implementation audit. Explicitly excludes the StateStore bridge (future Phase 4 work) and website content quality (separate sub-project).

**Motivation:** Post-implementation quality sweep after Phase 1–3 and the v0.9 sendDataModel feature. Catch rough edges before the codebase grows further.

## 1. Type Safety — `surface.component.ts`

**Problem:** `surfaceToSpec()` uses `Record<string, any>` for the elements map and several `as any` casts for DynamicValue and child template access.

**Fix:**
- Replace `Record<string, any>` with `Record<string, UIElement>` (import from `@json-render/core`)
- Add a type guard `isDynamicPathRef(value): value is { path: string }` to replace `(value as any).path` casts
- Use `A2uiChildTemplate` type directly for the children template cast (already imported)

**Scope:** `libs/chat/src/lib/a2ui/surface.component.ts` only. The `globalThis` cast in `libs/a2ui/src/lib/functions.ts` is pre-existing and out of scope.

## 2. Code Organization — Extract Pure Functions

**Problem:** `surfaceToSpec()` (113 lines) and `buildA2uiActionMessage()` (20 lines) are pure utility functions living inside the Angular component file. This makes the component file large and harder to reason about.

**Fix:**
- Extract `surfaceToSpec()` to `libs/chat/src/lib/a2ui/surface-to-spec.ts`
- Extract `buildA2uiActionMessage()` to `libs/chat/src/lib/a2ui/build-action-message.ts`
- Component file shrinks to ~60 lines (Angular component only)
- Move corresponding tests to `surface-to-spec.spec.ts` and `build-action-message.spec.ts`
- Update `public-api.ts` import paths

## 3. Public API Exports

**Problem:** `surfaceToSpec` not exported from `@cacheplane/chat`. Core A2UI types like `A2uiSurface`, `A2uiComponent`, `DynamicValue` require importing from `@cacheplane/a2ui` directly, creating a split mental model.

**Fix:**
- Re-export commonly-used A2UI types from `@cacheplane/chat`: `A2uiSurface`, `A2uiComponent`, `A2uiTheme`, `DynamicValue`
- Export `surfaceToSpec` for consumers wanting custom rendering pipelines
- Export individual catalog component classes for consumers extending the catalog via `withViews`

## 4. Catalog Component Unit Tests

**Problem:** Zero unit tests for 18 catalog components. Only indirect integration coverage through surface spec tests.

**Fix:** Add focused unit tests for input components that have binding/validation logic:
- `TextField` — renders label, placeholder, value; emits binding event on input; shows validation errors
- `CheckBox` — renders checked state; emits binding event on toggle; shows validation errors
- `Button` — renders label; calls emit('click') on click; shows disabled state
- `ChoicePicker` — renders options; emits binding event on selection
- `Slider` — renders min/max/value; emits binding event on change

Basic render tests for display components:
- `Text`, `Icon`, `Image` — render correct content from inputs

Complex interaction tests:
- `Modal` — backdrop click emits binding event
- `Tabs` — tab selection emits binding event

**Note:** We do NOT test the `a2ui:datamodel` event actually updating state — that's a known limitation addressed by future StateStore bridge work. We test that the component emits the expected string.

## 5. Input Component DRY — Shared Binding Utility

**Problem:** 7 input components have near-identical 3-line blocks for binding emission:
```typescript
const path = this._bindings()?.['value'];
if (path) {
  this.emit()(`a2ui:datamodel:${path}:${val}`);
}
```

**Fix:**
- Extract `emitBinding(emit, bindings, prop, value)` to `libs/chat/src/lib/a2ui/catalog/emit-binding.ts`
- Each component calls one function instead of repeating the pattern
- Unit test the utility function

## 6. Documentation Updates

**Problem:** `_bindings` convention undocumented. Data model binding flow not explained. Component prop reference incomplete.

**Fix:**
- Add "Data Model Bindings" section to `apps/website/content/docs/render/a2ui/overview.mdx` explaining the current mechanism and its known limitations
- Add prop reference tables to `apps/website/content/docs/render/a2ui/catalog.mdx` for each component group (inputs, display, layout, complex)
- Document the `emit` callback contract and how it flows through the render lib

## Non-Goals

- **StateStore bridge**: The `a2ui:datamodel` emit pattern will be replaced by proper StateStore integration in future work. This quality pass does not change the binding mechanism.
- **Website landing pages / home page**: Separate sub-project.
- **New catalog components**: No new components added.
- **Render lib changes**: All changes are in `@cacheplane/a2ui` and `@cacheplane/chat`.
