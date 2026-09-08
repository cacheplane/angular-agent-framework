# Enterprise architecture diagram on the homepage

**Date:** 2026-09-07
**Status:** Built on `blove/architecture-diagram` (PR #1048). Iterated through eight mockups and four review passes with the user; the final direction scaled the three-zone enterprise map back to this four-column flow. Merge is gated on the user's visual sign-off.
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

`apps/website/src/components/landing/EnterpriseArchitecture.tsx`, a server component rendering one `<svg viewBox="0 0 1280 640">` inside the kit's `DiagramFrame` at `scale="marketing"`, framed by `DiagramSection`. Logos are `<image href="/logos/...">` referencing the public files; line icons are inline paths in the component. The geometry lives in a data module, `apps/website/src/lib/architecture-diagram.ts`, as typed card/arrow/strip records, so the component, the unit spec and the e2e all read the same numbers.

Row kinds: `text`, `mono`, `caps` (the Threadplane card's five capability links), `badge` (a mark with a label), `marks` (a row of mark tiles), and `items` — the banded list used by the adapter and agent cards, one soft band per line with a left accent bar, white-on-tint inside a highlighted card.

Ground: a faint radial gradient under the kit's dot pattern, with the dots one step lighter than the docs default, so the figure reads as a surface.

**Grid.** Four columns 64 apart, 48px margins on all four sides, stacked cards 40 apart, every arrow 64 long landing on the vertical centre of the card it enters, and the two paired cards in each row sharing their tops, heights and row positions. The People card's block is centred on its card, where its arrow leaves.

**Phone form.** Under 768px the SVG is hidden and `ArchitectureStack` renders the same cards as an HTML stack in reading order, from the same data module, so the two forms cannot drift.

## 5. Verification

- **Unit:** every card rect is divisible by 8 and sits inside the view's margin; stacked cards are 40 apart; no two cards overlap; the users and Threadplane cards span the adapter stack exactly; every column gap is equal; the left, right and bottom margins match and the model strip starts at the first column; every arrow is one length and lands on the vertical centre of the card it enters; the paired cards share their tops, heights and first row positions; every row sits inside its card. Every href resolves to a docs page or route on disk, and every mark exists under `/logos`. Public-copy scan stays green.
- **e2e (`home-architecture.spec.ts`):** at 1440×900, with fonts loaded, every `<text>` and every chip rect in the diagram has a `getBBox()` inside its own card with margin, every `<image>` has a non-zero box, and the cards carry the expected hrefs. At 390px the HTML stack is visible, the SVG is hidden, it renders one card per data entry, and the page has no horizontal scroll.
- **Visual sign-off:** rendered frames at 1440 and 390 shown to the user before the PR merges; the PR is opened without auto-merge.
- **Spine test:** the homepage heading order replaces `why-heading` with `architecture-heading`.

## 6. Out of scope

Hover interactions beyond the links, animation, changes to the docs pages linked. LangSmith has no mark under the site's sourcing rules (Simple Icons carries no `langsmith` slug), so its card uses the LangChain mark and the logo README records why; swapping in a real LangSmith SVG is a later one-line change.
