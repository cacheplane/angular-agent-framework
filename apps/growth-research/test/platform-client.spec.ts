import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createPlatformClient } from '../scripts/platform-client.mts';

const threadId = '10000000-0000-4000-8000-000000000001';
const runId = '20000000-0000-4000-8000-000000000001';
const correlationId = 'synthetic-direct-1';
const run = (status = 'success') => ({ run_id: runId, thread_id: threadId, status, metadata: { growth_research_correlation: correlationId } });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

function server(handler: (path: string, init: RequestInit) => Response | Promise<Response>, options: Partial<Parameters<typeof createPlatformClient>[0]> = {}) {
  const calls: { path: string; init: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname + url.search;
    calls.push({ path, init });
    return handler(path, init);
  };
  return { calls, client: createPlatformClient({ url: 'https://fixture.us.langgraph.app', apiKey: 'secret-fixture-key', pollMs: 1, ...options, fetch: fetcher }) };
}

describe('LangSmith synthetic smoke transport', () => {
  it('discovers all public graphs so an exposed specialist cannot be hidden by a filter', async () => {
    const { client, calls } = server(() => json([]));
    await client.discover();
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ limit: 100 });
  });
  it('loads with the native Node 24 script runtime', () => {
    const moduleUrl = new URL('../scripts/platform-client.mts', import.meta.url).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import { createPlatformClient } from ${JSON.stringify(moduleUrl)}; createPlatformClient({url: 'http://localhost:8128'});`], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  });
  it('submits the graph assistant ID and credential without following redirects', async () => {
    const { client, calls } = server((_path, init) => init.method === 'POST' ? json(run('pending')) : json([]));
    await client.submitRun(threadId, correlationId, { messages: [{ role: 'user', content: 'synthetic-direct' }] });
    const post = calls.find(c => c.init.method === 'POST');
    expect(post?.path).toBe(`/threads/${threadId}/runs`);
    expect(JSON.parse(String(post?.init.body))).toMatchObject({ assistant_id: 'growth_research', metadata: { growth_research_correlation: correlationId }, multitask_strategy: 'reject', config: { recursion_limit: 12 } });
    expect(JSON.parse(String(post?.init.body))).not.toHaveProperty('route');
    expect(new Headers(post?.init.headers).get('x-api-key')).toBe('secret-fixture-key');
    expect(post?.init.redirect).toBe('error');
  });

  it.each([401, 403])('reports authentication status %s without reflecting response secrets or retrying', async status => {
    const { client, calls } = server(() => json({ detail: 'secret-fixture-key' }, status));
    await expect(client.submitRun(threadId, correlationId, {})).rejects.toMatchObject({ code: 'http_error', status });
    expect(calls).toHaveLength(1);
  });

  it('reconciles a lost accepted response without a second POST', async () => {
    let accepted = false;
    const { client, calls } = server((_path, init) => {
      if (init.method === 'POST') { accepted = true; throw new Error('socket closed with secret-fixture-key'); }
      return json(accepted ? [run()] : []);
    });
    await expect(client.submitRun(threadId, correlationId, {})).resolves.toMatchObject({ run_id: runId });
    expect(calls.filter(c => c.init.method === 'POST')).toHaveLength(1);
  });

  it('retains an ambiguous outcome and refuses automatic resubmission in this client', async () => {
    const { client, calls } = server((_path, init) => {
      if (init.method === 'POST') throw new Error('secret-fixture-key');
      return json([]);
    });
    for (let n = 0; n < 2; n++) {
      await expect(client.submitRun(threadId, correlationId, {})).rejects.toMatchObject({ code: 'ambiguous_submission', message: 'Run submission outcome is unknown; reconcile before another attempt.' });
    }
    expect(calls.filter(c => c.init.method === 'POST')).toHaveLength(1);
  });

  it('reuses an existing correlated run from a later page', async () => {
    const unrelated = { ...run(), metadata: {} };
    const { client, calls } = server(path => json(path.includes('offset=100') ? [run()] : Array.from({ length: 100 }, () => unrelated)));
    await expect(client.submitRun(threadId, correlationId, {})).resolves.toMatchObject({ run_id: runId });
    expect(calls).toHaveLength(2);
    expect(calls.some(c => c.init.method === 'POST')).toBe(false);
  });

  it('coalesces concurrent submissions made by the same smoke client', async () => {
    const { client, calls } = server((_path, init) => init.method === 'POST' ? json(run()) : json([]));
    await Promise.all([client.submitRun(threadId, correlationId, {}), client.submitRun(threadId, correlationId, {})]);
    expect(calls.filter(c => c.init.method === 'POST')).toHaveLength(1);
  });

  it('does not report a failed run as a successful fixture', async () => {
    const { client } = server(() => json(run('error')));
    await expect(client.waitForSuccess(threadId, runId)).rejects.toMatchObject({ code: 'run_failed' });
  });

  it('rejects a run response for a different run ID', async () => {
    const { client } = server(() => json({ ...run(), run_id: '20000000-0000-4000-8000-000000000002' }));
    await expect(client.getRun(threadId, runId)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('rejects late success and caps polling request time to the remaining run deadline', async () => {
    const { client, calls } = server(async () => { await delay(30); return json(run()); }, { runTimeoutMs: 5, requestTimeoutMs: 1000 });
    await expect(client.waitForSuccess(threadId, runId)).rejects.toMatchObject({ code: 'run_wait_timeout' });
    expect(calls[0]?.init.signal?.aborted).toBe(true);
  });

  it('caps polling sleeps to the remaining deadline', async () => {
    const { client } = server(() => json(run('running')), { runTimeoutMs: 10, pollMs: 1000 });
    const outcome = client.waitForTerminal(threadId, runId).then(() => 'unexpected_success', error => error.code);
    expect(await Promise.race([outcome, delay(100).then(() => 'deadline_ignored')])).toBe('run_wait_timeout');
  });

  it.each([200, 202, 204])('uses platform cancellation with HTTP %s and confirms the terminal state', async status => {
    const { client, calls } = server(path => path.includes('/cancel?') ? new Response(null, { status }) : json(run('interrupted')));
    await expect(client.cancelRun(threadId, runId)).resolves.toMatchObject({ status: 'interrupted' });
    expect(calls[0]?.path).toBe(`/threads/${threadId}/runs/${runId}/cancel?wait=true&action=interrupt`);
    expect(calls[0]?.init.method).toBe('POST');
  });

  it('refuses to delete an unrelated thread', async () => {
    const { client, calls } = server(() => json({ thread_id: threadId, metadata: { growth_research_smoke: 'someone-else' } }));
    await expect(client.deleteFixtureThread(threadId, 'our-smoke')).rejects.toMatchObject({ code: 'foreign_thread' });
    expect(calls.some(c => c.init.method === 'DELETE')).toBe(false);
  });
  it('does not mistake interrupted status for JavaScript worker quiescence', async () => {
    const { client, calls } = server(path => path.endsWith('/runs?limit=100&offset=0') ? json([run('interrupted')]) : json({ thread_id: threadId, metadata: { growth_research_smoke: 'our-smoke' } }));
    await expect(client.deleteFixtureThread(threadId, 'our-smoke')).rejects.toMatchObject({ code: 'quiescence_unverified' });
    expect(calls.some(call => call.init.method === 'DELETE')).toBe(false);
  });

  it('refuses cleanup while a run is still active', async () => {
    const { client, calls } = server(path => json(path.includes('/runs?') ? [run('running')] : { thread_id: threadId, metadata: { growth_research_smoke: 'our-smoke' } }));
    await expect(client.deleteFixtureThread(threadId, 'our-smoke')).rejects.toMatchObject({ code: 'active_run' });
    expect(calls.some(c => c.init.method === 'DELETE')).toBe(false);
  });

  it.each([200, 204])('deletes its quiescent fixture with HTTP %s and verifies absence', async status => {
    let deleted = false;
    const { client } = server((path, init) => {
      if (init.method === 'DELETE') { deleted = true; return new Response(null, { status }); }
      if (path.includes('/runs?')) return json([run()]);
      return deleted ? json({}, 404) : json({ thread_id: threadId, metadata: { growth_research_smoke: 'our-smoke' } });
    });
    await expect(client.deleteFixtureThread(threadId, 'our-smoke')).resolves.toBeUndefined();
    expect(deleted).toBe(true);
  });

  it('verifies ownership when reusing a deterministic thread ID', async () => {
    const { client } = server(() => json({ thread_id: threadId, metadata: { growth_research_smoke: 'someone-else' } }));
    await expect(client.ensureFixtureThread(threadId, 'our-smoke')).rejects.toMatchObject({ code: 'foreign_thread' });
  });

  it.each(['http://public.example', 'https://user:password@example.com', 'https://example.com?key=secret', 'https://example.com/path'])('rejects unsafe or ambiguous server URL %s', url => {
    expect(() => createPlatformClient({ url, apiKey: 'key' })).toThrow('Use a bare HTTPS server origin');
  });
});
