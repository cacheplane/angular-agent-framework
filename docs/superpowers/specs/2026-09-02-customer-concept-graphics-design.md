# Customer-facing concept graphics: homepage grid, /render, /pilot-to-prod

**Date:** 2026-09-02
**Status:** Approved for planning
**Scope:** apps/website — diagram-kit extension, one new homepage section, two page graphics

## Motivation

The docs-visual-design arc (PR #950/#953) gave the site one schematic language
and put architecture diagrams everywhere a developer looks. Prospects are
still underserved: the homepage explains capabilities with video and code but
no at-a-glance concept; `/render` sells the hardest-to-grasp capability with
code only; `/pilot-to-prod` pitches a process with no picture of it.

Decisions made interactively (visual companion session
`.superpowers/brainstorm/91468-1788325177`): customer-facing scope (homepage +
`/render` + `/pilot-to-prod`); **kit schematic register** (option A) over
product vignettes and icon cards; homepage placement as a **dedicated
section** (option C) with **four independent capability cards** (narrative
option 2, not the lifecycle strip); card diagrams built via a **compact kit
scale** (option A) rather than downscaled full-width compositions.

## 1. Kit extension — `compact` scale

- `DiagramFrame` gains `scale?: 'docs' | 'marketing' | 'compact'` (extends the
  existing union; `data-scale` already flows to the figure).
- CSS (docs.css, kit block): `.tp-diagram-figure[data-scale="compact"] .tp-diagram-svg`
  gets `min-width: 0` and `max-width: 100%` — a compact figure fills its card
  and never scrolls.
- Authoring convention (documented in `DiagramFrame`'s JSDoc): compact
  compositions use a ~320-wide viewBox and a larger type ramp so text renders
  at or above designed size at card widths (~300–420px): eyebrow 10px, title
  13.5px, meta 11px, all in viewBox units. Implemented as CSS overrides under
  the compact scale (`[data-scale="compact"] .tp-diagram-eyebrow` etc.), so
  primitives stay unchanged.
- Style contract: pin the compact `min-width: 0` override so the mobile
  600px floor (PR #953) can never leak into cards.

## 2. Homepage "How it works" section

New landing section component `HomeConceptGrid`
(`apps/website/src/components/landing/HomeConceptGrid.tsx`), placed directly
after the Architecture (`StackDiagramSection`) section: architecture says
where things sit; this says what happens at runtime.

- Shell: `Section surface="canvas"` (alternates with the tinted architecture
  section above) + `SectionHeader variant="centered"` (eyebrow "How it works",
  heading set at implementation against neighboring headlines — must not
  rhyme with "Your UI talks to one contract…" above or the DemoShowcase
  heading below).
- Body: a 2×2 grid (1-col on mobile) of four cards in the site card idiom.
  Each card: compact diagram on top, capability title, one sentence, and a
  "See it live" link to the matching existing anchor (`#stream`, `#render`,
  `#ship`, `#approve`).
- The four compact compositions (`components/docs/diagrams/`, registered in
  MDX only if a docs page later wants them — the grid imports directly):
  - **`StreamConcept`** — user message node → `injectAgent()` pill →
    signals node → UI node; the claim: tokens arrive as signals, the UI
    updates itself.
  - **`RenderConcept`** — spec node (mono JSON fragment) → registry pill →
    "your component" node (accent); the claim: agent output renders as your
    design system.
  - **`ApproveConcept`** — agent node → `interrupt` pill → human node
    (accent) → `resume` pill looping back; the claim: nothing irreversible
    without a human (the register-A mock from the companion session).
  - **`ShipConcept`** — a horizontal thread line crossing "reload" and
    "deploy" tick pills and continuing to a "resumes" node; the claim:
    threads survive everything between question and answer.
- Copy constraint: every card sentence must be verifiable against the docs
  (same discipline as the last arc); implementation verifies each claim and
  the reviewer re-verifies against pages/libs.

## 3. `/render` marketing graphic

- Generalize `StackDiagramSection` into a `DiagramSection` that accepts a
  diagram child (keep `StackDiagramSection`'s existing prop surface by making
  it a thin wrapper, or migrate its three call sites — implementer's choice,
  no visual change to existing pages).
- New marketing-scale composition **`RenderTransform`** (640-wide, standard
  scale): left node carries an abbreviated real spec fragment in mono
  (2–3 lines, e.g. `{ "component": "Form", … }`), center accent node
  `@threadplane/render` with meta `registry · state · handlers`, right node a
  suggested rendered result ("Your form component — your styles, your
  validation"). Edge pills: "JSON Spec" and "bindings + events" (labels
  verified against the render docs, as in the last arc).
- Placed on `/render` after the hero in a `DiagramSection` (tinted surface —
  verify the hero's surface at implementation and alternate correctly).
  Headline/body written against the page's existing copy to avoid
  duplication; body angle: "schema on the wire, your design system on
  screen."

## 4. `/pilot-to-prod` journey graphic

- New composition species **`PilotJourney`** (640×~240, standard scale): a
  horizontal baseline with three phase nodes — Pilot → Hardening →
  Production — each with 2–3 meta deliverables, and gate pills on the line
  between phases. Phase content MUST be lifted from the page's actual
  copy at implementation time (the page defines what pilot includes); no
  invented deliverables.
- Placed after that page's hero in a `DiagramSection`.

## 5. What we are communicating (evaluation criteria)

Each graphic exists to remove a specific reading burden. The implementation
and review MUST check each against this table — a graphic that fails its row
gets reworked, not shipped:

| Graphic | The one-sentence claim | Complexity it removes | Overclaim risk to check |
| --- | --- | --- | --- |
| StreamConcept | Tokens arrive as signals; the UI updates itself | Reading the streaming guide to learn there's no manual subscription plumbing | Don't imply zero configuration; provider setup exists |
| RenderConcept | Agent output renders as your components | Reading the render intro to learn it's not an iframe/chat-widget | Don't show validation render doesn't do (last arc's finding) |
| ApproveConcept | Nothing irreversible without a human | Reading the interrupts guide to learn pauses are durable | "Durable" must match langgraph checkpoint behavior; AG-UI path differs — keep the card runtime-neutral |
| ShipConcept | Threads survive reloads and deploys | Reading persistence docs to learn state isn't in component memory | True for LangGraph Platform; AG-UI history is out of scope — phrase against the contract, not a runtime |
| RenderTransform | Schema on the wire, your design system on screen | Understanding generative UI without reading a line of code | The spec fragment must be a real, valid shape from the docs |
| PilotJourney | The engagement is three phases with concrete gates | Reading the whole page to learn what "pilot" includes | Deliverables must quote the page, not embellish it |

Two systemic checks: (a) the homepage now has three visual systems in
sequence (stack diagram → concept grid → demo videos) — the section heading
and copy must differentiate their jobs (where / what happens / see it) so
they read as layers, not repetition; (b) no competitor names anywhere in
labels or copy.

## 6. Testing

- Vitest specs per composition (kit idioms: accessible label, load-bearing
  titles, pill/edge counts) and for `HomeConceptGrid` / `DiagramSection`
  (heading wiring, anchor links, compact data-scale present).
- Style-contract entries for the compact overrides.
- Browser verification at 375px and desktop: compact cards never scroll,
  text ≥ designed size, page never scrolls horizontally; `/render` and
  `/pilot-to-prod` sections alternate surfaces correctly.
- `nx test website`, `nx lint website` (0 errors), production build green.

## Out of scope

- `/chat` anatomy and `/solutions/*` graphics (inherit later).
- Docs concept-page diagrams beyond what exists (separate developer-facing
  arc).
- Animation/interaction in the concept cards.
