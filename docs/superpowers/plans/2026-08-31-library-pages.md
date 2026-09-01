# Library Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/langgraph`, `/chat`, `/ag-ui`, `/render` into the homepage manner per `docs/superpowers/specs/2026-08-31-library-pages-design.md`: medium switchers on each first FeatureBlock, dark FinalCTA closers, package-kicker heroes with marker sweeps, WhitePaperBlock parity on /ag-ui.

**Architecture:** Next.js 16 / React 19. `buildPanes` is currently page-local in `app/page.tsx` — Task 1 extracts it to a shared module (it renders `HighlightedCode`, an async Server Component, so the shared module stays server-only TSX). `SECTION_MEDIA` in `lib/section-media.ts` is the single media config; its spec auto-validates entries (video URLs, live `featured` ids cross-checked off disk). UNLAYERED CSS; the marker/rail/dark devices all exist.

**Test command:** `cd apps/website && npx vitest run --config vite.config.mts` — baseline ALL GREEN (48/390).
**Branch:** `blove/library-pages`, expected starting HEAD `56a76a1f` or descendant.

---

### Task 1: Extract `buildPanes` to a shared module

**Files:**
- Create: `apps/website/src/lib/build-panes.tsx`
- Modify: `apps/website/src/app/page.tsx`

- [ ] **Step 1:** Move the `buildPanes` function (and ONLY it, with its doc comment) from `app/page.tsx` into `apps/website/src/lib/build-panes.tsx`, exporting it. Move the imports it needs (`ClipPlayer`, `BrowserFrame`, `HighlightedCode`, `MediumPane` type, `SectionMedia` type); adjust relative paths. `page.tsx` imports `{ buildPanes }` from `'../lib/build-panes'` and deletes its local copy + now-unused imports (check each: BrowserFrame/ClipPlayer/HighlightedCode may have no other use in page.tsx — remove only if unused).
- [ ] **Step 2:** Full suite + `npx nx build website --configuration=production` (async-server-component extraction is exactly the kind of thing only the prod build catches). Both green — paste evidence.
- [ ] **Step 3:** Commit: `git add apps/website/src && git commit -m "refactor(website): extract buildPanes for reuse by library pages"`

---

### Task 2: `SECTION_MEDIA` library entries

**Files:**
- Modify: `apps/website/src/lib/section-media.ts`
- Possibly: `apps/website/src/lib/section-media.spec.ts` (only if it pins the key set)

- [ ] **Step 1:** Read `section-media.ts` fully (types, `SolutionCodeBlocks` shape, how the four homepage entries structure `code`). Read `section-media.spec.ts` — if it asserts an exact key list, extend that list.
- [ ] **Step 2:** Add four entries. Video/live per the spec's table (`libLanggraph`: LANGGRAPH_CLIP + `tell-me-about-coral`; `libChat`: SHIP_CLIP + `tell-me-about-coral`, NO code; `libAgUi`: AG_UI_CLIP, NO live; `libRender`: RENDER_CLIP + `generative-ui-contact-form`). The `code` sources are lifted VERBATIM from each page's current static `<pre>` content: `/langgraph` page lines ~63–80 (the provideAgent/injectAgent app.config.ts block, language `ts`, label `app.config.ts`); `/ag-ui` page's app.config.ts block; `/render` page's spec→component block (read it — if it is JSON+ts, split into labeled blocks the way homepage entries do, or one block; keep it faithful). `/chat` gets no code pane (its mock is a fake UI panel, not code).
- [ ] **Step 3:** Run `section-media.spec` → PASS (it validates the new entries' clips + featured ids). Full suite green. Paste evidence.
- [ ] **Step 4:** Commit: `feat(website): section media for the library pages`

---

### Task 3: The four pages adopt the manner

**Files:**
- Modify: `apps/website/src/app/{langgraph,chat,ag-ui,render}/page.tsx`
- Create: `apps/website/src/app/{langgraph,chat,ag-ui,render}/page.spec.tsx` (four minimal specs)
- Modify: `apps/website/src/styles/pages.css` (hero kicker rails — the library hero classes live there; grep to confirm)

Per page (repeat 4×, one commit at the end):

- [ ] **Step 1: Page spec FIRST** (each fails before the page change). Template per page — adapt literals:

```tsx
// apps/website/src/app/langgraph/page.spec.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LangGraphPage from './page';

vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: vi.fn(),
  trackExternalLinkClick: vi.fn(),
  trackWhitepaperDownloadClick: vi.fn(),
}));

describe('LangGraphPage', () => {
  it('renders the package kicker, marker sweep, switcher, and dark closer', async () => {
    const ui = await LangGraphPage();
    const { container } = render(ui);
    expect(screen.getByText('@threadplane/langgraph · LangGraph adapter')).toBeTruthy();
    expect(container.querySelector('.marker-highlight')?.textContent).toBe('humans stay in the loop');
    expect(screen.getAllByRole('tablist').length).toBeGreaterThanOrEqual(1);
    const cta = [...container.querySelectorAll('[data-ui="section"]')].find((s) =>
      s.querySelector('.final-cta-inner'),
    );
    expect(cta?.getAttribute('data-surface')).toBe('dark');
  });
});
```

The pages are async server components (`buildPanes` await) after this change — hence `await LangGraphPage()`. If the current pages are sync, they become async in step 2; write the spec for the END state. Marker phrases per spec §3; kicker strings per spec §3. Run all four specs → FAIL. Paste one representative failure.

- [ ] **Step 2: Page changes** (each page):
  1. Page component becomes `async`; build panes: `const panes = await buildPanes(SECTION_MEDIA.libLanggraph, SECTION_MEDIA.libLanggraph.video?.url ?? '');` (per-page key).
  2. First FeatureBlock: `visual={<MediumSwitcher sectionId="lib-langgraph" panes={panes} />}` — the static BrowserFrame mock is DELETED from the page (its code content now lives in section-media). Remove newly unused imports (BrowserFrame, Pill where only the mock used them — check per page; heroes also use Pill, keep where used).
  3. Hero: above the `<h1>`, insert the rail kicker:
```tsx
            <div className="lib-hero-rail">
              <Eyebrow tone="accent">@threadplane/langgraph · LangGraph adapter</Eyebrow>
              <span className="lib-hero-rail-line" aria-hidden="true" />
            </div>
```
  4. Subtitle: wrap the spec §3 phrase in `<span className="marker-highlight">…</span>` (the phrase text must remain byte-identical inside the span).
  5. `<FinalCTA />` → `<FinalCTA variant="dark" />`.
  6. `/ag-ui` only: add `<WhitePaperBlock paper="overview" />` before FinalCTA + import.
  7. Second FeatureBlock, WhitePaperBlock (existing), everything else: untouched.

- [ ] **Step 3: CSS** — add once to `pages.css` (shared by all four heroes):
```css
.lib-hero-rail {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 16px;
}
.lib-hero-rail-line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}
```
Also delete each page's now-orphaned static-mock CSS (`langgraph-page-code-pre`, `chat-page-visual-*`, ag-ui/render equivalents) — grep each class after the page edits; delete only zero-consumer rules; report each deletion.

- [ ] **Step 4:** All four page specs PASS; full suite green (48+4 files); commit: `feat(website): library pages — switchers, dark closers, package kickers`

---

### Task 4: Verification gate (controller-run)

- [ ] Full suite + prod build (async pages + shared buildPanes must survive prod type-check).
- [ ] Chrome MCP at 1440px: per page — kicker rail, marker sweep visible, switcher tabs render and switch (click Code/Live on /langgraph), dark closer, /ag-ui has the paper block; at ~390px: no horizontal scroll, switcher stacks.
- [ ] Live pane iframes are lazy (only on tab select — shipped MediumSwitcher behavior; confirm no iframe requests on initial load via Chrome network).
- [ ] Commit fixes; stop. No push/PR — separate decision.

## Deviations that require stopping

- `buildPanes` extraction breaking the prod build in a way import-path fixes don't resolve.
- section-media.spec rejecting a `featured` id (would mean the curated list changed).
- Any second-FeatureBlock or WhitePaperBlock diff appearing in a page's change.
