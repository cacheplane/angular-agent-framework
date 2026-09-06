import type { SqlExecutor } from '../database.ts';
import type { EmailHmacKeyring } from '../crypto.ts';
import { approveContactFromInstallRuntimeInTransaction } from '../contacts.ts';
import { privacyLock, assertIdentityKeyCoverage } from './store.ts';
import { enqueueInstallRuntimeEnrichment } from './install-runtime-enrichment.ts';

/** Resolve admitted evidence in the existing lifecycle tick; never invoked by public payloads. */
export async function processInstallRuntimeActivations(
  db: SqlExecutor,
  input: {
    enabled: boolean;
    limit: number;
    now: Date;
    keyring: EmailHmacKeyring;
  }
): Promise<{
  approved: number;
  ineligible: number;
  conflicted: number;
  disabled: boolean;
}> {
  const counts = {
    approved: 0,
    ineligible: 0,
    conflicted: 0,
    disabled: !input.enabled,
  };
  if (!input.enabled) return counts;
  if (
    !Number.isInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 100 ||
    !Number.isFinite(input.now.getTime())
  )
    throw new Error('invalid_activation_input');
  return db.transaction(async (tx) => {
    await privacyLock(tx);
    await assertIdentityKeyCoverage(tx, input.keyring);
    // Reuse database exclusion, not a new queue or in-memory background task.
    await tx.execute(
      "select pg_advisory_xact_lock(hashtextextended('growth-install-runtime-v1',0))"
    );
    const runtimes = await tx.execute<{
      id: string;
      installation_token_digest: string;
      properties: Record<string, string>;
    }>(
      `
      select r.id,r.installation_token_digest,r.properties from growth_observations r
      where r.source='runtime' and r.kind='runtime.session_started' and r.redacted_at is null
        and r.installation_token_digest is not null
        and not exists(select 1 from growth_install_runtime_links l where l.runtime_observation_id=r.id)
        and exists(select 1 from growth_observations i where i.source='install'
          and i.installation_token_digest=r.installation_token_digest
          and i.properties->>'packageName'=r.properties->>'packageName'
          and i.properties->>'packageVersion'=r.properties->>'packageVersion')
      order by r.received_at,r.id limit $1 for update of r`,
      [input.limit]
    );
    for (const runtime of runtimes.rows) {
      const installs = await tx.execute<{
        id: string;
        email_normalized: string | null;
        redacted_at: Date | null;
        environment: string;
      }>(
        `
        select i.id,e.email_normalized,i.redacted_at,i.properties->>'environment' as environment
        from growth_observations i left join growth_observation_identities e on e.observation_id=i.id
        where i.source='install' and i.installation_token_digest=$1
          and i.properties->>'packageName'=$2 and i.properties->>'packageVersion'=$3
        order by i.received_at,i.id`,
        [
          runtime.installation_token_digest,
          runtime.properties.packageName,
          runtime.properties.packageVersion,
        ]
      );
      const emails = new Set(
        installs.rows.map((i) => i.email_normalized).filter(Boolean)
      );
      let outcome: 'approved' | 'ineligible' | 'conflicted' =
        emails.size > 1 ? 'conflicted' : 'ineligible';
      const installation = installs.rows.find(
        (i) => i.email_normalized && !i.redacted_at && i.environment !== 'ci'
      );
      let contactId: string | null = null;
      if (
        emails.size === 1 &&
        installation &&
        !installs.rows.some((i) => i.redacted_at)
      ) {
        contactId = await approveContactFromInstallRuntimeInTransaction(tx, {
          email: installation.email_normalized!,
          keyring: input.keyring,
          now: input.now,
          installObservationId: installation.id,
          runtimeObservationId: runtime.id,
        });
        if (contactId) outcome = 'approved';
      }
      await tx.execute(
        `insert into growth_install_runtime_links(runtime_observation_id,install_observation_id,contact_id,outcome,evaluated_at)
        values($1,$2,$3,$4,$5)`,
        [runtime.id, installation?.id ?? null, contactId, outcome, input.now]
      );
      if (outcome === 'approved' && contactId && installation?.email_normalized) {
        await enqueueInstallRuntimeEnrichment(tx, {
          contactId,
          installObservationId: installation.id,
          runtimeObservationId: runtime.id,
          email: installation.email_normalized,
          now: input.now,
        });
      }
      counts[outcome]++;
    }
    return counts;
  });
}
