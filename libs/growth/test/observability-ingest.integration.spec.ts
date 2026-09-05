import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../src/lib/database.ts';
import { acceptObservationBatch } from '../src/lib/observability/ingest.ts';
import {
  cleanEvidence,
  evidenceDatabase,
  evidenceFixture,
  evidenceKeys,
} from './observability-fixtures.ts';

describe('durable observation acceptance', () => {
  it('accepts multi-subject batches in opposing event order without deadlocks', async () => {
    const now = new Date();
    const a = evidenceFixture(now).events[0];
    const b = evidenceFixture(now).events[0];
    subjects.push(a.subject.id, b.subject.id);
    await acceptObservationBatch(
      db,
      'install',
      { schemaVersion: 1, events: [a, b] },
      { now, keyring: evidenceKeys }
    );
    const left = structuredClone([a, b]);
    const right = structuredClone([b, a]);
    left[0].eventId = '00000000-0000-4000-8000-' + randomUUID().slice(-12);
    left[1].eventId = 'ffffffff-ffff-4fff-8fff-' + randomUUID().slice(-12);
    right[0].eventId = '00000000-0000-4000-8000-' + randomUUID().slice(-12);
    right[1].eventId = 'ffffffff-ffff-4fff-8fff-' + randomUUID().slice(-12);
    const result = await Promise.allSettled(
      [left, right].map((events) =>
        acceptObservationBatch(
          db,
          'install',
          { schemaVersion: 1, events },
          { now, keyring: evidenceKeys }
        )
      )
    );
    expect(result.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
  });
  let db: SqlExecutor;
  const subjects: string[] = [];
  beforeAll(async () => {
    db = await evidenceDatabase();
  });
  afterAll(async () => {
    await cleanEvidence(db, subjects);
    await db.close?.();
  });
  it('deduplicates concurrent retries without refreshing subject activity', async () => {
    const now = new Date();
    const batch = evidenceFixture(now);
    subjects.push(batch.events[0].subject.id);
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        acceptObservationBatch(db, 'install', batch, {
          now,
          keyring: evidenceKeys,
        })
      )
    );
    expect(
      results
        .flatMap((r) => r.events)
        .filter((e) => e.disposition === 'accepted')
    ).toHaveLength(1);
    await acceptObservationBatch(db, 'install', batch, {
      now: new Date(now.getTime() + 1000),
      keyring: evidenceKeys,
    });
    const rows = await db.execute<{ total: string; last_received_at: Date }>(
      `select count(o.id)::text as total, s.last_received_at from growth_observation_subjects s join growth_observations o on o.subject_id=s.id where s.external_id=$1 group by s.id`,
      [subjects.at(-1)]
    );
    expect(rows.rows[0].total).toBe('1');
    expect(new Date(rows.rows[0].last_received_at)).toEqual(now);
    const identity = await db.execute(
      `select i.* from growth_observation_identities i join growth_observations o on o.id=i.observation_id where o.event_id=$1`,
      [batch.events[0].eventId]
    );
    expect(identity.rows).toHaveLength(1);
  });
  it('rolls an entire batch back on a conflicting event', async () => {
    const now = new Date();
    const original = evidenceFixture(now);
    subjects.push(original.events[0].subject.id);
    await acceptObservationBatch(db, 'install', original, {
      now,
      keyring: evidenceKeys,
    });
    const changed = structuredClone(original.events[0]);
    changed.properties.packageVersion = '2';
    const fresh = evidenceFixture(now).events[0];
    fresh.eventId = '00000000-0000-4000-8000-' + randomUUID().slice(-12);
    subjects.push(fresh.subject.id);
    await expect(
      acceptObservationBatch(
        db,
        'install',
        { schemaVersion: 1, events: [fresh, changed] },
        { now, keyring: evidenceKeys }
      )
    ).rejects.toThrow('event_conflict');
    expect(
      (
        await db.execute(
          'select id from growth_observations where event_id=$1',
          [fresh.eventId]
        )
      ).rows
    ).toEqual([]);
  });
});
