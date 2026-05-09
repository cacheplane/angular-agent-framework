# `@ngaf/langgraph` Streaming Content Dedup

**Date:** 2026-05-08
**Status:** Approved
**Surfaced by:** live-Chrome smoke pass against `examples/chat` after Phase 2A landed (`8300be9b` on `origin/main`).

## Goal

Fix the visible content duplication in `<chat-streaming-md>` when an assistant message's content has both a `reasoning` block and a `text` block. Land tight unit-test coverage for the streaming-merge helpers in `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`, which currently have no direct test coverage despite being the most fragile part of the adapter.

## The bug

**Reproduction (currently broken on `origin/main`):**

- Demo: `examples/chat/angular` workspace-linked, against `examples/chat/python` with `reasoning.summary='auto'` (landed in PR #217).
- Set palette: model=`gpt-5`, effort=`high`. Click the "Solve a multi-step puzzle (try Effort = high)" welcome suggestion.
- Server-side state for the resulting AI message:

```json
{
  "type": "ai",
  "content": [
    { "type": "reasoning", "summary": [{ "type": "summary_text", "text": "..." }] },
    { "type": "text", "text": "<830 chars of visible answer>" }
  ]
}
```

- DOM-side after the stream settles: `chat-message[1].textContent.length === 1520`. The visible answer renders ~1.83× the expected length — the canonical text appears almost-but-not-quite twice.

## Root-cause analysis

The fragile path is the fallback inside `accumulateContent`:

```ts
function accumulateContent(existing: unknown, incoming: unknown): string {
  const existingText = extractText(existing);
  const incomingText = extractText(incoming);

  if (existingText.length === 0) return incomingText;
  if (incomingText.length === 0) return existingText;
  if (incomingText.startsWith(existingText)) return incomingText;
  if (existingText.startsWith(incomingText)) return existingText;
  // FALLBACK (the bug locus): treat incoming as a delta and append.
  return existingText + incomingText;
}
```

When neither side is a strict prefix of the other, the function blindly concatenates. The visible 1.83× ratio (≈690 + 830 ≈ 1520) suggests the streaming accumulator reaches ~690 chars while the final canonical message arrives with the full 830 chars; small formatting differences (whitespace, smart-quote normalization, NFC, or simply the leading reasoning block shifting which block `extractText` picks up) break the prefix check, and the fallback fires.

This bug surfaces specifically when content arrays contain both `reasoning` and `text` blocks because the content shape changes mid-stream from "string deltas" to "array with mixed blocks". Pre-Phase-2A the demo never exercised this path.

## Reference research

Two well-known consumer libraries handle this differently:

**CopilotKit** (`packages/runtime/src/agents/langgraph/event-source.ts`) — emits explicit `TextMessageStart` / `TextMessageContent` (with delta) / `TextMessageEnd` events through an RxJS `scan`. Downstream consumers append deltas. There is no dedupe logic — the wire protocol is delta-only by design.

**Hashbrown** (`packages/core/src/utils/assistant-message.ts`) — `updateAssistantMessage` is a single-line append: `existing.content + delta.choices[0].delta.content`. Pure delta protocol from the OpenAI SDK chat completions API.

Neither tries to prefix-detect or content-dedupe — because they don't have to. They live downstream of a delta-only wire protocol.

The `@ngaf/langgraph` adapter is the only one of the three trying to recover delta-like behavior from a hybrid snapshot+chunk source (the LangChain JS SDK's `astream` plus a final canonical message). That recovery is the source of the bug.

## Approach

Stay with the snapshot+dedupe model — converting to a CopilotKit-style delta protocol is a much larger refactor that would change the public `Message` shape and break downstream consumers. Instead, harden the existing pipeline by capturing a real chunk sequence, replaying it as a unit test, and applying a targeted fix.

### Step 1 — capture

Turn on the existing trace harness (`localStorage.setItem('NGAF_CHAT_STREAM_TRACE','1')`) and run the puzzle prompt with model=gpt-5, effort=high. Persist the actual sequence of `messages` events the bridge sees as a JSON fixture at `libs/langgraph/test/fixtures/streaming-reasoning-puzzle.json`.

### Step 2 — failing replay test

Add a unit test that loads the fixture and replays it through `mergeMessages` against an empty initial state. Assert:

```ts
const final = chunks.reduce((state, chunk) => mergeMessages(state, [chunk]), [] as BaseMessage[]);
expect(typeof final[final.length - 1].content).toBe('string');
expect((final[final.length - 1].content as string).length).toBe(830); // server canonical text length
```

This will currently fail at ~1520. Adjust the exact length assertion to whatever the captured fixture's server-side text block reports.

### Step 3 — diagnose

From the captured chunks, identify which event triggers the append fallback. Three plausible mechanisms:

- **a.** Final canonical content array has slightly different text than the streaming accumulator (whitespace, normalization).
- **b.** `extractText` is including a delta-token block that the final canonical excludes (e.g. `output_text` vs `text` discrimination).
- **c.** A reasoning-block presence in the incoming array shifts which block `extractText` picks up.

### Step 4 — targeted fix (decision after Step 3)

Pick whichever matches the diagnosis. Prefer the narrowest fix that doesn't regress the genuine delta-append path:

- **4a.** Detect "this is a final canonical message" (heuristic: incoming has `response_metadata.finish_reason` set, OR incoming.content is an array containing both `reasoning`/`thinking` AND `text`/`output_text` blocks) — when detected, the incoming is authoritative. Replace existing content with `extractText(incoming)`; never append.
- **4b.** Normalize `extractText`'s output (trim trailing whitespace, NFC) before the prefix comparison. Cheap, but only helps if the issue is text-level differences.
- **4c.** Track per-id state in the bridge: once a message id has received a final-shape canonical, refuse further appends — only allow replacement or strict prefix extension.

The default plan if Step 3 doesn't decisively rule out any: **4a** for the immediate fix (smallest blast radius, narrow trigger condition). Whatever Step 3 reveals, do NOT change the fallback to "longer wins" — that path discards legitimate sequential delta tokens.

### Step 5 — pin behavior

Add unit tests for the three currently-untested helpers, in addition to the captured-fixture replay test.

`accumulateContent` (4 cases):
1. Empty existing + string incoming → incoming.
2. String delta + string delta where incoming is NOT a prefix → append (current legitimate path; pin it does NOT regress).
3. String existing + array-with-reasoning+text incoming where text differs → replace with incoming text (the bug-fix path).
4. String existing + array incoming where text is a strict superset → take superset.

`mergeMessages` (3 cases):
1. Same-id chunks accumulate content.
2. Chunk arriving without an id falls into the most-recent AI message.
3. Reasoning + text array as incoming sets `next.reasoning` to the summary text and `next.content` to the text-block string.

`collapseAdjacentAi` (2 cases — regression coverage):
1. Two adjacent AI messages with identical text → collapse to one.
2. Two adjacent AI messages with non-prefix-related text → keep both.

## Out of scope (defer)

- **Migrating to a CopilotKit-style delta-event protocol.** Bigger refactor; changes public `Message` shape; not justified by this single bug.
- **Replacing `extractText` / `extractReasoning` / `accumulateReasoning`.** Just shipped in PR #217 with their own tests; leave them.
- **Refactor toward a single `applyMessageUpdate(state, incoming) → state` primitive.** Tempting (cleaner mental model) but risks regressions in subagent tracking, queue replay, history sync, and other surfaces depending on the current helper boundaries. Defer.
- **Finding D (thread restoration on reload).** Separate brainstorm/spec/plan.

## Files touched

| Path | Change |
|---|---|
| `libs/langgraph/src/lib/internals/stream-manager.bridge.ts` | targeted fix in `accumulateContent` (~10 LOC); optional state-track in `mergeMessages` (~10 LOC) |
| `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts` | +9 unit tests + 1 fixture-driven replay test (~250 LOC) |
| `libs/langgraph/test/fixtures/streaming-reasoning-puzzle.json` | NEW — captured chunks from the live run |

Total ≈ 270 LOC, mostly tests + the fixture.

## Definition of done

1. PR merged.
2. All existing langgraph specs still green.
3. The captured-fixture replay test passes — final content length matches the server canonical (±20 chars for whitespace).
4. Live smoke against the workspace demo: puzzle prompt produces a single bubble whose `chat-message[1].textContent.length` is in the range of the server's `text` block length. Empirically: < 1.1× expected, not 1.83×.
5. New unit tests pin: legitimate delta-append still works; final canonical replaces partial accumulator; reasoning-block content arrays still extract correctly.

## Risks

- **Capture step depends on Chrome MCP working.** Currently it does. Fallback: query LangGraph's event replay endpoint (`/threads/{tid}/runs/{rid}/events`) directly via curl to capture the raw stream.
- **The fix might mask a different latent bug.** Mitigation: the unit tests pin both the legitimate delta-append path AND the bug-fix path; a regression in either direction surfaces in CI.
- **Reasoning-block content array detection (4a heuristic) might trip on a future content shape** (e.g. tool-call blocks layered with text). Mitigation: scope the heuristic narrowly — incoming is an array AND contains BOTH a `reasoning`/`thinking` block AND a `text`/`output_text` block. For any other shape, fall back to current prefix-detection behavior.
- **Existing langgraph spec count is 43.** This PR adds 9 + 1 = 10 new tests. CI duration shifts negligibly (the spec file is under 50ms total).
