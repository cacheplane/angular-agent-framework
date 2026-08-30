# Docs Polish Arc Implementation Plan (Project 3)

> **For agentic workers:** This plan is executed by the controller directly with
> live browser measurement — the implement-measure-adjust loop each fix needs.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every defect in `docs/superpowers/audits/2026-08-29-docs-visual-review-findings.md` — the review that started this whole arc. Unlike Projects 1–2, these PRs **deliberately change what readers see**; each change is bounded by a measured before-state from the audit and a measured after-assertion here.

**Prerequisites (all merged):** #845 (tokens), #848–#858 (substrate). Every fix below is now a stylesheet edit.

**Verification stance:** the migration's "signature-identical to prod" gate inverts — for each defect the audit's measured *broken* value must flip to the specified *fixed* value, and surfaces a PR does not target must stay signature-identical to prod at 1280 (blast-radius check).

---

## PR 1 — structural: overflow truth, sticky rails, one nav height

Findings §1, §2, §5, §6(partial).

- [ ] **`--nav-h`** custom property on `:root` in `chrome.css`: `58px`, `81px` at `min-width: 768px` (measured nav heights). Consumers: docs shell `padding-top` (was hardcoded 80px → 22px mobile dead space), sidebar/TOC sticky `top` + `max-height`, mobile overlay `top` (`calc(var(--nav-h) - 1px)`, was 57px), and `html { scroll-padding-top: calc(var(--nav-h) + 16px) }` — which fixes every deep link landing under the nav (§5) without touching a heading.
- [ ] **Revive sticky** (§1): delete `overflow-x: hidden` from `body` (it makes `<body>` a scroll container; sticky descendants pin against it and never stick) and the `overflow-x-hidden` utility from the docs shell div. `html`'s guard **stays** — verified it propagates to the viewport without breaking sticky. Sidebar additionally needs `align-self: flex-start` + `max-height: calc(100vh - var(--nav-h))` so its own `overflow-y: auto` finally engages (it was 10,030px tall).
- [ ] **Fix the real overflow sources the guards were masking** (§2), then prove no page scrolls horizontally at 320/375/768 *with the guard gone*:
  - `<Step>` body: `min-width: 0` on `.mdx-step-body` (flex item refused to shrink; +512px on quickstarts at 320).
  - landing `.why-row__body` / hero demo box / whitepaper card: responsive max-widths.
  - blog index cards (`width: 300px` fixed) → fluid with a 300px cap.
  - about page GitHub URL → `overflow-wrap: anywhere`.
  - anything else the 320px probe finds — the probe is the authority, not this list.
- [ ] **Assertions:** at `scrollY=3000` on a docs page, sidebar and TOC `getBoundingClientRect().top === nav-h`; hash-jump to a mid-page heading lands its top ≥ nav bottom; docs shell top padding equals actual nav height at 375 and 1280; `documentElement.scrollWidth === innerWidth` on all 15 probe pages at 320 AND 375; non-targeted pages signature-identical to prod at 1280.

## PR 2 — details: breadcrumb, tables, rails, mdx

Findings §3, §4, §6(rail), §9.

- [ ] **Breadcrumb** (§3): typography moves to the `<ol>` (13px), `align-items: center`, separators become `li + li::before` (or equivalent) so they can never diverge from link size again; wrapped-row gap. Assertion: separator and link share font-size and vertical center on every crumb.
- [ ] **Tables** (§4): `min-width` on tables inside `.docs-table-scroll` so the scroller scrolls (at 375 the props table rendered `agent` as three lines in a 49px column, rows 227px tall); edge-fade affordance; `tabindex="0"` + `role="region"` + aria-label on the wrapper (keyboard reachability); same wrapper treatment for `ApiDocRenderer`/`ApiRefTable` tables. Inline `code` chips get `word-break: normal` so `@threadplane/langgraph` stops splitting into two pills.
- [ ] **One horizontal rail** (§6): breadcrumb/header wrapper, article, API block, and prev/next all share one padding scale (the 8px misalignment at <640px).
- [ ] **`<Steps>` connector**: `:last-child` kills the dangling line below the final step.
- [ ] **Dead CSS** (§9): delete the `.shiki` and `[data-rehype-pretty-code-title]` rules (zero matching elements site-wide; documented in the audit).
- [ ] **Assertions:** table wrapper `scrollWidth > clientWidth` at 375 with single-line `agent` cell; breadcrumb metrics; rail lefts equal at 375; docs pages signature vs prod shows deltas ONLY on the targeted elements.

## PR 3 — a11y + interaction

Findings §6(anchors/targets), §7.

- [ ] Shared `:focus-visible` ring (`var(--shadow-focus)`) on interactive docs chrome.
- [ ] **DocsSearch**: `role="dialog"` + `aria-modal`, focus trap + restore, `listbox`/`option` semantics, selected item scrolled into view, and a **mobile entry point** (the ⌘K trigger lives in the desktop-only sidebar).
- [ ] **Tabs/TabGroup**: `role="tablist"`/`tab`/`tabpanel`, arrow keys, horizontal scroll on narrow screens.
- [ ] **PageActions**: menu keyboard nav + item hover/focus styles.
- [ ] Heading anchors get a mobile-visible affordance (currently `display: none` below 768px — no way to deep-link from a phone).
- [ ] Touch targets ≥44px (PageActions 32px, code-copy 28px) via hit-area padding, not visual growth.
- [ ] `prefers-reduced-motion` guards `scroll-behavior: smooth`.
- [ ] **Assertions:** axe-style manual checks per control; targets measured ≥44; keyboard walkthrough of search + tabs + menu.

## Deferred, explicitly

- **Font unification onto next/font** (findings §10): a real sitewide visual change; needs its own decision.
- **Toast width on small screens**; **`AnnouncementToast` focus management** — candidates for a later pass.
