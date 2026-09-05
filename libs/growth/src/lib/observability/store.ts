import type { SqlTransaction } from '../database.ts';
import type { EmailHmacKeyring } from '../crypto.ts';
import { ObservationError } from './contracts.ts';

export async function privacyLock(
  tx: SqlTransaction,
  exclusive = false
): Promise<void> {
  await tx.execute(
    exclusive
      ? `select pg_advisory_xact_lock(hashtextextended('growth-observation-privacy-v1',0))`
      : `select pg_advisory_xact_lock_shared(hashtextextended('growth-observation-privacy-v1',0))`
  );
}
export async function assertIdentityKeyCoverage(
  tx: SqlTransaction,
  keyring: EmailHmacKeyring
): Promise<void> {
  const versions = [
    keyring.active.version,
    ...(keyring.previous ?? []).map((k) => k.version),
  ];
  const missing = await tx.execute(
    `select 1 from growth_observation_redactions where selector_kind='email' and not (key_version=any($1::smallint[])) limit 1`,
    [versions]
  );
  if (missing.rows.length)
    throw new ObservationError('identity_key_unavailable');
  const unfenced = await tx.execute(`
    with deleted_keys as (
      select email_lookup_hmac as digest,email_hmac_key_version as version from growth_contacts where deleted_at is not null
      union all
      select a.data->>'digest', (a.data->>'key_version')::smallint from growth_activity a join growth_contacts c on c.id=a.contact_id
      where c.deleted_at is not null and a.kind='contact.lookup_alias_added'
    ) select 1 from deleted_keys k where not exists (
      select 1 from growth_observation_redactions r where r.selector_kind='email' and r.selector_key=k.digest and r.key_version=k.version
    ) limit 1`);
  if (unfenced.rows.length)
    throw new ObservationError('redaction_initialization_required');
}
