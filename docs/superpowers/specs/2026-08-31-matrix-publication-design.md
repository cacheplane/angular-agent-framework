# Design: publish the runtime portability matrix + follow-up post

**Date:** 2026-08-31
**Status:** Approved in concept (Brian: "continue with follow ups 1-2"); gated on Mastra Lane B
landing so the published matrix has no asterisks.

## Two deliverables, one PR each

### 1. The matrix as a docs reference — extend `/docs/choosing-an-adapter`

Post #884 links that page as "the lookup table for this decision." Today it is 601 words and
ranks position 25 with zero clicks. The matrix makes it the reference it claims to be.

Add a `## Measured runtime support` section:
- The 4-runtime × 5-surface table with per-cell verdicts and the three-way cause column
  (protocol / upstream integration / our adapter) — the cause column is the whole value.
- One paragraph on method: real servers, captured SSE transcripts replayed through the
  pinned client, fixtures committed in `libs/ag-ui/fixtures/runtime-transcripts/`.
- Link each runtime row to its live example under `cockpit/runtimes/` (MAF, Strands, Mastra)
  and the demos.
- Keep the existing page content; this is additive. No heading changes to existing anchors.
- Note honestly: subagents red for all third parties (nobody emits our ACTIVITY convention;
  protocol SUBAGENT_* events exist since 0.0.59 but no runtime emits them yet).

### 2. The follow-up post

**Working title:** "We Measured It: Swapping the Agent Runtime Under an Angular App"
(drafter may sharpen; must read as the sequel to what-changes-when-the-runtime-changes).
**Slug:** `we-measured-the-runtime-swap` (or similar; final at draft time).
**Audience/length:** same as #884 — developers and architects, long-form OK but 1500-2500
words is enough; the matrix carries the weight.

**The story arc (this is the post):**
1. The previous post ended on a concession: every AG-UI backend we had was a LangGraph graph;
   "belief is not measurement, and I am not going to dress one up as the other."
2. So we measured. Three runtimes (AWS Strands, Microsoft Agent Framework, Mastra), two
   languages, real servers, captured wire transcripts replayed through the shipped client.
3. The claim held where it mattered: messages, tool calls, and state crossed three
   non-LangGraph runtimes with ZERO adapter changes.
4. **Both real failures were ours** — and the failures are the most useful part:
   - We keyed interrupts on a bridge convention (`on_interrupt`) while two of three runtimes
     used the protocol-standard `RUN_FINISHED.outcome`. Our reducer ignored it; runs
     finalized as success with a dangling approval. Fixed (#888).
   - Our resume payload was LangGraph-shaped. Each runtime needs its identity carried
     differently; fixed with per-provenance shapes + the 0.0.59 top-level resume (#889/#891).
5. What stayed red, honestly: subagents everywhere (three different non-mappings, ecosystem
   not bug), Strands state partial (no STATE_DELTA; per-tool opt-in; partial-snapshot
   clobber hazard).
6. The bonus finding: measuring the deploy surfaced a 2.5-month silent production outage
   (`railway up --detach` + a dev-only import style + no route probes). One paragraph, told
   plainly — it's a strong trust beat and a useful lesson (verify the route, not the exit
   code). Do NOT name live hostnames.
7. Close: the matrix is now a maintained reference (link the docs page); transcripts are
   committed as fixtures so regressions fail tests, not users.

**Register:** Brian's measured 2026 voice — no contractions, no "Let's", one sentence per
line, declarative fragments, opinions flagged, zero 3+ sentence lines, declarative close.
**Accuracy:** every claim traced to a merged PR or committed fixture; verify against main,
not memory. No live infra identifiers. Never call the Mastra interrupt cell "live-proven"
unless Lane B's smoke actually proved it by then — check before drafting.
**Update #884 in the same PR:** add a short editor's-note style link at the "What this post
cannot tell you" section pointing to the new post ("Since publishing, we measured it: …")
WITHOUT changing that section's headings or removing the original concession — the record
of having conceded it is part of the credibility.

## Sequencing

Draft both after Mastra Lane B lands (one cell + one example link depend on it). Docs page
and post ship as separate PRs; post links the docs page.
