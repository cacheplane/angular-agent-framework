# ATC theme spike — aviation yellow on the Threadplane website

**Date:** 2026-09-07
**Status:** Approved, ready for planning
**Branch:** `blove/threadplane-theme-update-55baa6`

## 1. Goal

Reskin the Threadplane website to the visual language of **ATC — Live Air
Traffic Radio** (Enhanced Radar, App Store id6755132266): aviation yellow, a
heavy grotesk display face, flat saturated blocks, and instrument-panel data
strips.

This is a spike in intent — it exists to be looked at and judged — but it is
built the real way, in `libs/design-tokens`, not as a throwaway override. The
branch is the isolation.

## 2. The reference

Values sampled from the App Store screenshots, not approximated:

| Value | Role in the app |
| --- | --- |
| `#FFAF00` | App icon ground. The aviation yellow. |
| `#FFB700` | The frequency strip at the bottom of the player. |
| `#15253E` | The radar/scope panel navy. |
| `#FF3200` | LIVE badges and marketing grounds. |
| `#6155F5` | The followed-flight card. Not adopted — see §4.1. |
| `#0A0A0A` | The wordmark black. |

The app's design language is flat saturated colour blocks with no gradients,
very heavy grotesk display type set tight, squircle and pill rounding, and
solid full-bleed data strips carrying callsigns and frequencies.

## 3. Direction

Of three directions considered — yellow as a signal colour on the existing
light page, a fully dark navy "scope" page, and a yellow-forward hero block —
the chosen direction is **the yellow-forward hero block on an otherwise
disciplined light page**.

The hero is the app icon blown up: a full-bleed `#FFAF00` panel with black type
and a black primary button, terminated by a `#15253E` data strip. Below the
strip the page returns to white and behaves. Yellow does not reappear as a
wash — only as the primary button, a 3px rule, or a link underline.

The rejected alternatives, and why:

- **Fully dark scope page.** Closest to the app's real product surface, but the
  site is light-only today; docs, code blocks, diagrams and the embedded live
  demo all assume a white ground. Largest blast radius for the least additional
  signal.
- **Yellow as accent only.** Safe and cheap, but reads as "a site that uses
  yellow" rather than as the reference. It does not answer the question the
  spike is asking.

## 4. Token architecture

### 4.1 The accent role splits in two

Today `--color-accent` does two jobs: it fills the primary button *and* colours
links, borders and focus rings. Navy `#004090` could do both. Yellow cannot —
`#FFAF00` on white is **1.84:1**, which is not a text colour under any
circumstances.

So the retheme is a remap of token *roles*, not a substitution of values.
Measured ratios:

| Pair | Ratio | Verdict |
| --- | --- | --- |
| `#FFAF00` on `#FFFFFF` | 1.84:1 | Fails. Fill only, never text. |
| `#0A0A0A` on `#FFAF00` | 10.73:1 | Passes AA. The yellow/black pairing. |
| `#15253E` on `#FFFFFF` | 15.37:1 | Passes AA — higher than the `#004090` it replaces (9.83:1). |
| `#FFAF00` on `#15253E` | 8.33:1 | Passes AA. Accent flips to yellow on dark. |
| `#FF3200` on `#FFFFFF` | 3.68:1 | Large/bold text or non-text only. |

**Brand layer — `libs/design-tokens/src/lib/base.ts`** (theme-invariant):

| Token | Value | Job |
| --- | --- | --- |
| `signal` | `#FFAF00` | Hero block, primary button fill, marker highlight, logo mark. |
| `signalStrong` | `#FFB700` | Full-bleed data strips only. |
| `scope` | `#15253E` | Interactive ink on light; the ground of the website's dark band. |
| `alert` | `#FF3200` | LIVE status fills. Never small text. |
| `ink` | `#0A0A0A` | Text on yellow; the new `textPrimary`. |

`angularRed` (`#DD0031`) is unchanged — it is Angular's trademark colour, not
ours to retheme. `renderGreen` and `chatPurple` are unchanged; retinting them
is unrelated churn. The app's indigo `#6155F5` is **not** adopted: it would
collide with `chatPurple` for no gain.

These are *additive* brand entries. Each needs a line in
`generate-theme-css.ts` (emitting `--color-signal`, `--color-signal-strong`,
`--color-scope`, `--color-alert`, `--color-ink` for Tailwind and the matching
`--ds-*` names for plain consumers), an entry in the `token-css-parity.spec.ts`
source→var map, and — because they become names consumers may reference — an
entry in the `ds-var-contract.spec.ts` list.

`signal` and `accentLight` resolve to the same value rather than one replacing
the other, and that is deliberate: `dark.ts` already derives its accent as
`baseTokens.brand.accentLight`, so repointing `accentLight` to `#FFAF00` makes
the dark accent flip to yellow with no second edit. `--color-signal` is the
name new work should use; `--color-accent-light` stays for its 4 existing call
sites.

**Light theme — `libs/design-tokens/src/lib/light.ts`:**

| Role | Was | Becomes | Rationale |
| --- | --- | --- | --- |
| `accent` | `#004090` | `#15253E` | Interactive ink. From the ATC palette, and higher contrast than what it replaces. |
| `accentLight` | `#64C3FD` | `#FFAF00` | The signal. Fill only. |
| `accentHover` | `#003070` | `#0E1B2E` | Darker scope navy. |
| `accentSurface` / `accentBorder` / `accentGlow` | navy tints | yellow tints | Tints are backgrounds, so they carry the yellow; the ink on top stays `accent`. This is already how `[data-ui="pill"][data-variant="accent"]` composes. |
| `shadowFocus` | navy ring | `#15253E` ring | **Deliberate.** A yellow focus ring on white is 1.84:1 and effectively invisible. |
| `textPrimary` | `rgb(28,28,28)` | `#0A0A0A` | Matches the app's harder near-black. |

**Dark theme — `libs/design-tokens/src/lib/dark.ts`:** its `accent` needs *no*
edit — line 28 already derives it as `baseTokens.brand.accentLight`, so it
becomes `#FFAF00` (8.33:1) the moment `accentLight` is repointed. What does
need editing is lines 29–33, which hardcode the blue: `accentHover`,
`accentGlow`, `accentBorder`, `accentBorderHover` and `accentSurface` all carry
literal `#8dd4ff` / `rgba(100, 195, 253, …)` values and must be re-derived from
the yellow. Leaving them is the likeliest silent bug in this whole change: the
accent would flip to yellow while its own hover and border tints stayed blue.

Its *surfaces* stay neutral, because that file states they are deliberately
aligned to `@threadplane/chat` so embedded chat has no colour seam, and the
cockpit consumes them.

The website's own `[data-ui="section"][data-surface="dark"]` scope
(`apps/website/src/styles/ui.css`) is website-local, so that band moves off
neutral `#111` onto scope navy `#15253E`, and its 1px boundary seam changes
from blue to yellow.

### 4.2 Why the library and not a website override

An override layer in `apps/website` would have kept `libs/design-tokens`
untouched and left every existing token spec green. It was rejected in favour
of doing it properly: the library is the source of truth, and a spike that
routes around it would not tell us what adopting the theme actually costs.

The accepted consequence is that the cockpit and example apps inherit the new
`--ds-*` values. They consume them with fallbacks and nothing imports
`tokens.css` yet, so nothing breaks at runtime — but they are not visually
reviewed as part of this work (§7).

## 5. Typography

| Var | Was | Becomes |
| --- | --- | --- |
| `--font-display` (was `--font-garamond`) | EB Garamond | **Archivo Black** |
| `--font-sans` (was `--font-inter`) | Inter | **Archivo** 400–700 |
| `--font-diagram` | *(new)* | **Inter** — retained for diagrams only |
| `--font-mono` | JetBrains Mono | unchanged |

EB Garamond is removed from `layout.tsx` entirely. A serif has no place in this
system, and dropping it removes six loaded font files. Inter is **not**
removed — it stays loaded to serve `--font-diagram` (§5.1).

Archivo Black is display-only (a single weight) and is used for h1/h2 and the
wordmark; Archivo carries body and UI. This pairing is what keeps the docs
readable — Archivo is a text face, so a long page still reads, which Archivo
Black alone would not.

JetBrains Mono uppercase on the eyebrows and the data strips is doing more work
than it looks: it is the instrument-panel cue. Without it the theme leans
entirely on the yellow.

### 5.1 Diagrams keep Inter

Diagrams do not take the brand face. They stay on Inter via a new
`--font-diagram` token, and they stay clean and minimal: neutral type, no
Archivo Black, no display weights.

Two reasons, and the second is the load-bearing one:

1. **Diagrams are information, not brand surface.** A heavy grotesk in a
   16-node architecture drawing fights the drawing. The brand lives in the
   hero; the diagram's job is to be read.
2. **The geometry is tuned to Inter's metrics.** `EnterpriseArchitecture.tsx`
   pins every rectangle to an 8px grid in a data module, and
   `home-architecture.spec.ts` measures every rendered text run against its
   card after `document.fonts.ready`. Swapping the diagram to Archivo would
   change every glyph width and force a geometry rework that could easily
   exceed the retheme itself. Keeping Inter makes that rework zero.

The carve-out is three declarations, not a scatter:

- `apps/website/src/styles/landing.css` — `.arch-figure text`, a single blanket
  rule over every text node in the architecture figure
- `apps/website/src/styles/docs.css` — `.tp-diagram-node[data-title="sans"]
  .tp-diagram-title` and `.tp-diagram-meta`, the shared docs diagram kit

Diagram rules already on `var(--font-mono)` (eyebrows, titles, `data-meta="mono"`)
are unchanged — mono was never Inter and is not being retyped.

**Trap:** the §5.2 rename is a mechanical `--font-inter` → `--font-sans`
replacement, and these three declarations must become `--font-diagram`
instead. A blind find-and-replace silently rethemes the diagrams to Archivo
and breaks the overflow e2e — or worse, passes at desktop and overflows at
390px. Do the carve-out in the same commit as the rename, not after it.

### 5.2 The rename

The names `--font-garamond` and `--font-inter` become lies after the swap, so
they are renamed to `--font-display` and `--font-sans`. This is wider than a
find-and-replace in `apps/website`, because the names are generated:

- `libs/design-tokens/src/lib/typography.ts` — `fontSerif` → `fontDisplay`
- `libs/design-tokens/src/lib/css-vars.ts` — `--ds-font-serif` → `--ds-font-display`
- `libs/design-tokens/scripts/generate-theme-css.ts` — emits both `--font-garamond` and `--ds-font-serif`
- `libs/design-tokens/src/lib/token-css-parity.spec.ts` — the source→var map
- `libs/design-tokens/src/lib/ds-var-contract.spec.ts` — the published `--ds-*` name list
- `libs/workspace-react/src/styles/workspace.css`
- `apps/website` — 55 uses of `--font-garamond`, 128 of `--font-inter`

Risk is low despite the breadth: `ds-var-contract.spec.ts` documents that
consumers reference `--ds-*` names with fallbacks and that nothing imports
`tokens.css` yet, so removing `--ds-font-serif` has no runtime effect.

The rename lands as **its own commit**, before the design commit, so review of
the design is not buried under ~190 mechanical replacements.

## 6. Surfaces in scope

Yellow appears in exactly three forms. Anywhere else it is reduced to a 3px
rule or an underline colour.

1. **Nav** — white ground, black text, yellow logo mark, yellow "Get started"
   button with black text.
2. **Homepage hero** — full-bleed `#FFAF00` block, Archivo Black headline in
   `#0A0A0A`, black primary button, terminated by a `#15253E` strip carrying
   the trust line in JetBrains Mono. Below the strip, white.
3. **Docs shell** — a document first. Yellow is the active sidebar item's 3px
   left rule, the callout's left rule over a near-white tint, and keyword
   colour inside scope-navy code blocks. Links are `#15253E` with a yellow
   underline.

Every other marketing page (pricing, blog, about, solutions, pilot-to-prod)
inherits the new tokens and fonts automatically — that is the point of the
library approach — but is not hand-tuned. Those pages get a smoke pass only.

## 7. Explicitly out of scope

Named here so the divergence reads as a decision rather than a defect:

- **The OG / social card pipeline's TYPE** (`apps/website/src/app/card/`,
  `opengraph-image.tsx`, `blog/[slug]/opengraph-image.tsx`, `og-font.ts`). It
  bundles its own `EBGaramond-Bold.ttf`, and `card.spec.ts` asserts the bundled
  filenames, so retyping it means shipping an Archivo Black TTF. The card keeps
  Garamond.

  **Its COLOURS are in scope, and this is a correction to an earlier draft of
  this spec.** `card/tokens.ts` is a hand-copied snapshot of the light tokens,
  and `card.spec.ts` actively compares it against `theme.css` — its docstring
  says a snapshot with nothing checking it "would keep rendering, in last
  season's colours". Declaring the divergence intentional in a markdown file
  does not satisfy a guard that compares values at test time; it just leaves
  `nx test website` red for the rest of the arc, which trains everyone to
  ignore it. The colours cost nothing to move (they are hex literals, not
  font files), so `ink`, `accent`, `accentSurface` and `accentBorder` follow
  the retheme and the guard keeps working.
- **`apps/website/scripts/generate-whitepaper.ts`** — same reason.
- **`apps/website/src/app/icon.svg`** — the favicon stays navy.
- **Cockpit and example apps** — they inherit the new values but are not
  visually reviewed here.

## 8. Verification

The e2e added by #1048 is the gate on the §5.1 carve-out.
`apps/website/e2e/home-architecture.spec.ts` waits on `document.fonts.ready`
and then runs an overflow report against every card in the homepage
architecture diagram, with the comment "a fallback face lies about widths."

Because diagrams keep Inter, this should pass **unchanged** — and that is
exactly what makes it useful. A green run means the carve-out held; a red run
means the rename swept the diagram rules into Archivo. If it goes red, the fix
is to restore `--font-diagram` on the three declarations in §5.1, **not** to
adjust the diagram geometry. Adjusting geometry would be treating the symptom
and would bake Archivo's metrics into the data module.

Run it at both viewports. The spec's second test drops to 390px, and a
metrics regression can pass at desktop while overflowing on a phone.

Specs that pin a value being deliberately changed, and must be updated as part
of the work:

- `libs/design-tokens/src/lib/css-vars.spec.ts` — `--ds-accent` pinned to
  `#004090`, dark to `#64C3FD`, and the serif light/dark agreement
- `libs/design-tokens/src/lib/ds-var-contract.spec.ts` — `--ds-font-serif`
- `libs/design-tokens/src/lib/token-css-parity.spec.ts` — the font var map
- `tokens.spec.ts`, `theme.spec.ts`, `ds-var-sources-agree.spec.ts`,
  `generate-theme-css.spec.ts` — wherever they assert changed values
- `apps/website/src/styles/style-contracts.spec.ts`

Sequence:

1. `rm -rf apps/website/.next` first. This worktree carries a 347 MB stale
   `.next` from earlier dev use, which panics the production build.
2. Edit `base.ts` / `light.ts` / `dark.ts` / `typography.ts`, then regenerate
   with `npx nx run design-tokens:generate-theme-css`. Never hand-edit
   `tokens.css`, `tokens-dark.css` or `theme.css` — they are generated.
3. `npx nx test design-tokens` green.
4. `npx nx test website` green.
5. `npx nx e2e website` — in particular `home-architecture.spec.ts`.
6. Browser pane on `/` and a docs page at desktop and at 390px, and a contrast
   check taken from the rendered page rather than from the table in §4.1.

## 9. Known debt if the theme is adopted

- The social card, whitepaper and favicon pipelines need the new face bundled
  and their own `#004090` replaced.
- The non-hand-tuned marketing pages need a real pass.
- The cockpit and example apps need a visual review against the new `--ds-*`.
