# Ninth arc — /solutions + /pilot-to-prod back half

**Date:** 2026-09-01 · **Status:** Approved (accent theming: KILL, navy everywhere). · **Branch:** `blove/solutions-pilot`

## 1 · /solutions/[slug] (the orphan)

- **Accent theming dies.** `solution.color` stops flowing into the UI: the
  `accent` props on PainPoints/Architecture/Capabilities, every inline
  `--accent` style, and `data-accent-text` usage on these pages go; Eyebrows
  become plain `tone="accent"` (navy). The `[data-accent-text]` CSS rule in
  pages.css is deleted IF these pages were its only consumers (grep).
  `solution.color` stays in the data if other consumers exist (index cards?
  grep) — otherwise remove the field and its type.
- **Section headers → rail** (`sol-page-section-header` gets the railkick;
  centered rules removed).
- **Capabilities metrics become proof-cell numerals**: `sol-page-metric`
  restyled serif Garamond (proof-strip-value scale ~40px here), navy →
  `--color-text-primary`; cards keep paper chrome.
- PainPoints/Architecture cards keep their card form (content-bearing);
  headers/rails only.
- Hero: eyebrow plain accent; structure unchanged; FinalCTA stays tinted
  (commerce rule).

## 2 · /solutions index

- "By use case" header → rail. Cards stay (nav device, like PostCards);
  their per-card Eyebrows plain accent.

## 3 · /pilot-to-prod back half

- The two `pilot-section-header` blocks ("What you walk away with",
  contact/"Tell us about your stack") → railkick, left-aligned (centered
  rule removed).
- The outcomes `Card` grid → the rows ledger (claim → mono tail), tails
  drawn from each card's substance; BrowserFrame visuals stay.
- FinalCTA stays tinted.

## Testing

Page specs: extend/create minimal specs asserting rail presence + zero
`data-accent-text` on slug pages + a metric renders. Full suite + prod
build + Chrome pass (desktop/390).
