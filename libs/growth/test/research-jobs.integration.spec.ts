import { createHash, randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../src/lib/database.ts';
import {
  beginResearchAttempt,
  markResearchSubmissionStarted,
  acknowledgeResearchRun,
  publishResearchArtifact,
  getResearchInput,
  recordResearchCleanupQuiescence,
  recordResearchCleanupAbsence,
  finishResearchCleanup,
} from '../src/lib/research-jobs.ts';
import { leaseDueJobs, readLifecycleJobContext } from '../src/lib/jobs.ts';
import { stopContact } from '../src/lib/stops.ts';
import { deleteContact } from '../src/lib/contacts.ts';
import { acceptObservationBatch } from '../src/lib/observability/ingest.ts';
import { redactObservationEvidence } from '../src/lib/observability/redaction.ts';
import { readContactJourney } from '../src/lib/observability/journey-report.ts';
import {
  cleanContactObservationFences,
  cleanEvidence,
  evidenceDatabase,
  evidenceFixture,
  evidenceKeys,
} from './observability-fixtures.ts';

// evidenceDatabase requires TEST_DATABASE_URL; the integration config also enforces
// Node 22 and prohibits DATABASE_URL/DAWN_DATABASE_URL. Never use a live fallback.
describe('durable research attempts against TEST_DATABASE_URL', () => {
  let db: SqlExecutor;
  let contactId: string,
    jobId: string,
    leaseToken: string,
    attemptId: string,
    threadId: string;
  let now: Date;
  let subjects: string[], operations: string[], attemptIds: string[];
  beforeEach(async () => {
    db = await evidenceDatabase();
    contactId = randomUUID();
    jobId = randomUUID();
    leaseToken = randomUUID();
    attemptId = randomUUID();
    threadId = randomUUID();
    now = new Date();
    subjects = [];
    operations = [];
    attemptIds = [attemptId];
    await db.execute(
      `insert into growth_contacts(id,email_normalized,email_lookup_hmac,email_hmac_key_version,source,outreach_approved_at,company_domain)
      values($1,$2,$3,777,'integration-test',$4,'example.invalid')`,
      [contactId, `${contactId}@example.invalid`, randomUUID(), now]
    );
    await db.execute(
      `insert into growth_jobs(id,kind,contact_id,status,available_at,idempotency_key,payload,lease_token,lease_until)
      values($1::uuid,'enrich',$2,'leased',$3,$1::text,'{}'::jsonb,$4,$5)`,
      [jobId, contactId, now, leaseToken, new Date(now.getTime() + 60000)]
    );
  });
  afterEach(async () => {
    if (!db) return;
    await cleanContactObservationFences(db, contactId);
    await db.execute('delete from growth_artifacts where contact_id=$1', [
      contactId,
    ]);
    await cleanEvidence(db, subjects, operations);
    await db.execute(
      'delete from growth_jobs where contact_id=$1 or idempotency_key=any($2::text[])',
      [contactId, attemptIds.map((id) => `research-cleanup:v1:${id}`)]
    );
    await db.execute('delete from growth_activity where contact_id=$1', [
      contactId,
    ]);
    await db.execute('delete from growth_contacts where id=$1', [contactId]);
    await db.close?.();
  });
  function input(id = attemptId) {
    const domain = 'example.invalid';
    const pages = [
      {
        canonicalUrl: 'https://example.invalid/about',
        retrievedAt: now.toISOString(),
        contentHash: 'b'.repeat(64),
        facts: ['Example makes software.'],
        snippets: ['Example makes software.'],
      },
    ];
    const evidenceHash = createHash('sha256')
      .update(JSON.stringify({ domain, pages }))
      .digest('hex');
    const expiresAt = new Date(now.getTime() + 90000);
    return {
      jobId,
      leaseToken,
      now,
      attemptId: id,
      threadId,
      companyDomain: domain,
      evidenceHash,
      expiresAt,
      researchInput: {
        version: 'company_research.request.v1',
        attemptId: id,
        domain,
        pages,
        evidenceHash,
        expiresAt: expiresAt.toISOString(),
        generationRef: 'integration-v1',
      },
    };
  }
  async function submit() {
    const request = input();
    await beginResearchAttempt(db, request);
    expect(await markResearchSubmissionStarted(db, request)).toEqual({
      claimed: true,
    });
    await acknowledgeResearchRun(db, { ...request, runId: randomUUID() });
    return request;
  }
  async function payload() {
    const result = await db.execute<{ payload: Record<string, unknown> }>(
      'select payload from growth_jobs where id=$1',
      [jobId]
    );
    return result.rows[0].payload;
  }
  it('guards absence observations and atomically scrubs only terminal parent evidence on verified completion', async () => {
    await submit();
    await publishResearchArtifact(db, {
      ...input(),
      content: { profile: { name: 'Example' } },
    });
    const result = await db.execute<{ id: string }>(
      `update growth_jobs set status='leased', lease_token=$2, lease_until=$3 where idempotency_key=$1 returning id`,
      [
        `research-cleanup:v1:${attemptId}`,
        leaseToken,
        new Date(now.getTime() + 600000),
      ]
    );
    const cleanup = {
      jobId: result.rows[0].id,
      leaseToken,
      now,
      attemptId,
      threadId,
    };
    await expect(
      recordResearchCleanupAbsence(db, { ...cleanup, threadId: randomUUID() })
    ).rejects.toThrow('lease');
    await recordResearchCleanupAbsence(db, cleanup);
    await recordResearchCleanupAbsence(db, { ...cleanup, absent: false });
    expect(
      (
        await db.execute<{ payload: Record<string, unknown> }>(
          'select payload from growth_jobs where id=$1',
          [cleanup.jobId]
        )
      ).rows[0].payload['cleanup_absent_at']
    ).toBeUndefined();
    await recordResearchCleanupAbsence(db, cleanup);
    await expect(finishResearchCleanup(db, cleanup)).rejects.toThrow('lease');
    expect((await payload())['research_input']).toBeDefined();
    const later = { ...cleanup, now: new Date(now.getTime() + 60000) };
    await expect(finishResearchCleanup(db, later)).rejects.toThrow('lease');
    await db.execute(
      `update growth_jobs set status='completed', lease_token=null, lease_until=null where id=$1`,
      [jobId]
    );
    await expect(
      finishResearchCleanup(db, { ...later, leaseToken: randomUUID() })
    ).rejects.toThrow('lease');
    expect((await payload())['research_input']).toBeDefined();
    await finishResearchCleanup(db, later);
    expect((await payload())['research_input']).toBeUndefined();
    expect((await payload())['research_attempt']).toBeDefined();
    expect(
      (
        await db.execute<{ content: unknown }>(
          'select content from growth_artifacts where job_id=$1',
          [jobId]
        )
      ).rows[0].content
    ).toEqual({ profile: { name: 'Example' } });
    expect(
      (
        await db.execute<{ status: string }>(
          'select status from growth_jobs where id=$1',
          [cleanup.jobId]
        )
      ).rows[0].status
    ).toBe('completed');
  });
  it.each(['completed', 'leased'])(
    'scrubs a %s parent at the failed horizon without requiring absence or losing identity',
    async (status) => {
      await submit();
      if (status === 'completed')
        await db.execute(
          `update growth_jobs set status='completed',lease_token=null,lease_until=null where id=$1`,
          [jobId]
        );
      const result = await db.execute<{ id: string }>(
        `update growth_jobs set status='leased',lease_token=$2,lease_until=$3 where idempotency_key=$1 returning id`,
        [
          `research-cleanup:v1:${attemptId}`,
          leaseToken,
          new Date(now.getTime() + 600000),
        ]
      );
      await finishResearchCleanup(db, {
        jobId: result.rows[0].id,
        leaseToken,
        now,
        attemptId,
        threadId,
        status: 'failed',
        errorCode: 'dawn_cleanup_horizon_exceeded',
      });
      expect((await payload())['research_input']).toBeUndefined();
      const parent = (
        await db.execute<{
          status: string;
          lease_token: string | null;
          last_error_code: string | null;
        }>(
          'select status,lease_token,last_error_code from growth_jobs where id=$1',
          [jobId]
        )
      ).rows[0];
      expect(parent.status).toBe(
        status === 'completed' ? 'completed' : 'failed'
      );
      expect(parent.lease_token).toBeNull();
      if (status === 'leased')
        expect(parent.last_error_code).toBe('dawn_recovery_deadline');
      const row = (
        await db.execute<{
          status: string;
          last_error_code: string;
          payload: Record<string, unknown>;
        }>(
          'select status,last_error_code,payload from growth_jobs where id=$1',
          [result.rows[0].id]
        )
      ).rows[0];
      expect(row.status).toBe('failed');
      expect(row.last_error_code).toBe('dawn_cleanup_horizon_exceeded');
      expect(row.payload['threadId']).toBe(threadId);
    }
  );
  async function assertCleanupLeasable() {
    const cleanup = (
      await db.execute<{
        id: string;
        contact_id: string | null;
        project_id: string | null;
        payload: Record<string, unknown>;
      }>(
        'select id,contact_id,project_id,payload from growth_jobs where idempotency_key=$1',
        [`research-cleanup:v1:${attemptId}`]
      )
    ).rows[0];
    expect(cleanup).toMatchObject({
      contact_id: null,
      project_id: null,
      payload: { attemptId, threadId },
    });
    expect(JSON.stringify(cleanup.payload)).not.toContain('example.invalid');
    expect(cleanup.payload).not.toHaveProperty('pages');
    const leased = await leaseDueJobs(db, {
      kinds: ['research_cleanup'],
      now: new Date(now.getTime() + 90001),
      batchSize: 100,
      leaseDurationMs: 30000,
      campaignEnabled: false,
    });
    expect(leased.find((job) => job.id === cleanup.id)?.status).toBe('leased');
    const cleanupLease = leased.find((job) => job.id === cleanup.id);
    if (!cleanupLease?.leaseToken) throw new Error('cleanup lease missing');
    const proofInput = {
      jobId: cleanup.id,
      leaseToken: cleanupLease.leaseToken,
      now: new Date(now.getTime() + 90001),
      attemptId,
      threadId,
      runId: randomUUID(),
      settledAt: now.toISOString(),
    };
    await recordResearchCleanupQuiescence(db, proofInput);
    await expect(
      recordResearchCleanupQuiescence(db, {
        ...proofInput,
        leaseToken: randomUUID(),
      })
    ).rejects.toThrow();
    expect(
      (
        await db.execute<{ payload: Record<string, unknown> }>(
          'select payload from growth_jobs where id=$1',
          [cleanup.id]
        )
      ).rows[0].payload['cleanup_quiescence']
    ).toEqual({ runId: proofInput.runId, settledAt: proofInput.settledAt });
  }
  async function stop() {
    await stopContact(db, {
      contactId,
      reason: 'unsubscribe',
      eventKey: randomUUID(),
      occurredAt: now,
      source: 'integration-test',
      provenance: { kind: 'one_click', policyVersion: 'test:v1' },
    });
  }
  it('serializes concurrent begin and submission claims to one immutable remote attempt', async () => {
    const other = randomUUID();
    attemptIds.push(other);
    const results = await Promise.all([
      beginResearchAttempt(db, input()),
      beginResearchAttempt(db, input(other)),
    ]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results[0].attempt).toEqual(results[1].attempt);
    attemptId = results[0].attempt.attemptId;
    expect(
      (
        await db.execute(
          'select id from growth_jobs where idempotency_key=any($1::text[])',
          [attemptIds.map((id) => `research-cleanup:v1:${id}`)]
        )
      ).rows
    ).toHaveLength(1);
    const claims = await Promise.all([
      markResearchSubmissionStarted(db, input()),
      markResearchSubmissionStarted(db, input()),
    ]);
    expect(claims.filter((result) => result.claimed)).toHaveLength(1);
    const replacement = randomUUID();
    await db.execute(
      'update growth_jobs set lease_token=$2,lease_until=$3 where id=$1',
      [jobId, replacement, new Date(now.getTime() + 180000)]
    );
    expect(
      await markResearchSubmissionStarted(db, {
        ...input(),
        leaseToken: replacement,
        now: new Date(now.getTime() + 100000),
      })
    ).toEqual({ claimed: false });
    expect(getResearchInput({ payload: await payload() })).toEqual(
      results[0].researchInput
    );
  });
  it('rejects stale acknowledgement after lease replacement and preserves exact cleanup identity', async () => {
    await beginResearchAttempt(db, input());
    await markResearchSubmissionStarted(db, input());
    const replacement = randomUUID(),
      runId = randomUUID();
    await db.execute('update growth_jobs set lease_token=$2 where id=$1', [
      jobId,
      replacement,
    ]);
    await expect(
      acknowledgeResearchRun(db, { ...input(), runId })
    ).rejects.toThrow();
    expect((await payload())['research_attempt']).toMatchObject({
      runId: null,
      phase: 'submitting',
    });
    await acknowledgeResearchRun(db, {
      ...input(),
      leaseToken: replacement,
      runId,
    });
    expect(
      (
        await db.execute<{ payload: Record<string, unknown> }>(
          'select payload from growth_jobs where idempotency_key=$1',
          [`research-cleanup:v1:${attemptId}`]
        )
      ).rows[0].payload
    ).toMatchObject({ runId, threadId });
  });
  it('publishes one matching artifact idempotently and rejects conflicting content', async () => {
    const request = await submit();
    const content = {
      profile: { name: 'Example' },
      claims: [
        {
          text: 'Example makes software.',
          citations: [
            { sourceId: 'source-1', quote: 'Example makes software.' },
          ],
        },
      ],
      unknowns: ['industry'],
      sources: [],
      execution: {
        attemptId,
        threadId,
        runId: 'opaque-run',
        model: 'gpt-4.1-mini',
        generatorVersion: 'v1',
        generationRef: 'integration-v1',
      },
      validation: { status: 'structurally_valid' },
    };
    await publishResearchArtifact(db, { ...request, content });
    await publishResearchArtifact(db, { ...request, content });
    await expect(
      publishResearchArtifact(db, {
        ...request,
        content: { profile: { name: 'Other' } },
      })
    ).rejects.toThrow();
    expect(
      (
        await db.execute('select id from growth_artifacts where job_id=$1', [
          jobId,
        ])
      ).rows
    ).toHaveLength(1);
    const journey = await readContactJourney(db, contactId);
    expect(journey.enrichment?.latest[0]).toMatchObject({
      company_name: 'Example',
      claims: content.claims,
      unknowns: ['industry'],
      execution: content.execution,
      validation_status: 'structurally_valid',
    });
  });
  it('selects the latest company artifact instead of reviving an older legacy personalized draft', async () => {
    const legacyJob = randomUUID(),
      sendJob = randomUUID();
    await db.execute(
      `insert into growth_jobs(id,kind,contact_id,status,available_at,idempotency_key)
      values($1::uuid,'enrich',$3,'completed',$4,$1::text),($2::uuid,'send_step',$3,'pending',$4,$2::text)`,
      [legacyJob, sendJob, contactId, now]
    );
    await db.execute(
      `insert into growth_artifacts(job_id,contact_id,kind,schema_version,content,created_at)
      values($1,$2,'enrichment.v1',1,'{"drafts":{"immediate":{"body":"legacy personalized copy"}}}'::jsonb,$3)`,
      [legacyJob, contactId, new Date(now.getTime() - 86400000)]
    );
    expect(
      (await readLifecycleJobContext(db, { jobId: sendJob })).enrichmentArtifact
        ?.kind
    ).toBe('enrichment.v1');
    const request = await submit();
    await publishResearchArtifact(db, {
      ...request,
      content: { profile: { name: 'Example' } },
    });
    expect(
      (await readLifecycleJobContext(db, { jobId: sendJob })).enrichmentArtifact
        ?.kind
    ).toBe('company_enrichment.v1');
  });
  it('blocks late publication after stop, scrubs pending evidence and still leases cleanup', async () => {
    const request = await submit();
    await stop();
    await expect(
      publishResearchArtifact(db, { ...request, content: {} })
    ).rejects.toThrow();
    expect(await payload()).not.toHaveProperty('research_input');
    await assertCleanupLeasable();
  });
  it('blocks changed company evidence and expired lease publication', async () => {
    const request = await submit();
    await db.execute(
      "update growth_contacts set company_domain='changed.invalid' where id=$1",
      [contactId]
    );
    await expect(
      publishResearchArtifact(db, { ...request, content: {} })
    ).rejects.toThrow();
    await db.execute(
      "update growth_contacts set company_domain='example.invalid' where id=$1",
      [contactId]
    );
    await expect(
      publishResearchArtifact(db, {
        ...request,
        now: new Date(now.getTime() + 60001),
        content: {},
      })
    ).rejects.toThrow();
  });
  it('deletes retained snapshots and artifacts while independent cleanup survives contact deletion', async () => {
    const request = await submit();
    await publishResearchArtifact(db, {
      ...request,
      content: { profile: { name: 'Example' } },
    });
    await db.execute(
      "update growth_jobs set status='completed',lease_token=null,lease_until=null where id=$1",
      [jobId]
    );
    await deleteContact(db, {
      contactId,
      eventKey: randomUUID(),
      occurredAt: now,
      actor: 'integration-test',
      source: 'integration-test',
      policyVersion: 'test:v1',
    });
    expect(await payload()).toEqual({});
    expect(
      (
        await db.execute('select id from growth_artifacts where job_id=$1', [
          jobId,
        ])
      ).rows
    ).toHaveLength(0);
    await assertCleanupLeasable();
  });
  it('redacts install/runtime evidence, rejects late publication and retains independent cleanup', async () => {
    const token = randomUUID();
    const install = evidenceFixture(now);
    install.events[0].identity = { gitEmail: `${contactId}@example.invalid` };
    install.events[0].installationToken = token;
    install.events[0].properties.environment = 'unknown';
    install.events[0].properties.environmentEvidence = 'unknown';
    const runtimeEvent = randomUUID(),
      runtimeSubject = randomUUID();
    subjects.push(install.events[0].subject.id, runtimeSubject);
    await acceptObservationBatch(db, 'install', install, {
      now,
      keyring: evidenceKeys,
    });
    await acceptObservationBatch(
      db,
      'runtime',
      {
        schemaVersion: 1,
        events: [
          {
            eventId: runtimeEvent,
            sessionId: randomUUID(),
            kind: 'runtime.session_started',
            occurredAt: now.toISOString(),
            collectorVersion: '1',
            subject: {
              id: runtimeSubject,
              namespace: 'development_browser',
              scope: 'memory',
            },
            installationToken: token,
            properties: {
              packageName: '@threadplane/chat',
              packageVersion: '1',
              integration: 'langgraph',
            },
          },
        ],
      },
      { now }
    );
    const installRow = (
      await db.execute<{ id: string }>(
        'select id from growth_observations where event_id=$1',
        [install.events[0].eventId]
      )
    ).rows[0];
    const runtimeRow = (
      await db.execute<{ id: string; subject_id: string }>(
        'select id,subject_id from growth_observations where event_id=$1',
        [runtimeEvent]
      )
    ).rows[0];
    await db.execute(
      "insert into growth_install_runtime_links(runtime_observation_id,install_observation_id,contact_id,outcome,evaluated_at) values($1,$2,$3,'approved',$4)",
      [runtimeRow.id, installRow.id, contactId, now]
    );
    await db.execute(
      "update growth_jobs set payload=jsonb_build_object('source','install_runtime','install_observation_id',$2::text,'runtime_observation_id',$3::text) where id=$1",
      [jobId, installRow.id, runtimeRow.id]
    );
    const request = await submit();
    const operationId = randomUUID();
    operations.push(operationId);
    await redactObservationEvidence(
      db,
      { subjectId: runtimeRow.subject_id },
      { operationId, now, keyring: evidenceKeys }
    );
    await expect(
      publishResearchArtifact(db, { ...request, content: {} })
    ).rejects.toThrow();
    expect(await payload()).toEqual({
      source: 'install_runtime',
      evidence_redacted: true,
    });
    await assertCleanupLeasable();
  });
});
