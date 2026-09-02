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
          `insert into growth_projects (id, contact_id, claim_key_hash)
           values
             ($1, $3, $4),
             ($2, $5, $6)`,
          [
            linkedProjectId,
            unlinkedProjectId,
            contactId,
            `scoring-integration:${linkedProjectId}`,
            otherContactId,
            `scoring-integration:${unlinkedProjectId}`,
          ]
        );
        await executor.execute(
          `insert into growth_activity (
             event_key, contact_id, project_id, kind, occurred_at, data
           ) values
             ($1, $5, null, 'docs:install_command_copied', now(), '{}'),
             ($2, null, $7, 'transport.connected', now(), '{}'),
             ($3, null, $8, 'runtime.first_stream_completed', now(), '{}'),
             ($4, $6, $7, 'thread.persisted', now(), '{}')`,
          [
            `${eventPrefix}:direct`,
            `${eventPrefix}:linked-anonymous`,
            `${eventPrefix}:unlinked-anonymous`,
            `${eventPrefix}:conflicting-dual-attribution`,
            contactId,
            otherContactId,
            linkedProjectId,
            unlinkedProjectId,
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
