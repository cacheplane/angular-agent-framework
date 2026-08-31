# Prompt: meeting scheduler copilot on AWS Strands

Build a Strands agent exposed over AG-UI:

- Use Strands' native OpenAI model provider (`OpenAIModel` on
  `OPENAI_API_KEY`) — no AWS credentials.
- Add a plain backend tool (`check_availability`) that executes
  server-side without pausing.
- Make `book_meeting` a context tool that parks in
  `tool_context.interrupt(...)`; the AG-UI bridge signals it as a
  protocol-standard `RUN_FINISHED` interrupt outcome and resumes from the
  client's top-level `resume` entries keyed by `interruptId`.
- Wrap the agent in `StrandsAgent` with a `StrandsAgentConfig` whose
  per-tool `ToolBehavior` hooks (`state_from_result`, `state_from_args`)
  emit shared frontend state. The bridge is SNAPSHOT-only — every hook
  must return the COMPLETE state object, never a partial one.
- Mount with `add_strands_fastapi_endpoint(app, agent, "/agent")`.
- Do not add multi-agent routes or a subagents surface — delegation has no
  ACTIVITY mapping in this bridge.
