# Enterprise architecture diagram on the homepage

**Date:** 2026-09-07
**Status:** Design approved in brainstorming (iterated through six mockups with the user); implementation gated on the user's visual sign-off before merge.
**Surface:** `apps/website` only.
**Replaces:** the "Where Threadplane fits" section (`ScopeTable`, section id `why`) on the homepage. `ScopeTable` and the `FINAL_MILE_*` copy leave with it.

## 1. Why

The homepage tells a developer what Threadplane does (the stage) but not where it sits in the estate they already run. Buyers need one picture they can find themselves in: their users, their Angular application with Threadplane as its UI layer, the adapter to their runtime, their agents, and their model provider, each by its mark. The old scope table answered "what do we add" as prose; the diagram answers "where does it go" spatially, which is the final-mile argument made visible.

## 2. Decisions

| Decision | Choice |
|---|---|
| Framing | A left-to-right flow for a buyer scanning for their own logos: your users, your Angular application with Threadplane as its UI layer, the two adapters, your agents, and a strip of model providers beneath. The earlier three-zone enterprise map was drawn, reviewed, and scaled back at the user's direction: less text, broader architecture, more marks. |
| Source of truth for contents | The docs. Every card links to the page that backs its wording. Named third-party products are examples of a role, never integrations Threadplane claims. |
| The first-class lane | The LangGraph SDK adapter is highlighted like Threadplane and tagged FIRST-CLASS, listing what the docs reserve for a checkpoint-aware runtime beyond the AG-UI event stream: time travel and branch, memory and subgraphs, durable execution. The AG-UI card lists events, tool calls, state, interrupts. |
| Marks | Only marks held under `apps/website/public/logos/` (README documents sources). LangSmith uses the LangChain mark from Simple Icons, which has no LangSmith slug; the README records that. Generic roles get a line icon in a tinted badge. |
| Precision | Coordinates on an 8px grid with 40px majors; a hidden alignment grid is part of the component for review; a unit spec asserts every card on the grid inside the view, no overlaps, 40px stack gaps, arrows leaving and entering card edges, and every href resolving; an e2e measures every rendered text run and chip inside its card. |
| Colour | The kit's dot grid, white cards with a faint vertical gradient, a light blue tint with a blue hairline for the two highlighted cards. No zone fills. |
| Interaction | Cards are links to their docs pages; the Threadplane card's five capabilities are their own links, so its title carries the card link (anchors do not nest). No hover states beyond links, no animation. |
| Placement | Where the scope table was: between Reliability and the stage. Eyebrow "Architecture", headline "The UI layer between your users and your agents.", body "Threadplane lives inside your Angular application and talks to your agents through the LangGraph SDK or AG-UI. Everything on the right is yours." |
| Responsive | The SVG scales with its container down to 1024px; below that it scrolls horizontally inside the diagram frame at a 1024px minimum width. |

## 3. Contents

Column labels: YOUR USERS, YOUR ANGULAR APPLICATION, ADAPTERS, YOUR AGENTS.

- **People** (users icon): "web · mobile · desktop". Links `/docs/chat/getting-started/introduction`.
- **Threadplane** (Angular mark, "YOUR ANGULAR APP", tag THE UI LAYER): five capability links, Chat, Approvals, Threads, Generative UI, Client tools (`/docs/chat/components/chat`, `/docs/langgraph/guides/interrupts`, `/docs/langgraph/guides/persistence`, `/docs/chat/guides/generative-ui`, `/docs/chat/guides/client-tools`); A2UI (Google mark) and json-render (Vercel mark); the package line `@threadplane/chat · render · langgraph · ag-ui`. Title links `/docs/chat/getting-started/introduction`.
- **LangGraph SDK** (LangGraph mark, tag FIRST-CLASS, highlighted): "threads · checkpoints", "interrupts · streaming", "time travel · branch", "memory · subgraphs", "durable execution". Links `/docs/langgraph/getting-started/introduction`.
- **AG-UI protocol** (AG-UI mark): "events · tool calls", "state · interrupts". Links `/docs/ag-ui/getting-started/introduction`.
- **LangSmith** (LangChain mark): "deploy · observe", "LangGraph agents", "traces · evals", "or self-hosted". Links `/docs/langgraph/guides/deployment`.
- **AG-UI servers**: five marks, CrewAI, Mastra, Microsoft, AWS (Strands), Pydantic AI, then "CrewAI · Mastra · Microsoft", "Strands · Pydantic AI". Links `/docs/runtimes/getting-started/introduction`.
- Arrows: users → Threadplane; Threadplane → each adapter with the caption "one Agent contract" between them; each adapter → its agents card.
- **ANY MODEL** strip: OpenAI, Anthropic, Google, Azure OpenAI, Amazon Bedrock as mark chips, caption "chosen by your runtime, never by the UI".

## 4. Component

`apps/website/src/components/landing/EnterpriseArchitecture.tsx`, a server component rendering one `<svg viewBox="0 0 1280 624">` inside the kit's `DiagramFrame` at `scale="marketing"`, framed by `DiagramSection`. Logos are `<image href="/logos/...">` referencing the public files. The diagram's geometry lives in a data module, `apps/website/src/lib/architecture-diagram.ts`, as typed card/arrow/strip records so the tests can read the same numbers the component draws. The line icons are inline paths in the component (five to seven, matching the mockup).

## 5. Verification

- **Unit:** every card rect has `x, y, width, height` divisible by 8 inside the view's 40px margin, stacked cards are 40 apart, no two cards overlap, the users and Threadplane cards span the adapter stack exactly, every arrow leaves one card edge and enters the next, and the model strip fits (from the data module). The component renders every link whose hrefs each resolve to an existing docs page or route (the spec reads `apps/website/content/docs` and `src/app`). Public-copy scan stays green.
- **e2e (`home-architecture.spec.ts`):** at 1440×900 every `<text>` in the diagram has a `getBBox()` inside its parent card's rect with 8px of margin, every chip rect is inside its card, every `<image>` loaded (`naturalWidth`/complete via the parent's `getBBox` non-zero), and the section's links have the expected hrefs. At 390px the frame scrolls horizontally and the SVG is at least 1024px wide.
- **Visual sign-off:** rendered frames at 1440 and 390 shown to the user before the PR merges; the PR is opened without auto-merge.
- **Spine test:** the homepage heading order replaces `why-heading` with `architecture-heading`.

## 6. Out of scope

Hover interactions, a mobile-specific stacked variant, sourcing the LangSmith mark, changes to the docs pages linked.
