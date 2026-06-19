# TypeScript DX Audit — Findings

**Date:** 2026-06-19 · **Scope:** `@threadplane/chat`, `ag-ui`, `langgraph`, `render` (302 public exports)
**Method:** TypeDoc extraction (`api-docs.json`) for JSDoc/signature grading across all exports + real `tsserver` quick-info probing for hover/inference on the authoring surface + source confirmation. See `2026-06-19-ts-dx-audit-design.md`.

## Executive summary

The public **type shapes and hovers are in good condition** — the IDE quick-info for the headline authoring APIs is clean and readable, and generic inference works where it's been wired (`action<S>`). The gap is almost entirely **inline guidance (JSDoc)** and a few **surface-hygiene + inference** items.

| Theme | Severity | One-line |
|---|---|---|
| **JSDoc: zero `@example` coverage** | 🔴 high | 0 of 66 public functions across the 4 libs carry an `@example`. |
| **JSDoc: undocumented params** | 🔴 high | 60 of 66 functions have ≥1 `@param` with no description. |
| **JSDoc: missing summaries** | 🟡 med | 21 functions + many option interfaces have no summary at all — incl. `provideChat`, `provideRender`, `provideViews`, `mockAgent`. |
| **Inference: `view`/`ask` don't infer component inputs** | 🟡 med | `schema: StandardSchemaV1` + `component: Type<unknown>` — no schema→component link, unlike `action<S>`. |
| **Surface hygiene: internal consts exported** | 🟡 med | 8 chat consts (`CHAT_MARKDOWN_STYLES`, 7 `ICON_*`) leak into the public API as raw string literals. |
| **Hover readability** | ✅ good | Headline symbols render clean quick-info; no `__type`/internal-generic leaks found. |

## Per-library grades

| Lib | exports | fns | no summary (fn) | undoc params (fn) | no `@example` (fn) | option ifaces w/o summary | hover |
|---|---|---|---|---|---|---|---|
| chat | 212 | 42 | 15 | 39 | 42 | 27/42 | ✅ |
| ag-ui | 10 | 5 | 1 | 4 | 5 | 1/4 | ✅ |
| langgraph | 43 | 9 | 1 | 8 | 7 | 4/20 | ✅ |
| render | 37 | 10 | 4 | 9 | 10 | 11/13 | ✅ |
| **total** | **302** | **66** | **21** | **60** | **66** | — | — |

## Findings

### F1 — Zero `@example` on the public function surface (🔴 high)
**Every** exported function across all four libs (66/66) lacks an `@example`. For an app-developer-facing framework, the hover example is the highest-leverage piece of guidance — it's what lets a dev use `view`/`action`/`provideChat`/`provideViews` without leaving the editor. Today the hover shows the signature + (sometimes) a one-line summary, never a usage snippet.
**Recommendation:** add a concise `@example` to the authoring surface first — `tools/action/view/ask`, `provideChat`, `provideAgent` (both adapters), `injectAgent`, `injectRenderHost`, `provideRender`, `provideViews`, `clientToolsChannel`, `injectThreadRouting`, `createAgentRef`, `mockAgent`. ~15 symbols cover the 80% path.

### F2 — Undocumented `@param`s (🔴 high)
60/66 functions have at least one parameter with no description. Example — `view`/`ask`/`action` have a summary but document none of `description` / `schema` / `component` / `handler`, so hovering a parameter shows only its type. `provideChat(config: ChatConfig)` doesn't describe `config`, and `ChatConfig`'s own members are largely undocumented (see F3).
**Recommendation:** `@param` lines on the authoring surface; for provider configs, prefer documenting the **option interface members** (richer hover at the call site) over the `@param` on the config bag.

### F3 — Missing summaries on entrypoints + option interfaces (🟡 med)
21 functions have no summary, including high-traffic ones: `provideChat`, `provideRender`, `provideViews`, `defineAngularRegistry`, `mockAgent`, `signalStateStore`, `getInterrupt`, and the message type-guards (`isUserMessage`/`isAssistantMessage`/`isSystemMessage`/`isToolMessage`/`isTyping`). Option/config interfaces are widely undocumented (chat 27/42, render 11/13) — these are exactly the objects a developer fills in, so undocumented members = blind authoring.
**Recommendation:** one-line summaries on the 21 functions; member docs on the public config interfaces (`ChatConfig`, render provider options, `AgentConfig`).

### F4 — `view`/`ask` don't infer component input types from the schema (🟡 med)
`action<S extends StandardSchemaV1>(desc, schema, handler)` correctly infers the handler's args from the schema (`StandardSchemaInferOutput<S>`). But `view(desc, schema, component: Type<unknown>)` and `ask(...)` are **not** generic — the component is `Type<unknown>`, so there's no compile-time link between the schema the model fills and the component's declared inputs. A developer can pass a component whose `@Input()`s don't match the schema with no type error.
**Recommendation (triage candidate, may touch signatures + type-tests):** make `view`/`ask` generic over the schema and constrain `component` to a `Type<>` whose inputs are assignable from `StandardSchemaInferOutput<S>`. Verify with type-tests. This is the one genuinely *type-level* improvement; everything else is docs/hygiene.

### F5 — Internal-only consts in the public surface (🟡 med)
8 chat exports are raw string-literal constants that read as internal implementation: `CHAT_MARKDOWN_STYLES` (a 6.8 KB CSS string) and `ICON_AGENT`/`ICON_CHECK`/`ICON_CHEVRON_DOWN`/`ICON_CHEVRON_UP`/`ICON_SEND`/`ICON_TOOL`/`ICON_WARNING` (inline SVG strings). They bloat the export list, produce noisy hovers, and imply a support contract.
**Recommendation:** mark `@internal` (and drop from `public-api.ts`) unless there's a deliberate theming/customization contract — if there is, document it; if not, remove from the surface.

### F6 — Hover readability is good (✅ — positive finding)
Real `tsserver` quick-info for the headline symbols is clean and faithful, e.g.:
- `view` → `function view(description: string, schema: StandardSchemaV1, component: Type<unknown>): ClientToolDef`
- `action` → `function action<S extends StandardSchemaV1>(description: string, schema: S, handler: (args: StandardSchemaInferOutput<S>) => unknown | Promise<unknown>): FunctionToolDef<S>`

No `__type`/anonymous-object or internal-generic leaks were found on the authoring surface. (Note: TypeDoc's `api-docs.json` renders some generics as `StandardSchemaV1<>` — a TypeDoc artifact, **not** what the IDE shows; do not treat as a finding.)

## Triage table (impact × effort)

| # | Fix | Impact | Effort | Breaking | Recommendation |
|---|---|---|---|---|---|
| F1 | `@example` on ~15 authoring symbols | high | low | no | **Do first** |
| F2/F3 | `@param` + summaries on authoring fns + config interface members | high | med | no | **Do first** (same PR as F1) |
| F5 | `@internal`/remove `ICON_*` + `CHAT_MARKDOWN_STYLES` | med | low | maybe (if consumed) | Do — verify no external consumer first |
| F4 | generic `view`/`ask` inferring component inputs | med | med-high | possibly | Triage — highest type-level value; needs type-tests + a design check on the component-input constraint |
| — | promote the extraction harness to a CI JSDoc-coverage guard | med | med | no | Optional follow-up — keeps the bar from regressing |

## Suggested sequencing
1. **PR 1 (docs sweep, non-breaking):** F1 + F2 + F3 on the authoring surface and public config interfaces. Pure additive JSDoc; regenerate `api-docs.json`.
2. **PR 2 (hygiene):** F5 — `@internal`/remove leaked consts after a consumer check.
3. **PR 3 (types, its own design):** F4 — generic `view`/`ask`, type-tested.
4. **Optional:** CI guard for JSDoc coverage on the dev-facing public surface.
