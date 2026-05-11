# Progressive GenUI Rendering + Bubble Coalescing — Design

**Status:** Approved (brainstorm 2026-05-11)
**Scope:** `@ngaf/chat` lib (catalog API, surface store, `<a2ui-surface>` internal rewrite, chat composition diff); `examples/chat/python` graph (single-node change).
**Supersedes:** The bubble-level `<chat-genui-skeleton>` rendering that lands in `<chat-message>`'s ng-content slot via the chat composition template.

---

## Problem

The GenUI flow today produces TWO assistant bubbles per turn:

1. **M1 — tool-call AI message.** Empty visible body (function_call content blocks filtered). The `<chat-genui-skeleton>` renders here for the duration of streaming.
2. **M2 — emit AI message.** Streams the wrapped `---a2ui_JSON---\n[envelopes]` payload. Once the classifier resolves the content to `'a2ui'`, the `<a2ui-surface>` mounts here and renders the UI.

By the end of the run, the user sees the skeleton bubble (M1) sitting above the rendered UI bubble (M2). The skeleton never transitions in place — a new bubble appears instead.

Two reference patterns in the broader ecosystem of generative UI libraries inform a better model:

- **Structured-output, per-component fallback (lib A pattern).** Generative UI is the assistant's structured content. One LLM call emits structured envelopes against a schema. The renderer walks the component tree and renders each node via `NgComponentOutlet`. Each component declares an optional `fallback` component, mounted while its props are still partial; once props complete, the slot swaps to the real component in place. No global "building UI" placeholder.
- **Tool-call-with-render, attached-to-message (lib B pattern).** Generative UI is a tool call with a `render(args, status)` function. The rendered output is hung off the assistant message as a sibling of the text content. Tool result messages render as `null`. The skeleton lives in the same DOM slot the real UI will mount into; status transitions (`inProgress` → `complete`) drive the transformation in place.

Both libraries converge on two invariants:

1. **One assistant turn = one visible bubble.** The tool result is hidden; the rendered UI lives on the same message that has the tool call.
2. **The skeleton lives in the DOM slot the real UI will mount into.** Progressive rendering reveals components in place, not as new messages.

Our backend's `emit_generated_surface` node appends a new AIMessage, which is what produces the two-bubble outcome. The frontend then dutifully renders both.

## Solution overview

Two changes ship together:

**B — Backend coalescing.** `emit_generated_surface` stops appending a new AIMessage. Instead it returns an AIMessage with the same `id` as the upstream tool-call AI message; LangGraph's `add_messages` reducer replaces by id match. The thread keeps one AI message per GenUI turn, carrying both the original `tool_calls` AND the wrapped surface content.

**C — Per-component fallback rendering.** The lib's catalog API gains an inline `fallback` slot per component type. `<a2ui-surface>` is rebuilt to walk the component tree and render each node via `NgComponentOutlet` — either the fallback (while bindings are unresolved) or the real component (once all bindings are populated). The chat composition drops its bubble-level `<chat-genui-skeleton>` branch; `<a2ui-surface>` becomes the single skeleton owner, with an empty-surface fallback for the gap before any component appears.

The combined result: a single assistant bubble per GenUI turn that mounts `<a2ui-surface>` on the first envelope, reveals component skeletons in the structure of the eventual UI, and swaps each component from skeleton to real in place as data binding envelopes arrive.

## Components

### Backend — `examples/chat/python/src/graph.py`

Single function changed: `emit_generated_surface` node (around line 500).

**Before:**

```python
# Append a new AIMessage carrying the wrapped surface payload
new_ai = AIMessage(content=wrapped, id=str(uuid4()))
return {"messages": [updated_tool_msg, new_ai]}
```

**After:**

```python
# Locate the upstream tool-call AI message — the most recent assistant
# message before the tool result we're processing.
tool_call_ai = next(
    m for m in reversed(state["messages"])
    if isinstance(m, AIMessage) and m.tool_calls
)

# Build a replacement AIMessage with the SAME id. add_messages matches
# by id and replaces in place, preserving tool_calls but updating
# content with the wrapped surface payload.
replacement = AIMessage(
    id=tool_call_ai.id,
    content=wrapped,
    tool_calls=tool_call_ai.tool_calls,
    additional_kwargs=tool_call_ai.additional_kwargs,
    response_metadata=tool_call_ai.response_metadata,
)

return {"messages": [updated_tool_msg, replacement]}
```

Post-emit thread state: `[user, ai(tool_calls + wrapped_content), tool(rendered)]` — three messages, not four.

**Preserved fields:**
- `tool_calls` — survives the replacement so time-travel, regenerate, fork, citations linkage all still work.
- `additional_kwargs` — token counts, reasoning blocks, citations stay attached.
- `response_metadata` — model info, finish reason stay attached.
- Tool message's `tool_call_id` still points at the original tool_call entry in the assistant's `tool_calls` array.

### Lib — catalog API

**`libs/chat/src/lib/a2ui/views.ts`** — new file exporting the `A2uiViewEntry` discriminated type:

```typescript
export interface A2uiViewEntry {
  /** The real component mounted once all bound paths are populated. */
  component: Type<unknown>;
  /** Optional skeleton rendered while bound paths remain unpopulated.
   *  Falls back to the lib-default skeleton when omitted. */
  fallback?: Type<unknown>;
}

export type A2uiViews = Record<string, Type<unknown> | A2uiViewEntry>;
```

**Migration:** existing consumers passing `views = { button: ButtonCmp }` (bare type) continue to work. The surface normalizes bare entries into `{ component }` shape on lookup. New consumers can opt into `views = { button: { component: ButtonCmp, fallback: ButtonSkeletonCmp } }`.

### Lib — surface store extensions

**`libs/chat/src/lib/a2ui/surface-store.ts`** — extend `A2uiSurfaceStore`:

- `A2uiSurface.components: ReadonlyMap<string, A2uiComponent>` — exposes per-component state where:
  - `type: string` — the component type key (matches a `views` entry).
  - `bindings: readonly string[]` — the data model paths this component references, extracted from its prop expressions on `surfaceUpdate` apply.
  - `ready: boolean` — true when ALL bindings are populated in the accumulated data model.
  - `props: Record<string, unknown>` — the resolved property values (only meaningful when `ready === true`).

- `A2uiSurfaceStore.dataModel: ReadonlyMap<string, unknown>` — the accumulated data model exposed for debug. Internal use only; the surface renderer reads `ready` + `props` directly, not the data model.

**Per-component readiness rule** (monotonic):
- `surfaceUpdate` apply: derives `bindings` per component from prop expressions, sets `ready: false` initially.
- `dataModelUpdate` apply: recomputes `ready` per affected component. Once `ready` transitions `false → true`, it stays `true` — even if a later update sets a referenced path to `null`. Subsequent dataModelUpdates push new resolved `props` to the component without flipping `ready` back.

The "stays true" rule means the rendered component, once mounted, receives a `null` binding as a reactive input change rather than reverting to fallback. Aligns with the design's monotonic swap rule (no flicker).

### Lib — `<a2ui-surface>` internal rewrite

**`libs/chat/src/lib/a2ui/surface.component.ts`** — template walks the surface's component tree depth-first via a new internal `a2uiSlot` structural directive.

```html
@if (surface().components.size === 0) {
  <ng-container *ngComponentOutlet="surfaceFallback() ?? defaultFallback" />
} @else {
  @for (rootId of surface().rootIds; track rootId) {
    <ng-container *a2uiSlot="surface().components.get(rootId)" />
  }
}
```

**`a2uiSlot` directive** — internal, not exported:

1. Resolves the component's `type` against the catalog → `A2uiViewEntry` (normalized).
2. Reads `component.ready`:
   - `false` → mounts `entry.fallback ?? DefaultFallbackComponent` via `NgComponentOutlet` with whatever partial props are available.
   - `true` → mounts `entry.component` with the resolved `component.props`.
3. Recursively renders the component's children — each child runs through the same slot logic.
4. **Monotonic gate:** stores `private mountedReal = false` on the directive instance. Once `mountedReal` is true, subsequent template-binding ticks only push new input values via the cached `ComponentRef.setInput()` — no remount, no re-check of `ready`.

**`<a2ui-default-fallback>` primitive** — new internal component. Visually identical to the current `<chat-genui-skeleton>`: 1px border, 10px radius, three shimmer rows, "✨ Building UI…" label. Used as:
- The top-level surface-fallback when `surface.components.size === 0`.
- The per-component fallback for any view entry whose `fallback` is omitted.

The primitive is internal to `<a2ui-surface>` — not exported in the public API.

**`surfaceFallback` input** on `<a2ui-surface>` — optional `Type<unknown>` for consumers who want a different top-level placeholder (defaults to `A2uiDefaultFallbackComponent`).

### Lib — chat composition

**`libs/chat/src/lib/compositions/chat/chat.component.ts`** — template changes inside the `ai` `chatMessageTemplate`:

```html
<!-- REMOVED entirely: -->
@if (genuiTurn && classified.type() !== 'a2ui' && classified.type() !== 'json-render') {
  <chat-genui-skeleton />
} @else if (classified.type() === 'a2ui' && classified.a2uiSurfaces().size === 0 && genuiTurn) {
  <chat-genui-skeleton />
} @else if (classified.markdown(); as md) {
  <chat-streaming-md [content]="md" ... />
}

<!-- REPLACED with: -->
@if (classified.markdown(); as md) {
  <chat-streaming-md [content]="md" ... />
}
```

The existing `<a2ui-surface>` branch (`@if (classified.type() === 'a2ui' && views(); as catalog)`) stays — it mounts the surface even when the surface has zero components (the surface owns its empty state).

**`<chat-genui-skeleton>` primitive stays in the lib's public API.** Consumers using `<chat-message>` directly with their own templates can still drop it in. The chat composition just no longer renders it.

**`isGenuiTurn` stays.** It still drives the `[excludeToolNames]` binding on `<chat-tool-calls>` (hide GenUI tool cards) and informs the classifier's `'pending'` patience window. No longer drives a skeleton branch.

## Data flow

End-to-end walkthrough for a GenUI prompt with B + C live:

```
T=0     User submits "Render a settings card…". status → 'running'.
        chat-typing-indicator visible at bottom.

T+~500ms  Sub-LLM tool call starts streaming. AIMessage appears with
          tool_calls = [{ name: 'generate_a2ui_schema', ... }] and
          content = [function_call block, reasoning block].
          
          Frontend: isGenuiTurn(message) === true (tool_calls match).
          chat-tool-calls renders no group (excludeToolNames filter).
          classifier is 'pending'. No skeleton renders (we removed the
          template branch). Bubble exists but is visually empty;
          typing indicator at the bottom is the only motion.

T+~3s   Sub-LLM completes. emit_generated_surface returns AIMessage
          with the same id as the tool-call AI. add_messages reducer
          replaces in place: M1 now carries tool_calls AND
          content = '---a2ui_JSON---\n[envelopes]'.
          
          Frontend: classifier sees the prefix, transitions
          'pending' → 'a2ui'. Parser feeds envelopes into the
          surface store.

T+~3.05s  First envelope is surfaceUpdate. Store builds the component
          tree, extracts bindings per component, all ready=false.
          
          <a2ui-surface> mounts. surface.components.size > 0 → skips
          top-level fallback. a2uiSlot directive walks the tree and
          mounts each component's fallback (entry.fallback ?? default).
          
          User sees: skeleton shapes arranged in the structure of the
          eventual UI (a header-shaped skeleton, a row of input-shaped
          skeletons, a button-shaped skeleton).

T+~3.1s   First dataModelUpdate. Store applies; readiness recomputes.
          Components whose bindings are now all populated flip
          ready: false → true.
          
          a2uiSlot directive sees the flip per-instance → unmounts the
          fallback, mounts the real component with resolved props.
          
          Visible: skeletons swap to real components in place, one or
          several at a time as data envelopes arrive.

T+~3.2s   More dataModelUpdates. Components already real receive new
          prop values reactively (Angular input updates) — no remount.

T+~5s     beginRendering arrives. Recorded by the store (informational).
          No visual change (rendering already in progress).

T+~6s    Streaming completes. status → 'idle'. typing indicator hides.
         M1 is the sole assistant bubble; surface is rendered.
```

**Invariants:**

1. **One bubble per GenUI turn.** Tool message hidden, no M2.
2. **Surface mounts on first envelope.** The empty-bubble gap is ~3s of typing-indicator-only.
3. **No skeleton flicker.** Per-component swap is monotonic; re-renders flow as reactive prop updates.
4. **Raw JSON never visible.** The classifier patience window bridges the gap between content streaming start and the prefix arriving.
5. **Tool calls preserved.** `tool_calls` survives the in-place replacement; time-travel, regenerate, fork, citations all still work.

**Failure modes:**

- **GenUI tool errors before emit fires.** No replacement happens; M1 stays in tool-call-only state. `chat-error` renders below. Bubble stays empty above.
- **Envelopes parse but no surface materializes.** `surface.components.size === 0` → empty-surface fallback stays visible.
- **Component references a binding that never arrives.** Component stays in fallback for that turn. Acceptable — the LLM produced an incomplete spec.

## Responsive behaviour

No new responsive concerns. The `<a2ui-surface>` and its components handle their own layout; the surface fallback inherits the parent bubble width.

## Testing

### Backend (`examples/chat/python/tests/test_graph_smoke.py`)

- `test_emit_replaces_tool_call_ai_in_place`:
  - Seed thread with a user message.
  - Run a single `generate_a2ui_schema` turn.
  - Assert post-emit thread has exactly 3 messages: `human`, `ai` (with both `tool_calls` AND `---a2ui_JSON---` content), `tool` (with `rendered`).
  - Assert the AI message's `id` is unchanged across the emit.

### Surface store (`libs/chat/src/lib/a2ui/surface-store.spec.ts`)

- `extracts bindings from a component on surfaceUpdate apply`.
- `component.ready is false when bindings are unpopulated`.
- `component.ready becomes true when all bindings are populated by dataModelUpdate`.
- `component.ready stays true after a later dataModelUpdate clears a binding` (monotonic rule).
- `multiple components have independent readiness`.

### `<a2ui-surface>` rendering (`libs/chat/src/lib/a2ui/surface.component.spec.ts`)

- `renders the default fallback when surface.components.size === 0`.
- `renders the views[type].fallback when a component is not ready`.
- `renders views[type].component when a component is ready`.
- `swap is monotonic: once real mounts, a later ready=false does not remount fallback`.
- `bare view entry (legacy shape) still works with default fallback`.

### Chat composition (`chat.component.spec.ts`)

- Remove existing bubble-level `<chat-genui-skeleton>` template tests (branch is gone).
- Add: `does not render <chat-genui-skeleton> in the AI template`.

### Live smoke (Chrome MCP, http://localhost:4200/embed)

- Settings-card prompt:
  1. Typing indicator only during sub-LLM phase (M1 empty bubble).
  2. Surface mounts on first envelope; per-component skeletons visible in the structure of the eventual UI.
  3. Components swap from skeleton to real as dataModelUpdates flow.
  4. No raw JSON visible at any point.
  5. Final DOM: **one** assistant `<chat-message>` per GenUI turn (not two).
- Non-GenUI prompt: normal markdown streaming, no skeleton flash.
- Regenerate / fork via timeline slider on a GenUI turn: surface re-renders in the same single bubble.

## Risks

- **Backend in-place replacement and time-travel.** LangGraph checkpointer snapshots message state at each node. The checkpoint between sub-LLM completion and emit holds M1 without the wrapped content; the post-emit checkpoint holds M1 with it. Replaying from the pre-emit checkpoint reproduces the same flow. Behavior is correct; tests cover.

- **Per-component fallback flash for short bindings.** If a component has one binding and the first `dataModelUpdate` resolves it immediately after `surfaceUpdate`, the fallback may render for one or two animation frames before the swap. Mitigation: the surface store could batch envelope application within a microtask so a `surfaceUpdate + dataModelUpdate` pair lands together. Deferred as polish — only matters if observable.

- **`a2uiSlot` directive complexity.** Recursive tree mounting via `NgComponentOutlet` with input pushing is fiddly. Mitigation: comprehensive unit tests. The directive is internal to `<a2ui-surface>`, not exported, so we can iterate freely.

- **Default fallback registration conflict.** If a consumer's catalog declares a `default` key, our `<a2ui-default-fallback>` must not clash. Mitigation: the default fallback is an internal component, never registered as a catalog entry — it's the fallback when `views[type].fallback` is undefined.

- **Legacy `views = { button: BareComponent }` callers.** Backward-compat normalization at the surface lookup level. Spec test covers.

## Phasing

Three independent PRs, recommended order A → B → C:

1. **PR A — Surface store + catalog shape (lib only).** Adds `A2uiViewEntry` discriminated type, extends `A2uiSurfaceStore` with per-component `bindings` + `ready`. No visible rendering change. Unit-tested. ~80 LOC.

2. **PR B — `<a2ui-surface>` per-component rendering.** Adds `a2uiSlot` directive, default fallback primitive, recursive tree mount, removes the chat composition's `<chat-genui-skeleton>` branch. Visible change: surface uses per-component fallbacks. Existing consumers with bare-type views get default fallbacks. ~120 LOC.

3. **PR C — Backend coalescing.** Single-file change to `examples/chat/python/src/graph.py`. Python smoke test asserts the message-count invariant. Live smoke verifies one-bubble-per-turn. ~50 LOC.

Each PR independently mergeable. A and B don't shift demo behavior visibly until both land; C flips the visible "two bubbles" to "one bubble" only after the rendering pipeline is ready.

Total: ~250 LOC net.

## Out of scope

- Pre-`surfaceUpdate` skeleton tree from the LLM's schema hints (no protocol support).
- Animation polish (crossfade fallback → real). Future visual polish.
- Per-binding readiness (currently the unit is per-component). Could be added if components want to render partial-prop states.
- json-render mode equivalent (this design is A2UI-specific; json-render uses `<chat-generative-ui>` with its own progressive rendering via `partial-json`).
- Removing the legacy `<chat-genui-skeleton>` primitive from the public API. Stays exported for direct-template consumers.
