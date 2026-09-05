import type { SqlExecutor } from '../database.ts';
import {
  uuid,
  ObservationError,
  type ObservationSource,
  type IdentityScope,
} from './contracts.ts';
import { readFormProjectionBacklog } from './form-projection.ts';

export type TimelineObservation = {
  id: string;
  source: ObservationSource;
  kind: string;
  session_id: string | null;
  collector_version: string;
  identity_scope: IdentityScope;
  occurred_at: Date;
  received_at: Date;
  trust: 'client_reported' | 'server_verified';
  properties: Record<string, string>;
  identity_redacted: boolean;
  processing_status: 'pending' | 'leased' | 'completed' | 'failed';
  last_error_code: string | null;
  projection_version: string | null;
  active_day: Date | string | null;
  milestone_kind: string | null;
};

export async function readTimeline(
  db: SqlExecutor,
  subjectId: string,
  input: { limit?: number; cursor?: string } = {}
) {
  uuid(subjectId);
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new ObservationError('invalid_payload');
  let cursorTime: Date | null = null,
    cursorId: string | null = null;
  if (input.cursor) {
    try {
      if (input.cursor.length > 300) throw new Error();
      const decoded = JSON.parse(
        Buffer.from(input.cursor, 'base64url').toString('utf8')
      );
      if (!Array.isArray(decoded) || decoded.length !== 2) throw new Error();
      cursorTime = new Date(decoded[0]);
      cursorId = uuid(decoded[1]);
      if (!Number.isFinite(cursorTime.getTime())) throw new Error();
    } catch {
      throw new ObservationError('invalid_cursor');
    }
  }
  const rows = await db.execute<TimelineObservation>(
    `select o.id,o.source,o.kind,o.session_id,o.collector_version,o.identity_scope,o.occurred_at,o.received_at,o.trust,o.properties,
    o.redacted_at is not null as identity_redacted,w.status as processing_status,w.last_error_code,f.projection_version,f.active_day,f.milestone_kind
    from growth_observations o join growth_observation_work w on w.observation_id=o.id
    left join growth_observation_facts f on f.observation_id=o.id
    where o.subject_id=$1 and ($2::timestamptz is null or (o.received_at,o.id)>($2,$3::uuid))
    order by o.received_at,o.id limit $4`,
    [subjectId, cursorTime, cursorId, limit + 1]
  );
  const events = rows.rows.slice(0, limit);
  const last = events.at(-1);
  const nextCursor =
    rows.rows.length > limit && last
      ? Buffer.from(
          JSON.stringify([new Date(last.received_at).toISOString(), last.id])
        ).toString('base64url')
      : null;
  return { subjectId, events, nextCursor };
}
export async function readObservationIdentity(
  db: SqlExecutor,
  observationId: string
) {
  uuid(observationId);
  const rows = await db.execute<{
    email_normalized: string | null;
    git_display_name: string | null;
    git_config_origin: string | null;
    repository_provider: string | null;
    repository_owner: string | null;
  }>(
    `select email_normalized,git_display_name,git_config_origin,repository_provider,repository_owner from growth_observation_identities where observation_id=$1`,
    [observationId]
  );
  if (rows.rows[0]) return rows.rows[0];
  const form = await db.execute<{
    email_normalized: string;
    contact_id: string;
    provenance: 'form_submission';
  }>(
    `select c.email_normalized,c.id as contact_id,'form_submission' as provenance
     from growth_observation_form_links l join growth_contacts c on c.id=l.contact_id
     where l.observation_id=$1 and c.deleted_at is null`,
    [observationId]
  );
  return form.rows[0] ?? null;
}
export async function readObservationHealth(
  db: SqlExecutor,
  input: { from: Date; to: Date }
) {
  if (
    !Number.isFinite(input.from.getTime()) ||
    !Number.isFinite(input.to.getTime()) ||
    input.to <= input.from ||
    input.to.getTime() - input.from.getTime() > 31 * 86400000
  )
    throw new ObservationError('invalid_payload');
  const activity = await db.execute(
    `select source,kind,collector_version,case when source='install' then properties->>'environment' end as environment,
    count(*) as observation_count,count(distinct subject_id) as subject_count,max(received_at) as last_received_at
    from growth_observations where received_at>=$1 and received_at<$2 group by source,kind,collector_version,case when source='install' then properties->>'environment' end order by source,kind,collector_version`,
    [input.from, input.to]
  );
  const work = await db.execute(
    'select * from growth_observation_work_health_v1 order by status,projection_version'
  );
  const activation = await db.execute(
    `select outcome,count(*) as runtime_count,count(distinct contact_id) as contact_count
     from growth_install_runtime_links where evaluated_at >= $1 and evaluated_at < $2
     group by outcome order by outcome`,
    [input.from, input.to]
  );
  return {
    from: input.from.toISOString(),
    to: input.to.toISOString(),
    activity: activity.rows,
    currentQueue: work.rows,
    installRuntimeActivation: activation.rows,
    formProjection: await readFormProjectionBacklog(db),
    ingressFailures: 'service_logs',
  };
}
