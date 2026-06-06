# Render Docs Technical Review — Findings

**Date:** 2026-06-06
**Pages audited:** 18 (getting-started ×3, guides ×5, concepts ×1, a2ui ×4, api ×5)
**Source verified against:** `libs/render/src`, `libs/chat/src/lib/a2ui`, `libs/a2ui/src/lib/types.ts`, generated `api-docs.json`
**Method:** 5 parallel read-only section auditors + completeness sweep; every finding cites a source line; borderline findings re-verified by the controller.

## Resolution status — ✅ ALL 17 FINDINGS FIXED

Fixed across 5 commits on `claude/render-docs-technical-review`, each gated by a source-cited accuracy review:
- ✅ **a2ui** (#1-7, #11) — `ebe716c3` — envelope names + catalog props corrected.
- ✅ **guides** (#8, #9, #16) — `b04aa7d7` — getFallback + fallback behavior + ChatComponent origin.
- ✅ **api** (#8, #10, #15) — `29592752` — getFallback + emitEvent + signalStateStore signature.
- ✅ **concepts** (#12, #13) — `bc68c2a3` — A2uiSurface/A2uiActionMessage optional fields.
- ✅ **getting-started** (#14) — `36d7b290` — example `spec` inputs typed `input.required<Spec>()`.
- (#17 thin-coverage required no action.)

**Verification:** all 18 render routes return HTTP 200; no a2ui→render mis-attribution; no stale envelope names in the corrected pages (the two remaining mentions are an intentional "do not use" warning and a prose reference to the render compat path); no inbound links to the one renamed anchor.

**Spawned as separate follow-ups (not in this PR):**
- api-docs.json generator signature drift (`generate-api-docs.ts`).
- a2ui-page relocation (information-architecture decision).

## Summary

- **P0: 5** · **P1: 2** · **P2: 6** · **P3: 4**
- **Hot spot:** `render/a2ui/catalog.mdx` (6 findings) and `render/a2ui/surface-store.mdx` (1 page-wide P0) — the A2UI pages drifted from the current protocol/catalog.
- **Systemic issues:**
  1. `surface-store.mdx` uses **obsolete A2UI envelope names** (`createSurface`/`updateComponents`/`updateDataModel`) throughout; the real protocol (libs/a2ui) is `surfaceUpdate`/`dataModelUpdate`/`beginRendering`/`deleteSurface`. Same class of staleness previously flagged in the cockpit example.
  2. `catalog.mdx` documents **wrong component prop names** for half the catalog (Button, TextField, Slider, DateTimeInput) and a nonexistent Card `title`.
  3. `getFallback()` — a real `AngularRegistry` method — is undocumented in both the registry guide and its API page.
  4. The generated `api-docs.json` has signature drift (see Structural).
- **Two suspected issues were verified as NON-issues** (see Structural): the `withViews` ordering and a "stray langgraph import."

---

## Findings by severity

### P0 — wrong (breaks copy-paste)

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 1 | render/a2ui/surface-store.mdx:38-43, 45, 53, 76-82 | accuracy | Obsolete A2UI envelope names `createSurface` / `updateComponents` / `updateDataModel` used in the message table and all JSON examples | libs/a2ui/src/lib/types.ts:220-223 (`surfaceUpdate` \| `dataModelUpdate` \| `beginRendering` \| `deleteSurface`) | Rename throughout: `createSurface`→`surfaceUpdate`, `updateComponents`→(component changes ride on `surfaceUpdate`), `updateDataModel`→`dataModelUpdate`; describe surface creation as `beginRendering`. Add `deleteSurface`. |
| 2 | render/a2ui/catalog.mdx:152-153 | accuracy | Button props listed as `label`/`variant`; real inputs are `childKeys`/`primary` | libs/chat/src/lib/a2ui/catalog/button.component.ts:52,54 | Replace rows: `childKeys: string[]`, `primary: boolean` (default true); button label comes from child components, not a `label` prop |
| 3 | render/a2ui/catalog.mdx:186 | accuracy | TextField prop listed as `value`; the input is `text` (`value` is a read-only computed alias) | libs/chat/src/lib/a2ui/catalog/text-field.component.ts:80,82 | Change row `value` → `text: string` |
| 4 | render/a2ui/catalog.mdx:240-248 | accuracy | DateTimeInput documents `inputType: 'date'\|'time'\|'datetime-local'`; real inputs are `enableDate`/`enableTime` booleans | libs/chat/src/lib/a2ui/catalog/date-time-input.component.ts:56,58 | Replace `inputType` row with `enableDate: boolean` (default true) and `enableTime: boolean` (default false); note the HTML input type is derived internally |
| 5 | render/a2ui/catalog.mdx:277-278 | accuracy | Slider props listed as `min`/`max`; real inputs are `minValue`/`maxValue` | libs/chat/src/lib/a2ui/catalog/slider.component.ts:49,51 | Change rows `min`→`minValue`, `max`→`maxValue` (keep `value`, `step`) |

### P1 — misleading (runs/reads but wrong model)

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 6 | render/a2ui/catalog.mdx:38 | accuracy | Text component JSON uses flat `"component": "Text"` instead of the keyed-union envelope the protocol requires | overview.mdx (same page set) uses `"component": {"Text": {...}}`; matches the a2ui parser | Change to `{"id":"greeting","component":{"Text":{"text":{"literalString":"Hello, world!"}}}}` |
| 7 | render/a2ui/catalog.mdx:214 | accuracy | CheckBox documents `checked` as the prop; canonical input is `value` (`checked` is a deprecated back-compat alias) | libs/chat/src/lib/a2ui/catalog/check-box.component.ts:36,38,47 | List `value: boolean` as primary; note `checked` is a deprecated alias |

### P2 — gap

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 8 | render/guides/registry.mdx:24-33 + render/api/define-angular-registry.mdx:29,38-41 | completeness | `AngularRegistry` has 3 methods; docs document only `get`/`names` — `getFallback()` is omitted | libs/render/src/lib/render.types.ts:42 (`getFallback(name): AngularComponentRenderer \| undefined`) | Add `getFallback(name)` to the interface block + methods table on both pages |
| 9 | render/guides/registry.mdx:35-103 | conceptual | No explanation of what renders when a type is unregistered or props are still resolving (fallback behavior) | libs/render/src/lib/render-element.component.ts:220-228 (uses `getFallback()`) | Add a short "Fallback rendering" note: unregistered type → configured fallback (or nothing); resolving props → fallback for visual feedback |
| 10 | render/api/render-spec-component.mdx:82 | completeness | `RenderContext` (RENDER_CONTEXT) section omits `emitEvent?` | libs/render/src/lib/contexts/render-context.ts:12 (`emitEvent?: (event: RenderEvent) => void`) | Add `emitEvent?: (event: RenderEvent) => void` to the documented shape |
| 11 | render/a2ui/catalog.mdx:114-116 | accuracy | Card props table lists a `title` prop that the component does not have | libs/chat/src/lib/a2ui/catalog/card.component.ts (inputs: `childKeys`, `spec` only) | Remove the `title` row |
| 12 | render/concepts/json-render-vs-a2ui.mdx:75-81 | completeness | `A2uiSurface` code fence omits optional `theme?` and `sendDataModel?` fields | libs/a2ui/src/lib/types.ts:227-243 | Add `theme?: A2uiTheme` and `sendDataModel?: boolean` to the fence (or note them in prose) |
| 13 | render/concepts/json-render-vs-a2ui.mdx:168-177 | completeness | `A2uiActionMessage` fence omits optional `label?` (action) and `metadata?` (message) | libs/a2ui/src/lib/types.ts:252-274 | Add `label?: string` to the action and `metadata?` to the message (or note in prose) |

### P3 — polish

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 14 | render/getting-started/quickstart.mdx:27,100-101 + installation.mdx:101 | accuracy | Child components type the `spec` input as `input<unknown>(null)`; the contract type is `Spec` | libs/render/src/lib/render.types.ts:15 (`spec: Spec`) | Optional: `input<Spec>()` for precision. Low priority — runs fine; illustrative. |
| 15 | render/api/signal-state-store.mdx:14 | accuracy | Signature shows `initialState?` while source uses `initialState: StateModel = {}` (default already shown in the table below) | libs/render/src/lib/signal-state-store.ts:37 | Show `initialState: StateModel = {}` in the signature for consistency |
| 16 | render/guides/events.mdx:170 | conceptual | `ChatComponent` referenced without noting it's from `@threadplane/chat`, not render | render handlers are render-lib; `ChatComponent` is chat-lib | Clarify "…or other render-enabled components like `ChatComponent` (from `@threadplane/chat`)" |
| 17 | (thin coverage) DefaultFallbackComponent, RenderViewEntry, VIEW_REGISTRY | completeness | Each exported symbol is mentioned only once across render docs | libs/render/src/public-api.ts | No action required (all are documented at least once); noted for awareness |

---

## Structural / won't-fix-here

- **a2ui page placement:** `render/a2ui/*` document `@threadplane/chat` runtime APIs (`A2uiSurfaceComponent`, `createA2uiSurfaceStore`) plus `@threadplane/a2ui` protocol types. The pages **correctly attribute the package** (`@threadplane/chat`) — there is **no** `@threadplane/render` mis-import. Accuracy is fixed in place here; **relocating** these pages out of render docs is a separate structural decision (flagged, not actioned).
- **Generated `api-docs.json` drift (generator bug — separate follow-up, not a prose fix):**
  - `withoutViews` signature flattened: rest param `...names: string[]` rendered as `names: string[]` (libs/render/src/lib/views.ts:46-49 is correct; the `.mdx` prose is correct; only the generated JSON is wrong).
  - `AngularRegistry.getFallback` and `RenderContext.emitEvent` missing from the generated JSON.
  - Root cause is `apps/website/scripts/generate-api-docs.ts` signature extraction — flag for a separate task; do not hand-edit generated JSON in this docs review.

## Verified NON-issues (no change)

- **`withViews` ordering:** source is `Object.freeze({ ...additions, ...base })` (libs/render/src/lib/views.ts:24-28) — base keys win on conflict, so the prose "keys that already exist in `base` are preserved" is **correct**. (One auditor mis-flagged this.)
- **"stray langgraph import":** the only `@threadplane/langgraph` reference in render docs is `import { agent }` at `render/a2ui/overview.mdx:258` — a legitimate example of a LangGraph agent as the A2UI streaming source. Not an error.

---

## Fix plan (Phase 2)

Default cutoff: **fix P0 + P1 + P2; fix P3 where it's a one-line change** (#15, #16; #14 optional). Structural + generator items are listed, not actioned.

Grouped by section (only sections with actionable findings):

- **a2ui** (Task 11): #1, #2, #3, #4, #5, #6, #7, #11 — the bulk. Ground every snippet in `libs/chat/src/lib/a2ui` + `libs/a2ui/src/lib/types.ts`.
- **guides** (Task 9): #8 (registry getFallback), #9 (fallback behavior), #16 (events ChatComponent clarity).
- **api** (Task 12): #8 (define-angular-registry getFallback), #10 (render-spec-component emitEvent), #15 (signal-state-store signature).
- **concepts** (Task 10): #12, #13.
- **getting-started** (Task 8): #14 only (optional P3) — may skip.

Each section group is gated by re-verification against the cited source line + a render-200 check before commit.
