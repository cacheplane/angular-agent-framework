import { describe, expect, it, vi } from 'vitest';

import type { SqlExecutor, SqlTransaction } from './database.ts';
import type { EmailHmacKeyring } from './crypto.ts';
import { acceptFormSubmission } from './forms.ts';

const keyring: EmailHmacKeyring = {
  active: {
    version: 1,
    secret: 'forms-test-secret-that-is-at-least-32-bytes-long',
  },
};

const occurredAt = new Date('2026-09-01T18:00:00.000Z');

function createHarness(
  authorization: 'approved' | 'stopped' | 'deleted' = 'approved',
  validJobReplay = true
) {
  const queries: { sql: string; parameters: readonly unknown[] }[] = [];
  const insertedJobKeys: string[] = [];
  const jobKeys = new Set<string>();
  const transaction: SqlTransaction = {
    execute: vi.fn(async (sql: string, parameters: readonly unknown[] = []) => {
      queries.push({ sql, parameters });
      if (sql.includes('growth:enqueue-form-jobs') && validJobReplay) {
        const kinds =
          parameters[3] === true
            ? ['fulfill', 'enrich', 'notify']
            : ['fulfill'];
        for (const kind of kinds) {
          const key = `form:${String(parameters[2])}:${kind}`;
          if (!jobKeys.has(key)) {
            jobKeys.add(key);
            insertedJobKeys.push(key);
          }
        }
        return {
          rows: kinds.map((kind) => ({
            idempotency_key: `form:${String(parameters[2])}:${kind}`,
          })),
        };
      }
      return { rows: [] };
    }),
  };
  const executor: SqlExecutor = {
    execute: transaction.execute,
    transaction: vi.fn(async (operation) => operation(transaction)),
  };
  const approveContact = vi.fn(async () => ({
    contactId: '10000000-0000-4000-8000-000000000001',
    authorization,
    canSend: authorization === 'approved',
    formApprovalGranted: authorization === 'approved',
    outreachApprovedAt: authorization === 'approved' ? occurredAt : null,
    latestHardStop:
      authorization === 'stopped'
        ? { reason: 'unsubscribe' as const, occurredAt }
        : authorization === 'deleted'
        ? { reason: 'deletion' as const, occurredAt }
        : null,
    deletedAt: authorization === 'deleted' ? occurredAt : null,
    updatedAt: occurredAt,
  }));
  return {
    executor,
    transaction,
    queries,
    approveContact,
    insertedJobKeys,
  };
}

const baseInput = {
  submissionId: '20000000-0000-4000-8000-000000000002',
  email: ' Person@Example.com ',
  displayName: 'Person',
  companyName: 'Example',
  form: {
    kind: 'whitepaper' as const,
    paper: 'chat' as const,
  },
  source: 'website',
  sourceForm: 'whitepaper',
  noticeText:
    'Send me the guide and a short, three-email follow-up from Brian about building with Threadplane. Unsubscribe anytime.',
  noticeVersion: 'growth_v1.whitepaper.2026-09-01',
  policyVersion: 'growth_v1.2026-09-01',
  acquisitionSessionId: '30000000-0000-4000-8000-000000000003',
  occurredAt,
  keyring,
};

describe('acceptFormSubmission', () => {
  it('approves and enqueues fulfillment, enrichment, and notification in one transaction', async () => {
    const harness = createHarness();

    const result = await acceptFormSubmission(harness.executor, baseInput, {
      approveContact: harness.approveContact,
    });

    expect(harness.executor.transaction).toHaveBeenCalledTimes(1);
    expect(harness.approveContact).toHaveBeenCalledWith(
      harness.transaction,
      expect.objectContaining({
        email: baseInput.email,
        eventKey: `form:${baseInput.submissionId}:accepted`,
        policyVersion: baseInput.policyVersion,
        submittedFacts: {
          acquisition_session_id: baseInput.acquisitionSessionId,
          form_kind: 'whitepaper',
          paper: 'chat',
          submission_id: baseInput.submissionId,
        },
      })
    );
    expect(result).toEqual({
      accepted: true,
      approved: true,
      contactId: '10000000-0000-4000-8000-000000000001',
      submissionId: baseInput.submissionId,
    });

    const enqueue = harness.queries.find(({ sql }) =>
      sql.includes('growth:enqueue-form-jobs')
    );
    expect(enqueue?.sql).toContain("'fulfill'");
    expect(enqueue?.sql).toContain("'enrich'");
    expect(enqueue?.sql).toContain("'notify'");
    expect(enqueue?.sql).not.toContain("'send_step'");
    expect(enqueue?.sql).toContain('on conflict (idempotency_key) do nothing');
    expect(enqueue?.parameters).toContain(baseInput.submissionId);
  });

  it.each(['stopped', 'deleted'] as const)(
    'queues fulfillment but no campaign-adjacent work for a %s contact',
    async (authorization) => {
      const harness = createHarness(authorization);

      const result = await acceptFormSubmission(harness.executor, baseInput, {
        approveContact: harness.approveContact,
      });

      expect(result.approved).toBe(false);
      const enqueue = harness.queries.find(({ sql }) =>
        sql.includes('growth:enqueue-form-jobs')
      );
      expect(enqueue?.parameters).toContain(false);
      expect(enqueue?.sql).not.toContain("'send_step'");
    }
  );

  it('uses the submission UUID for retry idempotency while a later submission gets new job keys', async () => {
    const first = createHarness();
    await acceptFormSubmission(first.executor, baseInput, {
      approveContact: first.approveContact,
    });
    const second = createHarness();
    await acceptFormSubmission(
      second.executor,
      {
        ...baseInput,
        submissionId: '20000000-0000-4000-8000-000000000099',
        occurredAt: new Date('2026-09-01T18:05:00.000Z'),
      },
      { approveContact: second.approveContact }
    );

    const firstKeys = JSON.stringify(
      first.queries.find(({ sql }) => sql.includes('growth:enqueue-form-jobs'))
        ?.parameters
    );
    const secondKeys = JSON.stringify(
      second.queries.find(({ sql }) => sql.includes('growth:enqueue-form-jobs'))
        ?.parameters
    );
    expect(firstKeys).toContain(baseInput.submissionId);
    expect(secondKeys).toContain('20000000-0000-4000-8000-000000000099');
    expect(firstKeys).not.toBe(secondKeys);
  });

  it('uses the immutable original approval outcome when the same UUID is replayed at a later time', async () => {
    const harness = createHarness();
    harness.approveContact
      .mockResolvedValueOnce({
        contactId: '10000000-0000-4000-8000-000000000001',
        authorization: 'approved',
        canSend: true,
        formApprovalGranted: true,
        outreachApprovedAt: occurredAt,
        latestHardStop: null,
        deletedAt: null,
        updatedAt: occurredAt,
      })
      .mockResolvedValueOnce({
        contactId: '10000000-0000-4000-8000-000000000001',
        authorization: 'stopped',
        canSend: false,
        formApprovalGranted: true,
        outreachApprovedAt: occurredAt,
        latestHardStop: {
          reason: 'unsubscribe',
          occurredAt: new Date('2026-09-01T18:03:00.000Z'),
        },
        deletedAt: null,
        updatedAt: new Date('2026-09-01T18:03:00.000Z'),
      });

    const first = await acceptFormSubmission(harness.executor, baseInput, {
      approveContact: harness.approveContact,
    });
    const replay = await acceptFormSubmission(
      harness.executor,
      {
        ...baseInput,
        occurredAt: new Date('2026-09-01T18:05:00.000Z'),
      },
      { approveContact: harness.approveContact }
    );

    expect(first.approved).toBe(true);
    expect(replay.approved).toBe(true);
    const enqueueCalls = harness.queries.filter(({ sql }) =>
      sql.includes('growth:enqueue-form-jobs')
    );
    expect(enqueueCalls).toHaveLength(2);
    expect(enqueueCalls.every(({ parameters }) => parameters[3] === true)).toBe(
      true
    );
    expect(enqueueCalls[1]?.sql).toContain(
      'on conflict (idempotency_key) do nothing'
    );
    expect(harness.insertedJobKeys).toHaveLength(3);
  });

  it('does not add campaign work when a denied submission is replayed after explicit reauthorization', async () => {
    const harness = createHarness('stopped');
    harness.approveContact
      .mockResolvedValueOnce({
        contactId: '10000000-0000-4000-8000-000000000001',
        authorization: 'stopped',
        canSend: false,
        formApprovalGranted: false,
        outreachApprovedAt: null,
        latestHardStop: { reason: 'unsubscribe', occurredAt },
        deletedAt: null,
        updatedAt: occurredAt,
      })
      .mockResolvedValueOnce({
        contactId: '10000000-0000-4000-8000-000000000001',
        authorization: 'approved',
        canSend: true,
        formApprovalGranted: false,
        outreachApprovedAt: new Date('2026-09-01T18:04:00.000Z'),
        latestHardStop: { reason: 'unsubscribe', occurredAt },
        deletedAt: null,
        updatedAt: new Date('2026-09-01T18:04:00.000Z'),
      });

    const first = await acceptFormSubmission(harness.executor, baseInput, {
      approveContact: harness.approveContact,
    });
    const replay = await acceptFormSubmission(
      harness.executor,
      { ...baseInput, occurredAt: new Date('2026-09-01T18:05:00.000Z') },
      { approveContact: harness.approveContact }
    );

    expect(first.approved).toBe(false);
    expect(replay.approved).toBe(false);
    const enqueueCalls = harness.queries.filter(({ sql }) =>
      sql.includes('growth:enqueue-form-jobs')
    );
    expect(enqueueCalls).toHaveLength(2);
    expect(
      enqueueCalls.every(({ parameters }) => parameters[3] === false)
    ).toBe(true);
    expect(harness.insertedJobKeys).toHaveLength(1);
  });

  it('rejects arbitrary or oversized submitted facts before opening a transaction', async () => {
    const harness = createHarness();

    await expect(
      acceptFormSubmission(
        harness.executor,
        {
          ...baseInput,
          form: {
            kind: 'contact',
            message: 'x'.repeat(2_001),
          },
        },
        { approveContact: harness.approveContact }
      )
    ).rejects.toThrow(/message/u);
    expect(harness.executor.transaction).not.toHaveBeenCalled();
  });

  it('rejects a submission UUID collision with jobs owned by another contact', async () => {
    const harness = createHarness('approved', false);

    await expect(
      acceptFormSubmission(harness.executor, baseInput, {
        approveContact: harness.approveContact,
      })
    ).rejects.toThrow(/job idempotency conflict/u);
  });
});
