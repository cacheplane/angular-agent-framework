# Chat Docs Technical Review — Findings

**Date:** 2026-06-06
**Pages audited:** 33 (getting-started ×3, guides ×9, concepts ×2, components ×14, api ×5)
**Source verified against:** `libs/chat` (+ cross-refs `libs/render`, `libs/langgraph`, `libs/a2ui`), generated `api-docs.json`
**Method:** 6 parallel read-only auditors + completeness sweep; controller re-verified every high-impact finding against source (dropped 1 auditor false alarm).

## Resolution status — ✅ ALL FINDINGS FIXED (3 PRs merged)

Cutoff: P0+P1+P2 + cheap P3. Each fix re-verified against its cited source by an independent reviewer (all PASS, no over-reach).
- ✅ **PR #594 — components:** systemic `agent()`→`injectAgent()`/`provideAgent()` across the component pages + folded-in `chat/a2ui/overview.mdx`; chat.mdx inputs/outputs; chat-input slots/inputs/outputs; chat-tool-calls, chat-select, chat-trace, popup/sidebar two-way, message-list reword.
- ✅ **PR #595 — guides + concepts:** `agent()` migration (generative-ui, layout-modes ×3, markdown comment); streaming `'undetermined'`→`'pending'`; writing-an-adapter `regenerate`; custom-catalogs `loading` optional; message-model `toolCallIds` + `Citation` shape.
- ✅ **PR #596 — api + getting-started:** `agent()` migration (quickstart, provide-chat); introduction base-Agent `history()` correction; content-classifier `'undetermined'`→`'pending'` + `a2uiSurfaceStates`; mock-agent `opts` + `events$`. (#4 parse-tree-store param and #22 provideChat return type were verified already-correct — no change.)

**Verification:** no `agent()` factory or `'undetermined'` remains in chat docs; all edited routes returned HTTP 200.

**Spawned as a separate follow-up (not in these PRs):** the `api-docs.json` default-valued-param `optional` flag (generator nuance — `mockAgent(opts = {})` marked `optional: false`).

## Summary

- **P0: 4 (one systemic, ~13 files)** · **P1: 7** · **P2: 8** · **P3: 3**
- **Headline systemic issue:** the chat docs pervasively import a **nonexistent** `agent` from `@threadplane/langgraph` and call `agent({ assistantId, threadId })`. `@threadplane/langgraph` exports only `provideAgent` and `injectAgent`; the canonical pattern (per langgraph's own installation page) is `provideAgent({...})` at the app root + **`injectAgent()` with no arguments** in the component. This appears in **~13 reviewed pages** and also in the *excluded* `chat/a2ui/overview.mdx` (the render review's a2ui audit missed it).
- Other systemic notes: `ContentType` value `'undetermined'` (doesn't exist; real value `'pending'`) in two pages; the `chat.mdx` and `chat-input.mdx` component pages under-document real inputs/outputs.
- **Dropped (verified non-issue):** the "missing theming guide" link — `theming` IS in `docs-config.ts:158`; the link resolves.

---

## Findings by severity

### P0 — wrong (breaks copy-paste)

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 1 | **SYSTEMIC** — `getting-started/quickstart.mdx:41,52`; `guides/generative-ui.mdx:27,48`; `guides/layout-modes.mdx:22,37,59,76,105,123`; `components/chat-debug.mdx:17,39`; `components/chat-interrupt-panel.mdx:125,148`; `components/chat-subagent-card.mdx:80,112`; `components/chat-sidebar.mdx:23,41,113`; `components/chat-message-list.mdx:142`; `components/chat-input.mdx:139,164`; `components/chat-trace.mdx:93,119`; `components/chat-popup.mdx:23,37,90`; `api/provide-chat.mdx:140` | accuracy | `import { agent } from '@threadplane/langgraph'` + `agent({ assistantId, threadId })` — `agent` is **not exported**; and config doesn't go in the inject call | `libs/langgraph/src/public-api.ts:3,7` (only `provideAgent`, `injectAgent`); `lib/inject-agent.ts:16` (`injectAgent()` takes no args); canonical pattern in `docs/langgraph/getting-started/installation.mdx:105-109` | Replace with `import { injectAgent } from '@threadplane/langgraph'` and `injectAgent()` (no args); move `assistantId`/`threadId` config to `provideAgent({...})` in the app config or component `providers` (show it where the snippet implies app setup). Apply consistently. **Also fix the excluded `chat/a2ui/overview.mdx:258,266`** (same bug). |
| 2 | `guides/streaming.mdx:60,69` | accuracy | `ContentType` documented value `'undetermined'` doesn't exist | `libs/chat/src/lib/streaming/content-classifier.ts:11` → `'pending' \| 'markdown' \| 'json-render' \| 'a2ui' \| 'mixed'` | Replace `'undetermined'` → `'pending'` (both lines) |
| 3 | `api/content-classifier.mdx:56` | accuracy | same `'undetermined'` in the ContentType enum | `content-classifier.ts:11` | Replace `'undetermined'` → `'pending'` |
| 4 | `api/parse-tree-store.mdx:15` | accuracy | `createParseTreeStore()` shown with no params; it requires `parser: PartialJsonParser` | `libs/chat/src/lib/streaming/parse-tree-store.ts:20` | Signature → `createParseTreeStore(parser: PartialJsonParser): ParseTreeStore`; show acquiring a `PartialJsonParser` |

### P1 — misleading (runs/reads but wrong model)

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 5 | `getting-started/introduction.mdx:61` | conceptual | claims base `Agent` exposes `history()`; that's on the optional `AgentWithHistory` | `libs/chat/src/lib/agent/agent.ts` (base contract has no `history`) | Drop `history()` from the base-contract list; note some adapters add `AgentWithHistory` with `history()` |
| 6 | `guides/writing-an-adapter.mdx:26-38` | completeness | Agent contract table omits the **required** `regenerate` method | `agent.ts:47` (`regenerate: (assistantMessageIndex: number) => Promise<void>`) | Add `regenerate` row; add it to the EchoAgent example (or the example fails the contract) |
| 7 | `guides/custom-catalogs.mdx:90` | accuracy | example types `loading` as required `input<boolean>(false)`; the contract field is optional | `libs/render/src/lib/render.types.ts:11` (`loading?: boolean`) | `input<boolean>()` (no default); optionally show `bindings` too |
| 8 | `concepts/message-model.mdx:9-20` | accuracy | `Message` interface omits `toolCallIds?: string[]` | `libs/chat/src/lib/agent/message.ts:44` | Add `toolCallIds?: string[]` with a one-line comment |
| 9 | `components/chat-message-list.mdx:19,159` | conceptual | says the component "reads `injectAgent().messages()`"; it takes the agent as a required input | `chat-message-list.component.ts:54` (`readonly agent = input.required<Agent>()`) | Reword to "receives an `agent` input and reads `agent.messages()`"; align the example with the `[agent]` pattern |
| 10 | `api/mock-agent.mdx:15` | accuracy | parameter named `options`; source is `opts` | `libs/chat/src/lib/testing/mock-agent.ts:65` (`mockAgent(opts: MockAgentOptions = {})`) | Rename to `opts` |
| 11 | `components/chat-popup.mdx:54`, `components/chat-sidebar.mdx:71`, `components/chat.mdx` (`selectedModel`) | accuracy | two-way `model()` inputs documented as plain inputs | `chat-popup.component.ts:101`, `chat-sidebar.component.ts:142`, `chat.component.ts:319` (all `model(...)`) | Mark these as two-way (e.g. "boolean (two-way)") so `[(open)]` / `[(selectedModel)]` is discoverable |

### P2 — gap

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 12 | `components/chat.mdx:75-91` | completeness | omits inputs `welcomeDisabled`, `modelOptions`, `showModelPicker`, `selectedModel`, `modelPickerPlaceholder`, `genuiToolNames` and outputs `renderEvent`, `regenerate`, `rate`, `messageCopy` | `chat.component.ts:295-348` | Add the missing input/output rows with source types/defaults |
| 13 | `components/chat-input.mdx:23-134` | completeness | omits `showStopButton` input, `stopped` output, and content-projection slots (`[chatInputBanner]`, `[chatInputAttachments]`, `[chatInputLeading]`, `[chatInputTrailing]`, `[chatInputFooter]`) | `chat-input.component.ts:41-102` | Add the missing input/output + a Slots table |
| 14 | `components/chat-reasoning.mdx:21-29` | completeness | omits `label` input | `chat-reasoning.component.ts:68` | Add `label: string \| undefined` (default `undefined`) row |
| 15 | `components/chat-tool-calls.mdx:13-20` | completeness | omits `excludeToolNames` input | `chat-tool-calls.component.ts:101` (`input<readonly string[]>([])`) | Add `excludeToolNames` row |
| 16 | `components/chat-select.mdx` | completeness | no explicit `valueChange` output (auto-created by `model()`) | `chat-select.component.ts:84` (`value = model<string>('')`) | Add an Outputs note documenting `valueChange` |
| 17 | `api/content-classifier.mdx:23-50` | completeness | `ContentClassifier` omits `a2uiSurfaceStates` signal | `content-classifier.ts:22` (`a2uiSurfaceStates: Signal<Map<string, A2uiSurfaceState>>`) | Document the property |
| 18 | `api/mock-agent.mdx` | completeness | `MockAgentOptions` table omits `events$?: Observable<AgentEvent>` | `mock-agent.ts:62` | Add `events$` row |
| 19 | `concepts/message-model.mdx` | completeness | `Citation` shape undocumented though citations are discussed | `libs/chat/src/lib/agent/citation.ts` | Add a short Citation-shape note |

### P3 — polish

| # | page:line | dim | what's wrong | source evidence | fix |
|---|---|---|---|---|---|
| 20 | `components/chat-trace.mdx:31,47-53` | polish | refers to the state union inline instead of the exported `TraceState`; slots not marked optional | `chat-trace.component.ts:7,40` (`TraceState` exported) | Cite `TraceState`; mark slots optional |
| 21 | `components/chat-reasoning.mdx:3-4` | conceptual | doesn't say `<chat>` auto-renders this when `Message.reasoning` is set | `chat.component.ts` (auto-renders chat-reasoning) | One-line clarification |
| 22 | `api/provide-chat.mdx:21` | polish | signature omits the return type | `libs/chat/src/lib/provide-chat.ts:36` (returns `EnvironmentProviders`) | Show `: EnvironmentProviders` in the signature |

---

## Structural / won't-fix-here

- **`api-docs.json` default-param drift:** `mockAgent`'s `opts` (which has a default `= {}`) is marked `optional: false` in the generated JSON. The generator doesn't treat default-valued params as optional. This is a generator nuance not covered by the earlier generator fix (#591) — flag for a separate follow-up; do not hand-edit the JSON.
- No `libs/*` source bugs identified in this review.

## Verified NON-issues (no change)

- **`introduction.mdx:108` theming link:** `theming` is registered in `docs-config.ts:158`; `/docs/chat/guides/theming` resolves. (One auditor mis-flagged.)
- **`ChatConfig` `__licenseEnvHint` / `__licensePublicKey`:** `@internal` test-only props; correctly omitted from the public reference.

---

## Fix plan (3 PRs)

Default cutoff: **fix P0 + P1 + P2; fix P3 where it's a one-liner** (#20–22). Structural item flagged only.

- **PR-1 — components** (Task 9): #1 (component-page occurrences), #9, #11 (popup/sidebar/chat), #12, #13, #14, #15, #16, #20, #21.
- **PR-2 — guides + concepts** (Task 10): #1 (guides occurrences), #2, #5*, #6, #7, #8, #19. (*#5 is on getting-started — see PR-3; listed once.)
- **PR-3 — api + getting-started** (Task 11): #1 (gs + provide-chat occurrences), #3, #4, #5, #10, #11 (selectedModel if in api), #17, #18, #22.

**Decision needed at checkpoint:** the systemic `agent()` P0 (#1) also affects the *excluded* `chat/a2ui/overview.mdx`. Recommend folding that one-file fix into PR-1 (the exclusion was based on a review that missed this), rather than leaving a known-broken snippet.

> Note: finding #1 spans all three batches (each PR fixes the `agent()`→`injectAgent()`/`provideAgent()` pattern in its own files). The correct replacement keeps `assistantId`/`threadId` but moves them into `provideAgent({...})` (app config or component `providers`), with `injectAgent()` taking no args.
