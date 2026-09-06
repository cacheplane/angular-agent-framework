import { CONTACT_HARD_STOP_REASONS } from '../contacts.ts';
import { companyDomainFromEmail } from '../company-domain.ts';
import type { SqlExecutor, SqlTransaction } from '../database.ts';
import { privacyLock } from './store.ts';

/** Internal static SQL expressions only; never interpolate operator/public input. Uses contact alias c. */
export function installRuntimeEvidenceSql(
  installIdExpression: string,
  runtimeIdExpression: string
): string {
  return `exists (
    select 1 from growth_install_runtime_links link
    join growth_observations i on i.id=link.install_observation_id
    join growth_observations r on r.id=link.runtime_observation_id
    join growth_observation_identities identity on identity.observation_id=i.id
    where link.contact_id=c.id and link.outcome='approved'
      and i.id::text=${installIdExpression} and r.id::text=${runtimeIdExpression}
      and i.redacted_at is null and r.redacted_at is null
      and i.source='install' and r.source='runtime' and r.kind='runtime.session_started'
      and i.properties->>'environment'<>'ci'
      and i.installation_token_digest=r.installation_token_digest
      and i.properties->>'packageName'=r.properties->>'packageName'
      and i.properties->>'packageVersion'=r.properties->>'packageVersion'
      and identity.email_normalized=c.email_normalized
      and not exists(select 1 from growth_observations removed
        where removed.source='install' and removed.installation_token_digest=i.installation_token_digest
          and removed.redacted_at is not null)
      and not exists(select 1 from growth_observations other
        join growth_observation_identities other_identity on other_identity.observation_id=other.id
        where other.source='install' and other.installation_token_digest=i.installation_token_digest
          and other_identity.email_normalized<>identity.email_normalized)
  )`;
}

/** Caller holds the shared privacy lock and has persisted the approved link in this transaction. */
export async function enqueueInstallRuntimeEnrichment(
  tx: SqlTransaction,
  input: {
    contactId: string;
    installObservationId: string;
    runtimeObservationId: string;
    email: string;
    now: Date;
  }
): Promise<void> {
  if (!companyDomainFromEmail(input.email)) return;
  await tx.execute(
    `/* growth:enqueue-install-runtime-enrichment */
    insert into growth_jobs(kind,contact_id,status,available_at,idempotency_key,payload)
    select 'enrich',c.id,'pending',$4,$5,
      jsonb_build_object('source','install_runtime','install_observation_id',$2::text,'runtime_observation_id',$3::text)
    from growth_contacts c where c.id=$1 and c.deleted_at is null and c.outreach_approved_at is not null
      and not exists(select 1 from growth_activity stop where stop.contact_id=c.id
        and stop.kind=any($6::text[]) and stop.occurred_at>=c.outreach_approved_at)
      and ${installRuntimeEvidenceSql('$2::text', '$3::text')}
    on conflict(idempotency_key) do nothing`,
    [
      input.contactId,
      input.installObservationId,
      input.runtimeObservationId,
      input.now,
      `install-runtime:v1:${input.contactId}:enrich`,
      CONTACT_HARD_STOP_REASONS,
    ]
  );
}

/** Re-read authorization between provider stages; returns no plaintext identity. */
export async function readInstallRuntimeEnrichmentContext(
  db: SqlExecutor,
  input: { jobId: string; leaseToken: string; now: Date }
): Promise<{ companyDomain: string } | null> {
  return db.transaction(async (tx) => {
    await privacyLock(tx);
    const result = await tx.execute<{ email_normalized: string }>(
      `/* growth:read-install-runtime-enrichment-context */
      select c.email_normalized from growth_jobs j join growth_contacts c on c.id=j.contact_id
      where j.id=$1 and j.kind='enrich' and j.payload->>'source'='install_runtime'
        and j.status='leased' and j.lease_token=$2::uuid and j.lease_until>$3
        and c.deleted_at is null and c.outreach_approved_at is not null
        and not exists(select 1 from growth_activity stop where stop.contact_id=c.id
          and stop.kind=any($4::text[]) and stop.occurred_at>=c.outreach_approved_at)
        and ${installRuntimeEvidenceSql(
          "j.payload->>'install_observation_id'",
          "j.payload->>'runtime_observation_id'"
        )}`,
      [input.jobId, input.leaseToken, input.now, CONTACT_HARD_STOP_REASONS]
    );
    const email = result.rows[0]?.email_normalized;
    const companyDomain = email ? companyDomainFromEmail(email) : null;
    return companyDomain ? { companyDomain } : null;
  });
}
