# Streaming Table Body Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An in-progress table body row renders as a streaming row inside the table's `<tbody>` (growing cell-by-cell) instead of flickering as a raw-pipe paragraph or a spurious second table.

**Architecture:** One `optimisticBlock`-gated branch in `handleBlockLine` (`block.ts`), placed before the `mode === 'table'` close: a partial open-line row (leading pipe, no trailing pipe yet) appends via the existing `appendTableRow` builder on the throwaway projection state. Committed parse untouched. Ships as `@cacheplane/partial-markdown` 0.5.3, consumed by `libs/chat`; a Chrome MCP live-stream capture is a required verification gate.

**Tech Stack:** TypeScript, Vitest, tsup (cacheplane); Angular/Vitest (ngaf `libs/chat`); Chrome MCP for the live gate.

**Repo note:** Tasks 1–3 run in **`~/repos/cacheplane`** (branch off main). Tasks 4–6 run in **`~/repos/angular-agent-framework`**. cacheplane main is PROTECTED (3 required checks) — release goes PR → squash-merge → annotated tag on the merged commit.

**Spec:** [docs/superpowers/specs/2026-07-05-partial-markdown-streaming-body-rows-design.md](../specs/2026-07-05-partial-markdown-streaming-body-rows-design.md)

---

## File Structure

**`~/repos/cacheplane/packages/partial-markdown`:**
- `src/handlers/block.ts` — `OPEN_TABLE_ROW_RE` (next to `TABLE_HEADER_INPROGRESS_RE`, ~line 682) + the new branch in `handleBlockLine` (before the table close at ~line 97).
- `src/__tests__/streaming-table.test.ts` — new `describe` block for body rows (appended; reuses the existing `blocks()` helper).
- `CHANGELOG.md`, `package.json` — 0.5.3.

**`~/repos/angular-agent-framework`:**
- `libs/chat/package.json`, `package-lock.json` — `^0.5.2 → ^0.5.3` (surgical lockfile edit; never regenerate).
- `libs/chat/src/lib/streaming/streaming-markdown.table-stream.spec.ts` — body-row anti-flicker test appended.

---

## Task 1: Body-row projection branch (TDD)

**Repo:** `~/repos/cacheplane` — first create the branch: `git checkout main && git pull --ff-only && git checkout -b feat/streaming-table-body-rows`

**Files:**
- Modify: `packages/partial-markdown/src/handlers/block.ts` (~line 97 branch; ~line 682 regex)
- Test: `packages/partial-markdown/src/__tests__/streaming-table.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `packages/partial-markdown/src/__tests__/streaming-table.test.ts` (the file already imports `createPartialMarkdownParser`/`materialize` and defines `blocks()`):

```ts
describe('streaming table body rows — open-line projection', () => {
  // Committed header + delimiter, so the table is active (mode 'table').
  const HEADER = '| A | B |\n| - | - |\n';

  it('projects a bare "|" as an empty in-progress row (no paragraph)', () => {
    const p = createPartialMarkdownParser();
    p.push(HEADER);
    p.push('|');
    expect(blocks(p)).toEqual([{ type: 'table', status: 'streaming' }]);
    const doc = materialize(p.root) as any;
    expect(doc.children[0].children).toHaveLength(2); // header + empty in-progress row
  });

  it('projects a partial row into the SAME table (no spurious second table)', () => {
    const p = createPartialMarkdownParser();
    p.push(HEADER);
    p.push('| x1 | y'); // two pipes, no trailing pipe — used to spawn a 2nd optimistic table
    expect(blocks(p)).toEqual([{ type: 'table', status: 'streaming' }]);
    const doc = materialize(p.root) as any;
    const rows = doc.children[0].children;
    expect(rows).toHaveLength(2); // header + in-progress body row
    const lastRow = JSON.stringify(rows[1]);
    expect(lastRow).toContain('x1');
    expect(lastRow).toContain('y');
  });

  it('grows the in-progress row cell-by-cell, padded to header width', () => {
    const p = createPartialMarkdownParser();
    p.push(HEADER);
    p.push('| x1');
    let doc = materialize(p.root) as any;
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].children[1].children).toHaveLength(2); // padded to 2 cols
    p.push(' | y1');
    doc = materialize(p.root) as any;
    expect(JSON.stringify(doc.children[0].children[1])).toContain('y1');
  });

  it('still appends a COMPLETE open-line row (regression guard)', () => {
    const p = createPartialMarkdownParser();
    p.push(HEADER);
    p.push('| x1 | y1 |'); // trailing pipe — pre-existing mid-table branch
    const doc = materialize(p.root) as any;
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].children).toHaveLength(2);
  });

  it('leaves the committed parse unchanged (newline-terminated + finish)', () => {
    const p = createPartialMarkdownParser();
    p.push('| A | B |\n| - | - |\n| x1 | y1 |\n| x2 | y2 |\n');
    p.finish();
    const doc = materialize(p.root) as any;
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe('table');
    expect(doc.children[0].status).toBe('complete');
    expect(doc.children[0].children).toHaveLength(3); // header + 2 body rows
  });

  it('a blank open line still closes nothing prematurely (table stays, no extra row)', () => {
    const p = createPartialMarkdownParser();
    p.push(HEADER);
    // No open line at all: committed table only.
    expect(blocks(p)).toEqual([{ type: 'table', status: 'streaming' }]);
    const doc = materialize(p.root) as any;
    expect(doc.children[0].children).toHaveLength(1); // header only
  });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `pnpm -C packages/partial-markdown test -- streaming-table`
Expected: FAIL — bare `|` yields `[table, paragraph]`, `| x1 | y` yields `[table, table]` (the 0.5.2 artifacts). The complete-row, committed-unchanged, and header-only tests already pass.

- [ ] **Step 3: Add the regex + branch**

In `packages/partial-markdown/src/handlers/block.ts`:

(a) Next to the existing header regex (~line 682, immediately above `const TABLE_HEADER_INPROGRESS_RE`):

```ts
// A line that has STARTED a table row but not necessarily finished it: up to
// three spaces of indent then a leading pipe. Prefix-consistent with
// TABLE_ROW_RE (which additionally requires the trailing pipe).
const OPEN_TABLE_ROW_RE = /^\s{0,3}\|/;
```

(b) In `handleBlockLine`, find (~line 96):

```ts
  // Close open table if current line is not a table row.
  if (s.mode === 'table' && !TABLE_ROW_RE.test(line)) {
    s = closeOpenTable(s);
  }
```

Insert **immediately before** it:

```ts
  // Optimistic projection only: while a table is active, an open line that
  // begins a new row (leading pipe, row not yet complete) projects as an
  // in-progress body row appended to the active table — instead of closing the
  // table and rendering the partial row as a paragraph or a spurious second
  // optimistic header table. A bare "|" projects as an empty in-progress row.
  if (s.optimisticBlock && s.mode === 'table' && OPEN_TABLE_ROW_RE.test(line) && !TABLE_ROW_RE.test(line)) {
    return appendTableRow(s, line);
  }

```

Note: the local variable at this point is `s` (declared just above as `{ ...state, line: state.line + 1, lineBuffer: '' }`) — verify by reading the surrounding code.

- [ ] **Step 4: Run the streaming-table suite to verify green**

Run: `pnpm -C packages/partial-markdown test -- streaming-table`
Expected: PASS (all, including the 12 pre-existing 0.5.2 tests).

- [ ] **Step 5: Run the full package suite (incl. chunk-fuzz)**

Run: `pnpm -C packages/partial-markdown test`
Expected: PASS — the chunk-invariance property (table corpus entry) re-verifies the new branch never changes committed output under any chunk split.

- [ ] **Step 6: Commit**

```bash
cd ~/repos/cacheplane
git add packages/partial-markdown/src/handlers/block.ts packages/partial-markdown/src/__tests__/streaming-table.test.ts
git commit -m "feat(partial-markdown): project in-progress table body rows on the open line"
```

---

## Task 2: Lint, typecheck, CHANGELOG, version 0.5.3

**Repo:** `~/repos/cacheplane`

**Files:**
- Modify: `packages/partial-markdown/CHANGELOG.md`, `packages/partial-markdown/package.json`

- [ ] **Step 1: Lint + typecheck**

Run: `pnpm -C packages/partial-markdown lint && pnpm -C packages/partial-markdown typecheck`
Expected: PASS, no errors. Fix any issues before continuing.

- [ ] **Step 2: Prepend the CHANGELOG entry** (above `## 0.5.2 — 2026-06-27`):

```markdown
## 0.5.3 — 2026-07-05

### Added

- **Streaming table body rows.** While a table is active, an in-progress body
  row on the open line now renders as a streaming row inside the table —
  growing cell-by-cell, padded to header width — instead of momentarily
  closing the table and flashing as a raw-pipe paragraph (bare `|` / one pipe)
  or a spurious second header-only table (two+ pipes). A bare `|` projects as
  an empty in-progress row. Projection-only: the committed parse is unchanged.
  Completes the streaming-table work begun in 0.5.2.
```

- [ ] **Step 3: Bump version** — `packages/partial-markdown/package.json`: `"version": "0.5.2"` → `"version": "0.5.3"`.

- [ ] **Step 4: Build** — Run: `pnpm -C packages/partial-markdown build` — Expected: tsup regenerates `dist/` cleanly.

- [ ] **Step 5: Commit**

```bash
cd ~/repos/cacheplane
git add packages/partial-markdown/CHANGELOG.md packages/partial-markdown/package.json
git commit -m "chore(partial-markdown): 0.5.3 — streaming table body rows"
```

---

## Task 3: Release 0.5.3 (PR → tag → npm)

**Repo:** `~/repos/cacheplane`. Main is protected (3 required checks: Workspace install+lint+typecheck, Package partial-json, Package partial-markdown) — direct pushes are rejected.

- [ ] **Step 1: Dry-run the publish**

```bash
cd ~/repos/cacheplane/packages/partial-markdown && npm publish --dry-run; cd -
```
Expected: would publish `@cacheplane/partial-markdown@0.5.3`, `dist/` files included.

- [ ] **Step 2: Push branch + open PR**

```bash
cd ~/repos/cacheplane
git push -u origin feat/streaming-table-body-rows
gh pr create --fill --title "feat(partial-markdown): streaming table body rows (0.5.3)"
```

- [ ] **Step 3: Merge on green (3 checks), then tag the merged main commit**

```bash
gh pr checks <PR#> --watch   # all 3 required checks pass
gh pr merge <PR#> --squash --delete-branch
git checkout main && git pull --ff-only
git tag -a partial-markdown-v0.5.3 -m "partial-markdown 0.5.3 — streaming table body rows"
git push origin partial-markdown-v0.5.3
```
Expected: tag push triggers `.github/workflows/publish.yml` (OIDC).

- [ ] **Step 4: Verify npm**

```bash
gh run list --workflow publish.yml --limit 1     # completed success
npm view @cacheplane/partial-markdown@0.5.3 version dist.integrity dist.tarball
```
Expected: `0.5.3`. NOTE: npm CDN can lag ~1 min after workflow success — a brief 404 is propagation, not failure. Record `dist.integrity` and `dist.tarball` for Task 4.

---

## Task 4: Consume 0.5.3 in `libs/chat` + body-row anti-flicker test

**Repo:** `~/repos/angular-agent-framework`

**Files:**
- Modify: `libs/chat/package.json` (`^0.5.2` → `^0.5.3`)
- Modify: `package-lock.json` — surgical hand-edit ONLY (never run bare `npm install`; regeneration on macOS drops Linux `@next/swc-*` bindings): the two range occurrences of `"@cacheplane/partial-markdown": "^0.5.2"` (root deps block + libs/chat block; find with `grep -n "partial-markdown" package-lock.json`) → `"^0.5.3"`, and the `node_modules/@cacheplane/partial-markdown` install block → version `0.5.3` + the `resolved`/`integrity` values recorded in Task 3.
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.table-stream.spec.ts` (append)

- [ ] **Step 1: Branch off main**

```bash
cd ~/repos/angular-agent-framework
git checkout main && git pull --ff-only
git checkout -b feat/chat-consume-pm-0.5.3
```

- [ ] **Step 2: Write the failing consumer test**

Append inside the existing `describe('ChatStreamingMdComponent — streaming table rendering', …)` block in `libs/chat/src/lib/streaming/streaming-markdown.table-stream.spec.ts`:

```ts
  it('streams body rows inside the table — no paragraph, no second table (0.5.3)', () => {
    host.streaming.set(true);
    grow('| A | B |\n| - | - |\n');
    for (const c of ['|', '| x1', '| x1 | y', '| x1 | y1 |', '| x1 | y1 |\n']) {
      grow('| A | B |\n| - | - |\n' + c);
      expect(el.querySelectorAll('table').length, `one table at ${JSON.stringify(c)}`).toBe(1);
      expect(
        [...el.querySelectorAll('p')].some((p) => (p.textContent || '').includes('|')),
        `no raw-pipe paragraph at ${JSON.stringify(c)}`,
      ).toBe(false);
    }
  });
```

- [ ] **Step 3: Verify it fails on 0.5.2**

Run: `npx nx test chat --skip-nx-cache -- streaming-markdown.table-stream`
Expected: FAIL — on 0.5.2 the `'|'` step renders a raw-pipe `<p>` and the `'| x1 | y'` step renders 2 tables.

- [ ] **Step 4: Bump dep + surgical lockfile edit** (values from Task 3). Refresh the on-disk copy WITHOUT touching the lockfile: `cd /tmp && npm pack @cacheplane/partial-markdown@0.5.3 && tar -xzf cacheplane-partial-markdown-0.5.3.tgz && rm -rf ~/repos/angular-agent-framework/node_modules/@cacheplane/partial-markdown && cp -r package ~/repos/angular-agent-framework/node_modules/@cacheplane/partial-markdown`. Verify: `cd ~/repos/angular-agent-framework && npm ls @cacheplane/partial-markdown` → `0.5.3`, no invalid/missing.

- [ ] **Step 5: Verify the test passes + gates**

Run: `npx nx test chat --skip-nx-cache -- streaming-markdown.table-stream` → PASS.
Run: `npx nx lint chat && npx nx test chat && npx nx build chat` → all PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/package.json package-lock.json libs/chat/src/lib/streaming/streaming-markdown.table-stream.spec.ts
git commit -m "build(chat): consume partial-markdown 0.5.3 — streaming table body rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Chrome MCP live verification (REQUIRED GATE)

**Repo:** `~/repos/angular-agent-framework`, on the Task 4 branch. This is the gate the user explicitly required. It is performed by the CONTROLLER session (needs Chrome MCP + the user's OPENAI key via `examples/chat/python/.env`), not a subagent.

- [ ] **Step 1: Start the stack** — `npx nx run examples-chat:serve` in the background; poll until BOTH `http://localhost:2024/ok` returns 200 AND the log shows `Application bundle generation complete` (a port-200 alone can race the first build). Kill any stale servers on :4200/:2024 first.

- [ ] **Step 2: Drive + capture via Chrome MCP** — navigate to `http://localhost:4200/embed`; install a 16ms DOM sampler on the last `chat-streaming-md` recording `{tables, pipeParagraphs}` per frame into `window.__frames`; send: `Output ONLY a markdown table of 12 chemical elements with columns Symbol, Name, Atomic Number, Group. No prose whatsoever.` (set textarea value via the native setter + input event, then keydown/keypress/keyup Enter).

- [ ] **Step 3: Assert the capture** — read `window.__frames` after the stream:
  - `tables === 1` in every frame after the first table frame (0 frames with 2 tables),
  - `pipeParagraphs === 0` in every frame (0 raw-pipe `<p>` frames; the #743 baseline measured 2 such frames — must now be 0),
  - final DOM: one table, 4 `thead th`, 12 `tbody tr`.
  If any assertion fails: STOP, root-cause (systematic-debugging), do not proceed to Task 6.

- [ ] **Step 4: Shut down the stack** — kill the serve processes by PID (`lsof -ti :4200 :2024`); confirm both ports free. (The nx process tree respawns children — kill by PID, verify, repeat if needed.)

---

## Task 6: PR + merge on green

**Repo:** `~/repos/angular-agent-framework`

- [ ] **Step 1: Push + PR**

```bash
git push -u origin feat/chat-consume-pm-0.5.3
gh pr create --title "build(chat): consume partial-markdown 0.5.3 — streaming table body rows" --fill
```
Include in the body: root cause recap (0.5.2 deferred body rows; partial open-line row closed the table → paragraph / 2nd-table flicker), the fix (projection-only body-row branch), test evidence (cacheplane suite, consumer red→green), and the Chrome MCP capture numbers from Task 5.

- [ ] **Step 2: Merge on green**

```bash
gh pr checks <PR#> --watch    # required: Vercel – threadplane
gh pr merge <PR#> --squash --delete-branch
```
If GitHub reports "head branch is not up to date" with green head checks and no conflicting files (stale-cache quirk / non-conflicting main advance), use `gh pr merge <PR#> --squash --delete-branch --admin`.

- [ ] **Step 3: Verify main**

```bash
git checkout main && git pull --ff-only
gh run list --branch main --limit 3
```
Expected: merge commit present; CI green (ignore the pre-existing non-required "PostHog telemetry quality" red — stale secret, unrelated).

---

## Out of scope (do not implement)

- Setext headings; non-pipe-fenced tables; live alignment during the delimiter stream.
- Any chat component/view changes — none are needed.
