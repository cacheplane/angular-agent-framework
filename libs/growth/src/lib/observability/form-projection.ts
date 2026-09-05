import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../database.ts';
import { ObservationError } from './contracts.ts';
import { publicDigest } from './canonical.ts';
import { privacyLock } from './store.ts';

const UUID =
  '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
const eligible = `a.kind='contact.form_submission' and a.event_key like 'form:%:accepted'
  and a.data->>'provenance'='form_submission' and a.data->>'submission_id' ~ '${UUID}'
  and a.event_key='form:' || (a.data->>'submission_id') || ':accepted'
  and a.data->>'form_kind' in ('contact','newsletter','whitepaper','pricing')
  and (a.data->>'form_kind'<>'whitepaper' or a.data->>'paper' in ('overview','angular','render','chat'))
  and c.deleted_at is null
  and not exists (select 1 from growth_observations o where o.source='form' and o.event_id::text=a.data->>'submission_id')`;

export async function readFormProjectionBacklog(db: SqlExecutor) {
  const result = await db.execute<{
    count: string;
  }>(`select count(*)::text as count from (
    select a.id from growth_activity a join growth_contacts c on c.id=a.contact_id where ${eligible} limit 1001
  ) pending`);
  const count = Number(result.rows[0]?.count ?? 0);
  return { pending: Math.min(1000, count), capped: count > 1000 };
}
export async function projectFormObservations(
  db: SqlExecutor,
  input: { enabled: boolean; limit: number; now?: () => Date }
) {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)
    throw new ObservationError('invalid_payload');
  const result = { projected: 0, disabled: !input.enabled };
  if (!input.enabled) return result;
  for (let index = 0; index < input.limit; index++) {
    const projected = await db.transaction(async (tx) => {
      await privacyLock(tx);
      const row = (
        await tx.execute<{
          id: string;
          contact_id: string;
          occurred_at: Date;
          created_at: Date;
          data: Record<string, string>;
        }>(`
        select a.id,a.contact_id,a.occurred_at,a.created_at,a.data from growth_activity a
        join growth_contacts c on c.id=a.contact_id where ${eligible} order by a.id limit 1 for update of a skip locked
      `)
      ).rows[0];
      if (!row) return false;
      const now = input.now?.() ?? new Date();
      if (!Number.isFinite(now.getTime()))
        throw new ObservationError('invalid_payload');
      const eventId = row.data.submission_id;
      const session = row.data.acquisition_session_id;
      const hasSession =
        typeof session === 'string' && new RegExp(UUID, 'i').test(session);
      const namespace = hasSession ? 'website_session' : 'form_submission';
      const externalId = hasSession ? session.toLowerCase() : eventId;
      await tx.execute(
        'insert into growth_observation_subjects(namespace,external_id,first_received_at,last_received_at) values($1,$2,$3,$3) on conflict(namespace,external_id) do nothing',
        [namespace, externalId, row.created_at]
      );
      const subjectId = (
        await tx.execute<{ id: string }>(
          'select id from growth_observation_subjects where namespace=$1 and external_id=$2 for update',
          [namespace, externalId]
        )
      ).rows[0].id;
      const suppressed =
        (
          await tx.execute(
            `select 1 from growth_observation_redactions r where
        (r.selector_kind='subject' and r.selector_key=$1 and r.key_version=0) or
        (r.selector_kind='email' and (r.key_version,r.selector_key) in (
          select email_hmac_key_version,email_lookup_hmac from growth_contacts where id=$2
          union all select (data->>'key_version')::smallint,data->>'digest' from growth_activity where contact_id=$2 and kind='contact.lookup_alias_added'
        )) limit 1`,
            [subjectId, row.contact_id]
          )
        ).rows.length > 0;
      const properties = {
        formKind: row.data.form_kind,
        ...(row.data.form_kind === 'whitepaper'
          ? { paper: row.data.paper }
          : {}),
      };
      const id = randomUUID();
      const digest = publicDigest({
        eventId,
        subjectId,
        kind: 'form.accepted',
        occurredAt: new Date(row.occurred_at).toISOString(),
        properties,
      });
      const inserted = await tx.execute<{ id: string }>(
        `insert into growth_observations(id,source,event_id,subject_id,kind,schema_version,collector_version,identity_scope,occurred_at,received_at,trust,properties,public_digest,redacted_at)
        values($1,'form',$2,$3,'form.accepted',1,'form-projector-v1','session',$4,$5,'server_verified',$6::jsonb,$7,$8)
        on conflict(source,event_id) do nothing returning id`,
        [
          id,
          eventId,
          subjectId,
          row.occurred_at,
          row.created_at,
          JSON.stringify(properties),
          digest,
          suppressed ? now : null,
        ]
      );
      if (!inserted.rows.length) return false;
      await tx.execute(
        'update growth_observation_subjects set first_received_at=least(first_received_at,$2),last_received_at=greatest(last_received_at,$2) where id=$1',
        [subjectId, row.created_at]
      );
      await tx.execute(
        'insert into growth_observation_work(observation_id,available_at,updated_at) values($1,$2,$2)',
        [id, now]
      );
      if (!suppressed)
        await tx.execute(
          'insert into growth_observation_form_links(observation_id,activity_id,contact_id) values($1,$2,$3)',
          [id, row.id, row.contact_id]
        );
      return true;
    });
    if (!projected) break;
    result.projected++;
  }
  return result;
}
