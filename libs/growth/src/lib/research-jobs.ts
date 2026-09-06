import type { SqlExecutor, SqlTransaction } from './database.ts';
import type { GrowthJob } from './models.ts';
import { JobLeaseConflictError, deferLeasedJob } from './jobs.ts';
import { CONTACT_HARD_STOP_REASONS } from './contacts.ts';
import { companyDomainFromEmail } from './company-domain.ts';
import { privacyLock } from './observability/store.ts';
import { installRuntimeEvidenceSql } from './observability/install-runtime-enrichment.ts';

export interface ResearchAttempt {
  attemptId: string;
  threadId: string;
  companyDomain: string;
  evidenceHash: string;
  expiresAt: string;
  runId: string | null;
  phase: 'prepared' | 'submitting' | 'submitted';
}
interface LeaseInput {
  jobId: string;
  leaseToken: string;
  now: Date;
}
function opaque(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)
  );
}
export function getResearchAttempt(
  job: Pick<GrowthJob, 'payload'>
): ResearchAttempt | null {
  const value = job.payload['research_attempt'];
  if (value === undefined) return null;
  const a = value as ResearchAttempt;
  if (
    !a ||
    !opaque(a.attemptId) ||
    !opaque(a.threadId) ||
    typeof a.companyDomain !== 'string' ||
    companyDomainFromEmail(`research@${a.companyDomain}`) !== a.companyDomain ||
    !/^[a-f0-9]{64}$/u.test(a.evidenceHash) ||
    typeof a.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(a.expiresAt)) ||
    !['prepared', 'submitting', 'submitted'].includes(a.phase) ||
    (a.runId !== null && !opaque(a.runId))
  ) {
    throw new Error('Invalid persisted research attempt');
  }
  return a;
}

function exactObject(
  value: unknown,
  keys: string[]
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}
function boundedText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}
/** Wire evidence stays contact-linked in Growth; cleanup jobs never receive it. */
export function getResearchInput(
  job: Pick<GrowthJob, 'payload'>
): Record<string, unknown> | null {
  const value = job.payload['research_input'];
  const attempt = getResearchAttempt(job);
  if (value === undefined && !attempt) return null;
  const invalid = () => new Error('Invalid persisted research input');
  if (
    !attempt ||
    !exactObject(value, [
      'version',
      'attemptId',
      'domain',
      'pages',
      'evidenceHash',
      'expiresAt',
      'generationRef',
    ]) ||
    value['version'] !== 'company_research.request.v1' ||
    value['attemptId'] !== attempt.attemptId ||
    value['evidenceHash'] !== attempt.evidenceHash ||
    value['expiresAt'] !== attempt.expiresAt ||
    !boundedText(value['domain'], 253) ||
    companyDomainFromEmail(`research@${value['domain']}`) !== value['domain'] ||
    !boundedText(value['generationRef'], 100) ||
    !/^[a-zA-Z0-9._-]+$/u.test(value['generationRef']) ||
    !Array.isArray(value['pages']) ||
    value['pages'].length > 3 ||
    JSON.stringify(value).length > 50000
  )
    throw invalid();
  for (const page of value['pages']) {
    if (
      !exactObject(page, [
        'canonicalUrl',
        'retrievedAt',
        'contentHash',
        'facts',
        'snippets',
      ]) ||
      !boundedText(page['canonicalUrl'], 2048) ||
      !boundedText(page['retrievedAt'], 40) ||
      !Number.isFinite(Date.parse(page['retrievedAt'])) ||
      !boundedText(page['contentHash'], 64) ||
      !/^[a-f0-9]{64}$/u.test(page['contentHash'])
    )
      throw invalid();
    const url = new URL(page['canonicalUrl']);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      url.hostname.replace(/^www\./u, '') !==
        value['domain'].replace(/^www\./u, '')
    )
      throw invalid();
    for (const key of ['facts', 'snippets']) {
      const texts = page[key];
      if (
        !Array.isArray(texts) ||
        texts.length > 6 ||
        texts.some((text) => !boundedText(text, 240))
      )
        throw invalid();
    }
  }
  return value;
}

async function authorized(tx: SqlTransaction, input: LeaseInput) {
  if (!Number.isFinite(input.now.getTime()))
    throw new Error('Invalid research time');
  await privacyLock(tx, true);
  const reference = await tx.execute<{ contact_id: string }>(
    `/* growth:research-discover */ select contact_id from growth_jobs where id=$1`,
    [input.jobId]
  );
  if (!reference.rows[0]?.contact_id)
    throw new JobLeaseConflictError(input.jobId);
  await tx.execute(
    `/* growth:research-lock-contact */ select id from growth_contacts where id=$1 for update`,
    [reference.rows[0].contact_id]
  );
  const result = await tx.execute<{
    payload: Record<string, unknown>;
    company_domain: string | null;
    email_normalized: string;
  }>(
    `/* growth:research-authorize */
     select j.payload, c.company_domain, c.email_normalized
     from growth_jobs j join growth_contacts c on c.id=j.contact_id
     where j.id=$1 and j.contact_id=$4 and j.kind='enrich'
       and j.status='leased' and j.lease_token=$2::uuid and j.lease_until>$3
       and c.deleted_at is null and c.outreach_approved_at is not null
       and j.payload->>'evidence_redacted' is distinct from 'true'
       and not exists(select 1 from growth_activity stop where stop.contact_id=c.id
         and stop.kind=any($5::text[]) and stop.occurred_at>=c.outreach_approved_at)
       and ((j.payload->>'source' is distinct from 'install_runtime' and j.idempotency_key not like 'install-runtime:v1:%')
         or (j.payload->>'source'='install_runtime' and ${installRuntimeEvidenceSql(
           "j.payload->>'install_observation_id'",
           "j.payload->>'runtime_observation_id'"
         )}))
     for update of j`,
    [
      input.jobId,
      input.leaseToken,
      input.now,
      reference.rows[0].contact_id,
      CONTACT_HARD_STOP_REASONS,
    ]
  );
  const row = result.rows[0];
  if (!row) throw new JobLeaseConflictError(input.jobId);
  return {
    ...row,
    domain:
      row.payload['source'] === 'install_runtime'
        ? companyDomainFromEmail(row.email_normalized)
        : row.company_domain
        ? companyDomainFromEmail(`research@${row.company_domain}`)
        : companyDomainFromEmail(row.email_normalized),
  };
}

/** No identity is exposed to the capture caller, and stops are checked before acquisition. */
export async function readResearchCompanyDomain(
  db: SqlExecutor,
  input: LeaseInput
): Promise<string | null> {
  return db.transaction(async (tx) => (await authorized(tx, input)).domain);
}

/** Establishes immutable correlation. Submission requires markResearchSubmissionStarted. */
export async function beginResearchAttempt(
  db: SqlExecutor,
  input: LeaseInput & {
    attemptId: string;
    threadId: string;
    companyDomain: string;
    evidenceHash: string;
    expiresAt: Date;
    researchInput: Record<string, unknown>;
  }
): Promise<{
  attempt: ResearchAttempt;
  researchInput: Record<string, unknown>;
  created: boolean;
}> {
  return db.transaction(async (tx) => {
    const row = await authorized(tx, input);
    const existing = getResearchAttempt(row);
    if (
      row.domain !== input.companyDomain ||
      (existing &&
        (existing.companyDomain !== input.companyDomain ||
          existing.evidenceHash !== input.evidenceHash))
    )
      throw new Error('Research company evidence changed');
    if (existing) {
      const researchInput = getResearchInput(row);
      if (!researchInput) throw new Error('Missing persisted research input');
      return { attempt: existing, researchInput, created: false };
    }
    const attempt: ResearchAttempt = {
      attemptId: input.attemptId,
      threadId: input.threadId,
      companyDomain: input.companyDomain,
      evidenceHash: input.evidenceHash,
      expiresAt: input.expiresAt.toISOString(),
      runId: null,
      phase: 'prepared',
    };
    getResearchAttempt({ payload: { research_attempt: attempt } });
    const researchInput = getResearchInput({
      payload: {
        research_attempt: attempt,
        research_input: input.researchInput,
      },
    });
    if (!researchInput) throw new Error('Missing research input');
    if (
      input.expiresAt.getTime() <= input.now.getTime() ||
      input.expiresAt.getTime() > input.now.getTime() + 120000
    )
      throw new Error('Research expiry must be within two minutes');
    // No contact/project linkage or evidence: privacy cancellation cannot erase owned remote identity.
    await tx.execute(
      `/* growth:research-enqueue-cleanup */
      insert into growth_jobs(kind,contact_id,project_id,status,available_at,idempotency_key,payload)
      values ('research_cleanup', null, null, 'pending', $1, $2, $3::jsonb)`,
      [
        input.expiresAt,
        `research-cleanup:v1:${attempt.attemptId}`,
        JSON.stringify({
          attemptId: attempt.attemptId,
          threadId: attempt.threadId,
          expiresAt: attempt.expiresAt,
          runId: null,
        }),
      ]
    );
    await tx.execute(
      `/* growth:research-record-attempt */ update growth_jobs
      set payload=jsonb_set(jsonb_set(payload,'{research_attempt}',$2::jsonb),'{research_input}',$3::jsonb) where id=$1`,
      [input.jobId, JSON.stringify(attempt), JSON.stringify(researchInput)]
    );
    return { attempt, researchInput, created: true };
  });
}

/** Durable one-way fence immediately before the non-idempotent paid POST. Never reset it after a timeout. */
export async function markResearchSubmissionStarted(
  db: SqlExecutor,
  input: LeaseInput & { attemptId: string }
): Promise<{ claimed: boolean }> {
  return db.transaction(async (tx) => {
    const row = await authorized(tx, input);
    const attempt = getResearchAttempt(row);
    if (
      !attempt ||
      attempt.attemptId !== input.attemptId ||
      attempt.companyDomain !== row.domain
    )
      throw new JobLeaseConflictError(input.jobId);
    if (attempt.phase !== 'prepared') return { claimed: false };
    if (Date.parse(attempt.expiresAt) <= input.now.getTime())
      return { claimed: false };
    await tx.execute(
      `/* growth:research-submit-fence */ update growth_jobs set payload=jsonb_set(payload,'{research_attempt,phase}','"submitting"'::jsonb) where id=$1`,
      [input.jobId]
    );
    return { claimed: true };
  });
}

export async function acknowledgeResearchRun(
  db: SqlExecutor,
  input: LeaseInput & { attemptId: string; runId: string }
): Promise<void> {
  if (!opaque(input.runId)) throw new Error('Invalid opaque run ID');
  await db.transaction(async (tx) => {
    const row = await authorized(tx, input);
    const attempt = getResearchAttempt(row);
    if (
      !attempt ||
      attempt.phase === 'prepared' ||
      attempt.attemptId !== input.attemptId ||
      (attempt.runId !== null && attempt.runId !== input.runId)
    )
      throw new JobLeaseConflictError(input.jobId);
    await tx.execute(
      `/* growth:research-acknowledge */ update growth_jobs set payload=jsonb_set(jsonb_set(payload,'{research_attempt,runId}',to_jsonb($2::text)),'{research_attempt,phase}','"submitted"'::jsonb) where id=$1`,
      [input.jobId, input.runId]
    );
    await tx.execute(
      `/* growth:research-cleanup-acknowledge */ update growth_jobs set payload=jsonb_set(payload,'{runId}',to_jsonb($2::text)) where idempotency_key=$1 and kind='research_cleanup'`,
      [`research-cleanup:v1:${attempt.attemptId}`, input.runId]
    );
  });
}

/** Existing lease deferral preserves payload for both enrichment reconciliation and cleanup. */
export const deferResearchJob = deferLeasedJob;

/** First observed thread absence; this is not execution-claim settlement. */
export async function recordResearchCleanupAbsence(
  db: SqlExecutor,
  input: LeaseInput & { attemptId: string; threadId: string; absent?: boolean }
): Promise<void> {
  const result = await db.execute(
    `/* growth:research-cleanup-absence */
     update growth_jobs set payload=case when $6::boolean then jsonb_set(payload,'{cleanup_absent_at}',to_jsonb($3::timestamptz)) else payload-'cleanup_absent_at' end
     where id=$1 and kind='research_cleanup' and status='leased' and lease_token=$2::uuid and lease_until>$3
       and payload->>'attemptId'=$4 and payload->>'threadId'=$5
     returning id`,
    [
      input.jobId,
      input.leaseToken,
      input.now,
      input.attemptId,
      input.threadId,
      input.absent !== false,
    ]
  );
  if (result.rows.length !== 1) throw new JobLeaseConflictError(input.jobId);
}

/** Finish cleanup and drop terminal evidence in the same transaction.
 * Parent-before-cleanup locking matches acknowledgement; artifacts are retained. */
export async function finishResearchCleanup(
  db: SqlExecutor,
  input: LeaseInput & {
    attemptId: string;
    threadId: string;
    status?: 'completed' | 'failed';
    errorCode?: string;
  }
): Promise<void> {
  await db.transaction(async (tx) => {
    await privacyLock(tx, true);
    const parents = await tx.execute<{ status: string }>(
      `select status from growth_jobs where kind='enrich'
       and payload->'research_attempt'->>'attemptId'=$1
       and payload->'research_attempt'->>'threadId'=$2
       order by id for update`,
      [input.attemptId, input.threadId]
    );
    if (
      input.status !== 'failed' &&
      parents.rows.some(
        (row) => row.status === 'pending' || row.status === 'leased'
      )
    )
      throw new JobLeaseConflictError(input.jobId);
    const result = await tx.execute(
      `/* growth:research-cleanup-finish */
       update growth_jobs set status=$6,lease_token=null,lease_until=null,last_error_code=$7
       where id=$1 and kind='research_cleanup' and status='leased' and lease_token=$2::uuid and lease_until>$3
         and payload->>'attemptId'=$4 and payload->>'threadId'=$5
         and ($6='failed' or (payload->>'cleanup_absent_at')::timestamptz <= $3::timestamptz - interval '60 seconds')
       returning id`,
      [
        input.jobId,
        input.leaseToken,
        input.now,
        input.attemptId,
        input.threadId,
        input.status ?? 'completed',
        input.errorCode ?? null,
      ]
    );
    if (result.rows.length !== 1) throw new JobLeaseConflictError(input.jobId);
    if (input.status === 'failed')
      await tx.execute(
        `update growth_jobs set status='failed',lease_token=null,lease_until=null,last_error_code='dawn_recovery_deadline'
       where kind='enrich' and status in ('pending','leased')
         and payload->'research_attempt'->>'attemptId'=$1
         and payload->'research_attempt'->>'threadId'=$2`,
        [input.attemptId, input.threadId]
      );
    await tx.execute(
      `/* growth:research-cleanup-scrub */ update growth_jobs set payload=payload-'research_input'
       where kind='enrich' and status in ('completed','failed','cancelled')
         and payload->'research_attempt'->>'attemptId'=$1
         and payload->'research_attempt'->>'threadId'=$2`,
      [input.attemptId, input.threadId]
    );
  });
}

/** Record observed terminal-run/settled-writer proof before deleting the remote
 * thread, so trace cleanup can resume without fabricating a missing run's fate. */
export async function recordResearchCleanupQuiescence(
  db: SqlExecutor,
  input: LeaseInput & {
    attemptId: string;
    threadId: string;
    runId: string;
    settledAt: string;
  }
): Promise<void> {
  if (
    !opaque(input.attemptId) ||
    !opaque(input.threadId) ||
    !opaque(input.runId) ||
    !Number.isFinite(Date.parse(input.settledAt))
  )
    throw new Error('Invalid cleanup proof');
  const result = await db.execute(
    `/* growth:research-cleanup-proof */
    update growth_jobs set payload=jsonb_set(payload,'{cleanup_quiescence}',$6::jsonb)
    where id=$1 and kind='research_cleanup' and status='leased' and lease_token=$2::uuid and lease_until>$3
      and payload->>'attemptId'=$4 and payload->>'threadId'=$5
      and (payload->'cleanup_quiescence' is null or payload->'cleanup_quiescence'=$6::jsonb)
    returning id`,
    [
      input.jobId,
      input.leaseToken,
      input.now,
      input.attemptId,
      input.threadId,
      JSON.stringify({ runId: input.runId, settledAt: input.settledAt }),
    ]
  );
  if (result.rows.length !== 1) throw new JobLeaseConflictError(input.jobId);
}

/** The caller validates candidate structure/quotes first; this transaction guards live publication. */
export async function publishResearchArtifact(
  db: SqlExecutor,
  input: LeaseInput & {
    attemptId: string;
    companyDomain: string;
    evidenceHash: string;
    content: Record<string, unknown>;
  }
): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await authorized(tx, input);
    const attempt = getResearchAttempt(row);
    if (
      !attempt ||
      !attempt.runId ||
      attempt.attemptId !== input.attemptId ||
      row.domain !== input.companyDomain ||
      attempt.companyDomain !== input.companyDomain ||
      attempt.evidenceHash !== input.evidenceHash
    )
      throw new JobLeaseConflictError(input.jobId);
    const inserted = await tx.execute(
      `/* growth:research-insert-artifact */
      insert into growth_artifacts(job_id,contact_id,project_id,kind,schema_version,content)
      select id,contact_id,project_id,'company_enrichment.v1',1,$2::jsonb from growth_jobs where id=$1
      on conflict(job_id) do update set content=growth_artifacts.content
      where growth_artifacts.kind='company_enrichment.v1' and growth_artifacts.schema_version=1
        and growth_artifacts.content=excluded.content returning id`,
      [input.jobId, JSON.stringify(input.content)]
    );
    if (inserted.rows.length !== 1)
      throw new Error('Research artifact conflicts with existing result');
  });
}
