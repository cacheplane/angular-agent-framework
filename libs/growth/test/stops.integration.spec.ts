import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import {
  authorizeLeasedJobForSubmission,
  createEmailLookupHmac,
  createDatabaseExecutor,
  recordProviderAcceptance,
  reauthorizeContact,
  stopContact,
  stopLegacyEmailUnsubscribe,
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
    ? 'growth stops against TEST_DATABASE_URL with two connections'
    : 'growth stops intentionally skipped: TEST_DATABASE_URL is not set',
  () => {
    let stopExecutor: SqlExecutor;
    let senderExecutor: SqlExecutor;
    const contactIds = new Set<string>();

    beforeAll(async () => {
      if (!testDatabaseUrl) {
        throw new Error(
          'TEST_DATABASE_URL is required for growth integration tests'
        );
      }
      stopExecutor = createDatabaseExecutor(testDatabaseUrl);
      senderExecutor = createDatabaseExecutor(testDatabaseUrl);
      await applyMigrations({
        directory: resolve(process.cwd(), 'migrations'),
        executor: stopExecutor,
      });
    });

    afterEach(async () => {
      for (const contactId of contactIds) {
        await stopExecutor.execute(
          'delete from growth_activity where contact_id = $1',
          [contactId]
        );
        await stopExecutor.execute(
          'delete from growth_jobs where contact_id = $1',
          [contactId]
        );
        await stopExecutor.execute(
          'delete from growth_contacts where id = $1',
          [contactId]
        );
      }
      contactIds.clear();
    });

    afterAll(async () => {
      await Promise.all([stopExecutor?.close?.(), senderExecutor?.close?.()]);
    });

    async function createLeasedContact(): Promise<{
      contactId: string;
      jobId: string;
      leaseToken: string;
    }> {
      const contactId = randomUUID();
      const jobId = randomUUID();
      const leaseToken = randomUUID();
      const approvedAt = new Date('2099-01-01T00:00:00.000Z');
      const approvalEventKey = `stop-integration:approval:${contactId}`;
      contactIds.add(contactId);
      await stopExecutor.execute(
        `insert into growth_contacts (
           id, email_normalized, email_lookup_hmac, email_hmac_key_version,
           outreach_approved_at, source
         ) values ($1, $2, $3, 1, $4, 'stop-integration')`,
        [
          contactId,
          `${contactId}@example.com`,
          `stop-integration:${contactId}`,
          approvedAt,
        ]
      );
      await stopExecutor.execute(
        `insert into growth_activity (
           event_key, contact_id, kind, occurred_at, data
         ) values
           ($1, $2, 'form.outreach_approved', $3,
            jsonb_build_object(
              'source_form', 'pricing',
              'verification', 'server_verified'
            )),
           ('campaign:v1:' || $2::text || ':enrolled', $2,
            'campaign.enrolled:v1', $3,
            jsonb_build_object(
              'campaign_version', 'v1',
              'approval_event_key', $1::text,
              'approval_kind', 'form.outreach_approved',
              'approval_at', $3::timestamptz
            ))`,
        [approvalEventKey, contactId, approvedAt]
      );
      await stopExecutor.execute(
        `insert into growth_jobs (
           id, kind, contact_id, status, available_at, lease_until,
           lease_token, idempotency_key, payload
         ) values (
           $1, 'send_step', $2, 'leased', $3, $4, $5, $6,
           jsonb_build_object(
             'campaign_version', 'v1',
             'step', 1,
             'approval_event_key', $7::text,
             'approval_kind', 'form.outreach_approved',
             'approval_at', $3::timestamptz
           )
         )`,
        [
          jobId,
          contactId,
          new Date('2099-01-01T00:00:00.000Z'),
          new Date('2099-01-01T00:10:00.000Z'),
          leaseToken,
          `stop-integration:${jobId}`,
          approvalEventKey,
        ]
      );
      return { contactId, jobId, leaseToken };
    }

    it('makes an exact concurrent stop idempotent and blocks every later authorization', async () => {
      const { contactId, jobId, leaseToken } = await createLeasedContact();
      const occurredAt = new Date('2099-01-01T00:01:00.000Z');
      const input = {
        contactId,
        reason: 'unsubscribe' as const,
        eventKey: `stop-integration:${contactId}`,
        occurredAt,
        source: 'integration',
        provenance: {
          actor: 'recipient',
          kind: 'one_click' as const,
          policyVersion: 'growth-v1',
        },
      };

      const [left, right] = await Promise.all([
        stopContact(stopExecutor, input),
        stopContact(senderExecutor, input),
      ]);
      expect([left.applied, right.applied].sort()).toEqual([false, true]);

      const authorization = await authorizeLeasedJobForSubmission(
        senderExecutor,
        {
          campaignEnabled: true,
          deliveryEnabled: true,
          jobId,
          leaseToken,
          now: new Date('2099-01-01T00:02:00.000Z'),
        }
      );
      expect(authorization.authorized).toBe(false);

      const inventory = await stopExecutor.execute<{
        approvals: string;
        jobs: string;
        stops: string;
      }>(
        `select
           (select count(*)::text from growth_contacts
            where id = $1 and outreach_approved_at is not null) as approvals,
           (select count(*)::text from growth_jobs
            where contact_id = $1 and status in ('pending', 'leased')) as jobs,
           (select count(*)::text from growth_activity
            where contact_id = $1 and event_key = $2) as stops`,
        [contactId, input.eventKey]
      );
      expect(inventory.rows).toEqual([
        { approvals: '0', jobs: '0', stops: '1' },
      ]);
    });

    it('uses first receipt time for an old signed stop and leaves a later reauthorization intact on replay', async () => {
      const { contactId } = await createLeasedContact();
      await stopContact(stopExecutor, {
        contactId,
        reason: 'unsubscribe',
        eventKey: `seed-stop:${contactId}`,
        occurredAt: new Date('2099-01-01T00:01:00.000Z'),
        source: 'integration',
        provenance: {
          actor: 'recipient',
          kind: 'one_click',
          policyVersion: 'growth-v1',
        },
      });
      await reauthorizeContact(stopExecutor, {
        contactId,
        eventKey: `first-reauthorization:${contactId}`,
        occurredAt: new Date('2099-01-02T00:00:00.000Z'),
        actor: 'founder',
        reason: 'verified renewed consent',
        source: 'integration',
        policyVersion: 'growth-v1',
        allowedPriorStops: ['unsubscribe'],
      });

      const firstReceiptAt = new Date('2099-01-03T00:00:00.000Z');
      const signedEventKey = `token:unsubscribe:${contactId}:4070908800000:old-link`;
      const first = await stopContact(stopExecutor, {
        contactId,
        reason: 'unsubscribe',
        eventKey: signedEventKey,
        occurredAt: firstReceiptAt,
        source: 'signed_unsubscribe',
        provenance: {
          actor: 'recipient',
          kind: 'one_click',
          policyVersion: 'growth-v1',
        },
      });
      expect(first).toMatchObject({ applied: true, effective: true });

      const secondReauthorizationAt = new Date('2099-01-04T00:00:00.000Z');
      await reauthorizeContact(stopExecutor, {
        contactId,
        eventKey: `second-reauthorization:${contactId}`,
        occurredAt: secondReauthorizationAt,
        actor: 'founder',
        reason: 'verified renewed consent again',
        source: 'integration',
        policyVersion: 'growth-v1',
        allowedPriorStops: ['unsubscribe'],
      });
      const laterJobId = randomUUID();
      await stopExecutor.execute(
        `insert into growth_jobs (
           id, kind, contact_id, status, available_at, idempotency_key, payload
         ) values (
           $1, 'send_step', $2, 'pending', $3, $4,
           '{"campaign_version":"v1","step":2}'::jsonb
         )`,
        [
          laterJobId,
          contactId,
          secondReauthorizationAt,
          `signed-stop-replay:${laterJobId}`,
        ]
      );

      const replay = await stopContact(senderExecutor, {
        contactId,
        reason: 'unsubscribe',
        eventKey: signedEventKey,
        occurredAt: new Date('2099-01-05T00:00:00.000Z'),
        source: 'signed_unsubscribe',
        provenance: {
          actor: 'recipient',
          kind: 'one_click',
          policyVersion: 'growth-v1',
        },
      });
      expect(replay).toMatchObject({ applied: false, effective: true });

      const inventory = await stopExecutor.execute<{
        occurred_at: Date;
        outreach_approved_at: Date;
        status: string;
        stops: string;
      }>(
        `select c.outreach_approved_at, j.status, stop.occurred_at,
                (select count(*)::text from growth_activity
                 where event_key = $2) as stops
         from growth_contacts c
         join growth_jobs j on j.id = $3
         join growth_activity stop on stop.event_key = $2
         where c.id = $1`,
        [contactId, signedEventKey, laterJobId]
      );
      expect(inventory.rows).toEqual([
        {
          occurred_at: firstReceiptAt,
          outreach_approved_at: secondReauthorizationAt,
          status: 'pending',
          stops: '1',
        },
      ]);
    });

    it('deduplicates concurrent and sequential legacy links per approval epoch and stops after reauthorization', async () => {
      const contactId = randomUUID();
      const firstJobId = randomUUID();
      const secondJobId = randomUUID();
      const email = `legacy-${contactId}@example.com`;
      const keyring = {
        active: { version: 1, secret: 'legacy-integration-email-hmac-key!' },
      };
      const lookup = createEmailLookupHmac(email, keyring.active);
      const approvedAt = new Date('2099-01-01T00:00:00.000Z');
      contactIds.add(contactId);
      await stopExecutor.execute(
        `insert into growth_contacts (
           id, email_normalized, email_lookup_hmac, email_hmac_key_version,
           outreach_approved_at, source
         ) values ($1, $2, $3, $4, $5, 'legacy-stop-integration')`,
        [contactId, email, lookup.digest, lookup.keyVersion, approvedAt]
      );
      await stopExecutor.execute(
        `insert into growth_jobs (
           id, kind, contact_id, status, available_at, idempotency_key, payload
         ) values (
           $1, 'send_step', $2, 'pending', $3, $4,
           '{"campaign_version":"v1","step":1}'::jsonb
         )`,
        [firstJobId, contactId, approvedAt, `legacy-stop:${firstJobId}`]
      );
      const firstInput = {
        email,
        keyring,
        occurredAt: new Date('2099-01-01T00:01:00.000Z'),
        policyVersion: 'growth-v1',
        source: 'legacy_raw_email_unsubscribe',
      };

      const concurrent = await Promise.all([
        stopLegacyEmailUnsubscribe(stopExecutor, firstInput),
        stopLegacyEmailUnsubscribe(senderExecutor, firstInput),
      ]);
      const sequential = await stopLegacyEmailUnsubscribe(
        stopExecutor,
        firstInput
      );

      expect(concurrent.map(({ applied }) => applied).sort()).toEqual([
        false,
        true,
      ]);
      expect(sequential.applied).toBe(false);

      const reauthorizedAt = new Date('2099-01-02T00:00:00.000Z');
      await expect(
        reauthorizeContact(stopExecutor, {
          contactId,
          eventKey: `legacy-reauthorize:${contactId}`,
          occurredAt: reauthorizedAt,
          actor: 'founder',
          reason: 'verified renewed consent',
          source: 'integration',
          policyVersion: 'growth-v1',
          allowedPriorStops: ['unsubscribe'],
        })
      ).resolves.toMatchObject({ reauthorized: true });
      await stopExecutor.execute(
        `insert into growth_jobs (
           id, kind, contact_id, status, available_at, idempotency_key, payload
         ) values (
           $1, 'send_step', $2, 'pending', $3, $4,
           '{"campaign_version":"v1","step":1}'::jsonb
         )`,
        [secondJobId, contactId, reauthorizedAt, `legacy-stop:${secondJobId}`]
      );

      await expect(
        stopLegacyEmailUnsubscribe(stopExecutor, {
          ...firstInput,
          occurredAt: new Date('2099-01-02T00:01:00.000Z'),
        })
      ).resolves.toMatchObject({ applied: true, effective: true });

      const inventory = await stopExecutor.execute<{
        cancelled_jobs: string;
        stops: string;
      }>(
        `select
           (select count(*)::text from growth_jobs
            where contact_id = $1 and status = 'cancelled') as cancelled_jobs,
           (select count(*)::text from growth_activity
            where contact_id = $1
              and kind = 'unsubscribe'
              and data->>'source' = 'legacy_raw_email_unsubscribe') as stops`,
        [contactId]
      );
      expect(inventory.rows).toEqual([{ cancelled_jobs: '2', stops: '2' }]);
    });

    it('serializes stop against final authorization and leaves no unsent lease active', async () => {
      const { contactId, jobId, leaseToken } = await createLeasedContact();
      const stopInput = {
        contactId,
        reason: 'campaign.reply_received' as const,
        eventKey: `reply-integration:${contactId}`,
        occurredAt: new Date('2099-01-01T00:01:00.000Z'),
        source: 'gmail_reply',
        provenance: {
          actor: 'recipient',
          kind: 'mailbox_reply' as const,
          policyVersion: 'growth-v1',
        },
      };

      const [authorization, stopped] = await Promise.all([
        authorizeLeasedJobForSubmission(senderExecutor, {
          campaignEnabled: true,
          deliveryEnabled: true,
          jobId,
          leaseToken,
          now: new Date('2099-01-01T00:00:30.000Z'),
        }),
        stopContact(stopExecutor, stopInput),
      ]);

      expect(stopped.providerSync.required).toBe(false);
      expect([true, false]).toContain(authorization.authorized);
      const job = await stopExecutor.execute<{
        delivery_status: string;
        lease_token: string | null;
        status: string;
      }>(
        'select status, lease_token, delivery_status from growth_jobs where id = $1',
        [jobId]
      );
      expect(job.rows).toEqual([
        {
          delivery_status: 'not_submitted',
          lease_token: null,
          status: 'cancelled',
        },
      ]);
    });

    it('preserves a provider acceptance that lands after an authorized stop race', async () => {
      const { contactId, jobId, leaseToken } = await createLeasedContact();
      const authorization = await authorizeLeasedJobForSubmission(
        senderExecutor,
        {
          campaignEnabled: true,
          deliveryEnabled: true,
          jobId,
          leaseToken,
          now: new Date('2099-01-01T00:00:30.000Z'),
        }
      );
      expect(authorization.authorized).toBe(true);

      const stopped = await stopContact(stopExecutor, {
        contactId,
        reason: 'unsubscribe',
        eventKey: `authorized-race-stop:${contactId}`,
        occurredAt: new Date('2099-01-01T00:00:31.000Z'),
        source: 'integration',
        provenance: {
          actor: 'recipient',
          kind: 'one_click',
          policyVersion: 'growth-v1',
        },
      });
      expect(stopped.race).toMatchObject({
        boundedProviderSubmissionPossible: true,
        manualReviewRequired: true,
        jobIds: [jobId],
      });

      const accepted = await recordProviderAcceptance(senderExecutor, {
        jobId,
        leaseToken,
        acceptedAt: new Date('2099-01-01T00:00:32.000Z'),
        providerEmailId: `provider-race:${jobId}`,
      });
      expect(accepted).toMatchObject({
        status: 'completed',
        deliveryStatus: 'submitted',
        providerEmailId: `provider-race:${jobId}`,
      });
    });

    it('serializes a real stop-versus-acceptance race without abort or deadlock', async () => {
      const { contactId, jobId, leaseToken } = await createLeasedContact();
      const authorizedAt = new Date('2099-01-01T00:00:30.000Z');
      await expect(
        authorizeLeasedJobForSubmission(senderExecutor, {
          campaignEnabled: true,
          deliveryEnabled: true,
          jobId,
          leaseToken,
          now: authorizedAt,
        })
      ).resolves.toMatchObject({ authorized: true });

      const [stopped, accepted] = await Promise.all([
        stopContact(stopExecutor, {
          contactId,
          reason: 'unsubscribe',
          eventKey: `acceptance-race-stop:${contactId}`,
          occurredAt: new Date('2099-01-01T00:00:31.000Z'),
          source: 'integration',
          provenance: {
            actor: 'recipient',
            kind: 'one_click',
            policyVersion: 'growth-v1',
          },
        }),
        recordProviderAcceptance(senderExecutor, {
          jobId,
          leaseToken,
          acceptedAt: new Date('2099-01-01T00:00:32.000Z'),
          providerEmailId: `provider-concurrent-race:${jobId}`,
        }),
      ]);

      expect(stopped.reason).toBe('unsubscribe');
      expect(accepted).toMatchObject({
        status: 'completed',
        deliveryStatus: 'submitted',
        providerEmailId: `provider-concurrent-race:${jobId}`,
      });
      const finalState = await stopExecutor.execute<{
        approval_cleared: boolean;
        delivery_status: string;
        status: string;
      }>(
        `select c.outreach_approved_at is null as approval_cleared,
                j.status,
                j.delivery_status
         from growth_contacts c
         join growth_jobs j on j.contact_id = c.id
         where c.id = $1 and j.id = $2`,
        [contactId, jobId]
      );
      expect(finalState.rows).toEqual([
        {
          approval_cleared: true,
          delivery_status: 'submitted',
          status: 'completed',
        },
      ]);
    });
  }
);
