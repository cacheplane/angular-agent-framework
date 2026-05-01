# Home page positioning strip redesign

**Date:** 2026-05-01
**Status:** Design — pending plan
**Scope:** Replace `StatsStrip` (the section directly below the hero on `/`) with a differentiator-focused positioning strip.

## Problem

The current section directly below the hero is `apps/website/src/components/landing/StatsStrip.tsx`, a 4-tile grid of stat-shaped claims:

- `14+ Capabilities` — vague; "capability" is undefined and uncountable.
- `100% Signal-Native` — table stakes for modern Angular, not a differentiator.
- `20+ Angular Version` — awkward phrasing; belongs on a badge, not positioning.
- `OSS Source Available` — conflates two distinct license categories; the project is MIT.

The strip's visual format (big number + label) forces synthetic numbers onto claims that aren't fundamentally numeric. Right after the hero, the visitor is asking "why this and not the React tools I already use?" — the current strip does not answer that.

## Goal

Replace the strip with **4 positioning claims** that differentiate NGAF against the actual competitive set (CopilotKit, Vercel AI SDK 5, assistant-ui, vanilla AG-UI/LangGraph wiring). Each claim must be defensible against a current competitor product page.

## Non-goals

- Not redesigning the hero, ProblemSection, or any section below.
- Not adding new pages or routes.
- Not changing the design tokens or glass-card system — reuse existing tokens.
- Not adding logos or social-proof imagery (separate concern).

## Competitive context (from research, 2026-05-01)

- **CopilotKit** ships `@copilotkitnext/angular` with services + headless UI + chat components. Full Angular customization is tier-gated. No A2UI renderer on the Angular side.
- **Vercel AI SDK 5** has official Angular support with signal-based primitives, but does not speak LangGraph natively.
- **assistant-ui** is React-only.
- **AG-UI** is a protocol; Angular is one of its listed renderers. Not a UI library.

Implication: NGAF cannot claim "first/only Angular agent framework." It *can* claim runtime neutrality, full-parity LangGraph streaming, built-in generative UI (json-render + A2UI), and unrestricted MIT licensing.

## Claims that will NOT appear

- "First Angular agent framework" — false (CopilotKit, Vercel AI SDK).
- "Built on signals" / "Zoneless" / "Modern Angular" — baseline.
- "Open source" alone — every competitor is OSS.
- "Cockpit DevTools" — not yet a shipped product surface; the libs under `libs/cockpit-*` are contracts only.
- "Type-safe" — table stakes.

## Design

### Section structure

Same 4-cell grid as today, but each cell becomes a positioning card with:

1. **Eyebrow** — short uppercase mono tag identifying the dimension (e.g. `RUNTIME`, `STREAMING`, `GENERATIVE UI`, `LICENSE`).
2. **Claim headline** — one short sentence in serif (Garamond), ~6–10 words.
3. **Supporting line** — one sentence in sans/secondary, ≤25 words, naming the concrete proof.

No big numbers. No icons in v1 (icons can be added in a follow-up if a designer pass calls for them).

### Visual treatment

- Reuse `tokens.glass` (bg, blur, border, shadow) so the card aesthetic matches `ProblemSection` and `TheStack`.
- Container: `max-width: 1040px`, `padding: 64px 32px`, centered.
- Grid: `repeat(auto-fit, minmax(240px, 1fr))`, 4 columns on desktop, 2 on tablet, 1 on mobile.
- Card padding: `24px 22px`. Border-radius: `18px` (match ProblemSection stat cards).
- Animation: keep the existing staggered fade-in from `StatsStrip` (`framer-motion`, `delay: i * 0.1`).

### Copy (exact text)

**Card 1 — RUNTIME**
> **One Angular UI. Any agent runtime.**
> Same primitives drive LangGraph, AG-UI, CrewAI, Mastra, Pydantic AI, AWS Strands, and your own backend.

**Card 2 — STREAMING**
> **Full-parity LangGraph streaming.**
> `agent()` ships everything React's `useStream()` does — interrupt, subagents, branch and history, tool progress — plus `error()`, `status()`, and `reload()`.

**Card 3 — GENERATIVE UI**
> **Generative UI, built in.**
> Render Vercel `json-render` and Google A2UI specs into Angular components. No second framework to bolt on.

**Card 4 — LICENSE**
> **MIT. Headless primitives, drop-in compositions.**
> No tier gates on Angular. Use the unstyled primitives, or the opinionated chat shell — your call.

### Order

`RUNTIME → STREAMING → GENERATIVE UI → LICENSE`. This walks the visitor from the broadest claim (works with anything) down to the most concrete commercial signal (no paywall on Angular).

### Accessibility

- The section gets `aria-labelledby` pointing at a visually-hidden `<h2>` with text "What makes the Angular Agent Framework different".
- Each card is a `<article>`; eyebrow is a `<p>` with mono styling, not a heading. Claim headline is `<h3>`. Supporting line is `<p>`.
- Inline code (`agent()`, `useStream()`, `json-render`) wrapped in `<code>` with mono font.
- Color contrast: all text uses `tokens.colors.textPrimary` / `textSecondary`; verify against glass background at the lightest gradient stop.

### Implementation footprint

- New file: `apps/website/src/components/landing/PositioningStrip.tsx`.
- Delete: `apps/website/src/components/landing/StatsStrip.tsx`.
- Edit: `apps/website/src/app/page.tsx` — swap `<StatsStrip />` for `<PositioningStrip />`, update the comment from `2. Trust — quick credibility stats` to `2. Differentiation — positioning vs other agent UIs`.
- No changes to `ProblemSection`, `PilotSolution`, `TheStack`, `WhitePaperSection`, or `PilotFooterCTA`.

### Risk and mitigation

- **A2UI claim has a short shelf-life.** CopilotKit blogged about React + A2UI in early 2026; Angular parity is plausible within 6 months. The claim is true today; revisit on the next quarterly content review.
- **Naming CopilotKit indirectly via "tier gates."** The copy says "No tier gates on Angular" without naming CopilotKit. Defensible factual statement; not a comparative ad.
- **LangGraph parity claim depends on the README parity table staying current.** If `@ngaf/langgraph` drifts behind upstream `useStream()`, this card becomes a liability. Add a note in the lib README that the parity table is load-bearing for marketing copy.

## Testing

- Visual: render `/` in dev server, verify 4-up desktop / 2-up tablet / 1-up mobile via `preview_resize`.
- Console / network: zero new errors or requests vs. current `StatsStrip`.
- A11y: `aria-labelledby` resolves, headings nest correctly under the hero `<h1>`, inline `<code>` is announced.
- No new unit tests required — this is presentational.
