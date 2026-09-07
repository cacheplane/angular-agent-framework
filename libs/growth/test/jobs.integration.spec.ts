import { randomUUID } from 'node:crypto';
import { cleanContactObservationFences } from './observability-fixtures.ts';
import { resolve } from 'node:path';

import {
  JobLeaseConflictError,
  authorizeLeasedJobForSubmission,
  createDatabaseExecutor,
  deferLeasedJob,
  deleteContact,
  leaseDueJobs,
  markProviderAcceptanceUnknown,
  materializeCampaignEnrollment,
  persistJobArtifact,
  recordProviderAcceptance,
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
    ? 'growth jobs against TEST_DATABASE_URL'
    : 'growth jobs intentionally skipped: TEST_DATABASE_URL is not set',
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
        await cleanContactObservationFences(executor, contactId);
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

    async function createContact(
      approvedAt: Date,
      approval: 'form' | 'none' | 'unallowlisted' | 'mismatched' = 'form'
    ): Promise<string> {
      const contactId = randomUUID();
      contactIds.add(contactId);
      await executor.execute(
        `insert into growth_contacts (
           id, email_normalized, email_lookup_hmac,
           email_hmac_key_version, outreach_approved_at, source
         ) values ($1, $2, $3, 1, $4, 'jobs-integration')`,
        [
          contactId,
          `${contactId}@example.com`,
          `jobs-integration:${contactId}`,
          approvedAt,
        ]
      );
      if (approval !== 'none') {
        await executor.execute(
          `insert into growth_activity (
             event_key, contact_id, kind, occurred_at, data
           ) values ($1, $2, $3, $4, $5::jsonb)`,
          [
            `jobs-integration:approval:${contactId}`,
            contactId,
            approval === 'unallowlisted'
              ? 'contact.imported_approval'
              : 'form.outreach_approved',
            approval === 'mismatched'
              ? new Date(approvedAt.getTime() + 1)
              : approvedAt,
            JSON.stringify({
              source_form: 'pricing',
              verification: 'server_verified',
            }),
          ]
        );
      }
      return contactId;
    }

    it('enrolls only the immutable post-launch cohort and remains idempotent', async () => {
      const launchAt = new Date('2097-09-01T00:00:00.000Z');
      const enrollmentAt = new Date('2097-09-01T12:00:00.000Z');
      const before = await createContact(new Date('2097-08-31T23:59:59.999Z'));
      const eligible = await createContact(
        new Date('2097-09-01T00:00:00.000Z')
      );
      const stopped = await createContact(new Date('2097-09-01T00:00:00.000Z'));
      const timestampOnly = await createContact(
        new Date('2097-09-01T00:00:00.000Z'),
        'none'
      );
      const mismatched = await createContact(
        new Date('2097-09-01T00:00:00.000Z'),
        'mismatched'
      );
      const unallowlisted = await createContact(
        new Date('2097-09-01T00:00:00.000Z'),
        'unallowlisted'
      );
      await executor.execute(
        `insert into growth_activity (
           event_key, contact_id, kind, occurred_at, data
         ) values ($1, $2, 'unsubscribe', $3, '{}')`,
        [
          `jobs-integration:stop:${stopped}`,
          stopped,
          new Date('2097-09-01T00:00:01.000Z'),
        ]
      );

      const disabled = await materializeCampaignEnrollment(executor, {
        enrollmentEnabled: false,
        enrollmentStartAt: launchAt,
        now: enrollmentAt,
        batchSize: 10,
      });
      expect(disabled.createdJobs).toBe(0);

      const first = await materializeCampaignEnrollment(executor, {
        enrollmentEnabled: true,
        enrollmentStartAt: launchAt,
        now: enrollmentAt,
        batchSize: 10,
      });
      const replay = await materializeCampaignEnrollment(executor, {
        enrollmentEnabled: true,
        enrollmentStartAt: launchAt,
        now: new Date('2097-09-01T12:01:00.000Z'),
        batchSize: 10,
      });

      expect(first).toEqual({ enrolledContactIds: [eligible], createdJobs: 3 });
      expect(replay).toEqual({ enrolledContactIds: [], createdJobs: 0 });
      const activities = await executor.execute<{
        contact_id: string;
        count: string;
      }>(
        `select contact_id, count(*)::text as count
         from growth_activity
         where kind = 'campaign.enrolled:v1'
           and contact_id = any($1::uuid[])
         group by contact_id`,
        [[before, eligible, stopped, timestampOnly, mismatched, unallowlisted]]
      );
      expect(activities.rows).toEqual([{ contact_id: eligible, count: '1' }]);
      const provenance = await executor.execute<{
        data: Record<string, unknown>;
      }>(
        `select data
         from growth_activity
         where contact_id = $1 and kind = 'campaign.enrolled:v1'`,
        [eligible]
      );
      expect(provenance.rows[0]?.data).toMatchObject({
        approval_event_key: `jobs-integration:approval:${eligible}`,
        approval_kind: 'form.outreach_approved',
      });
      const jobs = await executor.execute<{
        idempotency_key: string;
        available_at: Date;
      }>(
        `select idempotency_key, available_at
         from growth_jobs
         where contact_id = $1
         order by idempotency_key`,
        [eligible]
      );
      expect(jobs.rows.map(({ idempotency_key }) => idempotency_key)).toEqual([
        `campaign:v1:${eligible}:step:1`,
        `campaign:v1:${eligible}:step:2`,
        `campaign:v1:${eligible}:step:3`,
      ]);
      expect(
        jobs.rows.every(
          ({ available_at }) =>
            new Date(available_at).toISOString() === '2097-09-02T14:00:00.000Z'
        )
      ).toBe(true);
    });

    it('permanently excludes contacts with a terminal legacy marker', async () => {
      const launchAt = new Date('2097-10-01T00:00:00.000Z');
      const approvedAt = new Date('2097-10-01T00:00:00.000Z');
      const enrollmentAt = new Date('2097-10-01T12:00:00.000Z');
      const imported = await createContact(approvedAt);
      const control = await createContact(approvedAt);
      await executor.execute(
        `insert into growth_jobs (
           kind, contact_id, status, available_at, idempotency_key, payload
         ) values (
           'legacy', $1, 'cancelled', $2,
           $3,
           '{"legacy_type":"contact_marker","provider":"resend"}'::jsonb
         )`,
        [imported, approvedAt, `legacy:resend:contact:${imported}`]
      );

      const first = await materializeCampaignEnrollment(executor, {
        enrollmentEnabled: true,
        enrollmentStartAt: launchAt,
        now: enrollmentAt,
        batchSize: 10,
      });

      expect(first).toEqual({ enrolledContactIds: [control], createdJobs: 3 });
      const firstActivities = await executor.execute<{
        contact_id: string;
        count: string;
      }>(
        `select contact_id, count(*)::text as count
         from growth_activity
         where kind = 'campaign.enrolled:v1'
           and contact_id = any($1::uuid[])
         group by contact_id`,
        [[imported, control]]
      );
      expect(firstActivities.rows).toEqual([
        { contact_id: control, count: '1' },
      ]);
      const firstJobs = await executor.execute<{
        contact_id: string;
        count: string;
      }>(
        `select contact_id, count(*)::text as count
         from growth_jobs
         where kind = 'send_step'
           and contact_id = any($1::uuid[])
         group by contact_id`,
        [[imported, control]]
      );
      expect(firstJobs.rows).toEqual([{ contact_id: control, count: '3' }]);

      const laterApprovalAt = new Date('2097-10-01T13:00:00.000Z');
      await executor.execute(
        `insert into growth_activity (
           event_key, contact_id, kind, occurred_at, data
         ) values ($1, $2, 'form.outreach_approved', $3, $4::jsonb)`,
        [
          `jobs-integration:approval:later:${imported}`,
          imported,
          laterApprovalAt,
          JSON.stringify({
            source_form: 'pricing',
            verification: 'server_verified',
          }),
        ]
      );
      await executor.execute(
        `update growth_contacts
         set outreach_approved_at = $2
         where id = $1`,
        [imported, laterApprovalAt]
      );

      const replay = await materializeCampaignEnrollment(executor, {
        enrollmentEnabled: true,
        enrollmentStartAt: launchAt,
        now: new Date('2097-10-01T13:01:00.000Z'),
        batchSize: 10,
      });

      expect(replay).toEqual({ enrolledContactIds: [], createdJobs: 0 });
      const importedActivity = await executor.execute<{ count: string }>(
        `select count(*)::text as count
         from growth_activity
         where contact_id = $1 and kind = 'campaign.enrolled:v1'`,
        [imported]
      );
      expect(importedActivity.rows).toEqual([{ count: '0' }]);
      const importedJobs = await executor.execute<{ count: string }>(
        `select count(*)::text as count
         from growth_jobs
         where contact_id = $1 and kind = 'send_step'`,
        [imported]
      );
      expect(importedJobs.rows).toEqual([{ count: '0' }]);
    });

    it('anchors business dates across DST and never compresses after late acceptance or pause', async () => {
      const enrollmentAt = new Date('2026-03-05T19:00:00.000Z');
      const contactId = await createContact(enrollmentAt);
      await executor.transaction(async (transaction) => {
        await transaction.execute("set local time zone 'America/Los_Angeles'");
        const sessionExecutor: SqlExecutor = {
          execute: transaction.execute,
          transaction: (operation) => operation(transaction),
        };
        const timezone = await transaction.execute<{ timezone: string }>(
          `select current_setting('TimeZone') as timezone`
        );
        expect(timezone.rows).toEqual([{ timezone: 'America/Los_Angeles' }]);

        await materializeCampaignEnrollment(sessionExecutor, {
          enrollmentEnabled: true,
          enrollmentStartAt: enrollmentAt,
          now: enrollmentAt,
          batchSize: 10,
        });

        for (const now of [
          enrollmentAt,
          new Date('2026-03-06T14:59:59.999Z'),
        ]) {
          expect(
            await leaseDueJobs(sessionExecutor, {
              kinds: ['send_step'],
              now,
              batchSize: 10,
              leaseDurationMs: 60_000,
              campaignEnabled: true,
            })
          ).toEqual([]);
        }
        const beforeAcceptance = await leaseDueJobs(sessionExecutor, {
          kinds: ['send_step'],
          now: new Date('2026-03-06T15:00:00.000Z'),
          batchSize: 10,
          leaseDurationMs: 2 * 60 * 60_000,
          campaignEnabled: true,
        });
        expect(beforeAcceptance.map(({ payload }) => payload['step'])).toEqual([
          1,
        ]);
        const step1 = beforeAcceptance[0];
        if (!step1?.leaseToken)
          throw new Error('step 1 must have a lease token');
        const step1AcceptedAt = new Date('2026-03-06T15:30:00.000Z');
        await expect(
          authorizeLeasedJobForSubmission(sessionExecutor, {
            campaignEnabled: true,
            deliveryEnabled: true,
            jobId: step1.id,
            leaseToken: step1.leaseToken,
            now: new Date('2026-03-06T15:29:00.000Z'),
          })
        ).resolves.toMatchObject({ authorized: true });
        await recordProviderAcceptance(sessionExecutor, {
          jobId: step1.id,
          leaseToken: step1.leaseToken,
          acceptedAt: step1AcceptedAt,
          providerEmailId: `provider:${step1.id}`,
        });

        const anchored = await transaction.execute<{
          available_at: Date;
          step: string;
        }>(
          `select payload->>'step' as step, available_at
           from growth_jobs
           where contact_id = $1 and payload->>'step' in ('2', '3')
           order by payload->>'step'`,
          [contactId]
        );
        expect(
          anchored.rows.map(({ step, available_at }) => [
            step,
            new Date(available_at).toISOString(),
          ])
        ).toEqual([
          ['2', '2026-03-11T14:00:00.000Z'],
          ['3', '2026-03-18T14:00:00.000Z'],
        ]);

        const step2DueAt = new Date('2026-03-11T14:00:00.000Z');
        const earlyStep2 = await leaseDueJobs(sessionExecutor, {
          kinds: ['send_step'],
          now: new Date(step2DueAt.getTime() - 1),
          batchSize: 10,
          leaseDurationMs: 60_000,
          campaignEnabled: true,
        });
        expect(earlyStep2).toEqual([]);
        const step2Lease = await leaseDueJobs(sessionExecutor, {
          kinds: ['send_step'],
          now: new Date('2026-03-13T14:00:00.000Z'),
          batchSize: 10,
          leaseDurationMs: 2 * 60 * 60_000,
          campaignEnabled: true,
        });
        expect(step2Lease.map(({ payload }) => payload['step'])).toEqual([2]);
        const step2 = step2Lease[0];
        if (!step2?.leaseToken)
          throw new Error('step 2 must have a lease token');
        const step2AcceptedAt = new Date('2026-03-13T14:30:00.000Z');
        await expect(
          authorizeLeasedJobForSubmission(sessionExecutor, {
            campaignEnabled: true,
            deliveryEnabled: true,
            jobId: step2.id,
            leaseToken: step2.leaseToken,
            now: new Date('2026-03-13T14:29:00.000Z'),
          })
        ).resolves.toMatchObject({ authorized: true });
        await recordProviderAcceptance(sessionExecutor, {
          jobId: step2.id,
          leaseToken: step2.leaseToken,
          acceptedAt: step2AcceptedAt,
          providerEmailId: `provider:${step2.id}`,
        });

        // Replayed step 1 acceptance must not undo step 2's later anchor.
        await recordProviderAcceptance(sessionExecutor, {
          jobId: step1.id,
          leaseToken: step1.leaseToken,
          acceptedAt: step1AcceptedAt,
          providerEmailId: `provider:${step1.id}`,
        });
        const step3Row = await transaction.execute<{ available_at: Date }>(
          `select available_at
           from growth_jobs
           where idempotency_key = $1`,
          [`campaign:v1:${contactId}:step:3`]
        );
        expect(new Date(step3Row.rows[0].available_at).toISOString()).toBe(
          '2026-03-20T14:00:00.000Z'
        );

        for (const now of [
          new Date('2026-03-19T14:00:00.000Z'),
          new Date('2026-03-20T15:00:00.000Z'),
          new Date('2026-03-21T14:00:00.000Z'),
          new Date('2026-03-22T14:00:00.000Z'),
        ]) {
          expect(
            await leaseDueJobs(sessionExecutor, {
              kinds: ['send_step'],
              now,
              batchSize: 10,
              leaseDurationMs: 60_000,
              campaignEnabled: true,
            })
          ).toEqual([]);
        }

        const afterStep3Due = new Date('2026-03-23T14:00:00.000Z');
        const paused = await leaseDueJobs(sessionExecutor, {
          kinds: ['send_step', 'notify'],
          now: afterStep3Due,
          batchSize: 10,
          leaseDurationMs: 60_000,
          campaignEnabled: false,
        });
        expect(paused).toEqual([]);
        const resumed = await leaseDueJobs(sessionExecutor, {
          kinds: ['send_step'],
          now: afterStep3Due,
          batchSize: 10,
          leaseDurationMs: 60_000,
          campaignEnabled: true,
        });
        expect(resumed.map(({ payload }) => payload['step'])).toEqual([3]);
      });
    });

    it('rechecks the closing send window and a stop before submitting a leased campaign job', async () => {
      const enrollmentAt = new Date('2026-03-05T19:00:00.000Z');
      const contactId = await createContact(enrollmentAt);
      await materializeCampaignEnrollment(executor, {
        enrollmentEnabled: true,
        enrollmentStartAt: enrollmentAt,
        now: enrollmentAt,
        batchSize: 10,
      });
      const [job] = await leaseDueJobs(executor, {
        kinds: ['send_step'],
        now: new Date('2026-03-06T15:59:00.000Z'),
        batchSize: 10,
        leaseDurationMs: 120_000,
        campaignEnabled: true,
      });
      if (!job?.leaseToken) throw new Error('step 1 must be leased');
      await expect(
        authorizeLeasedJobForSubmission(executor, {
          campaignEnabled: true,
          deliveryEnabled: true,
          jobId: job.id,
          leaseToken: job.leaseToken,
          now: new Date('2026-03-06T15:59:59.999Z'),
          currentTime: () => new Date('2026-03-06T16:00:00.000Z'),
        })
      ).resolves.toMatchObject({
        authorized: false,
        reason: 'outside_send_window',
      });
      const authorizations = await executor.execute<{ count: string }>(
        `select count(*)::text as count from growth_activity
         where contact_id = $1 and kind = 'delivery.submission_authorized'`,
        [contactId]
      );
      expect(authorizations.rows).toEqual([{ count: '0' }]);

      const [resumed] = await leaseDueJobs(executor, {
        kinds: ['send_step'],
        now: new Date('2026-03-09T14:00:00.000Z'),
        batchSize: 10,
        leaseDurationMs: 60_000,
        campaignEnabled: true,
      });
      if (!resumed?.leaseToken) throw new Error('step 1 must be leased again');
      await executor.execute(
        `insert into growth_activity (event_key, contact_id, kind, occurred_at, data)
         values ($1, $2, 'unsubscribe', $3, '{}')`,
        [
          `jobs-integration:stop:${contactId}`,
          contactId,
          new Date('2026-03-09T14:00:01.000Z'),
        ]
      );
      await expect(
        authorizeLeasedJobForSubmission(executor, {
          campaignEnabled: true,
          deliveryEnabled: true,
          jobId: resumed.id,
          leaseToken: resumed.leaseToken!,
          now: new Date('2026-03-09T14:00:02.000Z'),
        })
      ).resolves.toMatchObject({ authorized: false });
    });

    it('recovers an unauthorized later lease after safe deferral of an authorized campaign lease', async () => {
      const enrollmentAt = new Date('2026-03-05T19:00:00.000Z');
      const contactId = await createContact(enrollmentAt);
      await materializeCampaignEnrollment(executor, {
        enrollmentEnabled: true,
        enrollmentStartAt: enrollmentAt,
        now: enrollmentAt,
        batchSize: 10,
      });
      const leaseAt = (now: Date) =>
        leaseDueJobs(executor, {
          kinds: ['send_step'],
          now,
          batchSize: 10,
          leaseDurationMs: 120_000,
          campaignEnabled: true,
        });
      const [friday] = await leaseAt(new Date('2026-03-06T15:59:00.000Z'));
      if (!friday?.leaseToken) throw new Error('Friday lease required');
      await expect(
        authorizeLeasedJobForSubmission(executor, {
          campaignEnabled: true,
          deliveryEnabled: true,
          jobId: friday.id,
          leaseToken: friday.leaseToken,
          now: new Date('2026-03-06T15:59:30.000Z'),
        })
      ).resolves.toMatchObject({ authorized: true });
      await deferLeasedJob(executor, {
        jobId: friday.id,
        leaseToken: friday.leaseToken,
        now: new Date('2026-03-06T16:00:00.000Z'),
        availableAt: new Date('2026-03-09T14:00:00.000Z'),
        errorCode: 'outside_send_window',
      });
      const [monday] = await leaseAt(new Date('2026-03-09T14:00:00.000Z'));
      expect(monday?.id).toBe(friday.id);
      expect(monday?.leaseToken).not.toBe(friday.leaseToken);

      // Monday's worker dies before authorization; Friday's event must not
      // make this new lease an ambiguous provider submission.
      const [tuesday] = await leaseAt(new Date('2026-03-10T14:00:00.000Z'));
      expect(tuesday).toMatchObject({
        id: friday.id,
        deliveryStatus: 'not_submitted',
      });
      if (!tuesday?.leaseToken)
        throw new Error('Tuesday recovery lease required');
      expect(tuesday.leaseToken).not.toBe(monday.leaseToken);
      const audit = await executor.execute<{ count: string }>(
        `select count(*)::text as count from growth_activity
         where contact_id = $1 and kind = 'delivery.acceptance_unknown'`,
        [contactId]
      );
      expect(audit.rows).toEqual([{ count: '0' }]);

      // An interruption after authorization on the actual current lease
      // still requires manual reconciliation instead of resubmission.
      await expect(
        authorizeLeasedJobForSubmission(executor, {
          campaignEnabled: true,
          deliveryEnabled: true,
          jobId: tuesday.id,
          leaseToken: tuesday.leaseToken,
          now: new Date('2026-03-10T14:00:30.000Z'),
        })
      ).resolves.toMatchObject({ authorized: true });
      expect(await leaseAt(new Date('2026-03-11T14:00:00.000Z'))).toEqual([]);
      const state = await executor.execute<{
        status: string;
        delivery_status: string;
        last_error_code: string;
      }>(
        'select status, delivery_status, last_error_code from growth_jobs where id = $1',
        [friday.id]
      );
      expect(state.rows).toEqual([
        {
          status: 'failed',
          delivery_status: 'unknown',
          last_error_code: 'worker_interrupted_after_authorization',
        },
      ]);
    });

    it('gates non-campaign work independently and enforces tokened transitions and artifacts', async () => {
      const contactId = await createContact(
        new Date('2097-11-01T00:00:00.000Z')
      );
      const genericJobId = randomUUID();
      const ambiguousJobId = randomUUID();
      const enrichmentJobId = randomUUID();
      const submissionId = randomUUID();
      await executor.execute(
        `insert into growth_jobs (
           id, kind, contact_id, status, available_at, idempotency_key, payload
         ) values
           ($1, 'fulfill', $4, 'pending', $5, $6, '{}'::jsonb),
           ($2, 'notify', $4, 'pending', $5, $7,
            jsonb_build_object('submission_id', $9::text)),
           ($3, 'enrich', $4, 'completed', $5, $8,
            jsonb_build_object('submission_id', $9::text))`,
        [
          genericJobId,
          ambiguousJobId,
          enrichmentJobId,
          contactId,
          new Date('2097-11-01T00:00:00.000Z'),
          `fulfill:${genericJobId}`,
          `notify:${ambiguousJobId}`,
          `enrich:${enrichmentJobId}`,
          submissionId,
        ]
      );
      const leased = await leaseDueJobs(executor, {
        kinds: ['fulfill', 'notify', 'send_step'],
        now: new Date('2097-11-01T00:00:01.000Z'),
        batchSize: 10,
        leaseDurationMs: 60_000,
        campaignEnabled: false,
      });
      expect(leased.map(({ kind }) => kind).sort()).toEqual([
        'fulfill',
        'notify',
      ]);

      const generic = leased.find(({ id }) => id === genericJobId);
      const ambiguous = leased.find(({ id }) => id === ambiguousJobId);
      if (!generic?.leaseToken || !ambiguous?.leaseToken) {
        throw new Error('generic jobs must have lease tokens');
      }
      await expect(
        renewJobLease(executor, {
          jobId: generic.id,
          leaseToken: randomUUID(),
          now: new Date('2097-11-01T00:00:02.000Z'),
          leaseDurationMs: 60_000,
        })
      ).resolves.toBeNull();
      const originalLeaseUntil = generic.leaseUntil;
      const shortenedRenewal = await renewJobLease(executor, {
        jobId: generic.id,
        leaseToken: generic.leaseToken,
        now: new Date('2097-11-01T00:00:02.000Z'),
        leaseDurationMs: 10_000,
      });
      expect(shortenedRenewal?.leaseUntil).toEqual(originalLeaseUntil);
      await expect(
        authorizeLeasedJobForSubmission(executor, {
          campaignEnabled: false,
          deliveryEnabled: true,
          jobId: generic.id,
          leaseToken: generic.leaseToken,
          now: new Date('2097-11-01T00:00:01.500Z'),
        })
      ).resolves.toMatchObject({ authorized: true });
      await expect(
        authorizeLeasedJobForSubmission(executor, {
          campaignEnabled: false,
          deliveryEnabled: true,
          jobId: ambiguous.id,
          leaseToken: ambiguous.leaseToken,
          now: new Date('2097-11-01T00:00:01.500Z'),
        })
      ).resolves.toMatchObject({ authorized: true });
      await expect(
        recordProviderAcceptance(executor, {
          jobId: generic.id,
          leaseToken: randomUUID(),
          acceptedAt: new Date('2097-11-01T00:00:02.000Z'),
          providerEmailId: `provider:${generic.id}`,
        })
      ).rejects.toBeInstanceOf(JobLeaseConflictError);
      const submitted = await recordProviderAcceptance(executor, {
        jobId: generic.id,
        leaseToken: generic.leaseToken,
        acceptedAt: new Date('2097-11-01T00:00:02.000Z'),
        providerEmailId: `provider:${generic.id}`,
      });
      await expect(
        recordProviderAcceptance(executor, {
          jobId: generic.id,
          leaseToken: generic.leaseToken,
          acceptedAt: new Date('2097-11-01T00:00:02.000Z'),
          providerEmailId: `provider:${generic.id}`,
        })
      ).resolves.toMatchObject({
        id: generic.id,
        providerEmailId: `provider:${generic.id}`,
      });
      expect(submitted.deliveryStatus).toBe('submitted');

      const unknown = await markProviderAcceptanceUnknown(executor, {
        jobId: ambiguous.id,
        leaseToken: ambiguous.leaseToken,
        occurredAt: new Date('2097-11-01T00:00:02.000Z'),
        errorCode: 'provider_acceptance_ambiguous',
      });
      expect(unknown).toMatchObject({
        status: 'failed',
        deliveryStatus: 'unknown',
      });

      const content = { score: 30, score_version: 'growth-score:v1' };
      const firstArtifact = await persistJobArtifact(executor, {
        jobId: generic.id,
        kind: 'growth.score',
        schemaVersion: 1,
        content,
      });
      const replayArtifact = await persistJobArtifact(executor, {
        jobId: generic.id,
        kind: 'growth.score',
        schemaVersion: 1,
        content: { score_version: 'growth-score:v1', score: 30 },
      });
      expect(firstArtifact).toMatchObject({ contactId, projectId: null });
      expect(replayArtifact.id).toBe(firstArtifact.id);
      await expect(
        persistJobArtifact(executor, {
          jobId: generic.id,
          kind: 'growth.score',
          schemaVersion: 1,
          content: { score: 31, score_version: 'growth-score:v1' },
        })
      ).rejects.toThrow(/different artifact/u);
    });

    async function authorizeFulfillmentForDeletionRace(input: {
      authorizedAt: Date;
      leaseDurationMs?: number;
    }) {
      const contactId = await createContact(input.authorizedAt);
      const jobId = randomUUID();
      await executor.execute(
        `insert into growth_jobs (
           id, kind, contact_id, status, available_at,
           idempotency_key, payload
         ) values ($1, 'fulfill', $2, 'pending', $3, $4, $5::jsonb)`,
        [
          jobId,
          contactId,
          input.authorizedAt,
          `jobs-integration:deletion-race:${jobId}`,
          JSON.stringify({
            form_kind: 'whitepaper',
            paper: 'chat',
            submission_id: randomUUID(),
          }),
        ]
      );
      const leased = await leaseDueJobs(executor, {
        kinds: ['fulfill'],
        now: input.authorizedAt,
        batchSize: 1,
        leaseDurationMs: input.leaseDurationMs ?? 60_000,
        campaignEnabled: false,
      });
      const job = leased[0];
      if (!job?.leaseToken) throw new Error('fulfillment must be leased');
      await expect(
        authorizeLeasedJobForSubmission(executor, {
          campaignEnabled: false,
          deliveryEnabled: true,
          jobId: job.id,
          leaseToken: job.leaseToken,
          now: input.authorizedAt,
        })
      ).resolves.toMatchObject({ authorized: true });
      return { contactId, job };
    }

    async function deleteAuthorizedContact(input: {
      contactId: string;
      deletedAt: Date;
    }) {
      return deleteContact(executor, {
        contactId: input.contactId,
        eventKey: `jobs-integration:delete:${input.contactId}`,
        occurredAt: input.deletedAt,
        actor: 'integration-test',
        source: 'integration-test',
        policyVersion: 'growth-policy:v1',
      });
    }

    it('durably resolves deletion provisional unknown when a known provider acceptance arrives late', async () => {
      const authorizedAt = new Date('2097-12-01T00:00:00.000Z');
      const { contactId, job } = await authorizeFulfillmentForDeletionRace({
        authorizedAt,
      });
      await deleteAuthorizedContact({
        contactId,
        deletedAt: new Date(authorizedAt.getTime() + 1_000),
      });

      const accepted = await recordProviderAcceptance(executor, {
        jobId: job.id,
        leaseToken: job.leaseToken as string,
        acceptedAt: new Date(authorizedAt.getTime() + 2_000),
        providerEmailId: `provider:${job.id}`,
      });

      expect(accepted).toMatchObject({
        status: 'completed',
        deliveryStatus: 'submitted',
        providerEmailId: `provider:${job.id}`,
      });
      const audit = await executor.execute<{
        kind: string;
        data: Record<string, unknown>;
      }>(
        `select kind, data
         from growth_activity
         where event_key in ($1, $2)
         order by kind`,
        [
          `job:${job.id}:provider-acceptance-unknown`,
          `job:${job.id}:provider-acceptance-unknown-resolved`,
        ]
      );
      expect(audit.rows.map(({ kind }) => kind)).toEqual([
        'delivery.acceptance_unknown',
        'delivery.acceptance_unknown_resolved',
      ]);
      expect(JSON.stringify(audit.rows)).not.toContain('@example.com');
    });

    it('keeps deletion plus an ambiguous provider outcome terminal unknown with no retry', async () => {
      const authorizedAt = new Date('2097-12-02T00:00:00.000Z');
      const { contactId, job } = await authorizeFulfillmentForDeletionRace({
        authorizedAt,
      });
      await deleteAuthorizedContact({
        contactId,
        deletedAt: new Date(authorizedAt.getTime() + 1_000),
      });

      await expect(
        markProviderAcceptanceUnknown(executor, {
          jobId: job.id,
          leaseToken: job.leaseToken as string,
          occurredAt: new Date(authorizedAt.getTime() + 2_000),
          errorCode: 'provider_acceptance_ambiguous',
        })
      ).rejects.toBeInstanceOf(JobLeaseConflictError);
      const state = await executor.execute<{
        status: string;
        delivery_status: string;
        last_error_code: string;
      }>(
        `select status, delivery_status, last_error_code
         from growth_jobs where id = $1`,
        [job.id]
      );
      expect(state.rows).toEqual([
        {
          status: 'failed',
          delivery_status: 'unknown',
          last_error_code: 'provider_acceptance_interrupted_by_deletion',
        },
      ]);
      await expect(
        leaseDueJobs(executor, {
          kinds: ['fulfill'],
          now: new Date(authorizedAt.getTime() + 60_000),
          batchSize: 10,
          leaseDurationMs: 60_000,
          campaignEnabled: false,
        })
      ).resolves.toEqual([]);
    });

    it('recovers authorize-crash-expiry-delete as terminal unknown without resubmission', async () => {
      const authorizedAt = new Date('2097-12-03T00:00:00.000Z');
      const { contactId, job } = await authorizeFulfillmentForDeletionRace({
        authorizedAt,
        leaseDurationMs: 1_000,
      });
      const afterExpiry = new Date(authorizedAt.getTime() + 2_000);
      await deleteAuthorizedContact({ contactId, deletedAt: afterExpiry });

      const recovery = await leaseDueJobs(executor, {
        kinds: ['fulfill'],
        now: new Date(afterExpiry.getTime() + 1_000),
        batchSize: 10,
        leaseDurationMs: 60_000,
        campaignEnabled: false,
      });
      expect(recovery).toEqual([]);
      const aggregate = await executor.execute<{
        acceptance_unknown: string;
        delivery_status: string;
        status: string;
      }>(
        `select j.status,
                j.delivery_status,
                count(a.*)::text as acceptance_unknown
         from growth_jobs j
         left join growth_activity a
           on a.event_key =
              'job:' || j.id::text || ':provider-acceptance-unknown'
          and a.kind = 'delivery.acceptance_unknown'
         where j.id = $1
         group by j.id`,
        [job.id]
      );
      expect(aggregate.rows).toEqual([
        {
          status: 'failed',
          delivery_status: 'unknown',
          acceptance_unknown: '1',
        },
      ]);
    });
  }
);
