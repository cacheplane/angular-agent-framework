import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import {
  JobLeaseConflictError,
  completeLeasedJob,
  createDatabaseExecutor,
  leaseDueJobs,
  materializeCampaignEnrollment,
  renewJobLease,
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
    ? 'growth job concurrency against TEST_DATABASE_URL'
    : 'growth job concurrency intentionally skipped: TEST_DATABASE_URL is not set',
  () => {
    let executor: SqlExecutor;
    const contactIds = new Set<string>();

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

    afterEach(async () => {
      for (const contactId of contactIds) {
        await executor.execute(
          `delete from growth_artifacts
           where contact_id = $1
              or job_id in (select id from growth_jobs where contact_id = $1)`,
          [contactId]
        );
        await executor.execute(
          'delete from growth_activity where contact_id = $1',
          [contactId]
        );
        await executor.execute(
          'delete from growth_jobs where contact_id = $1',
          [contactId]
        );
        await executor.execute('delete from growth_contacts where id = $1', [
          contactId,
        ]);
      }
      contactIds.clear();
      await executor.execute(
        "delete from growth_activity where event_key = 'campaign:v1:configuration'"
      );
    });

    afterAll(async () => {
      await executor?.close?.();
    });

    async function createContact(approvedAt: Date): Promise<string> {
      const contactId = randomUUID();
      contactIds.add(contactId);
      await executor.execute(
        `insert into growth_contacts (
           id, email_normalized, email_lookup_hmac,
           email_hmac_key_version, outreach_approved_at, source
         ) values ($1, $2, $3, 1, $4, 'concurrency-integration')`,
        [
          contactId,
          `${contactId}@example.com`,
          `concurrency-integration:${contactId}`,
          approvedAt,
        ]
      );
      await executor.execute(
        `insert into growth_activity (
           event_key, contact_id, kind, occurred_at, data
         ) values (
           $1, $2, 'form.outreach_approved', $3,
           jsonb_build_object(
             'source_form', 'pricing',
             'verification', 'server_verified'
           )
         )`,
        [`concurrency-integration:approval:${contactId}`, contactId, approvedAt]
      );
      return contactId;
    }

    it('does not duplicate enrollment under concurrent scheduler runs', async () => {
      const launchAt = new Date('2097-12-01T00:00:00.000Z');
      const contactId = await createContact(launchAt);
      const input = {
        enrollmentEnabled: true,
        enrollmentStartAt: launchAt,
        now: launchAt,
        batchSize: 10,
      };

      await Promise.all([
        materializeCampaignEnrollment(executor, input),
        materializeCampaignEnrollment(executor, input),
        materializeCampaignEnrollment(executor, input),
      ]);

      const inventory = await executor.execute<{
        activities: string;
        jobs: string;
      }>(
        `select
           (select count(*)::text from growth_activity
            where contact_id = $1 and kind = 'campaign.enrolled:v1') as activities,
           (select count(*)::text from growth_jobs
            where contact_id = $1 and kind = 'send_step') as jobs`,
        [contactId]
      );
      expect(inventory.rows).toEqual([{ activities: '1', jobs: '3' }]);
    });

    it('leases each job once across workers and safely reclaims an expired lease', async () => {
      const availableAt = new Date('2098-01-01T00:00:00.000Z');
      const contactId = await createContact(availableAt);
      const jobIds = Array.from({ length: 8 }, () => randomUUID());
      for (const [index, jobId] of jobIds.entries()) {
        await executor.execute(
          `insert into growth_jobs (
             id, kind, contact_id, status, available_at, idempotency_key
           ) values ($1, 'enrich', $2, 'pending', $3, $4)`,
          [jobId, contactId, availableAt, `enrich:${jobId}:${index}`]
        );
      }

      const leaseInput = {
        kinds: ['enrich'],
        now: availableAt,
        batchSize: 4,
        leaseDurationMs: 60_000,
        campaignEnabled: false,
      };
      const [worker1, worker2] = await Promise.all([
        leaseDueJobs(executor, leaseInput),
        leaseDueJobs(executor, leaseInput),
      ]);
      const leasedIds = [...worker1, ...worker2].map(({ id }) => id);
      expect(new Set(leasedIds).size).toBe(8);
      expect(new Set(leasedIds)).toEqual(new Set(jobIds));

      const reclaimed = await leaseDueJobs(executor, {
        ...leaseInput,
        now: new Date('2098-01-01T00:01:00.001Z'),
        batchSize: 1,
      });
      expect(reclaimed).toHaveLength(1);
      const reclaimedJob = reclaimed[0];
      const expired = [...worker1, ...worker2].find(
        ({ id }) => id === reclaimedJob?.id
      );
      if (!expired?.leaseToken || !reclaimedJob) {
        throw new Error('reclaimed job must have an earlier lease token');
      }
      expect(reclaimedJob.leaseToken).not.toBe(expired.leaseToken);
      expect(reclaimedJob.attempts).toBe(2);

      await expect(
        renewJobLease(executor, {
          jobId: expired.id,
          leaseToken: expired.leaseToken,
          now: new Date('2098-01-01T00:01:00.002Z'),
          leaseDurationMs: 60_000,
        })
      ).resolves.toBeNull();
      await expect(
        completeLeasedJob(executor, {
          jobId: expired.id,
          leaseToken: expired.leaseToken,
          now: new Date('2098-01-01T00:01:00.002Z'),
        })
      ).rejects.toBeInstanceOf(JobLeaseConflictError);
    });
  }
);
