# A2UI Stable (v0.9.1) Migration

**Date:** 2026-08-17
**Status:** Approved
**Scope:** `libs/a2ui`, `libs/chat/src/lib/a2ui/**`, `libs/chat` streaming/content-classifier, example-app Python graphs + schema prompts (`examples/chat`, `examples/ag-ui`), cockpit a2ui graphs (`cockpit/chat/a2ui`, `cockpit/ag-ui/a2ui`, `deployments/ag-ui-dev/deps/a2ui`), e2e fixtures, website docs (`apps/website/content/docs/a2ui/**`, `chat/a2ui/**`).
**Supersedes:** the wire shape adopted in `2026-05-09-a2ui-v1-protocol-migration-design.md`.

## Goal

Migrate Threadplane's A2UI implementation from the shape we call "v1" (`beginRendering`/`surfaceUpdate`/`dataModelUpdate`, type-keyed component wrappers, `literalString` wrappers, `children.explicitList`) — now classified upstream as the deprecated v0.8-legacy lineage — to the **A2UI v0.9.1 stable release** (the current production protocol family), implemented to **full conformance**: wire re-shape plus client-side functions, validation checks, and the `sendDataModel` round-trip. Types and internals are structured so the v1.0 release candidate's additions (`callRendererFunction`, `agentFunctionResponse`, embedded `createSurface` trees, `actionResponse`) slot in without another breaking rewrite.

Strategy: **Approach A — phased cutover.** Phase 1 is one atomic breaking re-shape across the whole repo (clean cutover, no legacy support, same playbook as the May migration). Phases 2–4 are additive, individually releasable PRs. Each phase: own branch/PR, merge on green, live Chrome verification for renderer-visible phases.

## Wire-format diff (current → v0.9.1)

### Envelopes

Every envelope gains a required `"version": "v0.9"` field (v0.9.1 is a spec patch — it standardizes the `application/a2ui+json` MIME type but does not bump the wire version).

```
current                              →   v0.9.1
{ surfaceUpdate: {surfaceId, components} }   { version:'v0.9', updateComponents: {surfaceId, components} }
{ dataModelUpdate: {surfaceId, path?, contents} }   { version:'v0.9', updateDataModel: {surfaceId, path?, value?} }
{ beginRendering: {surfaceId, root, styles?} }      (removed — no commit point; see Rendering below)
(no equivalent)                      { version:'v0.9', createSurface: {surfaceId, catalogId, theme?, sendDataModel?} }
{ deleteSurface: {surfaceId} }       { version:'v0.9', deleteSurface: {surfaceId} }
```

`updateDataModel` semantics: `path` defaults to `/` (whole-model replace); **omitted `value` deletes** the key at `path` (array indices are set to undefined, preserving length).

Client → agent messages:

- **Action:** `{ action: { name, surfaceId, sourceComponentId, timestamp, context } }` — `context` is a plain object (not the current array of typed entries).
- **Error (Phase 3):** `{ error: { code, surfaceId, path, message } }`.
- **Capabilities / data model metadata (Phase 4):** `a2uiClientCapabilities { supportedCatalogIds, inlineCatalogs? }`, `a2uiClientDataModel { surfaces: { [surfaceId]: model } }`.

### Rendering model

No `beginRendering`. `createSurface` opens the surface; components arrive via `updateComponents`; **the component whose `id` is `"root"`** is the tree root. Per spec: rendering can begin as soon as `root` is defined; other components are buffered until then, and the tree fills in progressively. The surface store's deferral gate moves from "wait for beginRendering" to "wait for root".

### Component shape

Flat — type is a string, props are direct:

```json
{ "id": "btn", "component": "Button", "child": "btn-text", "variant": "primary", "action": { "event": { "name": "submit" } } }
```

(current shape nests under a type-keyed wrapper: `{ "component": { "Button": { ... } } }`)

### Dynamic values

Bare literals; wrapping only for bindings and (Phase 2) function calls:

```json
"text": "Hello"                    // literal — no literalString wrapper
"text": { "path": "/title" }       // JSON-pointer binding (absolute) or relative in templates
"text": { "call": "formatString", "args": { ... } }   // Phase 2
```

The `isLiteralString/Number/Boolean` guards and wrappers are deleted; `isPathRef` stays; a new `isFunctionCall` guard is added.

### Children

```json
"children": ["a", "b"]                            // was { explicitList: [...] }
"children": { "path": "/items", "componentId": "row-template" }   // was { template: { dataBinding, componentId } }
```

### Actions

```json
"action": { "event": { "name": "submit", "context": { "flightId": { "path": "/selected" } } } }
"action": { "functionCall": { "call": "openUrl", "args": { "url": "..." } } }   // Phase 2
```

(current: `action: { name, context: [ {key, value} ] }` directly on the component)

### Catalog changes (basic catalog, exact spec props)

- **Text** — `text` (required), `variant`: h1–h5|caption|body.
- **Image** — `url` (required), `description`, `fit`: contain|cover|fill|none|scaleDown, `variant`: icon|avatar|smallFeature|mediumFeature|largeFeature|header.
- **Icon** — `name` (enum, svgPath object, or binding).
- **Video** — `url`. **AudioPlayer** — `url`, `description`.
- **Row/Column** — `children`, `justify`, `align` (spec enums).
- **List** — `children`, `direction`: vertical|horizontal, `align`.
- **Card** — `child` (required).
- **Tabs** — `tabs: [{ title, child }]` (replaces `tabItems`).
- **Modal** — `trigger` + `content` (replaces `entryPointChild`/`contentChild`).
- **Divider** — `axis`.
- **Button** — `child` (required — no text prop), `variant`: default|primary|borderless, `action` (required).
- **TextField** — `label` (required), `value`, `variant`: shortText|longText|number|obscured, `validationRegexp`.
- **CheckBox** — `label` (required), `value` (required).
- **ChoicePicker** — replaces **MultipleChoice**: `options: [{label, value}]`, `value` (DynamicStringList), `variant`: mutuallyExclusive|multipleSelection, `displayStyle`: checkbox|chips, `filterable`, `label`.
- **Slider** — `value` (required), `max` (required), `min` (default 0), `label`.
- **DateTimeInput** — `value` (required, ISO 8601), `enableDate`, `enableTime`, `min`, `max`, `label`.

During Phase 1 implementation, types and the schema prompt are validated against the official machine-readable catalog schema at `a2ui.org/specification/v0_9/catalogs/basic/catalog.json`, not just the prose docs.

## Phases

### Phase 1 — wire-format cutover (breaking; the migration proper)

One PR. No legacy acceptance, no dual shapes.

1. **`libs/a2ui`** — rewrite `types.ts` to the v0.9 vocabulary (`A2uiCreateSurface`, `A2uiUpdateComponents`, `A2uiUpdateDataModel`, `A2uiDeleteSurface`; flat `A2uiComponent`; new dynamic-value/children/action types; client message types; `A2UI_MIME_TYPE = 'application/a2ui+json'` and `A2UI_WIRE_VERSION = 'v0.9'` constants). Parser mechanics (JSONL buffering, malformed-line skip) unchanged; typed to the new union; tolerant of unknown envelope keys (forward-compat with v1.0 messages — unknown envelopes are skipped, not errors). `resolveDynamic` handles bare literals + `{path}`; `{call}` returns `undefined` until Phase 2 (typed now). Guards updated. Pointer utils unchanged.
2. **`libs/chat` renderer** — surface store re-gated on `createSurface` + root-id buffering; `surface-to-spec` consumes flat components; catalog components re-propped per the table above; `MultipleChoice` → `ChoicePicker` (rename + variant/displayStyle support at parity level); Tabs/Modal/Button/TextField/Image/Text prop updates; `build-action-message` emits the spec client action (`context` object, `timestamp`, `sourceComponentId`); `action-label`, `extract-bindings`, `views`, `envelope-normalizer`, `partial-args-bridge`, `content-classifier` updated to the new keys. Public API renames documented in the changelog; api-docs regenerated.
3. **Python emitters** — `A2UI_V1_SCHEMA_PROMPT` → new `A2UI_V09_SCHEMA_PROMPT` generated to match the official schema (both example apps, kept byte-identical); `envelope_tool.py` pydantic models re-shaped; `envelope_normalizer.py` `_ENVELOPE_KEYS` updated; graph envelope-ordering logic switches from "beginRendering into slot 2" to "createSurface first, root early"; cockpit `c-a2ui` graphs' structured-output specs (`BookingFormSpec` etc.) re-emit flat components + v0.9 envelopes; `deployments/ag-ui-dev/deps/a2ui` copy synced.
4. **Fixtures & tests** — all 6 e2e fixtures regenerated in the new shape (respecting the aimock tool-result-ordering rule); TS + Python unit tests updated alongside each module (TDD: shape tests first).
5. **Docs** — the 13 a2ui/chat-a2ui MDX pages, READMEs, and generated api-docs updated to describe v0.9.1 only.

**Exit criteria:** libs lint/test/build green; both example apps' e2e green (chat + ag-ui twins); cockpit a2ui e2e green; live Chrome smoke on examples/chat and the c-a2ui cockpit against a real LLM key renders a surface and round-trips a button action.

### Phase 2 — client-side functions (additive)

- `resolveDynamic` gains a **function registry**: standard functions `formatString` (with `${...}` interpolation, absolute/relative paths, nested calls, `\${` escape), `formatNumber`, `formatCurrency`, `formatDate`, `pluralize`, `and`, `or`, `not`. Registry is an injectable map so custom catalogs can extend it and v1.0's object-map function schemas can layer on.
- `action.functionCall` support in the renderer with `openUrl` as the standard local action (new-tab, rel=noopener).
- Schema prompt + docs updated to advertise functions.

### Phase 3 — validation checks (additive)

- `checks: [{ call, args, message }]` on input components; standard validators `required`, `regex`, `length`, `numeric`, `email` (plus TextField `validationRegexp`).
- Catalog input components display validation errors (existing `--tplane-*`/`--ds-*` token styling); invalid state blocks the enclosing action's event emission per spec.
- Client → agent `error` message (`VALIDATION_FAILED` etc.) wired through the surface component's outputs.

### Phase 4 — sendDataModel round-trip (additive)

- Honor `createSurface.sendDataModel`: when true, outgoing action messages carry `a2uiClientDataModel` (per-surface current model snapshot).
- `a2uiClientCapabilities` (supported catalog ids, inline catalogs) exposed as typed metadata the host app can attach to requests; the chat transports pass it through where the wire allows.
- Docs + schema prompt updates; live verification that agent-side graphs can read the round-tripped model.

## Error handling

- Parser: malformed JSONL lines skipped (unchanged); unknown envelope keys skipped (v1.0 forward-compat); envelopes for unknown surfaces buffered as today.
- Store: components for an unopened surface / missing root are buffered, never thrown; unknown component types render the default fallback.
- Resolver: unresolvable paths → `undefined` (progressive rendering per spec); unknown functions → `undefined` + one-time console warn.
- Validation (Phase 3): failed checks block event emission and emit the spec `error` message; never throw.

## Testing

- TDD per module. Unit: types compile-time assertions, parser envelope tests, resolver (literals/paths/functions), pointer delete-semantics (omitted `value`, array index), store root-buffering, per-catalog-component render tests, action-message shape.
- Python: envelope tool/normalizer/graph smoke tests re-shaped.
- E2E: existing a2ui specs over regenerated fixtures; remember aimock replay is ~atomic — incremental-update behavior (root-buffering) gets component-level vitest coverage, not e2e.
- Live gate per phase (renderer-visible phases): real-LLM serve + Chrome MCP drive, per the live-LLM smoke-gate practice.

## Out of scope

- v1.0 candidate features (`callRendererFunction`/`agentFunctionResponse`/`actionResponse`, embedded `createSurface` trees, strict UAX #31 identifier enforcement) — types are structured to accommodate them, not implemented.
- Custom/inline catalog *authoring* support beyond the typed metadata (Phase 4 types only).
- Theme schema rendering (`primaryColor`/`iconUrl`/`agentDisplayName`) — parsed and stored, surfaced to hosts, but no new theming engine; existing token styling stays.
- Any backward compatibility with the pre-migration shape.
