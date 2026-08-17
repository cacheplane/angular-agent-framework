# A2UI v0.9 Phase 4 — sendDataModel Round-Trip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the `createSurface.sendDataModel` round-trip: outbound action messages attach the **live** per-surface data model (user edits included, internal keys stripped), and hosts get a typed `a2uiClientCapabilities()` helper for catalog negotiation metadata.

**Architecture:** Phase 1 already attaches `metadata.a2uiClientDataModel` when `surface.sendDataModel` — but from the agent-seeded snapshot. Phase 3 gave `<a2ui-surface>` the live store; this phase passes the merged live model (minus the reserved `_a2uiChecks` key) into `buildA2uiActionMessage`, and adds a tiny capabilities helper. Base: main after #819.

---

### Task 1: live model in the action metadata

**Files:** Modify `libs/chat/src/lib/a2ui/surface.component.ts` (+spec).

- [ ] Failing spec: a surface created with `sendDataModel: true` whose bound TextField was edited via the live store → emitted action's `metadata.a2uiClientDataModel.surfaces[surfaceId]` contains the live-typed value and does NOT contain `_a2uiChecks`.
- [ ] Implement: in the `a2ui:event` success path, call `buildA2uiActionMessage({...params, context}, { ...surf, dataModel: publicModel })` where `publicModel` = merged live model with `_a2uiChecks` removed. Green + commit.

### Task 2: capabilities helper

**Files:** Create `libs/chat/src/lib/a2ui/capabilities.ts` (+spec); modify `libs/chat/src/public-api.ts`.

- [ ] `a2uiClientCapabilities(): A2uiClientCapabilities` returning `{ supportedCatalogIds: [A2UI_BASIC_CATALOG_ID] }` — the typed metadata hosts attach to requests for catalog negotiation. Export + api-docs.

### Task 3: prompts + docs

**Files:** `examples/*/python/src/schemas/a2ui_v09.py` twins (sendDataModel note), `apps/website/content/docs/a2ui/guides/message-protocol.mdx` + `chat/a2ui/overview.mdx` (live-model metadata wording), `npm run generate-api-docs`.

### Task 4: verification + PR

- [ ] `nx run-many -t lint test build -p a2ui chat`; pytest twins; affected sweep.
- [ ] Live Chrome smoke: prompt for a `sendDataModel: true` form; submit and verify (via thread state) that the outbound action carries `metadata.a2uiClientDataModel` with the live-typed values.
- [ ] PR `feat(a2ui): live sendDataModel round-trip + capabilities helper (Phase 4)`; merge on green.
