# Mastra sub-agent streaming: forward child deltas via a public-API stream tee

**Date:** 2026-09-02
**Status:** Approved (Brian, after deep research validated the layer and revised the seam)

## Problem

The Mastra runtime's subagent cell is Partial: Mastra streams the sub-agent's chunks
in-process as parent `tool-output` chunks (`{type:'tool-output', payload:{output:
<childChunk>, toolCallId, toolName}}` — a public, typed shape), but `@ag-ui/mastra`
1.1.2 drops them (`case "tool-output": break`) and buffers the delegation's
`TOOL_CALL_START/ARGS/END` until the tool result. The card therefore mounts already
complete after a ~5 s silent gap.

## Research verdicts (evidence in the session's research report)

- Pin not stale: 1.1.2 is the latest `@ag-ui/mastra`; upstream `main` still drops
  `tool-output`; the only related upstream work is open PR #2403 (opt-in eager
  `TOOL_CALL_START` for server tools), which also documents that buffering is
  load-bearing for suspend retraction.
- No alternative layer: `@mastra/server` has no AG-UI route; Mastra's documented server
  integration builds the same bridge inside a runtime we cannot depend on. `server.mjs`
  is the canonical pattern and adds things upstream lacks.
- Mastra's official `onChunk` hook excludes `tool-output` in its compiled allow-list.
- A bridge subclass works today but couples to three TS-private methods, a `clone()`
  that constructs the base class (drops overrides), and signature drift on `main`.

## Design

1. **Stream tee on a proxied agent** — `deployments/ag-ui-mastra/streaming-tee.mjs`
   exports `withDelegationTee(agent, observe)`: a `Proxy` over the real Mastra `Agent`
   that forwards every member bound to the real instance (so `#private` fields and the
   bridge's `'getMemory' in agent` check keep working) except `stream()` and
   `resumeStream()`, whose results are returned with `fullStream` replaced by an async
   generator that calls `observe(chunk)` **before** yielding each chunk to the bridge.
   One reader, one iteration → the observer's SSE writes are strictly ordered ahead of
   the bridge's processing of the same chunk. The unmodified `MastraAgent` receives the
   proxy.
2. **Injector grows a chunk input** — `subagent-emitter.mjs`'s per-run injector gains
   `chunk(c)` returning AG-UI events to write, alongside the existing `eventsFor(event)`:
   - `tool-call` whose `toolName` starts with `agent-` → synthesize eager
     `TOOL_CALL_START/ARGS/END` (args are complete in the chunk; `parentMessageId` = the
     last `start`/`step-start` chunk's message id) + `SUBAGENT_STARTED {subagentRunId:
     <toolCallId>-sub, name, parentToolCallId}`. Record the id so the bridge's later
     buffered `TOOL_CALL_START/ARGS/END` for the same id are dropped in `eventsFor`
     (its `TOOL_CALL_RESULT` still passes through).
   - `tool-output` for a tracked id: inner `text-start` → attributed `TEXT_MESSAGE_START`
     (lazy: open on first delta if no explicit start), `text-delta` →
     `TEXT_MESSAGE_CONTENT`, `text-end` → `TEXT_MESSAGE_END`. Inner tool chunks are
     out of scope for this PR (ignored).
   - `tool-result` for a tracked id → close any open message, `SUBAGENT_FINISHED`
     (success) or `SUBAGENT_ERROR` per the existing result check; mark deltas-seen.
   - `tool-call-suspended` for a tracked id → close any open message,
     `SUBAGENT_FINISHED {outcome:{type:'suspended'}}` (the eager START has already been
     painted — accepted, documented caveat; the demo's delegation does not suspend).
   - The existing `TOOL_CALL_RESULT` synthesis of a single-chunk message stays ONLY as
     the fallback when no deltas were observed for that id.
   - Terminal cleanup (RUN_FINISHED/RUN_ERROR) unchanged, extended to close open
     messages.
3. **server.mjs wiring** — build the proxy per request with an observer that runs
   `injector.chunk(c)` and writes each returned event as an SSE frame through the same
   `res.write` path; the bridge's events keep flowing through `injector.eventsFor`.
4. **Spike first** (the two unverified items): (a) a unit test that a Proxy-wrapped
   real `Agent` still satisfies the bridge (`'getMemory' in proxy`, `listTools`,
   `stream()` returning a wrapped `fullStream`); (b) confirmation from
   `libs/chat` that a subagent card needs the parent tool call present (it does —
   `chat-tool-calls` anchors cards to tool-call entries), which is why synthesis is
   required rather than optional; (c) a raw `fullStream` capture of one delegation
   (chunk types + order, presence of `text-start/end`, whether `tool-call-suspended`
   ever appears here).

## Verification gates

Wire capture showing eager `TOOL_CALL_START` + `SUBAGENT_STARTED` before the child
deltas and N attributed `TEXT_MESSAGE_CONTENT` events; browser check with the card's
text growing while `running` (char-growth samples + screenshot); e2e 5/5 in replay
(assertions unchanged); lane unit tests for the tee, the chunk mapping, dedupe, the
no-delta fallback, error, suspended, and terminal cleanup. Then the docs cell flips:
`choosing-an-adapter` matrix + section, runtimes intro + Mastra overview/how-it-connects,
both runtime blog posts ("one Partial cell" sentences), and the wire-capture doc.

## Out of scope

Inner sub-agent tool calls as attributed `TOOL_CALL_*`; the upstream `tool-output`
mapping patch (filed as a follow-up referencing #2403 for the eager-START half); the
bridge-subclass alternative (documented in the wire-capture doc as the fallback design).
