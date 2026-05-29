# Docs Landing Page Redesign — Design

**Date:** 2026-05-29
**Status:** Draft for review
**Scope:** Redesign `apps/website/src/app/docs/page.tsx` (the `/docs` index).

## Goal

Make `/docs` an evaluator-first landing page that funnels a newcomer down an
opinionated "start here" path. The page leads with the decision that matters
most — which backend adapter — then layers on generative UI and chat, and keeps
utility libraries quietly available. Optimize for time-to-first-quickstart.

### Primary visitor

A developer discovering Threadplane for the first time. They do not yet know
which of the seven libraries they need. Success = they reach a quickstart for
the right backend with minimal hesitation.

## Approach

Chosen direction: **backend funnel** (Approach A). A linear, numbered "start
here" path rendered as stacked sections, with the backend choice as the first
and most prominent fork. Rejected alternatives: a "numbered journey" framing
(vague final step, forces unrelated libraries into a linear story) and an
"inline chooser hero" (buries AG-UI behind a toggle, fighting the two-equal-
backends reality).

## Page structure

Five stacked sections, top to bottom. Hero and step sections use
`surface="canvas"`; the final search prompt uses `surface="tinted"`. Step
sections after the hero use `tight` spacing (matching the current page).

### 1. Hero

- Eyebrow: `Documentation`
- H1: **Build AI agent UIs in Angular**
- Subcopy: "A suite of MIT-licensed libraries for streaming agent interfaces.
  Pick your backend to get started."
- No CTA button — the Step 1 fork below is the call to action.

### 2. Step 1 · Pick your backend

Two prominent, accent-bordered cards side by side (the visual focal point of
the page):

| Card | Blurb | Install snippet | Link |
|------|-------|-----------------|------|
| **LangGraph** | For LangChain / LangGraph backends | `npm i @threadplane/langgraph` | `/docs/langgraph/getting-started/quickstart` |
| **AG-UI** | CrewAI, Mastra, Pydantic AI, Strands… | `npm i @threadplane/ag-ui` | `/docs/ag-ui/getting-started/quickstart` |

Helper line below the fork, centered, muted:
"Not sure which to use? **Choosing an adapter →**" linking
`/docs/choosing-an-adapter`.

### 3. Step 2 · Generative UI

Two cards presenting the generative-UI fork, each labeled with its protocol
lineage:

| Card | Vendor label | Blurb | Link |
|------|--------------|-------|------|
| **A2UI** | Google | Agent-to-UI protocol — the agent streams and updates surfaces over the conversation. | `/docs/a2ui/getting-started/introduction` |
| **json-render** | Vercel | Render a fixed JSON spec into your own Angular components. You own the schema. | `/docs/render/getting-started/introduction` |

Helper line below: "Which fits my use case? **json-render vs A2UI →**" linking
`/docs/render/concepts/json-render-vs-a2ui`.

**Decision:** the A2UI card links to the standalone `a2ui` protocol library
intro (not render's A2UI section at `/docs/render/a2ui/overview`). Rationale:
keeps every library with exactly one home on the page, and the a2ui intro
orients the reader and links onward to render/chat. Easy to flip to the render
A2UI overview if preferred.

### 4. Step 3 · Chat UI

Single full-width card:

- **Chat** — "Drop-in chat components — message list, input, streaming, tool
  calls, interrupts, subagents. Renders A2UI & json-render surfaces inline."
- Link: `/docs/chat/getting-started/introduction`

### 5. Supporting libraries

Compact row of small cards:

| Card | Blurb | Link |
|------|-------|------|
| **Licensing** | Token verification | `/docs/licensing/getting-started/introduction` |
| **Telemetry** | Browser & Node events | `/docs/telemetry/getting-started/introduction` |

### 6. Search prompt

`surface="tinted"`, centered: "Looking for something specific? Press `⌘K` to
search the docs." (uses the `Pill` component for the `⌘K` chip, as today).

## Library coverage

All seven libraries have exactly one home on the page:

- Step 1: `langgraph`, `ag-ui`
- Step 2: `a2ui`, `render`
- Step 3: `chat`
- Supporting: `licensing`, `telemetry`

## Implementation

- **File:** rewrite `apps/website/src/app/docs/page.tsx`. Remains a server
  component — no client-side JavaScript required.
- **Primitives reused:** `Section`, `Container`, `Eyebrow`, `Card` (with
  `hoverable`), `Pill`, and `@threadplane/design-tokens`. No new dependencies.
- **Content as local typed arrays** in the page file, mirroring the existing
  `POPULAR_TOPICS` pattern:
  - `BACKENDS: { title; blurb; install; href }[]`
  - `GENERATIVE_UI: { vendor; title; blurb; href }[]`
  - `SUPPORTING: { title; blurb; href }[]`
  - Chat is a single inline card.
  The curated marketing copy stays bespoke here; `docsConfig` remains the
  source of truth for sidebar/routing and is not the driver of this page.
- **Install snippets:** rendered as static, token-styled inline `<code>`. **No
  copy-to-clipboard button** (keeps the page a pure server component). Can be
  added later as a small `'use client'` child if desired.
- **Metadata:** keep the existing `createPageMetadata` call (title/description
  unchanged unless we revisit copy).
- **Accessibility:** each section keeps an `ariaLabelledBy` heading. Backend and
  generative-UI forks are accent-bordered `Card`s wrapped in `next/link`.

## Testing

Update `apps/website/e2e/docs.spec.ts` to assert:

- The H1 "Build AI agent UIs in Angular".
- Section headings: "Pick your backend", "Generative UI", "Chat UI".
- Both backend links resolve to the langgraph and ag-ui quickstarts.
- Both generative-UI links resolve to the a2ui intro and render intro.
- The "Choosing an adapter" and "json-render vs A2UI" helper links are present.
- The `⌘K` search prompt is present.

## Out of scope

- Changes to the docs sidebar, routing, or `docsConfig`.
- Copy-to-clipboard interactivity (deferred).
- Any visual/brand changes beyond this page.
