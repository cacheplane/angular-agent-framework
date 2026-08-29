# Inline-style substrate migration — design

**Date:** 2026-08-29
**Status:** Proposed. Project 2 of a three-project arc.
**Depends on:** Project 1, merged as #845 (`6c0685b7`).

## Where this sits

A visual review of the docs site found defects that cannot be *written* as
fixes, because the components style themselves with inline `style={{}}` objects
and inline styles cannot express `:focus-visible`, `:hover`, `:last-child`, or a
media query. The arc:

1. **Token CSS-var completion** — merged (#845). Every token now has a CSS
   counterpart, machine-checked.
2. **Substrate migration** — this document.
3. **The polish arc** — three PRs against
   `audits/2026-08-29-docs-visual-review-findings.md`.

## Correction to a number carried in Project 1

Project 1's spec, plan, and PR body all say **802** inline style objects. That
count came from `grep -c 'style={{'`, which sees only object literals written
at the call site. It misses components that build a `CSSProperties` object in a
variable and pass `style={someStyle}` — `Button.tsx` does exactly this, and was
miscounted as already migrated.

Measured properly:

| shape | sites |
|---|---:|
| `style={{ … }}` object literal | 802 |
| `style={namedVariable}` | 106 |
| **total** | **908** |

The 1,188 token-reference figure is **unaffected** — it was counted from
`tokens.*` occurrences directly, not derived from style sites.

The 106 are concentrated in three files (`app/docs/page.tsx` 33,
`app/docs/licensing/page.tsx` 26, `app/about/page.tsx` 14) and are the *easier*
shape: one object reused across many elements is already rule-shaped. They
convert to a single CSS rule, not N.

## Problem

908 style-prop sites across ~90 files. Beyond blocking the polish work, the
inline substrate causes real defects today — the comment on `[data-ui="card"]`
in `global.css` records one: inline styles beat any stylesheet `:hover` rule, so
the card's hover lift rendered only the transform until its resting styles were
moved into CSS.

## Goal

Presentation lives in CSS. Components keep structure, semantics, and genuinely
dynamic values. The polish fixes in Project 3 become one-liners.

## Non-goals

- **No visual change.** Any pixel that moves is a bug, not an improvement.
  Restyling opportunities spotted along the way get logged, not taken.
- **No fix from the findings audit.** That is Project 3, deliberately, so that
  a migration diff never mixes with a behaviour diff.
- **No component API changes.** Props stay as they are.
- **No dark theme.**

## Design

### 1. Extend the pattern that already exists

This is not a new convention. The codebase already ships **21 `data-*` style
hooks**:

```
data-ui="button|card|container|section|eyebrow|pill|faq|faq-item|faq-chevron
         |logo-mark|browser-frame|browser-frame-body|ecosystem-tile"
data-mdx="callout|card|feature-chip"
data-docs-navlink
modifiers: data-surface, data-accent, data-hoverable
```

Nine of the eleven `components/ui` primitives already emit one. The migration
finishes a job that is partly done, rather than importing CSS Modules and
running two competing conventions through a long migration.

`page.module.css` — an empty, unused stub — is deleted as part of batch 1, so
there is exactly one answer to "where does styling live".

**Rules for what stays inline.** A reviewer should reject a batch that moves
these into CSS:

- A value computed from props or state that is not a bounded set
  (`width: `${pct}%``, a measured offset).
- A value bounded to a few options becomes a `data-*` modifier and moves to CSS
  (`data-variant="primary"`), because that is what `Button`'s three variants
  and two sizes are.
- CSS custom properties set on an element to parameterise a rule
  (`style={{ '--row-count': n }}`) are the preferred escape hatch when a value
  is dynamic but its *use* is presentational.

### 2. CSS file layout

`global.css` becomes an index. It is 329 lines today; 908 migrated sites in one
file would push it past 3,000 and make every batch conflict with every other.

```
src/app/global.css          @import the rest; keeps preflight + base element rules
src/styles/ui.css           data-ui primitives
src/styles/chrome.css       Nav, Footer, AnnouncementToast
src/styles/docs.css         docs chrome + the .docs-prose rules moved out of global.css
src/styles/landing.css      landing blocks
src/styles/marketing.css    pricing, blog, contact, solutions
src/styles/pages.css        app/** route-level styling
```

One batch, one file — so batches do not conflict, and a batch can be reverted
by reverting one file plus its components.

### 3. Batches

Ordered so that dependencies migrate before their consumers.

| # | scope | sites | files | note |
|---|---|---:|---:|---|
| 1 | `components/ui` | 25 | 11 | primitives; 9 already have hooks; delete `page.module.css` |
| 2 | `components/shared` | 73 | 3 | Nav, Footer, AnnouncementToast |
| 3 | `components/docs` | 168 | 22 | unblocks Project 3 |
| 4 | `components/landing` | 159 | 17 | |
| 5 | pricing + blog + contact + solutions | 114 | 15 | |
| 6 | `app/**` routes | 263 | 23 | includes 73 of the 106 variable-shaped sites |

Each batch is its own PR. Batch 1 is deliberately small and lands first as the
pattern-setter; its review establishes what the remaining five look like.

### 4. Guarding the swap

**Decision: no visual-regression harness.** Screenshot baselines and
computed-style suites were both considered and declined on cost. This is a real
accepted risk and is recorded as such: a subtle regression on a
rarely-viewed page can ship unnoticed, and the website's vitest suite is
already 5-failures red with no `nx test` target running it in CI.

Two cheap mitigations that are *not* a harness:

**A per-batch value-equality check.** Most of the 908 sites are static objects
whose values come from `tokens.*`. A batch script extracts every
`property: value` pair removed from TSX and every pair added to CSS, resolves
`tokens.X.Y` and `var(--z)` to their common value via the Project 1 parity map,
and reports any pair whose value changed. This is text-level, runs in seconds,
and catches the dominant failure mode — a mistyped or mismapped value. It does
not catch specificity, cascade, or layout changes; nothing here does.

**A one-page spot check per batch.** For each batch, one representative page is
opened and the migrated components' computed styles are compared to the same
page on `main`. Manual, ~10 minutes, catches cascade mistakes the text check
cannot.

If a regression does slip through, the fix is to revert that batch's file — the
reason batches map 1:1 to CSS files.

### 5. The ESLint rule, last

After batch 6, a rule that reports a `style` JSX attribute whose value is an
object expression with only literal/`tokens.*` members. Dynamic values pass.
Landing it before batch 6 would mean 900 suppressions; landing it after means
it only ever sees new code.

Ships as `warn` for one release, then `error`.

## Amendments from planning (2026-08-29)

Facts found while writing the implementation plan
(`plans/2026-08-29-inline-style-substrate-migration.md`), which supersede the
corresponding text above:

- **A third substrate exists.** 12 components embed a `<style>{`…`}</style>`
  tag interpolating `${tokens.*}` (10 in landing, 2 in docs), one element per
  component instance. They migrate in Batches 3–4: CSS text moves verbatim
  into the batch file with interpolations replaced by `var(--*)`.
- **Exclusions.** `app/opengraph-image.tsx` and `app/blog/[slug]/opengraph-image.tsx`
  (14 sites) render through Satori, where inline styles are the only mechanism —
  migrating them breaks OG images. `app/dev/primitives/page.tsx` (17 sites) is a
  dev-only route documented as slated for deletion. In-scope is therefore
  **~877 style-prop sites + 12 `<style>` tags across 88 files**, not 908.
- **Batch 6 splits into 6a (docs-adjacent pages, ~115 sites) and 6b (remaining
  routes, ~192)** — measured, `app/**` was too large for one review. The arc is
  seven migration PRs plus the ESLint PR, not six.
- **33 JS hover handlers** (`onMouseEnter` presentation writes — 23 in Footer
  alone) convert to `:hover` rules as part of their component's batch.

## Risks

- **Cascade and specificity.** Inline styles have the highest specificity; CSS
  rules do not. A value that silently won as inline may lose to an existing
  rule once moved. This is the failure mode the text-level check cannot see and
  the spot check exists for.
- **Tailwind utility collision.** Many components carry both `className`
  utilities and inline styles. Moving a property into a rule can put it in
  conflict with a utility on the same element.
  **Resolved at planning (2026-08-29), reversing this section's first guess:**
  migrated rules are **unlayered**, like the existing `global.css` rules.
  Tailwind v4 layers everything (`@layer theme, base, components, utilities`),
  and unlayered author CSS beats all layers — which is the precedence inline
  styles had. `@layer components` would invert the winner and change rendering;
  unlayered preserves it. Verified against `node_modules/tailwindcss/index.css`.
- **Six PRs of pure refactor** with no user-visible payoff, before Project 3
  delivers anything a reader sees. That was accepted when the arc was ordered.
- **`app/**` at 263 sites is the largest batch** and may need splitting once
  batch 5 has calibrated the real per-site cost.
