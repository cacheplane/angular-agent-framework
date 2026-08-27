# Post #1 design: LangGraph subgraphs — the observability boundary

**Date:** 2026-08-27
**Status:** Approved (angle + scope approved in session; third post of the sequence in `docs/superpowers/specs/2026-08-26-blog-sequence-inject-agent-design.md`)

## Intent and evidence

`langgraph subgraphs` — 41 impressions, position 32.3, 0 clicks. Second-highest impression query on the site and we're effectively invisible for it. Nothing of ours competes.

This is the "grow the search surface" play: the searcher is a LangGraph-core engineer, often Python-first, not necessarily looking for an Angular UI framework. Per the candidates doc, serving them well may mean content only incidentally about Threadplane. That's the deliberate choice here.

**Slug:** `langgraph-subgraphs-when-to-split`
**File:** `apps/website/content/blog/2026-08-27-langgraph-subgraphs-when-to-split.mdx`
**Title:** working title "LangGraph Subgraphs: When to Split a Graph and When Not To" — the drafter may sharpen it toward the observability thesis, but must keep "subgraphs" early in the title for the query.
**Meta description (≤155 chars):** "When a LangGraph subgraph earns its complexity, how state crosses the boundary, and what your UI sees while a child graph runs."
**No licensing callout.**

## The angle: the observability boundary

**Rejected:** a generic "when to split" decision essay. `apps/website/content/docs/langgraph/concepts/agent-architecture.mdx:626-696` already carries a three-tier breakdown and a decision matrix; a generic post would co-rank against our own docs and lose the first-hand advantage. Link that section for the architecture question instead of restating it.

**The thesis:** most people reach for a subgraph expecting a *state* boundary, but in practice — at least on LangGraph — the thing a subgraph actually buys you is an *observable* boundary. That is the claim only we can make, and the repo says it out loud.

Supporting first-hand material (all verified; cite by path):

1. **Our own code says the motive is observability.** `examples/chat/python/src/graph.py:277-281` states that running the work as a real subgraph "is what causes LangGraph to emit stream events under namespace prefix `tools:<id>`… which the SubagentTracker keys on." The subgraph exists for the UI.
2. **A controlled A/B across transports.** The same three-subagent feature exists twice: with a subgraph on LangGraph (`cockpit/chat/subagents`) and with no subgraph at all on AG-UI (`cockpit/ag-ui/subagents/python/src/graph.py` — flat `_run_subagent()` at :107-135 plus `adispatch_custom_event("subagent_activity", …)` at :167). Same feature, opposite structural answer, because AG-UI's transport has a first-class delegation event and LangGraph's doesn't.
3. **A rejected alternative on record.** `docs/superpowers/specs/2026-05-08-*-subagents-design.md:23` rejected a plain `@tool` returning a synthesized payload because "no `tools:` namespace events get emitted because no subgraph runs. The card would render empty."
4. **A reverse migration.** `cockpit/chat/subagents` was converted from flat to subgraph (spec `2026-06-19-cockpit-subagents-subgraph-design.md`, PR #718) purely so a UI card would render.
5. **Splitting has real streaming costs the docs don't cover.** Namespaced terminal events would close out the parent's streaming message without a guard (`libs/chat`… see `stream-manager.bridge.ts:314-330`, test at `:474-505` asserting outcome `interrupted`); subagent text lands in the parent transcript unless you opt into `filterSubagentMessages` (default off, `agent.types.ts:282-283`).
6. **Attribution across the boundary is heuristic, not structural.** `matchSubgraphToSubagent()` (`subagent-tracker.ts:130-175`) falls back to "any unmapped pending/running subagent" (:165-169), and `extractToolCallIdFromNamespace` takes only the first `tools:` segment (:271-277) — so a subagent that itself delegates attributes inner events to the outer call. Nested delegation is untested here; say so plainly.

## Structure

1. **Lede** (no header): restate the question the searcher has, then land the thesis early — the useful boundary a subgraph draws is usually observability, not state.
2. `## What does a subgraph actually give you?` — the canonical pattern (compiled child as a node), what genuinely changes (nested execution, namespaced events) and what doesn't (state isolation isn't automatic; a shared `MessagesState` means the child appends to the parent's list). Point to the docs' architecture matrix for the tiering question rather than restating it.
3. `## Why do people really split?` — the observability thesis with the evidence above: our code comment, the rejected `@tool` alternative, the reverse migration.
4. `## What does the frontend see while a child runs?` — the differentiated section. Namespaced events (`messages|tools:call-1`), `streamSubgraphs` defaulting on, what breaks without namespace guards, `filterSubagentMessages` defaulting off, heuristic attribution and its fallback.
5. `## When should you not split?` — the honest counterweight: if you don't need the observable boundary and don't need genuinely divergent state, nesting adds a boundary you have to defend. Cite AG-UI doing the same feature flat.
6. `## Conclusion` — the heuristic, plus forward links to `/docs/langgraph/concepts/agent-architecture`, `/docs/langgraph/guides/subgraphs`, and `/blog/what-inject-agent-returns` (the `subagents()` signal is part of that return surface).

## Voice and register

Same as posts #11 and #9: `docs/gtm/voice.md` with the 2026 technical override — H2-as-question answered in the first line, contractions, 1–3-line paragraphs, "Let's" transitions, opinions flagged, no anecdotes, no emoji, no hype, no CTAs. Register reference: the two shipped posts.

Python code is fine here (the audience is Python-first); keep code to at most two short blocks.

## Accuracy requirements (drafting gate)

- Every claim cited to a real path/line, verified by reading the file — not from this spec's summary.
- **Do not claim the `cockpit/langgraph/subgraphs` example demonstrates delegation or populates the subagent sidebar.** It does neither (unconditional edge; no `subagentToolNames`; sidebar permanently empty). Two separate tasks are correcting the example and its guide; this post must not depend on or contradict their outcome — prefer citing `cockpit/chat/subagents` and `examples/chat` for working delegation.
- **Do not speculate about:** performance/latency of splitting (nothing measures it); parallel subagent fan-out (explicitly out of scope, e2e dispatches sequentially); child-specific checkpointers or state schemas (nothing exercises a separate checkpointer).
- Verify named public members against published 0.0.58 tarballs; drop main-only members.
- Frontmatter per existing posts; tags along the lines of [langgraph, subgraphs, agents, streaming, angular].

## Out of scope

- Fixing the subgraphs example or its guide (routed as separate tasks).
- Post #12 (own pass later).
