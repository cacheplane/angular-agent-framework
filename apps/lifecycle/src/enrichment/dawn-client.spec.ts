import { expect, it, vi } from 'vitest';
import { createDawnResearchClient } from './dawn-client.js';

const environment = {
  GROWTH_RESEARCH_URL: 'https://research.us.langgraph.app',
  LANGSMITH_API_KEY: 'fixture-key',
};
const threadId = '550e8400-e29b-41d4-a716-446655440000';
const attemptId = '650e8400-e29b-41d4-a716-446655440000';
const runId = '750e8400-e29b-41d4-a716-446655440000';

it('creates the stable thread idempotently and never automatically retries a lost submit', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        thread_id: threadId,
        metadata: { attempt_id: attemptId },
      })
    )
    .mockRejectedValueOnce(new Error('provider secret detail'));
  const client = createDawnResearchClient(environment, fetcher);
  const signal = new AbortController().signal;
  await client.ensureThread(threadId, attemptId, signal);
  await expect(
    client.submit(threadId, attemptId, { example: 'bounded request' }, signal)
  ).rejects.toThrow('dawn_request_failed');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    thread_id: threadId,
    if_exists: 'do_nothing',
    metadata: { attempt_id: attemptId },
  });
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({
    assistant_id: 'growth_company',
    multitask_strategy: 'reject',
    metadata: { attempt_id: attemptId },
    input: { request: { example: 'bounded request' } },
  });
});

it('rejects an existing thread belonging to another attempt', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      thread_id: threadId,
      metadata: { attempt_id: runId },
    })
  );
  await expect(
    createDawnResearchClient(environment, fetcher).ensureThread(
      threadId,
      attemptId,
      new AbortController().signal
    )
  ).rejects.toThrow('dawn_thread_mismatch');
});

it('reconciles exact attempt metadata across pages and rejects duplicate remote runs', async () => {
  const unrelated = Array.from({ length: 100 }, (_, n) => ({
    run_id: `other-${n}`,
    metadata: {},
  }));
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(unrelated))
    .mockResolvedValueOnce(
      Response.json([
        {
          run_id: runId,
          status: 'running',
          metadata: { attempt_id: attemptId },
        },
      ])
    );
  const client = createDawnResearchClient(environment, fetcher);
  expect(
    await client.findRun(threadId, attemptId, new AbortController().signal)
  ).toEqual({ runId, status: 'running' });
  expect(String(fetcher.mock.calls[1][0])).toContain('offset=100');
  const duplicate = createDawnResearchClient(
    environment,
    vi.fn().mockResolvedValue(
      Response.json([
        {
          run_id: runId,
          status: 'success',
          metadata: { attempt_id: attemptId },
        },
        {
          run_id: threadId,
          status: 'success',
          metadata: { attempt_id: attemptId },
        },
      ])
    )
  );
  await expect(
    duplicate.findRun(threadId, attemptId, new AbortController().signal)
  ).rejects.toThrow('dawn_duplicate_attempt');
});

it('empty reconciliation is unknown and does not submit a replacement', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json([]));
  expect(
    await createDawnResearchClient(environment, fetcher).findRun(
      threadId,
      attemptId,
      new AbortController().signal
    )
  ).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1].method).toBe('GET');
});

it('returns only the managed result and verifies deletion separately', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        values: { request: { private: 'not returned' }, result: { attemptId } },
      })
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(null, { status: 404 }));
  const client = createDawnResearchClient(environment, fetcher);
  const signal = new AbortController().signal;
  expect(await client.result(threadId, signal)).toEqual({ attemptId });
  await client.deleteThread(threadId, signal);
  expect(await client.threadAbsent(threadId, signal)).toBe(true);
});

it('rejects unsafe configuration, oversized responses and pre-cancelled calls', async () => {
  expect(() =>
    createDawnResearchClient({
      ...environment,
      GROWTH_RESEARCH_URL: 'https://user:secret@research.us.langgraph.app',
    })
  ).toThrow('dawn_configuration_invalid');
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response('x'.repeat(1_048_577)));
  const client = createDawnResearchClient(environment, fetcher);
  await expect(
    client.findRun(threadId, attemptId, new AbortController().signal)
  ).rejects.toThrow('dawn_response_too_large');
  const cancelled = AbortSignal.abort(new Error('cancelled'));
  await expect(
    client.ensureThread(threadId, attemptId, cancelled)
  ).rejects.toThrow('cancelled');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('accepts empty HTTP 200 acknowledgements for cancellation and deletion', async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(async () => new Response(null, { status: 200 }));
  const client = createDawnResearchClient(environment, fetcher);
  const signal = new AbortController().signal;
  await expect(
    client.interrupt(threadId, runId, signal)
  ).resolves.toBeUndefined();
  await expect(client.deleteThread(threadId, signal)).resolves.toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
