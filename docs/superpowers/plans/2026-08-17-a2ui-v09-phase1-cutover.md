# A2UI v0.9.1 Phase 1 — Wire-Format Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atomically migrate every A2UI touchpoint (TS libs, Angular renderer, Python emitters, fixtures, docs) from the legacy `beginRendering`/`surfaceUpdate` shape to the A2UI v0.9.1 stable wire format. Clean cutover, no legacy acceptance.

**Architecture:** `libs/a2ui` is the single canonical wire definition; everything else consumes it. Rewrite the protocol core first (types → guards → resolve → parser → pointer semantics), then the chat renderer (store → surface-to-spec → catalog), then Python emitters + prompts, then fixtures, then docs. Spec: `docs/superpowers/specs/2026-08-17-a2ui-v09-stable-migration-design.md` (the wire-format diff and catalog prop table there are normative for this plan).

**Tech Stack:** Nx monorepo, Angular signals, vitest, Python/pydantic + pytest, Playwright e2e with aimock fixtures.

**Phases 2–4** (client-side functions, checks, sendDataModel) get their own plan docs after this phase merges.

---

## Ground rules for every task

- TDD: update/write the failing spec first, run it (`npx nx test a2ui` / `npx nx test chat -- --run <file>`), implement, re-run green, commit.
- NEVER `replace_all` for `ChatMessage`/`ChatInterrupt`-adjacent names, and here specifically `A2uiComponent*` substrings (`A2uiComponentView` must survive renames).
- Worktree prep (once, before any chat test/serve): run `node scripts/generate-public-key.mjs` if present and copy `node_modules/katex` from the main checkout if missing.
- New public exports ⇒ `npm run generate-api-docs` + commit before PR (CI fails on lint *errors* only; strip ANSI before grepping lint output).
- Implementation-time spec check: before Task 1, download the official catalog schema `https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json` and the message schema linked from `https://a2ui.org/specification/v0.9-a2ui/` into the scratchpad; where this plan and the official schema disagree, **the official schema wins** (update the plan's prop table inline).

### Task 0: Branch + worktree prep

- [ ] `git checkout -b blove/a2ui-v09-phase1` from current worktree HEAD (which holds the design doc).
- [ ] Worktree dep gaps: `ls node_modules/katex || cp -R ~/repos/angular-agent-framework/node_modules/katex node_modules/`; run `node scripts/generate-public-key.mjs` if the script exists.
- [ ] Download official schemas to scratchpad; diff against the spec's catalog table; correct plan inline if needed.
- [ ] Baseline: `npx nx run-many -t test -p a2ui chat --exclude='*e2e*'` green before touching anything.

### Task 1: `libs/a2ui/src/lib/types.ts` — full rewrite

**Files:** Modify `libs/a2ui/src/lib/types.ts`, `libs/a2ui/src/lib/types.spec.ts`.

- [ ] **Step 1: failing spec** — rewrite `types.spec.ts` compile-time assertions to the new vocabulary (envelopes with `version`, flat component, bare literals). Representative:

```ts
const create: A2uiMessage = {
  version: 'v0.9',
  createSurface: { surfaceId: 's1', catalogId: A2UI_BASIC_CATALOG_ID, sendDataModel: true },
};
const update: A2uiMessage = {
  version: 'v0.9',
  updateComponents: {
    surfaceId: 's1',
    components: [
      { id: 'root', component: 'Column', children: ['title', 'cta'] },
      { id: 'title', component: 'Text', text: 'Hello', variant: 'h2' },
      { id: 'cta', component: 'Button', child: 'cta-text', variant: 'primary',
        action: { event: { name: 'submit', context: { flightId: { path: '/selected' } } } } },
    ],
  },
};
const data: A2uiMessage = {
  version: 'v0.9',
  updateDataModel: { surfaceId: 's1', path: '/selected', value: 'UA-42' },
};
const del: A2uiMessage = { version: 'v0.9', deleteSurface: { surfaceId: 's1' } };
```

- [ ] **Step 2:** `npx nx test a2ui` — expect type errors (FAIL).
- [ ] **Step 3: implement.** New `types.ts` core (complete component-prop interfaces follow the spec table in the design doc §Catalog changes; each interface extends `A2uiComponentBase`):

```ts
// SPDX-License-Identifier: MIT

export const A2UI_WIRE_VERSION = 'v0.9';
export const A2UI_MIME_TYPE = 'application/a2ui+json';
export const A2UI_BASIC_CATALOG_ID =
  'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';

// --- Dynamic values: bare literal | path binding | function call (typed now, resolved in Phase 2)
export interface A2uiPathRef { path: string }
export interface A2uiFunctionCall { call: string; args?: Record<string, unknown>; returnType?: string }
export type DynamicString = string | A2uiPathRef | A2uiFunctionCall;
export type DynamicNumber = number | A2uiPathRef | A2uiFunctionCall;
export type DynamicBoolean = boolean | A2uiPathRef | A2uiFunctionCall;
export type DynamicStringList = string[] | A2uiPathRef | A2uiFunctionCall;
export type DynamicValue = unknown;

// --- Children: static id list | template
export type A2uiChildren = string[] | { path: string; componentId: string };

// --- Actions
export interface A2uiEventAction { event: { name: string; context?: Record<string, DynamicValue> } }
export interface A2uiFunctionAction { functionCall: A2uiFunctionCall }
export type A2uiAction = A2uiEventAction | A2uiFunctionAction;

// --- Validation checks (typed now, enforced in Phase 3)
export interface A2uiCheck { call: string; args?: Record<string, DynamicValue>; message?: string }

// --- Components: flat, discriminated by `component` string
export interface A2uiComponentBase {
  id: string;
  component: string;
  catalogId?: string;
  weight?: number;
  checks?: A2uiCheck[];
}
export interface A2uiText extends A2uiComponentBase { component: 'Text'; text: DynamicString; variant?: 'h1'|'h2'|'h3'|'h4'|'h5'|'caption'|'body' }
export interface A2uiImage extends A2uiComponentBase { component: 'Image'; url: DynamicString; description?: DynamicString; fit?: 'contain'|'cover'|'fill'|'none'|'scaleDown'; variant?: 'icon'|'avatar'|'smallFeature'|'mediumFeature'|'largeFeature'|'header' }
export interface A2uiIcon extends A2uiComponentBase { component: 'Icon'; name: DynamicString | { svgPath: string } }
export interface A2uiVideo extends A2uiComponentBase { component: 'Video'; url: DynamicString }
export interface A2uiAudioPlayer extends A2uiComponentBase { component: 'AudioPlayer'; url: DynamicString; description?: DynamicString }
export interface A2uiRow extends A2uiComponentBase { component: 'Row'; children: A2uiChildren; justify?: 'start'|'center'|'end'|'spaceAround'|'spaceBetween'|'spaceEvenly'|'stretch'; align?: 'start'|'center'|'end'|'stretch' }
export interface A2uiColumn extends A2uiComponentBase { component: 'Column'; children: A2uiChildren; justify?: 'start'|'center'|'end'|'spaceAround'|'spaceBetween'|'spaceEvenly'|'stretch'; align?: 'start'|'center'|'end'|'stretch' }
export interface A2uiList extends A2uiComponentBase { component: 'List'; children: A2uiChildren; direction?: 'vertical'|'horizontal'; align?: 'start'|'center'|'end'|'stretch' }
export interface A2uiCard extends A2uiComponentBase { component: 'Card'; child: string }
export interface A2uiTabs extends A2uiComponentBase { component: 'Tabs'; tabs: { title: DynamicString; child: string }[] }
export interface A2uiModal extends A2uiComponentBase { component: 'Modal'; trigger: string; content: string }
export interface A2uiDivider extends A2uiComponentBase { component: 'Divider'; axis?: 'horizontal'|'vertical' }
export interface A2uiButton extends A2uiComponentBase { component: 'Button'; child: string; variant?: 'default'|'primary'|'borderless'; action: A2uiAction }
export interface A2uiCheckBox extends A2uiComponentBase { component: 'CheckBox'; label: DynamicString; value: DynamicBoolean }
export interface A2uiTextField extends A2uiComponentBase { component: 'TextField'; label: DynamicString; value?: DynamicString; variant?: 'shortText'|'longText'|'number'|'obscured'; validationRegexp?: string }
export interface A2uiDateTimeInput extends A2uiComponentBase { component: 'DateTimeInput'; value: DynamicString; enableDate?: boolean; enableTime?: boolean; min?: DynamicString; max?: DynamicString; label?: DynamicString }
export interface A2uiChoicePicker extends A2uiComponentBase { component: 'ChoicePicker'; options: { label: DynamicString; value: string }[]; value: DynamicStringList; variant?: 'mutuallyExclusive'|'multipleSelection'; displayStyle?: 'checkbox'|'chips'; filterable?: boolean; label?: DynamicString }
export interface A2uiSlider extends A2uiComponentBase { component: 'Slider'; value: DynamicNumber; max: number; min?: number; label?: DynamicString }

export type A2uiCatalogComponent =
  | A2uiText | A2uiImage | A2uiIcon | A2uiVideo | A2uiAudioPlayer
  | A2uiRow | A2uiColumn | A2uiList | A2uiCard | A2uiTabs | A2uiModal | A2uiDivider
  | A2uiButton | A2uiCheckBox | A2uiTextField | A2uiDateTimeInput | A2uiChoicePicker | A2uiSlider;
/** Any component, including non-basic-catalog types the renderer treats as unknown. */
export type A2uiComponent = A2uiCatalogComponent | (A2uiComponentBase & Record<string, unknown>);

// --- Theme
export interface A2uiTheme { primaryColor?: string; iconUrl?: string; agentDisplayName?: string }

// --- Envelopes (server → client)
export interface A2uiCreateSurface { surfaceId: string; catalogId: string; theme?: A2uiTheme; sendDataModel?: boolean }
export interface A2uiUpdateComponents { surfaceId: string; components: A2uiComponent[] }
export interface A2uiUpdateDataModel { surfaceId: string; path?: string; value?: unknown }
export interface A2uiDeleteSurface { surfaceId: string }
interface A2uiEnvelopeBase { version: string }
export type A2uiMessage = A2uiEnvelopeBase & (
  | { createSurface: A2uiCreateSurface }
  | { updateComponents: A2uiUpdateComponents }
  | { updateDataModel: A2uiUpdateDataModel }
  | { deleteSurface: A2uiDeleteSurface }
);

// --- Client → agent
export interface A2uiActionMessage {
  version: string;
  action: {
    name: string; surfaceId: string; sourceComponentId: string;
    timestamp: string; context?: Record<string, unknown>;
    /** Threadplane extension: human label for transcript bubbles (see 2026-05-19 design). */
    label?: string;
  };
  metadata?: { a2uiClientDataModel?: A2uiClientDataModel };
}
export interface A2uiErrorMessage {
  version: string;
  error: { code: string; surfaceId?: string; path?: string; message?: string };
}
export interface A2uiClientDataModel { surfaces: Record<string, Record<string, unknown>> }
export interface A2uiClientCapabilities { supportedCatalogIds: string[]; inlineCatalogs?: unknown[] }

// --- Internal surface model (renderer state, not wire)
export interface A2uiSurface {
  surfaceId: string;
  catalogId: string;
  theme?: A2uiTheme;
  sendDataModel?: boolean;
  components: Map<string, A2uiComponent>;
  dataModel: Record<string, unknown>;
}
```

Deleted names: `A2uiComponentDef`, `A2uiBeginRendering`, `A2uiSurfaceUpdate`, `A2uiDataModelUpdate`, `A2uiDataModelEntry`, `A2uiActionContextEntry`, `A2uiTabItem`, `A2uiMultipleChoice`, literal-wrapper Dynamic variants, `A2uiSurface.styles`.

- [ ] **Step 4:** `npx nx test a2ui -- --run types` — types.spec green (other specs still red until Tasks 2–4).
- [ ] **Step 5:** Commit `feat(a2ui)!: v0.9 wire types`.

### Task 2: guards

**Files:** Modify `libs/a2ui/src/lib/guards.ts`, `guards.spec.ts`.

- [ ] Failing spec: `isPathRef({path:'/x'})` true; `isFunctionCall({call:'formatDate'})` true; `isFunctionCall({path:'/x'})` false; literal-wrapper guards no longer exported (compile error if imported).
- [ ] Implement: keep `isPathRef` (unchanged); add:

```ts
/** Returns true when `value` is an A2UI client-side function call. */
export function isFunctionCall(value: unknown): value is { call: string; args?: Record<string, unknown> } {
  return typeof value === 'object' && value !== null
    && 'call' in value && typeof (value as { call: unknown }).call === 'string';
}
```

Delete `isLiteralString`/`isLiteralNumber`/`isLiteralBoolean`.
- [ ] `npx nx test a2ui -- --run guards` green. Commit.

### Task 3: resolve

**Files:** Modify `libs/a2ui/src/lib/resolve.ts`, `resolve.spec.ts`.

- [ ] Failing spec: bare literals pass through (`'Hi'`, `5`, `true`, `['a']`); `{path}` absolute + scope-relative resolve; `{call:'formatString',...}` returns `undefined` (Phase 2 placeholder); arrays recurse; plain objects **without** `path`/`call` keys pass through unchanged (options arrays etc. — note: element-wise recursion applies to arrays so `[{path:'/x'}]` resolves element-wise).
- [ ] Implement: drop literal-wrapper unwrapping; keep `resolvePathRef` and array recursion; add `if (isFunctionCall(value)) return undefined; // Phase 2` before the path check. `isPathRef`/`isFunctionCall` imported from `./guards.js` (single source; delete resolve.ts's private copies).
- [ ] Green + commit.

### Task 4: parser

**Files:** Modify `libs/a2ui/src/lib/parser.ts`, `parser.spec.ts`.

- [ ] Failing spec: parses the four v0.9 envelopes and **preserves `version`**; skips unknown envelope keys (`{"version":"v1.0","callRendererFunction":{...}}` → dropped, no throw); still skips malformed lines and buffers partial lines.
- [ ] Implement: `ENVELOPE_KEYS = ['createSurface','updateComponents','updateDataModel','deleteSurface']`; `parseEnvelope` returns `{ version: String(json['version'] ?? 'v0.9'), [key]: json[key] }`.
- [ ] Green + commit.

### Task 5: pointer delete semantics

**Files:** Modify `libs/a2ui/src/lib/pointer.ts` (only if needed), `pointer.spec.ts`.

- [ ] Spec additions: `deleteByPointer(model,'/items/1')` on an array **sets index 1 to `undefined` preserving length** (v0.9 rule); object key removal unchanged; root delete returns `{}`.
- [ ] Run; fix `deleteByPointer` only if the array case fails (current impl may splice). Green + commit.

### Task 6: `libs/a2ui` public API + README

**Files:** Modify `libs/a2ui/src/index.ts`, `libs/a2ui/README.md`.

- [ ] Export new names (constants, `isFunctionCall`, new types incl. `A2uiErrorMessage`, `A2uiClientCapabilities`, per-component interfaces, `A2uiCatalogComponent`); remove deleted names. `npx nx run a2ui:build` green.
- [ ] Rewrite README Quick-start/Capabilities to v0.9 (createSurface example, bare literals, root-id note, MIME type). Commit.

### Task 7: chat surface store

**Files:** Modify `libs/chat/src/lib/a2ui/surface-store.ts`, `surface-store.spec.ts`, `libs/chat/src/lib/a2ui/extract-bindings.ts` (+spec) if binding syntax touches wire shapes.

- [ ] Failing specs (core semantics):

```ts
it('opens a surface on createSurface and renders once root arrives', () => {
  const store = createA2uiSurfaceStore();
  store.apply({ version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: BASIC } });
  store.apply({ version: 'v0.9', updateComponents: { surfaceId: 's1', components: [
    { id: 'title', component: 'Text', text: 'Hi' },
  ] } });
  expect(store.surfaces().get('s1')).toBeUndefined();       // no root yet → buffered
  store.apply({ version: 'v0.9', updateComponents: { surfaceId: 's1', components: [
    { id: 'root', component: 'Column', children: ['title'] },
  ] } });
  expect(store.surfaces().get('s1')?.components.size).toBe(2); // renders, tree fills progressively
});
it('merges updateComponents by id instead of replacing the map', ...);
it('buffers components for a surface with no createSurface yet', ...);
it('applies updateDataModel value at path', ...);
it('replaces whole model when path omitted', ...);
it('deletes key when value omitted', ...);
it('keeps existing dataModel on re-open (createSurface for existing id)', ...);
```

- [ ] Implement: `SurfaceBuffer` becomes `{ create?: A2uiCreateSurface; components: Map<string, A2uiComponent>; componentViews: Map<string, A2uiComponentView>; dataModelDeltas: { path?: string; value?: unknown; del?: boolean }[] }`. `apply()` branches:
  - `createSurface`: record in buffer (or refresh catalogId/theme/sendDataModel on live surface); attempt commit.
  - `updateComponents`: **merge** each component by id into buffer (or live surface) — v0.9 updates are incremental, not replace-all; project `A2uiComponentView` per component (type = `component` string field now; `def` = the flat component); attempt commit.
  - commit condition: buffer has `create` AND a component with id `'root'` → build `A2uiSurface` (catalogId/theme/sendDataModel from `create`), fold buffered deltas via `setByPointer`/`deleteByPointer`, publish both signals, keep buffer for subsequent incremental merges (live surface path).
  - `updateDataModel`: on live surface `path`+`value` → `setByPointer`; omitted `value` → `deleteByPointer`; omitted/`/` path with value → replace model; pre-commit → push delta. Readiness recompute unchanged (monotonic rule stays).
  - `deleteSurface`: unchanged.
- [ ] Green (`npx nx test chat -- --run surface-store`) + commit.

### Task 8: surface-to-spec

**Files:** Modify `libs/chat/src/lib/a2ui/surface-to-spec.ts`, `surface-to-spec.spec.ts`.

- [ ] Failing spec: flat component consumption; `action.event` → `a2ui:event` params with **resolved context object**; `action.functionCall` → ignored (Phase 2), no `on` emitted; children plain array; template `{path, componentId}` expansion (scope base = `${path}/${i}`); Tabs `tabs[{title,child}]` → children + `tabTitles`; Modal `trigger`/`content`; ChoicePicker options label resolution; root fallback logic unchanged.
- [ ] Implement: delete `unwrapComponentDef`; `RESERVED_PROP_KEYS = new Set(['id','component','catalogId','weight','checks','child','children','action','tabs','trigger','content'])`; `resolveAction` reads `action.event.name` / `.context` (object iteration, `resolveDynamic` each value); `childrenToList`: `Array.isArray(children)` → ids; `'path' in children` → template expansion off `children.path`; prop loop: `isPathRef` → `$bindState` binding (unchanged), `isFunctionCall` → skip prop (Phase 2), else `resolveDynamic`.
- [ ] Green + commit.

### Task 9: catalog components (18 files)

**Files:** Modify each of `libs/chat/src/lib/a2ui/catalog/*.component.ts` (+ its spec), `catalog/index.ts`; **rename** `multiple-choice.component.ts` → `choice-picker.component.ts` (`A2uiMultipleChoiceComponent` → `A2uiChoicePickerComponent`, selector/type key `ChoicePicker`). No `replace_all` — the `MultipleChoice` string appears in registry keys, specs, and prompts; touch each site explicitly.

Prop mapping (old input → new input; template/CSS updated accordingly; all specs first, then implementation):

| Component | Changes |
|---|---|
| Text | `usageHint` → `variant` (same enum values + `body` default) |
| Image | `alt` → `description`; drop `width`/`height`; add `fit` (object-fit map), `variant` (size class map) |
| Icon | `icon` → `name` (string enum or `{svgPath}`), drop `size` |
| Video/AudioPlayer | drop `autoPlay`/`controls` inputs (native controls stay on); AudioPlayer gains `description` |
| Row/Column | `alignment` → `align`, `distribution` → `justify` (spec enums incl. `spaceAround` camelCase → CSS map); drop `gap` input (keep token-based default gap) |
| List | add `align`; keep `direction` |
| Card | unchanged (`child`) |
| Tabs | `tabItems`/`tabTitles` plumbing unchanged in component; input rename only where it read `tabItems` |
| Divider | `direction` → `axis` |
| Modal | `entryPointChild`/`contentChild` → `trigger`/`content` |
| Button | `primary: boolean` → `variant: 'default'\|'primary'\|'borderless'` (class map) |
| CheckBox | `checked` → `value` (two-way emit path unchanged via `emitBinding`) |
| TextField | `text` → `value`; `textFieldType` → `variant` (drop `date` — DateTimeInput owns dates); keep `validationRegexp` as pass-through attr (enforced Phase 3) |
| DateTimeInput | `value` required; add `min`/`max` |
| ChoicePicker (was MultipleChoice) | `selections` → `value`; `maxAllowedSelections` → `variant` (`mutuallyExclusive` = radio-like single, `multipleSelection` = multi); add `displayStyle` (`checkbox`\|`chips` — chips = existing chip styling), `filterable` (text filter input when true) |
| Slider | `minValue`/`maxValue` → `min`/`max`; drop `step` input |

- [ ] Specs first per component (`npx nx test chat -- --run catalog`), then implement, then green.
- [ ] Update `catalog/index.ts` registry (`MultipleChoice` key → `ChoicePicker`) and `a2uiBasicCatalog()` docs.
- [ ] Commit per logical group (layout, media, inputs).

### Task 10: chat glue + public API

**Files:** Modify `libs/chat/src/lib/a2ui/envelope-normalizer.ts` (+spec), `partial-args-bridge.ts` (+spec), `build-action-message.ts` (+spec), `action-label.ts` (+spec), `views.ts`/`component-view.ts` (+specs), `a2ui-default-fallback.component.ts`, `surface.component.ts` (+spec), `libs/chat/src/lib/streaming/content-classifier.ts` (+spec), `libs/chat/src/lib/compositions/chat/chat.component.ts` (envelope-key sniffer), `libs/chat/src/public-api.ts`.

- [ ] `envelope-normalizer`: `ENVELOPE_KEYS = ['createSurface','updateComponents','updateDataModel','deleteSurface']`; same four arg shapes.
- [ ] `partial-args-bridge`: envelope-key list update; emission gating reviewed for "createSurface before components" ordering (was beginRendering-last).
- [ ] `build-action-message`: emit v0.9 client action — `{ version: 'v0.9', action: { name, surfaceId, sourceComponentId, timestamp, context } }`, context now a plain object built from the (already-resolved) `a2ui:event` params; label derivation now reads Button `child` → Text `text` **bare string**.
- [ ] `action-label`: parse the new serialized action JSON shape.
- [ ] `component-view`: `type` comes from `component` string; `def` type becomes flat `A2uiComponent`.
- [ ] `content-classifier` + `chat.component.ts`: sniff the new envelope keys (`createSurface`/`updateComponents`/`updateDataModel`/`deleteSurface`) in wrapped content; `---a2ui_JSON---` prefix unchanged.
- [ ] `public-api.ts`: re-export updates (ChoicePicker component, removed names).
- [ ] `npx nx test chat` fully green; `npx nx run chat:build` green; `npm run generate-api-docs`; commit.

### Task 11: Python — examples/chat + examples/ag-ui (kept byte-identical pairs)

**Files:** Modify in BOTH `examples/chat/python/src/` and `examples/ag-ui/python/src/`: `schemas/a2ui_v1.py` → rename `schemas/a2ui_v09.py`; `streaming/envelope_tool.py`; `streaming/envelope_normalizer.py`; `streaming/a2ui_partial_handler.py` (key list only); `graph.py`; tests under `python/tests/`.

- [ ] Failing pytest first (`test_envelope_tool.py`, `test_envelope_normalizer.py`, `test_graph_smoke.py`): assert v0.9 envelopes — `version` field present, `createSurface` emitted first, components flat, root id present, no `beginRendering`.
- [ ] `a2ui_v09.py`: regenerate the schema prompt from the official message + basic-catalog schema (structure mirrors the old prompt: one-of envelope, per-component prop docs, bare literals, `{path}` binding, children forms, `action.event`). Cross-check every prop against the downloaded schema.
- [ ] `envelope_tool.py`: pydantic `Envelope` with optional `createSurface`/`updateComponents`/`updateDataModel`/`deleteSurface` + `version` default `'v0.9'`; docstring ordering rule: `createSurface` first, then `updateComponents` containing `root` early, then data.
- [ ] `graph.py`: reorder logic — ensure `createSurface` is emitted/slotted first and a root component exists in the first `updateComponents`; `A2UI_PREFIX` unchanged.
- [ ] `pytest examples/chat/python examples/ag-ui/python` green; `diff -r` the paired files byte-identical; commit.

### Task 12: cockpit graphs

**Files:** Modify `cockpit/chat/a2ui/python/src/graph.py`, `cockpit/ag-ui/a2ui/python/src/graph.py`, sync `deployments/ag-ui-dev/deps/a2ui/src/graph.py` (byte-identical to cockpit ag-ui copy). Cockpit examples stay standalone — duplicate, don't share.

- [ ] `ALLOWED_COMPONENTS` + pydantic `A2uiComponent` model: flat shape (`component: str` + props), drop single-key validator; `MultipleChoice` → `ChoicePicker`.
- [ ] `_SurfaceSpec`/`BookingFormSpec`/`FlightResultsSpec`/`ConfirmationSpec` wrappers now emit v0.9 envelopes (`createSurface` + `updateComponents` with root + `updateDataModel` path/value).
- [ ] System prompts (`_BUILD_FORM_SYSTEM_TMPL`, `_SEARCH_FLIGHTS_SYSTEM`) rewritten: flat component examples, bare literals, `children: [...]`, `action.event`.
- [ ] Python tests (if any per graph) + `pytest` green; commit.

### Task 13: fixtures + e2e

**Files:** Modify `examples/chat/angular/e2e/fixtures/a2ui-surface.json`, `contact-form.json`; byte-identical copies in `examples/ag-ui/angular/e2e/fixtures/`; `cockpit/chat/a2ui/angular/e2e/fixtures/c-a2ui.json`; byte-identical `cockpit/ag-ui/a2ui/angular/e2e/fixtures/a2ui.json`; the four e2e specs + manual harnesses if they assert wire strings.

- [ ] Regenerate fixture payloads in v0.9 shape (hand-translate; keep aimock entry ordering — `hasToolResult:true` entry BEFORE the plain `userMessage` entry).
- [ ] Kill orphaned dev servers on :4200/:2024 first; run `examples/chat` a2ui e2e, then the ag-ui twin (both must be updated together), then cockpit c-a2ui e2e (chat + ag-ui). All green; commit.

### Task 14: docs

**Files:** Modify `apps/website/content/docs/a2ui/**` (7 pages), `apps/website/content/docs/chat/a2ui/**` (4 pages), `apps/website/content/docs/render/concepts/json-render-vs-a2ui.mdx`, `apps/website/content/docs/chat/api/content-classifier.mdx`, `libs/chat/README.md`, root `README.md`, `examples/*/README.md`; regenerate both `api-docs.json` via `npm run generate-api-docs`.

- [ ] Rewrite protocol snippets to v0.9 (envelopes, flat components, bare literals, root-id, ChoicePicker, MIME type); message-protocol.mdx is the envelope reference — mirror the design doc's diff table.
- [ ] Website builds: `npx nx build website` (or the repo's docs check); docs e2e (`docs.spec.ts`) selectors still pass; commit.

### Task 15: verification + PR

- [ ] `npx nx affected -t lint test build` — zero lint **errors** (strip ANSI before grepping), all tests green, builds green including one example prod build (`npx nx build chat-example --configuration=production` per strict:false footgun note; Maps env var not needed locally for build).
- [ ] Live Chrome gate: serve examples/chat with real `OPENAI_API_KEY` **only** (do not source whole .env — AG_UI_INTERNAL_TOKEN 401 trap), drive a generative-UI prompt in Chrome, verify a surface renders and a Button action round-trips; screenshot as proof. Repeat spot-check on cockpit c-a2ui.
- [ ] PR to main: title `feat(a2ui)!: migrate to A2UI v0.9.1 stable wire format`, body = design-doc summary + verification evidence. Merge on green per repo convention (Vercel is the only required check; address AI review comments; arm auto-merge).

## Self-review notes

- Spec coverage: design §Phase 1 items 1–5 map to Tasks 1–6 (libs/a2ui), 7–10 (renderer), 11–12 (Python), 13 (fixtures), 14 (docs), 15 (exit criteria). Phases 2–4 intentionally deferred to their own plans.
- Type consistency: `A2uiPathRef`/`A2uiFunctionCall`/`A2uiChildren`/`A2uiAction` names used consistently across Tasks 1, 3, 8; `A2uiComponentView.def` flat-component change appears in Tasks 7 and 10.
- Known judgment calls encoded: incremental `updateComponents` merge (v0.9) vs old replace; catalog `gap`/`step`/`width`/`height` prop drops (not in official schema); TextField `date` variant removed.
