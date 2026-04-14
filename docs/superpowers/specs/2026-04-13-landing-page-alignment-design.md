# Product Landing Page Alignment — Design Spec

**Date:** 2026-04-13
**Scope:** `/angular`, `/render`, `/chat` product landing pages
**Philosophy:** Evolve, don't rebuild. Layer home page patterns into existing pages where they strengthen the narrative.

---

## Summary

The home page was recently restructured into a 7-section narrative funnel with a strong dark footer CTA, unified stack section, and pilot program prominence. The three product landing pages (`/angular`, `/render`, `/chat`) still use the original patterns: weak glass-card footer CTAs, no stack awareness, no mobile breakpoints, and isolated messaging. This spec aligns the product pages with the home page's narrative without rebuilding them.

## Changes Overview

| Change | Scope | New Files |
|--------|-------|-----------|
| Hero stack breadcrumb | 3 files modified | None |
| WhitePaperGate copy refresh | 3 files modified | None |
| Footer CTA dark design upgrade | 3 files rewritten | None |
| Stack siblings section | 3 new components | 3 files created |
| Comparison light refresh | 3 files modified | None |
| Mobile responsiveness | All product page components | None |
| Internal route fix (`<a>` → `<Link>`) | Heroes + any other internal links | None |

## Files Changed

### Modified (existing)
- `apps/website/src/components/landing/angular/AngularHero.tsx`
- `apps/website/src/components/landing/angular/AngularWhitePaperGate.tsx`
- `apps/website/src/components/landing/angular/AngularFooterCTA.tsx`
- `apps/website/src/components/landing/angular/AngularComparison.tsx`
- `apps/website/src/components/landing/angular/AngularProblemSolution.tsx`
- `apps/website/src/components/landing/angular/AngularFeaturesGrid.tsx`
- `apps/website/src/components/landing/angular/AngularCodeShowcase.tsx`
- `apps/website/src/components/landing/render/RenderHero.tsx`
- `apps/website/src/components/landing/render/RenderWhitePaperGate.tsx`
- `apps/website/src/components/landing/render/RenderFooterCTA.tsx`
- `apps/website/src/components/landing/render/RenderComparison.tsx`
- `apps/website/src/components/landing/render/RenderProblemSolution.tsx`
- `apps/website/src/components/landing/render/RenderFeaturesGrid.tsx`
- `apps/website/src/components/landing/render/RenderCodeShowcase.tsx`
- `apps/website/src/components/landing/chat-landing/ChatLandingHero.tsx`
- `apps/website/src/components/landing/chat-landing/ChatLandingWhitePaperGate.tsx`
- `apps/website/src/components/landing/chat-landing/ChatLandingFooterCTA.tsx`
- `apps/website/src/components/landing/chat-landing/ChatLandingComparison.tsx`
- `apps/website/src/components/landing/chat-landing/ChatLandingProblemSolution.tsx`
- `apps/website/src/components/landing/chat-landing/ChatLandingFeaturesGrid.tsx`
- `apps/website/src/components/landing/chat-landing/ChatLandingCodeShowcase.tsx`
- `apps/website/src/app/angular/page.tsx`
- `apps/website/src/app/render/page.tsx`
- `apps/website/src/app/chat/page.tsx`

### Created (new)
- `apps/website/src/components/landing/angular/AngularStackSiblings.tsx`
- `apps/website/src/components/landing/render/RenderStackSiblings.tsx`
- `apps/website/src/components/landing/chat-landing/ChatLandingStackSiblings.tsx`

---

## Section 1: Hero — Stack Breadcrumb

### What Changes

Add a stack position indicator above the `@cacheplane/<pkg>` eyebrow in each hero. Shows all three libraries with the current page bolded/highlighted in its brand color, siblings muted and linked.

### Per-Page Rendering

- **Angular:** **Agent** (bold, `tokens.colors.accent`) → Render (muted, link to `/render`) → Chat (muted, link to `/chat`)
- **Render:** Agent (muted, link to `/angular`) → **Render** (bold, `tokens.colors.renderGreen`) → Chat (muted, link to `/chat`)
- **Chat:** Agent (muted, link to `/angular`) → Render (muted, link to `/render`) → **Chat** (bold, `tokens.colors.chatPurple`)

### Styling

- Font: `JetBrains Mono`, 10px, uppercase, `letterSpacing: 0.08em`
- Current page: brand color, `fontWeight: 700`, not a link
- Siblings: `tokens.colors.textMuted`, `fontWeight: 500`, Next.js `<Link>`, `textDecoration: none`
- Arrow separator: ` → ` in `tokens.colors.textMuted`
- Placed above the existing `@cacheplane/<pkg>` eyebrow with `marginBottom: 0.75rem`
- Wrapped in a `motion.div` matching the existing eyebrow animation

### Technical Fixes (while in heroes)

- Replace `<a href="/docs">` with `<Link href="/docs">` (internal route)
- Add `import Link from 'next/link'`

### What Stays

Headlines, subtexts, CTA buttons, badge rows — all unchanged.

---

## Section 2: WhitePaperGate — Page-Specific Copy Refresh

### What Changes

Keep per-page WhitePaperGate components. Refresh eyebrow and subtitle copy to better connect each guide to the library's value prop and the unified framework.

### Copy Changes

**Angular (`AngularWhitePaperGate`):**
- Eyebrow: "Free Download" → "Agent Guide"
- Title: unchanged — "The Enterprise Guide to Agent Streaming in Angular"
- Subtitle: "Six chapters covering the last-mile gap, the agent() API, thread persistence, interrupts, time-travel, and deterministic testing with MockAgentTransport."
- Add after subtitle: "Part of the Cacheplane Angular Agent Framework." (Inter, 0.8rem, `tokens.colors.textMuted`)

**Render (`RenderWhitePaperGate`):**
- Eyebrow: "Free Download" → "Render Guide"
- Title: unchanged — "The Enterprise Guide to Generative UI in Angular"
- Subtitle: "Five chapters covering the coupling problem, declarative UI specs with Vercel's json-render standard and Google's A2UI protocol, the component registry, streaming JSON patches, and signal-native state management."
- Add after subtitle: "Part of the Cacheplane Angular Agent Framework."

**Chat (`ChatLandingWhitePaperGate`):**
- Eyebrow: "Free Download" → "Chat Guide"
- Title: unchanged — "The Enterprise Guide to Agent Chat Interfaces in Angular"
- Subtitle: "Five chapters covering the sprint tax, batteries-included components, theming and design system integration, generative UI with Vercel json-render, Google A2UI support, and debug tooling."
- Add after subtitle: "Part of the Cacheplane Angular Agent Framework."

### What Stays

Layout (2-column glassmorphism grid), email signup form, download button, all IDs and aria labels, styling.

---

## Section 3: Footer CTA — Dark Design Upgrade

### What Changes

Replace all three weak glass-card footer CTAs with the strong dark design from the home page's `PilotFooterCTA`.

### Design Pattern

Matches `apps/website/src/components/landing/PilotFooterCTA.tsx`:
- Background: `linear-gradient(135deg, #1a1a2e 0%, #0d1b3e 100%)`
- White text, centered layout, `maxWidth: 48rem`
- Mono eyebrow (11px, uppercase, `rgba(255,255,255,0.5)`)
- Garamond heading (42px, white, `fontWeight: 400`)
- Inter subtext (17px, `rgba(255,255,255,0.7)`)
- Primary CTA: white background button → `/pilot-to-prod` via Next.js `<Link>`
- Secondary CTA: ghost border button → page-specific PDF download via `<a download>`
- Fine print: mono 10px, `rgba(255,255,255,0.4)`
- `framer-motion` `whileInView` animation
- `aria-labelledby` on the heading

### Per-Page Customization

| | Angular | Render | Chat |
|---|---|---|---|
| Eyebrow | Ready when you are | Ready when you are | Ready when you are |
| Heading | Ready to ship your LangGraph agent? | Ready to ship your generative UI? | Ready to ship your agent chat? |
| Subtext | The Angular Agent Framework closes the last-mile gap. Start with a conversation. | Decouple your agent's UI layer with open standards. Start with a conversation. | Production chat UI in days, not sprints. Start with a conversation. |
| Primary CTA | Start Your Pilot → (`/pilot-to-prod`) | Start Your Pilot → (`/pilot-to-prod`) | Start Your Pilot → (`/pilot-to-prod`) |
| Secondary CTA | Download the Guide (`/whitepapers/angular.pdf`) | Download the Guide (`/whitepapers/render.pdf`) | Download the Guide (`/whitepapers/chat.pdf`) |
| Fine print | App deployment license · $20,000 · 3-month co-pilot engagement | Same | Same |

### Mobile Breakpoint

```css
@media (max-width: 767px) {
  .angular-footer-inner { padding-top: 4rem !important; padding-bottom: 4rem !important; }
  .angular-footer-heading { font-size: clamp(28px, 6vw, 42px) !important; }
}
```

(Same pattern for render and chat with appropriate class name prefixes.)

### What's Removed

The old three-button glass-card design (Download Guide / Pilot Program / View Docs) is fully replaced.

---

## Section 4: Stack Siblings Section (New)

### What Changes

New section between WhitePaperGate and FooterCTA on each page. Shows the other two libraries as compact cards.

### Layout

- Section eyebrow: "The Cacheplane Stack" — JetBrains Mono, 0.7rem, uppercase, `tokens.colors.accent`
- Subtitle: "This library is part of a cohesive three-layer architecture." — EB Garamond, italic, 1.05rem, `tokens.colors.textSecondary`
- Two cards in a `1fr 1fr` CSS grid, `gap: 16px`, `maxWidth: 860px`

### Card Design

Each card is a compact version of TheStack cards:
- `borderLeft: 3px solid <sibling brand color>`
- `borderRadius: 14px`
- `background: rgba(<sibling rgb>, 0.03)`
- `border: 1px solid rgba(<sibling rgb>, 0.15)`
- `padding: 24px 20px`
- Tag pill: sibling's tag ("Agent" / "Gen UI" / "Chat") in white on sibling's brand color background
- Package name: JetBrains Mono, 0.76rem, sibling's brand color
- Headline: one line from TheStack data (EB Garamond, 1.15rem)
- CTA: "Explore Agent →" / "Explore Render →" / "Explore Chat →" — Next.js `<Link>`, JetBrains Mono, 0.72rem, sibling's brand color

No description paragraph or differentiator pills — keep it compact.

Sibling data is defined inline in each StackSiblings component (not imported from TheStack) to avoid cross-dependencies between landing page sections.

### Per-Page Data

| Page | Card 1 | Card 2 |
|---|---|---|
| `/angular` | Render (green, `@cacheplane/render`, "Agents that render UI — on open standards") | Chat (purple, `@cacheplane/chat`, "Production chat UI in days, not sprints") |
| `/render` | Agent (blue, `@cacheplane/angular`, "The reactive bridge to LangGraph") | Chat (purple, `@cacheplane/chat`, "Production chat UI in days, not sprints") |
| `/chat` | Agent (blue, `@cacheplane/angular`, "The reactive bridge to LangGraph") | Render (green, `@cacheplane/render`, "Agents that render UI — on open standards") |

### Mobile Breakpoint

```css
@media (max-width: 767px) {
  .angular-stack-siblings { padding: 60px 20px !important; }
  .angular-stack-siblings-grid { grid-template-columns: 1fr !important; }
}
```

### Page Layout Integration

Each page's `page.tsx` adds the StackSiblings component between WhitePaperGate and FooterCTA:

```
Hero → ProblemSolution → FeaturesGrid → CodeShowcase → Comparison → WhitePaperGate → StackSiblings → FooterCTA
```

---

## Section 5: Comparison — Light Content Refresh

### What Changes

Verify-and-update pass only. No structural or styling changes.

### Angular (`AngularComparison`)

- Current 9 rows are accurate and well-calibrated. No changes expected.
- Verify `useStream()` parity claim is still the right framing.

### Render (`RenderComparison`)

- Row "A2UI components": verify "18 built-in" count is current. Update number if changed.
- All other rows accurate.

### Chat (`ChatLandingComparison`)

- Row "Google A2UI spec": verify "18 components, v0.9 validation" is current. Update if changed.
- All other rows accurate.

### What Stays

Table structure, glassmorphism styling, animation, column layout — all unchanged.

---

## Section 6: Mobile Responsiveness

### What Changes

All product page components currently have zero `@media` breakpoints. Add consistent mobile support using the home page convention.

### Convention

- Breakpoint: `@media (max-width: 767px)`
- Implementation: CSS-in-JS `<style>` tags with `className` targeting
- Section padding: reduce to `60px 20px` from `80px 32px`

### Per-Component

| Component Pattern | Mobile Changes |
|---|---|
| Hero (3 files) | Add `className`, section padding `60px 20px`. Heading already uses `clamp()`. Badge row wraps via `flexWrap`. |
| ProblemSolution (3 files) | Add `className`, section padding `60px 20px`. Grid columns already use `auto-fit` so they collapse. |
| FeaturesGrid (3 files) | Add `className`, section padding `60px 20px`. Grid already responsive via `auto-fit`. |
| CodeShowcase (3 files) | Add `className`, section padding `60px 20px`. Verify code blocks have `overflow-x: auto`. |
| Comparison (3 files) | Add `className`, section padding `60px 20px`. Container already has `overflow: auto`. Reduce cell padding to `10px 12px` from `14px 24px`. |
| WhitePaperGate (3 files) | Add `className`, section padding `60px 20px`. Grid already collapses via `auto-fit minmax(min(320px, 100%), 1fr)`. Reduce inner padding to `24px 16px`. |
| StackSiblings (3 new files) | Built with mobile breakpoint from the start (Section 4). |
| FooterCTA (3 files) | Built with mobile breakpoint from the start (Section 3). |

### What Stays

No font size overrides where `clamp()` is already used. No layout restructuring — existing `auto-fit` grids and `flexWrap` handle collapse naturally. This is primarily a padding/spacing pass.

---

## Out of Scope

- ProblemSolution sections: no content or structural changes
- FeaturesGrid sections: no content or structural changes (cockpit iframes stay)
- CodeShowcase sections: no content or structural changes
- Home page components: already done in previous iteration
- `/pilot-to-prod` page: not part of this spec
- New whitepaper content: copy refresh only, no new PDFs
