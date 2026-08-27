# LangGraph Subgraphs Blog Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a first-hand essay for the `langgraph subgraphs` query (41 impressions, position 32.3, nothing of ours competing) arguing that the boundary a subgraph really buys you is observability, not state.

**Architecture:** One new MDX file in `apps/website/content/blog/`. No code changes. At most two short code blocks (Python is fine — audience is Python-first).

**Tech Stack:** MDX blog content, Next.js website (`apps/website`), vitest for content validation.

**Spec:** `docs/superpowers/specs/2026-08-27-langgraph-subgraphs-post-design.md`
**Branch:** `blove/langgraph-subgraphs-post` (off main at `d2e5ce73`)

---

## Verified facts (I re-read each of these in source; drafter must still open them)

**The observability motive, in our own code** — `examples/chat/python/src/graph.py:276-281`, verbatim:

```
# Research subagent — a small compiled child graph the parent dispatches
# via the `research` @tool. Running it as an actual subgraph (vs. inline
# logic) is what causes LangGraph to emit stream events under namespace
# prefix `tools:<id>` for the child run, which is what the @threadplane/langgraph
# SubagentTracker keys on to populate `agent.subagents()`.
```

**Namespace gating** (`libs/langgraph/src/lib/internals/subagent-tracker.ts`):
- `isSubagentNamespace()` :265-269 — a segment must start with `tools:`.
- `extractToolCallIdFromNamespace()` :271-277 — returns the FIRST `tools:` segment only, so nested delegation attributes inner events to the outer call.
- `matchSubgraphToSubagent()` :130-175 — exact description match, then substring either direction, then the fallback at :165-169: any unmapped subagent whose status is `pending` or `running`. Heuristic, not structural.

**Streaming defaults:**
- `streamSubgraphs: streamSubgraphs ?? true` — `libs/langgraph/src/lib/transport/fetch-stream.transport.ts:154`. Subgraph streaming is opt-OUT. The SDK option is `streamSubgraphs`, not `subgraphs: true`.
- `filterSubagentMessages?: boolean` — `libs/langgraph/src/lib/agent.types.ts:283`, doc comment "When true, subagent messages are filtered from the main messages signal." Optional, so default OFF: subagent chatter lands in the parent transcript unless you opt in.
- Events are `|`-delimited (`messages|tools:call-1`), parsed in `fetch-stream.transport.ts:191-198` and `stream-manager.bridge.ts:1311-1318`.
- Namespaced terminal events would close out the parent's streaming message without a guard — `stream-manager.bridge.ts:314-330`, with `stream-manager.bridge.spec.ts:474-505` asserting outcome `interrupted`.

**The cross-transport A/B:**
- LangGraph side: `cockpit/chat/subagents` uses a real subgraph; converted from flat to subgraph in PR #718 (spec `docs/superpowers/specs/2026-06-19-cockpit-subagents-subgraph-design.md`) so a UI card would render.
- AG-UI side: `cockpit/ag-ui/subagents/python/src/graph.py` — flat `async def _run_subagent(...)` at :107 and `adispatch_custom_event("subagent_activity", {...})` at :166-168. No subgraph. Same feature.
- Rejected alternative on record: `docs/superpowers/specs/2026-05-08-*-subagents-design.md:23` — a plain `@tool` returning a synthesized payload was rejected because no `tools:` namespace events are emitted when no subgraph runs, so the card would render empty.

**Docs to link, not restate:** `apps/website/content/docs/langgraph/concepts/agent-architecture.mdx:626-696` (three-tier breakdown + decision matrix) and `apps/website/content/docs/langgraph/guides/subgraphs.mdx` (note :114 — "Plain subgraph nodes do not appear in this map").

**Hard prohibitions** (from the spec):
- Do NOT claim `cockpit/langgraph/subgraphs` demonstrates delegation or populates the sidebar — it does neither (unconditional edge `orchestrate → research → END` at `python/src/graph.py:57-58`; no `subagentToolNames` in `angular/src/app/app.config.ts`). Two separate tasks are correcting that example; the post must not depend on or contradict their outcome. Cite `cockpit/chat/subagents` and `examples/chat` for working delegation instead.
- Do NOT speculate about split performance/latency, parallel subagent fan-out, or child-specific checkpointers/state schemas. Nothing in the repo measures or exercises those.

---

### Task 1: Author the post

**Files:**
- Create: `apps/website/content/blog/2026-08-27-langgraph-subgraphs-when-to-split.mdx`

- [ ] **Step 1: Frontmatter**

```yaml
---
title: 'LangGraph Subgraphs: When to Split a Graph and When Not To'
description: 'When a LangGraph subgraph earns its complexity, how state crosses the boundary, and what your UI sees while a child graph runs.'
date: 2026-08-27
tags: [langgraph, subgraphs, agents, streaming, angular]
author: brian
featured: false
draft: false
---
```

Description is 127 chars (≤155). The drafter may sharpen the title toward the observability thesis but MUST keep "Subgraphs" early for the query, and must re-count the description if changed. No licensing callout.

- [ ] **Step 2: Body**

1. **Lede** (no header): restate the searcher's question, then land the thesis early — the boundary a subgraph really draws is usually observability, not state.
2. `## What does a subgraph actually give you?` — first line answers. The canonical pattern (compile a child, add it as a node). What genuinely changes: nested execution and namespaced stream events. What does NOT change automatically: state isolation — if parent and child share a `MessagesState`, the child appends to the parent's list. Link the architecture matrix for the tiering question rather than restating it. At most one short Python block here.
3. `## Why do people really split?` — the thesis, evidenced: quote or closely paraphrase the `examples/chat/python/src/graph.py:276-281` comment (attribute it as our own code), the rejected `@tool` alternative, and the flat→subgraph conversion done so a card would render.
4. `## What does the frontend see while a child runs?` — the differentiated section. Namespaced `|`-delimited events; `streamSubgraphs` defaults on; without namespace guards a child's terminal event closes the parent's message; `filterSubagentMessages` defaults off so child text lands in the parent transcript; attribution is heuristic (`matchSubgraphToSubagent` falls back to any unmapped pending/running subagent) and nested `tools:` collapses to the outer call — say plainly that deeper nesting is untested here.
5. `## When should you not split?` — the honest counterweight. If you don't need the observable boundary and don't have genuinely divergent state, a subgraph adds a boundary you then have to defend. Cite AG-UI doing the same feature flat because its transport has a first-class delegation event.
6. `## Conclusion` — the heuristic in a short paragraph; forward links to `/docs/langgraph/concepts/agent-architecture`, `/docs/langgraph/guides/subgraphs`, and `/blog/what-inject-agent-returns`. No CTA.

- [ ] **Step 3: Voice pass**

`docs/gtm/voice.md` with the 2026 technical override. Register references: `apps/website/content/blog/2026-08-26-what-inject-agent-returns.mdx` and `apps/website/content/blog/2026-08-26-json-render-vs-a2ui-choosing.mdx` — this post must read as the same author. Checklist: title-restating lede, no "Introduction" header, contractions, 1–3-line paragraphs, H2-as-question answered in its first line, ≥1 "Let's" per major section, opinions flagged ("I think"/"For me"), no invented anecdotes, no emoji, no hype, no CTAs. Don't copy sentences from our docs pages verbatim.

- [ ] **Step 4: Accuracy pass**

- Open every file cited in Verified Facts and confirm the claim before it ships. Cite behavior, not line numbers, in the prose — line numbers rot.
- Confirm the hard prohibitions above are respected.
- Published-release check: `npm pack @threadplane/langgraph@latest @threadplane/chat@latest` in the scratchpad; grep the `.d.ts` for any public member named (`subagents`, `filterSubagentMessages`, `subagentToolNames`, `streamSubgraphs`). Drop main-only members.

- [ ] **Step 5: Commit**

```bash
git add apps/website/content/blog/2026-08-27-langgraph-subgraphs-when-to-split.mdx
git commit -m "feat(website): add 'LangGraph Subgraphs' blog post"
```

---

### Task 2: Validate

- [ ] **Step 1: Frontmatter + description length**

```bash
cd apps/website && node -e "
const matter = require('/Users/blove/repos/angular-agent-framework/node_modules/gray-matter');
const fs = require('fs');
const f = matter(fs.readFileSync('content/blog/2026-08-27-langgraph-subgraphs-when-to-split.mdx','utf8'));
console.log('desc length:', f.data.description.length);
if (f.data.description.length > 155) throw new Error('description too long');
if (!f.data.title || !f.data.date || f.data.author !== 'brian') throw new Error('frontmatter incomplete');
console.log('OK');
"
```

- [ ] **Step 2: Test suite** (`nx test website` does not exist):

```bash
cd apps/website && npx vitest run --config vite.config.mts
```

`blog.spec.ts` and `sitemap-dates.spec.ts` must pass. Known pre-existing failures, do NOT fix, confirm the count is unchanged at 5: `PostCard.spec.tsx` (1), `Differentiator.spec.tsx` (1), `thanks/page.spec.tsx` (3).

- [ ] **Step 3: Render check** — `npx next dev -p 3111` from `apps/website` in the background, then curl:
  - `/blog/langgraph-subgraphs-when-to-split` → 200, correct `<title>`, meta description matches frontmatter, code blocks carry `data-language` with a theme
  - `/blog` lists the post

  Kill the server, confirm port 3111 free, and `git checkout apps/website/next-env.d.ts` if the dev server modified it.

- [ ] **Step 4: Commit fixes** (skip if none):

```bash
git add -A apps/website/content/blog/ && git commit -m "fix(website): render fixes for subgraphs post"
```

---

### Task 3: PR and merge

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(website): add 'LangGraph Subgraphs' blog post" --body "Third post of the GSC-driven blog sequence (spec: docs/superpowers/specs/2026-08-27-langgraph-subgraphs-post-design.md).

Targets \`langgraph subgraphs\` — 41 impressions at position 32.3, the second-highest-impression query on the site with nothing of ours competing. Argues from first-hand repo evidence that a subgraph's real payoff on LangGraph is an observable boundary rather than a state boundary.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 2: Merge on green, then verify production**

Arm auto-merge (`gh pr merge <n> --squash --auto`); only `Vercel – threadplane` gates. After merge, confirm `origin/main` carries the final content, then poll `https://threadplane.ai/blog/langgraph-subgraphs-when-to-split` until it returns 200 and spot-check the live title and meta description. Do not report "shipped" before the production URL answers 200 — a merge is not a deploy.
