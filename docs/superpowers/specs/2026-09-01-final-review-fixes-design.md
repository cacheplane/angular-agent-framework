# Final-review fix batch + rulings

**Date:** 2026-09-01 · **Status:** Approved ("ship"). · **Branch:** `blove/final-review-fixes`

Fixes from the all-surfaces final review:
1. **/ag-ui eight→seven** (H1, subtitle, block body — the grid lists 7). A
   page-spec assertion ties `BACKENDS.length` to the copy so adding an 8th
   runtime fails tests until the words update. BACKENDS gains a comment.
2. **Footer tagline de-litanied** → "The Angular UI layer for production
   agents." (meta/OG consumers of SHORT_POSITIONING_DESCRIPTION untouched).
3. **HomeFAQ header → railkick** (the homepage's last centered header).
4. **/render subtitle deduped** → "Unknown specs degrade gracefully — no
   surprises." (block headline keeps the terms).
5. **FinalCTA caption** → "All packages are MIT · Production support
   available · Installation is inert"; stale doc comment updated to the
   product-pages rule.
6. **Angular pills derived** on /langgraph + /ag-ui from
   WEBSITE_SUPPORTED_ANGULAR_MAJORS.
7. **8 orphaned marketing.css classes deleted** (zero-consumer verified).
8. **FeatureBlock.spec tautological card-row assertion removed.**
9. **PricingDetails kicker unified on Eyebrow.**
10. **YesWall aside** gains a sync comment beside TOTAL_QUESTIONS.

Rulings recorded (no code change): the Promises 5-marker ledger is the
sanctioned exception to marker-≤2 (ledger rows may sweep per-row; prose
stays ≤2); Yes-wall↔block API-tail echoes are the design's deliberate
grammar (wall asks, block elaborates); the hero caption's Genkit mention is
defensible ("keep your backend" claims compatibility of intent, not an
adapter); pricing hero's comma-join vs ProofStrip's en-dash are different
registers of the same derived source — both stand.
