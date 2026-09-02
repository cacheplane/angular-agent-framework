# Strands agents-as-tools: wire capture + emitter-seam decision

Task 0 spike evidence for translating Strands agents-as-tools delegation into
AG-UI `SUBAGENT_*` events. Captured 2026-09-02 against the live meeting-scheduler
backend (`src/agent.py` + `src/server.py`, bridge pinned to git rev
`363d3878e30887e88c1fd5ca1916ec3a5962b6be`), scratch delegation tool
`research_availability` wrapping a tool-less specialist `Agent(name="availability_researcher")`.
The scratch edit was reverted after capture; only this doc lands.

All bridge citations are into the installed venv source:
`.venv/lib/python3.14/site-packages/ag_ui_strands/` (referred to as `agent.py`
etc. below).

## 1. Seam decision: `ToolBehavior.tool_stream_event_handler` (config-level), not a subclass

**Decision: emit `SUBAGENT_*` from a per-tool `tool_stream_event_handler`
registered in `StrandsAgentConfig.tool_behaviors["research_availability"]`,
with the delegation tool written as an async-generator `@tool` that re-yields
the specialist's `stream_async` events.**

The exact hook point: the bridge's run loop dispatches every
`tool_stream_event` to the tool's registered handler in
`StrandsAgent.run`, `agent.py:4644-4663` — the handler is an async generator
called with a `ToolStreamEventContext` (`config.py:56-91`) and *"may yield zero
or more AG-UI Event objects which are forwarded directly into the top-level
event stream"* (`config.py:76-91`). Registering a handler suppresses the
default routing for that tool (state snapshots at `agent.py:4664-4669`,
agent-as-tool lifecycle forwarding at `agent.py:4670-4682`), so the handler
owns the whole child stream.

Why not the LangGraph lane's dispatch-hook subclass
(`cockpit/ag-ui/subagents/python/src/streaming/activity_emitting_agent.py`
overriding `_dispatch_event`):

- (1b) **A `@tool` body cannot reach an emitter directly, but it does not need
  one.** Strands wraps every value an async-generator tool yields as a
  `tool_stream_event` in the parent stream (`agent.py:4596-4598`), and the
  bridge hands that payload to the per-tool handler with `tool_use_id` and
  `tool_name` attached (`agent.py:4648-4652`). That IS the sanctioned
  tool-body-to-wire channel — no writer/contextvar/queue plumbing, no fork of
  the 5,771-line bridge module.
- The Strands bridge has no `_dispatch_event` seam at all: `StrandsAgent.run`
  (`agent.py:2956` onward) is one ~2,800-line async generator with dozens of
  inline `yield` sites. A subclass would have to wrap the entire generator and
  pattern-match already-serialized events to find the delegation window —
  strictly worse information than the handler gets (raw inner Strands events,
  pre-translation).
- (1a) Strands→AG-UI translation happens inline in that same `run` generator
  (text deltas, `current_tool_use`, `contentBlockStop`, tool results — e.g.
  the `tool_stream_event` branch at `agent.py:4596-4682`, tool results at
  `agent.py:4684+`), then each pydantic event is SSE-serialized by
  `EventEncoder.encode` → `event.model_dump_json(by_alias=True)`
  (`ag_ui/encoder/encoder.py:22-36`), called from the endpoint's
  `event_generator` (`endpoint.py:290-343`).
- (1c) **Unknown raw dicts do NOT pass through.** The encoder requires pydantic
  `BaseEvent` instances (`model_dump_json` call, `encoder.py:36`); a plain dict
  would crash the stream. Unmapped *Strands* events are forwarded only as
  sanitized `RawEvent` payloads (`_sanitize_raw_event`, `agent.py:1089-1125`)
  — and inner-agent payload keys (`data`, `current_tool_use`, ...) are in
  `_RAW_SUPPRESSED_KEYS` (`agent.py:1078-1086`), so nothing from the child
  leaks via RAW either. The handler must therefore yield real
  `ag_ui.core` event objects — which exist, see §2.
- (1d) **`tool_stream_event` from a nested agent-as-tool is forwarded today
  only for the inner TOOL-CALL lifecycle, never for inner text.**
  `_forward_inner_agent_events` (`agent.py:1195-1313`, invoked at
  `agent.py:4677-4682`) translates inner `current_tool_use` /
  `contentBlockStop` / `toolResult` into namespaced `TOOL_CALL_*` events and
  explicitly nothing else ("Only the tool-call lifecycle is forwarded",
  `agent.py:1209`). Inner `{"data": ...}` text deltas fall through every
  branch and are dropped. The live capture in §3 confirms this on the wire.

### Emitter shape (next task)

- Delegation tool: async-generator `@tool` that does
  `async for event in specialist.stream_async(prompt): yield event`, then
  yields the accumulated text as its final value (Strands takes the last
  yielded value as the tool result — confirmed in §3, the `TOOL_CALL_RESULT`
  content is exactly the joined child text).
- Handler on that tool: lazily emits `SubagentStartedEvent`
  (`subagent_run_id=f"{ctx.tool_use_id}-sub"`, `name="availability_researcher"`,
  `parent_tool_call_id=ctx.tool_use_id`) on the first inner event, translates
  inner `{"data": <delta>}` into `TEXT_MESSAGE_START/CONTENT/END` carrying
  `subagent_run_id`, and emits `SubagentFinishedEvent(outcome=success)` when it
  sees the inner terminal `{"result": AgentResult}` event;
  `SubagentErrorEvent` when the inner stream surfaces an error /
  `forceStop`. `ctx.tool_use_id` equals the wire `toolCallId` (the model's
  `call_...` id — §3 line 4 vs. the handler context), so `parentToolCallId`
  lines up with the bridge-native `TOOL_CALL_START` with zero bookkeeping.
- Wire-order nuance: the bridge emits `TOOL_CALL_END` when the *args* finish
  streaming, before the tool executes (§3 line 19). So the shipped order will
  be `TOOL_CALL_START → TOOL_CALL_ARGS → TOOL_CALL_END → SUBAGENT_STARTED →
  TEXT_MESSAGE_* → SUBAGENT_FINISHED → TOOL_CALL_RESULT` — the `SUBAGENT_*`
  block nests inside the tool call's start/result span, not inside
  start/end.

## 2. SDK check

```
$ uv run python -c "import ag_ui.core as c; print([n for n in dir(c) if 'Subagent' in n])"
['SubagentErrorEvent', 'SubagentFinishedEvent', 'SubagentFinishedOutcome',
 'SubagentFinishedSuccessOutcome', 'SubagentFinishedSuspendedOutcome',
 'SubagentStartedEvent']
```

The pinned SDK has first-class subagent events (`ag_ui/core/events.py:455-512`)
with exactly the target fields (`subagent_run_id`, `name`,
`parent_tool_call_id`, `outcome` discriminated union), and every
`TextMessage*` / `ToolCall*` event carries an optional `subagent_run_id`
(`events.py:127-235`). **No raw-dict fallback is needed** — the handler
constructs typed events and the stock encoder serializes them.

## 3. Live captures (scrubbed)

Prompt: *"Find a slot for Ada and Grace next week — research their availability
first"*. The model called `research_availability` on the first attempt in both
runs. No API keys or org ids appeared in either stream; nothing was scrubbed —
only long `MESSAGES_SNAPSHOT` lines and repetitive delta runs are elided, each
marked with a `# [elided: ...]` comment.

### 3a. Async-generator delegation tool (the seam-relevant variant)

The tool re-yielded the specialist's entire `stream_async` output, so every
child event crossed the bridge as `tool_stream_event` — and the wire between
`TOOL_CALL_END` (line 19) and `TOOL_CALL_RESULT` (line 21) still carries
**zero child events**: `_forward_inner_agent_events` dropped every inner text
delta (the child called no tools, so nothing was forwardable). Line numbers
refer to non-blank SSE lines.

```
data: {"type":"RUN_STARTED","threadId":"spike-thread-2","runId":"spike-run-2"}
data: {"type":"STATE_SNAPSHOT","snapshot":{}}
data: {"type":"MESSAGES_SNAPSHOT","messages":[{"id":"u1","role":"user","content":"Find a slot for Ada and Grace next week — research their availability first"}]}
data: {"type":"TOOL_CALL_START","toolCallId":"call_vF6Vc6Wzl40vz9pBZOOrDxS7","toolCallName":"research_availability","parentMessageId":"0130e374-95eb-4a08-aed3-2b6f877331c6"}
data: {"type":"TOOL_CALL_ARGS","toolCallId":"call_vF6Vc6Wzl40vz9pBZOOrDxS7","delta":"{\""}
# [elided: 12 more TOOL_CALL_ARGS deltas spelling {"attendees": "Ada, Grace", "date_range": "next week"}]
data: {"type":"TOOL_CALL_ARGS","toolCallId":"call_vF6Vc6Wzl40vz9pBZOOrDxS7","delta":"\"}"}
data: {"type":"TOOL_CALL_END","toolCallId":"call_vF6Vc6Wzl40vz9pBZOOrDxS7"}
# [elided: MESSAGES_SNAPSHOT mirroring the assistant tool-call message]
# <-- the specialist ran HERE; its interim + final text produced tool_stream_events, none reached the wire
data: {"type":"TOOL_CALL_RESULT","messageId":"2d0594ca-dc44-4c24-841a-1461d55759fc","toolCallId":"call_vF6Vc6Wzl40vz9pBZOOrDxS7","content":"\"To provide a summary of likely availability windows for Ada and Grace for the next week, I will check their schedules. Please hold on for a moment.\\nI actually do not have access to the scheduling information for the attendees. Please provide their typical availability or any specific constraints you might know about them, and I can help you summarize likely availability windows accordingly.\""}
# [elided: MESSAGES_SNAPSHOT adding the tool-result message]
data: {"type":"TEXT_MESSAGE_START","messageId":"51b44583-454d-4252-803a-1f91fa681f5e","role":"assistant"}
data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"51b44583-454d-4252-803a-1f91fa681f5e","delta":"I"}
# [elided: 27 more TEXT_MESSAGE_CONTENT deltas — the ORCHESTRATOR's own summary, after the tool result]
data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"51b44583-454d-4252-803a-1f91fa681f5e","delta":"."}
data: {"type":"TEXT_MESSAGE_END","messageId":"51b44583-454d-4252-803a-1f91fa681f5e"}
# [elided: final MESSAGES_SNAPSHOT]
data: {"type":"STATE_SNAPSHOT","snapshot":{}}
data: {"type":"RUN_FINISHED","threadId":"spike-thread-2","runId":"spike-run-2","outcome":{"type":"success"}}
```

Event tally: 1 RUN_STARTED, 2 STATE_SNAPSHOT, 4 MESSAGES_SNAPSHOT,
1 TOOL_CALL_START, 14 TOOL_CALL_ARGS, 1 TOOL_CALL_END, 1 TOOL_CALL_RESULT,
1 TEXT_MESSAGE_START, 29 TEXT_MESSAGE_CONTENT, 1 TEXT_MESSAGE_END,
1 RUN_FINISHED. No SUBAGENT_*, no RAW, no CUSTOM, no STEP_*.

### 3b. Plain sync delegation tool (the naive idiom)

Same prompt, tool body `result = availability_researcher(...); return str(result)`.
Identical wire shape: `TOOL_CALL_START/ARGS×14/END → MESSAGES_SNAPSHOT →
TOOL_CALL_RESULT` (child's full multi-paragraph answer as one string) `→
MESSAGES_SNAPSHOT → TEXT_MESSAGE_*` (orchestrator summary) `→ RUN_FINISHED
success`. A sync tool yields nothing mid-flight, so no `tool_stream_event`
fires at all — the child is a black box by construction, and this variant can
never feed a subagent emitter. (Capture withheld here as it adds nothing over
3a; tally: 24 TEXT_MESSAGE_CONTENT, otherwise identical event mix.)

## 4. Did child tokens appear on the wire?

**No — in neither variant.** During the delegation call the stream goes
straight from `TOOL_CALL_END` (§3a line 19) to `TOOL_CALL_RESULT` (§3a line
21) with only a `MESSAGES_SNAPSHOT` between. The specialist's interim sentence
("To provide a summary ... Please hold on for a moment.") exists in the run —
it surfaces verbatim *inside* the final `TOOL_CALL_RESULT` content — proving
the child streamed internally and the bridge dropped the deltas
(`_forward_inner_agent_events` forwards tool-call lifecycle only,
`agent.py:1195-1313`). Natively, delegation is: parent tool-call args stream →
silence → one opaque result string. This is the matrix cell the emitter fixes:
child tokens must be re-emitted by our `tool_stream_event_handler` as
`TEXT_MESSAGE_*` events carrying `subagentRunId`.

## 5. Other observations

- Restreaming the child through the generator tool logs repeated
  `ValueError: <Token var=<ContextVar name='current_context' ...> was created
  in a different Context` server-side (OTel context tokens crossing task
  boundaries; cosmetic with OTel disabled, but worth watching once the real
  emitter lands).
- `RunAgentInput` requires `threadId`, `runId`, `messages`, `tools`,
  `context`, `forwardedProps` (camelCase; `ag_ui/core/types.py:396-412`);
  the endpoint validates with `model_validate` and 422s otherwise
  (`endpoint.py:55-86`).
- `emit_messages_snapshot` (on by default) interleaves full
  `MESSAGES_SNAPSHOT`s after every tool END/RESULT and TEXT_MESSAGE_END —
  the future emitter must not splice subagent messages into those snapshots
  (mirroring `_forward_inner_agent_events`' deliberate choice,
  `agent.py:1209-1211`).
