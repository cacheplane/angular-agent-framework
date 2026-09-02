import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Resend } from 'resend';

import {
  compareEmailLookupHmac,
  createDatabaseExecutor,
  createEmailLookupCandidates,
  normalizeEmail,
  stopContact,
  type EmailHmacKeyring,
  type SqlExecutor,
  type SqlTransaction,
} from '../libs/growth/src/index.ts';
import { parseEmailHmacKeyringEnvironment } from './growth-control.mts';

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const MAX_TOTAL_RECORDS = PAGE_SIZE * MAX_PAGES;
const SOURCE = 'resend_legacy_import';
const USAGE =
  'Usage: npm run growth:import-resend -- --dry-run | --apply --expected-contacts N --expected-scheduled N [--allow-database-url-apply]';

type Environment = Record<string, string | undefined>;

type ProviderListResponse<T> =
  | {
      data: { object: 'list'; data: T[]; has_more: boolean };
      error: null;
    }
  | { data: null; error: unknown };

export interface ResendImportContact extends Record<string, unknown> {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribed: boolean;
  created_at: string;
}

export interface ResendImportScheduledEmail extends Record<string, unknown> {
  id: string;
  to: string[];
  last_event: 'scheduled';
  scheduled_at: string;
  created_at: string;
}

interface ResendImportListEmail extends Record<string, unknown> {
  id: string;
  to?: unknown;
  last_event: string;
  scheduled_at: string | null;
  created_at: string;
}

export interface ResendLifecycleClient {
  contacts: {
    list(options: {
      limit: number;
      after?: string;
    }): Promise<ProviderListResponse<unknown>>;
  };
  emails: {
    list(options: {
      limit: number;
      after?: string;
    }): Promise<ProviderListResponse<unknown>>;
  };
}

export interface ResendLifecycleSnapshot {
  contacts: ResendImportContact[];
  scheduledEmails: ResendImportScheduledEmail[];
}

export interface ResendLifecycleImportResult {
  contacts_created: number;
  contacts_existing: number;
  contacts_rekeyed: number;
  legacy_jobs_created: number;
  legacy_jobs_existing: number;
  legacy_provider_cancellations_required: number;
}

type FailureCode =
  | 'apply_database_guard_failed'
  | 'database_import_failed'
  | 'email_hmac_keyring_invalid'
  | 'provider_api_key_missing'
  | 'provider_contacts_list_failed'
  | 'provider_contacts_pagination_invalid'
  | 'provider_contacts_payload_invalid'
  | 'provider_emails_list_failed'
  | 'provider_emails_pagination_invalid'
  | 'provider_emails_payload_invalid'
  | 'snapshot_count_drift'
  | 'snapshot_identity_conflict'
  | 'snapshot_scheduled_recipient_invalid'
  | 'usage_error';

class ImportFailure extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
    this.name = 'ImportFailure';
  }
}

function fail(code: FailureCode): never {
  throw new ImportFailure(code);
}

function boundedProviderId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 200 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  ) {
    fail('provider_contacts_payload_invalid');
  }
  return value;
}

function validIsoDate(
  value: unknown,
  code: 'provider_contacts_payload_invalid' | 'provider_emails_payload_invalid'
): string {
  if (
    typeof value !== 'string' ||
    value.length > 100 ||
    !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/u.test(
      value
    )
  ) {
    fail(code);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) fail(code);
  return value;
}

function optionalName(value: unknown): string | null {
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    value.length > 200 ||
    /[\0\r\n]/u.test(value)
  ) {
    fail('provider_contacts_payload_invalid');
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function providerContact(value: unknown): ResendImportContact {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('provider_contacts_payload_invalid');
  }
  const input = value as Record<string, unknown>;
  const id = boundedProviderId(input['id']);
  if (typeof input['email'] !== 'string') {
    fail('provider_contacts_payload_invalid');
  }
  try {
    normalizeEmail(input['email']);
  } catch {
    fail('provider_contacts_payload_invalid');
  }
  if (typeof input['unsubscribed'] !== 'boolean') {
    fail('provider_contacts_payload_invalid');
  }
  return {
    id,
    email: input['email'],
    first_name: optionalName(input['first_name']),
    last_name: optionalName(input['last_name']),
    unsubscribed: input['unsubscribed'],
    created_at: validIsoDate(
      input['created_at'],
      'provider_contacts_payload_invalid'
    ),
  };
}

function providerListEmail(value: unknown): ResendImportListEmail {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('provider_emails_payload_invalid');
  }
  const input = value as Record<string, unknown>;
  const rawId = input['id'];
  if (
    typeof rawId !== 'string' ||
    rawId.length === 0 ||
    rawId.length > 200 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(rawId)
  ) {
    fail('provider_emails_payload_invalid');
  }
  if (
    typeof input['last_event'] !== 'string' ||
    input['last_event'].length === 0 ||
    input['last_event'].length > 50
  ) {
    fail('provider_emails_payload_invalid');
  }
  if (
    input['scheduled_at'] !== null &&
    typeof input['scheduled_at'] !== 'string'
  ) {
    fail('provider_emails_payload_invalid');
  }
  return {
    id: rawId,
    to: input['to'],
    last_event: input['last_event'],
    scheduled_at: input['scheduled_at'] as string | null,
    created_at: validIsoDate(
      input['created_at'],
      'provider_emails_payload_invalid'
    ),
  };
}

function scheduledEmail(
  email: ResendImportListEmail
): ResendImportScheduledEmail | null {
  if (email.last_event !== 'scheduled') return null;
  if (email.scheduled_at === null) fail('provider_emails_payload_invalid');
  validIsoDate(email.scheduled_at, 'provider_emails_payload_invalid');
  if (
    !Array.isArray(email.to) ||
    email.to.length !== 1 ||
    typeof email.to[0] !== 'string'
  ) {
    fail('provider_emails_payload_invalid');
  }
  try {
    normalizeEmail(email.to[0]);
  } catch {
    fail('provider_emails_payload_invalid');
  }
  return {
    id: email.id,
    to: [email.to[0]],
    last_event: 'scheduled',
    scheduled_at: email.scheduled_at,
    created_at: email.created_at,
  };
}

function listPage<T>(
  response: ProviderListResponse<unknown>,
  listFailure: FailureCode,
  payloadFailure: FailureCode,
  paginationFailure: FailureCode,
  parse: (value: unknown) => T
): { data: T[]; hasMore: boolean } {
  if (response.error !== null || response.data === null) fail(listFailure);
  const { data } = response;
  if (
    data.object !== 'list' ||
    !Array.isArray(data.data) ||
    typeof data.has_more !== 'boolean'
  ) {
    fail(payloadFailure);
  }
  if (data.data.length > PAGE_SIZE) fail(paginationFailure);
  return { data: data.data.map(parse), hasMore: data.has_more };
}

async function paginate<T>(
  list: (options: {
    limit: number;
    after?: string;
  }) => Promise<ProviderListResponse<unknown>>,
  codes: {
    list: FailureCode;
    payload: FailureCode;
    pagination: FailureCode;
  },
  parse: (value: unknown) => T & { id: string }
): Promise<T[]> {
  const all: T[] = [];
  const seenCursors = new Set<string>();
  let after: string | undefined;
  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber += 1) {
    let response: ProviderListResponse<unknown>;
    try {
      response = await list(
        after ? { limit: PAGE_SIZE, after } : { limit: PAGE_SIZE }
      );
    } catch {
      fail(codes.list);
    }
    const page = listPage(
      response,
      codes.list,
      codes.payload,
      codes.pagination,
      parse
    );
    if (all.length + page.data.length > MAX_TOTAL_RECORDS) {
      fail(codes.pagination);
    }
    all.push(...page.data);
    if (!page.hasMore) return all;
    const next = page.data.at(-1)?.id;
    if (!next || next === after || seenCursors.has(next)) {
      fail(codes.pagination);
    }
    seenCursors.add(next);
    after = next;
  }
  fail(codes.pagination);
}

export async function snapshotResendLifecycle(
  client: ResendLifecycleClient
): Promise<ResendLifecycleSnapshot> {
  const contacts = await paginate(
    (options) => client.contacts.list(options),
    {
      list: 'provider_contacts_list_failed',
      payload: 'provider_contacts_payload_invalid',
      pagination: 'provider_contacts_pagination_invalid',
    },
    providerContact
  );
  const emails = await paginate(
    (options) => client.emails.list(options),
    {
      list: 'provider_emails_list_failed',
      payload: 'provider_emails_payload_invalid',
      pagination: 'provider_emails_pagination_invalid',
    },
    providerListEmail
  );
  return {
    contacts,
    scheduledEmails: emails
      .map(scheduledEmail)
      .filter((email): email is ResendImportScheduledEmail => email !== null),
  };
}

interface PreparedContact {
  contact: ResendImportContact;
  displayName: string | null;
  normalizedEmail: string;
}

interface PreparedScheduledEmail {
  email: ResendImportScheduledEmail;
  normalizedRecipient: string;
  scheduledAt: Date;
}

function prepareSnapshot(snapshot: ResendLifecycleSnapshot): {
  contacts: PreparedContact[];
  scheduled: PreparedScheduledEmail[];
} {
  const providerContactIds = new Set<string>();
  const contactsByEmail = new Map<string, PreparedContact>();
  for (const rawContact of snapshot.contacts) {
    const contact = providerContact(rawContact);
    if (providerContactIds.has(contact.id)) fail('snapshot_identity_conflict');
    providerContactIds.add(contact.id);
    const normalizedEmail = normalizeEmail(contact.email);
    if (contactsByEmail.has(normalizedEmail))
      fail('snapshot_identity_conflict');
    const displayName = [contact.first_name, contact.last_name]
      .filter((part): part is string => part !== null)
      .join(' ')
      .trim();
    contactsByEmail.set(normalizedEmail, {
      contact,
      normalizedEmail,
      displayName: displayName.length > 0 ? displayName : null,
    });
  }

  const scheduledIds = new Set<string>();
  const scheduled: PreparedScheduledEmail[] = [];
  for (const rawEmail of snapshot.scheduledEmails) {
    const parsed = scheduledEmail(providerListEmail(rawEmail));
    if (!parsed) fail('provider_emails_payload_invalid');
    if (scheduledIds.has(parsed.id)) fail('snapshot_identity_conflict');
    scheduledIds.add(parsed.id);
    const normalizedRecipient = normalizeEmail(parsed.to[0] as string);
    if (!contactsByEmail.has(normalizedRecipient)) {
      fail('snapshot_scheduled_recipient_invalid');
    }
    scheduled.push({
      email: parsed,
      normalizedRecipient,
      scheduledAt: new Date(parsed.scheduled_at),
    });
  }
  return { contacts: [...contactsByEmail.values()], scheduled };
}

interface ImportContactRow extends Record<string, unknown> {
  id: string;
  email_normalized: string;
  email_lookup_hmac: string;
  email_hmac_key_version: number;
  outreach_approved_at: Date | string | null;
  deleted_at: Date | string | null;
  updated_at: Date | string;
}

interface ImportLegacyJobRow extends Record<string, unknown> {
  id: string;
  contact_id: string | null;
  kind: string;
  status: string;
  available_at: Date | string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  provider_email_id: string | null;
  delivery_status: string;
}

interface ImportAliasActivityRow extends Record<string, unknown> {
  event_key: string;
  contact_id: string | null;
  project_id: string | null;
  kind: string;
  occurred_at: Date | string;
  data: Record<string, unknown>;
}

function canonicalJson(value: unknown): string {
  function normalize(candidate: unknown): unknown {
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (candidate !== null && typeof candidate === 'object') {
      return Object.fromEntries(
        Object.entries(candidate as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, normalize(entry)])
      );
    }
    return candidate;
  }
  return JSON.stringify(normalize(value));
}

async function importContact(
  transaction: SqlTransaction,
  prepared: PreparedContact,
  keyring: EmailHmacKeyring,
  occurredAt: Date,
  result: ResendLifecycleImportResult
): Promise<ImportContactRow> {
  const candidates = createEmailLookupCandidates(
    prepared.normalizedEmail,
    keyring
  );
  const active = candidates[0];
  if (!active) fail('email_hmac_keyring_invalid');
  const found = await transaction.execute<ImportContactRow>(
    `/* growth:import-find-contact */
     select c.id, c.email_normalized, c.email_lookup_hmac,
            c.email_hmac_key_version, c.outreach_approved_at,
            c.deleted_at, c.updated_at
     from growth_contacts c
     left join lateral (
       select true as matched
       from jsonb_to_recordset($1::jsonb)
         as candidate(key_version smallint, digest text)
       where (
           candidate.key_version = c.email_hmac_key_version
           and candidate.digest = c.email_lookup_hmac
         )
         or exists (
           select 1 from growth_activity alias
           where alias.contact_id = c.id
             and alias.kind = 'contact.lookup_alias_added'
             and alias.data->>'key_version' = candidate.key_version::text
             and alias.data->>'digest' = candidate.digest
         )
       limit 1
     ) lookup on true
     where lookup.matched or c.email_normalized = $2
     limit 2
     for update of c`,
    [
      JSON.stringify(
        candidates.map(({ digest, keyVersion }) => ({
          digest,
          key_version: keyVersion,
        }))
      ),
      prepared.normalizedEmail,
    ]
  );
  if (found.rows.length > 1) fail('snapshot_identity_conflict');
  let contact = found.rows[0];
  if (!contact) {
    const inserted = await transaction.execute<ImportContactRow>(
      `/* growth:import-insert-contact */
       insert into growth_contacts (
         email_normalized, email_lookup_hmac, email_hmac_key_version,
         display_name, source
       ) values ($1, $2, $3, $4, $5)
       returning id, email_normalized, email_lookup_hmac,
                 email_hmac_key_version, outreach_approved_at,
                 deleted_at, updated_at`,
      [
        prepared.normalizedEmail,
        active.digest,
        active.keyVersion,
        prepared.displayName,
        SOURCE,
      ]
    );
    contact = inserted.rows[0];
    if (!contact) fail('database_import_failed');
    result.contacts_created += 1;
  } else {
    result.contacts_existing += 1;
    const current = candidates.find(
      ({ keyVersion }) => keyVersion === contact?.email_hmac_key_version
    );
    if (
      !current ||
      !compareEmailLookupHmac(current.digest, contact.email_lookup_hmac)
    ) {
      fail('snapshot_identity_conflict');
    }
    if (contact.email_hmac_key_version < active.keyVersion) {
      const aliasEventKey = `contact.lookup_alias_added:${contact.id}:v${contact.email_hmac_key_version}`;
      const aliasData = {
        digest: contact.email_lookup_hmac,
        key_version: contact.email_hmac_key_version,
      };
      const insertedAlias = await transaction.execute<{ event_key: string }>(
        `/* growth:import-add-lookup-alias */
         insert into growth_activity (
           event_key, contact_id, occurred_at, kind, data
         ) values (
           $1, $2, $3, 'contact.lookup_alias_added',
           jsonb_build_object('digest', $4::text, 'key_version', $5::smallint)
         )
         on conflict (event_key) do nothing
         returning event_key`,
        [
          aliasEventKey,
          contact.id,
          occurredAt,
          contact.email_lookup_hmac,
          contact.email_hmac_key_version,
        ]
      );
      if (insertedAlias.rows.length === 0) {
        const replay = await transaction.execute<ImportAliasActivityRow>(
          `/* growth:import-read-lookup-alias */
           select event_key, contact_id, project_id, kind, occurred_at, data
           from growth_activity
           where event_key = $1`,
          [aliasEventKey]
        );
        const row = replay.rows[0];
        if (
          !row ||
          row.contact_id !== contact.id ||
          row.project_id !== null ||
          row.kind !== 'contact.lookup_alias_added' ||
          new Date(row.occurred_at).getTime() !== occurredAt.getTime() ||
          canonicalJson(row.data) !== canonicalJson(aliasData)
        ) {
          fail('snapshot_identity_conflict');
        }
      }
      const rekeyed = await transaction.execute<ImportContactRow>(
        `/* growth:import-rekey-contact */
         update growth_contacts
         set email_hmac_key_version = $2,
             email_lookup_hmac = $3
         where id = $1
           and email_hmac_key_version < $2
         returning id, email_normalized, email_lookup_hmac,
                   email_hmac_key_version, outreach_approved_at,
                   deleted_at, updated_at`,
        [contact.id, active.keyVersion, active.digest]
      );
      contact = rekeyed.rows[0] ?? contact;
      result.contacts_rekeyed += 1;
    }
  }

  return contact;
}

interface ImportProviderStopRow extends Record<string, unknown> {
  contact_id: string | null;
  kind: string;
  occurred_at: Date | string;
}

function validateLegacyReplay(
  row: ImportLegacyJobRow | undefined,
  input: {
    contactId: string;
    availableAt: Date;
    idempotencyKey: string;
    providerEmailId: string;
    payload: Record<string, unknown>;
  }
): void {
  if (
    !row ||
    row.kind !== 'legacy' ||
    row.contact_id !== input.contactId ||
    !['pending', 'leased', 'completed', 'failed', 'cancelled'].includes(
      row.status
    ) ||
    new Date(row.available_at).getTime() !== input.availableAt.getTime() ||
    row.idempotency_key !== input.idempotencyKey ||
    row.provider_email_id !== input.providerEmailId ||
    ![
      'not_submitted',
      'submitted',
      'delivered',
      'bounced',
      'complained',
      'suppressed',
      'failed',
      'unknown',
    ].includes(row.delivery_status) ||
    canonicalJson(row.payload) !== canonicalJson(input.payload)
  ) {
    fail('snapshot_identity_conflict');
  }
}

export async function importResendLifecycleSnapshot(
  executor: SqlExecutor,
  snapshot: ResendLifecycleSnapshot,
  keyring: EmailHmacKeyring,
  occurredAt: Date
): Promise<ResendLifecycleImportResult> {
  if (!(occurredAt instanceof Date) || Number.isNaN(occurredAt.getTime())) {
    fail('database_import_failed');
  }
  const prepared = prepareSnapshot(snapshot);
  // Validate all configured key material before the transaction can mutate data.
  createEmailLookupCandidates('keyring-validation@example.invalid', keyring);
  return executor.transaction(async (transaction) => {
    await transaction.execute(
      `/* growth:lock-resend-lifecycle-import */
       select pg_advisory_xact_lock(
         hashtextextended('growth:resend-lifecycle-import:v1', 0)
       )`
    );
    const storedVersions = await transaction.execute<{
      email_hmac_key_version: number;
    }>(
      `/* growth:import-read-key-versions */
       select distinct email_hmac_key_version
       from growth_contacts
       order by email_hmac_key_version`
    );
    const configuredVersions = new Set([
      keyring.active.version,
      ...(keyring.previous ?? []).map(({ version }) => version),
    ]);
    if (
      storedVersions.rows.some(
        ({ email_hmac_key_version }) =>
          !configuredVersions.has(email_hmac_key_version)
      )
    ) {
      throw new Error('rotation_coverage_failed');
    }

    const result: ResendLifecycleImportResult = {
      contacts_created: 0,
      contacts_existing: 0,
      contacts_rekeyed: 0,
      legacy_jobs_created: 0,
      legacy_jobs_existing: 0,
      legacy_provider_cancellations_required: 0,
    };
    const contactsByEmail = new Map<string, ImportContactRow>();
    for (const contact of prepared.contacts) {
      contactsByEmail.set(
        contact.normalizedEmail,
        await importContact(transaction, contact, keyring, occurredAt, result)
      );
    }

    const payload = {
      imported: true,
      provider: 'resend',
      provider_state: 'scheduled',
    };
    for (const scheduled of prepared.scheduled) {
      const contact = contactsByEmail.get(scheduled.normalizedRecipient);
      if (!contact || contact.deleted_at !== null) {
        fail('snapshot_scheduled_recipient_invalid');
      }
      const idempotencyKey = `legacy:resend:scheduled:${scheduled.email.id}`;
      const inserted = await transaction.execute<ImportLegacyJobRow>(
        `/* growth:import-insert-legacy-job */
         insert into growth_jobs (
           kind, contact_id, status, available_at, idempotency_key,
           payload, provider_email_id, delivery_status
         ) values (
           'legacy', $1, 'pending', $2, $4, $5::jsonb, $3, 'not_submitted'
         )
         on conflict (idempotency_key) do nothing
         returning id, contact_id, kind, status, available_at,
                   idempotency_key, payload, provider_email_id,
                   delivery_status`,
        [
          contact.id,
          scheduled.scheduledAt,
          scheduled.email.id,
          idempotencyKey,
          JSON.stringify(payload),
        ]
      );
      if (inserted.rows.length > 0) {
        result.legacy_jobs_created += 1;
        continue;
      }
      const replay = await transaction.execute<ImportLegacyJobRow>(
        `/* growth:import-read-legacy-job */
         select id, contact_id, kind, status, available_at,
                idempotency_key, payload, provider_email_id,
                delivery_status
         from growth_jobs
         where idempotency_key = $1`,
        [idempotencyKey]
      );
      validateLegacyReplay(replay.rows[0], {
        contactId: contact.id,
        availableAt: scheduled.scheduledAt,
        idempotencyKey,
        providerEmailId: scheduled.email.id,
        payload,
      });
      result.legacy_jobs_existing += 1;
    }

    const transactionExecutor: SqlExecutor = {
      execute: (sql, parameters) => transaction.execute(sql, parameters),
      transaction: (operation) => operation(transaction),
    };
    const providerCancellationIds = new Set<string>();
    for (const preparedContact of prepared.contacts) {
      if (!preparedContact.contact.unsubscribed) continue;
      const contact = contactsByEmail.get(preparedContact.normalizedEmail);
      if (!contact) fail('snapshot_identity_conflict');
      const eventKey = `legacy:resend:contact:${preparedContact.contact.id}:unsubscribe`;
      const existing = await transaction.execute<ImportProviderStopRow>(
        `/* growth:import-read-provider-stop */
         select contact_id, kind, occurred_at
         from growth_activity
         where event_key = $1`,
        [eventKey]
      );
      const existingStop = existing.rows[0];
      const observedAt = existingStop
        ? new Date(existingStop.occurred_at)
        : occurredAt;
      if (Number.isNaN(observedAt.getTime())) {
        fail('snapshot_identity_conflict');
      }
      const stopped = await stopContact(transactionExecutor, {
        contactId: contact.id,
        reason: 'unsubscribe',
        eventKey,
        occurredAt: observedAt,
        source: SOURCE,
        provenance: {
          kind: 'system',
          policyVersion: 'growth-v1',
        },
      });
      for (const providerId of stopped.legacyProviderCancellationIds) {
        providerCancellationIds.add(providerId);
      }
    }
    result.legacy_provider_cancellations_required =
      providerCancellationIds.size;
    return result;
  });
}

type ParsedArguments =
  | { mode: 'dry_run' }
  | {
      mode: 'apply';
      expectedContacts: number;
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
  let expectedContacts: number | undefined;
  let expectedScheduled: number | undefined;
  let allowDatabaseUrlApply = false;
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--expected-contacts' && expectedContacts === undefined) {
      expectedContacts = countArgument(argv[index + 1]);
      index += 1;
    } else if (
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
  if (expectedContacts === undefined || expectedScheduled === undefined) {
    fail('usage_error');
  }
  return {
    mode: 'apply',
    expectedContacts,
    expectedScheduled,
    allowDatabaseUrlApply,
  };
}

function dryRunSummary(snapshot: ResendLifecycleSnapshot) {
  const subscribed = snapshot.contacts.filter(
    ({ unsubscribed }) => !unsubscribed
  ).length;
  return {
    command: 'import-resend-lifecycle',
    mode: 'dry_run',
    contacts: snapshot.contacts.length,
    contact_categories: {
      subscribed,
      unsubscribed: snapshot.contacts.length - subscribed,
    },
    scheduled: snapshot.scheduledEmails.length,
    scheduled_statuses: { scheduled: snapshot.scheduledEmails.length },
  } as const;
}

export interface ImportResendLifecycleMainDependencies {
  environment: Environment;
  createClient(apiKey: string): ResendLifecycleClient;
  createExecutor(databaseUrl: string): SqlExecutor;
  loadKeyring(environment: Environment): EmailHmacKeyring;
  writeOutput(line: string): void;
  writeError(line: string): void;
  now?: () => Date;
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

export async function mainImportResendLifecycle(
  argv: readonly string[] = process.argv.slice(2),
  dependencies: ImportResendLifecycleMainDependencies = DEFAULT_DEPENDENCIES
): Promise<number> {
  let executor: SqlExecutor | undefined;
  try {
    const args = parseArguments(argv);
    const databaseUrl =
      args.mode === 'apply'
        ? databaseUrlForApply(args, dependencies.environment)
        : undefined;
    const apiKey = dependencies.environment['RESEND_API_KEY'];
    if (!apiKey) fail('provider_api_key_missing');
    const snapshot = await snapshotResendLifecycle(
      dependencies.createClient(apiKey)
    );
    if (args.mode === 'dry_run') {
      dependencies.writeOutput(JSON.stringify(dryRunSummary(snapshot)));
      return 0;
    }
    if (
      snapshot.contacts.length !== args.expectedContacts ||
      snapshot.scheduledEmails.length !== args.expectedScheduled
    ) {
      fail('snapshot_count_drift');
    }
    let keyring: EmailHmacKeyring;
    try {
      keyring = dependencies.loadKeyring(dependencies.environment);
      createEmailLookupCandidates(
        'keyring-validation@example.invalid',
        keyring
      );
    } catch {
      fail('email_hmac_keyring_invalid');
    }
    executor = dependencies.createExecutor(databaseUrl);
    let result: ResendLifecycleImportResult;
    try {
      result = await importResendLifecycleSnapshot(
        executor,
        snapshot,
        keyring,
        dependencies.now?.() ?? new Date()
      );
    } catch (error) {
      if (error instanceof ImportFailure) throw error;
      fail('database_import_failed');
    }
    dependencies.writeOutput(
      JSON.stringify({
        command: 'import-resend-lifecycle',
        mode: 'apply',
        ...result,
      })
    );
    return 0;
  } catch (error) {
    const code =
      error instanceof ImportFailure ? error.code : 'database_import_failed';
    dependencies.writeError(
      code === 'usage_error' ? USAGE : `Resend lifecycle import failed: ${code}`
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

const DEFAULT_DEPENDENCIES: ImportResendLifecycleMainDependencies = {
  environment: process.env,
  createClient: (apiKey) => {
    const resend = new Resend(apiKey);
    return {
      contacts: {
        list: (options) => resend.contacts.list(options),
      },
      emails: {
        list: (options) => resend.emails.list(options),
      },
    };
  },
  createExecutor: (databaseUrl) => createDatabaseExecutor(databaseUrl),
  loadKeyring: parseEmailHmacKeyringEnvironment,
  writeOutput: (line) => process.stdout.write(`${line}\n`),
  writeError: (line) => process.stderr.write(`${line}\n`),
};

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  void mainImportResendLifecycle().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
