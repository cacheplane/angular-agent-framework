# examples/ag-ui (LangGraph): subagent wire capture + emitter-seam decision

Evidence for migrating this demo's research subagent from the private
ACTIVITY convention (`ACTIVITY_SNAPSHOT`/`ACTIVITY_DELTA` with `activityType:
"subagent"`) to the protocol's standard `SUBAGENT_*` events plus
`subagentRunId`-attributed `TEXT_MESSAGE_*` / `TOOL_CALL_*` events. Captured
2026-09-02 against the live backend (`src/server.py`, `uv run uvicorn
src.server:app --port 8000`, real `OPENAI_API_KEY`, `gpt-5-mini` for the
orchestrator and the research child) with `ag-ui-langgraph 0.0.40` and
`ag-ui-protocol 0.1.22` (bumped in the same commit as this doc; the previous
transitive pin was 0.1.19).

This demo is the richer fork of `cockpit/ag-ui/subagents`: the child is a
compiled LangGraph subgraph running a reason → `lookup` tool → answer loop, so
the transcript has two assistant turns and one child tool call (the flat
cockpit variant has one turn and no tools). The cockpit capture lives at
`cockpit/ag-ui/subagents/python/docs/wire-capture-subagents.md`; this doc
records only what differs.

Bridge citations are into the installed venv source:
`.venv/lib/python3.12/site-packages/ag_ui_langgraph/agent.py` and
`.venv/lib/python3.12/site-packages/ag_ui/core/events.py`.

## 1. SDK check

```
$ uv run python -c "from ag_ui.core import SubagentStartedEvent, TextMessageContentEvent, ToolCallStartEvent, ToolCallResultEvent; print(TextMessageContentEvent.model_fields['subagent_run_id']); print(list(ToolCallStartEvent.model_fields)); print(list(ToolCallResultEvent.model_fields))"
annotation=Union[str, NoneType] required=False default=None alias='subagentRunId' alias_priority=1
['metadata', 'type', 'timestamp', 'raw_event', 'tool_call_id', 'tool_call_name', 'parent_message_id', 'subagent_run_id']
['metadata', 'type', 'timestamp', 'raw_event', 'message_id', 'tool_call_id', 'content', 'role', 'subagent_run_id']
```

`ToolCallStartEvent` carries `parent_message_id` + `subagent_run_id`, and
`ToolCallResultEvent` carries `message_id`, `tool_call_id`, `content`, `role`,
`subagent_run_id` — the fields the contract's `tool_call` / `tool_result`
expansions need. `SubagentStartedEvent` exposes `parent_tool_call_id`.

## 2. Baseline (before the emitter)

`RunAgentInput` POSTed to `/agent` (`Accept: text/event-stream`):

```json
{"threadId":"capture-thread-2","runId":"capture-thread-2-run",
 "messages":[{"id":"u1","role":"user","content":"I want an in-depth research deep-dive on Angular signals: history, motivation, and how they compare to zone.js. Dispatch your research subagent (the research tool, subagent_type research) now; do not use search_documents."}],
 "tools":[],"context":[],"state":{},"forwardedProps":{}}
```

(The e2e's bare prompt *"Research Angular signals and summarize"* delegates
under aimock replay, but the live orchestrator answered it with
`search_documents` — the system prompt routes "simple lookups" there and
reserves `research` for "in-depth research". The longer prompt above
delegated on the first attempt.)

Scrubbed capture — line numbers are event indices (1-based) in the SSE
stream; `rawEvent` mirrors are dropped from every line and repetitive runs
are elided with `# [elided: ...]`. No keys or org ids appeared in the stream.

```
1     {"type":"RUN_STARTED","threadId":"capture-thread-2","runId":"capture-thread-2-run"}
3     {"type":"STEP_STARTED","stepName":"generate"}
9     {"type":"TOOL_CALL_START","toolCallId":"call_9n4N3xc350eeejpCUahSoH4v","toolCallName":"research","parentMessageId":"lc_run--01a063d9-03e5-7521-90c4-cc6e84ddf9fa"}
      # [elided: 29 TOOL_CALL_ARGS deltas spelling {"topic":"Angular signals: history, motivation, ...","subagent_type":"research"}]
69    {"type":"TOOL_CALL_END","toolCallId":"call_9n4N3xc350eeejpCUahSoH4v"}
77    {"type":"STEP_FINISHED","stepName":"generate"}
78    {"type":"STEP_STARTED","stepName":"tools"}
80    {"type":"RAW","event":{"event":"on_tool_start","name":"research"}}
82    {"type":"ACTIVITY_SNAPSHOT","messageId":"call_9n4N3xc350eeejpCUahSoH4v","activityType":"subagent","content":{"toolCallId":"call_9n4N3xc350eeejpCUahSoH4v","name":"research","status":"running","messages":[],"toolCalls":[]},"replace":true}
86    {"type":"STEP_FINISHED","stepName":"tools"}
87    {"type":"STEP_STARTED","stepName":"agent"}                      # the CHILD subgraph's node
90    {"type":"ACTIVITY_DELTA", ... "patch":[{"op":"add","path":"/messages/-","value":{"id":"call_9n4N3xc350eeejpCUahSoH4v-0","role":"assistant","content":"","toolCallIds":[]}}]}
93    {"type":"TOOL_CALL_START","toolCallId":"call_fgoFFeLMn9eA1V2voGF8pa2Q","toolCallName":"lookup","parentMessageId":"lc_run--01a063d9-0b11-7b50-95c5-ddf0404f2be9"}   # UNATTRIBUTED — the child's own call, streamed by the bridge as if it were the parent's
      # [elided: 12 TOOL_CALL_ARGS deltas for lookup]
120   {"type":"TOOL_CALL_END","toolCallId":"call_fgoFFeLMn9eA1V2voGF8pa2Q"}
124   {"type":"ACTIVITY_DELTA", ... "patch":[{"op":"add","path":"/toolCalls/-","value":{"id":"call_fgoFFeLMn9eA1V2voGF8pa2Q","name":"lookup","args":{"query":"Angular signals history m..."},"status":"running"}},{"op":"add","path":"/messages/0/toolCallIds/-","value":"call_fgoFFeLMn9eA1V2voGF8pa2Q"}]}
130   {"type":"STEP_FINISHED","stepName":"agent"}
131   {"type":"STEP_STARTED","stepName":"tools"}
134   {"type":"RAW","event":{"event":"on_tool_start","name":"lookup"}}
135   {"type":"RAW","event":{"event":"on_tool_end","name":"lookup"}}
137   {"type":"ACTIVITY_DELTA", ... "patch":[{"op":"replace","path":"/toolCalls/0/status","value":"complete"},{"op":"replace","path":"/toolCalls/0/result","value":"Angular signals are ..."}]}
141   {"type":"STEP_FINISHED","stepName":"tools"}
142   {"type":"STEP_STARTED","stepName":"agent"}
146   {"type":"ACTIVITY_DELTA", ... "patch":[{"op":"add","path":"/messages/-","value":{"id":"call_9n4N3xc350eeejpCUahSoH4v-1","role":"assistant","content":"","toolCallIds":[]}}]}
150   {"type":"TEXT_MESSAGE_START","messageId":"lc_run--01a063d9-195b-7dc2-9a29-2e20f8b34638","role":"assistant"}   # UNATTRIBUTED — the child's answer, streamed by the bridge into the PARENT transcript
153   {"type":"ACTIVITY_DELTA", ... "patch":[{"op":"replace","path":"/messages/1/content","value":"-"}]}
      # [elided: 343 more (TEXT_MESSAGE_CONTENT + RAW + RAW on_custom_event + ACTIVITY_DELTA) quads — each ACTIVITY_DELTA carries the FULL accumulated text ("- What", "- What signals", ...): 306,482 bytes of `value` across 344 deltas for a 1,810-char answer]
1525  {"type":"ACTIVITY_DELTA", ... "patch":[{"op":"replace","path":"/messages/1/content","value":"<all 1,810 chars>"}]}
1530  {"type":"TEXT_MESSAGE_END","messageId":"lc_run--01a063d9-195b-7dc2-9a29-2e20f8b34638"}
1537  {"type":"STEP_FINISHED","stepName":"agent"}
1538  {"type":"STEP_STARTED","stepName":"tools"}
1541  {"type":"ACTIVITY_DELTA", ... "patch":[{"op":"replace","path":"/status","value":"complete"}]}
1542  {"type":"RAW","event":{"event":"on_tool_end","name":"research"}}
1543  {"type":"TOOL_CALL_RESULT","messageId":"c5fafb3e-cf02-4ee5-b247-c841b97ec603","toolCallId":"call_9n4N3xc350eeejpCUahSoH4v","content":"- What signals are: a fine-grained reactivity primitive in Angular ..."}
1550  {"type":"STEP_FINISHED","stepName":"tools"}
1551  {"type":"STEP_STARTED","stepName":"generate"}
1557  {"type":"TEXT_MESSAGE_START","messageId":"lc_run--01a063d9-565b-7eb3-a7ac-837d933d2e97","role":"assistant"}
      # [elided: 68 TEXT_MESSAGE_CONTENT deltas — the ORCHESTRATOR's own answer]
1695  {"type":"TEXT_MESSAGE_END","messageId":"lc_run--01a063d9-565b-7eb3-a7ac-837d933d2e97"}
1704  {"type":"STEP_STARTED","stepName":"attach_citations"}
1711  {"type":"STEP_STARTED","stepName":"generate_title"}
1720  {"type":"MESSAGES_SNAPSHOT", ...}   # user, assistant(research call), tool(result), assistant(answer) — the child's lc_run message is NOT in it
1721  {"type":"RUN_FINISHED","threadId":"capture-thread-2","runId":"capture-thread-2-run"}
```

Event tally (1,721 events): 1 RUN_STARTED, 9 STEP_STARTED, 9 STEP_FINISHED,
2 TOOL_CALL_START, 41 TOOL_CALL_ARGS, 2 TOOL_CALL_END, 1 ACTIVITY_SNAPSHOT,
349 ACTIVITY_DELTA, 1 TOOL_CALL_RESULT, 2 TEXT_MESSAGE_START,
412 TEXT_MESSAGE_CONTENT, 2 TEXT_MESSAGE_END, 10 STATE_SNAPSHOT,
2 MESSAGES_SNAPSHOT, 1 RUN_FINISHED, 877 RAW. No CUSTOM (the
`ActivityEmittingAgent` swallowed all 350 `subagent_activity` CUSTOM events
and emitted an ACTIVITY event in each one's place), no SUBAGENT_*, zero
events carrying `subagentRunId`.

RAW breakdown: 469 `on_chat_model_stream`, 350 `on_custom_event`, 16
`on_chain_stream`, 15 `on_chain_start`, 15 `on_chain_end`, 4
`on_chat_model_start`, 4 `on_chat_model_end`, 2 `on_tool_start`, 2
`on_tool_end`.

### 2a. Ordering finding (design §6)

**`TOOL_CALL_START` for `research` precedes the first ACTIVITY event:** START
at 9, ARGS through 68, END at 69, `STEP_FINISHED(generate)` /
`STEP_STARTED(tools)` at 77/78, `on_tool_start` at 80, ACTIVITY_SNAPSHOT at
82. The tool call is fully announced before the tool body runs, and the
delegation window nests between `TOOL_CALL_END` (69) and `TOOL_CALL_RESULT`
(1543) — the same nesting the cockpit lane measured. The reducer's
`parentToolCallId` lookup therefore always finds an already-announced tool
call; the card never renders nameless.

### 2b. The bridge streams the child subgraph unattributed

Unlike the cockpit lane (whose child is a bare `llm.astream` inside the tool
body), this child is a compiled subgraph and `ag-ui-langgraph` streams
subgraphs by default (`forwarded_props.stream_subgraphs`, `agent.py:257`,
`:590-595`). The bridge therefore emits the child's nodes as `STEP_*`
(`agent` / `tools`, 87-141) AND the child's own content as bridge-native,
unattributed events: the `lookup` `TOOL_CALL_START/ARGS/END` (93-120) and the
answer's `TEXT_MESSAGE_START/CONTENT/END` (150-1530, 344 deltas) land in the
PARENT transcript while the run streams. The trailing `MESSAGES_SNAPSHOT`
(1720) omits the child's `lc_run--…` message, so the parent bubble reconciles
after the run — which is why the e2e's "child text must not leak into the
parent bubble" assertion (checked post-finalization) passes today. On the
wire, however, the child's answer is shipped twice: once verbatim as
unattributed `TEXT_MESSAGE_CONTENT` and once accumulated inside
`ACTIVITY_DELTA`.

### 2c. Wire volume

The `SubagentStreamHandler` accumulated `text_so_far` and shipped it in every
`message` event; the transform turned each into a JSON-patch `replace` of the
whole message. 344 deltas carried 306,482 bytes of `value` for a 1,810-char
answer — quadratic in the answer length. The per-token contract (each event
carries only the raw token) makes this linear.

### 2d. Why the 1:1 `_dispatch_event` seam cannot carry the migration

Identical to the cockpit finding: `ActivityEmittingAgent` overrode
`LangGraphAgent._dispatch_event`, which is called inline as `yield
self._dispatch_event(...)` at every yield site — strictly one in / one out.
The standard sequence needs 1:N expansion (`tool_call` → three `TOOL_CALL_*`
events; `finished` → `TEXT_MESSAGE_END` + `SUBAGENT_FINISHED`; the CUSTOM
event itself consumed → zero out), so the seam is `LangGraphAgent.run`, the
async generator the FastAPI endpoint consumes.
