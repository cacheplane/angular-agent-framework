import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import {
  acceptFormSubmission,
  createDatabaseExecutor,
  type AcceptFormSubmissionInput,
  type EmailHmacKeyring,
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

const keyring: EmailHmacKeyring = {
  active: {
    version: 197,
    secret: 'task8-integration-email-hmac-secret-32-bytes',
  },
};

describeDatabase(
  testDatabaseUrl
    ? 'growth form acceptance against TEST_DATABASE_URL'
    : 'growth form acceptance intentionally skipped: TEST_DATABASE_URL is not set',
  () => {
    let executor: SqlExecutor;

    beforeAll(async () => {
      if (!testDatabaseUrl) {
        throw new Error('TEST_DATABASE_URL is required for integration tests');
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

    async function cleanup(email: string): Promise<void> {
      const contacts = await executor.execute<{ id: string }>(
        'select id from growth_contacts where email_normalized = $1',
        [email]
      );
      for (const { id } of contacts.rows) {
        await executor.execute(
          `delete from growth_artifacts
           where contact_id = $1
              or job_id in (select id from growth_jobs where contact_id = $1)`,
          [id]
        );
        await executor.execute(
          'delete from growth_activity where contact_id = $1',
          [id]
        );
        await executor.execute(
          'delete from growth_jobs where contact_id = $1',
          [id]
        );
        await executor.execute(
          'delete from growth_projects where contact_id = $1',
          [id]
        );
        await executor.execute('delete from growth_contacts where id = $1', [
          id,
        ]);
      }
    }

    function submission(
      email: string,
      submissionId: string,
      paper: 'chat' | 'render',
      occurredAt: Date
    ): AcceptFormSubmissionInput {
      return {
        submissionId,
        email,
        form: { kind: 'whitepaper', paper },
        source: 'integration',
        sourceForm: 'whitepaper',
        noticeText: 'Exact Task 8 integration notice.',
        noticeVersion: 'task8-integration.whitepaper',
        policyVersion: 'task8-integration',
        occurredAt,
        keyring,
      };
    }

    async function counts(email: string, submissionId: string) {
      const result = await executor.execute<{
        contacts: string;
        activities: string;
        jobs: string;
      }>(
        `select
           (select count(*)::text from growth_contacts
             where email_normalized = $1) as contacts,
           (select count(*)::text from growth_activity
             where event_key = 'form:' || $2 || ':accepted'
               and contact_id in (
                 select id from growth_contacts where email_normalized = $1
               )) as activities,
           (select count(*)::text from growth_jobs
             where idempotency_key like 'form:' || $2 || ':%'
               and contact_id in (
                 select id from growth_contacts where email_normalized = $1
               )) as jobs`,
        [email, submissionId]
      );
      return result.rows[0];
    }

    async function collisionCounts(
      emails: readonly string[],
      submissionId: string
    ) {
      const result = await executor.execute<{
        contacts: string;
        activities: string;
        jobs: string;
        orphan_activities: string;
        orphan_jobs: string;
      }>(
        `select
           (select count(*)::text from growth_contacts
             where email_normalized = any($1::text[])) as contacts,
           (select count(*)::text from growth_activity
             where event_key = 'form:' || $2 || ':accepted') as activities,
           (select count(*)::text from growth_jobs
             where idempotency_key like 'form:' || $2 || ':%') as jobs,
           (select count(*)::text
              from growth_activity activity
              left join growth_contacts contact on contact.id = activity.contact_id
             where activity.event_key = 'form:' || $2 || ':accepted'
               and contact.id is null) as orphan_activities,
           (select count(*)::text
              from growth_jobs job
              left join growth_contacts contact on contact.id = job.contact_id
             where job.idempotency_key like 'form:' || $2 || ':%'
               and contact.id is null) as orphan_jobs`,
        [emails, submissionId]
      );
      return result.rows[0];
    }

    it('commits one contact, activity, and job set for concurrent identical UUIDs', async () => {
      const submissionId = randomUUID();
      const email = `task8-identical-${randomUUID()}@example.com`;
      try {
        const [first, replay] = await Promise.all([
          acceptFormSubmission(
            executor,
            submission(
              email,
              submissionId,
              'chat',
              new Date('2097-09-01T12:00:00Z')
            )
          ),
          acceptFormSubmission(
            executor,
            submission(
              email,
              submissionId,
              'chat',
              new Date('2097-09-01T12:00:01Z')
            )
          ),
        ]);

        expect(first).toMatchObject({ accepted: true, approved: true });
        expect(replay).toMatchObject({ accepted: true, approved: true });
        expect(await counts(email, submissionId)).toEqual({
          contacts: '1',
          activities: '1',
          jobs: '3',
        });
      } finally {
        await cleanup(email);
      }
    });

    it('rolls back a conflicting payload for the same UUID without orphan rows', async () => {
      const submissionId = randomUUID();
      const emails = [
        `task8-conflict-a-${randomUUID()}@example.com`,
        `task8-conflict-b-${randomUUID()}@example.com`,
      ] as const;
      try {
        const results = await Promise.allSettled([
          acceptFormSubmission(
            executor,
            submission(
              emails[0],
              submissionId,
              'chat',
              new Date('2097-09-01T12:00:00Z')
            )
          ),
          acceptFormSubmission(
            executor,
            submission(
              emails[1],
              submissionId,
              'render',
              new Date('2097-09-01T12:00:01Z')
            )
          ),
        ]);

        expect(
          results.filter(({ status }) => status === 'fulfilled')
        ).toHaveLength(1);
        expect(
          results.filter(({ status }) => status === 'rejected')
        ).toHaveLength(1);
        const winnerIndex = results.findIndex(
          ({ status }) => status === 'fulfilled'
        );
        const loserIndex = winnerIndex === 0 ? 1 : 0;
        expect(await counts(emails[winnerIndex] ?? '', submissionId)).toEqual({
          contacts: '1',
          activities: '1',
          jobs: '3',
        });
        expect(await counts(emails[loserIndex] ?? '', submissionId)).toEqual({
          contacts: '0',
          activities: '0',
          jobs: '0',
        });
        expect(await collisionCounts(emails, submissionId)).toEqual({
          contacts: '1',
          activities: '1',
          jobs: '3',
          orphan_activities: '0',
          orphan_jobs: '0',
        });
      } finally {
        await cleanup(emails[0]);
        await cleanup(emails[1]);
      }
    });
  }
);
