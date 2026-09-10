import { describe, expect, it, vi } from 'vitest';
import {
  prepareFormAdmission,
  recordFormAdmission,
  FormRateLimitError,
} from './form-admission.ts';
import type { SqlTransaction } from './database.ts';

const input = {
  submissionId: '20000000-0000-4000-8000-000000000002',
  email: 'person@gmail.com',
  form: { kind: 'contact' as const, message: 'Hello there' },
  source: 'website',
  sourceForm: 'contact',
  noticeText: 'Follow up',
  noticeVersion: 'v1',
  policyVersion: 'v1',
  keyring: {
    active: { version: 1, secret: 'a-long-admission-secret-for-tests-only' },
  },
  occurredAt: new Date('2026-09-09T14:01:00Z'),
};

function harness(count = 1, unavailable = false) {
  const queries: string[] = [];
  const tx: SqlTransaction = {
    execute: vi.fn(async (q: string) => {
      queries.push(q);
      if (q.includes('growth:consume-form-budget')) {
        if (unavailable) throw new Error('provider secret should not leak');
        return { rows: [{ count }] };
      }
      return { rows: [] };
    }) as SqlTransaction['execute'],
  };
  return { tx, queries };
}

describe('transactional form admission', () => {
  it('replays the immutable decision without consuming a budget and rejects changed identities', async () => {
    const h = harness();
    const first = await prepareFormAdmission(h.tx, input);
    const result = {
      accepted: true as const,
      approved: true,
      contactId: 'contact',
      submissionId: input.submissionId,
    };
    await recordFormAdmission(h.tx, input, first, result);
    const call = vi
      .mocked(h.tx.execute)
      .mock.calls.find(([q]) => q.includes('record-form-assessment'));
    const data = JSON.parse(String(call?.[1]?.[3]));
    const tx: SqlTransaction = {
      execute: vi.fn(async (q: string) => ({
        rows: q.includes('read-form-assessment') ? [{ data }] : [],
      })) as SqlTransaction['execute'],
    };
    expect((await prepareFormAdmission(tx, input)).replay).toEqual(result);
    expect(
      vi
        .mocked(tx.execute)
        .mock.calls.some(([q]) => q.includes('consume-form-budget'))
    ).toBe(false);
    await expect(
      prepareFormAdmission(tx, { ...input, email: 'other@gmail.com' })
    ).rejects.toThrow('identity conflict');
  });

  it('corroborates a placeholder with a recent different identity', async () => {
    const h = harness();
    const original = h.tx.execute;
    h.tx.execute = vi.fn(async (q: string, p: readonly unknown[] = []) =>
      q.includes('read-form-history')
        ? {
            rows: [
              {
                display_name: 'Earlier Person',
                company_name: 'Earlier Company',
              },
            ],
          }
        : original(q, p)
    ) as SqlTransaction['execute'];
    expect(
      (
        await prepareFormAdmission(h.tx, {
          ...input,
          email: 'test@example.com',
          displayName: 'New Person',
          companyName: 'New Company',
        })
      ).assessment
    ).toMatchObject({
      score: 80,
      decision: 'blocked',
      category: 'placeholder_email',
    });
  });

  it('limits the sixth new email submission with a bounded retry time', async () => {
    const h = harness(6);
    await expect(prepareFormAdmission(h.tx, input)).rejects.toMatchObject({
      retryAfterSec: 3540,
    });
    expect(
      h.queries.some((q) => q.includes('savepoint growth_form_budget'))
    ).toBe(true);
  });
  it('continues local scoring after rolling back a failed budget operation', async () => {
    const h = harness(1, true);
    const result = await prepareFormAdmission(h.tx, input);
    expect(result).toMatchObject({
      limiterUnavailable: true,
      assessment: { decision: 'allow' },
    });
    expect(h.queries).toContain('rollback to savepoint growth_form_budget');
  });
  it('does not mistake a denied budget for an infrastructure failure', async () => {
    const h = harness(21);
    await expect(
      prepareFormAdmission(h.tx, { ...input, trustedClientIp: '203.0.113.5' })
    ).rejects.toBeInstanceOf(FormRateLimitError);
  });
  it('locks a normalized identity before inspecting history', async () => {
    const h = harness();
    await prepareFormAdmission(h.tx, { ...input, email: ' Person@Gmail.com ' });
    expect(h.tx.execute).toHaveBeenCalledWith(
      expect.stringContaining('growth:lock-form-email'),
      ['person@gmail.com']
    );
    expect(
      h.queries.findIndex((q) => q.includes('lock-form-email'))
    ).toBeLessThan(h.queries.findIndex((q) => q.includes('read-form-history')));
  });
});
