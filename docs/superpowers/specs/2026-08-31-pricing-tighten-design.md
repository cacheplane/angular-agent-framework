# Pricing page tightening

**Date:** 2026-08-31
**Status:** Approved (both cuts confirmed; LeadForm FORM explicitly retained).
**Branch:** `blove/pricing-tighten`

## Problem

The pricing page is ~7,050px and says "everything is MIT" six times: hero
license line, Community card, boundary section, the comparison table's
six-row all-"Included" SOFTWARE block, four of ten FAQ items, and the CTA
caption. The compatibility section spends ~700px on one sentence (two of its
four rows are "—"). The LeadForm section restates the tiers a third time in
four checkmark cards. Headers are centered while the site now speaks rails.
The three tier cards cluster left with dead space right (grid not centered).

## Changes

1. **Comparison table** (`PricingDetails.tsx` / `PricingComparison`): delete
   the SOFTWARE section (all six rows + its group header). Above the table,
   one line replaces it: "The software is identical on every path — MIT, all
   of it. What changes is support." (rendered as the section's lede,
   replacing "The software stays open. The level of support and delivery
   changes."). The SUPPORT AND DELIVERY group header becomes unnecessary
   with one group — remove it; the seven remaining rows stand alone.
2. **Compatibility section**: the `<Section>` in `pricing/page.tsx` and
   `CompatibilityMatrix` usage are deleted. One compatibility line joins the
   hero license strip: "Every package is MIT · Commercial use without
   registration or runtime checks · Angular 20–22, CI-tested · No
   Threadplane cloud". `CompatibilityMatrix.tsx` + its spec are deleted IF
   the homepage/docs don't consume it (grep first; if consumed elsewhere,
   only the pricing usage is removed).
   Note: `angular-support.mjs` in the pricing dir may generate the versions —
   if so, the hero line should consume the same source (single source of
   truth for "20–22"); investigate at plan time.
3. **FAQ 10 → 6** (`PricingFAQ.tsx`): delete "Is Threadplane free?",
   "Can I use every package commercially?", "Does a paid plan unlock
   different software?", "Can I modify or redistribute the source?". Keep:
   cloud service, conversations/data storage, model/hosting costs, what am I
   paying for, Production Assurance, Pilot-to-Prod. Update `PricingFAQ.spec`
   accordingly (it exists).
4. **LeadForm** (`LeadForm.tsx`): the FORM and all its fields, states, and
   analytics are UNTOUCHED. Delete the four checkmark cards; the section
   becomes rail header + the framing sentence + the form, with the form
   allowed the visual center (single-column layout, form max-width ~640px).
   The "See how Pilot-to-Prod works →" link from the deleted cards moves
   under the framing sentence (do not lose the link).
5. **Rail headers** on: boundary section ("What you are buying"), comparison
   ("Full comparison"), FAQ ("Questions"), LeadForm ("Enterprise") — the
   local railkick pattern (kicker + hairline), left-aligned. Hero stays
   centered (it is the page's one centered moment, like the homepage hero).
6. **Tier card grid centered** (`CompareTable`): the three cards center in
   the container (fix the left-cluster + dead right column).

## Testing

- `pricing/page.spec.tsx` exists — update assertions minimally where they
  reference removed content (grep for compat/FAQ strings first).
- `PricingFAQ.spec` updated to the six survivors.
- `CompareTable.spec` untouched unless the centering fix moves DOM.
- New `LeadForm.spec` pinning: submit fires its analytics events and
  renders its success state (mock fetch; same pattern as
  WhitePaperBlock.spec) — written BEFORE the layout change, passing before
  and after.
- Full suite green (48+ files, all green baseline); prod build; Chrome MCP
  visual pass at 1440px + 375px (the pane's hidden-viewport artifacts make
  Chrome the verification surface for this arc).

## Out of scope

Tier copy/structure inside the cards; the boundary diagram's three bands;
FinalCTA (default variant is correct here); the /contact page.
