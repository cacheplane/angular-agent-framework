import type { SqlExecutor } from '../database.ts';
import {
  uuid,
  collectionSource,
  ObservationError,
  type CollectionSource,
} from './contracts.ts';
import { publicDigest } from './canonical.ts';

export type ReplaySelection = { operationId: string; maxEvents: number } & (
  | { subjectId: string }
  | { source: CollectionSource; from: Date; to: Date }
);
export async function replayObservations(
  db: SqlExecutor,
  input: ReplaySelection,
  now = new Date()
) {
  const operationId = uuid(input.operationId);
  if (
    !Number.isInteger(input.maxEvents) ||
    input.maxEvents < 1 ||
    input.maxEvents > 1000 ||
    !Number.isFinite(now.getTime())
  )
    throw new ObservationError('invalid_payload');
  let subject: string | null = null,
    source: CollectionSource | null = null,
    from: Date | null = null,
    to: Date | null = null;
  if ('subjectId' in input) subject = uuid(input.subjectId);
  else {
    source = collectionSource(input.source);
    from = input.from;
    to = input.to;
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      to <= from ||
      to.getTime() - from.getTime() > 86400000
    )
      throw new ObservationError('invalid_payload');
  }
  const digest = publicDigest({
    subject,
    source,
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    maxEvents: input.maxEvents,
  });
  return db.transaction(async (tx) => {
    await tx.execute(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `observation-operation:${operationId}`,
    ]);
    const existing = (
      await tx.execute<{
        kind: string;
        selection_digest: string;
        selected_count: number;
      }>(
        'select kind,selection_digest,selected_count from growth_observation_operations where operation_id=$1',
        [operationId]
      )
    ).rows[0];
    if (existing) {
      if (existing.kind !== 'replay' || existing.selection_digest !== digest)
        throw new ObservationError('operation_conflict');
      return { selectedCount: existing.selected_count };
    }
    const selected = await tx.execute<{ id: string }>(
      `select id from growth_observations where ($1::uuid is not null and subject_id=$1)
      or ($1::uuid is null and source=$2 and received_at>=$3 and received_at<$4) order by id limit $5`,
      [subject, source, from, to, input.maxEvents + 1]
    );
    if (selected.rows.length > input.maxEvents)
      throw new ObservationError('selection_overflow');
    const ids = selected.rows.map((r) => r.id);
    await tx.execute(
      'select observation_id from growth_observation_work where observation_id=any($1::uuid[]) order by observation_id for update',
      [ids]
    );
    await tx.execute(
      `update growth_observation_work set generation=generation+1,status='pending',attempts=0,lease_token=null,lease_until=null,available_at=$2,updated_at=$2,last_error_code=null where observation_id=any($1::uuid[])`,
      [ids, now]
    );
    await tx.execute(
      'delete from growth_observation_facts where observation_id=any($1::uuid[])',
      [ids]
    );
    await tx.execute(
      `insert into growth_observation_operations(operation_id,kind,requested_at,selection_digest,selected_count,completed_at) values($1,'replay',$2,$3,$4,$2)`,
      [operationId, now, digest, ids.length]
    );
    return { selectedCount: ids.length };
  });
}
