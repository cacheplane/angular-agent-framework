# Cockpit Mobile Menu Redesign

## Problem

The cockpit mobile menu is a narrow `w-64` (256px) left-sliding drawer that leaves content peeking through on the right. It doesn't fill the screen, wastes horizontal space, and feels cramped on mobile. There is no enter/exit animation — the drawer pops in and out via conditional rendering.

## Solution

Replace the narrow drawer with a full-screen overlay that reimagines the navigation as product cards with topic chips. The overlay takes over the entire viewport on mobile, providing a native app-like navigation experience.

## Design

### New Component: `MobileNavOverlay`

A client component at `apps/cockpit/src/components/mobile-nav-overlay.tsx`.

**Props:**
- `navigationTree: NavigationProduct[]` — the product/section/entry tree
- `manifest: CockpitManifestEntry[]` — full manifest for the language picker
- `entry: CockpitManifestEntry` — current active entry
- `isOpen: boolean` — controlled open state
- `onClose: () => void` — callback to close the overlay

### Layout Structure

```
+------------------------------------------+
| Cockpit            [Python ▾]    [X]     |  <- Fixed header
+------------------------------------------+
|                                          |
| ┌──────────────────────────────────────┐ |
| │ LANGGRAPH                            │ |
| │ [Streaming] [Persistence] [Interrupts│ |
| │ ] [Memory] [Durable Exec] [Subgraphs│ |
| │ ] [Time Travel] [Deploy]            │ |
| └──────────────────────────────────────┘ |
|                                          |
| ┌──────────────────────────────────────┐ |
| │ RENDER                               │ |
| │ [*Spec Rendering*] [Element]         │ |  <- Scrollable body
| │ [State Mgmt] [Registry]             │ |
| │ [Repeat Loops] [Computed]            │ |
| └──────────────────────────────────────┘ |
|                                          |
| ┌──────────────────────────────────────┐ |
| │ CHAT                                 │ |
| │ [Messages] [Input] [Interrupts]      │ |
| │ [Tool Calls] [Subagents] [Threads]   │ |
| │ [Timeline] [Gen UI] [Debug]          │ |
| │ [Theming]                            │ |
| └──────────────────────────────────────┘ |
|                                          |
| ┌──────────────────────────────────────┐ |
| │ DEEP AGENTS                          │ |
| │ [Planning] [Filesystem] [Subagents]  │ |
| │ [Memory] [Skills] [Sandboxes]        │ |
| └──────────────────────────────────────┘ |
+------------------------------------------+
```

### Overlay Container

- `fixed inset-0 z-50 md:hidden` — full viewport, mobile only
- `display: flex; flex-direction: column`
- Background: `var(--ds-glass-bg)` with `backdrop-filter: blur(var(--ds-glass-blur))`

### Header

- Fixed at top of overlay (not scrollable)
- Left: "Cockpit" label (mono uppercase, `--ds-text-muted`)
- Right: `LanguagePicker` component (reused as-is) + close button
- Close button: X SVG, `color: var(--ds-text-muted)`, `24x24` icon with at least `44x44` touch target
- Bottom border: `1px solid var(--ds-glass-border)`

### Product Cards

- Vertical stack inside a scrollable container (`overflow-y: auto; flex: 1`)
- Container padding: `12px 16px`
- Card gap: `10px`
- Card styling:
  - `background: var(--ds-glass-bg)`
  - `border: 1px solid var(--ds-glass-border)`
  - `border-radius: 10px`
  - `padding: 12px`
- Product label: mono uppercase, `font-size: 0.7rem`, `font-weight: 600`, `color: var(--ds-accent)`, `margin-bottom: 8px`

### Topic Chips

- `display: flex; flex-wrap: wrap; gap: 6px`
- Each chip is an `<a>` tag linking to `toCockpitPath(entry)`
- Chip styling:
  - `padding: 4px 10px`
  - `border-radius: 20px`
  - `font-size: 0.8rem`
  - `text-decoration: none`
- Default state: subtle surface background, `color: var(--ds-text-secondary)`
- Active state (current entry): `background: var(--ds-accent-surface)`, `color: var(--ds-accent)`, `border: 1px solid` with accent tint
- Topics with `topic === 'overview'` are filtered out (matching existing sidebar behavior)
- Product prefix is stripped from titles (matching existing `stripProductPrefix` logic)

### Animation

- Enter: opacity `0 -> 1` + `translateY(8px) -> 0`, `200ms ease-out`
- Exit: reverse, `150ms ease-in`
- Driven by `data-state="open|closing"` attribute on the overlay container
- On close: set `data-state="closing"`, wait for `transitionend`, then call `onClose` to unmount

### Close Behavior

- X button in header
- Chip click (navigates away, page load closes overlay)
- Escape key (keyboard listener)
- No backdrop click needed (overlay is full-screen)

## Integration with cockpit-shell.tsx

### Changes

1. **Remove** the existing mobile sidebar overlay block (the `isSidebarOpen && (<>...</>)` JSX — backdrop div + `w-64` drawer div)
2. **Add** `<MobileNavOverlay>` in its place, receiving `navigationTree`, `manifest={cockpitManifest}`, `entry`, `isOpen={isSidebarOpen}`, `onClose={() => setIsSidebarOpen(false)}`
3. Existing `isSidebarOpen` state and hamburger button stay unchanged — they control the new overlay

### No Changes To

- `CockpitSidebar` — desktop only, untouched
- `NavigationGroups` — desktop only, untouched
- `LanguagePicker` — reused inside the new overlay
- Desktop grid layout and all `md:` responsive classes
- `ModeSwitcher`, `RunMode`, `CodeMode`, or any content components

## File Changes

| File | Action |
|------|--------|
| `apps/cockpit/src/components/mobile-nav-overlay.tsx` | **New** — full-screen overlay component |
| `apps/cockpit/src/components/cockpit-shell.tsx` | **Modify** — swap old mobile overlay for `MobileNavOverlay` |
