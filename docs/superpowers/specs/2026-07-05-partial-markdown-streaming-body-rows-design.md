# Streaming table body rows (partial-markdown) — Design

**Date:** 2026-07-05
**Status:** Approved, ready for implementation plan
**Repos:** `~/repos/cacheplane` (`@cacheplane/partial-markdown` — the fix, released as 0.5.3) and `~/repos/angular-agent-framework` (`libs/chat` — consume the release)
**Continues:** [2026-06-25-partial-markdown-streaming-table-header-design.md](2026-06-25-partial-markdown-streaming-table-header-design.md) (0.5.2 header projection) and the chat finalize-debounce fix (#743). This is the open-body-row case explicitly deferred from 0.5.2.

## Problem

With 0.5.2 + #743, a streaming table renders its header immediately and stays a table — but each **body row in progress** produces a transient artifact below the table. Probed against the live 0.5.2 dist, streaming `| A | B |\n| - | - |\n| x1 | y1 |\n…` char-by-char:

```
open line "|"          -> [ table:streaming | paragraph:streaming ]   (bare pipe → paragraph)
open line "| x1 | y"   -> [ table:streaming | table:streaming ]      (partial row → spurious 2nd table)
open line "| x1 | y1 |"-> [ table:streaming ]                        (complete row → appended correctly)
```

The user sees a raw-pipe paragraph or a phantom one-row table flicker under the real table as each row streams, settling only at each row's newline.

### Root cause

In `handleBlockLine` (`src/handlers/block.ts`), when a table is active (`s.mode === 'table'`) and the current line does **not** match `TABLE_ROW_RE` (`/^\s*\|.*\|\s*$/` — requires a trailing pipe), the table is closed (~line 83, `closeOpenTable`). On the open-line projection this fires for every partial row: the not-yet-complete row lacks its trailing pipe, so the projection closes the table and the partial row falls through to:

- a **paragraph** (bare `|` or one pipe: `| x1`), or
- the 0.5.2 **optimistic header branch** (two+ pipes: `| x1 | y`) → a spurious second header-only table.

A complete row on the open line (`| x1 | y1 |`) already appends correctly via the mid-table body-row branch (~line 161).

## Goal

While a table is streaming, an in-progress body row renders as a **streaming row inside the table's `<tbody>`**, growing cell-by-cell — never as a paragraph and never as a second table. Committed parse unchanged.

## Decisions (locked)

1. **Projection-only** — same `optimisticBlock` architecture as 0.5.2. No committed-state changes; revert/`finish()` correctness automatic.
2. **Bare `|` open line projects as an empty in-progress row** (smoothest; no pop-in when the first cell char arrives).
3. **Fix in the library, not chat** — the projection is the right layer.
4. **Live verification via Chrome MCP is a required gate** — capture the streaming DOM frame-by-frame in the running examples/chat app and assert zero paragraph/second-table frames during body-row streaming, before release.

## Change

One new branch in `handleBlockLine` (`packages/partial-markdown/src/handlers/block.ts`), placed **immediately before** the `mode === 'table'` close at ~line 83:

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

with, alongside the existing table regexes' local declarations in `block.ts`:

```ts
// A line that has started a table row but not necessarily finished it: up to
// three spaces of indent then a leading pipe. Prefix-consistent with
// TABLE_ROW_RE (which additionally requires the trailing pipe).
const OPEN_TABLE_ROW_RE = /^\s{0,3}\|/;
```

Notes:
- `appendTableRow` + `splitTableCells` already handle a partial row: cells split on unescaped/non-code pipes, body rows pad/truncate to the header's `alignments.length`, so the row grows cell-by-cell and always has the full column count (trailing cells empty until their text streams).
- Placement before the ~line 83 `closeOpenTable` means the projection never closes the active table for a partial row. The committed path (no `optimisticBlock`) is untouched: it still closes the table when a non-row line follows, and appends real rows on their newline.
- The 0.5.2 optimistic **header** branch (~line 170) is unreachable for this case afterward (mode is `'table'`, that branch requires `mode === 'block'`) — the spurious-2nd-table artifact disappears because the partial row no longer falls through to it.
- No parser.ts / types.ts changes — `optimisticBlock` and the preview-state plumbing already exist.

## Error handling / correctness invariants

- **Committed parse unchanged.** Newline-terminated and `finish()` output identical to 0.5.2 (branch is `optimisticBlock`-gated).
- **Revert.** If the "partial row" turns out not to be a row (e.g. the open line continues into `| just prose…` and ends without a trailing pipe at newline), the committed parser closes the table and emits a paragraph at that newline; the projection, rebuilt each push, follows. Same accepted optimism tradeoff as the header.
- **Escaped/code pipes.** Cell tokenization is `splitTableCells` — identical to the committed path, so `\|` and backtick-fenced pipes don't split cells.
- **Width clamp.** Body rows pad/truncate to header width (existing `appendTableRow` behavior); the `table_overflow` warning may fire transiently on the projection for a pathological partial row — harmless (projection is throwaway) but verified in tests not to corrupt committed warnings.

## Testing

**partial-markdown — extend `src/__tests__/streaming-table.test.ts`:**
- Open line `|` after a committed header+delimiter → ONE `table`, body row count includes an empty streaming row; no `paragraph` sibling.
- Open line `| x1` and `| x1 | y` → ONE `table` (no second table), last row contains `x1`/`y`, padded to header width.
- Cell growth: pushing `| x1`, ` | y`, `1 |` grows the last row's populated cells.
- Complete-row open line (`| x1 | y1 |`) still appends (existing behavior, regression guard).
- Committed output unchanged: full table document parses identically to 0.5.2 (newline-terminated + finish()).
- Existing chunk-fuzz table corpus entry re-verifies chunk invariance over the new branch.

**chat (`libs/chat`) — extend `streaming-markdown.table-stream.spec.ts`:**
- While streaming body rows token-by-token, assert exactly one `table` element and zero raw-pipe `<p>` siblings at every step.

**Live verification (required gate, Chrome MCP):**
- Run examples/chat locally (`nx run examples-chat:serve`), drive it via Chrome MCP: send a 10+ row table prompt, sample the last `chat-streaming-md` DOM every ~16ms during the stream, and assert:
  - `tables === 1` in every frame after the header appears (no second table),
  - `pipeParagraphs === 0` in every frame (no raw-pipe paragraph),
  - final table has the full row count.
- This is the same harness used to verify #743; the pre-fix baseline there measured `framesTableWithPipe = 2` — post-fix it must be 0.

## Release & consume

1. cacheplane: bump `0.5.2 → 0.5.3`, CHANGELOG, PR to protected main (3 required checks), squash-merge, then annotated tag `partial-markdown-v0.5.3` on the merged commit → OIDC publish; verify on npm (CDN may lag ~1 min).
2. ngaf: bump `libs/chat` dep `^0.5.2 → ^0.5.3`, surgical lockfile edit (never regenerate on macOS), chat lint/test/build, the Chrome MCP live gate above, PR, merge on green Vercel.

## Out of scope

- Setext headings; non-pipe-fenced tables; live alignment during the delimiter stream (unchanged from 0.5.2's out-of-scope list).
- Any chat-side rendering changes — none needed.
