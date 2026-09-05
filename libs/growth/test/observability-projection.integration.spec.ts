import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../src/lib/database.ts';
import { acceptObservationBatch } from '../src/lib/observability/ingest.ts';
import {
  leaseObservationWork,
  projectObservation,
  processObservations,
} from '../src/lib/observability/projection.ts';
import { replayObservations } from '../src/lib/observability/replay.ts';
import {
  cleanEvidence,
  evidenceDatabase,
  evidenceFixture,
  evidenceKeys,
} from './observability-fixtures.ts';

describe('projection ownership', () => {
  let db: SqlExecutor;
  const subjects: string[] = [];
  const operations: string[] = [];
  beforeAll(async () => {
    db = await evidenceDatabase();
  });
  afterAll(async () => {
    await cleanEvidence(db, subjects, operations);
    await db.close?.();
  });
  it('processes concurrently without duplicate facts or duplicate settlements', async () => {
    const now = new Date(),
      a = evidenceFixture(now),
      b = evidenceFixture(now);
    subjects.push(a.events[0].subject.id, b.events[0].subject.id);
    for (const batch of [a, b])
      await acceptObservationBatch(db, 'install', batch, {
        now,
        keyring: evidenceKeys,
      });
    const results = await Promise.all(
      [1, 2].map(() =>
        processObservations(db, { enabled: true, limit: 1, now: () => now })
      )
    );
    expect(results.reduce((total, result) => total + result.completed, 0)).toBe(
      2
    );
    const rows = await db.execute(
      'select f.observation_id from growth_observation_facts f join growth_observations o on o.id=f.observation_id where o.event_id=any($1::uuid[])',
      [[a.events[0].eventId, b.events[0].eventId]]
    );
    expect(rows.rows).toHaveLength(2);
  });
  it('reports exhausted crashed leases even when no further work can be claimed', async () => {
    const now = new Date(),
      batch = evidenceFixture(now);
    subjects.push(batch.events[0].subject.id);
    await acceptObservationBatch(db, 'install', batch, {
      now,
      keyring: evidenceKeys,
    });
    const id = (
      await db.execute<{ id: string }>(
        'select id from growth_observations where event_id=$1',
        [batch.events[0].eventId]
      )
    ).rows[0].id;
    await db.execute(
      "update growth_observation_work set status='leased',attempts=5,lease_token=$2,lease_until=$3 where observation_id=$1",
      [id, randomUUID(), now]
    );
    expect(
      await processObservations(db, {
        enabled: true,
        limit: 20,
        now: () => now,
      })
    ).toMatchObject({ failed: 1, retryScheduled: 0 });
    expect(
      (
        await db.execute(
          'select status,last_error_code from growth_observation_work where observation_id=$1',
          [id]
        )
      ).rows[0]
    ).toEqual({ status: 'failed', last_error_code: 'attempts_exhausted' });
  });
  it('recovers expired leases and rolls back facts if time expires during settlement', async () => {
    const now = new Date();
    const batch = evidenceFixture(now);
    subjects.push(batch.events[0].subject.id);
    await acceptObservationBatch(db, 'install', batch, {
      now,
      keyring: evidenceKeys,
    });
    const id = (
      await db.execute<{ id: string }>(
        'select id from growth_observations where event_id=$1',
        [batch.events[0].eventId]
      )
    ).rows[0].id;
    const lease = (await leaseObservationWork(db, { now, limit: 20 })).find(
      (l) => l.observationId === id
    )!;
    let calls = 0;
    expect(
      await projectObservation(db, lease, {
        now: () => (++calls < 3 ? now : new Date(now.getTime() + 31000)),
      })
    ).toBe('lease_lost');
    expect(
      (
        await db.execute(
          'select observation_id from growth_observation_facts where observation_id=$1',
          [id]
        )
      ).rows
    ).toHaveLength(0);
    const later = new Date(now.getTime() + 31000);
    const replacement = (
      await leaseObservationWork(db, { now: later, limit: 20 })
    ).find((l) => l.observationId === id)!;
    expect(replacement.leaseToken).not.toBe(lease.leaseToken);
    expect(await projectObservation(db, lease, { now: () => later })).toBe(
      'lease_lost'
    );
    expect(
      await projectObservation(db, replacement, { now: () => later })
    ).toBe('completed');
  });
  it('isolates a projection failure, schedules a retry, then exhausts attempts', async () => {
    const now = new Date();
    const bad = evidenceFixture(now),
      good = evidenceFixture(now);
    subjects.push(bad.events[0].subject.id, good.events[0].subject.id);
    for (const batch of [bad, good])
      await acceptObservationBatch(db, 'install', batch, {
        now,
        keyring: evidenceKeys,
      });
    const id = (
      await db.execute<{ id: string }>(
        'select id from growth_observations where event_id=$1',
        [bad.events[0].eventId]
      )
    ).rows[0].id;
    const failing: SqlExecutor = {
      execute: db.execute.bind(db),
      transaction: (operation) =>
        db.transaction((tx) =>
          operation({
            execute: (sql, params) => {
              if (
                sql.includes('insert into growth_observation_facts') &&
                params?.[0] === id
              )
                throw new Error('synthetic storage failure');
              return tx.execute(sql, params);
            },
          })
        ),
    };
    const result = await processObservations(failing, {
      enabled: true,
      limit: 20,
      now: () => now,
    });
    expect(result).toMatchObject({ retryScheduled: 1, failed: 0 });
    const retry = (
      await db.execute<{ status: string; available_at: Date }>(
        'select status,available_at from growth_observation_work where observation_id=$1',
        [id]
      )
    ).rows[0];
    expect(retry.status).toBe('pending');
    expect(new Date(retry.available_at).getTime()).toBe(now.getTime() + 60000);
    await db.execute(
      'update growth_observation_work set attempts=4 where observation_id=$1',
      [id]
    );
    expect(
      await processObservations(failing, {
        enabled: true,
        limit: 20,
        now: () => new Date(now.getTime() + 60000),
      })
    ).toMatchObject({ failed: 1, retryScheduled: 0 });
    expect(
      (
        await db.execute(
          'select status from growth_observation_work where observation_id=$1',
          [id]
        )
      ).rows[0].status
    ).toBe('failed');
  });
  it('fences an old worker after replay and rebuilds one fact', async () => {
    const now = new Date();
    const batch = evidenceFixture(now);
    subjects.push(batch.events[0].subject.id);
    await acceptObservationBatch(db, 'install', batch, {
      now,
      keyring: evidenceKeys,
    });
    const observation = (
      await db.execute<{ id: string; subject_id: string }>(
        'select id, subject_id from growth_observations where event_id=$1',
        [batch.events[0].eventId]
      )
    ).rows[0];
    const leases = await leaseObservationWork(db, { now, limit: 20 });
    const lease = leases.find((l) => l.observationId === observation.id)!;
    expect(lease).toBeDefined();
    const operationId = randomUUID();
    operations.push(operationId);
    await replayObservations(
      db,
      { operationId, subjectId: observation.subject_id, maxEvents: 10 },
      now
    );
    expect(await projectObservation(db, lease, { now: () => now })).toBe(
      'lease_lost'
    );
    const fresh = (await leaseObservationWork(db, { now, limit: 20 })).find(
      (l) => l.observationId === observation.id
    )!;
    expect(await projectObservation(db, fresh, { now: () => now })).toBe(
      'completed'
    );
    await replayObservations(
      db,
      { operationId, subjectId: observation.subject_id, maxEvents: 10 },
      now
    );
    expect(
      (
        await db.execute(
          'select * from growth_observation_facts where observation_id=$1',
          [observation.id]
        )
      ).rows
    ).toHaveLength(1);
  });
});
