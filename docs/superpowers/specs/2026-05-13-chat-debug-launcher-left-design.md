# UI Polish — Chat Debug to Bottom-Left + Missing Sidebar Launcher — Design

**Status:** Approved
**Date:** 2026-05-13
**Goal:** Fix two UI bugs found in the live `demo.cacheplane.ai` smoke run: (1) the `chat-debug` toggle pill occludes the popup-mode chat launcher at the bottom-right corner; (2) the sidebar-mode composition is missing its chat launcher button entirely.

## Background

`demo.cacheplane.ai` (Phase 2 of the canonical-demo deployment) shipped successfully and the proxy / streaming / state pipeline works end-to-end. A browser-based smoke run surfaced two bugs not catchable via API smoke:

1. **Popup launcher occluded by debug toggle.** Both `chat-popup`'s launcher (white circle with chat icon, 56×56) and `chat-debug`'s status pill (36×36, green dot) anchor to `position: fixed; bottom: 20px; right: 20px`. The debug pill has `z-index: 990` and renders later in the DOM, so click events at that corner reach the debug pill, not the chat launcher. The popup never opens via its intended button. Verified by DOM inspection at the click point — `elementsFromPoint` returns `[<button aria-label="Open chat debug">, <svg>, <button class="chat-launcher-button" aria-label="Open chat">, ...]`.

2. **Sidebar mode missing launcher.** `chat-popup.component.ts:62` renders `<chat-launcher-button (click)="toggle()" />` in its host template. `chat-sidebar.component.ts` does NOT — no import of `ChatLauncherButtonComponent`, no usage. The empty-state copy in `sidebar-mode.component.ts:16` promises "Click the launcher button (right edge) to slide in the chat panel" but the button is not in the DOM. Confirmed via `document.querySelector('.chat-launcher-button')` returning `null` on `/sidebar`.

## Decisions Locked

| Decision | Choice |
|---|---|
| Where to move chat-debug toggle | Bottom-left (`bottom: 20px; left: 20px`) |
| Sidebar launcher placement | Mirror `chat-popup` exactly — `<chat-launcher-button (click)="toggle()" />` adjacent to the sliding panel |
| Per-consumer position overrides on chat-debug | Out of scope; single hardcoded position for now |
| Verification of unverified UX items (stop mid-stream, regenerate, model picker) | Out of scope; punt to follow-up if real users report issues |
| Sidenav cohabitation | Accept the visual overlap with the sidenav's "ARCHIVED" footer (pill stays clickable; `position: fixed`) |

## Architecture

Three small, independent surfaces — all in `libs/chat`:

### Fix 1 — Move chat-debug toggle to bottom-left

`libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`, lines 50–52:

```css
.launcher {
  position: fixed;
  bottom: 20px;
  right: 20px;     /* ← change to: left: 20px; */
  ...
}
```

Replace `right: 20px;` with `left: 20px;`. One-character spell change in property name. The `.panel--*` dock variants are unaffected — they tile against viewport edges, not the launcher.

### Fix 2 — Add missing launcher to chat-sidebar composition

`libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts`:

1. Add import:
   ```ts
   import { ChatLauncherButtonComponent } from '../../primitives/chat-launcher-button/chat-launcher-button.component';
   ```
2. Add to component `imports` array.
3. Render in template adjacent to the sliding `<aside>` panel:
   ```html
   <chat-launcher-button (click)="toggle()" />
   ```
4. The `toggle()` method already exists (line 82: `toggle(): void { this.open.update((v) => !v); }`).

The launcher inherits the default `position: fixed; bottom: 20px; right: 20px` from `.chat-launcher-button` styles — no additional CSS needed.

### Fix 3 — Verify popup launcher works after Fix 1

No code change. Once the debug pill moves left, the popup's `.chat-launcher-button` becomes clickable. Verified by browser smoke in the post-merge step.

## Components touched

| File | Change | Lines |
|---|---|---|
| `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts` | `right: 20px` → `left: 20px` in `.launcher` rule | 1 |
| `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts` | + import, + `imports` entry, + `<chat-launcher-button>` in template | ~3 |
| `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts` | + one assertion: launcher button present | ~5 |

## Data Flow

No new data flow. The launcher button emits `(click)` → calls `toggle()` → flips the existing `open` model signal → CSS-driven slide-in animation runs. Identical to the existing popup pattern.

## Error Handling

None needed. Both fixes are purely structural / cosmetic. The `toggle()` method already exists. CSS `position: fixed` doesn't fail.

## Testing

### Unit

One new assertion in `chat-sidebar.component.spec.ts`: after rendering, `fixture.nativeElement.querySelector('.chat-launcher-button')` is not `null`. Mirrors what the popup spec asserts (if it does — confirm during implementation; if not, this is a slight precedent expansion).

No unit test for the chat-debug position change. CSS changes that move a fixed-position element by a single property name aren't usefully covered by unit tests; the manual verification covers it.

### Manual

Add to the PR description:

1. **`/embed`** — page loads, chat input visible, no overlap. Debug pill is at bottom-left. (Confirms Fix 1 doesn't break the embed flow.)
2. **`/popup`** — bottom-right shows the white launcher circle. Click it → popup window opens with chat. Bottom-left shows the debug pill (green dot). Click debug → debug panel docks on the right. No overlap. (Confirms Fixes 1 + 3.)
3. **`/sidebar`** — bottom-right shows a launcher circle. Click it → sidebar slides in from the right. Bottom-left shows the debug pill. (Confirms Fix 2 + Fix 1 didn't break sidebar.)
4. **Debug panel dock controls** — open debug, switch dock from "right" to "left" to "bottom" to "right" again. All variants render correctly. (Confirms Fix 1 didn't break the docked-panel layout.)

## Out of scope

- Per-consumer position overrides on `chat-debug` (e.g., `--ngaf-chat-debug-launcher-x` CSS variables). YAGNI; can be a single-line refactor later if a consumer asks.
- Verifying the unverified items from the earlier smoke run (stop mid-stream button flip, regenerate response flow, model picker dropdown). Real user reports drive the next polish pass, not speculative pre-emptive fixes.
- Sidenav layout adjustments. The demo shell's sidenav cohabits with the debug pill; pill stays clickable because of `position: fixed`.
- Repositioning the popup launcher to a non-default corner. Stays where it's been.
- Adding a launcher to `chat-embed` mode (it's an inline composition; no launcher concept).

## References

- `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts:50–52` — current launcher pill position
- `libs/chat/src/lib/compositions/chat-popup/chat-popup.component.ts:62` — reference pattern for `<chat-launcher-button>` usage
- `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts:82` — existing `toggle()` method the new launcher button will call
- `libs/chat/src/lib/styles/chat-launcher-button.styles.ts` — launcher button visual styles (no changes needed)
