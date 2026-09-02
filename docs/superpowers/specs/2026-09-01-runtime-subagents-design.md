# Subagent support across runtimes: adapter, demos, verification, and publication

**Date:** 2026-09-01
**Status:** Draft (pending Brian's approval)

## Problem

The published capability matrix says subagents are LangGraph-only ("No" for AWS Strands,
Microsoft Agent Framework, and Mastra; cause "upstream"). Investigation shows all three
findings are stale or under-measured:

1. `@ag-ui/core` 0.0.59 (2026-08-27) added first-class subagent events —
   `SUBAGENT_STARTED` / `SUBAGENT_FINISHED` / `SUBAGENT_ERROR` plus an optional
   `subagentRunId` attribution field on ~30 content-event types (text, tool-call, step,
   reasoning, activity), with `parentToolCallId` linkage designed for agents-as-tools.
   **Our `@threadplane/ag-ui` adapter ignores all of it** — the only path into
   `subagents()` is the Threadplane-private `activityType: 'subagent'` ACTIVITY
   convention. "Cause: upstream" is now half-wrong; consuming the protocol's own events
   is our gap.
2. Every runtime has observable delegation signals the measurement never exercised:
   Strands emits `multiagent_node_start/stop`, `multiagent_handoff`, and forwards child
   token streams (agents-as-tools children stream via `tool_stream_event`); MAF (GA 1.0)
   stamps `executor_id` on every workflow event with per-agent streaming deltas; Mastra
   1.8.0 shipped a sub-agents system with `onDelegationStart`/`onDelegationComplete`
   hooks (child text reaches the parent only as a tool result; incremental delta
   forwarding is undocumented — treat as absent until proven).
3. The red cells were measured on **single-agent demos**. None of the three runtime
   backends attempts delegation anywhere.

## Goal

Approach 1 (approved): server-side emitters, protocol-pure adapter.

- `@threadplane/ag-ui` consumes the standard `SUBAGENT_*` events and `subagentRunId`
  attribution, keeping the legacy ACTIVITY convention as back-compat.
- Each cockpit runtime demo gains a real delegation flow plus a small per-runtime
  emitter that translates its native signals into the standard events.
- Every claim is verified by live wire capture against a real model before it is
  written down.
- Docs and both runtime blog posts are rewritten to the verified matrix.

Out of scope: migrating the existing `cockpit/ag-ui/subagents` /
`examples/ag-ui` demos off the ACTIVITY convention (follow-up arc); Azure live
validation of MAF (still gated on credentials; OpenAI fallback is used); client-side
decoding of runtime-native shapes (rejected Approach 2); nested subagent trees
(`parentSubagentRunId` is stored but not rendered as a tree — flat map stays the
contract, matching @threadplane/langgraph).

## Design

### 1. Adapter: `@threadplane/ag-ui` consumes the protocol events (PR A)

`libs/ag-ui/src/lib/reducer.ts`:

- New store slot `subagents: Map<string, SubagentEntry>` keyed by `subagentRunId`.
  `SubagentEntry { subagentRunId, name, description?, parentToolCallId?,
  parentSubagentRunId?, status, messages, toolCalls, state }` with signal-backed
  mutable fields following the existing `ActivityEntry` pattern.
- `SUBAGENT_STARTED` → create entry (status `running`; re-announcement with a known id
  after a suspend updates rather than duplicates). `SUBAGENT_FINISHED` → outcome
  `success` → `complete`; outcome `suspended` → status stays `running` (the run will
  resume; the interrupt surfaces through the normal interrupt signal, not the card).
  `SUBAGENT_ERROR` → `error` with the message stored in `state`.
- **Attribution routing:** any `TEXT_MESSAGE_*` / `TOOL_CALL_*` event carrying
  `subagentRunId` feeds that subagent's `messages`/`toolCalls` and never merges into
  the parent transcript — the same structural rule the LangGraph adapter enforces for
  namespaced events. Events with an unknown `subagentRunId` buffer briefly under the id
  (started event may arrive after the first delta; mirror the LangGraph tracker's
  buffer-not-drop behavior).
- Unknown/absent `subagentRunId` → existing behavior, byte-for-byte.

`libs/ag-ui/src/lib/to-agent.ts` projection: `subagents()` merges (a) `SUBAGENT_*`
entries and (b) legacy `activityType === 'subagent'` ACTIVITY entries, in that order,
into the neutral `Map<string, Subagent>`. Neutral `Subagent.toolCallId` =
`parentToolCallId ?? subagentRunId`. Generation-stable wrappers as today.

Testing: reducer unit tests (lifecycle, suspended re-announcement, attribution routing,
unknown-id buffering, legacy-path regression) plus a new runtime transcript fixture in
`libs/ag-ui/fixtures/runtime-transcripts/` exercising the full event sequence.

### 2. Per-runtime delegation demos + emitters (PRs B, C, D)

Common shape: each demo keeps its existing scenario and gains ONE delegated specialist,
so messages/tools/state/interrupt tests stay untouched. Each backend gains an emitter
at its bridge boundary that produces the standard events. Emitters are duplicated per
the standalone-examples rule (demo backend + the registry-generated
`deployments/ag-ui-dev` dep for Strands/MAF; Mastra's own `deployments/ag-ui-mastra`).

**Spike-first rule:** each runtime PR starts with a wire-capture spike — run the
delegating agent against the live bridge and dump the raw SSE — BEFORE committing to
the emitter design. The captured stream is checked into the PR (scrubbed) as the
evidence artifact.

- **AWS Strands (PR B):** meeting-scheduler delegates to an `availability_researcher`
  specialist via **agents-as-tools** (`agent.as_tool(...)`; matches our task-tool
  demos, child tokens surface through `tool_stream_event`). Emitter: a bridge-agent
  subclass hook (the `ag_ui_strands` equivalent of our `ActivityEmittingAgent`)
  observing `current_tool_use` for the specialist tool → `SUBAGENT_STARTED`
  (`parentToolCallId` = toolUseId), forwarding the specialist's streamed text as
  `TEXT_MESSAGE_*` with `subagentRunId`, and tool completion → `SUBAGENT_FINISHED`.
- **Microsoft Agent Framework (PR C):** expense demo delegates to a
  `policy_researcher`. Pattern chosen by the spike: agents-as-tools if the bridge
  surfaces the nested run attributably, else a two-executor workflow (handoff's
  autonomous mode is still experimental in Python — avoid). Emitter maps
  `executor_invoked`/`executor_completed` + executor-attributed streaming updates to
  the standard events.
- **Mastra (PR D):** camping-trip planner delegates to a `weather_forecaster` sub-agent
  (`agents` property, 1.8.0). Emitter lives in our hand-written `server.mjs`/bridge
  layer (we own the whole SSE path): `onDelegationStart` → `SUBAGENT_STARTED`,
  `onDelegationComplete` → one `subagentRunId`-attributed text message carrying the
  child's final response + `SUBAGENT_FINISHED`. **No child deltas** unless the spike
  proves otherwise — expected matrix cell: Partial (lifecycle + final text, no
  streaming).

Event-construction risk: the Python `ag-ui-protocol` core package may lag the TS SDK on
the new event classes. Fallback (decided at plan time per bridge): emit the events as
raw typed dicts through the bridge's dispatch/encoder hook — the wire format is JSON
SSE either way. The Angular side is already on `@ag-ui/client` 0.0.59, which parses
them.

### 3. Runtime verification (every PR, plus the docs PR)

A cell may only change color with ALL of:
1. **Live wire capture**: the raw SSE stream from a real-model run showing the
   delegation sequence (checked in, scrubbed).
2. **Live browser check**: `chat-subagent-card` renders for the child during a real
   run (live-LLM smoke gate; screenshots in the PR).
3. **Deterministic e2e**: a new fixture + spec per runtime asserting the card via
   aimock replay (subagent events are produced by backend logic, so replay reproduces
   them deterministically).

### 4. Docs updates (PR E)

- `choosing-an-adapter/index.mdx` matrix: subagent cells per verified outcome, cause
  column rewritten (expected: "Yes — via a small emitter in the backend" for
  Strands/MAF, "Partial — lifecycle + final text, no child streaming" for Mastra; final
  wording follows verification). The "no cell is caused by our adapter" paragraph and
  the "Subagents are red for every third-party runtime" section rewritten.
- `runtimes/getting-started/introduction.mdx` matrix + the "Subagents are unavailable"
  section (L84) rewritten.
- Three `runtimes/*/overview.mdx` Surface tables (row 24) + "Subagents are not
  available" sections; three `how-it-connects.mdx` pages — the five-copy `SUBAGENT_*`
  / 0.0.59 boilerplate replaced in lockstep with the new truth (adapter consumes them;
  each backend emits them via its emitter).
- `ag-ui/reference/event-mapping.mdx`: document the SUBAGENT_* consumption +
  `subagentRunId` routing next to the existing ACTIVITY section.
- docsPath contract: no page renames (matrix specs assert 3-segment paths).

### 5. Blog updates (PR E)

Per the established convention: rewrite in place, truthful against the shipped code, no
arc narrative, no-contraction register (#883).

- `2026-08-31-we-measured-the-runtime-swap.mdx`: matrix row values updated; the
  "Subagents are red for all three" section (L137-155) rewritten around the verified
  reality — the protocol grew standard events, the adapter consumes them, each runtime
  reaches them through a small emitter, and what each runtime's native signals do and
  don't provide (Mastra's missing child deltas stays an honest Partial). L183/L185
  conclusions updated.
- `2026-08-31-what-changes-when-the-runtime-changes.mdx`: the adapter-comparison
  subagent row (L199) and the `activityType` convention caveat (L302) updated to name
  the standard events; editor's-note block updated or removed if superseded.

### 6. PR staging and verification gates

- PR A (adapter) → PR B (Strands) → PR C (MAF) → PR D (Mastra) → PR E (docs + blog).
  B/C/D depend on A; E depends on all. B/C/D are independent of each other.
- Each PR: two-stage review, full `nx test ag-ui` (+ that runtime's e2e), live smoke
  before merge. PR E ships only claims verified in B-D; any cell that fails
  verification publishes as its true color with the measured cause.
- CI: the three runtime e2e shards already exist; new specs ride them. Railway deploys
  (ag-ui-dev, ag-ui-mastra) redeploy after B/C/D merge; deployment smoke via the
  existing boot gates.

## Risks

- **Python AG-UI SDK lag** on SUBAGENT_* classes → raw-dict fallback (above).
- **MAF pattern uncertainty** → resolved by the spike before the PR shape is fixed;
  worst case the MAF cell publishes Partial with the measured cause.
- **Mastra deltas** → assumed absent; only the spike can upgrade the cell.
- **Suspended subagents** interacting with interrupt UX → suspended keeps the card
  `running`; interrupts flow through the existing interrupt signal (already verified
  per-runtime in #888/#889); one e2e per affected runtime covers the combination.
- **Wire-capture leakage** → captures are scrubbed of keys/org ids before commit.
