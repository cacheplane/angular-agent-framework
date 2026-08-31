# Runtimes — AWS Strands

Second entry on the one-capability-many-runtimes axis
(`cockpit/runtimes/<runtime>/`): the same neutral `Agent` contract and the
same `@threadplane/chat` UI primitives as every other AG-UI example, over a
backend that is genuinely not LangGraph.

## What it demonstrates

| Surface | How |
| --- | --- |
| Messages | Streamed assistant text from a Strands `Agent`. |
| Tool calls | `check_availability` executes server-side, no pause. |
| Shared state | SNAPSHOT-only, honestly: the Strands bridge never emits STATE_DELTA, and outbound state exists only where a tool opts in via per-tool `ToolBehavior` hooks — `state_from_result` on `check_availability`, `state_from_args` on `book_meeting`. Because snapshots replace the whole state object, every hook returns the COMPLETE state (a partial return would clobber sibling keys). |
| Interrupts | `book_meeting` parks in `tool_context.interrupt(...)`; the bridge finishes the run with the protocol-standard `RUN_FINISHED.outcome = { type: 'interrupt', interrupts: [...] }` and resumes from the client's top-level `resume` entries keyed by `interruptId`. |
| Subagents | Not demonstrated — the bridge routes delegation through CUSTOM MultiAgentHandoff + STEP_* with zero ACTIVITY events (measured red upstream in the 2026-08-31 runtime matrix). Multi-agent routes also crash the stale PyPI wheel (below). |

The interrupt path never uses the LangGraph bridge's `CUSTOM on_interrupt`
convention; it is the outcome-provenance path added to the reducer and
resume builder in #888/#889/#891.

## The bridge pin

PyPI `ag-ui-strands` 0.3.0 is stale: it crashes on multi-agent routes
(`'function' object has no attribute 'model'`, agent.py:927) and predates
the interrupt/resume contract. `pyproject.toml` therefore pins the bridge
to a git ref of `ag-ui-protocol/ag-ui` (subdirectory
`integrations/aws-strands/python`) via `[tool.uv.sources]`, and the
exported requirements carry a `git+https://...#subdirectory=...` line.

## Model client

Strands' native OpenAI provider on plain `OPENAI_API_KEY` — no AWS
credentials involved. `OPENAI_BASE_URL` is honored, which is how the
aimock e2e harness intercepts model calls. `OTEL_SDK_DISABLED=true` is
setdefaulted in `src/agent.py` to silence Strands' collector-less OTEL
exporter noise. See `.env.example`.

## Running locally

```sh
npx tsx apps/cockpit/scripts/serve-example.ts --capability=rt-strands
```

Angular dev server on :4331, uvicorn backend on :5331 (`/agent`, health at
`/ok`).
