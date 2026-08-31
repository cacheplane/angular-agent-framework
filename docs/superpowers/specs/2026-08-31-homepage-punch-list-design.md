# Homepage punch list — hero merge, FAQ litany, FeatureBlock migration

**Date:** 2026-08-31
**Status:** Design — awaiting review. No code written.
**Branch:** `blove/homepage-punch-list`

## Problem

Three follow-ups recorded across the shipped redesign arcs (#885/#886/#890):
the hero renders two near-identical noun rows on desktop; the first FAQ answer
still ends in an eight-noun litany; and `FeatureBlock` carries two content
structures because five non-home pages still use the legacy bullets+cards
shape — including an unguarded hole where a caller passing neither structure
renders empty scaffolding.

## Change 1 — hero: one row, chips become links

`HERO_CHIPS` (decorative, hidden on mobile) and `POSITIONING_PROOF_POINTS`
(linked pills) merge into one export in `positioning.ts`:

```ts
export interface HeroCapability {
  readonly label: string;
  readonly href: string;
}

export const HERO_CAPABILITIES: readonly HeroCapability[] = [
  { label: 'durable threads', href: '/docs/langgraph/guides/persistence' },
  { label: 'interrupts', href: '/docs/langgraph/guides/interrupts' },
  { label: 'subagents', href: '/docs/langgraph/guides/subgraphs' },
  { label: 'planning + memory', href: '/docs/langgraph/guides/memory' },
  { label: 'generative UI', href: '/docs/render/concepts/json-render-vs-a2ui' },
  { label: 'LangGraph + AG-UI', href: '/docs/choosing-an-adapter' },
];
```

Labels take the chips' lowercase casing; hrefs come from the pills. The
"generative UI" slot absorbs the pills' json-render + A2UI href — that page
is what the label means.

Rendering: the chip row's visual (mono, hairline border, `--radius-full`)
becomes a row of `<a>` links firing the existing `hero_proof_pill` analytics
id (funnel continuity). The `max-width: 640px` hide is removed — one row
earns its mobile place. The old `hero-proof-row` markup, its pill styling,
and `HERO_CHIPS` are deleted. `POSITIONING_PROOF_POINTS` SURVIVES — it also
feeds the OG image (`app/opengraph-image.tsx`) and `site-metadata.ts`
keywords, verified at design time; only Hero's usage of it is removed. `Hero.spec` asserts the six links (label + href) within the
labelled row and drops the two-row logic.

Also delete the `hero-caption` italic paragraph? **No** — out of scope; only
the two noun rows are in play.

## Change 2 — FAQ first answer

Replace:
> "…Threadplane gives Angular teams the production surface around compatible
> runtimes: headless chat, durable threads, interrupts, subagents, planning,
> memory, generative UI, and runtime adapters."

with:
> "AG-UI is a protocol rather than a complete Angular UI layer. Threadplane
> is the production surface built on the runtimes that speak it — the chat,
> threads, interrupts, and generative UI your Angular app actually ships."

## Change 3 — migrate all five pages to rows, delete the legacy path

All eleven remaining `FeatureBlock`s convert to `rows`. Headlines and bodies
on those pages are NOT rewritten — only bullets+cards collapse into three
rows each. Then the legacy path dies: `bullets`/`supportingCards` props,
their JSX branch, `.feature-block-bullets`/`.feature-block-bullet*`/
`.feature-block-card-*` CSS, and the `Card` import are deleted; `rows`
becomes REQUIRED; the rail eyebrow becomes the only header form. The
`FeatureBlock.spec` legacy-variant test is replaced by a test that TS
requires `rows` (compile-level; runtime test asserts rows render).

Row rule: no verbatim mono-tail repeats WITHIN a page (cross-page repeats
fine). Tails name real public surfaces or, on /pilot-to-prod, engagement
deliverables.

### The 33 rows (approved copy; refine wording, keep claims and tails)

**/langgraph · Providers** — Wire it once in app.config.ts → `provideAgent` ·
A typed, signal-based handle, no args → `injectAgent()` · Deterministic tests
without a backend → `MockAgentTransport`

**/langgraph · Signals** — messages(), status(), error() — live signals →
`signal-native handle` · Human-in-the-loop gates → `interrupt()` · Branch,
history, time-travel built in → `checkpoints`

**/chat · Compositions** — A drop-in production conversation surface →
`chat-timeline` · Devtools beside it, ship-ready → `chat-debug` · Thread
navigation and history search → `sidenav + palette`

**/chat · Headless** — Unstyled primitives, your design tokens →
`message + tool primitives` · The approval gate as a component →
`interrupt primitive` · Composes against the streaming contract →
`Agent contract`

**/ag-ui · Runtime choice** — Stream from Python, .NET, or TypeScript →
`AG-UI protocol` · Tool calls, state deltas, citations — standardized →
`protocol events` · New AG-UI runtimes work day one → `no adapter needed`

**/ag-ui · Same primitives** — Same names across adapters →
`provideAgent + injectAgent` · Same components, themes, citations →
`@threadplane/chat` · Same deterministic testing → `MockAgentTransport`

**/render · Schemas** — One spec, rendered by components you own →
`component registry` · Both protocols spoken → `json-render + A2UI` · Schema
on the server, validation in the client → `validated specs`

**/render · Fallbacks** — Unknown components degrade, not crash →
`fallback API` · Renders hold until the surface is real → `readiness gate` ·
Partial renders while streaming → `streaming specs`

**/pilot-to-prod · Discover** — Audit your surfaces and agent-eligible
workflows → `stack audit` · Pick the one or two agents that earn their keep →
`roadmap` · Auth, residency, observability locked early → `workshops`

**/pilot-to-prod · Build** — A working agent on your real data →
`your repo, your engineers` · Streaming surface from the chat compositions →
`@threadplane/chat` · Weekly demos to stakeholders → `open progress`

**/pilot-to-prod · Harden** — Tracing, metrics, error budgets →
`OpenTelemetry hooks` · Fallbacks across every agent surface →
`readiness + fallback` · Load tested, on-call ready → `runbook, yours`

## Testing

- Hero spec: six capability links with hrefs, scoped to the labelled row;
  no `hero-proof-row` remains.
- FeatureBlock spec: rows required; render asserted.
- Each migrated page's existing page spec must stay green; any asserting old
  bullet/card strings gets updated (grep before assuming none).
- Full suite + prod build + visual pass (homepage hero at 375px — the row now
  shows on mobile; one migrated page, e.g. /langgraph, at both widths).

## Out of scope

Headline/body rewrites on the five pages; PilotBlock/WhitePaperBlock/
Promises/RecentArticles passes; the SHORT_POSITIONING_DESCRIPTION meta string
(it is a meta description, not rendered copy).
