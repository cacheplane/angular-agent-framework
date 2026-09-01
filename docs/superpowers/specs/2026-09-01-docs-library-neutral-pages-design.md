# Library-neutral docs pages

**Date:** 2026-09-01
**Scope:** `/docs/choosing-an-adapter` and the control plane's missing
"no library selected" state
**Status:** approved, ready to implement

## Context

Follow-ups recorded during the adapter-picker refresh (#911). Re-checked against
`main` before writing this, and both moved:

- **"There is no docs nav below `lg`" is already fixed.** #892 added a mobile
  drawer with Site/Docs tabs that renders `DocsContextContent`. The original
  note was taken against the pre-#892 tree.
- **"`/docs` has no control plane" is not a defect.** `/docs` is a designed
  landing page — "Start building with Threadplane", pick-your-backend cards.
  It is the front door; a sidebar would damage it. Only
  `/docs/choosing-an-adapter` is a content page missing its shell.

What the re-check *did* surface is a worse bug than the one originally noted.

## Problems

### 1. The mobile drawer fabricates a location

On `/docs/choosing-an-adapter` at 375px the Scope card reads:

> **LangGraph** / Getting Started / **Documentation**

Three fabrications in the one card whose job is telling you where you are.
`Nav.tsx:95` derives `activeLibrary` from `pathParts[1]`, which here is
`"choosing-an-adapter"` — not a library. `getLibraryConfig()` returns
undefined, and line 98 falls back to `'langgraph'`. The drawer then shows
LangGraph's picker, LangGraph's whole section tree, and the page title
`'Documentation'`.

The failure mode is silence: it renders something plausible.

### 2. The page has no control plane

Only `[library]/[section]/[slug]` renders `DocsControlPlane`. Following the
"Choosing an adapter" link from the sidebar drops the reader into a page with
no nav out.

### 3. The section has no accessible name

`aria-labelledby="choosing-an-adapter-heading"` points at an empty `<div>`.
Verified: the target's text content is `""`.

### 4. A 144px dead gap

Measured, between the eyebrow and the H1 — an empty hero `Section` stacked
above the content `Section`.

### 5. The MDX pipeline is duplicated

`choosing-an-adapter/page.tsx` carries ~60 lines of `mdxComponents`,
`rehypeOptions` and prose token styles that already exist in `MdxRenderer`,
which the `[slug]` route uses.

Problems 2–5 are all symptoms of one cause: the page is bespoke and drifted
from the shell every other docs page uses.

**Not a problem:** a hydration error seen while investigating was an artifact of
resizing the tab mid-hydration. A fresh tab logs no console errors on either
page. Not pursued.

## Design

### Nullable library

`DocsControlPlaneProps.activeLibrary` and `DocsNavigationProps.activeLibrary`
become `LibraryId | null`. `null` means library-neutral — a state the control
plane has never had, and whose absence produced problem 1.

### The neutral states

| Element | With a library | Neutral |
| --- | --- | --- |
| Scope | library / section / page | `Docs` / page |
| Picker trigger | mark + library name | `Choose a library`, muted, no mark |
| Picker menu | current entry `aria-checked` | nothing checked |
| Learn | special links + picker + sections | special links + picker only |

The neutral picker label is coherent on this page in particular: the reader is
literally on the page that helps them choose.

### `Nav.tsx`

- `docsLibrary`: `getLibraryConfig(activeLibrary)?.id ?? null` — the
  `?? 'langgraph'` fallback is the bug.
- `docsPageTitle`: look up `specialDocsPages` by pathname before falling back to
  `'Documentation'`.

This corrects the drawer on every library-neutral route, not just this one.

### The page

`choosing-an-adapter/page.tsx` adopts the `docs-shell-page` layout used by the
`[slug]` route, with `<DocsControlPlane activeLibrary={null} …>`, and:

- **Deletes the empty hero `Section`.** Removes the 144px gap and the dangling
  `aria-labelledby` target in one move; the section takes a real `aria-label`.
- **Replaces its MDX pipeline with `<MdxRenderer source={…} />`.**

### `MdxRenderer`

Props reduce to `{ source }`. `library`, `section`, `slug` and `title` are
accepted and never read — they are four of the website's existing lint
warnings. The `[slug]` call site updates accordingly.

### Not needed

The rail's Run/Code/API links already fall back to the cockpit root when
`resolveCockpitIdentity` finds no mapping, which is the case for all but five
docs pages. A null library needs no special handling there.

## Testing

Must fail against `main`:

1. **`Nav` on `/docs/choosing-an-adapter`** — Scope does not say LangGraph, and
   the page title is "Choosing an adapter". This is problem 1.

New coverage:

2. **Neutral control plane** — no library or section line in Scope, picker reads
   "Choose a library", no section groups, nothing `aria-checked`.
3. **The page renders the control plane and its H1**, with no empty
   `aria-labelledby` target.
4. **A library page is unchanged** — Scope still shows library and section, and
   the picker still shows the current library checked. Guards against the
   nullable change quietly degrading the normal path.

## Out of scope

`/docs` keeps its landing-page treatment. If it should ever gain the control
plane that is a separate design question about the front door, not a defect.
