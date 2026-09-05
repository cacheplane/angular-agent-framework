import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../src/lib/database.ts';
import { createEmailLookupCandidates } from '../src/lib/crypto.ts';
import { acceptObservationBatch } from '../src/lib/observability/ingest.ts';
import { processObservations } from '../src/lib/observability/projection.ts';
import {
  readTimeline,
  readObservationHealth,
  readObservationIdentity,
} from '../src/lib/observability/queries.ts';
import { replayObservations } from '../src/lib/observability/replay.ts';
import { redactObservationEvidence } from '../src/lib/observability/redaction.ts';
import {
  cleanEvidence,
  evidenceDatabase,
  evidenceFixture,
  evidenceKeys,
} from './observability-fixtures.ts';

describe('synthetic evidence journey', () => {
  let db: SqlExecutor;
  const subjects: string[] = [];
  const operations: string[] = [];
  let email = '';
  beforeAll(async () => {
    db = await evidenceDatabase();
  });
  afterAll(async () => {
    await cleanEvidence(db, subjects, operations);
    if (email)
      for (const key of createEmailLookupCandidates(email, evidenceKeys)) {
        await db.execute(
          "delete from growth_observation_redactions where selector_kind='email' and selector_key=$1 and key_version=$2",
          [key.digest, key.keyVersion]
        );
      }
    await db.close?.();
  });
  it('accepts three sources, retries, projects, replays and redacts without enrollment', async () => {
    const now = new Date();
    const before = (
      await db.execute(
        'select (select count(*) from growth_contacts) as contacts,(select count(*) from growth_jobs) as jobs'
      )
    ).rows;
    const install = evidenceFixture(now);
    email = install.events[0].identity!.gitEmail!;
    const website = {
      schemaVersion: 1,
      events: [
        {
          eventId: randomUUID(),
          kind: 'website.session_started',
          occurredAt: now.toISOString(),
          collectorVersion: '1',
          subject: {
            id: randomUUID(),
            namespace: 'website_session',
            scope: 'session',
          },
          properties: {},
        },
      ],
    };
    const runtimeSubject = randomUUID();
    const runtime = {
      schemaVersion: 1,
      events: [
        'runtime.session_started',
        'transport.connected',
        'runtime.first_stream_completed',
        'runtime.first_stream_completed',
      ].map((kind) => ({
        eventId: randomUUID(),
        kind,
        occurredAt: now.toISOString(),
        collectorVersion: '1',
        subject: {
          id: runtimeSubject,
          namespace: 'development_browser',
          scope: 'memory',
        },
        sessionId: randomUUID(),
        properties: {
          packageName: '@threadplane/langgraph',
          packageVersion: '1',
          integration: 'langgraph',
        },
      })),
    };
    subjects.push(
      install.events[0].subject.id,
      website.events[0].subject.id,
      runtimeSubject
    );
    for (const [source, batch] of [
      ['website', website],
      ['install', install],
      ['runtime', runtime],
    ] as const) {
      const accepted = await acceptObservationBatch(db, source, batch, {
        now,
        ...(source === 'install' ? { keyring: evidenceKeys } : {}),
      });
      expect(accepted.events.every((e) => e.disposition === 'accepted')).toBe(
        true
      );
      const retry = await acceptObservationBatch(db, source, batch, {
        now,
        ...(source === 'install' ? { keyring: evidenceKeys } : {}),
      });
      expect(retry.events.every((e) => e.disposition === 'duplicate')).toBe(
        true
      );
    }
    const rows = (
      await db.execute<{ id: string; external_id: string }>(
        'select id,external_id from growth_observation_subjects where external_id=any($1::uuid[])',
        [subjects]
      )
    ).rows;
    const runtimeId = rows.find((r) => r.external_id === runtimeSubject)!.id;
    const installId = rows.find(
      (r) => r.external_id === install.events[0].subject.id
    )!.id;
    expect(
      (await readTimeline(db, runtimeId)).events.every(
        (e) => e.processing_status === 'pending'
      )
    ).toBe(true);
    expect(
      (await processObservations(db, { enabled: false, limit: 100 })).disabled
    ).toBe(true);
    await processObservations(db, {
      enabled: true,
      limit: 100,
      now: () => now,
    });
    const timeline = await readTimeline(db, runtimeId, { limit: 2 });
    expect(timeline.events).toHaveLength(2);
    expect(timeline.nextCursor).toBeTruthy();
    const second = await readTimeline(db, runtimeId, {
      limit: 2,
      cursor: timeline.nextCursor!,
    });
    expect(second.events).toHaveLength(2);
    expect(
      new Set([...timeline.events, ...second.events].map((e) => e.id)).size
    ).toBe(4);
    expect(
      [...timeline.events, ...second.events].every(
        (e) => e.processing_status === 'completed'
      )
    ).toBe(true);
    expect(second.nextCursor).toBeNull();
    expect(
      (
        await db.execute(
          'select active_days,attained_milestone_count from growth_observation_subject_overview_v1 where subject_id=$1',
          [runtimeId]
        )
      ).rows[0]
    ).toEqual({ active_days: '1', attained_milestone_count: '2' });
    const health = await readObservationHealth(db, {
      from: new Date(now.getTime() - 1000),
      to: new Date(now.getTime() + 1000),
    });
    expect(new Set(health.activity.map((row) => row.source))).toEqual(
      new Set(['website', 'install', 'runtime'])
    );
    expect(JSON.stringify(health)).not.toContain(email);
    const operationId = randomUUID();
    operations.push(operationId);
    await expect(
      replayObservations(
        db,
        { subjectId: runtimeId, operationId, maxEvents: 2 },
        now
      )
    ).rejects.toThrow('selection_overflow');
    expect(
      await replayObservations(
        db,
        { subjectId: runtimeId, operationId, maxEvents: 4 },
        now
      )
    ).toEqual({ selectedCount: 4 });
    await expect(
      replayObservations(
        db,
        { subjectId: installId, operationId, maxEvents: 3 },
        now
      )
    ).rejects.toThrow('operation_conflict');
    await processObservations(db, {
      enabled: true,
      limit: 100,
      now: () => now,
    });
    const observation = (await readTimeline(db, installId)).events[0];
    expect(
      (await readObservationIdentity(db, observation.id))?.email_normalized
    ).toBe(email);
    const redactionId = randomUUID();
    operations.push(redactionId);
    expect(
      await redactObservationEvidence(
        db,
        { email },
        { operationId: redactionId, now, keyring: evidenceKeys }
      )
    ).toEqual({ selectedCount: 1 });
    expect(
      await redactObservationEvidence(
        db,
        { email },
        { operationId: redactionId, now, keyring: evidenceKeys }
      )
    ).toEqual({ selectedCount: 1 });
    await processObservations(db, {
      enabled: true,
      limit: 100,
      now: () => now,
    });
    expect(await readObservationIdentity(db, observation.id)).toBeNull();
    expect(JSON.stringify(await readTimeline(db, installId))).not.toContain(
      email
    );
    expect(
      (
        await db.execute(
          'select (select count(*) from growth_contacts) as contacts,(select count(*) from growth_jobs) as jobs'
        )
      ).rows
    ).toEqual(before);
    expect(
      (
        await db.execute(
          'select o.id from growth_observations o join growth_observation_subjects s on s.id=o.subject_id where s.external_id=any($1::uuid[])',
          [subjects]
        )
      ).rows
    ).toHaveLength(6);
  }, 60000);
});
