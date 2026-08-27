# Blog sequence + post #1 design: "What `injectAgent()` Actually Returns"

**Date:** 2026-08-26
**Status:** Approved (roadmap + post design approved in brainstorming session)
**Source data:** `docs/gtm/blog-topic-candidates.md` (Search Console pull, window 2026-05-25 → 08-23; lives on branch of worktree `suspicious-ellis-644600`)

## The roadmap

Brian chose to run all three strategic plays, in this order — one post each, sequentially:

1. **Convert existing traffic** — two posts:
   1. **#11 "What `injectAgent()` Actually Returns"** (`what-inject-agent-returns`) — `injectagent` is the site's top striking-distance query: 108 impressions at position 5.6, currently landing on an API reference page.
   2. **#9 "json-render vs A2UI: Choosing a Generative UI Contract"** (`json-render-vs-a2ui-choosing`) — highest-intent traffic; already #3 with a 25% CTR phrasing.
2. **Grow search surface** — **#1 "LangGraph Subgraphs: When to Split a Graph and When Not To"** (`langgraph-subgraphs-when-to-split`) — 41 impressions at position 32.3, nothing of ours competes.
3. **Distribution / reputation** — **#12 "Testing Agents Deterministically: Fixture-Replay for LLM UIs"** (`deterministic-agent-ui-testing`) — no search evidence; the flagship shareable piece.

Each later post gets its own design pass before drafting. This spec fully designs only the first.

## Post #1: What `injectAgent()` Actually Returns

**Slug:** `what-inject-agent-returns`
**File:** `apps/website/content/blog/2026-08-26-what-inject-agent-returns.mdx` (date = publish date; adjust if drafting slips)
**Meta description (<155 chars, per `apps/website/src/lib/docs.ts` truncation):** "The signals, the async methods, and the runtime-neutral Agent contract underneath — what you get from one call."

### Intent and positioning

Someone typing bare `injectagent` wants "what is this for," not "what is the signature." The existing API page (`apps/website/content/docs/langgraph/api/inject-agent.mdx`) answers signatures well. The post answers the conceptual question and **must not cannibalize the API page** — it links to it for signatures and targets the conceptual intent.

Chosen angle (of three considered): **the contract tour.** Walk the returned object in three groups — signals, methods, and the runtime-neutral `Agent` contract underneath. The contract section is the strategic payload: it turns "one call" into "and you can swap runtimes later," links `/docs/choosing-an-adapter`, and sets up the next two plays (#9 comparison post; later #19 migration post).

Rejected angles: a "projection/mental-model" frame (drifts into internals; overlaps a future stream-modes post) and a mini-tutorial (cannibalizes the quickstart and both chat tutorials).

### Structure

1. Lede: one sentence restating the title — one call, one object; here's what's actually in it. No "Introduction" header.
2. `## What are the signals?` — the reactive surface you bind templates to.
3. `## What are the methods?` — the imperative surface user actions call.
4. `## Why is the return type two types?` — `LangGraphAgent` vs. the runtime-neutral `Agent` contract, and what that separation buys. Links `/docs/choosing-an-adapter`.
5. `## What does this look like in a component?` — one short, honest snippet. Not a tutorial; link the quickstart for the full path.
6. `## Conclusion` — one paragraph; forward links to the API page, choosing-an-adapter, and the streaming-chat tutorial.

### Voice and register

Per `docs/gtm/voice.md` with the 2026 technical-post override (no invented first-person anecdotes, trimmed rhetoric, no emoji, substance over framing):

- H2-as-question scaffolding, each answered immediately.
- Contractions, short paragraphs (1–3 lines), "Let's" transitions.
- Opinions flagged as opinions where recommendations appear.
- No hype vocabulary, no marketing CTAs; close is a forward link.

### Accuracy requirements (drafting gate)

- Enumerate the returned surface **from source** (`libs/langgraph` + the `Agent` contract in `libs/chat`), not from memory. Every signal and method named in the post must exist on the published API.
- Verify claims against the current published release (v0.0.58 line) — main may be ahead of npm.
- Frontmatter must match existing blog conventions (see `2026-08-13-angular-chat-app-tutorial-with-langchain-langgraph.mdx`): title, description, date, tags, `author: brian`, `featured`, `draft`.
- Include the standard Threadplane licensing callout if the post shows `@threadplane/chat` usage.

### Out of scope

- Any docs/API-page changes.
- Posts #9, #1, #12 content design (each gets its own pass).
- Search-position tracking changes (GSC harness already live, PR #826).
