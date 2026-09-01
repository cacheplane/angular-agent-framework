# Prompt: camping trip planner on Mastra

Build a Mastra agent exposed over AG-UI:

- Resolve the model through Mastra's model router with the plain string
  `openai/gpt-4o-mini` (honors `OPENAI_API_KEY` and `OPENAI_BASE_URL`) — no
  provider SDK wiring.
- Add a plain backend tool (`check_conditions`, via `createTool`) that
  executes server-side without pausing. Keep it deterministic so e2e
  fixtures stay stable.
- Make `reserve_campsite` a human-in-the-loop tool: give it a
  `suspendSchema`/`resumeSchema` pair and call `suspend(...)` on the first
  invocation; the AG-UI bridge signals it as a `CUSTOM on_interrupt` payload
  followed by the protocol-standard `RUN_FINISHED` interrupt outcome, and
  the resume arrives as `forwardedProps.command = { resume,
  interruptEvent: { toolCallId, runId } }`.
- Give the agent `Memory` with a `workingMemory` schema (`packing_list`)
  backed by file-based `LibSQLStore` storage. Working memory bridges to
  AG-UI shared state as a `STATE_SNAPSHOT` plus real JSON-Patch
  `STATE_DELTA` events. File-backed storage is REQUIRED: suspended-run
  snapshots persist there, and resume loads them back across HTTP requests.
- Upstream `@ag-ui/mastra` ships no plain AG-UI HTTP endpoint, so
  hand-write the hosting service: for each `POST /agent/<topic>` request,
  construct a fresh `MastraAgent` bridge (`resourceId` keyed by the AG-UI
  `threadId`), subscribe to `run(input)`, and write one SSE `data:` frame
  per event. Map Observable errors to a `RUN_ERROR` frame, never a dropped
  socket.
- Do not add a multi-agent surface — Mastra reserves `ACTIVITY_*` events
  for background tasks, so delegation has no per-subagent stream.
