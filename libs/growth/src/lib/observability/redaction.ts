import type { SqlExecutor, SqlTransaction } from '../database.ts';
import {
  createEmailLookupCandidates,
  normalizeEmail,
  type EmailHmacKeyring,
  type EmailLookupHmac,
} from '../crypto.ts';
import { uuid, ObservationError } from './contracts.ts';
import { identityDigest, publicDigest } from './canonical.ts';
import { privacyLock } from './store.ts';

type Selector = { subjectId: string } | { email: string };
async function redactLocked(
  tx: SqlTransaction,
  input: {
    subjectId?: string;
    email?: string;
    lookups: readonly EmailLookupHmac[];
  },
  now: Date
): Promise<number> {
  const rows = await tx.execute<{
    observation_id: string;
    email_lookup_hmac: string | null;
    email_key_version: number | null;
  }>(
    `
    select o.id as observation_id,coalesce(i.email_lookup_hmac,c.email_lookup_hmac) as email_lookup_hmac,
      coalesce(i.email_key_version,c.email_hmac_key_version) as email_key_version from growth_observations o
    left join growth_observation_identities i on i.observation_id=o.id
    left join growth_observation_form_links l on l.observation_id=o.id
    left join growth_contacts c on c.id=l.contact_id where
      ($1::uuid is not null and o.subject_id=$1) or
      ($2::text is not null and (i.email_normalized=$2 or c.email_normalized=$2)) or
      ((i.email_key_version,i.email_lookup_hmac) in (select * from unnest($3::smallint[],$4::text[]))) or
      ((c.email_hmac_key_version,c.email_lookup_hmac) in (select * from unnest($3::smallint[],$4::text[]))) order by o.id`,
    [
      input.subjectId ?? null,
      input.email ?? null,
      input.lookups.map((k) => k.keyVersion),
      input.lookups.map((k) => k.digest),
    ]
  );
  if (input.subjectId)
    await tx.execute(
      `insert into growth_observation_redactions values('subject',$1,0,$2) on conflict do nothing`,
      [input.subjectId, now]
    );
  const lookups = [
    ...input.lookups,
    ...rows.rows.flatMap((r) =>
      r.email_lookup_hmac && r.email_key_version
        ? [{ digest: r.email_lookup_hmac, keyVersion: r.email_key_version }]
        : []
    ),
  ];
  for (const key of lookups)
    await tx.execute(
      `insert into growth_observation_redactions values('email',$1,$2,$3) on conflict do nothing`,
      [key.digest, key.keyVersion, now]
    );
  const ids = rows.rows.map((r) => r.observation_id);
  // Retire derived research before removing its identity evidence. A redacted
  // install invalidates every version sharing its token, just as authorization does.
  await tx.execute(
    `/* growth:redact-install-runtime-enrichment */
     with affected as materialized (
       select j.id from growth_jobs j
       where j.kind='enrich' and j.payload->>'source'='install_runtime'
         and (
           j.payload->>'install_observation_id'=any($1::text[])
           or j.payload->>'runtime_observation_id'=any($1::text[])
           or exists (
             select 1 from growth_observations linked_install
             join growth_observations removed on removed.installation_token_digest=linked_install.installation_token_digest
             where linked_install.id::text=j.payload->>'install_observation_id'
               and removed.id=any($1::uuid[]) and removed.source='install'
           )
         )
       order by j.id for update of j
     ), scrubbed as (
       update growth_jobs j set
         status=case when j.status in ('pending','leased') then 'cancelled' else j.status end,
         lease_token=null, lease_until=null,
         payload=jsonb_build_object('source','install_runtime','evidence_redacted',true),
         last_error_code='install_runtime_evidence_redacted', updated_at=$2
       where j.id in (select id from affected)
       returning j.id
     )
     delete from growth_artifacts where job_id in (select id from scrubbed)`,
    [ids, now]
  );
  await tx.execute(
    'select observation_id from growth_observation_work where observation_id=any($1::uuid[]) order by observation_id for update',
    [ids]
  );
  await tx.execute(
    'delete from growth_observation_identities where observation_id=any($1::uuid[])',
    [ids]
  );
  await tx.execute(
    'delete from growth_observation_form_links where observation_id=any($1::uuid[])',
    [ids]
  );
  await tx.execute(
    'update growth_observations set identity_digest=null,identity_digest_key_version=null,redacted_at=coalesce(redacted_at,$2) where id=any($1::uuid[])',
    [ids, now]
  );
  await tx.execute(
    'delete from growth_observation_facts where observation_id=any($1::uuid[])',
    [ids]
  );
  await tx.execute(
    `update growth_observation_work set generation=generation+1,status='pending',attempts=0,lease_token=null,lease_until=null,last_error_code=null,available_at=$2,updated_at=$2 where observation_id=any($1::uuid[])`,
    [ids, now]
  );
  return ids.length;
}
export async function redactObservationEvidence(
  db: SqlExecutor,
  selector: Selector,
  context: { operationId: string; now: Date; keyring: EmailHmacKeyring }
) {
  uuid(context.operationId);
  if (!Number.isFinite(context.now.getTime()))
    throw new ObservationError('invalid_payload');
  const subjectId =
    'subjectId' in selector ? uuid(selector.subjectId) : undefined;
  const email =
    'email' in selector ? normalizeEmail(selector.email) : undefined;
  const lookups = email
    ? createEmailLookupCandidates(email, context.keyring)
    : [];
  return db.transaction(async (tx) => {
    await privacyLock(tx, true);
    // Acquire privacy first everywhere that both locks are needed.
    await tx.execute('select pg_advisory_xact_lock(hashtextextended($1,0))', [
      `observation-operation:${context.operationId}`,
    ]);
    const old = (
      await tx.execute<{
        kind: string;
        selection_digest: string;
        selected_count: number;
      }>(
        'select kind,selection_digest,selected_count from growth_observation_operations where operation_id=$1',
        [context.operationId]
      )
    ).rows[0];
    if (
      old &&
      (old.kind !== 'redact' || (email && !/^\d+:/u.test(old.selection_digest)))
    )
      throw new ObservationError('operation_conflict');
    const version =
      old && email
        ? Number(old.selection_digest.split(':')[0])
        : context.keyring.active.version;
    const digest = email
      ? `${version}:${identityDigest({ email }, context.keyring, version)}`
      : publicDigest({ subjectId });
    if (old) {
      if (old.kind !== 'redact' || old.selection_digest !== digest)
        throw new ObservationError('operation_conflict');
      return { selectedCount: old.selected_count };
    }
    const selectedCount = await redactLocked(
      tx,
      { subjectId, email, lookups },
      context.now
    );
    await tx.execute(
      `insert into growth_observation_operations values($1,'redact',$2,$3,$4,$2)`,
      [context.operationId, context.now, digest, selectedCount]
    );
    return { selectedCount };
  });
}
export async function redactContactObservationEvidence(
  tx: SqlTransaction,
  contactId: string,
  now: Date
): Promise<void> {
  await privacyLock(tx, true);
  const contact = (
    await tx.execute<{
      email_normalized: string | null;
      email_lookup_hmac: string;
      email_hmac_key_version: number;
    }>(
      `/* growth:observation-contact-identity */ select email_normalized,email_lookup_hmac,email_hmac_key_version from growth_contacts where id=$1`,
      [contactId]
    )
  ).rows[0];
  if (!contact) return;
  const aliases = await tx.execute<{ digest: string; version: number }>(
    `/* growth:observation-contact-aliases */ select data->>'digest' as digest,(data->>'key_version')::smallint as version from growth_activity where contact_id=$1 and kind='contact.lookup_alias_added'`,
    [contactId]
  );
  await redactLocked(
    tx,
    {
      email: contact.email_normalized ?? undefined,
      lookups: [
        {
          digest: contact.email_lookup_hmac,
          keyVersion: contact.email_hmac_key_version,
        },
        ...aliases.rows.map((k) => ({
          digest: k.digest,
          keyVersion: k.version,
        })),
      ],
    },
    now
  );
}
export async function initializeObservationRedactions(
  db: SqlExecutor,
  input: { limit: number; cursor?: string },
  now = new Date()
) {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)
    throw new ObservationError('invalid_payload');
  const cursor = input.cursor ? uuid(input.cursor) : null;
  const rows = await db.execute<{ id: string }>(
    'select id from growth_contacts where deleted_at is not null and ($1::uuid is null or id>$1) order by id limit $2',
    [cursor, input.limit + 1]
  );
  const selected = rows.rows.slice(0, input.limit);
  for (const row of selected)
    await db.transaction(async (tx) => {
      await privacyLock(tx, true);
      await tx.execute(
        'select id from growth_contacts where id=$1 for update',
        [row.id]
      );
      await redactContactObservationEvidence(tx, row.id, now);
    });
  return {
    processed: selected.length,
    nextCursor: rows.rows.length > input.limit ? selected.at(-1)!.id : null,
  };
}
