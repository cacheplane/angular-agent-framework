# Design-program follow-ups

**Date:** 2026-08-31 · **Status:** Approved. · **Branch:** `blove/followups`

1. **Showcase intros → rail.** The three CodeShowcase intros (lg/chat/render
   `*-show-intro`) are the last centered kicker grammar. Each eyebrow wraps
   in a shared `show-intro-rail` div + aria-hidden hairline; intros
   left-align. Headings/snippets untouched.
2. **ProofStrip fourth cell (condition met).** npm @threadplane/langgraph
   @latest publishes `^20 || ^21 || ^22` (verified 2026-08-31 against the
   registry) — the shipped homepage spec's revival condition for the cut
   Angular cell. New cell: value derived from
   `WEBSITE_SUPPORTED_ANGULAR_MAJORS` (`20–22`, first–last, NOT hardcoded),
   caption "Angular majors supported, CI-tested", source
   npmjs.com/package/@threadplane/langgraph. Grid → repeat(4, 1fr); spec
   3→4 first.
3. **RecentArticles moves above the dark FinalCTA** so the closer closes.
4. **Untrack `apps/website/tsconfig.tsbuildinfo`** (gitignored but tracked).
