# Chat sidenav polish — Design

**Status:** Approved
**Date:** 2026-05-17
**Goal:** Rework `chat-sidenav` so the minimized state is functionally useful, the New chat / New project visual hierarchy is clear, and the footer is customizable via slots.

## Why now

User reviewed the production demo (`demo.cacheplane.ai/embed`) and flagged that:
- The minimized sidenav is "not usable" — three icons (`+`, `>`, magnifying glass) with no way to start a new chat or see threads
- The "+ New project" button styling doesn't feel aligned with the chat-input pill family
- The "New chat" affordance — which should be the biggest CTA in the entire product — is missing or invisible at the top level
- The sidenav lacks a footer for consumer-customizable controls (e.g. theme switcher)

Sub-project A of a two-part polish pass. Sub-project B (chat-surface polish — dropdown width, scroll fade, message-actions padding) ships as a separate follow-up.

## Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Minimized state direction | **Icon rail** — every action gets a permanent icon button; tooltip on hover |
| Threads in minimized rail | **Actions only** (no thread avatars / dots / popovers). Threads visible only when expanded. |
| New chat button style | **Primary CTA pill** — filled accent (`var(--ngaf-chat-primary)`), rounded 9999px radius, biggest button in the sidenav |
| New project button style | **Muted secondary pill** — dark fill, 1px border, same radius family. Tonally below New chat. |
| Footer | **Two slots** — `[sidenavFooterLeft]` + `[sidenavFooterRight]`, separated by top divider. Both empty by default. |
| Expand/collapse toggle | Moves from top-right into footer's right slot (last child) |
| Theme switcher | Renders inside the right footer slot in the canonical demo (consumer-provided; not part of the lib) |
| Search position | Stays at top, styled like an input field (dark fill + light border) |

## Architecture

`chat-sidenav` already has slot infrastructure: `[sidenavHeader]`, `[sidenavPrimary]`, `[sidenavSections]`, `[sidenavAccount]`, plus a `newChat` output. The polish extends this surface without breaking the existing API.

**New slot selectors (additive, content-projection):**
- `[sidenavFooterLeft]` — leftmost child in the footer row (hidden when minimized)
- `[sidenavFooterRight]` — rightmost child in the footer row (always rendered; consumer-provided controls)

**Existing slot `[sidenavAccount]`** is deprecated in this design: same semantic role (footer-leaning) but the new left/right split is more flexible. Migration: keep `[sidenavAccount]` working but document it as legacy; consumers should migrate to the named slots.

**Built-in New chat / New project buttons:**
The lib provides default rendering for both buttons inside `chat-sidenav`'s template, wired to the existing `newChat` and `newProjectRequested` outputs. Consumers who project something via `[sidenavPrimary]` can override.

**Minimized state collapses footer:**
When `mode === 'collapsed'`, the footer shows only the right-slot contents (theme + expand toggle stacked vertically). The left slot is hidden via CSS (`display: none`).

## Visual treatment

### New chat button (primary CTA)

```css
.chat-sidenav__new-chat {
  background: var(--ngaf-chat-primary);
  color: var(--ngaf-chat-on-primary);
  border: 0;
  padding: 10px 16px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  display: flex; align-items: center; gap: 8px;
  cursor: pointer;
  width: 100%;
}
.chat-sidenav__new-chat:hover { filter: brightness(1.1); }
```

In **minimized** mode, the button collapses to a 32×32 icon-only square (same border-radius family, just smaller). Tooltip reveals "New chat".

### New project button (secondary)

```css
.chat-sidenav__new-project {
  background: var(--ngaf-chat-surface);
  color: var(--ngaf-chat-text-muted);
  border: 1px solid var(--ngaf-chat-separator);
  padding: 8px 14px;
  border-radius: 9999px;
  font-size: 12px;
  display: flex; align-items: center; gap: 8px;
  cursor: pointer;
  width: 100%;
}
.chat-sidenav__new-project:hover {
  background: var(--ngaf-chat-surface-alt);
  color: var(--ngaf-chat-text);
}
```

In **minimized** mode: 32×32 icon-only square with the same surface fill.

### Search

Renders as an input-field affordance (dark fill, light border, magnifying-glass prefix). Already styled this way; the spec preserves and explicitly tokens it.

### Footer

```css
.chat-sidenav__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-top: 1px solid var(--ngaf-chat-separator);
  gap: 8px;
}

:host([data-mode="collapsed"]) .chat-sidenav__footer {
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
}

:host([data-mode="collapsed"]) .chat-sidenav__footer-left {
  display: none;
}
```

**Right-side composition:** the lib renders the expand/collapse toggle as a sibling AFTER the `[sidenavFooterRight]` projection within a shared flex row, so consumer-projected controls appear visually left of the toggle. Both live inside a `.chat-sidenav__footer-right` container.

```html
<div class="chat-sidenav__footer">
  <div class="chat-sidenav__footer-left">
    <ng-content select="[sidenavFooterLeft]" />
  </div>
  <div class="chat-sidenav__footer-right">
    <ng-content select="[sidenavFooterRight]" />
    <button class="chat-sidenav__toggle" (click)="modeChange.emit(...)">→</button>
  </div>
</div>
```

## Files touched

### Library — `libs/chat/`

1. **`libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`** *(modify)*
   - Add `[sidenavFooterLeft]` and `[sidenavFooterRight]` ng-content selectors to the template
   - Render default "+ New chat" + "+ New project" buttons (wired to existing outputs)
   - Move the expand toggle from `[sidenavHeader]` area to inside the footer's right slot (as a lib-rendered last child)
   - Deprecate `[sidenavAccount]` (keep it working; add a JSDoc note)
   - Mark new outputs are NOT needed — reuses existing `newChat` + `newProjectRequested`

2. **`libs/chat/src/lib/styles/chat-sidenav.styles.ts`** *(modify)*
   - Add `.chat-sidenav__new-chat`, `.chat-sidenav__new-project`, `.chat-sidenav__footer`, `.chat-sidenav__footer-left`, `.chat-sidenav__footer-right` classes
   - Add `:host([data-mode="collapsed"])` rules: footer goes column, left slot hides, buttons collapse to 32×32 icon squares
   - Keep existing styles for back-compat where applicable

3. **`libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`** *(modify)*
   - Add tests: New chat button renders + emits `newChat`; New project button renders + emits `newProjectRequested`; footer slots project content; collapsed mode hides left slot; expand toggle present in right slot

### Demo — `examples/chat/angular/`

4. **`examples/chat/angular/src/app/shell/demo-shell.component.ts`** *(modify)*
   - Add a theme-switcher button (a small `<button (click)="onToggleColorScheme()">` styled as a 28×28 icon) projected into `[sidenavFooterRight]`
   - Remove the previous theme-switcher location (currently inside chat-debug palette — keep that too; not removing, just adding the sidenav-footer instance)

### Out of scope (separate sub-project B)
- Dropdown width
- Scroll fade above chat input
- Message-actions-bar padding

## Behavior

| State | What's visible |
|---|---|
| Expanded, no projects | New chat (primary pill) → New project (secondary pill) → Search → RECENT list → footer (left empty, right: theme + expand toggle) |
| Expanded, projects exist | Same, plus PROJECTS section with project list |
| Collapsed | Icon-only New chat (accent fill) → New project (gray) → Search icon → empty space → footer (vertical stack: theme + expand toggle); left slot hidden |
| Drawer (mobile) | Same as expanded but with overlay backdrop; no minimize affordance |

## Testing

### Component spec

`chat-sidenav.component.spec.ts` — 8 new vitest cases:
1. Renders default "+ New chat" button when no `[sidenavPrimary]` projected
2. Renders default "+ New project" button below New chat
3. Click on New chat emits `newChat`
4. Click on New project emits `newProjectRequested`
5. `[sidenavFooterLeft]` content projects into the footer's left position
6. `[sidenavFooterRight]` content projects into the footer's right position
7. `mode="collapsed"` hides left footer slot (`display: none`)
8. Expand toggle is the last child of the right footer slot

### Demo smoke (CHECKLIST.md)

Add three manual checks under a new "Sidenav polish" section:
- Click "+ New chat" → starts a new conversation
- Theme switcher (footer right) → toggles light/dark
- Collapse the sidenav → see icon-only New chat + New project + Search + theme + expand toggle, in that order; verify tooltips appear on hover

### Visual regression

Not formal — but a screenshot in the PR body showing expanded + collapsed states matches the mockup approved during brainstorming.

## Out of scope

- Replacing the existing `[sidenavAccount]` slot (deprecate, don't remove — back-compat)
- Tooltip implementation (use native `title="..."` attribute; richer popover tooltip is a separate feature)
- Drawer mode redesign (only changing expanded + collapsed; drawer keeps current behavior)
- Animations / transitions on the collapse toggle
- Account / user-avatar functionality

## References

- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts` — existing slot infrastructure (`sidenavHeader`, `sidenavPrimary`, `sidenavSections`, `sidenavAccount`) and outputs (`newChat`, `threadSelected`, `searchOpened`, `newProjectRequested`)
- `libs/chat/src/lib/styles/chat-sidenav.styles.ts` — existing sidenav CSS (~200 lines)
- Visual companion mockup: `.superpowers/brainstorm/53365-1778990640/content/sidenav-full-layout.html`
- Sub-project B follow-up: chat-surface polish (dropdown width, scroll fade, message-actions padding) — separate spec + PR
