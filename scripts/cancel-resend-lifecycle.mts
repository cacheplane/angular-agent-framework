import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createDatabaseExecutor,
  type SqlExecutor,
} from '../libs/growth/src/index.ts';

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const MAX_TOTAL_RECORDS = PAGE_SIZE * MAX_PAGES;
const MAX_PROVIDER_ID_LENGTH = 200;
const MAX_PROVIDER_REQUEST_MS = 10_000;
// Resend inventory and exact-email wrappers are small; one MiB is a closed,
// conservative ceiling that prevents provider bodies from growing unchecked.
const MAX_PROVIDER_RESPONSE_BYTES = 1_048_576;
const CANCELLATION_CLAIM_GRACE_MS = 5_000;
const DELIVERY_SAFETY_MARGIN_MS = 5 * 60_000;
const CUTOVER_CONFIGURATION_EVENT_KEY =
  'legacy:resend:cutover:v1:configuration';
const CUTOVER_CONFIGURATION_KIND = 'legacy.resend_cutover_configured';
const CANCELLATION_ACTIVITY_KIND = 'legacy.resend_schedule_cancelled';
const USAGE =
  'Usage: npm run growth:cancel-resend -- --dry-run | --apply --expected-scheduled N [--allow-database-url-apply]';

type Environment = Record<string, string | undefined>;

export type ProviderListResponse<T> =
  | {
      data: { object: 'list'; data: T[]; has_more: boolean };
      error: null;
    }
  | { data: null; error: unknown };

interface ProviderRequestOptions {
  signal?: AbortSignal;
}

export interface LegacyCancellationClient {
  emails: {
    list(
      options: { limit: number; after?: string },
      request?: ProviderRequestOptions
    ): Promise<ProviderListResponse<unknown>>;
    cancel(
      id: string,
      request?: ProviderRequestOptions
    ): Promise<{ data: unknown | null; error: unknown | null }>;
    get(
      id: string,
      request?: ProviderRequestOptions
    ): Promise<{ data: unknown | null; error: unknown | null }>;
  };
}

export interface LegacyCancellationDependencies {
  environment: Environment;
  createClient(apiKey: string): LegacyCancellationClient;
  createExecutor(databaseUrl: string): SqlExecutor;
  writeOutput(line: string): void;
  writeError(line: string): void;
  now?: () => Date;
}

export function createAbortableResendCancellationClient(
  apiKey: string,
  fetchImplementation: typeof fetch = fetch
): LegacyCancellationClient {
  async function readBoundedJson(
    response: Response,
    signal?: AbortSignal
  ): Promise<{ ok: true; value: unknown } | { ok: false }> {
    const body = response.body;
    if (body === null) return { ok: false };
    const reader = body.getReader();
    const rawContentLength = response.headers.get('content-length');
    const declaredContentLength =
      rawContentLength !== null && /^\d+$/u.test(rawContentLength)
        ? Number(rawContentLength)
        : null;
    const contentEncoding = response.headers.get('content-encoding');
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    let completed = false;

    async function readChunk(): Promise<ReadableStreamReadResult<Uint8Array>> {
      if (!signal) return reader.read();
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return new Promise((resolveRead, rejectRead) => {
        const abort = () =>
          rejectRead(new DOMException('Aborted', 'AbortError'));
        signal.addEventListener('abort', abort, { once: true });
        reader
          .read()
          .then(resolveRead, rejectRead)
          .finally(() => {
            signal.removeEventListener('abort', abort);
          });
      });
    }

    try {
      if (
        declaredContentLength !== null &&
        (!Number.isSafeInteger(declaredContentLength) ||
          declaredContentLength > MAX_PROVIDER_RESPONSE_BYTES)
      ) {
        return { ok: false };
      }
      while (true) {
        const chunk = await readChunk();
        if (chunk.done) break;
        totalBytes += chunk.value.byteLength;
        if (totalBytes > MAX_PROVIDER_RESPONSE_BYTES) return { ok: false };
        chunks.push(chunk.value);
      }
      if (
        declaredContentLength !== null &&
        (contentEncoding === null || contentEncoding === 'identity') &&
        totalBytes !== declaredContentLength
      ) {
        return { ok: false };
      }
      const bytes = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const value = JSON.parse(text) as unknown;
      completed = true;
      return { ok: true, value };
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return { ok: false };
    } finally {
      if (!completed) {
        try {
          await reader.cancel();
        } catch {
          // The transport is already closed; no response details are surfaced.
        }
      }
      reader.releaseLock();
    }
  }

  async function request(
    path: string,
    method: 'GET' | 'POST',
    options?: ProviderRequestOptions
  ): Promise<{ data: unknown | null; error: unknown | null }> {
    const response = await fetchImplementation(
      `https://api.resend.com${path}`,
      {
        method,
        headers: {
          accept: 'application/json',
          'accept-encoding': 'identity',
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        signal: options?.signal,
      }
    );
    const decoded = await readBoundedJson(response, options?.signal);
    if (!decoded.ok) return { data: null, error: null };
    const payload = decoded.value;
    return response.ok
      ? { data: payload, error: null }
      : { data: null, error: payload };
  }

  return {
    emails: {
      list: async (options, requestOptions) => {
        const query = new URLSearchParams({ limit: String(options.limit) });
        if (options.after) query.set('after', options.after);
        return request(
          `/emails?${query.toString()}`,
          'GET',
          requestOptions
        ) as Promise<ProviderListResponse<unknown>>;
      },
      get: (id, requestOptions) =>
        request(`/emails/${encodeURIComponent(id)}`, 'GET', requestOptions),
      cancel: (id, requestOptions) =>
        request(
          `/emails/${encodeURIComponent(id)}/cancel`,
          'POST',
          requestOptions
        ),
    },
  };
}

type FailureCode =
  | 'apply_database_guard_failed'
  | 'cancellation_operator_already_running'
  | 'cancellation_deadline_expired'
  | 'cutover_configuration_invalid'
  | 'database_cancellation_failed'
  | 'database_inventory_failed'
  | 'dry_run_database_guard_failed'
  | 'immutable_inventory_invalid'
  | 'provider_api_key_missing'
  | 'provider_cancel_outcome_unknown'
  | 'provider_cancel_response_malformed'
  | 'provider_emails_list_failed'
  | 'provider_emails_pagination_invalid'
  | 'provider_emails_payload_invalid'
  | 'provider_emails_response_malformed'
  | 'provider_emails_request_timeout'
  | 'provider_inventory_not_empty'
  | 'provider_inventory_unexpected'
  | 'provider_lookup_ambiguous'
  | 'provider_lookup_malformed'
  | 'provider_lookup_missing'
  | 'provider_lookup_terminal'
  | 'provider_lookup_timeout'
  | 'scheduled_count_drift'
  | 'unresolved_inventory_mismatch'
  | 'usage_error';

class CancellationFailure extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
    this.name = 'CancellationFailure';
  }
}

function fail(code: FailureCode): never {
  throw new CancellationFailure(code);
}

type ParsedArguments =
  | { mode: 'dry_run' }
  | {
      mode: 'apply';
      expectedScheduled: number;
      allowDatabaseUrlApply: boolean;
    };

function countArgument(value: string | undefined): number {
  if (value === undefined || !/^(0|[1-9][0-9]*)$/u.test(value)) {
    fail('usage_error');
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count)) fail('usage_error');
  return count;
}

function parseArguments(argv: readonly string[]): ParsedArguments {
  if (argv.length === 1 && argv[0] === '--dry-run') {
    return { mode: 'dry_run' };
  }
  if (argv[0] !== '--apply') fail('usage_error');
  let expectedScheduled: number | undefined;
  let allowDatabaseUrlApply = false;
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (
      argument === '--expected-scheduled' &&
      expectedScheduled === undefined
    ) {
      expectedScheduled = countArgument(argv[index + 1]);
      index += 1;
    } else if (
      argument === '--allow-database-url-apply' &&
      !allowDatabaseUrlApply
    ) {
      allowDatabaseUrlApply = true;
    } else {
      fail('usage_error');
    }
  }
  if (expectedScheduled === undefined) fail('usage_error');
  return { mode: 'apply', expectedScheduled, allowDatabaseUrlApply };
}

function databaseUrlForDryRun(environment: Environment): string {
  const testDatabaseUrl = environment['TEST_DATABASE_URL'];
  const databaseUrl = environment['DATABASE_URL'];
  if (testDatabaseUrl && !databaseUrl) return testDatabaseUrl;
  if (databaseUrl && !testDatabaseUrl) return databaseUrl;
  fail('dry_run_database_guard_failed');
}

function databaseUrlForApply(
  args: Extract<ParsedArguments, { mode: 'apply' }>,
  environment: Environment
): string {
  const testDatabaseUrl = environment['TEST_DATABASE_URL'];
  const databaseUrl = environment['DATABASE_URL'];
  if (testDatabaseUrl && !databaseUrl && !args.allowDatabaseUrlApply) {
    return testDatabaseUrl;
  }
  if (databaseUrl && !testDatabaseUrl && args.allowDatabaseUrlApply) {
    return databaseUrl;
  }
  fail('apply_database_guard_failed');
}

function currentTime(dependencies: LegacyCancellationDependencies): Date {
  const value = dependencies.now?.() ?? new Date();
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail('database_cancellation_failed');
  }
  return value;
}

function boundedProviderId(
  value: unknown,
  code:
    | 'immutable_inventory_invalid'
    | 'provider_emails_payload_invalid'
    | 'provider_lookup_malformed'
): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_PROVIDER_ID_LENGTH ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  ) {
    fail(code);
  }
  return value;
}

function validDate(value: unknown, code: FailureCode): Date {
  const date =
    value instanceof Date ? new Date(value) : new Date(String(value));
  if (
    (typeof value !== 'string' && !(value instanceof Date)) ||
    Number.isNaN(date.getTime())
  ) {
    fail(code);
  }
  return date;
}

interface ConfigurationRow extends Record<string, unknown> {
  event_key: string;
  contact_id: string | null;
  project_id: string | null;
  occurred_at: Date | string;
  kind: string;
  data: Record<string, unknown>;
}

interface CutoverConfiguration {
  snapshotAt: Date;
  cancellationDeadline: Date | null;
  expectedContacts: number;
  expectedScheduled: number;
  snapshotIdentity: string;
}

interface ContactMarkerRow extends Record<string, unknown> {
  provider_contact_id: string | null;
}

interface LegacyJobRow extends Record<string, unknown> {
  id: string;
  contact_id: string | null;
  available_at: Date | string;
  provider_email_id: string | null;
  status: string;
  payload: Record<string, unknown>;
  last_error_code?: string | null;
  lease_token?: string | null;
  lease_until?: Date | string | null;
}

interface ValidLegacyJob {
  id: string;
  contactId: string;
  availableAt: Date;
  providerEmailId: string;
  status: 'pending' | 'cancelled';
  providerState: 'scheduled' | 'cancelled';
  lastErrorCode: string | null;
  leaseToken: string | null;
  leaseUntil: Date | null;
}

interface Inventory {
  configuration: CutoverConfiguration;
  contactProviderIds: string[];
  immutableSchedules: ValidLegacyJob[];
  unresolvedSchedules: ValidLegacyJob[];
}

function nonNegativeSafeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Number(value)
    : null;
}

function readConfiguration(
  row: ConfigurationRow | undefined
): CutoverConfiguration {
  if (
    !row ||
    row.event_key !== CUTOVER_CONFIGURATION_EVENT_KEY ||
    row.contact_id !== null ||
    row.project_id !== null ||
    row.kind !== CUTOVER_CONFIGURATION_KIND ||
    row.data === null ||
    typeof row.data !== 'object' ||
    Array.isArray(row.data)
  ) {
    fail('cutover_configuration_invalid');
  }
  const occurredAt = validDate(
    row.occurred_at,
    'cutover_configuration_invalid'
  );
  const snapshotAt = validDate(
    row.data['snapshot_at'],
    'cutover_configuration_invalid'
  );
  const expectedContacts = nonNegativeSafeInteger(
    row.data['expected_contacts']
  );
  const expectedScheduled = nonNegativeSafeInteger(
    row.data['expected_scheduled']
  );
  const identity = row.data['snapshot_identity'];
  if (
    snapshotAt.getTime() !== occurredAt.getTime() ||
    expectedContacts === null ||
    expectedScheduled === null ||
    typeof identity !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(identity)
  ) {
    fail('cutover_configuration_invalid');
  }
  const rawDeadline = row.data['cancellation_deadline'];
  const cancellationDeadline =
    rawDeadline === null
      ? null
      : validDate(rawDeadline, 'cutover_configuration_invalid');
  return {
    snapshotAt,
    cancellationDeadline,
    expectedContacts,
    expectedScheduled,
    snapshotIdentity: identity,
  };
}

function validatePayload(row: LegacyJobRow): 'scheduled' | 'cancelled' {
  const payload = row.payload;
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    payload['imported'] !== true ||
    payload['legacy_type'] !== 'scheduled_message' ||
    payload['provider'] !== 'resend' ||
    (payload['provider_state'] !== 'scheduled' &&
      payload['provider_state'] !== 'cancelled')
  ) {
    fail('immutable_inventory_invalid');
  }
  if (payload['provider_state'] === 'cancelled') {
    validDate(payload['cancelled_at'], 'immutable_inventory_invalid');
  }
  return payload['provider_state'];
}

function validateJob(row: LegacyJobRow): ValidLegacyJob {
  const providerState = validatePayload(row);
  const providerEmailId = boundedProviderId(
    row.provider_email_id,
    'immutable_inventory_invalid'
  );
  const leaseToken = row.lease_token ?? null;
  const leaseUntil =
    row.lease_until === undefined || row.lease_until === null
      ? null
      : validDate(row.lease_until, 'immutable_inventory_invalid');
  if (
    typeof row.id !== 'string' ||
    row.id.length === 0 ||
    row.id.length > 200 ||
    typeof row.contact_id !== 'string' ||
    row.contact_id.length === 0 ||
    row.contact_id.length > 200 ||
    (row.status !== 'pending' && row.status !== 'cancelled') ||
    (providerState === 'cancelled' && row.status !== 'cancelled') ||
    (row.last_error_code !== undefined &&
      row.last_error_code !== null &&
      (typeof row.last_error_code !== 'string' ||
        row.last_error_code.length === 0 ||
        row.last_error_code.length > 100)) ||
    (leaseToken !== null &&
      (typeof leaseToken !== 'string' ||
        !/^[a-f0-9-]{36}$/u.test(leaseToken))) ||
    (leaseToken === null) !== (leaseUntil === null)
  ) {
    fail('immutable_inventory_invalid');
  }
  return {
    id: row.id,
    contactId: row.contact_id,
    availableAt: validDate(row.available_at, 'immutable_inventory_invalid'),
    providerEmailId,
    status: row.status,
    providerState,
    lastErrorCode: row.last_error_code ?? null,
    leaseToken,
    leaseUntil,
  };
}

function uniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function inventoryIdentity(
  contacts: readonly string[],
  schedules: readonly string[]
): string {
  return createHash('sha256')
    .update(
      [
        'contacts',
        String(contacts.length),
        ...[...contacts].sort(),
        'scheduled_messages',
        String(schedules.length),
        ...[...schedules].sort(),
      ].join('\0')
    )
    .digest('hex');
}

async function readInventory(executor: SqlExecutor): Promise<Inventory> {
  try {
    return await executor.transaction(async (transaction) => {
      const configurationResult = await transaction.execute<ConfigurationRow>(
        `/* growth:cancel-read-cutover-configuration */
         select event_key, contact_id, project_id, occurred_at, kind, data
         from growth_activity
         where event_key = $1`,
        [CUTOVER_CONFIGURATION_EVENT_KEY]
      );
      if (configurationResult.rows.length !== 1) {
        fail('cutover_configuration_invalid');
      }
      const configuration = readConfiguration(configurationResult.rows[0]);
      const markerResult = await transaction.execute<ContactMarkerRow>(
        `/* growth:cancel-read-contact-markers */
         select payload->>'provider_contact_id' as provider_contact_id
         from growth_jobs
         where kind = 'legacy'
           and provider_email_id is null
           and payload->>'legacy_type' = 'contact_marker'
         order by payload->>'provider_contact_id'`
      );
      const immutableResult = await transaction.execute<LegacyJobRow>(
        `/* growth:cancel-read-immutable-schedules */
         select id, contact_id, available_at, provider_email_id, status, payload,
                last_error_code, lease_token, lease_until
         from growth_jobs
         where kind = 'legacy'
           and provider_email_id is not null
           and payload->>'legacy_type' = 'scheduled_message'
         order by provider_email_id`
      );
      const unresolvedResult = await transaction.execute<LegacyJobRow>(
        `/* growth:cancel-read-unresolved-schedules */
         select id, contact_id, available_at, provider_email_id, status, payload,
                last_error_code, lease_token, lease_until
         from growth_jobs
         where kind = 'legacy'
           and provider_email_id is not null
           and payload->>'legacy_type' = 'scheduled_message'
           and payload->>'provider_state' = 'scheduled'
         order by provider_email_id`
      );
      const contactProviderIds = markerResult.rows.map((row) =>
        boundedProviderId(
          row.provider_contact_id,
          'immutable_inventory_invalid'
        )
      );
      const immutableSchedules = immutableResult.rows.map(validateJob);
      const unresolvedSchedules = unresolvedResult.rows.map(validateJob);
      const immutableJobIds = immutableSchedules.map(({ id }) => id);
      const immutableProviderIds = immutableSchedules.map(
        ({ providerEmailId }) => providerEmailId
      );
      const unresolvedJobIds = unresolvedSchedules.map(({ id }) => id);
      const unresolvedProviderIds = unresolvedSchedules.map(
        ({ providerEmailId }) => providerEmailId
      );
      if (
        !uniqueValues(contactProviderIds) ||
        !uniqueValues(immutableJobIds) ||
        !uniqueValues(immutableProviderIds) ||
        !uniqueValues(unresolvedJobIds) ||
        !uniqueValues(unresolvedProviderIds) ||
        unresolvedSchedules.some(
          ({ providerState }) => providerState !== 'scheduled'
        ) ||
        unresolvedSchedules.some(
          ({ id, providerEmailId }) =>
            !immutableSchedules.some(
              (candidate) =>
                candidate.id === id &&
                candidate.providerEmailId === providerEmailId
            )
        )
      ) {
        fail('immutable_inventory_invalid');
      }
      if (
        contactProviderIds.length !== configuration.expectedContacts ||
        immutableSchedules.length !== configuration.expectedScheduled ||
        inventoryIdentity(contactProviderIds, immutableProviderIds) !==
          configuration.snapshotIdentity
      ) {
        fail('immutable_inventory_invalid');
      }
      const reconstructedDeadline =
        immutableSchedules.length === 0
          ? null
          : new Date(
              Math.min(
                ...immutableSchedules.map(({ availableAt }) =>
                  availableAt.getTime()
                )
              ) - DELIVERY_SAFETY_MARGIN_MS
            );
      if (
        (reconstructedDeadline === null) !==
          (configuration.cancellationDeadline === null) ||
        (reconstructedDeadline !== null &&
          configuration.cancellationDeadline !== null &&
          reconstructedDeadline.getTime() !==
            configuration.cancellationDeadline.getTime())
      ) {
        fail('cutover_configuration_invalid');
      }
      return {
        configuration,
        contactProviderIds,
        immutableSchedules,
        unresolvedSchedules,
      };
    });
  } catch (error) {
    if (error instanceof CancellationFailure) throw error;
    fail('database_inventory_failed');
  }
}

interface ProviderEmail {
  id: string;
  lastEvent: string;
}

interface ProviderResponseWrapper {
  data: unknown | null;
  error: unknown | null;
}

function providerResponseWrapper(
  value: unknown,
  malformedCode:
    | 'provider_emails_response_malformed'
    | 'provider_lookup_malformed'
    | 'provider_cancel_response_malformed'
): ProviderResponseWrapper {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(malformedCode);
  }
  const input = value as Record<string, unknown>;
  if (
    !Object.hasOwn(input, 'data') ||
    !Object.hasOwn(input, 'error') ||
    input['data'] === undefined ||
    input['error'] === undefined ||
    (input['data'] === null) === (input['error'] === null)
  ) {
    fail(malformedCode);
  }
  return {
    data: input['data'],
    error: input['error'],
  } as ProviderResponseWrapper;
}

function providerEmail(value: unknown): ProviderEmail {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('provider_emails_payload_invalid');
  }
  const input = value as Record<string, unknown>;
  const id = boundedProviderId(input['id'], 'provider_emails_payload_invalid');
  const lastEvent = input['last_event'];
  if (
    typeof lastEvent !== 'string' ||
    lastEvent.length === 0 ||
    lastEvent.length > 50 ||
    !/^[a-z][a-z0-9_-]*$/u.test(lastEvent)
  ) {
    fail('provider_emails_payload_invalid');
  }
  return { id, lastEvent };
}

function providerListPage(response: unknown): {
  data: ProviderEmail[];
  hasMore: boolean;
} {
  const wrapper = providerResponseWrapper(
    response,
    'provider_emails_response_malformed'
  );
  if (wrapper.error !== null || wrapper.data === null) {
    fail('provider_emails_list_failed');
  }
  const data = wrapper.data as Record<string, unknown>;
  if (
    data.object !== 'list' ||
    !Array.isArray(data.data) ||
    typeof data.has_more !== 'boolean'
  ) {
    fail('provider_emails_payload_invalid');
  }
  if (data.data.length > PAGE_SIZE) {
    fail('provider_emails_pagination_invalid');
  }
  return { data: data.data.map(providerEmail), hasMore: data.has_more };
}

async function listProviderScheduled(
  client: LegacyCancellationClient,
  context: ProviderDeadlineContext
): Promise<Set<string>> {
  const all = new Map<string, ProviderEmail>();
  const seenCursors = new Set<string>();
  let after: string | undefined;
  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber += 1) {
    let response: ProviderListResponse<unknown>;
    try {
      response = await requestProvider(
        context,
        'provider_emails_request_timeout',
        'legacy_resend_provider_list_timeout',
        (signal) =>
          client.emails.list(
            after ? { limit: PAGE_SIZE, after } : { limit: PAGE_SIZE },
            { signal }
          )
      );
    } catch (error) {
      if (error instanceof CancellationFailure) throw error;
      fail('provider_emails_list_failed');
    }
    if (context.configuration.cancellationDeadline !== null) {
      await requireFutureDeadline(
        context.executor,
        context.configuration,
        context.unresolved,
        context.dependencies,
        context.persist
      );
    }
    const page = providerListPage(response);
    if (all.size + page.data.length > MAX_TOTAL_RECORDS) {
      fail('provider_emails_pagination_invalid');
    }
    for (const email of page.data) {
      if (all.has(email.id)) fail('provider_emails_pagination_invalid');
      all.set(email.id, email);
    }
    if (!page.hasMore) {
      return new Set(
        [...all.values()]
          .filter(({ lastEvent }) => lastEvent === 'scheduled')
          .map(({ id }) => id)
      );
    }
    const next = page.data.at(-1)?.id;
    if (!next || next === after || seenCursors.has(next)) {
      fail('provider_emails_pagination_invalid');
    }
    seenCursors.add(next);
    after = next;
  }
  fail('provider_emails_pagination_invalid');
}

function setsEqual(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>
): boolean {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

function deadlineIsFuture(
  configuration: CutoverConfiguration,
  at: Date
): boolean {
  return (
    configuration.cancellationDeadline !== null &&
    configuration.cancellationDeadline.getTime() > at.getTime()
  );
}

async function settleCancellation(
  executor: SqlExecutor,
  job: ValidLegacyJob,
  occurredAt: Date,
  claimToken: string | null = null
): Promise<void> {
  try {
    await executor.transaction(async (transaction) => {
      const settled = await transaction.execute<{ id: string }>(
        `/* growth:cancel-settle-job */
         update growth_jobs
         set status = 'cancelled',
             lease_token = null,
             lease_until = null,
             last_error_code = null,
             payload = payload || jsonb_build_object(
               'provider_state', 'cancelled',
               'cancelled_at', $2::timestamptz
             )
         where id = $1
           and kind = 'legacy'
           and provider_email_id = $3
           and payload->>'legacy_type' = 'scheduled_message'
           and payload->>'provider_state' = 'scheduled'
           and ($4::uuid is null or lease_token = $4::uuid)
         returning id`,
        [job.id, occurredAt, job.providerEmailId, claimToken]
      );
      if (settled.rows.length !== 1 || settled.rows[0]?.id !== job.id) {
        fail('database_cancellation_failed');
      }
      await transaction.execute(
        `/* growth:cancel-insert-activity */
         insert into growth_activity (
           event_key, contact_id, occurred_at, kind, data
         ) values (
           $1, $2, $3, '${CANCELLATION_ACTIVITY_KIND}',
           jsonb_build_object('provider', 'resend')
         )`,
        [
          `legacy:resend:scheduled:${job.id}:cancelled`,
          job.contactId,
          occurredAt,
        ]
      );
    });
  } catch (error) {
    if (error instanceof CancellationFailure) throw error;
    fail('database_cancellation_failed');
  }
}

async function claimCancellation(
  executor: SqlExecutor,
  job: ValidLegacyJob,
  claimedAt: Date,
  configuration: CutoverConfiguration
): Promise<string> {
  const deadline = configuration.cancellationDeadline;
  if (deadline === null) fail('cutover_configuration_invalid');
  const claimToken = randomUUID();
  const leaseUntil = new Date(
    Math.min(
      deadline.getTime(),
      claimedAt.getTime() +
        MAX_PROVIDER_REQUEST_MS +
        CANCELLATION_CLAIM_GRACE_MS
    )
  );
  let claimed: { rows: Array<{ id: string }> };
  try {
    claimed = await executor.execute<{ id: string }>(
      `/* growth:cancel-claim-job */
       update growth_jobs
       set lease_token = $4::uuid,
           lease_until = $5::timestamptz,
           last_error_code = 'legacy_resend_cancel_outcome_unknown',
           updated_at = $6::timestamptz
       where id = $1
         and kind = 'legacy'
         and provider_email_id = $2
         and payload->>'legacy_type' = 'scheduled_message'
         and payload->>'provider_state' = 'scheduled'
         and (
           lease_token is null
           or lease_until <= $3::timestamptz
         )
       returning id`,
      [
        job.id,
        job.providerEmailId,
        claimedAt,
        claimToken,
        leaseUntil,
        claimedAt,
      ]
    );
  } catch {
    fail('database_cancellation_failed');
  }
  if (claimed.rows.length === 0) fail('cancellation_operator_already_running');
  if (claimed.rows.length !== 1 || claimed.rows[0]?.id !== job.id) {
    fail('database_cancellation_failed');
  }
  return claimToken;
}

type ClosedErrorCode =
  | 'legacy_resend_cancel_provider_failed'
  | 'legacy_resend_cancel_outcome_unknown'
  | 'legacy_resend_cancel_response_malformed'
  | 'legacy_resend_cancellation_deadline_expired'
  | 'legacy_resend_lookup_ambiguous'
  | 'legacy_resend_lookup_malformed'
  | 'legacy_resend_lookup_missing'
  | 'legacy_resend_lookup_terminal'
  | 'legacy_resend_lookup_timeout'
  | 'legacy_resend_provider_list_timeout';

async function persistUnresolved(
  executor: SqlExecutor,
  job: ValidLegacyJob,
  code: ClosedErrorCode,
  occurredAt: Date,
  claimToken: string | null = null
): Promise<void> {
  try {
    const persisted = await executor.execute<{ id: string }>(
      `/* growth:cancel-persist-error */
       update growth_jobs
       set last_error_code = $3,
           updated_at = $4,
           lease_token = null,
           lease_until = null
       where id = $1
         and kind = 'legacy'
         and provider_email_id = $2
         and payload->>'legacy_type' = 'scheduled_message'
         and payload->>'provider_state' = 'scheduled'
         and (
           ($5::uuid is null and (
             lease_token is null
             or lease_until <= $4::timestamptz
           ))
           or lease_token = $5::uuid
         )
       returning id`,
      [job.id, job.providerEmailId, code, occurredAt, claimToken]
    );
    if (persisted.rows.length !== 1 || persisted.rows[0]?.id !== job.id) {
      fail('database_cancellation_failed');
    }
  } catch (error) {
    if (error instanceof CancellationFailure) throw error;
    fail('database_cancellation_failed');
  }
}

async function expireUnresolved(
  executor: SqlExecutor,
  jobs: readonly ValidLegacyJob[],
  occurredAt: Date,
  claimToken: string | null = null
): Promise<never> {
  for (const [index, job] of jobs.entries()) {
    await persistUnresolved(
      executor,
      job,
      'legacy_resend_cancellation_deadline_expired',
      occurredAt,
      index === 0 ? claimToken : null
    );
  }
  fail('cancellation_deadline_expired');
}

async function requireFutureDeadline(
  executor: SqlExecutor,
  configuration: CutoverConfiguration,
  unresolved: readonly ValidLegacyJob[],
  dependencies: LegacyCancellationDependencies,
  persist: boolean,
  claimToken: string | null = null
): Promise<Date> {
  const at = currentTime(dependencies);
  if (deadlineIsFuture(configuration, at)) return at;
  if (persist && unresolved.length > 0) {
    return expireUnresolved(executor, unresolved, at, claimToken);
  }
  fail('cancellation_deadline_expired');
}

interface ProviderDeadlineContext {
  executor: SqlExecutor;
  configuration: CutoverConfiguration;
  unresolved: readonly ValidLegacyJob[];
  dependencies: LegacyCancellationDependencies;
  persist: boolean;
  claimToken?: string;
}

async function requestProvider<T>(
  context: ProviderDeadlineContext,
  timeoutFailure: FailureCode,
  timeoutCode: ClosedErrorCode,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const deadline = context.configuration.cancellationDeadline;
  const startedAt =
    deadline === null
      ? currentTime(context.dependencies)
      : await requireFutureDeadline(
          context.executor,
          context.configuration,
          context.unresolved,
          context.dependencies,
          context.persist,
          context.claimToken ?? null
        );
  const timeoutMs =
    deadline === null
      ? MAX_PROVIDER_REQUEST_MS
      : Math.max(
          1,
          Math.min(
            MAX_PROVIDER_REQUEST_MS,
            deadline.getTime() - startedAt.getTime()
          )
        );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (error instanceof CancellationFailure) throw error;
    if (controller.signal.aborted) {
      if (context.persist) {
        const occurredAt = currentTime(context.dependencies);
        for (const job of context.unresolved) {
          await persistUnresolved(
            context.executor,
            job,
            timeoutCode,
            occurredAt,
            context.claimToken ?? null
          );
        }
      }
      fail(timeoutFailure);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

type LookupOutcome =
  | { kind: 'canceled' }
  | { kind: 'scheduled' }
  | { kind: 'unresolved'; code: ClosedErrorCode; failure: FailureCode };

const RESEND_ERROR_NAMES = new Set([
  'invalid_idempotency_key',
  'validation_error',
  'missing_api_key',
  'restricted_api_key',
  'invalid_api_key',
  'not_found',
  'method_not_allowed',
  'invalid_idempotent_request',
  'concurrent_idempotent_requests',
  'invalid_attachment',
  'invalid_from_address',
  'invalid_access',
  'invalid_parameter',
  'invalid_region',
  'missing_required_field',
  'monthly_quota_exceeded',
  'daily_quota_exceeded',
  'rate_limit_exceeded',
  'security_error',
  'application_error',
  'internal_server_error',
]);

function lookupErrorOutcome(error: unknown): LookupOutcome {
  if (error === null || typeof error !== 'object' || Array.isArray(error)) {
    return {
      kind: 'unresolved',
      code: 'legacy_resend_lookup_malformed',
      failure: 'provider_lookup_malformed',
    };
  }
  const input = error as Record<string, unknown>;
  const name = input['name'];
  const statusCode = input['statusCode'];
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    name.length > 100 ||
    !/^[a-z][a-z0-9_]*$/u.test(name) ||
    !RESEND_ERROR_NAMES.has(name) ||
    (statusCode !== null && !Number.isSafeInteger(statusCode)) ||
    typeof input['message'] !== 'string'
  ) {
    return {
      kind: 'unresolved',
      code: 'legacy_resend_lookup_malformed',
      failure: 'provider_lookup_malformed',
    };
  }
  if (name === 'not_found' && statusCode === 404) {
    return {
      kind: 'unresolved',
      code: 'legacy_resend_lookup_missing',
      failure: 'provider_lookup_missing',
    };
  }
  return {
    kind: 'unresolved',
    code: 'legacy_resend_lookup_ambiguous',
    failure: 'provider_lookup_ambiguous',
  };
}

async function lookupExact(
  client: LegacyCancellationClient,
  providerEmailId: string,
  context: ProviderDeadlineContext
): Promise<LookupOutcome> {
  let response: unknown;
  try {
    response = await requestProvider(
      context,
      'provider_lookup_timeout',
      'legacy_resend_lookup_timeout',
      (signal) => client.emails.get(providerEmailId, { signal })
    );
  } catch (error) {
    if (error instanceof CancellationFailure) throw error;
    return {
      kind: 'unresolved',
      code: 'legacy_resend_lookup_ambiguous',
      failure: 'provider_lookup_ambiguous',
    };
  }
  let wrapper: ProviderResponseWrapper;
  try {
    wrapper = providerResponseWrapper(response, 'provider_lookup_malformed');
  } catch (error) {
    if (
      error instanceof CancellationFailure &&
      error.code === 'provider_lookup_malformed'
    ) {
      return {
        kind: 'unresolved',
        code: 'legacy_resend_lookup_malformed',
        failure: 'provider_lookup_malformed',
      };
    }
    throw error;
  }
  if (wrapper.data === null) {
    return lookupErrorOutcome(wrapper.error);
  }
  if (typeof wrapper.data !== 'object' || Array.isArray(wrapper.data)) {
    return {
      kind: 'unresolved',
      code: 'legacy_resend_lookup_malformed',
      failure: 'provider_lookup_malformed',
    };
  }
  const data = wrapper.data as Record<string, unknown>;
  let id: string;
  try {
    id = boundedProviderId(data['id'], 'provider_lookup_malformed');
  } catch {
    return {
      kind: 'unresolved',
      code: 'legacy_resend_lookup_malformed',
      failure: 'provider_lookup_malformed',
    };
  }
  if (
    id !== providerEmailId ||
    data['object'] !== 'email' ||
    typeof data['last_event'] !== 'string' ||
    data['last_event'].length === 0 ||
    data['last_event'].length > 50
  ) {
    return {
      kind: 'unresolved',
      code: 'legacy_resend_lookup_malformed',
      failure: 'provider_lookup_malformed',
    };
  }
  if (data['last_event'] === 'canceled') return { kind: 'canceled' };
  if (data['last_event'] === 'scheduled') return { kind: 'scheduled' };
  if (
    data['last_event'] === 'delivered' ||
    data['last_event'] === 'sent' ||
    data['last_event'] === 'failed'
  ) {
    return {
      kind: 'unresolved',
      code: 'legacy_resend_lookup_terminal',
      failure: 'provider_lookup_terminal',
    };
  }
  return {
    kind: 'unresolved',
    code: 'legacy_resend_lookup_ambiguous',
    failure: 'provider_lookup_ambiguous',
  };
}

async function verifyDryRunInventory(
  client: LegacyCancellationClient,
  inventory: Inventory,
  providerScheduled: ReadonlySet<string>,
  context: ProviderDeadlineContext
): Promise<number> {
  const remainingUnresolved = new Set(
    inventory.unresolvedSchedules.map(({ providerEmailId }) => providerEmailId)
  );
  const verifiedScheduled = new Set(providerScheduled);
  let missingUnresolved = 0;
  for (const job of inventory.unresolvedSchedules) {
    if (providerScheduled.has(job.providerEmailId)) continue;
    missingUnresolved += 1;
    const outcome = await lookupExact(client, job.providerEmailId, {
      ...context,
      unresolved: [job],
    });
    await requireFutureDeadline(
      context.executor,
      context.configuration,
      context.unresolved,
      context.dependencies,
      context.persist
    );
    if (outcome.kind === 'canceled') {
      remainingUnresolved.delete(job.providerEmailId);
    } else if (outcome.kind === 'scheduled') {
      verifiedScheduled.add(job.providerEmailId);
    } else {
      fail(outcome.failure);
    }
  }
  if (!setsEqual(remainingUnresolved, verifiedScheduled)) {
    fail('unresolved_inventory_mismatch');
  }
  return missingUnresolved;
}

function successfulCancelResult(
  result: { data: unknown | null; error: unknown | null },
  expectedId: string
): boolean {
  if (
    result.error !== null ||
    result.data === null ||
    typeof result.data !== 'object' ||
    Array.isArray(result.data)
  ) {
    return false;
  }
  const id = (result.data as Record<string, unknown>)['id'];
  const object = (result.data as Record<string, unknown>)['object'];
  return id === expectedId && object === 'email';
}

function summary(input: {
  mode: 'dry_run' | 'apply';
  inventory: Inventory;
  providerScheduled: ReadonlySet<string>;
  missingUnresolved: number;
  unexpectedProviderScheduled: number;
  providerScheduledRemaining?: number;
  at: Date;
}) {
  const deadline = input.inventory.configuration.cancellationDeadline;
  return {
    command: 'cancel-resend-lifecycle',
    mode: input.mode,
    immutable_contacts: input.inventory.contactProviderIds.length,
    immutable_scheduled: input.inventory.immutableSchedules.length,
    unresolved_imported: input.inventory.unresolvedSchedules.length,
    provider_scheduled: input.providerScheduled.size,
    missing_unresolved: input.missingUnresolved,
    unexpected_provider_scheduled: input.unexpectedProviderScheduled,
    cancellation_remaining_seconds:
      deadline === null
        ? null
        : Math.max(
            0,
            Math.floor((deadline.getTime() - input.at.getTime()) / 1_000)
          ),
    ...(input.providerScheduledRemaining === undefined
      ? {}
      : { provider_scheduled_remaining: input.providerScheduledRemaining }),
  };
}

async function applyCancellation(
  executor: SqlExecutor,
  client: LegacyCancellationClient,
  initialInventory: Inventory,
  initialProviderScheduled: Set<string>,
  dependencies: LegacyCancellationDependencies
): Promise<{ output: Record<string, unknown>; success: boolean }> {
  const importedProviderIds = new Set(
    initialInventory.immutableSchedules.map(
      ({ providerEmailId }) => providerEmailId
    )
  );
  const unexpected = [...initialProviderScheduled].filter(
    (id) => !importedProviderIds.has(id)
  );
  if (unexpected.length > 0) fail('provider_inventory_unexpected');

  const verifiedScheduled = new Set(initialProviderScheduled);
  let missingUnresolved = 0;
  const lookups: Array<{
    job: ValidLegacyJob;
    outcome: LookupOutcome;
    checkpointAt: Date;
  }> = [];
  for (const job of initialInventory.unresolvedSchedules) {
    const requiresExactRecovery = job.lastErrorCode !== null;
    if (
      initialProviderScheduled.has(job.providerEmailId) &&
      !requiresExactRecovery
    ) {
      continue;
    }
    missingUnresolved += 1;
    const outcome = await lookupExact(client, job.providerEmailId, {
      executor,
      configuration: initialInventory.configuration,
      unresolved: [job],
      dependencies,
      persist: true,
    });
    const checkpointAt = await requireFutureDeadline(
      executor,
      initialInventory.configuration,
      initialInventory.unresolvedSchedules,
      dependencies,
      true
    );
    if (
      job.leaseToken !== null &&
      job.leaseUntil !== null &&
      job.leaseUntil.getTime() > checkpointAt.getTime() &&
      outcome.kind !== 'canceled'
    ) {
      fail('cancellation_operator_already_running');
    }
    lookups.push({ job, outcome, checkpointAt });
    if (outcome.kind === 'scheduled') {
      verifiedScheduled.add(job.providerEmailId);
    } else if (outcome.kind === 'canceled') {
      verifiedScheduled.delete(job.providerEmailId);
    }
  }
  const unresolvedLookups = lookups.filter(
    (
      entry
    ): entry is typeof entry & {
      outcome: Extract<LookupOutcome, { kind: 'unresolved' }>;
    } => entry.outcome.kind === 'unresolved'
  );
  if (unresolvedLookups.length > 0) {
    for (const { job, outcome, checkpointAt } of unresolvedLookups) {
      await persistUnresolved(executor, job, outcome.code, checkpointAt);
    }
    fail(unresolvedLookups[0]?.outcome.failure ?? 'provider_lookup_ambiguous');
  }
  const settledRecoveryJobIds = new Set<string>();
  for (const { job, outcome } of lookups) {
    if (outcome.kind === 'canceled') {
      const settlementAt = await requireFutureDeadline(
        executor,
        initialInventory.configuration,
        initialInventory.unresolvedSchedules.filter(
          ({ id }) => !settledRecoveryJobIds.has(id)
        ),
        dependencies,
        true
      );
      await settleCancellation(executor, job, settlementAt);
      settledRecoveryJobIds.add(job.id);
    }
  }

  let inventory = await readInventory(executor);
  const unresolvedIds = new Set(
    inventory.unresolvedSchedules.map(({ providerEmailId }) => providerEmailId)
  );
  if (!setsEqual(unresolvedIds, verifiedScheduled)) {
    fail('unresolved_inventory_mismatch');
  }

  let cancellationFailed = false;
  for (
    let index = 0;
    index < inventory.unresolvedSchedules.length;
    index += 1
  ) {
    const job = inventory.unresolvedSchedules[index] as ValidLegacyJob;
    const claimAt = await requireFutureDeadline(
      executor,
      inventory.configuration,
      inventory.unresolvedSchedules.slice(index),
      dependencies,
      true
    );
    const claimToken = await claimCancellation(
      executor,
      job,
      claimAt,
      inventory.configuration
    );
    let result: unknown;
    try {
      result = await requestProvider(
        {
          executor,
          configuration: inventory.configuration,
          unresolved: [job],
          dependencies,
          persist: true,
          claimToken,
        },
        'provider_cancel_outcome_unknown',
        'legacy_resend_cancel_outcome_unknown',
        (signal) => client.emails.cancel(job.providerEmailId, { signal })
      );
    } catch (error) {
      if (error instanceof CancellationFailure) throw error;
      await persistUnresolved(
        executor,
        job,
        'legacy_resend_cancel_outcome_unknown',
        currentTime(dependencies),
        claimToken
      );
      fail('provider_cancel_outcome_unknown');
    }
    const requestCompletedAt = await requireFutureDeadline(
      executor,
      inventory.configuration,
      inventory.unresolvedSchedules.slice(index),
      dependencies,
      true,
      claimToken
    );
    let wrapper: ProviderResponseWrapper;
    try {
      wrapper = providerResponseWrapper(
        result,
        'provider_cancel_response_malformed'
      );
    } catch (error) {
      if (
        error instanceof CancellationFailure &&
        error.code === 'provider_cancel_response_malformed'
      ) {
        await persistUnresolved(
          executor,
          job,
          'legacy_resend_cancel_outcome_unknown',
          requestCompletedAt,
          claimToken
        );
        fail('provider_cancel_outcome_unknown');
      }
      throw error;
    }
    if (wrapper.error !== null) {
      await persistUnresolved(
        executor,
        job,
        'legacy_resend_cancel_provider_failed',
        currentTime(dependencies),
        claimToken
      );
      cancellationFailed = true;
      break;
    }
    if (!successfulCancelResult(wrapper, job.providerEmailId)) {
      await persistUnresolved(
        executor,
        job,
        'legacy_resend_cancel_outcome_unknown',
        currentTime(dependencies),
        claimToken
      );
      fail('provider_cancel_outcome_unknown');
    }
    await settleCancellation(executor, job, requestCompletedAt, claimToken);
  }

  inventory = await readInventory(executor);
  const finalProviderScheduled = await listProviderScheduled(client, {
    executor,
    configuration: inventory.configuration,
    unresolved: inventory.unresolvedSchedules,
    dependencies,
    persist: true,
  });
  await requireFutureDeadline(
    executor,
    inventory.configuration,
    inventory.unresolvedSchedules,
    dependencies,
    true
  );
  const finalUnexpected = [...finalProviderScheduled].filter(
    (id) => !importedProviderIds.has(id)
  ).length;
  const outputAt = await requireFutureDeadline(
    executor,
    inventory.configuration,
    inventory.unresolvedSchedules,
    dependencies,
    true
  );
  const output = {
    ...summary({
      mode: 'apply',
      inventory,
      providerScheduled: initialProviderScheduled,
      missingUnresolved,
      unexpectedProviderScheduled: finalUnexpected,
      providerScheduledRemaining: finalProviderScheduled.size,
      at: outputAt,
    }),
    unresolved_imported: inventory.unresolvedSchedules.length,
  };
  const success =
    !cancellationFailed &&
    inventory.unresolvedSchedules.length === 0 &&
    finalUnexpected === 0 &&
    finalProviderScheduled.size === 0;
  return { output, success };
}

export async function mainCancelResendLifecycle(
  argv: readonly string[] = process.argv.slice(2),
  dependencies: LegacyCancellationDependencies = DEFAULT_DEPENDENCIES
): Promise<number> {
  let executor: SqlExecutor | undefined;
  try {
    const args = parseArguments(argv);
    const databaseUrl =
      args.mode === 'apply'
        ? databaseUrlForApply(args, dependencies.environment)
        : databaseUrlForDryRun(dependencies.environment);
    const apiKey = dependencies.environment['RESEND_API_KEY'];
    if (!apiKey) fail('provider_api_key_missing');
    const client = dependencies.createClient(apiKey);
    executor = dependencies.createExecutor(databaseUrl);
    const inventory = await readInventory(executor);
    if (
      args.mode === 'apply' &&
      args.expectedScheduled !== inventory.configuration.expectedScheduled
    ) {
      fail('scheduled_count_drift');
    }
    if (
      inventory.configuration.expectedScheduled === 0 &&
      (inventory.configuration.cancellationDeadline !== null ||
        inventory.immutableSchedules.length !== 0 ||
        inventory.unresolvedSchedules.length !== 0)
    ) {
      fail('cutover_configuration_invalid');
    }
    const providerContext: ProviderDeadlineContext = {
      executor,
      configuration: inventory.configuration,
      unresolved: inventory.unresolvedSchedules,
      dependencies,
      persist: false,
    };
    const providerScheduled = await listProviderScheduled(
      client,
      providerContext
    );
    const importedProviderIds = new Set(
      inventory.immutableSchedules.map(({ providerEmailId }) => providerEmailId)
    );
    const unexpectedProviderScheduled = [...providerScheduled].filter(
      (id) => !importedProviderIds.has(id)
    ).length;
    if (unexpectedProviderScheduled > 0) {
      fail('provider_inventory_unexpected');
    }
    if (inventory.configuration.expectedScheduled > 0) {
      await requireFutureDeadline(
        executor,
        inventory.configuration,
        inventory.unresolvedSchedules,
        dependencies,
        args.mode === 'apply'
      );
    }
    if (inventory.configuration.expectedScheduled === 0) {
      if (providerScheduled.size !== 0) fail('provider_inventory_unexpected');
      dependencies.writeOutput(
        JSON.stringify({
          ...summary({
            mode: args.mode,
            inventory,
            providerScheduled,
            missingUnresolved: 0,
            unexpectedProviderScheduled: 0,
            ...(args.mode === 'apply' ? { providerScheduledRemaining: 0 } : {}),
            at: currentTime(dependencies),
          }),
        })
      );
      return 0;
    }
    if (args.mode === 'dry_run') {
      const missingUnresolved = await verifyDryRunInventory(
        client,
        inventory,
        providerScheduled,
        providerContext
      );
      const outputAt = await requireFutureDeadline(
        executor,
        inventory.configuration,
        inventory.unresolvedSchedules,
        dependencies,
        false
      );
      dependencies.writeOutput(
        JSON.stringify(
          summary({
            mode: 'dry_run',
            inventory,
            providerScheduled,
            missingUnresolved,
            unexpectedProviderScheduled,
            at: outputAt,
          })
        )
      );
      return 0;
    }
    const applied = await applyCancellation(
      executor,
      client,
      inventory,
      providerScheduled,
      dependencies
    );
    dependencies.writeOutput(JSON.stringify(applied.output));
    if (!applied.success) fail('provider_inventory_not_empty');
    return 0;
  } catch (error) {
    const code =
      error instanceof CancellationFailure
        ? error.code
        : 'database_cancellation_failed';
    dependencies.writeError(
      code === 'usage_error'
        ? USAGE
        : `Resend lifecycle cancellation failed: ${code}`
    );
    return code === 'usage_error' ? 2 : 1;
  } finally {
    if (executor) {
      try {
        await executor.close?.();
      } catch {
        // Never redisclose a database/provider error from cleanup.
      }
    }
  }
}

const DEFAULT_DEPENDENCIES: LegacyCancellationDependencies = {
  environment: process.env,
  createClient: (apiKey) => createAbortableResendCancellationClient(apiKey),
  createExecutor: (databaseUrl) => createDatabaseExecutor(databaseUrl),
  writeOutput: (line) => process.stdout.write(`${line}\n`),
  writeError: (line) => process.stderr.write(`${line}\n`),
};

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  void mainCancelResendLifecycle().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
