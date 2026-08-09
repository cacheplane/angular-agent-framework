# LangGraph Flush Missing-Persistence Error

**Date:** 2026-08-09
**Status:** Approved for implementation
**Builds on:** `2026-08-07-client-tool-continuation-fixes-design.md`

## Problem

LangGraph client-tool results settled without a follow-up run are buffered in
the browser until `flush()` makes them durable with `AgentTransport.updateState`.
Custom transports may omit `updateState`, so `agent.fn.ts` constructs the
client-tools capability without a persistence function.

Today `flush()` returns a resolved promise when that persistence function is
missing, even when the buffer contains results. The buffer survives for the
next ordinary `submit()`, but terminal groups do not require another submit.
A reload before the next user message therefore loses the results while every
caller observed a successful flush.

This violates the method's public contract: a resolved `flush()` must mean the
staged results are durable.

## Decision

`flush()` will reject when both conditions are true:

1. one or more client-tool results are staged; and
2. no persistence function is configured.

The error message will explain that custom LangGraph transports using terminal
client tools must implement `updateState()`.

An empty-buffer `flush()` remains a successful no-op. This preserves harmless
calls made as part of generic settlement flows when there is nothing to write.

## Data and Control Flow

The check belongs in `createClientToolsCapability`, where both the staged
buffer and the optional persistence function are visible.

1. `settle()` records the local result and appends its `ToolMessage` to the
   staged buffer.
2. `flush()` checks whether the buffer is empty. If so, it resolves.
3. If the buffer is non-empty and persistence is unavailable, `flush()` rejects
   without taking ownership of or mutating the buffer.
4. If persistence is available, the existing batching, chaining, thread
   filtering, and re-staging logic runs unchanged.
5. A later ordinary `submit()` may still drain the retained buffer. This
   fallback limits damage, but it no longer masquerades as successful
   durability.

The chat coordinator already catches rejected flush promises and logs
`Client tool flush failed`, so terminal settlement will not create an
unhandled rejection or start a continuation run.

## Error Handling

- **Empty buffer:** resolve without requiring persistence.
- **Missing persistence with staged results:** reject with a configuration
  error and retain every staged result.
- **Configured persistence rejects:** retain the existing behavior: warn,
  re-stage the owned batch, and allow a later flush or submit to retry it.
- **Thread switch:** retain the existing generation and retired-tool-call
  guards; this change must not re-stage results onto another thread.

The configured-persistence failure behavior is intentionally out of scope. It
has different retry and observability trade-offs from the deterministic
missing-capability error.

## Alternatives Rejected

### Reject at agent construction

Failing whenever a custom transport omits `updateState()` would reject valid
agents that never use terminal client tools. The error should occur only when
durability is actually requested for staged data.

### Start a continuation run automatically

Submitting the buffered results would contradict `followUp: false`, user-stop,
and continuation-limit semantics. `flush()` must never start a run.

### Warn and resolve

A warning preserves the false success signal. Callers awaiting `flush()` need
an observable failure to distinguish durable state from volatile fallback
state.

## Testing

### Capability tests

- A staged result plus no persistence function rejects with the configuration
  error.
- The rejected flush leaves the complete buffer available to
  `drainToolMessages()`.
- No persistence function plus an empty buffer still resolves.
- Existing successful, failed, concurrent, and thread-switch flush tests remain
  green.

### Agent wiring test

An agent using a custom transport without `updateState()` rejects `flush()`
after settlement and still drains that result into the next ordinary submit.
This verifies the public adapter seam rather than only the internal factory.

### Documentation

Update the client-tools guide to state that terminal settlement rejects when a
custom LangGraph transport cannot persist results, while the next-submit
fallback remains available if the application chooses to recover.

## Out of Scope

- Changing the `ClientToolsCapability` type or adding a public error class.
- Changing AG-UI, whose settlement path is already durable.
- Changing how configured persistence failures are logged or propagated.
- Fixing the separate destructive-drain behavior when `submit()` fails.
