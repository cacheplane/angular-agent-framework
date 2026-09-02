import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type {
  SqlExecutor,
  SqlQueryResult,
  SqlTransaction,
} from './database.ts';
import {
  GoogleReplyReplayError,
  parseGoogleMailboxEvent,
  processGoogleMailboxEvent,
  isGoogleMailboxRecoveryPaused,
  rankGoogleReplyCandidates,
  selectBestGoogleReplyResolution,
  settleGoogleReplyReconciliation,
  sha256Base64Url,
  verifyGoogleReplySignature,
} from './replies.ts';

type TestRow = Record<string, unknown>;

const now = new Date('2026-09-01T12:00:00.000Z');
const timestamp = String(now.getTime());
const secret = 'g'.repeat(32);
const nonce = 'nonce_0123456789abcdef';
const contactId = '00000000-0000-4000-8000-000000000002';
const jobId = '00000000-0000-4000-8000-000000000001';

function signature(rawBody: string, at = timestamp, key = secret): string {
  const digest = sha256Base64Url(rawBody);
  return `v1=${createHmac('sha256', key)
    .update(`${at}\n${nonce}\n${digest}`)
    .digest('base64url')}`;
}

function seed(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: 'seed',
    version: 1,
    gmail_message_id: '18cafe123abc',
    rfc_message_id: '<seed.1@threadplane.ai>',
    occurred_at: now.toISOString(),
    from: 'Brian at Threadplane <brian@threadplane.ai>',
    verification: 'gmail_auth_aligned',
    x_threadplane_job_id: jobId,
    ...overrides,
  });
}

function reply(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: 'reply',
    version: 1,
    gmail_message_id: '18cafe123abd',
    rfc_message_id: '<reply.1@example.com>',
    occurred_at: now.toISOString(),
    from: 'Developer <developer@example.com>',
    in_reply_to: '<seed.1@threadplane.ai>',
    references: ['<older@example.com>', '<seed.1@threadplane.ai>'],
    ...overrides,
  });
}

function recoveryRequired(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: 'recovery_required',
    version: 1,
    recovery_id: '00000000-0000-4000-8000-000000000123',
    occurred_at: now.toISOString(),
    reason: 'history_expired',
    ...overrides,
  });
}

function recoveryCompleted(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: 'recovery_completed',
    version: 1,
    recovery_id: '00000000-0000-4000-8000-000000000123',
    occurred_at: now.toISOString(),
    ...overrides,
  });
}

function messageUnavailable(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: 'message_unavailable',
    version: 1,
    gmail_message_id: 'vanished-message',
    occurred_at: now.toISOString(),
    reason: 'not_found',
    ...overrides,
  });
}

function executorWith(
  handlers: Record<
    string,
    (parameters: readonly unknown[], sql: string) => SqlQueryResult<TestRow>
  >
): { executor: SqlExecutor; calls: string[] } {
  const calls: string[] = [];
  const transaction: SqlTransaction = {
    async execute<Row extends Record<string, unknown>>(
      sql: string,
      parameters: readonly unknown[] = []
    ): Promise<SqlQueryResult<Row>> {
      const marker = /\/\* growth:([a-z0-9-]+) \*\//u.exec(sql)?.[1];
      const handler = marker ? handlers[marker] : undefined;
      if (marker === 'read-google-mailbox-recovery-pause' && !handler) {
        calls.push(marker);
        return { rows: [{ paused: false }] } as SqlQueryResult<Row>;
      }
      if (!marker || !handler) {
        throw new Error(`Unexpected SQL marker: ${marker ?? 'missing'}`);
      }
      calls.push(marker);
      return handler(parameters, sql) as SqlQueryResult<Row>;
    },
  };
  return {
    calls,
    executor: {
      execute: transaction.execute,
      transaction: async (operation) => operation(transaction),
    },
  };
}

function commonHandlers(overrides: Record<string, TestRow[]> = {}) {
  const rows = (key: string, fallback: TestRow[]) => overrides[key] ?? fallback;
  return {
    'acquire-google-reconcile-advisory-lock': () => ({ rows: [{}] }),
    'claim-google-reply-nonce': () => ({
      rows: rows('nonce', [{ event_key: 'nonce' }]),
    }),
    'insert-google-mailbox-event': () => ({
      rows: rows('insert-event', [{ event_key: 'gmail' }]),
    }),
    'read-google-mailbox-event': () => ({ rows: rows('read-event', []) }),
    'insert-google-mailbox-rejection': () => ({
      rows: rows('insert-rejection', [{ event_key: 'rejected' }]),
    }),
    'read-google-mailbox-rejection': () => ({
      rows: rows('read-rejection', []),
    }),
    'read-google-mailbox-recovery-pause': () => ({
      rows: [{ paused: false }],
    }),
  };
}

describe('Google reply HMAC envelope', () => {
  it('accepts only the exact timestamp, nonce, and raw-body digest envelope', () => {
    const rawBody = seed();
    expect(() =>
      verifyGoogleReplySignature({
        rawBody,
        timestamp,
        nonce,
        signature: signature(rawBody),
        secret,
        now,
      })
    ).not.toThrow();

    expect(() =>
      verifyGoogleReplySignature({
        rawBody: `${rawBody} `,
        timestamp,
        nonce,
        signature: signature(rawBody),
        secret,
        now,
      })
    ).toThrow(/signature/u);
    expect(() =>
      verifyGoogleReplySignature({
        rawBody,
        timestamp,
        nonce,
        signature: signature(rawBody, timestamp, 'x'.repeat(32)),
        secret,
        now,
      })
    ).toThrow(/signature/u);
  });

  it.each([
    [String(now.getTime() - 300_001), 'stale'],
    [String(now.getTime() + 300_001), 'future'],
    ['01788264000000', 'leading zero'],
    ['1788264000.0', 'decimal'],
    ['+1788264000000', 'signed'],
  ])('rejects a %s timestamp (%s)', (invalidTimestamp) => {
    const rawBody = seed();
    expect(() =>
      verifyGoogleReplySignature({
        rawBody,
        timestamp: invalidTimestamp,
        nonce,
        signature: signature(rawBody, invalidTimestamp),
        secret,
        now,
      })
    ).toThrow(/timestamp/u);
  });

  it('rejects weak secrets and non-closed nonce/signature encodings', () => {
    const rawBody = seed();
    const validSignature = signature(rawBody);
    const base64UrlAlphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const lastIndex = base64UrlAlphabet.indexOf(validSignature.at(-1) ?? '');
    const noncanonicalLastCharacter =
      base64UrlAlphabet[(lastIndex & 60) | ((lastIndex + 1) & 3)];
    const noncanonicalSignature = `${validSignature.slice(
      0,
      -1
    )}${noncanonicalLastCharacter}`;
    for (const input of [
      { secret: 'short', nonce, signature: signature(rawBody) },
      { secret, nonce: 'bad nonce', signature: signature(rawBody) },
      { secret, nonce, signature: `sha256=${'a'.repeat(43)}` },
      { secret, nonce, signature: `v1=${'A'.repeat(44)}` },
      { secret, nonce, signature: noncanonicalSignature },
    ]) {
      expect(() =>
        verifyGoogleReplySignature({
          rawBody,
          timestamp,
          now,
          ...input,
        })
      ).toThrow();
    }
  });
});

describe('ranked reply reconciliation', () => {
  it('ranks In-Reply-To first and References newest-first regardless of seed arrival', () => {
    expect(
      rankGoogleReplyCandidates({
        inReplyTo: '<direct@example.com>',
        references: [
          '<oldest@example.com>',
          '<newest@example.com>',
          '<direct@example.com>',
        ],
      })
    ).toEqual([
      { message_id: '<direct@example.com>', rank: 0 },
      { message_id: '<newest@example.com>', rank: 1 },
      { message_id: '<oldest@example.com>', rank: 2 },
    ]);
  });

  it.each([
    ['lower seed first', [1, 0]],
    ['direct seed first', [0, 1]],
  ])('selects the same contact when %s', (_case, arrivalRanks) => {
    const candidates = arrivalRanks.map((rank) => ({
      message_id: rank === 0 ? '<direct@example.com>' : '<lower@example.com>',
      rank,
      contact_id:
        rank === 0 ? '00000000-0000-4000-8000-000000000077' : contactId,
      seed_job_id: rank === 0 ? '00000000-0000-4000-8000-000000000066' : jobId,
    }));
    expect(selectBestGoogleReplyResolution(candidates)?.rank).toBe(0);
    expect(selectBestGoogleReplyResolution(candidates)?.contact_id).toBe(
      '00000000-0000-4000-8000-000000000077'
    );
  });

  it('records a lower-ranked seed without stopping before the settlement window', async () => {
    const raw = seed({
      gmail_message_id: 'lower-seed',
      rfc_message_id: '<lower@example.com>',
    });
    const payload = {
      gmail_message_id: 'reply-ranked',
      occurred_at: now.toISOString(),
      in_reply_to: '<direct@example.com>',
      references: ['<lower@example.com>'],
      ranked_candidates: [
        { message_id: '<direct@example.com>', rank: 0 },
        { message_id: '<lower@example.com>', rank: 20 },
      ],
      resolved_candidates: [],
    };
    const stopContact = vi.fn();
    const test = executorWith({
      ...commonHandlers(),
      'discover-google-seed-job': () => ({ rows: [{ contact_id: contactId }] }),
      'lock-google-seed-contact': () => ({
        rows: [{ id: contactId, deleted_at: null }],
      }),
      'lock-google-seed-job': () => ({
        rows: [
          {
            id: jobId,
            kind: 'send_step',
            contact_id: contactId,
            status: 'completed',
            provider_email_id: 'resend-lower',
            delivery_status: 'submitted',
            rfc_message_id: null,
            gmail_seed_message_id: null,
          },
        ],
      }),
      'check-google-seed-binding-conflicts': () => ({ rows: [] }),
      'bind-google-seed-identifiers': () => ({ rows: [{ id: jobId }] }),
      'lock-google-reconcile-for-seed': (_parameters, sql) => {
        expect(sql).toMatch(/status in \('pending', 'leased'\)/u);
        return {
          rows: [
            {
              id: 'reconcile-ranked',
              contact_id: null,
              status: 'leased',
              payload,
            },
          ],
        };
      },
      'record-google-reconcile-candidate': (_parameters, sql) => {
        expect(sql).toMatch(/status in \('pending', 'leased'\)/u);
        return { rows: [{ id: 'reconcile-ranked' }] };
      },
    });

    await expect(
      processGoogleMailboxEvent(
        test.executor,
        {
          event: parseGoogleMailboxEvent(raw),
          nonce: 'lower_rank_nonce_012345',
          timestamp,
          requestDigest: sha256Base64Url(raw),
          receivedAt: now,
        },
        { stopContact }
      )
    ).resolves.toEqual({ applied: true, outcome: 'seed_registered' });
    expect(stopContact).not.toHaveBeenCalled();
    expect(test.calls).not.toContain('complete-google-reconciled-reply');
  });

  it('settles a leased reconciliation against the best persisted candidate', async () => {
    const leaseToken = '00000000-0000-4000-8000-000000000099';
    const reconcileId = '00000000-0000-4000-8000-000000000088';
    const highContact = '00000000-0000-4000-8000-000000000077';
    const payload = {
      gmail_message_id: 'reply-ranked',
      occurred_at: now.toISOString(),
      resolved_candidates: [
        {
          message_id: '<lower@example.com>',
          rank: 1,
          contact_id: contactId,
          seed_job_id: jobId,
        },
        {
          message_id: '<direct@example.com>',
          rank: 0,
          contact_id: highContact,
          seed_job_id: '00000000-0000-4000-8000-000000000066',
        },
        {
          message_id: '<oldest-maximum@example.com>',
          rank: 20,
          contact_id: '00000000-0000-4000-8000-000000000055',
          seed_job_id: '00000000-0000-4000-8000-000000000044',
        },
      ],
    };
    const stopContact = vi.fn().mockResolvedValue({ applied: true });
    const handlers = {
      'read-google-reconcile-settlement': () => ({
        rows: [
          {
            id: reconcileId,
            kind: 'reply_reconcile',
            status: 'leased',
            lease_token: leaseToken,
            attempts: 1,
            payload,
          },
        ],
      }),
      'acquire-google-reconcile-advisory-lock': () => ({ rows: [{}] }),
      'read-current-google-reconcile-settlement': () => ({
        rows: [
          {
            id: reconcileId,
            kind: 'reply_reconcile',
            status: 'leased',
            lease_token: leaseToken,
            attempts: 1,
            payload,
          },
        ],
      }),
      'lock-google-reconcile-contact': (parameters: readonly unknown[]) => {
        expect(parameters[0]).toBe(highContact);
        return { rows: [{ id: highContact, deleted_at: null }] };
      },
      'lock-leased-google-reconcile': () => ({
        rows: [
          {
            id: reconcileId,
            kind: 'reply_reconcile',
            status: 'leased',
            lease_token: leaseToken,
            attempts: 1,
            payload,
          },
        ],
      }),
      'complete-leased-google-reconcile': () => ({
        rows: [{ id: reconcileId }],
      }),
    };
    const test = executorWith(handlers);

    await expect(
      settleGoogleReplyReconciliation(
        test.executor,
        { jobId: reconcileId, leaseToken, now },
        { stopContact }
      )
    ).resolves.toBe('completed');
    expect(stopContact).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ contactId: highContact })
    );
    expect(test.calls.indexOf('lock-google-reconcile-contact')).toBeLessThan(
      test.calls.indexOf('lock-leased-google-reconcile')
    );
  });

  it('reselects the current ranked candidate after serializing against a racing rank-zero seed', async () => {
    const leaseToken = '00000000-0000-4000-8000-000000000099';
    const reconcileId = '00000000-0000-4000-8000-000000000088';
    const highContact = '00000000-0000-4000-8000-000000000077';
    const lowerPayload = {
      gmail_message_id: 'racing-reply',
      occurred_at: now.toISOString(),
      resolved_candidates: [
        {
          message_id: '<lower@example.com>',
          rank: 1,
          contact_id: contactId,
          seed_job_id: jobId,
        },
      ],
    };
    const currentPayload = {
      ...lowerPayload,
      resolved_candidates: [
        ...lowerPayload.resolved_candidates,
        {
          message_id: '<direct@example.com>',
          rank: 0,
          contact_id: highContact,
          seed_job_id: '00000000-0000-4000-8000-000000000066',
        },
      ],
    };
    const leased = (payload: Record<string, unknown>) => ({
      id: reconcileId,
      kind: 'reply_reconcile',
      status: 'leased',
      lease_token: leaseToken,
      attempts: 1,
      payload,
    });
    const stopContact = vi.fn().mockResolvedValue({ applied: true });
    const test = executorWith({
      'read-google-reconcile-settlement': () => ({
        rows: [leased(lowerPayload)],
      }),
      'acquire-google-reconcile-advisory-lock': () => ({ rows: [{}] }),
      'read-current-google-reconcile-settlement': () => ({
        rows: [leased(currentPayload)],
      }),
      'lock-google-reconcile-contact': (parameters) => {
        expect(parameters[0]).toBe(highContact);
        return { rows: [{ id: highContact, deleted_at: null }] };
      },
      'lock-leased-google-reconcile': () => ({
        rows: [leased(currentPayload)],
      }),
      'complete-leased-google-reconcile': () => ({
        rows: [{ id: reconcileId }],
      }),
    });

    await expect(
      settleGoogleReplyReconciliation(
        test.executor,
        { jobId: reconcileId, leaseToken, now },
        { stopContact }
      )
    ).resolves.toBe('completed');
    expect(stopContact).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ contactId: highContact })
    );
  });

  it('cancels a leased reconcile when the serialized rank-zero contact was deleted instead of stopping the stale lower rank', async () => {
    const leaseToken = '00000000-0000-4000-8000-000000000099';
    const reconcileId = '00000000-0000-4000-8000-000000000088';
    const deletedContact = '00000000-0000-4000-8000-000000000077';
    const lowerPayload = {
      gmail_message_id: 'racing-deleted-reply',
      occurred_at: now.toISOString(),
      resolved_candidates: [
        {
          message_id: '<lower@example.com>',
          rank: 1,
          contact_id: contactId,
          seed_job_id: jobId,
        },
      ],
    };
    const currentPayload = {
      ...lowerPayload,
      resolved_candidates: [
        ...lowerPayload.resolved_candidates,
        {
          message_id: '<direct@example.com>',
          rank: 0,
          contact_id: deletedContact,
          seed_job_id: '00000000-0000-4000-8000-000000000066',
        },
      ],
    };
    const leased = (payload: Record<string, unknown>) => ({
      id: reconcileId,
      kind: 'reply_reconcile',
      status: 'leased',
      lease_token: leaseToken,
      attempts: 1,
      payload,
    });
    const stopContact = vi.fn();
    const test = executorWith({
      'read-google-reconcile-settlement': () => ({
        rows: [leased(lowerPayload)],
      }),
      'acquire-google-reconcile-advisory-lock': () => ({ rows: [{}] }),
      'read-current-google-reconcile-settlement': () => ({
        rows: [leased(currentPayload)],
      }),
      'lock-google-reconcile-contact': (parameters) => {
        expect(parameters[0]).toBe(deletedContact);
        return {
          rows: [
            {
              id: deletedContact,
              deleted_at: '2026-09-01T11:00:00.000Z',
            },
          ],
        };
      },
      'lock-leased-google-reconcile': () => ({
        rows: [leased(currentPayload)],
      }),
      'cancel-deleted-google-reconcile': () => ({
        rows: [{ id: reconcileId }],
      }),
    });

    await expect(
      settleGoogleReplyReconciliation(
        test.executor,
        { jobId: reconcileId, leaseToken, now },
        { stopContact }
      )
    ).resolves.toBe('ignored_deleted');
    expect(stopContact).not.toHaveBeenCalled();
  });

  it('removes a deleted lower-rank candidate and retries instead of cancelling the leased reconciliation', async () => {
    const leaseToken = '00000000-0000-4000-8000-000000000099';
    const reconcileId = '00000000-0000-4000-8000-000000000088';
    const payload = {
      gmail_message_id: 'deleted-lower-reply',
      occurred_at: now.toISOString(),
      resolved_candidates: [
        {
          message_id: '<lower@example.com>',
          rank: 1,
          contact_id: contactId,
          seed_job_id: jobId,
        },
      ],
    };
    const leased = {
      id: reconcileId,
      kind: 'reply_reconcile',
      status: 'leased',
      lease_token: leaseToken,
      attempts: 1,
      payload,
    };
    const stopContact = vi.fn();
    const test = executorWith({
      'read-google-reconcile-settlement': () => ({ rows: [leased] }),
      'acquire-google-reconcile-advisory-lock': () => ({ rows: [{}] }),
      'read-current-google-reconcile-settlement': () => ({ rows: [leased] }),
      'lock-google-reconcile-contact': () => ({
        rows: [{ id: contactId, deleted_at: '2026-09-01T11:00:00.000Z' }],
      }),
      'lock-leased-google-reconcile': () => ({ rows: [leased] }),
      'defer-deleted-lower-google-reconcile': (parameters) => {
        expect(parameters[2]).toBe('pending');
        expect(JSON.parse(String(parameters[3]))).toMatchObject({
          resolved_candidates: [],
        });
        return { rows: [{ id: reconcileId }] };
      },
    });

    await expect(
      settleGoogleReplyReconciliation(
        test.executor,
        { jobId: reconcileId, leaseToken, now },
        { stopContact }
      )
    ).resolves.toBe('retry_scheduled');
    expect(stopContact).not.toHaveBeenCalled();
    expect(test.calls).not.toContain('cancel-deleted-google-reconcile');
  });

  it('rechecks recovery pause under the advisory lock before a leased settlement can stop a contact', async () => {
    const leaseToken = '00000000-0000-4000-8000-000000000099';
    const reconcileId = '00000000-0000-4000-8000-000000000088';
    const leased = {
      id: reconcileId,
      kind: 'reply_reconcile',
      status: 'leased',
      lease_token: leaseToken,
      attempts: 1,
      payload: {
        gmail_message_id: 'paused-settlement',
        occurred_at: now.toISOString(),
        resolved_candidates: [
          {
            message_id: '<direct@example.com>',
            rank: 0,
            contact_id: contactId,
            seed_job_id: jobId,
          },
        ],
      },
    };
    const stopContact = vi.fn();
    const test = executorWith({
      'read-google-reconcile-settlement': () => ({ rows: [leased] }),
      'acquire-google-reconcile-advisory-lock': () => ({ rows: [{}] }),
      'read-google-mailbox-recovery-pause': () => ({
        rows: [{ paused: true }],
      }),
    });

    await expect(
      settleGoogleReplyReconciliation(
        test.executor,
        { jobId: reconcileId, leaseToken, now },
        { stopContact }
      )
    ).resolves.toBe('recovery_paused');
    expect(stopContact).not.toHaveBeenCalled();
    expect(test.calls).not.toContain(
      'read-current-google-reconcile-settlement'
    );
  });
});

describe('parseGoogleMailboxEvent', () => {
  it('accepts the closed seed and reply shapes and normalizes addresses/message IDs', () => {
    expect(parseGoogleMailboxEvent(seed())).toMatchObject({
      kind: 'seed',
      from: 'brian@threadplane.ai',
      verification: 'gmail_auth_aligned',
      rfcMessageId: '<seed.1@threadplane.ai>',
      jobId,
    });
    expect(
      parseGoogleMailboxEvent(
        reply({
          from: ' DEVELOPER@EXAMPLE.COM ',
          in_reply_to: '  <Seed.1@Threadplane.AI> ',
        })
      )
    ).toMatchObject({
      kind: 'reply',
      from: 'developer@example.com',
      inReplyTo: '<Seed.1@threadplane.ai>',
    });
  });

  it.each([
    { subject: 'hello' },
    { body: 'secret' },
    { snippet: 'secret' },
    { payload: { headers: [] } },
    { arbitrary_metadata: {} },
    { attachments: [] },
    { extra: { nested_body: 'secret' } },
  ])('rejects prohibited or unknown data %#', (extra) => {
    expect(() => parseGoogleMailboxEvent(reply(extra))).toThrow();
  });

  it('rejects unsafe or unbounded fields and reference collections', () => {
    expect(() =>
      parseGoogleMailboxEvent(reply({ from: 'bad\r\n@example.com' }))
    ).toThrow();
    expect(() =>
      parseGoogleMailboxEvent(reply({ rfc_message_id: 'not-bracketed' }))
    ).toThrow();
    expect(() =>
      parseGoogleMailboxEvent(
        reply({
          references: Array.from(
            { length: 21 },
            (_, index) => `<${index}@x.dev>`
          ),
        })
      )
    ).toThrow();
    expect(() => parseGoogleMailboxEvent('[]')).toThrow();
  });

  it('accepts only closed recovery and unavailable-message control facts', () => {
    expect(parseGoogleMailboxEvent(recoveryRequired())).toMatchObject({
      kind: 'recovery_required',
      reason: 'history_expired',
    });
    expect(parseGoogleMailboxEvent(recoveryCompleted())).toMatchObject({
      kind: 'recovery_completed',
    });
    expect(parseGoogleMailboxEvent(messageUnavailable())).toMatchObject({
      kind: 'message_unavailable',
      reason: 'not_found',
    });
    expect(() =>
      parseGoogleMailboxEvent(recoveryRequired({ reason: 'anything' }))
    ).toThrow();
    expect(() =>
      parseGoogleMailboxEvent(messageUnavailable({ subject: 'secret' }))
    ).toThrow();
  });
});

describe('Google mailbox recovery pause', () => {
  it('persists required/completed facts and exposes only unmatched recovery as paused', async () => {
    let paused = true;
    const handlers = {
      ...commonHandlers(),
      'insert-google-mailbox-control-event': () => ({
        rows: [{ event_key: 'control' }],
      }),
      'read-google-mailbox-control-event': () => ({ rows: [] }),
      'require-google-mailbox-recovery': () => ({
        rows: [{ recovery_id: '00000000-0000-4000-8000-000000000123' }],
      }),
      'read-google-mailbox-recovery-pause': () => ({ rows: [{ paused }] }),
    };
    const test = executorWith(handlers);
    const requiredRaw = recoveryRequired();
    await expect(
      processGoogleMailboxEvent(test.executor, {
        event: parseGoogleMailboxEvent(requiredRaw),
        nonce,
        timestamp,
        requestDigest: sha256Base64Url(requiredRaw),
        receivedAt: now,
      })
    ).resolves.toEqual({ applied: true, outcome: 'recovery_paused' });
    expect(test.calls).toContain('acquire-google-reconcile-advisory-lock');
    expect(
      test.calls.indexOf('acquire-google-reconcile-advisory-lock')
    ).toBeLessThan(test.calls.indexOf('insert-google-mailbox-control-event'));
    await expect(isGoogleMailboxRecoveryPaused(test.executor)).resolves.toBe(
      true
    );

    paused = false;
    const completedRaw = recoveryCompleted();
    await expect(
      processGoogleMailboxEvent(test.executor, {
        event: parseGoogleMailboxEvent(completedRaw),
        nonce: 'recovery_complete_nonce_1',
        timestamp,
        requestDigest: sha256Base64Url(completedRaw),
        receivedAt: now,
      })
    ).resolves.toEqual({ applied: true, outcome: 'recovery_completed' });
    expect(
      test.calls.filter(
        (marker) => marker === 'acquire-google-reconcile-advisory-lock'
      )
    ).toHaveLength(2);
    await expect(isGoogleMailboxRecoveryPaused(test.executor)).resolves.toBe(
      false
    );
  });

  it('persists a closed message-unavailable alert without content', async () => {
    const test = executorWith({
      ...commonHandlers(),
      'insert-google-mailbox-control-event': (parameters) => {
        expect(JSON.stringify(parameters)).not.toMatch(
          /body|snippet|subject/iu
        );
        return { rows: [{ event_key: 'unavailable' }] };
      },
      'read-google-mailbox-control-event': () => ({ rows: [] }),
    });
    const raw = messageUnavailable();
    await expect(
      processGoogleMailboxEvent(test.executor, {
        event: parseGoogleMailboxEvent(raw),
        nonce: 'message_unavailable_nonce',
        timestamp,
        requestDigest: sha256Base64Url(raw),
        receivedAt: now,
      })
    ).resolves.toEqual({
      applied: true,
      outcome: 'message_unavailable_recorded',
    });
  });
});

describe('processGoogleMailboxEvent', () => {
  it('claims each nonce once and rejects a replay before Gmail processing', async () => {
    const event = parseGoogleMailboxEvent(seed());
    const harness = executorWith({
      ...commonHandlers({ nonce: [] }),
    });

    await expect(
      processGoogleMailboxEvent(harness.executor, {
        event,
        nonce,
        timestamp,
        requestDigest: sha256Base64Url(seed()),
        receivedAt: now,
      })
    ).rejects.toBeInstanceOf(GoogleReplyReplayError);
    expect(harness.calls).toEqual(['claim-google-reply-nonce']);
  });

  it('commits the nonce independently when downstream event processing rolls back', async () => {
    let nonceClaimed = false;
    const transaction = vi
      .fn()
      .mockRejectedValue(new Error('database unavailable'));
    const executor: SqlExecutor = {
      async execute<Row extends Record<string, unknown>>(
        sql: string
      ): Promise<SqlQueryResult<Row>> {
        expect(sql).toMatch(/claim-google-reply-nonce/u);
        if (nonceClaimed) return { rows: [] };
        nonceClaimed = true;
        return { rows: [{ event_key: 'nonce' }] as Row[] };
      },
      transaction,
    };
    const raw = reply();
    const input = {
      event: parseGoogleMailboxEvent(raw),
      nonce,
      timestamp,
      requestDigest: sha256Base64Url(raw),
      receivedAt: now,
    };

    await expect(processGoogleMailboxEvent(executor, input)).rejects.toThrow(
      'database unavailable'
    );
    await expect(
      processGoogleMailboxEvent(executor, input)
    ).rejects.toBeInstanceOf(GoogleReplyReplayError);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('allows only one concurrent claimant for the same nonce', async () => {
    let claimed = false;
    const raw = reply();
    const harness = executorWith({
      ...commonHandlers(),
      'claim-google-reply-nonce': () => {
        if (claimed) return { rows: [] };
        claimed = true;
        return { rows: [{ event_key: 'nonce' }] };
      },
      'find-google-reply-job-by-rfc': () => ({ rows: [] }),
      'insert-google-reply-reconcile-job': () => ({
        rows: [{ id: 'reconcile-job' }],
      }),
      'read-google-reply-reconcile-job': () => ({ rows: [] }),
    });
    const input = {
      event: parseGoogleMailboxEvent(raw),
      nonce,
      timestamp,
      requestDigest: sha256Base64Url(raw),
      receivedAt: now,
    };

    const results = await Promise.allSettled([
      processGoogleMailboxEvent(harness.executor, input),
      processGoogleMailboxEvent(harness.executor, input),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1
    );
    const rejected = results.find(({ status }) => status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: expect.any(GoogleReplyReplayError),
    });
  });

  it('registers a valid Brian seed against only its accepted recipient job and never stops', async () => {
    const stopContact = vi.fn();
    const handlers = {
      ...commonHandlers(),
      'discover-google-seed-job': (
        _parameters: readonly unknown[],
        sql: string
      ) => {
        expect(sql).not.toMatch(/for update/u);
        return { rows: [{ contact_id: contactId }] };
      },
      'lock-google-seed-contact': (
        _parameters: readonly unknown[],
        sql: string
      ) => {
        expect(sql).toMatch(/for update/u);
        return { rows: [{ id: contactId, deleted_at: null }] };
      },
      'lock-google-seed-job': (
        _parameters: readonly unknown[],
        sql: string
      ) => {
        expect(sql).toMatch(/for update/u);
        return {
          rows: [
            {
              id: jobId,
              kind: 'send_step',
              contact_id: contactId,
              status: 'completed',
              provider_email_id: 'resend-1',
              delivery_status: 'submitted',
              rfc_message_id: null,
              gmail_seed_message_id: null,
            },
          ],
        };
      },
      'check-google-seed-binding-conflicts': () => ({ rows: [] }),
      'bind-google-seed-identifiers': (
        _parameters: readonly unknown[],
        sql: string
      ) => {
        expect(sql).toMatch(/rfc_message_id/u);
        return { rows: [{ id: jobId }] };
      },
      'lock-google-reconcile-for-seed': () => ({ rows: [] }),
    };
    const harness = executorWith(handlers);
    const result = await processGoogleMailboxEvent(
      harness.executor,
      {
        event: parseGoogleMailboxEvent(seed()),
        nonce,
        timestamp,
        requestDigest: sha256Base64Url(seed()),
        receivedAt: now,
      },
      { stopContact }
    );

    expect(result).toEqual({ applied: true, outcome: 'seed_registered' });
    expect(harness.calls.indexOf('lock-google-seed-contact')).toBeLessThan(
      harness.calls.indexOf('lock-google-seed-job')
    );
    expect(stopContact).not.toHaveBeenCalled();
  });

  it('acks a valid late seed for a deleted contact without binding, stopping, or resurrecting', async () => {
    const stopContact = vi.fn();
    const handlers = {
      ...commonHandlers(),
      'discover-google-seed-job': () => ({ rows: [{ contact_id: contactId }] }),
      'lock-google-seed-contact': (
        _parameters: readonly unknown[],
        sql: string
      ) => {
        expect(sql).not.toMatch(/deleted_at is null/u);
        return {
          rows: [{ id: contactId, deleted_at: '2026-09-01T11:00:00.000Z' }],
        };
      },
      'lock-google-seed-job': () => ({
        rows: [
          {
            id: jobId,
            kind: 'send_step',
            contact_id: contactId,
            status: 'completed',
            provider_email_id: 'resend-1',
            delivery_status: 'delivered',
            rfc_message_id: null,
            gmail_seed_message_id: null,
          },
        ],
      }),
      'settle-google-reconcile-for-deleted-seed': (
        _parameters: readonly unknown[],
        sql: string
      ) => {
        expect(sql).toMatch(/status in \('pending', 'leased'\)/u);
        expect(sql).toMatch(/lease_token = null/u);
        expect(sql).toMatch(/candidate->>'rank' = '0'/u);
        expect(sql).toMatch(/payload->>'in_reply_to' = \$1/u);
        return { rows: [] };
      },
    };
    const harness = executorWith(handlers);

    await expect(
      processGoogleMailboxEvent(
        harness.executor,
        {
          event: parseGoogleMailboxEvent(seed()),
          nonce,
          timestamp,
          requestDigest: sha256Base64Url(seed()),
          receivedAt: now,
        },
        { stopContact }
      )
    ).resolves.toEqual({ applied: true, outcome: 'ignored_deleted' });
    expect(harness.calls).not.toContain('bind-google-seed-identifiers');
    expect(harness.calls).not.toContain('check-google-seed-binding-conflicts');
    expect(stopContact).not.toHaveBeenCalled();
  });

  it('treats an exact already-bound seed replay as inert while retaining reconciliation capability', async () => {
    const raw = seed();
    const stopContact = vi.fn();
    const existing = {
      event_key: `google:gmail:${sha256Base64Url('18cafe123abc')}`,
      kind: 'mailbox.seed_received',
      occurred_at: now,
      data: {
        event_fingerprint: sha256Base64Url(raw),
        gmail_message_id: '18cafe123abc',
      },
    };
    const handlers = {
      ...commonHandlers({ 'insert-event': [], 'read-event': [existing] }),
      'discover-google-seed-job': () => ({ rows: [{ contact_id: contactId }] }),
      'lock-google-seed-contact': () => ({
        rows: [{ id: contactId, deleted_at: null }],
      }),
      'lock-google-seed-job': () => ({
        rows: [
          {
            id: jobId,
            kind: 'send_step',
            contact_id: contactId,
            status: 'completed',
            provider_email_id: 'resend-1',
            delivery_status: 'submitted',
            rfc_message_id: '<seed.1@threadplane.ai>',
            gmail_seed_message_id: '18cafe123abc',
          },
        ],
      }),
      'check-google-seed-binding-conflicts': () => ({ rows: [] }),
      'lock-google-reconcile-for-seed': () => ({ rows: [] }),
    };
    const harness = executorWith(handlers);
    await expect(
      processGoogleMailboxEvent(
        harness.executor,
        {
          event: parseGoogleMailboxEvent(raw),
          nonce: 'exact_seed_replay_012345',
          timestamp,
          requestDigest: sha256Base64Url(raw),
          receivedAt: now,
        },
        { stopContact }
      )
    ).resolves.toEqual({ applied: false, outcome: 'replay' });
    expect(harness.calls).not.toContain('bind-google-seed-identifiers');
    expect(stopContact).not.toHaveBeenCalled();
  });

  it.each([
    ['conflicting Gmail ID', 'other-gmail', '<seed.1@threadplane.ai>'],
    ['conflicting RFC Message-ID', '18cafe123abc', '<other@threadplane.ai>'],
  ])(
    'rejects %s already bound to the same job',
    async (_case, gmailId, rfcId) => {
      const handlers = {
        ...commonHandlers(),
        'discover-google-seed-job': () => ({
          rows: [{ contact_id: contactId }],
        }),
        'lock-google-seed-contact': () => ({
          rows: [{ id: contactId, deleted_at: null }],
        }),
        'lock-google-seed-job': () => ({
          rows: [
            {
              id: jobId,
              kind: 'send_step',
              contact_id: contactId,
              status: 'completed',
              provider_email_id: 'resend-1',
              delivery_status: 'submitted',
              rfc_message_id: rfcId,
              gmail_seed_message_id: gmailId,
            },
          ],
        }),
        'check-google-seed-binding-conflicts': () => ({ rows: [] }),
      };
      const harness = executorWith(handlers);
      await expect(
        processGoogleMailboxEvent(harness.executor, {
          event: parseGoogleMailboxEvent(seed()),
          nonce,
          timestamp,
          requestDigest: sha256Base64Url(seed()),
          receivedAt: now,
        })
      ).resolves.toMatchObject({
        outcome: 'rejected_terminal',
        rejectionReason: 'seed_binding_conflict',
      });
    }
  );

  it.each(['gmail', 'rfc'])(
    'rejects another job owning the seed %s identifier',
    async () => {
      const handlers = {
        ...commonHandlers(),
        'discover-google-seed-job': () => ({
          rows: [{ contact_id: contactId }],
        }),
        'lock-google-seed-contact': () => ({
          rows: [{ id: contactId, deleted_at: null }],
        }),
        'lock-google-seed-job': () => ({
          rows: [
            {
              id: jobId,
              kind: 'send_step',
              contact_id: contactId,
              status: 'completed',
              provider_email_id: 'resend-1',
              delivery_status: 'submitted',
              rfc_message_id: null,
              gmail_seed_message_id: null,
            },
          ],
        }),
        'check-google-seed-binding-conflicts': () => ({
          rows: [{ id: 'other-job' }],
        }),
      };
      const harness = executorWith(handlers);
      await expect(
        processGoogleMailboxEvent(harness.executor, {
          event: parseGoogleMailboxEvent(seed()),
          nonce,
          timestamp,
          requestDigest: sha256Base64Url(seed()),
          receivedAt: now,
        })
      ).resolves.toMatchObject({
        outcome: 'rejected_terminal',
        rejectionReason: 'seed_identifier_conflict',
      });
    }
  );

  it.each([
    ['missing provider ID', { provider_email_id: null }],
    ['wrong kind', { kind: 'enrich' }],
    ['non-completed job', { status: 'leased' }],
    ['non-accepted delivery', { delivery_status: 'not_submitted' }],
  ])('rejects an accepted-seed regression: %s', async (_case, override) => {
    const handlers = {
      ...commonHandlers(),
      'discover-google-seed-job': () => ({ rows: [{ contact_id: contactId }] }),
      'lock-google-seed-contact': () => ({
        rows: [{ id: contactId, deleted_at: null }],
      }),
      'lock-google-seed-job': () => ({
        rows: [
          {
            id: jobId,
            kind: 'send_step',
            contact_id: contactId,
            status: 'completed',
            provider_email_id: 'resend-1',
            delivery_status: 'submitted',
            rfc_message_id: null,
            gmail_seed_message_id: null,
            ...override,
          },
        ],
      }),
    };
    const harness = executorWith(handlers);
    await expect(
      processGoogleMailboxEvent(harness.executor, {
        event: parseGoogleMailboxEvent(seed()),
        nonce,
        timestamp,
        requestDigest: sha256Base64Url(seed()),
        receivedAt: now,
      })
    ).resolves.toMatchObject({
      outcome: 'rejected_terminal',
      rejectionReason: 'seed_job_invalid',
    });
  });

  it.each([
    ['wrong sender', seed({ from: 'attacker@example.com' })],
    ['wrong status', seed()],
  ])('rejects an invalid seed: %s', async (kind, raw) => {
    const event = parseGoogleMailboxEvent(raw);
    const handlers = {
      ...commonHandlers(),
      'discover-google-seed-job': () => ({ rows: [{ contact_id: contactId }] }),
      'lock-google-seed-contact': () => ({
        rows: [{ id: contactId, deleted_at: null }],
      }),
      'lock-google-seed-job': () => ({
        rows: [
          {
            id: jobId,
            kind: 'send_step',
            contact_id: contactId,
            status: kind === 'wrong status' ? 'pending' : 'completed',
            provider_email_id: 'resend-1',
            delivery_status: 'submitted',
            rfc_message_id: null,
            gmail_seed_message_id: null,
          },
        ],
      }),
    };
    const harness = executorWith(handlers);
    await expect(
      processGoogleMailboxEvent(harness.executor, {
        event,
        nonce,
        timestamp,
        requestDigest: sha256Base64Url(raw),
        receivedAt: now,
      })
    ).resolves.toMatchObject({ outcome: 'rejected_terminal' });
  });

  it('terminally records an authenticated invalid seed instead of poisoning the poll cursor', async () => {
    const raw = seed();
    const handlers = {
      ...commonHandlers(),
      'discover-google-seed-job': () => ({ rows: [{ contact_id: contactId }] }),
      'lock-google-seed-contact': () => ({
        rows: [{ id: contactId, deleted_at: null }],
      }),
      'lock-google-seed-job': () => ({
        rows: [
          {
            id: jobId,
            kind: 'enrich',
            contact_id: contactId,
            status: 'completed',
            provider_email_id: 'resend-1',
            delivery_status: 'submitted',
            rfc_message_id: null,
            gmail_seed_message_id: null,
          },
        ],
      }),
      'insert-google-mailbox-rejection': (parameters: readonly unknown[]) => {
        expect(JSON.parse(String(parameters[2]))).toMatchObject({
          reason: 'seed_job_invalid',
        });
        return { rows: [{ event_key: 'rejected' }] };
      },
      'read-google-mailbox-rejection': () => ({ rows: [] }),
    };
    const harness = executorWith(handlers);

    await expect(
      processGoogleMailboxEvent(harness.executor, {
        event: parseGoogleMailboxEvent(raw),
        nonce,
        timestamp,
        requestDigest: sha256Base64Url(raw),
        receivedAt: now,
      })
    ).resolves.toEqual({
      applied: true,
      outcome: 'rejected_terminal',
      rejectionReason: 'seed_job_invalid',
    });
    expect(harness.calls).toContain('insert-google-mailbox-event');
    expect(harness.calls).toContain('insert-google-mailbox-rejection');
  });

  it('rolls back partial seed mutations before persisting a terminal rejection in a fresh transaction', async () => {
    const raw = seed();
    let bindingCommitted = false;
    let rejectionCommitted = false;
    let transactionCount = 0;
    const transaction: SqlTransaction = {
      async execute<Row extends Record<string, unknown>>(
        sql: string
      ): Promise<SqlQueryResult<Row>> {
        const marker = /\/\* growth:([a-z0-9-]+) \*\//u.exec(sql)?.[1];
        const rowsByMarker: Record<string, TestRow[]> = {
          'insert-google-mailbox-event': [{ event_key: 'gmail' }],
          'acquire-google-reconcile-advisory-lock': [{}],
          'discover-google-seed-job': [{ contact_id: contactId }],
          'lock-google-seed-contact': [{ id: contactId, deleted_at: null }],
          'lock-google-seed-job': [
            {
              id: jobId,
              kind: 'send_step',
              contact_id: contactId,
              status: 'completed',
              provider_email_id: 'resend-1',
              delivery_status: 'submitted',
              rfc_message_id: null,
              gmail_seed_message_id: null,
            },
          ],
          'check-google-seed-binding-conflicts': [],
          'bind-google-seed-identifiers': [{ id: jobId }],
          'lock-google-reconcile-for-seed': [
            {
              id: '00000000-0000-4000-8000-000000000003',
              contact_id: null,
              status: 'pending',
              payload: {
                gmail_message_id: 'reply-conflict',
                occurred_at: now.toISOString(),
                ranked_candidates: [
                  { message_id: '<seed.1@threadplane.ai>', rank: 0 },
                ],
                resolved_candidates: [
                  {
                    message_id: '<seed.1@threadplane.ai>',
                    rank: 0,
                    contact_id: '00000000-0000-4000-8000-000000000077',
                    seed_job_id: '00000000-0000-4000-8000-000000000066',
                  },
                ],
              },
            },
          ],
          'insert-google-mailbox-rejection': [{ event_key: 'rejection' }],
        };
        if (marker === 'bind-google-seed-identifiers') bindingCommitted = true;
        if (marker === 'insert-google-mailbox-rejection') {
          rejectionCommitted = true;
        }
        if (!marker || !(marker in rowsByMarker)) {
          throw new Error(`Unexpected SQL marker: ${marker ?? 'missing'}`);
        }
        return { rows: rowsByMarker[marker] as Row[] };
      },
    };
    const executor: SqlExecutor = {
      execute: async (sql) => {
        expect(sql).toMatch(/growth:claim-google-reply-nonce/u);
        return { rows: [{ event_key: 'nonce' }] };
      },
      async transaction(operation) {
        transactionCount += 1;
        const bindingBefore = bindingCommitted;
        const rejectionBefore = rejectionCommitted;
        try {
          return await operation(transaction);
        } catch (error) {
          bindingCommitted = bindingBefore;
          rejectionCommitted = rejectionBefore;
          throw error;
        }
      },
    };

    await expect(
      processGoogleMailboxEvent(executor, {
        event: parseGoogleMailboxEvent(raw),
        nonce,
        timestamp,
        requestDigest: sha256Base64Url(raw),
        receivedAt: now,
      })
    ).resolves.toEqual({
      applied: true,
      outcome: 'rejected_terminal',
      rejectionReason: 'reconcile_conflict',
    });
    expect(transactionCount).toBe(2);
    expect(bindingCommitted).toBe(false);
    expect(rejectionCommitted).toBe(true);
  });

  it('matches In-Reply-To before References and applies the canonical reply stop', async () => {
    const stopContact = vi
      .fn()
      .mockResolvedValue({ applied: true, effective: true });
    const lookups: string[] = [];
    const handlers = {
      ...commonHandlers(),
      'find-google-reply-job-by-rfc': (parameters: readonly unknown[]) => {
        lookups.push(String(parameters[0]));
        return parameters[0] === '<seed.1@threadplane.ai>'
          ? {
              rows: [
                {
                  id: jobId,
                  contact_id: contactId,
                  rfc_message_id: parameters[0],
                },
              ],
            }
          : { rows: [] };
      },
      'lock-google-reply-contact': () => ({
        rows: [{ id: contactId, deleted_at: null }],
      }),
      'lock-google-reply-job': () => ({
        rows: [
          {
            id: jobId,
            kind: 'send_step',
            contact_id: contactId,
            status: 'completed',
            provider_email_id: 'resend-1',
            delivery_status: 'submitted',
            rfc_message_id: '<seed.1@threadplane.ai>',
          },
        ],
      }),
    };
    const harness = executorWith(handlers);
    const result = await processGoogleMailboxEvent(
      harness.executor,
      {
        event: parseGoogleMailboxEvent(reply()),
        nonce,
        timestamp,
        requestDigest: sha256Base64Url(reply()),
        receivedAt: now,
      },
      { stopContact }
    );

    expect(lookups).toEqual(['<seed.1@threadplane.ai>']);
    expect(stopContact).toHaveBeenCalledWith(
      expect.objectContaining({ transaction: expect.any(Function) }),
      expect.objectContaining({
        contactId,
        reason: 'campaign.reply_received',
        source: 'google_mailbox_poller',
        provenance: expect.objectContaining({ kind: 'mailbox_reply' }),
      })
    );
    expect(result.outcome).toBe('reply_stopped');
  });

  it('queues an existing lower-ranked match outside recovery so a later rank-zero seed on another contact can supersede it', async () => {
    const raw = reply({
      gmail_message_id: 'recovery-unordered-reply',
      in_reply_to: '<direct@example.com>',
      references: ['<lower@example.com>'],
    });
    const stopContact = vi.fn();
    const handlers = {
      ...commonHandlers(),
      'find-google-reply-job-by-rfc': (parameters: readonly unknown[]) => ({
        rows:
          parameters[0] === '<lower@example.com>'
            ? [
                {
                  id: jobId,
                  kind: 'send_step',
                  contact_id: contactId,
                  status: 'completed',
                  provider_email_id: 'resend-lower',
                  delivery_status: 'submitted',
                  rfc_message_id: '<lower@example.com>',
                },
              ]
            : [],
      }),
      'read-google-mailbox-recovery-pause': () => ({
        rows: [{ paused: false }],
      }),
      'insert-google-reply-reconcile-job': (parameters: readonly unknown[]) => {
        expect(JSON.parse(String(parameters[2]))).toMatchObject({
          ranked_candidates: [
            { message_id: '<direct@example.com>', rank: 0 },
            { message_id: '<lower@example.com>', rank: 1 },
          ],
          resolved_candidates: [
            {
              message_id: '<lower@example.com>',
              rank: 1,
              contact_id: contactId,
              seed_job_id: jobId,
            },
          ],
        });
        return {
          rows: [{ id: '00000000-0000-4000-8000-000000000088' }],
        };
      },
    };
    const test = executorWith(handlers);

    await expect(
      processGoogleMailboxEvent(
        test.executor,
        {
          event: parseGoogleMailboxEvent(raw),
          nonce: 'recovery_order_nonce_1234',
          timestamp,
          requestDigest: sha256Base64Url(raw),
          receivedAt: now,
        },
        { stopContact }
      )
    ).resolves.toEqual({ applied: true, outcome: 'reconcile_queued' });
    expect(stopContact).not.toHaveBeenCalled();
    expect(test.calls).not.toContain('lock-google-reply-contact');
  });

  it('serializes a rank-zero direct reply behind recovery_required and queues without stopping after pause linearizes', async () => {
    const raw = reply({ gmail_message_id: 'paused-direct-reply' });
    const stopContact = vi.fn();
    const test = executorWith({
      ...commonHandlers(),
      'find-google-reply-job-by-rfc': () => ({
        rows: [
          {
            id: jobId,
            kind: 'send_step',
            contact_id: contactId,
            status: 'completed',
            provider_email_id: 'resend-1',
            delivery_status: 'submitted',
            rfc_message_id: '<seed.1@threadplane.ai>',
          },
        ],
      }),
      'read-google-mailbox-recovery-pause': () => ({
        rows: [{ paused: true }],
      }),
      'insert-google-reply-reconcile-job': () => ({
        rows: [{ id: '00000000-0000-4000-8000-000000000088' }],
      }),
    });

    await expect(
      processGoogleMailboxEvent(
        test.executor,
        {
          event: parseGoogleMailboxEvent(raw),
          nonce: 'paused_direct_nonce_1234',
          timestamp,
          requestDigest: sha256Base64Url(raw),
          receivedAt: now,
        },
        { stopContact }
      )
    ).resolves.toEqual({ applied: true, outcome: 'reconcile_queued' });
    expect(
      test.calls.indexOf('acquire-google-reconcile-advisory-lock')
    ).toBeLessThan(test.calls.indexOf('read-google-mailbox-recovery-pause'));
    expect(stopContact).not.toHaveBeenCalled();
  });

  it('terminally records an invalid matched recipient binding so mailbox progress is not poisoned', async () => {
    const raw = reply();
    const test = executorWith({
      ...commonHandlers(),
      'find-google-reply-job-by-rfc': () => ({
        rows: [
          {
            id: jobId,
            contact_id: contactId,
            rfc_message_id: '<seed.1@threadplane.ai>',
          },
        ],
      }),
      'lock-google-reply-contact': () => ({
        rows: [{ id: contactId, deleted_at: null }],
      }),
      'lock-google-reply-job': () => ({
        rows: [
          {
            id: jobId,
            kind: 'send_step',
            contact_id: contactId,
            status: 'pending',
            provider_email_id: 'resend-1',
            delivery_status: 'submitted',
            rfc_message_id: '<seed.1@threadplane.ai>',
          },
        ],
      }),
    });

    await expect(
      processGoogleMailboxEvent(test.executor, {
        event: parseGoogleMailboxEvent(raw),
        nonce: 'invalid_binding_nonce_0123',
        timestamp,
        requestDigest: sha256Base64Url(raw),
        receivedAt: now,
      })
    ).resolves.toEqual({
      applied: true,
      outcome: 'rejected_terminal',
      rejectionReason: 'reply_binding_invalid',
    });
    expect(test.calls).toContain('insert-google-mailbox-rejection');
  });

  it('acks a late matched reply for a deleted contact without stopping or provider mutation', async () => {
    const stopContact = vi.fn();
    const handlers = {
      ...commonHandlers(),
      'find-google-reply-job-by-rfc': () => ({
        rows: [
          {
            id: jobId,
            kind: 'send_step',
            contact_id: contactId,
            status: 'completed',
            provider_email_id: 'resend-1',
            delivery_status: 'delivered',
            rfc_message_id: '<seed.1@threadplane.ai>',
          },
        ],
      }),
      'lock-google-reply-contact': (
        _parameters: readonly unknown[],
        sql: string
      ) => {
        expect(sql).not.toMatch(/deleted_at is null/u);
        return {
          rows: [{ id: contactId, deleted_at: '2026-09-01T11:00:00.000Z' }],
        };
      },
      'lock-google-reply-job': () => ({
        rows: [
          {
            id: jobId,
            kind: 'send_step',
            contact_id: contactId,
            status: 'completed',
            provider_email_id: 'resend-1',
            delivery_status: 'delivered',
            rfc_message_id: '<seed.1@threadplane.ai>',
          },
        ],
      }),
    };
    const harness = executorWith(handlers);
    await expect(
      processGoogleMailboxEvent(
        harness.executor,
        {
          event: parseGoogleMailboxEvent(reply()),
          nonce,
          timestamp,
          requestDigest: sha256Base64Url(reply()),
          receivedAt: now,
        },
        { stopContact }
      )
    ).resolves.toEqual({ applied: true, outcome: 'ignored_deleted' });
    expect(stopContact).not.toHaveBeenCalled();
  });

  it('falls back through References most-recent-first and queues OOO lower-rank matches identically', async () => {
    const stopContact = vi
      .fn()
      .mockResolvedValue({ applied: true, effective: true });
    const lookups: string[] = [];
    const raw = reply({
      in_reply_to: '<unknown@example.com>',
      references: [
        '<old@example.com>',
        '<match@example.com>',
        '<new@example.com>',
      ],
    });
    const handlers = {
      ...commonHandlers(),
      'find-google-reply-job-by-rfc': (parameters: readonly unknown[]) => {
        lookups.push(String(parameters[0]));
        return parameters[0] === '<match@example.com>'
          ? {
              rows: [
                {
                  id: jobId,
                  kind: 'send_step',
                  contact_id: contactId,
                  status: 'completed',
                  provider_email_id: 'resend-1',
                  delivery_status: 'submitted',
                  rfc_message_id: parameters[0],
                },
              ],
            }
          : { rows: [] };
      },
      'insert-google-reply-reconcile-job': () => ({
        rows: [{ id: '00000000-0000-4000-8000-000000000088' }],
      }),
    };
    const harness = executorWith(handlers);
    const result = await processGoogleMailboxEvent(
      harness.executor,
      {
        event: parseGoogleMailboxEvent(raw),
        nonce,
        timestamp,
        requestDigest: sha256Base64Url(raw),
        receivedAt: now,
      },
      { stopContact }
    );
    expect(lookups).toEqual([
      '<unknown@example.com>',
      '<new@example.com>',
      '<match@example.com>',
    ]);
    expect(result).toEqual({ applied: true, outcome: 'reconcile_queued' });
    expect(stopContact).not.toHaveBeenCalled();
  });

  it('never guesses by sender and queues one bounded header-only reconciliation job', async () => {
    const stopContact = vi.fn();
    const handlers = {
      ...commonHandlers(),
      'find-google-reply-job-by-rfc': () => ({ rows: [] }),
      'insert-google-reply-reconcile-job': (
        parameters: readonly unknown[],
        sql: string
      ) => {
        const serialized = parameters.join(' ');
        expect(sql).toMatch(/on conflict \(idempotency_key\) do nothing/u);
        expect(serialized).not.toContain('developer@example.com');
        expect(serialized).not.toMatch(/body|snippet|subject|attachment/iu);
        expect(serialized).toContain('max_attempts');
        expect(serialized).toContain('founder_review');
        return { rows: [{ id: 'reconcile-job' }] };
      },
      'read-google-reply-reconcile-job': () => ({ rows: [] }),
    };
    const harness = executorWith(handlers);
    const result = await processGoogleMailboxEvent(
      harness.executor,
      {
        event: parseGoogleMailboxEvent(reply()),
        nonce,
        timestamp,
        requestDigest: sha256Base64Url(reply()),
        receivedAt: now,
      },
      { stopContact }
    );

    expect(result).toEqual({ applied: true, outcome: 'reconcile_queued' });
    expect(stopContact).not.toHaveBeenCalled();
    expect(harness.calls).not.toContain('find-contact-by-sender');
  });

  it('lets a late rank-zero IRT seed on another contact supersede an already resolved lower reference', async () => {
    const highContact = '00000000-0000-4000-8000-000000000077';
    const stopContact = vi
      .fn()
      .mockResolvedValue({ applied: true, effective: true });
    const handlers = {
      ...commonHandlers(),
      'discover-google-seed-job': () => ({
        rows: [{ contact_id: highContact }],
      }),
      'lock-google-seed-contact': () => ({
        rows: [{ id: highContact, deleted_at: null }],
      }),
      'lock-google-seed-job': () => ({
        rows: [
          {
            id: jobId,
            kind: 'send_step',
            contact_id: highContact,
            status: 'completed',
            provider_email_id: 'resend-1',
            delivery_status: 'delivered',
            rfc_message_id: null,
            gmail_seed_message_id: null,
          },
        ],
      }),
      'check-google-seed-binding-conflicts': () => ({ rows: [] }),
      'bind-google-seed-identifiers': () => ({ rows: [{ id: jobId }] }),
      'lock-google-reconcile-for-seed': () => ({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000003',
            contact_id: null,
            status: 'pending',
            payload: {
              gmail_message_id: '18cafe-reply-early',
              occurred_at: '2026-09-01T11:59:00.000Z',
              in_reply_to: '<seed.1@threadplane.ai>',
              references: ['<lower@example.com>'],
              ranked_candidates: [
                { message_id: '<seed.1@threadplane.ai>', rank: 0 },
                { message_id: '<lower@example.com>', rank: 1 },
              ],
              resolved_candidates: [
                {
                  message_id: '<lower@example.com>',
                  rank: 1,
                  contact_id: contactId,
                  seed_job_id: '00000000-0000-4000-8000-000000000099',
                },
              ],
            },
          },
        ],
      }),
      'record-google-reconcile-candidate': () => ({
        rows: [{ id: '00000000-0000-4000-8000-000000000003' }],
      }),
      'complete-google-reconciled-reply': () => ({
        rows: [{ id: 'reconcile' }],
      }),
    };
    const harness = executorWith(handlers);
    await processGoogleMailboxEvent(
      harness.executor,
      {
        event: parseGoogleMailboxEvent(seed()),
        nonce,
        timestamp,
        requestDigest: sha256Base64Url(seed()),
        receivedAt: now,
      },
      { stopContact }
    );
    expect(stopContact).toHaveBeenCalledTimes(1);
    expect(stopContact).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        contactId: highContact,
        reason: 'campaign.reply_received',
        eventKey: expect.stringMatching(/^google:reply:/u),
      })
    );
    expect(harness.calls.indexOf('lock-google-seed-contact')).toBeLessThan(
      harness.calls.indexOf('lock-google-reconcile-for-seed')
    );
  });

  it('treats an exact Gmail retry with a fresh nonce as idempotent but rejects conflicting content', async () => {
    const existing = {
      event_key: `google:gmail:${sha256Base64Url('18cafe123abd')}`,
      kind: 'mailbox.reply_received',
      occurred_at: now,
      data: {
        event_fingerprint: sha256Base64Url(reply()),
        gmail_message_id: '18cafe123abd',
      },
    };
    const exact = executorWith({
      ...commonHandlers({ 'insert-event': [], 'read-event': [existing] }),
    });
    await expect(
      processGoogleMailboxEvent(exact.executor, {
        event: parseGoogleMailboxEvent(reply()),
        nonce: 'fresh_nonce_0123456789',
        timestamp,
        requestDigest: sha256Base64Url(reply()),
        receivedAt: now,
      })
    ).resolves.toEqual({ applied: false, outcome: 'replay' });

    const conflict = executorWith({
      ...commonHandlers({ 'insert-event': [], 'read-event': [existing] }),
    });
    const changed = reply({ from: 'other@example.com' });
    await expect(
      processGoogleMailboxEvent(conflict.executor, {
        event: parseGoogleMailboxEvent(changed),
        nonce: 'another_nonce_01234567',
        timestamp,
        requestDigest: sha256Base64Url(changed),
        receivedAt: now,
      })
    ).resolves.toMatchObject({
      outcome: 'rejected_terminal',
      rejectionReason: 'gmail_message_conflict',
    });
  });

  it('reruns idempotent seed reconciliation on overlap after a delayed reply race', async () => {
    const raw = seed();
    const stopContact = vi
      .fn()
      .mockResolvedValue({ applied: true, effective: true });
    const existing = {
      event_key: `google:gmail:${sha256Base64Url('18cafe123abc')}`,
      kind: 'mailbox.seed_received',
      occurred_at: now,
      data: {
        event_fingerprint: sha256Base64Url(raw),
        gmail_message_id: '18cafe123abc',
      },
    };
    const harness = executorWith({
      ...commonHandlers({ 'insert-event': [], 'read-event': [existing] }),
      'discover-google-seed-job': () => ({ rows: [{ contact_id: contactId }] }),
      'lock-google-seed-contact': () => ({
        rows: [{ id: contactId, deleted_at: null }],
      }),
      'lock-google-seed-job': () => ({
        rows: [
          {
            id: jobId,
            kind: 'send_step',
            contact_id: contactId,
            status: 'completed',
            provider_email_id: 'resend-1',
            delivery_status: 'delivered',
            rfc_message_id: '<seed.1@threadplane.ai>',
            gmail_seed_message_id: '18cafe123abc',
          },
        ],
      }),
      'check-google-seed-binding-conflicts': () => ({ rows: [] }),
      'lock-google-reconcile-for-seed': () => ({
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000003',
            contact_id: null,
            status: 'pending',
            payload: {
              gmail_message_id: '18cafe-delayed-reply',
              occurred_at: '2026-09-01T12:00:01.000Z',
              in_reply_to: '<seed.1@threadplane.ai>',
              references: [],
            },
          },
        ],
      }),
      'complete-google-reconciled-reply': () => ({
        rows: [{ id: 'reconcile' }],
      }),
    });

    const result = await processGoogleMailboxEvent(
      harness.executor,
      {
        event: parseGoogleMailboxEvent(raw),
        nonce: 'overlap_nonce_0123456789',
        timestamp,
        requestDigest: sha256Base64Url(raw),
        receivedAt: now,
      },
      { stopContact }
    );

    expect(result).toEqual({ applied: false, outcome: 'replay' });
    expect(stopContact).toHaveBeenCalledTimes(1);
    expect(stopContact).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventKey: `google:reply:${sha256Base64Url(
          '18cafe-delayed-reply'
        )}:stop`,
      })
    );
    expect(harness.calls).toContain('complete-google-reconciled-reply');
  });
});
