# LangGraph delta merge: identity-based reconciliation — Design

**Date:** 2026-07-06
**Status:** Approved, ready for implementation plan
**Repo:** `~/repos/angular-agent-framework` (`libs/langgraph`)
**Relates to:** the streaming-table work (partial-markdown 0.5.2/0.5.3, chat #743/#744). This fixes the remaining intermittent "table collapses to raw text mid-stream" — which turned out to be silent data loss in the message accumulation, not a rendering issue.

## Problem

While an assistant message streams over the LangGraph transport, the accumulated content intermittently **loses characters**. Live capture (examples/chat, gpt-5-mini, table prompts): the wire delivered a delimiter row `|--------------|--------|-------------|` (48 pipes across the message) but the accumulated content rendered `-----------------------------------|` (35 pipes). The final message (values-sync) is always correct, so the UI self-heals at stream end — mid-stream, tables collapse to raw pipe text (invalid GFM) until then.

### Root cause (proven)

`accumulateContent` in `libs/langgraph/src/lib/internals/stream-manager.bridge.ts` (~line 1183) merges each incoming messages-tuple chunk into the accumulated text with **string-prefix heuristics**:

```ts
if (incomingText.startsWith(existingText)) return incomingText; // superset → replace
if (existingText.startsWith(incomingText)) return existingText; // "stale duplicate" → DROP
return existingText + incomingText;                             // delta → append
```

The second guard drops any delta that happens to be a **prefix of the accumulated message**. A markdown table message starts with `|`, so every bare-`"|"` token the model streams (row boundaries, delimiter pipes) is silently swallowed. Proof: replaying a corrupted run's captured wire events through this exact algorithm reproduced the observed accumulation **byte-identically** (466 chars / 35 pipes; 13 dropped chunks, every one the single character `|`); the same replay without the guard yields the wire-exact text (48 pipes). The wire itself is intact — SDK-delivered events carry all characters.

Contributing facts:

- The failure is content-dependent and intermittent: only runs where the tokenizer emits bare `|` (or other message-prefix-coinciding) tokens trip it; runs with fused tokens (`|---`, `:|`) don't. Any message whose opening characters recur as a lone delta is exposed (e.g. `-` deltas in a message starting with a bullet).
- The first guard is also unsound for deltas: a `"| Gem"` delta arriving when the accumulation is `"|"` *replaces* instead of appending (drops a pipe). It didn't fire in captured runs but is the same class of bug.
- The guards exist for a real reason: after a node completes, values-sync installs canonical full text for the message, and a straggler token chunk arriving afterwards must not append duplicate text. The prefix check is a text-based *guess* at that situation.
- Both unit suites and aimock-replay e2e are blind to this: fixtures deliver content atomically, and the corruption depends on live token boundaries.

## Design principle

**Reconcile by identity and event kind — never by comparing text to text.**

The event system already declares what each event is: messages-tuple events (`event.messageMetadata` present) are **deltas**; `messages/partial` events are **snapshots** (message-so-far); values-sync carries **canonical** state. The merge must use those declarations instead of inferring intent from string prefixes. Measured on live streams, tuple chunks carry a stable message id (150/151 chunks in a sampled run shared one id; the outlier is covered by the existing trailing-AI fallback), so identity-keyed accumulation is reliable.

## Change (all in `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`)

1. **Thread a merge mode from the event site.** `processEvent`'s messages branch calls `mergeMessages(existing, normalized, reasoningTimingMap, mode)` with `mode: 'delta'` when `event.messageMetadata` is present (messages-tuple) and `mode: 'snapshot'` for `messages/partial`. `mergeMessages` passes the mode to `accumulateContent`.

2. **`accumulateContent(existing, incoming, mode)`:**
   - `snapshot` → current behavior, unchanged (mutual-prefix reconcile; snapshots are prefixes of one another by nature).
   - `delta` → **append unconditionally**, with exactly two exceptions:
     - `isFinalCanonicalReasoningContent(incoming)` → replace (unchanged; this is the authoritative final array shape, and it marks the message canonical — see 3).
     - empty incoming → keep existing (unchanged).
   - Both `startsWith` guards are removed from the delta path.

3. **Canonical-id backstop (identity-based version of what the dropped guard was for).** The bridge keeps a `canonicalMessageIds: Set<string>`:
   - values-sync (the `'values'` case that projects `state.messages` into `messages$`) adds each synced assistant message id to the set; the `isFinalCanonicalReasoningContent` replacement adds the message's id too.
   - In `mergeMessages`, a **delta** whose target message id is in the set is ignored (a straggler token after canonical text landed — the scenario the old guard guessed at, now decided by identity).
   - The set is cleared at the start of every `runStream` and on thread switch (same lifecycle as the other per-run maps, e.g. `toolProgressMap`).

4. **No changes** to `findContentMatch`, the trailing-AI fallback, `preserveIds`, reasoning accumulation, or the snapshot path.

## Error handling / invariants

- **No text-shape assumptions:** the delta path never inspects content beyond extracting text; pipes, dashes, or any prefix-coinciding token are appended like any other.
- **No duplicates:** post-canonical stragglers are dropped by id membership, not text similarity. Values-sync continues to replace content wholesale for matching ids (existing behavior), so canonical text remains authoritative.
- **Ordering:** SSE delivers events in order on a single connection; a message's deltas precede its values-sync. The canonical set only ever suppresses deltas that arrive *after* canonical text for that id, which is precisely the stale case.
- **Lifecycle:** clearing the set per run prevents a regenerated message (new run, reused thread) from being suppressed by a previous run's canonical marking.

## Testing

**Unit (TDD, `libs/langgraph`)** — extend the existing harness in `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`, driving events through the bridge (a fake transport yielding scripted tuple/values events), matching that file's established pattern:

1. **Pipe-preservation (red first):** feed tuple delta events `['|', ' Gem', ' |', ' Color', ' |', '\n', '|', '---', '|', '---', '|', '\n', '|', ' Ruby', ' |', ' red', ' |']` for one message id; assert the accumulated content equals the exact concatenation (fails today: bare `|` deltas vanish).
2. **Prefix-delta append:** accumulation `'|'` + delta `'| Gem'` → `'|| Gem'` (guards the first `startsWith` misfire).
3. **Straggler-after-canonical:** deltas accumulate → values-sync installs canonical full text for the id → one more late delta for that id → content unchanged (no duplicate, no loss).
4. **Final-canonical replacement:** streamed accumulation + final reasoning+text array → replaced by canonical text (existing behavior preserved).
5. **Snapshot regression:** `messages/partial` snapshots (each a prefix-extension of the last, then a shorter stale one) reconcile exactly as today.
6. **Per-run reset:** after a new `runStream` on the same thread, deltas for a fresh message id accumulate normally even if a prior run marked ids canonical.

**Suites:** full `libs/langgraph` + `libs/chat` (lint/test/build).

**Live verification (required gate, Chrome MCP):** with the dev stack serving the fix, run ≥6 table prompts using the 3-layer capture (SDK events recorder + accumulation progression + DOM). Require on **every** run: `sdkPipes === accumPipes`, no non-prefix content divergence at stream end (accumulation now equals final), and zero table-collapse frames. Then remove the temporary SDK-event recorder from `fetch-stream.transport.ts` (added during diagnosis) before the PR.

## Out of scope

- The langgraph dev server / SDK (wire is proven intact).
- `subagent-tracker.ts`'s own `mergeMessages` (id/append-based already; no prefix guards).
- Stream resumability (`streamResumable`) — orthogonal transport hardening; not implicated.
- Any rendering-layer changes.
