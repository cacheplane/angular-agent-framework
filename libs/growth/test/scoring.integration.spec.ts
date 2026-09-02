import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import {
  createDatabaseExecutor,
  recomputeContactScore,
  type GrowthScoreContentRegistry,
  type SqlExecutor,
} from '../src/index.ts';
// The repository-level migration CLI is deliberately outside the Nx library.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { applyMigrations } from '../../../scripts/apply-migrations.mts';

const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
const describeDatabase =
  process.env['GROWTH_INTEGRATION'] === '1' && testDatabaseUrl
    ? describe
    : describe.skip;

describeDatabase(
  testDatabaseUrl
    ? 'growth scoring against TEST_DATABASE_URL'
    : 'growth scoring intentionally skipped: TEST_DATABASE_URL is not set',
  () => {
    let executor: SqlExecutor;

    beforeAll(async () => {
      if (!testDatabaseUrl) {
        throw new Error(
          'TEST_DATABASE_URL is required for growth integration tests'
        );
      }
      executor = createDatabaseExecutor(testDatabaseUrl);
      await applyMigrations({
        directory: resolve(process.cwd(), 'migrations'),
        executor,
      });
    });

    afterAll(async () => {
      await executor?.close?.();
    });

    it('scores only direct and linked anonymous activity for a contact', async () => {
      const contactId = randomUUID();
      const otherContactId = randomUUID();
      const linkedProjectId = randomUUID();
      const unlinkedProjectId = randomUUID();
      const eventPrefix = `scoring-integration:${contactId}`;
      const claimedAt = new Date('2099-01-01T00:00:00.000Z');
      const registry: GrowthScoreContentRegistry = {
        version: 'content-registry:v1',
        entries: [],
      };

      try {
        await executor.execute(
          `insert into growth_contacts (
             id, email_lookup_hmac, email_hmac_key_version, source
           ) values
             ($1, $3, 1, 'scoring-integration'),
             ($2, $4, 1, 'scoring-integration')`,
          [
            contactId,
            otherContactId,
            `scoring-integration:${contactId}`,
            `scoring-integration:${otherContactId}`,
          ]
        );
        await executor.execute(
          `insert into growth_projects (
             id, contact_id, claim_key_hash, claim_consumed_at, claim_method
           )
           values
             ($1, $3, $4, $7, 'one_time_secret'),
             ($2, $5, $6, null, null)`,
          [
            linkedProjectId,
            unlinkedProjectId,
            contactId,
            `scoring-integration:${linkedProjectId}`,
            otherContactId,
            `scoring-integration:${unlinkedProjectId}`,
            claimedAt,
          ]
        );
        await executor.execute(
          `insert into growth_activity (
             event_key, contact_id, project_id, kind, occurred_at, data
           ) values
             ($1, $6, null, 'docs:install_command_copied', now(),
              '{"qualifying_projection":true}'::jsonb),
             ($2, null, $8, 'transport.connected', now(),
              '{"qualifying_projection":true}'::jsonb),
             ($3, null, $9, 'runtime.first_stream_completed', now(),
              '{"qualifying_projection":true}'::jsonb),
             ($4, $7, $8, 'thread.persisted', now(),
              '{"qualifying_projection":true}'::jsonb),
             ($5, $6, $8, 'project.claimed', $10,
              jsonb_build_object(
                'claim_method', 'one_time_secret',
                'relationship', 'self_claimed_project'
              ))`,
          [
            `${eventPrefix}:direct`,
            `${eventPrefix}:linked-anonymous`,
            `${eventPrefix}:unlinked-anonymous`,
            `${eventPrefix}:conflicting-dual-attribution`,
            `${eventPrefix}:claim`,
            contactId,
            otherContactId,
            linkedProjectId,
            unlinkedProjectId,
            claimedAt,
          ]
        );

        const result = await recomputeContactScore(executor, {
          contactId,
          contentRegistry: registry,
        });

        expect(result.score).toBe(20);
        expect(result.reasons.map(({ code }) => code).sort()).toEqual([
          'docs.install_command_copied',
          'transport.connected',
        ]);
      } finally {
        await executor.execute(
          `delete from growth_activity where event_key like $1 || '%'`,
          [eventPrefix]
        );
        await executor.execute(
          'delete from growth_projects where id = any($1::uuid[])',
          [[linkedProjectId, unlinkedProjectId]]
        );
        await executor.execute(
          'delete from growth_contacts where id = any($1::uuid[])',
          [[contactId, otherContactId]]
        );
      }
    });
  }
);
