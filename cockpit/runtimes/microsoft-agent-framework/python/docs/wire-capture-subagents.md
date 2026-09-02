# MAF delegation wire capture — subagent pattern decision (Task 0 spike)

Date: 2026-09-02. Live capture against `src/server.py` (uvicorn, port 5330) with the
plain-OpenAI client path (`build_chat_client`, `gpt-4o-mini`). The scratch delegation
code described below was NOT committed; only this document is.

Installed bridge inspected end to end: `agent-framework-ag-ui` 1.2.x in
`.venv/lib/python3.14/site-packages/agent_framework_ag_ui/` (all venv line numbers below
refer to that tree).

## Verdict: Candidate A (agents-as-tools), emitter injects via a run-wrapper merge queue

- **Candidate A works and is observable.** A specialist `Agent` invoked from an async
  function tool streams its updates INTO the tool body in real time (101 streamed
  updates observed in-tool for a ~550-char answer). That is everything the emitter
  needs to synthesize the SUBAGENT_* sequence with streaming child deltas.
- **Candidate B (two-executor workflow) is not needed.** The endpoint does mount
  workflows (`_endpoint.py:137-138` wraps a `Workflow` in `AgentFrameworkWorkflow`),
  so B remains a fallback, but A is simpler and keeps the demo's existing
  approval/predictive-state surfaces untouched.

## Seam analysis (venv file:line)

### (a) Where MAF run events become AG-UI events

- Single entry point: `run_agent_stream` (`agent_framework_ag_ui/_agent_run.py:2259`),
  reached from `AgentFrameworkAgent.run` (`_agent.py:147-166`).
- The wrapped agent is invoked at `_agent_run.py:2723`
  (`response_stream = (a2ui_runner or agent).run(messages, stream=True, **run_kwargs)`);
  updates are pulled at `_agent_run.py:2726` and each content item is converted to
  AG-UI events by `_emit_content` (`_run_common.py:1166`, dispatched from
  `_agent_run.py:2828`). `_emit_content` handles `text`, `function_call`,
  `function_result`, `function_approval_request`, `usage`, reasoning, and MCP content
  types (`_run_common.py:1174-1200`); anything else is dropped with a debug log
  (`_run_common.py:1200`).
- The FastAPI endpoint consumes `protocol_runner.run(input_data)` and encodes each
  yielded event generically (`_endpoint.py:212-242`).

### (b) Can a function tool reach an event emitter/queue/context?

**No.** There is no ContextVar, queue, writer, or middleware hook anywhere in
`agent_framework_ag_ui/*.py` or in `agent_framework/_tools.py` / `_middleware.py` /
`_agents.py` that a tool body could use to inject AG-UI events
(`grep -rn ContextVar` over those modules returns nothing). The event pipeline is a
pure pull-driven async generator; tools execute deep inside the framework's function
invocation loop within `agent.run(stream=True)` and only their return value surfaces
(as `function_result` content → `TOOL_CALL_RESULT`).

**Injection seam (named):** wrap `AgentFrameworkAgent.run` — the exact method the
endpoint calls at `_endpoint.py:212`. Our emitter will be a small subclass (or
compositional wrapper) in the demo:

1. `run()` creates an `asyncio.Queue` and sets a module-level `ContextVar` to it
   before delegating to the inner `run_agent_stream` generator. Because the tool body
   executes on the same async call chain (endpoint → wrapper → `run_agent_stream` →
   `agent.run` → function invocation), the ContextVar value propagates into the tool.
2. The wrapper pumps the inner generator into the same queue from an
   `asyncio.create_task` and yields from the merged queue. This is required for LIVE
   interleaving: while the tool runs, the bridge generator is suspended awaiting the
   next provider update, so a naive "drain queue between inner yields" design would
   batch all child deltas until the tool returns. With the pump-task merge, a
   `queue.put_nowait` from the tool body wakes the outer consumer immediately.
3. The tool body reads the ContextVar and enqueues
   `SubagentStartedEvent {subagentRunId: <toolCallId>-sub, name: "policy_researcher",
   parentToolCallId: <toolCallId>}` → attributed `TextMessageStart/Content×N/End`
   (one delta per specialist update) → `SubagentFinishedEvent success`
   (`SubagentErrorEvent` on exception). The tool's own `toolCallId` is available to
   the body via the framework's function-call content on the update stream; the
   emitter wrapper can also correlate it by observing the preceding
   `TOOL_CALL_START` for the delegation tool on the bridge stream.

This is the same "emit from inside the tool body" shape the Strands PR proved, with
the writer supplied by our own wrapper instead of the runtime (MAF's bridge provides
none). Reference translator: `cockpit/ag-ui/subagents/python/src/streaming/activity_emitting_agent.py`.

### (c) Does the encoder accept ag_ui.core pydantic events generally?

**Yes.** `EventEncoder.encode` takes any `BaseEvent` and does a generic
model-dump → SSE `data:` frame (`ag_ui/encoder/encoder.py`, `encode`/`_encode_sse`);
the endpoint applies it uniformly with no per-type allowlist (`_endpoint.py:224`).
`Subagent*` events are `BaseEvent` subclasses, so they pass through untouched.

SDK check (in this venv):

```
$ uv run python -c "import ag_ui.core as c; print([n for n in dir(c) if 'Subagent' in n])"
['SubagentErrorEvent', 'SubagentFinishedEvent', 'SubagentFinishedOutcome',
 'SubagentFinishedSuccessOutcome', 'SubagentFinishedSuspendedOutcome',
 'SubagentStartedEvent']
```

### (d) What does the bridge do with nested-agent activity inside a tool?

**Nothing is observable.** The specialist's `run(stream=True)` updates are consumed
entirely inside the tool body; the bridge sees only the tool's `function_call`
(streamed as `TOOL_CALL_START/ARGS/END`) and its string return value
(`TOOL_CALL_RESULT`). No ACTIVITY_*, no per-child events, no specialist name on the
wire beyond the delegation tool's own name. This matches the "measured red upstream"
note in `src/agent.py` and is confirmed by the capture below.

## Scratch setup (uncommitted, reverted after capture)

Added to `src/agent.py`: a `policy_researcher` `Agent` (same `build_chat_client()`,
instructions: expense-policy researcher, 3 short bullets) plus an async
`@tool research_policy(category: str, amount: float) -> str` that ran
`specialist.run(prompt, stream=True)`, accumulated `update.text`, logged each update
to stderr, and returned the joined text; registered on the primary agent with one
instruction sentence about delegating policy research.

## In-tool streaming datum

The specialist's deltas DID stream into the tool body, token by token:

```
[spike] specialist update #2: '-'
[spike] specialist update #3: ' **'
[spike] specialist update #4: 'Pre'
...
[spike] specialist DONE: 101 streamed updates, 548 chars   (attempt 2; attempt 1: 106 updates, 582 chars)
```

So the emitter can produce **streaming child deltas** (preferred contract), not just a
single final chunk.

## Live wire capture (attempt 2 of 2; attempt 1 also delegated but was truncated client-side)

Request: POST `/agent` with `threadId: spike-thread-2`, `runId: spike-run-2`, single
user message "Should I submit a $900 conference travel expense? Research the policy
first". The model delegated on the first turn in both attempts. Full event-type
census of the complete stream:

```
1 RUN_STARTED   1 STATE_SNAPSHOT   3 CUSTOM (PredictState, usage×2)
2 TEXT_MESSAGE_START   35 TEXT_MESSAGE_CONTENT   2 TEXT_MESSAGE_END
1 TOOL_CALL_START   9 TOOL_CALL_ARGS   1 TOOL_CALL_END   1 TOOL_CALL_RESULT
1 MESSAGES_SNAPSHOT   1 RUN_FINISHED
0 SUBAGENT_* / ACTIVITY_* / anything child-related
```

Abridged stream (ids as captured; no secrets present):

```
data: {"type":"RUN_STARTED","threadId":"spike-thread-2","runId":"spike-run-2"}
data: {"type":"CUSTOM","name":"PredictState","value":[{"state_key":"expense","tool":"submit_expense","tool_argument":"expense"}]}
data: {"type":"STATE_SNAPSHOT","snapshot":{"expense":{}}}
data: {"type":"TEXT_MESSAGE_START","messageId":"5cff954e-...","role":"assistant"}
data: {"type":"TOOL_CALL_START","toolCallId":"call_7sxPY1sC236nPyHRTWAZMJB9","toolCallName":"research_policy","parentMessageId":"5cff954e-..."}
data: {"type":"TOOL_CALL_ARGS","toolCallId":"call_7sxP...","delta":"{\""}
...   (9 ARGS deltas spelling {"category":"travel","amount":900})
data: {"type":"TOOL_CALL_END","toolCallId":"call_7sxP..."}
      <-- specialist runs HERE; 101 updates streamed in-tool; NOTHING on the wire -->
data: {"type":"TOOL_CALL_RESULT","messageId":"c2c72fd2-...","toolCallId":"call_7sxP...","content":"1. **Pre-Approval Required**: Travel expenses exceeding $500 ...","role":"tool"}
data: {"type":"TEXT_MESSAGE_END","messageId":"5cff954e-..."}
data: {"type":"TEXT_MESSAGE_START","messageId":"534fe3b3-...","role":"assistant"}
data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"534fe3b3-...","delta":"The"}
...   (35 deltas: policy summary + ask to confirm approval)
data: {"type":"TEXT_MESSAGE_END","messageId":"534fe3b3-..."}
data: {"type":"MESSAGES_SNAPSHOT","messages":[...user, assistant toolCalls(research_policy), tool result, assistant text...]}
data: {"type":"RUN_FINISHED","threadId":"spike-thread-2","runId":"spike-run-2"}
```

### Explicit statements

- **Native delegation on the wire:** an ordinary function tool call —
  `TOOL_CALL_START(research_policy)` → streamed `TOOL_CALL_ARGS` → `TOOL_CALL_END` →
  a single `TOOL_CALL_RESULT` carrying the specialist's complete final text. The
  wall-clock gap between `TOOL_CALL_END` and `TOOL_CALL_RESULT` is where the
  specialist runs, silently.
- **Child updates streamed in-tool:** YES — 101 streamed updates (attempt 2; 106 in
  attempt 1), token-granular.
- **Anything child-related on the wire:** NO — zero events; the specialist is
  invisible except as the tool's result string.

## Emitter plan (for the implementation PR)

Target sequence, injected by the wrapper-queue seam around the existing bridge stream
for tool call id `<tid>`:

`SUBAGENT_STARTED {subagentRunId: "<tid>-sub", name: "policy_researcher", parentToolCallId: "<tid>"}`
→ `TEXT_MESSAGE_START/CONTENT×N/END` attributed to the subagent run (one CONTENT per
specialist update; live-interleaved via the pump-task merge) → `SUBAGENT_FINISHED
{outcome: success}` (or `SUBAGENT_ERROR` on tool-body exception), all before the
bridge's own `TOOL_CALL_RESULT` for `<tid>` reaches the client.
