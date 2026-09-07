# Enterprise architecture diagram on the homepage

**Date:** 2026-09-07
**Status:** Design approved in brainstorming (iterated through six mockups with the user); implementation gated on the user's visual sign-off before merge.
**Surface:** `apps/website` only.
**Replaces:** the "Where Threadplane fits" section (`ScopeTable`, section id `why`) on the homepage. `ScopeTable` and the `FINAL_MILE_*` copy leave with it.

## 1. Why

The homepage tells a developer what Threadplane does (the stage) but not where it sits in the estate they already run. Architects need one picture: three zones they recognise, one highlighted box inside their own application, and every named product in the place it actually occupies. The old scope table answered "what do we add" as prose; the diagram answers "where does it go" spatially, which is the final-mile argument made visible.

## 2. Decisions

| Decision | Choice |
|---|---|
| Framing | Layers and boundaries (framing A): three horizontal zones, your Angular application, your platform edge, the agent platform, with Threadplane the only highlighted box, inside your application zone. |
| Source of truth for contents | The docs. Every box links to the page that backs its wording; nothing on the diagram claims what a docs page does not say. Named third-party products appear as examples of a role, never as integrations Threadplane claims. |
| Marks | Only marks the site already holds under `apps/website/public/logos/` (README documents their sources). Generic enterprise boxes get a consistent line icon in a tinted badge, never a fake logo. LangSmith is a text chip until its mark is sourced under the same rules. |
| Precision | Coordinates on an 8px grid with 40px majors; a hidden alignment grid is part of the component (`data-grid` attribute toggles it) for review; a unit test asserts every rect lands on the grid; an e2e measures every text run and asserts it is inside its box. |
| Colour | Tinted gradient zones (blue-violet application, neutral edge, green-to-blue platform), white cards with a faint vertical gradient, a light blue tint with a blue hairline for Threadplane, the site's dot grid behind. |
| Interaction | Every card is a link to its docs page with a "docs ↗" affordance at the top-right; no hover states beyond the link. No animation. |
| Placement | Where `ScopeTable` was: between Reliability and the stage. Eyebrow "Architecture", headline "Where Threadplane fits in your agent platform.", body: "One highlighted box inside your Angular application. Everything else is yours or your runtime's, and the docs say what crosses each line." |
| Responsive | The SVG scales with its container down to 1024px; below that it scrolls horizontally inside the diagram frame at a 1024px minimum width (the kit's scroll-shadow treatment), so text never drops below legibility. |

## 3. Contents (verbatim, with the source page each links to)

**Zone 1, YOUR ANGULAR APPLICATION (Angular mark), "you own this zone".**
- **Threadplane** card, tag THE FINAL MILE; capabilities as icon badges, each a link: Chat (`/docs/chat/components/chat`), Interrupts (`/docs/langgraph/guides/interrupts`), Threads (`/docs/langgraph/guides/persistence`), Generative UI (`/docs/chat/guides/generative-ui`), Client tools (`/docs/chat/guides/client-tools`); mono line `@threadplane/chat · render · langgraph · ag-ui · middleware`; chips A2UI v0.9 (Google mark) and json-render (Vercel mark); caption "generative UI on two open standards · one Agent contract for every adapter". Card links to `/docs/chat/getting-started/introduction`.
- **Your components** (layers icon): "design system · tool views · client-tool handlers", "pages · routing · state · your APM on status() and error()", "unchanged by Threadplane". Links `/docs/chat/guides/client-tools`.
- Arrow to zone 2, caption "relative apiUrl · POST + SSE via the LangGraph SDK" (langgraph-basics, angular-signals, deployment).

**Zone 2, YOUR PLATFORM EDGE, "you own this zone".**
- **Same-origin proxy or API gateway** (gateway icon): chips Azure API Management, Amazon API Gateway, Apigee; line "adds the deployment credentials · forwards user identity · keys never reach the browser". Links `/docs/langgraph/guides/deployment`.
- **Identity & session** (key icon): chip Microsoft Entra ID; line "or Okta · session as HTTP-only cookies". Links `/docs/langgraph/guides/deployment`.
- Arrow to zone 3, caption "credentials added server-side · CORS on the runtime".

**Zone 3, AGENT PLATFORM, "your runtime owns this zone".**
- **Agent runtime** (cpu icon): chips LangGraph Platform, AG-UI; Strands (AWS mark), Agent Framework (Microsoft mark), Mastra. Links `/docs/langgraph/getting-started/introduction`.
- **Models** (sparkle icon): chips Azure OpenAI, Amazon Bedrock, Vertex AI; OpenAI and Anthropic marks as badges. Links `/docs/runtimes/getting-started/introduction`.
- **Tools · MCP · data** (plug icon): "server tools run here, against your systems", "client tools round-trip to the browser". Links `/docs/middleware/getting-started/introduction`.
- **Observability** (trace icon): text chip LangSmith; "traces every run · evals · token cost". Links `/docs/langgraph/guides/deployment`.
- **Durable state** (database icon): "checkpoints at every super-step, keyed by thread · platform-managed, or Postgres / SQLite when you embed the graph", "exposed by Threadplane, never faked". Links `/docs/langgraph/guides/persistence`.

## 4. Component

`apps/website/src/components/landing/EnterpriseArchitecture.tsx`, a server component rendering one `<svg viewBox="0 0 1280 1088">` inside the kit's `DiagramFrame` at `scale="marketing"`, framed by `DiagramSection`. Logos are `<image href="/logos/...">` referencing the public files. The diagram's geometry lives in a data module, `apps/website/src/lib/architecture-diagram.ts`, as typed zone/card/chip records so the tests can read the same numbers the component draws. The line icons are inline paths in the component (five to seven, matching the mockup).

## 5. Verification

- **Unit:** every zone and card rect has `x, y, width, height` divisible by 8, zone padding is 32 and card gaps 40, no two cards overlap, and every card sits inside its zone (from the data module). The component renders 12 links whose hrefs each resolve to an existing docs page or route (the spec reads `apps/website/content/docs` and `src/app`). Public-copy scan stays green.
- **e2e (`home-architecture.spec.ts`):** at 1440×900 every `<text>` in the diagram has a `getBBox()` inside its parent card's rect with 8px of margin, every chip rect is inside its card, every `<image>` loaded (`naturalWidth`/complete via the parent's `getBBox` non-zero), and the section's links have the expected hrefs. At 390px the frame scrolls horizontally and the SVG is at least 1024px wide.
- **Visual sign-off:** rendered frames at 1440 and 390 shown to the user before the PR merges; the PR is opened without auto-merge.
- **Spine test:** the homepage heading order replaces `why-heading` with `architecture-heading`.

## 6. Out of scope

Hover interactions, a mobile-specific stacked variant, sourcing the LangSmith mark, changes to the docs pages linked.
