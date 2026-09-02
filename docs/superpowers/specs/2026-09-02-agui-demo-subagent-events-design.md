# Migrate the AG-UI subagent demos to the standard SUBAGENT_* events

**Date:** 2026-09-02
**Status:** Approved (Brian: "we should use standard events; consider bumping the stale pin")

## Problem

`@threadplane/ag-ui` consumes the protocol's `SUBAGENT_STARTED/FINISHED/ERROR` +
`subagentRunId`-attributed content (#955), and all three third-party runtime demos emit
them (#956–#958). Our own LangGraph-backed AG-UI subagent demos still emit the private
`subagent_activity` CUSTOM event translated to `ACTIVITY_*` with `activityType:
'subagent'` — the legacy path. Two defects ride along: the per-token delta is discarded
into an accumulator and shipped as a full-string JSON-patch `replace` (O(n²) wire
volume), and the translator sits on `LangGraphAgent._dispatch_event`, a strictly 1:1
seam that cannot expand one CUSTOM into the N standard events.

## Scope

- `cockpit/ag-ui/subagents/python` — source of truth for the flat variant;
  `deployments/ag-ui-dev/deps/subagents/**` is CI-gated generator output (regenerate,
  never edit).
- `examples/ag-ui/python` — an independent, richer fork (multi-message + tool calls);
  migrated second with the same emitter pattern.
- Out of scope: `deployments/shared-dev/deps/{c-,da-}subagents` (chat-lane LangGraph
  mechanism, untouched); removing the adapter's legacy ACTIVITY support (stays).

## Design

1. **SDK pin.** Both demos pin `ag-ui-protocol==0.1.19`, which predates the Subagent
   event classes. Add an explicit `ag-ui-protocol>=0.1.22` to each `pyproject.toml`
   (transitive today; `ag_ui_langgraph 0.0.37` only requires `>=0.1.15`), re-lock with uv.
   First act per demo: a wire capture proving `ag_ui_langgraph`'s serializer round-trips
   `subagent_run_id` and the `SUBAGENT_*` types.
2. **Seam.** Replace `ActivityEmittingAgent` (`_dispatch_event`, 1:1) with a
   `SubagentEmittingAgent(LangGraphAgent)` that wraps `run()`: `async for ev in
   super().run(input): for out in expand(ev): yield out`. No queue merge — the CUSTOM
   events already flow through that generator (simpler than the MAF lane).
3. **Graph payloads.** `subagent_activity` phases become: `started {name}`,
   `message_start {message_id}`, `message {message_id, delta}` (the raw `token` from
   `on_llm_new_token` — the accumulator goes away), `tool_call {tool_call_id, name,
   args}`, `tool_result {tool_call_id, content}`, `finished {status}` /
   `error {message}`. The payload's `subagent_id` is the `task` tool's injected
   `tool_call_id` — identical to the bridge's `TOOL_CALL_START.toolCallId`.
4. **Expansion contract** (ids derived from `tid = subagent_id`, distinct run id per the
   #956–#958 convention): `started` → `SubagentStartedEvent(subagent_run_id=f"{tid}-sub",
   name, parent_tool_call_id=tid)`; `message_start` → `TextMessageStartEvent(message_id=
   f"{tid}-sub-m{n}", role="assistant", subagent_run_id)`; `message` →
   `TextMessageContentEvent(delta, subagent_run_id)`; end-of-message inferred at the next
   `message_start`/`tool_call`/`finished` → `TextMessageEndEvent`; `tool_call` →
   `ToolCallStart/Args/End` attributed; `tool_result` → `ToolCallResultEvent` attributed;
   `finished` → `SubagentFinishedEvent(outcome=success)`; `error` →
   `SubagentErrorEvent(message)`. The CUSTOM event itself is consumed (not forwarded).
   Pydantic `ag_ui.core` classes only (encoders reject raw dicts).
5. **Tests.** Python: the ACTIVITY transform/handler tests are replaced by an emitter
   suite in the MAF style (exact sequence field-for-field, error path, multi-message
   ordering for examples). Angular e2e assertions are projection-level and survive;
   aimock fixtures drive the model and do not change.
6. **Ordering check.** LangGraph-specific: verify on the wire that the bridge's
   `TOOL_CALL_START` for `task` precedes the tool body's `SUBAGENT_STARTED`. The reducer
   tolerates the reverse (buffer-not-drop) but the card would briefly render nameless;
   record the measured order in each demo's `docs/wire-capture-subagents.md`.
7. **Docs.** The subgraphs blog post's two "emits `subagent_activity` CUSTOM events"
   sentences and the cockpit `docs/guide.md` walkthrough are rewritten to the standard
   events (no-contraction register in the post).

## Verification gates (per demo)

Wire capture (before + after), live browser check of the card streaming, e2e replay
green (cockpit `subagents.spec.ts`; examples `subagent-card.spec.ts`), `deployments/
ag-ui-dev` regenerated in the same PR (deploy workflow fails on drift).

## PR staging

PR 1 cockpit demo (+ regen), PR 2 examples demo, PR 3 docs — or fold docs into PR 2.
