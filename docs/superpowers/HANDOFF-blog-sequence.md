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
| #1 | LangGraph Subgraphs: When to Split a Graph and When Not To | **Drafted, unpushed, reviews returned BLOCKING findings** — commit `850573e3` on this branch |
| #12 | Testing Agents Deterministically: Fixture-Replay for LLM UIs | **Not started** |

## Immediate next step — post #1 needs real work before it ships

Both reviews reported. **The post is NOT ready.** Two of the findings are factual errors, one is an argument hole. Fix these, re-review, then push/PR/merge/verify.

### Blocking: two false technical claims (spec review)

**A. The attribution paragraph is backwards.** The post says attribution "is a heuristic" and that the last-resort fallback is "doing real work in practice." Both wrong:

- The **primary path is structural, not heuristic.** The namespace segment *is* the tool call id — `extractToolCallIdFromNamespace` is `segment.slice(6)` (`libs/langgraph/src/lib/internals/subagent-tracker.ts:271-277`), and `resolveToolCallId` falls back to the namespace id itself (:260-262), which is the key `registerFromToolCalls` already stored. So `markRunningFromNamespace` / `addMessageToSubagent` bind by id with no matching at all.
- `matchSubgraphToSubagent` is called from exactly one place (`stream-manager.bridge.ts:968-976`), gated on the child's `values.messages[0]` being a **human** message.
- **Neither shipped graph can satisfy that gate.** `examples/chat/python/src/graph.py:327` invokes with `messages: []`, and `cockpit/chat/subagents/python/src/graph.py:172-174` likewise. Both children start empty; the human message goes straight to `llm.ainvoke([...])` and never enters state. So the first message in child values is the AI response, and the ladder never runs in either demo. There is no `subagent-tracker.spec.ts` either.

Fix: invert the emphasis. Attribution normally rides the namespace, because `tools:<id>` carries the parent tool call id and the tracker resolves it directly. There *is* a description-comparison ladder (exact → substring → last-resort unmapped-pending) for children whose state opens with a human message, but nothing we ship reaches it — treat it as untested rather than as the mechanism. The closing warning survives and gets sharper: the ladder is what a fan-out graph would fall back on.

**B. The `streamSubgraphs` "naming trap" isn't a trap.** `streamSubgraphs` **is** the LangGraph JS SDK's own option name (`node_modules/@langchain/langgraph-sdk/dist/types.d.ts:148,187,240`), passed straight through by `buildRunPayload` (`fetch-stream.transport.ts:152-155`). `subgraphs=True` is the *Python in-process* `graph.stream()` kwarg, not the SDK. Delete the sentence or re-aim it at the Python API. (The default-on half is correct: `streamSubgraphs ?? true` at :154.)

**C. Nit:** the test asserts `phase: 'complete'` with `outcome: 'interrupted'`. "Settles as `interrupted` rather than complete" reads as a phase claim — say "settles with outcome `interrupted` rather than success."

### Blocking: the argument has a hole a skeptic finds immediately (editorial review)

The post never engages the **non-observability** reasons to split, and our own docs assert them: `docs/langgraph/guides/subgraphs.mdx:310` (own context window, isolated error boundaries), `agent-architecture.mdx:689` (State isolation: "Isolated per subagent"), and the post's own evidence file at `examples/chat/python/src/graph.py:288-291` ("the subagent is a focused contractor"). A LangGraph engineer dismisses the piece in one comment: context-window isolation, per-child error boundaries, reuse across parents, parallel fan-out.

Fix (cheap, and it *strengthens* the thesis): a paragraph conceding these are real, then reframing — context isolation and error boundaries come from what you pass into `ainvoke` and how you handle child failures, not from `compile()`. The only thing the compile step itself hands you is the namespace.

### Important, not blocking

- **Show the evidence, don't paraphrase it.** An essay whose method is "we wrote it down" currently quotes nothing. Put the five-line `examples/chat/python/src/graph.py:277-281` comment in a `python` fence. Same for `cockpit/ag-ui/subagents/python/src/graph.py:5-6`, which literally declares itself the control group ("Mirrors `cockpit/chat/subagents`' … structure, but each dispatch emits `subagent_activity` CUSTOM events").
- **The AG-UI control group is the strongest evidence and gets the least space** (200 words vs 301/404 for the other sections). It needs the controlled-experiment framing stated outright: same team, same feature, same three roles, one variable — whether the transport already carries a delegation primitive. Therefore the subgraph was never required by the feature, only by the transport. That keystone sentence isn't in the post. Fund the space by compressing the two duplicated design-doc paragraphs.
- **"Nothing was compromised by staying flat" is unsupported** in the place the post can least afford it. Name the cost (hand-rolled per-token streaming in the tool body, no independent checkpointing, no separate state).
- **`add_node` vs tool-body mismatch:** the canonical opening sample uses `builder.add_node(...)`, but all four pieces of evidence are children invoked via `ainvoke` from a `@tool` body. The post admits the gap but never says whether the thesis holds for plain `add_node` subgraphs. One sentence closes it.
- **The streaming section is a wall** — 404 words, 30% of the post, no H3s, and the post uses no bullets anywhere (the injectAgent post uses ten). Add three H3s or a lead-in list naming the hazards.
- **Audience bridge missing** where the post pivots to "in our own repo" — one sentence licensing the generalization (a natural experiment, not a portfolio) buys the next 300 words for a Python-first reader.
- **Two hazards stop at the API name** where the best paragraph earns its specifics by generalizing. `filterSubagentMessages` → *child text lands in the parent transcript by default in any consumer*; the attribution ladder → *any consumer mapping namespaces to delegations is doing string matching unless the protocol gives it an id*. That second one is a real design insight currently phrased as a config caveat.

### Minor

Cut the structural self-narration ("That's the whole post, so let's start there and then earn it") — neither sibling announces its plan. Drop "says the quiet part out loud." Compress the two design-doc paragraphs that make the same point twice. Fix the elided verb in "gets assumed and shouldn't." The frontmatter description promises "how state crosses the boundary," which is survey-flavored and slightly at odds with a post arguing state largely *doesn't* get a boundary — there's room under the limit to make it carry the thesis. Add a closing invitation (voice.md calls for one; the json-render post ends "Pick a surface you're building this week… and let me know where it lands").

### Verified clean — don't re-litigate

Both reviews independently confirmed: no mention of `cockpit/langgraph/subgraphs` anywhere; no speculation about checkpointers, latency, performance, or parallel fan-out; no line numbers in prose; no emoji, hype, "Introduction" header, CTA, or licensing callout; exactly 2 code blocks; **zero 8-gram prose overlap with either docs page**; frontmatter correct at 127 chars; all links resolve; and every evidence claim about what the cited files say is true. Voice is a strong match to both siblings (five "Let's", H2-as-question, flagged opinions, italics-only emphasis).

### One thing to raise with Brian

The docs matrix row at `agent-architecture.mdx:689` reads "State isolation | … | Isolated per subagent," which sits in tension with this post's thesis. Not a blocker (the matrix is linked, not restated), but if the post lands, that row is arguably the next thing to fix.

**Already verified locally for this post** (no need to redo unless the file changes): frontmatter valid, description 127 chars, renders 200 with correct `<title>` and meta description, both fences highlight (`python`, `text`), listed on `/blog`, working tree clean, and the website suite shows the same 5 pre-existing failures as before (unchanged by this post).

### Post #1's thesis — do not let a reviewer flatten it

The obvious "when to split" essay would co-rank against our own `apps/website/content/docs/langgraph/concepts/agent-architecture.mdx:626-696` decision matrix. Brian approved a sharper angle instead: **on LangGraph, a subgraph buys an *observable* boundary, not a state boundary.** Evidence, all first-hand:

- `examples/chat/python/src/graph.py:276-281` — a code comment stating the motive outright: running it as a real subgraph "is what causes LangGraph to emit stream events under namespace prefix `tools:<id>`… which the SubagentTracker keys on."
- `cockpit/ag-ui/subagents/python/src/graph.py` — the **strongest single piece**: the same three-subagent feature with no subgraph at all (flat `_run_subagent` at :107, `adispatch_custom_event("subagent_activity", …)` at :166-168), because AG-UI's transport has a first-class delegation event.
- `docs/superpowers/specs/2026-05-08-*-subagents-design.md:23` — a plain `@tool` alternative rejected because with no subgraph, no `tools:` events fire and the card renders empty.
- PR #718 (`docs/superpowers/specs/2026-06-19-cockpit-subagents-subgraph-design.md`) — `cockpit/chat/subagents` was converted flat→subgraph purely so a UI card would render.

Full design rationale: `docs/superpowers/specs/2026-08-27-langgraph-subgraphs-post-design.md`. Task-level plan: `docs/superpowers/plans/2026-08-27-langgraph-subgraphs-post.md`.

## Two live defects — NOT fixed

Both were spawned as background tasks and **both sessions were deleted before landing anything**. No branch, no PR. They are still real:

1. **`cockpit/langgraph/subgraphs/python/docs/guide.md:112` states a falsehood** — claims subgraph events surface through `stream.subagents()`. For that example they cannot: it adds a compiled subgraph as a plain node (`python/src/graph.py:55`), emitting namespace `research:<uuid>`, but the tracker only routes `tools:`-prefixed namespaces (`libs/langgraph/src/lib/internals/subagent-tracker.ts:265-269`) and additionally requires `subagentToolNames` + `args.subagent_type` (:78-112). The Angular app sets no `subagentToolNames` and never has. Our published docs already say the opposite at `apps/website/content/docs/langgraph/guides/subgraphs.mdx:114`.
2. **The example doesn't demonstrate what it advertises** — the docstring at `python/src/graph.py:22` claims the orchestrator "decides when to delegate," but the edge at :57-58 is unconditional. The subagent sidebar (`angular/src/app/subgraphs.component.ts:112-119`) can never populate, and `e2e/manual/subgraphs.manual.ts:12` asserts `text=No active subagents` as its only assertion — a test passing vacuously.

Post #1 is written to neither depend on nor contradict either fix, so it can ship first. Re-spawn these if Brian still wants them.

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
