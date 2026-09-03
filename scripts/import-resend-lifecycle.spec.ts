// This repository-level importer deliberately sits outside the Nx growth project.
// eslint-disable-next-line @nx/enforce-module-boundaries
import type {
  EmailHmacKeyring,
  SqlExecutor,
  SqlQueryResult,
  SqlTransaction,
} from '../libs/growth/src/index.ts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  createEmailLookupHmac,
  stopContact,
} from '../libs/growth/src/index.ts';
import {
  cancellationDeadline,
  importResendLifecycleSnapshot,
  mainImportResendLifecycle,
  snapshotResendLifecycle,
  type ResendLifecycleClient,
  type ResendLifecycleSnapshot,
} from './import-resend-lifecycle.mts';

const now = new Date('2026-09-01T12:00:00.000Z');
const contactId = '00000000-0000-4000-8000-000000000001';
const otherContactId = '00000000-0000-4000-8000-000000000002';
const keyring: EmailHmacKeyring = {
  active: { version: 2, secret: 'a'.repeat(32) },
  previous: [{ version: 1, secret: 'b'.repeat(32) }],
};

type PageItem = Record<string, unknown> & { id: string };

function paginatedClient(input?: {
  contactPages?: PageItem[][];
  emailPages?: PageItem[][];
  contactError?: unknown;
  emailError?: unknown;
}) {
  const contactPages = input?.contactPages ?? [
    [
      {
        id: 'contact_provider_1',
        email: 'First.Person@example.com',
        first_name: 'First',
        last_name: 'Person',
        unsubscribed: false,
        created_at: '2026-08-01T00:00:00.000Z',
      },
    ],
  ];
  const emailPages = input?.emailPages ?? [
    [
      {
        id: 'email_scheduled_1',
        to: ['first.person@example.com'],
        from: 'Brian <brian@threadplane.ai>',
        subject: 'Private subject',
        created_at: '2026-09-01T00:00:00.000Z',
        scheduled_at: '2026-09-03T12:00:00.000Z',
        last_event: 'scheduled',
        bcc: null,
        cc: null,
        reply_to: null,
      },
      {
        id: 'email_delivered_1',
        to: ['secret-recipient@example.com'],
        from: 'Brian <brian@threadplane.ai>',
        subject: 'Another private subject',
        created_at: '2026-08-01T00:00:00.000Z',
        scheduled_at: null,
        last_event: 'delivered',
        bcc: null,
        cc: null,
        reply_to: null,
      },
    ],
  ];
  const contactsList = vi.fn(async (options?: { after?: string }) => {
    if (input?.contactError) {
      return { data: null, error: input.contactError, headers: null };
    }
    const index = options?.after
      ? contactPages.findIndex((page) => page.at(-1)?.id === options.after) + 1
      : 0;
    return {
      data: {
        object: 'list' as const,
        data: contactPages[index] ?? [],
        has_more: index < contactPages.length - 1,
      },
      error: null,
      headers: null,
    };
  });
  const emailsList = vi.fn(async (options?: { after?: string }) => {
    if (input?.emailError) {
      return { data: null, error: input.emailError, headers: null };
    }
    const index = options?.after
      ? emailPages.findIndex((page) => page.at(-1)?.id === options.after) + 1
      : 0;
    return {
      data: {
        object: 'list' as const,
        data: emailPages[index] ?? [],
        has_more: index < emailPages.length - 1,
      },
      error: null,
      headers: null,
    };
  });
  const cancel = vi.fn();
  return {
    cancel,
    contactsList,
    emailsList,
    client: {
      contacts: { list: contactsList },
      emails: { list: emailsList, cancel },
    } as unknown as ResendLifecycleClient,
  };
}

function noDatabase(): SqlExecutor {
  return {
    execute: vi.fn(),
    transaction: vi.fn(),
    close: vi.fn(),
  } as unknown as SqlExecutor;
}

function mainHarness(overrides?: {
  client?: ResendLifecycleClient;
  environment?: Record<string, string | undefined>;
  executor?: SqlExecutor;
  now?: () => Date;
}) {
  const output: string[] = [];
  const errors: string[] = [];
  const defaultClient = paginatedClient().client;
  const executor = overrides?.executor ?? noDatabase();
  const createClient = vi.fn(() => overrides?.client ?? defaultClient);
  const createExecutor = vi.fn((databaseUrl: string) => {
    void databaseUrl;
    return executor;
  });
  const loadKeyring = vi.fn(() => keyring);
  return {
    output,
    errors,
    createClient,
    createExecutor,
    loadKeyring,
    executor,
    dependencies: {
      environment: overrides?.environment ?? {},
      createClient,
      createExecutor,
      loadKeyring,
      writeOutput: (line: string) => output.push(line),
      writeError: (line: string) => errors.push(line),
      now: overrides?.now,
    },
  };
}

describe('snapshotResendLifecycle', () => {
  it('paginates every contact and email page with Resend 6.10 after cursors', async () => {
    const provider = paginatedClient({
      contactPages: [
        [
          {
            id: 'contact_1',
            email: 'one@example.com',
            first_name: null,
            last_name: null,
            unsubscribed: false,
            created_at: '2026-08-01T00:00:00.000Z',
          },
        ],
        [
          {
            id: 'contact_2',
            email: 'two@example.com',
            first_name: null,
            last_name: null,
            unsubscribed: true,
            created_at: '2026-08-02T00:00:00.000Z',
          },
        ],
      ],
      emailPages: [
        [
          {
            id: 'email_1',
            to: ['one@example.com'],
            created_at: '2026-08-01T00:00:00.000Z',
            scheduled_at: '2026-09-03T12:00:00.000Z',
            last_event: 'scheduled',
          },
        ],
        [
          {
            id: 'email_2',
            to: ['two@example.com'],
            created_at: '2026-08-02T00:00:00.000Z',
            scheduled_at: null,
            last_event: 'delivered',
          },
        ],
      ],
    });

    const snapshot = await snapshotResendLifecycle(provider.client);

    expect(provider.contactsList).toHaveBeenNthCalledWith(1, { limit: 100 });
    expect(provider.contactsList).toHaveBeenNthCalledWith(2, {
      limit: 100,
      after: 'contact_1',
    });
    expect(provider.emailsList).toHaveBeenNthCalledWith(1, { limit: 100 });
    expect(provider.emailsList).toHaveBeenNthCalledWith(2, {
      limit: 100,
      after: 'email_1',
    });
    expect(snapshot.contacts).toHaveLength(2);
    expect(snapshot.scheduledEmails.map(({ id }) => id)).toEqual(['email_1']);
    expect(provider.cancel).not.toHaveBeenCalled();
  });

  it('fails closed on malformed pagination instead of looping or returning a partial snapshot', async () => {
    const provider = paginatedClient({ contactPages: [[]] });
    provider.contactsList.mockResolvedValueOnce({
      data: { object: 'list', data: [], has_more: true },
      error: null,
      headers: null,
    });

    await expect(snapshotResendLifecycle(provider.client)).rejects.toThrow(
      /provider_contacts_pagination_invalid/u
    );
  });

  it('accepts Resend API timestamps with UTC offsets and fractional precision', async () => {
    const provider = paginatedClient({
      contactPages: [
        [
          {
            id: 'contact_1',
            email: 'one@example.com',
            first_name: null,
            last_name: null,
            unsubscribed: false,
            created_at: '2026-08-01T00:00:00.123456+00:00',
          },
        ],
      ],
      emailPages: [
        [
          {
            id: 'email_1',
            to: ['one@example.com'],
            created_at: '2026-08-01T00:00:00.123456+00:00',
            scheduled_at: '2026-09-03T12:00:00.123456+00:00',
            last_event: 'scheduled',
          },
        ],
      ],
    });

    await expect(
      snapshotResendLifecycle(provider.client)
    ).resolves.toMatchObject({
      contacts: [{ id: 'contact_1' }],
      scheduledEmails: [{ id: 'email_1' }],
    });
  });

  it('rejects an impossible scheduled calendar date with the safe payload error', async () => {
    const provider = paginatedClient({
      emailPages: [
        [
          {
            id: 'invalid_scheduled_date',
            to: ['one@example.com'],
            created_at: '2026-02-01T00:00:00.000Z',
            scheduled_at: '2026-02-31T12:00:00.000Z',
            last_event: 'scheduled',
          },
        ],
      ],
    });
    let outcome = 'resolved';

    try {
      await snapshotResendLifecycle(provider.client);
    } catch (error) {
      outcome = error instanceof Error ? error.message : 'unknown_error';
    }

    expect(outcome).toBe('provider_emails_payload_invalid');
  });

  it('accepts the PostgreSQL-style timestamp shape returned by live Resend contacts', async () => {
    const provider = paginatedClient({
      contactPages: [
        [
          {
            id: 'contact_1',
            email: 'one@example.com',
            first_name: null,
            last_name: null,
            unsubscribed: false,
            created_at: '2026-08-01 00:00:00.123456+00',
          },
        ],
      ],
      emailPages: [[]],
    });

    await expect(
      snapshotResendLifecycle(provider.client)
    ).resolves.toMatchObject({
      contacts: [{ id: 'contact_1' }],
      scheduledEmails: [],
    });
  });

  it('detects a non-adjacent cursor cycle without walking the maximum page budget', async () => {
    const provider = paginatedClient({ emailPages: [[]] });
    const contacts = [
      {
        id: 'contact_1',
        email: 'one@example.com',
        first_name: null,
        last_name: null,
        unsubscribed: false,
        created_at: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'contact_2',
        email: 'two@example.com',
        first_name: null,
        last_name: null,
        unsubscribed: false,
        created_at: '2026-08-02T00:00:00.000Z',
      },
    ];
    provider.contactsList.mockImplementation(
      async (options?: { after?: string }) => {
        const item = options?.after === 'contact_1' ? contacts[1] : contacts[0];
        return {
          data: { object: 'list', data: [item], has_more: true },
          error: null,
          headers: null,
        };
      }
    );

    await expect(snapshotResendLifecycle(provider.client)).rejects.toThrow(
      /provider_contacts_pagination_invalid/u
    );
    expect(provider.contactsList.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('rejects a provider page larger than the requested page size', async () => {
    const provider = paginatedClient({ emailPages: [[]] });
    provider.contactsList.mockResolvedValueOnce({
      data: {
        object: 'list',
        data: Array.from({ length: 101 }, (_, index) => ({
          id: `contact_${index}`,
          email: `person-${index}@example.com`,
          first_name: null,
          last_name: null,
          unsubscribed: false,
          created_at: '2026-08-01T00:00:00.000Z',
        })),
        has_more: false,
      },
      error: null,
      headers: null,
    });

    await expect(snapshotResendLifecycle(provider.client)).rejects.toThrow(
      /provider_contacts_pagination_invalid/u
    );
  });

  it('caps each collection at 100 pages and 10000 retained records', async () => {
    const provider = paginatedClient({ emailPages: [[]] });
    let page = 0;
    provider.contactsList.mockImplementation(async () => {
      const pageNumber = page++;
      return {
        data: {
          object: 'list',
          data: Array.from({ length: 100 }, (_, index) => ({
            id: `contact_${pageNumber}_${index}`,
            email: `person-${pageNumber}-${index}@example.com`,
            first_name: null,
            last_name: null,
            unsubscribed: false,
            created_at: '2026-08-01T00:00:00.000Z',
          })),
          has_more: true,
        },
        error: null,
        headers: null,
      };
    });

    await expect(snapshotResendLifecycle(provider.client)).rejects.toThrow(
      /provider_contacts_pagination_invalid/u
    );
    expect(provider.contactsList).toHaveBeenCalledTimes(100);
  });
});

describe('cancellationDeadline', () => {
  it('returns null without attempting a timing comparison when no messages are scheduled', () => {
    expect(
      cancellationDeadline(
        { contacts: fixtureSnapshot().contacts, scheduledEmails: [] },
        new Date(Number.NaN)
      )
    ).toBeNull();
  });
});

describe('redacted dry run and guards', () => {
  it('prints aggregate categories only and never provider PII or payloads', async () => {
    const provider = paginatedClient();
    const harness = mainHarness({
      client: provider.client,
      environment: { RESEND_API_KEY: 're_secret_value' },
    });

    const exitCode = await mainImportResendLifecycle(
      ['--dry-run'],
      harness.dependencies
    );

    expect(exitCode).toBe(0);
    expect(harness.output).toHaveLength(1);
    const line = String(harness.output[0]);
    expect(JSON.parse(line)).toEqual({
      command: 'import-resend-lifecycle',
      mode: 'dry_run',
      contacts: 1,
      contact_categories: { subscribed: 1, unsubscribed: 0 },
      scheduled: 1,
      scheduled_statuses: { scheduled: 1 },
    });
    expect(line).not.toMatch(
      /@|First|Person|private|contact_provider|email_/iu
    );
    expect(harness.createExecutor).not.toHaveBeenCalled();
    expect(harness.loadKeyring).not.toHaveBeenCalled();
    expect(provider.cancel).not.toHaveBeenCalled();
  });

  it('redacts provider error messages that may contain contact PII', async () => {
    const provider = paginatedClient({
      contactError: {
        name: 'application_error',
        message: 'Failed for secret.person@example.com named Secret Person',
        statusCode: 500,
      },
    });
    const harness = mainHarness({
      client: provider.client,
      environment: { RESEND_API_KEY: 're_secret_value' },
    });

    const exitCode = await mainImportResendLifecycle(
      ['--dry-run'],
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(harness.output).toEqual([]);
    expect(harness.errors).toEqual([
      'Resend lifecycle import failed: provider_contacts_list_failed',
    ]);
    expect(harness.errors.join('\n')).not.toMatch(
      /@|Secret|application_error/iu
    );
  });

  it('aborts snapshot drift before loading keys, opening Neon, or writing', async () => {
    const harness = mainHarness({
      environment: {
        RESEND_API_KEY: 're_secret_value',
        TEST_DATABASE_URL: 'postgres://test-safe',
      },
    });

    const exitCode = await mainImportResendLifecycle(
      ['--apply', '--expected-contacts', '14', '--expected-scheduled', '17'],
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(harness.errors).toEqual([
      'Resend lifecycle import failed: snapshot_count_drift',
    ]);
    expect(harness.loadKeyring).not.toHaveBeenCalled();
    expect(harness.createExecutor).not.toHaveBeenCalled();
  });

  it('requires TEST_DATABASE_URL or an explicit DATABASE_URL apply acknowledgement', async () => {
    const harness = mainHarness({
      environment: {
        RESEND_API_KEY: 're_secret_value',
        DATABASE_URL: 'postgres://could-be-live',
      },
    });

    const exitCode = await mainImportResendLifecycle(
      ['--apply', '--expected-contacts', '1', '--expected-scheduled', '1'],
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(harness.errors).toEqual([
      'Resend lifecycle import failed: apply_database_guard_failed',
    ]);
    expect(harness.createClient).not.toHaveBeenCalled();
    expect(harness.createExecutor).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'rejects conflicting test and environment-bound database targets before reading Resend (acknowledged=%s)',
    async (acknowledged) => {
      const harness = mainHarness({
        environment: {
          RESEND_API_KEY: 're_secret_value',
          TEST_DATABASE_URL: 'postgres://test-safe',
          DATABASE_URL: 'postgres://environment-bound',
        },
      });

      const exitCode = await mainImportResendLifecycle(
        [
          '--apply',
          '--expected-contacts',
          '1',
          '--expected-scheduled',
          '1',
          ...(acknowledged ? ['--allow-database-url-apply'] : []),
        ],
        harness.dependencies
      );

      expect(exitCode).toBe(1);
      expect(harness.errors).toEqual([
        'Resend lifecycle import failed: apply_database_guard_failed',
      ]);
      expect(harness.createClient).not.toHaveBeenCalled();
      expect(harness.createExecutor).not.toHaveBeenCalled();
    }
  );

  it('rejects the environment-bound acknowledgement when only TEST_DATABASE_URL is selected', async () => {
    const harness = mainHarness({
      environment: {
        RESEND_API_KEY: 're_secret_value',
        TEST_DATABASE_URL: 'postgres://test-safe',
      },
    });

    const exitCode = await mainImportResendLifecycle(
      [
        '--apply',
        '--expected-contacts',
        '1',
        '--expected-scheduled',
        '1',
        '--allow-database-url-apply',
      ],
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(harness.errors).toEqual([
      'Resend lifecycle import failed: apply_database_guard_failed',
    ]);
    expect(harness.createClient).not.toHaveBeenCalled();
    expect(harness.createExecutor).not.toHaveBeenCalled();
  });

  it('rejects an unsafe cancellation window before loading keys or opening Neon', async () => {
    const provider = paginatedClient({
      emailPages: [
        [
          {
            id: 'email_scheduled_1',
            to: ['first.person@example.com'],
            created_at: '2026-09-01T00:00:00.000Z',
            scheduled_at: '2026-09-01T12:34:59.999Z',
            last_event: 'scheduled',
          },
        ],
      ],
    });
    const nowFn = vi.fn(() => now);
    const harness = mainHarness({
      client: provider.client,
      environment: {
        RESEND_API_KEY: 're_secret_value',
        TEST_DATABASE_URL: 'postgres://test-safe',
      },
      now: nowFn,
    });

    const exitCode = await mainImportResendLifecycle(
      ['--apply', '--expected-contacts', '1', '--expected-scheduled', '1'],
      harness.dependencies
    );

    expect(exitCode).toBe(1);
    expect(harness.errors).toEqual([
      'Resend lifecycle import failed: snapshot_cancellation_window_insufficient',
    ]);
    expect(nowFn).toHaveBeenCalledTimes(1);
    expect(harness.loadKeyring).not.toHaveBeenCalled();
    expect(harness.createExecutor).not.toHaveBeenCalled();
    expect(provider.cancel).not.toHaveBeenCalled();
  });

  it('accepts the exact 35-minute cancellation boundary', async () => {
    const provider = paginatedClient({
      emailPages: [
        [
          {
            id: 'email_scheduled_1',
            to: ['first.person@example.com'],
            created_at: '2026-09-01T00:00:00.000Z',
            scheduled_at: '2026-09-01T12:35:00.000Z',
            last_event: 'scheduled',
          },
        ],
      ],
    });
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
    };
    const nowFn = vi.fn(() => now);
    const harness = mainHarness({
      client: provider.client,
      executor: importExecutor(state),
      environment: {
        RESEND_API_KEY: 're_secret_value',
        TEST_DATABASE_URL: 'postgres://test-safe',
      },
      now: nowFn,
    });

    const exitCode = await mainImportResendLifecycle(
      ['--apply', '--expected-contacts', '1', '--expected-scheduled', '1'],
      harness.dependencies
    );

    expect(exitCode).toBe(0);
    expect(nowFn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(harness.output[0]))).toMatchObject({
      cancellation_deadline: '2026-09-01T12:30:00.000Z',
      cancellation_remaining_seconds: 1800,
    });
  });

  it('applies a zero-schedule snapshot with null deadline output', async () => {
    const provider = paginatedClient({ emailPages: [[]] });
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
    };
    const harness = mainHarness({
      client: provider.client,
      executor: importExecutor(state),
      environment: {
        RESEND_API_KEY: 're_secret_value',
        TEST_DATABASE_URL: 'postgres://test-safe',
      },
      now: () => now,
    });

    const exitCode = await mainImportResendLifecycle(
      ['--apply', '--expected-contacts', '1', '--expected-scheduled', '0'],
      harness.dependencies
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(String(harness.output[0]))).toEqual({
      command: 'import-resend-lifecycle',
      mode: 'apply',
      contacts_created: 1,
      contacts_existing: 0,
      contacts_rekeyed: 0,
      legacy_contact_markers_created: 1,
      legacy_contact_markers_existing: 0,
      legacy_scheduled_jobs_created: 0,
      legacy_scheduled_jobs_existing: 0,
      legacy_provider_cancellations_required: 0,
      cancellation_deadline: null,
      cancellation_remaining_seconds: null,
    });
  });

  it('applies only after exact counts and passes TEST_DATABASE_URL explicitly', async () => {
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
    };
    const executor = importExecutor(state);
    const harness = mainHarness({
      executor,
      environment: {
        RESEND_API_KEY: 're_secret_value',
        TEST_DATABASE_URL: 'postgres://test-safe',
      },
      now: () => now,
    });

    const exitCode = await mainImportResendLifecycle(
      ['--apply', '--expected-contacts', '1', '--expected-scheduled', '1'],
      harness.dependencies
    );

    expect(exitCode).toBe(0);
    expect(harness.createExecutor).toHaveBeenCalledWith('postgres://test-safe');
    expect(harness.loadKeyring).toHaveBeenCalledTimes(1);
    const line = String(harness.output[0]);
    expect(JSON.parse(line)).toEqual({
      command: 'import-resend-lifecycle',
      mode: 'apply',
      contacts_created: 1,
      contacts_existing: 0,
      contacts_rekeyed: 0,
      legacy_contact_markers_created: 1,
      legacy_contact_markers_existing: 0,
      legacy_scheduled_jobs_created: 1,
      legacy_scheduled_jobs_existing: 0,
      legacy_provider_cancellations_required: 0,
      cancellation_deadline: '2026-09-03T11:55:00.000Z',
      cancellation_remaining_seconds: 172500,
    });
    expect(line).not.toMatch(/@|provider_contact_|provider_email_/u);
  });

  it('uses only DATABASE_URL with the explicit environment-bound acknowledgement', async () => {
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
    };
    const executor = importExecutor(state);
    const harness = mainHarness({
      executor,
      environment: {
        RESEND_API_KEY: 're_secret_value',
        DATABASE_URL: 'postgres://environment-bound',
      },
      now: () => now,
    });

    const exitCode = await mainImportResendLifecycle(
      [
        '--apply',
        '--expected-contacts',
        '1',
        '--expected-scheduled',
        '1',
        '--allow-database-url-apply',
      ],
      harness.dependencies
    );

    expect(exitCode).toBe(0);
    expect(harness.createExecutor).toHaveBeenCalledWith(
      'postgres://environment-bound'
    );
  });
});

interface ImportState {
  contacts: Map<
    string,
    {
      id: string;
      email_normalized: string;
      email_lookup_hmac: string;
      email_hmac_key_version: number;
      outreach_approved_at: Date | null;
      deleted_at: null;
      updated_at: Date;
    }
  >;
  jobs: Map<string, Record<string, unknown>>;
  activities: Map<string, Record<string, unknown>>;
  nextContact: number;
  failAtMarker?: string;
  queries?: Array<{
    sql: string;
    parameters: readonly unknown[];
  }>;
}

function importExecutor(state: ImportState): SqlExecutor {
  const transaction: SqlTransaction = {
    async execute<Row extends Record<string, unknown>>(
      sql: string,
      parameters: readonly unknown[] = []
    ): Promise<SqlQueryResult<Row>> {
      state.queries?.push({ sql, parameters: [...parameters] });
      const marker = /\/\* growth:([a-z0-9-]+) \*\//u.exec(sql)?.[1];
      if (marker === state.failAtMarker) throw new Error('injected failure');
      if (marker === 'lock-resend-lifecycle-import') return { rows: [] };
      if (marker === 'import-read-key-versions') {
        return {
          rows: [...state.contacts.values()].map((contact) => ({
            email_hmac_key_version: contact.email_hmac_key_version,
          })),
        } as SqlQueryResult<Row>;
      }
      if (marker === 'import-find-contact') {
        const candidates = JSON.parse(String(parameters[0])) as {
          digest: string;
          key_version: number;
        }[];
        const email = String(parameters[1]);
        const found = [...state.contacts.values()].filter(
          (contact) =>
            contact.email_normalized === email ||
            candidates.some(
              (candidate) =>
                candidate.key_version === contact.email_hmac_key_version &&
                candidate.digest === contact.email_lookup_hmac
            )
        );
        return { rows: found } as SqlQueryResult<Row>;
      }
      if (marker === 'import-insert-contact') {
        const id = `00000000-0000-4000-8000-${String(
          state.nextContact++
        ).padStart(12, '0')}`;
        const contact = {
          id,
          email_normalized: String(parameters[0]),
          email_lookup_hmac: String(parameters[1]),
          email_hmac_key_version: Number(parameters[2]),
          outreach_approved_at: null,
          deleted_at: null,
          updated_at: now,
        };
        state.contacts.set(contact.email_normalized, contact);
        return { rows: [contact] } as SqlQueryResult<Row>;
      }
      if (marker === 'import-add-lookup-alias') {
        const key = String(parameters[0]);
        if (!state.activities.has(key)) {
          state.activities.set(key, {
            event_key: key,
            contact_id: parameters[1],
            kind: 'contact.lookup_alias_added',
          });
          return { rows: [{ event_key: key }] } as SqlQueryResult<Row>;
        }
        return { rows: [] } as SqlQueryResult<Row>;
      }
      if (marker === 'import-read-lookup-alias') {
        const activity = state.activities.get(String(parameters[0]));
        return { rows: activity ? [activity] : [] } as SqlQueryResult<Row>;
      }
      if (marker === 'import-rekey-contact') {
        const contact = [...state.contacts.values()].find(
          ({ id }) => id === parameters[0]
        );
        if (!contact) return { rows: [] } as SqlQueryResult<Row>;
        contact.email_hmac_key_version = Number(parameters[1]);
        contact.email_lookup_hmac = String(parameters[2]);
        return { rows: [contact] } as SqlQueryResult<Row>;
      }
      if (marker === 'import-insert-cutover-configuration') {
        const key = String(parameters[0]);
        if (state.activities.has(key)) {
          return { rows: [] } as SqlQueryResult<Row>;
        }
        const activity = {
          event_key: key,
          contact_id: null,
          project_id: null,
          occurred_at: parameters[1],
          kind: parameters[2],
          data: JSON.parse(String(parameters[3])),
        };
        state.activities.set(key, activity);
        return { rows: [activity] } as SqlQueryResult<Row>;
      }
      if (marker === 'import-read-cutover-configuration') {
        const activity = state.activities.get(String(parameters[0]));
        return { rows: activity ? [activity] : [] } as SqlQueryResult<Row>;
      }
      if (marker === 'import-insert-contact-marker') {
        const idempotencyKey = String(parameters[2]);
        if (state.jobs.has(idempotencyKey)) {
          return { rows: [] } as SqlQueryResult<Row>;
        }
        const job = {
          id: `00000000-0000-4000-8000-${String(state.jobs.size + 100).padStart(
            12,
            '0'
          )}`,
          kind: 'legacy',
          contact_id: parameters[0],
          status: 'cancelled',
          available_at: parameters[1],
          provider_email_id: null,
          idempotency_key: idempotencyKey,
          delivery_status: 'not_submitted',
          payload: JSON.parse(String(parameters[3])),
        };
        state.jobs.set(idempotencyKey, job);
        return { rows: [job] } as SqlQueryResult<Row>;
      }
      if (marker === 'import-read-contact-marker') {
        const job = state.jobs.get(String(parameters[0]));
        return { rows: job ? [job] : [] } as SqlQueryResult<Row>;
      }
      if (marker === 'import-insert-legacy-job') {
        const idempotencyKey = String(parameters[3]);
        if (state.jobs.has(idempotencyKey))
          return { rows: [] } as SqlQueryResult<Row>;
        const job = {
          id: `00000000-0000-4000-8000-${String(state.jobs.size + 100).padStart(
            12,
            '0'
          )}`,
          kind: 'legacy',
          contact_id: parameters[0],
          status: 'pending',
          available_at: parameters[1],
          provider_email_id: parameters[2],
          idempotency_key: idempotencyKey,
          delivery_status: 'not_submitted',
          payload: JSON.parse(String(parameters[4])),
        };
        state.jobs.set(idempotencyKey, job);
        return { rows: [job] } as SqlQueryResult<Row>;
      }
      if (marker === 'import-read-legacy-job') {
        const job = state.jobs.get(String(parameters[0]));
        return { rows: job ? [job] : [] } as SqlQueryResult<Row>;
      }
      if (marker === 'import-read-provider-stop') {
        const activity = state.activities.get(String(parameters[0]));
        return { rows: activity ? [activity] : [] } as SqlQueryResult<Row>;
      }
      if (marker === 'lock-contact-for-stop') {
        const contact = [...state.contacts.values()].find(
          ({ id }) => id === parameters[0]
        );
        return { rows: contact ? [contact] : [] } as SqlQueryResult<Row>;
      }
      if (marker === 'insert-stop-activity') {
        const key = String(parameters[0]);
        if (state.activities.has(key))
          return { rows: [] } as SqlQueryResult<Row>;
        state.activities.set(key, {
          event_key: key,
          contact_id: parameters[1],
          project_id: null,
          occurred_at: parameters[2],
          kind: parameters[3],
          data: JSON.parse(String(parameters[4])),
        });
        return { rows: [{ event_key: key }] } as SqlQueryResult<Row>;
      }
      if (marker === 'read-stop-activity') {
        const activity = state.activities.get(String(parameters[0]));
        return { rows: activity ? [activity] : [] } as SqlQueryResult<Row>;
      }
      if (marker === 'finalize-stop-activity') {
        const key = String(parameters[0]);
        const activity = state.activities.get(key);
        if (!activity) return { rows: [] } as SqlQueryResult<Row>;
        const data = activity['data'] as Record<string, unknown>;
        if ('result' in data) return { rows: [] } as SqlQueryResult<Row>;
        data['result'] = JSON.parse(String(parameters[1]));
        return { rows: [{ event_key: key }] } as SqlQueryResult<Row>;
      }
      if (marker === 'clear-stop-approval') {
        const contact = [...state.contacts.values()].find(
          ({ id }) => id === parameters[0]
        );
        const stopAt = new Date(parameters[1] as Date | string);
        if (
          contact?.outreach_approved_at &&
          contact.outreach_approved_at.getTime() <= stopAt.getTime()
        ) {
          contact.outreach_approved_at = null;
          return { rows: [{ id: contact.id }] } as SqlQueryResult<Row>;
        }
        return { rows: [] } as SqlQueryResult<Row>;
      }
      if (marker === 'lock-stop-jobs') {
        const rows = [...state.jobs.values()]
          .filter(({ contact_id }) => contact_id === parameters[0])
          .map((job) => ({
            project_id: null,
            lease_token: null,
            authorization_event_key: null,
            authorization_contact_id: null,
            authorization_project_id: null,
            authorization_kind: null,
            authorization_occurred_at: null,
            authorization_data: null,
            ...job,
          }));
        return { rows } as unknown as SqlQueryResult<Row>;
      }
      if (marker === 'cancel-stop-jobs') {
        const ids = new Set(parameters[1] as string[]);
        for (const job of state.jobs.values()) {
          if (ids.has(String(job['id']))) {
            job['status'] = 'cancelled';
            job['last_error_code'] = 'contact_stopped';
          }
        }
        return { rows: [] };
      }
      if (marker === 'read-stop-race-reviews') return { rows: [] };
      throw new Error(`Unexpected SQL marker: ${marker ?? 'missing'}`);
    },
  };
  return {
    execute: transaction.execute,
    async transaction(operation) {
      const before = structuredClone({
        contacts: [...state.contacts.entries()],
        jobs: [...state.jobs.entries()],
        activities: [...state.activities.entries()],
        nextContact: state.nextContact,
      });
      try {
        return await operation(transaction);
      } catch (error) {
        state.contacts = new Map(before.contacts);
        state.jobs = new Map(before.jobs);
        state.activities = new Map(before.activities);
        state.nextContact = before.nextContact;
        throw error;
      }
    },
  };
}

function recordedQuery(state: ImportState, marker: string) {
  const query = state.queries?.find(({ sql }) =>
    sql.includes(`/* growth:${marker} */`)
  );
  if (!query) throw new Error(`Expected recorded query for ${marker}`);
  return query;
}

function compactSql(sql: string): string {
  return sql.replace(/\s+/gu, ' ').trim();
}

function fixtureSnapshot(): ResendLifecycleSnapshot {
  return {
    contacts: [
      {
        id: 'provider_contact_1',
        email: ' First.Person@Example.COM ',
        first_name: 'First',
        last_name: 'Person',
        unsubscribed: false,
        created_at: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'provider_contact_2',
        email: 'stopped@example.com',
        first_name: null,
        last_name: null,
        unsubscribed: true,
        created_at: '2026-08-02T00:00:00.000Z',
      },
    ],
    scheduledEmails: [
      {
        id: 'provider_email_1',
        to: ['first.person@example.com'],
        scheduled_at: '2026-09-03T12:00:00.000Z',
        created_at: '2026-09-01T00:00:00.000Z',
        last_event: 'scheduled',
      },
      {
        id: 'provider_email_2',
        to: ['stopped@example.com'],
        scheduled_at: '2026-09-04T12:00:00.000Z',
        created_at: '2026-09-01T00:00:00.000Z',
        last_event: 'scheduled',
      },
    ],
  };
}

function oneContactSnapshot(scheduledAt?: string): ResendLifecycleSnapshot {
  const fixture = fixtureSnapshot();
  return {
    contacts: fixture.contacts.slice(0, 1),
    scheduledEmails:
      scheduledAt === undefined
        ? []
        : [
            {
              ...(fixture
                .scheduledEmails[0] as ResendLifecycleSnapshot['scheduledEmails'][number]),
              scheduled_at: scheduledAt,
            },
          ],
  };
}

const expectedFixtureSnapshotIdentity =
  '60242884d71c5e0f7b23323b4af191a1a59aca157e150d2ab1315362dfcf5e3d';

describe('importResendLifecycleSnapshot', () => {
  it('creates one terminal legacy marker for a contact with no scheduled messages', async () => {
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
      queries: [],
    };

    const result = await importResendLifecycleSnapshot(
      importExecutor(state),
      oneContactSnapshot(),
      keyring,
      now
    );

    expect(result).toEqual({
      contacts_created: 1,
      contacts_existing: 0,
      contacts_rekeyed: 0,
      legacy_contact_markers_created: 1,
      legacy_contact_markers_existing: 0,
      legacy_scheduled_jobs_created: 0,
      legacy_scheduled_jobs_existing: 0,
      legacy_provider_cancellations_required: 0,
    });
    expect(state.jobs).toHaveLength(1);
    const markerKey = 'legacy:resend:contact:provider_contact_1';
    const markerPayload = {
      imported: true,
      legacy_type: 'contact_marker',
      provider: 'resend',
      provider_contact_id: 'provider_contact_1',
    };
    const marker = state.jobs.get(markerKey);
    const importedContact = state.contacts.get('first.person@example.com');
    expect({
      contact_id: marker?.['contact_id'],
      kind: marker?.['kind'],
      status: marker?.['status'],
      available_at: marker?.['available_at'],
      idempotency_key: marker?.['idempotency_key'],
      payload: marker?.['payload'],
      provider_email_id: marker?.['provider_email_id'],
      delivery_status: marker?.['delivery_status'],
    }).toEqual({
      contact_id: importedContact?.id,
      kind: 'legacy',
      status: 'cancelled',
      available_at: now,
      idempotency_key: markerKey,
      payload: markerPayload,
      provider_email_id: null,
      delivery_status: 'not_submitted',
    });
    const markerInsert = recordedQuery(state, 'import-insert-contact-marker');
    expect(compactSql(markerInsert.sql)).toContain(
      'insert into growth_jobs ( kind, contact_id, status, available_at, idempotency_key, payload, provider_email_id, delivery_status )'
    );
    expect(compactSql(markerInsert.sql)).toContain(
      "values ( 'legacy', $1, 'cancelled', $2, $3, $4::jsonb, null, 'not_submitted' )"
    );
    expect(compactSql(markerInsert.sql)).toContain(
      'on conflict (idempotency_key) do nothing'
    );
    expect(markerInsert.parameters).toEqual([
      importedContact?.id,
      now,
      markerKey,
      JSON.stringify(markerPayload),
    ]);
    expect(
      state.contacts.get('first.person@example.com')?.outreach_approved_at
    ).toBeNull();
    expect(
      state.activities.get('legacy:resend:cutover:v1:configuration')?.['data']
    ).toMatchObject({
      cancellation_deadline: null,
      expected_contacts: 1,
      expected_scheduled: 0,
    });
  });

  it('creates a contact marker and a separate provider-bound scheduled legacy job', async () => {
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
      queries: [],
    };

    const result = await importResendLifecycleSnapshot(
      importExecutor(state),
      oneContactSnapshot('2026-09-03T12:00:00.000Z'),
      keyring,
      now
    );

    expect(result).toMatchObject({
      legacy_contact_markers_created: 1,
      legacy_contact_markers_existing: 0,
      legacy_scheduled_jobs_created: 1,
      legacy_scheduled_jobs_existing: 0,
    });
    expect(state.jobs).toHaveLength(2);
    const scheduledKey = 'legacy:resend:scheduled:provider_email_1';
    const scheduledPayload = {
      imported: true,
      legacy_type: 'scheduled_message',
      provider: 'resend',
      provider_state: 'scheduled',
    };
    const scheduled = state.jobs.get(scheduledKey);
    const importedContact = state.contacts.get('first.person@example.com');
    const scheduledAt = new Date('2026-09-03T12:00:00.000Z');
    expect({
      contact_id: scheduled?.['contact_id'],
      kind: scheduled?.['kind'],
      status: scheduled?.['status'],
      available_at: scheduled?.['available_at'],
      idempotency_key: scheduled?.['idempotency_key'],
      payload: scheduled?.['payload'],
      provider_email_id: scheduled?.['provider_email_id'],
      delivery_status: scheduled?.['delivery_status'],
    }).toEqual({
      contact_id: importedContact?.id,
      kind: 'legacy',
      status: 'pending',
      available_at: scheduledAt,
      idempotency_key: scheduledKey,
      payload: scheduledPayload,
      provider_email_id: 'provider_email_1',
      delivery_status: 'not_submitted',
    });
    const scheduledInsert = recordedQuery(state, 'import-insert-legacy-job');
    expect(compactSql(scheduledInsert.sql)).toContain(
      'insert into growth_jobs ( kind, contact_id, status, available_at, idempotency_key, payload, provider_email_id, delivery_status )'
    );
    expect(compactSql(scheduledInsert.sql)).toContain(
      "values ( 'legacy', $1, 'pending', $2, $4, $5::jsonb, $3, 'not_submitted' )"
    );
    expect(compactSql(scheduledInsert.sql)).toContain(
      'on conflict (idempotency_key) do nothing'
    );
    expect(scheduledInsert.parameters).toEqual([
      importedContact?.id,
      scheduledAt,
      'provider_email_1',
      scheduledKey,
      JSON.stringify(scheduledPayload),
    ]);
  });

  it('reapplies the same snapshot without duplicating either legacy row type', async () => {
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
    };
    const executor = importExecutor(state);
    const snapshot = oneContactSnapshot('2026-09-03T12:00:00.000Z');
    await importResendLifecycleSnapshot(executor, snapshot, keyring, now);

    const result = await importResendLifecycleSnapshot(
      executor,
      snapshot,
      keyring,
      now
    );

    expect(result).toMatchObject({
      legacy_contact_markers_created: 0,
      legacy_contact_markers_existing: 1,
      legacy_scheduled_jobs_created: 0,
      legacy_scheduled_jobs_existing: 1,
    });
    expect(state.jobs).toHaveLength(2);
  });

  it.each([
    ['status', (row: Record<string, unknown>) => (row['status'] = 'pending')],
    [
      'provider binding',
      (row: Record<string, unknown>) =>
        (row['provider_email_id'] = 'conflicting_message'),
    ],
    [
      'delivery status',
      (row: Record<string, unknown>) => (row['delivery_status'] = 'submitted'),
    ],
    [
      'payload',
      (row: Record<string, unknown>) =>
        (row['payload'] = {
          imported: true,
          legacy_type: 'contact_marker',
          provider: 'resend',
        }),
    ],
  ] as const)(
    'rejects a contact marker with conflicting %s',
    async (_name, tamper) => {
      const state: ImportState = {
        contacts: new Map(),
        jobs: new Map(),
        activities: new Map(),
        nextContact: 1,
      };
      const executor = importExecutor(state);
      const snapshot = oneContactSnapshot();
      await importResendLifecycleSnapshot(executor, snapshot, keyring, now);
      const marker = state.jobs.get('legacy:resend:contact:provider_contact_1');
      if (!marker) throw new Error('Fixture contact marker missing');
      tamper(marker);

      await expect(
        importResendLifecycleSnapshot(executor, snapshot, keyring, now)
      ).rejects.toThrow(/^snapshot_identity_conflict$/u);
    }
  );

  it('never grants outreach approval while importing an existing contact', async () => {
    const lookup = createEmailLookupHmac(
      'first.person@example.com',
      keyring.active
    );
    const approvedAt = new Date('2026-08-31T12:00:00.000Z');
    const existing = {
      id: contactId,
      email_normalized: 'first.person@example.com',
      email_lookup_hmac: lookup.digest,
      email_hmac_key_version: lookup.keyVersion,
      outreach_approved_at: approvedAt,
      deleted_at: null,
      updated_at: approvedAt,
    };
    const state: ImportState = {
      contacts: new Map([['first.person@example.com', existing]]),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 2,
    };

    await importResendLifecycleSnapshot(
      importExecutor(state),
      oneContactSnapshot(),
      keyring,
      now
    );

    expect(existing.outreach_approved_at).toEqual(approvedAt);
  });

  it.each([
    [
      'missing legacy type',
      {
        imported: true,
        provider: 'resend',
        provider_state: 'scheduled',
      },
    ],
    [
      'extra conflicting property',
      {
        imported: true,
        legacy_type: 'scheduled_message',
        provider: 'resend',
        provider_state: 'scheduled',
        conflicting: true,
      },
    ],
  ] as const)(
    'rejects a scheduled-message payload with %s on replay',
    async (_name, conflictingPayload) => {
      const state: ImportState = {
        contacts: new Map(),
        jobs: new Map(),
        activities: new Map(),
        nextContact: 1,
      };
      const executor = importExecutor(state);
      const snapshot = oneContactSnapshot('2026-09-03T12:00:00.000Z');
      await importResendLifecycleSnapshot(executor, snapshot, keyring, now);
      const scheduled = state.jobs.get(
        'legacy:resend:scheduled:provider_email_1'
      );
      if (!scheduled) throw new Error('Fixture scheduled job missing');
      scheduled['payload'] = conflictingPayload;

      await expect(
        importResendLifecycleSnapshot(executor, snapshot, keyring, now)
      ).rejects.toThrow(/^snapshot_identity_conflict$/u);
    }
  );

  it('persists one immutable cutover configuration and validates it on replay', async () => {
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
      queries: [],
    };
    const executor = importExecutor(state);
    const snapshot = fixtureSnapshot();
    await importResendLifecycleSnapshot(executor, snapshot, keyring, now);
    const eventKey = 'legacy:resend:cutover:v1:configuration';
    const configuration = state.activities.get(eventKey);
    const expectedData = {
      snapshot_at: now.toISOString(),
      cancellation_deadline: '2026-09-03T11:55:00.000Z',
      expected_contacts: 2,
      expected_scheduled: 2,
      snapshot_identity: expectedFixtureSnapshotIdentity,
    };

    expect(configuration).toEqual({
      event_key: eventKey,
      contact_id: null,
      project_id: null,
      kind: 'legacy.resend_cutover_configured',
      occurred_at: now,
      data: expectedData,
    });
    const configurationInsert = recordedQuery(
      state,
      'import-insert-cutover-configuration'
    );
    const configurationSql = compactSql(configurationInsert.sql);
    expect(configurationSql).toContain(
      'insert into growth_activity ( event_key, occurred_at, kind, data ) values ($1, $2, $3, $4::jsonb)'
    );
    expect(configurationSql).toContain('on conflict (event_key) do nothing');
    expect(configurationSql).not.toContain('do update');
    expect(configurationSql).not.toMatch(/\bupdate growth_activity\b/u);
    expect(configurationInsert.parameters).toEqual([
      eventKey,
      now,
      'legacy.resend_cutover_configured',
      JSON.stringify(expectedData),
    ]);
    expect(JSON.stringify(configuration)).not.toMatch(
      /@|provider_contact_|provider_email_/u
    );
    const immutableConfiguration = structuredClone(configuration);
    const reorderedSnapshot: ResendLifecycleSnapshot = {
      contacts: [...snapshot.contacts].reverse(),
      scheduledEmails: [...snapshot.scheduledEmails].reverse(),
    };

    await importResendLifecycleSnapshot(
      executor,
      reorderedSnapshot,
      keyring,
      new Date('2026-09-02T12:00:00.000Z')
    );

    expect(state.activities.get(eventKey)).toEqual(immutableConfiguration);
  });

  it.each([
    ['cancellation_deadline', '2026-09-03T11:54:59.999Z'],
    ['expected_contacts', 999],
    ['expected_scheduled', 999],
    ['snapshot_identity', '0'.repeat(64)],
  ] as const)(
    'rejects conflicting cutover configuration %s without replacing it',
    async (field, conflictingValue) => {
      const state: ImportState = {
        contacts: new Map(),
        jobs: new Map(),
        activities: new Map(),
        nextContact: 1,
      };
      const executor = importExecutor(state);
      const snapshot = fixtureSnapshot();
      const eventKey = 'legacy:resend:cutover:v1:configuration';
      await importResendLifecycleSnapshot(executor, snapshot, keyring, now);
      const configuration = state.activities.get(eventKey);
      const data = configuration?.['data'] as
        | Record<string, unknown>
        | undefined;
      if (!data) throw new Error('Fixture cutover configuration missing');
      data[field] = conflictingValue;

      await expect(
        importResendLifecycleSnapshot(
          executor,
          snapshot,
          keyring,
          new Date('2026-09-02T12:00:00.000Z')
        )
      ).rejects.toThrow(/^snapshot_identity_conflict$/u);

      const persistedData = state.activities.get(eventKey)?.['data'] as
        | Record<string, unknown>
        | undefined;
      expect(persistedData?.[field]).toEqual(conflictingValue);
      expect(state.activities.get(eventKey)?.['occurred_at']).toEqual(now);
    }
  );

  it('imports contacts, then applies provider unsubscribe through the canonical stop without provider mutation', async () => {
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
    };
    const executor = importExecutor(state);

    const result = await importResendLifecycleSnapshot(
      executor,
      fixtureSnapshot(),
      keyring,
      now
    );

    expect(result).toEqual({
      contacts_created: 2,
      contacts_existing: 0,
      contacts_rekeyed: 0,
      legacy_contact_markers_created: 2,
      legacy_contact_markers_existing: 0,
      legacy_scheduled_jobs_created: 2,
      legacy_scheduled_jobs_existing: 0,
      legacy_provider_cancellations_required: 1,
    });
    expect([...state.contacts.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email_normalized: 'first.person@example.com',
          email_hmac_key_version: 2,
          outreach_approved_at: null,
        }),
      ])
    );
    expect([...state.jobs.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'legacy',
          status: 'pending',
          delivery_status: 'not_submitted',
          provider_email_id: 'provider_email_1',
          available_at: new Date('2026-09-03T12:00:00.000Z'),
          payload: {
            imported: true,
            legacy_type: 'scheduled_message',
            provider: 'resend',
            provider_state: 'scheduled',
          },
        }),
      ])
    );
    expect(
      state.jobs.get('legacy:resend:scheduled:provider_email_2')?.['status']
    ).toBe('cancelled');
    const providerStop = state.activities.get(
      'legacy:resend:contact:provider_contact_2:unsubscribe'
    );
    expect(providerStop).toMatchObject({
      kind: 'unsubscribe',
      occurred_at: now,
    });
  });

  it('is idempotent on rerun and preserves an existing approval timestamp', async () => {
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
    };
    const executor = importExecutor(state);
    await importResendLifecycleSnapshot(
      executor,
      fixtureSnapshot(),
      keyring,
      now
    );
    const approved = state.contacts.get('first.person@example.com');
    if (!approved) throw new Error('Fixture contact missing');
    (approved as { outreach_approved_at: Date | null }).outreach_approved_at =
      new Date('2026-09-01T11:00:00.000Z');

    const rerun = await importResendLifecycleSnapshot(
      executor,
      fixtureSnapshot(),
      keyring,
      now
    );

    expect(rerun).toEqual({
      contacts_created: 0,
      contacts_existing: 2,
      contacts_rekeyed: 0,
      legacy_contact_markers_created: 0,
      legacy_contact_markers_existing: 2,
      legacy_scheduled_jobs_created: 0,
      legacy_scheduled_jobs_existing: 2,
      legacy_provider_cancellations_required: 1,
    });
    expect(approved.outreach_approved_at).toEqual(
      new Date('2026-09-01T11:00:00.000Z')
    );
  });

  it('treats a stopped or delivered legacy ledger as an idempotent rerun without resurrecting it', async () => {
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
    };
    const executor = importExecutor(state);
    await importResendLifecycleSnapshot(
      executor,
      fixtureSnapshot(),
      keyring,
      now
    );
    const first = state.jobs.get('legacy:resend:scheduled:provider_email_1');
    const second = state.jobs.get('legacy:resend:scheduled:provider_email_2');
    if (!first || !second) throw new Error('Fixture jobs missing');
    first['status'] = 'cancelled';
    second['status'] = 'completed';
    second['delivery_status'] = 'delivered';

    const result = await importResendLifecycleSnapshot(
      executor,
      fixtureSnapshot(),
      keyring,
      now
    );

    expect(result.legacy_scheduled_jobs_existing).toBe(2);
    expect(first['status']).toBe('cancelled');
    expect(second['delivery_status']).toBe('delivered');
  });

  it('uses observation time to stop an existing approved contact and cancels its imported ledger', async () => {
    const lookup = createEmailLookupHmac('stopped@example.com', keyring.active);
    const approvedAt = new Date('2026-09-01T11:00:00.000Z');
    const approvedContact = {
      id: contactId,
      email_normalized: 'stopped@example.com',
      email_lookup_hmac: lookup.digest,
      email_hmac_key_version: lookup.keyVersion,
      outreach_approved_at: approvedAt,
      deleted_at: null,
      updated_at: approvedAt,
    };
    const state: ImportState = {
      contacts: new Map([['stopped@example.com', approvedContact]]),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 10,
    };

    const result = await importResendLifecycleSnapshot(
      importExecutor(state),
      fixtureSnapshot(),
      keyring,
      now
    );

    expect(approvedContact.outreach_approved_at).toBeNull();
    expect(
      state.jobs.get('legacy:resend:scheduled:provider_email_2')?.['status']
    ).toBe('cancelled');
    expect(result.legacy_provider_cancellations_required).toBe(1);
    expect(
      state.activities.get(
        'legacy:resend:contact:provider_contact_2:unsubscribe'
      )?.['occurred_at']
    ).toEqual(now);
  });

  it('scopes provider unsubscribe stops and cancellation counts across multiple contacts', async () => {
    const snapshot = fixtureSnapshot();
    snapshot.contacts.push({
      id: 'provider_contact_3',
      email: 'also-stopped@example.com',
      first_name: null,
      last_name: null,
      unsubscribed: true,
      created_at: '2026-07-01T00:00:00.000Z',
    });
    snapshot.scheduledEmails.push({
      id: 'provider_email_3',
      to: ['also-stopped@example.com'],
      scheduled_at: '2026-09-05T12:00:00.000Z',
      created_at: '2026-09-01T00:00:00.000Z',
      last_event: 'scheduled',
    });
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
    };

    const result = await importResendLifecycleSnapshot(
      importExecutor(state),
      snapshot,
      keyring,
      now
    );

    expect(result.legacy_provider_cancellations_required).toBe(2);
    expect(
      state.jobs.get('legacy:resend:scheduled:provider_email_1')?.['status']
    ).toBe('pending');
    expect(
      state.jobs.get('legacy:resend:scheduled:provider_email_2')?.['status']
    ).toBe('cancelled');
    expect(
      state.jobs.get('legacy:resend:scheduled:provider_email_3')?.['status']
    ).toBe('cancelled');
  });

  it('reuses the first observed stop timestamp on a later idempotent rerun', async () => {
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
    };
    const executor = importExecutor(state);
    await importResendLifecycleSnapshot(
      executor,
      fixtureSnapshot(),
      keyring,
      now
    );
    const later = new Date('2026-09-03T12:00:00.000Z');

    const rerun = await importResendLifecycleSnapshot(
      executor,
      fixtureSnapshot(),
      keyring,
      later
    );

    expect(rerun.legacy_provider_cancellations_required).toBe(1);
    expect(
      state.activities.get(
        'legacy:resend:contact:provider_contact_2:unsubscribe'
      )?.['occurred_at']
    ).toEqual(now);
  });

  it('rolls back contacts, ledgers, and stops when canonical stop processing fails', async () => {
    const state: ImportState = {
      contacts: new Map(),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 1,
      failAtMarker: 'cancel-stop-jobs',
    };

    await expect(
      importResendLifecycleSnapshot(
        importExecutor(state),
        fixtureSnapshot(),
        keyring,
        now
      )
    ).rejects.toThrow(/injected failure/u);

    expect(state.contacts).toHaveLength(0);
    expect(state.jobs).toHaveLength(0);
    expect(state.activities).toHaveLength(0);
    expect(state.nextContact).toBe(1);
  });

  it('requires rotation coverage before importing any row', async () => {
    const state: ImportState = {
      contacts: new Map([
        [
          'old@example.com',
          {
            id: contactId,
            email_normalized: 'old@example.com',
            email_lookup_hmac: 'old-digest',
            email_hmac_key_version: 1,
            outreach_approved_at: null,
            deleted_at: null,
            updated_at: now,
          },
        ],
      ]),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 10,
    };

    await expect(
      importResendLifecycleSnapshot(
        importExecutor(state),
        fixtureSnapshot(),
        { active: keyring.active },
        now
      )
    ).rejects.toThrow(/rotation_coverage_failed/u);
    expect(state.contacts).toHaveLength(1);
    expect(state.jobs).toHaveLength(0);
  });

  it('preserves the prior lookup as an alias and rekeys to the active HMAC version', async () => {
    const previousLookup = createEmailLookupHmac(
      'first.person@example.com',
      keyring.previous?.[0] as NonNullable<EmailHmacKeyring['previous']>[number]
    );
    const existing = {
      id: contactId,
      email_normalized: 'first.person@example.com',
      email_lookup_hmac: previousLookup.digest,
      email_hmac_key_version: previousLookup.keyVersion,
      outreach_approved_at: null,
      deleted_at: null,
      updated_at: now,
    };
    const state: ImportState = {
      contacts: new Map([['first.person@example.com', existing]]),
      jobs: new Map(),
      activities: new Map(),
      nextContact: 10,
    };

    const result = await importResendLifecycleSnapshot(
      importExecutor(state),
      {
        contacts: fixtureSnapshot().contacts.slice(0, 1),
        scheduledEmails: fixtureSnapshot().scheduledEmails.slice(0, 1),
      },
      keyring,
      now
    );

    expect(result.contacts_rekeyed).toBe(1);
    expect(existing.email_hmac_key_version).toBe(2);
    expect(existing.email_lookup_hmac).toBe(
      createEmailLookupHmac('first.person@example.com', keyring.active).digest
    );
    expect(
      [...state.activities.values()].some(
        ({ kind }) => kind === 'contact.lookup_alias_added'
      )
    ).toBe(true);
  });

  it('rejects a conflicting pre-existing lookup alias before rekeying', async () => {
    const previousLookup = createEmailLookupHmac(
      'first.person@example.com',
      keyring.previous?.[0] as NonNullable<EmailHmacKeyring['previous']>[number]
    );
    const existing = {
      id: contactId,
      email_normalized: 'first.person@example.com',
      email_lookup_hmac: previousLookup.digest,
      email_hmac_key_version: previousLookup.keyVersion,
      outreach_approved_at: null,
      deleted_at: null,
      updated_at: now,
    };
    const aliasKey = `contact.lookup_alias_added:${contactId}:v1`;
    const state: ImportState = {
      contacts: new Map([['first.person@example.com', existing]]),
      jobs: new Map(),
      activities: new Map([
        [
          aliasKey,
          {
            event_key: aliasKey,
            contact_id: otherContactId,
            project_id: null,
            kind: 'contact.lookup_alias_added',
            occurred_at: now,
            data: { digest: 'forged', key_version: 1 },
          },
        ],
      ]),
      nextContact: 10,
    };

    await expect(
      importResendLifecycleSnapshot(
        importExecutor(state),
        {
          contacts: fixtureSnapshot().contacts.slice(0, 1),
          scheduledEmails: fixtureSnapshot().scheduledEmails.slice(0, 1),
        },
        keyring,
        now
      )
    ).rejects.toThrow(/snapshot_identity_conflict/u);
    expect(existing.email_hmac_key_version).toBe(1);
  });
});

describe('legacy selective stop compatibility', () => {
  it('returns only the stopped contact pending provider IDs and never calls cancel itself', async () => {
    const cancel = vi.fn();
    const transaction: SqlTransaction = {
      async execute<Row extends Record<string, unknown>>(
        sql: string,
        parameters: readonly unknown[] = []
      ): Promise<SqlQueryResult<Row>> {
        const marker = /\/\* growth:([a-z0-9-]+) \*\//u.exec(sql)?.[1];
        if (marker === 'lock-contact-for-stop') {
          return {
            rows: [
              {
                id: contactId,
                outreach_approved_at: null,
                deleted_at: null,
              },
            ],
          } as SqlQueryResult<Row>;
        }
        if (marker === 'insert-stop-activity') {
          return {
            rows: [{ event_key: parameters[0] }],
          } as SqlQueryResult<Row>;
        }
        if (marker === 'finalize-stop-activity') {
          return {
            rows: [{ event_key: parameters[0] }],
          } as SqlQueryResult<Row>;
        }
        if (marker === 'clear-stop-approval') return { rows: [] };
        if (marker === 'lock-stop-jobs') {
          expect(parameters).toEqual([contactId]);
          return {
            rows: [
              {
                id: '00000000-0000-4000-8000-000000000101',
                kind: 'legacy',
                contact_id: contactId,
                project_id: null,
                status: 'pending',
                delivery_status: 'not_submitted',
                provider_email_id: 'provider_for_stopped_contact',
                lease_token: null,
                payload: { imported: true },
                authorization_event_key: null,
                authorization_contact_id: null,
                authorization_project_id: null,
                authorization_kind: null,
                authorization_occurred_at: null,
                authorization_data: null,
              },
            ],
          } as SqlQueryResult<Row>;
        }
        if (marker === 'cancel-stop-jobs') {
          expect(parameters[1]).toEqual([
            '00000000-0000-4000-8000-000000000101',
          ]);
          return { rows: [] };
        }
        if (marker === 'read-stop-race-reviews') return { rows: [] };
        throw new Error(`Unexpected SQL marker: ${marker ?? 'missing'}`);
      },
    };
    const executor: SqlExecutor = {
      execute: transaction.execute,
      transaction: (operation) => operation(transaction),
    };

    const result = await stopContact(executor, {
      contactId,
      eventKey: 'founder-stop:legacy-selective-test',
      occurredAt: now,
      reason: 'manual_suppression',
      source: 'test',
      provenance: {
        actor: 'founder',
        kind: 'founder_action',
        policyVersion: 'growth-v1',
      },
    });

    expect(result.legacyProviderCancellationIds).toEqual([
      'provider_for_stopped_contact',
    ]);
    expect(result.legacyProviderCancellationIds).not.toContain(
      'provider_for_other_contact'
    );
    expect(cancel).not.toHaveBeenCalled();
    expect(otherContactId).not.toBe(contactId);
  });
});
