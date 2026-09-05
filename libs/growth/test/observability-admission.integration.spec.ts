import type { SqlExecutor } from '../src/lib/database.ts';
import { randomUUID } from 'node:crypto';
import {
  consumeSourceBudget,
  consumeSubjectBudgets,
} from '../src/lib/observability/admission.ts';
import type { CollectionEventV1 } from '../src/lib/observability/contracts.ts';
import { evidenceDatabase } from './observability-fixtures.ts';

describe('durable admission limits', () => {
  let db: SqlExecutor;
  const now = new Date('2001-01-01T00:00:30Z');
  beforeAll(async () => {
    db = await evidenceDatabase();
  });
  it('charges every subject on denial and resets at the exact minute boundary', async () => {
    const a = randomUUID(),
      b = randomUUID(),
      start = new Date('2001-01-01T00:00:00Z');
    const event = (id: string) =>
      ({
        subject: { id, namespace: 'installation', scope: 'persistent' },
      } as CollectionEventV1);
    await db.execute(
      'insert into growth_collection_budgets(bucket_key,window_start,count) values($1,$2,119)',
      [`subject:installation:${a}`, start]
    );
    expect(
      (
        await consumeSubjectBudgets(
          db,
          'install',
          [event(a), event(a), event(b)],
          now
        )
      ).allowed
    ).toBe(false);
    expect(
      (
        await db.execute(
          'select count from growth_collection_budgets where bucket_key=$1 and window_start=$2',
          [`subject:installation:${b}`, start]
        )
      ).rows[0].count
    ).toBe('1');
    expect(
      (await consumeSubjectBudgets(db, 'install', [event(a)], now)).allowed
    ).toBe(false);
    const next = new Date('2001-01-01T00:01:00Z');
    try {
      expect(
        await consumeSubjectBudgets(db, 'install', [event(a)], next)
      ).toEqual({ allowed: true, retryAfterSec: 60 });
    } finally {
      await db.execute(
        'delete from growth_collection_budgets where bucket_key=$1 and window_start=$2',
        [`subject:installation:${a}`, next]
      );
    }
  });
  afterAll(async () => {
    await db.execute(
      'delete from growth_collection_budgets where window_start=$1',
      [new Date('2001-01-01T00:00:00Z')]
    );
    await db.close?.();
  });
  it('admits exactly the remaining quota under concurrent requests', async () => {
    await db.execute(
      `insert into growth_collection_budgets(bucket_key,window_start,count) values('source:install',$1,1199) on conflict(bucket_key,window_start) do update set count=1199`,
      [new Date('2001-01-01T00:00:00Z')]
    );
    const results = await Promise.all(
      Array.from({ length: 3 }, () => consumeSourceBudget(db, 'install', now))
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(1);
    expect(results[0].retryAfterSec).toBe(30);
    expect((await consumeSourceBudget(db, 'install', now)).allowed).toBe(false);
  });
});
