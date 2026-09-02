import { randomUUID } from 'node:crypto';

import {
  createDatabaseExecutor,
  type SqlExecutor,
} from '@threadplane-internal/growth';

import {
  cleanupGrowthFixture,
  parseDogfoodManifest,
  setupGrowthFixture,
  type DogfoodManifest,
} from './dogfood-harness.mts';

const integrationEnabled =
  process.env['LIFECYCLE_DOGFOOD_ROLLBACK_INTEGRATION'] === 'true';
const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
const testDatabaseSentinel =
  process.env['LIFECYCLE_DOGFOOD_TEST_DATABASE_SENTINEL'];
const TEST_SENTINEL = /^threadplane:growth-test-target:[A-Za-z0-9_-]{3,160}$/u;
const describeDatabase = integrationEnabled ? describe : describe.skip;

function rollbackFixture(sentinel: string): DogfoodManifest {
  const fixture = parseDogfoodManifest({
    schema_version: 1,
    environment_label: 'preview-lifecycle-dogfood',
    fixture_namespace: 'threadplane-preview-dogfood-v1',
    targets: {
      lifecycle_instance_a_deployment_id: 'dpl_rollback_a',
      lifecycle_instance_b_deployment_id: 'dpl_rollback_b',
      growth_database_sentinel:
        'threadplane:growth-target:rollback-placeholder',
    },
    growth: {
      alias: 'cleanup-growth-fixtures-01',
      expected_count: 4,
      contact_id: '10000000-0000-4000-8000-000000000101',
      project_id: '10000000-0000-4000-8000-000000000102',
      posthog_distinct_id: '10000000-0000-4000-8000-000000000103',
      job_id: '10000000-0000-4000-8000-000000000104',
      submission_id: '10000000-0000-4000-8000-000000000105',
      activity_event_key: 'form:10000000-0000-4000-8000-000000000105:accepted',
      job_idempotency_key:
        'dogfood:rollback-fixture-01:10000000-0000-4000-8000-000000000104',
    },
    dawn: {
      alias: 'cleanup-dawn-fixtures-01',
      expected_count: 4,
      threads: [
        {
          alias: 'thread-dogfood-01',
          id: '10000000-0000-4000-8000-000000000201',
        },
        {
          alias: 'duplicate-fixture-01-a',
          id: '10000000-0000-4000-8000-000000000202',
        },
        {
          alias: 'duplicate-fixture-01-b',
          id: '10000000-0000-4000-8000-000000000203',
        },
        {
          alias: 'abort-fixture-01',
          id: '10000000-0000-4000-8000-000000000204',
        },
      ],
    },
  });
  return {
    ...fixture,
    targets: { ...fixture.targets, growth_database_sentinel: sentinel },
  };
}

async function countExactFixture(
  database: SqlExecutor,
  fixture: DogfoodManifest
): Promise<number> {
  const result = await database.execute<{ count: string }>(
    `select (
       (select count(*) from growth_contacts
        where id = $1::uuid) +
       (select count(*) from growth_projects
        where id = $2::uuid or contact_id = $1::uuid) +
       (select count(*) from growth_activity
        where contact_id = $1::uuid or project_id = $2::uuid) +
       (select count(*) from growth_jobs
        where id = $3::uuid
           or contact_id = $1::uuid
           or project_id = $2::uuid) +
       (select count(*) from growth_artifacts
        where job_id = $3::uuid
           or contact_id = $1::uuid
           or project_id = $2::uuid)
     )::text as count`,
    [
      fixture.growth.contact_id,
      fixture.growth.project_id,
      fixture.growth.job_id,
    ]
  );
  return Number(result.rows[0]?.count);
}

describeDatabase('dogfood growth transaction rollback', () => {
  let database: SqlExecutor;
  let databaseIdentityVerified = false;
  let fixture: DogfoodManifest;
  let fixtureMayExist = false;
  let setupDdlAttempted = false;
  let cleanupDdlAttempted = false;
  const suffix = randomUUID().replaceAll('-', '');
  const setupFunction = `dogfood_setup_rollback_${suffix}`;
  const setupTrigger = `dogfood_setup_rollback_${suffix}`;
  const cleanupFunction = `dogfood_cleanup_rollback_${suffix}`;
  const cleanupTrigger = `dogfood_cleanup_rollback_${suffix}`;

  async function dropDdl(
    tableName: 'growth_contacts' | 'growth_jobs',
    triggerName: string,
    functionName: string
  ) {
    await database.execute(
      `drop trigger if exists ${triggerName} on ${tableName}`
    );
    await database.execute(`drop function if exists ${functionName}()`);
  }

  beforeAll(async () => {
    if (
      !testDatabaseUrl ||
      !testDatabaseSentinel ||
      !TEST_SENTINEL.test(testDatabaseSentinel)
    ) {
      throw new Error(
        'A test-only database URL and growth-test-target sentinel are required'
      );
    }
    database = createDatabaseExecutor(testDatabaseUrl);
    const identity = await database.execute<{ target_sentinel: string | null }>(
      `select shobj_description(database.oid, 'pg_database') as target_sentinel
       from pg_database as database
       where database.datname = current_database()`
    );
    if (
      identity.rows.length !== 1 ||
      identity.rows[0]?.target_sentinel !== testDatabaseSentinel
    ) {
      throw new Error('Disposable database sentinel mismatch');
    }
    databaseIdentityVerified = true;
    fixture = rollbackFixture(testDatabaseSentinel);
    expect(await countExactFixture(database, fixture)).toBe(0);
  });

  afterAll(async () => {
    let teardownError: unknown;
    const attempt = async (operation: () => Promise<void>) => {
      try {
        await operation();
      } catch (error) {
        teardownError ??= error;
      }
    };
    if (databaseIdentityVerified && cleanupDdlAttempted) {
      await attempt(() =>
        dropDdl('growth_contacts', cleanupTrigger, cleanupFunction)
      );
    }
    if (databaseIdentityVerified && setupDdlAttempted) {
      await attempt(() => dropDdl('growth_jobs', setupTrigger, setupFunction));
    }
    if (databaseIdentityVerified && fixtureMayExist) {
      await attempt(async () => {
        const count = await countExactFixture(database, fixture);
        if (count === 4) await cleanupGrowthFixture(database, fixture);
        else if (count !== 0) {
          throw new Error('Unsafe disposable fixture teardown count');
        }
      });
    }
    await attempt(async () => database?.close?.());
    if (teardownError) throw teardownError;
  });

  it('rolls back every exact fixture row when setup postflight observes five rows', async () => {
    setupDdlAttempted = true;
    try {
      await database.execute(
        `create function ${setupFunction}()
         returns trigger
         language plpgsql
         as $function$
         begin
           insert into growth_activity (
             event_key, contact_id, project_id, kind, occurred_at, data
           ) values (
             'dogfood:rollback-extra:' || new.id::text,
             new.contact_id,
             new.project_id,
             'contact.form_submission',
             now(),
             jsonb_build_object(
               'fixture_namespace', 'threadplane-preview-dogfood-v1',
               'rollback_probe', true
             )
           );
           return new;
         end
         $function$`
      );
      await database.execute(
        `create trigger ${setupTrigger}
         after insert on growth_jobs
         for each row
         when (new.id = '10000000-0000-4000-8000-000000000104'::uuid)
         execute function ${setupFunction}()`
      );

      await expect(setupGrowthFixture(database, fixture)).rejects.toThrow(
        'growth_setup_postflight_mismatch'
      );
      expect(await countExactFixture(database, fixture)).toBe(0);
    } finally {
      if (databaseIdentityVerified && setupDdlAttempted) {
        await dropDdl('growth_jobs', setupTrigger, setupFunction);
        setupDdlAttempted = false;
      }
    }
  });

  it('rolls back destructive cleanup when postflight observes a reinserted owner', async () => {
    await setupGrowthFixture(database, fixture);
    fixtureMayExist = true;
    cleanupDdlAttempted = true;
    await database.execute(
      `create function ${cleanupFunction}()
       returns trigger
       language plpgsql
       as $function$
       begin
         insert into growth_contacts (
           id, email_normalized, email_lookup_hmac, email_hmac_key_version,
           display_name, company_name, company_domain, outreach_approved_at,
           source, created_at, updated_at, deleted_at
         ) values (
           old.id, old.email_normalized, old.email_lookup_hmac,
           old.email_hmac_key_version, old.display_name, old.company_name,
           old.company_domain, old.outreach_approved_at, old.source,
           old.created_at, old.updated_at, old.deleted_at
         );
         return old;
       end
       $function$`
    );
    await database.execute(
      `create trigger ${cleanupTrigger}
       after delete on growth_contacts
       for each row
       when (old.id = '10000000-0000-4000-8000-000000000101'::uuid)
       execute function ${cleanupFunction}()`
    );

    await expect(cleanupGrowthFixture(database, fixture)).rejects.toThrow(
      'growth_cleanup_postflight_mismatch'
    );
    expect(await countExactFixture(database, fixture)).toBe(4);
  });
});
