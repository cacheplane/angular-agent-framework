// SPDX-License-Identifier: MIT
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
