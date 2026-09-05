import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import {
  createDatabaseExecutor,
  type SqlExecutor,
} from '../src/lib/database.ts';
import type { CollectionBatchV1 } from '../src/lib/observability/contracts.ts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { applyMigrations } from '../../../scripts/apply-migrations.mts';
export const evidenceKeys = {
  active: {
    version: 777,
    secret: 'observation-fixture-secret-at-least-32-bytes',
  },
};
/** Remove only fences created for this exact synthetic contact before deleting its fixture rows. */
export async function cleanContactObservationFences(
  db: SqlExecutor,
  contactId: string
) {
  await db.execute(
    `delete from growth_observation_redactions r where r.selector_kind='email' and (r.key_version,r.selector_key) in (
    select email_hmac_key_version,email_lookup_hmac from growth_contacts where id=$1
    union all select (data->>'key_version')::smallint,data->>'digest' from growth_activity where contact_id=$1 and kind='contact.lookup_alias_added'
  )`,
    [contactId]
  );
}
export async function evidenceDatabase(): Promise<SqlExecutor> {
  if (!process.env['TEST_DATABASE_URL'])
    throw new Error('TEST_DATABASE_URL required');
  const db = createDatabaseExecutor(process.env['TEST_DATABASE_URL']);
  await applyMigrations({ directory: resolve('migrations'), executor: db });
  return db;
}
export function evidenceFixture(now = new Date()): CollectionBatchV1 {
  return {
    schemaVersion: 1,
    events: [
      {
        eventId: randomUUID(),
        kind: 'package.installed',
        occurredAt: now.toISOString(),
        collectorVersion: '1',
        subject: {
          id: randomUUID(),
          namespace: 'installation',
          scope: 'persistent',
        },
        properties: {
          packageName: '@threadplane/chat',
          packageVersion: '1',
          osFamily: 'linux',
          architecture: 'x64',
          nodeVersion: '22',
          environment: 'ci',
          environmentEvidence: 'generic_ci',
        },
        identity: {
          gitEmail: `${randomUUID()}@example.invalid`,
          gitDisplayName: 'Synthetic Developer',
          gitConfigOrigin: 'global',
        },
      },
    ],
  };
}
export async function cleanEvidence(
  db: SqlExecutor,
  externalIds: string[],
  operationIds: string[] = []
) {
  await db.execute(
    `delete from growth_observation_redactions where selector_kind='subject' and selector_key in (select id::text from growth_observation_subjects where external_id=any($1::uuid[]))`,
    [externalIds]
  );
  await db.execute(
    'delete from growth_observation_subjects where external_id=any($1::uuid[])',
    [externalIds]
  );
  await db.execute(
    'delete from growth_observation_operations where operation_id=any($1::uuid[])',
    [operationIds]
  );
}
