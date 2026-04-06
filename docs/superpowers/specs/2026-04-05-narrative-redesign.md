# Narrative Redesign — Implementation Spec

## Goal

Add four new landing page sections that reframe Angular Stream Resource around the "last mile" production narrative: the problem (why AI projects stall), the full stack architecture, the @cacheplane/chat UI layer in depth, and a fair comparison table. Update one existing section (FeatureStrip) to remove an inaccurate claim. Existing sections are preserved as-is.

## Architecture

All new sections are standalone React components added to `apps/website/src/components/landing/`. The landing page (`apps/website/src/app/page.tsx`) is updated to insert them in a specific sequence within the existing section order. Each component uses Framer Motion with `whileInView + viewport={{ once: true }}` for scroll-triggered animations, design tokens from `@cacheplane/design-tokens`, and the established glass-morphism visual language.

SVG animations use `animateMotion` with `mpath` for particle flows and CSS `@keyframes` for sequential reveal. No new dependencies required — Framer Motion and all tokens are already available.

## Tech Stack

- Next.js 16, React 19, TypeScript
- Framer Motion (already in workspace)
- `@cacheplane/design-tokens` for all color/glass values
- Inline SVG for particle animations (no library needed)
- EB Garamond for headlines, Inter for body, JetBrains Mono for labels/code

---

## File Map

| Action | Path |
|--------|------|
| Create | `apps/website/src/components/landing/ProblemSection.tsx` |
| Create | `apps/website/src/components/landing/FullStackSection.tsx` |
| Create | `apps/website/src/components/landing/ChatFeaturesSection.tsx` |
| Create | `apps/website/src/components/landing/FairComparisonSection.tsx` |
| Modify | `apps/website/src/app/page.tsx` |

---

## Section 1: ProblemSection

**Placement in page.tsx:** After `<StatsStrip />`, before `<ValueProps />`.

**Narrative:** The last-mile gap. Three stats establish the problem. An animated progress bar shows teams stalling at 77% and Angular Stream Resource closing the gap to 100%.

### Component structure

```tsx
'use client';
import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const STATS = [
  { num: '66%', label: 'of AI solutions are almost right — not quite production-ready' },
  { num: '31%', label: 'of prioritized AI use cases actually reach production' },
  { num: '75%', label: 'of developers still want a human in the loop when trust breaks down' },
];
```

### Stat cards

Three glass cards in a 3-column grid. The number uses `tokens.colors.angularRed` with EB Garamond at `3.4rem`. Staggered `whileInView` entrance with `delay: i * 0.1`.

### Gap animation

A single `<div>` track bar with `overflow: hidden` and `borderRadius: 8`. **Critical:** `overflow: hidden` on the track container is what makes the fill clips work correctly — no two-piece border-radius artifact. The fill is one element that transitions in two phases:

**Phase 1** (triggered by `useInView`): fill width transitions from `0%` → `77%` over `1.7s cubic-bezier(.4,0,.2,1)`. A counter animates from 0 → 77 using `requestAnimationFrame`.

**Phase 2** (after 1s pause): stall marker (red vertical line at 77%) and hatch overlay appear. Track shakes with a CSS keyframe.

**Phase 3** (after another 1s): hatch fades out, fill continues `77%` → `100%` over `1s`. The background gradient shifts from red → blue as it crosses the 77% threshold: `linear-gradient(90deg, rgba(221,0,49,.5) 0%, rgba(221,0,49,.38) 70%, rgba(0,64,144,.8) 82%, #004090 100%)`. Counter animates 77 → 100.

**Phase 4**: "100%" label, "✓ Production" label, and tagline fade in.

```tsx
// Trigger: useInView with once:true, 30% threshold
// Phase timings (ms from trigger):
// 150   → start fill to 77%
// 2100  → show stall marker + hatch + shake
// 3200  → close gap to 100%
// 4400  → show end labels + tagline
```

The tagline: *"Your backend agent may already work. The frontend and production path is what slips the schedule."*

---

## Section 2: FullStackSection

**Placement in page.tsx:** After `<ProblemSection />`, before `<ValueProps />`.

**Narrative:** Three-layer architecture. Particles animate downward through each connector, showing data flowing from LangGraph → stream-resource → chat → render.

### Component structure

A centered vertical stack, max-width 520px, centered on the page. Above the stack: eyebrow, headline, subtitle. Below the stack: a three-column roadmap strip.

### LangGraph source node

Dark card (`#1a1b26`), centered, width 220px. Shows "LangGraph Cloud" label and a pulsing "stream active" live badge.

### Layer cards

Three cards with the established color scheme:
- `@cacheplane/stream-resource` — blue (`#004090`), tag "Primitives"
- `@cacheplane/chat` — purple (`#5a00c8`), tag "UI Layer"
- `@cacheplane/render` — green (`#1a7a40`), tag "Gen UI"

Each card shows the package name and 4–5 chip tags for key APIs.

### SVG connectors

Each of the three connectors (LG→SR, SR→chat, chat→render) is a `<svg>` element 4px wide, 52px tall. Contains:
- A dashed vertical line
- Two `<circle>` elements with `<animateMotion>` and `<mpath>` — staggered `begin` offsets so they flow continuously
- A `<path>` element (display:none) defining the motion path

Connector labels float to the right of each SVG: "AIMessage stream", "Signal<Message[]>", "Spec · JSON patch".

### Roadmap strip

Below the stack, a glass card with three columns:
- **Available now** (green): Text streaming, Tool-call cards, Interrupt flows, Generative UI specs, Thread persistence, Deterministic testing
- **Coming soon** (amber, with "Planned" badge): File attachments, Image inputs & rendering, Audio input, Multi-modal messages
- **On the horizon** (gray): Voice UI primitives, Video stream rendering, Collaborative agents

---

## Section 3: ChatFeaturesSection

**Placement in page.tsx:** After `<FullStackSection />`, before `<ValueProps />`.

**Narrative:** @cacheplane/chat in depth. Four interactive tabs (Streaming, Generative UI, Tool Calls, Interrupt) each play a focused chat scenario. Left/right callouts light up as the relevant component activates.

### Layout

Three-column: `1fr 440px 1fr`. Center column is the dark chat window. Left/right columns hold callout cards that illuminate when their component appears in the chat sequence.

### Tab buttons

Four pill buttons: Streaming, Generative UI, Tool Calls, Interrupt. Clicking a tab clears the chat window, updates the callouts, and runs the scenario.

### Chat window

Dark window (`#12131f`) with macOS traffic-light dots, window title, and a colored feature badge. Fixed height 460px with scrollable message list.

### Scenarios (correct sequencing)

**Streaming:** User message → typing dots → AI tokens stream in word by word. Callouts light: `<chat-messages>` (left) while streaming, `isStreaming()` signal (right) throughout.

**Generative UI:** User message → typing dots → AI text partial → then inline `<chat-generative-ui>` block appears with header "@cacheplane/render · DataTable", rows stream in one at a time. Callouts: `<chat-generative-ui>` left, `<render-spec>` right.

**Tool Calls:** User message → tool card appears immediately (no AI text first — correct LangGraph execution order) with `● running` status. Steps appear sequentially. Card transitions to `✓ done`. Then AI response text streams in. Callouts: `<chat-tool-calls>` left, `<chat-tool-call-card>` right.

**Interrupt:** User message → typing dots → AI starts a sentence mid-stream → pauses → interrupt panel appears with approve/edit/cancel buttons. Callouts: `<chat-interrupt>` left, `<chat-interrupt-panel>` right.

### State management

Each tab scenario is an `async` function using a local `wait(ms)` helper. Tab switch cancels any in-progress animation by checking a `currentScenario` ref that is incremented on each tab change. Each async step checks `if (scenario !== currentScenarioRef.current) return` before proceeding.

---

## Section 4: FairComparisonSection

**Placement in page.tsx:** After `<DeepAgentsShowcase />`, before `<ArchDiagram />`.

**Narrative:** Honest comparison of LangChain alone vs Angular Stream Resource. No attacks. Just what Angular Stream Resource adds on top.

### Component structure

Eyebrow: "A fair comparison". Headline: "What Angular Stream Resource adds". Subtitle: "LangChain and LangGraph are excellent. This is what the Angular production layer provides on top."

### Comparison table

Two columns: "LangChain + Angular (without Angular Stream Resource)" and "LangChain + Angular + Angular Stream Resource".

| Capability | Without | With |
|---|---|---|
| Token streaming | Custom SSE wiring + zone management | `streamResource()` signal, zero boilerplate |
| Thread persistence | Manual localStorage + API calls | `threadId` signal + `onThreadId` callback |
| Interrupt flows | Custom polling or WebSocket | `interrupt()` signal + resume built in |
| Tool-call rendering | Custom event parsing | `<chat-tool-call-card>` or headless `<chat-tool-calls>` |
| Generative UI | No established pattern | `<chat-generative-ui>` + `<render-spec>` + registry |
| Deterministic testing | Mock HTTP + tick management | `MockStreamTransport` + writable signals |
| Human approval UI | Build from scratch | `<chat-interrupt-panel>` |
| Prebuilt full chat | Build from scratch | `<chat>` drop-in |

Each "With" cell uses `tokens.colors.accent` text with a checkmark. Each "Without" cell uses `tokens.colors.textMuted`.

---

## FeatureStrip Update

**File:** `apps/website/src/components/landing/FeatureStrip.tsx`

Remove the feature entry that reads "Generative UI — no established Angular pattern exists anywhere" or equivalent language that implies Angular Stream Resource is the only solution. Replace with: `{ icon: '🎨', title: 'Generative UI', desc: 'Agent-emitted Angular components via @cacheplane/render. Your component registry, your design — rendered inline from a JSON spec.' }`.

---

## page.tsx Changes

Insert sections in this order:

```tsx
// After StatsStrip:
<ProblemSection />
<FullStackSection />
<ChatFeaturesSection />
// (then ValueProps, CodeBlock, LangGraphShowcase, DeepAgentsShowcase as before)
// After DeepAgentsShowcase:
<FairComparisonSection />
// (then ArchDiagram, FeatureStrip, CockpitCTA as before)
```

Add four new imports at the top.

---

## Animation Details

### Gap fill — no border-radius artifact fix

The track container uses `overflow: hidden` with `borderRadius: 8`. The fill `<div>` has no border-radius of its own — it is simply `position: absolute, inset: 0, height: 100%`. The container clips it. This is the only correct approach; separate left/right border-radius on two fill elements always produces a visual seam.

### SVG particle connectors

```tsx
// Example connector SVG (copy pattern for all three, change fill color and timing)
<svg width="4" height="52" viewBox="0 0 4 52" overflow="visible">
  <line x1="2" y1="0" x2="2" y2="52"
    stroke="rgba(0,64,144,.2)" strokeWidth="2" strokeDasharray="3 3"/>
  <circle r="3.5" fill="#004090">
    <animateMotion dur="1.1s" repeatCount="indefinite" begin="0s">
      <mpath href="#path-sr"/>
    </animateMotion>
    <animate attributeName="opacity" values="0;1;1;0"
      dur="1.1s" repeatCount="indefinite" begin="0s"/>
  </circle>
  <circle r="3.5" fill="#004090">
    <animateMotion dur="1.1s" repeatCount="indefinite" begin="0.55s">
      <mpath href="#path-sr"/>
    </animateMotion>
    <animate attributeName="opacity" values="0;1;1;0"
      dur="1.1s" repeatCount="indefinite" begin="0.55s"/>
  </circle>
  <path id="path-sr" d="M2,0 L2,52" style={{ display: 'none' }}/>
</svg>
```

Use unique `id` values for each connector path (`path-sr`, `path-chat`, `path-render`).

---

## Testing

Each component can be verified visually by running the dev server (`npm run dev` from `apps/website`). No unit tests required for animation components. The FairComparisonSection has no interactive state — verify it renders the correct table content.

Scroll-triggered animations: verified by scrolling past each section in the browser. The `viewport={{ once: true }}` flag means each animation plays exactly once per page load.
