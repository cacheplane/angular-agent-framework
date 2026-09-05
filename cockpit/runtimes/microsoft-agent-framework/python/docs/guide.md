# Runtimes — Microsoft Agent Framework

This example is the first entry on the one-capability-many-runtimes axis
(`cockpit/runtimes/<runtime>/`): the same neutral `Agent` contract and the
same `@threadplane/chat` UI primitives as every other AG-UI example, over a
backend that is genuinely not LangGraph.

## What it demonstrates

| Surface | How |
| --- | --- |
| Messages | Streamed assistant text from `Agent` (agent-framework-core). |
| Tool calls | `lookup_expense_policy` executes server-side, no pause. |
| Shared state | `predict_state_config` streams the `submit_expense` `expense` argument into frontend state (STATE_SNAPSHOT / STATE_DELTA) while the model is still generating it. |
| Interrupts | `submit_expense` has `approval_mode="always_require"`; the bridge finishes the run with the protocol-standard `RUN_FINISHED.outcome = { type: 'interrupt', interrupts: [...] }` and resumes from the client's top-level `resume` entries. |
| Subagents | Not demonstrated — the bridge emits no per-subagent ACTIVITY stream (measured red upstream in the 2026-08-31 runtime matrix). |

The interrupt path never uses the LangGraph bridge's `CUSTOM on_interrupt`
convention; it is the outcome-provenance path added to the reducer and
resume builder in #888/#889/#891.

## Model client

Azure OpenAI is the default: set `AZURE_OPENAI_ENDPOINT`,
`AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_MODEL` (deployment name), and
optionally `AZURE_OPENAI_API_VERSION`. When `AZURE_OPENAI_ENDPOINT` is
absent, the agent falls back to the plain OpenAI client on
`OPENAI_API_KEY` (honoring `OPENAI_BASE_URL`, which is how the aimock e2e
harness intercepts model calls). See `.env.example`.

## Running locally

```sh
npx tsx scripts/examples/serve-example.ts --capability=rt-maf
```

Angular dev server on :4330, uvicorn backend on :5330 (`/agent`, health at
`/ok`).
