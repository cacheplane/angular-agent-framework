# Homepage cohesion — ecosystem ribbon + feature-block rebuild

**Date:** 2026-08-31
**Status:** Design — awaiting review. No code written.
**Branch:** `blove/homepage-cohesion`

## Problem

Two leftovers from the Basecamp redesign undermine the page it produced.

**The agent-stack section is too big.** `EcosystemStrip` renders 16 logo cards
in three titled rows — about two screens on desktop, sixteen stacked cards on a
phone — introduced by yet another run of the capability litany. Its
information design pads itself: the per-tile note "model provider" repeats
three times, five runtimes share the identical note "via AG-UI", AWS Strands
reuses the Bedrock logo, and the "Angular surface" group presents Threadplane's
own tech as if it were the visitor's stack.

**The four feature blocks are self-redundant.** Each is headline +
three-sentence body + four bullets + three supporting cards + CTA, where the
bullets restate the body and the cards restate the bullets; across blocks,
"readiness gate + per-component fallback" ships verbatim in both Render and
Ship. Roughly 40% of each block's text duplicates another part of the same
block. The copy is also stale against the new page voice.

## Decisions (made in mockup review)

1. **EcosystemStrip → thin logo ribbon** (option C of three mocked).
2. **Feature blocks adopt the rows structure** — no supporting cards.
3. **APPROVE keeps its name** (INTERRUPT rename considered and declined).
4. The medium switcher (Video / Code / Live) is untouched.

## Change 1 — `LogoRibbon` replaces `EcosystemStrip`

The section stops being a section: one hairline-bounded line, no heading, no
subhead, directly below the hero. The portability *argument* already lives in
the Yes wall ("Can I swap LangGraph for AG-UI…"); the ribbon keeps only the
recognition function.

- Content: mono label `WORKS WITH`, then eight logo+name pairs — OpenAI,
  Anthropic, Gemini, Bedrock, LangGraph, AG-UI, CrewAI, Mastra — then a muted
  `+ 4 more` (Azure OpenAI, Pydantic AI, Microsoft Agent Framework, AWS
  Strands). The four "Angular surface" tiles (Angular, RxJS, json-render,
  A2UI) are **dropped from this section entirely** — they are Threadplane's
  own tech, and json-render/A2UI already appear in the Render block's rows.
- Anatomy: `border-top`/`border-bottom` 1px `--color-border`, ~16px vertical
  padding, logos at ~16px, names 13px/500 `--color-text-secondary`, label
  10.5px mono uppercase muted. Wraps to 2–3 lines on phones. No links, no
  hover states, no tooltips.
- Accessibility: `<section aria-label="Works with your agent stack">`; logo
  imgs keep empty alt (names are adjacent text).
- The full 16-item breakdown is not lost to the site: `/langgraph` and
  `/ag-ui` pages carry runtime detail; nothing else on the homepage needs it.
- `EcosystemStrip.tsx` is deleted along with its CSS block and the litany
  subhead — the last homepage instance of the six-noun sentence outside the
  hero chips. Check for stray consumers before deleting (`grep -rn
  EcosystemStrip apps/website/src`).

## Change 2 — feature blocks: rail header, two-sentence body, three rows

`FeatureBlock` gains an alternative content structure, **opt-in by prop** —
it is shared by six pages (`/`, `/langgraph`, `/chat`, `/ag-ui`, `/render`,
`/pilot-to-prod`), and only the homepage changes now. Same pattern as
`FinalCTA variant="dark"`.

- New optional prop `rows?: { claim: string; api: string }[]`.
  `bullets` and `supportingCards` become optional; a block renders EITHER
  rows OR bullets+cards. TypeScript should make the intent explicit (a union
  or runtime guard is fine; do not render both).
- When `rows` is present: the eyebrow renders as the rail anatomy (kicker +
  hairline, left-aligned), the body caps at two sentences by convention (not
  enforced), and the rows render in the Yes wall's grammar — claim left, mono
  API right, hairline rules, 2px top cap, max-width ~46ch. No cards.
- The five non-home consumers keep bullets+cards untouched; migrating them is
  a recorded follow-up, not this scope.

### Approved copy (refine wording at implementation, keep claims and APIs)

**STREAM** — "One provider. A whole agent surface."
Body: "provideAgent wires the agent into DI; injectAgent() hands back
signals — messages(), status(), error() — plus durable threads and tool
progress."
Rows: Signals, not promises → `injectAgent()` · Threads that branch, resume,
replay → `threadId` · Same contract on LangGraph and AG-UI → `runtime adapters`

**RENDER** — "Agent output, rendered as your components."
Body: "The server emits a JSON spec. Angular renders it with components you
own — json-render and A2UI both speak it."
Rows: Your design system, not a chat widget → `@threadplane/render` · Unknown
specs degrade per component → `fallback + readiness gate` · Schema on the
server, trust in the client → `validated specs`

**SHIP** — "Demos stream. Production recovers."
Body: "The seams that turn a demo into an app: error boundaries, readiness
gates, and threads that outlive deploys."
Rows: error() / status() / reload() on every agent → `boundary signals` ·
Fallback content where specs go wrong → `readiness gate` · Conversations
restore across sessions → `thread persistence`

**APPROVE** — "Nothing irreversible without a human."
Body: "interrupt() freezes the run inside the checkpoint. Your UI renders the
proposal; submit({ resume }) continues with the decision on the record."
Rows: The pause is a checkpoint, not a modal → `interrupt()` · The proposal
renders in your UI → `<chat-interrupt-panel>` · The decision lands beside the
action it gated → `submit({ resume })`

Copy rules carried from the shipped spec: every claim true without
qualification; API labels must name real public surfaces; no phrase repeats
verbatim across blocks (the old readiness-gate duplication is resolved by
Render owning "fallback + readiness gate" and Ship owning "readiness gate"
in different claims — acceptable; do not let a third instance appear).

## Cohesion effects (why these two changes are one design)

After this, every major homepage section speaks the same two devices: the
rail header (Yes wall, proof strip, feature blocks) and the claim→API row
grammar (Yes wall, feature blocks). The section stack becomes: Hero → ribbon
→ Yes wall → demo → four blocks → pilot → white paper → promises → proof →
FAQ → dark CTA → articles. Net height shrinks by roughly one and a half
screens on desktop and far more on mobile.

## Testing

- `LogoRibbon` spec: renders 8 named items + "+ 4 more"; aria-label present;
  no links.
- `FeatureBlock` spec: rows variant renders claims + APIs and NO cards;
  bullets variant (existing usage shape) still renders — pin both, the
  five other pages depend on the old shape.
- Homepage spec assertions referencing old bullet/card strings: none exist
  today (verified by grep); e2e has no ecosystem assertions.
- Full suite + prod build + visual pass at 1440px and 375px (marker lessons
  apply: verify via DOM geometry where the pane won't paint).

## Out of scope, recorded

- Migrating the five non-home `FeatureBlock` consumers to rows.
- The first FAQ answer still carries the litany sentence.
- Hero chips vs proof pills duplication on desktop.

## Mockups

`.superpowers/brainstorm/3322-1788150420/content/` — `ecosystem-approaches.html`
(A/B/C; C chosen) and `feature-blocks.html` (before/after; AFTER chosen).
