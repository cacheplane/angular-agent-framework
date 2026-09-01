# Library pages — the homepage manner

**Date:** 2026-08-31 · **Status:** Approved in review. · **Branch:** `blove/library-pages`
Supersedes the narrow subtitle-only reading (commit d85d0d4d stands as this
arc's first commit).

## Scope

`/langgraph`, `/chat`, `/ag-ui`, `/render`: medium switchers, one dark
arrival per page, hero polish. Cut: per-page Yes ledgers (would re-duplicate
the homepage wall).

## 1 · Medium switchers

Each page's FIRST FeatureBlock swaps its static BrowserFrame mock for
`MediumSwitcher`, panes built server-side via the homepage's `buildPanes`
pattern (extract that helper from `app/page.tsx` into a shared module rather
than copy it — it is currently page-local). The SECOND FeatureBlock keeps its
CodeShowcase untouched.

New `SECTION_MEDIA` entries (validation via the existing section-media.spec
comes free):

| key | video | live (`?featured=`) | code pane |
|---|---|---|---|
| `libLanggraph` | LANGGRAPH_CLIP | `tell-me-about-coral` | the page's current app.config.ts mock content |
| `libChat` | SHIP_CLIP | `tell-me-about-coral` | the page's current cockpit mock content, if it is code; else omit code |
| `libAgUi` | AG_UI_CLIP | — none (the demo host is the LangGraph demo; wiring AG-UI live is out of scope) | the page's current app.config.ts mock content |
| `libRender` | RENDER_CLIP | `generative-ui-contact-form` | the page's current spec→component mock content |

The switcher renders bare when only one medium exists (its shipped
behavior); missing panes are omitted, never faked. /chat's clip is SHIP (the
production chat surface); HITL was considered and declined.

## 2 · Dark arrival

`<FinalCTA variant="dark" />` on all four pages. Rule amendment recorded:
the dark closer extends to product pages; commerce pages (/pricing,
/pilot-to-prod, /solutions) stay tinted. The FinalCTA spec's default-tinted
test continues to guard the others.

## 3 · Hero polish

Per page:
- Mono package-identity kicker with rail hairline above the h1 (currently NO
  kicker exists): `@threadplane/langgraph · LangGraph adapter`,
  `@threadplane/chat · chat compositions`, `@threadplane/ag-ui · protocol
  adapter`, `@threadplane/render · generative UI`.
- One `.marker-highlight` sweep per subtitle on the load-bearing phrase:
  langgraph → "humans stay in the loop"; ag-ui → "work the day they ship";
  chat → "Production-shaped from day one"; render → "components you already
  own".
- `/ag-ui` gains `<WhitePaperBlock paper="overview" />` before FinalCTA
  (parity with the other three; no ag-ui-specific PDF exists).

## Testing

- section-media.spec validates the new entries automatically.
- Each page: no colocated page spec exists (verify) — add a minimal one per
  page asserting: kicker text, marker span presence, switcher tablist when
  >1 pane, dark FinalCTA surface. Keep them small.
- Full suite + prod build + Chrome MCP visual pass (pane hidden-viewport
  artifacts persist; Chrome is the visual surface).

## Out of scope

The AG-UI live demo wiring; MediumSwitcher/FeatureBlock internals; clip
re-recording; /pilot-to-prod (5th page — engagement page, different genre).
