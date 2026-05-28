# README Refactor & Complete Update — Design

**Date:** 2026-05-28
**Status:** Approved (brainstorming) — pending implementation plan
**Scope:** Root `README.md` + the 7 published `@threadplane/*` npm package READMEs

## Problem

The README surfaces (root + per-package) have drifted from the framework. Two
gaps to close, confirmed with the user:

1. **Factual / API drift** — content may describe APIs, exports, or behavior that
   no longer matches the actual library source.
2. **Missing capabilities** — real shipped features (interrupts, subagents,
   GenUI/A2UI, theming, citations, queue/branch/history, etc.) may not be
   surfaced.

These are developer-facing surfaces (GitHub + npm). Beyond accuracy, they should
highlight **features/capabilities**, **reliability**, and **production-readiness /
continued maintenance**.

`@threadplane/a2ui` currently ships to npm (v0.0.47) with **no README at all** —
a concrete gap to fix.

## In Scope

Root `README.md` plus the 7 published packages:

| Package | Lib path | License |
|---|---|---|
| `@threadplane/a2ui` | `libs/a2ui` | MIT (verify) |
| `@threadplane/ag-ui` | `libs/ag-ui` | MIT |
| `@threadplane/chat` | `libs/chat` | PolyForm Noncommercial + Commercial (dual) |
| `@threadplane/langgraph` | `libs/langgraph` | MIT |
| `@threadplane/licensing` | `libs/licensing` | MIT |
| `@threadplane/render` | `libs/render` | MIT |
| `@threadplane/telemetry` | `libs/telemetry` | MIT |

## Out of Scope

- Private/internal libs: `cockpit-*`, `db`, `design-tokens`, `example-layouts`,
  `ui-react` (all `"private": true`).
- App-level READMEs: `apps/`, `examples/`, `cockpit/`, `marketing/`, `tools/`.

## Approach (C — Verified inventory first, then write)

Accuracy is the #1 concern, so ground truth is established **before** any prose is
written. Two phases.

### Phase 1 — Audit (parallelizable)

One audit per published package. Each reads:

- Public entry points: `src/public-api.ts` / `index.ts` and barrel exports.
- `package.json`: version, `peerDependencies`, `exports` map / sub-path exports,
  `files`, license.
- Capability surfaces: exported components, providers, services, functions.

Each produces an **inventory block** (see Ground Truth appendix):

- Public exported symbols, each with a one-line purpose.
- Shipped capabilities.
- Peer-dependency ranges (verbatim).
- Sub-path exports (e.g. `@threadplane/chat/themes/*`).
- License.

Capture repo-wide trust facts once: CI workflow names, test/E2E harness presence,
patch-only `0.0.x` release policy, Angular 20/21 peer support.

### Phase 2 — Write

Rewrite all 8 READMEs from the inventory. **Anti-drift gate: every claim in a
README must trace to an entry in the Ground Truth appendix.** If it is not in the
inventory, it does not go in a README. Load-bearing claims (method signatures,
provider names) are spot-checked directly against source, not trusted from a
summary alone.

## README Template (loose convention)

Common section order; each package flexes depth. Tiny packages collapse 6–7 into
a line or two.

1. **Title + one-line tagline** — what it is, who it's for.
2. **Badges** — npm version, Angular 20+/21 support, license. *(Trust: version &
   Angular support.)*
3. **What it does** — 2–4 bullets of real capabilities.
4. **Install** — command + peer-dependency ranges (verbatim from `package.json`).
5. **Quick start** — minimal working example, verified against the actual API.
6. **Capabilities / Features** — the meat; scaled to package size.
7. **Reliability** — testing story (`MockAgentTransport`, E2E harness),
   production-readiness framing, runtime-neutral architecture as stability
   guarantee. *(Trust: test/CI + production framing.)*
8. **Documentation** — links to threadplane.ai docs.
9. **License** — per-package (MIT for most; PolyForm/commercial block for `chat`).

**No changelog / release-cadence section** (not a selected trust signal).

### Trust signals to surface

- Version & Angular support: npm version badges, Angular 20/21 support matrix,
  peer-dep ranges, patch-only `0.0.x` release policy.
- Test & CI signals: test coverage / E2E harness, CI status, `MockAgentTransport`
  testing story.
- Production-readiness framing: "production-ready" lead language, real example
  apps, runtime-neutral architecture as a stability guarantee.

(Release cadence & changelog links intentionally excluded.)

## Per-Package Handling

- **`a2ui`** — net-new README, full template. Audit actual exports first to set
  depth.
- **`ag-ui`** — adapter framing is good. Verify `provideAgUiAgent()` / `AG_UI_AGENT`
  / `bridgeCitationsState()` against source; surface missing capabilities
  (interrupts, subagents, queue, branch/history) if present.
- **`chat`** — keep the dual-license story (PolyForm Noncommercial + commercial
  token via `provideChat({ license })`). Fold the ~50-token A2UI theming dump into
  a tighter "Theming" subsection that links to docs instead of listing every
  token inline. Largest surface (compositions, citations, GenUI, theming) —
  Capabilities stays rich.
- **`langgraph`** — verify `agent()` / `provideAgent()` / `MockAgentTransport` /
  `extractCitations()` signatures and citation paths; surface missing capabilities.
- **`telemetry`** — `ngaf:*` strings are real wire-format event names; keep them.
  The transparency / opt-out contract is a feature; keep it, align framing.
- **`licensing`** — small; verify exports, apply collapsed template. Must stay
  browser-safe in framing (consumed by Angular bundles).
- **`render`** — small; verify exports, apply collapsed template.

## Root README

The current root README is close. Refactor to:

- Tighten the intro.
- Keep the `agent()` vs `useStream()` comparison table — **verify each row against
  actual exports; drop rows that no longer match.**
- Add a **Packages** table mapping each `@threadplane/*` package to a one-line
  purpose and its license.
- Weave in reliability / production framing.
- Keep the architecture explainer and the SVG hero / arch-diagram references as-is.

## Ground Truth Appendix (filled during Phase 1)

> Populated by the audit phase. Each package gets a block below.

### Repo-wide facts

- **CI workflows** (`.github/workflows/ci.yml`):
  - `Library — lint / test / build` — runs lint, test, and build for all published libs.
  - `Website — lint / build` — lints and builds the docs website.
  - `Cockpit — build / test`, `Cockpit — build all examples`, `Cockpit — representative capability smoke`, `Cockpit — e2e` — example-app CI.
  - `examples/chat — python smoke`, `examples/chat — e2e` — end-to-end Playwright tests (4 shards).
  - `Website — e2e` — Playwright tests for the marketing/docs site.
  - `CI — required` — gate job that all PRs must pass.
  - `Deploy → Vercel` — deploy pipeline.

- **Test / E2E harness**:
  - `libs/e2e-harness` — present (README.md, project.json, src). Repo-level E2E harness.
  - `libs/cockpit-testing` — present (package.json, project.json, src, tsconfig files). Cockpit-specific test helpers.
  - `MockAgentTransport` — exported from `@threadplane/langgraph` (`libs/langgraph/src/lib/transport/mock-stream.transport.ts`). Used extensively in langgraph unit tests (agent.fn.spec, agent.provider.spec, lifecycle.spec, stream-manager.bridge.spec, agent.conformance.spec).

- **Release policy**: patch-only at `0.0.x` (e.g. 0.0.47 → 0.0.48). Never minor-bump. Current version: `0.0.47`.

- **Angular peer support**: `^20.0.0 || ^21.0.0` (confirmed from `@threadplane/ag-ui`, `@threadplane/chat`, `@threadplane/langgraph`, `@threadplane/render`, `@threadplane/telemetry` package.json files).

---

### Per-package inventories

#### `@threadplane/a2ui`

**Version:** 0.0.47 | **License:** MIT | **No peerDependencies** | **No sub-path exports**

Entry point: `libs/a2ui/src/index.ts`

**Exported symbols:**

Types (all `export type`):
- `A2uiTheme` — theme variant type for A2UI surfaces.
- `DynamicString`, `DynamicNumber`, `DynamicBoolean`, `DynamicStringList` — dynamic value types (literal or path-reference).
- `A2uiChildren` — child node container type.
- `A2uiActionContextEntry`, `A2uiAction` — action definition types.
- `A2uiComponent`, `A2uiComponentDef` — component node types.
- `A2uiText`, `A2uiImage`, `A2uiIcon`, `A2uiVideo`, `A2uiAudioPlayer` — media/display element types.
- `A2uiRow`, `A2uiColumn`, `A2uiList`, `A2uiCard`, `A2uiTabs`, `A2uiTabItem`, `A2uiDivider`, `A2uiModal` — layout element types.
- `A2uiButton`, `A2uiCheckBox`, `A2uiTextField`, `A2uiDateTimeInput`, `A2uiMultipleChoice`, `A2uiSlider` — interactive input element types.
- `A2uiSurfaceUpdate`, `A2uiDataModelEntry`, `A2uiDataModelUpdate`, `A2uiBeginRendering`, `A2uiDeleteSurface` — protocol message types.
- `A2uiMessage`, `A2uiSurface` — top-level message and surface types.
- `A2uiClientDataModel`, `A2uiActionMessage` — client-side data model and action message types.
- `A2uiMessageParser` — parser function type (from `parser.js`).
- `A2uiScope` — scope type for dynamic value resolution (from `resolve.js`).

Functions:
- `getByPointer(obj, pointer)` — read a value from a JSON-pointer path.
- `setByPointer(obj, pointer, value)` — write a value at a JSON-pointer path.
- `deleteByPointer(obj, pointer)` — delete a value at a JSON-pointer path.
- `createA2uiMessageParser()` — factory that returns a streaming A2UI protocol message parser.
- `resolveDynamic(value, scope)` — resolve a dynamic value (literal or path-ref) against a data scope.
- `isLiteralString(v)`, `isLiteralNumber(v)`, `isLiteralBoolean(v)`, `isPathRef(v)` — type guards for dynamic value variants.

**Shipped capabilities:** A2UI (Agent-to-UI) protocol type system and utilities — JSON-pointer helpers, streaming message parser, dynamic value resolver, type guards. Pure TypeScript; no Angular dependency. Runtime-neutral (used in both browser and server contexts).

---

#### `@threadplane/ag-ui`

**Version:** 0.0.47 | **License:** MIT | **No sub-path exports**

**peerDependencies:**
```json
{
  "@threadplane/chat": "*",
  "@angular/core": "^20.0.0 || ^21.0.0",
  "@ag-ui/client": "*",
  "rxjs": "~7.8.0"
}
```

Entry point: `libs/ag-ui/src/public-api.ts`

**Exported symbols:**

Functions / values:
- `toAgent(agUiAgent, options?)` — adapts an `@ag-ui/client` Agent instance into a `LangGraphAgent`-compatible surface consumable by `<chat [agent]>`.
- `provideAgUiAgent(config)` — DI provider function; registers an AG-UI agent in the Angular injector.
- `AG_UI_AGENT` — injection token for the AG-UI agent (type: `InjectionToken`).
- `injectAgUiAgent()` — inject helper to retrieve the AG-UI agent from DI.
- `FakeAgent` — test-only class; a fake `@ag-ui/client` Agent for unit tests.
- `provideFakeAgUiAgent(config?)` — DI provider function for the `FakeAgent` test double.
- `bridgeCitationsState(state)` — utility for advanced consumers; bridges citations from non-standard AG-UI state paths into `ngaf Citation[]`.

Types:
- `ToAgentOptions` — options for `toAgent()`.
- `AgUiAgentConfig` — config shape for `provideAgUiAgent()`.
- `FakeAgUiAgentConfig` — config shape for `provideFakeAgUiAgent()`.

**Shipped capabilities:** AG-UI adapter — bridges any `@ag-ui/client`-compliant agent into the Threadplane chat surface. Exposes interrupts, subagents, tool calls, citations, and all `AgentWithHistory` capabilities as Angular Signals via the `toAgent()` translation layer. Includes test utilities (`FakeAgent`, `provideFakeAgUiAgent`).

**Confirmed present vs. plan's symbol list:**
- `provideAgUiAgent` ✓, `AG_UI_AGENT` ✓, `bridgeCitationsState` ✓, `injectAgUiAgent` ✓, `toAgent` ✓.
- `provideChat` — NOT in ag-ui (lives in `@threadplane/chat`). Not a drift; correct.

---

#### `@threadplane/chat`

**Version:** 0.0.47 | **License:** `PolyForm-Noncommercial-1.0.0 OR LicenseRef-Threadplane-Commercial`

**dependencies:**
```json
{
  "@cacheplane/partial-json": ">=0.1.1 <0.3.0",
  "@cacheplane/partial-markdown": "^0.3.0"
}
```

**peerDependencies:**
```json
{
  "@angular/core": "^20.0.0 || ^21.0.0",
  "@angular/common": "^20.0.0 || ^21.0.0",
  "@angular/forms": "^20.0.0 || ^21.0.0",
  "@angular/platform-browser": "^20.0.0 || ^21.0.0",
  "@threadplane/licensing": "*",
  "@threadplane/render": "*",
  "@threadplane/a2ui": "*",
  "@json-render/core": "^0.16.0",
  "@langchain/core": "^1.1.33",
  "rxjs": "~7.8.0",
  "marked": "^15.0.0 || ^16.0.0"
}
```

**Sub-path CSS exports** (keys of `exports` in package.json):
- `@threadplane/chat/chat.css` — main chat stylesheet (build output; `chat.css` is not a source file in `libs/chat/src` — it is generated at build time from `chat-tokens.ts`).
- `@threadplane/chat/themes/default-dark.css` — default dark theme (source confirmed at `libs/chat/src/themes/default-dark.css`).
- `@threadplane/chat/themes/default-light.css` — default light theme (source confirmed at `libs/chat/src/themes/default-light.css`).
- `@threadplane/chat/themes/material-dark.css` — Material dark theme (source confirmed at `libs/chat/src/themes/material-dark.css`).
- `@threadplane/chat/themes/material-light.css` — Material light theme (source confirmed at `libs/chat/src/themes/material-light.css`).

Entry point: `libs/chat/src/public-api.ts` (barrel-re-exported from `libs/chat/src/index.ts`)

**Exported symbols:**

Types:
- `ChatConfig` — config shape for `provideChat()`.
- `MessageTemplateType` — string union for message template variants.
- `Agent` — runtime-neutral agent contract (base).
- `AgentWithHistory` — agent contract extended with history/branch.
- `Citation` — citation record type.
- `Message` — runtime-neutral chat message type.
- `Role` — `'user' | 'assistant' | 'tool' | 'system'`.
- `ContentBlock` — typed message content block.
- `ToolCall`, `ToolCallStatus` — tool call and its status.
- `AgentStatus` — `'idle' | 'running' | 'error'`.
- `AgentInterrupt` — interrupt value payload.
- `Subagent`, `SubagentStatus` — subagent delegate and its status.
- `AgentSubmitInput`, `AgentSubmitOptions` — submit parameter types.
- `AgentEvent`, `AgentStateUpdateEvent`, `AgentCustomEvent` — event union types.
- `AgentCheckpoint` — checkpoint record (time-travel/history).
- `AgentRuntimeTelemetryEvent`, `AgentRuntimeTelemetryPayload`, `AgentRuntimeTelemetryProperties`, `AgentRuntimeTelemetrySink` — telemetry hook types.
- `ChatRenderEvent` — render lifecycle event type for `<chat>`.
- `ChatSidenavMode` — `'side' | 'over'` sidenav mode.
- `InterruptAction` — action result type from `<chat-interrupt-panel>`.
- `ChatApprovalAction` — approval/rejection result from `<chat-approval-card>`.
- `ToolCallInfo` — display data for `<chat-tool-call-card>`.
- `TraceState` — state type for `<chat-trace>`.
- `ChatMessageRole` — role union used in `<chat-message>`.
- `OverflowMenuItem` — menu item shape for `<chat-overflow-menu>`.
- `ThreadMatch` — search result for `<chat-history-search-palette>`.
- `ChatScrollBubbleMode` — `'up' | 'down'` scroll bubble direction.
- `ChatSelectOption` — option shape for `<chat-select>`.
- `Thread`, `ThreadActionAdapter` — thread record and action adapter for `<chat-thread-list>`.
- `Project`, `ProjectActionAdapter` — project record and action adapter for `<chat-project-list>`.
- `ResolvedCitation` — resolved citation with source metadata.
- `ViewRegistry`, `RenderEvent`, `RenderHandlerEvent`, `RenderStateChangeEvent`, `RenderLifecycleEvent`, `RenderViewEntry` — re-exported from `@threadplane/render`.
- `ContentClassifier`, `ContentType` — streaming content classifier types.
- `ParseTreeStore`, `ElementAccumulationState` — parse tree streaming types.
- `A2uiSurfaceStore`, `A2uiSurfaceState`, `A2uiViewEntry`, `A2uiViews`, `A2uiComponentView`, `PartialArgsBridge` — A2UI integration types.
- `A2uiActionMessage`, `A2uiClientDataModel`, `A2uiSurface`, `A2uiComponent`, `A2uiTheme`, `DynamicString`, `DynamicNumber`, `DynamicBoolean`, `A2uiChildren`, `A2uiAction`, `A2uiActionContextEntry`, `A2uiComponentDef` — re-exported from `@threadplane/a2ui`.
- `MockAgent`, `MockAgentOptions` — test double types.

Functions:
- `isUserMessage(msg)`, `isAssistantMessage(msg)`, `isToolMessage(msg)`, `isSystemMessage(msg)` — role type guards.
- `getMessageType(msg)` — get the message template type string.
- `provideChat(config)` — DI provider; registers chat config (license, theme, etc.) in the Angular injector.
- `submitMessage(input, options?)` — imperative function to submit a chat message.
- `isTyping(agent)` — returns true while the agent is generating a response.
- `extractErrorMessage(err)` — extract a human-readable string from an error value.
- `getInterrupt(agent)` — get the current interrupt from an agent.
- `views(...)`, `withViews(...)`, `withoutViews(...)`, `toRenderRegistry(...)` — re-exported from `@threadplane/render`; build/modify view registries.
- `provideViews(registry)` — re-exported from `@threadplane/render`; DI provider for view registries.
- `createContentClassifier()` — factory for streaming content type classifier.
- `createParseTreeStore()` — factory for streaming parse tree state.
- `createA2uiSurfaceStore()` — factory for A2UI surface state store.
- `normalizeViewEntry(entry)` — normalize an A2UI view entry.
- `createPartialArgsBridge(...)` — factory for partial-JSON args bridge.
- `normalizeEnvelopeArgs(envelope)` — normalize A2UI action envelope args.
- `surfaceToSpec(surface)` — convert A2UI surface to `@json-render/core` spec.
- `buildA2uiActionMessage(...)` — build an A2UI action message for submission.
- `a2uiBasicCatalog` — built-in A2UI component catalog (object).
- `emitBinding(ctx, key, value)` — emit a data binding event from an A2UI catalog component.
- `isPathRef(v)`, `isLiteralString(v)`, `isLiteralNumber(v)`, `isLiteralBoolean(v)` — re-exported from `@threadplane/a2ui`.
- `renderMarkdown(md, options?)` — render a markdown string to a parse tree.
- `messageContent(msg)` — extract display-safe content string from a `Message`.
- `formatDuration(ms)` — format milliseconds to a human-readable duration string.
- `statusColor(status)` — return a CSS color token string for a subagent status.
- `cacheplaneMarkdownViews` — default Cacheplane markdown view registry (object).

Constants / tokens:
- `CHAT_CONFIG` — injection token for `ChatConfig`.
- `CHAT_LIFECYCLE` — injection token for `ChatLifecycle` hooks.
- `MARKDOWN_VIEW_REGISTRY` — injection token for the markdown view registry.
- `VIEW_REGISTRY` — re-exported from `@threadplane/render`.
- `IS_HEADER_ROW` — injection token for table header row context.
- `CHAT_MARKDOWN_STYLES` — CSS string constant for markdown element styles.
- `ICON_CHEVRON_DOWN`, `ICON_CHEVRON_UP`, `ICON_TOOL`, `ICON_WARNING`, `ICON_AGENT`, `ICON_CHECK`, `ICON_SEND` — SVG icon string constants.

Angular Components (UI primitives — `selector` in brackets):
- `ChatMessageListComponent` [`<chat-message-list>`] — renders a scrollable list of chat messages.
- `ChatMessageComponent` [`<chat-message>`] — renders a single chat message bubble.
- `ChatMessageActionsComponent` [`<chat-message-actions>`] — action toolbar for a message (copy, regenerate, etc.).
- `ChatWindowComponent` [`<chat-window>`] — outer scroll container for a chat conversation.
- `ChatTraceComponent` [`<chat-trace>`] — collapsible execution trace / debug view.
- `ChatReasoningComponent` [`<chat-reasoning>`] — displays model reasoning/thinking blocks.
- `ChatLauncherButtonComponent` [`<chat-launcher-button>`] — floating launcher button for chat popup.
- `ChatSuggestionsComponent` [`<chat-suggestions>`] — renders quick-reply / suggestion chips.
- `ChatInputComponent` [`<chat-input>`] — chat text input field with send button.
- `ChatTypingIndicatorComponent` [`<chat-typing-indicator>`] — animated dots while agent is streaming.
- `ChatHistorySearchPaletteComponent` [`<chat-history-search-palette>`] — command-palette search over thread history.
- `ChatOverflowMenuComponent` [`<chat-overflow-menu>`] — kebab/overflow menu for chat actions.
- `ChatConfirmDialogComponent` [`<chat-confirm-dialog>`] — modal confirmation dialog.
- `ChatScrollBubbleComponent` [`<chat-scroll-bubble>`] — sticky "scroll to bottom/top" bubble indicator.
- `ChatErrorComponent` [`<chat-error>`] — displays agent error state.
- `ChatInterruptComponent` [`<chat-interrupt>`] — renders an interrupt prompt inline.
- `ChatToolCallsComponent` [`<chat-tool-calls>`] — renders the list of in-progress / completed tool calls.
- `ChatSubagentsComponent` [`<chat-subagents>`] — renders delegated subagent activity.
- `ChatThreadListComponent` [`<chat-thread-list>`] — sidebar list of conversation threads.
- `ChatProjectListComponent` [`<chat-project-list>`] — sidebar list of projects.
- `ChatGenuiSkeletonComponent` [`<chat-genui-skeleton>`] — loading skeleton for GenerativeUI surfaces.
- `ChatTimelineComponent` [`<chat-timeline>`] — timeline/debug strip showing agent event history.
- `ChatGenerativeUiComponent` [`<chat-generative-ui>`] — renders A2UI generative UI surfaces.
- `ChatWelcomeComponent` [`<chat-welcome>`] — empty-state welcome screen.
- `ChatWelcomeSuggestionComponent` [`<chat-welcome-suggestion>`] — individual suggestion chip inside the welcome screen.
- `ChatSelectComponent` [`<chat-select>`] — styled select / dropdown primitive.
- `ChatCitationsComponent` [`<chat-citations>`] — renders citation cards attached to an assistant message.
- `ChatCitationsCardComponent` [`<chat-citations-card>`] — single citation card.
- `ChatSidenavScrimComponent` [`<chat-sidenav-scrim>`] — overlay scrim for sidenav.
- `ChatStreamingMdComponent` [`<chat-streaming-md>`] — live streaming markdown renderer.
- `DefaultFallbackComponent` — re-exported from `@threadplane/render`; fallback when no view matches.
- `RenderElementComponent` — re-exported from `@threadplane/render`.
- `RenderSpecComponent` — re-exported from `@threadplane/render`.

Angular Components (Compositions):
- `ChatComponent` [`<chat>`] — full-page chat composition; accepts `[agent]` input.
- `ChatPopupComponent` [`<chat-popup>`] — floating popup chat composition.
- `ChatSidebarComponent` [`<chat-sidebar>`] — sidebar-docked chat composition.
- `ChatTimelineSliderComponent` [`<chat-timeline-slider>`] — time-travel slider UI composition.
- `ChatSidenavComponent` [`<chat-sidenav>`] — sidenav host composition.
- `ChatInterruptPanelComponent` [`<chat-interrupt-panel>`] — full interrupt handling composition with approve/reject actions.
- `ChatApprovalCardComponent` [`<chat-approval-card>`] — approval card dialog composition for human-in-the-loop.
- `ChatToolCallCardComponent` [`<chat-tool-call-card>`] — rich card composition for a single tool call.
- `ChatSubagentCardComponent` [`<chat-subagent-card>`] — rich card composition for a subagent delegation.

Angular Directives:
- `MessageTemplateDirective` — structural directive for custom message templates in `<chat-message-list>`.
- `ChatToolCallTemplateDirective` — structural directive for custom tool call templates in `<chat-tool-calls>`.

Angular Services:
- `CitationsResolverService` — resolves raw citation references into display-ready `ResolvedCitation` objects.

Markdown view components (for per-node override via `withViews(cacheplaneMarkdownViews, {...})`):
`MarkdownDocumentComponent`, `MarkdownParagraphComponent`, `MarkdownHeadingComponent`, `MarkdownBlockquoteComponent`, `MarkdownListComponent`, `MarkdownListItemComponent`, `MarkdownCodeBlockComponent`, `MarkdownThematicBreakComponent`, `MarkdownTextComponent`, `MarkdownEmphasisComponent`, `MarkdownStrongComponent`, `MarkdownStrikethroughComponent`, `MarkdownInlineCodeComponent`, `MarkdownLinkComponent`, `MarkdownAutolinkComponent`, `MarkdownImageComponent`, `MarkdownSoftBreakComponent`, `MarkdownHardBreakComponent`, `MarkdownCitationReferenceComponent`, `MarkdownTableComponent`, `MarkdownTableRowComponent`, `MarkdownTableCellComponent`.

A2UI catalog components (for `withViews()` customization):
`A2uiTextFieldComponent`, `A2uiCheckBoxComponent`, `A2uiButtonComponent`, `A2uiMultipleChoiceComponent`, `A2uiSliderComponent`, `A2uiDateTimeInputComponent`, `A2uiTextComponent`, `A2uiIconComponent`, `A2uiImageComponent`, `A2uiColumnComponent`, `A2uiRowComponent`, `A2uiCardComponent`, `A2uiDividerComponent`, `A2uiListComponent`, `A2uiModalComponent`, `A2uiTabsComponent`, `A2uiAudioPlayerComponent`, `A2uiVideoComponent`.

Test utilities:
- `mockAgent(options?)` — factory returning a `MockAgent` test double implementing the runtime-neutral `Agent` contract.

**Shipped capabilities:** Full Angular chat UI library. Compositions (`<chat>`, `<chat-popup>`, `<chat-sidebar>`, `<chat-sidenav>`), interrupt handling (`<chat-interrupt-panel>`, `<chat-approval-card>`), tool call visualization, subagent tracking, citation rendering, streaming markdown, time-travel timeline, A2UI generative UI surfaces, history/thread/project management UIs. Dual-license (noncommercial + commercial via `provideChat({ license })`).

**Note on `provideChat`:** confirmed present. Commercial license token passed as `provideChat({ license: 'your-token' })`.

---

#### `@threadplane/langgraph`

**Version:** 0.0.47 | **License:** MIT

**peerDependencies:**
```json
{
  "@threadplane/chat": "*",
  "@angular/core": "^20.0.0 || ^21.0.0",
  "@langchain/core": "^1.1.33",
  "@langchain/langgraph-sdk": "^1.7.4",
  "rxjs": "~7.8.0"
}
```

No sub-path exports.

Entry point: `libs/langgraph/src/public-api.ts`

**Exported symbols:**

Primary function:
- `agent<T, Bag>(options)` — creates a LangGraph-backed Angular agent within an injection context; returns a `LangGraphAgent` with Angular Signals for all state.

Provider / DI:
- `provideAgent(config)` — DI provider; registers global `AgentConfig` (apiUrl, transport) so `agent()` calls inherit defaults.
- `AGENT_CONFIG` — injection token for `AgentConfig`.
- `AGENT_LIFECYCLE` — injection token for `AgentLifecycle`.
- `AgentLifecycleRegistry` — Angular service; registry of per-agent lifecycle objects, injectable for telemetry/observability consumers.

Transport:
- `MockAgentTransport` — test utility; an `AgentTransport` implementation that replays scripted stream events; confirmed in `libs/langgraph/src/lib/transport/mock-stream.transport.ts`.
- `FetchStreamTransport` — production transport; streams LangGraph events over HTTP SSE.

Client helpers:
- `createLangGraphClient(config)` — creates a `@langchain/langgraph-sdk` client; handles relative-URL normalization for browser contexts.
- `toAbsoluteApiUrl(url)` — normalizes a relative `/api`-style URL to an absolute URL.

Thread store:
- `LangGraphThreadsAdapter` — Angular service; SDK-backed thread CRUD (list, create, delete) replacing hand-rolled `ThreadsService`.
- `LANGGRAPH_THREADS_CONFIG` — injection token for `LangGraphThreadsConfig`.
- `LANGGRAPH_CLIENT` — injection token for the `@langchain/langgraph-sdk` `Client` instance.

Lifecycle helpers:
- `refreshOnRunEnd(agent, refreshFn)` — sets up an effect to call `refreshFn` when a run ends.
- `refreshOnTransition(agent, from, to, refreshFn)` — sets up an effect to call `refreshFn` on a specific status transition.

Citation utility:
- `extractCitations(msg)` — extracts `Citation[]` from a LangGraph message's `additional_kwargs`; useful for consumers building custom adapters.

Test utility:
- `mockLangGraphAgent(options?)` — factory returning a `MockLangGraphAgent` test double.

Types:
- `AgentConfig` — config for `provideAgent()` (apiUrl, transport).
- `AgentLifecycle` — eight read-only signals tracking key stream transitions (streamStartedAt, streamErrorAt, interruptReceivedAt, interruptResolvedAt, threadCreatedAt, threadPersistedAt, toolCallStartedAt, toolCallCompletedAt).
- `AgentOptions<T, Bag>` — options for `agent()`.
- `LangGraphAgent<T, Bag>` — full agent surface (extends `AgentWithHistory`).
- `LangGraphMultitaskStrategy` — `'reject' | 'interrupt' | 'rollback' | 'enqueue'`.
- `LangGraphSubmitOptions` — all submit parameters (signal, config, command, resume, checkpoint, multitaskStrategy, etc.).
- `AgentQueue`, `AgentQueueEntry` — server-side queued run surface.
- `AgentBranchTree`, `AgentBranchTreeFork`, `AgentBranchTreeNode` — checkpoint branch tree types for time-travel UIs.
- `AgentTransport` — transport interface (stream, joinStream?, createQueuedRun?, cancelRun?, getHistory?, updateState?).
- `CustomStreamEvent` — custom backend event (`adispatch_custom_event()`).
- `StreamEvent` — raw stream event shape.
- `SubagentStreamRef` — reference to a subagent's streaming state (toolCallId, name, status signal, values signal, messages signal).
- `MockLangGraphAgent` — type for the mock agent test double.
- `LangGraphThreadsConfig` — config shape for `LangGraphThreadsAdapter`.
- Re-exported from SDK: `BagTemplate`, `InferBag`, `Interrupt`, `ThreadState`, `SubmitOptions`.
- `ResourceStatus` — const-object shim (Idle, Loading, Reloading, Resolved, Error, Local) for runtime comparisons.

**Shipped capabilities:** All LangGraph agent capabilities via the `agent()` function and `LangGraphAgent` surface:
- `messages` (Signal<Message[]>), `status` (Signal<AgentStatus>), `isLoading` (Signal<boolean>), `error` (Signal<unknown>) ✓
- `interrupt` (Signal<AgentInterrupt | undefined>), `langGraphInterrupts` (raw Signal<Interrupt[]>) ✓
- `toolCalls` (Signal<ToolCall[]>), `langGraphToolCalls` (raw) ✓
- `subagents` (Signal<Map<string, Subagent>>), `getSubagent(toolCallId)`, `getSubagentsByType(type)`, `getSubagentsByMessage(msg)`, `activeSubagents` ✓
- `queue` (Signal<AgentQueue>) ✓
- `branch` (Signal<string>), `setBranch(b)` ✓
- `history` (Signal<AgentCheckpoint[]>), `langGraphHistory` (raw Signal<ThreadState[]>) ✓
- `experimentalBranchTree` (Signal<AgentBranchTree>) ✓
- `regenerate(assistantMessageIndex)` ✓
- `reload()` ✓
- `submit(input, opts?)`, `stop()` ✓
- `switchThread(threadId)`, `joinStream(runId, lastEventId?)` ✓
- `lifecycle` (AgentLifecycle — 8 signals) ✓

**Confirmed present vs. plan's symbol list:**
- `messages`, `status`, `isLoading`, `error` ✓
- `interrupt` / `interrupts` — `interrupt` (singular, runtime-neutral) ✓; `langGraphInterrupts` (raw plural) ✓
- `toolCalls` ✓
- `subagents` / `getSubagent` ✓
- `queue` ✓
- `branch` / `history` / `experimentalBranchTree` ✓
- `regenerate`, `reload`, `submit`, `stop` ✓
- `MockAgentTransport` ✓ (in langgraph only; NOT in chat)
- `extractCitations` ✓
- `provideAgent` ✓
- `AG_UI_AGENT` — NOT in langgraph (lives in `@threadplane/ag-ui`)
- `bridgeCitationsState` — NOT in langgraph (lives in `@threadplane/ag-ui`)
- `provideAgUiAgent` — NOT in langgraph (lives in `@threadplane/ag-ui`)
- `provideChat` — NOT in langgraph (lives in `@threadplane/chat`)
- `Citation` — NOT in langgraph (lives in `@threadplane/chat`)
- `CitationsResolverService` — NOT in langgraph (lives in `@threadplane/chat`)

---

#### `@threadplane/licensing`

**Version:** 0.0.47 | **License:** MIT

**peerDependencies:**
```json
{
  "@noble/ed25519": "^2.2.3"
}
```

No sub-path exports.

Entry point: `libs/licensing/src/index.ts`

**Exported symbols:**

Functions:
- `verifyLicense(token, publicKey?)` — verify a signed JWT license token; returns `VerifyResult`.
- `evaluateLicense(claims, options?)` — evaluate license claims against usage context; returns `EvaluateResult` (allowed / nag / blocked).
- `emitNag(options)` — emit a console warning/nag for noncommercial-license over-use.
- `runLicenseCheck(options)` — orchestrates verify + evaluate + nag in one call; used internally by `provideChat()`.
- `signLicense(claims, privateKey)` — sign a license claims object into a JWT token (server/tooling use only).
- `inferNoncommercial(context)` — heuristically determine if the runtime context is noncommercial.

Constants:
- `LICENSE_PUBLIC_KEY` — the Ed25519 public key used to verify Threadplane license tokens.

Types:
- `LicenseClaims` — shape of the decoded JWT payload (tier, expiry, etc.).
- `LicenseTier` — `'noncommercial' | 'commercial'` (or similar).
- `VerifyResult` — result of `verifyLicense()` (valid, invalid, expired, etc.).
- `VerifyReason` — reason code for a `VerifyResult`.
- `LicenseStatus` — runtime license state enum/union.
- `EvaluateResult` — result of `evaluateLicense()`.
- `EvaluateOptions` — options for `evaluateLicense()`.
- `EmitNagOptions` — options for `emitNag()`.
- `RunLicenseCheckOptions` — options for `runLicenseCheck()`.

**Shipped capabilities:** Browser-safe license verification/evaluation library. Ed25519 JWT signature verification, tier evaluation, noncommercial inference, license nag emission. No `Buffer`, no bare `process` references (Angular bundle–safe).

---

#### `@threadplane/render`

**Version:** 0.0.47 | **License:** MIT

**peerDependencies:**
```json
{
  "@angular/core": "^20.0.0 || ^21.0.0",
  "@angular/common": "^20.0.0 || ^21.0.0",
  "@json-render/core": "^0.16.0"
}
```

No sub-path exports.

Entry point: `libs/render/src/public-api.ts`

**Exported symbols:**

Types:
- `AngularComponentInputs` — mapped type extracting `@Input()` properties from an Angular component class.
- `AngularComponentRenderer` — type for a function that renders an Angular component into a view.
- `AngularRegistry` — type for the Angular-specific component registry.
- `RenderConfig` — config shape for `provideRender()`.
- `RenderContext` — context object injected into render view components.
- `RepeatScope` — scope object for repeated (list) render contexts.
- `ViewRegistry` — map from `@json-render/core` node types to Angular components.
- `RenderEvent` — base render lifecycle event type.
- `RenderHandlerEvent` — event from a user action on a rendered element.
- `RenderStateChangeEvent` — event when rendered element state changes.
- `RenderLifecycleEvent` — event for mount/unmount lifecycle.
- `RenderLifecycle` — lifecycle hook interface for `RENDER_LIFECYCLE`.
- `RenderViewEntry` — single entry in the view registry (component + metadata).

Functions:
- `defineAngularRegistry(entries)` — create an Angular component registry from an entries map.
- `signalStateStore(initial)` — create a signal-based state store for render view components.
- `provideRender(config)` — DI provider; registers `RenderConfig` in the injector.
- `views(...)` — build a `ViewRegistry` from a list of view entries.
- `withViews(base, overrides)` — merge view registries, with overrides taking precedence.
- `withoutViews(base, keys)` — produce a view registry with specified keys removed.
- `toRenderRegistry(views)` — convert a `ViewRegistry` to a `@json-render/core` Registry.
- `provideViews(registry)` — DI provider; registers a `ViewRegistry` in the injector.

Angular Components:
- `RenderElementComponent` [`<render-element>`] — renders a single JSON-render spec node.
- `RenderSpecComponent` [`<render-spec>`] — renders a full JSON-render spec tree.
- `DefaultFallbackComponent` — fallback component when no view matches a node type.

Injection tokens:
- `RENDER_CONTEXT` — context for the current render element.
- `REPEAT_SCOPE` — scope for a repeat (list iteration) render context.
- `RENDER_CONFIG` — global render configuration.
- `RENDER_LIFECYCLE` — lifecycle hooks token.
- `VIEW_REGISTRY` — the active view registry.

**Shipped capabilities:** `@json-render/core`-backed Angular render engine. Renders JSON specs to Angular components via a registry pattern. Signal-based state store, view composition helpers (`views`, `withViews`, `withoutViews`), DI providers. Used internally by `@threadplane/chat` for A2UI generative UI rendering.

---

#### `@threadplane/telemetry`

**Version:** 0.0.47 | **License:** MIT

**peerDependencies** (both optional):
```json
{
  "@angular/core": "^20.0.0 || ^21.0.0",
  "posthog-js": "^1.372.0"
}
```

**Sub-path exports:**
- `.` — main entry (`index.js`): re-exports shared utilities.
- `./shared` — shared/public-api (browser + node isomorphic utilities).
- `./node` — Node.js telemetry adapter (captureEvent, captureRuntimeInstanceCreated, etc.).
- `./node/postinstall` — postinstall script entry (run by npm lifecycle).
- `./browser` — Angular browser telemetry service (`ThreadplaneTelemetryService`, `provideThreadplaneTelemetry`).
- `./README.md` — package README.

**Bin:** `threadplane-telemetry-postinstall` → `./node/postinstall.js` (runs on npm install).

Entry point: `libs/telemetry/src/index.ts`

**Exported symbols (main `.` entry):**

- `isTelemetryDisabled(env?)` — returns true if telemetry is disabled (via env var, CI, or DO_NOT_TRACK).
- `getDisableReason(env?)` — returns the specific disable reason: `'DO_NOT_TRACK' | 'NGAF_TELEMETRY_DISABLED' | 'CI' | null`.
- `sha256(input)` — hash utility for anonymous ID derivation.
- `getAnonId()` — returns the persistent anonymous install ID.
- `shouldSample(rate)` — returns true if this event should be sampled at the given rate.
- Types: `ThreadplaneEvent`, `ThreadplaneNodeEvent`, `ThreadplaneBrowserEvent` — event name type unions.

**`./browser` sub-path exports:**

- `provideThreadplaneTelemetry(config)` — Angular DI provider; registers the PostHog-backed telemetry service.
- `ThreadplaneTelemetryService` — Angular service; receives `AgentRuntimeTelemetryEvent` payloads and forwards to PostHog.
- `THREADPLANE_TELEMETRY_CONFIG` — injection token for `ThreadplaneTelemetryConfig`.
- `isLocalAnalyticsHost(url)`, `shouldCaptureAnalytics(config)` — helpers to gate PostHog capture in local/dev environments.
- Types: `ThreadplaneTelemetryConfig`, `ThreadplaneTelemetryEvent`, `ThreadplaneTelemetryEventPayload`, `ThreadplaneTelemetrySink`, `ThreadplaneBrowserEvent`, `ThreadplaneBrowserRuntimeTelemetry`, `ThreadplaneBrowserStreamErrorTelemetry`, `ThreadplaneBrowserStreamTelemetry`, `CaptureConfig`.

**`./node` sub-path exports:**

- `disableTelemetry()` — programmatically disable telemetry for the current process.
- `capturePostinstall(config?)` — capture a postinstall telemetry event (called by the postinstall bin).
- `captureEvent(event, payload)` — capture a generic telemetry event.
- `captureRuntimeInstanceCreated(payload)` — capture `ngaf:runtime_instance_created`.
- `captureRuntimeRequestCreated(payload)` — capture `ngaf:runtime_request_created`.
- `captureStreamStarted(payload)` — capture `ngaf:stream_started`.
- `captureStreamEnded(payload)` — capture `ngaf:stream_ended`.
- `captureStreamErrored(payload)` — capture `ngaf:stream_errored`.
- Types: `CaptureResult`, `RuntimeInstanceTelemetry`, `RuntimeRequestTelemetry`, `StreamTelemetry`.

**`ngaf:*` event names** (from `libs/telemetry/src/shared/events.ts` — these are the wire-format strings):

Node events (`ThreadplaneNodeEvent`):
- `ngaf:postinstall` — fired by the postinstall bin on package install.
- `ngaf:runtime_instance_created` — fired when a LangGraph agent instance is created.
- `ngaf:runtime_request_created` — fired when a run/request is initiated.
- `ngaf:stream_started` — fired when the first stream event arrives.
- `ngaf:stream_ended` — fired when a stream completes normally.
- `ngaf:stream_errored` — fired when a stream terminates with an error.

Browser events (`ThreadplaneBrowserEvent`):
- `ngaf:browser_provided` — fired when `provideThreadplaneTelemetry()` is called.
- `ngaf:browser_chat_init` — fired when a chat component initializes.

**Environment variable controls** (confirmed in source):
- `NGAF_TELEMETRY_DISABLED=1` — disables all telemetry.
- `NGAF_TELEMETRY_SAMPLE_RATE` — float 0–1 controlling sampling rate (in `node/client.ts`).
- `NGAF_TELEMETRY_INGEST_URL` — override ingest endpoint URL (in `node/client.ts`).
- `DO_NOT_TRACK=1` (or `npm_config_do_not_track`, `NPM_CONFIG_DO_NOT_TRACK`) — standard opt-out; also disables telemetry.
- `CI=1`, `GITHUB_ACTIONS=1`, `CONTINUOUS_INTEGRATION=1`, `BUILDKITE=1`, `CIRCLECI=1` — CI environments auto-disable telemetry.

**Shipped capabilities:** Transparent, opt-out anonymous usage telemetry. Node.js postinstall capture, browser Angular service (PostHog-backed), shared isomorphic utilities. All event names are public wire-format strings (`ngaf:*`). Fully opt-outable via env vars or DO_NOT_TRACK.

## Success Criteria

- All 8 READMEs rewritten; `a2ui` has a README.
- Every factual claim traces to a verified inventory entry (no unverified API
  references).
- Each README follows the loose-convention template, scaled to package size.
- Trust signals (version/Angular, test/CI, production framing) present where
  applicable.
- No stale branding; `ngaf:*` event names preserved as wire format.
- Private libs and app READMEs untouched.
