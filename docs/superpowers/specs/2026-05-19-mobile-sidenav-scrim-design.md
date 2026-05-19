# Mobile sidenav scrim + responsive polish — Design

**Status:** Approved
**Date:** 2026-05-19
**Goal:** Fix the chat-sidenav drawer's broken mobile interaction (scrim renders over content, can't scroll/tap), elevate the drawer with a right-edge shadow, move the demo's hamburger out of the toolbar's overlap, and document the chat lib's z-index layers as CSS-variable tokens.

## Why now

On a 375px viewport, `demo.threadplane.ai` shows the drawer mode is unusable: clicking inside the open drawer hits a `.chat-sidenav__scrim` button rather than the drawer contents, scrolling is blocked, and the floating hamburger button sits on top of the demo's top toolbar. These are stacking-context bugs and missing affordances — high-impact polish for the first impression a mobile visitor gets.

## Root cause

`chat-sidenav` renders its scrim **inside** its own host element:

```html
@if (mode() === 'drawer' && open()) {
  <button class="chat-sidenav__scrim" .../>
}
<nav class="chat-sidenav">...</nav>
```

The host has `position: fixed; z-index: 1001` — this creates a stacking context. Inside:
- Scrim: `position: fixed; inset: 0; z-index: 1000` (creates sub-stacking context)
- Nav: `position: static` (paints BEFORE positive-z positioned siblings in the same stacking context)

Net: scrim paints **over** nav within the host. `elementFromPoint` at the drawer center returns the scrim button, not the drawer content — every click closes the drawer.

## Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Structural vs cheap fix | **Structural** — scrim lives outside the chat-sidenav host |
| How to externalize the scrim | **New `chat-sidenav-scrim` primitive in the lib**, rendered by consumers as a sibling of `chat-sidenav` |
| CDK overlay or manual portal | Neither — the scrim is just a sibling element. No `@angular/cdk` dependency added. |
| Drawer shadow placement | On `:host([data-mode="drawer"][data-open="true"])`, dropped when closed |
| Hamburger placement | **Move INTO** the demo-shell toolbar as the first flex child when in drawer mode (no more fixed positioning) |
| Z-index hardcodes | **Promote to CSS variables** in `chat-tokens.ts`. Three layers documented and used. |

## Architecture

### Lib (`@ngaf/chat`)

#### A. New primitive: `chat-sidenav-scrim`

Single-purpose backdrop component, ~40 lines. Lives at `libs/chat/src/lib/primitives/chat-sidenav-scrim/`.

```ts
@Component({
  selector: 'chat-sidenav-scrim',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <button
        type="button"
        class="chat-sidenav-scrim__button"
        aria-label="Close conversations"
        (click)="close.emit()"
      ></button>
    }
  `,
  styles: [
    `
      :host { display: contents; }
      .chat-sidenav-scrim__button {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: var(--ngaf-chat-z-drawer-scrim, 1000);
        border: 0;
        padding: 0;
        cursor: pointer;
      }
    `,
  ],
})
export class ChatSidenavScrimComponent {
  readonly open = input<boolean>(false);
  readonly close = output<void>();
}
```

`:host { display: contents; }` so the component host doesn't create a stacking context — the fixed-positioned button is the only painted element and competes at the document root.

Exported from `libs/chat/src/public-api.ts`.

#### B. `chat-sidenav` stops rendering its scrim

Template change in `chat-sidenav.component.ts`: delete the `@if (mode() === 'drawer' && open()) { <button class="chat-sidenav__scrim" .../> }` block.

CSS change in `chat-sidenav.styles.ts`: delete the `.chat-sidenav__scrim` rule.

The drawer host's `z-index: 1001` stays (now references the new CSS var). Drawer is still position: fixed at left:0 top:0 bottom:0 width: drawer-width.

#### C. Drawer right-edge shadow

In `chat-sidenav.styles.ts`, add to the existing drawer rule:

```css
:host([data-mode="drawer"][data-open="true"]) {
  box-shadow: 8px 0 32px rgba(0, 0, 0, 0.18);
}
```

Only applied when open — keeps the shadow off the offscreen state.

#### D. Z-index layer tokens

Add to `libs/chat/src/lib/styles/chat-tokens.ts` (the `CHAT_HOST_TOKENS` constant):

```css
--ngaf-chat-z-overlay-content: 30;   /* chat-sidebar panel, chat-popup window */
--ngaf-chat-z-drawer-scrim: 1000;    /* chat-sidenav-scrim primitive */
--ngaf-chat-z-drawer: 1001;          /* chat-sidenav drawer mode */
```

Replace the hardcoded `z-index: 30` in chat-sidebar.component.ts and chat-popup.component.ts with `z-index: var(--ngaf-chat-z-overlay-content, 30)`.

Replace `z-index: 1001` in chat-sidenav.styles.ts with `z-index: var(--ngaf-chat-z-drawer, 1001)`.

The new scrim primitive uses `z-index: var(--ngaf-chat-z-drawer-scrim, 1000)`.

### Demo (`examples/chat/angular`)

#### E. Hamburger moves into the toolbar

Currently in `demo-shell.component.html`:

```html
@if (sidenavMode() === 'drawer' && !drawerOpen()) {
  <button type="button" class="demo-shell__hamburger" ...>☰</button>
}
<div class="demo-shell__toolbar" ...>
  <div class="demo-shell__segmented" aria-label="Mode">...</div>
  ...
</div>
```

New:

```html
<div class="demo-shell__toolbar" ...>
  @if (sidenavMode() === 'drawer' && !drawerOpen()) {
    <button
      type="button"
      class="demo-shell__hamburger"
      aria-label="Open conversations"
      [attr.aria-expanded]="drawerOpen()"
      (click)="toggleSidenav()"
    >☰</button>
  }
  <div class="demo-shell__segmented" aria-label="Mode">...</div>
  ...
</div>
```

CSS for `.demo-shell__hamburger` in `demo-shell.component.css`:

```css
.demo-shell__hamburger {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border: 0;
  background: transparent;
  color: var(--ngaf-chat-text);
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.demo-shell__hamburger:hover {
  background: var(--ngaf-chat-surface-alt);
}
```

(Drop the old `position: fixed; top: 12; left: 12; z-index: 1100; box-shadow` etc. — it's now a normal flex child.)

#### F. Scrim wiring in demo-shell

`demo-shell.component.ts` imports `ChatSidenavScrimComponent` and adds to `imports: [...]`.

`demo-shell.component.html` adds the scrim as a sibling of chat-sidenav, just before it:

```html
<chat-sidenav-scrim
  [open]="sidenavMode() === 'drawer' && drawerOpen()"
  (close)="drawerOpen.set(false)"
/>
<chat-sidenav ...>...</chat-sidenav>
```

The scrim is now a top-level sibling of `<chat-sidenav>` in the demo-shell template — outside the chat-sidenav host's stacking context — so its z-index 1000 sits cleanly between content (z auto / z 50) and drawer (z 1001).

## Files touched

### Lib (`libs/chat/`)
- **Create**: `src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.ts`
- **Create**: `src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.spec.ts`
- **Modify**: `src/public-api.ts` — add export
- **Modify**: `src/lib/compositions/chat-sidenav/chat-sidenav.component.ts` — drop the scrim template block
- **Modify**: `src/lib/styles/chat-sidenav.styles.ts` — drop `.chat-sidenav__scrim` rule, add drawer box-shadow, use z-index token
- **Modify**: `src/lib/styles/chat-tokens.ts` — add three z-index CSS variables
- **Modify**: `src/lib/compositions/chat-sidebar/chat-sidebar.component.ts` — use `var(--ngaf-chat-z-overlay-content, 30)` for panel z
- **Modify**: `src/lib/compositions/chat-popup/chat-popup.component.ts` — same

### Demo (`examples/chat/angular/`)
- **Modify**: `src/app/shell/demo-shell.component.ts` — import `ChatSidenavScrimComponent`
- **Modify**: `src/app/shell/demo-shell.component.html` — render `<chat-sidenav-scrim>` sibling; move hamburger into toolbar
- **Modify**: `src/app/shell/demo-shell.component.css` — drop fixed-position hamburger styles, add flex-child styles

### Release
- **Modify**: all 7 publishable libs `package.json` — 0.0.43 → 0.0.44

## Testing

### Unit
- `chat-sidenav-scrim.component.spec.ts` (new):
  - Renders only when `[open]="true"`
  - Click on the scrim emits `(close)`
  - Has accessible name "Close conversations"
- `chat-sidenav.component.spec.ts`: remove any test asserting the old `.chat-sidenav__scrim` element inside chat-sidenav. Replace with an assertion that `.chat-sidenav__scrim` is NOT present (responsibility moved out).
- `chat-sidenav.styles.spec.ts`: assert the new box-shadow rule + the z-index uses the CSS var (`var(--ngaf-chat-z-drawer, 1001)`).
- `chat-tokens` spec (if exists): assert the three new variables are declared.

### Manual smoke (chrome-mcp)
- Resize to 375×812. Reload demo.
- Hamburger renders as the FIRST element in the toolbar (not floating).
- Click hamburger → drawer slides in, scrim covers the rest of the viewport.
- Click an element INSIDE the drawer (e.g. a thread) → does NOT close the drawer; thread is selected.
- Scroll the threads list → it scrolls inside the drawer.
- Drawer has a visible right-edge shadow.
- Click the scrim (any pixel outside the drawer) → drawer closes.
- `elementFromPoint` at drawer center returns a thread item / drawer chrome, NOT the scrim.

## Out of scope

- chat-input layout at narrow widths (separate follow-up)
- chat-sidebar / chat-popup mobile geometry (separate follow-up)
- Touch target size audit across all interactive elements (separate follow-up)
- Mobile-specific theme tweaks
- Persistent drawer state for tablet sizes

## References

- Drawer current source: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts:60-68` (template), `libs/chat/src/lib/styles/chat-sidenav.styles.ts:35-66` (drawer CSS)
- Hamburger current source: `examples/chat/angular/src/app/shell/demo-shell.component.html:2-10`, `examples/chat/angular/src/app/shell/demo-shell.component.css:16-38`
- Stacking-context primer: [MDN — The stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context)
