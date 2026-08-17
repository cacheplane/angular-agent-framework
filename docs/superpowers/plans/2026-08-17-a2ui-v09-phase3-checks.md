# A2UI v0.9 Phase 3 — Validation Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement A2UI v0.9 client-side validation: `checks` rules on input components evaluate against **live user input**, failing checks display inline errors and block event actions, and the client emits the spec `error` message (`VALIDATION_FAILED`).

**Architecture:** Correct `A2uiCheck` to the official `CheckRule` shape (`{condition: DynamicBoolean, message}`); add the validator functions (`required`/`regex`/`length`/`numeric`/`email`) to the Phase-2 registry; `<a2ui-surface>` takes ownership of the render `StateStore` (seed-preserve pattern from `chat-generative-ui`) so event-time logic sees live values; at `a2ui:event` time the surface evaluates all checks against `dataModel ∪ store.getSnapshot()`, blocks + emits `A2uiErrorMessage` on failure, writes per-component messages to reserved store paths (`/_a2uiChecks/<id>`) that catalog inputs bind for reactive display, and resolves `{path}` action-context values live (fixing the pre-existing stale-context gap). Base: main after #818.

**Key discovered facts:** official `CheckRule` = `{condition, message}` (NOT `{call,args,message}` as typed in Phase 1 — unused, safe to correct); `render-spec` accepts a `[store]` input and `signalStateStore` exposes `getSnapshot()`; `invokeHandlers` passes action params raw (no dispatch-time binding resolution) — hence the surface must resolve live values itself.

---

### Task 1: types + validators (`libs/a2ui`)

**Files:** Modify `libs/a2ui/src/lib/types.ts` (+types.spec), `functions.ts` (+functions.spec), `index.ts`.

- [ ] `A2uiCheck` → `{ condition: DynamicValue; message: string }` (spec CheckRule); update the `A2uiCheckable` JSDoc.
- [ ] Failing specs for validators (exact arg schemas from `scratchpad/basic-catalog.json`): `required {value}` (false for null/undefined/''/[] — true otherwise), `regex {value, pattern}` (RegExp.test, string value required, invalid pattern → false), `length {value, min?, max?}`, `numeric {value, min?, max?}` (accepts numeric strings), `email {value}` (linear-safe pattern).
- [ ] Implement in the standard registry. Green + commit.

### Task 2: surface store ownership + live models

**Files:** Modify `libs/chat/src/lib/a2ui/surface.component.ts` (+spec).

- [ ] `<a2ui-surface>` creates one internal `signalStateStore({})`, seeds it from `spec().state` with the seeded-map preserve-user-edits semantics (copy of `chat-generative-ui`), passes `[store]` to `<render-spec>`.
- [ ] Spec: user write survives a spec re-emission; agent update to an untouched path lands.

### Task 3: live checks + event gating + error output

**Files:** Modify `libs/chat/src/lib/a2ui/surface.component.ts` (+spec), `surface-to-spec.ts` (+spec), checkable catalog components (`text-field`, `check-box`, `choice-picker`, `slider`, `date-time-input`) + specs.

- [ ] surface-to-spec: `{path}` **action-context** values stay as `{ $bindState: path }` markers (no build-time resolution); checkable components with `checks` (or TextField `validationRegexp` + path-bound value → synthesized regex rule) get `errorText: { $bindState: '/_a2uiChecks/<id>' }` prop.
- [ ] surface.component `a2ui:event` handler: build live model = `{...surface.dataModel, ...store.getSnapshot()}` (deep merge by pointer for written paths); resolve `$bindState` markers in `params.context` from the live model; evaluate every component's check rules (`resolveDynamic(rule.condition, liveModel, undefined, registry) === true` passes); on failure: write each failing component's first message to `/_a2uiChecks/<id>`, emit `error` output (`{version:'v0.9', error:{code:'VALIDATION_FAILED', surfaceId, path?, message}}`), do NOT emit the action; on success: clear `/_a2uiChecks/*` and emit as today.
- [ ] Catalog checkable components render `errorText` (small `--ds-*` error line + invalid styling) when non-empty.
- [ ] Specs cover: failing required check blocks + displays + emits error; fixing the value then re-clicking emits the action with the live context value.

### Task 4: prompts + docs + api-docs

**Files:** `examples/*/python/src/schemas/a2ui_v09.py` (byte-identical twins; add checks section with the CheckRule shape + validators), a2ui/chat docs pages that say checks are "typed but not enforced", `libs/a2ui/README.md`, `npm run generate-api-docs`.

### Task 5: verification + PR

- [ ] `nx run-many -t lint test build -p a2ui chat`; pytest twins; `nx affected -t lint test build`.
- [ ] Live Chrome smoke: prompt for a form with a required + email check; submit empty → inline error, no agent turn; fill valid → action round-trips with the typed values in context (verify via thread state).
- [ ] PR `feat(a2ui): validation checks + client error message (Phase 3)`; merge on green.
