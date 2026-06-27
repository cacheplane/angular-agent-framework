# Design: hand-rolled connected-overlay primitive for @threadplane/chat

Date: 2026-06-27
Status: approved (brainstorming)
Branch context: `blove/ag-ui-app-mode-promo`

## Problem

`chat-select`'s dropdown menu was an absolutely-positioned child. It is clipped
by any ancestor `overflow` container and trapped by any ancestor `transform`
(the sliding `chat-sidebar__panel` and `chat-welcome` both have `transform`), so
the "More prompts" menu in sidebar mode was cut off. `position: fixed` cannot
escape a transformed ancestor, so the menu must render in a body-level portal.

The current fix (shipped on this branch) uses `@angular/cdk`'s
`cdkConnectedOverlay`, which added `@angular/cdk` as a **peer dependency** of the
published `@threadplane/chat` package.

## Goal

Remove the `@angular/cdk` peer dependency: keep `@threadplane/chat`'s install
footprint minimal (zero extra peer deps). Replace CDK Overlay with a small,
**public**, hand-rolled connected-overlay primitive owned in-lib, using the CDK
source (`~/repos/components/src/cdk/overlay`) as the reference for positioning,
lifecycle, and accessibility. Runtime dependencies: `@angular/core` + DOM APIs
only.

### Decisions (from brainstorming)

- **Driver:** zero extra peer deps.
- **Scroll/resize while open:** reposition live (menu follows the trigger).
- **A11y bar:** port current behavior + tighten (focus-return on close, Tab
  closes, `aria-controls`). Not the full APG type-ahead/`aria-activedescendant`
  pattern.
- **Factoring:** ship as a **public** exported primitive; `chat-select` is the
  first consumer (dogfood).
- **API shape:** declarative directive pair, mirroring `cdkConnectedOverlay`
  (Approach A).
- **RTL:** out of scope (LTR-only); noted as a future extension.

## Public surface

New folder `libs/chat/src/lib/primitives/overlay/`:

| File | Responsibility | Angular |
|---|---|---|
| `connected-position.ts` | Pure positioning function + `ConnectedPosition` / `OverlayPositionResult` types. | No |
| `overlay-container.ts` | `getOverlayContainer(document)` — lazily creates the single body-level `<div class="chat-overlay-container">` and injects structural CSS once into `<head>` (same `<style>`-append pattern as `ROOT_TOKEN_STYLES`, so consumers import nothing). | minimal |
| `connected-overlay.directive.ts` | `ChatOverlayOriginDirective` (`[chatOverlayOrigin]`, `exportAs: 'chatOverlayOrigin'`) + `ChatConnectedOverlayDirective` (`[chatConnectedOverlay]` on an `<ng-template>`). | Yes |
| `*.spec.ts` | Unit tests. | — |

Exported from the lib public entry. Naming follows the lib's `chat*` / `Chat*`
convention.

```html
<button chatOverlayOrigin #origin="chatOverlayOrigin">…</button>
<ng-template
  chatConnectedOverlay
  [chatOverlayOrigin]="origin"
  [chatOverlayOpen]="open()"
  [chatOverlayPositions]="positions"
  [chatOverlayPanelClass]="panelClasses()"
  (chatOverlayAttached)="onAttached()"
  (chatOverlayOutsideClick)="open.set(false)"
  (chatOverlayDetach)="open.set(false)">
  <div class="…menu…">…</div>
</ng-template>
```

`ConnectedPosition` is structurally identical to CDK's (`originX/Y`,
`overlayX/Y`, `offsetX/Y`), so the position arrays already in `chat-select`
carry over unchanged.

## Positioning engine (`connected-position.ts`)

Pure function, ported from CDK's core fit logic (no flexible-dimensions,
grow-after-open, RTL, or virtual-keyboard handling):

```
computeConnectedPosition({ originRect, overlaySize, viewport, positions, margin })
  → { top, left, position }
```

1. For each candidate position: origin point on the trigger (`originX/Y`), then
   overlay top-left from `overlayX/Y` + offsets (CDK `_getOriginPoint` +
   `_getOverlayPoint`).
2. Compute fit against `viewport − margin`, tracking the best partial fit by
   visible area (CDK `_getOverlayFit`).
3. Pick the first fully-fitting position; if none fit, take the best partial and
   clamp it onscreen (CDK `_pushOverlayOnScreen`).
4. Return viewport-coordinate `{ top, left }` + chosen `position` (for a
   `transform-origin` hook).

## Portal model & lifecycle

Mirrors CDK's structure: one shared container `position: fixed; inset: 0;
pointer-events: none; z-index: 1000` on `<body>`; each open menu gets a
`position: absolute; pointer-events: auto` pane (`.chat-overlay-pane` + consumer
`panelClass`). Top/left are viewport coords (container is fixed at 0,0).

**On open** (`ChatConnectedOverlayDirective`):
1. Create the pane in the container; `viewContainerRef.createEmbeddedView(templateRef)`
   and move its root nodes into the pane. The embedded view is created from the
   **consumer's** template, so it keeps the consumer's `_ngcontent`
   encapsulation attributes → menu styles + `:root` theme tokens work through
   the portal.
2. Measure pane → `computeConnectedPosition` → apply `top/left`.
3. Reposition-live: `window` scroll (**capture + passive**, catches inner
   scroll-container scrolls too) + `window` resize + a `ResizeObserver` on origin
   & pane, all funneled through one rAF-throttled recompute.
4. Capture-phase `mousedown` outside-click → `(chatOverlayOutsideClick)`.

**On close/destroy:** destroy the embedded view, remove the pane, detach all
listeners + the `ResizeObserver`/rAF. Idempotent; tied to `DestroyRef`.

## Accessibility split

| Concern | Owner |
|---|---|
| role=`listbox`/`option`, `aria-expanded`/`aria-haspopup`, `aria-controls` (trigger→listbox id), roving focus, Up/Down/Enter/Space, focus first option on open | chat-select (consumer) |
| Focus returns to origin on close (when focus is inside the pane), **Tab closes** the non-modal popover, Escape → `(chatOverlayDetach)` | directive (generic) |

The directive emits `(chatOverlayAttached)` so `chat-select` focuses the first
option once the pane is live (replaces today's `requestAnimationFrame` guess).
Escape remains handled in `chat-select`'s menu keydown (already returns focus);
the directive's focus-return is the backstop for click-outside / Tab.

## chat-select migration

Swap the four `cdk*` attributes for the `chat*` equivalents (position arrays,
`panelClass`, `open` signal, origin ref unchanged), point option-focus at
`(chatOverlayAttached)`, and **drop `@angular/cdk` from `package.json`
peerDependencies**. Behavior identical; zero new peer dep.

## Theming, SSR

- Theming preserved: `:root` tokens inherit into the body container; the
  embedded view keeps the consumer's encapsulation; `panelClass` carries
  consumer width overrides.
- SSR-safe: guard all `document` / `window` / `ResizeObserver` access; the
  overlay never attaches server-side (open is false at render).

## Testing

- **Unit (high value):** positioning-function table spec — trigger rect ×
  viewport edges → asserts flip/clamp output. Directive spec: open portals to
  container, outside-click + Escape detach, cleanup on destroy.
- **chat-select spec:** query `.chat-overlay-container` (renamed from
  `.cdk-overlay-container`).
- **e2e:** existing consumer specs cover model-picker / toolbar / welcome — only
  the container-selector rename (`test-helpers.selectToolbarOption`,
  `model-picker.spec.ts`).
- **Live Chrome:** re-verify the three surfaces (More-prompts no-clip in
  sidebar, model picker opens up, toolbar flips down) + a scroll-while-open
  reposition check.

## Risk

The positioning fit/push port is the crux; the table-driven unit spec is how we
de-risk it. Everything else is mechanical. Reverting CDK is low-risk because the
consumer template/positions are near-identical between the two APIs.

## Out of scope

RTL positioning, type-ahead search, `aria-activedescendant` focus model,
flexible-dimensions/grow-after-open, backdrop/modal scroll-blocking. Add later
if a consumer needs them.
