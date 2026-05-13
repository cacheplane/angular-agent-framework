# CI Testing Coverage — Phase 1 (input-variance table tests)

> Scope is intentionally narrow. Phase 0 (test-infrastructure audit) and
> Phase 3 (AIMock E2E + CI wiring) are deferred. This document covers
> only the table-driven unit coverage that would have caught the PR #290
> regression before it shipped.

## Motivating regression

PR #290 fixed an empty-assistant-bubble bug: `@cacheplane/partial-markdown@0.3`
does not flush trailing text on `finish()` unless the buffer ends with `\n`.
Plain LLM responses (no trailing newline) rendered as an empty paragraph.
The fix lives in [streaming-markdown.component.ts:101-118](libs/chat/src/lib/streaming/streaming-markdown.component.ts) — a sentinel newline
is pushed before `finish()` so the open paragraph is closed.

The bug shipped because every pre-existing `chat-streaming-md` test fed
input that ended with `\n`. The "no trailing newline" shape — the most
common LLM-response shape — was not covered. Manual smoke caught it.

Two retro-fit assertions now live in
[streaming-markdown.component.spec.ts:77-103](libs/chat/src/lib/streaming/streaming-markdown.component.spec.ts) as point-in-time
checks for that exact case. Phase 1 generalises that approach: a table
of LLM-realistic input shapes, applied to the streaming-render pipeline
top-to-bottom, so the next "the LLM produced X" surprise can't ship
without a failing test.

## Goal

Add a focused table of input-variance assertions to four streaming-render
units that together cover the assistant-bubble render path:

1. `ChatStreamingMdComponent` — markdown rendering of LLM text
2. `ContentClassifier` — type detection of markdown vs. json-render vs. a2ui
3. `createPartialArgsBridge` — incremental envelope extraction from tool-call args
4. `createA2uiMessageParser` — JSONL envelope parsing from `---a2ui_JSON---` content

Each unit gets a new dedicated `*.variants.spec.ts` file (or expanded
coverage in its existing spec where the existing structure is already
table-friendly). The variants must include the case PR #290 missed —
no trailing newline — and other LLM-realistic shapes that would not be
written by a human-authored fixture.

## Non-goals

- A new test harness, mock agent, or E2E layer — deferred to Phase 2/3.
- Coverage of components downstream of these four units (those have their
  own existing specs).
- Performance benchmarking or fuzz testing — table-driven is enough to
  catch the class of regressions we have actually shipped.
- Refactoring existing specs that already test these units — only add
  the variance table.

## Definition of done

- A new `*.variants.spec.ts` file lives next to each of the four target
  source files.
- Each variants spec uses `describe.each` (or `it.each`) over a table of
  inputs so that adding a new variant is one row, not a copy-paste of an
  `it(...)` block.
- The PR #290 regression input ("plain text, no trailing newline") is
  one row of the chat-streaming-md table.
- `nx run chat:test` and `nx run a2ui:test` both pass.
- New rows do not duplicate assertions already covered in the existing
  pre-Phase-1 specs (they exercise variance, not happy-path).

## Target unit 1 — ChatStreamingMdComponent

**File under test:** [streaming-markdown.component.ts](libs/chat/src/lib/streaming/streaming-markdown.component.ts)

**New spec:** `libs/chat/src/lib/streaming/streaming-markdown.variants.spec.ts`

Each row drives the host's `content` signal to the input, sets `streaming`
to `false`, and asserts the rendered text content matches `expected`.
Streaming-mid-flight variants (where applicable) also set `streaming` to
`true`, push the content, then flip `streaming` to `false` and assert.

**Variance table:**

| Row name                          | Input                                | Expected text |
| --------------------------------- | ------------------------------------ | ------------- |
| plain text no trailing newline    | `Hello`                              | `Hello`       |
| plain text with trailing newline  | `Hello\n`                            | `Hello`       |
| heading no trailing newline       | `# Title`                            | `Title`       |
| heading with trailing newline     | `# Title\n`                          | `Title`       |
| partial bold mid-stream           | `**bo` (streaming=true → false)      | `bo`          |
| completed bold                    | `**bold**`                           | `bold`        |
| mixed paragraph + code            | `Run \`npm test\` to verify`         | contains `npm test` in `<code>` |
| CRLF line endings                 | `Line one\r\nLine two\r\n`           | both lines present |
| whitespace only                   | `   `                                | normalized text empty (markdown-it emits a placeholder `<p>` containing whitespace; we only assert the trimmed-text invariant) |
| empty string                      | ``                                   | no block elements |
| trailing whitespace no newline    | `Answer   `                          | `Answer` (trimmed paragraph) |

The "partial bold mid-stream" row exercises the same finalisation path
PR #290 fixed — the buffer ends mid-token without a trailing newline.

## Target unit 2 — ContentClassifier

**File under test:** [content-classifier.ts](libs/chat/src/lib/streaming/content-classifier.ts)

**New spec:** `libs/chat/src/lib/streaming/content-classifier.variants.spec.ts`

The existing
[content-classifier.spec.ts](libs/chat/src/lib/streaming/content-classifier.spec.ts)
covers the happy path for each branch. Variants table targets the
prefix-detection edge cases — places where the classifier must NOT
commit prematurely.

**Variance table:**

| Row name                                  | Push sequence                          | Expected final `type()` |
| ----------------------------------------- | -------------------------------------- | ----------------------- |
| single dash                               | `-`                                    | `pending`               |
| two dashes                                | `--`                                   | `pending`               |
| three dashes                              | `---`                                  | `pending`               |
| ---a                                      | `---a`                                 | `pending`               |
| ---a2u                                    | `---a2u`                               | `pending`               |
| ---a2ui_JSON---                           | `---a2ui_JSON---`                      | `a2ui`                  |
| ---a2ui_JSON--- in chunks                 | `[---, a2u, i_JSON, ---]`              | `a2ui`                  |
| markdown bullet — leading dash + space    | `- bullet`                             | `markdown`              |
| markdown HR — three dashes + space        | `--- horizontal`                       | `markdown`              |
| dash followed by char not in prefix       | `-x`                                   | `markdown`              |
| long dash-led plain text                  | `-this is just text leading dashes`    | `markdown`              |
| leading brace                             | `{`                                    | `json-render`           |
| leading whitespace then brace             | `\n  {`                                | `json-render`           |
| leading whitespace then dash              | `   -`                                 | `pending`               |
| empty                                     | ``                                     | `pending`               |
| whitespace only                           | `   \n  `                              | `pending`               |

Push sequences with multiple chunks call `update()` once per chunk; the
final assertion uses the classifier's state after the last push.

## Target unit 3 — createPartialArgsBridge

**File under test:** [partial-args-bridge.ts](libs/chat/src/lib/a2ui/partial-args-bridge.ts)

**Existing spec to extend:** [partial-args-bridge.spec.ts](libs/chat/src/lib/a2ui/partial-args-bridge.spec.ts)

The existing spec is already structured per-scenario rather than as a
table, and several rows from the variance set would duplicate it.
Phase 1 ADDS a `describe('createPartialArgsBridge — input variance', …)`
block at the bottom of the same file with `it.each` over the table
below.

**Variance table:**

| Row name                                       | Pushed args (one per row in the chunks array)                               | Expected after final push                   |
| ---------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| open brace then closed brace                   | `{`, `{}`                                                                   | no surface mounted, not poisoned            |
| open array mid-stream                          | `{"envelopes":[`                                                            | no surface mounted, not poisoned            |
| escaped quote in component id                  | full args with id `"with\"quote"`                                           | surface mounted, component id parsed verbatim |
| trailing whitespace after valid prefix         | full args + `   \n  `                                                       | surface mounted                              |
| unicode in component id                        | full args with id `"héllo"`                                                 | surface mounted, id matches                  |
| garbage prefix                                 | `{{{not_json`                                                               | poisoned, surfaces empty                    |
| valid prefix then garbage suffix               | valid args + ` garbage`                                                | poisoned                                    |
| two tool_call_ids interleaved                  | push `tc-A` (surface `a`), push `tc-B` (surface `b`)                        | both surfaces mounted independently         |
| identical chunk pushed twice                   | full args, full args                                                        | exactly one mount, no double dispatch       |

The "identical chunk pushed twice" row guards the re-parse path the
existing tc-6 test uses — but as a single row rather than a hand-written
case, so future variants slot in cleanly.

> **Char-by-char streams intentionally NOT tested.** A row that fed
> progressive 1-character prefixes was drafted and dropped during
> implementation. `@cacheplane/partial-json` materializes partially-parsed
> strings as their incomplete text (so prefix `"id":"r` materializes as
> `id: "r"`); the bridge's mount-once gate then synthesises
> `beginRendering` with `root: "r"` and never re-targets when the id
> fills in to `"root"`. LLM streams arrive token-chunked, not
> char-chunked, so this edge case has never bitten production. Phase 1
> would surface a false positive if it covered it. Filing this as a
> latent concern for a future phase if char-granular streams ever
> become real.

## Target unit 4 — createA2uiMessageParser

**File under test:** [parser.ts](libs/a2ui/src/lib/parser.ts)

**Existing spec to extend:** [parser.spec.ts](libs/a2ui/src/lib/parser.spec.ts)

Add a `describe('createA2uiMessageParser — input variance', …)` block
at the bottom of the existing spec.

**Variance table:**

| Row name                                     | Push sequence                                                                              | Expected emitted envelopes |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| envelope with trailing CRLF                  | `{"beginRendering":{"surfaceId":"s","root":"r"}}\r\n`                                      | 1 beginRendering           |
| envelope split mid-key                       | `{"begin`, `Rendering":{"surfaceId":"s","root":"r"}}\n`                                    | 1 beginRendering           |
| envelope split mid-string-value              | `{"beginRendering":{"surfaceId":"s","root":"`, `r"}}\n`                                    | 1 beginRendering           |
| three envelopes one chunk                    | concatenated 3 valid JSON lines with `\n` separators                                       | 3 envelopes in order       |
| three envelopes char-by-char                 | same input fed one character at a time                                                     | 3 envelopes in order       |
| malformed line then valid line               | `{garbage}\n` + valid envelope `\n`                                                        | 1 valid envelope (malformed dropped) |
| valid envelope, no trailing newline          | valid envelope JSON without final `\n`                                                     | 0 envelopes (parser waits for delimiter) |
| valid envelope, then trailing newline later  | valid envelope JSON (no `\n`), then push `\n`                                              | 1 envelope after second push |
| empty lines between envelopes                | `\n\n` + valid envelope + `\n\n` + valid envelope + `\n`                                   | 2 envelopes                |
| envelope with whitespace before brace        | `   {"beginRendering":...}\n`                                                              | 1 envelope                 |
| envelope key we don't recognise              | `{"mysteryUpdate":{}}\n`                                                                   | 0 envelopes (skipped)      |
| mixed valid + unrecognised + valid           | valid + unknown + valid (each on its own line)                                             | 2 valid envelopes          |

The "valid envelope, no trailing newline" row encodes a key invariant:
the parser is delimiter-driven and is allowed to wait. That contract is
relied on by the streaming pipeline; if a future refactor "helpfully"
flushes the last buffered line on its own, this row catches it.

## Test layout conventions

Per Phase 1, every new spec file follows these rules:

1. License header on the first line: `// SPDX-License-Identifier: MIT`
2. `import { describe, it, expect } from 'vitest'` (use `beforeEach` only
   when fixture state must be reset per row).
3. Use `it.each` (or `describe.each` when the assertion shape varies per
   row) to keep the table at the top of the spec and the assertions in
   one place at the bottom.
4. Row names match the table in this spec — easier to triage failures.
5. Variance specs must NOT duplicate the happy-path coverage in the
   pre-existing spec for the same unit. If a row is already covered,
   either remove the duplicate from the existing spec or skip the row.

## Runtime expectations

- `nx run chat:test` adds ~30–40 new assertions; current run time is
  under 10s and Phase 1 should keep it under 15s.
- `nx run a2ui:test` adds ~12 new assertions; current run time is under
  3s; Phase 1 should keep it under 5s.
- No new dependencies, no new tooling, no new CI jobs — Phase 1 is
  additive within the existing `nx run-many --target=test` pipeline.

## Deferred (NOT Phase 1)

- Mock-agent harness for end-to-end streaming tests.
- AIMock-based E2E coverage that drives the chat composition with
  scripted SSE frames.
- A CI workflow split that surfaces Phase 1 failures separately from
  flaky integration tests.
- Property-based / fuzz testing of the streaming pipeline (interesting,
  but doesn't catch the same class of regression PR #290 represented).
