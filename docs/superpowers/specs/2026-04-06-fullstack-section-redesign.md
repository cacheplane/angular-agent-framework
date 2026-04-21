# FullStackSection Redesign — Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the `FullStackSection` component to speak to an EM/CTO buying audience — leading with a business outcome headline per layer, surfacing the problem each layer solves, and retaining API chips as technical proof — while simultaneously fixing the Gen UI tag overlap bug.

**Architecture:** Single component rewrite (`FullStackSection.tsx`). No new files, no new dependencies. The data shape gains two fields per layer (`outcome` and `problem`). The `Connector` component is unchanged. The floating `position: absolute; top: -10px` tag pattern is replaced with an inline tag at the top of each card.

**Tech Stack:** React 19 / Next.js, Framer Motion, local design tokens (`../../../lib/design-tokens`), JetBrains Mono + EB Garamond fonts via CSS variables.

---

## Design Decisions

### Audience
Primary reader: Engineering managers and CTOs evaluating whether to purchase an app deployment license. They skim headlines and read problem statements. Technical chips are proof points for the engineer they bring to the call.

### Layer structure per card (top to bottom)
1. **Tag pill** — inline `display: inline-block`, not `position: absolute`. Fixes the Gen UI overlap bug where the floating tag bled into the absent connector above.
2. **Package name** — `@cacheplane/...` in JetBrains Mono. Technical anchor.
3. **Outcome headline** — EB Garamond, ~20px bold. The EM reads this and stops.
4. **"Without this" block** — red left-border callout. One or two sentences on the pain the team has without this layer. Concise, relatable.
5. **Solution line** — 1–2 sentences on what the layer gives the team. Positive framing.
6. **API chips** — same as current. Engineer proof.

### Copy per layer

**@cacheplane/langgraph (Primitives)**
- Outcome: "Ship streaming agents without building the plumbing."
- Problem: Wiring SSE into Angular requires weeks of zone patching, manual subscription management, and custom thread-persistence code — most of which breaks under load or after a page refresh.
- Solution: agent() gives your team production-ready streaming, thread persistence, interrupt handling, and a deterministic test transport on day one.

**@cacheplane/chat (UI Layer)**
- Outcome: "Accessible agent UI in days, not sprints."
- Problem: Approval flows, streaming indicators, tool-call cards, and interrupt panels are rebuilt from scratch by every team — typically a 4–6 week sprint that delays the real agent work.
- Solution: Pre-built, accessible Angular components for every agent interaction pattern. Your team configures and styles them — not writes them.

**@cacheplane/render (Gen UI)**
- Outcome: "Agents that render UI — without coupling them to your frontend."
- Problem: Agents that surface dynamic data require either hardcoded frontend logic per agent or a fragile coupling between agent output and component code — both block iteration speed.
- Solution: The agent emits a declarative UI spec. Your Angular registry maps it to components. Swap components or redesign the UI without touching the agent.

### Bug fix: Gen UI tag overlap
**Root cause:** `.layer-tag` uses `position: absolute; top: -10px; left: 16px` — it bleeds upward into the connector SVG above it. The Gen UI layer has no connector (empty `connFill`), so the tag overlaps the Chat layer card below the missing connector gap.

**Fix:** Remove `position: absolute; top: -10px` from `.layer-tag`. Render it as `display: inline-block` at the top of the card content flow, with `margin-bottom: 10px`. The card gets `padding-top: 20px` (same as current) — no visual regression on the first two layers, overlap fully resolved on Gen UI.

### Section headline
Keep existing: "Three packages. One architecture. Nothing left to wire yourself." — still accurate, now backed by the layer copy underneath.

### Roadmap strip
No changes. The "Available now / Coming soon / On the horizon" grid beneath the stack is unchanged.

---

## Files

- **Modify:** `apps/website/src/components/landing/FullStackSection.tsx`
  - Add `outcome: string` and `problem: string` fields to the `LAYERS` array objects
  - Update the layer card render to use the new structure
  - Fix the tag from absolute-positioned to inline
  - No changes to `Connector` component, `NOW_ITEMS`, `SOON_ITEMS`, `HORIZON_ITEMS`, or the roadmap strip

---

## What Is Not Changing
- The `Connector` SVG animation between layers
- The roadmap strip below the stack
- The section headline and subheadline
- The LangGraph Cloud source box at the top
- The chip data for each layer
- Any other component on the page
