# `@ngaf/a2ui` v1 Protocol Migration

**Date:** 2026-05-09
**Status:** Approved
**Scope:** `libs/a2ui`, `libs/chat/src/lib/a2ui/**`, `examples/chat/python/src/graph.py`
**Builds on:** PRs #226 #227 (Phase 4 of canonical examples/chat demo, currently using v0.9 envelopes)
**Forcing function for:** Phase 5 (GenUI dropdown + dynamic schema generation via sub-LLM) — that work depends on the canonical v1 schema being the lib's native shape so the schema-doc system prompt to the sub-LLM matches what the parser eats.

## Goal

Migrate `@ngaf/a2ui` from the older v0.9 envelope shape (`createSurface`/`updateComponents`/`updateDataModel`) to the canonical Google A2UI v1 protocol (`surfaceUpdate`/`dataModelUpdate`/`beginRendering`/`deleteSurface`). Single PR, no backward compatibility — the lib is unreleased internally, so a clean cutover beats dual-shape support.

## Why now

Phase 4 shipped a working A2UI render path against v0.9. Phase 5 will replace the hardcoded `FEEDBACK_FORM_JSONL` with a dynamic sub-LLM that emits the schema directly. For the sub-LLM pattern to be reliable, the schema in its system prompt must match what the parser actually eats. Choosing the canonical v1 shape now means:

- The sub-LLM's system prompt becomes the public spec, not a homegrown variant.
- Future external consumers of `@ngaf/a2ui` get the canonical wire format, not a snowflake.
- Catalog components match the v1 component contract, ready for any v1-conformant agent.

## Wire-format diff (v0.9 → v1)

### Envelopes

```
v0.9                              →   v1
{ createSurface: { ... } }            { surfaceUpdate: { ... } }
{ updateComponents: { ... } }         (folded into surfaceUpdate.components)
{ updateDataModel: { ... } }          { dataModelUpdate: { ... } }
(no equivalent)                       { beginRendering: { ... } }   ← new commit point
{ deleteSurface: { surfaceId } }      { deleteSurface: { surfaceId } }   (unchanged)
```

`beginRendering` is the new explicit commit point — `surfaceUpdate` defines components and `dataModelUpdate` seeds state, but neither renders. The parser **defers** all surface mutations until `beginRendering` arrives, then commits atomically. This eliminates partial-render flicker and matches the canonical interpretation.

### Component shape

v0.9 components were flat:

```json
{ "id": "btn", "component": "Button", "label": "Submit", "action": { "event": { "name": "submit" } } }
```

v1 nests properties under a type-keyed wrapper, and `Button` no longer has a `label` (use a child `Text` component):

```json
{ "id": "btn", "component": { "Button": { "child": "btn-text", "action": { "name": "submit" } } } }
{ "id": "btn-text", "component": { "Text": { "text": { "literalString": "Submit" } } } }
```

### Dynamic values always wrapped

v0.9 mixed literals and path refs:

```json
{ "text": "Hello" }              // literal
{ "text": { "path": "/title" } }  // path ref
```

v1 always wraps:

```json
{ "text": { "literalString": "Hello" } }
{ "text": { "path": "/title" } }
{ "rating": { "literalNumber": 5 } }
{ "consent": { "literalBoolean": true } }
```

Stricter, but trivial for the parser and removes ambiguity.

### Children always wrapped

v0.9: `children: ['a', 'b']` (or template object).
v1: `children: { explicitList: ['a', 'b'] }` (or `{ template: { componentId, dataBinding } }`).

### Action context

v0.9: `action: { event: { name, context: { key: 'val' } } }`.
v1: `action: { name, context: [ { key, value: { literalString: 'val' } } ] }` — array of typed key-value pairs, value uses the same DynamicValue shape. Action is a direct property of the component, not nested under `event`.

### Card: single child

v0.9: `Card.children` (array). v1: `Card.child` (single id). Multi-child layouts wrap in `Column`/`Row`.

## Decisions for this migration

### 1. No backward compat

Reject. The lib has no released v0.9 consumers; supporting both shapes doubles the parser surface and bloats catalog component branches. Clean cutover.

### 2. Deferred-apply on `beginRendering`

The parser buffers `surfaceUpdate`/`dataModelUpdate` envelopes per `surfaceId`. When `beginRendering` arrives, it commits the buffer atomically to the surface store. `deleteSurface` clears both buffer and store. The chat composition's content classifier signals "render ready" only when at least one `beginRendering` has fired.

Subsequent updates after first render apply incrementally (the buffer is reset on each `beginRendering`).

### 3. Drop `CheckRule` validation extension

v1's canonical schema has no per-component `checks` field; client-side validation lives at the component level (e.g. `TextField.validationRegexp`). Our v0.9 had a custom `checks: [{condition, message}]` extension. Drop it. Phase 4's feedback-form had a `checks` block on TextField and Button — the v1 port relies on `TextField.validationRegexp` instead, plus button-disabled-when-empty handled in component logic.

### 4. Rename `ChoicePicker` → `MultipleChoice`

v1 spec uses `MultipleChoice` for choice selection (single or multi via `maxAllowedSelections`). v0.9 had a single-select `ChoicePicker`. Rename to align with the spec. Single-select expressed as `maxAllowedSelections: 1`. The catalog file is renamed; any consumer using the old name breaks (acceptable: lib unreleased).

### 5. Skip new components from canonical v1 spec

Out of scope for this PR: `Heading` (covered by `Text.usageHint=h1..h5`), and any other v1 components we don't currently have. Keep the catalog at its current 18 components, just rewritten for v1 property shapes. New v1 components ship in follow-up work.

## Library changes

### `libs/a2ui/src/lib/types.ts`

Full rewrite. Key types:

```ts
// Dynamic values — always wrapped in v1
export type DynamicString =
  | { literalString: string }
  | { path: string };

export type DynamicNumber =
  | { literalNumber: number }
  | { path: string };

export type DynamicBoolean =
  | { literalBoolean: boolean }
  | { path: string };

export type DynamicStringList =
  | { literalArray: string[] }
  | { path: string };

// Children
export type A2uiChildren =
  | { explicitList: string[] }
  | { template: { componentId: string; dataBinding: string } };

// Action — direct on component, not under `event`
export interface A2uiActionContextEntry {
  key: string;
  value: DynamicString | DynamicNumber | DynamicBoolean;
}

export interface A2uiAction {
  name: string;
  context?: A2uiActionContextEntry[];
}

// Component — type-keyed wrapper
export interface A2uiComponent {
  id: string;
  weight?: number;   // for Row/Column flex-grow
  component: A2uiComponentDef;
}

// Discriminated union of all component definitions
export type A2uiComponentDef =
  | { Text: A2uiText }
  | { Image: A2uiImage }
  | { Icon: A2uiIcon }
  | { Video: A2uiVideo }
  | { AudioPlayer: A2uiAudioPlayer }
  | { Row: A2uiRow }
  | { Column: A2uiColumn }
  | { List: A2uiList }
  | { Card: A2uiCard }
  | { Tabs: A2uiTabs }
  | { Divider: A2uiDivider }
  | { Modal: A2uiModal }
  | { Button: A2uiButton }
  | { CheckBox: A2uiCheckBox }
  | { TextField: A2uiTextField }
  | { DateTimeInput: A2uiDateTimeInput }
  | { MultipleChoice: A2uiMultipleChoice }
  | { Slider: A2uiSlider };

// Per-component property interfaces (sample subset)
export interface A2uiButton {
  child: string;          // id of the (Text) component to display
  primary?: boolean;
  action: A2uiAction;     // required
}

export interface A2uiText {
  text: DynamicString;
  usageHint?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body';
}

export interface A2uiTextField {
  label: DynamicString;
  text?: DynamicString;
  textFieldType?: 'date' | 'longText' | 'number' | 'shortText' | 'obscured';
  validationRegexp?: string;
}

export interface A2uiCard {
  child: string;          // single child id
}

export interface A2uiMultipleChoice {
  selections: DynamicStringList;
  options: { label: DynamicString; value: string }[];
  maxAllowedSelections?: number;
}

// Envelopes
export interface A2uiSurfaceUpdate {
  surfaceId: string;
  components: A2uiComponent[];
}

export interface A2uiDataModelEntry {
  key: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueMap?: A2uiDataModelEntry[];
}

export interface A2uiDataModelUpdate {
  surfaceId: string;
  path?: string;          // optional sub-tree path
  contents: A2uiDataModelEntry[];
}

export interface A2uiBeginRendering {
  surfaceId: string;
  root: string;           // root component id
  styles?: { font?: string; primaryColor?: string };
}

export interface A2uiDeleteSurface {
  surfaceId: string;
}

export type A2uiMessage =
  | { surfaceUpdate: A2uiSurfaceUpdate }
  | { dataModelUpdate: A2uiDataModelUpdate }
  | { beginRendering: A2uiBeginRendering }
  | { deleteSurface: A2uiDeleteSurface };
```

### `libs/a2ui/src/lib/parser.ts`

Update `ENVELOPE_KEYS` and dispatch:

```ts
const ENVELOPE_KEYS = ['surfaceUpdate', 'dataModelUpdate', 'beginRendering', 'deleteSurface'] as const;
```

Parser remains JSONL-line-based; each line is one envelope. No structural change to the line-tokenizer.

### `libs/chat/src/lib/a2ui/surface-store.ts`

Refactor for deferred apply:

- Buffer `surfaceUpdate.components` and `dataModelUpdate` per `surfaceId` (not yet visible to consumers).
- On `beginRendering`: atomically commit buffered changes to the public surface map; emit a single change notification.
- On `deleteSurface`: clear both buffer and committed surface.
- Surfaces only appear in `store.surfaces()` after their first `beginRendering`.

### `libs/chat/src/lib/a2ui/build-action-message.ts`

Outbound `A2uiActionMessage` schema also follows v1 (action context as `[{key, value: DynamicValue}]`). Update the construction to use the wrapped DynamicValue shape:

```ts
function toDynamicValue(v: unknown): unknown {
  if (typeof v === 'string') return { literalString: v };
  if (typeof v === 'number') return { literalNumber: v };
  if (typeof v === 'boolean') return { literalBoolean: v };
  return { literalString: String(v) };
}
```

### `libs/chat/src/lib/a2ui/catalog/*.ts` (18 components)

Each component reads its props from the v1 nested-wrapper shape. Examples:

- `TextField`: input is a `DynamicString` → component resolves `text.literalString` or `text.path` via the surface store.
- `Card`: `child` is a single id, not a list — template iterates one id.
- `Button`: child renders the inner Text component; `label` input removed.
- `Row`/`Column`/`List`: `children` reads `explicitList` or `template`.
- `MultipleChoice`: replaces `ChoicePicker`; `selections: DynamicStringList`, `maxAllowedSelections` enforced in the change handler.

A small helper `resolveDynamic<T>(value, store): T` (already present in `libs/a2ui/src/lib/resolve.ts` — verify it handles new shapes) extracts the literal or path-resolved value uniformly.

### `libs/chat/src/lib/streaming/content-classifier.ts`

`A2UI_PREFIX` stays `---a2ui_JSON---`. The classifier passes JSONL lines to the parser as before; only envelope key set changes.

## Demo (examples/chat/python/src/graph.py)

Rewrite `FEEDBACK_FORM_JSONL` in v1 shape. Replaces v0.9 (`createSurface`/`updateComponents`/`updateDataModel`) with v1 (`surfaceUpdate`/`dataModelUpdate`/`beginRendering`):

```python
FEEDBACK_FORM_JSONL = "\n".join([
    json.dumps({"surfaceUpdate": {
        "surfaceId": "feedback",
        "components": [
            {"id": "root", "component": {"Card": {"child": "main-column"}}},
            {"id": "main-column", "component": {"Column": {
                "children": {"explicitList": ["title", "name-field", "rating-picker", "submit-btn"]},
            }}},
            {"id": "title", "component": {"Text": {
                "text": {"literalString": "Quick feedback"},
                "usageHint": "h3",
            }}},
            {"id": "name-field", "component": {"TextField": {
                "label": {"literalString": "Your name"},
                "text": {"path": "/name"},
                "textFieldType": "shortText",
            }}},
            {"id": "rating-picker", "component": {"MultipleChoice": {
                "selections": {"path": "/rating"},
                "options": [
                    {"label": {"literalString": "1"}, "value": "1"},
                    {"label": {"literalString": "2"}, "value": "2"},
                    {"label": {"literalString": "3"}, "value": "3"},
                    {"label": {"literalString": "4"}, "value": "4"},
                    {"label": {"literalString": "5"}, "value": "5"},
                ],
                "maxAllowedSelections": 1,
            }}},
            {"id": "submit-btn-text", "component": {"Text": {
                "text": {"literalString": "Submit feedback"},
            }}},
            {"id": "submit-btn", "component": {"Button": {
                "child": "submit-btn-text",
                "primary": True,
                "action": {
                    "name": "feedbackSubmit",
                    "context": [
                        {"key": "surface", "value": {"literalString": "feedback"}},
                    ],
                },
            }}},
        ],
    }}),
    json.dumps({"dataModelUpdate": {
        "surfaceId": "feedback",
        "contents": [
            {"key": "name", "valueString": ""},
            {"key": "rating", "valueString": "5"},
        ],
    }}),
    json.dumps({"beginRendering": {
        "surfaceId": "feedback",
        "root": "root",
    }}),
]) + "\n"
```

This stays as Phase 4's golden integration test. Phase 5 deletes it once the dynamic-schema path is in place.

## TDD scope

Each layer gets unit tests:

- `libs/a2ui/src/lib/parser.spec.ts` — 4 envelope shapes parse correctly; malformed lines logged and skipped; partial JSONL across `\n` handled.
- `libs/a2ui/src/lib/{resolve,functions,validate,pointer,guards}.spec.ts` — DynamicValue resolution against new wrapped shapes.
- `libs/chat/src/lib/a2ui/surface-store.spec.ts` — deferred apply: buffered updates not visible until `beginRendering`; atomic commit; `deleteSurface` clears both buffer and surface.
- `libs/chat/src/lib/a2ui/build-action-message.spec.ts` — outbound action serializes context as `[{key, value: DynamicValue}]`.
- `libs/chat/src/lib/a2ui/catalog/*.spec.ts` — each catalog component renders from the new property shape; `MultipleChoice` enforces `maxAllowedSelections`.
- `libs/chat/src/lib/streaming/content-classifier.spec.ts` — A2UI detection unchanged; v1 JSONL flows end-to-end into the surface-store.

## Live smoke (Chrome MCP)

Per the user's directive — exercise the Phase 4 feedback-card welcome suggestion against the migrated lib + ported demo:

1. **Restart backend + Angular dev server** (workspace-linked libs pick up the migration).
2. **Reload demo at `/embed`**, click "Demo: render an interactive A2UI surface".
3. **Verify**: `agent.messages()` shows the `render_demo_form` tool_call, ToolMessage("rendered"), and final AIMessage starting with `---a2ui_JSON---\n` containing v1 envelopes (`surfaceUpdate` / `dataModelUpdate` / `beginRendering`).
4. **Verify**: `<a2ui-surface>` mounts the Card titled "Quick feedback" with a TextField, a MultipleChoice (5 options), and a Submit button.
5. **Verify**: action round-trip — clicking Submit emits an `A2uiActionMessage` whose `action.context[0]` is `{ key: 'surface', value: { literalString: 'feedback' } }`; chat re-submits as a JSON-stringified user message; AI responds conversationally.
6. **Verify**: zero console errors; no parse failures on JSONL across the SSE boundary.

If any check fails, that's a finding for in-PR fix-up before merge.

## Out of scope (deferred)

- **New v1 components** (Heading, etc.) not currently in our catalog.
- **`A2uiTheme` migration to `beginRendering.styles`** — for this PR the existing surface-level theme stays a no-op; v1's `styles: { font, primaryColor }` on `beginRendering` is the canonical home but no consumer reads it yet. Future work.
- **Form-input back-propagation (Finding K from Phase 4)** — orthogonal lib gap, will be tracked separately.
- **`A2uiMessageParser` schema validation** — current parser is permissive; tightening to reject malformed envelopes is follow-up.

## Files touched

| Path | Change |
|---|---|
| `libs/a2ui/src/lib/types.ts` | Full rewrite for v1 type system. |
| `libs/a2ui/src/lib/parser.ts` | Update `ENVELOPE_KEYS` to v1 set. |
| `libs/a2ui/src/lib/{resolve,functions,validate,pointer,guards}.ts` | Adapt to wrapped DynamicValue shape. |
| `libs/a2ui/src/lib/{*.spec.ts}` | Tests for new shapes. |
| `libs/chat/src/lib/a2ui/surface-store.ts` | Buffer + deferred apply on `beginRendering`. |
| `libs/chat/src/lib/a2ui/surface-to-spec.ts` | v1 component-def → render Spec. |
| `libs/chat/src/lib/a2ui/build-action-message.ts` | Outbound action with wrapped DynamicValue. |
| `libs/chat/src/lib/a2ui/catalog/*.ts` (18 components) | Each rewritten for v1 property shape; `choice-picker` → `multiple-choice`. |
| `libs/chat/src/lib/a2ui/catalog/index.ts` | Update registry to use new component names. |
| `libs/chat/src/lib/a2ui/catalog/*.spec.ts` | Update tests for v1 shapes. |
| `libs/chat/src/lib/streaming/content-classifier.ts` | (probably no-op) — verify A2UI_PREFIX still triggers. |
| `examples/chat/python/src/graph.py` | Rewrite `FEEDBACK_FORM_JSONL` in v1 shape; smoke tests still pass. |
| `examples/chat/smoke/CHECKLIST.md` | Update Generative UI section with v1 envelope check. |
| `apps/website/content/docs/chat/api/api-docs.json` | Regenerate after type changes. |

Total ≈ 1500-1800 LOC across ~30 files.

## Phasing for the implementation plan

- Phase 0 — Branch creation
- Phase 1 — `libs/a2ui` types + parser + resolve helpers + their specs (TDD)
- Phase 2 — `libs/chat/src/lib/a2ui` surface-store + surface-to-spec + build-action-message + their specs
- Phase 3 — `libs/chat/src/lib/a2ui/catalog/*` 18 components + specs (mechanical port to v1 props)
- Phase 4 — Content classifier + chat composition wiring verification
- Phase 5 — `examples/chat/python/src/graph.py` `FEEDBACK_FORM_JSONL` rewrite in v1
- Phase 6 — Verification: build + lint + tests across the lib stack; server-side curl probe; **live Chrome MCP smoke against the workspace examples/chat demo** (per Phase 4's pattern). PR open + merge on green.
