# Mastra sub-agents: installed-API findings and delegation wire capture

Task 0 spike evidence for the Mastra subagent PRs. Captured 2026-09-02 against
the live `deployments/ag-ui-mastra` service (`@mastra/core@1.63.2`,
`@ag-ui/mastra@1.1.2`) with a scratch `weather_forecaster` child agent
registered on the camping-trip supervisor. The scratch changes were reverted;
this document is the only artifact.

## Verdict summary

| Question | Answer |
| --- | --- |
| Sub-agents API present at installed `@mastra/core@1.63.2`? | **Yes** — no version bump needed. |
| Child registration | `agents: { weather_forecaster: childAgent }` on the supervisor's `Agent` config. |
| Delegation hooks | `delegation: { onDelegationStart, onDelegationComplete }` in stream options; works via the supervisor's `defaultOptions` (verified live — both hooks fired). |
| Delegation on the AG-UI wire today | An ordinary backend tool call named `agent-<childKey>`: `TOOL_CALL_START` → one `TOOL_CALL_ARGS` blob → `TOOL_CALL_END` → `TOOL_CALL_RESULT` whose `content` is JSON `{text, subAgentThreadId, subAgentResourceId, subAgentToolResults}`. |
| Does child text stream incrementally anywhere? | **In-process yes, on the wire no.** The parent `fullStream` carries every child chunk wrapped as `tool-output` (`payload: {output: <childChunk>, toolCallId, toolName}`) — 82 inner `text-delta` chunks in the raw tap — but `@ag-ui/mastra`'s chunk processor drops them (`case "tool-output": break`). Only the final text reaches AG-UI, inside `TOOL_CALL_RESULT`. |
| Delegation tool-call id (for `parentToolCallId`) | The LLM's tool-call id (e.g. `call_aUfV9K0RCDZdZK3NWt9dRDKx`). Identical across `TOOL_CALL_START/ARGS/END/RESULT` and both hooks' `toolCallId`. |

## Installed-API details (`node_modules/@mastra/core/dist`)

- **Registration** — `agent/types.d.ts:656` (AgentConfig):
  `agents?: DynamicArgument<Record<string, SubAgent<string, TRequestContext>>>` —
  "Sub-Agents that the agent can access." A plain `Agent` instance satisfies
  `SubAgent` (`agent/subagent.d.ts:42`). Give the child a `description`; it
  becomes the delegation tool's description.
- **Tool naming** — compiled `agent-B8m3ps7U.js:34916/35498/35513`: each child
  becomes a tool `agent-${agentName}` where `agentName` is the key in the
  `agents` record. Its input schema is
  `{prompt, threadId, resourceId, instructions, maxSteps, suspendedToolRunId, resumeData}`.
- **Hook config site** — `agent/agent.types.d.ts` (~line 671 in
  `AgentExecutionOptionsBase`): `delegation?: DelegationConfig` is a
  **per-invocation stream/generate option**, not an `Agent` constructor field.
  Since the AG-UI bridge calls `agent.stream()` without it, set it via the
  supervisor's `defaultOptions: { delegation: {...} }` — verified live that
  the merged defaults fire both hooks. `DelegationConfig`
  (`agent.types.d.ts:294-344`) also offers `messageFilter`,
  `includeSubAgentToolResultsInModelContext`, `hookErrorStrategy`.
- **Hook signatures** (`agent.types.d.ts:61-207`):
  - `onDelegationStart(ctx: DelegationStartContext)` — `primitiveId`,
    `primitiveType: 'agent'|'workflow'`, `prompt`, `params{threadId, resourceId,
    instructions, maxSteps}`, `iteration`, `runId` (the PARENT run id),
    `threadId`, `resourceId`, `parentAgentId`, `parentAgentName`,
    **`toolCallId`** (the LLM tool-call id), `messages`, `requestContext`.
    May return `{proceed, rejectionReason, modifiedPrompt, modifiedInstructions,
    modifiedMaxSteps}`.
  - `onDelegationComplete(ctx: DelegationCompleteContext)` — same identity
    fields plus `result{text, subAgentThreadId, subAgentResourceId,
    finishReason, subAgentToolResults[], usage}`, `duration`, `success`,
    `error?`, `bail()`. May return `{feedback, resultText}`.
  - **Neither hook exposes a child run id.** The only child-run identifiers are
    `subAgentThreadId`/`subAgentResourceId` in the complete-hook result — a
    synthesized `subagentRunId` (`<toolCallId>-sub` or `<runId>-sub`) is
    required.
- **Parent stream chunks during delegation** (`stream/types.d.ts:313-319, 904`):
  every child chunk is forwarded to the parent stream as
  `{type: 'tool-output', payload: {output: <childChunk>, toolCallId, toolName}}`
  (compiled subagent tool execute, `agent-B8m3ps7U.js:35290-35300`:
  `for await (chunk of streamResult.fullStream) context.writer.write(chunk)`).
  The inner `start` chunk even carries the child agent id:
  `output.payload = {id: 'weather_forecaster', messageId: ...}`.
  The `agent-execution-*` / `routing-agent-*` chunk types belong to the
  deprecated AgentNetwork path and never appeared; do not use `.network()`.

## Raw parent-stream tap (direct `agent.stream()`, chunk types observed)

```
start, step-start,
tool-call-input-streaming-start/delta/end (name agent-weather_forecaster),
tool-call            toolName=agent-weather_forecaster toolCallId=call_…
tool-output x266     payload.output.type ∈ {start, step-start, text-start,
                     text-delta(x82), text-end, tool-call, tool-call-delta,
                     tool-call-input-streaming-*, tool-result, step-finish,
                     finish}   ← the ENTIRE child stream, incrementally
tool-result          toolName=agent-weather_forecaster (same toolCallId)
step-start, text-start, text-delta(x43), text-end, step-finish, finish
```

So incremental child text exists at the Mastra layer, keyed to the delegation
`toolCallId` — it is `@ag-ui/mastra` that discards it.

## Live AG-UI SSE capture (scrubbed, capture-2)

Request: `POST /agent/mastra` with
`{"threadId":"t-spike-2","runId":"r-spike-2","messages":[{"role":"user","content":"Plan a trip to Bear Lake this weekend — what will the weather be?"}], ...}`.
Delegated on the first attempt in both runs.

```
data: {"type":"RUN_STARTED","threadId":"t-spike-2","runId":"r-spike-2"}
data: {"type":"TOOL_CALL_START","parentMessageId":"4aca0872-…","toolCallId":"call_aUfV9K0RCDZdZK3NWt9dRDKx","toolCallName":"agent-weather_forecaster"}
data: {"type":"TOOL_CALL_ARGS","toolCallId":"call_aUfV9K0RCDZdZK3NWt9dRDKx","delta":"{\"prompt\":\"What will the weather be like at Bear Lake this weekend?\",\"threadId\":null,\"resourceId\":null,\"instructions\":null,\"maxSteps\":5,\"suspendedToolRunId\":null,\"resumeData\":null}"}
data: {"type":"TOOL_CALL_END","toolCallId":"call_aUfV9K0RCDZdZK3NWt9dRDKx"}
data: {"type":"TOOL_CALL_RESULT","toolCallId":"call_aUfV9K0RCDZdZK3NWt9dRDKx","content":"{\"text\":\"Here's the weather forecast for Bear Lake this weekend:\\n\\n- **Friday**: Mostly sunny…\",\"subAgentThreadId\":\"t-spike-2-f50a7c26-…\",\"subAgentResourceId\":\"t-spike-2-weather_forecaster\",\"subAgentToolResults\":[{\"toolName\":\"updateWorkingMemory\",\"toolCallId\":\"call_rSLW…\",\"result\":{\"success\":true},…}]}","messageId":"70b04476-…","role":"tool"}
data: {"type":"STATE_SNAPSHOT","snapshot":{}}
data: {"type":"STATE_DELTA","delta":[{"op":"add","path":"/packing_list","value":{}}]}   (x3 — child inherited working memory and wrote to it)
data: {"type":"TEXT_MESSAGE_CHUNK","role":"assistant","messageId":"4aca0872-…-agui-text","delta":"The"}   (x26 — the PARENT's own summary, streamed)
…
data: {"type":"STATE_SNAPSHOT","snapshot":{"packing_list":{"title":"","items":[]}}}
data: {"type":"RUN_FINISHED","threadId":"t-spike-2","runId":"r-spike-2","usage":[{…}]}
```

Event-type totals for the run: 1 RUN_STARTED, 1 each TOOL_CALL_START/ARGS/END/
RESULT, 2 STATE_SNAPSHOT, 3 STATE_DELTA, 26 TEXT_MESSAGE_CHUNK, 1 RUN_FINISHED.
Notes:

- `TOOL_CALL_ARGS` arrives as ONE blob, not deltas — the bridge buffers backend
  `tool-call` chunks and flushes start+args+end together. The child's `prompt`
  is therefore readable on the wire before the result.
- The child's final text is embedded in `TOOL_CALL_RESULT.content` (JSON
  string) — no child TEXT_MESSAGE events of any kind today.
- Working-memory injection: with no memory of its own the child inherits the
  supervisor's working-memory tooling (`injectSupervisorMemory`), so it called
  `updateWorkingMemory`; those nested calls appear only in
  `subAgentToolResults`, never as top-level TOOL_CALL_* events.

## Hook payloads (stderr, capture-1 run — same shape every run)

```
[HOOK onDelegationStart] {"primitiveId":"weather_forecaster","primitiveType":"agent",
  "prompt":"What will the weather be like at Bear Lake this weekend?",
  "params":{"threadId":"t-spike-1","resourceId":"t-spike-1","maxSteps":5},
  "iteration":1,"runId":"r-spike-1","threadId":"t-spike-1","resourceId":"t-spike-1",
  "parentAgentId":"mastra","parentAgentName":"mastra",
  "toolCallId":"call_cmS8mH1Up9o5MxKyMmTsYCPU","messages":"<1 messages>"}
[HOOK onDelegationComplete] {"primitiveId":"weather_forecaster","primitiveType":"agent",
  "result":{"text":"Here's the weather forecast…","finishReason":"stop",
    "subAgentThreadId":"t-spike-1-e80e0b3d-…","subAgentResourceId":"t-spike-1-weather_forecaster",
    "subAgentToolResults":[…],"usage":{"inputTokens":1066,"outputTokens":127,…}},
  "duration":4987,"success":true,"iteration":1,"runId":"r-spike-1",
  "toolCallId":"call_cmS8mH1Up9o5MxKyMmTsYCPU",…}
```

The `toolCallId` in both hooks equals the wire tool-call id exactly.

## Emitter wiring decision

Inject the SUBAGENT_* events in **`deployments/ag-ui-mastra/server.mjs`'s
translation loop** — the `sub.run(input).subscribe({ next })` handler
(server.mjs:111-126) — keyed off the AG-UI events themselves, NOT off the
delegation hooks:

1. On `TOOL_CALL_START` with `toolCallName.startsWith('agent-')`: emit
   `SUBAGENT_STARTED { subagentRunId: `${toolCallId}-sub`, name:
   toolCallName.slice('agent-'.length), parentToolCallId: toolCallId }`
   before forwarding the frame, and remember the toolCallId → name mapping.
2. On `TOOL_CALL_RESULT` for a remembered toolCallId: parse `content` JSON,
   emit an attributed `TEXT_MESSAGE_CHUNK` (single final chunk — that is all
   the wire has) carrying `result.text` under the subagent identity, then
   `SUBAGENT_FINISHED { subagentRunId, parentToolCallId }`, then forward (or
   suppress) the TOOL_CALL_RESULT per the target contract.

Rationale:

- The bridge gives the server only the AG-UI Observable; the Mastra chunk
  stream (where `tool-output` child deltas live) is consumed inside
  `@ag-ui/mastra` and dropped there. Recovering incremental child text would
  mean bypassing/forking the bridge (subscribe to `agent.stream()` ourselves
  and re-implement its ~800-line chunk processor) — not worth it for Task 0's
  single-final-chunk contract, but the data provably exists if a later PR
  wants real streaming.
- The delegation hooks (via `defaultOptions` in `agents.mjs`) fire in a
  different async context than the Observable events, with no ordering
  guarantee relative to `res.write` frames — unsafe as the primary emitter
  trigger. They remain available for metadata enrichment (prompt, duration,
  usage, `subAgentToolResults`) if SUBAGENT_FINISHED wants a payload beyond
  ids.
- Everything needed for the target contract is already deterministic on the
  wire: the `agent-` name prefix, the stable `toolCallId`, and the final text
  in `TOOL_CALL_RESULT.content.text`.

## Scratch setup used (reverted)

- Child: `new Agent({ id/name: 'weather_forecaster', description: 'Forecasts
  weather for a campsite and date range…', instructions: '…3-bullet forecast
  summary…', model: 'openai/gpt-4o-mini' })`.
- Supervisor additions: `agents: { weather_forecaster }`,
  `defaultOptions: { delegation: { onDelegationStart, onDelegationComplete } }`
  (hooks logging to stderr), and one instruction line changed to "For questions
  about weather forecasts you MUST delegate to the weather_forecaster agent"
  (the stock instructions force `check_conditions` for weather, which would
  have fought delegation).
