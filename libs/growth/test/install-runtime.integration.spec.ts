import { randomUUID } from 'node:crypto';
import { acceptObservationBatch } from '../src/lib/observability/ingest.ts';
import { processInstallRuntimeActivations } from '../src/lib/observability/install-runtime.ts';
import {
  materializeCampaignEnrollment,
  leaseDueJobs,
  readLifecycleJobContext,
  authorizeLeasedJobForSubmission,
} from '../src/lib/jobs.ts';
import {
  evidenceDatabase,
  evidenceFixture,
  evidenceKeys,
} from './observability-fixtures.ts';
import type { SqlExecutor } from '../src/lib/database.ts';
import { redactObservationEvidence } from '../src/lib/observability/redaction.ts';
import { createEmailLookupHmac } from '../src/lib/crypto.ts';
import { readObservationHealth } from '../src/lib/observability/queries.ts';
import { privacyLock } from '../src/lib/observability/store.ts';

describe('install-runtime founder activation', () => {
  let db: SqlExecutor;
  const subjects: string[] = [],
    emails: string[] = [],
    operations: string[] = [];
  beforeAll(async () => {
    db = await evidenceDatabase();
  });
  afterAll(async () => {
    if (!db) return;
    const digests = emails.map(
      (email) => createEmailLookupHmac(email, evidenceKeys.active).digest
    );
    const contacts = (
      await db.execute<{ id: string }>(
        'select id from growth_contacts where email_lookup_hmac=any($1::text[])',
        [digests]
      )
    ).rows.map((c) => c.id);
    await db.execute(
      'delete from growth_observation_subjects where external_id=any($1::uuid[])',
      [subjects]
    );
    await db.execute(
      'delete from growth_observation_redactions where selector_key=any($1::text[])',
      [digests]
    );
    await db.execute(
      'delete from growth_observation_operations where operation_id=any($1::uuid[])',
      [operations]
    );
    await db.execute(
      'delete from growth_activity where contact_id=any($1::uuid[])',
      [contacts]
    );
    await db.execute(
      'delete from growth_jobs where contact_id=any($1::uuid[])',
      [contacts]
    );
    await db.execute('delete from growth_contacts where id=any($1::uuid[])', [
      contacts,
    ]);
    await db.execute(
      "delete from growth_activity where event_key='campaign:v1:configuration' and data->>'enrollment_start_at'=$1",
      ['2026-01-01T00:00:00+00:00']
    );
    await db.close?.();
  });
  function fixture(now: Date, token = randomUUID()) {
    const install = evidenceFixture(now);
    install.events[0].installationToken = token;
    install.events[0].properties = {
      ...install.events[0].properties,
      packageName: '@threadplane/langgraph',
      packageVersion: '0.0.65',
      environment: 'unknown',
      environmentEvidence: 'unknown',
    };
    const runtime = {
      schemaVersion: 1,
      events: [
        {
          eventId: randomUUID(),
          kind: 'runtime.session_started',
          occurredAt: now.toISOString(),
          collectorVersion: '1',
          subject: {
            id: randomUUID(),
            namespace: 'development_browser',
            scope: 'persistent',
          },
          sessionId: randomUUID(),
          installationToken: token,
          properties: {
            integration: 'langgraph',
            packageName: '@threadplane/langgraph',
            packageVersion: '0.0.65',
          },
        },
      ],
    };
    subjects.push(install.events[0].subject.id, runtime.events[0].subject.id);
    emails.push(install.events[0].identity!.gitEmail!);
    return { install, runtime };
  }
  it('resolves a runtime that arrived before install and enrolls once without enrichment', async () => {
    const now = new Date();
    const { install, runtime } = fixture(now);
    await acceptObservationBatch(db, 'runtime', runtime, {
      now,
      keyring: evidenceKeys,
    });
    expect(
      (
        await processInstallRuntimeActivations(db, {
          enabled: true,
          limit: 20,
          now,
          keyring: evidenceKeys,
        })
      ).approved
    ).toBe(0);
    await acceptObservationBatch(db, 'install', install, {
      now,
      keyring: evidenceKeys,
    });
    expect(
      (
        await processInstallRuntimeActivations(db, {
          enabled: true,
          limit: 20,
          now,
          keyring: evidenceKeys,
        })
      ).approved
    ).toBe(1);
    expect(
      (
        await processInstallRuntimeActivations(db, {
          enabled: true,
          limit: 20,
          now,
          keyring: evidenceKeys,
        })
      ).approved
    ).toBe(0);
    const contact = (
      await db.execute<{ id: string }>(
        'select id from growth_contacts where email_normalized=$1',
        [install.events[0].identity!.gitEmail]
      )
    ).rows[0];
    const start = new Date('2026-01-01T00:00:00Z');
    await materializeCampaignEnrollment(db, {
      enrollmentEnabled: true,
      enrollmentStartAt: start,
      now,
      batchSize: 20,
    });
    const jobs = await db.execute<{ id: string }>(
      "select id from growth_jobs where contact_id=$1 order by payload->>'step'",
      [contact.id]
    );
    expect(jobs.rows).toHaveLength(3);
    expect(
      await readLifecycleJobContext(db, { jobId: jobs.rows[0].id })
    ).toMatchObject({ campaignEnrollmentReason: 'install_runtime' });
    const leased = await leaseDueJobs(db, {
      kinds: ['send_step'],
      now,
      batchSize: 20,
      leaseDurationMs: 30000,
      campaignEnabled: true,
    });
    expect(leased.some((j) => j.id === jobs.rows[0].id)).toBe(true);
    const job = leased.find((j) => j.id === jobs.rows[0].id)!;
    const operationId = randomUUID();
    operations.push(operationId);
    await redactObservationEvidence(
      db,
      { email: install.events[0].identity!.gitEmail! },
      { operationId, now, keyring: evidenceKeys }
    );
    expect(
      await authorizeLeasedJobForSubmission(db, {
        jobId: job.id,
        leaseToken: job.leaseToken!,
        now,
        campaignEnabled: true,
        deliveryEnabled: true,
      })
    ).toMatchObject({ authorized: false });
  });
  it.each(['ci', 'noreply', 'conflicting', 'package_mismatch'])(
    'does not approve %s evidence',
    async (reason) => {
      const now = new Date();
      const { install, runtime } = fixture(now);
      if (reason === 'ci') {
        install.events[0].properties.environment = 'ci';
        install.events[0].properties.environmentEvidence = 'generic_ci';
      }
      if (reason === 'noreply')
        install.events[0].identity!.gitEmail = 'noreply@example.invalid';
      if (reason === 'package_mismatch')
        runtime.events[0].properties.packageVersion = '0.0.66';
      await acceptObservationBatch(db, 'install', install, {
        now,
        keyring: evidenceKeys,
      });
      if (reason === 'conflicting') {
        const other = fixture(now, install.events[0].installationToken).install;
        await acceptObservationBatch(db, 'install', other, {
          now,
          keyring: evidenceKeys,
        });
      }
      await acceptObservationBatch(db, 'runtime', runtime, {
        now,
        keyring: evidenceKeys,
      });
      expect(
        (
          await processInstallRuntimeActivations(db, {
            enabled: true,
            limit: 20,
            now,
            keyring: evidenceKeys,
          })
        ).approved
      ).toBe(0);
    }
  );
  it('deduplicates concurrent ticks and additional browsers for the same recipient', async () => {
    const now = new Date();
    const { install, runtime } = fixture(now);
    await acceptObservationBatch(db, 'install', install, {
      now,
      keyring: evidenceKeys,
    });
    await acceptObservationBatch(db, 'runtime', runtime, {
      now,
      keyring: evidenceKeys,
    });
    const results = await Promise.all(
      [1, 2].map(() =>
        processInstallRuntimeActivations(db, {
          enabled: true,
          limit: 20,
          now,
          keyring: evidenceKeys,
        })
      )
    );
    expect(results.reduce((sum, r) => sum + r.approved, 0)).toBe(1);
    const again = {
      ...runtime,
      events: [
        {
          ...runtime.events[0],
          eventId: randomUUID(),
          sessionId: randomUUID(),
        },
      ],
    };
    await acceptObservationBatch(db, 'runtime', again, {
      now,
      keyring: evidenceKeys,
    });
    await processInstallRuntimeActivations(db, {
      enabled: true,
      limit: 20,
      now,
      keyring: evidenceKeys,
    });
    const activities = await db.execute(
      "select a.id from growth_activity a join growth_contacts c on c.id=a.contact_id where c.email_normalized=$1 and a.kind='install_runtime.outreach_approved'",
      [install.events[0].identity!.gitEmail]
    );
    expect(activities.rows).toHaveLength(1);
    const health = await readObservationHealth(db, {
      from: new Date(now.getTime() - 1000),
      to: new Date(now.getTime() + 1000),
    });
    expect(health).toHaveProperty('installRuntimeActivation');
    expect(JSON.stringify(health)).not.toContain(
      install.events[0].installationToken
    );
    expect(JSON.stringify(health)).not.toContain(
      install.events[0].identity!.gitEmail
    );
  });
  it('keeps a wrong-package match pending for a later compatible install', async () => {
    const now = new Date();
    const { install, runtime } = fixture(now);
    const wrong = {
      ...install,
      events: [
        {
          ...install.events[0],
          eventId: randomUUID(),
          properties: {
            ...install.events[0].properties,
            packageVersion: '0.0.64',
          },
        },
      ],
    };
    await acceptObservationBatch(db, 'install', wrong, {
      now,
      keyring: evidenceKeys,
    });
    await acceptObservationBatch(db, 'runtime', runtime, {
      now,
      keyring: evidenceKeys,
    });
    expect(
      (
        await processInstallRuntimeActivations(db, {
          enabled: true,
          limit: 20,
          now,
          keyring: evidenceKeys,
        })
      ).approved
    ).toBe(0);
    await acceptObservationBatch(db, 'install', install, {
      now,
      keyring: evidenceKeys,
    });
    expect(
      (
        await processInstallRuntimeActivations(db, {
          enabled: true,
          limit: 20,
          now,
          keyring: evidenceKeys,
        })
      ).approved
    ).toBe(1);
  });
  it('does not revive approval by deleting conflicting source identity', async () => {
    const now = new Date();
    const { install, runtime } = fixture(now);
    await acceptObservationBatch(db, 'install', install, {
      now,
      keyring: evidenceKeys,
    });
    await acceptObservationBatch(db, 'runtime', runtime, {
      now,
      keyring: evidenceKeys,
    });
    await processInstallRuntimeActivations(db, {
      enabled: true,
      limit: 20,
      now,
      keyring: evidenceKeys,
    });
    const other = fixture(now, install.events[0].installationToken).install;
    await acceptObservationBatch(db, 'install', other, {
      now,
      keyring: evidenceKeys,
    });
    const operationId = randomUUID();
    operations.push(operationId);
    await redactObservationEvidence(
      db,
      { email: other.events[0].identity!.gitEmail! },
      { operationId, now, keyring: evidenceKeys }
    );
    const result = await materializeCampaignEnrollment(db, {
      enrollmentEnabled: true,
      enrollmentStartAt: new Date('2026-01-01T00:00:00Z'),
      now,
      batchSize: 100,
    });
    const contact = (
      await db.execute<{ id: string }>(
        'select id from growth_contacts where email_normalized=$1',
        [install.events[0].identity!.gitEmail]
      )
    ).rows[0];
    expect(result.enrolledContactIds).not.toContain(contact.id);
  });
  it('waits for a source-redaction transaction before final send authorization', async () => {
    const now = new Date();
    const { install, runtime } = fixture(now);
    await acceptObservationBatch(db, 'install', install, {
      now,
      keyring: evidenceKeys,
    });
    await acceptObservationBatch(db, 'runtime', runtime, {
      now,
      keyring: evidenceKeys,
    });
    await processInstallRuntimeActivations(db, {
      enabled: true,
      limit: 20,
      now,
      keyring: evidenceKeys,
    });
    await materializeCampaignEnrollment(db, {
      enrollmentEnabled: true,
      enrollmentStartAt: new Date('2026-01-01T00:00:00Z'),
      now,
      batchSize: 100,
    });
    const contact = (
      await db.execute<{ id: string }>(
        'select id from growth_contacts where email_normalized=$1',
        [install.events[0].identity!.gitEmail]
      )
    ).rows[0];
    const job = (
      await leaseDueJobs(db, {
        kinds: ['send_step'],
        now,
        batchSize: 100,
        leaseDurationMs: 30000,
        campaignEnabled: true,
      })
    ).find((j) => j.contactId === contact.id)!;
    let release!: () => void, acquired!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const locked = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const redaction = db.transaction(async (tx) => {
      await privacyLock(tx, true);
      acquired();
      await gate;
      await tx.execute(
        'update growth_observations set redacted_at=$2 where event_id=$1',
        [install.events[0].eventId, now]
      );
    });
    await locked;
    let settled = false;
    const authorization = authorizeLeasedJobForSubmission(db, {
      jobId: job.id,
      leaseToken: job.leaseToken!,
      now,
      campaignEnabled: true,
      deliveryEnabled: true,
    }).finally(() => {
      settled = true;
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(settled).toBe(false);
    } finally {
      release();
      await redaction;
    }
    expect(await authorization).toMatchObject({ authorized: false });
  });
});
