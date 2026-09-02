# PR 4: Blog Post Rewrites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the two confessional blog posts so they teach the same lessons as design rationale — no incident narrative, no open-gap admissions — and are truthful against the post-PR-1/2/3 codebase.

**Architecture:** Surgical passage replacements in `2026-08-27-langgraph-subgraphs-when-to-split.mdx`; section-level rewrites in `2026-08-29-what-fixture-replay-cant-catch.mdx`. Both posts are live, so this updates published content in place (dates unchanged). The two 2026-08-26 posts are untouched.

**Hard dependency:** PRs 1–3 must be merged (or at minimum on this branch) before this lands — every rewritten claim below is only true after them. Do not reorder.

**Voice:** per `docs/gtm/voice.md` — short lines, contractions, "Let's", opinions flagged ("For me"), closing invitation. Never fabricate first-person stories; the rewrites below only *remove* narrative, they don't invent any. Never name competitors.

**Spec:** `docs/superpowers/specs/2026-09-01-blog-damage-control-design.md` (PR 4 section).

---

### Task 1: Surgical edits to the subgraphs post

**Files:**
- Modify: `apps/website/content/blog/2026-08-27-langgraph-subgraphs-when-to-split.mdx`

Apply each edit with Edit-tool exact-match replacements. Line numbers are pre-edit.

- [ ] **Edit A (lines 97–99)** — drop the "working feature was restructured" confession.

Old:
```text
Then there's the conversion.
Our `cockpit/chat/subagents` demo originally ran its three specialists as a flat in-process helper, and was rewritten to dispatch a real compiled child graph — because the flat version emitted no namespace events, so `subagents()` stayed empty and no card rendered.
A working feature was restructured so a UI card would appear.
```

New:
```text
Our `cockpit/chat/subagents` demo makes the same call.
Its three specialists dispatch through a real compiled child graph because the subgraph run is what emits namespace events — and the namespace events are what the tracker turns into per-child progress.
Run the specialists as a flat in-process helper and the feature still works; the UI just can't see it working.
```

- [ ] **Edit B (lines 104–111)** — drop the docs-were-blunt / "framework was the last to admit it" history; describe both identity paths as current design.

Old:
```text
For a long time that was also the only way into the map: plain `add_node` subgraphs streamed under a namespace nobody claimed, so [our own docs](/docs/langgraph/guides/subgraphs) were blunt that they didn't show up at all.
That's no longer true.
The namespace segment is itself a workable identity — unique per invocation, prefixed with the node name — so a plain subgraph child now registers in `subagents()` under its namespace key the moment it first streams, named by its node.
The subgraph is what makes the events observable; the tool call upgrades that identity from a node name to a real delegation record, with arguments a UI can render.

Which cuts the other way from how it sounds — plain `add_node` subgraphs make the visibility point sharper, not weaker.
Nothing about them was ever invisible.
The framework was simply the last to admit it.
```

New:
```text
A plain `add_node` subgraph has an identity too, just a thinner one.
Its namespace segment is unique per invocation and prefixed with the node name, so it registers in `subagents()` under its namespace key the moment it first streams, named by its node.
The subgraph is what makes the events observable; the tool call upgrades that identity from a node name to a real delegation record, with arguments a UI can render.
```

- [ ] **Edit C (lines 141–156, "Where child text goes")** — remove the "ours took that path for a long time" arc and the live-model-probe confession; keep the self-correcting insight as a design rationale.

Old (the entire section body, from "Onto the child's stream — and, as of this week, nowhere else." through "...like routers and title generators."):
```text
Onto the child's stream — and, as of this week, nowhere else.

Any consumer reading a namespaced stream has to decide what a child's tokens mean, and "append them like everything else" is the path of least resistance.
Ours took that path for a long time: child tokens merged into `messages()` unless an opt-out flag was set, and the flag itself only fired for `tools:` namespaces — so for a plain subgraph node it silently did nothing, and the child's internal notes rendered as their own chat bubble mid-stream.

What made that bug expensive is that it self-corrected.
The parent's final `values` event rewrites the message list from authoritative graph state, so the stray bubble disappeared on its own once the run settled.
Assert on the finished DOM and everything looks right; watch the streaming pass and you'd see the child's notes appear and then vanish.
A final-state test cannot catch it — we found it by watching a live model with the DOM under a polling probe.

The fix was to stop making it a decision at all.
A namespaced event belongs to its child, structurally: it feeds that child's `messages()` on the subagent stream and never merges into the parent transcript.
The opt-out flag is gone because there's nothing left to opt out of.
What the transcript shows at settle is decided by state — a shared `messages` key delivers the child's message through the final `values` sync; an isolated child schema means it never arrives.
`transcriptNodeNames` still exists for the genuinely separate problem of *top-level* side-effect nodes, like routers and title generators.
```

New:
```text
Onto the child's stream — and nowhere else.

Any consumer reading a namespaced stream has to decide what a child's tokens mean, and "append them like everything else" is the path of least resistance.
It's also a trap, and a well-hidden one.
Merge a child's tokens into the transcript and its internal notes render as their own chat bubble mid-stream — then the parent's final `values` event rewrites the message list from authoritative graph state, and the stray bubble disappears on its own.
The end state looks right. The streaming pass didn't.

So we don't make it a decision at all.
A namespaced event belongs to its child, structurally: it feeds that child's `messages()` on the subagent stream and never merges into the parent transcript.
There's no opt-out flag because there's nothing to opt out of.
What the transcript shows at settle is decided by state — a shared `messages` key delivers the child's message through the final `values` sync; an isolated child schema means it never arrives.
`transcriptNodeNames` still exists for the genuinely separate problem of *top-level* side-effect nodes, like routers and title generators.
```

- [ ] **Edit D (lines 158–176, "How does a child get attributed?")** — remove "Treat that path as untested" and the nested "don't build on it" warning; describe the ladder's conservatism and the (new, real) nested behavior.

Old (from "There is also a description-comparison ladder" through "so don't build on it."):
```text
There is also a description-comparison ladder — exact match on the tool call's `description` argument, then substring either direction, then a last-resort fallback to any unmapped subagent still pending or running.
It only runs for children whose state opens with a human message, and none of the graphs we ship reach it.
The ones dispatched through a tool call invoke the child with an empty message list, so the first message in child state is the AI response.
The one wired in as a plain node doesn't keep a `messages` key in child state at all.
Treat that path as untested rather than as the mechanism.

The general point survives, though, and it's the one worth carrying to any protocol.
A consumer mapping child runs onto delegations is doing string matching unless the protocol gives it an id.
LangGraph gives it an id — which is why the ladder is vestigial here and would be load-bearing in a fan-out graph with look-alike children.

One limit, though: only the _first_ `tools:` segment of a namespace is read.
A subagent that itself delegates will have its inner events attributed to the outer tool call.
Nothing in this repo exercises deeper nesting, so don't build on it.
```

New:
```text
There is also a description-comparison ladder for streams the id can't resolve — exact match on the tool call's `description` argument, then substring either direction, then a positional fallback that only fires when exactly one unmapped subagent is still pending or running.
That last rung is deliberately conservative.
With parallel children in flight, guessing would cross-wire one card's output into another, so an unattributed stream stays buffered instead — an empty card beats a confidently wrong one.

The general point is the one worth carrying to any protocol.
A consumer mapping child runs onto delegations is doing string matching unless the protocol gives it an id.
LangGraph gives it an id — which is why the ladder is a fallback here and would be load-bearing in a fan-out graph with look-alike children.

Nesting is worth knowing about too.
A subagent that itself delegates gets its own entry in `subagents()`, keyed by its full namespace path, the same way a plain subgraph node does.
Each level of delegation surfaces as its own stream; the map stays flat, so there's no parent/child tree to walk.
```

- [ ] **Edit E (line 192)** — fix the typo.

Old: `So so the specialists stayed a flat `
New: `So the specialists stayed a flat `

- [ ] **Step: run the website suite and commit**

Run: `npx nx test website`
Expected: PASS.

```bash
git add apps/website/content/blog/2026-08-27-langgraph-subgraphs-when-to-split.mdx
git commit -m "docs(blog): rewrite subgraphs post — behavior as design rationale, current attribution model"
```

---

### Task 2: Section rewrites in the fixture-replay post

**Files:**
- Modify: `apps/website/content/blog/2026-08-29-what-fixture-replay-cant-catch.mdx`

- [ ] **Edit A — section "What did we trade away?"** (lines 85–115, from "The streaming, on purpose." through "…the one flying blind."). Replace the whole section body with:

```text
The streaming, by default.

The mock is constructed with a chunk size large enough that every response arrives in one or two server-sent events. Here's the note that sits above it:

​```typescript
// Use a large default chunkSize so ordinary fixture responses arrive in 1-2
// SSE deltas: most e2e assertions measure the final rendered DOM, and big
// chunks keep them deterministic. This is a determinism default, not a
// workaround — streaming-progressive behavior is covered by the unit
// variance tables and by fixtures that opt into small per-fixture
// chunkSize/latency values.
const mock = new LLMock({ port: 0, chunkSize: 4096 });
​```

Structural assertions — a code fence renders as a block, a list is a list — are final-state invariants, and big chunks keep them from depending on where a token boundary happened to fall.

That 4096 is a _default_, not a law, and the second half of that comment is the useful half.
Targeted streaming regressions opt into smaller per-fixture chunks: fixtures that set chunk sizes of three, four, six, thirty-six, with latencies from 25 to 750 milliseconds, and e2e tests that sample the mid-stream DOM while it renders.
What a real model's chunking does to a triple-backtick fence is covered one tier down too, in unit tables that drive the markdown parser one character at a time.

So "we deleted time" is too tidy. What we did was delete it by default and buy it back per fixture, in the places somebody decided the progressive render was the thing under test.

Which turns the question into a better one. Not *what did the harness give up*, but *which fixtures opted back in* — because a tier where nothing does is flying blind on everything mid-stream.
```
(Un-escape the code fence — the `​` marks above exist only so this plan file's own fences survive.)

- [ ] **Edit B — section "What does that hide?"** (lines 117–137). Replace the whole section body with:

```text
Bugs that exist only while the stream is open and fix themselves before it closes.

Here's the shape, built from a mechanism [the subgraphs post](/blog/langgraph-subgraphs-when-to-split) walks through.
A child graph's tokens stream in under a namespace. A consumer that merged them into the transcript would show an extra chat bubble mid-run — the child's internal notes, rendered as if the assistant said them. Then the run settles, the parent publishes its authoritative state, the transcript is rebuilt from it, and the extra bubble vanishes.

Read that sequence from a test's point of view.
The end state is correct. Two messages, in the right order.
Assert on the finished DOM and it passes — not by luck.

That's why our transport routes child tokens structurally instead of by merge decision — and it's why *verifying* that property means driving a live model and sampling the DOM on a tight interval for the length of a full run, watching that the message count never crosses two. Not something a final-state suite does, and not something it could tell you.

Let's generalize, because this isn't specific to us.
Any assertion that runs after an `await` sees a settled system. A self-correcting bug is precisely one that settles.
So the class of defects a final-state suite cannot see isn't random — it's exactly the ones that repair themselves.
```

- [ ] **Edit C — section "What runs alongside it?"** (lines 139–158). Replace the whole section body with:

```text
A live pass for what replay structurally can't see, and a weekly drift run for the model itself.

The live pass is unglamorous: for anything whose failure mode is mid-stream, drive it against a real model in a real browser before it ships.
There's no clever tooling in it. The deterministic suite is for final-state invariants, and mid-stream behavior isn't one of them.

Drift is the other half, and the tempting design is the wrong one.
Re-record fixtures and diff the bytes and you detect that a response changed *size* while learning nothing about whether it changed *meaning* — the same trade again, one layer up. A model that starts returning something equally long and completely different sails straight through a size check.

So the drift check isn't a new metric. It's the assertions we already trust.

The drift run takes a tagged subset of the same e2e suite — contract assertions only: a reply renders, the research dispatch surfaces a subagent card, the interrupt panel appears — and points it at the live provider through the mock's record-proxy, which any app on the harness can switch on with an environment variable.
No fixtures judged, no thresholds invented.
If today's model stops calling the research tool, or the graph's prompts stop eliciting the interrupt, a spec we already believe in goes red and a weekly job opens an issue. Meaning drift is caught by construction.

One rule makes the subset work: a tagged assertion may depend on structure or on the prompt's own terms — an element exists, a reply to "say hi" matches `/hi/i` — never on the content of a canned response. A spec that expects the fixture's exact words fails against a live model whether or not anything drifted, so it stays in replay where it belongs.
A structural differ runs alongside as a diagnostic, and it files recordings the recorder itself flagged as incomplete under their own category instead of counting them as drift — an instrument reporting on its own blind spot rather than disguising it.
```

- [ ] **Edit D — Conclusion** (lines 160–175). Replace the whole section body with:

```text
Push your seam as far out as you can afford. The further out it goes, the more of your stack is under test rather than simulated, and provider base URL is far out for how little it costs.

Then write down which dimension you deleted to make it deterministic, in the file where you deleted it. Not in a wiki. Six months later that comment is the difference between "the suite is green" and "the suite is green, and here is what green does not cover."

For us the remaining list is short and specific: mid-stream behavior on fixtures that never opted into real chunking, and the model itself moving under the fixtures.
Both are answered by pointing what you already trust at the real thing — the tagged specs at the live provider on a schedule, a live browser at anything mid-stream before it ships.
Widening either net is a fixture opt-in or a spec tag, not a new design.

The [testing guide](/docs/langgraph/guides/testing) has the in-process tier, and [the subgraphs post](/blog/langgraph-subgraphs-when-to-split) has the streaming attribution model this post leans on.

If your agent suite is green today, I'd like to know what you think it can't see.
```

- [ ] **Edit E — fixture-count line (line 52)**: recount after PR 2's added fixture and update the sentence. Get the numbers:

```bash
python3 - <<'PY'
import json, glob
files = glob.glob('cockpit/*/*/angular/e2e/fixtures/*.json') + glob.glob('examples/*/angular/e2e/fixtures/*.json')
entries = sum(len(json.load(open(f))['fixtures']) for f in files)
print(len(files), 'files,', entries, 'entries')
PY
```

Update `We have 50 fixture files holding 129 entries across 34 apps` to the printed numbers (expected: 130 entries; keep the sentence shape).

- [ ] **Step: run the website suite and commit**

Run: `npx nx test website`
Expected: PASS.

```bash
git add apps/website/content/blog/2026-08-29-what-fixture-replay-cant-catch.mdx
git commit -m "docs(blog): rewrite fixture-replay post — deleted-dimension argument without the incident arc"
```

---

### Task 3: Truthfulness audit against the codebase

Every claim in the rewritten passages must be checkable. Verify each; if any fails, fix the CODE claim in the post (never un-fix the code):

- [ ] Ladder rungs + conservative fallback → `libs/langgraph/src/lib/internals/subagent-tracker.ts` (`matchSubgraphToSubagent`) and `subagent-tracker.spec.ts` exist and pass (PR 1).
- [ ] Nested delegation gets its own flat entry keyed by full namespace path → `childStreamRefFromNamespace` multi-`tools:` branch + its spec (PR 1).
- [ ] "No opt-out flag" / structural child routing → confirm no subagent merge flag remains: `grep -rn "filterSubagentMessages" libs/` → no production hits (removed in #844).
- [ ] Harness comment quoted in the post matches the file → compare against `libs/e2e-harness/src/aimock-runner.ts` (PR 2 text). The post may compress the trailing cross-reference; everything it does quote must appear verbatim.
- [ ] Per-fixture opt-ins include a cockpit fixture → `grep -rn "chunkSize" cockpit/*/*/angular/e2e/fixtures/*.json` → at least one hit (PR 2).
- [ ] "any app on the harness can switch on [the record-proxy] with an environment variable" → `resolveAimockLaunch` exists in `libs/e2e-harness/src/aimock-mode.ts` and both factories consume it (PR 3).
- [ ] Weekly job + issue-on-failure → `.github/workflows/aimock-drift.yml` cron + issue step still present.
- [ ] Differ's incomplete-recording category → `libs/e2e-harness/src/drift-lib.ts` (`incompleteRecordings`) at its post-move path (PR 3).
- [ ] No open-gap language survived: `grep -nE "untested|don't build on it|for a long time|shipped one recently|the last to admit|measuring the wrong thing|open chore|porting record mode" apps/website/content/blog/2026-08-2*.mdx` → no hits in the two rewritten posts.

---

### Task 4: Final verification and PR

- [ ] **Step 1:** `npx nx test website` → PASS.
- [ ] **Step 2:** Voice self-check against `docs/gtm/voice.md`: contractions present, at least one flagged opinion ("For me" / "I think") per post, closing invitation intact, no fabricated anecdotes introduced.
- [ ] **Step 3:** Render check — serve the website locally and read both posts end to end in the browser (`npx nx serve website`, `/blog/langgraph-subgraphs-when-to-split` and `/blog/what-fixture-replay-cant-catch`): no broken MDX, code fences render, internal links resolve.
- [ ] **Step 4:** Open the PR, title `docs(blog): rewrite subgraphs and fixture-replay posts against the hardened codebase`. Body links the three code PRs. Address AI review comments before arming auto-merge; deploy goes out via the normal Vercel path.
