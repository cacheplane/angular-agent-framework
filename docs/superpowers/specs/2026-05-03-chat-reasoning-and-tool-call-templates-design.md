# Chat Reasoning + Tool Call Templates — Design Specification

**Date:** 2026-05-03
**Status:** Draft, pending user review
**Phase:** B2 in the post-0.0.18 roadmap (B = tool-call & reasoning UX; B2 = polish + reasoning, citations deferred to a later sub-phase)
**Targets:** `@ngaf/chat` 0.0.19, `@ngaf/langgraph` 0.0.11, `@ngaf/ag-ui` next patch

---

## 1. Goals

Surface assistant reasoning content as a first-class UI affordance, and turn tool-call rendering into a CopilotKit-style extension surface while keeping a polished default that matches what users see in ChatGPT-style products.

Concretely:

- Reasoning content emitted by gpt-5 / o-series / Anthropic thinking-enabled models renders as a collapsible "Thinking…" / "Thought for Ns" pill above the assistant response, default-collapsed once the response starts.
- Tool-call cards default-collapse when complete; the at-a-glance state pill (running / done / error) gets consistent visual chrome.
- Sequential same-name tool calls auto-group into a single labeled strip ("Searched 5 sites").
- Consumers can fully replace the default card UX per tool name via a `chatToolCallTemplate` directive — turning e.g. `search_images` into an image grid, `place_order` into a confirmation card, without forking the primitive.
- Both adapters (`@ngaf/langgraph` and `@ngaf/ag-ui`) populate the same `Message.reasoning` field; downstream UI is provider-neutral.

---

## 2. Architecture

### 2.1 Data flow

```
LangGraph SSE  ─┐                                       ┌─ <chat-reasoning>
                ├→ adapter ─→ Message {role,content,    ┤
AG-UI events ───┘             reasoning?, …, extra}     ├─ <chat-streaming-md>
                                                        └─ <chat-tool-calls>
                                                            └─ optional <ng-template chatToolCallTemplate="…">
```

Two adapter paths converge on the shared `Message` interface in `@ngaf/chat/agent/message.ts`. The chat composition reads only that shape — it never sees provider-specific blocks, events, or schemas.

### 2.2 `Message` interface additions

```typescript
// libs/chat/src/lib/agent/message.ts
export interface Message {
  // existing fields…
  /** Reasoning text emitted by the model before/alongside the visible response.
   *  Populated by adapters from {type:'reasoning'}/{type:'thinking'} content
   *  blocks (LangGraph) or REASONING_MESSAGE_* events (AG-UI). */
  reasoning?: string;
  /** Wall-clock duration of the reasoning phase in milliseconds. Populated by
   *  the adapter when start and end timestamps are both known. */
  reasoningDurationMs?: number;
}
```

Both fields are optional — existing code reading `Message` is unaffected.

### 2.3 Provider neutrality

`Message.reasoning` is always a plain string. Provider-specific shape (encrypted-thinking blocks, multi-step reasoning summaries, redacted ranges) is absorbed by the adapters and not exposed to UI primitives. Future enhancements (multi-step trace, token counts, redaction badges) are additive on `Message` or attached via `Message.extra` — never breaking the v1 string contract.

---

## 3. New primitive: `<chat-reasoning>`

### 3.1 Selector & API

```typescript
@Component({ selector: 'chat-reasoning', standalone: true, changeDetection: OnPush })
export class ChatReasoningComponent {
  readonly content         = input.required<string>();
  readonly isStreaming     = input<boolean>(false);
  readonly durationMs      = input<number | undefined>(undefined);
  readonly label           = input<string | undefined>(undefined);
  readonly defaultExpanded = input<boolean>(false);
}
```

Slot: `[chatReasoningLabel]` content-projection for fully custom labels (default rendering covers the common case).

### 3.2 Visual states

| State | Pill label | Body |
|---|---|---|
| `isStreaming === true` | "Thinking…" with subtle pulsing dot | Auto-expanded; renders `[content]` through `<chat-streaming-md>` |
| Idle, has `durationMs` | `"Thought for {formatDuration(ms)}"` | Hidden by default; click to expand |
| Idle, no `durationMs` | "Show reasoning" | Hidden by default; click to expand |

`formatDuration`:
- < 1 s → `"<1s"`
- 1 s ≤ d < 60 s → `"Ns"` (e.g. `"4s"`)
- d ≥ 60 s → `"Nm Ms"` (e.g. `"1m 12s"`)

### 3.3 State management

Internal `expanded = signal(defaultExpanded)`. Transitions:

- `isStreaming` becoming `true` → force `expanded = true` (so streaming text is visible).
- `isStreaming` going `true → false` → leave `expanded` as user left it (don't force-collapse mid-read).
- `isStreaming` going `false → true` after a prior idle period (e.g. follow-up turn that re-uses the component) → reset to expanded.
- User click → toggle, and the user choice persists for the lifetime of this primitive instance.

Body re-uses `<chat-streaming-md>` for markdown rendering; reasoning text often contains lists, code, or step labels.

### 3.4 Styling

- Muted text color (`var(--ngaf-chat-text-muted)`).
- Thin left border on expanded body (matches blockquote pattern).
- Pill chrome same as existing chat surfaces (rounded rect, surface-alt bg).
- No new design tokens.

### 3.5 Tests

- Renders correct label per state (streaming / idle-with-duration / idle-without).
- `formatDuration` boundary cases (`<1s`, `1s`, `59s`, `60s → "1m 0s"`, `125s → "2m 5s"`).
- Click toggles expansion; user choice persists across `isStreaming` transitions.
- Hides itself when `[content]` is empty (`:host(:not([data-has-content])) { display: none }`).
- Force-expands when `isStreaming` is `true`.
- Streams content through `<chat-streaming-md>` (markdown renders inside the panel).

---

## 4. New directive: `chatToolCallTemplate`

### 4.1 Surface

```html
<chat-tool-calls [agent]="agent" [message]="msg">
  <ng-template chatToolCallTemplate="search_web" let-call let-status="status">
    <my-search-result-card
      [query]="call.args.query"
      [results]="call.result"
      [status]="status"
    />
  </ng-template>
  <ng-template chatToolCallTemplate="generate_image" let-call let-status="status">
    <my-image-card [prompt]="call.args.prompt" [imageUrl]="call.result" [status]="status" />
  </ng-template>
</chat-tool-calls>
```

### 4.2 Implementation

```typescript
@Directive({ selector: '[chatToolCallTemplate]', standalone: true })
export class ChatToolCallTemplateDirective {
  readonly chatToolCallTemplate = input.required<string>(); // tool name
  readonly templateRef = inject(TemplateRef<ChatToolCallTemplateContext>);
}

interface ChatToolCallTemplateContext {
  $implicit: ToolCall;       // the tool call
  status: ToolCallStatus;    // 'pending' | 'running' | 'complete' | 'error'
}
```

`<chat-tool-calls>` collects directives via `contentChildren(ChatToolCallTemplateDirective)`, builds a `Map<name, TemplateRef>`, dispatches per call. Falls back to `<chat-tool-call-card>` when no template is registered for a given tool name.

---

## 5. Augmented: `<chat-tool-calls>`

### 5.1 New inputs

```typescript
readonly grouping = input<'auto' | 'none'>('auto');
readonly groupSummary = input<((name: string, count: number) => string) | undefined>(undefined);
```

The legacy single `<ng-template>` content-child fallback (no name binding) is removed in favor of the named-template directive — consumers who want a catch-all register `chatToolCallTemplate="*"` (wildcard) and the registry uses it for any unmapped name.

### 5.2 Grouping behavior

When `grouping === 'auto'`, walk the tool-call list once. Adjacent calls with the same `name` form a group:

- **Group size 1** → render as a single card (or per-tool template if registered).
- **Group size ≥ 2 + per-tool-name template registered** → render each call through that template (consumer takes responsibility for visual density).
- **Group size ≥ 2 + no per-tool template** → render a single collapsible strip with header summary text. Expanding reveals the individual `<chat-tool-call-card>`s.
- A different `name` resets the grouping. `[search_web, search_web, read_file, search_web]` → 3 entries: a 2-group, a 1, a 1.

### 5.3 Default summary text

A small registry keyed by tool-name shape:

| Pattern | Default summary |
|---|---|
| `search_*` | "Searched N {pluralize}" |
| `generate_*` | "Generated N {pluralize}" |
| `read_*` / `write_*` / `list_*` | "Called {name} N times" |
| Any other | "Called {name} N times" |

`[groupSummary]` callback overrides the registry per-instance.

### 5.4 Tests

- Grouped: 3 sequential `search_web` calls → one strip + 3 cards on expand.
- Mixed: `search_web` + `read_file` + `search_web` → 3 entries (groups don't span name boundaries).
- Per-tool template wins: `chatToolCallTemplate="search_web"` registered → all `search_web` calls go through template, no card.
- Wildcard catch-all: `chatToolCallTemplate="*"` registered + a per-tool template for `search_web` → `search_web` calls go through their specific template; everything else goes through `*`.
- `[grouping]="'none'"`: every call independent (no auto-grouping).
- `[groupSummary]` callback overrides the default registry.

---

## 6. Augmented: `<chat-tool-call-card>`

### 6.1 Status pill

Replaces inline plaintext status with a consistent pill rendered next to the tool name:

| State | Visual | aria-label |
|---|---|---|
| `running` | spinner icon (CSS `@keyframes` rotation) | "Running" |
| `done` | check icon (success color) | "Completed" |
| `error` | exclamation icon (error color) | "Failed" |

All three pills share the same chrome (rounded rect, surface-alt bg, 11px font, semibold). Equal visual weight regardless of state.

### 6.2 Default-collapsed when done

```typescript
readonly defaultCollapsed = input<boolean>(true);
```

- `running` → expanded (visible "in progress" affordance).
- `error` → expanded (failure detail without a click).
- `done` → collapsed when `defaultCollapsed === true`.
- Header is always clickable to toggle. Once a user manually toggles, manual choice wins for the lifetime of that card instance — subsequent status changes don't override.

### 6.3 Tests

- Renders running spinner / done check / error badge with correct aria-labels.
- Default-collapsed when status is `done`; expanded for `running` and `error`.
- Click on header toggles open/closed.
- After manual toggle, card respects user choice across status changes.
- `[defaultCollapsed]="false"` always-expanded mode.

---

## 7. `<chat>` composition wiring

### 7.1 Reasoning slot

In the assistant message branch of `<chat-message-list>`'s template, render `<chat-reasoning>` between any tool-calls/subagents block and the response markdown when `message.reasoning` is non-empty:

```html
@if (message.reasoning) {
  <chat-reasoning
    [content]="message.reasoning"
    [isStreaming]="isReasoningStreaming(message)"
    [durationMs]="message.reasoningDurationMs"
  />
}
```

`isReasoningStreaming(message)` is a small helper computed from agent state: `true` when this message is the streaming tail AND no response text has arrived yet. Once response tokens start, `isStreaming` flips to `false` and the panel collapses (per its internal logic in §3.3).

### 7.2 Tool-call template forwarding

Consumers projecting `<ng-template chatToolCallTemplate="…">` directives directly into `<chat>` need them forwarded into the inner `<chat-tool-calls>`. Pattern matches existing `[chatInputModelSelect]` / `[chatWelcomeSuggestions]` slot forwarding: outer `<chat>` accepts content via projection, inner `<chat-tool-calls>` `contentChildren()` picks them up by directive class. The templates are projected via `<ng-content>` inside the message-list template.

### 7.3 Public API additions to `@ngaf/chat`

Re-exports from `public-api.ts`:

- `ChatReasoningComponent`
- `ChatToolCallTemplateDirective`
- `ChatToolCallTemplateContext` (interface)
- `formatDuration` utility

---

## 8. Bridge changes

### 8.1 `@ngaf/langgraph` (`stream-manager.bridge.ts` + `agent.fn.ts → toMessage`)

1. New `extractReasoning(content)` helper, parallel to `extractText`. Walks complex-content arrays, accumulates text from `{type:'reasoning'}` and `{type:'thinking'}` blocks (provider-agnostic), skips everything else.
2. New `accumulateReasoning(existing, incoming)` parallel to `accumulateContent` — same superset / pure-delta append semantics, returns string.
3. `mergeMessages` extended: when merging an incoming AI chunk into an existing slot, additionally accumulate reasoning content via `accumulateReasoning(existing.reasoning, incoming.reasoning)` and write it to the merged slot.
4. New `reasoningTimingMap = new Map<messageId, {startedAt: number; endedAt?: number}>()`. First chunk with reasoning content for a given id sets `startedAt`. First chunk where response text appears (and reasoning is non-empty) sets `endedAt`. On final canonical message merge, compute `reasoningDurationMs = endedAt - startedAt` if both timestamps exist. The map is cleared on `resetThreadState()` (thread switch) and on bridge teardown so it doesn't leak across thread boundaries.
5. `toMessage` (in `agent.fn.ts`) reads accumulated reasoning + the timing map, returns `{…, reasoning, reasoningDurationMs}`.

### 8.2 `@ngaf/ag-ui` (`to-agent.ts`)

1. New event handlers:
   - `REASONING_MESSAGE_START` — record `startedAt` for the active assistant message; initialize its `reasoning` string.
   - `REASONING_MESSAGE_CONTENT` / `REASONING_MESSAGE_CHUNK` — append to the active message's `reasoning` string.
   - `REASONING_MESSAGE_END` — record `endedAt`; compute and write `reasoningDurationMs`.
2. The active-message tracking already exists for text-message events; reasoning piggy-backs on the same `currentMessageId` pointer.
3. Update the `messages` signal whenever reasoning state changes for the active message (same pattern as text content updates).

### 8.3 Conformance test

A shared `reasoning-fixture.ts` defines an abstract event sequence ("reasoning chunk arrives", "text chunk arrives") and the expected `Message[]` output. Both adapter spec suites translate the abstract sequence into their respective wire format and assert the same `Message[]` shape (including `reasoning` text and `reasoningDurationMs >= 0`). One fixture, two adapters — keeps the populating logic honest across implementations.

---

## 9. Testing harnesses

Three test/mock surfaces beyond the runtime adapters. None require behavior changes; the `Message` widening makes the new fields available automatically.

- **`libs/chat/src/lib/testing/mock-agent.ts`** — generic `Message[]` mock for chat-library tests. No code change. Spec suites that exercise the new behavior seed mock messages with `reasoning` populated.
- **`libs/langgraph/src/lib/testing/mock-langgraph-agent.ts`** — exposes `messages` and `langGraphMessages` signals. Same widening; example added to docs showing how to seed reasoning text.
- **`libs/ag-ui/src/lib/testing/fake-agent.ts`** — canned event emitter. Gains an optional `reasoningTokens?: string[]` constructor option that, when provided, emits `REASONING_MESSAGE_START` → N × `REASONING_MESSAGE_CONTENT` → `REASONING_MESSAGE_END` *before* the existing text token sequence.
- **`libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.ts`** — pass-through of the new `reasoningTokens` option.

---

## 10. Documentation

Per-component MDX files under `apps/website/content/docs/chat/components/`.

### 10.1 New docs

- **`chat-reasoning.mdx`** — full primitive reference: API table for all inputs (`[content]`, `[isStreaming]`, `[durationMs]`, `[label]`, `[defaultExpanded]`), three visual states with code examples, the `formatDuration` helper, the `[chatReasoningLabel]` slot, integration example showing automatic rendering by `<chat>` plus a standalone usage example.
- **`chat-tool-call-template.mdx`** — directive reference. Selector + template context shape (`let-call`, `let-status`), worked examples (search results card, image generation card), interaction with `[grouping]`.

### 10.2 Updated docs

- **`chat-tool-calls.mdx`** — adds `[grouping]` input, `[groupSummary]` callback, the `chatToolCallTemplate` extension pattern (cross-link to its dedicated page), grouping behavior table.
- **`chat-tool-call-card.mdx`** — adds `[defaultCollapsed]` input, status pill visual reference (running/done/error), default-state behavior table per status.
- **`chat.mdx`** — short "Reasoning" subsection covering automatic `<chat-reasoning>` rendering and the tool-call template projection example.

### 10.3 Changelog

A "What's new in chat 0.0.19" callout in the appropriate changelog page (location confirmed during planning) covering: reasoning auto-display, default-collapsed tool-call cards, per-tool template extension via `chatToolCallTemplate` directive, named-template registry replacing the legacy single-template fallback, automatic grouping of sequential same-name calls.

### 10.4 Hard constraint

Never reference any chat-UI library this work was inspired by. No `copilotkit` / `chatgpt` / `chatbot-kit` references in code, comments, commits, PR bodies, or docs. The aesthetic and extensibility patterns described here are independently arrived at.

---

## 11. Versioning & release

- `@ngaf/chat` 0.0.18 → **0.0.19** — new primitive, new directive, augmented primitives, new `Message` fields, tool-call rendering reshaped (default-collapsed cards, named-template registry replacing the legacy single-template fallback).
- `@ngaf/langgraph` 0.0.10 → **0.0.11** — bridge extracts reasoning, populates timing.
- `@ngaf/ag-ui` current → next patch — reasoning event handlers + fake-agent reasoning option.

Single PR, single tag set: `chat-v0.0.19`, `langgraph-v0.0.11`, `ag-ui-v<next>`. Phased commits inside the PR.

Branch: `claude/chat-reasoning-and-tool-call-templates`, fresh from `origin/main` after #191 merges.

These are pre-1.0 patch releases. No backward-compatibility guarantees — the legacy single-template fallback in `<chat-tool-calls>` is removed (replaced by the wildcard `chatToolCallTemplate="*"` pattern), and `<chat-tool-call-card>` defaults to collapsed-when-done. Consumers update at the same patch boundary.

---

## 12. Out of scope (deferred)

- **Citations / sources rendering** — next sub-phase after this one (per the B2-then-citations plan).
- **D — generative UI / structured streaming output** (`<chat-generative-ui>` polish).
- **A — thread list / conversation continuity.**
- **C — file/image attachments / voice input.**
- **Multi-step reasoning visualization** — one reasoning string is the v1 contract.
- **Reasoning effort surface in UI** — developer-side only (`reasoning_effort` in adapter state).
- **Per-step reasoning timing or token counts** beyond `reasoningDurationMs`.

---

## 13. Smoke test plan

- Regression: `~/tmp/ngaf` against `langgraph dev` + gpt-5-mini at default `reasoning.effort='minimal'` — verify reasoning pill appears with "Thought for Ns" after streaming completes.
- Regression: same with effort raised to `'high'` — verify reasoning streams visibly while pill says "Thinking…", collapses to "Thought for Ns" when text starts.
- Regression: tool-call card renders collapsed after a tool completes (graph that exercises a tool).
- Smoke: register a `chatToolCallTemplate="search_web"` in the smoke app, verify it replaces the default card.
