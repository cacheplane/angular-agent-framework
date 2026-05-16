# chat-debug × chat-sidebar coexistence — Design

**Status:** Approved
**Date:** 2026-05-15
**Goal:** Make `<chat-debug>` and `<chat-sidebar>` coexist on screen without overlap. In sidebar mode today the debug panel docks over the sidebar's launcher, leaving the user unable to open the chat while inspecting it. Fix this by introducing a lightweight, CSS-only **edge-claim primitive** in `@ngaf/chat` and an auto-dock rule that picks a sensible default when a sidebar is present.

## Why now

Phase 5 of the canonical-demo deploy shipped (PR #340). Local verification revealed two latent UX bugs in the chat-debug composition: launcher anchored bottom-left, and panel covering the sidebar launcher in sidebar mode. PR #341 fixed the launcher position; this design fixes the panel coexistence.

## Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| User intent when both panels open | Watch chat + inspect timeline/state simultaneously — both must be visible |
| Mechanism | Mutual edge-claiming via CSS custom properties on `<html>` (no service, no DI) |
| Default dock when sidebar mode is active | Auto-switch chat-debug to `dock="bottom"` |
| User override | If the user explicitly clicks a dock button, store an override flag and stop auto-switching |
| Demo-shell wiring | None — chat-debug auto-detects via `document.querySelector('chat-sidebar')` |
| Scope | Library-internal primitive; `data-ngaf-chat-{sidebar,debug}` attributes are NOT documented as public API yet |
| Release vehicle | `@ngaf/chat` patch bump (0.0.x → 0.0.x+1) |

## Architecture

A library-side primitive at the `chat-tokens.ts` layer. Each docked panel publishes its claimed edge as a `data-*` attribute on `<html>`. Tokens defined alongside the existing theme tokens map those attributes to four CSS custom properties (`--ngaf-chat-occupy-{top,right,bottom,left}`). Other panels read those custom properties via `right:` / `bottom:` declarations to leave room.

The mechanism is symmetric: any panel that opts in by writing the attribute participates. Today only `chat-sidebar` and `chat-debug` participate. Future drawers (notifications, etc.) extend the pattern without touching existing components.

The auto-dock rule lives inside `chat-debug` and uses DOM presence detection — no demo-shell or DI plumbing.

## The edge-claim contract

### Custom properties

Four CSS custom properties on `:root`, defaulting to `0`:

```css
:root {
  --ngaf-chat-occupy-top:    0px;
  --ngaf-chat-occupy-right:  0px;
  --ngaf-chat-occupy-bottom: 0px;
  --ngaf-chat-occupy-left:   0px;
}
```

### Attribute mapping (write side)

```css
:root[data-ngaf-chat-sidebar="open"] {
  --ngaf-chat-occupy-right: var(--ngaf-chat-sidebar-width-drawer, 28rem);
}

:root[data-ngaf-chat-debug="bottom"] { --ngaf-chat-occupy-bottom: var(--ngaf-chat-debug-panel-size-h, 40vh); }
:root[data-ngaf-chat-debug="right"]  { --ngaf-chat-occupy-right:  var(--ngaf-chat-debug-panel-size-w, 420px); }
:root[data-ngaf-chat-debug="left"]   { --ngaf-chat-occupy-left:   var(--ngaf-chat-debug-panel-size-w, 420px); }
```

### Read side

```css
/* sidebar: shorten vertically when something occupies the bottom */
.chat-sidebar__panel  { bottom: var(--ngaf-chat-occupy-bottom, 0); }

/* debug bottom: don't extend under a right-edge occupier */
.chat-debug .panel--bottom { right: var(--ngaf-chat-occupy-right, 0); }

/* debug right: stack to the left of an existing right-edge occupier */
.chat-debug .panel--right  { right: var(--ngaf-chat-occupy-right, 0); }

/* launchers respect bottom-occupier so they're not buried */
.chat-sidebar__launcher    { bottom: calc(1rem + var(--ngaf-chat-occupy-bottom, 0)); }
```

### Conflict resolution

**Additive last-writer-wins per axis.** If two panels both claim the same edge, the second simply overrides — we do not sum widths. Reason: in practice no two panels claim the same edge simultaneously. Sidebar always claims `right`. Debug picks an unoccupied edge (auto-bottom in sidebar mode, defaults to right otherwise).

If a future panel needs to stack-along-the-same-edge (e.g. a notification drawer above the sidebar), it can be added with its own `--ngaf-chat-occupy-right-2` token. Out of scope for this design.

## Behavior matrix

What the user sees, per demo mode × debug-open combo:

| Demo mode | Debug closed | Debug open (default dock) |
|---|---|---|
| **embed** | Chat fills the page; debug launcher top-right | Debug docks **right** (status quo) |
| **popup** | Chat closed; popup launcher bottom-right; debug launcher top-right | Debug docks **right** (status quo); popup unaffected (it's a floating window, not edge-anchored) |
| **sidebar** | Demo bg fills page; sidebar launcher bottom-right; debug launcher top-right | Debug auto-docks **bottom**. Sidebar opens normally — bottom strip respects `--ngaf-chat-occupy-right`, sidebar shortens via `bottom: var(--ngaf-chat-occupy-bottom)` |

### Auto-dock rule

In `chat-debug.component.ts`, when the panel is first opened (or when `mode` changes), check for a sibling `<chat-sidebar>` element. If found AND the user hasn't explicitly overridden the dock, force `dockState.set('bottom')`.

```ts
// pseudocode in chat-debug.component.ts
private readonly userDockOverride = signal(false);

private maybeAutoDock(): void {
  if (this.userDockOverride()) return;
  if (typeof document === 'undefined') return;
  if (document.querySelector('chat-sidebar')) {
    this.dockState.set('bottom');
  }
}

protected onDockButtonClick(next: DockPosition): void {
  this.userDockOverride.set(true);
  this.dockState.set(next);
}
```

The override flag persists for the session (not written to storage — when the user changes modes or refreshes, auto-dock can kick back in).

### Edge cases

- **Sidebar push-content mode** (`data-push="true"`): unchanged. Push affects `<main>` margin, not panel positions, so edge-claim math still works.
- **Animation jitter when sidebar opens with debug already in bottom-dock**: transition `right` on `.chat-debug .panel--bottom` over the same duration as the sidebar slide (`var(--ngaf-chat-anim-fast, 200ms)`). The two slides become visually coordinated.
- **SSR**: `document.documentElement.dataset` writes are guarded with `typeof document === 'undefined'`. Same pattern `ensureChatRootStyles()` already uses.
- **Mobile (<768px)**: when sidebar drawer is full-width and debug bottom is open, the bottom strip would compute `right: 100%` (zero width). Solution: a `@media (max-width: 767px)` rule hides `.chat-debug .panel--bottom` and shows a smaller "expand" affordance on the launcher. Encoded as CSS only — no JS.

## Files touched

### Library — 3 modify, 1 add

1. **`libs/chat/src/lib/styles/chat-tokens.ts`** *(modify)*
   - Add the four `--ngaf-chat-occupy-*` defaults to `ROOT_TOKEN_STYLES`
   - Add the attribute-mapping rules (`:root[data-ngaf-chat-sidebar="open"]`, `:root[data-ngaf-chat-debug="bottom|right|left"]`)
   - Define `--ngaf-chat-debug-panel-size-h` (default `40vh`, used by the bottom dock) and `--ngaf-chat-debug-panel-size-w` (default `420px`, used by right/left docks). Two variables instead of one because the dock orientations need different units; consumers retain per-axis override knobs
   - Define `--ngaf-chat-sidebar-width-drawer` (already exists; verify the value used in the attribute mapping matches)

2. **`libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts`** *(modify)*
   - Effect: when `open()` changes, set/clear `document.documentElement.dataset.ngafChatSidebar = 'open'`
   - Cleanup in `ngOnDestroy` and on `open()=false`
   - CSS: `.chat-sidebar__panel { bottom: var(--ngaf-chat-occupy-bottom, 0); }`
   - CSS: `.chat-sidebar__launcher { bottom: calc(1rem + var(--ngaf-chat-occupy-bottom, 0)); }`

3. **`libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`** *(modify)*
   - Effect: when `dockState()` AND panel-open state change, set/clear `document.documentElement.dataset.ngafChatDebug`
   - Add `userDockOverride: signal<boolean>(false)`; flip to `true` on any dock-button click
   - Auto-dock detection on first open: if sibling `<chat-sidebar>` exists AND no override, set `dockState.set('bottom')`
   - CSS: `.panel--bottom { right: var(--ngaf-chat-occupy-right, 0); transition: right var(--ngaf-chat-anim-fast, 200ms); }`
   - CSS: `.panel--right { right: var(--ngaf-chat-occupy-right, 0); transition: right var(--ngaf-chat-anim-fast, 200ms); }`

4. **`libs/chat/src/lib/styles/__edge-claim.spec.ts`** *(add)*
   - Assert the four `--ngaf-chat-occupy-*` defaults exist in `ROOT_TOKEN_STYLES`
   - Assert each `data-ngaf-chat-{sidebar,debug}="..."` attribute-mapping rule is present
   - Snapshot the read-side declarations on `.chat-sidebar__panel`, `.chat-sidebar__launcher`, `.chat-debug .panel--bottom`, `.chat-debug .panel--right`

### Demo — no changes

The auto-dock detection uses DOM presence (`querySelector('chat-sidebar')`), so demo-shell does not change. The existing `(modeChange)` handler stays as-is.

### Specs to extend

- **`chat-sidebar.component.spec.ts`** — assert `data-ngaf-chat-sidebar` toggles on `open()` true/false
- **`chat-debug.component.spec.ts`** — assert (a) `data-ngaf-chat-debug` reflects dock when panel is open, (b) auto-dock fires to `'bottom'` when a sibling `<chat-sidebar>` exists, (c) explicit dock-button click sets `userDockOverride` to `true` and prevents subsequent auto-switches

### What is deliberately NOT touched

- `chat-popup` — it's a floating window, doesn't claim edges
- demo-shell — auto-detection handles the case
- A2UI tokens / theme system — orthogonal
- Resizable docks (drag handle to grow the bottom strip) — out of scope; sizes remain fixed at `40vh` / `420px`
- Generalizing edge-claim as a public consumer API — internal hook only for now; follow-up if a third consumer needs it

## Testing

### Unit (vitest, no DOM)

- **`chat-tokens.spec.ts`** — extend the existing spec (added in PR #341) with new cases asserting the four `--ngaf-chat-occupy-*` defaults compile, and all 7 attribute-mapping rules are present in `ROOT_TOKEN_STYLES`
- **`__edge-claim.spec.ts`** *(new)* — focused snapshot of the read-side declarations on the four panel selectors

### Component (vitest + Angular TestBed)

- **`chat-sidebar.component.spec.ts`** — toggling `open()` writes/clears `data-ngaf-chat-sidebar` on `<html>`; cleanup runs on destroy
- **`chat-debug.component.spec.ts`** — three cases:
  1. `dockState` writes `data-ngaf-chat-debug` on `<html>` when the panel opens; clears on close
  2. Auto-dock fires to `'bottom'` when a sibling `<chat-sidebar>` element exists at first open
  3. Clicking the right-dock button sets `userDockOverride` and disables subsequent auto-switching even if a `<chat-sidebar>` is present

### E2E (playwright)

Extend the existing `examples-chat-aimock-e2e` suite with a new spec for sidebar mode:

1. Switch to sidebar mode via the debug palette
2. Open chat-debug (now bottom-docked automatically)
3. Assert the sidebar launcher is clickable (`page.locator('.chat-sidebar__launcher').click()` succeeds)
4. Assert the sidebar panel opens
5. Assert no overlap: computed `right` of `.chat-debug .panel--bottom` equals `448px` (28rem) when sidebar is open

### Manual smoke (CHECKLIST.md additions)

- Sidebar open + debug bottom open → no overlap
- Sidebar closed + debug bottom open → debug spans full width
- Sidebar open + user clicks debug right-dock → debug stacks at `right: 28rem`, no overlap

## Data flow

No runtime data flow changes. Edge claims propagate via CSS variables on `<html>`. The only JS side effect is two `dataset` writes (one per component) on signal changes.

## Error handling

No new failure paths. Edge-claim is best-effort styling. If a component fails to write its attribute (e.g. exception during effect), the worst case is a single overlap incident — the panel still renders correctly, and the next state change re-syncs.

## Release

Single `@ngaf/chat` patch bump. No breaking API changes; new CSS custom properties default to `0` and have no effect on consumers that don't use chat-sidebar or chat-debug. Consumers can override the defaults if they want different panel sizes (`--ngaf-chat-debug-panel-size-h`, `--ngaf-chat-debug-panel-size-w`, `--ngaf-chat-sidebar-width-drawer`).

## Out of scope

- Stack-along-same-edge for a third overlay (e.g. notifications drawer above sidebar)
- Z-index ladder / focus-management system
- Resizable docks (drag-to-grow handles)
- A2UI surface / theme token changes
- Demo-shell wiring (handled by auto-detection)
- Documenting `data-ngaf-chat-{sidebar,debug}` as public consumer API

## References

- PR #341 — chat-debug launcher move + theme override fix; adds the `data-ngaf-chat-theme` selector that this design's pattern mirrors
- `libs/chat/src/lib/styles/chat-tokens.ts` — where the primitive lives
- `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts:55-63` — current launcher positioning
- `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts:49-128` — current dock CSS and DockPosition type
