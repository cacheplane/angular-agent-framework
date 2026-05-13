# Grip-Replaces-Pin on Hover — Design

**Status:** Approved
**Date:** 2026-05-12
**Scope:** `libs/chat` thread-list row layout
**Predecessor:** PR #280 (drag-to-reorder pinned threads)

## Goal

Eliminate the 18px left-side gutter that pinned thread rows currently reserve for the always-present (but usually invisible) drag-handle button. Swap the drag affordance into the same slot as the pin icon so there is zero layout shift between unpinned, pinned-resting, and pinned-hover states.

## Background

PR #280 introduced a grip-handle button as a sibling of the row's main click button. The grip is `width: 16px; margin-right: 2px; opacity: 0` by default, fading in on `:hover` / `:focus-within`. Because the element takes inline space regardless of opacity, every pinned row sits 18px to the right of every unpinned row, which the user dislikes.

Pinned rows also display a 13×13px pin SVG inline with the title text inside `.chat-thread-list__item-title`. That existing slot — already reserved by the layout when a row is pinned — is the natural place to host the drag affordance.

## Approach

Single slot, opacity-swap. Both icons occupy a fixed-size positioned container; CSS toggles which one is visible based on hover state.

- **Default (pinned row):** pin SVG at full opacity, grip glyph at zero opacity.
- **Hover/focus-within of pinned row that has `actions.reorderPinned`:** pin SVG fades to zero opacity, grip glyph fades to full opacity. Cursor on the wrap becomes `grab`.
- **Active (mid-drag):** cursor becomes `grabbing`.

Zero layout shift in any state. Unpinned rows are unaffected and unchanged.

## Architecture

One template restructure + one styles diff:

- **`libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`** — remove the standalone `.chat-thread-list__grip` button (currently a sibling of `.chat-thread-list__item`). Wrap the existing inline pin SVG in a new `.chat-thread-list__pin-slot` span. When the thread is pinned AND `actions.reorderPinned` is defined, render a grip glyph as a sibling inside the same slot. The `<li>` keeps its `draggable` attribute and all five drag handlers untouched — the entire row remains the drag source.

- **`libs/chat/src/lib/styles/chat-thread-list.styles.ts`** — delete the existing `.chat-thread-list__grip` rule and its hover-reveal selectors. Add new rules for `.chat-thread-list__pin-slot` (position relative, fixed 13×13 dimensions) and the new in-slot `.chat-thread-list__grip` (position absolute, opacity 0). Add hover/focus-within rules to swap opacities, and a wrap-level `cursor: grab` rule when the row is pinned and drag-reorderable.

## Data Flow

None. Pure CSS opacity transitions. No new component state, no new inputs, no new outputs.

## Template

Before (the relevant fragment inside the `@for` loop):

```html
@if (thread.pinned && actions()?.reorderPinned) {
  <button
    type="button"
    class="chat-thread-list__grip"
    aria-label="Drag to reorder"
    draggable="false"
  >⋮⋮</button>
}
<button class="chat-thread-list__item" ...>
  <span class="chat-thread-list__initial">...</span>
  <span class="chat-thread-list__item-title">
    @if (thread.pinned) {
      <svg class="chat-thread-list__item-pin" viewBox="0 0 24 24" ...>...</svg>
    }
    {{ threadLabel(thread) }}
  </span>
  ...
</button>
```

After:

```html
<button class="chat-thread-list__item" ...>
  <span class="chat-thread-list__initial">...</span>
  <span class="chat-thread-list__item-title">
    @if (thread.pinned) {
      <span class="chat-thread-list__pin-slot" aria-hidden="true">
        <svg class="chat-thread-list__item-pin" viewBox="0 0 24 24" ...>...</svg>
        @if (actions()?.reorderPinned) {
          <span class="chat-thread-list__grip">⋮⋮</span>
        }
      </span>
    }
    {{ threadLabel(thread) }}
  </span>
  ...
</button>
```

The `<li>` wrapper, its `[attr.draggable]`, and the five drag handlers (`dragstart`, `dragover`, `dragleave`, `drop`, `dragend`) are unchanged. The grip is now a `<span>` (not a `<button>`), purely decorative, marked `aria-hidden` via its parent slot.

## Styles

Remove these existing rules:

```css
.chat-thread-list__grip {
  flex-shrink: 0;
  width: 16px;
  height: 28px;
  margin-right: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ngaf-chat-text-muted);
  cursor: grab;
  opacity: 0;
  transition: opacity 100ms ease;
  font-size: 11px;
  line-height: 1;
  letter-spacing: -1px;
  user-select: none;
}
.chat-thread-list__item-wrap:hover .chat-thread-list__grip,
.chat-thread-list__item-wrap:focus-within .chat-thread-list__grip {
  opacity: 1;
}
.chat-thread-list__grip:active { cursor: grabbing; }
```

Replace with:

```css
.chat-thread-list__pin-slot {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  margin-right: 4px;
  flex-shrink: 0;
  vertical-align: -1px;
}
.chat-thread-list__pin-slot .chat-thread-list__item-pin {
  position: absolute;
  inset: 0;
  width: 13px;
  height: 13px;
  opacity: 1;
  transition: opacity 100ms ease;
}
.chat-thread-list__pin-slot .chat-thread-list__grip {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ngaf-chat-text-muted);
  font-size: 11px;
  line-height: 1;
  letter-spacing: -1px;
  opacity: 0;
  transition: opacity 100ms ease;
  user-select: none;
  pointer-events: none;
}
.chat-thread-list__item-wrap:hover .chat-thread-list__pin-slot .chat-thread-list__item-pin,
.chat-thread-list__item-wrap:focus-within .chat-thread-list__pin-slot .chat-thread-list__item-pin {
  opacity: 0;
}
.chat-thread-list__item-wrap:hover .chat-thread-list__pin-slot .chat-thread-list__grip,
.chat-thread-list__item-wrap:focus-within .chat-thread-list__pin-slot .chat-thread-list__grip {
  opacity: 1;
}
.chat-thread-list__item-wrap[draggable="true"] { cursor: grab; }
.chat-thread-list__item-wrap[draggable="true"]:active { cursor: grabbing; }
```

The wrap-level cursor change keys off the `draggable` attribute (which is `null` unless the row is pinned + has `reorderPinned`), so unpinned rows keep `cursor: pointer` from the item button.

Note `pointer-events: none` on the grip glyph: prevents the decorative span from interfering with the underlying click target (the item button).

## Error Handling

None. Adding/removing the `reorderPinned` adapter method live, or pinning/unpinning a thread, simply changes whether the slot appears or whether the grip is rendered inside it. Angular's `@if` handles both.

## Testing

### Update three existing tests (`chat-thread-list.component.spec.ts`)

1. **`grip renders for pinned thread when reorderPinned adapter is defined`** — change the selector from `.chat-thread-list__grip` (as a sibling) to `.chat-thread-list__pin-slot .chat-thread-list__grip`. Assert it's present.
2. **`grip does not render when reorderPinned is undefined`** — same selector update. Assert the pin slot exists (`.chat-thread-list__pin-slot`) but the grip child does not.
3. **`grip does not render for unpinned threads`** — selector update. Assert the pin slot itself is absent for unpinned rows.

### Keep unchanged

- The two drag-and-drop tests (`drop "before" target` and `drop "after" last pinned`) — they exercise the `<li>` drag handlers, which are untouched.
- The three menu-item tests (Move up / Move down) — untouched.
- The reorder-rejection rollback test — untouched.

### Manual verification

Documented in the PR description:

1. Open the chat example at `localhost:4200`.
2. Pin one thread.
3. Confirm: pinned row's left margin matches unpinned rows' (no gutter shift). Pin SVG visible in the title.
4. Hover the pinned row. Confirm: pin SVG fades out, grip glyph (`⋮⋮`) fades in over the same slot. Cursor → `grab`.
5. Pin a second thread, drag-reorder. Confirm: drag indicator works as before; drop succeeds.
6. macOS Reduce Motion → on. Confirm: hover swap is instant (the universal `transition-duration: 0.01ms` applies).

## Scope Boundaries

**In scope:**
- The two files listed
- The three test updates above
- The spec + plan + PR

**Out of scope:**
- Touch drag (still rejected — Move up / Move down menu items remain the keyboard/touch path)
- Showing the grip on unpinned rows (no behavior change for unpinned)
- Visual redesign of the pin icon itself
- Changing the kebab Move-up / Move-down items

## References

- PR #280 — original drag-to-reorder implementation that introduced the gutter
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts` lines ~92–150 (template) and ~234–242 (state)
- `libs/chat/src/lib/styles/chat-thread-list.styles.ts` lines ~126–155 (current grip rules)
