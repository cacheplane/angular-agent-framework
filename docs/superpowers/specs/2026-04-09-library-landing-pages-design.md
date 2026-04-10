# Library Landing Pages & Home Page Refactor

**Date:** 2026-04-09
**Status:** Approved

## Overview

Create 3 bespoke library landing pages (`/angular`, `/render`, `/chat`), refactor the home page to replace the stacked diagram with teaser cards, generate 3 library-specific whitepapers, add drip email campaigns, update the footer with a Libraries column, and merge the mobile docs nav into the main mobile menu.

## Goals

- Give each library a dedicated, go-to-market-focused landing page targeting enterprise decision makers
- Spark developer interest on the home page with concise teaser cards
- Generate library-specific whitepapers as primary conversion assets
- Improve mobile UX by consolidating two separate mobile menus into one
- Enable SEO/bot discovery of library pages via footer links

---

## 1. Home Page Refactor

### Replace FullStackSection with LibrariesSection

Remove the current `FullStackSection` component (3-layer stacked diagram with connectors, problem/solution blocks, and roadmap strip). Replace with a new `LibrariesSection` — a 3-card teaser grid.

**Remove entirely:** The roadmap strip (Now / Coming Soon / On the Horizon).

**New component: `LibrariesSection`**

```
Eyebrow:  "The Cacheplane Stack"
Headline: "Three libraries. One architecture."
Subtitle: "Everything your Angular team needs to ship AI agents to production."

3-card grid (responsive: 1 col mobile, 3 col desktop):

Card 1 — Angular (blue #004090)
  Package: @cacheplane/angular
  One-liner: "Signal-native streaming for LangGraph agents"
  Chips: agent(), provideAgent(), interrupt(), MockStreamTransport
  CTA: "Explore Angular →" → /angular

Card 2 — Render (green #1a7a40)
  Package: @cacheplane/render
  One-liner: "Agents that render UI — without coupling to your frontend"
  Chips: <render-spec>, defineAngularRegistry(), signalStateStore(), JSON patch
  CTA: "Explore Render →" → /render

Card 3 — Chat (purple #5a00c8)
  Package: @cacheplane/chat
  One-liner: "Batteries-included agent chat — fully featured from day one"
  Chips: <chat-messages>, <chat>, <chat-debug>, <chat-generative-ui>
  CTA: "Explore Chat →" → /chat
```

Each card uses glassmorphism styling consistent with the rest of the site. Cards are developer-focused — package name, value prop, API surface, clear link out.

### Home Page Section Order (updated)

1. HeroTwoCol
2. StatsStrip
3. ProblemSection
4. **LibrariesSection** (replaces FullStackSection)
5. ChatFeaturesSection
6. ValueProps
7. LangGraphShowcase
8. DeepAgentsShowcase
9. FairComparisonSection
10. WhitePaperSection (continues pointing to overview whitepaper.pdf)
11. HomePilotCTA
12. ArchDiagram

---

## 2. Library Landing Pages

Three new routes: `/angular`, `/render`, `/chat`. Each is a full bespoke conversion funnel page — not templated. Each follows the same section order but with entirely unique content.

### Section Structure (all 3 pages)

1. **LibraryHero** — Eyebrow (package name), headline, subheadline, primary CTA (whitepaper download), secondary CTA (docs), trust badges, library color accent
2. **ProblemSolution** — Two-column: "Without this" pain (red accent) vs "With @cacheplane/___" solution (green accent)
3. **FeaturesGrid** — 2-column grid of feature cards, each with embedded cockpit iframe showing live demo
4. **CodeShowcase** — 1-2 syntax-highlighted code snippets showing core API usage
5. **ComparisonTable** — Head-to-head comparison table specific to each library's competitive landscape
6. **WhitePaperGate** — Library-specific whitepaper download with email capture
7. **LibraryFooterCTA** — Primary: whitepaper. Secondary: pilot-to-prod. Tertiary: docs.

### Cockpit Iframe URLs

Each feature card embeds a cockpit iframe. The cockpit is hosted at `cockpit.cacheplane.ai`. Iframe URLs follow the pattern:

- Angular features: `https://cockpit.cacheplane.ai/{topic}/{capability}` — uses existing LangGraph and Deep Agent cockpit examples
- Render features: `https://cockpit.cacheplane.ai/render/{capability}` — uses the 6 existing render examples
- Chat features: `https://cockpit.cacheplane.ai/chat/{capability}` — uses the 5 scoped chat examples

Exact URLs will be resolved during implementation by mapping to existing cockpit routes.

### Page ambient styling

Each page uses the same ambient gradient blob pattern as the home page and pilot-to-prod page, with the library's color influencing the gradient tones.

---

### 2a. `/angular` — Agent Streaming Core

**Hero:**
- Eyebrow: `@cacheplane/angular`
- Headline: "Ship LangGraph agents in Angular — without building the plumbing"
- Subheadline: "Signal-native streaming, thread persistence, interrupts, and deterministic testing. The complete agent primitive layer for Angular 20+."
- Primary CTA: "Download the Guide" → `/whitepapers/angular.pdf`
- Secondary CTA: "View Docs" → `/docs`
- Trust badges: Angular 20+, LangGraph, LangChain, DeepAgent
- Color: Blue (#004090)

**ProblemSolution:**
- Without: "Your LangGraph agent works. Your Angular frontend doesn't stream it." — zone.js pain, manual subscription management, custom SSE wiring, OnPush incompatibility, no test story
- With: "agent() gives you production-ready streaming on day one." — signals-native, OnPush compatible, built-in thread persistence, interrupt handling, MockStreamTransport

**FeaturesGrid (6 cards with cockpit iframes):**
1. `agent()` API — basic streaming demo
2. Thread persistence — thread list + resume demo
3. Interrupt handling — approval flow demo
4. Tool call support — tool execution states demo
5. Time travel — state history navigation demo
6. DeepAgent support — multi-agent orchestration demo

**CodeShowcase (2 snippets):**
- Minimal `agent()` setup (8-10 lines)
- `provideAgent()` configuration with thread persistence (10-12 lines)

**ComparisonTable: "LangGraph Angular SDK vs @cacheplane/angular"**

Head-to-head against the recently released official LangGraph Angular SDK:

| Capability | LangGraph Angular SDK | @cacheplane/angular |
|---|---|---|
| SSE streaming | Manual wiring | Signal-native via agent() |
| State management | Custom signals | Built-in reactive state |
| Thread persistence | DIY localStorage | Built-in threadId signal + restore |
| Interrupt handling | Manual Command.RESUME | interrupt() signal + approve/edit/cancel |
| Tool call rendering | Raw events | Structured tool call state |
| Time travel | Not included | Built-in state history |
| Testing | Against live API | MockStreamTransport, offline, <100ms |
| OnPush compatibility | Requires workarounds | Native signal support |
| DeepAgent support | Not included | Full multi-agent orchestration |

**WhitePaperGate:** "The Enterprise Guide to Agent Streaming in Angular"
**FooterCTA:** Primary: whitepaper. Secondary: pilot-to-prod. Tertiary: docs.

---

### 2b. `/render` — Generative UI

**Hero:**
- Eyebrow: `@cacheplane/render`
- Headline: "Agents that render UI — without coupling to your frontend"
- Subheadline: "Built on Vercel's json-render spec — an open standard you already trust. @cacheplane/render brings it to Angular with streaming JSON patches, component registries, and signal-native state."
- Primary CTA: "Download the Guide" → `/whitepapers/render.pdf`
- Secondary CTA: "View Docs" → `/docs`
- Trust badges: Angular 20+, Vercel json-render, JSON Patch streaming
- Color: Green (#1a7a40)

**ProblemSolution:**
- Without: "Every new agent output means a new frontend deploy." — hardcoded component logic per agent, tight coupling blocks iteration, can't swap UI without rewriting agent, no streaming for progressive updates
- With: "The agent emits a spec. Your registry renders it." — declarative, decoupled, hot-swappable components, no frontend deploy for new agent capabilities, progressive JSON patch streaming

**FeaturesGrid (6 cards with cockpit iframes — maps to existing render examples):**
1. Spec rendering — basic `<render-spec>` demo
2. Element rendering — component mapping demo
3. State management — `signalStateStore()` demo
4. Component registry — `defineAngularRegistry()` demo
5. Repeat loops — list rendering demo
6. Computed functions — reactive derived values demo

**CodeShowcase (2 snippets):**
- `defineAngularRegistry()` setup (8-10 lines)
- `<render-spec>` template binding (6-8 lines)

**ComparisonTable: "Hardcoded agent UI vs @cacheplane/render"**

| Capability | Hardcoded Approach | @cacheplane/render |
|---|---|---|
| New agent output | Frontend deploy required | Spec change only, no deploy |
| Component swapping | Rewrite agent + frontend | Swap registry entry |
| Streaming updates | Manual DOM manipulation | JSON patch streaming, automatic |
| Testing specs | Integration tests only | Unit test specs in isolation |
| Frontend/agent coupling | Tight — changes break both | Decoupled via spec contract |
| Iteration speed | Days per change | Minutes per change |
| Open standard | Proprietary format | Vercel json-render spec |

**WhitePaperGate:** "The Enterprise Guide to Generative UI in Angular"
**FooterCTA:** Primary: whitepaper. Secondary: pilot-to-prod. Tertiary: docs.

---

### 2c. `/chat` — Chat UI Components

**Hero:**
- Eyebrow: `@cacheplane/chat`
- Headline: "Production agent chat UI in days, not sprints"
- Subheadline: "The batteries-included Angular chat library. Built on the agent framework, Vercel's json-render spec, and Google's A2UI spec. Every feature included — debug, theming, generative UI, streaming — from day one."
- Primary CTA: "Download the Guide" → `/whitepapers/chat.pdf`
- Secondary CTA: "View Docs" → `/docs`
- Trust badges: Angular 20+, Vercel json-render, Google A2UI, WCAG accessible
- Color: Purple (#5a00c8)

**ProblemSolution:**
- Without: "Every team rebuilds the same chat UI. It takes 4-6 weeks and delays the real agent work." — message rendering, streaming indicators, input handling, accessibility, responsive layout, generative UI, debug tooling — all from scratch, sprint after sprint
- With: "Fully featured from day one. No feature backlog." — pre-built components, json-render spec support via @cacheplane/render, Google A2UI spec support, debug tooling, theming, accessibility — all included, not add-ons

**FeaturesGrid (5 cards with cockpit iframes):**
1. Messages — streaming message display demo
2. Input — chat input with send/interrupt demo
3. Generative UI — inline spec rendering in chat (json-render + A2UI) demo
4. Theming — design token customization demo
5. Debug — agent state inspector demo

**CodeShowcase (2 snippets):**
- `<chat>` prebuilt usage (6-8 lines)
- Custom theming with CSS custom properties (8-10 lines)

**ComparisonTable: "Incrementally building chat vs @cacheplane/chat"**

| Capability | Build Incrementally | @cacheplane/chat |
|---|---|---|
| Message rendering | Sprint 1 | Included |
| Streaming indicators | Sprint 1 | Included |
| Input handling | Sprint 2 | Included |
| Accessibility (WCAG) | Sprint 2-3 | Included |
| Theming / design system | Sprint 3 | Included (CSS custom properties) |
| Generative UI (json-render) | Sprint 4+ | Included (via @cacheplane/render) |
| Google A2UI spec | Sprint 5+ | Included |
| Debug tooling | Often never | Included |
| Time to production | 4-6 weeks | Days |

**WhitePaperGate:** "The Enterprise Guide to Agent Chat Interfaces in Angular"
**FooterCTA:** Primary: whitepaper. Secondary: pilot-to-prod. Tertiary: docs.

---

## 3. Whitepaper Generation Pipeline

### Script Refactor

Refactor `apps/website/scripts/generate-whitepaper.ts` from a single hardcoded whitepaper into a multi-whitepaper pipeline.

**Config structure:**
```typescript
const WHITEPAPERS: Record<string, WhitepaperConfig> = {
  overview: { title, subtitle, coverColor, chapters[] },  // existing
  angular:  { title, subtitle, coverColor, chapters[] },
  render:   { title, subtitle, coverColor, chapters[] },
  chat:     { title, subtitle, coverColor, chapters[] },
};
```

**CLI usage:**
- `npm run generate-whitepaper` → generates all 4
- `npm run generate-whitepaper -- --paper angular` → generates one

**Output files:**
- `public/whitepaper.pdf` — existing overview (unchanged path for backwards compat)
- `public/whitepapers/angular.pdf`
- `public/whitepapers/render.pdf`
- `public/whitepapers/chat.pdf`

### Chapter Definitions

**"The Enterprise Guide to Agent Streaming in Angular" (angular.pdf) — 6 chapters:**

1. **The Last-Mile Problem** — LangGraph backend works, Angular frontend is the gap. Why SSE + zones + signals is hard. The cost of building it yourself.
2. **The agent() API** — Signal-native streaming, `agent()`, `provideAgent()`, reactive state management. Code examples showing minimal setup.
3. **Thread Persistence & Memory** — `threadId` signal, localStorage restore, thread list UI, LangGraph MemorySaver integration. Production conversation management.
4. **Interrupt & Approval Flows** — `interrupt()` signal, Command.RESUME, approve/edit/cancel patterns. Production human-in-the-loop for consequential actions.
5. **Full LangGraph Feature Coverage** — Tool calls, subgraphs, time travel, DeepAgent support. Why partial coverage isn't production-ready. Comparison with LangGraph Angular SDK.
6. **Deterministic Testing** — MockStreamTransport, `createMockStreamResourceRef()`, offline CI, sub-100ms tests. Why testing against live APIs doesn't scale.

**"The Enterprise Guide to Generative UI in Angular" (render.pdf) — 5 chapters:**

1. **The Coupling Problem** — Why hardcoding agent output to component logic blocks iteration. The cost of tight coupling between agent and frontend.
2. **Declarative UI Specs & the json-render Standard** — Vercel's json-render spec, how agents emit structured UI without knowing the frontend. Open standard trust.
3. **The Component Registry** — `defineAngularRegistry()`, `<render-spec>`, mapping specs to Angular components. Swap components without touching the agent.
4. **Streaming JSON Patches** — Progressive UI updates, rows appearing as data arrives, partial-json parsing, skeleton states. Real-time rendering.
5. **State Management & Computed Functions** — `signalStateStore()`, computed properties, repeat loops, reactive spec rendering. Dynamic, interactive generative UI.

**"The Enterprise Guide to Agent Chat Interfaces in Angular" (chat.pdf) — 5 chapters:**

1. **The Sprint Tax** — Every team rebuilds chat UI from scratch. 4-6 weeks of work that delays agent development. The compounding cost across teams.
2. **Batteries-Included Components** — `<chat-messages>`, `<chat>`, the component model. Every feature from day one — not a feature backlog.
3. **Theming & Design System Integration** — CSS custom properties, design tokens, integrating with enterprise design systems. Brand-consistent agent UI.
4. **Generative UI in Chat** — json-render spec (via @cacheplane/render) and Google A2UI spec support out of the box. Inline spec rendering in conversation.
5. **Debug Tooling** — `<chat-debug>`, inspecting agent state, messages, tool calls in development. Ship with confidence. Why most teams skip this and regret it.

### Cover Page Customization

Each whitepaper gets a unique cover:
- **Overview:** Existing gradient (pink → purple → blue)
- **Angular:** Blue-dominant gradient, "The Enterprise Guide to Agent Streaming in Angular"
- **Render:** Green-dominant gradient, "The Enterprise Guide to Generative UI in Angular"
- **Chat:** Purple-dominant gradient, "The Enterprise Guide to Agent Chat Interfaces in Angular"

---

## 4. Drip Email Campaigns

### Existing Pattern

The current drip campaign (`emails/drip-whitepaper-followup.ts`) sends 4 emails on days 2, 5, 10, and 20 after whitepaper download. Each escalates from engagement → education → product → sales conversation.

### New Campaigns

Create 3 new drip campaign files, one per library whitepaper. Each follows the same 4-email, 20-day cadence but with library-specific content.

**Angular drip (`emails/drip-angular-followup.ts`):**
- Day 2: "Did you read Chapter 2 on the agent() API?" — highlights the core API, links to docs
- Day 5: "LangGraph Angular SDK vs @cacheplane/angular" — comparison narrative, links to `/angular`
- Day 10: "The pilot program includes hands-on integration" — pilot program intro, links to `/pilot-to-prod`
- Day 20: "Ready to ship your LangGraph agent? Let's talk." — soft sales outreach

**Render drip (`emails/drip-render-followup.ts`):**
- Day 2: "Did you read Chapter 2 on declarative UI specs?" — highlights Vercel json-render, links to docs
- Day 5: "Why tight coupling between agents and UI kills iteration speed" — problem narrative, links to `/render`
- Day 10: "The pilot program includes hands-on integration" — pilot program intro, links to `/pilot-to-prod`
- Day 20: "Ready to decouple your agent UI? Let's talk." — soft sales outreach

**Chat drip (`emails/drip-chat-followup.ts`):**
- Day 2: "Did you read Chapter 2 on batteries-included components?" — highlights feature breadth, links to docs
- Day 5: "The sprint tax: why every team rebuilds chat from scratch" — problem narrative, links to `/chat`
- Day 10: "The pilot program includes hands-on integration" — pilot program intro, links to `/pilot-to-prod`
- Day 20: "Ready to ship your agent chat? Let's talk." — soft sales outreach

### Download Confirmation Emails

3 new download confirmation emails (`emails/angular-download.ts`, `emails/render-download.ts`, `emails/chat-download.ts`) following the existing `whitepaper-download.ts` pattern but with library-specific chapter summaries and download links.

### API Route Update

Update `/api/whitepaper-signup` to accept a `paper` field indicating which whitepaper was downloaded. This enables routing to the correct drip campaign. The NDJSON log gets the `paper` field appended to each entry.

---

## 5. Footer Update

### Add Libraries Column

The footer grid changes from `md:grid-cols-4` to `md:grid-cols-5`. A new **Libraries** column is added between Product and Resources:

```
Brand (2 cols)    Product       Libraries     Resources
────────────────  ──────────    ──────────    ──────────
[brand content]   Documentation Angular       Getting Started
                  API Reference Render        npm Package
                  Examples      Chat          Commercial License
                  Pricing
                  GitHub
```

All 3 library links are internal `<Link>` components pointing to `/angular`, `/render`, `/chat` — crawlable for SEO and bot discovery.

---

## 6. Mobile Navigation Integration

### Problem

On mobile (< 768px), docs pages currently have two separate expandable menus:
1. The main header hamburger (site links: Pilot to Prod, Docs, Examples, etc.)
2. A separate `DocsMobileNav` component rendered in the docs content area (docs sections: Getting Started, Guides, Concepts, API Reference)

This is confusing — users must discover and use two different menus.

### Solution

Merge both menus into the main header hamburger. When on a docs page, the mobile menu shows:

```
─── Site ───
Pilot to Prod
Docs
Examples
Pricing
GitHub
Get Started

─── divider ───

─── Documentation ───
▸ Getting Started
  Introduction
  Quick Start
  Installation
▸ Guides
  Streaming
  Persistence
  ...
▸ Concepts
  ...
▸ API Reference
  ...
```

**Implementation:**
- `Nav.tsx` becomes context-aware: it checks the current pathname. If on a `/docs/*` route, it renders the docs sections below the site links in the mobile menu.
- `Nav.tsx` imports `docsConfig` from `docs-config.ts` — single source of truth.
- Docs sections are collapsible (same accordion behavior as current `DocsMobileNav`).
- Active docs page gets accent color highlight.
- `DocsMobileNav` component is removed from the docs page layout.
- Desktop behavior is completely unchanged.

---

## 7. Follow-Up Tasks (Out of Scope)

- **Consolidate @cacheplane/stream-resource into @cacheplane/angular** — merge the base primitives library into the agent library so there are truly 3 libraries, not 4. Tracked as a separate task.
- **Editorial review of generated whitepaper content** — the pipeline generates content via Claude API; human review of tone, accuracy, and messaging is a follow-up.

---

## File Map

### New Files
- `apps/website/src/app/angular/page.tsx` — Angular landing page
- `apps/website/src/app/render/page.tsx` — Render landing page
- `apps/website/src/app/chat/page.tsx` — Chat landing page
- `apps/website/src/components/landing/LibrariesSection.tsx` — Home page teaser cards
- `apps/website/src/components/landing/AngularHero.tsx`
- `apps/website/src/components/landing/AngularProblemSolution.tsx`
- `apps/website/src/components/landing/AngularFeaturesGrid.tsx`
- `apps/website/src/components/landing/AngularCodeShowcase.tsx`
- `apps/website/src/components/landing/AngularComparison.tsx`
- `apps/website/src/components/landing/AngularWhitePaperGate.tsx`
- `apps/website/src/components/landing/AngularFooterCTA.tsx`
- `apps/website/src/components/landing/RenderHero.tsx`
- `apps/website/src/components/landing/RenderProblemSolution.tsx`
- `apps/website/src/components/landing/RenderFeaturesGrid.tsx`
- `apps/website/src/components/landing/RenderCodeShowcase.tsx`
- `apps/website/src/components/landing/RenderComparison.tsx`
- `apps/website/src/components/landing/RenderWhitePaperGate.tsx`
- `apps/website/src/components/landing/RenderFooterCTA.tsx`
- `apps/website/src/components/landing/ChatLandingHero.tsx`
- `apps/website/src/components/landing/ChatLandingProblemSolution.tsx`
- `apps/website/src/components/landing/ChatLandingFeaturesGrid.tsx`
- `apps/website/src/components/landing/ChatLandingCodeShowcase.tsx`
- `apps/website/src/components/landing/ChatLandingComparison.tsx`
- `apps/website/src/components/landing/ChatLandingWhitePaperGate.tsx`
- `apps/website/src/components/landing/ChatLandingFooterCTA.tsx`
- `apps/website/emails/drip-angular-followup.ts`
- `apps/website/emails/drip-render-followup.ts`
- `apps/website/emails/drip-chat-followup.ts`
- `apps/website/emails/angular-download.ts`
- `apps/website/emails/render-download.ts`
- `apps/website/emails/chat-download.ts`
- `public/whitepapers/angular.pdf` (generated)
- `public/whitepapers/render.pdf` (generated)
- `public/whitepapers/chat.pdf` (generated)

### Modified Files
- `apps/website/src/app/page.tsx` — Replace FullStackSection import with LibrariesSection
- `apps/website/src/components/shared/Footer.tsx` — Add Libraries column, grid-cols-5
- `apps/website/src/components/shared/Nav.tsx` — Mobile menu context-aware for docs
- `apps/website/src/app/docs/[[...slug]]/page.tsx` — Remove DocsMobileNav from layout
- `apps/website/scripts/generate-whitepaper.ts` — Multi-whitepaper config + CLI args
- `apps/website/src/app/api/whitepaper-signup/route.ts` — Accept `paper` field
- `package.json` — Update generate-whitepaper script if needed

### Deleted Files
- `apps/website/src/components/landing/FullStackSection.tsx` — Replaced by LibrariesSection
- `apps/website/src/components/docs/DocsMobileNav.tsx` — Merged into Nav.tsx mobile menu
