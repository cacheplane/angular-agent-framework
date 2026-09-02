import { describe, expect, it, vi } from 'vitest';

import type { SqlExecutor, SqlTransaction } from './database.ts';
import { dispatchGrowthLeasedJob } from './dispatcher.ts';
import { leaseDueJobs } from './jobs.ts';

const now = new Date('2026-09-01T12:10:00.000Z');
const jobId = '00000000-0000-4000-8000-000000000088';
const leaseToken = '00000000-0000-4000-8000-000000000099';
const contactId = '00000000-0000-4000-8000-000000000077';

describe('dispatchGrowthLeasedJob', () => {
  it('runs the production lease → ranked reconciliation → canonical stop path', async () => {
    const calls: string[] = [];
    const payload = {
      gmail_message_id: 'reply-before-seed',
      occurred_at: '2026-09-01T12:00:00.000Z',
      resolved_candidates: [
        {
          message_id: '<lower@threadplane.ai>',
          rank: 1,
          contact_id: contactId,
          seed_job_id: '00000000-0000-4000-8000-000000000066',
        },
      ],
    };
    const leasedRow = {
      id: jobId,
      kind: 'reply_reconcile',
      contact_id: null,
      project_id: null,
      status: 'leased',
      available_at: now,
      lease_until: new Date(now.getTime() + 60_000),
      lease_token: leaseToken,
      attempts: 1,
      idempotency_key: 'reply_reconcile:gmail:reply-before-seed',
      payload,
      provider_email_id: null,
      rfc_message_id: null,
      gmail_seed_message_id: null,
      delivery_status: 'not_submitted',
      last_error_code: null,
      created_at: now,
      updated_at: now,
    };
    const execute: SqlTransaction['execute'] = async <
      Row extends Record<string, unknown>
    >(
      sql: string
    ) => {
      const marker = /\/\* growth:([a-z0-9-]+) \*\//u.exec(sql)?.[1];
      if (!marker) throw new Error('missing marker');
      calls.push(marker);
      const rows =
        marker === 'read-google-mailbox-recovery-pause'
          ? [{ paused: false }]
          : marker === 'acquire-google-reconcile-advisory-lock'
          ? [{}]
          : marker === 'lease-due-jobs' ||
            marker === 'read-google-reconcile-settlement' ||
            marker === 'read-current-google-reconcile-settlement' ||
            marker === 'lock-leased-google-reconcile'
          ? [leasedRow]
          : marker === 'lock-google-reconcile-contact'
          ? [{ id: contactId, deleted_at: null }]
          : marker === 'complete-leased-google-reconcile'
          ? [{ id: jobId }]
          : (() => {
              throw new Error(`unexpected marker ${marker}`);
            })();
      return { rows: rows as unknown as Row[] };
    };
    const transaction: SqlTransaction = { execute };
    const executor: SqlExecutor = {
      execute,
      transaction: async (operation) => operation(transaction),
    };
    const stopContact = vi.fn().mockResolvedValue({ applied: true });

    const [leased] = await leaseDueJobs(executor, {
      kinds: ['reply_reconcile'],
      now,
      batchSize: 1,
      leaseDurationMs: 60_000,
      campaignEnabled: false,
    });
    if (!leased) throw new Error('expected leased job');

    await expect(
      dispatchGrowthLeasedJob(executor, leased, { stopContact })
    ).resolves.toBe('completed');
    expect(stopContact).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        contactId,
        reason: 'campaign.reply_received',
      })
    );
    expect(calls).toEqual([
      'lease-due-jobs',
      'read-google-mailbox-recovery-pause',
      'read-google-reconcile-settlement',
      'acquire-google-reconcile-advisory-lock',
      'read-google-mailbox-recovery-pause',
      'read-current-google-reconcile-settlement',
      'lock-google-reconcile-contact',
      'lock-leased-google-reconcile',
      'complete-leased-google-reconcile',
    ]);
  });

  it.each(['fulfill', 'enrich', 'notify', 'send_step'] as const)(
    'routes leased app-owned %s jobs through an injected handler',
    async (kind) => {
      const executor = {
        execute: vi.fn().mockResolvedValue({ rows: [{ paused: false }] }),
      } as unknown as SqlExecutor;
      const handler = vi.fn().mockResolvedValue('completed');
      const leased = {
        id: jobId,
        kind,
        contactId,
        projectId: null,
        status: 'leased' as const,
        availableAt: now,
        leaseUntil: new Date(now.getTime() + 60_000),
        leaseToken,
        attempts: 1,
        idempotencyKey: `app:${kind}:job`,
        payload: {},
        providerEmailId: null,
        rfcMessageId: null,
        gmailSeedMessageId: null,
        deliveryStatus: 'not_submitted' as const,
        lastErrorCode: null,
        createdAt: now,
        updatedAt: now,
      };

      await expect(
        dispatchGrowthLeasedJob(executor, leased, {
          appHandlers: { [kind]: handler },
          signal: new AbortController().signal,
        })
      ).resolves.toBe('completed');
      expect(handler).toHaveBeenCalledWith(
        executor,
        leased,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    }
  );

  it('fails closed for an unsupported leased kind', async () => {
    const executor = {} as SqlExecutor;
    await expect(
      dispatchGrowthLeasedJob(
        executor,
        {
          id: jobId,
          kind: 'legacy',
          contactId,
          projectId: null,
          status: 'leased',
          availableAt: now,
          leaseUntil: new Date(now.getTime() + 60_000),
          leaseToken,
          attempts: 1,
          idempotencyKey: 'campaign:v1:contact:step:1',
          payload: {},
          providerEmailId: null,
          rfcMessageId: null,
          gmailSeedMessageId: null,
          deliveryStatus: 'not_submitted',
          lastErrorCode: null,
          createdAt: now,
          updatedAt: now,
        },
        { appHandlers: {} }
      )
    ).rejects.toThrow(/unsupported/iu);
  });

  it('does not settle an already-leased reply reconciliation while mailbox recovery is paused', async () => {
    const execute: SqlExecutor['execute'] = async <
      Row extends Record<string, unknown>
    >(
      sql: string
    ) => {
      expect(sql).toMatch(/growth:read-google-mailbox-recovery-pause/u);
      return { rows: [{ paused: true }] as Row[] };
    };
    const executor: SqlExecutor = {
      execute,
      transaction: async () => {
        throw new Error('settlement must not begin while recovery is paused');
      },
    };

    await expect(
      dispatchGrowthLeasedJob(executor, {
        id: jobId,
        kind: 'reply_reconcile',
        contactId: null,
        projectId: null,
        status: 'leased',
        availableAt: now,
        leaseUntil: new Date(now.getTime() + 60_000),
        leaseToken,
        attempts: 1,
        idempotencyKey: 'reply_reconcile:gmail:paused',
        payload: {},
        providerEmailId: null,
        rfcMessageId: null,
        gmailSeedMessageId: null,
        deliveryStatus: 'not_submitted',
        lastErrorCode: null,
        createdAt: now,
        updatedAt: now,
      })
    ).resolves.toBe('recovery_paused');
  });

  it('does not invoke an already-leased campaign handler while mailbox recovery is paused', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ paused: true }] });
    const executor = { execute } as unknown as SqlExecutor;
    const sendStep = vi.fn().mockResolvedValue('completed');

    await expect(
      dispatchGrowthLeasedJob(
        executor,
        {
          id: jobId,
          kind: 'send_step',
          contactId,
          projectId: null,
          status: 'leased',
          availableAt: now,
          leaseUntil: new Date(now.getTime() + 60_000),
          leaseToken,
          attempts: 1,
          idempotencyKey: 'campaign:v1:contact:step:1',
          payload: { campaign_version: 'v1', step: 1 },
          providerEmailId: null,
          rfcMessageId: null,
          gmailSeedMessageId: null,
          deliveryStatus: 'not_submitted',
          lastErrorCode: null,
          createdAt: now,
          updatedAt: now,
        },
        { appHandlers: { send_step: sendStep } }
      )
    ).resolves.toBe('recovery_paused');
    expect(sendStep).not.toHaveBeenCalled();
  });

  it('honors an already-aborted Dawn dispatch signal before database work', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled by Dawn'));
    const executor = {
      execute: vi.fn(() => {
        throw new Error('database must not be reached after cancellation');
      }),
    } as unknown as SqlExecutor;

    await expect(
      dispatchGrowthLeasedJob(
        executor,
        {
          id: jobId,
          kind: 'reply_reconcile',
          contactId: null,
          projectId: null,
          status: 'leased',
          availableAt: now,
          leaseUntil: new Date(now.getTime() + 60_000),
          leaseToken,
          attempts: 1,
          idempotencyKey: 'reply_reconcile:gmail:cancelled',
          payload: {},
          providerEmailId: null,
          rfcMessageId: null,
          gmailSeedMessageId: null,
          deliveryStatus: 'not_submitted',
          lastErrorCode: null,
          createdAt: now,
          updatedAt: now,
        },
        { signal: controller.signal }
      )
    ).rejects.toThrow('cancelled by Dawn');
    expect(executor.execute).not.toHaveBeenCalled();
  });
});
