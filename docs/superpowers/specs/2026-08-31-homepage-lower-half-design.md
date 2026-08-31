# Homepage lower half — the established language, applied

**Date:** 2026-08-31
**Status:** Approved in mockup review (all four sections + toast option A).
**Branch:** `blove/homepage-lower-half`

## Scope

The last homepage sections untouched by the redesign arcs: `Promises`,
`PilotBlock`, `WhitePaperBlock`, `RecentArticles`, plus the `DemoShowcase`
header and the sitewide `AnnouncementToast` behavior. No new design devices —
only the shipped ones: rail headers, the claim→tail rows grammar, specimen
numerals, the marker sweep, paper elevation.

## 1 · Promises — cards become a ledger

Rail header (kicker "Built on principles" + hairline + italic aside "honest
commitments, not aspirations"), heading unchanged, subhead absorbed into the
aside. The five Cards become five rows (2px cap, hairline rules, max-width
~56ch): the **"No X" phrase gets the marker sweep** (`.marker-highlight` —
its only appearance below the hero), the substance follows inline after an
em-dash, the mono tail carries the proof term.

Rows (exact copy):
- **No runtime lock-in** — every package is MIT, commercial or not. → `MIT, all packages`
- **No abandoned majors** — Angular's current and previous LTS, always. → `support policy`
- **No required cloud** — run everything in your own VPC. → `self-host`
- **No hidden telemetry** — events require an explicit application action. → `installation is inert`
- **No model lock-in** — swap providers without touching Angular code. → `any LLM your runtime runs`

The left-hugging ~56ch ledger with open right whitespace is deliberate
(treatment C asymmetry).

## 2 · PilotBlock — rows + specimen numerals

Rail kicker ("For teams" + hairline). Headline, subhead sentence, and both
CTAs unchanged. The OUTCOMES checklist becomes four rows:
- A working agent demo on your domain → `your data`
- Hardened error, fallback, observability patterns → `production-ready`
- Deploy-ready integration → `your CI/CD`
- Team trained on the framework → `runbook, yours`

The four timeline Cards become a numbered ledger (no Card chrome): 2px top
cap, per-step ghost Garamond numerals 01–04 (~44px, `--color-border` grey,
aria-hidden), bold step title + one-line body, hairline rules between.
Step copy unchanged except tightened Build line ("A working demo on your
real data, in your real app.").

## 3 · WhitePaperBlock — the paper becomes paper

Rail kicker ("Field report" + hairline). Heading unchanged. The three
BULLETS become rows:
- Six production-readiness dimensions → `18 pages`
- Error boundaries, fallbacks, observability, deploy → `concrete patterns`
- No vendor pitch — what we learned shipping it → `free`

New right-column visual: a document mock — white card, ~-1.2deg rotation,
deep soft shadow (treatment D values), containing mono kicker "FIELD REPORT ·
18 PAGES", serif title "From Prototype to Production", three skeleton lines
(6px rounded rects, last at 70%), mono "THREADPLANE" footer. Pure
CSS/markup, aria-hidden (decorative). The form, its states, the fetch, and
every analytics event stay byte-identical. If the current component has an
existing right-column visual, it is replaced by the mock.

## 4 · Rail-header conversions

`RecentArticles` and `DemoShowcase`: centered header → rail anatomy (kicker +
hairline; RecentArticles gains italic aside "recent articles" and its heading
is absorbed by it — kicker "Blog", no h2 change if one is structurally
needed for aria; keep the h2, visually integrated). Content untouched.
Implementation may use the `SectionHeader` rail variant OR the local
railkick pattern the feature blocks use — match whichever needs fewer
special cases, but do not fork a third header anatomy.

## 5 · AnnouncementToast — intent gating (option A)

Current: 30s timer, sitewide (layout.tsx), localStorage dismissal. New: the
toast appears only when BOTH hold — the existing 30s timer has fired AND the
reader has scrolled ≥40% of the document height (passive scroll listener,
rAF-throttled, cleaned up on satisfy). Applies on all viewports and all
pages (the "past the Yes wall" framing generalizes to scroll depth — the
Yes wall sits at roughly 40% of the homepage). Dismissal behavior, storage
key, analytics, and copy unchanged.

## Testing

- Promises/PilotBlock/WhitePaperBlock/RecentArticles have no colocated specs
  today (verify by ls before assuming); WhitePaperBlock's form behavior must
  keep working — add a spec pinning: submit fires the two analytics events
  and renders the done state (mock fetch + analytics).
- AnnouncementToast: add a spec — not visible before scroll threshold even
  after timer; visible after both; dismissal persists.
- Full suite (the 7 docs-chrome failures are pre-existing on main — see task
  chip; not this branch's concern), prod build, visual pass 1440/375.

## Out of scope

Footer, Nav, FAQ accordion internals, the toast's copy/steps, PostCard.
