# Docs Chrome Polish — Design

**Date:** 2026-06-04
**Status:** Draft for review
**Scope:** Carry the landing-page visual language into the docs reading chrome — the sidebar, the per-page header, and the prev/next footer. Frontend/visual only. Builds on the branded landing shipped in #564/#568.

## Goal

The `/docs` landing page is now branded (vendor/library marks, accent treatment,
hover-lift cards). The inner docs pages still use plainer styling. This spec
extends the same language to the docs chrome so the reading experience matches
the landing.

This is the **first of two** related specs. A later spec adds Mintlify-style
per-page LLM markdown export (a raw-markdown route + a `PageActions` dropdown);
this spec reserves the slot where that control mounts but does not build it.

## Shared foundation — `LibraryMark`

A single small component that maps each of the seven libraries to its visual
mark, reusing the exact assets/glyphs from the landing page:

| Library | Mark |
|---------|------|
| langgraph | `/logos/langgraph.svg` (logo chip) |
| ag-ui | `/logos/runtimes/copilotkit.svg` (logo chip) |
| a2ui | `/logos/providers/google.svg` (logo chip) |
| render | `/logos/surface/vercel.svg` (logo chip) |
| chat | in-house speech-bubble glyph |
| licensing | in-house key glyph |
| telemetry | in-house pulse glyph |

- **Create:** `apps/website/src/components/docs/LibraryMark.tsx`.
- Props: `{ library: LibraryId; size?: number }` (default size 24).
- Logo libraries render the white rounded "logo chip" treatment (white bg,
  border, contained `<img alt="" aria-hidden loading=lazy>`); glyph libraries
  render the accent-tinted "glyph chip" (accent-surface bg, accent border, the
  stroked SVG in `tokens.colors.accent`). Same visual styling as the landing's
  `LogoChip`/`GlyphChip`.
- The 3 glyph SVGs (speech-bubble, key, pulse) move here as the single source of
  truth. (The landing page keeps its own copies — out of scope to refactor the
  already-merged landing in this spec.)
- Server-component safe (no client hooks).

## 1. Sidebar library switcher

In `apps/website/src/components/docs/DocsSidebar.tsx`:
- The current-library button (top of `LibraryDropdown`) renders a small
  `LibraryMark` (size ~20) left of the library name.
- Each dropdown option renders its `LibraryMark` left of the title/description.
- Behavior, routing, and the open/close logic are unchanged.

## 2. Sidebar section hierarchy (nav cleanup)

In `DocsSidebar.tsx`, `SectionGroup` page links:
- **Active page:** accent-surface background only. **Remove any left accent bar**
  — background is the only active affordance. Text stays `tokens.colors.accent`,
  weight 600.
- **Hover (inactive):** a subtle background (`tokens.surfaces.surfaceDim`) via a
  scoped `<style>` block or `data-` attribute + CSS (the component is already a
  client component). Active links do not change on hover.
- Section header colors (blue for `accent`, red for `angularRed`) are unchanged.

## 3. Branded page header

- **Create:** `apps/website/src/components/docs/DocsPageHeader.tsx`.
- Rendered in the doc route
  (`apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`) between the
  breadcrumb and the `<article>`.
- Layout: a flex row with the header content on the left and a **right-aligned
  actions slot** on the right; below the row, the existing MDX `# Title` remains
  the page `h1` (this component does NOT render the title — no duplication, no
  MDX surgery).
  - Left: a `LibraryMark` chip (size ~34) + a mono eyebrow reading
    `LIBRARY · SECTION` (e.g. `LANGGRAPH · GUIDES`), uppercased, letter-spaced,
    `tokens.colors.accent`, using the library's display title and the section's
    title from `docs-config`.
  - Right (actions slot): renders `props.actions` if provided, else nothing.
    Spec 2 passes the `PageActions` dropdown here. In this spec the route passes
    no actions, so the slot is empty.
- Props: `{ library: LibraryId; section: string; actions?: ReactNode }`.
- Server-component safe.

## 4. Prev/Next footer

In `apps/website/src/components/docs/DocsPrevNext.tsx`:
- Replace the current link styling with two hover-lift **cards** (matching the
  landing card treatment via `data-ui="docs-card"` + a scoped hover `<style>`:
  border → `accentBorderHover`, shadow → `md`, `translateY(-1px)`, with a
  `prefers-reduced-motion` guard).
- Each card shows a small uppercase mono direction label (`← PREVIOUS` /
  `NEXT →`, the latter right-aligned) above the page title in
  `tokens.colors.accent`.
- Prev-only or next-only cases keep a single card (current behavior preserved).

## Components & implementation

- **Create:** `LibraryMark.tsx`, `DocsPageHeader.tsx`.
- **Modify:** `DocsSidebar.tsx` (switcher marks + nav cleanup), `DocsPrevNext.tsx`
  (cards), and the doc route `page.tsx` (render `DocsPageHeader`).
- **Reuse:** `/logos/*.svg` assets, design tokens, `docs-config` (library titles,
  section titles via `getLibraryConfig`/`getDocsSection`).
- No new dependencies, no new asset files, no analytics changes.

## Testing

Update/extend `apps/website/e2e/docs.spec.ts` (the `Docs slug page` block):
- The sidebar renders a library mark `<img>` or glyph for the active library.
- The active sidebar link has the accent-surface background and **no** inset
  left-bar box-shadow.
- The page header renders the `LIBRARY · SECTION` eyebrow text.
- `DocsPrevNext` renders direction label(s) (`Next →` and/or `← Previous`).

Add a focused unit test `LibraryMark.spec.tsx`: renders a logo `<img src>` for a
logo library (e.g. langgraph) and a glyph (svg) for a glyph library (e.g. chat).

## Out of scope

- The raw-markdown route and `PageActions` dropdown (Spec 2 — the actions slot is
  reserved here but unused).
- Refactoring the already-merged landing page to consume `LibraryMark`.
- Breadcrumb, TOC, MDX prose components, and the search modal.
- Any change to docs content, routing, or `docs-config`.
