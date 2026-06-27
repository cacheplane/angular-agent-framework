# Streaming Table-Header Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the table blank/flash during token-by-token markdown streaming by rendering an optimistic, growing header-row table on the open line — projection-only, no change to the committed parse.

**Architecture:** Extend the existing open-line projection (`buildStreamingRoot` → `handleBlockLine` on a throwaway preview state) with a new `optimisticBlock` flag. Under that flag only, a table-header-in-progress renders as a streaming header-only `table` node (reusing the committed-path `commitTable`/`appendTableRow`/`splitTableCells` builders with default `null` alignments) instead of buffering invisibly in `tablePending`. The committed parse is untouched, so revert and `finish()` stay CommonMark-correct automatically. Then bump the consuming `libs/chat` dependency (no component change — the table view already tolerates a header-only table).

**Tech Stack:** TypeScript, Vitest, fast-check (property tests), tsup; the fix is in `~/repos/cacheplane/packages/partial-markdown`, consumed by `~/repos/angular-agent-framework/libs/chat`.

**Repo note:** Tasks 1–6 run in **`~/repos/cacheplane`** (pnpm workspace). Tasks 7–8 run in **`~/repos/angular-agent-framework`** (Nx monorepo). Each task states its repo. In cacheplane, run package scripts from `~/repos/cacheplane/packages/partial-markdown` (or `pnpm -C packages/partial-markdown <script>` from the root).

**Spec:** [docs/superpowers/specs/2026-06-25-partial-markdown-streaming-table-header-design.md](../specs/2026-06-25-partial-markdown-streaming-table-header-design.md)

---

## File Structure

**`~/repos/cacheplane/packages/partial-markdown`:**
- `src/types.ts` — add `optimisticBlock?: boolean` to `InternalState`.
- `src/parser.ts` — `buildStreamingRoot` sets `optimisticBlock: true` on the preview state.
- `src/handlers/block.ts` — add `isTableHeaderInProgress` predicate, `commitOptimisticTableHeader` helper, and two `optimisticBlock`-gated branches in `handleBlockLine` (open-line candidate + `tablePending` window).
- `src/__tests__/streaming-table.test.ts` — **new**, behavior + correctness tests.
- `src/__tests__/chunk-fuzz.property.test.ts` — add a table string to `CORPUS`.
- `CHANGELOG.md`, `package.json` — version bump to 0.5.2.

**`~/repos/angular-agent-framework`:**
- `libs/chat/package.json`, `package-lock.json` — bump `@cacheplane/partial-markdown` to `^0.5.2` (surgical lockfile edit).
- `libs/chat/src/lib/markdown/streaming-table.spec.ts` — **new**, consumer-side anti-flicker invariant.

---

## Task 1: `optimisticBlock` flag + eager open-line header table

**Repo:** `~/repos/cacheplane`

**Files:**
- Modify: `packages/partial-markdown/src/types.ts` (after the `optimisticInline?` field, ~line 353)
- Modify: `packages/partial-markdown/src/parser.ts` (`buildStreamingRoot`, ~line 456)
- Modify: `packages/partial-markdown/src/handlers/block.ts` (Tables section ~line 649; candidate branch ~line 166)
- Test: `packages/partial-markdown/src/__tests__/streaming-table.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/partial-markdown/src/__tests__/streaming-table.test.ts`:

```ts
// SPDX-License-Identifier: MIT
//
// Streaming table-header rendering: an in-progress table header renders as a
// growing header-only table on the open line (projection only), eliminating the
// blank/flash. The committed parse is unchanged.
import { describe, it, expect } from 'vitest';
import { createPartialMarkdownParser, materialize } from '../index';

function blocks(p: ReturnType<typeof createPartialMarkdownParser>) {
  const doc = materialize(p.root) as { children?: Array<{ type: string; status: string }> } | null;
  return (doc?.children ?? []).map((c) => ({ type: c.type, status: c.status }));
}

describe('streaming table header — eager open-line projection', () => {
  it('stays a paragraph until the first cell is closed', () => {
    const p = createPartialMarkdownParser();
    p.push('| Na'); // one pipe only — not yet confidently a table
    expect(blocks(p)).toEqual([{ type: 'paragraph', status: 'streaming' }]);
  });

  it('flips paragraph→table at the first closed cell', () => {
    const p = createPartialMarkdownParser();
    p.push('| Na');
    p.push('me |'); // open line is now "| Name |" — first cell closed
    expect(blocks(p)).toEqual([{ type: 'table', status: 'streaming' }]);
  });

  it('renders the header row, growing column by column', () => {
    const p = createPartialMarkdownParser();
    p.push('| Name | Age'); // two cells, second still open
    const doc = materialize(p.root) as any;
    expect(doc.children).toHaveLength(1);
    const table = doc.children[0];
    expect(table.type).toBe('table');
    expect(table.children[0].isHeader).toBe(true);
    expect(table.children[0].children).toHaveLength(2); // two cells
    expect(JSON.stringify(table)).toContain('Name');
    expect(JSON.stringify(table)).toContain('Age');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/partial-markdown test -- streaming-table`
Expected: FAIL — the `| Name |` / `| Name | Age` cases come back as `paragraph` (today the header is buffered/blanked), so the `table` assertions fail.

- [ ] **Step 3: Add the `optimisticBlock` flag to `InternalState`**

In `packages/partial-markdown/src/types.ts`, immediately after the `optimisticInline?: boolean;` field (~line 353):

```ts
  optimisticInline?: boolean;
  /**
   * Projection-only flag. When set, `handleBlockLine` renders an in-progress
   * table header as a streaming header-only table instead of buffering it
   * invisibly in `tablePending`. Set only by `buildStreamingRoot`; never set on
   * the committed parse path, so the committed document stays CommonMark-correct.
   */
  optimisticBlock?: boolean;
```

- [ ] **Step 4: Set the flag in `buildStreamingRoot`**

In `packages/partial-markdown/src/parser.ts`, in `buildStreamingRoot` (~line 456), add `optimisticBlock: true` to the preview state:

```ts
    const preview = handleBlockLine(
      { ...state, lineBuffer: '', optimisticInline: true, optimisticBlock: true },
      state.lineBuffer,
    );
```

- [ ] **Step 5: Add the predicate + header-table helper in `block.ts`**

In `packages/partial-markdown/src/handlers/block.ts`, in the Tables section (just above `function closeOpenTable`, ~line 649):

```ts
// Eager table-header detection for the streaming projection: a line that, after
// up to three spaces of indent, starts with `|` and has at least one further `|`
// (the first cell is closed). Looser than TABLE_ROW_RE (no trailing pipe needed)
// but prefix-consistent with it, so the optimism never disagrees with what
// eventually commits.
const TABLE_HEADER_INPROGRESS_RE = /^\s{0,3}\|[^|]*\|/;

function isTableHeaderInProgress(line: string): boolean {
  return TABLE_HEADER_INPROGRESS_RE.test(line);
}

// Projection-only: render `headerLine` as a streaming header-only table with
// default (null) alignments — one cell per `splitTableCells` token. Reuses the
// committed-path builders so cell tokenization matches exactly.
function commitOptimisticTableHeader(
  state: InternalState,
  headerLine: string,
): InternalState {
  const cellCount = splitTableCells(headerLine).length;
  const alignments: Alignment[] = new Array(cellCount).fill(null);
  return commitTable(state, headerLine, alignments);
}
```

- [ ] **Step 6: Add the open-line candidate branch**

In `packages/partial-markdown/src/handlers/block.ts`, find the existing committed-path candidate branch (~line 166):

```ts
  // Candidate table header: starts with `|`, contains `|`. Buffer for lookahead.
  if (TABLE_ROW_RE.test(line)) {
```

Insert this **immediately before** it:

```ts
  // Optimistic projection only: an open line that reads as a table header in
  // progress renders immediately as a streaming header-only table (first closed
  // cell), rather than buffering invisibly in tablePending. Gated to top-level
  // block context (mode 'block', no enclosing list) so it can't spawn a second
  // table inside an active one or hijack list continuation.
  if (s.optimisticBlock && s.mode === 'block' && s.listStack.length === 0 && isTableHeaderInProgress(line)) {
    s = closeOpenParagraph(s);
    s = closeOpenList(s);
    return commitOptimisticTableHeader(s, line);
  }

```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm -C packages/partial-markdown test -- streaming-table`
Expected: PASS (all three tests).

- [ ] **Step 8: Run the full package test suite (no regressions)**

Run: `pnpm -C packages/partial-markdown test`
Expected: PASS — all existing suites green (the committed path is unchanged; `optimisticBlock` is only set by the projection).

- [ ] **Step 9: Commit**

```bash
cd ~/repos/cacheplane
git add packages/partial-markdown/src/types.ts packages/partial-markdown/src/parser.ts packages/partial-markdown/src/handlers/block.ts packages/partial-markdown/src/__tests__/streaming-table.test.ts
git commit -m "feat(partial-markdown): eager optimistic table-header on the open line"
```

---

## Task 2: `tablePending` window — no blank, no double-paragraph

**Repo:** `~/repos/cacheplane`

This covers the frame after the header's newline but before the delimiter row: today the committed doc shows nothing (blank), then the header reappears as raw-pipe paragraphs.

**Files:**
- Modify: `packages/partial-markdown/src/handlers/block.ts` (the `tablePending` block, ~lines 63–78)
- Test: `packages/partial-markdown/src/__tests__/streaming-table.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/partial-markdown/src/__tests__/streaming-table.test.ts`:

```ts
describe('streaming table header — awaiting the delimiter row', () => {
  it('keeps the header visible as a table after its newline (no blank/double-paragraph)', () => {
    const p = createPartialMarkdownParser();
    p.push('| a | b |\n'); // header committed → tablePending set, lineBuffer empty
    expect(blocks(p)).toEqual([{ type: 'table', status: 'streaming' }]);
  });

  it('keeps the header as a table while a partial delimiter streams', () => {
    const p = createPartialMarkdownParser();
    p.push('| a | b |\n');
    p.push('| -'); // partial delimiter on the open line
    expect(blocks(p)).toEqual([{ type: 'table', status: 'streaming' }]);
  });

  it('hands off to the real table when the delimiter row commits', () => {
    const p = createPartialMarkdownParser();
    p.push('| a | b |\n| --- | ---: |\n');
    const doc = materialize(p.root) as any;
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe('table');
    // Body row streams into the committed table.
    p.push('| 1 | 2 |\n');
    const doc2 = materialize(p.root) as any;
    expect(doc2.children[0].children).toHaveLength(2); // header + 1 body row
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/partial-markdown test -- streaming-table`
Expected: FAIL on the first two (today: after `| a | b |\n` the projection is `[]`; after `| -` it is two `paragraph` blocks). The handoff test should already PASS (delimiter-committed path is unchanged).

- [ ] **Step 3: Add the `tablePending` optimistic branch**

In `packages/partial-markdown/src/handlers/block.ts`, in the `if (state.tablePending !== null) {` block, **after** the `if (TABLE_ALIGNMENT_RE.test(trimmed)) { … return s; }` sub-block and **before** the `// Revert:` comment (~line 73), insert:

```ts
    // Optimistic projection only: keep the buffered header visible as a streaming
    // header-only table while we wait for the delimiter, instead of reverting it
    // to a paragraph. The committed path still reverts below (CommonMark-correct:
    // a lone `| a | b |` is a paragraph).
    if (state.optimisticBlock) {
      const s2: InternalState = {
        ...state,
        tablePending: null,
        line: state.line + 1,
        lineBuffer: '',
      };
      return commitOptimisticTableHeader(s2, state.tablePending.headerLine);
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C packages/partial-markdown test -- streaming-table`
Expected: PASS (all of Task 1 + Task 2 tests).

- [ ] **Step 5: Run the full package test suite**

Run: `pnpm -C packages/partial-markdown test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd ~/repos/cacheplane
git add packages/partial-markdown/src/handlers/block.ts packages/partial-markdown/src/__tests__/streaming-table.test.ts
git commit -m "feat(partial-markdown): project buffered table header during delimiter wait"
```

---

## Task 3: Correctness invariants (revert, finish, code-fence gating, committed-unchanged)

**Repo:** `~/repos/cacheplane`

These guard the projection-only contract. With Tasks 1–2 in place they should already pass; they exist to lock the behavior and catch future regressions.

**Files:**
- Test: `packages/partial-markdown/src/__tests__/streaming-table.test.ts`
- Modify (only if a guard fails): `packages/partial-markdown/src/handlers/block.ts`

- [ ] **Step 1: Write the guard tests**

Append to `packages/partial-markdown/src/__tests__/streaming-table.test.ts`:

```ts
describe('streaming table header — projection-only correctness', () => {
  it('reverts to a paragraph when no delimiter follows', () => {
    const p = createPartialMarkdownParser();
    p.push('| a | b |\n');
    p.push('just text\n'); // not a delimiter → committed parser reverts
    const b = blocks(p);
    expect(b.some((x) => x.type === 'table')).toBe(false);
    expect(b[0].type).toBe('paragraph');
  });

  it('finishing a lone header commits a paragraph, not a table', () => {
    const p = createPartialMarkdownParser();
    p.push('| a | b |'); // optimistic table on the open line…
    p.finish(); // …but finish has no delimiter → CommonMark paragraph
    expect(blocks(p)).toEqual([{ type: 'paragraph', status: 'complete' }]);
  });

  it('does not tableize a pipe line inside a fenced code block', () => {
    const p = createPartialMarkdownParser();
    p.push('```\n');
    p.push('| a | b |'); // open line inside the code fence
    expect(blocks(p)).toEqual([{ type: 'code-block', status: 'streaming' }]);
  });

  it('leaves the committed (newline-terminated) table output unchanged', () => {
    const p = createPartialMarkdownParser();
    p.push('| a | b |\n| - | - |\n| 1 | 2 |\n');
    p.finish();
    const doc = materialize(p.root) as any;
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe('table');
    expect(doc.children[0].status).toBe('complete');
    expect(doc.children[0].children).toHaveLength(2); // header + 1 body row
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm -C packages/partial-markdown test -- streaming-table`
Expected: PASS. If the revert or finish test fails, the projection leaked into committed state — re-check that the Task 1/2 branches are gated on `optimisticBlock` and `return` without mutating committed nodes; fix in `block.ts` and re-run.

- [ ] **Step 3: Commit**

```bash
cd ~/repos/cacheplane
git add packages/partial-markdown/src/__tests__/streaming-table.test.ts
git commit -m "test(partial-markdown): lock projection-only table-header invariants"
```

---

## Task 4: Chunk-invariance fuzz coverage for tables

**Repo:** `~/repos/cacheplane`

**Files:**
- Modify: `packages/partial-markdown/src/__tests__/chunk-fuzz.property.test.ts` (`CORPUS`, ~line 58)

- [ ] **Step 1: Add a table document to the fuzz corpus**

Open `packages/partial-markdown/src/__tests__/chunk-fuzz.property.test.ts`. Find the `const CORPUS = [` array (~line 58) and add this entry (keep the array's existing formatting/trailing-comma style):

```ts
  '| Name | Age |\n| :--- | ---: |\n| Ada | 36 |\n| Linus | 54 |\n',
```

The existing chunk-invariance property feeds each corpus string in arbitrary chunk splits and asserts it materializes identically to a single push — this now exercises the table header/delimiter/body across every chunk boundary (including splits mid-`| Name |` that trip the new optimistic branch).

- [ ] **Step 2: Run the fuzz suite**

Run: `pnpm -C packages/partial-markdown test -- chunk-fuzz`
Expected: PASS — chunk invariance holds for the table corpus entry (the optimistic projection is transient; the committed/finished tree is identical regardless of chunking), and no chunking throws.

- [ ] **Step 3: Run the full suite once more**

Run: `pnpm -C packages/partial-markdown test`
Expected: PASS (all suites).

- [ ] **Step 4: Commit**

```bash
cd ~/repos/cacheplane
git add packages/partial-markdown/src/__tests__/chunk-fuzz.property.test.ts
git commit -m "test(partial-markdown): chunk-invariance fuzz for streaming tables"
```

---

## Task 5: Lint, typecheck, CHANGELOG, version bump

**Repo:** `~/repos/cacheplane`

**Files:**
- Modify: `packages/partial-markdown/CHANGELOG.md`
- Modify: `packages/partial-markdown/package.json` (`version`)

- [ ] **Step 1: Lint + typecheck the package**

Run: `pnpm -C packages/partial-markdown lint && pnpm -C packages/partial-markdown typecheck`
Expected: PASS, no errors. Fix any lint/type issues (e.g. unused imports) and re-run before continuing.

- [ ] **Step 2: Prepend the CHANGELOG entry**

In `packages/partial-markdown/CHANGELOG.md`, add a new section at the top (above the `## 0.5.1 — 2026-06-24` heading):

```markdown
## 0.5.2 — 2026-06-25

### Added

- **Streaming table headers.** A table header now renders as a growing,
  header-only table the moment the first cell closes on the open line
  (`| Name |` → a 1-row table; columns and cell text fill in as tokens arrive),
  instead of blanking out and reappearing as raw pipe text before snapping into
  a table. This closes the most visible remaining streaming artifact for
  token-by-token (LLM) output. Projection-only: the committed parse is unchanged
  and a header with no delimiter row still finishes as a CommonMark paragraph.
```

- [ ] **Step 3: Bump the package version**

In `packages/partial-markdown/package.json`, change `"version": "0.5.1"` to `"version": "0.5.2"`.

- [ ] **Step 4: Build to confirm the package is publishable**

Run: `pnpm -C packages/partial-markdown build`
Expected: tsup completes, `dist/index.mjs`, `dist/index.cjs`, and the `.d.ts` files regenerate without errors.

- [ ] **Step 5: Commit**

```bash
cd ~/repos/cacheplane
git add packages/partial-markdown/CHANGELOG.md packages/partial-markdown/package.json
git commit -m "chore(partial-markdown): 0.5.2 — streaming table headers"
```

---

## Task 6: Release partial-markdown 0.5.2 to npm

**Repo:** `~/repos/cacheplane`

Publishing is driven by pushing an annotated `partial-markdown-v*` tag, which triggers `.github/workflows/publish.yml` (npm OIDC trusted publishing — npm ≥ 11.5.1, no `registry-url` in setup-node). The workflow runs from the tagged commit, so the version-bump commit (Task 5) must be pushed first.

- [ ] **Step 1: Dry-run the publish locally**

Run: `pnpm -C packages/partial-markdown build && cd packages/partial-markdown && npm publish --dry-run; cd -`
Expected: npm lists the tarball contents and reports it would publish `@cacheplane/partial-markdown@0.5.2`. Confirm the version is `0.5.2` and `dist/` files are included. (Dry-run does not publish.)

- [ ] **Step 2: Push the version-bump commit to the default branch**

Run:
```bash
cd ~/repos/cacheplane
git push origin HEAD
```
Expected: the Task 5 commit lands on the branch the publish workflow builds from.

- [ ] **Step 3: Create and push the annotated release tag**

Run:
```bash
cd ~/repos/cacheplane
git tag -a partial-markdown-v0.5.2 -m "partial-markdown 0.5.2 — streaming table headers"
git push origin partial-markdown-v0.5.2
```
Expected: the tag push triggers the `publish.yml` workflow.

- [ ] **Step 4: Verify the publish succeeded**

Run (poll until the workflow finishes, ~1–2 min):
```bash
cd ~/repos/cacheplane
gh run list --workflow publish.yml --limit 1
```
Then confirm on npm:
```bash
npm view @cacheplane/partial-markdown@0.5.2 version
```
Expected: the workflow run concludes `success`, and `npm view` prints `0.5.2`. If the run failed at the OIDC exchange, check the verbose publish log for `POST 404 …/oidc/token/exchange/package/@cacheplane/partial-markdown` (a trusted-publisher config mismatch) vs `POST 201 …` (success) — this is the same setup that shipped 0.5.0/0.5.1, so it should already be configured.

---

## Task 7: Consume 0.5.2 in `libs/chat` + consumer anti-flicker test

**Repo:** `~/repos/angular-agent-framework`

**Files:**
- Modify: `libs/chat/package.json:13` (`@cacheplane/partial-markdown` → `^0.5.2`)
- Modify: `package-lock.json` (two `^0.5.0` range occurrences at lines ~32 and ~210, plus the `node_modules/@cacheplane/partial-markdown` install block at ~7274 — surgical edit, do NOT regenerate)
- Create: `libs/chat/src/lib/markdown/streaming-table.spec.ts`

- [ ] **Step 1: Create a feature branch off main**

Run:
```bash
cd ~/repos/angular-agent-framework
git checkout main && git pull --ff-only
git checkout -b feat/chat-consume-pm-0.5.2
```
Expected: a clean branch on the latest main.

- [ ] **Step 2: Write the consumer anti-flicker test (failing until the dep bumps)**

Create `libs/chat/src/lib/markdown/streaming-table.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
//
// Consumer-side guarantee: with the partial-markdown version chat depends on, a
// streaming table header renders as a `table` immediately — before the delimiter
// row and while it is buffered awaiting the delimiter — instead of blanking out.
// Guards against a dependency downgrade reintroducing the table blank/flash.
import { describe, it, expect } from 'vitest';
import { createPartialMarkdownParser, materialize } from '@cacheplane/partial-markdown';

function topType(p: ReturnType<typeof createPartialMarkdownParser>): string | null {
  const doc = materialize(p.root) as { children?: Array<{ type: string }> } | null;
  return doc?.children?.[0]?.type ?? null;
}

describe('libs/chat consumes streaming table headers', () => {
  it('shows a table header immediately, before and during the delimiter wait', () => {
    const p = createPartialMarkdownParser();
    p.push('| Name | Age |'); // first row, still on the open line (no newline)
    expect(topType(p)).toBe('table'); // pre-0.5.2: null (header buffered/blank)
    p.push('\n'); // header committed; delimiter not yet streamed
    expect(topType(p)).toBe('table'); // pre-0.5.2: null (the blank gap)
    p.push('| --- | --- |\n| Ada | 36 |\n'); // delimiter + body commit
    const doc = materialize(p.root) as any;
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe('table');
    expect(doc.children[0].children.length).toBeGreaterThanOrEqual(2); // header + body
  });
});
```

- [ ] **Step 3: Run it to verify it fails on the current dep**

Run: `npx nx test chat -- streaming-table`
Expected: FAIL — the installed `@cacheplane/partial-markdown` is 0.5.1, which buffers the header invisibly during the pre-delimiter window, so `topType(p)` is `null` (not `'table'`) at both early assertions. This is exactly the blank gap 0.5.2 closes. (If the package manager has not yet fetched 0.5.2, this still proves the test discriminates the versions.)

- [ ] **Step 4: Bump the dependency in `package.json`**

In `libs/chat/package.json`, line 13, change:
```json
    "@cacheplane/partial-markdown": "^0.5.0",
```
to:
```json
    "@cacheplane/partial-markdown": "^0.5.2",
```

- [ ] **Step 5: Surgically update the lockfile**

Get the published integrity hash:
```bash
cd ~/repos/angular-agent-framework
npm view @cacheplane/partial-markdown@0.5.2 dist.integrity dist.tarball
```
Then edit `package-lock.json` by hand (do NOT run `npm install` without `--package-lock-only`; never regenerate on macOS — it drops the Linux `@next/swc-*` bindings and breaks CI):
- In the `node_modules/@cacheplane/partial-markdown` block (~line 7274): set `"version": "0.5.2"`, update `"resolved"` to the 0.5.2 tarball URL, and replace `"integrity"` with the published hash from the command above.
- Update each dependency-range occurrence of `"@cacheplane/partial-markdown": "^0.5.0"` (the root workspace block ~line 32 and the `libs/chat` package block ~line 210) to `"^0.5.2"` so the lockfile matches `package.json`.

Verify the lockfile is consistent and resolves to 0.5.2:
```bash
npm ls @cacheplane/partial-markdown
```
Expected: prints `@cacheplane/partial-markdown@0.5.2` with no "invalid"/"unmet" errors. If npm reports a mismatch, re-check the three range strings and the version/resolved/integrity triple.

- [ ] **Step 6: Run the consumer test to verify it passes**

Run: `npx nx test chat -- streaming-table`
Expected: PASS — the table is a `table` from the first closed cell onward and never flickers back to a paragraph.

- [ ] **Step 7: Run the chat lint/test/build gates**

Run:
```bash
npx nx lint chat && npx nx test chat && npx nx build chat
```
Expected: all PASS. The markdown table view needs no change (`markdown-table.component` already renders a header-only table via `headerRow()`/`bodyRows()`), so the build is clean.

- [ ] **Step 8: Commit**

```bash
cd ~/repos/angular-agent-framework
git add libs/chat/package.json package-lock.json libs/chat/src/lib/markdown/streaming-table.spec.ts
git commit -m "build(chat): consume partial-markdown 0.5.2 — streaming table headers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: PR, gates, merge

**Repo:** `~/repos/angular-agent-framework`

- [ ] **Step 1: Push the branch and open the PR**

Run:
```bash
cd ~/repos/angular-agent-framework
git push -u origin feat/chat-consume-pm-0.5.2
gh pr create --fill --title "build(chat): consume partial-markdown 0.5.2 — streaming table headers"
```
Expected: PR created against `main`.

- [ ] **Step 2: Confirm the required check, then merge on green**

Run:
```bash
gh pr checks --watch
```
Expected: the required `Vercel – threadplane` check passes (other checks are advisory). Address any AI-review comments before arming merge, then:
```bash
gh pr merge --squash --delete-branch
```
Expected: PR squash-merges into main. (If GitHub reports a stale mergeable state despite a green head — a known cache quirk in this repo — re-check head checks are green, then `gh pr merge --squash --admin` overrides the stale state; `enforce_admins` is false.)

- [ ] **Step 3: Verify main is green post-merge**

Run:
```bash
git checkout main && git pull --ff-only
gh run list --branch main --limit 1
```
Expected: the latest main CI run concludes `success`.

---

## Out of scope (do not implement)

- Setext headings (`Title`/`===` → h1). Separate, pre-existing correctness gap.
- Non-pipe-fenced GFM tables (no leading pipe). The parser intentionally requires a leading pipe.
- Live column alignment while the delimiter streams. Alignments lock in when the delimiter commits.
- Open *body*-row cell streaming and tables nested inside list items (the open-line branch is gated to top-level, `listStack.length === 0`). Cheap follow-ons; deliberately deferred to keep v1 tight.
