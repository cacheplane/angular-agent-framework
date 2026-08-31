# Basecamp-informed homepage changes — design

**Date:** 2026-08-27
**Status:** Design — awaiting review. No code written.
Changes A and F are ready to plan. **Change D is blocked**: all four of its
figures failed verification and the section needs rebuilding first.
**Branch:** `blove/basecamp-homepage-design-34a935`

## Problem

The homepage is clear and says true things, but it has two failures that are
easiest to see side by side with basecamp.com.

**It repeats its pitch instead of advancing an argument.** The litany "durable
threads, interrupts, subagents, planning, memory, and generative UI" appears in
the `<title>`, the hero subheadline, the ecosystem section, and again as the ten
rows of `Differentiator`. A reader who scrolls learns the same list four times.
Basecamp never restates its pitch; each section makes a new move.

**It has no rhythm.** Every section is white or near-white (`canvas` and `white`
are the same value in the light theme), centred, and evenly padded. Nothing on
the page is ever an arrival. The result reads as competent and slightly airless
— clear, but with no appeal.

There is also a concrete layout defect. `Differentiator` renders a claim, a
gloss, and an API hint per row, but the API hint is an inline element rather
than a grid column, so long rows wrap underneath it and the right edge goes
ragged.

## What we took from Basecamp, and what we deliberately did not

Taken: the **"all these questions have the same answer: Yes"** section, which
converts capability nouns into the questions a buyer actually asks; **proof by
specificity** rather than vague trust claims; and **section labels that state a
benefit** rather than a codename.

Not taken: the **founder-letter hero**. Basecamp sells to non-technical managers
and trades on a twenty-year-famous founder. Threadplane sells to developers who
want the API and a running demo inside ten seconds. The product-first hero,
medium switcher, and live demos stay.

Also not taken: **adoption numbers**. Basecamp's "84 million accounts" is the one
move Threadplane cannot borrow, because adoption is currently its weakest
signal. Specificity is the transferable principle, not size.

## Goal

Give the homepage one genuine arrival moment, replace the repeated capability
litany with a section that answers real questions, and add proof that is
specific and attributable — without lengthening the page.

## Non-goals

- **No new palette or type scale.** Everything below uses tokens that already
  exist in `@threadplane/design-tokens`.
- **No change to `FeatureBlock`** or the four medium-switcher sections. Section
  labels (STREAM / RENDER / SHIP / APPROVE) were considered and **cut** from
  this scope.
- **No dark mode for the site.** Two sections are dark by design. This is not a
  theme toggle and does not imply one.
- **No founder note, and no live-class scheduling.** Both were considered and
  cut.

## Visual direction: Inverted × Specimen

Two devices, combined:

**Inverted** — the section sits on the dark canvas. This is the source of the
rhythm the page lacks, and it is nearly free: the full dark palette already
ships in `libs/design-tokens/src/lib/dark.ts` and the website simply never
consumes it.

**Specimen** — type is the graphic. A 330px italic EB Garamond "Yes" watermark
at ~8.5% accent bleeding off the right edge; group numerals at 62px in
`#3c3c3c` so they read as structure, not content; each group capped with a 2px
`#f5f5f5` rule; the answer set inline and italic so a repeating *Yes* runs down
the left margin.

Dark-section values (from `dark.ts`):

| Role | Value |
|---|---|
| Canvas | `rgb(17,17,17)` |
| Border | `rgb(45,45,45)` / strong `rgb(60,60,60)` |
| Text | `rgb(245,245,245)` / secondary `rgb(200,200,200)` / muted `rgb(160,160,160)` |
| Accent | `#64C3FD` |
| Accent glow | `rgba(100,195,253,.25)` |
| Row hover tint | `rgba(100,195,253,.08)` |

**The dark treatment must appear twice.** A single inverted band reads as
arbitrary. `FinalCTA` adopts the same surface, which turns "a dark section" into
"the dark treatment" and costs little since the CTA is already short.

## Change A — the Yes wall (replaces `Differentiator`)

`Differentiator` is already a Yes wall wearing the wrong clothes: same three
parts, wrong markup. This replaces it rather than adding to the page.

Sixteen questions in four numbered groups — *State that survives*, *Humans in
the loop*, *On my design system*, *Shipping it* — each row a real grid:
`1fr / 250px`, question and inline italic answer on the left, mono API on the
right. Every question is phrased as a developer would search for it ("Can a
conversation survive a page reload?"), and every answer links to the API that
delivers it.

The questions are load-bearing content, not decoration: each must be one a real
evaluator asks, and each must be answerable **yes** without qualification. Any
question needing "yes, but" belongs in the FAQ instead.

## Change D — proof strip (new, light)

Basecamp's "big numbers" translated to proof that is defensible: supply-chain
posture and maintenance discipline. Four cells on the `tinted` surface
(`rgb(251,251,251)`), 74px Garamond numerals, 2px `#1c1c1c` cap rule, hairline
verticals, **and a source printed under every cell**. The source line is the
point; without it this is decoration.

Deliberately **light**, not dark, so the Yes wall remains the page's single
arrival moment and the CTA's callback to the dark surface still lands.

### Figures — verified, and mostly wrong

The four figures drafted for this section were checked on 2026-08-27 and **all
four were wrong or misleading**. See "Verification results" below. Change D
**cannot ship as drafted** and needs rebuilding around three honest cells before
implementation starts.

Two rules for whatever replaces them. A figure that moves on its own — like the
HVTrust grade, which flipped six times this month — must be a **live badge, not
a hardcoded string**. And a figure must be favourable *and* honest: the Angular
LTS cell was literally true while implying the opposite of the truth, which is
worse than omitting it.

## Change F — hero copy

Keep the layout, the H1, and the light surface — the hero's restraint is part of
what makes the dark section land later.

Replace the six-noun subheadline with the problem it solves ("The streaming demo
takes an afternoon. Everything after it takes six months."), and demote the
nouns to mono chips beneath it. The keywords still scan for SEO and for
skimmers; they stop being the pitch.

## Scope: what happens to the rest of the page

**Decision needed at review.** The proposal is:

- `Differentiator` is **removed**; the Yes wall takes its slot.
- `HomeFAQ` **shrinks** to genuinely non-binary questions — pricing, adapter
  choice, SSR — since roughly half of its current items become Yes-wall rows.
- Net page length stays approximately flat.

The alternative is keeping both, which costs length and reintroduces the
repetition this design exists to remove.

## Updated for main as of 2026-08-30 (post-#881, all-MIT)

Main landed "move all packages to MIT" (#881) after this spec was first
committed. Three corrections to the design content:

- **Licensing moves from FAQ to the Yes wall.** It is no longer a "yes, but"
  ("most packages MIT, chat commercially licensed") — it is now an unqualified
  yes: *"Can I use every package commercially without a license fee?" → Yes,
  MIT.* The old licensing FAQ item is gone from main; do not resurrect it.
- **The CopilotKit migration question no longer exists.** #881 scrubbed
  CopilotKit from the entire site (FAQ item, logo, differentiator copy). The
  surviving-FAQ list above reflects that; reintroducing the comparison would
  run against a deliberate decision on main.
- **The telemetry Yes-wall row strengthens.** Main's language is now "package
  installation is inert" — stronger than the drafted "telemetry off by
  default". Use the inert phrasing: *"Can I install it without phoning home?"
  → Yes, installation is inert.*

Main also introduced **Production Assurance** as a second commercial offering
beside Pilot-to-Prod; the FOR TEAMS section is untouched by this design, but
any Yes-wall row about support should not imply Pilot-to-Prod is the only
option.

**Angular 22:** support is in flight per Brian (2026-08-30) but NOT yet on
main — every Angular-facing lib still pins `^20.0.0 || ^21.0.0`. Once a
`^22.0.0` range lands and releases, the cut LTS proof cell can return in
honest form ("Angular 20–22 supported" — current Active plus both LTS lines).
Until then it stays cut. Verify the published peer range, not the docs, before
reviving it.

## Surface treatments (approved 2026-08-30)

Four atmosphere treatments, chosen with basecamp.com as reference. Basecamp
barely uses gradients — its texture comes from highlight marks, elevation on
product shots, and asymmetric whitespace. These translate those moves; all four
ship, and they compose (A+D dress light sections, B refines the dark band, C
restructures section openings).

**A — Marker highlight.** A skewed navy sweep behind key phrases — hero
subheadline first, testimonial pulls if/when real ones exist. Values:
`linear-gradient(100deg, rgba(0,64,144,.14), rgba(0,64,144,.08) 85%)`,
`border-radius:4px`, `transform:skewX(-6deg) rotate(-.4deg)`, drawn by a
`::before` at `z-index:-1` with `isolation:isolate` on the span (without the
isolation the sweep paints behind the section background and vanishes).
Use on at most two phrases per section; a page of highlights is a page of none.

**B — Glow & gradient atmosphere (dark band).** The Yes wall and FinalCTA
canvas becomes `linear-gradient(180deg,#161616,#0e0e0e)` instead of flat
`#111`. A radial accent glow sits behind the watermark
(`radial-gradient(closest-side, rgba(100,195,253,.13), rgba(100,195,253,.04)
55%, transparent 75%)`, ~640px, off the top-right corner). The watermark glyph
itself is gradient-filled via `background-clip:text`
(`linear-gradient(160deg, rgba(100,195,253,.16), rgba(100,195,253,.03) 70%)`)
rather than flat low-opacity. A 1px seam marks the light→dark boundary:
`linear-gradient(90deg, transparent, rgba(100,195,253,.55) 30%,
rgba(100,195,253,.55) 70%, transparent)`.

**C — Editorial asymmetry.** Section headers leave the centre for a left rail:
kicker over a 2px ink rule, Garamond heading below (~44px in-rail), an italic
muted aside under that; content in the right column. Grid `300px / 1fr`, gap
64px, collapsing to stacked below ~900px. This replaces the centred
kicker/H2/lede opening on the sections this design touches. **Consequence:**
the shared `SectionHeader` primitive previously noted as out-of-scope becomes
**in-scope** — restructuring every section opening by copy-paste would multiply
the existing margin/letter-spacing drift. Build a `SectionHeader` (or
`SectionRail`) primitive with centred and rail variants; sections not in this
design's scope keep the centred variant and migrate opportunistically.

**D — Paper elevation (light sections).** Tinted bands become a whisper of
vertical gradient (`linear-gradient(180deg,#fdfdfd,#f6f6f6)`) instead of flat
`#fbfbfb`. Proof cards: layered shadows — tight contact plus long soft ambient
(`0 1px 2px rgba(0,0,0,.04), 0 12px 28px -12px rgba(28,28,28,.14)`) — a 1px
top highlight (`linear-gradient(90deg, transparent, rgba(255,255,255,.9),
transparent)`), and a faint internal vertical wash so they read as paper rather
than outlines. Product shots: slight rotation with a deep soft shadow
(`rotate(-.6deg)`, `0 2px 4px rgba(0,0,0,.05), 0 24px 48px -16px
rgba(28,28,28,.22)`) — `BrowserFrame` already supports `rotate` and
`elevation`, so this extends existing props rather than inventing.

Note: change D's earlier drawing used a flat 4-cell hairline grid; with this
treatment the proof strip becomes three elevated cards on the gradient band.
The per-cell source lines and the live-badge rule are unchanged.

## Implementation notes

`apps/website` is **Next.js 16 / React 19**, not Angular. Landing components
style via inline `style={{}}` objects reading from `@threadplane/design-tokens`;
Tailwind is present but barely used on the homepage. Match that pattern.

**Files**

| Change | File |
|---|---|
| A | New `apps/website/src/components/landing/YesWall.tsx`; delete `Differentiator.tsx`; update `app/page.tsx` |
| D | New `apps/website/src/components/landing/ProofStrip.tsx`; insert in `page.tsx` |
| F | `apps/website/src/components/landing/Hero.tsx` |
| Partner | `apps/website/src/components/landing/FinalCTA.tsx` |
| Scope | `apps/website/src/components/landing/HomeFAQ.tsx` |

**Two primitives need extending — this is the main technical risk.**

1. `components/ui/Section.tsx` accepts `surface: 'canvas' | 'tinted' | 'white'`.
   A dark section needs a fourth value. Extend the union rather than bypassing
   `Section` with a one-off wrapper, or the vertical rhythm drifts.

2. The website **hardwires the light theme**: `tokens.ts`, `surfaces.ts`, and
   `colors.ts` all re-export `lightOverrides`, so `tokens.colors.accent` is
   always `#004090`. A dark section cannot simply read `tokens.*`. Import
   `darkOverrides` explicitly for the inverted sections. Do **not** "fix" this by
   making the token exports theme-aware — that is a much larger change and is
   out of scope here.

3. `components/ui/Eyebrow.tsx` has three tones (`muted`/`accent`/`angular`), all
   light-theme. The dark sections need an on-dark tone resolving to `#64C3FD`.

**`SectionHeader` extraction is now in scope** (see treatment C above). There
is no shared primitive today — the kicker/H2/lede block is copy-pasted across
`EcosystemStrip`, `Differentiator`, `Promises`, and `HomeFAQ` with drifting
margins (28/44/56/48) and inconsistent letter-spacing. Treatment C's left-rail
opening is the reason to extract one with centred and rail variants.

**Testing.** `nx test website` does not exist and fails quasi-silently. Use:

```bash
cd apps/website && npx vitest run --config vite.config.mts
```

Homepage specs cross-check content against disk; a spec asserting the ten
`Differentiator` rows will need updating with the removal.

**Accessibility.** The dark sections must hit WCAG AA against
`rgb(17,17,17)`; `#64C3FD` body text and the `#3c3c3c` group numerals both need
checking. The numerals are decorative structure — if they fail contrast, they
must not be the only carrier of the group number. The watermark is
`aria-hidden` and `user-select: none`.

**Responsive.** The specimen devices are the fragile part. Below ~900px the
330px watermark and the 112px numeral gutter both need explicit handling, and
the two-column row collapses to stacked question-then-API.

## Verification results

**Checked 2026-08-27. All four drafted figures were wrong or misleading.**
Repo resolved as `github.com/cacheplane/angular-agent-framework`.

| # | Drafted | Actual | Verdict |
|---|---|---|---|
| 1 | Grade A, 82.8/100 | Grade A, **81.2**/100 | Grade matches, score DIFFERS |
| 2 | #7 of 75 frameworks | **#13 of 119** frameworks (**#76 of 1,316** overall) | DIFFERS badly |
| 2b | "the only Angular one" | Only entry whose *description* says Angular | UNPROVEN |
| 3 | OpenSSF Scorecard 7.7 | **8.1**/10 per official API | DIFFERS — sources disagree |
| 4 | Current + previous Angular LTS | Angular 20 + 21 — true but misleading | MISLEADING |

Sources: `https://hvtracker.net/agents/threadplane/`,
`https://hvtracker.net/categories/agent-frameworks/`,
`https://api.securityscorecards.dev/projects/github.com/cacheplane/angular-agent-framework`,
`https://angular.dev/reference/releases`.

**Detail that changes the design, not just the numbers:**

1. **The HVTrust grade is volatile.** The A band starts at 80 and the project
   sits at 81.2. Its own reputation timeline shows the grade flipping six times
   this month (A→B Aug 5, B→A Aug 14, A→B Aug 17, B→A Aug 19, A→B Aug 22, B→A
   Aug 24). **A hardcoded "Grade A" will be false on some days.** Either embed
   the live badge (`https://hvtracker.net/badge/threadplane.svg`) or cut the
   cell. Hardcoding is not an option.

2. **The rank claim was wrong in an instructive way.** The detail page shows
   "Rank Change ▼1 was #75" — 75 is a recent *rank*, not a category size. The
   drafted claim appears to have crossed those two fields.

3. **Two Scorecard sources genuinely disagree.** The official OpenSSF API
   returns 8.1 (scanned 2026-08-18, commit `13d8a87`, Scorecard v5.0.0);
   HVTracker runs its own Scorecard CLI and shows 7.7. Cite **8.1** with the
   OpenSSF API as the source, because that is what a reader sees on
   scorecard.dev. Do not cite HVTracker's derived number under an "OpenSSF"
   label.

4. **The Angular LTS cell must be cut.** Every Angular-facing library pins
   `"@angular/core": "^20.0.0 || ^21.0.0"`. Angular 20 and 21 *are* the two LTS
   lines, so the sentence is literally true — but **Angular 22 has been the
   Active release since 2026-06-03 and is not in any peer range.** On a
   homepage "current and previous LTS" reads as "up to date"; the honest reading
   is "supports the two maintenance-mode releases, not the current one." It also
   decays on its own when v20's LTS window closes 2026-11-28. This is a weakness
   dressed as proof — cut it.

### Consequences for change D

Change D **cannot ship as drafted**. Of four cells: one must become a live badge
or be cut, one needs materially less impressive true numbers, one needs a
different source and value, and one must be cut outright.

Options, for the review conversation:

- **Rebuild with three honest cells** — live HVTrust badge, "#13 of 119 agent
  frameworks", "OpenSSF Scorecard 8.1/10" — and find a fourth that is stable and
  genuinely favourable. A three-cell grid is also fine.
- **Cut change D** and ship A and F only. The risk section already anticipated
  this outcome.

Recommendation: **rebuild with three cells.** #13 of 119 and 8.1/10 are still
good numbers honestly stated, and the per-cell source line makes them stronger
than the inflated versions would have been.

### Out-of-scope bug this surfaced

`README.md` (line 18 badge, line 38) and
`apps/website/content/docs/langgraph/getting-started/installation.mdx` (lines
8–9) both promise open-ended **"Angular 20+"**, but the published peer ranges
cap at `^21`. An Angular 22 user following those docs gets an npm peer failure.
Tracked separately; not part of this design.

## Risks

- **The dark band looks arbitrary** if `FinalCTA` does not ship with it. Treat
  the two as one change, not two.
- **The questions go soft.** Sixteen rows is a lot; the temptation is to pad
  with questions that are really features. A padded Yes wall is worse than the
  grid it replaced.
- **Unverifiable proof figures** could hollow out change D. If two or more
  cannot be verified, the section should be cut and revisited rather than
  shipped thin.

## Mockups

Rendered mockups live in `.superpowers/brainstorm/` (gitignored). All four
candidate rounds — initial candidates, high-fidelity redraw, three visual
directions, and the final Inverted × Specimen combination — are preserved as
standalone HTML.
