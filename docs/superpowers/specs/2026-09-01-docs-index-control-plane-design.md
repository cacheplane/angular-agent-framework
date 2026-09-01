# Aligning the docs index with the control plane

**Date:** 2026-09-01
**Scope:** `/docs`, and the `Render` / `json-render` naming split
**Status:** approved, ready to implement

## Context

After #920, `/docs` is the only `/docs/*` route without the control plane. That
was a deliberate call at the time — it is a designed landing page, and forcing
its 2-up card grids into the prose column would flatten it. In review the
inconsistency was judged worse than that risk, so the page adopts the shell.

## Design

### The shell, without the prose measure

`/docs` renders `docs-shell-page` with `<DocsControlPlane activeLibrary={null}>`,
reusing the library-neutral state added in #920.

The landing content goes inside `docs-shell-body` but **not** inside the
`md:max-w-3xl` article measure the `[slug]` route uses. Its `Section`/`Container`
structure keeps its own width. The chrome becomes consistent; the layout does
not get squeezed.

Scope reads `Docs / Overview`. Passing the page title verbatim would render
`Docs / Documentation`, which is redundant.

`Nav` resolves the drawer's title independently of the page, so setting this on
the page alone made the desktop say `Docs / Overview` while the mobile drawer
said `Docs / Documentation` — the same page named two ways by viewport width.
Both now read a shared `DOCS_INDEX_TITLE` constant so they cannot drift.

### The picker stays, deliberately

The page's main content *is* a backend picker, so the sidebar picker is
arguably duplicative — the same class of problem removed in #911, where the
library was stated twice.

Kept anyway, because the two do different jobs: the cards are a decision aid
(compare, copy the install line, follow the quickstart), the picker is a
shortcut for a returning reader who already knows where they are going. The
#911 duplication was two *statements of the same fact*; this is a statement and
a shortcut.

### `Render` → `json-render`

The library is called `json-render` 85 times across docs content and on the
marketing page, and on the `/docs` card. It is called `Render` in exactly one
place: `docsConfig[].title`, which feeds the picker, breadcrumbs, structured
data and search.

Once the index has the control plane, both names appear on screen at once — the
sidebar saying `Render`, the card saying `json-render`.

`docsConfig` title becomes `json-render`. The package stays
`@threadplane/render` and the URL stays `/docs/render/`; only the display label
changes. Marketing surfaces (`/render`, the footer, `solutions-data`) keep
`Render` — those describe the product page, a different context, and are not
part of this alignment.

### Test hygiene

`e2e/website.spec.ts` → `'docs landing page shows library cards'` asserts
`getByText('Render')`, which passes on a substring of `json-render` and would
also pass on the new sidebar. It is tightened to assert the cards themselves.

## Testing

1. **The index renders the control plane** with a library-neutral Scope of
   `Docs / Overview` and a `Choose a library` picker.
2. **The picker reads `json-render`**, not `Render`.
3. **The landing content keeps its width** — it is not inside the article
   measure.
4. **The drawer and the page agree on the index's name.**

Each guard was mutation-tested. The naming test initially passed against a
reverted `docsConfig` — `getAllByText` is exact-match and the picker menu is
closed on mount, so it only ever saw the index card. It now opens the menu
first.

## Out of scope

Marketing surfaces keep `Render`. Renaming those is a product-vocabulary
decision about the `/render` page, not about docs consistency.
