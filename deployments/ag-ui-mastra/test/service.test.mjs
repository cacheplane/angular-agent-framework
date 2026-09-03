// Transcript-shape tests for the ag-ui-mastra service.
//
// Each surface's SSE event sequence is asserted against the MEASURED shapes
// from the 2026-08-31 Mastra spike captures (scratchpad spike-mastra
// transcripts 01/02/04a/05a/05c — inventoried in the comments below). The
// model is a scripted OpenAI responses-API mock (the endpoint Mastra's model
// router actually calls), so text differs from the live captures but the
// event grammar must match. The interrupt→resume round trip is additionally
// driven through the REAL @ag-ui/client 0.0.59 HttpAgent — the same client
// the Angular adapter uses — so every frame must parse and verify.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TOKEN = 'test-internal-token';
let mock; // scripted OpenAI responses-API mock
let server; // the service under test
let baseUrl;
let dbDir;

// ── scripted model ─────────────────────────────────────────────────────────
// aimock-style matcher list: tool-output matchers FIRST so continuation
// requests never re-match the original tool-call entry.
const SCRIPT = [
  {
    match: { hasToolOutput: 'check_conditions' },
    response: { content: 'Clear skies at Yosemite Valley with a high of 18°C.' },
  },
  {
    match: { hasToolOutput: 'updateWorkingMemory' },
    response: { content: 'Started your Yosemite Weekend packing list.' },
  },
  {
    match: { hasToolOutput: 'reserve_campsite' },
    response: { content: 'Booked — North Pines is reserved for 2 nights.' },
  },
  {
    match: { userIncludes: 'weather' },
    response: { toolCalls: [{ name: 'check_conditions', arguments: { location: 'Yosemite Valley' } }] },
  },
  {
    match: { userIncludes: 'packing list' },
    response: {
      toolCalls: [
        {
          name: 'updateWorkingMemory',
          arguments: {
            memory: {
              packing_list: {
                title: 'Yosemite Weekend',
                items: [
                  { name: 'tent', qty: 1 },
                  { name: 'sleeping bag', qty: 2 },
                ],
              },
            },
          },
        },
      ],
    },
  },
  {
    match: { userIncludes: 'reserve' },
    response: { toolCalls: [{ name: 'reserve_campsite', arguments: { site: 'North Pines', nights: 2 } }] },
  },
  { match: { userIncludes: 'hello' }, response: { content: 'Hello there.' } },
];

function requestContext(body) {
  const items = Array.isArray(body.input) ? body.input : [];
  const callNamesById = new Map(
    items.filter((i) => i.type === 'function_call').map((i) => [i.call_id, i.name]),
  );
  const toolOutputNames = items
    .filter((i) => i.type === 'function_call_output')
    .map((i) => callNamesById.get(i.call_id))
    .filter(Boolean);
  const lastUser = [...items].reverse().find((i) => i.role === 'user');
  const userText = !lastUser
    ? ''
    : typeof lastUser.content === 'string'
      ? lastUser.content
      : (lastUser.content ?? []).map((p) => p.text ?? '').join('');
  return { toolOutputNames, userText: userText.toLowerCase() };
}

function pickEntry(body) {
  const ctx = requestContext(body);
  return SCRIPT.find((entry) => {
    if (entry.match.hasToolOutput !== undefined) {
      return ctx.toolOutputNames.includes(entry.match.hasToolOutput);
    }
    return ctx.userText.includes(entry.match.userIncludes);
  });
}

let mockCall = 0;
function responsesOutput(entry) {
  mockCall++;
  if (entry.response.toolCalls) {
    return entry.response.toolCalls.map((t, i) => ({
      id: `fc_mock${mockCall}_${i}`,
      call_id: `call_mock${mockCall}_${i}`,
      type: 'function_call',
      name: t.name,
      arguments: JSON.stringify(t.arguments ?? {}),
      status: 'completed',
    }));
  }
  return [
    {
      id: `msg_mock${mockCall}`,
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [
        { type: 'output_text', text: String(entry.response.content), annotations: [], logprobs: [] },
      ],
    },
  ];
}

function responsesEnvelope(id, model, out, status) {
  const completed = status === 'completed';
  return {
    id,
    object: 'response',
    created_at: 1,
    completed_at: completed ? 1 : null,
    status,
    background: false,
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    max_tool_calls: null,
    metadata: null,
    model,
    output: completed ? out : [],
    parallel_tool_calls: true,
    previous_response_id: null,
    prompt: null,
    reasoning: null,
    service_tier: 'default',
    temperature: null,
    text: { format: { type: 'text' } },
    tool_choice: 'auto',
    tools: [],
    top_p: null,
    truncation: 'disabled',
    usage: completed
      ? {
          input_tokens: 0,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens: 0,
          output_tokens_details: { reasoning_tokens: 0 },
          total_tokens: 0,
        }
      : null,
  };
}

function startMockOpenAi() {
  return new Promise((resolve) => {
    const s = http.createServer(async (req, res) => {
      let body = '';
      for await (const c of req) body += c;
      const parsed = body ? JSON.parse(body) : {};
      if (!req.url?.endsWith('/responses')) {
        res.writeHead(500).end('unexpected endpoint ' + req.url);
        return;
      }
      const entry = pickEntry(parsed);
      if (!entry) {
        res.writeHead(500).end('no script entry matched: ' + JSON.stringify(requestContext(parsed)));
        return;
      }
      const model = parsed.model ?? 'mock';
      const id = `resp_mock${mockCall}`;
      const out = responsesOutput(entry);
      let seq = 0;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const send = (ev) => res.write(`data: ${JSON.stringify({ ...ev, sequence_number: seq++ })}\n\n`);
      send({ type: 'response.created', response: responsesEnvelope(id, model, out, 'in_progress') });
      for (let oi = 0; oi < out.length; oi++) {
        const item = out[oi];
        if (item.type === 'function_call') {
          send({ type: 'response.output_item.added', output_index: oi, item: { ...item, arguments: '', status: 'in_progress' } });
          // Two argument chunks so partial-args paths (STATE_DELTA) exercise.
          const mid = Math.ceil(item.arguments.length / 2);
          send({ type: 'response.function_call_arguments.delta', output_index: oi, item_id: item.id, delta: item.arguments.slice(0, mid) });
          send({ type: 'response.function_call_arguments.delta', output_index: oi, item_id: item.id, delta: item.arguments.slice(mid) });
          send({ type: 'response.function_call_arguments.done', output_index: oi, item_id: item.id, name: item.name, arguments: item.arguments });
          send({ type: 'response.output_item.done', output_index: oi, item });
          continue;
        }
        send({ type: 'response.output_item.added', output_index: oi, item: { ...item, status: 'in_progress', content: [] } });
        const content = item.content[0];
        send({ type: 'response.content_part.added', output_index: oi, content_index: 0, item_id: item.id, part: { ...content, text: '' } });
        for (const word of content.text.split(/(?<= )/)) {
          send({ type: 'response.output_text.delta', output_index: oi, content_index: 0, item_id: item.id, delta: word, logprobs: [] });
        }
        send({ type: 'response.output_text.done', output_index: oi, content_index: 0, item_id: item.id, text: content.text, logprobs: [] });
        send({ type: 'response.content_part.done', output_index: oi, content_index: 0, item_id: item.id, part: content });
        send({ type: 'response.output_item.done', output_index: oi, item });
      }
      send({ type: 'response.completed', response: responsesEnvelope(id, model, out, 'completed') });
      res.end('data: [DONE]\n\n');
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

// ── harness ────────────────────────────────────────────────────────────────
before(async () => {
  mock = await startMockOpenAi();
  dbDir = mkdtempSync(join(tmpdir(), 'ag-ui-mastra-test-'));
  process.env.AG_UI_INTERNAL_TOKEN = TOKEN;
  process.env.OPENAI_API_KEY = 'sk-test-not-used';
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${mock.address().port}/v1`;
  process.env.AG_UI_MASTRA_DB_PATH = join(dbDir, 'mastra.db');
  const { createAgUiServer } = await import('../server.mjs');
  server = createAgUiServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server?.close(resolve));
  await new Promise((resolve) => mock?.close(resolve));
  rmSync(dbDir, { recursive: true, force: true });
});

async function runAgent(input, { token = TOKEN } = {}) {
  const res = await fetch(`${baseUrl}/agent/mastra`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-token': token },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  const events = text
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => JSON.parse(l.slice(6)));
  return { status: res.status, events };
}

function baseInput(threadId, runId, content) {
  return {
    threadId,
    runId,
    state: {},
    messages: [{ id: `${runId}-u1`, role: 'user', content }],
    tools: [],
    context: [],
    forwardedProps: {},
  };
}

/** Compress consecutive duplicate event types: the spike inventory notation. */
function grammar(events) {
  const out = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if (last && last.type === e.type) last.count++;
    else out.push({ type: e.type, count: 1 });
  }
  return out.map((o) => o.type);
}

// ── auth / health contract (mirrors ag-ui-dev server.py middleware) ────────
test('GET /ok is unauthenticated', async () => {
  const res = await fetch(`${baseUrl}/ok`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('agent route without the internal token → clean 401 JSON', async () => {
  const { status, events } = await runAgent(baseInput('t-auth', 'r-auth', 'Say hello.'), { token: 'wrong' });
  assert.equal(status, 401);
  assert.equal(events.length, 0);
});

test('unknown topic → 404 JSON', async () => {
  const res = await fetch(`${baseUrl}/agent/nope`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-token': TOKEN },
    body: '{}',
  });
  assert.equal(res.status, 404);
});

// ── surface grammars vs the measured spike shapes ──────────────────────────
test('chat: RUN_STARTED → TEXT_MESSAGE_CHUNK+ → RUN_FINISHED (spike 01-chat)', async () => {
  const { events } = await runAgent(baseInput('t-chat', 'r-chat-1', 'Say hello.'));
  assert.deepEqual(grammar(events), ['RUN_STARTED', 'TEXT_MESSAGE_CHUNK', 'RUN_FINISHED']);
  assert.equal(events.at(-1).outcome, undefined);
});

test('backend tool: TOOL_CALL_* → TOOL_CALL_RESULT → text (spike 02-backend-tool)', async () => {
  const { events } = await runAgent(baseInput('t-tool', 'r-tool-1', "What's the weather at Yosemite Valley?"));
  assert.deepEqual(grammar(events), [
    'RUN_STARTED',
    'TOOL_CALL_START',
    'TOOL_CALL_ARGS',
    'TOOL_CALL_END',
    'TOOL_CALL_RESULT',
    'TEXT_MESSAGE_CHUNK',
    'RUN_FINISHED',
  ]);
  const start = events.find((e) => e.type === 'TOOL_CALL_START');
  assert.equal(start.toolCallName, 'check_conditions');
  const result = events.find((e) => e.type === 'TOOL_CALL_RESULT');
  assert.ok(result.content.includes('Clear skies'));
});

test('state: STATE_SNAPSHOT + real STATE_DELTA patches (spike 04a-state)', async () => {
  const { events } = await runAgent(
    baseInput('t-state', 'r-state-1', "Start a packing list titled 'Yosemite Weekend' with a tent and two sleeping bags."),
  );
  const types = events.map((e) => e.type);
  assert.equal(types[0], 'RUN_STARTED');
  assert.equal(types.at(-1), 'RUN_FINISHED');
  const firstSnapshot = types.indexOf('STATE_SNAPSHOT');
  const firstDelta = types.indexOf('STATE_DELTA');
  assert.ok(firstSnapshot !== -1, 'expected a STATE_SNAPSHOT');
  assert.ok(firstDelta !== -1, 'expected at least one STATE_DELTA (Mastra emits real deltas)');
  assert.ok(firstSnapshot < firstDelta, 'snapshot precedes deltas');
  const deltaOps = events.filter((e) => e.type === 'STATE_DELTA').flatMap((e) => e.delta);
  assert.ok(deltaOps.every((op) => op.path.startsWith('/packing_list')), 'deltas patch /packing_list');
  const finalSnapshot = events.filter((e) => e.type === 'STATE_SNAPSHOT').at(-1);
  assert.equal(finalSnapshot.snapshot.packing_list?.title, 'Yosemite Weekend');
});

test('interrupt: CUSTOM on_interrupt + RUN_FINISHED outcome (spike 05a-interrupt)', async () => {
  const { events } = await runAgent(baseInput('t-hitl', 'r-hitl-1', 'Please reserve the North Pines campsite for 2 nights.'));
  assert.deepEqual(grammar(events), ['RUN_STARTED', 'CUSTOM', 'RUN_FINISHED']);

  const custom = events.find((e) => e.type === 'CUSTOM');
  assert.equal(custom.name, 'on_interrupt');
  const value = JSON.parse(custom.value);
  assert.equal(value.type, 'mastra_suspend');
  assert.equal(value.toolName, 'reserve_campsite');
  assert.equal(typeof value.toolCallId, 'string');
  assert.equal(value.runId, 'r-hitl-1');
  assert.equal(value.suspendPayload.site, 'North Pines');
  assert.equal(value.suspendPayload.total_usd, 90);

  const finished = events.at(-1);
  assert.equal(finished.outcome.type, 'interrupt');
  assert.equal(finished.outcome.interrupts[0].toolCallId, value.toolCallId);

  // Stash for the resume test below (node:test runs serially by default).
  globalThis.__pendingInterrupt = value;
});

test('resume: command.interruptEvent{toolCallId,runId} completes the run (spike 05c-resume-correct)', async () => {
  const pending = globalThis.__pendingInterrupt;
  assert.ok(pending, 'interrupt test must run first');
  const input = {
    ...baseInput('t-hitl', 'r-hitl-2', 'Please reserve the North Pines campsite for 2 nights.'),
    forwardedProps: {
      command: {
        resume: { approved: true },
        interruptEvent: { toolCallId: pending.toolCallId, runId: pending.runId },
      },
    },
  };
  const { events } = await runAgent(input);
  assert.deepEqual(grammar(events), ['RUN_STARTED', 'TOOL_CALL_RESULT', 'TEXT_MESSAGE_CHUNK', 'RUN_FINISHED']);
  const result = events.find((e) => e.type === 'TOOL_CALL_RESULT');
  assert.equal(result.toolCallId, pending.toolCallId);
  assert.ok(result.content.includes('North Pines'));
  assert.equal(events.at(-1).outcome, undefined);
});

// ── the REAL client: every frame must parse + verify on @ag-ui/client 0.0.59 ─
test('interrupt → resume round trip through @ag-ui/client HttpAgent', async () => {
  const { HttpAgent } = await import('@ag-ui/client');
  const agent = new HttpAgent({
    url: `${baseUrl}/agent/mastra`,
    headers: { 'x-internal-token': TOKEN },
    threadId: 't-client-hitl',
  });
  agent.messages = [{ id: 'cu1', role: 'user', content: 'Please reserve the North Pines campsite for 2 nights.' }];

  let interruptValue = null;
  const seen = [];
  agent.subscribe({
    onEvent({ event }) {
      seen.push(event.type);
      if (event.type === 'CUSTOM' && event.name === 'on_interrupt') {
        interruptValue = JSON.parse(event.value);
      }
    },
  });

  await agent.runAgent({});
  assert.ok(interruptValue, 'client observed the on_interrupt signal');
  assert.deepEqual(seen, ['RUN_STARTED', 'CUSTOM', 'RUN_FINISHED']);

  seen.length = 0;
  // @ag-ui/client 0.0.59 records the RUN_FINISHED interrupt outcome on
  // `pendingInterrupts` and refuses runAgent() unless a top-level `resume`
  // addresses it. Mastra's measured wire shape carries the resume in
  // forwardedProps instead, so the Threadplane adapter clears the ledger
  // before a forwardedProps resume (libs/ag-ui/src/lib/to-agent.ts). Mirror
  // that here — this test drives the raw client the way the adapter does.
  agent.pendingInterrupts = [];
  await agent.runAgent({
    forwardedProps: {
      command: {
        resume: { approved: true },
        interruptEvent: { toolCallId: interruptValue.toolCallId, runId: interruptValue.runId },
      },
    },
  });
  assert.ok(seen.includes('TOOL_CALL_RESULT'), `resume stream: ${seen.join(' ')}`);
  const last = agent.messages.at(-1);
  assert.equal(last.role, 'assistant');
  assert.ok(String(last.content).includes('North Pines'));
});

// ── failure mapping ────────────────────────────────────────────────────────
test('model failure surfaces as RUN_ERROR frame, not a dropped socket', async () => {
  // No script entry matches this text → the mock returns HTTP 500 → the
  // bridge Observable errors → the service must emit RUN_ERROR.
  const { status, events } = await runAgent(baseInput('t-err', 'r-err-1', 'zzz-unmatched-zzz'));
  assert.equal(status, 200);
  const types = events.map((e) => e.type);
  assert.ok(types.includes('RUN_ERROR'), `got: ${types.join(' ')}`);
});
