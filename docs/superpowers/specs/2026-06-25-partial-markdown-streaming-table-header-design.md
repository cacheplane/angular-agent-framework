# Streaming table-header rendering (partial-markdown) — Design

**Date:** 2026-06-25
**Status:** Approved, ready for implementation plan
**Repos:** `~/repos/cacheplane` (`@cacheplane/partial-markdown` — the fix) and `~/repos/angular-agent-framework` (`libs/chat` — consume the release)
**Continues:** [2026-06-20-resilient-markdown-math-rendering-design.md](2026-06-20-resilient-markdown-math-rendering-design.md) and the B.2/optimistic open-line streaming shipped in partial-markdown 0.5.x.

## Problem

A markdown table streamed token-by-token from an LLM flickers badly. Probed against the live 0.5.1 parser, feeding `| Name | Age |` one token at a time then the delimiter row:

```
"| Na"          -> paragraph "| Na"          (text visible)
"...| Age |"    -> []          ← VANISHES    (the whole row blanks out)
"\n| ---"       -> two paragraphs            (reappears as raw pipe text, 2 lines)
"- | --- |"     -> table                     (snaps into a table)
```

The user sees **text → blank → raw pipes → table**: a jarring multi-stage flicker. Tables are common in LLM output, so this is the most visible streaming artifact remaining after the 0.5.x open-line work.

### Root cause

The committed parser is correct but conservative. When a newline-terminated line matches `TABLE_ROW_RE = /^\s*\|.*\|\s*$/`, it is stashed in `state.tablePending` and **excluded from the committed document** pending one line of lookahead:

- next line is an alignment row (`| --- | --- |`) → promote header+delimiter to a `table` node;
- anything else → revert: flush the buffered header as a paragraph.

This lookahead is required for CommonMark correctness (a lone `| a | b |` line is a paragraph, not a table). But during streaming it produces two un-rendered windows that the open-line projection (`buildStreamingRoot`) does not currently cover:

1. **Open line is a complete-or-partial header** (`| Name | Age |`, no newline yet) — `handleBlockLine` sets `tablePending` and the projection renders nothing for it.
2. **Header newline-committed, awaiting the delimiter** — `tablePending` is set, `lineBuffer` is empty or a partial delimiter; the committed doc has nothing for the header.

## Goal

Render a streaming table as **text → header-row table (growing) → full table**, with no vanish, no raw-pipe paragraph flash, and no double-paragraph — while keeping the committed parse byte-for-byte CommonMark-correct.

## Decisions (locked during brainstorming)

1. **Scope:** the table-header flicker only. Setext headings (a separate, pre-existing correctness gap) and non-pipe-fenced GFM tables are out of scope.
2. **Pending render:** an optimistic **header-row table** (smooth header preview), not literal text.
3. **Architecture:** **projection-only** (Approach A). No optimistic writes to committed state — the immutable model stays clean; revert/`finish()` correctness is automatic. (Approach B — eagerly committing a real table and un-committing it on revert — was rejected: it churns identity, makes "un-commit a table → paragraph" awkward, and would corrupt CommonMark correctness in a full-document parse.)
4. **Eagerness:** **first closed cell** — flip paragraph→table the instant the open line, after ≤3 spaces of indent, starts with `|` **and** contains a second `|` (the first cell is closed). `| Name |` or `| Name | A` → table; a lone `| Na` stays a paragraph one extra token. Fastest unambiguous point; prefix-consistent with the committed `TABLE_ROW_RE`.

## Architecture & data flow

The open-line projection already exists: `buildStreamingRoot` (parser.ts) runs `handleBlockLine` on a **throwaway preview state** (`{ ...state, lineBuffer: '', optimisticInline: true }`, with the open line passed as the argument) and grafts the resulting open-line nodes onto the committed document, reusing committed mirror nodes by reference-equality for identity. The fix extends that same flagged path:

```
push(chunk)
  → committed parse (unchanged; tablePending lookahead intact)
  → root getter → buildStreamingRoot(committedDoc)
        → handleBlockLine(previewState, openLine)   // previewState carries optimistic flag + state.tablePending
              → NEW: under the optimistic flag, a table-header-in-progress
                     becomes a streaming `table` node instead of buffering
        → graft preview children onto committed doc (reuse committed nodes by identity)
```

Because the optimistic table is built only on the preview state, it is **never committed**. The next push rebuilds the projection from scratch, so revert is automatic.

## Components & changes

### `@cacheplane/partial-markdown` (the fix)

**`src/types.ts`** — add `optimisticBlock?: boolean` to `InternalState` (distinct from `optimisticInline` for clarity; both set by the projection). Keeps inline-vs-block optimism legible.

**`src/handlers/block.ts`** — under `state.optimisticBlock === true` (i.e. the preview path only), render table headers optimistically:

- **Detection helper** `isTableHeaderInProgress(line): boolean` — true when, after `/^\s{0,3}/` indent, the line starts with `|` and contains at least one further `|`. (Prefix-consistent with `TABLE_ROW_RE`, which requires the leading pipe.)
- **Open-line case:** when `optimisticBlock` and `state.mode === 'block'` and `isTableHeaderInProgress(openLine)`, build a streaming header-only table from `openLine` instead of stashing it in `tablePending`. Gated on `state.mode === 'block'` so a `|` line inside a code fence / html-block / math-display stays in that mode.
- **`tablePending` case:** when `optimisticBlock` and `state.tablePending !== null`, build a streaming header-only table from `state.tablePending.headerLine` (rather than the normal "wait/revert" logic). This covers the post-newline-pre-delimiter frame that today blanks.
- **Header synthesis** reuses the existing builders: a `table` AstNode (`status: 'streaming'`, `alignments` = array of `null`, one per cell) + one `appendTableRow(..., isHeader = true)` whose cells come from the existing `splitTableCells`. Cell count = number of cells `splitTableCells` finds so far, so the header grows column-by-column as `|`s arrive and the trailing in-progress cell fills in. `commitTable` (block.ts:659), `appendTableRow` (block.ts:680) and `splitTableCells` (block.ts:750) are all local to `block.ts`, so the new optimistic code lives alongside them — no extraction or new shared module needed.

**`src/parser.ts`** — `buildStreamingRoot` sets `optimisticBlock: true` on the preview state (next to the existing `optimisticInline: true`). The `tablePending` projection works because the preview state already spreads `...state` (so it carries the live `state.tablePending`). No other parser.ts change; the existing committed-node reuse-by-identity logic continues to graft the real table once it commits.

### `~/repos/angular-agent-framework` `libs/chat` (consume)

- **No component changes.** `libs/chat/src/lib/markdown/views/markdown-table.component.ts` already tolerates a header-only table: `headerRow()` returns `rows[0]` when `isHeader`; `bodyRows()` is `rows.slice(1)` (empty). It renders `<thead><tr>…</tr></thead><tbody></tbody>` and fills `<tbody>` as body rows stream.
- **Dependency bump:** `@cacheplane/partial-markdown` to the new release in `libs/chat/package.json` (+ root `package-lock.json`, **edited surgically** — never regenerate on macOS, which drops Linux `@next/swc-*` bindings).

## Error handling / correctness invariants

- **Committed parse unchanged.** All optimism is on the throwaway preview state. A full-document or newline-terminated parse produces identical committed output to 0.5.1.
- **Revert.** Open line `| a | b` with no delimiter on the next line → the committed parser reverts `tablePending` to a paragraph; the projection, rebuilt each push, follows. Brief table→paragraph flip, identical in spirit to inline `**` reverting — the accepted optimism tradeoff.
- **`finish()`.** A lone header with no delimiter commits as a **paragraph** (CommonMark-correct). The optimistic table never persists.
- **Context gating.** Optimistic table detection fires only when `state.mode === 'block'`. Lines starting with `|` inside fenced code, html-block, or math-display are unaffected.
- **Identity.** The not-yet-committed table node is regenerated each push (no stable identity), matching how the open paragraph already churns under B.2; chat markdown views track by index, so this causes no `@for` re-creation regression. Once the real table commits, `buildStreamingRoot`'s reference-equality reuse gives it stable identity.

## Testing

**partial-markdown — new `src/__tests__/streaming-table.test.ts`:**

- Eager flip at the first closed cell: `| Name |` (open, no newline) → `table:streaming` with one header row, cell `Name`; `| Na` (no second pipe) stays `paragraph:streaming`.
- Live column growth: pushing `| Name `, `| Age `, `|` grows the header row from 1 → 2 cells.
- The `tablePending` frame never blanks: after `| a | b |\n` (header committed, no delimiter yet) the projection is `table:streaming` (header row), **not** `[]` and **not** two paragraphs.
- Delimiter handoff: after the alignment row commits, the node is the real `table` with parsed `alignments`, body rows stream into it, and committed nodes keep identity across pushes.
- Revert: `| a | b |\n` followed by a non-delimiter line → paragraph(s), no table (matches committed behavior).
- `finish()` on a lone header → paragraph, status complete.
- Context gating: a `|`-leading line inside a ```` ``` ```` fence stays `code-block`.

**partial-markdown — extend `src/__tests__/chunk-fuzz.property.test.ts`:** a table input (`| a | b |\n| - | - |\n| 1 | 2 |\n`) chunk-split at every boundary yields the same committed document (chunk-invariance), and no chunking throws.

**chat — integration test (vitest, mirroring existing markdown streaming tests):** feed the table incrementally through the parser, `materialize(parser.root)` after each push, and assert the top block is a `table` from the first closed cell onward — i.e. it never regresses to a `paragraph` mid-stream (the anti-flicker guarantee, from the consumer's perspective). No e2e needed.

## Release & consume

1. partial-markdown: bump `0.5.1 → 0.5.2`, update CHANGELOG, publish via the npm OIDC trusted-publishing workflow (npm ≥ 11.5.1, no `registry-url` in setup-node, annotated tag).
2. ngaf: bump the `libs/chat` dependency to `0.5.2`, surgical lockfile edit, run chat lint/test/build, and a live or fixture smoke of a streaming table before merge.

## Out of scope

- Setext headings (`Title`/`===` → h1) — a separate correctness gap, rare in LLM output.
- Non-pipe-fenced GFM tables (`Name | Age` with no leading pipe) — the parser intentionally requires a leading pipe.
- Live column alignment during the delimiter stream — alignments lock in when the delimiter commits; not worth projecting partially.
- Open *body*-row cell streaming — body rows already appear per-newline; a cheap follow-on using the same mechanism, deliberately deferred to keep v1 tight.
