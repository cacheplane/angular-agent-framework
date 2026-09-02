import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  createDatabaseExecutor,
  type SqlExecutor,
  type SqlTransaction,
} from '@threadplane-internal/growth';
import { z } from 'zod';

const UUID = z.uuid();
const SAFE_LABEL = z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/u);
const FIXTURE_NAMESPACE = z.literal('threadplane-preview-dogfood-v1');
const DEPLOYMENT_ID = z.string().regex(/^dpl_[A-Za-z0-9_-]{3,120}$/u);
const DATABASE_SENTINEL = z
  .string()
  .regex(/^threadplane:growth-target:[A-Za-z0-9_-]{3,160}$/u);
const ROUTE = '/dispatch#workflow';
const FUTURE = new Date('9999-12-31T23:59:59.000Z');

const ThreadFixtureSchema = z.object({ alias: SAFE_LABEL, id: UUID }).strict();

const DogfoodManifestSchema = z
  .object({
    schema_version: z.literal(1),
    environment_label: z.literal('preview-lifecycle-dogfood'),
    fixture_namespace: FIXTURE_NAMESPACE,
    targets: z
      .object({
        lifecycle_instance_a_deployment_id: DEPLOYMENT_ID,
        lifecycle_instance_b_deployment_id: DEPLOYMENT_ID,
        growth_database_sentinel: DATABASE_SENTINEL,
      })
      .strict(),
    growth: z
      .object({
        alias: z.literal('cleanup-growth-fixtures-01'),
        expected_count: z.number().int().positive(),
        contact_id: UUID,
        project_id: UUID,
        posthog_distinct_id: UUID,
        job_id: UUID,
        submission_id: UUID,
        activity_event_key: z.string().min(1).max(300),
        job_idempotency_key: z.string().min(1).max(300),
      })
      .strict(),
    dawn: z
      .object({
        alias: z.literal('cleanup-dawn-fixtures-01'),
        expected_count: z.number().int().positive(),
        threads: z.array(ThreadFixtureSchema).min(1).max(10),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.targets.lifecycle_instance_a_deployment_id ===
      value.targets.lifecycle_instance_b_deployment_id
    ) {
      context.addIssue({
        code: 'custom',
        message: 'lifecycle deployments must be distinct',
        path: ['targets'],
      });
    }
    if (value.growth.expected_count !== 4) {
      context.addIssue({
        code: 'custom',
        message: 'growth expected_count must equal the closed v1 fixture size',
        path: ['growth', 'expected_count'],
      });
    }
    if (value.dawn.expected_count !== value.dawn.threads.length) {
      context.addIssue({
        code: 'custom',
        message:
          'dawn expected_count must equal the exact thread selector count',
        path: ['dawn', 'expected_count'],
      });
    }
    const requiredAliases = new Set([
      'thread-dogfood-01',
      'duplicate-fixture-01-a',
      'duplicate-fixture-01-b',
      'abort-fixture-01',
    ]);
    const actualAliases = value.dawn.threads.map(({ alias }) => alias);
    if (
      actualAliases.length !== requiredAliases.size ||
      new Set(actualAliases).size !== actualAliases.length ||
      actualAliases.some((alias) => !requiredAliases.has(alias))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'dawn threads must use the closed v1 alias set',
        path: ['dawn', 'threads'],
      });
    }
    const ids = value.dawn.threads.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        message: 'dawn thread selectors must be unique',
        path: ['dawn', 'threads'],
      });
    }
  });

export type DogfoodManifest = z.infer<typeof DogfoodManifestSchema>;

export class DogfoodHarnessError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'DogfoodHarnessError';
  }
}

export function parseDogfoodManifest(value: unknown): DogfoodManifest {
  const parsed = DogfoodManifestSchema.safeParse(value);
  if (!parsed.success) throw new DogfoodHarnessError('manifest_invalid');
  return parsed.data;
}

export interface DogfoodTargets {
  databaseUrl: string;
  lifecycleOriginA: string;
  lifecycleOriginB: string;
}

function parseTargetUrl(value: string, kind: 'database' | 'origin'): URL {
  try {
    const url = new URL(value);
    const validProtocol =
      kind === 'database'
        ? url.protocol === 'postgres:' || url.protocol === 'postgresql:'
        : url.protocol === 'https:';
    const invalidOrigin =
      kind === 'origin' &&
      (url.username !== '' ||
        url.password !== '' ||
        url.pathname !== '/' ||
        url.search !== '' ||
        url.hash !== '' ||
        value !== url.origin);
    if (!validProtocol || !url.hostname || invalidOrigin) {
      throw new Error('invalid');
    }
    return url;
  } catch {
    throw new DogfoodHarnessError('target_url_invalid');
  }
}

async function assertGrowthDatabaseTarget(
  executor: SqlTransaction,
  manifest: DogfoodManifest
): Promise<void> {
  const result = await executor.execute<{ target_sentinel: string | null }>(
    `/* lifecycle-dogfood:read-growth-target-sentinel */
     select shobj_description(database.oid, 'pg_database') as target_sentinel
     from pg_database as database
     where database.datname = current_database()`
  );
  if (
    result.rows.length !== 1 ||
    result.rows[0]?.target_sentinel !==
      manifest.targets.growth_database_sentinel
  ) {
    throw new DogfoodHarnessError('target_identity_mismatch');
  }
}

function validateDogfoodTargetUrls(actual: DogfoodTargets): void {
  parseTargetUrl(actual.databaseUrl, 'database');
  const originA = parseTargetUrl(actual.lifecycleOriginA, 'origin');
  const originB = parseTargetUrl(actual.lifecycleOriginB, 'origin');
  if (originA.origin === originB.origin) {
    throw new DogfoodHarnessError('target_identity_mismatch');
  }
}

export async function assertDogfoodTargets(
  executor: SqlExecutor,
  manifest: DogfoodManifest,
  actual: DogfoodTargets
): Promise<void> {
  validateDogfoodTargetUrls(actual);
  await assertGrowthDatabaseTarget(executor, manifest);
}

interface CountRow extends Record<string, unknown> {
  count: string | number;
  markers_valid?: boolean;
}

async function countGrowthFixture(
  executor: SqlTransaction,
  manifest: DogfoodManifest
): Promise<{ count: number; markersValid: boolean }> {
  const result = await executor.execute<CountRow>(
    `/* lifecycle-dogfood:count-growth-fixture */
     with fixture_counts as (
       select
         (select count(*) from growth_contacts where id = $1::uuid) as contacts,
         (select count(*) from growth_projects
           where id = $2::uuid or contact_id = $1::uuid) as projects,
         (select count(*) from growth_activity
           where contact_id = $1::uuid or project_id = $2::uuid) as activities,
         (select count(*) from growth_jobs
           where id = $3::uuid
              or contact_id = $1::uuid
              or project_id = $2::uuid) as jobs,
         (select count(*) from growth_artifacts
           where job_id = $3::uuid
              or contact_id = $1::uuid
              or project_id = $2::uuid) as artifacts,
         (select count(*) from growth_contacts
           where id = $1::uuid and source = $4::text) as marked_contact,
         (select count(*) from growth_projects
           where id = $2::uuid
             and contact_id = $1::uuid
             and posthog_distinct_id = $5::uuid
             and claim_key_hash = $6::text) as marked_project,
         (select count(*) from growth_activity
           where event_key = $7::text
             and contact_id = $1::uuid
             and project_id = $2::uuid
             and data->>'fixture_namespace' = $4::text) as marked_activity,
         (select count(*) from growth_jobs
           where id = $3::uuid
             and contact_id = $1::uuid
             and project_id = $2::uuid
             and idempotency_key = $8::text
             and payload->>'fixture_namespace' = $4::text) as marked_job
     )
     select (contacts + projects + activities + jobs + artifacts)::text as count,
            (marked_contact + marked_project + marked_activity + marked_job = 4)
              as markers_valid
     from fixture_counts`,
    [
      manifest.growth.contact_id,
      manifest.growth.project_id,
      manifest.growth.job_id,
      manifest.fixture_namespace,
      manifest.growth.posthog_distinct_id,
      `dogfood:${manifest.fixture_namespace}:${manifest.growth.project_id}`,
      manifest.growth.activity_event_key,
      manifest.growth.job_idempotency_key,
    ]
  );
  const row = result.rows[0];
  const count = Number(row?.count);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new DogfoodHarnessError('growth_count_invalid');
  }
  return { count, markersValid: row?.markers_valid === true };
}

async function assertNoOtherDueJobs(
  executor: SqlTransaction,
  manifest: DogfoodManifest
): Promise<void> {
  const result = await executor.execute<CountRow>(
    `/* lifecycle-dogfood:count-other-due-jobs */
     select count(*)::text as count
     from growth_jobs
     where id <> $1::uuid
       and kind = any(
         array['fulfill', 'enrich', 'notify', 'send_step', 'reply_reconcile']
       )
       and available_at <= now()
       and (
         status = 'pending'
         or (status = 'leased' and lease_until <= now())
       )`,
    [manifest.growth.job_id]
  );
  if (Number(result.rows[0]?.count) !== 0) {
    throw new DogfoodHarnessError('non_fixture_jobs_due');
  }
}

export interface SetupResult {
  alias: string;
  expectedCount: number;
  preflightCount: number;
  postSetupCount: number;
  status: 'VERIFIED';
}

export async function setupGrowthFixture(
  executor: SqlExecutor,
  manifest: DogfoodManifest
): Promise<SetupResult> {
  return executor.transaction(async (transaction) => {
    await assertGrowthDatabaseTarget(transaction, manifest);
    const preflight = await countGrowthFixture(transaction, manifest);
    if (preflight.count !== 0) {
      throw new DogfoodHarnessError('growth_setup_preflight_mismatch');
    }
    await assertNoOtherDueJobs(transaction, manifest);
    const inserted = await transaction.execute<{
      inserted_count: string | number;
    }>(
      `/* lifecycle-dogfood:insert-growth-fixture */
       with inserted_contact as (
         insert into growth_contacts (
           id, email_normalized, email_lookup_hmac, email_hmac_key_version,
           display_name, company_name, company_domain, outreach_approved_at,
           source
         ) values (
           $1::uuid,
           'lifecycle-dogfood+' || $1::text || '@threadplane.invalid',
           'dogfood:' || $1::text,
           1,
           'Lifecycle Dogfood',
           'Threadplane Dogfood',
           'threadplane.invalid',
           null,
           $6::text
         )
         returning id
       ), inserted_project as (
         insert into growth_projects (
           id, contact_id, posthog_distinct_id, claim_key_hash,
           claim_consumed_at, claim_method
         ) values (
           $2::uuid, $1::uuid, $8::uuid, $7::text, null, $6::text
         )
         returning id
       ), inserted_activity as (
         insert into growth_activity (
           event_key, contact_id, project_id, kind, occurred_at, data
         ) values (
           $3::text,
           $1::uuid,
           $2::uuid,
           'contact.form_submission',
           now(),
           jsonb_build_object(
             'fixture_namespace', $6::text,
             'form_kind', 'whitepaper',
             'submission_id', $9::text,
             'display_name', 'Lifecycle Dogfood',
             'company_name', 'Threadplane Dogfood',
             'company_domain', 'threadplane.invalid',
             'email_classification', 'personal',
             'paper', 'overview',
             'approval_granted', true
           )
         )
         returning id
       ), inserted_job as (
         insert into growth_jobs (
           id, kind, contact_id, project_id, status, available_at,
           idempotency_key, payload
         ) values (
           $4::uuid,
           'fulfill',
           $1::uuid,
           $2::uuid,
           'pending',
           $10::timestamptz,
           $5::text,
           jsonb_build_object(
             'fixture_namespace', $6::text,
             'form_kind', 'whitepaper',
             'paper', 'overview',
             'submission_id', $9::text
           )
         )
         returning id
       )
       select (
         (select count(*) from inserted_contact) +
         (select count(*) from inserted_project) +
         (select count(*) from inserted_activity) +
         (select count(*) from inserted_job)
       )::text as inserted_count`,
      [
        manifest.growth.contact_id,
        manifest.growth.project_id,
        manifest.growth.activity_event_key,
        manifest.growth.job_id,
        manifest.growth.job_idempotency_key,
        manifest.fixture_namespace,
        `dogfood:${manifest.fixture_namespace}:${manifest.growth.project_id}`,
        manifest.growth.posthog_distinct_id,
        manifest.growth.submission_id,
        FUTURE,
      ]
    );
    if (
      Number(inserted.rows[0]?.inserted_count) !==
      manifest.growth.expected_count
    ) {
      throw new DogfoodHarnessError('growth_setup_insert_mismatch');
    }
    const postSetup = await countGrowthFixture(transaction, manifest);
    if (
      postSetup.count !== manifest.growth.expected_count ||
      !postSetup.markersValid
    ) {
      throw new DogfoodHarnessError('growth_setup_postflight_mismatch');
    }
    return {
      alias: manifest.growth.alias,
      expectedCount: manifest.growth.expected_count,
      preflightCount: preflight.count,
      postSetupCount: postSetup.count,
      status: 'VERIFIED',
    };
  });
}

export interface CleanupResult {
  alias: string;
  expectedCount: number;
  preflightCount: number;
  postCleanupCount: number;
  status: 'VERIFIED';
}

export async function cleanupGrowthFixture(
  executor: SqlExecutor,
  manifest: DogfoodManifest
): Promise<CleanupResult> {
  return executor.transaction(async (transaction) => {
    await assertGrowthDatabaseTarget(transaction, manifest);
    const preflight = await countGrowthFixture(transaction, manifest);
    if (
      preflight.count !== manifest.growth.expected_count ||
      !preflight.markersValid
    ) {
      throw new DogfoodHarnessError('growth_cleanup_preflight_mismatch');
    }
    const deleted = await transaction.execute<{
      deleted_count: string | number;
    }>(
      `/* lifecycle-dogfood:delete-growth-fixture */
       with deleted_artifacts as (
         delete from growth_artifacts
         where job_id = $3::uuid
            or contact_id = $1::uuid
            or project_id = $2::uuid
         returning id
       ), deleted_activity as (
         delete from growth_activity
         where contact_id = $1::uuid or project_id = $2::uuid
         returning id
       ), deleted_jobs as (
         delete from growth_jobs
         where id = $3::uuid
            or contact_id = $1::uuid
            or project_id = $2::uuid
         returning id
       ), deleted_projects as (
         delete from growth_projects
         where id = $2::uuid and contact_id = $1::uuid
         returning id
       ), deleted_contacts as (
         delete from growth_contacts
         where id = $1::uuid and source = $4::text
         returning id
       )
       select (
         (select count(*) from deleted_artifacts) +
         (select count(*) from deleted_activity) +
         (select count(*) from deleted_jobs) +
         (select count(*) from deleted_projects) +
         (select count(*) from deleted_contacts)
       )::text as deleted_count`,
      [
        manifest.growth.contact_id,
        manifest.growth.project_id,
        manifest.growth.job_id,
        manifest.fixture_namespace,
      ]
    );
    if (Number(deleted.rows[0]?.deleted_count) !== preflight.count) {
      throw new DogfoodHarnessError('growth_cleanup_delete_mismatch');
    }
    const postCleanup = await countGrowthFixture(transaction, manifest);
    if (postCleanup.count !== 0) {
      throw new DogfoodHarnessError('growth_cleanup_postflight_mismatch');
    }
    return {
      alias: manifest.growth.alias,
      expectedCount: manifest.growth.expected_count,
      preflightCount: preflight.count,
      postCleanupCount: postCleanup.count,
      status: 'VERIFIED',
    };
  });
}

type Fetch = typeof globalThis.fetch;

interface LifecycleRequestDependencies {
  fetch: Fetch;
  lifecycleOriginA: string;
  lifecycleOriginB: string;
  serviceSecret: string;
}

function requestUrl(origin: string, path: string): URL {
  return new URL(path, origin.endsWith('/') ? origin : `${origin}/`);
}

async function lifecycleRequest(
  dependencies: LifecycleRequestDependencies,
  instance: 'a' | 'b',
  path: string,
  init: RequestInit = {},
  authorization: 'missing' | 'valid' | 'wrong' = 'valid'
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (authorization === 'valid') {
    headers.set('authorization', `Bearer ${dependencies.serviceSecret}`);
  } else if (authorization === 'wrong') {
    headers.set('authorization', 'Bearer dogfood-wrong-token');
  }
  const origin =
    instance === 'a'
      ? dependencies.lifecycleOriginA
      : dependencies.lifecycleOriginB;
  return dependencies.fetch(requestUrl(origin, path), { ...init, headers });
}

function threadByAlias(manifest: DogfoodManifest, alias: string): string {
  const thread = manifest.dawn.threads.find(
    (candidate) => candidate.alias === alias
  );
  if (!thread) throw new DogfoodHarnessError('manifest_invalid');
  return thread.id;
}

const DispatchStateSchema = z
  .object({
    trigger: z.enum(['cron', 'nudge']),
    dogfood_fixture_marker: FIXTURE_NAMESPACE,
    result: z
      .object({
        leased: z.number().int().nonnegative(),
        dispatched: z.number().int().nonnegative(),
        recoveryPaused: z.boolean(),
        operatorAlerts: z.array(z.literal('mailbox_recovery_required')),
      })
      .strict(),
  })
  .strict();

const PersistedWorkflowThreadSchema = z
  .object({
    metadata: z
      .object({
        route: z.literal(ROUTE),
      })
      .passthrough(),
    status: z.literal('idle'),
    thread_id: z.string(),
  })
  .passthrough();

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DogfoodHarnessError('response_schema_invalid');
  }
}

async function runDispatch(
  dependencies: LifecycleRequestDependencies,
  instance: 'a' | 'b',
  threadId: string,
  trigger: 'cron' | 'nudge' = 'cron'
): Promise<z.infer<typeof DispatchStateSchema>> {
  const response = await lifecycleRequest(
    dependencies,
    instance,
    `/threads/${encodeURIComponent(threadId)}/runs/wait`,
    {
      body: JSON.stringify({
        input: {
          trigger,
          dogfood_fixture_marker: FIXTURE_NAMESPACE.value,
        },
        route: ROUTE,
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }
  );
  if (response.status !== 200) {
    throw new DogfoodHarnessError('dispatch_probe_failed');
  }
  const parsed = DispatchStateSchema.safeParse(
    await parseJsonResponse(response)
  );
  if (!parsed.success) throw new DogfoodHarnessError('response_schema_invalid');
  return parsed.data;
}

export interface DogfoodGate {
  name: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  actual: Record<string, boolean | number | string>;
}

export interface DogfoodProbeResult {
  environmentLabel: string;
  gates: DogfoodGate[];
}

async function activateDuplicateFixture(
  executor: SqlExecutor,
  manifest: DogfoodManifest
): Promise<void> {
  const result = await executor.execute<{ activated_count: string | number }>(
    `/* lifecycle-dogfood:activate-duplicate-fixture */
     update growth_jobs
     set available_at = now()
     where id = $1::uuid
       and contact_id = $2::uuid
       and project_id = $3::uuid
       and idempotency_key = $4::text
       and payload->>'fixture_namespace' = $5::text
       and status = 'pending'
       and attempts = 0
       and delivery_status = 'not_submitted'
     returning 1::text as activated_count`,
    [
      manifest.growth.job_id,
      manifest.growth.contact_id,
      manifest.growth.project_id,
      manifest.growth.job_idempotency_key,
      manifest.fixture_namespace,
    ]
  );
  if (Number(result.rows[0]?.activated_count) !== 1) {
    throw new DogfoodHarnessError('duplicate_fixture_activation_failed');
  }
}

interface DuplicateJobRow extends Record<string, unknown> {
  attempts: number;
  delivery_status: string;
  last_error_code: string | null;
  provider_email_id: string | null;
  rfc_message_id: string | null;
  status: string;
}

async function verifyDuplicateFixture(
  executor: SqlExecutor,
  manifest: DogfoodManifest
): Promise<boolean> {
  const result = await executor.execute<DuplicateJobRow>(
    `/* lifecycle-dogfood:read-duplicate-fixture */
     select attempts, delivery_status, last_error_code,
            provider_email_id, rfc_message_id, status
     from growth_jobs
     where id = $1::uuid
       and contact_id = $2::uuid
       and project_id = $3::uuid
       and idempotency_key = $4::text
       and payload->>'fixture_namespace' = $5::text`,
    [
      manifest.growth.job_id,
      manifest.growth.contact_id,
      manifest.growth.project_id,
      manifest.growth.job_idempotency_key,
      manifest.fixture_namespace,
    ]
  );
  const row = result.rows[0];
  return (
    result.rows.length === 1 &&
    row?.attempts === 1 &&
    row.status === 'pending' &&
    row.last_error_code === 'delivery_disabled' &&
    row.delivery_status === 'not_submitted' &&
    row.provider_email_id === null &&
    row.rfc_message_id === null
  );
}

function bodyHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function readVerifiedHealth(
  dependencies: LifecycleRequestDependencies,
  manifest: DogfoodManifest,
  instance: 'a' | 'b'
): Promise<{ response: Response; text: string }> {
  const response = await lifecycleRequest(dependencies, instance, '/healthz', {
    method: 'GET',
  });
  const text = await response.text();
  let health: unknown;
  try {
    health = JSON.parse(text) as unknown;
  } catch {
    throw new DogfoodHarnessError('health_probe_failed');
  }
  const expectedDeploymentId =
    instance === 'a'
      ? manifest.targets.lifecycle_instance_a_deployment_id
      : manifest.targets.lifecycle_instance_b_deployment_id;
  if (
    response.status !== 200 ||
    !health ||
    typeof health !== 'object' ||
    (health as Record<string, unknown>)['status'] !== 'ready'
  ) {
    throw new DogfoodHarnessError('health_probe_failed');
  }
  if (
    response.headers.get('x-threadplane-deployment-id') !== expectedDeploymentId
  ) {
    throw new DogfoodHarnessError('target_identity_mismatch');
  }
  return { response, text };
}

export async function probeLifecyclePreview(
  dependencies: LifecycleRequestDependencies & { database: SqlExecutor },
  manifest: DogfoodManifest
): Promise<DogfoodProbeResult> {
  const namedThread = threadByAlias(manifest, 'thread-dogfood-01');
  const duplicateA = threadByAlias(manifest, 'duplicate-fixture-01-a');
  const duplicateB = threadByAlias(manifest, 'duplicate-fixture-01-b');
  const abortThread = threadByAlias(manifest, 'abort-fixture-01');
  await assertGrowthDatabaseTarget(dependencies.database, manifest);
  const [healthA] = await Promise.all([
    readVerifiedHealth(dependencies, manifest, 'a'),
    readVerifiedHealth(dependencies, manifest, 'b'),
  ]);
  await assertNoOtherDueJobs(dependencies.database, manifest);
  const authCases: readonly [string, RequestInit][] = [
    ['/healthz', { method: 'GET' }],
    ['/threads', { body: '{}', method: 'POST' }],
    [`/threads/${namedThread}`, { method: 'GET' }],
    [`/threads/${namedThread}/state`, { method: 'GET' }],
    [`/threads/${namedThread}/cancel`, { method: 'POST' }],
    [`/threads/${namedThread}/runs/wait`, { body: '{}', method: 'POST' }],
    [`/agui/${encodeURIComponent(ROUTE)}`, { body: '{}', method: 'POST' }],
    ['/memory/candidates', { method: 'GET' }],
  ];
  const authResponses = await Promise.all(
    authCases.flatMap(([path, init]) =>
      (['missing', 'wrong'] as const).map((authorization) =>
        lifecycleRequest(dependencies, 'a', path, init, authorization)
      )
    )
  );
  if (authResponses.some(({ status }) => status !== 401)) {
    throw new DogfoodHarnessError('outer_auth_probe_failed');
  }

  const named = await runDispatch(dependencies, 'a', namedThread);
  if (
    named.trigger !== 'cron' ||
    named.result.leased !== 0 ||
    named.result.dispatched !== 0 ||
    named.result.recoveryPaused
  ) {
    throw new DogfoodHarnessError('named_thread_probe_failed');
  }
  const persisted = await lifecycleRequest(
    dependencies,
    'b',
    `/threads/${encodeURIComponent(namedThread)}`,
    { method: 'GET' }
  );
  const persistedBody = PersistedWorkflowThreadSchema.safeParse(
    await parseJsonResponse(persisted)
  );
  if (
    persisted.status !== 200 ||
    !persistedBody.success ||
    persistedBody.data.thread_id !== namedThread
  ) {
    throw new DogfoodHarnessError('persistence_probe_failed');
  }

  await activateDuplicateFixture(dependencies.database, manifest);
  const duplicateStates = await Promise.all([
    runDispatch(dependencies, 'a', duplicateA),
    runDispatch(dependencies, 'b', duplicateB),
  ]);
  const leased = duplicateStates.reduce(
    (total, state) => total + state.result.leased,
    0
  );
  const dispatched = duplicateStates.reduce(
    (total, state) => total + state.result.dispatched,
    0
  );
  const duplicateVerified = await verifyDuplicateFixture(
    dependencies.database,
    manifest
  );
  if (leased !== 1 || dispatched !== 1 || !duplicateVerified) {
    throw new DogfoodHarnessError('duplicate_effect_probe_failed');
  }

  await runDispatch(dependencies, 'a', abortThread, 'nudge');
  const idleCancel = await lifecycleRequest(
    dependencies,
    'a',
    `/threads/${encodeURIComponent(abortThread)}/cancel`,
    { method: 'POST' }
  );
  if (idleCancel.status !== 409) {
    throw new DogfoodHarnessError('cancel_route_probe_failed');
  }

  return {
    environmentLabel: manifest.environment_label,
    gates: [
      {
        name: 'outer-auth',
        status: 'PASS',
        actual: {
          checkedPaths: authCases.length,
          checkedRequests: authResponses.length,
        },
      },
      {
        name: 'real-generated-health',
        status: 'PASS',
        actual: {
          bodySha256: bodyHash(healthA.text),
          status: healthA.response.status,
        },
      },
      {
        name: 'named-thread-run',
        status: 'PASS',
        actual: {
          dispatched: named.result.dispatched,
          leased: named.result.leased,
          recoveryPaused: named.result.recoveryPaused,
        },
      },
      {
        name: 'duplicate-effects',
        status: 'PASS',
        actual: { dispatched, leased, providerEffects: 0 },
      },
      {
        name: 'recovery-pause-resume',
        status: 'BLOCKED',
        actual: { reason: 'provider_free_resume_fixture_unavailable' },
      },
      {
        name: 'abort-and-cancel',
        status: 'BLOCKED',
        actual: {
          cancelRouteStatus: idleCancel.status,
          reason: 'deterministic_long_running_route_unavailable',
        },
      },
      {
        name: 'fresh-instance-persistence',
        status: 'PASS',
        actual: { threadRecordValid: true },
      },
    ],
  };
}

interface DawnFixturePreflight {
  markedIds: string[];
  missingCount: number;
}

async function preflightDawnFixtures(
  dependencies: LifecycleRequestDependencies,
  manifest: DogfoodManifest,
  instance: 'a' | 'b'
): Promise<DawnFixturePreflight> {
  const markedIds: string[] = [];
  let missingCount = 0;
  for (const { id } of manifest.dawn.threads) {
    const response = await lifecycleRequest(
      dependencies,
      instance,
      `/threads/${encodeURIComponent(id)}/state`,
      { method: 'GET' }
    );
    if (response.status === 404) {
      const threadResponse = await lifecycleRequest(
        dependencies,
        instance,
        `/threads/${encodeURIComponent(id)}`,
        { method: 'GET' }
      );
      if (threadResponse.status === 404) {
        missingCount += 1;
        continue;
      }
      if (threadResponse.status !== 200) {
        throw new DogfoodHarnessError('dawn_cleanup_preflight_failed');
      }
      const persistedThread = PersistedWorkflowThreadSchema.safeParse(
        await parseJsonResponse(threadResponse)
      );
      if (
        !persistedThread.success ||
        persistedThread.data.thread_id !== id
      ) {
        throw new DogfoodHarnessError('dawn_fixture_marker_mismatch');
      }
      markedIds.push(id);
      continue;
    }
    if (response.status !== 200) {
      throw new DogfoodHarnessError('dawn_cleanup_preflight_failed');
    }
    const body = await parseJsonResponse(response);
    const values =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)['values']
        : undefined;
    const marker =
      values && typeof values === 'object'
        ? (values as Record<string, unknown>)['dogfood_fixture_marker']
        : undefined;
    if (marker !== FIXTURE_NAMESPACE.value) {
      throw new DogfoodHarnessError('dawn_fixture_marker_mismatch');
    }
    markedIds.push(id);
  }
  return { markedIds, missingCount };
}

async function deleteDawnFixtures(
  dependencies: LifecycleRequestDependencies,
  manifest: DogfoodManifest,
  preflight: DawnFixturePreflight
): Promise<CleanupResult> {
  for (const id of preflight.markedIds) {
    const response = await lifecycleRequest(
      dependencies,
      'a',
      `/threads/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    if (response.status !== 204) {
      throw new DogfoodHarnessError('dawn_cleanup_delete_failed');
    }
  }
  const postflight = await preflightDawnFixtures(dependencies, manifest, 'b');
  if (
    postflight.markedIds.length !== 0 ||
    postflight.missingCount !== manifest.dawn.expected_count
  ) {
    throw new DogfoodHarnessError('dawn_cleanup_postflight_mismatch');
  }
  return {
    alias: manifest.dawn.alias,
    expectedCount: manifest.dawn.expected_count,
    preflightCount: preflight.markedIds.length,
    postCleanupCount: 0,
    status: 'VERIFIED',
  };
}

export async function cleanupDawnFixtures(
  dependencies: LifecycleRequestDependencies,
  manifest: DogfoodManifest
): Promise<CleanupResult> {
  await Promise.all([
    readVerifiedHealth(dependencies, manifest, 'a'),
    readVerifiedHealth(dependencies, manifest, 'b'),
  ]);
  const preflight = await preflightDawnFixtures(dependencies, manifest, 'a');
  if (
    preflight.markedIds.length === 0 ||
    preflight.markedIds.length + preflight.missingCount !==
      manifest.dawn.expected_count
  ) {
    throw new DogfoodHarnessError('dawn_cleanup_preflight_mismatch');
  }
  return deleteDawnFixtures(dependencies, manifest, preflight);
}

export async function cleanupDogfoodFixtures(
  dependencies: LifecycleRequestDependencies & { database: SqlExecutor },
  manifest: DogfoodManifest
): Promise<{ dawn: CleanupResult; growth: CleanupResult }> {
  await assertGrowthDatabaseTarget(dependencies.database, manifest);
  const growthPreflight = await countGrowthFixture(
    dependencies.database,
    manifest
  );
  if (
    growthPreflight.count !== 0 &&
    (growthPreflight.count !== manifest.growth.expected_count ||
      !growthPreflight.markersValid)
  ) {
    throw new DogfoodHarnessError('growth_cleanup_preflight_mismatch');
  }
  await Promise.all([
    readVerifiedHealth(dependencies, manifest, 'a'),
    readVerifiedHealth(dependencies, manifest, 'b'),
  ]);
  const dawnPreflight = await preflightDawnFixtures(
    dependencies,
    manifest,
    'a'
  );
  if (
    dawnPreflight.markedIds.length + dawnPreflight.missingCount !==
    manifest.dawn.expected_count
  ) {
    throw new DogfoodHarnessError('dawn_cleanup_preflight_mismatch');
  }
  const emptyDawn =
    dawnPreflight.markedIds.length === 0
      ? await deleteDawnFixtures(dependencies, manifest, dawnPreflight)
      : undefined;

  const growth =
    growthPreflight.count === 0
      ? {
          alias: manifest.growth.alias,
          expectedCount: manifest.growth.expected_count,
          preflightCount: 0,
          postCleanupCount: 0,
          status: 'VERIFIED' as const,
        }
      : await cleanupGrowthFixture(dependencies.database, manifest);
  const dawn =
    emptyDawn ??
    (await deleteDawnFixtures(dependencies, manifest, dawnPreflight));
  return { dawn, growth };
}

type DogfoodCommand = 'cleanup' | 'probe' | 'setup';

function parseCliArguments(argv: readonly string[]): {
  command: DogfoodCommand;
  manifestPath: string;
} {
  const command = argv[0];
  if (command !== 'cleanup' && command !== 'probe' && command !== 'setup') {
    throw new DogfoodHarnessError('usage_invalid');
  }
  if (argv[1] !== '--manifest' || !argv[2] || argv.length !== 3) {
    throw new DogfoodHarnessError('usage_invalid');
  }
  return { command, manifestPath: argv[2] };
}

function requiredEnvironment(
  environment: NodeJS.ProcessEnv,
  name: string
): string {
  const value = environment[name]?.trim();
  if (!value) throw new DogfoodHarnessError('environment_incomplete');
  return value;
}

async function loadManifest(path: string): Promise<DogfoodManifest> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    throw new DogfoodHarnessError('manifest_invalid');
  }
  return parseDogfoodManifest(parsed);
}

interface DogfoodMainDependencies {
  createDatabase: (databaseUrl: string) => SqlExecutor;
  fetch: Fetch;
  loadManifest: (path: string) => Promise<DogfoodManifest>;
  writeError: (value: string) => void;
  writeOutput: (value: string) => void;
}

const defaultMainDependencies: DogfoodMainDependencies = {
  createDatabase: createDatabaseExecutor,
  fetch: globalThis.fetch,
  loadManifest,
  writeError: (value) => process.stderr.write(value),
  writeOutput: (value) => process.stdout.write(value),
};

export async function mainDogfoodHarness(
  argv: readonly string[] = process.argv.slice(2),
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: DogfoodMainDependencies = defaultMainDependencies
): Promise<number> {
  let database: SqlExecutor | undefined;
  let output: string | undefined;
  let failureCode: string | undefined;
  try {
    const { command, manifestPath } = parseCliArguments(argv);
    const manifest = await dependencies.loadManifest(manifestPath);
    const databaseUrl = requiredEnvironment(environment, 'DATABASE_URL');
    const lifecycleOriginA = requiredEnvironment(
      environment,
      'LIFECYCLE_DOGFOOD_INSTANCE_A_ORIGIN'
    );
    const lifecycleOriginB = requiredEnvironment(
      environment,
      'LIFECYCLE_DOGFOOD_INSTANCE_B_ORIGIN'
    );
    validateDogfoodTargetUrls({
      databaseUrl,
      lifecycleOriginA,
      lifecycleOriginB,
    });
    const serviceSecret = requiredEnvironment(
      environment,
      'LIFECYCLE_SERVICE_SECRET'
    );
    database = dependencies.createDatabase(databaseUrl);
    await assertDogfoodTargets(database, manifest, {
      databaseUrl,
      lifecycleOriginA,
      lifecycleOriginB,
    });
    const requestDependencies = {
      fetch: dependencies.fetch,
      lifecycleOriginA,
      lifecycleOriginB,
      serviceSecret,
    };
    const result =
      command === 'setup'
        ? await setupGrowthFixture(database, manifest)
        : command === 'probe'
        ? await probeLifecyclePreview(
            { ...requestDependencies, database },
            manifest
          )
        : await cleanupDogfoodFixtures(
            { ...requestDependencies, database },
            manifest
          );
    output = `${JSON.stringify({ command, result })}\n`;
  } catch (error) {
    failureCode =
      error instanceof DogfoodHarnessError ? error.code : 'operation_failed';
  }
  try {
    await database?.close?.();
  } catch {
    failureCode ??= 'database_close_failed';
  }
  if (failureCode) {
    dependencies.writeError(
      `${JSON.stringify({ status: 'FAILED', error: failureCode })}\n`
    );
    return 1;
  }
  dependencies.writeOutput(output ?? '');
  return 0;
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) process.exitCode = await mainDogfoodHarness();
