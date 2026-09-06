import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../src/lib/database.ts';
import {
  enqueueInstallRuntimeEnrichment,
  readInstallRuntimeEnrichmentContext,
} from '../src/lib/observability/install-runtime-enrichment.ts';
import { acceptObservationBatch } from '../src/lib/observability/ingest.ts';
import { privacyLock } from '../src/lib/observability/store.ts';
import { persistJobArtifact } from '../src/lib/jobs.ts';
import { redactObservationEvidence } from '../src/lib/observability/redaction.ts';
import { stopContact } from '../src/lib/stops.ts';
import { createEmailLookupHmac } from '../src/lib/crypto.ts';
import {
  cleanEvidence,
  evidenceDatabase,
  evidenceFixture,
  evidenceKeys,
} from './observability-fixtures.ts';

describe('install/runtime enrichment SQL authorization', () => {
  let db: SqlExecutor;
  let contactId: string, leaseToken: string, token: string;
  let subjects: string[], operations: string[];
  const now = new Date();
  let installObservationId: string,
    runtimeObservationId: string,
    email: string,
    jobId: string;
  beforeEach(async () => {
    contactId = randomUUID();
    leaseToken = randomUUID();
    token = randomUUID();
    subjects = [];
    operations = [];
    db = await evidenceDatabase();
    const install = evidenceFixture(now);
    const fixtureEmail = install.events[0].identity?.gitEmail;
    if (!fixtureEmail) throw new Error('fixture_email_required');
    email = fixtureEmail;
    install.events[0].installationToken = token;
    install.events[0].properties.environment = 'unknown';
    install.events[0].properties.environmentEvidence = 'unknown';
    const runtimeSubject = randomUUID();
    const runtimeEvent = randomUUID();
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
    installObservationId = (
      await db.execute<{ id: string }>(
        'select id from growth_observations where event_id=$1',
        [install.events[0].eventId]
      )
    ).rows[0].id;
    runtimeObservationId = (
      await db.execute<{ id: string }>(
        'select id from growth_observations where event_id=$1',
        [runtimeEvent]
      )
    ).rows[0].id;
    await db.execute(
      `insert into growth_contacts(id,email_normalized,email_lookup_hmac,email_hmac_key_version,source,outreach_approved_at) values($1,$2,$3,777,'install_runtime',$4)`,
      [contactId, email, randomUUID(), now]
    );
    await db.execute(
      `insert into growth_install_runtime_links(runtime_observation_id,install_observation_id,contact_id,outcome,evaluated_at) values($1,$2,$3,'approved',$4)`,
      [runtimeObservationId, installObservationId, contactId, now]
    );
    await enqueue();
    jobId = (
      await db.execute<{ id: string }>(
        'select id from growth_jobs where contact_id=$1',
        [contactId]
      )
    ).rows[0].id;
    await db.execute(
      `update growth_jobs set status='leased',lease_token=$2,lease_until=$3 where id=$1`,
      [jobId, leaseToken, new Date(now.getTime() + 60_000)]
    );
  });
  afterEach(async () => {
    if (!db) return;
    await db.execute(
      "delete from growth_observation_redactions where selector_kind='email' and selector_key=$1 and key_version=$2",
      [
        createEmailLookupHmac(email, evidenceKeys.active).digest,
        evidenceKeys.active.version,
      ]
    );
    await db.execute('delete from growth_artifacts where contact_id=$1', [
      contactId,
    ]);
    await cleanEvidence(db, subjects, operations);
    await db.execute('delete from growth_jobs where contact_id=$1', [
      contactId,
    ]);
    await db.execute('delete from growth_activity where contact_id=$1', [
      contactId,
    ]);
    await db.execute('delete from growth_contacts where id=$1', [contactId]);
    await db.close?.();
  });
  async function enqueue() {
    await db.transaction(async (tx) => {
      await privacyLock(tx);
      await enqueueInstallRuntimeEnrichment(tx, {
        contactId,
        installObservationId,
        runtimeObservationId,
        email,
        now,
      });
    });
  }
  async function context() {
    return readInstallRuntimeEnrichmentContext(db, { jobId, leaseToken, now });
  }
  it('serializes admitted evidence writes through the final artifact insertion', async () => {
    let authorized!: () => void;
    let resume!: () => void;
    const atAuthorization = new Promise<void>((resolve) => {
      authorized = resolve;
    });
    const resumed = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const pausedDb: SqlExecutor = {
      execute: db.execute,
      transaction: (operation) =>
        db.transaction((tx) =>
          operation({
            async execute<Row extends Record<string, unknown>>(
              sql: string,
              parameters?: readonly unknown[]
            ) {
              const result = await tx.execute<Row>(sql, parameters);
              if (sql.includes('growth:authorize-install-runtime-artifact')) {
                authorized();
                await resumed;
              }
              return result;
            },
          })
        ),
    };
    const writing = persistJobArtifact(pausedDb, {
      jobId,
      leaseToken,
      now,
      kind: 'enrichment.v1',
      schemaVersion: 1,
      content: { summary: 'Concurrent persistence' },
    });
    const ingestionCanLock = () =>
      db.transaction(
        async (tx) =>
          (
            await tx.execute<{ acquired: boolean }>(
              "select pg_try_advisory_xact_lock_shared(hashtextextended('growth-observation-privacy-v1',0)) as acquired"
            )
          ).rows[0].acquired
      );
    try {
      await Promise.race([
        atAuthorization,
        writing.then(() => {
          throw new Error('authorization_pause_not_reached');
        }),
      ]);
      // Ingest uses this shared lock before admitting conflicting identities.
      expect(await ingestionCanLock()).toBe(false);
    } finally {
      resume();
      await writing;
    }
    expect(await ingestionCanLock()).toBe(true);
  });
  async function persist() {
    return persistJobArtifact(db, {
      jobId,
      leaseToken,
      now,
      kind: 'enrichment.v1',
      schemaVersion: 1,
      content: { summary: 'Synthetic company research' },
    });
  }
  async function redactRuntime() {
    const subjectId = (
      await db.execute<{ subject_id: string }>(
        'select subject_id from growth_observations where id=$1',
        [runtimeObservationId]
      )
    ).rows[0].subject_id;
    const operationId = randomUUID();
    operations.push(operationId);
    await redactObservationEvidence(
      db,
      { subjectId },
      { operationId, now, keyring: evidenceKeys }
    );
  }
  it('rejects artifact persistence after a linked observation is redacted', async () => {
    await redactRuntime();
    await expect(persist()).rejects.toThrow();
    await expect(
      persistJobArtifact(db, {
        jobId,
        kind: 'enrichment.v1',
        schemaVersion: 1,
        content: { summary: 'Late unbound writer' },
      })
    ).rejects.toThrow();
    expect(
      (
        await db.execute(
          'select id from growth_artifacts where contact_id=$1',
          [contactId]
        )
      ).rows
    ).toHaveLength(0);
  });
  it('rejects artifact persistence by a worker leased before an authoritative stop', async () => {
    await stopContact(db, {
      contactId,
      reason: 'unsubscribe',
      eventKey: randomUUID(),
      occurredAt: now,
      source: 'integration-test',
      provenance: { kind: 'one_click', policyVersion: 'test:v1' },
    });
    await expect(persist()).rejects.toThrow();
    expect(
      (
        await db.execute(
          'select id from growth_artifacts where contact_id=$1',
          [contactId]
        )
      ).rows
    ).toHaveLength(0);
  });
  it('redaction removes completed research, scrubs provenance payloads and cancels a leased worker', async () => {
    await persist();
    await db.execute(
      `update growth_jobs set status='completed',lease_token=null,lease_until=null where id=$1`,
      [jobId]
    );
    const leasedJobId = randomUUID();
    await db.execute(
      `insert into growth_jobs(id,kind,contact_id,status,available_at,idempotency_key,payload,lease_token,lease_until)
      select $2::uuid,kind,contact_id,'leased',available_at,$2::text,payload,$3::uuid,$4::timestamptz from growth_jobs where id=$1`,
      [jobId, leasedJobId, leaseToken, new Date(now.getTime() + 60_000)]
    );
    await redactRuntime();
    expect(
      (
        await db.execute(
          'select id from growth_artifacts where contact_id=$1',
          [contactId]
        )
      ).rows
    ).toHaveLength(0);
    const jobs = (
      await db.execute<{
        id: string;
        status: string;
        payload: unknown;
        lease_token: string | null;
      }>(
        'select id,status,payload,lease_token from growth_jobs where contact_id=$1',
        [contactId]
      )
    ).rows;
    expect(jobs.find((job) => job.id === jobId)).toMatchObject({
      status: 'completed',
      payload: { source: 'install_runtime', evidence_redacted: true },
    });
    expect(jobs.find((job) => job.id === leasedJobId)).toMatchObject({
      status: 'cancelled',
      payload: { source: 'install_runtime', evidence_redacted: true },
      lease_token: null,
    });
  });
  it('redacting another package version on the same token scrubs completed research', async () => {
    await persist();
    await db.execute(
      "update growth_jobs set status='completed',lease_token=null,lease_until=null where id=$1",
      [jobId]
    );
    const other = evidenceFixture(now);
    other.events[0].installationToken = token;
    other.events[0].properties.packageVersion = '2';
    other.events[0].identity = { gitEmail: email };
    subjects.push(other.events[0].subject.id);
    await acceptObservationBatch(db, 'install', other, {
      now,
      keyring: evidenceKeys,
    });
    const subjectId = (
      await db.execute<{ subject_id: string }>(
        'select subject_id from growth_observations where event_id=$1',
        [other.events[0].eventId]
      )
    ).rows[0].subject_id;
    const operationId = randomUUID();
    operations.push(operationId);
    await redactObservationEvidence(
      db,
      { subjectId },
      { operationId, now, keyring: evidenceKeys }
    );
    expect(
      (
        await db.execute(
          'select id from growth_artifacts where contact_id=$1',
          [contactId]
        )
      ).rows
    ).toHaveLength(0);
    expect(
      (
        await db.execute<{ payload: unknown }>(
          'select payload from growth_jobs where id=$1',
          [jobId]
        )
      ).rows[0].payload
    ).toEqual({ source: 'install_runtime', evidence_redacted: true });
  });
  it('enqueues once with no form/enrollment and blocks stale leases, stops, CI and redacted evidence', async () => {
    await enqueue();
    await enqueue();
    const jobs = (
      await db.execute<{ id: string; payload: unknown }>(
        'select id,payload from growth_jobs where contact_id=$1',
        [contactId]
      )
    ).rows;
    expect(jobs).toHaveLength(1);
    jobId = jobs[0].id;
    expect(jobs[0].payload).toEqual({
      source: 'install_runtime',
      install_observation_id: installObservationId,
      runtime_observation_id: runtimeObservationId,
    });
    await db.execute(
      `update growth_jobs set status='leased',lease_token=$2,lease_until=$3 where id=$1`,
      [jobId, leaseToken, new Date(now.getTime() + 60_000)]
    );
    expect(await context()).toEqual({ companyDomain: 'example.invalid' });
    expect(
      await readInstallRuntimeEnrichmentContext(db, {
        jobId,
        leaseToken: randomUUID(),
        now,
      })
    ).toBeNull();
    expect(
      await readInstallRuntimeEnrichmentContext(db, {
        jobId,
        leaseToken,
        now: new Date(now.getTime() + 60_000),
      })
    ).toBeNull();
    await db.execute(
      `insert into growth_activity(event_key,contact_id,kind,occurred_at) values($1,$2,'unsubscribe',$3)`,
      [randomUUID(), contactId, now]
    );
    expect(await context()).toBeNull();
    await db.execute('delete from growth_activity where contact_id=$1', [
      contactId,
    ]);
    await db.execute(
      `update growth_observations set properties=jsonb_set(properties,'{environment}','"ci"') where id=$1`,
      [installObservationId]
    );
    expect(await context()).toBeNull();
    await db.execute(
      `update growth_observations set properties=jsonb_set(properties,'{environment}','"unknown"') where id=$1`,
      [installObservationId]
    );
    await db.execute(
      'update growth_observations set redacted_at=$2 where id=$1',
      [runtimeObservationId, now]
    );
    expect(await context()).toBeNull();
    await db.execute(
      'update growth_observations set redacted_at=null where id=$1',
      [runtimeObservationId]
    );
    expect(await context()).not.toBeNull();
    await db.execute('update growth_contacts set deleted_at=$2 where id=$1', [
      contactId,
      now,
    ]);
    expect(await context()).toBeNull();
    await db.execute('update growth_contacts set deleted_at=null where id=$1', [
      contactId,
    ]);
  });
  it('rejects a conflicting email on the same token even across package versions', async () => {
    const conflict = evidenceFixture(now);
    conflict.events[0].installationToken = token;
    conflict.events[0].properties.packageVersion = '2';
    subjects.push(conflict.events[0].subject.id);
    await acceptObservationBatch(db, 'install', conflict, {
      now,
      keyring: evidenceKeys,
    });
    expect(await context()).toBeNull();
    await db.execute('delete from growth_jobs where contact_id=$1', [
      contactId,
    ]);
    await enqueue();
    expect(
      (
        await db.execute('select id from growth_jobs where contact_id=$1', [
          contactId,
        ])
      ).rows
    ).toHaveLength(0);
  });
});
