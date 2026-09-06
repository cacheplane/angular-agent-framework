import { setTimeout as delay } from 'node:timers/promises';

export const researchGraphId = 'growth_research';
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const statuses = new Set(['pending', 'running', 'success', 'error', 'timeout', 'interrupted']);

export class PlatformError extends Error {
  readonly code: string;
  readonly status: number | undefined;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface PlatformRun {
  run_id: string;
  thread_id: string;
  status: string;
  metadata: Record<string, unknown>;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PlatformError('invalid_response', 'Invalid platform response.');
  return value as Record<string, unknown>;
}

function id(value: string): string {
  if (!uuid.test(value)) throw new PlatformError('invalid_id', 'Expected a platform UUID.');
  return value;
}

function parseRun(value: unknown, threadId: string): PlatformRun {
  const row = object(value);
  if (typeof row['run_id'] !== 'string' || !uuid.test(row['run_id']) || row['thread_id'] !== threadId || typeof row['status'] !== 'string' || !statuses.has(row['status'])) {
    throw new PlatformError('invalid_response', 'Invalid platform run.');
  }
  return { run_id: row['run_id'], thread_id: threadId, status: row['status'], metadata: object(row['metadata'] ?? {}) };
}

/** Internal synthetic smoke client. Persistent work leases and cross-process deduplication belong to Growth. */
export function createPlatformClient(options: {
  url: string;
  apiKey?: string;
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
  runTimeoutMs?: number;
  pollMs?: number;
}) {
  const base = new URL(options.url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(local && base.protocol === 'http:')) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new PlatformError('invalid_url', 'Use a bare HTTPS server origin or local development origin.');
  }
  if (!local && !options.apiKey) throw new PlatformError('missing_credential', 'A server-held LangSmith credential is required.');
  const fetcher = options.fetch ?? fetch;
  const requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
  const runTimeoutMs = options.runTimeoutMs ?? 120_000;
  const pollMs = options.pollMs ?? 500;
  for (const n of [requestTimeoutMs, runTimeoutMs, pollMs]) {
    if (!Number.isFinite(n) || n <= 0 || n > 300_000) throw new PlatformError('invalid_timeout', 'Timeouts must be positive and bounded.');
  }

  async function request(path: string, method = 'GET', body?: unknown, responseOptions: { json?: boolean; timeoutMs?: number } = {}): Promise<unknown> {
    let response: Response;
    try {
      response = await fetcher(new URL(path, base).href, {
        method, redirect: 'error', signal: AbortSignal.timeout(responseOptions.timeoutMs ?? requestTimeoutMs),
        headers: { 'content-type': 'application/json', ...(options.apiKey ? { 'x-api-key': options.apiKey } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      // Transport exceptions and response bodies can contain credentials or fixture input.
      throw new PlatformError('transport_error', 'Platform request did not return a usable response.');
    }
    if (!response.ok) throw new PlatformError('http_error', `Platform request failed with HTTP ${response.status}.`, response.status);
    if (responseOptions.json === false || response.status === 204) return null;
    try { return await response.json(); } catch { throw new PlatformError('invalid_response', 'Platform returned invalid JSON.'); }
  }

  async function listRuns(threadId: string): Promise<PlatformRun[]> {
    const runs: PlatformRun[] = [];
    for (let offset = 0; offset < 1_000; offset += 100) {
      const page = await request(`/threads/${id(threadId)}/runs?limit=100&offset=${offset}`);
      if (!Array.isArray(page)) throw new PlatformError('invalid_response', 'Expected a platform run list.');
      runs.push(...page.map(row => parseRun(row, threadId)));
      if (page.length < 100) return runs;
    }
    throw new PlatformError('pagination_limit', 'Run history exceeds the synthetic smoke limit.');
  }

  async function findRun(threadId: string, correlationId: string): Promise<PlatformRun | undefined> {
    const matches = new Map((await listRuns(threadId)).filter(run => run.metadata['growth_research_correlation'] === correlationId).map(run => [run.run_id, run]));
    if (matches.size > 1) throw new PlatformError('duplicate_runs', 'Multiple runs match this fixture; operator reconciliation is required.');
    return matches.values().next().value;
  }

  const submissions = new Map<string, Promise<PlatformRun>>();
  function submitRun(threadId: string, correlationId: string, input: unknown): Promise<PlatformRun> {
    if (!correlationId || correlationId.length > 160) throw new PlatformError('invalid_correlation', 'A bounded fixture correlation ID is required.');
    const key = `${id(threadId)}:${correlationId}`;
    const existing = submissions.get(key);
    if (existing) return existing;
    const attempt = (async () => {
      const prior = await findRun(threadId, correlationId);
      if (prior) return prior;
      try {
        const result = parseRun(await request(`/threads/${threadId}/runs`, 'POST', {
          assistant_id: researchGraphId, input,
          metadata: { growth_research_correlation: correlationId },
          config: { recursion_limit: 12 }, multitask_strategy: 'reject', durability: 'sync',
        }), threadId);
        if (result.metadata['growth_research_correlation'] !== correlationId) throw new PlatformError('invalid_response', 'Run correlation was not returned.');
        return result;
      } catch (error) {
        if (error instanceof PlatformError && error.status && error.status >= 400 && error.status < 500) throw error;
        try {
          const reconciled = await findRun(threadId, correlationId);
          if (reconciled) return reconciled;
        } catch { /* Keep the uncertain submission blocked, including when reconciliation fails. */ }
        throw new PlatformError('ambiguous_submission', 'Run submission outcome is unknown; reconcile before another attempt.');
      }
    })();
    // Retain rejected promises too: a caller retry must not blindly submit again.
    submissions.set(key, attempt);
    return attempt;
  }

  async function readRun(threadId: string, runId: string, timeoutMs = requestTimeoutMs): Promise<PlatformRun> {
    const run = parseRun(await request(`/threads/${id(threadId)}/runs/${id(runId)}`, 'GET', undefined, { timeoutMs }), threadId);
    if (run.run_id !== runId) throw new PlatformError('invalid_response', 'Platform returned a different run.');
    return run;
  }

  async function waitForTerminal(threadId: string, runId: string): Promise<PlatformRun> {
    const until = Date.now() + runTimeoutMs;
    while (Date.now() < until) {
      let run: PlatformRun;
      try { run = await readRun(threadId, runId, Math.max(1, Math.min(requestTimeoutMs, until - Date.now()))); } catch (error) {
        if (Date.now() >= until) break;
        throw error;
      }
      if (Date.now() >= until) break;
      if (run.status !== 'pending' && run.status !== 'running') return run;
      await delay(Math.max(1, Math.min(pollMs, until - Date.now())));
    }
    throw new PlatformError('run_wait_timeout', 'Run did not finish within the smoke deadline; cancel or reconcile it.');
  }

  async function waitForSuccess(threadId: string, runId: string): Promise<PlatformRun> {
    const run = await waitForTerminal(threadId, runId);
    if (run.status !== 'success') throw new PlatformError('run_failed', `Synthetic run ended with status ${run.status}.`);
    return run;
  }

  function assertOwnership(value: unknown, threadId: string, smokeId: string): void {
    const thread = object(value);
    if (thread['thread_id'] !== threadId || object(thread['metadata'] ?? {})['growth_research_smoke'] !== smokeId) {
      throw new PlatformError('foreign_thread', 'Thread does not belong to this synthetic smoke.');
    }
  }

  async function ensureFixtureThread(threadId: string, smokeId: string): Promise<void> {
    if (!smokeId || smokeId.length > 160) throw new PlatformError('invalid_correlation', 'A bounded smoke ID is required.');
    const thread = await request('/threads', 'POST', { thread_id: id(threadId), if_exists: 'do_nothing', metadata: { growth_research_smoke: smokeId } });
    assertOwnership(thread, threadId, smokeId);
  }

  async function deleteFixtureThread(threadId: string, smokeId: string): Promise<void> {
    assertOwnership(await request(`/threads/${id(threadId)}`), threadId, smokeId);
    const runs = await listRuns(threadId);
    if (runs.some(run => run.status === 'pending' || run.status === 'running')) {
      throw new PlatformError('active_run', 'Cancel and reconcile active fixture runs before deletion.');
    }
    // Agent Server 0.13.4 can report interruption while its JS graph keeps writing.
    // Leave these threads for operator cleanup after independently proven quiescence.
    if (runs.some(run => run.status === 'interrupted')) throw new PlatformError('quiescence_unverified', 'Interrupted JavaScript runs require verified worker quiescence before operator cleanup.');
    await request(`/threads/${threadId}`, 'DELETE', undefined, { json: false });
    try { await request(`/threads/${threadId}`); } catch (error) {
      if (error instanceof PlatformError && error.status === 404) return;
      throw error;
    }
    throw new PlatformError('cleanup_failed', 'Fixture thread remains readable after deletion.');
  }

  async function cancelRun(threadId: string, runId: string): Promise<PlatformRun> {
    await request(`/threads/${id(threadId)}/runs/${id(runId)}/cancel?wait=true&action=interrupt`, 'POST', undefined, { json: false });
    return waitForTerminal(threadId, runId);
  }

  return { submitRun, getRun: (threadId: string, runId: string) => readRun(threadId, runId), listRuns, waitForTerminal, waitForSuccess, ensureFixtureThread, deleteFixtureThread, cancelRun,
    getState: (threadId: string) => request(`/threads/${id(threadId)}/state`),
    discover: () => request('/assistants/search', 'POST', { limit: 100 }),
  };
}
