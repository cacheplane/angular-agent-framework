import { createHash } from 'node:crypto';

import type {
  SqlExecutor,
  SqlQueryResult,
  SqlTransaction,
} from './database.ts';
import {
  authorizeLeasedJobForSubmission,
  recordProviderAcceptance,
} from './jobs.ts';
import {
  providerSyncActionForStopReason,
  stopContact,
  stopLegacyEmailUnsubscribe,
  type CanonicalStopReason,
  type StopContactInput,
} from './stops.ts';

type TestRow = Record<string, unknown>;

function executorWith(
  handlers: Record<
    string,
    (parameters: readonly unknown[], sql: string) => SqlQueryResult<TestRow>
  >
): {
  calls: { marker: string; parameters: readonly unknown[]; sql: string }[];
  executor: SqlExecutor;
  transactions: { count: number };
} {
  const calls: {
    marker: string;
    parameters: readonly unknown[];
    sql: string;
  }[] = [];
  const transactions = { count: 0 };
  const transaction: SqlTransaction = {
    async execute<Row extends Record<string, unknown>>(
      sql: string,
      parameters: readonly unknown[] = []
    ): Promise<SqlQueryResult<Row>> {
      const marker = /\/\* growth:([a-z0-9-]+) \*\//u.exec(sql)?.[1];
      if (
        sql.includes(
          "pg_advisory_xact_lock_shared(hashtextextended('growth-observation-privacy-v1'"
        )
      )
        return { rows: [] };
      const handler = marker ? handlers[marker] : undefined;
      if (marker === 'acquire-google-reconcile-advisory-lock' && !handler) {
        return { rows: [{}] } as SqlQueryResult<Row>;
      }
      if (marker === 'read-google-mailbox-recovery-pause' && !handler) {
        return { rows: [{ paused: false }] } as SqlQueryResult<Row>;
      }
      if (!marker || !handler) {
        throw new Error(`Unexpected SQL marker: ${marker ?? 'missing'}`);
      }
      calls.push({ marker, parameters, sql });
      return handler(parameters, sql) as SqlQueryResult<Row>;
    },
  };

  return {
    calls,
    transactions,
    executor: {
      execute: transaction.execute,
      async transaction(operation) {
        transactions.count += 1;
        return operation(transaction);
      },
    },
  };
}

const contactId = '00000000-0000-4000-8000-000000000001';
const now = new Date('2026-09-01T12:00:00.000Z');
const validCampaignProvenance = {
  campaign_approval_valid: true,
  campaign_enrollment_valid: true,
} as const;
const stopInput: StopContactInput = {
  contactId,
  reason: 'unsubscribe',
  eventKey: 'provider:unsubscribe:event-1',
  occurredAt: now,
  source: 'resend_webhook',
  provenance: {
    actor: 'recipient',
    kind: 'provider_webhook',
    policyVersion: 'growth-v1',
  },
};

function jobRow(overrides: TestRow = {}): TestRow {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    kind: 'send_step',
    contact_id: contactId,
    project_id: null,
    status: 'pending',
    available_at: now,
    lease_until: null,
    lease_token: null,
    attempts: 0,
    idempotency_key: 'campaign:v1:contact:step:1',
    payload: {
      campaign_version: 'v1',
      step: 1,
      approval_event_key: 'form:submission:accepted:outreach-approved',
      approval_kind: 'form.outreach_approved',
      approval_at: '2026-08-31T12:00:00.000Z',
    },
    provider_email_id: null,
    rfc_message_id: null,
    gmail_seed_message_id: null,
    delivery_status: 'not_submitted',
    last_error_code: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('providerSyncActionForStopReason', () => {
  it('uses a canonical stop type that excludes deletion', () => {
    expectTypeOf<
      StopContactInput['reason']
    >().toEqualTypeOf<CanonicalStopReason>();
    expectTypeOf<'deletion'>().not.toMatchTypeOf<CanonicalStopReason>();
    expect(() =>
      providerSyncActionForStopReason('deletion' as CanonicalStopReason)
    ).toThrow(/unsupported contact stop reason/iu);
  });

  it.each([
    'unsubscribe',
    'complaint',
    'hard_bounce',
    'provider_suppression',
    'invalid_address',
    'manual_suppression',
  ] as const)('requires provider contact suppression for %s', (reason) => {
    expect(providerSyncActionForStopReason(reason)).toEqual({
      action: 'suppress_contact',
      required: true,
    });
  });

  it('ends only automation for a reply', () => {
    expect(providerSyncActionForStopReason('campaign.reply_received')).toEqual({
      action: 'none',
      required: false,
    });
  });
});

describe('stopContact', () => {
  it('rejects deletion at runtime before opening the canonical stop transaction', async () => {
    const harness = executorWith({});

    await expect(
      stopContact(harness.executor, {
        ...stopInput,
        reason: 'deletion' as CanonicalStopReason,
      })
    ).rejects.toThrow(/unsupported contact stop reason/iu);
    expect(harness.transactions.count).toBe(0);
  });

  it('atomically clears approval, records one stop, cancels only unsent work, and preserves ledgers', async () => {
    const ordinaryPending = jobRow();
    const leasedUnsent = jobRow({
      id: '00000000-0000-4000-8000-000000000011',
      status: 'leased',
      lease_token: '00000000-0000-4000-8000-000000000099',
      lease_until: new Date('2026-09-01T12:05:00.000Z'),
      authorization_event_key:
        'job:00000000-0000-4000-8000-000000000011:submission-authorized:00000000-0000-4000-8000-000000000099',
      authorization_contact_id: contactId,
      authorization_project_id: null,
      authorization_kind: 'delivery.submission_authorized',
      authorization_occurred_at: new Date('2026-09-01T11:59:59.000Z'),
      authorization_data: {
        bounded_stop_race: true,
        lease_token: '00000000-0000-4000-8000-000000000099',
      },
    });
    const leasedWithoutAuthorization = jobRow({
      id: '00000000-0000-4000-8000-000000000016',
      status: 'leased',
      lease_token: '00000000-0000-4000-8000-000000000097',
      lease_until: new Date('2026-09-01T12:05:00.000Z'),
    });
    const legacyScheduled = jobRow({
      id: '00000000-0000-4000-8000-000000000012',
      kind: 'legacy',
      provider_email_id: 'resend-scheduled-1',
      payload: { imported: true, scheduled: true },
    });
    const submitted = jobRow({
      id: '00000000-0000-4000-8000-000000000013',
      status: 'completed',
      provider_email_id: 'resend-submitted-1',
      rfc_message_id: '<message-1@example.com>',
      gmail_seed_message_id: 'gmail-seed-1',
      delivery_status: 'submitted',
    });
    const leasedSubmitted = jobRow({
      id: '00000000-0000-4000-8000-000000000015',
      status: 'leased',
      lease_token: '00000000-0000-4000-8000-000000000098',
      lease_until: new Date('2026-09-01T12:05:00.000Z'),
      provider_email_id: 'resend-submitted-race',
      delivery_status: 'submitted',
    });
    const unknown = jobRow({
      id: '00000000-0000-4000-8000-000000000014',
      status: 'failed',
      delivery_status: 'unknown',
    });
    let persistedReview: TestRow | undefined;
    const harness = executorWith({
      'lock-contact-for-stop': (_parameters, sql) => {
        expect(sql).toMatch(/for update/u);
        return {
          rows: [
            {
              id: contactId,
              outreach_approved_at: new Date('2026-08-31T12:00:00.000Z'),
              deleted_at: null,
            },
          ],
        };
      },
      'insert-stop-activity': (parameters, sql) => {
        expect(parameters.slice(0, 4)).toEqual([
          stopInput.eventKey,
          contactId,
          now,
          'unsubscribe',
        ]);
        expect(JSON.parse(String(parameters[4]))).toEqual({
          actor: 'recipient',
          policy_version: 'growth-v1',
          provenance: 'provider_webhook',
          reason: 'unsubscribe',
          source: 'resend_webhook',
        });
        expect(sql).toMatch(/on conflict \(event_key\) do nothing/u);
        return { rows: [{ event_key: stopInput.eventKey }] };
      },
      'clear-stop-approval': (_parameters, sql) => {
        expect(sql).toMatch(/outreach_approved_at = null/u);
        return { rows: [{ id: contactId }] };
      },
      'lock-stop-jobs': (_parameters, sql) => {
        expect(sql).toMatch(/for update/u);
        expect(sql).toMatch(/order by j\.id/u);
        expect(sql).toMatch(/growth_activity submission_authorization/u);
        expect(sql).not.toMatch(/growth_activity authorization/u);
        return {
          rows: [
            ordinaryPending,
            leasedUnsent,
            leasedWithoutAuthorization,
            legacyScheduled,
            submitted,
            leasedSubmitted,
            unknown,
          ],
        };
      },
      'cancel-stop-jobs': (parameters, sql) => {
        expect(parameters[1]).toEqual([
          ordinaryPending.id,
          leasedUnsent.id,
          leasedWithoutAuthorization.id,
          legacyScheduled.id,
        ]);
        expect(parameters[2]).toEqual([leasedUnsent.id]);
        expect(sql).toMatch(/status = 'cancelled'/u);
        expect(sql).toMatch(/lease_token = null/u);
        expect(sql).toMatch(/when kind = 'legacy' then payload/u);
        expect(sql).toMatch(/campaign_version/u);
        expect(sql).toMatch(/step/u);
        expect(sql).not.toMatch(/provider_email_id\s*=/u);
        expect(sql).not.toMatch(/rfc_message_id\s*=/u);
        expect(sql).not.toMatch(/gmail_seed_message_id\s*=/u);
        return { rows: [] };
      },
      'insert-stop-race-review': (parameters, sql) => {
        const reviewData = JSON.parse(String(parameters[4]));
        expect(reviewData).toMatchObject({
          job_id: leasedUnsent.id,
          campaign_version: 'v1',
          step: 1,
          bounded_provider_submission: true,
        });
        expect(sql).toMatch(/delivery\.stop_race_review/u);
        expect(sql).toMatch(/returning event_key/u);
        persistedReview = {
          event_key: parameters[0],
          contact_id: parameters[1],
          project_id: parameters[2],
          kind: 'delivery.stop_race_review',
          occurred_at: parameters[3],
          data: reviewData,
          job_id: leasedUnsent.id,
        };
        return { rows: [{ event_key: 'race-review' }] };
      },
      'read-stop-race-reviews': () => ({
        rows: persistedReview ? [persistedReview] : [],
      }),
      'finalize-stop-activity': (parameters, sql) => {
        expect(parameters[0]).toBe(stopInput.eventKey);
        expect(JSON.parse(String(parameters[1]))).toMatchObject({
          effective: true,
          provider_sync: { action: 'suppress_contact', required: true },
          cancelled_job_ids: [
            ordinaryPending.id,
            leasedUnsent.id,
            leasedWithoutAuthorization.id,
            legacyScheduled.id,
          ],
          legacy_provider_cancellation_ids: ['resend-scheduled-1'],
        });
        expect(sql).toMatch(/not \(data \? 'result'\)/u);
        return { rows: [{ event_key: stopInput.eventKey }] };
      },
      'settle-stop-ledger-jobs': (parameters, sql) => {
        expect(parameters[1]).toEqual([leasedSubmitted.id]);
        expect(sql).toMatch(/lease_token = null/u);
        expect(sql).toMatch(/delivery_status = 'unknown' then 'failed'/u);
        expect(sql).not.toMatch(/provider_email_id\s*=/u);
        expect(sql).not.toMatch(/payload\s*=/u);
        return { rows: [] };
      },
    });

    const result = await stopContact(harness.executor, stopInput);

    expect(harness.transactions.count).toBe(1);
    expect(harness.calls.map(({ marker }) => marker)).toEqual([
      'lock-contact-for-stop',
      'insert-stop-activity',
      'clear-stop-approval',
      'lock-stop-jobs',
      'insert-stop-race-review',
      'cancel-stop-jobs',
      'settle-stop-ledger-jobs',
      'read-stop-race-reviews',
      'finalize-stop-activity',
    ]);
    expect(result).toMatchObject({
      applied: true,
      contactId,
      reason: 'unsubscribe',
      providerSync: { action: 'suppress_contact', required: true },
      cancelledJobIds: [
        ordinaryPending.id,
        leasedUnsent.id,
        leasedWithoutAuthorization.id,
        legacyScheduled.id,
      ],
      legacyProviderCancellationIds: ['resend-scheduled-1'],
      preservedJobIds: [submitted.id, leasedSubmitted.id, unknown.id],
      race: {
        boundedProviderSubmissionPossible: true,
        manualReviewRequired: true,
        jobIds: [leasedUnsent.id, submitted.id, leasedSubmitted.id, unknown.id],
        providerSubmissionAlreadyRecordedJobIds: [
          submitted.id,
          leasedSubmitted.id,
        ],
      },
    });
  });

  it('accepts an exact replay without inserting a second immutable reason', async () => {
    const expectedData = {
      actor: 'recipient',
      policy_version: 'growth-v1',
      provenance: 'provider_webhook',
      reason: 'unsubscribe',
      source: 'resend_webhook',
    };
    const harness = executorWith({
      'lock-contact-for-stop': () => ({
        rows: [{ id: contactId, outreach_approved_at: null, deleted_at: null }],
      }),
      'insert-stop-activity': () => ({ rows: [] }),
      'read-stop-activity': () => ({
        rows: [
          {
            event_key: stopInput.eventKey,
            contact_id: contactId,
            project_id: null,
            kind: stopInput.reason,
            occurred_at: now,
            data: expectedData,
          },
        ],
      }),
      'clear-stop-approval': () => ({ rows: [] }),
      'lock-stop-jobs': () => ({
        rows: [
          jobRow({
            id: '00000000-0000-4000-8000-000000000015',
            kind: 'legacy',
            status: 'cancelled',
            provider_email_id: 'resend-scheduled-replay',
          }),
        ],
      }),
      'read-stop-race-reviews': () => ({ rows: [] }),
      'finalize-stop-activity': () => ({
        rows: [{ event_key: stopInput.eventKey }],
      }),
    });

    const result = await stopContact(harness.executor, stopInput);

    expect(result.applied).toBe(false);
    expect(result.effective).toBe(true);
    expect(result.cancelledJobIds).toEqual([]);
    expect(result.legacyProviderCancellationIds).toEqual([
      'resend-scheduled-replay',
    ]);
    expect(
      harness.calls.filter(({ marker }) => marker === 'insert-stop-activity')
    ).toHaveLength(1);
  });

  it('returns the first persisted stop outcome when a stable event key is replayed at a later receipt time', async () => {
    const replayedAt = new Date('2026-09-03T12:00:00.000Z');
    const persistedResult = {
      effective: true,
      provider_sync: { action: 'suppress_contact', required: true },
      cancelled_job_ids: ['00000000-0000-4000-8000-000000000010'],
      legacy_provider_cancellation_ids: [],
      preserved_job_ids: [],
      race: {
        bounded_provider_submission_possible: false,
        manual_review_required: false,
        job_ids: [],
        provider_submission_already_recorded_job_ids: [],
        unknown_delivery_job_ids: [],
      },
    };
    const harness = executorWith({
      'lock-contact-for-stop': () => ({
        rows: [
          {
            id: contactId,
            outreach_approved_at: new Date('2026-09-02T12:00:00.000Z'),
            deleted_at: null,
          },
        ],
      }),
      'insert-stop-activity': () => ({ rows: [] }),
      'read-stop-activity': () => ({
        rows: [
          {
            event_key: stopInput.eventKey,
            contact_id: contactId,
            project_id: null,
            kind: stopInput.reason,
            occurred_at: now,
            data: {
              actor: 'recipient',
              policy_version: 'growth-v1',
              provenance: 'provider_webhook',
              reason: 'unsubscribe',
              source: 'resend_webhook',
              result: persistedResult,
            },
          },
        ],
      }),
    });

    const result = await stopContact(harness.executor, {
      ...stopInput,
      occurredAt: replayedAt,
    });

    expect(result).toEqual({
      applied: false,
      effective: true,
      contactId,
      reason: 'unsubscribe',
      providerSync: { action: 'suppress_contact', required: true },
      cancelledJobIds: ['00000000-0000-4000-8000-000000000010'],
      legacyProviderCancellationIds: [],
      preservedJobIds: [],
      race: {
        boundedProviderSubmissionPossible: false,
        manualReviewRequired: false,
        jobIds: [],
        providerSubmissionAlreadyRecordedJobIds: [],
        unknownDeliveryJobIds: [],
      },
    });
    expect(harness.calls.map(({ marker }) => marker)).toEqual([
      'lock-contact-for-stop',
      'insert-stop-activity',
      'read-stop-activity',
    ]);
  });

  it('rejects a forged durable stop-race review replay', async () => {
    const activeLeaseToken = '00000000-0000-4000-8000-000000000099';
    const authorized = jobRow({
      status: 'leased',
      lease_token: activeLeaseToken,
      lease_until: new Date('2026-09-01T12:05:00.000Z'),
      authorization_event_key: `job:${
        jobRow().id
      }:submission-authorized:${activeLeaseToken}`,
      authorization_contact_id: contactId,
      authorization_project_id: null,
      authorization_kind: 'delivery.submission_authorized',
      authorization_occurred_at: new Date('2026-09-01T11:59:00.000Z'),
      authorization_data: {
        bounded_stop_race: true,
        lease_token: activeLeaseToken,
      },
    });
    const harness = executorWith({
      'lock-contact-for-stop': () => ({
        rows: [{ id: contactId, outreach_approved_at: null, deleted_at: null }],
      }),
      'insert-stop-activity': () => ({
        rows: [{ event_key: stopInput.eventKey }],
      }),
      'clear-stop-approval': () => ({ rows: [] }),
      'lock-stop-jobs': () => ({ rows: [authorized] }),
      'insert-stop-race-review': () => ({ rows: [] }),
      'read-stop-race-review': (parameters) => ({
        rows: [
          {
            event_key: parameters[0],
            contact_id: contactId,
            project_id: null,
            kind: 'delivery.stop_race_review',
            occurred_at: now,
            data: { job_id: authorized.id, bounded_provider_submission: false },
          },
        ],
      }),
    });

    await expect(stopContact(harness.executor, stopInput)).rejects.toThrow(
      /stop race event key conflict/u
    );
    expect(harness.calls.map(({ marker }) => marker)).not.toContain(
      'cancel-stop-jobs'
    );
  });

  it('rejects a source-event collision whose immutable stop facts differ', async () => {
    const harness = executorWith({
      'lock-contact-for-stop': () => ({
        rows: [{ id: contactId, outreach_approved_at: null, deleted_at: null }],
      }),
      'insert-stop-activity': () => ({ rows: [] }),
      'read-stop-activity': () => ({
        rows: [
          {
            event_key: stopInput.eventKey,
            contact_id: contactId,
            project_id: null,
            kind: 'complaint',
            occurred_at: now,
            data: { reason: 'complaint' },
          },
        ],
      }),
    });

    await expect(stopContact(harness.executor, stopInput)).rejects.toThrow(
      /event key conflict/u
    );
    expect(harness.calls.map(({ marker }) => marker)).not.toContain(
      'clear-stop-approval'
    );
  });

  it.each([
    ['an exact replay', false],
    ['a delayed first delivery', true],
  ] as const)(
    'records %s but does not supersede a strictly newer reauthorization',
    async (_label, inserted) => {
      const expectedData = {
        actor: 'recipient',
        policy_version: 'growth-v1',
        provenance: 'provider_webhook',
        reason: 'unsubscribe',
        source: 'resend_webhook',
      };
      const harness = executorWith({
        'lock-contact-for-stop': () => ({
          rows: [
            {
              id: contactId,
              outreach_approved_at: new Date('2026-09-02T12:00:00.000Z'),
              deleted_at: null,
            },
          ],
        }),
        'insert-stop-activity': () =>
          inserted
            ? { rows: [{ event_key: stopInput.eventKey }] }
            : { rows: [] },
        'read-stop-activity': () => ({
          rows: [
            {
              event_key: stopInput.eventKey,
              contact_id: contactId,
              project_id: null,
              kind: stopInput.reason,
              occurred_at: now,
              data: expectedData,
            },
          ],
        }),
        'finalize-stop-activity': () => ({
          rows: [{ event_key: stopInput.eventKey }],
        }),
      });

      const result = await stopContact(harness.executor, stopInput);

      expect(result).toMatchObject({
        applied: inserted,
        effective: false,
        providerSync: { action: 'none', required: false },
      });
      expect(harness.calls.map(({ marker }) => marker)).toEqual(
        inserted
          ? [
              'lock-contact-for-stop',
              'insert-stop-activity',
              'finalize-stop-activity',
            ]
          : [
              'lock-contact-for-stop',
              'insert-stop-activity',
              'read-stop-activity',
              'finalize-stop-activity',
            ]
      );
      expect(result.cancelledJobIds).toEqual([]);
    }
  );
});

describe('stopLegacyEmailUnsubscribe', () => {
  it('serializes concurrent and sequential repeats by approval epoch, then stops again after reauthorization', async () => {
    const approvalAt = new Date('2026-09-01T11:00:00.000Z');
    const reauthorizedAt = new Date('2026-09-02T11:00:00.000Z');
    const activities = new Map<string, TestRow>();
    const eventKeys: string[] = [];
    const state = {
      approvalAt: approvalAt as Date | null,
      cancellationCount: 0,
      jobStatus: 'pending',
      stopActivityCount: 0,
    };
    let transactionTail = Promise.resolve();
    const transaction: SqlTransaction = {
      async execute<Row extends Record<string, unknown>>(
        sql: string,
        parameters: readonly unknown[] = []
      ): Promise<SqlQueryResult<Row>> {
        const marker = /\/\* growth:([a-z0-9-]+) \*\//u.exec(sql)?.[1];
        let rows: TestRow[] = [];
        if (marker === 'lock-contact-by-email-for-legacy-stop') {
          expect(sql).toMatch(/for update of c/u);
          expect(String(parameters[0])).not.toContain('reader@example.com');
          rows = [
            {
              id: contactId,
              outreach_approved_at: state.approvalAt,
              deleted_at: null,
            },
          ];
        } else if (marker === 'read-latest-legacy-stop') {
          const latest = [...activities.values()].at(-1);
          rows = latest ? [latest] : [];
        } else if (marker === 'lock-contact-for-stop') {
          rows = [
            {
              id: contactId,
              outreach_approved_at: state.approvalAt,
              deleted_at: null,
            },
          ];
        } else if (marker === 'insert-stop-activity') {
          const eventKey = String(parameters[0]);
          if (!activities.has(eventKey)) {
            const row = {
              event_key: eventKey,
              contact_id: contactId,
              project_id: null,
              kind: 'unsubscribe',
              occurred_at: parameters[2],
              data: JSON.parse(String(parameters[4])),
            };
            activities.set(eventKey, row);
            eventKeys.push(eventKey);
            state.stopActivityCount += 1;
            rows = [{ event_key: eventKey }];
          }
        } else if (marker === 'clear-stop-approval') {
          state.approvalAt = null;
          rows = [{ id: contactId }];
        } else if (marker === 'lock-stop-jobs') {
          rows = [jobRow({ status: state.jobStatus })];
        } else if (marker === 'cancel-stop-jobs') {
          state.jobStatus = 'cancelled';
          state.cancellationCount += 1;
        } else if (marker === 'read-stop-race-reviews') {
          rows = [];
        } else if (marker === 'finalize-stop-activity') {
          const eventKey = String(parameters[0]);
          const activity = activities.get(eventKey);
          const activityData = activity?.['data'];
          if (
            activity &&
            activityData !== null &&
            typeof activityData === 'object' &&
            !Array.isArray(activityData)
          ) {
            activity['data'] = {
              ...(activityData as Record<string, unknown>),
              result: JSON.parse(String(parameters[1])),
            };
            rows = [{ event_key: eventKey }];
          }
        } else {
          throw new Error(`Unexpected SQL marker: ${marker ?? 'missing'}`);
        }
        return { rows: rows as Row[] };
      },
    };
    const executor: SqlExecutor = {
      execute: transaction.execute,
      async transaction(operation) {
        const previous = transactionTail;
        let release = () => undefined;
        transactionTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await operation(transaction);
        } finally {
          release();
        }
      },
    };
    const keyring = {
      active: { version: 1, secret: 'legacy-unsubscribe-email-hmac-key!' },
    };
    const input = {
      email: 'reader@example.com',
      keyring,
      occurredAt: now,
      policyVersion: 'growth-v1',
      source: 'legacy_raw_email_unsubscribe',
    };

    const concurrent = await Promise.all([
      stopLegacyEmailUnsubscribe(executor, input),
      stopLegacyEmailUnsubscribe(executor, input),
    ]);
    const sequential = await stopLegacyEmailUnsubscribe(executor, input);

    expect(concurrent.map(({ applied }) => applied).sort()).toEqual([
      false,
      true,
    ]);
    expect(sequential).toMatchObject({
      applied: false,
      contactMatched: true,
      effective: true,
    });
    expect(state.stopActivityCount).toBe(1);
    expect(state.cancellationCount).toBe(1);
    const firstApprovalIdentity = createHash('sha256')
      .update(
        `legacy-unsubscribe-v1:${contactId}:${approvalAt.getTime()}`,
        'utf8'
      )
      .digest('base64url');
    expect(eventKeys[0]).toBe(`legacy:unsubscribe:${firstApprovalIdentity}`);
    expect(eventKeys[0]).not.toContain(now.getTime().toString(10));
    expect(eventKeys[0]).not.toContain('reader@example.com');

    state.approvalAt = reauthorizedAt;
    state.jobStatus = 'pending';
    const afterReauthorization = await stopLegacyEmailUnsubscribe(executor, {
      ...input,
      occurredAt: new Date('2026-09-02T12:00:00.000Z'),
    });

    expect(afterReauthorization).toMatchObject({
      applied: true,
      contactMatched: true,
      effective: true,
    });
    expect(state.stopActivityCount).toBe(2);
    expect(state.cancellationCount).toBe(2);
    expect(new Set(eventKeys).size).toBe(2);
    expect(eventKeys.every((eventKey) => !eventKey.includes('@'))).toBe(true);
  });
});

describe('authorizeLeasedJobForSubmission', () => {
  it('locks contact before job and refuses authorization after a stop', async () => {
    const harness = executorWith({
      'lock-contact-for-send': (_parameters, sql) => {
        expect(sql).toMatch(/for update of c/u);
        return {
          rows: [
            {
              id: contactId,
              outreach_approved_at: null,
              deleted_at: null,
              latest_hard_stop_kind: 'unsubscribe',
              latest_hard_stop_at: now,
            },
          ],
        };
      },
      'lock-job-for-send': (_parameters, sql) => {
        expect(sql).toMatch(/for update of j/u);
        expect(sql).not.toMatch(/lease_token/u);
        expect(sql).not.toMatch(/status = 'leased'/u);
        expect(sql).not.toMatch(/delivery_status = 'not_submitted'/u);
        return {
          rows: [
            jobRow({
              status: 'cancelled',
              lease_token: null,
              lease_until: null,
            }),
          ],
        };
      },
    });

    const result = await authorizeLeasedJobForSubmission(harness.executor, {
      campaignEnabled: true,
      deliveryEnabled: true,
      jobId: String(jobRow().id),
      leaseToken: '00000000-0000-4000-8000-000000000099',
      now,
    });

    expect(result).toEqual({
      authorized: false,
      reason: 'contact_stopped',
      job: expect.objectContaining({ id: jobRow().id }),
    });
    expect(harness.calls.map(({ marker }) => marker)).toEqual([
      'lock-contact-for-send',
      'lock-job-for-send',
    ]);
  });

  it('validates the active lease only after confirming the contact is approved', async () => {
    const harness = executorWith({
      'lock-contact-for-send': () => ({
        rows: [
          {
            id: contactId,
            email_normalized: 'developer@example.com',
            outreach_approved_at: new Date('2026-08-31T12:00:00.000Z'),
            ...validCampaignProvenance,
            deleted_at: null,
            latest_hard_stop_kind: null,
            latest_hard_stop_at: null,
          },
        ],
      }),
      'lock-job-for-send': () => ({
        rows: [jobRow({ status: 'cancelled', lease_token: null })],
      }),
    });

    await expect(
      authorizeLeasedJobForSubmission(harness.executor, {
        campaignEnabled: true,
        deliveryEnabled: true,
        jobId: String(jobRow().id),
        leaseToken: '00000000-0000-4000-8000-000000000099',
        now,
      })
    ).rejects.toThrow(/lease is no longer active/u);
    expect(harness.calls.map(({ marker }) => marker)).toEqual([
      'lock-contact-for-send',
      'lock-job-for-send',
    ]);
  });

  it('records the final authorization fact before allowing provider submission', async () => {
    const activeLeaseToken = '00000000-0000-4000-8000-000000000099';
    const harness = executorWith({
      'lock-contact-for-send': () => ({
        rows: [
          {
            id: contactId,
            email_normalized: 'developer@example.com',
            outreach_approved_at: new Date('2026-08-31T12:00:00.000Z'),
            ...validCampaignProvenance,
            deleted_at: null,
            latest_hard_stop_kind: null,
            latest_hard_stop_at: null,
          },
        ],
      }),
      'lock-job-for-send': () => ({
        rows: [
          jobRow({
            status: 'leased',
            lease_token: activeLeaseToken,
            lease_until: new Date('2026-09-01T12:05:00.000Z'),
          }),
        ],
      }),
      'insert-final-send-authorization': (parameters, sql) => {
        expect(parameters).toEqual([
          jobRow().id,
          contactId,
          null,
          activeLeaseToken,
          now,
        ]);
        expect(sql).toMatch(/delivery\.submission_authorized/u);
        expect(sql).toMatch(/on conflict \(event_key\) do nothing/u);
        return { rows: [{ event_key: 'authorization' }] };
      },
    });

    const result = await authorizeLeasedJobForSubmission(harness.executor, {
      campaignEnabled: true,
      deliveryEnabled: true,
      jobId: String(jobRow().id),
      leaseToken: activeLeaseToken,
      now,
    });

    expect(result).toMatchObject({
      authorized: true,
      recipient: {
        contactId,
        emailNormalized: 'developer@example.com',
      },
      boundedRaceNotice: 'a_future_stop_can_overlap_provider_submission',
    });
    expect(harness.calls.map(({ marker }) => marker)).toEqual([
      'lock-contact-for-send',
      'lock-job-for-send',
      'insert-final-send-authorization',
    ]);
  });

  it('refuses an already-leased campaign send while mailbox recovery is required', async () => {
    const activeLeaseToken = '00000000-0000-4000-8000-000000000099';
    const harness = executorWith({
      'acquire-google-reconcile-advisory-lock': () => ({ rows: [{}] }),
      'lock-contact-for-send': (_parameters, sql) => {
        expect(sql).toMatch(/mailbox\.recovery_required/u);
        expect(sql).toMatch(/mailbox\.recovery_completed/u);
        return {
          rows: [
            {
              id: contactId,
              email_normalized: 'developer@example.com',
              outreach_approved_at: new Date('2026-08-31T12:00:00.000Z'),
              ...validCampaignProvenance,
              deleted_at: null,
              latest_hard_stop_kind: null,
              latest_hard_stop_at: null,
              mailbox_recovery_required: true,
            },
          ],
        };
      },
      'lock-job-for-send': () => ({
        rows: [
          jobRow({
            status: 'leased',
            lease_token: activeLeaseToken,
            lease_until: new Date('2026-09-01T12:05:00.000Z'),
          }),
        ],
      }),
    });

    await expect(
      authorizeLeasedJobForSubmission(harness.executor, {
        campaignEnabled: true,
        deliveryEnabled: true,
        jobId: String(jobRow().id),
        leaseToken: activeLeaseToken,
        now,
      })
    ).resolves.toMatchObject({
      authorized: false,
      reason: 'mailbox_recovery_required',
    });
    expect(harness.calls.map(({ marker }) => marker)).not.toContain(
      'insert-final-send-authorization'
    );
    expect(harness.calls.map(({ marker }) => marker).slice(0, 2)).toEqual([
      'acquire-google-reconcile-advisory-lock',
      'lock-contact-for-send',
    ]);
  });

  it('rechecks mailbox recovery under the advisory gate immediately before final authorization', async () => {
    const activeLeaseToken = '00000000-0000-4000-8000-000000000099';
    const harness = executorWith({
      'acquire-google-reconcile-advisory-lock': () => ({ rows: [{}] }),
      'lock-contact-for-send': () => ({
        rows: [
          {
            id: contactId,
            email_normalized: 'developer@example.com',
            outreach_approved_at: new Date('2026-08-31T12:00:00.000Z'),
            ...validCampaignProvenance,
            deleted_at: null,
            latest_hard_stop_kind: null,
            latest_hard_stop_at: null,
            mailbox_recovery_required: false,
          },
        ],
      }),
      'lock-job-for-send': () => ({
        rows: [
          jobRow({
            status: 'leased',
            lease_token: activeLeaseToken,
            lease_until: new Date('2026-09-01T12:05:00.000Z'),
          }),
        ],
      }),
      'read-google-mailbox-recovery-pause': () => ({
        rows: [{ paused: true }],
      }),
    });

    await expect(
      authorizeLeasedJobForSubmission(harness.executor, {
        campaignEnabled: true,
        deliveryEnabled: true,
        jobId: String(jobRow().id),
        leaseToken: activeLeaseToken,
        now,
      })
    ).resolves.toMatchObject({
      authorized: false,
      reason: 'mailbox_recovery_required',
    });
    expect(harness.calls.map(({ marker }) => marker)).toEqual([
      'acquire-google-reconcile-advisory-lock',
      'lock-contact-for-send',
      'lock-job-for-send',
      'read-google-mailbox-recovery-pause',
    ]);
  });

  it.each([
    ['a missing canonical email', null],
    ['a noncanonical email', 'Developer@Example.com'],
  ] as const)(
    'refuses final authorization for %s',
    async (_label, emailNormalized) => {
      const activeLeaseToken = '00000000-0000-4000-8000-000000000099';
      const harness = executorWith({
        'lock-contact-for-send': (_parameters, sql) => {
          expect(sql).toMatch(/c\.email_normalized/u);
          return {
            rows: [
              {
                id: contactId,
                email_normalized: emailNormalized,
                outreach_approved_at: new Date('2026-08-31T12:00:00.000Z'),
                ...validCampaignProvenance,
                deleted_at: null,
                latest_hard_stop_kind: null,
                latest_hard_stop_at: null,
              },
            ],
          };
        },
        'lock-job-for-send': () => ({
          rows: [
            jobRow({
              status: 'leased',
              lease_token: activeLeaseToken,
              lease_until: new Date('2026-09-01T12:05:00.000Z'),
            }),
          ],
        }),
      });

      await expect(
        authorizeLeasedJobForSubmission(harness.executor, {
          campaignEnabled: true,
          deliveryEnabled: true,
          jobId: String(jobRow().id),
          leaseToken: activeLeaseToken,
          now,
        })
      ).rejects.toThrow(/lease is no longer active/u);
      expect(harness.calls.map(({ marker }) => marker)).toEqual([
        'lock-contact-for-send',
        'lock-job-for-send',
      ]);
    }
  );

  it('refuses final authorization when the job has no canonical contact row', async () => {
    const harness = executorWith({
      'lock-contact-for-send': () => ({ rows: [] }),
    });

    await expect(
      authorizeLeasedJobForSubmission(harness.executor, {
        campaignEnabled: true,
        deliveryEnabled: true,
        jobId: String(jobRow().id),
        leaseToken: '00000000-0000-4000-8000-000000000099',
        now,
      })
    ).rejects.toThrow(/lease is no longer active/u);
    expect(harness.calls.map(({ marker }) => marker)).toEqual([
      'lock-contact-for-send',
    ]);
  });

  it('authorizes an exact replay of the immutable final authorization envelope', async () => {
    const activeLeaseToken = '00000000-0000-4000-8000-000000000099';
    const authorizationEventKey = `job:${
      jobRow().id
    }:submission-authorized:${activeLeaseToken}`;
    const harness = executorWith({
      'lock-contact-for-send': () => ({
        rows: [
          {
            id: contactId,
            email_normalized: 'developer@example.com',
            outreach_approved_at: new Date('2026-08-31T12:00:00.000Z'),
            ...validCampaignProvenance,
            deleted_at: null,
            latest_hard_stop_kind: null,
            latest_hard_stop_at: null,
          },
        ],
      }),
      'lock-job-for-send': () => ({
        rows: [
          jobRow({
            status: 'leased',
            lease_token: activeLeaseToken,
            lease_until: new Date('2026-09-01T12:05:00.000Z'),
          }),
        ],
      }),
      'insert-final-send-authorization': () => ({ rows: [] }),
      'read-final-send-authorization': () => ({
        rows: [
          {
            event_key: authorizationEventKey,
            contact_id: contactId,
            project_id: null,
            kind: 'delivery.submission_authorized',
            occurred_at: now,
            data: {
              bounded_stop_race: true,
              lease_token: activeLeaseToken,
            },
          },
        ],
      }),
    });

    await expect(
      authorizeLeasedJobForSubmission(harness.executor, {
        campaignEnabled: true,
        deliveryEnabled: true,
        jobId: String(jobRow().id),
        leaseToken: activeLeaseToken,
        now,
      })
    ).resolves.toMatchObject({ authorized: true });
  });

  it.each([
    ['changed contact', { contact_id: '00000000-0000-4000-8000-000000000777' }],
    ['changed time', { occurred_at: new Date('2026-09-01T12:00:01.000Z') }],
    [
      'changed data',
      { data: { bounded_stop_race: false, lease_token: 'forged' } },
    ],
  ] as const)(
    'rejects a malicious final authorization collision with %s',
    async (_case, override) => {
      const activeLeaseToken = '00000000-0000-4000-8000-000000000099';
      const harness = executorWith({
        'lock-contact-for-send': () => ({
          rows: [
            {
              id: contactId,
              email_normalized: 'developer@example.com',
              outreach_approved_at: new Date('2026-08-31T12:00:00.000Z'),
              ...validCampaignProvenance,
              deleted_at: null,
              latest_hard_stop_kind: null,
              latest_hard_stop_at: null,
            },
          ],
        }),
        'lock-job-for-send': () => ({
          rows: [
            jobRow({
              status: 'leased',
              lease_token: activeLeaseToken,
              lease_until: new Date('2026-09-01T12:05:00.000Z'),
            }),
          ],
        }),
        'insert-final-send-authorization': () => ({ rows: [] }),
        'read-final-send-authorization': () => ({
          rows: [
            {
              event_key: `job:${
                jobRow().id
              }:submission-authorized:${activeLeaseToken}`,
              contact_id: contactId,
              project_id: null,
              kind: 'delivery.submission_authorized',
              occurred_at: now,
              data: {
                bounded_stop_race: true,
                lease_token: activeLeaseToken,
              },
              ...override,
            },
          ],
        }),
      });

      await expect(
        authorizeLeasedJobForSubmission(harness.executor, {
          campaignEnabled: true,
          deliveryEnabled: true,
          jobId: String(jobRow().id),
          leaseToken: activeLeaseToken,
          now,
        })
      ).rejects.toThrow(/authorization event key conflict/u);
    }
  );

  it('reconciles provider acceptance after a bounded stop race without erasing the ledger', async () => {
    const activeLeaseToken = '00000000-0000-4000-8000-000000000099';
    const acceptedAt = new Date('2026-09-01T12:00:01.000Z');
    const harness = executorWith({
      'discover-provider-acceptance-contact': (_parameters, sql) => {
        expect(sql).not.toMatch(/for update/u);
        return { rows: [{ contact_id: contactId }] };
      },
      'lock-provider-acceptance-contact': (_parameters, sql) => {
        expect(sql).toMatch(/for update/u);
        return { rows: [{ id: contactId }] };
      },
      'lock-provider-acceptance-job': (_parameters, sql) => {
        expect(sql).toMatch(/for update/u);
        return {
          rows: [
            jobRow({
              status: 'cancelled',
              lease_token: null,
              lease_until: null,
            }),
          ],
        };
      },
      'read-final-send-authorization': () => ({
        rows: [
          {
            event_key: `job:${
              jobRow().id
            }:submission-authorized:${activeLeaseToken}`,
            contact_id: contactId,
            project_id: null,
            kind: 'delivery.submission_authorized',
            occurred_at: now,
            data: {
              bounded_stop_race: true,
              lease_token: activeLeaseToken,
            },
          },
        ],
      }),
      'accept-provider-submission': () => ({ rows: [] }),
      'reconcile-stopped-provider-submission': (parameters, sql) => {
        expect(parameters.slice(0, 5)).toEqual([
          jobRow().id,
          activeLeaseToken,
          acceptedAt,
          'resend-race-accepted',
          'submitted',
        ]);
        expect(sql).toMatch(/current\.status = 'cancelled'/u);
        expect(sql).toMatch(/delivery\.submission_authorized/u);
        expect(sql).toMatch(/growth_activity submission_authorization/u);
        expect(sql).not.toMatch(/growth_activity authorization/u);
        expect(sql).toMatch(/provider_email_id = \$4/u);
        expect(sql).toMatch(/delivery_status = \$5/u);
        return {
          rows: [
            jobRow({
              status: 'completed',
              lease_token: null,
              lease_until: null,
              provider_email_id: 'resend-race-accepted',
              delivery_status: 'submitted',
            }),
          ],
        };
      },
      'insert-provider-acceptance-activity': () => ({
        rows: [{ event_key: `job:${jobRow().id}:provider-accepted` }],
      }),
      'anchor-campaign-cadence': () => ({ rows: [] }),
    });

    const result = await recordProviderAcceptance(harness.executor, {
      jobId: String(jobRow().id),
      leaseToken: activeLeaseToken,
      acceptedAt,
      providerEmailId: 'resend-race-accepted',
    });

    expect(result).toMatchObject({
      status: 'completed',
      providerEmailId: 'resend-race-accepted',
      deliveryStatus: 'submitted',
    });
    expect(harness.calls.map(({ marker }) => marker).slice(0, 4)).toEqual([
      'discover-provider-acceptance-contact',
      'lock-provider-acceptance-contact',
      'lock-provider-acceptance-job',
      'read-final-send-authorization',
    ]);
  });

  it('refuses cancelled reconciliation without the exact prior authorization envelope', async () => {
    const activeLeaseToken = '00000000-0000-4000-8000-000000000099';
    const harness = executorWith({
      'discover-provider-acceptance-contact': () => ({
        rows: [{ contact_id: contactId }],
      }),
      'lock-provider-acceptance-contact': () => ({
        rows: [{ id: contactId }],
      }),
      'lock-provider-acceptance-job': () => ({
        rows: [
          jobRow({ status: 'cancelled', lease_token: null, lease_until: null }),
        ],
      }),
      'read-final-send-authorization': () => ({
        rows: [
          {
            event_key: `job:${
              jobRow().id
            }:submission-authorized:${activeLeaseToken}`,
            contact_id: contactId,
            project_id: null,
            kind: 'delivery.submission_authorized',
            occurred_at: now,
            data: {
              bounded_stop_race: false,
              lease_token: 'forged',
            },
          },
        ],
      }),
    });

    await expect(
      recordProviderAcceptance(harness.executor, {
        jobId: String(jobRow().id),
        leaseToken: activeLeaseToken,
        acceptedAt: new Date('2026-09-01T12:00:01.000Z'),
        providerEmailId: 'resend-forged-race',
      })
    ).rejects.toThrow(/authorization event key conflict/u);
    expect(harness.calls.map(({ marker }) => marker)).not.toContain(
      'reconcile-stopped-provider-submission'
    );
  });
});
