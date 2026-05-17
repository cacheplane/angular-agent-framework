# Sidenav button treatment — Design

**Status:** Approved
**Date:** 2026-05-17
**Goal:** Pull the sidenav's two buttons — "New chat" (primary CTA) and "New project" (secondary action) — into the chat-input button system so the sidenav reads as part of the same product surface as the chat.

## Why now

Final sub-project (C) of the demo UX polish pass. Sub-project A (sidenav layout) shipped in PR #399 and B (chat-surface polish) shipped in PR #409. With those two in place, the remaining mismatch is visual: the sidenav uses a brand-primary purple CTA and a thin-bordered secondary pill, while the chat-input area is a monochrome high-contrast system anchored on `--ngaf-chat-text` and `--ngaf-chat-surface-alt`. The two surfaces sit next to each other and shouldn't look like different products.

## Decisions locked during brainstorming

| Button | Current | Target |
|---|---|---|
| New chat (`.chat-sidenav__action--new`) | `--ngaf-chat-primary` fill, `--ngaf-chat-on-primary` text, padding `10px 16px` | `--ngaf-chat-text` fill, `--ngaf-chat-bg` text, padding `12px 18px` |
| New project (`.chat-project-list__new`) | `--ngaf-chat-surface` fill, 1px `--ngaf-chat-separator` border, `--ngaf-chat-text-muted` text, padding `8px 14px` | `--ngaf-chat-surface-alt` fill, **no border**, `--ngaf-chat-text` text, padding `10px 16px` |
| Anchor button | Chat-input send (`.chat-input__send`): solid `--ngaf-chat-text` fill on `--ngaf-chat-bg`, monochrome, no brand color | unchanged — this is the reference |

The shared design rule: **buttons in chrome around the chat are monochrome, scaled by importance (text-color fill for the biggest CTA, surface-alt fill for secondary, transparent for tertiary).** No brand-primary color in button fills inside this surface.

## Architecture

### New chat — `.chat-sidenav__action--new`

In `libs/chat/src/lib/styles/chat-sidenav.styles.ts`, both the early `.chat-sidenav__action--new` block and the later-cascade `.chat-sidenav__action.chat-sidenav__action--new` block carry the primary-color fill today. Both must change. The later block is the effective one (defined after the generic `.chat-sidenav__action` rule with equal specificity, so it wins the cascade) — that's where the new fill lives. The earlier block stays only to anchor the `:host([data-mode="collapsed"]) .chat-sidenav__action--new` override (which uses higher specificity and continues to work).

Specifically:
- `background: var(--ngaf-chat-text)` — same fill as the input send button
- `color: var(--ngaf-chat-bg)` — inverse for contrast
- `padding: 12px 18px` — bumped from `10px 16px` for a bit more presence
- `font-weight: 600` — unchanged
- `border-radius: 9999px` — pill, unchanged
- Hover: `filter: brightness(0.92)` (subtle darken on light fill instead of brighten) — replacing the current `brightness(1.1)` which was tuned for the brand color
- Focus: `outline: 2px solid var(--ngaf-chat-primary); outline-offset: 2px` — unchanged (the primary color stays for focus rings; this is an a11y affordance, not chrome)
- Collapsed mode (32×32 square at 10px radius): inherits the new fill via cascade. No change needed beyond removing the duplicate `background: var(--ngaf-chat-primary)` line in the earlier block.

### New project — `.chat-project-list__new`

In `libs/chat/src/lib/styles/chat-project-list.styles.ts`:
- `background: var(--ngaf-chat-surface-alt)` — solid fill, no longer outlined
- `color: var(--ngaf-chat-text)` — full strength (was muted)
- `border: 0` — removed
- `padding: 10px 16px` — bumped from `8px 14px`
- `font-size: 12px` — unchanged
- `border-radius: 9999px` — pill, unchanged
- Hover: `background: color-mix(in srgb, var(--ngaf-chat-text) 8%, var(--ngaf-chat-surface-alt))` — small lift on top of surface-alt (the existing rule's "surface-alt as hover from surface" no longer makes sense once the default is surface-alt)

## Files touched

### Library
- `libs/chat/src/lib/styles/chat-sidenav.styles.ts` — update both `.chat-sidenav__action--new` rules (the early block: remove redundant `background`/`color`; the late-cascade block: new fill, color, padding, hover)
- `libs/chat/src/lib/styles/chat-project-list.styles.ts` — `.chat-project-list__new`: new fill, color, border:0, padding, hover

### Tests
- `libs/chat/src/lib/styles/chat-sidenav.styles.spec.ts` — NEW: CSS-string assertions on the late-cascade `.chat-sidenav__action.chat-sidenav__action--new` rule (background, color, padding)
- `libs/chat/src/lib/styles/chat-project-list.styles.spec.ts` — NEW: CSS-string assertions on `.chat-project-list__new` (background, border:0, padding)

### Out of scope
- Touching `.chat-input__send` (it's the anchor — leave it alone)
- Focus ring color (still `--ngaf-chat-primary` — a11y, not chrome)
- Collapsed-mode New chat geometry (still 32×32 square at 10px radius, just with the new fill)
- The generic `.chat-sidenav__action` baseline (Search, etc. — they stay as transparent hover-only items, which already matches the "tertiary" tier of the monochrome system)
- Other buttons in the sidenav header/footer slots (consumer-controlled)

## Visual treatment

### chat-sidenav.styles.ts (relevant rules after the change)

```css
.chat-sidenav__action--new {
  /* Geometry only — the early block exists to anchor the collapsed-mode
     :host overrides below. Fill + text color are set by the late-cascade
     .chat-sidenav__action.chat-sidenav__action--new block. */
  border: 0;
  padding: 12px 18px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  width: 100%;
}
.chat-sidenav__action--new:focus-visible {
  outline: 2px solid var(--ngaf-chat-primary);
  outline-offset: 2px;
}
:host([data-mode="collapsed"]) .chat-sidenav__action--new {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 10px;
  justify-content: center;
}

/* Late-cascade — wins over the generic .chat-sidenav__action below. */
.chat-sidenav__action.chat-sidenav__action--new {
  background: var(--ngaf-chat-text);
  color: var(--ngaf-chat-bg);
  border-radius: 9999px;
  padding: 12px 18px;
  font-weight: 600;
  font-size: 13px;
}
.chat-sidenav__action.chat-sidenav__action--new:hover {
  background: var(--ngaf-chat-text);
  filter: brightness(0.92);
}
```

### chat-project-list.styles.ts (relevant rule after the change)

```css
.chat-project-list__new {
  background: var(--ngaf-chat-surface-alt);
  color: var(--ngaf-chat-text);
  border: 0;
  padding: 10px 16px;
  border-radius: 9999px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  width: 100%;
}
.chat-project-list__new:hover {
  background: color-mix(in srgb, var(--ngaf-chat-text) 8%, var(--ngaf-chat-surface-alt));
  color: var(--ngaf-chat-text);
}
```

## Testing

### Unit
- `chat-sidenav.styles.spec.ts` — assert the late-cascade rule contains `background: var(--ngaf-chat-text)`, `color: var(--ngaf-chat-bg)`, and `padding: 12px 18px`. Use whitespace-normalized regex matching, same pattern as `chat-message-actions.styles.spec.ts` from sub-project B.
- `chat-project-list.styles.spec.ts` — assert `.chat-project-list__new` contains `background: var(--ngaf-chat-surface-alt)`, `border: 0`, and `padding: 10px 16px`.

### Manual smoke
- Local demo: `/embed` → expanded sidenav shows the new monochrome treatment; New chat reads as the main CTA, New project as a secondary fill, both clearly part of the same system as the chat input below.
- Collapsed-mode New chat is still a 32×32 icon-only square with the new fill.
- Focus ring on both buttons still visible (primary-color outline).
- Dark theme + light theme both look right (both fills resolve via CSS variables).

## References

- Sub-project A: `docs/superpowers/specs/2026-05-17-sidenav-polish-design.md`
- Sub-project B: `docs/superpowers/specs/2026-05-17-chat-surface-polish-design.md`
- Anchor button styles: `libs/chat/src/lib/styles/chat-input.styles.ts` (`.chat-input__send`)
- Visual mockup: `.superpowers/brainstorm/57568-1779038013/content/buttons.html`
