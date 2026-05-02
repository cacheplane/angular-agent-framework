# Chat Pipeline Redesign

**Status:** Design • **Date:** 2026-05-02 • **Owner:** brian@brianflove.com

## Summary

Redesign three connected pieces of the @ngaf chat library:

1. Extract a standalone partial-JSON streaming parser (`@cacheplane/partial-json`) shared by @ngaf/chat and a separate downstream project (pretable).
2. Replace the @ngaf/chat streaming-markdown renderer with a simpler, RAF-batched full-reparse approach. Delete the existing append-only incremental renderer.
3. Add a dedicated welcome-screen primitive that owns the empty-state UX (centered greeting + centered input + optional suggestions), distinct from the conversation layout.

Phases ship in dependency order. Phase 4 (migrating pretable to consume the new package) is deferred to a separate session and provided as a self-contained prompt.

## Goals

- Reduce streaming-related complexity in @ngaf/chat by deleting the bespoke append-only renderer (~200 LOC) and replacing it with a ~30 LOC RAF-batched reparse component.
- Eliminate the class of bugs caused by negative-delta math in the incremental renderer (silent freeze when content is shorter than the previous emission).
- Share the partial-JSON parser between @ngaf/chat and the downstream tabular project so improvements (validation, performance, structural sharing) accrue to both.
- Give @ngaf/chat a distinctive empty-state UX so consumers don't see a generic "How can I help?" placeholder hugging the bottom of the screen.
- Keep @ngaf/chat's public surface mostly stable; consumers should update import paths once and experience no behavior regressions.

## Non-goals

- Changing the LLM wire format @ngaf/chat assumes (still: free-form text via langgraph adapter; structured JSON envelope is a future option, not part of this redesign).
- Replacing `marked` with a different markdown parser.
- Worker-thread parsing.
- Virtualized message list for very long histories.
- Time-of-day greeting variation, animated typed-out title, persistent dismiss for the welcome screen.

## Architecture

```
phase 1 ───────────────────────────────────────────────
  github.com/cacheplane/partial-json (new repo)
    ├── npm: @cacheplane/partial-json@1.0.0
    ├── tokenizer: pretable's strict state machine
    ├── api: events + getByPath + materialize (from @ngaf/partial-json)
    └── tests: union of both projects' suites (~70+ cases)

phase 2 ───────────────────────────────────────────────
  @ngaf/chat 0.0.14
    ├── deps: + @cacheplane/partial-json
    ├── delete: libs/chat/src/lib/streaming/streaming-markdown.ts
    ├── rewrite: chat-streaming-md.component.ts (RAF-batched reparse)
    ├── update: content-classifier.ts (import @cacheplane/partial-json)
    ├── update: parse-tree-store.ts (import @cacheplane/partial-json)
    ├── rekey: chat.component.ts classifiers Map by message.id
    └── add: localStorage NGAF_CHAT_STREAM_TRACE harness

  @ngaf/a2ui 0.0.3, @ngaf/render 0.0.3
    └── update: @ngaf/partial-json -> @cacheplane/partial-json

  @ngaf/partial-json 0.0.2 (frozen)
    └── deprecated; no further versions published

phase 3 ───────────────────────────────────────────────
  @ngaf/chat 0.0.15
    ├── new: libs/chat/src/lib/primitives/chat-welcome/
    │   ├── chat-welcome.component.ts (greeting + slots)
    │   ├── chat-welcome-suggestion.component.ts (helper row)
    │   └── styles
    └── update: libs/chat/src/lib/compositions/chat/chat.component.ts
        └── empty-state branch renders welcome (not scroll container)

phase 4 ───────────────────────────────────────────────
  Deferred. Self-contained prompt at:
  docs/superpowers/context/2026-05-02-pretable-partial-json-migration.md
```

## Phase 1 — `@cacheplane/partial-json`

### Repo

New repo `github.com/cacheplane/partial-json`. Pure TypeScript library. ESM + CJS. Tests run on Node. Standard CI: lint + test + build + npm publish via OIDC.

### Authoring base

Combine the strengths of the two existing parsers:

| Layer | Source | Justification |
|---|---|---|
| Tokenizer / state machine | pretable/json-stream/handlers.ts | Stricter validation: errors on invalid escape, control chars, malformed unicode; correctly handles partial keywords (e.g. `tru` is buffered, not eagerly completed as a boolean). |
| Identity preservation | pretable/json-stream/internals.ts | `preserveArrayValue`, `preserveObjectValue`, `propagateResolved` already implemented. Returns old object reference when content unchanged. |
| `finish()` | pretable/json-stream | Closes open primitives at stream end and validates resulting tree. Missing in @ngaf today. |
| Event API (`node-created`, `value-updated` with delta, `node-completed`) | @ngaf/partial-json/parser.ts | Useful for downstream consumers that want push notifications instead of polling the tree. |
| `getByPath(path)` (RFC 6901 JSON Pointer subset) | @ngaf/partial-json/parser.ts | Convenient for content-classifier and consumers that know the schema. |
| `materialize()` with WeakMap structural sharing | @ngaf/partial-json/materialize.ts | Stable references for `===` checks in downstream rendering. |

Result: ~2000 LOC superset, public API:

```ts
// Pull-style (pretable)
import { create, push, finish, resolve } from '@cacheplane/partial-json';
let state = create();
state = push(state, chunk);
state = finish(state);
const value = resolve(state); // JsonValue | undefined

// Push-style (ngaf)
import { createPartialJsonParser, materialize } from '@cacheplane/partial-json';
const parser = createPartialJsonParser();
const events = parser.push(chunk); // ParseEvent[]
const root = parser.root;          // JsonNode | null
const node = parser.getByPath('/items/1/id');
const value = materialize(parser.root);
```

Both APIs share the same internal node graph; pull-style users can operate on `state.nodes`, push-style users can operate on `parser.root`.

### Versioning

Start at `1.0.0`. Both source parsers are mature. Public API is documented and tested. Future breaking changes go through a deprecation cycle with `@deprecated` JSDoc + warnings before any major bump.

### Test suite

Union of:
- pretable's existing tests (strict validation, error cases)
- @ngaf/partial-json's existing tests (event ordering, getByPath, materialize)
- New cross-cutting tests (parity between pull and push APIs, finish() semantics, deep nesting, scientific notation, dangling commas, all the partial-keyword cases pretable handles correctly)

Aim for >95% line coverage on the parser and 100% on the public API surface.

### Migration of @ngaf/* consumers

```
libs/chat/src/lib/streaming/content-classifier.ts:4
libs/chat/src/lib/streaming/parse-tree-store.ts:4-5
libs/chat/src/lib/streaming/parse-tree-store.spec.ts:4
(plus libs/a2ui, libs/render — confirm with grep)
```

Find-and-replace `@ngaf/partial-json` → `@cacheplane/partial-json` in source. Update package.json `peerDependencies`. Run full test suite; expected to pass without code changes since the API is preserved.

### `@ngaf/partial-json` lifecycle

Frozen at 0.0.2. Add `"deprecated"` field to package.json:

> Replaced by `@cacheplane/partial-json`. No further versions will be published.

Repo subdirectory `libs/partial-json/` may eventually be deleted in a separate cleanup PR; leave it for now to avoid a cascade.

## Phase 2 — Chat streaming rewrite

### Files deleted

- `libs/chat/src/lib/streaming/streaming-markdown.ts` (~200 LOC append-only DOM renderer)
- `libs/chat/src/lib/streaming/streaming-markdown.spec.ts` (its tests; replaced by tests on the new renderer)

### `chat-streaming-md.component.ts` (rewritten)

Replaces the existing 80-LOC component with a ~30-LOC version:

- One `effect()` reading `content()` and `streaming()` signals
- `requestAnimationFrame` schedules a single render per frame
- Coalesces multiple signal updates into the latest content
- Renders by computing `marked.parse(content)` synchronously and writing the result via `el.innerHTML` (sanitized through DomSanitizer)
- No `lastContent`, no delta math, no append-only state
- Idempotent and side-effect-free per frame
- On `streaming()` flipping false, no special "final swap" logic — it's just one more render

Pseudocode:

```ts
private rafHandle = 0;
private pendingContent = '';

constructor() {
  effect(() => {
    this.pendingContent = this.content();
    if (this.rafHandle) return;
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = 0;
      const html = renderMarkdownToString(this.pendingContent, this.sanitizer);
      this.el.innerHTML = html;
    });
  });

  inject(DestroyRef).onDestroy(() => {
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
  });
}
```

### Classifier map keyed by id

`libs/chat/src/lib/compositions/chat/chat.component.ts`:

```ts
private readonly classifiers = new Map<string, ContentClassifier>();
```

`classifyMessage(content, message)` looks up by `message.id`. A janitor effect compares the current `agent.messages()` with the map keys and disposes classifiers for messages no longer present.

### Trace harness

Single internal flag in `libs/chat/src/lib/streaming/trace.ts`:

```ts
function isTraceEnabled(): boolean {
  if (typeof globalThis === 'undefined') return false;
  const win = (globalThis as any).window;
  if (!win) return false;
  if ((win as any).__ngafChatTrace === true) return true;
  try { return win.localStorage?.getItem('NGAF_CHAT_STREAM_TRACE') === '1'; } catch { return false; }
}
export function trace(...args: unknown[]): void {
  if (isTraceEnabled()) console.debug('[ngaf-chat-stream]', ...args);
}
```

Call sites (all guarded by `if (isTraceEnabled())` to skip allocation in the off path):

- `chat-streaming-md` rendered: `{ frame, contentLength, durationMs }`
- `content-classifier.update()`: `{ messageId, contentLength, branch }`
- `chat.component` classifyMessage hits/misses
- `langgraph` stream-manager.bridge messages-tuple events: `{ id, contentLength, mode }`
- `langgraph` values-event sync: `{ existingLength, incomingLength, mergedLength, idsPreserved }`

Off-path is a single boolean check + early return, dead-code-eliminated by Terser when used inside `if (isTraceEnabled()) ...`.

### Reproduce + diagnose long-stream symptom

After the rewrite ships, deliberately reproduce the user-reported "streaming not working on long outputs" symptom with a controlled prompt:

> "Write 800 words about coral reefs. Use three markdown headings. Include one fenced code block per section."

Capture the trace, MutationObserver log, and network event stream. Categorize the symptom:

- Stall mid-stream → likely throttle/RAF scheduling, fix in `agent.fn` throttle config
- Visible truncation → likely id swap or merge edge case, instrument bridge
- Markdown breaks → likely already fixed by the rewrite (full reparse, no incremental state)
- Tokens drop → likely throttle window, lower to 8ms or remove
- Final state correct, intermediate broken → already fixed by the rewrite

Whatever the category, fix it under the same milestone. Document the cause in the spec's "Findings" appendix below.

### Tests

- New: `chat-streaming-md.component.spec.ts` — covers RAF batching, idempotent renders, dispose-cleanup
- New: regression test exercising content shrink (a previous bug class)
- Updated: `content-classifier.spec.ts`, `parse-tree-store.spec.ts` — adjust imports

### `@ngaf/chat` version

`0.0.14` for the streaming rewrite milestone.

## Phase 3 — Welcome screen

### `<chat-welcome>` primitive

`libs/chat/src/lib/primitives/chat-welcome/chat-welcome.component.ts`. Standalone, OnPush. Public host CSS variables:

```
--ngaf-chat-welcome-max-width  (default: 36rem)
--ngaf-chat-welcome-gap        (default: 1.5rem)
--ngaf-chat-welcome-padding    (default: 24px)
```

Template:

```html
<div class="chat-welcome__inner">
  <span class="chat-welcome__beacon" aria-hidden="true"></span>
  <ng-content select="[chatWelcomeTitle]">
    <h1 class="chat-welcome__title">How can I help?</h1>
  </ng-content>
  <ng-content select="[chatWelcomeSubtitle]">
    <p class="chat-welcome__subtitle">Ask anything to get started.</p>
  </ng-content>
  <div class="chat-welcome__input"><ng-content select="[chatWelcomeInput]" /></div>
  <div class="chat-welcome__suggestions">
    <ng-content select="[chatWelcomeSuggestions]" />
  </div>
</div>
```

### Differentiating visual elements

- **Two-line greeting**: h1 (1.25rem mobile / 1.5rem desktop, weight 500) plus a smaller subtitle paragraph in muted color. Avoids the single-giant-h1 look.
- **Beacon dot**: a 16x16 dot positioned 8px above the title, animated with the same 2s cubic-bezier pulse curve as our streaming caret. Quietly signals "ready to listen". Implementation: a `<span>` with a radial-gradient background and an `animation: ngaf-chat-pulse 2s ...` rule.
- **Vertical suggestion rows**: optional helper component `<chat-welcome-suggestion>` renders a left-aligned row with leading icon + label + chevron, separated by hairlines. Reads like a recommended-actions list, not pill tags. Consumer can opt out by projecting their own content into `[chatWelcomeSuggestions]`.
- **Fade-in mount**: 200ms opacity 0 → 1 + 8px translateY (-8 → 0) on first mount.

### `<chat-welcome-suggestion>` helper

```html
<button class="chat-welcome-suggestion" (click)="select.emit(value())">
  <ng-content select="[chatWelcomeSuggestionIcon]" />
  <span class="chat-welcome-suggestion__label">{{ label() }}</span>
  <span class="chat-welcome-suggestion__chevron" aria-hidden="true">›</span>
</button>
```

Inputs: `label: string`, `value: string`. Output: `select: EventEmitter<string>`.

### Composition change in `<chat>`

Today: empty-state is a hidden `<div class="chat-empty">` inside the scroll container, displayed when `agent.messages().length === 0`.

After: an upstream `@if (showWelcome())` branch decides. When true, the scroll container is not rendered; instead `<chat-welcome>` is rendered with the existing `<chat-input>` projected into its `[chatWelcomeInput]` slot. When false (any messages exist, or welcome explicitly disabled, or thread is loading), the normal scroll layout renders.

```ts
readonly welcomeDisabled = input<boolean>(false);
readonly showWelcome = computed(() => {
  if (this.welcomeDisabled()) return false;
  if (this.agent().isThreadLoading?.()) return false;
  return this.agent().messages().length === 0;
});
```

### Welcome → conversation transition

When `showWelcome()` flips false, the welcome branch unmounts and the scroll branch mounts. The `<chat-input>` is projected into both branches; we need to ensure its internal state (text being typed, focus, composition) survives the swap. Two options:

1. Keep the `<chat-input>` as a sibling of both branches and use CSS positioning to move it (centered → bottom-anchored) based on a host attribute.
2. Accept a fresh remount; users almost always click send before the swap, so internal state loss is rarely visible.

**Recommendation**: option 2 for simplicity. If users report issues with mid-compose state loss, revisit with option 1 in a follow-up.

### `welcomeDisabled` and configuration

Single boolean input on `<chat>`. Consumer-controlled (resumed thread, custom empty UX, embedded contexts where the welcome is inappropriate).

### Tests

- `chat-welcome.component.spec.ts` — render, slot projection, beacon animation present
- `chat-welcome-suggestion.component.spec.ts` — emit on click, label render
- `chat.component.spec.ts` — welcome shows on empty messages, hides when messages exist, hides when `welcomeDisabled=true`

### `@ngaf/chat` version

`0.0.15` for the welcome screen milestone.

## Phase 4 — Pretable migration (deferred)

Pretable currently maintains its own copy of the parser. After Phase 1 lands, pretable can migrate to consume `@cacheplane/partial-json` and delete its local copy.

Deferred to a separate session because:

- It's an unrelated repo (separate ownership context)
- The migration is mechanical once Phase 1 is live
- Doing it inline expands this milestone's scope unnecessarily

A self-contained prompt for that session is committed at `docs/superpowers/context/2026-05-02-pretable-partial-json-migration.md`. The prompt includes: current state of pretable's `packages/json-stream/`, the new package's API, file-by-file migration steps, and a test plan.

## Risk assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| The "streaming not working on long outputs" symptom is unrelated to the renderer rewrite | Medium | Trace harness lands in Phase 2 to isolate the actual cause. If the rewrite alone doesn't fix it, the trace data tells us what to fix next. |
| @cacheplane/partial-json API drift breaks consumers | Low | Phase 1 includes parity tests against both source projects' existing test suites before any consumer migration. |
| Chat-input state loss on welcome → conversation swap is jarring | Low-Medium | Phase 3 ships option 2 (accept remount). User feedback determines whether option 1 (sibling positioning) is needed. |
| Welcome screen doesn't differentiate enough from inspirations | Low | Beacon + vertical suggestion rows + fade-in mount + 2-line greeting are all distinct enough. Consumer slot projection lets app authors customize further. |
| Pretable migration prompt becomes stale | Medium | Date-stamped doc; reviewer of the deferred session reads the current state of both repos before acting. |

## Findings appendix

Diagnosed during Phase 2 reproduction (2026-05-02) against a real LangGraph backend with the trace harness enabled.

**Symptom**: previously reported as "streaming is not working for long outputs". After the rewrite, an ~800-word response (5092 chars) renders end-to-end without DOM teardown, classifier desync, or visible truncation.

**Trace counts for an 800-word response:**

| Event | Count | Note |
|---|---|---|
| `bridge.messages-tuple` | 982 | One per streamed token (expected) |
| `bridge.values-sync` | 2 | Initial state + final (sane) |
| `classifier.update` | 9 | Angular `@let` recomputes only when its expression's input identity changes — message-id identity preservation in the langgraph bridge keeps the Message reference stable, so `@let content = messageContent(message)` doesn't re-evaluate per token |
| `streaming-md.flush` | 1 | RAF coalesced 9 content updates into a single render frame because they arrived before RAF fired |

**Root cause of original symptom (pre-rewrite)**: The bespoke append-only renderer's `delta = content.slice(lastContent.length)` silently froze whenever `content.length < lastContent.length`. On long streams, intermediate values events would briefly shrink content, the renderer would compute a negative/empty delta, and the DOM would freeze for the rest of the stream.

**Fix**: replaced with RAF-batched full-reparse component — idempotent within a frame, never reads `lastContent`, immune to content shrinking. The classifier-by-id rekey + janitor prevents stale-state bleed across messages.

**Side observation**: the low `streaming-md.flush` count (1 per long stream) is a feature, not a bug — RAF coalesces content updates that arrive faster than 60Hz into single frames. The user perceives the rendered DOM, not the trace count. Visual smoothness during streaming is bounded by how often content changes shape semantically (paragraph breaks, list items, code fences open/close), not how many tokens arrive.

**Open follow-up**: the identity preservation in the bridge is so aggressive that the chat composition's `@let content = messageContent(message)` only re-evaluates ~9 times per long stream. If consumers report a "jumpy" feel during long streams (i.e. visible jumps rather than smooth token-by-token text growth), revisit by either weakening identity preservation or threading a content-only signal through the chat-streaming-md path (bypassing the @let recomputation gate).

**Regression test added**: `streaming-markdown.component.spec.ts` — "handles content shrinking without freezing" exercises the failure path that the negative-delta math would have hit.

## Open questions

None. All scope decisions answered during brainstorming.
