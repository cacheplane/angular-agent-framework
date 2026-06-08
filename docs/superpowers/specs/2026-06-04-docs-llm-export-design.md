# Docs LLM Markdown Export — Design

**Date:** 2026-06-04
**Status:** Draft for review
**Scope:** Add Mintlify-style per-page LLM export to the docs — a raw-markdown route plus a `PageActions` dropdown that mounts in the page-header actions slot reserved by the docs-chrome polish (Spec 1). Mirrors the pattern built in `~/repos/dawn`.

## Goal

Let readers (and their LLMs) pull a doc page as raw markdown and jump into
ChatGPT or GitHub from any doc page. This is the **second of two** docs specs;
Spec 1 (docs chrome) reserved the `actions` slot in `DocsPageHeader` that this
control fills.

The repo already ships `/llms.txt`, `/llms-full.txt`, and a `content/prompts/`
dir — those are unchanged. This spec adds only the **per-page** experience.

## Decisions (locked during brainstorming)

- **Mirror dawn exactly.** Menu items: Copy page as Markdown, Open in ChatGPT,
  Edit on GitHub. No "Open in Claude", no "View as Markdown" link.
- **Serve raw MDX verbatim** (JSX components and all), like dawn — no MDX→md
  conversion.
- **ChatGPT link passes the page URL** (relies on ChatGPT fetching it), not the
  embedded markdown body.

## 1. Raw-markdown route

- **Create:** `apps/website/src/app/api/markdown/[library]/[section]/[slug]/route.ts`.
- `GET` handler: `await params` → call the existing
  `getDocBySlug(library, section, slug)` (from `apps/website/src/lib/docs.ts`).
  - If it returns a doc, respond `200` with the doc's `.content` (raw `.mdx`
    string, verbatim) and headers `Content-Type: text/markdown; charset=utf-8`
    and `Cache-Control: public, max-age=60, must-revalidate`.
  - If it returns `null` (unknown library/section/slug), respond `404` with a
    short plain-text body. (Reusing `getDocBySlug` gives slug validation for
    free — only real doc pages resolve, so no path-traversal handling is
    needed.)
- `export function generateStaticParams()` → map `getAllDocSlugs()` to
  `{ library, section, slug }` so the routes are statically generated, matching
  the doc page route.

URL example: `/api/markdown/langgraph/guides/streaming` →
`content/docs/langgraph/guides/streaming.mdx` verbatim.

## 2. `PageActions` dropdown component

- **Create:** `apps/website/src/components/docs/PageActions.tsx` (`'use client'`).
- Props: `{ library: string; section: string; slug: string }`.
- A kebab (⋯) trigger button (icon, `aria-haspopup="menu"`, `aria-expanded`)
  that toggles a popover `role="menu"`. Closes on outside-click (a `mousedown`
  listener like the sidebar's `LibraryDropdown`) and on `Escape`.
- Three items:
  1. **Copy page as Markdown** — `fetch('/api/markdown/<library>/<section>/<slug>')`,
     `await res.text()`, `navigator.clipboard.writeText(text)`; show a brief
     "Copied" state (2s). Fires
     `track(analyticsEvents.docsCopyCodeClick, { surface: 'docs', cta_id: 'copy_page_markdown' })`
     (reuses the existing event). On fetch/clipboard failure, fail silently
     (try/catch), matching `CopyButton`.
  2. **Open in ChatGPT** — `window.open(url, '_blank', 'noopener,noreferrer')`
     where `url = 'https://chatgpt.com/?hints=search&q=' + encodeURIComponent(prompt)`
     and `prompt = 'Read this Threadplane docs page and help me apply it to my
     project: ' + pageUrl`, `pageUrl = 'https://threadplane.ai/docs/<library>/<section>/<slug>'`.
     (`https://threadplane.ai` is `SITE_ORIGIN` from `src/lib/site-metadata.ts`.)
  3. **Edit on GitHub** — opens
     `https://github.com/cacheplane/angular-agent-framework/edit/main/apps/website/content/docs/<library>/<section>/<slug>.mdx`
     in a new tab (`noopener,noreferrer`).
- Styling: tokens-based, consistent with the existing docs components
  (`LibraryDropdown` popover treatment — surface bg, border, `shadows.md`,
  `radius`).

## 3. Mount in the reserved slot

- **Modify:** `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx` —
  pass the control into the header's reserved slot:
  ```tsx
  <DocsPageHeader
    library={library as LibraryId}
    section={section}
    actions={<PageActions library={library} section={section} slug={slug} />}
  />
  ```
- No other change to `DocsPageHeader` (the `actions` prop already exists).

## Components & implementation

- **Create:** the route + `PageActions.tsx`.
- **Modify:** the doc route page to pass `actions`.
- **Reuse:** `getDocBySlug`/`getAllDocSlugs` (`lib/docs.ts`), `SITE_ORIGIN`
  (`lib/site-metadata.ts`), `track`/`analyticsEvents` (existing), design tokens.
  No new dependencies, no new analytics event, no `llms.txt` changes.

## Testing

- **Route test** `apps/website/src/app/api/markdown/[library]/[section]/[slug]/route.spec.ts`
  (vitest, node env): a known slug (e.g. langgraph/getting-started/introduction)
  → `200`, `Content-Type` includes `text/markdown`, body contains the doc's
  first heading; an unknown slug → `404`. (Follows the existing API route-test
  pattern, e.g. `api/leads/route.spec.ts`.)
- **Component test** `PageActions.spec.tsx` (vitest, jsdom): clicking "Copy page
  as Markdown" fetches `/api/markdown/<lib>/<sec>/<slug>` and writes the response
  to the clipboard and fires `docs:copy_code_click` with `cta_id: 'copy_page_markdown'`;
  the ChatGPT and GitHub items have the exact expected hrefs/URLs. Mock `fetch`,
  `navigator.clipboard.writeText`, `window.open`, and `track`.
- **e2e** (`docs.spec.ts`, slug-page block): the page header renders the
  PageActions trigger (assert by its `aria-label`, e.g. "Page actions").

## Out of scope

- "Open in Claude", "View as Markdown" link, per-page prompts.
- Changes to `/llms.txt` or `/llms-full.txt`.
- Any visual change to `DocsPageHeader` beyond filling its existing slot.
