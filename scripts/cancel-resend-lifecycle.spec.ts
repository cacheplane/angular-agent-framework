import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// This repository-level operator deliberately sits outside the Nx growth project.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  createDatabaseExecutor,
  type SqlExecutor,
  type SqlQueryResult,
  type SqlTransaction,
} from '../libs/growth/src/index.ts';
import { applyMigrations } from './apply-migrations.mts';

import {
  createAbortableResendCancellationClient,
  mainCancelResendLifecycle,
  type LegacyCancellationClient,
  type LegacyCancellationDependencies,
} from './cancel-resend-lifecycle.mts';

const now = new Date('2026-09-02T12:00:00.000Z');
const futureDeadline = '2026-09-03T11:55:00.000Z';
const contactProviderId = 'opaque_contact_1';
const scheduledProviderId = 'opaque_email_1';
const otherScheduledProviderId = 'opaque_email_2';
const jobId = '00000000-0000-4000-8000-000000000101';
const otherJobId = '00000000-0000-4000-8000-000000000102';
const contactId = '00000000-0000-4000-8000-000000000001';

interface CancellationJob extends Record<string, unknown> {
  id: string;
  contact_id: string;
  available_at: Date;
  provider_email_id: string;
  status: string;
  payload: Record<string, unknown>;
  last_error_code: string | null;
  lease_token: string | null;
  lease_until: Date | null;
}

interface CancellationState {
  configuration: Record<string, unknown> | null;
  contactMarkers: Array<string | null>;
  jobs: CancellationJob[];
  activities: Map<string, Record<string, unknown>>;
  queries: Array<{ sql: string; parameters: readonly unknown[] }>;
  failSettlementOnce?: boolean;
  ignoreErrorPersist?: boolean;
}

interface ProviderRequestOptions {
  signal?: AbortSignal;
}

function waitForAbort<T>(options?: ProviderRequestOptions): Promise<T> {
  if (!options?.signal) {
    return Promise.reject(new Error('abort signal missing'));
  }
  return new Promise<T>((_resolve, reject) => {
    options.signal?.addEventListener(
      'abort',
      () => reject(new DOMException('private timeout', 'AbortError')),
      { once: true }
    );
  });
}

function snapshotIdentity(
  contacts: readonly string[],
  scheduled: readonly string[]
): string {
  return createHash('sha256')
    .update(
      [
        'contacts',
        String(contacts.length),
        ...[...contacts].sort(),
        'scheduled_messages',
        String(scheduled.length),
        ...[...scheduled].sort(),
      ].join('\0')
    )
    .digest('hex');
}

function legacyJob(input?: Partial<CancellationJob>): CancellationJob {
  return {
    id: jobId,
    contact_id: contactId,
    available_at: new Date('2026-09-03T12:00:00.000Z'),
    provider_email_id: scheduledProviderId,
    status: 'pending',
    payload: {
      imported: true,
      legacy_type: 'scheduled_message',
      provider: 'resend',
      provider_state: 'scheduled',
    },
    last_error_code: null,
    lease_token: null,
    lease_until: null,
    ...input,
  };
}

function cancellationState(input?: {
  expectedContacts?: number;
  expectedScheduled?: number;
  deadline?: string | null;
  contactMarkers?: Array<string | null>;
  jobs?: CancellationJob[];
}): CancellationState {
  const contactMarkers = input?.contactMarkers ?? [contactProviderId];
  const jobs = input?.jobs ?? [legacyJob()];
  const expectedContacts = input?.expectedContacts ?? contactMarkers.length;
  const expectedScheduled = input?.expectedScheduled ?? jobs.length;
  const boundedContacts = contactMarkers.filter(
    (value): value is string => typeof value === 'string'
  );
  const scheduled = jobs.map(({ provider_email_id }) => provider_email_id);
  return {
    configuration: {
      event_key: 'legacy:resend:cutover:v1:configuration',
      contact_id: null,
      project_id: null,
      occurred_at: new Date('2026-09-02T11:00:00.000Z'),
      kind: 'legacy.resend_cutover_configured',
      data: {
        snapshot_at: '2026-09-02T11:00:00.000Z',
        cancellation_deadline:
          input && 'deadline' in input ? input.deadline : futureDeadline,
        expected_contacts: expectedContacts,
        expected_scheduled: expectedScheduled,
        snapshot_identity: snapshotIdentity(boundedContacts, scheduled),
      },
    },
    contactMarkers,
    jobs,
    activities: new Map(),
    queries: [],
  };
}

function marker(sql: string): string | undefined {
  return /\/\* growth:([a-z0-9-]+) \*\//u.exec(sql)?.[1];
}

function cancellationExecutor(state: CancellationState): SqlExecutor {
  const transaction: SqlTransaction = {
    async execute<Row extends Record<string, unknown>>(
      sql: string,
      parameters: readonly unknown[] = []
    ): Promise<SqlQueryResult<Row>> {
      state.queries.push({ sql, parameters: [...parameters] });
      switch (marker(sql)) {
        case 'cancel-claim-job': {
          const found = state.jobs.find(
            ({ id, provider_email_id, payload, lease_token, lease_until }) =>
              id === parameters[0] &&
              provider_email_id === parameters[1] &&
              payload['provider_state'] === 'scheduled' &&
              (lease_token === null ||
                (lease_until !== null &&
                  lease_until.getTime() <=
                    new Date(String(parameters[2])).getTime()))
          );
          if (found) {
            found.lease_token = String(parameters[3]);
            found.lease_until = new Date(String(parameters[4]));
            if (
              sql.includes(
                "last_error_code = 'legacy_resend_cancel_outcome_unknown'"
              )
            ) {
              found.last_error_code = 'legacy_resend_cancel_outcome_unknown';
            }
          }
          return {
            rows: found ? [{ id: found.id }] : [],
          } as unknown as SqlQueryResult<Row>;
        }
        case 'cancel-read-cutover-configuration':
          return {
            rows: state.configuration ? [state.configuration] : [],
          } as unknown as SqlQueryResult<Row>;
        case 'cancel-read-contact-markers':
          return {
            rows: state.contactMarkers.map((provider_contact_id) => ({
              provider_contact_id,
            })),
          } as unknown as SqlQueryResult<Row>;
        case 'cancel-read-immutable-schedules':
          return { rows: state.jobs } as unknown as SqlQueryResult<Row>;
        case 'cancel-read-unresolved-schedules':
          return {
            rows: state.jobs.filter(
              ({ payload }) => payload['provider_state'] === 'scheduled'
            ),
          } as unknown as SqlQueryResult<Row>;
        case 'cancel-settle-job': {
          if (state.failSettlementOnce) {
            state.failSettlementOnce = false;
            throw new Error('private database failure');
          }
          const found = state.jobs.find(
            ({ id, provider_email_id, payload, lease_token }) =>
              id === parameters[0] &&
              provider_email_id === parameters[2] &&
              payload['provider_state'] === 'scheduled' &&
              (parameters[3] === null || lease_token === parameters[3])
          );
          if (!found) return { rows: [] } as SqlQueryResult<Row>;
          found.status = 'cancelled';
          found.last_error_code = null;
          found.lease_token = null;
          found.lease_until = null;
          found.payload = {
            ...found.payload,
            provider_state: 'cancelled',
            cancelled_at: new Date(String(parameters[1])).toISOString(),
          };
          return {
            rows: [{ id: found.id }],
          } as unknown as SqlQueryResult<Row>;
        }
        case 'cancel-insert-activity': {
          const eventKey = String(parameters[0]);
          if (state.activities.has(eventKey)) {
            if (/on conflict \(event_key\) do nothing/u.test(sql)) {
              return { rows: [] } as SqlQueryResult<Row>;
            }
            throw new Error('activity conflict');
          }
          const activity = {
            event_key: eventKey,
            contact_id: parameters[1],
            occurred_at: parameters[2],
            kind: 'legacy.resend_schedule_cancelled',
            data: { provider: 'resend' },
          };
          state.activities.set(eventKey, activity);
          return { rows: [activity] } as unknown as SqlQueryResult<Row>;
        }
        case 'cancel-persist-error': {
          if (state.ignoreErrorPersist) {
            return { rows: [] } as SqlQueryResult<Row>;
          }
          const found = state.jobs.find(({ id }) => id === parameters[0]);
          if (
            found &&
            found.payload['provider_state'] === 'scheduled' &&
            (parameters[4] === null || found.lease_token === parameters[4])
          ) {
            found.last_error_code = String(parameters[2]);
            found.lease_token = null;
            found.lease_until = null;
            return {
              rows: [{ id: found.id }],
            } as unknown as SqlQueryResult<Row>;
          }
          return { rows: [] } as SqlQueryResult<Row>;
        }
        default:
          throw new Error(`Unexpected SQL marker: ${marker(sql) ?? 'missing'}`);
      }
    },
  };
  return {
    execute: transaction.execute,
    async transaction<T>(
      operation: (inner: SqlTransaction) => Promise<T>
    ): Promise<T> {
      const jobs = structuredClone(state.jobs);
      const activities = structuredClone(state.activities);
      try {
        return await operation(transaction);
      } catch (error) {
        state.jobs = jobs;
        state.activities = activities;
        throw error;
      }
    },
    close: vi.fn(async () => undefined),
  };
}

type ProviderEmail = Record<string, unknown> & { id: string };

function exactProviderEmail(
  id: string,
  lastEvent:
    | 'bounced'
    | 'canceled'
    | 'clicked'
    | 'complained'
    | 'delivered'
    | 'delivery_delayed'
    | 'failed'
    | 'opened'
    | 'queued'
    | 'scheduled'
    | 'sent'
): Record<string, unknown> {
  return {
    bcc: null,
    cc: null,
    created_at: '2026-09-01T00:00:00.000Z',
    from: 'Private Sender <private-sender@example.invalid>',
    html: null,
    id,
    last_event: lastEvent,
    object: 'email',
    reply_to: null,
    scheduled_at: lastEvent === 'scheduled' ? '2026-09-03T12:00:00.000Z' : null,
    subject: 'Private subject',
    text: null,
    to: ['private-recipient@example.invalid'],
  };
}

function providerError(
  name: string,
  statusCode: number | null,
  message = 'private-provider-message@example.invalid'
): Record<string, unknown> {
  return { message, name, statusCode };
}

function providerHarness(input?: {
  pages?: ProviderEmail[][];
  getResults?: Record<string, { data: unknown | null; error: unknown | null }>;
  cancelResults?: Record<
    string,
    { data: unknown | null; error: unknown | null }
  >;
}) {
  const canceledIds = new Set<string>();
  let pages = input?.pages ?? [
    [
      {
        id: scheduledProviderId,
        to: ['private-recipient@example.invalid'],
        subject: 'Private subject',
        last_event: 'scheduled',
      },
    ],
  ];
  const list = vi.fn(
    async (
      options: { limit: number; after?: string },
      _request?: ProviderRequestOptions
    ) => {
      const index = options.after
        ? pages.findIndex((page) => page.at(-1)?.id === options.after) + 1
        : 0;
      return {
        data: {
          object: 'list' as const,
          data: pages[index] ?? [],
          has_more: index < pages.length - 1,
        },
        error: null,
      };
    }
  );
  const get = vi.fn(async (id: string, _request?: ProviderRequestOptions) =>
    input?.getResults?.[id]
      ? input.getResults[id]
      : canceledIds.has(id)
      ? { data: exactProviderEmail(id, 'canceled'), error: null }
      : { data: null, error: { message: 'private provider error' } }
  );
  const cancel = vi.fn(
    async (id: string, _request?: ProviderRequestOptions) => {
      const result = input?.cancelResults?.[id] ?? {
        data: { id, object: 'email' },
        error: null,
      };
      if (result.error === null && result.data !== null) {
        canceledIds.add(id);
        pages = pages.map((page) => page.filter((email) => email.id !== id));
      }
      return result;
    }
  );
  return {
    list,
    get,
    cancel,
    client: { emails: { list, get, cancel } } as LegacyCancellationClient,
  };
}

function mainHarness(input?: {
  state?: CancellationState;
  provider?: ReturnType<typeof providerHarness>;
  executor?: SqlExecutor;
  environment?: Record<string, string | undefined>;
  now?: () => Date;
}) {
  const state = input?.state ?? cancellationState();
  const provider = input?.provider ?? providerHarness();
  const executor = input?.executor ?? cancellationExecutor(state);
  const output: string[] = [];
  const errors: string[] = [];
  const createClient = vi.fn(() => provider.client);
  const createExecutor = vi.fn((databaseUrl: string) => {
    void databaseUrl;
    return executor;
  });
  const dependencies: LegacyCancellationDependencies = {
    environment: input?.environment ?? {
      RESEND_API_KEY: 'private-api-key',
      TEST_DATABASE_URL: 'postgres://private-test-database',
    },
    createClient,
    createExecutor,
    writeOutput: (line) => output.push(line),
    writeError: (line) => errors.push(line),
    now: input?.now ?? (() => new Date(now)),
  };
  return {
    state,
    provider,
    executor,
    output,
    errors,
    createClient,
    createExecutor,
    dependencies,
  };
}

function applyArguments(expectedScheduled = 1): string[] {
  return ['--apply', '--expected-scheduled', String(expectedScheduled)];
}

function allRenderedText(harness: ReturnType<typeof mainHarness>): string {
  return [...harness.output, ...harness.errors].join('\n');
}

function cancellationWriteMarkers(state: CancellationState): string[] {
  const writeMarkers = new Set([
    'cancel-claim-job',
    'cancel-insert-activity',
    'cancel-persist-error',
    'cancel-settle-job',
  ]);
  return state.queries
    .map(({ sql }) => marker(sql))
    .filter(
      (value): value is string => value !== undefined && writeMarkers.has(value)
    );
}

describe('mainCancelResendLifecycle', () => {
  it('uses the exact encoded Resend list, get, and cancellation wire contract', async () => {
    const calls: Array<{
      input: string | URL | Request;
      init?: RequestInit;
    }> = [];
    const fetchImplementation = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ input, init });
        const url = String(input);
        const payload = url.endsWith('/cancel')
          ? { id: 'fixture/id?part', object: 'email' }
          : url.includes('?')
          ? { object: 'list', data: [], has_more: false }
          : exactProviderEmail('fixture/id?part', 'scheduled');
        return new Response(JSON.stringify(payload), {
          headers: { 'content-type': 'application/json' },
        });
      }
    );
    const client = createAbortableResendCancellationClient(
      'synthetic-key',
      fetchImplementation as typeof fetch
    );
    const controller = new AbortController();

    await client.emails.list(
      { limit: 100, after: 'fixture/cursor?' },
      { signal: controller.signal }
    );
    await client.emails.get('fixture/id?part', {
      signal: controller.signal,
    });
    await client.emails.cancel('fixture/id?part', {
      signal: controller.signal,
    });

    expect(calls.map(({ input }) => String(input))).toEqual([
      'https://api.resend.com/emails?limit=100&after=fixture%2Fcursor%3F',
      'https://api.resend.com/emails/fixture%2Fid%3Fpart',
      'https://api.resend.com/emails/fixture%2Fid%3Fpart/cancel',
    ]);
    expect(calls.map(({ init }) => init?.method)).toEqual([
      'GET',
      'GET',
      'POST',
    ]);
    const cancellationHeaders = new Headers(calls[2]?.init?.headers);
    expect({
      authorizationIsCorrect:
        cancellationHeaders.get('authorization') === 'Bearer synthetic-key',
      contentTypeIsCorrect:
        cancellationHeaders.get('content-type') === 'application/json',
    }).toEqual({ authorizationIsCorrect: true, contentTypeIsCorrect: true });
    expect(calls.map(({ init }) => init?.signal)).toEqual([
      controller.signal,
      controller.signal,
      controller.signal,
    ]);
  });

  it.each([
    [
      'declared oversized list',
      'list',
      new Response(
        JSON.stringify({ object: 'list', data: [], has_more: false }),
        {
          headers: { 'content-length': '1048577' },
        }
      ),
    ],
    [
      'chunked oversized get',
      'get',
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('"'));
            controller.enqueue(new Uint8Array(1_048_576).fill(97));
            controller.enqueue(new TextEncoder().encode('"'));
            controller.close();
          },
        })
      ),
    ],
    [
      'understated oversized cancellation',
      'cancel',
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('"'));
            controller.enqueue(new Uint8Array(1_048_576).fill(97));
            controller.enqueue(new TextEncoder().encode('"'));
            controller.close();
          },
        }),
        { headers: { 'content-length': '2' } }
      ),
    ],
    ['invalid JSON list', 'list', new Response('{')],
    [
      'malformed encoding get',
      'get',
      new Response(Uint8Array.from([0xc3, 0x28])),
    ],
    [
      'truncated cancellation',
      'cancel',
      new Response('{}', { headers: { 'content-length': '10' } }),
    ],
  ] as const)(
    'bounds a %s response before JSON parsing',
    async (_name, method, response) => {
      const fetchImplementation = vi.fn(async () => response);
      const client = createAbortableResendCancellationClient(
        'synthetic-key',
        fetchImplementation as typeof fetch
      );
      const result =
        method === 'list'
          ? await client.emails.list({ limit: 100 })
          : method === 'get'
          ? await client.emails.get('fixture-id')
          : await client.emails.cancel('fixture-id');

      expect(result).toEqual({ data: null, error: null });
    }
  );

  it.each(['list', 'get', 'cancel'] as const)(
    'uses the supplied AbortSignal in the default %s transport',
    async (method) => {
      const fetchImplementation = vi.fn(
        async (_input: string | URL | Request, init?: RequestInit) =>
          waitForAbort<Response>({ signal: init?.signal ?? undefined })
      );
      const client = createAbortableResendCancellationClient(
        'private-api-key',
        fetchImplementation as typeof fetch
      );
      const controller = new AbortController();
      const request =
        method === 'list'
          ? client.emails.list({ limit: 100 }, { signal: controller.signal })
          : method === 'get'
          ? client.emails.get(scheduledProviderId, {
              signal: controller.signal,
            })
          : client.emails.cancel(scheduledProviderId, {
              signal: controller.signal,
            });

      controller.abort();

      await expect(request).rejects.toMatchObject({ name: 'AbortError' });
      expect(fetchImplementation).toHaveBeenCalledTimes(1);
      expect(fetchImplementation.mock.calls[0]?.[1]?.signal).toBe(
        controller.signal
      );
    }
  );

  it.each(['list', 'get', 'cancel'] as const)(
    'aborts and cancels a hanging default %s response body stream',
    async (method) => {
      let bodyCanceled = false;
      const response = new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"data":'));
          },
          pull: () => new Promise<void>(() => undefined),
          cancel() {
            bodyCanceled = true;
          },
        })
      );
      const fetchImplementation = vi.fn(async () => response);
      const client = createAbortableResendCancellationClient(
        'synthetic-key',
        fetchImplementation as typeof fetch
      );
      const controller = new AbortController();
      const request =
        method === 'list'
          ? client.emails.list({ limit: 100 }, { signal: controller.signal })
          : method === 'get'
          ? client.emails.get('fixture-id', { signal: controller.signal })
          : client.emails.cancel('fixture-id', { signal: controller.signal });
      await vi.waitFor(() => expect(fetchImplementation).toHaveBeenCalled());

      controller.abort();

      await expect(request).rejects.toMatchObject({ name: 'AbortError' });
      expect(bodyCanceled).toBe(true);
    }
  );

  it('maps a malformed default list body to a closed read-only provider category', async () => {
    const client = createAbortableResendCancellationClient(
      'synthetic-key',
      vi.fn(async () => new Response('{')) as typeof fetch
    );
    const harness = mainHarness();

    expect(
      await mainCancelResendLifecycle(['--dry-run'], {
        ...harness.dependencies,
        createClient: () => client,
      })
    ).toBe(1);
    expect(harness.errors).toEqual([
      'Resend lifecycle cancellation failed: provider_emails_response_malformed',
    ]);
    expect(cancellationWriteMarkers(harness.state)).toEqual([]);
  });

  it('maps a malformed default exact-get body to the closed lookup category', async () => {
    const responses = [
      new Response(
        JSON.stringify({ object: 'list', data: [], has_more: false })
      ),
      new Response(Uint8Array.from([0xc3, 0x28])),
    ];
    const client = createAbortableResendCancellationClient(
      'synthetic-key',
      vi.fn(async () => responses.shift() as Response) as typeof fetch
    );
    const harness = mainHarness();

    expect(
      await mainCancelResendLifecycle(applyArguments(), {
        ...harness.dependencies,
        createClient: () => client,
      })
    ).toBe(1);
    expect(harness.errors).toEqual([
      'Resend lifecycle cancellation failed: provider_lookup_malformed',
    ]);
    expect(harness.state.jobs[0]?.last_error_code).toBe(
      'legacy_resend_lookup_malformed'
    );
  });

  it('maps a malformed default cancellation body to outcome unknown', async () => {
    const responses = [
      new Response(
        JSON.stringify({
          object: 'list',
          data: [{ id: scheduledProviderId, last_event: 'scheduled' }],
          has_more: false,
        })
      ),
      new Response('{'),
    ];
    const client = createAbortableResendCancellationClient(
      'synthetic-key',
      vi.fn(async () => responses.shift() as Response) as typeof fetch
    );
    const harness = mainHarness();

    expect(
      await mainCancelResendLifecycle(applyArguments(), {
        ...harness.dependencies,
        createClient: () => client,
      })
    ).toBe(1);
    expect(harness.errors).toEqual([
      'Resend lifecycle cancellation failed: provider_cancel_outcome_unknown',
    ]);
    expect(harness.state.jobs[0]?.last_error_code).toBe(
      'legacy_resend_cancel_outcome_unknown'
    );
  });

  it('dry-run reads Neon and every bounded Resend page, emits aggregate counts, and never cancels', async () => {
    const provider = providerHarness({
      pages: [
        [{ id: scheduledProviderId, last_event: 'scheduled' }],
        [{ id: 'opaque_delivered_1', last_event: 'delivered' }],
      ],
    });
    const harness = mainHarness({ provider });

    const exitCode = await mainCancelResendLifecycle(
      ['--dry-run'],
      harness.dependencies
    );

    expect(exitCode).toBe(0);
    expect(harness.createExecutor).toHaveBeenCalledWith(
      'postgres://private-test-database'
    );
    expect(provider.list).toHaveBeenNthCalledWith(
      1,
      { limit: 100 },
      { signal: expect.any(AbortSignal) }
    );
    expect(provider.list).toHaveBeenNthCalledWith(
      2,
      {
        limit: 100,
        after: scheduledProviderId,
      },
      { signal: expect.any(AbortSignal) }
    );
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(JSON.parse(String(harness.output[0]))).toEqual({
      command: 'cancel-resend-lifecycle',
      mode: 'dry_run',
      immutable_contacts: 1,
      immutable_scheduled: 1,
      unresolved_imported: 1,
      provider_scheduled: 1,
      missing_unresolved: 0,
      unexpected_provider_scheduled: 0,
      cancellation_remaining_seconds: 86_100,
    });
  });

  it('fails a positive dry-run when the immutable window expires at output time without writing', async () => {
    const deadline = new Date('2026-09-02T12:00:00.004Z');
    const state = cancellationState({
      deadline: deadline.toISOString(),
      jobs: [
        legacyJob({
          available_at: new Date(deadline.getTime() + 5 * 60_000),
        }),
      ],
    });
    let clockReads = 0;
    const harness = mainHarness({
      state,
      now: () => {
        clockReads += 1;
        return new Date(
          clockReads < 4 ? deadline.getTime() - 1 : deadline.getTime()
        );
      },
    });

    expect(
      await mainCancelResendLifecycle(['--dry-run'], harness.dependencies)
    ).toBe(1);
    expect(harness.output).toEqual([]);
    expect(harness.errors).toEqual([
      'Resend lifecycle cancellation failed: cancellation_deadline_expired',
    ]);
    expect(cancellationWriteMarkers(state)).toEqual([]);
    expect(state.jobs[0]?.last_error_code).toBeNull();
  });

  it('dry-run exact-checks missing unresolved records and rejects ambiguity without mutation', async () => {
    const provider = providerHarness({
      pages: [[]],
      getResults: {
        [scheduledProviderId]: {
          data: exactProviderEmail(scheduledProviderId, 'delivered'),
          error: null,
        },
      },
    });
    const harness = mainHarness({ provider });

    const exitCode = await mainCancelResendLifecycle(
      ['--dry-run'],
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(provider.get).toHaveBeenCalledWith(scheduledProviderId, {
      signal: expect.any(AbortSignal),
    });
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(harness.state.jobs[0]).toMatchObject({
      status: 'pending',
      payload: { provider_state: 'scheduled' },
      last_error_code: null,
    });
  });

  it('aborts a hung initial provider list at the closed request maximum', async () => {
    vi.useFakeTimers();
    try {
      const provider = providerHarness();
      provider.list.mockImplementationOnce((_options, request) =>
        waitForAbort(request)
      );
      const harness = mainHarness({ provider });
      let settled = false;
      const result = mainCancelResendLifecycle(
        ['--dry-run'],
        harness.dependencies
      ).then((exitCode) => {
        settled = true;
        return exitCode;
      });

      await vi.advanceTimersByTimeAsync(9_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect(await result).toBe(1);
      expect(provider.list.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      expect(harness.errors).toEqual([
        'Resend lifecycle cancellation failed: provider_emails_request_timeout',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps an apply preflight read-only when the initial provider page times out', async () => {
    vi.useFakeTimers();
    try {
      const state = cancellationState();
      const provider = providerHarness();
      provider.list.mockImplementationOnce((_options, request) =>
        waitForAbort(request)
      );
      const harness = mainHarness({ state, provider });
      const result = mainCancelResendLifecycle(
        applyArguments(),
        harness.dependencies
      );

      await vi.advanceTimersByTimeAsync(10_000);

      expect(await result).toBe(1);
      expect(cancellationWriteMarkers(state)).toEqual([]);
      expect(state.jobs[0]?.last_error_code).toBeNull();
      expect(state.activities).toHaveLength(0);
      expect(provider.cancel).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps an apply preflight read-only when a later pagination page times out', async () => {
    vi.useFakeTimers();
    try {
      const provider = providerHarness();
      provider.list
        .mockResolvedValueOnce({
          data: {
            object: 'list',
            data: [{ id: scheduledProviderId, last_event: 'scheduled' }],
            has_more: true,
          },
          error: null,
        })
        .mockImplementationOnce((_options, request) => waitForAbort(request));
      const harness = mainHarness({ provider });
      const result = mainCancelResendLifecycle(
        applyArguments(),
        harness.dependencies
      );

      await vi.advanceTimersByTimeAsync(10_000);

      expect(await result).toBe(1);
      expect(provider.list).toHaveBeenCalledTimes(2);
      expect(provider.cancel).not.toHaveBeenCalled();
      expect(cancellationWriteMarkers(harness.state)).toEqual([]);
      expect(harness.state.jobs[0]?.last_error_code).toBeNull();
      expect(harness.state.activities).toHaveLength(0);
      expect(allRenderedText(harness)).not.toMatch(/@|opaque_|private/u);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps an apply preflight read-only when a later provider page is malformed', async () => {
    const state = cancellationState();
    const provider = providerHarness();
    provider.list
      .mockResolvedValueOnce({
        data: {
          object: 'list',
          data: [{ id: scheduledProviderId, last_event: 'scheduled' }],
          has_more: true,
        },
        error: null,
      })
      .mockResolvedValueOnce(undefined as never);
    const harness = mainHarness({ state, provider });

    expect(
      await mainCancelResendLifecycle(applyArguments(), harness.dependencies)
    ).toBe(1);
    expect(provider.list).toHaveBeenCalledTimes(2);
    expect(cancellationWriteMarkers(state)).toEqual([]);
    expect(state.jobs[0]?.last_error_code).toBeNull();
    expect(state.activities).toHaveLength(0);
    expect(allRenderedText(harness)).not.toMatch(/@|opaque_|private/u);
  });

  it('aborts a hung exact lookup and persists a closed lookup timeout', async () => {
    vi.useFakeTimers();
    try {
      const provider = providerHarness({ pages: [[]] });
      provider.get.mockImplementationOnce((_id, request) =>
        waitForAbort(request)
      );
      const harness = mainHarness({ provider });
      const result = mainCancelResendLifecycle(
        applyArguments(),
        harness.dependencies
      );

      await vi.advanceTimersByTimeAsync(10_000);

      expect(await result).toBe(1);
      expect(provider.get).toHaveBeenCalledTimes(1);
      expect(provider.cancel).not.toHaveBeenCalled();
      expect(harness.state.jobs[0]?.last_error_code).toBe(
        'legacy_resend_lookup_timeout'
      );
      expect(allRenderedText(harness)).not.toMatch(/@|opaque_|private/u);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps an ambiguously timed-out cancel unresolved and starts no later cancel', async () => {
    vi.useFakeTimers();
    try {
      const state = cancellationState({
        jobs: [
          legacyJob(),
          legacyJob({
            id: otherJobId,
            provider_email_id: otherScheduledProviderId,
          }),
        ],
      });
      const provider = providerHarness({
        pages: [
          [
            { id: scheduledProviderId, last_event: 'scheduled' },
            { id: otherScheduledProviderId, last_event: 'scheduled' },
          ],
        ],
      });
      provider.cancel.mockImplementationOnce((_id, request) =>
        waitForAbort(request)
      );
      const harness = mainHarness({ state, provider });
      const result = mainCancelResendLifecycle(
        applyArguments(2),
        harness.dependencies
      );

      await vi.advanceTimersByTimeAsync(10_000);

      expect(await result).toBe(1);
      expect(provider.cancel).toHaveBeenCalledTimes(1);
      expect(state.jobs[0]).toMatchObject({
        payload: { provider_state: 'scheduled' },
        last_error_code: 'legacy_resend_cancel_outcome_unknown',
      });
      expect(state.jobs[1]?.payload['provider_state']).toBe('scheduled');
      expect(state.activities).toHaveLength(0);
      expect(allRenderedText(harness)).not.toMatch(/@|opaque_|private/u);
    } finally {
      vi.useRealTimers();
    }
  });

  it('exact-checks an earlier cancel timeout before any later-run cancellation', async () => {
    vi.useFakeTimers();
    const state = cancellationState();
    const provider = providerHarness({
      getResults: {
        [scheduledProviderId]: {
          data: exactProviderEmail(scheduledProviderId, 'canceled'),
          error: null,
        },
      },
    });
    provider.cancel.mockImplementationOnce((_id, request) =>
      waitForAbort(request)
    );
    const first = mainHarness({ state, provider });
    try {
      const firstResult = mainCancelResendLifecycle(
        applyArguments(),
        first.dependencies
      );
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await firstResult).toBe(1);
    } finally {
      vi.useRealTimers();
    }
    let rerunListCount = 0;
    provider.list.mockImplementation(async () => {
      rerunListCount += 1;
      return {
        data: {
          object: 'list' as const,
          data:
            rerunListCount === 1
              ? [{ id: scheduledProviderId, last_event: 'scheduled' }]
              : [],
          has_more: false,
        },
        error: null,
      };
    });
    const second = mainHarness({ state, provider });

    expect(
      await mainCancelResendLifecycle(applyArguments(), second.dependencies)
    ).toBe(0);
    expect(provider.get).toHaveBeenCalledWith(scheduledProviderId, {
      signal: expect.any(AbortSignal),
    });
    expect(provider.cancel).toHaveBeenCalledTimes(1);
    expect(state.jobs[0]?.payload['provider_state']).toBe('cancelled');
  });

  it('derives provider timeout from the shorter immutable cancellation window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const deadline = new Date(now.getTime() + 50);
      const state = cancellationState({
        deadline: deadline.toISOString(),
        jobs: [
          legacyJob({
            available_at: new Date(deadline.getTime() + 5 * 60_000),
          }),
        ],
      });
      const provider = providerHarness();
      provider.list.mockImplementationOnce((_options, request) =>
        waitForAbort(request)
      );
      const harness = mainHarness({
        state,
        provider,
        now: () => new Date(Date.now()),
      });
      let settled = false;
      const result = mainCancelResendLifecycle(
        ['--dry-run'],
        harness.dependencies
      ).then((exitCode) => {
        settled = true;
        return exitCode;
      });

      await vi.advanceTimersByTimeAsync(49);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect(await result).toBe(1);
      expect(provider.list.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      expect(harness.errors).toEqual([
        'Resend lifecycle cancellation failed: provider_emails_request_timeout',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('dry-run rejects a provider-scheduled record whose immutable job is already settled', async () => {
    const state = cancellationState({
      jobs: [
        legacyJob({
          status: 'cancelled',
          payload: {
            imported: true,
            legacy_type: 'scheduled_message',
            provider: 'resend',
            provider_state: 'cancelled',
            cancelled_at: '2026-09-02T11:30:00.000Z',
          },
        }),
      ],
    });
    const harness = mainHarness({ state });

    const exitCode = await mainCancelResendLifecycle(
      ['--dry-run'],
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(harness.provider.get).not.toHaveBeenCalled();
    expect(harness.provider.cancel).not.toHaveBeenCalled();
  });

  it('requires expected scheduled and the importer database guard before provider or Neon access', async () => {
    for (const testCase of [
      {
        argv: ['--apply'],
        environment: {
          RESEND_API_KEY: 'private-api-key',
          TEST_DATABASE_URL: 'postgres://private-test-database',
        },
        expectedCode: 2,
      },
      {
        argv: applyArguments(),
        environment: {
          RESEND_API_KEY: 'private-api-key',
          DATABASE_URL: 'postgres://private-production-database',
        },
        expectedCode: 1,
      },
      {
        argv: [...applyArguments(), '--allow-database-url-apply'],
        environment: {
          RESEND_API_KEY: 'private-api-key',
          TEST_DATABASE_URL: 'postgres://private-test-database',
          DATABASE_URL: 'postgres://private-production-database',
        },
        expectedCode: 1,
      },
    ]) {
      const harness = mainHarness({ environment: testCase.environment });
      const exitCode = await mainCancelResendLifecycle(
        testCase.argv,
        harness.dependencies
      );
      expect(exitCode).toBe(testCase.expectedCode);
      expect(harness.createClient).not.toHaveBeenCalled();
      expect(harness.createExecutor).not.toHaveBeenCalled();
    }
  });

  it('allows only one concurrent apply operator to reach an exact provider cancel', async () => {
    const state = cancellationState();
    const provider = providerHarness();
    let releaseFirstCancel: (() => void) | undefined;
    const firstCancelReleased = new Promise<void>((resolve) => {
      releaseFirstCancel = resolve;
    });
    const normalCancel = provider.cancel.getMockImplementation();
    let cancelCount = 0;
    provider.cancel.mockImplementation(async (...parameters) => {
      cancelCount += 1;
      if (cancelCount === 1) await firstCancelReleased;
      return normalCancel?.(...parameters) as Promise<{
        data: unknown | null;
        error: unknown | null;
      }>;
    });
    const first = mainHarness({
      state,
      provider,
      executor: cancellationExecutor(state),
    });
    const second = mainHarness({
      state,
      provider,
      executor: cancellationExecutor(state),
    });

    const firstResult = mainCancelResendLifecycle(
      applyArguments(),
      first.dependencies
    );
    await vi.waitFor(() => expect(provider.cancel).toHaveBeenCalledTimes(1));
    const secondResult = await mainCancelResendLifecycle(
      applyArguments(),
      second.dependencies
    );
    releaseFirstCancel?.();

    expect(secondResult).toBe(1);
    expect(second.errors).toEqual([
      'Resend lifecycle cancellation failed: cancellation_operator_already_running',
    ]);
    expect(await firstResult).toBe(0);
    expect(provider.cancel).toHaveBeenCalledTimes(1);
  });

  it('allows DATABASE_URL apply only with the explicit acknowledgement', async () => {
    const harness = mainHarness({
      environment: {
        RESEND_API_KEY: 'private-api-key',
        DATABASE_URL: 'postgres://private-production-database',
      },
    });

    const exitCode = await mainCancelResendLifecycle(
      [...applyArguments(), '--allow-database-url-apply'],
      harness.dependencies
    );

    expect(exitCode).toBe(0);
    expect(harness.createExecutor).toHaveBeenCalledWith(
      'postgres://private-production-database'
    );
  });

  it('halts before mutation when provider has a scheduled ID outside the immutable imported set', async () => {
    const provider = providerHarness({
      pages: [
        [
          { id: scheduledProviderId, last_event: 'scheduled' },
          { id: 'opaque_unexpected_1', last_event: 'scheduled' },
        ],
      ],
    });
    const state = cancellationState({
      deadline: futureDeadline,
      jobs: [
        legacyJob({
          available_at: new Date('2026-09-02T12:05:00.000Z'),
        }),
      ],
    });
    const harness = mainHarness({ state, provider });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(),
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(provider.get).not.toHaveBeenCalled();
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(cancellationWriteMarkers(state)).toEqual([]);
    expect(harness.state.activities).toHaveLength(0);
    expect(state.jobs[0]?.last_error_code).toBeNull();
  });

  it('checks missing unresolved IDs exactly before comparing the verified scheduled subset', async () => {
    const provider = providerHarness({
      pages: [[]],
      getResults: {
        [scheduledProviderId]: {
          data: exactProviderEmail(scheduledProviderId, 'scheduled'),
          error: null,
        },
      },
    });
    const harness = mainHarness({ provider });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(),
      harness.dependencies
    );

    expect(exitCode).toBe(0);
    expect(provider.get).toHaveBeenCalledWith(scheduledProviderId, {
      signal: expect.any(AbortSignal),
    });
    expect(provider.cancel).toHaveBeenCalledWith(scheduledProviderId, {
      signal: expect.any(AbortSignal),
    });
  });

  it('requires a stored non-null future deadline for a positive schedule count', async () => {
    for (const deadline of [null, now.toISOString()]) {
      const state = cancellationState({
        deadline,
        ...(deadline === null
          ? {}
          : {
              jobs: [
                legacyJob({
                  available_at: new Date('2026-09-02T12:05:00.000Z'),
                }),
              ],
            }),
      });
      const harness = mainHarness({ state });

      const exitCode = await mainCancelResendLifecycle(
        applyArguments(),
        harness.dependencies
      );

      expect(exitCode).toBe(1);
      expect(harness.provider.cancel).not.toHaveBeenCalled();
    }
  });

  it('accepts the zero-schedule null-deadline boundary with no get or cancel calls', async () => {
    const state = cancellationState({
      expectedContacts: 0,
      expectedScheduled: 0,
      deadline: null,
      contactMarkers: [],
      jobs: [],
    });
    const provider = providerHarness({ pages: [[]] });
    const harness = mainHarness({ state, provider });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(0),
      harness.dependencies
    );

    expect(exitCode).toBe(0);
    expect(provider.get).not.toHaveBeenCalled();
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(JSON.parse(String(harness.output[0]))).toMatchObject({
      unresolved_imported: 0,
      unexpected_provider_scheduled: 0,
      provider_scheduled_remaining: 0,
      cancellation_remaining_seconds: null,
    });
  });

  it('rejects zero expected schedules unless deadline and all schedule inventories are empty', async () => {
    const cases = [
      {
        state: cancellationState({
          expectedContacts: 0,
          expectedScheduled: 0,
          deadline: futureDeadline,
          contactMarkers: [],
          jobs: [],
        }),
        provider: providerHarness({ pages: [[]] }),
      },
      {
        state: cancellationState({
          expectedScheduled: 0,
          deadline: null,
        }),
        provider: providerHarness({ pages: [[]] }),
      },
      {
        state: cancellationState({
          expectedContacts: 0,
          expectedScheduled: 0,
          deadline: null,
          contactMarkers: [],
          jobs: [],
        }),
        provider: providerHarness(),
      },
    ];
    for (const testCase of cases) {
      const harness = mainHarness(testCase);
      const exitCode = await mainCancelResendLifecycle(
        applyArguments(0),
        harness.dependencies
      );
      expect(exitCode).toBe(1);
      expect(testCase.provider.get).not.toHaveBeenCalled();
      expect(testCase.provider.cancel).not.toHaveBeenCalled();
    }
  });

  it('cancels one exact provider record and atomically settles only its job with one stable activity', async () => {
    const second = legacyJob({
      id: otherJobId,
      provider_email_id: otherScheduledProviderId,
    });
    const state = cancellationState({ jobs: [legacyJob(), second] });
    const provider = providerHarness({
      pages: [
        [
          { id: scheduledProviderId, last_event: 'scheduled' },
          { id: otherScheduledProviderId, last_event: 'scheduled' },
        ],
      ],
    });
    const normalCancel = provider.cancel.getMockImplementation();
    provider.cancel.mockImplementation(async (id) => {
      const claimed = state.jobs.find(
        ({ provider_email_id }) => provider_email_id === id
      );
      expect(claimed).toMatchObject({
        last_error_code: 'legacy_resend_cancel_outcome_unknown',
        lease_token: expect.any(String),
        lease_until: expect.any(Date),
      });
      return normalCancel?.(id) as Promise<{
        data: unknown | null;
        error: unknown | null;
      }>;
    });
    const harness = mainHarness({ state, provider });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(2),
      harness.dependencies
    );

    expect(exitCode).toBe(0);
    expect(provider.cancel.mock.calls.map(([id]) => id)).toEqual([
      scheduledProviderId,
      otherScheduledProviderId,
    ]);
    for (const call of provider.cancel.mock.calls) {
      expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(state.jobs).toMatchObject([
      {
        id: jobId,
        status: 'cancelled',
        payload: { provider_state: 'cancelled' },
      },
      {
        id: otherJobId,
        status: 'cancelled',
        payload: { provider_state: 'cancelled' },
      },
    ]);
    expect([...state.activities.keys()]).toEqual([
      `legacy:resend:scheduled:${jobId}:cancelled`,
      `legacy:resend:scheduled:${otherJobId}:cancelled`,
    ]);
    expect(JSON.parse(String(harness.output[0]))).toMatchObject({
      cancellation_remaining_seconds: 86_100,
    });
    const settlement = state.queries.find(
      ({ sql }) => marker(sql) === 'cancel-settle-job'
    );
    expect(settlement?.parameters.slice(0, 3)).toEqual([
      jobId,
      now,
      scheduledProviderId,
    ]);
    expect(settlement?.parameters[3]).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u
    );
  });

  it('persists one closed category and leaves the exact job unresolved on provider error or ambiguity', async () => {
    const cases: Array<
      [
        { data: unknown | null; error: unknown | null },
        (
          | 'legacy_resend_cancel_provider_failed'
          | 'legacy_resend_cancel_outcome_unknown'
        )
      ]
    > = [
      [
        { data: null, error: { message: 'raw provider failure' } },
        'legacy_resend_cancel_provider_failed',
      ],
      [{ data: null, error: null }, 'legacy_resend_cancel_outcome_unknown'],
      [
        { data: { id: scheduledProviderId }, error: null },
        'legacy_resend_cancel_outcome_unknown',
      ],
    ];
    for (const [result, expectedCode] of cases) {
      const state = cancellationState();
      const provider = providerHarness({
        cancelResults: { [scheduledProviderId]: result },
      });
      const harness = mainHarness({ state, provider });

      const exitCode = await mainCancelResendLifecycle(
        applyArguments(),
        harness.dependencies
      );

      expect(exitCode).toBe(1);
      expect(state.jobs[0]).toMatchObject({
        status: 'pending',
        payload: { provider_state: 'scheduled' },
        last_error_code: expectedCode,
      });
      expect(allRenderedText(harness)).not.toContain('raw provider failure');
    }
  });

  it('fails closed when the exact cancellation error category cannot be persisted', async () => {
    const state = cancellationState();
    state.ignoreErrorPersist = true;
    const provider = providerHarness({
      cancelResults: {
        [scheduledProviderId]: {
          data: null,
          error: { message: 'private provider error' },
        },
      },
    });
    const harness = mainHarness({ state, provider });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(),
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(harness.errors).toEqual([
      'Resend lifecycle cancellation failed: database_cancellation_failed',
    ]);
    expect(state.jobs[0]?.last_error_code).toBe(
      'legacy_resend_cancel_outcome_unknown'
    );
  });

  it('rolls back exact job settlement when the stable cancellation activity conflicts', async () => {
    const state = cancellationState();
    const eventKey = `legacy:resend:scheduled:${jobId}:cancelled`;
    state.activities.set(eventKey, {
      event_key: eventKey,
      kind: 'conflicting.kind',
    });
    const harness = mainHarness({ state });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(),
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(state.jobs[0]).toMatchObject({
      status: 'pending',
      payload: { provider_state: 'scheduled' },
    });
    expect(state.activities.get(eventKey)?.['kind']).toBe('conflicting.kind');
  });

  it('recovers provider success plus Neon settlement failure through exact canceled lookup without a second cancel', async () => {
    const state = cancellationState();
    state.failSettlementOnce = true;
    const provider = providerHarness();
    const first = mainHarness({ state, provider });

    expect(
      await mainCancelResendLifecycle(applyArguments(), first.dependencies)
    ).toBe(1);
    expect(provider.cancel).toHaveBeenCalledTimes(1);
    expect(state.jobs[0]?.payload['provider_state']).toBe('scheduled');
    expect(state.jobs[0]?.last_error_code).toBe(
      'legacy_resend_cancel_outcome_unknown'
    );

    let rerunListCalls = 0;
    provider.list.mockImplementation(async () => {
      rerunListCalls += 1;
      return {
        data: {
          object: 'list',
          data:
            rerunListCalls === 1
              ? [{ id: scheduledProviderId, last_event: 'scheduled' }]
              : [],
          has_more: false,
        },
        error: null,
      };
    });

    const second = mainHarness({ state, provider });
    expect(
      await mainCancelResendLifecycle(applyArguments(), second.dependencies)
    ).toBe(0);
    expect(provider.get).toHaveBeenCalledWith(scheduledProviderId, {
      signal: expect.any(AbortSignal),
    });
    expect(provider.cancel).toHaveBeenCalledTimes(1);
    expect(state.jobs[0]?.payload['provider_state']).toBe('cancelled');
  });

  it('exact-checks a thrown cancel outcome on rerun even when the provider list is stale', async () => {
    const state = cancellationState();
    const provider = providerHarness({
      getResults: {
        [scheduledProviderId]: {
          data: exactProviderEmail(scheduledProviderId, 'canceled'),
          error: null,
        },
      },
    });
    provider.cancel.mockRejectedValueOnce(
      new Error('private-provider-message@example.invalid')
    );
    const first = mainHarness({ state, provider });

    expect(
      await mainCancelResendLifecycle(applyArguments(), first.dependencies)
    ).toBe(1);
    expect(provider.cancel).toHaveBeenCalledTimes(1);
    expect(state.jobs[0]?.last_error_code).toBe(
      'legacy_resend_cancel_outcome_unknown'
    );
    expect(first.errors).toEqual([
      'Resend lifecycle cancellation failed: provider_cancel_outcome_unknown',
    ]);

    let rerunListCalls = 0;
    provider.list.mockImplementation(async () => {
      rerunListCalls += 1;
      return {
        data: {
          object: 'list',
          data:
            rerunListCalls === 1
              ? [{ id: scheduledProviderId, last_event: 'scheduled' }]
              : [],
          has_more: false,
        },
        error: null,
      };
    });
    const second = mainHarness({ state, provider });

    expect(
      await mainCancelResendLifecycle(applyArguments(), second.dependencies)
    ).toBe(0);
    expect(provider.get).toHaveBeenCalledWith(scheduledProviderId, {
      signal: expect.any(AbortSignal),
    });
    expect(provider.cancel).toHaveBeenCalledTimes(1);
    expect(allRenderedText(second)).not.toMatch(/@|opaque_|private/u);
  });

  it('exact-checks a malformed cancel response on rerun even when the provider list is stale', async () => {
    const state = cancellationState();
    const provider = providerHarness({
      getResults: {
        [scheduledProviderId]: {
          data: exactProviderEmail(scheduledProviderId, 'canceled'),
          error: null,
        },
      },
    });
    provider.cancel.mockResolvedValueOnce(undefined as never);
    const first = mainHarness({ state, provider });

    expect(
      await mainCancelResendLifecycle(applyArguments(), first.dependencies)
    ).toBe(1);
    expect(state.jobs[0]?.last_error_code).toBe(
      'legacy_resend_cancel_outcome_unknown'
    );

    let rerunListCalls = 0;
    provider.list.mockImplementation(async () => {
      rerunListCalls += 1;
      return {
        data: {
          object: 'list',
          data:
            rerunListCalls === 1
              ? [{ id: scheduledProviderId, last_event: 'scheduled' }]
              : [],
          has_more: false,
        },
        error: null,
      };
    });
    const second = mainHarness({ state, provider });

    expect(
      await mainCancelResendLifecycle(applyArguments(), second.dependencies)
    ).toBe(0);
    expect(provider.get).toHaveBeenCalledTimes(1);
    expect(provider.cancel).toHaveBeenCalledTimes(1);
    expect(allRenderedText(second)).not.toMatch(/@|opaque_|private/u);
  });

  it('recovers an expired durable cancellation claim through exact lookup before trusting a stale list', async () => {
    const state = cancellationState({
      jobs: [
        legacyJob({
          last_error_code: 'legacy_resend_cancel_outcome_unknown',
          lease_token: '00000000-0000-4000-8000-000000000999',
          lease_until: new Date(now.getTime() - 1),
        }),
      ],
    });
    let listCalls = 0;
    const provider = providerHarness({
      getResults: {
        [scheduledProviderId]: {
          data: exactProviderEmail(scheduledProviderId, 'canceled'),
          error: null,
        },
      },
    });
    provider.list.mockImplementation(async () => {
      listCalls += 1;
      return {
        data: {
          object: 'list',
          data:
            listCalls === 1
              ? [{ id: scheduledProviderId, last_event: 'scheduled' }]
              : [],
          has_more: false,
        },
        error: null,
      };
    });
    const harness = mainHarness({ state, provider });

    expect(
      await mainCancelResendLifecycle(applyArguments(), harness.dependencies)
    ).toBe(0);
    expect(provider.get).toHaveBeenCalledTimes(1);
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(state.jobs[0]).toMatchObject({
      status: 'cancelled',
      payload: { provider_state: 'cancelled' },
      lease_token: null,
      lease_until: null,
    });
  });

  it('does not settle another recovered record after an ambiguous exact lookup', async () => {
    const second = legacyJob({
      id: otherJobId,
      provider_email_id: otherScheduledProviderId,
    });
    const state = cancellationState({ jobs: [legacyJob(), second] });
    const provider = providerHarness({
      pages: [[]],
      getResults: {
        [scheduledProviderId]: {
          data: exactProviderEmail(scheduledProviderId, 'delivered'),
          error: null,
        },
        [otherScheduledProviderId]: {
          data: exactProviderEmail(otherScheduledProviderId, 'canceled'),
          error: null,
        },
      },
    });
    const harness = mainHarness({ state, provider });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(2),
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(provider.get.mock.calls.map(([id]) => id)).toEqual([
      scheduledProviderId,
      otherScheduledProviderId,
    ]);
    for (const call of provider.get.mock.calls) {
      expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(state.jobs[1]).toMatchObject({
      status: 'pending',
      payload: { provider_state: 'scheduled' },
    });
    expect(state.activities).toHaveLength(0);
  });

  it.each([
    ['missing', { data: null, error: providerError('not_found', 404) }],
    ['malformed', { data: { id: scheduledProviderId }, error: null }],
    [
      'missing discriminator',
      {
        data: { id: scheduledProviderId, last_event: 'canceled' },
        error: null,
      },
    ],
    [
      'delivered',
      {
        data: exactProviderEmail(scheduledProviderId, 'delivered'),
        error: null,
      },
    ],
    [
      'otherwise ambiguous',
      {
        data: exactProviderEmail(scheduledProviderId, 'queued'),
        error: null,
      },
    ],
  ])('leaves a %s exact lookup unresolved and halts', async (_name, result) => {
    const state = cancellationState();
    const provider = providerHarness({
      pages: [[]],
      getResults: { [scheduledProviderId]: result },
    });
    const harness = mainHarness({ state, provider });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(),
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(state.jobs[0]?.payload['provider_state']).toBe('scheduled');
    expect(state.jobs[0]?.last_error_code).toMatch(
      /^legacy_resend_lookup_(missing|malformed|terminal|ambiguous)$/u
    );
  });

  it('classifies only a structurally valid not_found 404 lookup as missing', async () => {
    const state = cancellationState();
    const provider = providerHarness({
      pages: [[]],
      getResults: {
        [scheduledProviderId]: {
          data: null,
          error: providerError('not_found', 404),
        },
      },
    });
    const harness = mainHarness({ state, provider });

    expect(
      await mainCancelResendLifecycle(applyArguments(), harness.dependencies)
    ).toBe(1);
    expect(state.jobs[0]?.last_error_code).toBe('legacy_resend_lookup_missing');
    expect(allRenderedText(harness)).not.toMatch(
      /@|opaque_|private-provider-message/u
    );
  });

  it('classifies a thrown exact lookup as ambiguous without exposing it', async () => {
    const state = cancellationState();
    const provider = providerHarness({ pages: [[]] });
    provider.get.mockRejectedValueOnce(
      new Error('private-thrown-message@example.invalid')
    );
    const harness = mainHarness({ state, provider });

    expect(
      await mainCancelResendLifecycle(applyArguments(), harness.dependencies)
    ).toBe(1);
    expect(state.jobs[0]?.last_error_code).toBe(
      'legacy_resend_lookup_ambiguous'
    );
    expect(allRenderedText(harness)).not.toMatch(
      /@|opaque_|private-thrown-message/u
    );
  });

  it.each([
    ['auth', providerError('invalid_api_key', 401)],
    ['rate limit', providerError('rate_limit_exceeded', 429)],
    ['internal', providerError('internal_server_error', 500)],
    ['not-found name with non-404 status', providerError('not_found', 500)],
    [
      '404 status with non-not-found name',
      providerError('application_error', 404),
    ],
  ])(
    'classifies a valid %s provider error as ambiguous',
    async (_name, error) => {
      const state = cancellationState();
      const provider = providerHarness({
        pages: [[]],
        getResults: {
          [scheduledProviderId]: { data: null, error },
        },
      });
      const harness = mainHarness({ state, provider });

      expect(
        await mainCancelResendLifecycle(applyArguments(), harness.dependencies)
      ).toBe(1);
      expect(state.jobs[0]?.last_error_code).toBe(
        'legacy_resend_lookup_ambiguous'
      );
      expect(allRenderedText(harness)).not.toMatch(
        /@|opaque_|private-provider-message/u
      );
    }
  );

  it.each([
    ['null error', { data: null, error: null }],
    ['non-object error', { data: null, error: 'private-raw-error' }],
    [
      'missing message',
      { data: null, error: { name: 'not_found', statusCode: 404 } },
    ],
    [
      'unbounded name',
      {
        data: null,
        error: providerError('x'.repeat(101), 404),
      },
    ],
    [
      'unknown name',
      { data: null, error: providerError('unknown_error', 500) },
    ],
    [
      'invalid status',
      { data: null, error: providerError('not_found', 404.5) },
    ],
    [
      'both data and error',
      {
        data: exactProviderEmail(scheduledProviderId, 'scheduled'),
        error: providerError('not_found', 404),
      },
    ],
  ])(
    'classifies a %s exact lookup response as malformed',
    async (_name, result) => {
      const state = cancellationState();
      const provider = providerHarness({
        pages: [[]],
        getResults: { [scheduledProviderId]: result },
      });
      const harness = mainHarness({ state, provider });

      expect(
        await mainCancelResendLifecycle(applyArguments(), harness.dependencies)
      ).toBe(1);
      expect(state.jobs[0]?.last_error_code).toBe(
        'legacy_resend_lookup_malformed'
      );
      expect(allRenderedText(harness)).not.toMatch(
        /@|opaque_|private-provider-message|private-raw-error/u
      );
    }
  );

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['primitive', 7],
    ['null/null', { data: null, error: null }],
    [
      'data/error',
      {
        data: { object: 'list', data: [], has_more: false },
        error: providerError('application_error', 500),
      },
    ],
  ])(
    'classifies a malformed %s list wrapper without leakage',
    async (_name, response) => {
      const provider = providerHarness();
      provider.list.mockResolvedValueOnce(response as never);
      const harness = mainHarness({ provider });

      expect(
        await mainCancelResendLifecycle(['--dry-run'], harness.dependencies)
      ).toBe(1);
      expect(harness.errors).toEqual([
        'Resend lifecycle cancellation failed: provider_emails_response_malformed',
      ]);
      expect(allRenderedText(harness)).not.toMatch(/@|opaque_|private/u);
    }
  );

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['primitive', 7],
    [
      'data/error',
      {
        data: exactProviderEmail(scheduledProviderId, 'scheduled'),
        error: providerError('application_error', 500),
      },
    ],
  ])(
    'classifies a malformed %s get wrapper without leakage',
    async (_name, response) => {
      const provider = providerHarness({ pages: [[]] });
      provider.get.mockResolvedValueOnce(response as never);
      const harness = mainHarness({ provider });

      expect(
        await mainCancelResendLifecycle(applyArguments(), harness.dependencies)
      ).toBe(1);
      expect(harness.state.jobs[0]?.last_error_code).toBe(
        'legacy_resend_lookup_malformed'
      );
      expect(harness.errors).toEqual([
        'Resend lifecycle cancellation failed: provider_lookup_malformed',
      ]);
      expect(allRenderedText(harness)).not.toMatch(/@|opaque_|private/u);
    }
  );

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['primitive', 7],
    [
      'data/error',
      {
        data: { id: scheduledProviderId, object: 'email' },
        error: providerError('application_error', 500),
      },
    ],
  ])(
    'classifies a malformed %s cancel wrapper without leakage',
    async (_name, response) => {
      const provider = providerHarness();
      provider.cancel.mockResolvedValueOnce(response as never);
      const harness = mainHarness({ provider });

      expect(
        await mainCancelResendLifecycle(applyArguments(), harness.dependencies)
      ).toBe(1);
      expect(harness.state.jobs[0]?.last_error_code).toBe(
        'legacy_resend_cancel_outcome_unknown'
      );
      expect(harness.errors).toEqual([
        'Resend lifecycle cancellation failed: provider_cancel_outcome_unknown',
      ]);
      expect(allRenderedText(harness)).not.toMatch(/@|opaque_|private/u);
    }
  );

  it('uses the deadline category when time expires during an exact lookup checkpoint', async () => {
    const state = cancellationState({
      deadline: '2026-09-02T12:00:00.001Z',
      jobs: [
        legacyJob({
          available_at: new Date('2026-09-02T12:05:00.001Z'),
        }),
      ],
    });
    const provider = providerHarness({
      pages: [[]],
      getResults: {
        [scheduledProviderId]: {
          data: exactProviderEmail(scheduledProviderId, 'delivered'),
          error: null,
        },
      },
    });
    let clockReads = 0;
    const harness = mainHarness({
      state,
      provider,
      now: () => {
        clockReads += 1;
        return new Date(
          clockReads < 5
            ? '2026-09-02T12:00:00.000Z'
            : '2026-09-02T12:00:00.002Z'
        );
      },
    });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(),
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(provider.get).toHaveBeenCalledWith(scheduledProviderId, {
      signal: expect.any(AbortSignal),
    });
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(state.jobs[0]?.last_error_code).toBe(
      'legacy_resend_cancellation_deadline_expired'
    );
  });

  it('rechecks the deadline immediately before each recovered settlement', async () => {
    const first = legacyJob({
      available_at: new Date('2026-09-02T12:05:00.001Z'),
    });
    const second = legacyJob({
      id: otherJobId,
      provider_email_id: otherScheduledProviderId,
      available_at: new Date('2026-09-02T12:05:00.001Z'),
    });
    const state = cancellationState({
      deadline: '2026-09-02T12:00:00.001Z',
      jobs: [first, second],
    });
    const provider = providerHarness({
      pages: [[]],
      getResults: {
        [scheduledProviderId]: {
          data: exactProviderEmail(scheduledProviderId, 'canceled'),
          error: null,
        },
        [otherScheduledProviderId]: {
          data: exactProviderEmail(otherScheduledProviderId, 'canceled'),
          error: null,
        },
      },
    });
    let clockReads = 0;
    const harness = mainHarness({
      state,
      provider,
      now: () => {
        clockReads += 1;
        return new Date(
          clockReads < 9
            ? '2026-09-02T12:00:00.000Z'
            : '2026-09-02T12:00:00.002Z'
        );
      },
    });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(2),
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(state.jobs[0]?.payload['provider_state']).toBe('cancelled');
    expect(state.jobs[1]).toMatchObject({
      status: 'pending',
      payload: { provider_state: 'scheduled' },
      last_error_code: 'legacy_resend_cancellation_deadline_expired',
    });
  });

  it('selects a locally cancelled provider-unsubscribed job while provider state remains scheduled', async () => {
    const state = cancellationState({
      jobs: [legacyJob({ status: 'cancelled' })],
    });
    const harness = mainHarness({ state });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(),
      harness.dependencies
    );

    expect(exitCode).toBe(0);
    expect(harness.provider.cancel).toHaveBeenCalledWith(scheduledProviderId, {
      signal: expect.any(AbortSignal),
    });
    const unresolvedQuery = state.queries.find(
      ({ sql }) => marker(sql) === 'cancel-read-unresolved-schedules'
    );
    expect(unresolvedQuery?.sql).toContain(
      "payload->>'provider_state' = 'scheduled'"
    );
    expect(unresolvedQuery?.sql).not.toMatch(/\bstatus\s*=/u);
  });

  it('uses complete immutable queries and rejects count, hash, null, duplicate, unbounded, or job-state drift', async () => {
    const invalidStates: CancellationState[] = [];
    const countDrift = cancellationState();
    (countDrift.configuration?.['data'] as Record<string, unknown>)[
      'expected_scheduled'
    ] = 2;
    invalidStates.push(countDrift);
    const hashDrift = cancellationState();
    (hashDrift.configuration?.['data'] as Record<string, unknown>)[
      'snapshot_identity'
    ] = '0'.repeat(64);
    invalidStates.push(hashDrift);
    invalidStates.push(
      cancellationState({ deadline: '2026-09-04T11:55:00.000Z' })
    );
    invalidStates.push(cancellationState({ contactMarkers: [null] }));
    invalidStates.push(
      cancellationState({
        contactMarkers: [contactProviderId, contactProviderId],
      })
    );
    invalidStates.push(
      cancellationState({
        jobs: [legacyJob({ provider_email_id: 'x'.repeat(201) })],
      })
    );
    invalidStates.push(
      cancellationState({ jobs: [legacyJob({ status: 'processing' })] })
    );

    for (const state of invalidStates) {
      const harness = mainHarness({ state });
      expect(
        await mainCancelResendLifecycle(applyArguments(), harness.dependencies)
      ).toBe(1);
      expect(harness.provider.cancel).not.toHaveBeenCalled();
    }

    const queries = invalidStates[0]?.queries ?? [];
    const markerQuery = queries.find(
      ({ sql }) => marker(sql) === 'cancel-read-contact-markers'
    )?.sql;
    const scheduleQuery = queries.find(
      ({ sql }) => marker(sql) === 'cancel-read-immutable-schedules'
    )?.sql;
    expect(markerQuery).toContain("payload->>'legacy_type' = 'contact_marker'");
    expect(markerQuery).not.toMatch(/\bstatus\s*=/u);
    expect(scheduleQuery).toContain(
      "payload->>'legacy_type' = 'scheduled_message'"
    );
    expect(scheduleQuery).not.toMatch(/provider_state|\bstatus\s*=/u);
  });

  it('requires the final bounded provider re-list to contain zero scheduled messages', async () => {
    const provider = providerHarness();
    provider.cancel.mockImplementationOnce(async (id: string) => ({
      data: { id, object: 'email' },
      error: null,
    }));
    const harness = mainHarness({ provider });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(),
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(provider.list).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(harness.output[0]))).toMatchObject({
      unresolved_imported: 0,
      unexpected_provider_scheduled: 0,
      provider_scheduled_remaining: 1,
    });
  });

  it('reruns after full settlement with zero get and cancel calls', async () => {
    const state = cancellationState();
    const provider = providerHarness();
    const first = mainHarness({ state, provider });
    expect(
      await mainCancelResendLifecycle(applyArguments(), first.dependencies)
    ).toBe(0);
    provider.get.mockClear();
    provider.cancel.mockClear();
    const second = mainHarness({ state, provider });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(),
      second.dependencies
    );

    expect(exitCode).toBe(0);
    expect(provider.get).not.toHaveBeenCalled();
    expect(provider.cancel).not.toHaveBeenCalled();
  });

  it('keeps initial provider preflight read-only when its page crosses the deadline', async () => {
    const state = cancellationState({
      deadline: '2026-09-02T12:00:00.001Z',
      jobs: [
        legacyJob({
          available_at: new Date('2026-09-02T12:05:00.001Z'),
        }),
      ],
    });
    const provider = providerHarness({
      cancelResults: {
        [scheduledProviderId]: {
          data: null,
          error: {
            message:
              'raw failure for private-recipient@example.invalid / Private subject',
          },
        },
      },
    });
    let clockReads = 0;
    const harness = mainHarness({
      state,
      provider,
      now: () => {
        clockReads += 1;
        return new Date(
          clockReads === 1
            ? '2026-09-02T12:00:00.000Z'
            : '2026-09-02T12:00:00.002Z'
        );
      },
    });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(),
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(cancellationWriteMarkers(state)).toEqual([]);
    expect(state.jobs[0]?.last_error_code).toBeNull();
    expect(state.activities).toHaveLength(0);
    expect(allRenderedText(harness)).not.toMatch(
      /@|opaque_|Private subject|private-recipient|raw failure|postgres:/u
    );
  });

  it('does not settle after a successful cancel call crosses the deadline', async () => {
    const state = cancellationState({
      deadline: '2026-09-02T12:00:00.001Z',
      jobs: [
        legacyJob({
          available_at: new Date('2026-09-02T12:05:00.001Z'),
        }),
        legacyJob({
          id: otherJobId,
          provider_email_id: otherScheduledProviderId,
          available_at: new Date('2026-09-02T12:06:00.001Z'),
        }),
      ],
    });
    const provider = providerHarness({
      pages: [
        [
          { id: scheduledProviderId, last_event: 'scheduled' },
          { id: otherScheduledProviderId, last_event: 'scheduled' },
        ],
      ],
    });
    const harness = mainHarness({
      state,
      provider,
      now: () =>
        new Date(
          provider.cancel.mock.calls.length === 0
            ? '2026-09-02T12:00:00.000Z'
            : '2026-09-02T12:00:00.001Z'
        ),
    });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(2),
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(provider.cancel).toHaveBeenCalledTimes(1);
    expect(provider.cancel).toHaveBeenCalledWith(scheduledProviderId, {
      signal: expect.any(AbortSignal),
    });
    expect(state.jobs).toHaveLength(2);
    for (const job of state.jobs) {
      expect(job).toMatchObject({
        status: 'pending',
        payload: { provider_state: 'scheduled' },
        last_error_code: 'legacy_resend_cancellation_deadline_expired',
      });
    }
    expect(state.activities).toHaveLength(0);
  });

  it('fails when the final provider re-list crosses the deadline', async () => {
    const state = cancellationState({
      deadline: '2026-09-02T12:00:00.001Z',
      jobs: [
        legacyJob({
          available_at: new Date('2026-09-02T12:05:00.001Z'),
        }),
      ],
    });
    const provider = providerHarness();
    const harness = mainHarness({
      state,
      provider,
      now: () =>
        new Date(
          provider.list.mock.calls.length < 2
            ? '2026-09-02T12:00:00.000Z'
            : '2026-09-02T12:00:00.001Z'
        ),
    });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(),
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(provider.cancel).toHaveBeenCalledTimes(1);
    expect(state.jobs[0]?.payload['provider_state']).toBe('cancelled');
    expect(state.activities).toHaveLength(1);
    expect(harness.errors).toEqual([
      'Resend lifecycle cancellation failed: cancellation_deadline_expired',
    ]);
  });

  it('enforces the fresh output-time clock before reporting apply success', async () => {
    const state = cancellationState({
      deadline: '2026-09-02T12:00:00.001Z',
      jobs: [
        legacyJob({
          available_at: new Date('2026-09-02T12:05:00.001Z'),
        }),
      ],
    });
    const provider = providerHarness();
    let postFinalListReads = 0;
    const harness = mainHarness({
      state,
      provider,
      now: () => {
        if (provider.list.mock.calls.length < 2) {
          return new Date('2026-09-02T12:00:00.000Z');
        }
        postFinalListReads += 1;
        return new Date(
          postFinalListReads < 3
            ? '2026-09-02T12:00:00.000Z'
            : '2026-09-02T12:00:00.001Z'
        );
      },
    });

    expect(
      await mainCancelResendLifecycle(applyArguments(), harness.dependencies)
    ).toBe(1);
    expect(harness.output).toHaveLength(0);
    expect(harness.errors).toEqual([
      'Resend lifecycle cancellation failed: cancellation_deadline_expired',
    ]);
  });

  it('rewrites remaining unresolved rows when the final provider re-list crosses the deadline', async () => {
    const state = cancellationState({
      deadline: '2026-09-02T12:00:00.001Z',
      jobs: [
        legacyJob({
          available_at: new Date('2026-09-02T12:05:00.001Z'),
        }),
      ],
    });
    const provider = providerHarness({
      cancelResults: {
        [scheduledProviderId]: {
          data: null,
          error: providerError('application_error', 500),
        },
      },
    });
    const harness = mainHarness({
      state,
      provider,
      now: () =>
        new Date(
          provider.list.mock.calls.length < 2
            ? '2026-09-02T12:00:00.000Z'
            : '2026-09-02T12:00:00.001Z'
        ),
    });

    const exitCode = await mainCancelResendLifecycle(
      applyArguments(),
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(provider.cancel).toHaveBeenCalledTimes(1);
    expect(state.jobs[0]).toMatchObject({
      status: 'pending',
      payload: { provider_state: 'scheduled' },
      last_error_code: 'legacy_resend_cancellation_deadline_expired',
    });
    expect(state.activities).toHaveLength(0);
    expect(allRenderedText(harness)).not.toMatch(
      /@|opaque_|private-provider-message/u
    );
  });

  it('documents distinct pre-import and post-import failure branches', async () => {
    const runbook = await readFile(
      resolve(
        process.cwd(),
        'docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md'
      ),
      'utf8'
    );

    expect(runbook).toContain(
      'Pre-import insufficient-window failure: no database or provider mutation occurred.'
    );
    expect(runbook).toContain(
      'Restore all three blocked acquisition POST routes and choose a later safe window.'
    );
    expect(runbook).toContain(
      'Post-import or cancellation failure: keep all three acquisition POST routes blocked.'
    );
    expect(runbook).toContain(
      'Restore ingress only after a reviewed Neon-only boundary is active and every accepted Neon and provider effect is reconciled.'
    );
  });

  it('documents a zero-work preview apply rerun followed by a final dry-run', async () => {
    const runbook = await readFile(
      resolve(
        process.cwd(),
        'docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md'
      ),
      'utf8'
    );
    const preview = runbook.slice(
      runbook.indexOf(
        '### PREVIEW LIVE — explicit authorization required',
        runbook.indexOf('## 6.')
      ),
      runbook.indexOf(
        '### PRODUCTION LIVE — explicit authorization required',
        runbook.indexOf('## 6.')
      )
    );
    const applyCommand =
      'env -u DATABASE_URL npm run growth:cancel-resend -- --apply --expected-scheduled "$EXPECTED_SCHEDULED"';
    const firstApply = preview.indexOf(applyCommand);
    const secondApply = preview.indexOf(applyCommand, firstApply + 1);
    const finalDryRun = preview.lastIndexOf(
      'npm run growth:cancel-resend -- --dry-run'
    );

    expect(firstApply).toBeGreaterThan(-1);
    expect(secondApply).toBeGreaterThan(firstApply);
    expect(finalDryRun).toBeGreaterThan(secondApply);
  });

  it('documents a zero-work production apply rerun followed by a final dry-run', async () => {
    const runbook = await readFile(
      resolve(
        process.cwd(),
        'docs/superpowers/runbooks/2026-08-31-growth-lifecycle-cutover.md'
      ),
      'utf8'
    );
    const production = runbook.slice(
      runbook.indexOf(
        '### PRODUCTION LIVE — explicit authorization required',
        runbook.indexOf('## 6.')
      ),
      runbook.indexOf('## 7.')
    );
    const applyCommand =
      'env -u TEST_DATABASE_URL npm run growth:cancel-resend -- --apply --expected-scheduled "$EXPECTED_SCHEDULED" --allow-database-url-apply';
    const firstApply = production.indexOf(applyCommand);
    const secondApply = production.indexOf(applyCommand, firstApply + 1);
    const finalDryRun = production.lastIndexOf(
      'npm run growth:cancel-resend -- --dry-run'
    );

    expect(firstApply).toBeGreaterThan(-1);
    expect(secondApply).toBeGreaterThan(firstApply);
    expect(finalDryRun).toBeGreaterThan(secondApply);
  });
});

const integrationDatabaseUrl = process.env['TEST_DATABASE_URL'];
const describeDatabase =
  process.env['GROWTH_INTEGRATION'] === '1' && integrationDatabaseUrl
    ? describe
    : describe.skip;

describeDatabase(
  integrationDatabaseUrl
    ? 'cancel Resend lifecycle against disposable TEST_DATABASE_URL'
    : 'cancel Resend lifecycle integration intentionally skipped',
  () => {
    const integrationSource = 'cancel-resend-lifecycle-integration';
    let inspector: SqlExecutor;

    async function cleanupIntegrationRows(): Promise<void> {
      await inspector.execute(
        `delete from growth_activity
         where contact_id in (
           select id from growth_contacts where source = $1
         )
            or (
              event_key = 'legacy:resend:cutover:v1:configuration'
              and data->>'operator_integration' = 'true'
            )`,
        [integrationSource]
      );
      await inspector.execute(
        `delete from growth_jobs
         where payload->>'operator_integration' = 'true'`
      );
      await inspector.execute('delete from growth_contacts where source = $1', [
        integrationSource,
      ]);
    }

    beforeAll(async () => {
      if (!integrationDatabaseUrl) {
        throw new Error(
          'TEST_DATABASE_URL is required for this integration lane'
        );
      }
      inspector = createDatabaseExecutor(integrationDatabaseUrl);
      await applyMigrations({
        directory: resolve(process.cwd(), 'migrations'),
        executor: inspector,
      });
    });

    beforeEach(async () => {
      await cleanupIntegrationRows();
      const configuration = await inspector.execute<{ count: string }>(
        `select count(*)::text as count
         from growth_activity
         where event_key = 'legacy:resend:cutover:v1:configuration'`
      );
      if (configuration.rows[0]?.count !== '0') {
        throw new Error(
          'Disposable integration database contains a non-test cutover configuration'
        );
      }
    });

    afterEach(async () => {
      await cleanupIntegrationRows();
    });

    afterAll(async () => {
      await inspector?.close?.();
    });

    async function seedDatabaseCancellation(): Promise<{
      contactId: string;
      deadline: Date;
      jobId: string;
      providerContactId: string;
      providerEmailId: string;
      scheduledAt: Date;
    }> {
      const run = randomUUID().replaceAll('-', '');
      const seededContactId = randomUUID();
      const seededJobId = randomUUID();
      const markerJobId = randomUUID();
      const seededProviderContactId = `integration_contact_${run}`;
      const seededProviderEmailId = `integration_email_${run}`;
      const snapshotAt = new Date('2099-01-01T00:00:00.000Z');
      const scheduledAt = new Date('2099-01-02T00:00:00.000Z');
      const deadline = new Date(scheduledAt.getTime() - 5 * 60_000);
      await inspector.execute(
        `insert into growth_contacts (
           id, email_normalized, email_lookup_hmac,
           email_hmac_key_version, source
         ) values ($1, $2, $3, 1, $4)`,
        [
          seededContactId,
          `${run}@example.invalid`,
          `integration:${run}`,
          integrationSource,
        ]
      );
      await inspector.execute(
        `insert into growth_jobs (
           id, kind, contact_id, status, available_at, idempotency_key,
           payload, provider_email_id, delivery_status
         ) values (
           $1, 'legacy', $2, 'cancelled', $3, $4, $5::jsonb,
           null, 'not_submitted'
         )`,
        [
          markerJobId,
          seededContactId,
          snapshotAt,
          `integration:marker:${run}`,
          JSON.stringify({
            imported: true,
            legacy_type: 'contact_marker',
            operator_integration: true,
            provider: 'resend',
            provider_contact_id: seededProviderContactId,
          }),
        ]
      );
      await inspector.execute(
        `insert into growth_jobs (
           id, kind, contact_id, status, available_at, idempotency_key,
           payload, provider_email_id, delivery_status
         ) values (
           $1, 'legacy', $2, 'pending', $3, $4, $5::jsonb,
           $6, 'not_submitted'
         )`,
        [
          seededJobId,
          seededContactId,
          scheduledAt,
          `integration:schedule:${run}`,
          JSON.stringify({
            imported: true,
            legacy_type: 'scheduled_message',
            operator_integration: true,
            provider: 'resend',
            provider_state: 'scheduled',
          }),
          seededProviderEmailId,
        ]
      );
      await inspector.execute(
        `insert into growth_activity (
           event_key, contact_id, project_id, occurred_at, kind, data
         ) values (
           'legacy:resend:cutover:v1:configuration', null, null, $1,
           'legacy.resend_cutover_configured', $2::jsonb
         )`,
        [
          snapshotAt,
          JSON.stringify({
            snapshot_at: snapshotAt.toISOString(),
            cancellation_deadline: deadline.toISOString(),
            expected_contacts: 1,
            expected_scheduled: 1,
            snapshot_identity: snapshotIdentity(
              [seededProviderContactId],
              [seededProviderEmailId]
            ),
            operator_integration: true,
          }),
        ]
      );
      return {
        contactId: seededContactId,
        deadline,
        jobId: seededJobId,
        providerContactId: seededProviderContactId,
        providerEmailId: seededProviderEmailId,
        scheduledAt,
      };
    }

    function databaseHarness(
      provider: ReturnType<typeof providerHarness>,
      deadline: Date,
      createExecutor: (databaseUrl: string) => SqlExecutor = (databaseUrl) =>
        createDatabaseExecutor(databaseUrl)
    ) {
      const output: string[] = [];
      const errors: string[] = [];
      const dependencies: LegacyCancellationDependencies = {
        environment: {
          RESEND_API_KEY: 'private-integration-key',
          TEST_DATABASE_URL: integrationDatabaseUrl,
        },
        createClient: () => provider.client,
        createExecutor,
        writeOutput: (line) => output.push(line),
        writeError: (line) => errors.push(line),
        now: () => new Date(deadline.getTime() - 60 * 60_000),
      };
      return { dependencies, errors, output };
    }

    it('reconstructs real JSONB and timestamptz inventory in dry-run', async () => {
      const seeded = await seedDatabaseCancellation();
      const provider = providerHarness({
        pages: [[{ id: seeded.providerEmailId, last_event: 'scheduled' }]],
      });
      const harness = databaseHarness(provider, seeded.deadline);

      expect(
        await mainCancelResendLifecycle(['--dry-run'], harness.dependencies)
      ).toBe(0);
      expect(JSON.parse(String(harness.output[0]))).toMatchObject({
        immutable_contacts: 1,
        immutable_scheduled: 1,
        unresolved_imported: 1,
        provider_scheduled: 1,
        cancellation_remaining_seconds: 3_600,
      });
      const decoded = await inspector.execute<{
        available_at: Date;
        payload: Record<string, unknown>;
      }>(
        `select available_at, payload
         from growth_jobs
         where id = $1`,
        [seeded.jobId]
      );
      expect(decoded.rows[0]?.available_at).toBeInstanceOf(Date);
      expect(decoded.rows[0]?.payload).toMatchObject({
        legacy_type: 'scheduled_message',
        provider_state: 'scheduled',
      });
      expect(provider.cancel).not.toHaveBeenCalled();
    });

    it('settles one real row and records one stable activity', async () => {
      const seeded = await seedDatabaseCancellation();
      const provider = providerHarness({
        pages: [[{ id: seeded.providerEmailId, last_event: 'scheduled' }]],
      });
      const first = databaseHarness(provider, seeded.deadline);

      expect(
        await mainCancelResendLifecycle(applyArguments(), first.dependencies)
      ).toBe(0);
      const settled = await inspector.execute<{
        last_error_code: string | null;
        payload: Record<string, unknown>;
        status: string;
      }>(
        'select status, payload, last_error_code from growth_jobs where id = $1',
        [seeded.jobId]
      );
      expect(settled.rows[0]).toMatchObject({
        status: 'cancelled',
        payload: { provider_state: 'cancelled' },
        last_error_code: null,
      });
      const activities = await inspector.execute<{ count: string }>(
        `select count(*)::text as count
         from growth_activity
         where event_key = $1
           and kind = 'legacy.resend_schedule_cancelled'`,
        [`legacy:resend:scheduled:${seeded.jobId}:cancelled`]
      );
      expect(activities.rows).toEqual([{ count: '1' }]);
      const replay = databaseHarness(provider, seeded.deadline);
      expect(
        await mainCancelResendLifecycle(applyArguments(), replay.dependencies)
      ).toBe(0);
      expect(provider.cancel).toHaveBeenCalledTimes(1);
    });

    it('rolls back an activity conflict and recovers by exact get without a second cancel', async () => {
      const seeded = await seedDatabaseCancellation();
      const eventKey = `legacy:resend:scheduled:${seeded.jobId}:cancelled`;
      await inspector.execute(
        `insert into growth_activity (
           event_key, contact_id, occurred_at, kind, data
         ) values ($1, $2, $3, 'integration.conflict', '{}')`,
        [eventKey, seeded.contactId, new Date(seeded.deadline.getTime() - 1)]
      );
      const provider = providerHarness({
        pages: [[{ id: seeded.providerEmailId, last_event: 'scheduled' }]],
        getResults: {
          [seeded.providerEmailId]: {
            data: exactProviderEmail(seeded.providerEmailId, 'canceled'),
            error: null,
          },
        },
      });
      const first = databaseHarness(provider, seeded.deadline);

      expect(
        await mainCancelResendLifecycle(applyArguments(), first.dependencies)
      ).toBe(1);
      const rolledBack = await inspector.execute<{
        payload: Record<string, unknown>;
        status: string;
      }>('select status, payload from growth_jobs where id = $1', [
        seeded.jobId,
      ]);
      expect(rolledBack.rows[0]).toMatchObject({
        status: 'pending',
        payload: { provider_state: 'scheduled' },
      });
      await inspector.execute(
        'delete from growth_activity where event_key = $1',
        [eventKey]
      );
      const second = databaseHarness(provider, seeded.deadline);

      expect(
        await mainCancelResendLifecycle(applyArguments(), second.dependencies)
      ).toBe(0);
      expect(provider.get).toHaveBeenCalledWith(seeded.providerEmailId, {
        signal: expect.any(AbortSignal),
      });
      expect(provider.cancel).toHaveBeenCalledTimes(1);
    });

    it('fails closed on a real zero-row settlement conflict', async () => {
      const seeded = await seedDatabaseCancellation();
      const provider = providerHarness({
        pages: [[{ id: seeded.providerEmailId, last_event: 'scheduled' }]],
      });
      const normalCancel = provider.cancel.getMockImplementation();
      provider.cancel.mockImplementationOnce(async (...parameters) => {
        await inspector.execute(
          `update growth_jobs
           set status = 'cancelled',
               payload = payload || '{"provider_state":"cancelled","cancelled_at":"2099-01-01T00:00:00.000Z"}'::jsonb
           where id = $1`,
          [seeded.jobId]
        );
        return normalCancel?.(...parameters) as Promise<{
          data: unknown | null;
          error: unknown | null;
        }>;
      });
      const harness = databaseHarness(provider, seeded.deadline);

      expect(
        await mainCancelResendLifecycle(applyArguments(), harness.dependencies)
      ).toBe(1);
      expect(harness.errors).toEqual([
        'Resend lifecycle cancellation failed: database_cancellation_failed',
      ]);
      const activities = await inspector.execute<{ count: string }>(
        `select count(*)::text as count
         from growth_activity
         where event_key = $1`,
        [`legacy:resend:scheduled:${seeded.jobId}:cancelled`]
      );
      expect(activities.rows).toEqual([{ count: '0' }]);
    });

    it('serializes concurrent applies with a real durable row claim', async () => {
      const seeded = await seedDatabaseCancellation();
      const provider = providerHarness({
        pages: [[{ id: seeded.providerEmailId, last_event: 'scheduled' }]],
      });
      const normalCancel = provider.cancel.getMockImplementation();
      let releaseCancel: (() => void) | undefined;
      const cancelReleased = new Promise<void>((resolve) => {
        releaseCancel = resolve;
      });
      provider.cancel.mockImplementationOnce(async (...parameters) => {
        const claimed = await inspector.execute<{
          last_error_code: string | null;
          lease_token: string | null;
          lease_until: Date | null;
        }>(
          `select last_error_code, lease_token, lease_until
           from growth_jobs
           where id = $1`,
          [seeded.jobId]
        );
        expect(claimed.rows[0]).toMatchObject({
          last_error_code: 'legacy_resend_cancel_outcome_unknown',
          lease_token: expect.any(String),
          lease_until: expect.any(Date),
        });
        await cancelReleased;
        return normalCancel?.(...parameters) as Promise<{
          data: unknown | null;
          error: unknown | null;
        }>;
      });
      const first = databaseHarness(provider, seeded.deadline);
      const second = databaseHarness(provider, seeded.deadline);

      const firstResult = mainCancelResendLifecycle(
        applyArguments(),
        first.dependencies
      );
      await vi.waitFor(() => expect(provider.cancel).toHaveBeenCalledTimes(1), {
        timeout: 10_000,
      });
      expect(
        await mainCancelResendLifecycle(applyArguments(), second.dependencies)
      ).toBe(1);
      expect(second.errors).toEqual([
        'Resend lifecycle cancellation failed: cancellation_operator_already_running',
      ]);
      releaseCancel?.();
      expect(await firstResult).toBe(0);
      expect(provider.cancel).toHaveBeenCalledTimes(1);
    });
  }
);
