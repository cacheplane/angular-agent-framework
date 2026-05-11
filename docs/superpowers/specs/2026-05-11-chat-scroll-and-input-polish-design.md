# Chat scroll and input polish — design

**Date:** 2026-05-11
**Surface:** `@ngaf/chat` (`libs/chat`) — `chat` composition and `chat-input` primitive
**Status:** Design approved; ready for implementation plan

## Summary

Two work streams that polish scroll and input behavior in the chat composition:

- **Stream A — Quick fixes.** Three independent, small fixes: final post-stream scroll, input/output gap token, multiline auto-grow with viewport cap.
- **Stream B — Pin/bubble system.** A pin/unpin state machine driving a centered-bottom bubble that lets the user re-engage with the bottom of the scroll during and after streaming.

Streams are sequenced A → B in implementation; A does not depend on B.

## Current state

`libs/chat/src/lib/compositions/chat/chat.component.ts` owns the scroll container (`.chat-scroll`, `#scrollContainer`) and a single auto-scroll effect. The effect fires on every message-content mutation and uses a 150px "near-bottom" tolerance: if the user is within 150px of the bottom, it sets `scrollTop = scrollHeight`; otherwise it skips.

Gaps in today's behavior:

- The auto-scroll effect stops as soon as content stops mutating, so action buttons (reload, copy) that render *after* streaming completes can land below the fold.
- No explicit pin/unpin model — tolerance is recomputed inline per event.
- No scroll-to-bottom affordance when the user has scrolled up.
- `chat-typing-indicator` always renders inline; nothing surfaces the streaming state when the user is scrolled away.
- `chat-input` does not auto-grow with content.
- No documented gap token between the scroll container and input wrapper.

## Stream A — Quick fixes

### A1. Post-stream final scroll

Add a second effect in `chat.component.ts` that watches agent status. When status transitions out of `streaming`/`thinking` to `idle`, perform one final `scrollTop = scrollHeight`, gated by `pinned()` (defined in Stream B; until then, by the existing 150px inline check).

Rationale: action buttons render on idle, after the last content-mutation tick fires.

### A2. Embed gap token

Introduce CSS custom property `--ngaf-chat-input-gap` with default `0.75rem`. Apply as `margin-top` on the input wrapper (or equivalent — implementation choice) so the gap appears in both embed and standalone modes. Token-based so embedders can override per-host.

### A3. Multiline input auto-grow

In `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts`:

- Apply `field-sizing: content` to the textarea where supported.
- JS fallback: on `input`, set `element.style.height = 'auto'` then `element.style.height = element.scrollHeight + 'px'`.
- Cap: `max-height: min(40vh, 320px)`. Overflow scrolls internally.
- Min height: preserve current single-line height.

## Stream B — Pin/bubble system

### State

Single signal on the chat composition: `pinned = signal<boolean>(true)`. Initialized `true`.

A `(scroll)` listener on `#scrollContainer` recomputes `pinned` from the 150px tolerance on every scroll event, throttled via `requestAnimationFrame`. The existing auto-scroll effect gates on `pinned()` instead of recomputing tolerance inline.

State table (orthogonal axes: pin × stream):

| Pin      | Stream    | Auto-scroll | Bubble shown                           |
| -------- | --------- | ----------- | -------------------------------------- |
| pinned   | streaming | yes         | none                                   |
| pinned   | idle      | n/a         | none                                   |
| unpinned | streaming | no          | streaming bubble (animated 3 dots)     |
| unpinned | idle      | no          | down-arrow button                      |

### Transitions

- User scrolls *up* past 150px threshold → `pinned = false`.
- User scrolls back *within* 150px of bottom (manually) → `pinned = true`.
- User clicks bubble (either variant) → `scrollTop = scrollHeight`, then `pinned = true`.
- User sends a new message → force `pinned = true` + force scroll, regardless of prior state.
- New assistant turn starts while `pinned` → auto-scroll continues (covered by existing effect).
- New assistant turn starts while `unpinned` → bubble swaps from `idle` to `streaming` mode.

### Programmatic vs. user scroll

When the composition auto-scrolls, the `(scroll)` event fires too. To avoid flipping `pinned` to `false` from our own scroll: set `programmaticScroll = true` immediately before assigning `scrollTop`, clear it in the next `requestAnimationFrame` tick. The scroll handler ignores events while the flag is set.

### Bubble primitive

New primitive: `chat-scroll-bubble` at `libs/chat/src/lib/primitives/chat-scroll-bubble/`.

**Inputs / outputs:**

- `mode: 'streaming' | 'idle'` — controls inner content (3-dot animation vs. down-arrow icon).
- `(click)` output — emitted on user click; composition handles scroll + re-pin.

**Placement:** rendered as a sibling of `#scrollContainer` inside the chat shell (not a child of the scroll container). Absolutely positioned above the input wrapper, horizontally centered. Concrete approach: place the bubble inside a flex container that wraps the input wrapper; the bubble is an absolutely-positioned overlay sibling of the input, so its `bottom` anchor tracks the input's actual rendered height (handles embed-mode height changes without measurement).

**Visibility:** the composition decides via template control flow:

```html
@if (!pinned()) {
  <chat-scroll-bubble
    [mode]="agent().status() === 'streaming' || agent().status() === 'thinking' ? 'streaming' : 'idle'"
    (click)="onBubbleClick()"
  />
}
```

No internal visibility logic in the primitive.

**Typing-indicator interplay:** when `pinned()` is `false`, suppress the inline `chat-typing-indicator` — the bubble carries the streaming signal instead. When `pinned()` is `true`, the inline indicator behaves as today.

**Styling:** small rounded pill (~36px tall), surface background, subtle shadow, matching the shadcn-style tokens already in use in the composition. Three-dot animation copies the markup/CSS from `chat-typing-indicator` (the indicator is ~10 lines of CSS; sharing via a CSS module is not worth the indirection at this scale).

## Edge cases

1. **Programmatic scroll vs. user scroll** — handled via `programmaticScroll` flag described above.
2. **Content shrinks mid-stream** (edited / removed message) — `scrollHeight` decreases; position may land within tolerance, re-pinning the user. Acceptable; matches intent.
3. **First mount with prefilled history** — `pinned` defaults to `true`. A one-shot effect gated by `prevMessageCount === 0` forces `scrollTop = scrollHeight` on first render after messages settle.
4. **Embed mode height changes** — bubble position is anchored to the input wrapper via the flex/overlay approach, so input height changes don't require recomputation.
5. **Touch / momentum scroll on iOS** — rAF throttling handles this; no special-casing.

## Testing

- **Unit:** extract a small `usePinnedScroll(scrollEl, threshold = 150)` helper (signal-returning) or test the composition's pin signal directly via synthetic `scroll` events at the boundary (149px above → still pinned; 151px above → unpinned).
- **Component:** `chat-scroll-bubble` emits `click`; renders correct content per `mode`.
- **Manual via Chrome MCP:**
  - Streaming + user scrolls up → bubble appears in streaming mode.
  - Click bubble → re-pins, scrolls to bottom, bubble disappears.
  - Idle + scrolled up → bubble appears in idle (down-arrow) mode.
  - Send new message from scrolled-up state → force-pin + scroll.
  - Multiline expand: type lines; height grows to viewport cap, then scrolls internally.
  - Embed mode: visible gap between output and input.
  - Stream completes near bottom → action buttons fully visible.

No new e2e suite — interaction behavior best validated with the visual workflow above.

## Files touched

- `libs/chat/src/lib/compositions/chat/chat.component.ts` — pin signal, scroll handler, programmatic-scroll flag, post-stream final-scroll effect, bubble integration, typing-indicator gating.
- `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts` — auto-grow + viewport cap.
- `libs/chat/src/lib/primitives/chat-scroll-bubble/` — new primitive (component + style).
- `libs/chat/src/lib/primitives/index.ts` (or equivalent barrel) — export new primitive.
- CSS custom property `--ngaf-chat-input-gap` — declared near existing chat tokens.

## Out of scope

- Reworking the existing typing indicator beyond the visibility gate.
- Smooth-scroll animations (current instant `scrollTop = scrollHeight` stays; documented in code).
- Accessibility audit beyond ensuring the bubble is a `<button>` with an accessible label per mode (`"Scroll to latest"` / `"Latest activity"`).
- Persisting pin state across thread switches (each thread enters with `pinned = true`).
