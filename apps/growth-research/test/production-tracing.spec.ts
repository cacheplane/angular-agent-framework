import { afterEach, expect, it, vi } from 'vitest';
import {
  configuredTraceSink,
  createTraceTransport,
} from '../src/production/tracing.js';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('exports only measured whitelisted fields and links actual child spans to the attempt', async () => {
  const payloads: Record<string, unknown>[] = [];
  const transport = createTraceTransport({
    apiKey: 'credential-sentinel',
    projectId: '11111111-1111-4111-8111-111111111111',
    fetch: async (_url, init) => {
      payloads.push(JSON.parse(String(init?.body)));
      return new Response('{}');
    },
  });
  const attemptId = '22222222-2222-4222-8222-222222222222';
  await transport.emit(
    {
      attemptId,
      phase: 'settled',
      outcome: 'completed',
      elapsedMs: 50,
      modelCalls: 1,
      evidenceReads: 0,
      inputTokens: 12,
      outputTokens: 3,
    },
    [
      {
        kind: 'model',
        callIndex: 1,
        startedAt: 100,
        endedAt: 130,
        outcome: 'succeeded',
        inputTokens: 12,
        outputTokens: 3,
        raw: 'identity@sentinel.test',
      } as never,
    ]
  );
  expect(payloads).toHaveLength(2);
  expect(payloads[0]['id']).toBe(attemptId);
  expect(payloads[0]['dotted_order']).toMatch(
    /^\d{8}T\d{12}Z22222222-2222-4222-8222-222222222222$/
  );
  expect(payloads[1]['dotted_order']).toBe(
    `${payloads[0]['dotted_order']}.19700101T000000100000Z${payloads[1]['id']}`
  );
  expect(payloads[1]['parent_run_id']).toBe(attemptId);
  expect(payloads[1]['start_time']).toBe(new Date(100).toISOString());
  expect(JSON.stringify(payloads)).not.toMatch(
    /sentinel|raw|canonicalUrl|snippets/
  );
});
it('keeps export failures nonfatal and verifies deletion through an exact trace query', async () => {
  const bodies: unknown[] = [];
  const trace = createTraceTransport({
    apiKey: 'test',
    projectId: '11111111-1111-4111-8111-111111111111',
    fetch: async (url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(
        String(url).endsWith('/query') ? '{"runs":[]}' : '{}'
      );
    },
  });
  const id = '22222222-2222-4222-8222-222222222222';
  await trace.requestDeletion(id);
  expect(await trace.isAbsent(id)).toBe(true);
  expect(bodies).toEqual([
    { trace_ids: [id], session_id: '11111111-1111-4111-8111-111111111111' },
    {
      trace: id,
      session: ['11111111-1111-4111-8111-111111111111'],
      limit: 1,
      select: ['id'],
    },
  ]);
});
it('absorbs trace transport failure without exposing provider details', async () => {
  const trace = createTraceTransport({
    apiKey: 'test',
    projectId: '11111111-1111-4111-8111-111111111111',
    fetch: async () => {
      throw new Error('credential-bearing transport error');
    },
  });
  await expect(
    trace.emit({
      attemptId: '22222222-2222-4222-8222-222222222222',
      phase: 'settled',
      outcome: 'failed',
      elapsedMs: 10,
      modelCalls: 0,
      evidenceReads: 0,
      inputTokens: null,
      outputTokens: null,
    })
  ).resolves.toBeUndefined();
});
it('uses explicit trace credentials and emits only a sanitized rejection diagnostic', async () => {
  vi.stubEnv('GROWTH_RESEARCH_TRACE_API_KEY', 'custom-key');
  vi.stubEnv('LANGSMITH_API_KEY', 'injected-key');
  vi.stubEnv('GROWTH_RESEARCH_TRACE_WORKSPACE_ID', 'custom-workspace');
  vi.stubEnv(
    'GROWTH_RESEARCH_TRACE_PROJECT_ID',
    '11111111-1111-4111-8111-111111111111'
  );
  const fetcher = vi.fn<typeof fetch>(
    async () => new Response('private failure body', { status: 403 })
  );
  vi.stubGlobal('fetch', fetcher);
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await configuredTraceSink({
    attemptId: '22222222-2222-4222-8222-222222222222',
    phase: 'settled',
    outcome: 'skipped',
    elapsedMs: 1,
    modelCalls: 0,
    evidenceReads: 0,
    inputTokens: null,
    outputTokens: null,
  });
  expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
    'x-api-key': 'custom-key',
    'x-tenant-id': 'custom-workspace',
  });
  expect(log).toHaveBeenCalledWith('company_trace', {
    code: 'http_rejected',
    status: 403,
  });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(
    /private|custom-key|injected-key/
  );
});
