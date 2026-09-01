# Blog damage control: fix the disclosed framework gaps, then rewrite the posts

**Date:** 2026-09-01
**Status:** Approved (design)

## Problem

Two published blog posts disclose open product gaps and narrate bug arcs in confessional detail:

- `apps/website/content/blog/2026-08-27-langgraph-subgraphs-when-to-split.mdx`
- `apps/website/content/blog/2026-08-29-what-fixture-replay-cant-catch.mdx`

Four disclosures describe issues that are *still open* in the framework. The plan is to fix
those first, then rewrite both posts to describe the clean end state — same technical
lessons, no incident narrative, no open-chore admissions. The two 2026-08-26 posts are
clean and stay untouched.

## Workstreams (staged PRs, in order)

### PR 1 — SubagentTracker hardening (libs/langgraph)

Source: `libs/langgraph/src/lib/internals/subagent-tracker.ts`.

1. **New direct unit spec** `subagent-tracker.spec.ts` (the tracker is a plain class; do
   not add more bridge-transport tests). Cases:
   - Rung 1 exact-description match where the namespace id ≠ tool-call id (the currently
     missing discriminating test).
   - Rung 2 substring match, both directions (`:180-187`) — currently zero coverage.
   - Substring rung skipped when the stored description is empty.
   - Rung 3 refusal when two unmapped candidates are pending (parallel fan-out hazard).
   - `pendingMatches` deferred retry: child stream arrives before the parent tool call
     (`:216-218`, `:365-371`) — currently zero coverage.
   - Empty-description edge: `ensureToolStreamAttribution` vs a subagent whose
     `description === ''`.
2. **Fix the latent rung-1 bug**: `''` description must not exact-match at `:173-178`;
   guard so an empty description falls through to rung 3's one-candidate check.
3. **Nested-namespace guard**: `childStreamRefFromNamespace()` (`:409-419`) currently
   returns on the *first* `tools:` segment, merging a grandchild's tokens into the outer
   subagent's card and overwriting its `values`. Change: when a namespace contains more
   than one `tools:` segment, register the innermost segment as its own tracked stream
   (subgraph-kind entry, named/keyed by the innermost segment, **exempt from the
   attribution ladder** so it can never mis-attach to a sibling). Full nested attribution
   (parent links, depth) is explicitly out of scope — it breaks the `id === tool-call-id`
   invariant relied on by `processToolMessage`, `getSubagent(toolCallId)`,
   `getSubagentsByMessage`, and the flat-map rendering in libs/chat, for a shape no
   shipped graph produces.
4. **Delete dead export** `extractToolCallIdFromNamespace` (`:421-427`) — unreferenced,
   duplicates the first-match rule.
5. **Docs**: update `apps/website/content/docs/langgraph/guides/subgraphs.mdx` to state
   the actual nested behavior (each delegation level surfaces as its own stream; no
   parent/child linking).
6. Bridge-test hygiene: fix the stale comment at `stream-manager.bridge.spec.ts:~2852`
   (its ladder assertion was neutered by #847's `ensureToolStreamAttribution`) and note
   the event-ordering constraint (child `values` before child `messages`) needed to reach
   rungs 1/2 through the bridge.

### PR 2 — Fence-split parser fix (cross-repo: cacheplane → this repo)

The bug: with small chunks, `@cacheplane/partial-markdown` 0.5.8 can commit an
inline-code interpretation when a triple-backtick opener is split mid-token, and the
final state stays `<code>` instead of `<pre><code>`. Worked around today by
`chunkSize: 4096` in `libs/e2e-harness/src/aimock-runner.ts:50-59`.

1. **Repro spec in this repo first**: consumer-guarantee test alongside
   `libs/chat/src/lib/markdown/streaming-table.spec.ts` driving
   `createPartialMarkdownParser()` with the opener split across pushes
   (`` ` `` / `` ` `` / `` `ts\n ``), asserting the top node materializes as a code
   block after `finish()`.
2. **Fix upstream** in `~/repos/cacheplane` (partial-markdown fence-opener recovery;
   related prior art: 0.5.6 closing-fence work). Release **0.5.9** (pnpm workspace;
   publish with `npm publish` for OIDC).
3. **Bump the exact pin** in root `package.json` and `libs/chat/package.json`
   (surgical lockfile edit — never regenerate on macOS).
4. **Retire the workaround framing**: rewrite the comment at
   `libs/e2e-harness/src/aimock-runner.ts:50-58` to describe 4096 as the default for
   final-state assertions (no longer a bug workaround), and add at least one small-chunk
   fence fixture + assertion to the cockpit harness tier (mirroring
   `examples/chat/angular/e2e/fixtures/streaming-markdown.json:29-35`), so the cockpit
   tier is no longer the one with zero streaming opt-ins.
5. If the repro does *not* fail at parser level, the suspect is `finish()` timing in
   `libs/chat/src/lib/streaming/streaming-markdown.component.ts:181-194`; investigate
   there before touching cacheplane.

### PR 3 — Record mode in the shared e2e harness (libs/e2e-harness)

Mechanical port of the proven examples/chat implementation; **no cockpit drift CI in
this arc** (deferred as a separate decision — recurring live-API spend, per-cap `@drift`
tagging judgment, and a differ entry-key collision across caps that all need design).

1. `aimock-runner.ts`: `mode: 'replay' | 'record'`, optional `recordDir`, record branch
   lifted from `examples/chat/angular/e2e/aimock-runner.ts:51-63`.
2. Both setup factories (`global-setup-factory.ts`, `ag-ui-global-setup-factory.ts`):
   read `AIMOCK_MODE` / `AIMOCK_RECORD_DIR`, fail fast without `OPENAI_API_KEY` in
   record mode, pass the real key through instead of `'test-not-used'`. Factor the
   byte-identical helper lines into a shared module while there.
3. Move `drift-lib.ts`, `drift.ts`, `drift-lib.test.ts` from
   `examples/chat/angular/e2e/scripts/` into the lib, parameterizing the hardcoded
   fixtures dir; examples/chat consumes the moved copy.
4. New record-mode boot test in `aimock-runner.spec.ts` (no upstream call).
5. Out of scope: tagging cockpit specs `@drift`, cockpit drift workflow, deleting the
   examples' inline harness copies (pre-existing duplication, tracked separately).

### PR 4 — Rewrite the two posts

Editorial rules:

- Describe current behavior as design rationale, not incident narrative. Remove:
  "we shipped one recently", "A working feature was restructured so a UI card would
  appear", "our own docs were blunt that they didn't show up at all", "The framework was
  simply the last to admit it", "our first drift design was measuring the wrong thing",
  the recorder blind-spot story, "Treat that path as untested", the nested-delegation
  "don't build on it" warning, and the "porting record mode … is an open chore" framing.
- Keep every real technical lesson (fixture ordering is executable, deleted-dimension
  framing, self-correcting bug class, state isolation is designed not granted, the
  observability argument, the control-flow split test).
- Rewrites must be truthful against the post-fix codebase: ladder is tested, nested
  children surface as their own streams, the fence path is fixed with a small-chunk
  fixture in the cockpit tier, record mode is harness-wide. Do not claim cockpit drift
  CI exists.
- Fix the "So so" typo (subgraphs post `:192`).
- Voice per `docs/gtm/voice.md`: warm, contractions, flagged opinions, closing
  invitation. No fabricated anecdotes. No competitor names.
- Frontmatter dates stay as published; posts are live, so this PR updates published
  content in place.

## Ordering constraint

PR 4 depends on 1-3 landing (its claims must be true). PRs 1-3 are independent of each
other. PR 2 has an external dependency (cacheplane release) and can proceed in parallel.

## Verification

- PR 1: new spec red-green against the rung-1 guard; full libs lint/test (strip ANSI
  before grepping for errors); `npm run generate-api-docs` if any public surface moves.
- PR 2: repro spec fails on 0.5.8, passes on 0.5.9; cockpit small-chunk fixture green;
  one example prod build before claiming deploy-ready.
- PR 3: boot test; run one cockpit cap e2e in replay to prove no regression; record mode
  smoke against a live key locally (not CI).
- PR 4: `nx test website` (content assertions), prose review against the post-fix code.
