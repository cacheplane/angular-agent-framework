import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createDatabaseExecutor,
  type SqlExecutor,
} from '../src/lib/database.ts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { applyMigrations } from '../../../scripts/apply-migrations.mts';
import { acceptObservationBatch } from '../src/lib/observability/ingest.ts';
import {
  evidenceFixture,
  evidenceKeys,
  cleanEvidence,
} from './observability-fixtures.ts';

describe('observation schema', () => {
  let db: SqlExecutor;
  beforeAll(async () => {
    db = createDatabaseExecutor(process.env['TEST_DATABASE_URL']);
    await applyMigrations({ directory: resolve('migrations'), executor: db });
  });
  afterAll(async () => db.close?.());
  it('installs an isolated queue and redacted reporting', async () => {
    const result = await db.execute<{ name: string }>(
      `select table_name as name from information_schema.tables where table_schema='public' and table_name like 'growth_observation%' order by table_name`
    );
    expect(result.rows.map((r) => r.name)).toContain('growth_observations');
    expect(result.rows.map((r) => r.name)).toContain('growth_observation_work');
    const privateColumns = await db.execute(
      `select column_name from information_schema.columns where table_name in ('growth_observation_source_health_v1','growth_observation_subject_overview_v1','growth_observation_work_health_v1') and column_name in ('email_normalized','git_display_name','identity_digest')`
    );
    expect(privateColumns.rows).toEqual([]);
  });
  it('enforces uniqueness, trust, lease shape and cascading fixture removal', async () => {
    const now = new Date(),
      batch = evidenceFixture(now);
    try {
      await acceptObservationBatch(db, 'install', batch, {
        now,
        keyring: evidenceKeys,
      });
      const row = (
        await db.execute<{ id: string; subject_id: string }>(
          'select id,subject_id from growth_observations where event_id=$1',
          [batch.events[0].eventId]
        )
      ).rows[0];
      await expect(
        db.execute(
          "insert into growth_observation_subjects(namespace,external_id,first_received_at,last_received_at) values('installation',$1,$2,$2)",
          [batch.events[0].subject.id, now]
        )
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        db.execute(
          "update growth_observations set trust='verified' where id=$1",
          [row.id]
        )
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        db.execute(
          "update growth_observation_work set status='leased' where observation_id=$1",
          [row.id]
        )
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        db.execute(
          'insert into growth_observation_work(observation_id,available_at,updated_at) values($1,$2,$2)',
          [randomUUID(), now]
        )
      ).rejects.toMatchObject({ code: '23503' });
      await db.execute('delete from growth_observation_subjects where id=$1', [
        row.subject_id,
      ]);
      for (const table of [
        'growth_observations',
        'growth_observation_identities',
        'growth_observation_work',
      ]) {
        const column =
          table === 'growth_observations' ? 'id' : 'observation_id';
        expect(
          (
            await db.execute(`select 1 from ${table} where ${column}=$1`, [
              row.id,
            ])
          ).rows
        ).toHaveLength(0);
      }
    } finally {
      await cleanEvidence(db, [batch.events[0].subject.id]);
    }
  });
});
