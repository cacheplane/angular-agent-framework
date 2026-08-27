# Handoff: GSC-driven blog sequence

**Written:** 2026-08-27
**Worktree:** `/Users/blove/repos/angular-agent-framework/.claude/worktrees/threadplane-a2ui-migration-94f7b6`
**Current branch:** `blove/langgraph-subgraphs-post` (3 commits ahead of `origin/main`, **not pushed**)

---

## What this is

Brian ranked 20 blog candidates against a Search Console pull and approved a four-post sequence running three strategic plays in order: convert existing traffic, grow search surface, then earn distribution. Two posts are live; the third is drafted and unpushed; the fourth is unstarted.

The candidates doc lives at `docs/gtm/blog-topic-candidates.md` **on a different worktree branch** (`suspicious-ellis-644600`) and is NOT on main. Read it there if you need the full evidence table.

## Sequence status

| # | Post | Status |
|---|---|---|
| #11 | What `injectAgent()` Actually Returns | **Live** — [threadplane.ai/blog/what-inject-agent-returns](https://threadplane.ai/blog/what-inject-agent-returns), PR #836 |
| #9 | json-render vs A2UI: Choosing a Generative UI Contract | **Live** — [threadplane.ai/blog/json-render-vs-a2ui-choosing](https://threadplane.ai/blog/json-render-vs-a2ui-choosing), PR #837 |
| #1 | LangGraph Subgraphs: When to Split a Graph and When Not To | **Shipped** — see the section below for what the reviews changed |
| #12 | Testing Agents Deterministically: Fixture-Replay for LLM UIs | **Not started** |

## What the reviews changed in post #1

Both reviews returned blocking findings and all were real. Recorded here because two of them are traps a future post could repeat.

**Attribution is structural, not heuristic.** The `tools:<id>` namespace segment *is* the parent tool call id (`extractToolCallIdFromNamespace` is `segment.slice(6)`; `resolveToolCallId` falls back to the namespace id itself). The description-comparison ladder exists but is unreachable in every shipped graph. Do not describe it as the mechanism.

**`streamSubgraphs` is the LangGraph JS SDK's own option name** (`@langchain/langgraph-sdk` `types.d.ts:148,187,240`), not a Threadplane rename. The `subgraphs=True` kwarg is the Python in-process `graph.stream()` API.

**The discriminator for an earned split is control flow, not state schema.** `examples/chat` and `cockpit/chat/subagents` both define custom child `TypedDict`s yet are single-node straight lines, so "the child has its own state schema" fails to separate an earned split from an observability split. Only `examples/ag-ui` — child with its own `agent → tools → agent` loop and iteration cap — earns it on the merits.

**`examples/ag-ui` is a counterexample the first draft missed.** It compiles a child on a transport that already emits `subagent_activity`, so that split is not buying observability. The post now owns this rather than claiming no such case exists.

**Checkpointing is a trap in both directions.** Both subgraph children compile bare (`.compile()`, no checkpointer) while the *flat* `cockpit/ag-ui/subagents` graph is the one using `MemorySaver`. So "compile() gives the child its own checkpoint lineage" is false, and so is listing "no independent checkpointing" as a cost of staying flat. An editorial reviewer proposed the first of those as a fix — verify reviewer suggestions in source before applying them.

## Two live defects — FIXED

Both were real, and both were fixed by #838 (`cockpit/langgraph/subgraphs` now routes conditionally and gives the child a state schema with no `messages` key). Kept here for the record:

1. **`cockpit/langgraph/subgraphs/python/docs/guide.md:112` states a falsehood** — claims subgraph events surface through `stream.subagents()`. For that example they cannot: it adds a compiled subgraph as a plain node (`python/src/graph.py:55`), emitting namespace `research:<uuid>`, but the tracker only routes `tools:`-prefixed namespaces (`libs/langgraph/src/lib/internals/subagent-tracker.ts:265-269`) and additionally requires `subagentToolNames` + `args.subagent_type` (:78-112). The Angular app sets no `subagentToolNames` and never has. Our published docs already say the opposite at `apps/website/content/docs/langgraph/guides/subgraphs.mdx:114`.
2. **The example doesn't demonstrate what it advertises** — the docstring at `python/src/graph.py:22` claims the orchestrator "decides when to delegate," but the edge at :57-58 is unconditional. The subagent sidebar (`angular/src/app/subgraphs.component.ts:112-119`) can never populate, and `e2e/manual/subgraphs.manual.ts:12` asserts `text=No active subagents` as its only assertion — a test passing vacuously.

Post #1 was held until #838 landed, then re-checked against it — the fixed example is now cited in the post as first-hand evidence that state isolation is designed, not handed to you by `compile()`.

## Post #12 — research was in flight, results lost

A research pass was running when the session ended; its findings are gone. Re-run it before designing. What it was asked to establish (all read-only):

- How the aimock harness works end to end: what it intercepts, record vs replay, fixture format, how a test selects a fixture set.
- **Fixture matching semantics** — the matching keys and, critically, the ordering constraint: a `hasToolResult: true` entry must precede the plain `userMessage` entry, or the continuation re-matches the tool call and loops forever.
- **What replay cannot catch** — replay is roughly atomic (one content snapshot), so streaming re-materialization warnings (NG0956, `@for` recreation) can't fire and console-guard e2e assertions false-pass. There's a live-LLM smoke-gate convention as the counterweight.
- Concrete war stories from specs and git history; scale facts (fixture count, which suites, runtime) to make "we run our entire e2e suite this way" checkable.
- What we should NOT publish.

This is the only post with **no search evidence** — it's a bet on being genuinely differentiated and shareable. If the research comes back thin, say so rather than padding it.

## The pipeline (used for all three posts; it works)

1. **Design pass** — research the repo for first-hand material, present 2–3 angles with a recommendation, get Brian's approval. He engages with this and picks.
2. **Spec** → `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, commit.
3. **Plan** → `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`, commit. Include a "Verified facts" block with paths/lines you personally read.
4. **Implementer subagent** — give it the full task text, the verified facts, hard prohibitions, and the voice gate. Never make it read the plan file.
5. **Spec-compliance review subagent** — explicitly told not to trust the implementer's report; verifies claims against source.
6. **Editorial review subagent** — prose, argument, voice fidelity, MDX mechanics; told a separate agent handles spec compliance.
7. **Apply findings → re-review → validate → PR → auto-merge → verify production.**

Run the two reviews in parallel; they don't conflict.

## Hard-won conventions

**Voice.** `docs/gtm/voice.md` with a 2026 technical override: no invented first-person anecdotes (Brian: "don't make up stories"), no emoji, trimmed rhetoric. Keep contractions, "Let's" transitions, 1–3-line paragraphs, H2-as-question answered in its first line, opinions flagged ("For me," "I think"), no hype, no marketing CTAs. Register references are the two shipped posts.

**No licensing callout.** Brian removed it from post #11 as unnecessary. Don't reintroduce it.

**Don't co-rank against our own docs.** Every post so far had a docs page targeting the same query. The post must answer the *decision* the searcher faces and link the docs page for mechanics. Check for verbatim runs against the docs page before shipping — reviewers caught three in post #9.

**Verify against published tarballs, not just source.** Main routinely runs ahead of npm (releases fire only on a pushed tag). `npm pack @threadplane/<pkg>@latest` into the scratchpad and grep the `.d.ts` for every public member the post names. Drop main-only members.

**`nx test website` does not exist** — it fails silently-ish. Use `cd apps/website && npx vitest run --config vite.config.mts`.

**5 pre-existing test failures**, unrelated to any of this work and red long enough to have drifted: `PostCard.spec.tsx` (expects a raw date the component now formats), `Differentiator.spec.tsx` (assertion drift), `thanks/page.spec.tsx` (3). Confirm the count is unchanged; don't fix them inside a content PR. Worth a separate cleanup — Brian hasn't decided.

**Merge is not a deploy.** Only `Vercel – threadplane` gates merge. Vercel preview URLs are SSO-protected, so verify locally on `npx next dev -p 3111` and then poll the production URL until it returns 200 before claiming shipped. On post #9 the PR merged while two accuracy fixes were still in flight — "merged" wouldn't have proven the right content shipped, so re-check `origin/main` content and the live page.

**Dev server side effect:** `next dev` modifies `apps/website/next-env.d.ts`. `git checkout` it before committing.

## Gotchas that bit us

- A Fable 5 subagent hit a usage limit mid-task and died **leaving its edits uncommitted in the working tree**. Don't assume a dead agent did nothing — check `git status` and verify each expected change before committing on its behalf.
- An editorial reviewer suggested wording that was itself a factual overreach ("a submit action *always* goes back"); its own re-review caught it. Validation checks can block a submit — `libs/chat/src/lib/a2ui/surface.component.ts:203`. Verify reviewer suggestions in source before applying them.
- Post #9's snippet needed real schema validation: `Card` has no `title` prop, and the A2UI envelopes were checked against `libs/a2ui/schemas/server_to_client.json` and round-tripped through the published parser. Plausible-looking JSON is not good enough.
