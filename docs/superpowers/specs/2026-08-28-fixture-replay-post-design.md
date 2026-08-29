# Design: "What Fixture Replay Can't Catch" (blog post #12)

**Date:** 2026-08-28
**Sequence:** post #12 of the GSC-driven blog sequence. Posts #11, #9, #1 shipped.
**Status:** approved angle, pending spec review.

## Why this post is different from the others

It is the only post in the sequence with **no search evidence** behind it. #11, #9, and #1 were each selected against a Search Console pull. This one is a bet on being genuinely differentiated and shareable rather than on capturing existing demand.

That raises the bar: if the material turns out thin, say so rather than padding. It did not turn out thin — see Verified facts.

## Thesis

A deterministic test harness buys determinism by deleting a dimension. Ours deletes **time** — deliberately, with the reason written in the source — and that makes one specific bug class structurally invisible to a green suite.

The post is not "how to mock your LLM." That post exists everywhere. The post is "here is what my passing suite cannot see, and why I chose that trade anyway."

## Co-ranking check

`apps/website/content/docs/langgraph/guides/testing` covers the **in-process** tier: `provideFakeAgent()`, `mockLangGraphAgent()`, `MockAgentTransport`. Its only "fixture" occurrences are Angular `TestBed` / `ComponentFixture` (lines 91-101). It says nothing about aimock or fixture replay.

So there is no co-ranking risk. The post covers the **out-of-process** harness, a different layer, and should link the guide for the unit tier rather than restate it.

## Structure

Target ~1,300 words. The subgraphs post ran ~1,900 and a reviewer measured that as roughly twice the two shipped siblings; this one stays tighter.

1. **Opening.** Thesis in two lines. Determinism has a price; the useful question is which one you paid.
2. **"Where do you put the mock?"** The seam is one environment variable. Everything above it runs for real.
3. **"What does a fixture match on?"** Matching semantics, then the ordering constraint that loops forever.
4. **"What did we trade away?"** `chunkSize: 4096`, quoted from source. Replay is near-atomic by design.
5. **"The bug class that hides there."** Mid-stream and self-correcting. The subgraph transcript leak as the worked example.
6. **"What runs alongside it."** The live gate, and how drift is detected.
7. **Close.** Invitation, matching the siblings.

## Verified facts

Every line below was read directly in this repo on 2026-08-28.

**The seam.**
`libs/e2e-harness/src/global-setup-factory.ts:90` spawns a real `langgraph dev` with `OPENAI_BASE_URL: aimock.baseUrl` and `OPENAI_API_KEY: 'test-not-used'`. Real Angular app, real transport, real LangGraph server, real Python graph. Only the model provider is replaced. `ag-ui-global-setup-factory.ts:89` does the same for the AG-UI stack.

**Scale.** 50 fixture files holding 129 total fixture entries, across 34 distinct apps — 32 cockpit capabilities plus 2 example apps (counted by parsing every `**/e2e/fixtures/*.json`). Say "apps" or "capabilities and example apps" in prose, not "capabilities" alone: 2 of the 34 are examples, not cockpit caps.

**The determinism trade.**
`libs/e2e-harness/src/aimock-runner.ts:59` constructs `new LLMock({ port: 0, chunkSize: 4096 })`. The comment at :50-58 states the rationale: a large chunk size makes each response arrive in 1-2 SSE deltas, so structural assertions measure the FINAL rendered DOM rather than the progressive render; with default chunking the partial-markdown parser sometimes cannot recover a triple-backtick fence split mid-token, and the final state degrades to inline `<code>`. Progressive behavior is covered by unit-variance tables instead.

This is the load-bearing fact of the post: replay is near-atomic **on purpose**, and the reason is written down.

**The ordering constraint.**
`cockpit/langgraph/client-tools/angular/e2e/fixtures/client-tools.json` holds 7 entries. Every `match` block carrying `hasToolResult: true` precedes its plain `userMessage` twin (indices 0<1, 2<3, 5<6). Matching is first-match-wins, so reversing a pair makes the post-tool continuation re-match the original tool call and loop forever — the assistant never finalizes.

**The bug class replay cannot catch.**
Mid-stream defects with a clean end state. Worked example, measured this week: `cockpit/langgraph/subgraphs`. Without `transcriptNodeNames: ['answer']`, the child graph's internal brief renders as its own chat bubble and the message list transiently reaches 3 before the parent's authoritative `values` event collapses it back to 2 (`cockpit/langgraph/subgraphs/angular/src/app/app.config.ts:20`). A final-state assertion passes. Confirmed live with a 60ms DOM sampler against a real model: with the option set, `chat-message` count never exceeded 2 across 56 samples spanning a full stream.

**Drift detection — describe the mechanism, not a cadence.**
`examples/chat/angular/e2e/scripts/drift.ts` re-records each committed fixture against the live provider and compares **byte length**, flagging any fixture whose size diverges by more than 20% (`THRESHOLD_PCT = 0.2`). `.github/workflows/aimock-drift.yml` runs it and opens an issue on failure.

The workflow is currently `workflow_dispatch` only; its cron is deliberately omitted because the committed fixtures are handwritten seeds rather than recordings. **Brian intends to fix this.** The post therefore describes how drift is detected — the mechanism — and makes no claim about a schedule. That phrasing is accurate today and remains accurate once the cron is enabled, so the post will not need revisiting either way.

Worth saying plainly in the post: a byte-size comparison detects that a response changed *size*, not that it changed *meaning*. That is another instance of the thesis, not a contradiction of it.

## Hard prohibitions

- No invented first-person anecdotes. Brian: "don't make up stories."
- No claim that the suite catches more than it does. The whole point is the opposite.
- No cadence claim about drift detection.
- No emoji, no hype, no marketing CTA, no "Introduction" heading, no licensing callout.
- No line numbers in prose.
- Do not restate the testing guide's in-process API surface; link it.
- Verify any named public API against the published tarball, not just source — main routinely runs ahead of npm.

## Voice

`docs/gtm/voice.md` with the 2026 technical override. Register references: the two shipped siblings and the subgraphs post. H2-as-question answered in its first line, `Let's` transitions, 1-3 line paragraphs, opinions flagged ("For me", "I think"), italics-only emphasis, contractions kept.

## Follow-up this post creates

Enable the `aimock-drift.yml` cron once fixtures are recorded rather than handwritten. Tracked separately; the post does not depend on it.
