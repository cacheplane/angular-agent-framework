# Docs visual review — findings

**Date:** 2026-08-29
**Status:** Findings captured. Fixes deferred to Project 3 of the substrate arc
(see `2026-08-29-design-token-css-var-completion-design.md` for the decomposition).

This is the evidence log for a visual/usability review of the docs site. Every
item below was measured against a live dev server at 1280px, 768px, 375px, and
320px — not read off the source. Numbers are reproducible with the probe
described at the end.

The fixes are **not** in this document's scope. They land after the token work
and the substrate migration, because roughly half of them (focus rings,
`:last-child`, media queries) cannot be expressed in the inline `style={{}}`
objects the components use today.

---

## 1. `position: sticky` is dead site-wide

The docs sidebar and the "On this page" TOC are both written as sticky rails.
Neither has ever stuck.

At `scrollY = 3000` on `/docs/chat/components/chat` (1280×800):

| element | `getBoundingClientRect().top` | expected |
|---|---|---|
| `DocsSidebar` | `-2920` | `80` |
| `DocsTOC` | `-2840` | `80` |

Both scroll entirely off-screen. The reader loses navigation and the page
outline the moment they start reading.

**Cause — two independent scroll containers, both must be removed:**

1. `body { overflow-x: hidden }` — [`global.css:18`](../../../apps/website/src/app/global.css). When `html`
   *and* `body` both set `overflow-x`, `html`'s value propagates to the viewport
   and `body` keeps its own, which makes `<body>` a scroll container. Sticky
   descendants then position against `<body>`, which never scrolls.
2. `overflow-x-hidden` on the docs shell —
   [`page.tsx:98`](../../../apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx).
   Same mechanism, one level down.

Verified by elimination: clearing **both** at runtime pins both rails at
`top: 80` and holds it at `scrollY = 3000` and `5000`. Clearing only one leaves
them broken. `html { overflow-x: hidden }` alone does *not* break sticky —
`html`'s value propagates to the viewport and `html` itself computes to
`visible` — but this needs re-verification at implementation time rather than
being taken on faith.

**Secondary defect.** `DocsSidebar` is `height: 10030px` — it stretches to the
article's full height because the parent flex row defaults to
`align-items: stretch` and the aside sets no `align-self`. Its
`overflow-y: auto` therefore never engages (`scrollHeight === clientHeight`).
Needs `align-self: flex-start` plus a `max-height` before the sticky fix has any
useful effect on long library sidebars.

## 2. The `overflow-x` guards are masking real overflow

They cannot simply be deleted. With both guards disabled, five pages overflow
the viewport for real:

| page | viewport | actual `scrollWidth` | culprit |
|---|---|---|---|
| `/docs/langgraph/getting-started/quickstart` | 768 | **864** (+96) | `<Step>` body |
| same | 320 | **832** (+512) | same |
| `/docs/ag-ui/getting-started/quickstart` | 320 | 740 (+420) | same |
| `/`, `/pilot-to-prod`, `/solutions` | 375 | 421 (+46) | `.wp-grid` "Field report" card, fixed `392px` |
| `/` | 320 | 421 (+101) | `.why-row__body` + hero `demo.threadplane.ai` box |
| `/blog` | 320 | 324 (+4) | post cards, hard-coded `width: 300px` |
| `/about` | 320 | 329 (+9) | unbroken GitHub URL in an `<a>` |

**The `<Step>` culprit, precisely.** Ancestor chain measured at a 768px
viewport, walking down from `.docs-prose`:

```
DIV  w=672  display:flex  min-width:0px    ← Steps wrapper, correctly constrained
DIV  w=672  display:flex  min-width:auto   ← Step row
DIV  w=772  display:block flex:1 1 0%  min-width:auto   ← Step body: OVERFLOWS
```

[`Steps.tsx`](../../../apps/website/src/components/docs/mdx/Steps.tsx) sets
`style={{ flex: 1, paddingBottom: 8 }}` on the step body. `flex: 1` leaves
`min-width: auto`, so the item refuses to shrink below its content's min-content
width and blows 100px past its 672px container. Fix is `min-width: 0` on the
flex item.

Docs pages are otherwise clean at 320px. A sweep found 300 elements exceeding
the viewport on `/docs/chat/components/chat`, and **all 300 are shiki token
spans inside `<pre>`** — correctly contained by their own `overflow-x: auto`
scrollers, not page-level overflow. `documentElement.scrollWidth` stayed at
320.

## 3. Breadcrumb vertical alignment

In [`DocsBreadcrumb.tsx`](../../../apps/website/src/components/docs/DocsBreadcrumb.tsx)
the `crumb` style object is applied to the `<a>`, not to the `<li>` — but the
`/` separator `<span>` is a sibling of the link, inside the `<li>`. The first
two crumbs therefore leave both the `<li>` and the separator inheriting body
typography.

Measured on `/docs/chat/components/chat`:

| crumb | `li` font-size | separator font-size | separator `top` | link `top` |
|---|---|---|---|---|
| Docs | **16px** / 24px | **16px** | 106 | 109 |
| Chat | **16px** / 24px | **16px** | 106 | 109 |
| Components | 13px / 19.5px | 13px | 106 | — |
| ChatComponent | 13px / 19.5px | — | — | — |

Two visible defects: the first two separators render **3px larger** than the
third, and every separator sits **3px above** the link text beside it. The
`<ol>` computes `align-items: normal`, so nothing re-centers them.

## 4. Tables do not scroll, and are unreadable on mobile

`.docs-table-scroll` exists and sets `overflow-x: auto`, but
`.docs-prose table { width: 100% }` with no `min-width` means the table always
fits its container. Measured at 375px on the `ChatComponent` inputs table:

```
wrapper:  width 343  scrollWidth 343  clientWidth 343   ← never scrolls
table:    width 343
columns:  49px | 81px | 75px | 138px
first row height: 227px     tallest cell: 290px
```

The rendered result: `agent` breaks across three lines as `ag` / `en` / `t`, the
`INPUT` header becomes `INP` / `UT`, and `undefined` becomes `undefi` / `ned`. A
single props row is taller than half a phone screen.

Related: `ApiDocRenderer` and `ApiRefTable` render tables with **no scroll
wrapper at all**.

Related: `.docs-prose { word-break: break-word }` splits inline `code` chips
mid-token — `@threadplane/langgraph` renders as two separately-backgrounded
pills reading `@threadplane/lan` and `ggraph`.

## 5. Every deep link lands under the fixed nav

There is no `scroll-margin-top` or `scroll-padding-top` anywhere in the
codebase — `grep` across `apps/website/src` returns nothing.

Jumping to `#message-templates` on `/docs/chat/components/chat`:

```
heading top:  0
nav bottom:  81
```

The heading and roughly 45px of following body text sit behind the fixed nav.
This affects every TOC click, every heading-anchor click, and every shared
anchor URL.

## 6. Mobile layout defects

Measured at 375×812 on `/docs/chat/components/chat`:

- **22px of dead space.** Nav height is `58px`; the docs shell hard-codes
  `paddingTop: 80`. The 80 matches desktop (`81px`), not mobile.
- **8px rail misalignment.** The breadcrumb and page-header wrapper use
  `px-6` (`left: 24`); the `<article>` uses `px-4 sm:px-6 md:px-12`
  (`left: 16`). The H1 and all body copy sit 8px left of the breadcrumb above
  them, on every docs page below 640px. The API block and prev/next use a third
  value.
- **Heading anchors are `display: none`** below 768px
  ([`global.css:321`](../../../apps/website/src/app/global.css)), so there is no
  way to copy a deep link from a phone.
- **Touch targets below 44px:** `PageActions` trigger is 32×32; the code-block
  copy button is 28×28.
- The `AnnouncementToast` is `width: calc(100vw - 48px)` capped at 360 — 327px
  of a 375px screen.

## 7. Component detail and accessibility

- **`<Steps>` draws its connector below the last step.** The vertical rule is
  rendered unconditionally per step, so the final step trails a dangling line.
  Needs `:last-child`, which inline styles cannot express.
- **`<Tabs>` has no tab semantics** — no `role="tablist"` / `role="tab"` /
  `role="tabpanel"`, no `aria-selected`, no arrow-key navigation, and the tab
  bar does not scroll horizontally when labels overflow a narrow screen.
- **`DocsSearch`** is ⌘K-only with no mobile entry point (the trigger lives in
  the desktop-only sidebar). The overlay has no `role="dialog"`,
  no `aria-modal`, no focus trap, no focus restoration, no `listbox`/`option`
  roles, and the keyboard-selected result is not scrolled into view.
- **`PageActions`** menu has no roving focus or arrow-key navigation, and its
  items have no hover or focus styling.
- **Code blocks scroll but advertise nothing.** 11 of them on the
  `ChatComponent` page have `scrollWidth > clientWidth` at 375px with no edge
  fade or other affordance. Scrollable regions are also not keyboard-focusable
  (WCAG 2.1.1).
- **No `prefers-reduced-motion` guard on `html { scroll-behavior: smooth }`.**

## 8. Token drift already present in `global.css`

`global.css` hardcodes values from the stale `--ds-*` surface that disagree with
the live `light.ts` tokens:

| literal | occurrences | live token | live value |
|---|---|---|---|
| `#555770` | 4 (lines 139, 170, 195, 196) | `--color-text-secondary` | `rgb(70, 70, 70)` |
| `#8b8fa3` | 1 (line 100) | `--color-text-muted` | `rgb(115, 115, 115)` |
| `#004090` | 1 (line 115) | `--color-accent` | same value |
| `rgba(0, 64, 144, 0.06)` | 1 (line 114) | `--color-accent-surface` | same value |
| `rgba(0, 64, 144, 0.15)` | 1 (line 195) | `--color-accent-border` | same value |

The first two are genuine colour drift, not just un-tokenised literals: docs
table text and code-block titles render in a blue-grey that no current token
produces. Resolving these is Project 1 scope, and it is a **visible** change,
not a refactor.

## 9. Two rules in `global.css` are dead CSS

Found while verifying the token work on 2026-08-29, not during the original
review. Measured on `/docs/langgraph/getting-started/quickstart` and
`/blog/langgraph-subgraphs-when-to-split`:

```
.shiki elements:                        0
[data-rehype-pretty-code-title] elements: 0
[data-rehype-pretty-code-figure]:         5
```

Both selectors match nothing, on docs **and** blog:

- **`.shiki`** (`global.css:56-65`) — `rehype-pretty-code` is configured with
  `keepBackground: true`, so it writes the theme background as an *inline
  style* on the `<pre>` (`style="background-color:#1a1b26;color:#a9b1d6"`)
  rather than emitting a `.shiki` class. The inline style is where the code
  background actually comes from.
- **`[data-rehype-pretty-code-title]`** (`global.css:97-109`, plus the
  `:has()` companion rule) — no code fence in `content/docs` or `content/blog`
  uses the `title=` meta, so the element is never generated.

Consequences worth knowing:

- The sibling rule `.docs-prose [data-rehype-pretty-code-figure] pre` **is**
  live — verified, its border computes to `rgba(0, 0, 0, 0.1)` and its shadow
  to `rgba(0, 0, 0, 0.08) 0px 2px 12px`.
- This narrows the visible surface of the token adoption: changing the
  code-title colour from `#8b8fa3` to `var(--color-text-muted)` is correct but
  renders nowhere today.

**Not fixed here.** Deleting dead rules is a cleanup, not a literal audit, and
the `.shiki` rule would become live again if `keepBackground` were turned off.
It belongs in the polish arc alongside the rest of the docs CSS work.

---

## Reproducing

The measurements above came from a headless probe run against
`nx serve website`. Scripts were written to `tmp/probe/` (gitignored) and are
not committed; the method is:

1. Inject `html, body { overflow-x: visible !important }` and
   `[class*="overflow-x-hidden"] { overflow-x: visible !important }` to unmask
   real overflow.
2. Compare `document.documentElement.scrollWidth` against `innerWidth` —
   that, not per-element rects, is the authority on page overflow.
3. For offenders, collect elements whose `right > innerWidth`, filter out any
   with a `pre` / `.docs-table-scroll` / `.shiki` ancestor (correctly
   contained), then keep only those with no offending child to find the leaf.
4. For sticky, read `getBoundingClientRect().top` after `window.scrollTo` at
   two different offsets — a sticky element reports the same `top` at both.

Both the overflow assertion and the sticky assertion **fail silently if written
wrong** (an empty offender list and an off-screen `top` both look like a pass
under a careless predicate). Any regression test built from this must be
mutation-tested — break the fix, confirm the test goes red — before it is
trusted. See `feedback_tests_that_pass_vacuously`.
