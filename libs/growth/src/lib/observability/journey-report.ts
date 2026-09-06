import type { SqlExecutor } from '../database.ts';
import {
  CONTACT_HARD_STOP_REASONS,
  readContactControlState,
} from '../contacts.ts';
import { ObservationError, uuid } from './contracts.ts';

const LIMIT = 50;
function reportSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const url = new URL(value);
    // Encoded paths can hide identity through repeated decoding. Omit them
    // conservatively; query and fragment are never useful source provenance.
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      /[%@]/u.test(url.pathname)
    )
      return null;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function bounded(rows: Record<string, unknown>[], limit = LIMIT) {
  return {
    state: rows.length ? 'available' : 'no_evidence',
    latest: rows.slice(0, limit),
    limit,
    truncated: rows.length > limit,
  };
}

/** Independent signals are not a conversion denominator. Cohort membership requires a persisted link. */
export async function readGrowthFunnel(
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
  const parameters = [input.from, input.to];
  const signals = await db.execute(
    `select source,kind,case when source='install' then properties->>'environment' end as environment,
    count(*) as observations,count(distinct subject_id) as subjects
    from growth_observations where received_at >= $1 and received_at < $2
    group by source,kind,case when source='install' then properties->>'environment' end order by source,kind,environment`,
    parameters
  );
  const links = await db.execute(
    `select outcome,count(*) as runtime_observations,count(distinct contact_id) as contacts
    from growth_install_runtime_links where evaluated_at >= $1 and evaluated_at < $2 group by outcome order by outcome`,
    parameters
  );
  const processing = await db.execute(
    `select coalesce(w.status,'missing') as status,count(*) as observations
    from growth_observations o left join growth_observation_work w on w.observation_id=o.id
    where o.received_at >= $1 and o.received_at < $2 group by w.status order by status`,
    parameters
  );
  const cohort = await db.execute(
    `with cohort as (
    select distinct contact_id from growth_install_runtime_links
    where evaluated_at >= $1 and evaluated_at < $2 and contact_id is not null
  ), states as (
    select c.id,c.deleted_at,c.outreach_approved_at,s.kind as stop_kind,s.occurred_at as stop_at
    from cohort join growth_contacts c on c.id=cohort.contact_id
    left join lateral (select kind,occurred_at from growth_activity where contact_id=c.id and kind=any($3::text[])
      order by occurred_at desc,id desc limit 1) s on true
  ) select count(*) as linked_contacts,
    count(*) filter(where deleted_at is null and outreach_approved_at is not null and (stop_at is null or stop_at < outreach_approved_at) and stop_kind is distinct from 'deletion') as currently_authorized_contacts,
    count(*) filter(where exists(select 1 from growth_activity a where a.contact_id=states.id and a.kind='campaign.enrolled:v1')) as enrolled_contacts,
    count(*) filter(where exists(select 1 from growth_jobs j where j.contact_id=states.id and j.kind='send_step' and j.delivery_status <> 'not_submitted')) as submitted_or_attempted_contacts,
    count(*) filter(where exists(select 1 from growth_activity a where a.contact_id=states.id and a.kind='campaign.step_accepted')) as accepted_contacts,
    count(*) filter(where exists(select 1 from growth_activity a where a.contact_id=states.id and a.kind='delivery.delivered')) as delivered_contacts,
    count(*) filter(where exists(select 1 from growth_activity a where a.contact_id=states.id and a.kind='campaign.reply_received')) as replied_contacts,
    count(*) filter(where deleted_at is not null or stop_kind='deletion' or (stop_at is not null and (outreach_approved_at is null or stop_at >= outreach_approved_at))) as currently_stopped_contacts,
    count(*) filter(where exists(select 1 from growth_artifacts a join growth_jobs j on j.id=a.job_id where a.contact_id=states.id and j.kind='enrich' and a.kind='enrichment.v1' and a.schema_version=1)) as enriched_contacts
    from states`,
    [...parameters, CONTACT_HARD_STOP_REASONS]
  );
  return {
    from: input.from.toISOString(),
    to: input.to.toISOString(),
    independentSignals: {
      unit: 'observations and distinct subjects per group; subjects may appear in multiple groups',
      window: 'received_at [from,to)',
      rows: signals.rows,
    },
    activationDecisions: {
      unit: 'runtime observations and distinct contacts per outcome',
      window: 'evaluated_at [from,to)',
      rows: links.rows,
    },
    observationProcessing: {
      unit: 'observations received in the window, current processing state',
      rows: processing.rows,
    },
    linkedContactCohort: {
      definition:
        'Distinct non-null contacts linked by decisions evaluated in the window. Outcome counts are all persisted history as of this read; current authorization/stops use current control state, not full campaign eligibility. Stages are not necessarily sequential.',
      unit: 'distinct contacts',
      counts: cohort.rows[0] ?? null,
    },
    unavailable: [
      'Anonymous website-to-install attribution is not persisted.',
      'Ingress rejection details require service logs.',
      'Provider outcomes not yet persisted are unavailable.',
    ],
  };
}

/** Read a bounded, identity-free operator view. Never select job payloads, activity data or raw artifacts. */
export async function readContactJourney(db: SqlExecutor, contactId: string) {
  uuid(contactId);
  const contact = await db.execute(
    'select id from growth_contacts where id=$1',
    [contactId]
  );
  if (!contact.rows[0]) return { contactId, state: 'not_found' };
  const control = await readContactControlState(db, contactId);
  if (control.authorization === 'deleted')
    return { contactId, state: 'redacted', control };
  const observations = await db.execute(
    `select o.id,o.subject_id,o.source,o.kind,o.occurred_at,o.received_at,o.trust,
    o.redacted_at is not null as redacted,w.status as processing_status,w.last_error_code
    from growth_observations o left join growth_observation_work w on w.observation_id=o.id
    where exists(select 1 from growth_install_runtime_links l where l.contact_id=$1 and (l.runtime_observation_id=o.id or l.install_observation_id=o.id))
      or exists(select 1 from growth_observation_form_links f where f.contact_id=$1 and f.observation_id=o.id)
    order by o.received_at desc,o.id desc limit $2`,
    [contactId, LIMIT + 1]
  );
  const activation = await db.execute(
    `select runtime_observation_id,install_observation_id,outcome,evaluated_at
    from growth_install_runtime_links where contact_id=$1 order by evaluated_at desc,runtime_observation_id desc limit $2`,
    [contactId, LIMIT + 1]
  );
  const jobs = await db.execute(
    `select id,kind,status,delivery_status,attempts,available_at,created_at,updated_at,last_error_code,
    payload->>'campaign_version' as campaign_version,payload->>'step' as step,
    payload->>'source' as source,payload->>'install_observation_id' as install_observation_id,payload->>'runtime_observation_id' as runtime_observation_id
    from growth_jobs where contact_id=$1 order by created_at desc,id desc limit $2`,
    [contactId, LIMIT + 1]
  );
  const activity = await db.execute(
    `select id,kind,occurred_at from growth_activity where contact_id=$1
    order by occurred_at desc,id desc limit $2`,
    [contactId, LIMIT + 1]
  );
  const artifacts = await db.execute(
    `select a.id,a.job_id,a.kind,a.schema_version,a.created_at,
    left(a.content->'company_profile'->>'name',120) as company_name,
    left(a.content->'company_profile'->>'description',500) as company_description,
    left(a.content->'company_profile'->>'industry',120) as company_industry,
    (select jsonb_agg(jsonb_build_object('id',left(s->>'id',40),'url',left(s->>'url',500),'retrieved_at',left(s->>'retrieved_at',40),'content_hash',left(s->>'content_hash',64)))
      from (select s from jsonb_array_elements(case when jsonb_typeof(a.content->'sources')='array' then a.content->'sources' else '[]'::jsonb end) s limit 3) sources) as sources,
    case when jsonb_typeof(a.content->'sources')='array' then jsonb_array_length(a.content->'sources')>3 else false end as sources_truncated
    from growth_artifacts a join growth_jobs j on j.id=a.job_id
    where a.contact_id=$1 and j.kind='enrich' and a.kind='enrichment.v1' and a.schema_version=1
      and not exists(select 1 from growth_contacts c where c.id=$1 and c.deleted_at is not null)
    order by a.created_at desc,a.id desc limit 2`,
    [contactId]
  );
  // Company prose is untrusted; avoid accidentally echoing an email embedded in a profile or URL.
  const safeArtifacts = JSON.parse(
    JSON.stringify(
      artifacts.rows.map((artifact) => ({
        ...artifact,
        sources: Array.isArray(artifact.sources)
          ? artifact.sources.map((source: Record<string, unknown>) => ({
              ...source,
              url: reportSourceUrl(source.url),
            }))
          : artifact.sources,
      }))
    ).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[redacted]')
  ) as Record<string, unknown>[];
  return {
    contactId,
    state: 'available',
    control,
    observations: bounded(observations.rows),
    activation: bounded(activation.rows),
    jobs: bounded(jobs.rows),
    activity: bounded(activity.rows),
    enrichment: bounded(safeArtifacts, 1),
    notes: [
      'Latest evidence only; truncation is explicit per section.',
      'Only persisted direct observation links are shown; anonymous browsing is unavailable.',
      'Company research is a candidate-domain profile, not verified employment. Missing profile fields mean unavailable.',
      'Only enrichment.v1 schema 1 artifacts are summarized. Source URLs omit query/fragment; unsafe or encoded paths are unavailable.',
      'Control state is current; earlier activation approval does not override stops. Reads are not a transaction snapshot.',
    ],
  };
}
