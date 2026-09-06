const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES = 1_048_576;
export interface RemoteResearchRun {
  runId: string;
  status: string;
}

function id(value: string): string {
  if (!UUID.test(value)) throw new Error('dawn_identifier_invalid');
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('dawn_response_invalid');
  return value as Record<string, unknown>;
}

/** Private platform client. Submission retries belong to durable Growth reconciliation. */
export function createDawnResearchClient(
  environment: Record<string, string | undefined>,
  fetcher: typeof fetch = fetch
) {
  let origin: URL;
  try {
    origin = new URL(environment['GROWTH_RESEARCH_URL'] ?? '');
  } catch {
    throw new Error('dawn_configuration_invalid');
  }
  const key = environment['LANGSMITH_API_KEY']?.trim();
  if (
    !key ||
    origin.protocol !== 'https:' ||
    !origin.hostname.endsWith('.langgraph.app') ||
    origin.username ||
    origin.password ||
    origin.port ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('dawn_configuration_invalid');

  async function request(
    path: string,
    method: string,
    signal: AbortSignal,
    body?: unknown,
    allow404 = false,
    expectJson = true
  ) {
    signal.throwIfAborted();
    const boundedSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(10_000),
    ]);
    let response: Response;
    try {
      response = await fetcher(new URL(path, origin), {
        method,
        redirect: 'error',
        signal: boundedSignal,
        headers: {
          'X-Api-Key': key as string,
          'content-type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      signal.throwIfAborted();
      throw new Error('dawn_request_failed');
    }
    if (allow404 && response.status === 404) {
      await response.body?.cancel();
      return { absent: true };
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`dawn_http_${response.status}`);
    }
    if (response.status === 204) return null;
    if (!expectJson) {
      await response.body?.cancel();
      return null;
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('dawn_response_invalid');
    let size = 0;
    const chunks: Uint8Array[] = [];
    const abort = () => {
      void reader.cancel().catch(() => undefined);
    };
    boundedSignal.addEventListener('abort', abort, { once: true });
    try {
      while (true) {
        boundedSignal.throwIfAborted();
        const { done, value } = await reader.read();
        boundedSignal.throwIfAborted();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new Error('dawn_response_too_large');
        }
        chunks.push(value);
      }
    } finally {
      boundedSignal.removeEventListener('abort', abort);
      reader.releaseLock();
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
      throw new Error('dawn_response_invalid');
    }
  }
  const threadPath = (threadId: string) => `/threads/${id(threadId)}`;
  return {
    async ensureThread(
      threadId: string,
      attemptId: string,
      signal: AbortSignal
    ): Promise<void> {
      const result = object(
        await request('/threads', 'POST', signal, {
          thread_id: id(threadId),
          if_exists: 'do_nothing',
          metadata: { attempt_id: id(attemptId) },
        })
      );
      if (
        result['thread_id'] !== threadId ||
        object(result['metadata'] ?? {})['attempt_id'] !== attemptId
      )
        throw new Error('dawn_thread_mismatch');
    },
    async submit(
      threadId: string,
      attemptId: string,
      input: unknown,
      signal: AbortSignal
    ): Promise<RemoteResearchRun> {
      const result = object(
        await request(`${threadPath(threadId)}/runs`, 'POST', signal, {
          assistant_id: 'growth_company',
          input: { request: input },
          metadata: { attempt_id: id(attemptId) },
          multitask_strategy: 'reject',
        })
      );
      return {
        runId: id(String(result['run_id'])),
        status: String(result['status']),
      };
    },
    async findRun(
      threadId: string,
      attemptId: string,
      signal: AbortSignal
    ): Promise<RemoteResearchRun | null> {
      id(attemptId);
      let found: RemoteResearchRun | null = null;
      for (let offset = 0; offset < 1_000; offset += 100) {
        const rows = await request(
          `${threadPath(threadId)}/runs?limit=100&offset=${offset}`,
          'GET',
          signal,
          undefined,
          true
        );
        if (!Array.isArray(rows)) {
          if (object(rows)['absent'] === true) return null;
          throw new Error('dawn_response_invalid');
        }
        for (const raw of rows) {
          const row = object(raw);
          if (object(row['metadata'] ?? {})['attempt_id'] !== attemptId)
            continue;
          if (found) throw new Error('dawn_duplicate_attempt');
          found = {
            runId: id(String(row['run_id'])),
            status: String(row['status']),
          };
        }
        if (rows.length < 100) return found;
      }
      throw new Error('dawn_reconciliation_limit');
    },
    async result(threadId: string, signal: AbortSignal): Promise<unknown> {
      const state = object(
        await request(`${threadPath(threadId)}/state`, 'GET', signal)
      );
      return object(state['values'])['result'];
    },
    async interrupt(
      threadId: string,
      runId: string,
      signal: AbortSignal
    ): Promise<void> {
      await request(
        `${threadPath(threadId)}/runs/${id(
          runId
        )}/cancel?wait=true&action=interrupt`,
        'POST',
        signal,
        undefined,
        false,
        false
      );
    },
    async deleteThread(threadId: string, signal: AbortSignal): Promise<void> {
      await request(
        threadPath(threadId),
        'DELETE',
        signal,
        undefined,
        true,
        false
      );
    },
    async threadAbsent(
      threadId: string,
      signal: AbortSignal
    ): Promise<boolean> {
      const result = await request(
        threadPath(threadId),
        'GET',
        signal,
        undefined,
        true
      );
      return object(result)['absent'] === true;
    },
  };
}
export type DawnResearchClient = ReturnType<typeof createDawnResearchClient>;
