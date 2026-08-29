# Design: Working drift detection for aimock fixtures

**Date:** 2026-08-29
**Status:** approved by Brian (angle, scope, recordings policy, trigger).
**Branch:** `blove/aimock-drift-detection` (independent of the paused fixture-replay blog post on `blove/fixture-replay-post`).

## Why

The existing drift check has never run. `examples/chat/angular/e2e/scripts/drift.ts` shells out to `llmock --record ... --out <path>`, and `--out` is not a declared CLI option (the set is `options, port, host, fixtures, latency, watch, metrics, record, strict`, strict `parseArgs`), so the spawn exits with `ERR_PARSE_ARGS_UNKNOWN_OPTION` before any comparison happens. Two deeper problems sit under that:

1. **A fixture cannot be "re-recorded" in isolation.** An entry is only `match` + `response`; the request that produced it (system prompts, conversation state) is built by the graph at runtime. Fresh responses can only come from driving the real app through aimock's record-proxy.
2. **Byte-size comparison cannot see meaning drift.** A model that returns something equally long and completely different passes the 20% threshold.

There is also a structural constraint discovered during design: the e2e suite mixes **contract assertions** (a fence renders as `<pre><code>`, a tool round completes, the citations panel populates) with **fixture-content assertions** (`toHaveText('3')` on a citation count, cards containing "Signals"). Content assertions encode the canned response and fail against a live model regardless of drift. No re-recording scheme can ever satisfy them. Drift detection must therefore run a **tagged subset**, not the whole suite.

## What drift means (two staged signals)

**Stage 1 — the gate.** A `@drift`-tagged subset of the `examples/chat` e2e suite, containing contract assertions only, runs against the live provider through aimock's record-proxy. Drift = specs we already trust go red against today's model. This catches meaning drift by construction: if the graph's prompts stop eliciting the tool call, or replies stop containing renderable structure, a spec fails. The assertions are the semantic contract; no invented threshold.

**Stage 2 — the diagnostic.** The recordings captured during stage 1 are structurally diffed against the committed fixtures. The diff explains a red run; it is never a gate by itself.

## Scope

`examples/chat` only (approved). It is the canonical demo, the current drift.ts scope, and the suite with the richest assertions. The other 33 apps are explicitly out of scope for v1.

## Components

### 1. `@drift` spec tag

Contract-only specs in `examples/chat/angular/e2e/` get `@drift` in their spec titles; the runner filters with Playwright `--grep @drift`.

First candidates (final list decided at plan time by reading each spec's assertions):
- send-receive: a user message produces a rendered assistant reply.
- markdown-surfaces, structural subset: fenced code renders as `<pre><code>`, lists render as lists.
- research-subagent: the tool round completes and a subagent card appears.
- interrupt-approval: an interrupt is raised and surfaced.

Rule for tagging: an assertion may depend on *shape* (element exists, class present, count > 0), never on *content* (exact text, exact counts tied to a canned response). Untagged specs continue to run only in replay mode.

### 2. Record-mode plumbing

`examples/chat/angular/e2e/aimock-runner.ts` (the app-local copy, not `libs/e2e-harness`) grows `mode: 'record'` alongside `'replay'`. Record mode starts the aimock CLI with flags that actually exist:

```
llmock --record --provider-openai https://api.openai.com --fixtures <tmpdir> --port <p>
```

Unmatched requests proxy through to the real provider and are captured into `<tmpdir>`. The global-setup selects mode from `AIMOCK_MODE` (`record` | unset→`replay`), so the normal suite is untouched. `OPENAI_API_KEY` is required in record mode and the run fails fast with a clear message without it.

### 3. The differ (rewritten `drift.ts`)

Reads the tmpdir recordings and the committed fixtures, pairs entries by match discriminator, and reports structural differences as JSON:
- tool names called (set equality),
- response kind (text vs toolCalls),
- coarse length bucket (order-of-magnitude, to note gross size shifts without pretending precision).

Output feeds the issue body. The differ never fails the run on its own; stage 1's spec results are the gate. Unpairable entries (a recording with no committed counterpart, or vice versa) are reported as such rather than errored — handwritten seeds guarantee some of these at first.

### 4. The workflow (`aimock-drift.yml`)

- Enable weekly `schedule:` cron; keep `workflow_dispatch`. (The workflow comment says to do exactly this "once a phase lands recorded fixtures"; the tagged-subset design removes that precondition because committed fixtures are no longer what is being judged.)
- Run: start the app stack with `AIMOCK_MODE=record`, run Playwright with `--grep @drift`, `retries: 1` (live models are live; one flaky generation should not page anyone).
- On any outcome: upload the recordings tmpdir as a workflow artifact. Committed fixtures are never modified; promoting a recording to a fixture stays a deliberate, reviewed act via the existing `scripts/record-aimock-cap.sh` flow.
- On failure after retry: open an issue with the failing spec names and the differ's JSON summary in the body. Advisory only — never a merge gate.
- Fix the leftover issue-body text that claims "The scheduled fixture drift check failed" regardless of trigger; say which trigger fired.

## Error handling

- Missing `OPENAI_API_KEY` in record mode: fail fast, clear message (matches current behavior).
- Live-model flakiness: Playwright `retries: 1` on the drift run only.
- aimock CLI missing or version-skewed: the spawn error propagates with the executed command line in the message, so the next person debugs the actual invocation (the original bug was invisible partly because the command was buried).

## Testing the tester

- The differ gets a vitest spec with handwritten recorded-vs-committed pairs: same tools, different tools, text-vs-toolCall, unpairable entry.
- Record-mode plumbing is proven by one manual `workflow_dispatch` run before the cron is enabled. **Acceptance for the whole feature: the workflow has produced one green run and one recordings artifact.** The cron lands in the same PR but the PR is not merged until the manual run is green.

## Out of scope (deliberate)

- The other 33 apps.
- Auto-refresh PRs of committed fixtures.
- Semantic / LLM-judge comparison.
- Any change to committed fixtures.
- Gating merges on drift.

## Interaction with the paused blog post

`blove/fixture-replay-post` §5 currently says the drift check has never run and would compare byte size. When this ships, the honest story improves: "the assertions are the drift check." The post gets updated after this lands, before it ships.
