# Client Tools — Plan Index

> Spec: `docs/superpowers/specs/2026-06-08-client-tools-design.md`

The spec spans six independently-testable subsystems. Per writing-plans guidance, each is its own plan that builds, tests, and commits on its own. Implement in dependency order:

| # | Plan | Builds | Depends on |
|---|---|---|---|
| 01 | **Render foundation** | `@threadplane/render`: `RenderViewEntry.schema/description`; `RenderResultEvent`; `injectRenderHost()` (`set`/`emit`/`result`) added **alongside** the existing `emit` (no removal yet) | — |
| 01b | **a2ui catalog migration** | Port the 5 a2ui catalog input components + `emit-binding.ts` off the `a2ui:datamodel:` string protocol onto `injectRenderHost().set()`; then delete the legacy string path (`applyDatamodelWrite`, `A2UI_DATAMODEL_PREFIX`, `coerceValue`, the `emit` input) | 01 |
| 02 | **Chat lib `tools()` + executor** | `tools()` + `action`/`view`/`ask`; JSON-Schema derivation from Standard Schema; `Agent.clientTools` capability type; the executor (against a fake adapter) | 01 |
| 03 | **Python `client-tools` middleware** | Published LangGraph middleware: bind client stubs + route-to-END on a client tool call; PyPI publishing infra | — (parallel) |
| 04 | **`@threadplane/ag-ui` adapter** | `clientTools` impl (native `RunAgentInput.tools` + `addMessage`/re-run); reducer `pending` detection | 02 |
| 05 | **`@threadplane/langgraph` adapter** | `clientTools` impl (catalog via run input + `ToolMessage` re-run) | 02, 03 |
| 06 | **Cockpit examples** | `cockpit/ag-ui/client-tools` + `cockpit/langgraph/client-tools` (python + angular), each demoing function/view/ask; e2e + docs + registry/manifest/ports wiring | 03, 04, 05 |

**Notes**
- Plan 01 is intentionally *additive* (the legacy `emit` keeps working) so every step stays green; the cross-lib string-protocol removal is isolated in **01b**. This is a small deviation from the spec's "port in one pass" — it sequences the risky cross-lib migration as its own reviewable plan. Flag if you'd rather fold 01b into 01.
- **TS LangGraph.js middleware** remains a separate future spec (not in this set).
- Each plan ends green (build + lint + its own tests) and commits. Patch-only versioning at 0.0.x for any `@threadplane/*` bump.
