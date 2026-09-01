# Docs adapter picker — visual and structural refresh

**Date:** 2026-08-31
**Scope:** the library picker in the docs control-plane sidebar (`LibraryDropdown`)
**Status:** approved, ready to implement

## Context

PR #892 ("Unify Docs and Cockpit sidebar control planes") replaced the docs
sidebar with a control plane: an icon rail, then named sections — **Scope**,
**Learn**, **Environment**, **Actions**. The library picker moved into **Learn**
but did not get the same design pass as the rest of the sidebar, and one style
rule was lost in the migration.

The picker is the control a reader uses to move between `@threadplane/langgraph`
and `@threadplane/ag-ui`. It should read as the deliberate choice it is, in the
vocabulary the rest of the sidebar now speaks (Inter, 12–13px, 7–9px radii,
quiet muted labels).

## Problems

1. **The title and description collide.** `.docs-sidebar-lib-item-text` carries
   only `min-width: 0`; the `flex flex-col` that stacked the two spans was
   dropped when #892 moved the JSX off Tailwind onto semantic class names. Both
   spans compute to `display: inline`, so every row renders as one run-on line:
   `LangGraphLangChain/LangGraph adapter for Angular UI`.
   **This is live on threadplane.ai** — production CSS serves
   `.docs-sidebar-lib-item-text{min-width:0}`.

2. **The menu is clipped.** Measured at a 720px viewport: menu spans y=342→902
   inside a pane ending at y=720. **182px is off-screen.**

3. **Rows are ragged.** Measured item heights: `66, 66, 66, 138, 66, 66, 90`.
   AG-UI's 100+ character description is the 138.

4. **The list is undifferentiated.** Seven entries, flat. Two are adapters; five
   are companion libraries. The picker reads as a library index rather than an
   adapter choice.

5. **Items are not links.** `<button onClick={router.push}>` — no ⌘-click, no
   middle-click, no open-in-new-tab.

6. **The library is stated twice.** The picker sits in **Learn**; **Environment**
   separately lists a `Library — LangGraph` row.

Accessibility is *not* a problem here: #892 added `role="menu"`,
`aria-expanded`, `aria-haspopup`, `aria-controls`, arrow keys, Home/End, Escape,
and focus restore. That work stands and is preserved.

## Design

### Placement

The picker **stays in Learn**, directly above the nav it rescopes. Duplication is
resolved by removing the `Library` row from **Environment**.

Considered and rejected: promoting the picker into **Scope**. Semantically exact
— changing the library *is* changing scope, and Scope never collapses — but that
card is a quiet 11px muted readout, and its quietness is load-bearing for the
sidebar's calm. A 38px bordered control inside it makes one card half-control,
half-readout. Also rejected: making it the **Environment** `Library` row —
Environment is collapsed by default and sits at the bottom, so the primary way to
switch adapters would hide behind a disclosure most readers never open.

### Menu anatomy

Two labelled groups:

- **Adapters** — LangGraph, AG-UI. Mark + name + a 3–4 word tagline. ~46px rows.
- **Libraries** — Render, Chat, A2UI, Middleware, Telemetry. Mark + name only.
  ~34px rows.

Rows are uniform *within* a group and deliberately different *between* groups;
that difference is what makes the two adapters read as the weighted choice.
Taglines are capped at 3–4 words so rows can never wrap ragged again.

Bare names for the five libraries are intentional: "Chat", "Render", and
"Telemetry" are self-describing, and a tagline there is the grey noise the
current design already suffers from.

### Data model — `src/lib/docs-config.ts`

```ts
export type LibraryGroup = 'adapter' | 'library';

export interface DocsLibrary {
  id: LibraryId;
  title: string;
  group: LibraryGroup;
  /** Shown in the picker. Adapters only — libraries are self-describing. */
  tagline?: string;
  // …unchanged
}
```

`DocsLibrary.description` is **removed**. It is read in exactly one place today
(`DocsSidebar.tsx:172`, the picker). `DocsSearch` indexes pages, not libraries;
page `metadata.description` is a separate concern. Once the picker stops
rendering it, it is dead data, and seven long strings that nothing reads will
drift unnoticed.

Group assignment:

| Library    | Group   | Tagline                      |
| ---------- | ------- | ---------------------------- |
| LangGraph  | adapter | Talk to LangGraph directly   |
| AG-UI      | adapter | Any AG-UI backend            |
| Render     | library | —                            |
| Chat       | library | —                            |
| A2UI       | library | —                            |
| Middleware | library | —                            |
| Telemetry  | library | —                            |

### Markup — `src/components/docs/DocsSidebar.tsx`

```tsx
<div role="menu" aria-labelledby={triggerId}>
  <div role="group" aria-label="Adapters">
    <span aria-hidden="true" className="docs-sidebar-lib-group">Adapters</span>
    <Link
      href={libraryIntroPath(library.id)}
      role="menuitemradio"
      aria-checked={isActive}
      …
    >
```

- **`<Link href>` replaces `<button onClick={router.push}>`.** Restores
  ⌘-click / middle-click / new-tab. Uses the existing `libraryIntroPath()`
  helper instead of an inline template string.
- **`role="menuitemradio"` + `aria-checked`** — single-select from a set, which
  is what the checkmark means.
- **`role="group"` + `aria-label`** — makes the visual group labels programmatic
  rather than decorative.

**Migration hazard:** the keyboard handler queries
`querySelectorAll<HTMLButtonElement>('[role="menuitem"]')`. Both the selector and
the element type must change (`[role="menuitemradio"]`, `HTMLElement`) or arrow
keys, Home/End and Escape silently stop finding items — a failure whose mode is
silence, so it must be covered by a test that fails before the fix.

### Styles — `src/styles/docs.css`

```css
.docs-sidebar-lib-item-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.docs-sidebar-lib-menu {
  max-height: 60vh;   /* replaces overflow: hidden */
  overflow-y: auto;
}
```

The redesigned menu measures ~325px, which already fits a 720px viewport — but
by only ~15px. `60vh` guarantees internal scrolling rather than a menu that runs
off the fold at smaller heights.

### Environment — `src/components/docs/DocsControlPlane.tsx`

Remove the `Library` row from `environmentRows`. `Framework` and
`Package manager` stay.

## Testing

Two existing tests in `DocsControlPlane.spec.tsx` will fail and should:

- `'shows truthful scope and collapsed environment defaults'` — asserts the
  removed `Library` row.
- `'supports keyboard entry and dismissal for the library menu'` — assumes
  button elements and the `[role="menuitem"]` selector.

New coverage:

1. **Title and tagline render on separate lines** — a regression test for the
   collision. Must fail against current `main`.
2. **Keyboard navigation still traverses items after the anchor migration** —
   guards the silent-selector hazard above.
3. **Groups are labelled** — `role="group"` with accessible names
   "Adapters" / "Libraries".
4. **Items are anchors with real hrefs** — guards the ⌘-click regression.

## Out of scope

Deliberately deferred, both worth doing separately:

- `/docs/choosing-an-adapter` renders without the control plane, so following
  that link drops the reader into a page with no nav.
- There is no docs navigation below the `lg` breakpoint.

Neither is about the picker; folding them in would blur what this change is.
