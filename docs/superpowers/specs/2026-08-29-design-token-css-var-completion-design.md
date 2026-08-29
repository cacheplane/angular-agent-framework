# Design token CSS-var completion — design

**Date:** 2026-08-29
**Status:** Proposed. Project 1 of a three-project arc.

## Where this sits

A visual review of the docs site (`audits/2026-08-29-docs-visual-review-findings.md`)
turned up a set of real defects — dead sticky rails, tables that render `agent`
as `ag`/`en`/`t` on a phone, deep links landing behind the fixed nav. Roughly
half of the fixes cannot be written, because the components style themselves
with inline `style={{}}` objects and inline styles cannot express
`:focus-visible`, `:hover`, `:last-child`, or a media query.

The decision was to migrate the site off inline styles first, site-wide, and
then apply the polish. That splits into three projects:

1. **Token CSS-var completion** — this document. Make every token the site uses
   reachable from CSS.
2. **Substrate migration** — 802 inline style objects across 90 files, in
   reviewable batches, ending with an ESLint rule.
3. **The polish arc** — three PRs against the findings audit.

Project 2 is blocked on this one: 29% of the site's token references have no CSS
counterpart to migrate *to*.

## Problem

The website reads design tokens two ways that are supposed to agree.

- **From JS** — `import { tokens } from '@threadplane/design-tokens'`, then
  `tokens.colors.accent` inside a `style={{}}` object. 1,188 such references.
- **From CSS** — `var(--color-accent)`, from the generated `theme.css` that
  `global.css` imports.

Both derive from `light.ts`, so where a var exists the values are identical *by
construction* — a JS-to-CSS swap is provably value-preserving. That is what
makes Project 2 tractable at all.

But `theme.css` only emits colors, font families, radii, and shadows.
[`generate-theme-css.ts`](../../../libs/design-tokens/scripts/generate-theme-css.ts)
never learned about the **type scale** or the **space scale**, so a large slice
of the site's styling has nowhere to go:

| token group | refs | reachable from CSS today |
|---|---:|---|
| `colors.*` | 512 | ✅ `--color-*` |
| `surfaces.*` | 175 | ✅ `--color-*` |
| `typography.fontSans/Mono/Serif` | 86 | ✅ `--font-*` |
| `radius.*` | 48 | ✅ `--radius-*` |
| `shadows.*` | 24 | ✅ `--shadow-*` |
| composite `.family` (h1/h2/h3/eyebrow/bodyLg/body/caption) | 122 | ✅ — the JS value is *already* `var(--font-garamond)` etc. |
| `eyebrow.transform` | 4 | ✅ — plain `text-transform`, needs no var |
| **type scale** `.size` / `.line` / `.weight` / `.letterSpacing` | **210** | ❌ |
| **`space.*`** | **7** | ❌ |
| | **1,188** | **217 unreachable** |

Separately, `global.css` hardcodes colour literals, two of which are stale
values from a third token surface and **no longer match any live token**:

| literal | uses | live token | live value |
|---|---:|---|---|
| `#555770` | 4 | `--color-text-secondary` | `rgb(70, 70, 70)` |
| `#8b8fa3` | 1 | `--color-text-muted` | `rgb(115, 115, 115)` |

Docs table text and code-block titles therefore render in a blue-grey the design
system stopped producing. Migrating around that drift would bake it in
permanently.

## Goal

Every token the website consumes is reachable from CSS at a value identical to
its JS counterpart, and that identity is machine-checked rather than asserted.

## Non-goals

- **Migrating any component.** No `style={{}}` is touched. That is Project 2.
- **Any fix from the findings audit.** That is Project 3.
- **Dark theme.** `darkOverrides` exists and `cssVars('dark')` resolves it, but
  the website is light-only and stays so here.
- **Rewiring cockpit examples.** See "The third surface" below — real, adjacent,
  out of scope.
- **Growing the token API for one-off tints.** See "Literals that are not
  tokens".

## Design

### 1. Emit the type scale as Tailwind v4 composite text tokens

Tailwind v4 lets one `@theme` entry carry a whole type step:

```css
--text-h1: clamp(48px, 6vw, 72px);
--text-h1--line-height: 1.08;
```

`--text-{name}` also accepts `--line-height`, `--font-weight`, and
`--letter-spacing` sub-keys, which is an exact structural match for the
composite token shape in `typography.ts`. A single `text-h1` utility then sets
size, leading, weight, and tracking together — so the migration in Project 2
collapses four inline properties into one class, not four `var()` calls.

Seven steps, generated from `baseTokens.typography`:

| token | `--text-*` | line-height | other |
|---|---|---|---|
| `h1` | `--text-h1` | 1.08 | |
| `h2` | `--text-h2` | 1.12 | |
| `h3` | `--text-h3` | 1.25 | `--font-weight: 600` |
| `eyebrow` | `--text-eyebrow` | 1.4 | `--font-weight: 700`, `--letter-spacing: 0.12em` |
| `bodyLg` | `--text-body-lg` | 1.6 | |
| `body` | `--text-body` | 1.6 | |
| `caption` | `--text-caption` | 1.5 | |

**What deliberately gets no var.** `family` and `transform` are excluded, and a
reviewer should reject a version that adds them:

- Every `.family` value is *already* `var(--font-garamond)` / `var(--font-inter)`
  / `var(--font-mono)`. Those vars exist. Emitting `--text-h1--font-family`
  would be a second name for a thing that already has one, and Tailwind's
  `--text-*` bundle does not support it anyway.
- `eyebrow.transform` is `uppercase` — a plain `text-transform` declaration.
  A var indirecting a keyword buys nothing.

These two exclusions are why 336 composite references reduce to 210 needing new
vars.

`@theme` is additive in Tailwind v4, so these sit alongside the built-in
`--text-xs … --text-9xl` without collision. No namespace reset.

### 2. Emit the space scale

```css
--spacing-section-y: clamp(64px, 8vw, 120px);
--spacing-section-y-tight: clamp(48px, 6vw, 80px);
--spacing-container-x: clamp(20px, 4vw, 40px);
--container-page: 1200px;
```

`containerMax` goes to the `--container-*` namespace rather than `--spacing-*`
because it is a max-width, not a spacing step; that namespace generates the
`max-w-container-page` utility the marketing `Container` primitive wants.

Seven references, four vars. Small, but it is the difference between `Section`
and `Container` being migratable in Project 2 and not.

### 3. Resolve the hardcoded literals in `global.css`

Three categories, three different answers. The categorisation is the actual
work here; the edits are trivial.

**Genuine drift — adopt the live token, accept a visible change.**
Only three of the five stale-literal uses actually render stale. Two are
already `var(--color-text-muted, #555770)` — on `li::marker` (line 139) and
`figcaption` (line 170) — where the var *is* defined, so the fallback is dead
text and deleting it changes nothing. The visible set is exactly:

| line | rule | now | becomes |
|---|---|---|---|
| 195 | `.docs-prose th` | `#555770` | `var(--color-text-muted)` |
| 196 | `.docs-prose td` | `#555770` | `var(--color-text-secondary)` |
| 100 | `[data-rehype-pretty-code-title]` | `#8b8fa3` | `var(--color-text-muted)` |

`th` and `td` deliberately diverge rather than both taking one token: `td` is
body content and should match `--tw-prose-body` (which `MdxRenderer` already
sets to `colors.textSecondary`), while `th` is an uppercase mono label and
belongs with the other muted labels, like the TOC heading.

This is a **visible design change, not a refactor** — it needs before/after
screenshots at review, and it is the one part of this project that could
reasonably be rejected on taste. If it is rejected, the correct outcome is a new
token, not a retained literal.

**Already-matching literals — swap, no visual change.**
`#004090` → `var(--color-accent)`, `rgba(0, 64, 144, 0.06)` →
`var(--color-accent-surface)`, `rgba(0, 64, 144, 0.15)` →
`var(--color-accent-border)`. Byte-identical output; a screenshot diff must show
nothing.

**Literals that are not tokens — keep local, name them.** Three sets do not
belong in the design system and must not be promoted into it:

- `#1a1b26` (×2), `rgba(0, 0, 0, 0.08 / 0.1)` and `rgba(255, 255, 255, 0.06)`
  are all code-figure chrome — the tokyo-night background plus the border and
  shadow tuned against it. They are coupled to `rehypeOptions.theme` in
  `MdxRenderer`, so they become a local `--docs-code-bg` / `--docs-code-border`
  / `--docs-code-shadow` group in `global.css`, commented with that coupling.
  Promoting them to the token package would imply the design system owns the
  syntax theme. It does not.
- `rgba(0, 32, 72, 0.08 / 0.1)` are figure-shadow tints → local
  `--docs-figure-shadow`.
- `rgba(0, 64, 144, 0.035 / 0.08 / 0.1)` are accent tints that fall between
  `--color-accent-surface` (0.06) and `--color-accent-border` (0.15). Rather
  than invent three tokens for three call sites, derive them:
  `color-mix(in srgb, var(--color-accent) 3.5%, transparent)`. They then track
  the accent automatically. **Open question for review:** `color-mix` is
  baseline across current browsers but this is the only use in the codebase; if
  that is unwanted, three local `--docs-accent-tint-*` vars are the fallback.

### 4. The third surface

`libs/design-tokens/src/lib/tokens.css` defines a `--ds-*` set whose values have
drifted from `light.ts` — `--ds-text-secondary: #555770` against
`rgb(70, 70, 70)`. It is where the `global.css` drift above came from.

Measured state: **zero importers.** It is not in the package `exports` map
(only `.` and `./theme.css` are), and nothing in the repo imports it. Forty-five
cockpit and example files reference `--ds-*` properties, but every one supplies
a fallback — `var(--ds-canvas, #111)` — so those apps are rendering on their
fallbacks today and have been all along.

**Decision: bring `tokens.css` under the generator**, emitting `--ds-*` from
`light.ts` so the third surface can no longer disagree with the first two. Not
deletion: the file records an intent (a plain-CSS token drop for non-Tailwind
consumers) that the cockpit apps clearly still want, and deleting it silently
blesses 45 files running on fallback colours.

Actually wiring those cockpit apps to import it is **out of scope** and wants
its own ticket — it is a visual change to nine example apps, unrelated to the
website.

### 5. Machine-check the parity

This is the load-bearing deliverable. Project 2 rewrites 1,188 call sites on the
premise that `tokens.X.Y` and its CSS var hold the same value. That premise
should be a test, not a belief.

A new spec in `libs/design-tokens`:

- Walks the `tokens` object.
- For every leaf with a designated CSS-var counterpart, asserts the value in
  `theme.css` is string-identical.
- Asserts every leaf either has a counterpart or is on an explicit, commented
  exclusion list (`.family`, `.transform`, `light`, `dark`).

The exclusion list is the point — it is what stops a future token being added
with no CSS var and nobody noticing until Project 2 hits it.

The existing `generate-theme-css.spec.ts` drift guard (re-runs the generator,
diffs against the committed file) already covers staleness and needs no change
beyond the new output.

## Files

| file | change |
|---|---|
| `libs/design-tokens/scripts/generate-theme-css.ts` | emit type scale + space scale; emit `tokens.css` |
| `libs/design-tokens/src/lib/theme.css` | regenerated |
| `libs/design-tokens/src/lib/tokens.css` | regenerated from `light.ts` |
| `libs/design-tokens/src/lib/token-css-parity.spec.ts` | new — JS↔CSS value parity |
| `libs/design-tokens/src/lib/ds-var-contract.spec.ts` | new — `--ds-*` name stability |
| `libs/design-tokens/src/lib/generate-theme-css.spec.ts` | extend to cover `tokens.css` |
| `libs/design-tokens/package.json` | export `./tokens.css` |
| `libs/design-tokens/project.json` | ship `tokens.css` in the build assets |
| `apps/website/src/app/global.css` | literal audit — 18 literals, 3 categories |

Nine files. No component touched.

The two new specs stay separate because they guard different contracts —
value parity between JS and CSS, versus stability of the `--ds-*` names
cockpit apps reference — and each should be able to fail with a clear,
unambiguous message.

## Verification

- `nx test design-tokens` — parity spec and both drift guards.
- `cd apps/website && npx vitest run --config vite.config.mts` — the website has
  **no `nx test` target**; `nx test website` fails and 20+ specs silently stopped
  running once before. Use the direct invocation.
- `nx build website --configuration=production` before claiming deploy-ready —
  the prod bundle-budget and env wiring differ from dev.
- Screenshot diff on `/docs/chat/components/chat`, `/docs`, and `/` at 1280 and
  375. Expected: **no change anywhere except** docs table header text, docs
  table body text, and code-block titles. Any other delta — including list
  markers and figure captions, whose `#555770` is a dead fallback — is a bug in
  the literal audit.

The parity spec fails silently if written wrong — a walker that visits nothing
passes. Mutation-test it: change one value in `light.ts` without regenerating,
confirm red. See `feedback_tests_that_pass_vacuously`.

## Risks

- **The `#555770` change is visible and subjective.** Called out above rather
  than buried; it is the one reviewable design decision in an otherwise
  mechanical project.
- **`@theme` additions generate utilities.** `--text-body` produces a `text-body`
  class. Harmless, but it widens the utility surface; worth a glance at the
  generated CSS size.
- **`color-mix`** — flagged as an open question in §3.
- **This project unblocks, but does not deliver, anything a reader sees.** The
  docs defects in the findings audit stay live through Projects 1 and 2. That
  was an accepted trade when the arc was ordered this way; it is recorded here
  so nobody rediscovers it as a surprise.
