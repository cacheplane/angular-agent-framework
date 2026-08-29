# "What Fixture Replay Can't Catch" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship blog post #12 — an essay arguing that a deterministic agent-test harness buys determinism by deleting time, which makes mid-stream self-correcting bugs structurally invisible to a green suite.

**Architecture:** One new MDX file under `apps/website/content/blog/`. No code changes, no new components. The website renders blog posts from frontmatter + markdown; the filename encodes date and slug.

**Tech Stack:** MDX, Next.js (apps/website), gray-matter frontmatter, Shiki fences.

**Source of truth:** `docs/superpowers/specs/2026-08-28-fixture-replay-post-design.md`. Read it before Task 1.

---

## File Structure

- **Create:** `apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx` — the entire deliverable.

The filename must match `YYYY-MM-DD-<slug>.mdx`; `apps/website/src/lib/blog.ts` parses date and slug from it and throws if `title`, `description`, `date`, or `author` are missing from frontmatter.

---

### Task 1: Frontmatter and skeleton

**Files:**
- Create: `apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx`

- [ ] **Step 1: Create the file with exactly this frontmatter**

```mdx
---
title: "What Fixture Replay Can't Catch"
description: 'Our agent e2e suite replaces the model and keeps everything else real. That buys determinism by deleting time — and one bug class disappears with it.'
date: 2026-08-28
tags: [testing, langgraph, agents, streaming, angular]
author: brian
featured: false
draft: false
---
```

Rules: `author` must be `brian` (the only value in use). `description` must stay under 180 characters — docs meta descriptions truncate there. Count it before moving on.

- [ ] **Step 2: Add the H2 skeleton, in this order**

```
## Where do you put the mock?
## What does a fixture match on?
## What did we trade away?
## What does that hide?
## What runs alongside it?
## Conclusion
```

Every H2 is a question except the last, and each must be answered in its first line.

- [ ] **Step 3: Verify frontmatter parses**

Run:
```bash
cd apps/website && npx vitest run --config vite.config.mts src/lib/blog.spec.ts
```
Expected: PASS. A missing required field throws at read time, so a failure here means frontmatter is malformed.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx
git commit -m "feat(website): scaffold the fixture-replay post"
```

---

### Task 2: Opening and the seam

**Files:**
- Modify: `apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx`

- [ ] **Step 1: Write the opening, before the first H2**

Two to four lines. State the thesis outright: a deterministic harness buys determinism by deleting a dimension, ours deletes time, and the useful question about any harness is which dimension it deleted.

Do not announce the post's structure ("first we'll look at..."). Neither sibling post does, and a reviewer flagged it on the subgraphs post.

- [ ] **Step 2: Write "Where do you put the mock?"**

Answer in the first line: at the model provider, not the app.

Content, all verified — do not restate line numbers in prose:
- `libs/e2e-harness/src/global-setup-factory.ts` spawns a real `langgraph dev` subprocess with `OPENAI_BASE_URL` pointed at the mock server and `OPENAI_API_KEY: 'test-not-used'`.
- Everything above that seam is the real thing: real Angular app, real transport, real LangGraph server, real Python graph nodes. Only the model is replaced.
- Scale: 50 fixture files, 129 fixture entries, 34 apps. **Say "34 apps" or "32 cockpit capabilities and 2 example apps" — never "34 capabilities."** Two of them are examples.

Include one fenced `typescript` block showing the seam. Use exactly this, which is faithful to the source:

```typescript
const aimock = await startAimock({ mode: 'replay', fixturePath: opts.fixturesDir });

spawn('uv', ['run', 'langgraph', 'dev', '--port', String(langgraphPort)], {
  env: {
    ...process.env,
    OPENAI_BASE_URL: aimock.baseUrl,   // the only thing that isn't real
    OPENAI_API_KEY: 'test-not-used',
  },
});
```

- [ ] **Step 2b: Link the docs tier rather than restating it**

One sentence pointing at [`/docs/langgraph/guides/testing`](/docs/langgraph/guides/testing) for the in-process fakes (`provideFakeAgent()`, `mockLangGraphAgent()`, `MockAgentTransport`). Do not explain those APIs — that page owns them, and restating them risks co-ranking.

- [ ] **Step 3: Check verbatim overlap against that docs page**

Run:
```bash
cd apps/website && python3 - <<'EOF'
import re
def prose(p):
    t=open(p).read(); t=re.sub(r'```.*?```','',t,flags=re.S)
    t=re.sub(r'^---.*?^---','',t,flags=re.S|re.M); t=re.sub(r'<[^>]+>','',t)
    return re.findall(r"[a-z']+",t.lower())
post=prose('content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx')
w=prose('content/docs/langgraph/guides/testing.mdx')
doc=set(tuple(w[i:i+8]) for i in range(len(w)-7))
hits=[' '.join(post[i:i+8]) for i in range(len(post)-7) if tuple(post[i:i+8]) in doc]
print("8-gram overlap:",len(hits),hits[:3])
EOF
```
Expected: `8-gram overlap: 0`. Any hit means a phrase was lifted — rewrite it in your own words and re-run.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx
git commit -m "feat(website): opening and the seam"
```

---

### Task 3: Fixture matching and the ordering trap

**Files:**
- Modify: `apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx`

- [ ] **Step 1: Write "What does a fixture match on?"**

Answer in the first line: on the shape of the request, and the order you list them decides which one wins.

Content, verified against `cockpit/langgraph/client-tools/angular/e2e/fixtures/client-tools.json`:
- A fixture entry carries a `match` block. Discriminators include `userMessage`, plus richer ones like `toolName` and `hasToolResult` that distinguish a first call from the continuation after a tool round.
- Matching is **first-match-wins**.
- That file holds 7 entries in pairs, and in every pair the `hasToolResult: true` entry is listed **before** its plain `userMessage` twin.
- Reverse a pair and the post-tool continuation re-matches the original tool call, so the model is told to call the tool again — an infinite loop where the assistant never finalizes.

- [ ] **Step 2: Add one fenced `json` block**

Show the ordering, abbreviated but structurally faithful:

```json
{
  "fixtures": [
    { "match": { "userMessage": "book a flight", "hasToolResult": true }, "response": "..." },
    { "match": { "userMessage": "book a flight" }, "response": "..." }
  ]
}
```

Then one line: swap those two and the run never terminates.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx
git commit -m "feat(website): fixture matching and the ordering trap"
```

---

### Task 4: The trade, and what it hides

**Files:**
- Modify: `apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx`

This is the heart of the post. Give it the most care.

- [ ] **Step 1: Write "What did we trade away?"**

Answer in the first line: the streaming, on purpose.

Content, verified in `libs/e2e-harness/src/aimock-runner.ts`:
- The mock is constructed with `chunkSize: 4096`, which is large enough that each response arrives in one or two SSE deltas.
- The reason is written in a comment above it: structural assertions (a code fence, a list) are meant to measure the **final** rendered DOM, not the progressive render. With default chunking the partial-markdown parser sometimes cannot recover a triple-backtick fence that gets split mid-token, and the final state degrades to an inline `<code>` instead of a `<pre><code>`.
- Progressive behavior is covered by unit-level variance tables instead.

Quote the comment in a fenced `typescript` block rather than paraphrasing it — the essay's method is "we wrote it down," so show the writing:

```typescript
// Use a large chunkSize so each response arrives in 1-2 SSE deltas. This
// intentionally turns off the partial-markdown streaming path for harness
// tests: structural assertions (code fence, list) measure the FINAL rendered
// DOM, not the progressive render.
const mock = new LLMock({ port: 0, chunkSize: 4096 });
```

Flag the opinion: this is a defensible trade, and the point is that it was made deliberately and recorded, not that it was wrong.

- [ ] **Step 2: Write "What does that hide?"**

Answer in the first line: bugs that exist only while the stream is open and fix themselves before it closes.

Content — this is the worked example, measured on 2026-08-27:
- The `cockpit/langgraph/subgraphs` demo runs a child graph as a plain node. Its namespace is not a `tools:` subagent namespace, so the bridge merges the child's tokens into the transcript as they arrive.
- Without `transcriptNodeNames: ['answer']`, the child's internal research brief renders as its own chat bubble, and the message list transiently reaches three.
- The parent's final `values` event then rewrites the message list from authoritative graph state, and the stray bubble disappears.
- So the end state is correct. Assert on the finished DOM and the test passes. The defect is real and invisible to it.
- Confirming the fix took sampling the DOM every 60ms against a live model across a full streaming run: the message count never exceeded two across 56 samples.

Generalize in one line: any assertion that runs after `await` sees a settled system, and a self-correcting bug is exactly the kind that settles.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx
git commit -m "feat(website): the determinism trade and the bug class it hides"
```

---

### Task 5: What runs alongside, and the close

**Files:**
- Modify: `apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx`

- [ ] **Step 1: Write "What runs alongside it?"**

Answer in the first line: a live pass for the things replay structurally cannot see, and a drift check for the fixtures themselves.

Two pieces of content:

1. **The live gate.** Replay cannot see streaming re-materialization, so anything whose failure mode is mid-stream needs driving against a real model before it ships. Keep this short and concrete; do not oversell it as a formal system.

2. **Drift.** `examples/chat/angular/e2e/scripts/drift.ts` re-records each committed fixture against the live provider and compares it to the committed copy, flagging any whose size diverges by more than twenty percent; the workflow opens an issue when it trips.

**CRITICAL — do not claim a cadence.** Do not write "nightly", "weekly", "on a schedule", or "in CI on every run" about drift detection. Describe the mechanism only. The cron is currently not enabled. Mechanism-only phrasing is accurate now and stays accurate after it is enabled.

Then be honest about what that check can prove, because it is another instance of the thesis: comparing byte size detects that a response changed *size*, not that it changed *meaning*. A model that returns something equally long and completely different passes.

- [ ] **Step 2: Write the Conclusion**

Restate the heuristic without repeating earlier sentences verbatim: pick your seam as far out as you can afford, then write down which dimension you deleted, because that is the list of bugs your suite cannot report.

End with an invitation, matching the siblings — the json-render post closes by asking where it lands for the reader. Do not write a marketing CTA.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx
git commit -m "feat(website): the live gate, drift, and the close"
```

---

### Task 6: Validate

**Files:**
- Modify: `apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx` (only if a check fails)

- [ ] **Step 1: Check the mechanical constraints**

Run:
```bash
cd apps/website && python3 - <<'EOF'
import re
p='content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx'
s=open(p).read(); body=re.sub(r'^---.*?^---','',s,flags=re.S|re.M)
prose=re.sub(r'```.*?```','',body,flags=re.S)
d=re.search(r"^description: '(.*)'$",s,re.M) or re.search(r'^description: "(.*)"$',s,re.M)
print("description chars:",len(d.group(1)))
print("words:",len(prose.split()))
print("fences:",re.findall(r'```(\w+)',s))
print("emoji present:",bool(re.search(r'[\U0001F300-\U0001FAFF]',s)))
for bad in ['nightly','weekly','on a schedule','every night']:
    if bad in prose.lower(): print("!! CADENCE CLAIM:",bad)
EOF
```
Expected: description under 180; words roughly 1200-1500; fences are `typescript`, `json`, `typescript`; no emoji; no cadence claim.

- [ ] **Step 2: Check overlap against the testing docs page**

Re-run the overlap script from Task 2 Step 3. Expected: `8-gram overlap: 0`.

- [ ] **Step 3: Render it**

Run:
```bash
cd apps/website && npx next dev -p 3111
```
Then in a second shell:
```bash
curl -s -o /tmp/p.html -w '%{http_code}\n' http://localhost:3111/blog/what-fixture-replay-cant-catch
grep -o '<title>[^<]*</title>' /tmp/p.html
grep -c 'data-language' /tmp/p.html
curl -s http://localhost:3111/blog | grep -c 'what-fixture-replay-cant-catch'
```
Expected: `200`; a `<title>` containing the post title; a non-zero `data-language` count (fences highlighted); `1` for the listing.

Note: `next dev` rewrites `apps/website/next-env.d.ts`. Run `git checkout apps/website/next-env.d.ts` before committing.

- [ ] **Step 4: Run the website suite**

Run:
```bash
cd apps/website && npx vitest run --config vite.config.mts
```
Expected: **10 failures, 5 files** — and confirm they are the same ones present on `main`: `thanks/page.spec.tsx` (3), `PostCard.spec.tsx`, `Differentiator.spec.tsx`, plus `api/ingest/route.spec.ts` and `lib/analytics/server.spec.ts` failing to resolve `posthog-node`.

These are pre-existing and unrelated. Do not fix them in this PR. If the count differs from 10, this post broke something — investigate before continuing.

`nx test website` does **not** work. Use the vitest command above.

- [ ] **Step 5: Commit any fixes**

```bash
git add apps/website/content/blog/2026-08-28-what-fixture-replay-cant-catch.mdx
git commit -m "fix(website): validation fixes for the fixture-replay post"
```

---

## Hard prohibitions

Carried from the spec. Violating any of these fails the task:

- **No invented first-person anecdotes.** Brian's instruction: "don't make up stories." Every concrete claim traces to a file in this repo.
- **No cadence claim about drift detection.** Mechanism only.
- **Never write "34 capabilities."** It is 34 apps: 32 cockpit capabilities plus 2 example apps.
- **No claim that the suite catches more than it does.** The thesis is the opposite.
- No emoji, no hype, no marketing CTA, no "Introduction" heading, no licensing callout.
- No line numbers in prose.
- Do not restate the testing guide's in-process API surface; link it.
- If you name a public API member, verify it exists in the published package, not just in `main` — releases fire only on a pushed tag and `main` runs ahead of npm.

## Voice

`docs/gtm/voice.md`, with the 2026 technical override. Register references: `2026-08-26-what-inject-agent-returns.mdx`, `2026-08-27-json-render-vs-a2ui-choosing.mdx`, `2026-08-27-langgraph-subgraphs-when-to-split.mdx`.

- H2 as a question, answered in its first line.
- `Let's` transitions — the siblings use about four each. Do not substitute a demonstrative tic (`That's`, `Here's`); a reviewer counted 13 `That's` in the subgraphs draft and flagged it.
- Paragraphs of one to three lines. Put each sentence on its own source line, as the siblings do.
- Flag opinions: "For me", "I think".
- Italics for emphasis, never bold, in body prose.
- Contractions throughout.
