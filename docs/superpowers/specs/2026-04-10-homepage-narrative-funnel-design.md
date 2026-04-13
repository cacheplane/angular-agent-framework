# Homepage Narrative Funnel Redesign

**Date:** 2026-04-10
**Status:** Draft

## Summary

Redesign the home page from an 11-section showcase into a focused 7-section narrative funnel: Problem → Solution → Stack → CTA. The page tells one story and routes visitors to dedicated landing pages for depth.

## Motivation

The current home page is long (11 sections) and includes deep interactive demos (ChatFeaturesSection, LangGraphShowcase, DeepAgentsShowcase) that duplicate content available on dedicated library landing pages. The Pilot-to-Prod program — the core solution to the "last mile" problem — appears only as a weak CTA near the bottom. The architecture diagram adds technical credibility but doesn't drive conversions.

The redesign positions Cacheplane's narrative clearly: here's the problem → here's how we solve it → here's what you get → let's go.

## New Page Flow

```
HeroTwoCol → StatsStrip → ProblemSection → PilotSolution → TheStack → WhitePaperSection → StopStallingCTA
```

### Removed sections
- `LibrariesSection` — replaced by TheStack (more substance)
- `ChatFeaturesSection` — interactive demo lives on `/chat` landing page
- `ValueProps` ("Why agent()?") — folded into TheStack's Agent card
- `LangGraphShowcase` — capability detail lives on `/angular` landing page
- `DeepAgentsShowcase` — capability detail lives on `/angular` landing page
- `HomePilotCTA` — replaced by StopStallingCTA (stronger design)
- `ArchDiagram` — dropped entirely

### Kept as-is
- `HeroTwoCol` — hero with GenerativeUIFrame demo
- `StatsStrip` — credibility stats
- `ProblemSection` — last-mile gap narrative with animated progress bar
- `WhitePaperSection` — lead gen form + guide description

### Ambient gradient blobs
Reduced from 7 to 4 (page is shorter). Positions adjusted to cover the new section layout.

## New Components

### 1. `PilotSolution`

**File:** `apps/website/src/components/landing/PilotSolution.tsx`
**Type:** Client component (`'use client'` — uses framer-motion)
**Position:** Directly after ProblemSection — the "answer" to the 50% failure stat.

#### Layout
- Eyebrow: `THE SOLUTION` — mono font, accent blue (`tokens.colors.accent`), uppercase
- Headline: "From proof of concept to production in 90 days" — EB Garamond, `clamp(26px, 3.5vw, 46px)`
- Subtitle: italic, "The structured pilot engagement that closes the last-mile gap."
- 3 step cards in a horizontal row (responsive: stack on mobile)
- CTA button: "Explore the Pilot Program →" → `/pilot-to-prod`
- Fine print: "Included with every app deployment license"

#### Step cards
Each card uses glassmorphism (`tokens.glass.*`) consistent with ProblemSection stat cards.

| # | Title | Description |
|---|-------|-------------|
| 1 | Pilot | We assess your LangGraph agent and Angular codebase. You get a concrete production plan. |
| 2 | Build | We work alongside your team to integrate the framework. Streaming, generative UI, testing — done right. |
| 3 | Ship | Your agent goes to production with your team owning every line. No vendor lock-in, no black boxes. |

Each card has:
- A numbered circle (accent blue bg, white text, 32px)
- Title in Inter, 600 weight
- Description in Inter, `tokens.colors.textSecondary`

#### Styling
- Section padding: `80px 32px`
- Content max-width: `840px` (matches ProblemSection)
- Step cards grid: `repeat(auto-fit, minmax(220px, 1fr))` with `gap: 16px`
- CTA: `tokens.colors.accent` background, white text, 6px border-radius, centered
- Responsive: cards stack to single column on mobile

### 2. `TheStack`

**File:** `apps/website/src/components/landing/TheStack.tsx`
**Type:** Client component (`'use client'` — uses framer-motion for scroll animations)
**Position:** After PilotSolution. The product showcase.

#### Layout
- Eyebrow: `THE CACHEPLANE STACK` — mono font, accent blue
- Headline: "Three libraries. One architecture. Every layer you need." — EB Garamond
- Subtitle: "Your LangGraph agent already works. These three libraries ship it."
- 3 cards in vertical stack with connecting lines between them
- Max-width: `860px`, centered

#### Cards

Cards are stacked vertically (not a 3-col grid) to reinforce the layering metaphor. Between each card, a thin gradient connector line (2px, ~24px tall) transitions from the upper card's color to the lower card's color.

Each card structure:
- Tag pill (white text on library color, uppercase mono, same style as current LibrariesSection)
- Package name (mono, library color, 0.76rem)
- Headline (EB Garamond, 700 weight, `tokens.colors.textPrimary`)
- Value prop paragraph (Inter, `tokens.colors.textSecondary`, ~2 sentences)
- Differentiator pills row (mono, tinted bg/border matching library color)
- CTA link: "Explore [Name] →" (mono, library color, no decoration)

**Card 1 — Agent** (color: `tokens.colors.accent` / `#004090`, rgb: `0,64,144`):
- Tag: `AGENT`
- Package: `@cacheplane/angular`
- Headline: "The reactive bridge to LangGraph"
- Value prop: "Signal-native streaming connects your Angular templates directly to LangGraph agent state. Interrupts, persistence, time-travel, and branch history — every LangGraph feature has a first-class Angular API. Test deterministically with MockAgentTransport."
- Pills: `Angular Signals` · `LangGraph Cloud` · `MockAgentTransport`
- CTA: "Explore Agent →" → `/angular`

**Card 2 — Render** (color: `tokens.colors.renderGreen` / `#1a7a40`, rgb: `26,122,64`):
- Tag: `GEN UI`
- Package: `@cacheplane/render`
- Headline: "Agents that render UI — on open standards"
- Value prop: "Built on Vercel's json-render spec and Google's A2UI protocol. Your agent emits a render spec, your Angular components render it — with streaming JSON patches, component registries, and signal-native state. No coupling between agent logic and frontend."
- Pills: `Vercel json-render` · `Google A2UI` · `JSON Patch streaming`
- CTA: "Explore Render →" → `/render`

**Card 3 — Chat** (color: `tokens.colors.chatPurple` / `#5a00c8`, rgb: `90,0,200`):
- Tag: `CHAT`
- Package: `@cacheplane/chat`
- Headline: "Production chat UI in days, not sprints"
- Value prop: "Every component you need — streaming messages, tool call cards, interrupt panels, generative UI, debug overlay, theming — pre-built, composable, and WCAG accessible. Built on the Agent and Render libraries so everything works together from day one."
- Pills: `<chat-messages>` · `<chat-debug>` · `WCAG accessible`
- CTA: "Explore Chat →" → `/chat`

#### Card styling
- Background: `rgba(${rgb}, 0.03)`
- Border: `1px solid rgba(${rgb}, 0.15)`
- Border-radius: `14px`
- Padding: `28px 28px 24px`
- Each card animates in with framer-motion (`opacity: 0, y: 24` → visible) with staggered delay

#### Connector lines
Between each card, a centered vertical line:
- Width: `2px`, height: `28px`
- Background: `linear-gradient(to bottom, rgba(${upperRgb}, 0.3), rgba(${lowerRgb}, 0.3))`
- Centered horizontally within the max-width container

### 3. `StopStallingCTA` (reuse of `PilotFooterCTA`)

**File:** No new file — reuse `apps/website/src/components/landing/PilotFooterCTA.tsx`
**Position:** Final section on the page, after WhitePaperSection.

We import and render `PilotFooterCTA` directly in `page.tsx`. The component is already self-contained with the correct design:

- Dark background: `linear-gradient(135deg, #1a1a2e 0%, #0d1b3e 100%)`
- Eyebrow: "Ready when you are"
- Headline: "Ready to stop stalling?"
- Subtext with Gartner citation
- Primary CTA: "Start Your Pilot →" → `#whitepaper-gate`
- Secondary CTA: "Download the Guide" → `/whitepaper.pdf`
- Fine print: pricing info

**One change:** Update the primary CTA `href` from `#whitepaper-gate` to `/pilot-to-prod` so it drives to the pilot page rather than scrolling to the whitepaper form (which is directly above it on the page and redundant as a CTA target).

## Changes to `page.tsx`

```tsx
import { HeroTwoCol } from '../components/landing/HeroTwoCol';
import { StatsStrip } from '../components/landing/StatsStrip';
import { ProblemSection } from '../components/landing/ProblemSection';
import { PilotSolution } from '../components/landing/PilotSolution';
import { TheStack } from '../components/landing/TheStack';
import { WhitePaperSection } from '../components/landing/WhitePaperSection';
import { PilotFooterCTA } from '../components/landing/PilotFooterCTA';
import { tokens } from '../../lib/design-tokens';

export default async function HomePage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* 4 ambient gradient blobs */}
      <HeroTwoCol />
      <StatsStrip />
      <ProblemSection />
      <PilotSolution />
      <TheStack />
      <WhitePaperSection />
      <PilotFooterCTA />  {/* "Ready to stop stalling?" dark CTA */}
    </div>
  );
}
```

## Files changed

| Action | File |
|--------|------|
| Create | `apps/website/src/components/landing/PilotSolution.tsx` |
| Create | `apps/website/src/components/landing/TheStack.tsx` |
| Edit | `apps/website/src/app/page.tsx` — new flow, reduced blobs |
| Edit | `apps/website/src/components/landing/PilotFooterCTA.tsx` — change primary CTA href from `#whitepaper-gate` to `/pilot-to-prod` |

## Files NOT deleted

Existing components (LibrariesSection, ChatFeaturesSection, ValueProps, LangGraphShowcase, DeepAgentsShowcase, HomePilotCTA, ArchDiagram) are not deleted — they are simply no longer imported by the home page. They may still be used by other pages or re-used in the future.
