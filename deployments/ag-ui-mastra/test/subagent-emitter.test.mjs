// Unit tests for the SUBAGENT_* injector — synthetic AG-UI event sequences,
// exact injected ordering asserted field-for-field against the contract in
// cockpit/runtimes/mastra/angular/docs/wire-capture-subagents.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSubagentInjector } from '../subagent-emitter.mjs';

const TID = 'call_aUfV9K0RCDZdZK3NWt9dRDKx';

function delegationStart(tid = TID) {
  return {
    type: 'TOOL_CALL_START',
    parentMessageId: 'pm-1',
    toolCallId: tid,
    toolCallName: 'agent-weather_forecaster',
  };
}

function delegationResult(content, tid = TID) {
  return {
    type: 'TOOL_CALL_RESULT',
    toolCallId: tid,
    content,
    messageId: 'tm-1',
    role: 'tool',
  };
}

/** Run a whole sequence through one injector, collecting the output frames. */
function transform(events) {
  const injector = createSubagentInjector();
  return events.flatMap((e) => injector.eventsFor(e));
}

test('success path: exact injected sequence, field-for-field', () => {
  const resultContent = JSON.stringify({
    text: 'Here is the forecast:\n- Fri sunny\n- Sat cloudy\n- Sun rain',
    subAgentThreadId: 't-1-abc',
    subAgentResourceId: 't-1-weather_forecaster',
    subAgentToolResults: [],
  });
  const start = delegationStart();
  const args = { type: 'TOOL_CALL_ARGS', toolCallId: TID, delta: '{"prompt":"weather?"}' };
  const end = { type: 'TOOL_CALL_END', toolCallId: TID };
  const result = delegationResult(resultContent);
  const finished = { type: 'RUN_FINISHED', threadId: 't-1', runId: 'r-1' };

  const out = transform([start, args, end, result, finished]);

  assert.deepEqual(out, [
    start,
    {
      type: 'SUBAGENT_STARTED',
      subagentRunId: `${TID}-sub`,
      name: 'weather_forecaster',
      parentToolCallId: TID,
    },
    args,
    end,
    {
      type: 'TEXT_MESSAGE_START',
      messageId: `${TID}-sub-m1`,
      role: 'assistant',
      subagentRunId: `${TID}-sub`,
    },
    {
      type: 'TEXT_MESSAGE_CONTENT',
      messageId: `${TID}-sub-m1`,
      delta: 'Here is the forecast:\n- Fri sunny\n- Sat cloudy\n- Sun rain',
      subagentRunId: `${TID}-sub`,
    },
    {
      type: 'TEXT_MESSAGE_END',
      messageId: `${TID}-sub-m1`,
      subagentRunId: `${TID}-sub`,
    },
    {
      type: 'SUBAGENT_FINISHED',
      subagentRunId: `${TID}-sub`,
      outcome: { type: 'success' },
    },
    result,
    finished,
  ]);
});

test('error result (success:false) → SUBAGENT_ERROR instead of text+finished', () => {
  const result = delegationResult(JSON.stringify({ success: false, error: 'model refused' }));
  const out = transform([delegationStart(), result]);
  assert.deepEqual(out.slice(2), [
    { type: 'SUBAGENT_ERROR', subagentRunId: `${TID}-sub`, message: 'model refused' },
    result,
  ]);
  assert.ok(!out.some((e) => e.type === 'SUBAGENT_FINISHED'));
  assert.ok(!out.some((e) => e.type.startsWith('TEXT_MESSAGE')));
});

test("error result (finishReason:'error') → SUBAGENT_ERROR", () => {
  const result = delegationResult(JSON.stringify({ text: 'partial', finishReason: 'error' }));
  const out = transform([delegationStart(), result]);
  assert.deepEqual(out.slice(2), [
    { type: 'SUBAGENT_ERROR', subagentRunId: `${TID}-sub`, message: 'partial' },
    result,
  ]);
});

test('non-JSON result content falls back to the raw string as the delta', () => {
  const result = delegationResult('plain text answer');
  const out = transform([delegationStart(), result]);
  const content = out.find((e) => e.type === 'TEXT_MESSAGE_CONTENT');
  assert.equal(content.delta, 'plain text answer');
  assert.ok(out.some((e) => e.type === 'SUBAGENT_FINISHED'));
});

test('non-delegation tool calls pass through untouched', () => {
  const events = [
    { type: 'RUN_STARTED', threadId: 't', runId: 'r' },
    { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'check_conditions' },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'c1', delta: '{}' },
    { type: 'TOOL_CALL_END', toolCallId: 'c1' },
    { type: 'TOOL_CALL_RESULT', toolCallId: 'c1', content: '{"forecast":"clear"}' },
    { type: 'TEXT_MESSAGE_CHUNK', messageId: 'm', delta: 'ok' },
    { type: 'RUN_FINISHED', threadId: 't', runId: 'r' },
  ];
  assert.deepEqual(transform(events), events);
});

test('unmatched TOOL_CALL_RESULT (no prior delegation start) is ignored', () => {
  const result = delegationResult('{"text":"orphan"}', 'call_never_started');
  assert.deepEqual(transform([result]), [result]);
});

test('pending delegation at RUN_FINISHED → SUBAGENT_ERROR cleanup before the terminal frame', () => {
  const finished = { type: 'RUN_FINISHED', threadId: 't', runId: 'r' };
  const out = transform([delegationStart(), finished]);
  assert.deepEqual(out.slice(2), [
    {
      type: 'SUBAGENT_ERROR',
      subagentRunId: `${TID}-sub`,
      message: 'delegation did not complete before the run terminated',
    },
    finished,
  ]);
});

// ── chunk() — the stream-tee input (shapes copied from the Task 0 capture) ──

const PARENT_MID = 'b45dfabd-fec1-4072-92db-215f394625a4';
const CHILD_TEXT_ID = 'msg_0dadf9a2c94517c2006a986e0c8ecc87d0b86efe35436a91a4';
const ARGS = {
  prompt: 'What is the weather forecast for Bear Lake this weekend?',
  threadId: null,
  resourceId: null,
  instructions: null,
  maxSteps: 5,
  suspendedToolRunId: null,
  resumeData: null,
};

const startChunk = { type: 'start', runId: 'r', payload: { messageId: PARENT_MID } };
const stepStartChunk = { type: 'step-start', runId: 'r', payload: { messageId: PARENT_MID } };
function toolCallChunk(tid = TID, toolName = 'agent-weather_forecaster', args = ARGS) {
  return { type: 'tool-call', runId: 'r', payload: { toolCallId: tid, toolName, args } };
}
function toolOutput(output, tid = TID) {
  return {
    type: 'tool-output',
    runId: 'r',
    payload: { output, toolCallId: tid, toolName: 'agent-weather_forecaster' },
  };
}
const childTextStart = toolOutput({ type: 'text-start', payload: { id: CHILD_TEXT_ID } });
const childDelta = (text) => toolOutput({ type: 'text-delta', payload: { id: CHILD_TEXT_ID, text } });
const childTextEnd = toolOutput({ type: 'text-end', payload: { id: CHILD_TEXT_ID } });
function toolResultChunk(result, tid = TID) {
  return {
    type: 'tool-result',
    runId: 'r',
    payload: { toolCallId: tid, toolName: 'agent-weather_forecaster', result },
  };
}
const SUCCESS_RESULT = {
  text: "Here's the weather",
  subAgentThreadId: 't-1-abc',
  subAgentResourceId: 't-1-weather_forecaster',
  subAgentToolResults: [],
};

const SUB = `${TID}-sub`;
const M1 = `${TID}-sub-m1`;
const eagerToolCall = [
  { type: 'TOOL_CALL_START', parentMessageId: PARENT_MID, toolCallId: TID, toolCallName: 'agent-weather_forecaster' },
  { type: 'TOOL_CALL_ARGS', toolCallId: TID, delta: JSON.stringify(ARGS) },
  { type: 'TOOL_CALL_END', toolCallId: TID },
  { type: 'SUBAGENT_STARTED', subagentRunId: SUB, name: 'weather_forecaster', parentToolCallId: TID },
];

test('chunk: agent-* tool-call → eager TOOL_CALL_START/ARGS/END + SUBAGENT_STARTED (parentMessageId from step-start)', () => {
  const injector = createSubagentInjector();
  assert.deepEqual(injector.chunk(startChunk), []);
  assert.deepEqual(injector.chunk(stepStartChunk), []);
  assert.deepEqual(injector.chunk(toolCallChunk()), eagerToolCall);
});

test('chunk: parentMessageId tracks the LAST start/step-start chunk', () => {
  const injector = createSubagentInjector();
  injector.chunk(startChunk);
  injector.chunk({ type: 'step-start', payload: { messageId: 'later-mid' } });
  const [start] = injector.chunk(toolCallChunk());
  assert.equal(start.parentMessageId, 'later-mid');
});

test('chunk: tool-output text-start/delta/end → attributed TEXT_MESSAGE_START/CONTENT/END', () => {
  const injector = createSubagentInjector();
  injector.chunk(stepStartChunk);
  injector.chunk(toolCallChunk());
  assert.deepEqual(injector.chunk(childTextStart), [
    { type: 'TEXT_MESSAGE_START', messageId: M1, role: 'assistant', subagentRunId: SUB },
  ]);
  assert.deepEqual(injector.chunk(childDelta("Here's")), [
    { type: 'TEXT_MESSAGE_CONTENT', messageId: M1, delta: "Here's", subagentRunId: SUB },
  ]);
  assert.deepEqual(injector.chunk(childDelta(' the')), [
    { type: 'TEXT_MESSAGE_CONTENT', messageId: M1, delta: ' the', subagentRunId: SUB },
  ]);
  assert.deepEqual(injector.chunk(childTextEnd), [
    { type: 'TEXT_MESSAGE_END', messageId: M1, subagentRunId: SUB },
  ]);
});

test('chunk: lazy TEXT_MESSAGE_START when the child omits text-start; empty deltas skipped', () => {
  const injector = createSubagentInjector();
  injector.chunk(stepStartChunk);
  injector.chunk(toolCallChunk());
  assert.deepEqual(injector.chunk(childDelta('')), []);
  assert.deepEqual(injector.chunk(childDelta('Hi')), [
    { type: 'TEXT_MESSAGE_START', messageId: M1, role: 'assistant', subagentRunId: SUB },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: M1, delta: 'Hi', subagentRunId: SUB },
  ]);
});

test('chunk: inner non-text child chunks are ignored', () => {
  const injector = createSubagentInjector();
  injector.chunk(stepStartChunk);
  injector.chunk(toolCallChunk());
  for (const inner of [
    { type: 'start', payload: { id: 'weather_forecaster', messageId: 'c-mid' } },
    { type: 'step-start', payload: { messageId: 'c-mid' } },
    { type: 'tool-call-input-streaming-start', payload: { toolName: 'updateWorkingMemory' } },
    { type: 'tool-call', payload: { toolCallId: 'inner-1', toolName: 'updateWorkingMemory', args: {} } },
    { type: 'tool-result', payload: { toolCallId: 'inner-1', toolName: 'updateWorkingMemory', result: {} } },
    { type: 'step-finish', payload: { messageId: 'c-mid' } },
    { type: 'finish', payload: { messageId: 'c-mid' } },
  ]) {
    assert.deepEqual(injector.chunk(toolOutput(inner)), [], inner.type);
  }
  // An inner step-start must NOT move the parent's parentMessageId.
  const [start] = injector.chunk(toolCallChunk('call_second'));
  assert.equal(start.parentMessageId, PARENT_MID);
});

test('chunk: tool-result after deltas → close message + SUBAGENT_FINISHED (no fallback text)', () => {
  const injector = createSubagentInjector();
  injector.chunk(stepStartChunk);
  injector.chunk(toolCallChunk());
  injector.chunk(childTextStart);
  injector.chunk(childDelta('Hi'));
  // No text-end arrived: the result must close the open message first.
  assert.deepEqual(injector.chunk(toolResultChunk(SUCCESS_RESULT)), [
    { type: 'TEXT_MESSAGE_END', messageId: M1, subagentRunId: SUB },
    { type: 'SUBAGENT_FINISHED', subagentRunId: SUB, outcome: { type: 'success' } },
  ]);
});

test('chunk: tool-result with text-end already seen → SUBAGENT_FINISHED only', () => {
  const injector = createSubagentInjector();
  injector.chunk(stepStartChunk);
  injector.chunk(toolCallChunk());
  injector.chunk(childTextStart);
  injector.chunk(childDelta('Hi'));
  injector.chunk(childTextEnd);
  assert.deepEqual(injector.chunk(toolResultChunk(SUCCESS_RESULT)), [
    { type: 'SUBAGENT_FINISHED', subagentRunId: SUB, outcome: { type: 'success' } },
  ]);
});

test('chunk: tool-result with NO deltas observed → single-chunk fallback from result.text', () => {
  const injector = createSubagentInjector();
  injector.chunk(stepStartChunk);
  injector.chunk(toolCallChunk());
  assert.deepEqual(injector.chunk(toolResultChunk(SUCCESS_RESULT)), [
    { type: 'TEXT_MESSAGE_START', messageId: M1, role: 'assistant', subagentRunId: SUB },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: M1, delta: "Here's the weather", subagentRunId: SUB },
    { type: 'TEXT_MESSAGE_END', messageId: M1, subagentRunId: SUB },
    { type: 'SUBAGENT_FINISHED', subagentRunId: SUB, outcome: { type: 'success' } },
  ]);
});

test('chunk: failed tool-result → close message + SUBAGENT_ERROR', () => {
  const injector = createSubagentInjector();
  injector.chunk(stepStartChunk);
  injector.chunk(toolCallChunk());
  injector.chunk(childDelta('partial'));
  assert.deepEqual(injector.chunk(toolResultChunk({ text: 'partial', finishReason: 'error' })), [
    { type: 'TEXT_MESSAGE_END', messageId: M1, subagentRunId: SUB },
    { type: 'SUBAGENT_ERROR', subagentRunId: SUB, message: 'partial' },
  ]);
  const injector2 = createSubagentInjector();
  injector2.chunk(toolCallChunk());
  assert.deepEqual(injector2.chunk(toolResultChunk({ success: false, error: 'model refused' })), [
    { type: 'SUBAGENT_ERROR', subagentRunId: SUB, message: 'model refused' },
  ]);
});

test('chunk: tool-error for a tracked id → close message + SUBAGENT_ERROR', () => {
  const injector = createSubagentInjector();
  injector.chunk(toolCallChunk());
  injector.chunk(childDelta('x'));
  assert.deepEqual(
    injector.chunk({ type: 'tool-error', payload: { toolCallId: TID, toolName: 'agent-weather_forecaster', error: new Error('boom') } }),
    [
      { type: 'TEXT_MESSAGE_END', messageId: M1, subagentRunId: SUB },
      { type: 'SUBAGENT_ERROR', subagentRunId: SUB, message: 'boom' },
    ],
  );
});

test('chunk: tool-call-suspended for a tracked id → close message + SUBAGENT_FINISHED{suspended}', () => {
  const injector = createSubagentInjector();
  injector.chunk(stepStartChunk);
  injector.chunk(toolCallChunk());
  injector.chunk(childDelta('thinking'));
  assert.deepEqual(
    injector.chunk({
      type: 'tool-call-suspended',
      payload: { toolCallId: TID, toolName: 'agent-weather_forecaster', suspendPayload: {}, runId: 'r' },
    }),
    [
      { type: 'TEXT_MESSAGE_END', messageId: M1, subagentRunId: SUB },
      { type: 'SUBAGENT_FINISHED', subagentRunId: SUB, outcome: { type: 'suspended' } },
    ],
  );
  // Suspended is terminal for the card: RUN_FINISHED must not error it.
  const finished = { type: 'RUN_FINISHED', threadId: 't', runId: 'r', outcome: { type: 'interrupt' } };
  assert.deepEqual(injector.eventsFor(finished), [finished]);
});

test('chunk: non-agent tool-calls and untracked tool-output/tool-result are untouched', () => {
  const injector = createSubagentInjector();
  injector.chunk(stepStartChunk);
  assert.deepEqual(injector.chunk(toolCallChunk('c1', 'check_conditions', { location: 'x' })), []);
  assert.deepEqual(injector.chunk(toolOutput({ type: 'text-delta', payload: { text: 'nope' } }, 'c1')), []);
  assert.deepEqual(injector.chunk(toolResultChunk({ forecast: 'clear' }, 'c1')), []);
  // Parent-level text chunks are the bridge's job.
  assert.deepEqual(injector.chunk({ type: 'text-delta', payload: { text: 'parent' } }), []);
  assert.deepEqual(injector.chunk({ type: 'finish', payload: {} }), []);
});

test('eventsFor: bridge copies of a synthesized TOOL_CALL_START/ARGS/END are dropped; RESULT passes through', () => {
  const injector = createSubagentInjector();
  injector.chunk(stepStartChunk);
  injector.chunk(toolCallChunk());
  injector.chunk(childTextStart);
  injector.chunk(childDelta('Hi'));
  injector.chunk(childTextEnd);
  injector.chunk(toolResultChunk(SUCCESS_RESULT));
  // The bridge flushes its buffered copy AFTER the tool-result chunk.
  assert.deepEqual(injector.eventsFor(delegationStart()), []);
  assert.deepEqual(injector.eventsFor({ type: 'TOOL_CALL_ARGS', toolCallId: TID, delta: '{}' }), []);
  assert.deepEqual(injector.eventsFor({ type: 'TOOL_CALL_END', toolCallId: TID }), []);
  const result = delegationResult(JSON.stringify(SUCCESS_RESULT));
  assert.deepEqual(injector.eventsFor(result), [result], 'no second SUBAGENT_* / TEXT_MESSAGE_* synthesis');
  const finished = { type: 'RUN_FINISHED', threadId: 't', runId: 'r' };
  assert.deepEqual(injector.eventsFor(finished), [finished]);
});

test('end-to-end interleave: exact wire order for one streamed delegation', () => {
  const injector = createSubagentInjector();
  const out = [];
  const chunkThenBridge = (chunk, bridgeEvents = []) => {
    out.push(...injector.chunk(chunk));
    for (const e of bridgeEvents) out.push(...injector.eventsFor(e));
  };
  const runStarted = { type: 'RUN_STARTED', threadId: 't', runId: 'r' };
  out.push(...injector.eventsFor(runStarted));
  chunkThenBridge(startChunk);
  chunkThenBridge(stepStartChunk);
  chunkThenBridge(toolCallChunk()); // bridge buffers; emits nothing
  chunkThenBridge(childTextStart);
  chunkThenBridge(childDelta('A'));
  chunkThenBridge(childDelta('B'));
  chunkThenBridge(childTextEnd);
  const result = delegationResult(JSON.stringify(SUCCESS_RESULT));
  chunkThenBridge(toolResultChunk(SUCCESS_RESULT), [
    delegationStart(),
    { type: 'TOOL_CALL_ARGS', toolCallId: TID, delta: JSON.stringify(ARGS) },
    { type: 'TOOL_CALL_END', toolCallId: TID },
    result,
  ]);
  const parentText = { type: 'TEXT_MESSAGE_CHUNK', messageId: 'x', delta: 'ok' };
  chunkThenBridge({ type: 'text-delta', payload: { text: 'ok' } }, [parentText]);
  const finished = { type: 'RUN_FINISHED', threadId: 't', runId: 'r' };
  chunkThenBridge({ type: 'finish', payload: {} }, [finished]);

  assert.deepEqual(out, [
    runStarted,
    ...eagerToolCall,
    { type: 'TEXT_MESSAGE_START', messageId: M1, role: 'assistant', subagentRunId: SUB },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: M1, delta: 'A', subagentRunId: SUB },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: M1, delta: 'B', subagentRunId: SUB },
    { type: 'TEXT_MESSAGE_END', messageId: M1, subagentRunId: SUB },
    { type: 'SUBAGENT_FINISHED', subagentRunId: SUB, outcome: { type: 'success' } },
    result,
    parentText,
    finished,
  ]);
  assert.equal(out.filter((e) => e.type === 'TOOL_CALL_START').length, 1);
});

test('terminal cleanup closes an open child message before SUBAGENT_ERROR, exactly once', () => {
  const injector = createSubagentInjector();
  injector.chunk(stepStartChunk);
  injector.chunk(toolCallChunk());
  injector.chunk(childDelta('half'));
  const out = injector.eventsFor({ type: 'RUN_ERROR', message: 'boom' });
  assert.deepEqual(out, [
    { type: 'TEXT_MESSAGE_END', messageId: M1, subagentRunId: SUB },
    { type: 'SUBAGENT_ERROR', subagentRunId: SUB, message: 'delegation did not complete before the run terminated' },
    { type: 'RUN_ERROR', message: 'boom' },
  ]);
  assert.deepEqual(injector.eventsFor({ type: 'RUN_FINISHED' }), [{ type: 'RUN_FINISHED' }]);
});

test('two sequential delegations get distinct message ids and independent state', () => {
  const injector = createSubagentInjector();
  injector.chunk(stepStartChunk);
  injector.chunk(toolCallChunk('call_a'));
  injector.chunk(childDelta('a1'));
  injector.chunk(toolResultChunk(SUCCESS_RESULT, 'call_a'));
  injector.chunk(toolCallChunk('call_b'));
  const out = injector.chunk(toolOutput({ type: 'text-delta', payload: { text: 'b1' } }, 'call_b'));
  assert.deepEqual(out, [
    { type: 'TEXT_MESSAGE_START', messageId: 'call_b-sub-m1', role: 'assistant', subagentRunId: 'call_b-sub' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'call_b-sub-m1', delta: 'b1', subagentRunId: 'call_b-sub' },
  ]);
});

test('pending delegation at RUN_ERROR → SUBAGENT_ERROR cleanup, then no double-cleanup', () => {
  const injector = createSubagentInjector();
  const out = [
    ...injector.eventsFor(delegationStart()),
    ...injector.eventsFor({ type: 'RUN_ERROR', message: 'boom' }),
  ];
  assert.equal(out.filter((e) => e.type === 'SUBAGENT_ERROR').length, 1);
  assert.equal(out.at(-1).type, 'RUN_ERROR');
  // A second terminal frame injects nothing more.
  assert.deepEqual(injector.eventsFor({ type: 'RUN_FINISHED' }), [{ type: 'RUN_FINISHED' }]);
});

test('chunk: agent-* tool-call with NO prior start/step-start omits parentMessageId entirely', () => {
  const injector = createSubagentInjector();
  const [start] = injector.chunk(toolCallChunk());
  assert.equal(start.type, 'TOOL_CALL_START');
  assert.equal('parentMessageId' in start, false, 'key must be absent, not present with an undefined value');
});
