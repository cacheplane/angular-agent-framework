# Runtimes — Mastra

Third entry on the one-capability-many-runtimes axis
(`cockpit/runtimes/<runtime>/`): the same neutral `Agent` contract and the
same `@threadplane/chat` UI primitives as every other AG-UI example, over a
backend that is genuinely not LangGraph — and, uniquely on this axis, not
Python either.

## What it demonstrates

| Surface | How |
| --- | --- |
| Messages | Streamed assistant text (`TEXT_MESSAGE_CHUNK`) from a Mastra `Agent` via the `@ag-ui/mastra` bridge. |
| Tool calls | `check_conditions` executes server-side, no pause. |
| Shared state | Working memory bridged honestly: the agent's `packing_list` working-memory schema streams as a `STATE_SNAPSHOT` plus real JSON-Patch `STATE_DELTA` events while the agent updates the list (measured in the spike's 04a capture) — the only runtime on this axis that emits deltas. |
| Interrupts | `reserve_campsite` suspends the run via its `suspendSchema`/`resumeSchema` pair; the bridge emits a `CUSTOM on_interrupt` payload (`{ toolCallId, toolName, suspendPayload, runId }`) followed by the protocol-standard `RUN_FINISHED.outcome = { type: 'interrupt', interrupts: [...] }`. The adapter resumes with the Mastra wire shape `forwardedProps.command = { resume, interruptEvent: { toolCallId, runId } }`. |
| Subagents | Not demonstrated — upstream reserves `ACTIVITY_*` events for background tasks, so delegation has no per-subagent stream (measured red in the 2026-08-31 runtime matrix). |

Unlike the Python-lane runtimes, the interrupt path here does use a `CUSTOM
on_interrupt` event — it is the one convention the Mastra bridge shares with
the LangGraph bridge — but the run still finishes with the outcome-provenance
`RUN_FINISHED` shape added in #888/#889/#891, so the reducer treats all three
runtimes identically.

Suspend/resume REQUIRES persistent storage: Mastra writes suspended-run
snapshots to LibSQL file storage and resume loads them back, so an in-memory
store would orphan every pending approval across HTTP requests.

## The hosting service (Node lane)

Upstream `@ag-ui/mastra` ships no plain AG-UI HTTP endpoint — only the
in-process `MastraAgent` bridge and a mount for its own chat frontend
runtime. The backend is therefore the hand-written Node service
`deployments/ag-ui-mastra/`:
`server.mjs` subscribes to `MastraAgent.run(input)` (the raw AG-UI event
Observable) and encodes each event as one SSE `data:` frame — exactly what
`@ag-ui/client`'s `HttpAgent` consumes. It mirrors the Python lane's
behavior contract (`GET /ok` unauthenticated, `X-Internal-Token` on every
other route, topics at `POST /agent/<topic>`, Observable errors mapped to a
`RUN_ERROR` frame). The agent itself lives in `agents.mjs`, next to the
shim, because there is no per-example Python module to stage into a
generated deployment. This is why `cockpit/runtimes/mastra/` has no
`python/` directory and its assets live in the `angular` lane.

## Model client

Mastra's model router resolves the plain string `openai/gpt-4o-mini` on
`OPENAI_API_KEY` — no provider SDK wiring. `OPENAI_BASE_URL` is honored,
which is how the aimock e2e harness intercepts model calls without a code
fork.

## Running locally

```sh
npx tsx apps/cockpit/scripts/serve-example.ts --capability=rt-mastra
```

Angular dev server on :4332. The serve script only auto-starts Python
backends, so start the Node service manually (see
`deployments/ag-ui-mastra/README.md`):

```sh
cd deployments/ag-ui-mastra && npm ci
AG_UI_INTERNAL_TOKEN=dev-local-token OPENAI_API_KEY=sk-... PORT=5332 node server.mjs
```

The example's dev proxy rewrites `/agent` to
`http://localhost:5332/agent/mastra` and injects the dev token.
