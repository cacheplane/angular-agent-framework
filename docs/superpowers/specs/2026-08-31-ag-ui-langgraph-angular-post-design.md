# Design: "What changes in your Angular code when the runtime changes"

**Date:** 2026-08-31
**Status:** Approved (reframe approved in session)
**Audience:** developers and architects. Long form, 2500–4000 words.

## Intent and evidence

Biggest remaining GSC cluster: `ag-ui angular` (27 impr, pos 8.2), `ag ui angular` (25, 8.6),
`angular ag-ui` (11, 10.3), `agui angular` (4, 6.8), plus `agentic ui angular` (14, 7.9) and
`agentic ui with angular` (11, 8.3). ~92 impressions, 6 clicks — the only remaining cluster
earning clicks.

`/docs/choosing-an-adapter` ranks **position 25.0 with zero clicks** and is only 601 words.
The decision intent is real and our docs are losing it. Cannibalization risk is therefore low:
this post becomes the canonical decision surface; the docs page stays a lookup.

## The reframe (why the working title was wrong)

Rejected title: "AG-UI or LangGraph: Picking an Agent Runtime for an Angular App."

Two reasons, both disqualifying:

1. **Positioning conflict.** `docs/gtm/messaging.md` locks in *"Not another backend agent
   runtime. Keep LangGraph, Genkit, Mastra, CrewAI, or your own service."* A post that picks
   your runtime for you inverts that.
2. **It overclaims.** Every AG-UI backend in this repo is itself a LangGraph graph. The
   `a2ui` twins differ by two lines (a `MemorySaver` import and the compile call). What we can
   demonstrate is a **transport swap over one runtime**, not a runtime swap.

Also: no query in the 146-row GSC pull contains "vs", "versus", "compare", or "choosing".
The demand is informational, not comparison-shaped.

**Approved frame:** *what changes in your Angular code when the runtime changes — and what
does not.* Same searchers, no positioning conflict, and it is the question our parity data
can answer honestly.

## Structure

1. **Lede** — the question, and the honest answer stated immediately.
2. `## What actually reaches your Angular code?` — both adapters land on the same neutral
   `Agent` contract. Link `/blog/what-inject-agent-returns`; do NOT re-derive the two-types
   explanation, that post owns it.
3. `## What does not change` — the measured part. In the cockpit twins, 6 of 9 `src/` files
   differ and they are always the same six; the demo component's diff is **one import line**.
   `injectAgent()`, `a2uiBasicCatalog()`, the `<chat>` template, and `submit({ message })` are
   untouched.
4. `## What does change` — config shapes are not substitutable (12 fields vs 5, overlapping on
   two); threads cascade into non-agent code (a 27-line `UrlMatcher` vs 13 lines total, a
   projects service, ~90 lines of sidenav); `<chat-timeline*>` requires `AgentWithHistory`, so
   it is a **compile-time** failure, not graceful degradation; e2e forks at the library level;
   `@threadplane/chat` peer-declares `@langchain/core` (type-only, but a required install).
5. `## Is that a protocol gap or our gap?` — **the section that justifies the post.** The
   capability table with a third column naming the cause. Threads/persistence/reload/time
   travel/queueing = protocol (AG-UI has no thread CRUD and no "fetch state of thread X").
   Client-tool `flush()` non-durability and missing lifecycle signals = our implementation gap.
   Generative UI = genuine parity. Subagents = protocol, and **AG-UI's design is better**
   (server-declared `ACTIVITY_*` vs LangGraph namespace inference, which needed two corrective
   PRs and is now converging on AG-UI's approach).
6. `## Where each one is genuinely stronger` — honest both ways. AG-UI: vendor neutrality,
   much smaller dependency surface, better delegation model, single-SSE-endpoint ops.
   LangGraph: everything durable — threads, checkpoints, time travel, branching, queued runs,
   reconnect, retry budget, lifecycle signals.
7. `## What this post cannot tell you` — the credibility section. Every AG-UI backend here is
   a LangGraph graph, so whether the neutral contract survives a genuinely non-LangGraph
   backend is **untested by us**. Say it plainly.
8. `## Conclusion` — decision heuristic, declarative close.

## Honest disclosure (required, not optional)

The post MUST disclose that our AG-UI support is thinner than our LangGraph support:
no `DestroyRef` teardown (and the JSDoc points at a destroy hook that does not exist),
`clientTools.flush()` is a no-op, no thread store, no lifecycle signals, no retry
configuration, 1,873 LOC vs 5,817.

Do not cite `libs/chat/testing/agent-conformance.ts` as proof of interchangeability — it is
65 lines and mostly asserts `typeof x === 'function'`. A shape check, not a behavioral one.

## Do NOT publish

- Live infrastructure identifiers: the Railway hostname, the `cockpit-dev-….us.langgraph.app`
  URL, `AG_UI_INTERNAL_TOKEN`, the exact origin allowlist. Describe topology, not addresses.
- The `cockpit/ag-ui/subagents` config bug (separate fix).

## Do NOT speculate

`@ag-ui/client` retry/timeout defaults; AG-UI vs LangGraph performance or latency; Railway
replica/scaling posture; LangGraph Cloud pricing or checkpointer internals; LangGraph
self-hosting (no in-repo evidence); non-LangGraph AG-UI backends.

## Overlap to respect

- `2026-08-09-agentic-ui-in-angular-production-patterns.mdx` — Pattern 1 is "put the runtime
  behind an Angular contract" and it has `## What about backend portability?`. Cite, extend,
  do not restate.
- `2026-05-21-build-fullstack-agentic-angular-apps-using-ag-ui.mdx` — best-ranking AG-UI page,
  already has `## Can you swap the backend without changing the UI?`.
- `2026-08-26-what-inject-agent-returns.mdx` — owns the neutral-vs-runtime type distinction.

## Voice

`docs/gtm/voice.md`, **2026 register** (as corrected): no contractions, no "Let's", one
sentence per line, declarative fragments, opinions flagged early and often, no emoji,
declarative close. Tutorial scaffolding allowed (H2-as-question, `## Conclusion`).
Never fabricate a first-person anecdote.

## Assets available

`ArchFlowDiagram` (LangGraph) and `AgUiArchDiagram` (AG-UI) components both exist and are
already used in published posts; `/blog/diagrams/agent-contract-boundary.svg` exists. Markdown
tables render inside a scroll container. Use a table for the capability matrix.
