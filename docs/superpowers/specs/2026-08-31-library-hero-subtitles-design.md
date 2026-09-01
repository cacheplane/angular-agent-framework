# Library page hero subtitles — the last two litanies

**Date:** 2026-08-31 · **Status:** Approved. · **Branch:** `blove/library-pages`

The four library pages inherited the design language via shared components
(FeatureBlock rows/rails, WhitePaperBlock paper, FinalCTA); their H1s and
FeatureBlock bodies are already in voice. Two hero subtitles remain:

1. `/langgraph` — the site's last six-noun litany. Replace subtitle with
   EXACTLY: "Ship LangGraph agents inside your Angular app. Agent state
   arrives as signals; threads survive reloads; humans stay in the loop."
2. `/ag-ui` — a 45-word runtime enumeration the H1 already counts. Replace
   subtitle with EXACTLY: "Build the Angular UI once, on the AG-UI protocol —
   eight runtimes speak it today, and new ones work the day they ship.
   History and checkpoint behavior stays with your backend."

`/chat` and `/render` subtitles deliberately unchanged. Update any spec/e2e
assertions on the old strings (grep first). This closes the recorded
"five pages' headlines/bodies copy pass" follow-up as satisfied.
