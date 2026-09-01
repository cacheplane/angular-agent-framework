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
  /** Long form. Fallback for the page meta description — not shown in the picker. */
  description: string;
  group: LibraryGroup;
  /** Shown in the picker. Adapters only — libraries are self-describing. */
  tagline?: string;
  // …unchanged
}
```

`DocsLibrary.description` is **kept**, unchanged. An earlier draft of this spec
removed it as dead data; that was wrong. Besides the picker it is the fallback
for each page's `<meta name="description">` via `resolveDocDescription()`
(`src/lib/docs.ts:126`), which also feeds the page's JSON-LD. Deleting it would
have silently changed search snippets across the docs — the exact budget tuned
in #880. `tagline` is added *alongside* it: `description` is long-form metadata,
`tagline` is the short picker string.

Every `description` string stays byte-identical to `main`. Group assignment:

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
  max-height: 60vh;   /* replaces overflow: hidden — floor only, see below */
  overflow-y: auto;
}
```

**A CSS cap alone is not enough**, and an earlier draft of this spec claimed
otherwise. The menu opens ~342px down the pane, so at a 600px viewport `60vh`
(360px) still puts its bottom edge at 702px — **102px past the fold**, measured.
A viewport percentage cannot account for a large fixed top offset.

So the real cap is measured from the trigger, in an effect that runs on open and
on resize:

```ts
const available = window.innerHeight - trigger.getBoundingClientRect().bottom - 16;
menu.style.maxHeight = `${Math.max(180, available)}px`;
```

Verified at a 600px viewport: the menu caps to 245px, its bottom lands 12px
inside the viewport, it scrolls internally, and Telemetry — the last entry —
stays reachable. The CSS `max-height` remains as a pre-hydration floor.

### Environment — `src/components/docs/DocsControlPlane.tsx`

Remove the `Library` row from `environmentRows`. `Framework` and
`Package manager` stay.

## Testing

Three existing tests will fail and should:

- `DocsControlPlane.spec.tsx` → `'shows truthful scope and collapsed environment
  defaults'` — asserts the removed `Library` row.
- `DocsControlPlane.spec.tsx` → `'supports keyboard entry and dismissal for the
  library menu'` — assumes button elements and the `[role="menuitem"]` selector.
- `Nav.spec.tsx` → `'keeps the drawer open when Escape dismisses the nested
  library menu'` — the mobile drawer renders the same menu, so it asserts the
  same role.

New coverage:

1. **Title and tagline render on separate lines** — a regression test for the
   collision. Must fail against current `main`.
2. **Keyboard navigation still traverses items after the anchor migration** —
   guards the silent-selector hazard above.
3. **Groups are labelled** — `role="group"` with accessible names
   "Adapters" / "Libraries".
4. **Items are anchors with real hrefs** — guards the ⌘-click regression.
5. **The menu carries a measured `max-height` when open** — guards the cap,
   whose absence is invisible until someone opens the picker in a short window.
6. **A CSS-level guard** (`src/styles/docs-sidebar-styles.spec.ts`) asserting
   both new rules exist. jsdom does not apply the stylesheet, so no component
   test can see the collision — this is the only guard for the failure mode that
   actually reached production.

## Out of scope

Deliberately deferred, both worth doing separately:

- `/docs/choosing-an-adapter` renders without the control plane, so following
  that link drops the reader into a page with no nav.
- There is no docs navigation below the `lg` breakpoint.

Neither is about the picker; folding them in would blur what this change is.
