import { beforeEach, describe, expect, it, vi } from 'vitest';

// The website intentionally consumes the growth library through its internal boundary.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  acceptFormSubmission,
  type ApproveContactFromFormInput,
  type FormApprovalControlState,
  type SqlExecutor,
  type SqlTransaction,
} from '@threadplane-internal/growth';

vi.mock('server-only', () => ({}));

const seam = vi.hoisted(() => ({
  accept: vi.fn(),
  close: vi.fn(),
  createDatabase: vi.fn(),
  getPolicy: vi.fn(),
  loadKeyring: vi.fn(),
  now: vi.fn(),
  nudge: vi.fn(),
}));

vi.mock('../../../lib/growth/form-route', async (importOriginal) => ({
  ...(await importOriginal()),
  defaultGrowthFormRouteDependencies: () => ({
    accept: seam.accept,
    createDatabase: seam.createDatabase,
    getPolicy: seam.getPolicy,
    loadKeyring: seam.loadKeyring,
    now: seam.now,
    nudge: seam.nudge,
  }),
}));

// These no-op modules isolate the legacy handler during the required RED run.
vi.mock('../../../../lib/resend', () => ({
  FROM: '',
  NOTIFY_TO: '',
  addToAudience: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock('../../../../lib/loops', () => ({
  loopsSendEvent: vi.fn(),
  loopsUpsertContact: vi.fn(),
}));
vi.mock('../../../lib/analytics/server', () => ({
  captureLeadConversion: vi.fn(),
  captureLeadQualified: vi.fn(),
}));

import type { PublicFormPolicy } from '../../../lib/growth/form-policy';
import { POST } from './route';

const policy: PublicFormPolicy = {
  mode: 'growth_v1',
  version: 'growth_v1.2026-09-01',
  disclosures: {
    contact: 'Contact disclosure',
    newsletter: 'Newsletter disclosure',
    whitepaper: 'Whitepaper disclosure',
  },
};
const submissionId = '20000000-0000-4000-8000-000000000002';
const acquisitionSessionId = '30000000-0000-4000-8000-000000000003';
const occurredAt = new Date('2026-09-01T18:00:00.000Z');
const keyring = {
  active: {
    version: 1,
    secret: 'route-test-secret-that-is-at-least-32-bytes-long',
  },
};

function request(
  body: BodyInit | unknown,
  contentType = 'application/json'
): Request {
  return new Request('https://threadplane.ai/api/leads', {
    method: 'POST',
    headers: contentType ? { 'content-type': contentType } : undefined,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    submission_id: submissionId,
    policy_version: policy.version,
    acquisition_session_id: acquisitionSessionId,
    form_kind: 'contact',
    email: '  Reader@Acme.COM  ',
    name: '  Reader  ',
    company: '  Acme  ',
    message: '  How do interrupts work?  ',
    ...overrides,
  };
}

function expectCommittedBeforeNudge(): void {
  expect(seam.accept).toHaveBeenCalledOnce();
  expect(seam.close).toHaveBeenCalledOnce();
  expect(seam.nudge).toHaveBeenCalledOnce();
  expect(seam.accept.mock.invocationCallOrder[0]).toBeLessThan(
    seam.close.mock.invocationCallOrder[0] as number
  );
  expect(seam.close.mock.invocationCallOrder[0]).toBeLessThan(
    seam.nudge.mock.invocationCallOrder[0] as number
  );
  expect(seam.accept.mock.invocationCallOrder[0]).toBeLessThan(
    seam.nudge.mock.invocationCallOrder[0] as number
  );
}

function safeError(responseBody: unknown): void {
  const serialized = JSON.stringify(responseBody);
  expect(serialized).not.toContain('Reader@Acme.COM');
  expect(serialized).not.toContain('route-test-secret');
  expect(serialized).not.toContain('database');
}

beforeEach(() => {
  vi.clearAllMocks();
  seam.getPolicy.mockReturnValue(policy);
  seam.accept.mockResolvedValue({
    accepted: true,
    approved: true,
    contactId: '10000000-0000-4000-8000-000000000001',
    submissionId,
  });
  seam.close.mockResolvedValue(undefined);
  seam.createDatabase.mockReturnValue({ close: seam.close });
  seam.loadKeyring.mockReturnValue(keyring);
  seam.now.mockReturnValue(occurredAt);
  seam.nudge.mockResolvedValue(undefined);
});

describe('/api/leads growth_v1', () => {
  it('commits the disclosed contact submission, closes Neon, then nudges', async () => {
    const response = await POST(request(validBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(seam.accept).toHaveBeenCalledWith(expect.anything(), {
      submissionId,
      email: 'reader@acme.com',
      displayName: 'Reader',
      companyName: 'Acme',
      form: { kind: 'contact', message: 'How do interrupts work?' },
      source: 'website',
      sourceForm: 'contact',
      noticeText: policy.disclosures.contact,
      noticeVersion: `${policy.version}.contact`,
      policyVersion: policy.version,
      acquisitionSessionId,
      occurredAt,
      keyring,
    });
    expect(seam.nudge).toHaveBeenCalledWith({ submissionId });
    expect(JSON.stringify(seam.nudge.mock.calls)).not.toContain(
      'reader@acme.com'
    );
    expectCommittedBeforeNudge();
  });

  it('commits a pricing submission with its qualifying answers', async () => {
    const response = await POST(
      request(
        validBody({
          form_kind: 'pricing',
          team_size: '6-25',
          timeline: 'this_quarter',
          pilot_interest: 'yes',
        })
      )
    );

    expect(response.status).toBe(200);
    expect(seam.accept).toHaveBeenCalledWith(expect.anything(), {
      submissionId,
      email: 'reader@acme.com',
      displayName: 'Reader',
      companyName: 'Acme',
      form: {
        kind: 'pricing',
        message: 'How do interrupts work?',
        teamSize: '6-25',
        timeline: 'this_quarter',
        pilotInterest: 'yes',
      },
      source: 'website',
      sourceForm: 'pricing',
      noticeText: policy.disclosures.contact,
      noticeVersion: `${policy.version}.pricing`,
      policyVersion: policy.version,
      acquisitionSessionId,
      occurredAt,
      keyring,
    });
    expectCommittedBeforeNudge();
  });

  it.each([undefined, 'growth_v1.stale'])(
    'returns the current safe policy for missing or stale version %s',
    async (policyVersion) => {
      const body = validBody();
      if (policyVersion === undefined) delete body.policy_version;
      else body.policy_version = policyVersion;

      const response = await POST(request(body));

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: 'This form changed. Please retry.',
        policy_version: policy.version,
        retryable: true,
      });
      expect(response.headers.get('retry-after')).toBe('0');
      expect(seam.createDatabase).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['malformed JSON', request('{')],
    ['non-object JSON', request('null')],
    ['missing content type', request(JSON.stringify(validBody()), '')],
    ['invalid content type', request(JSON.stringify(validBody()), 'text/plain')],
    [
      'oversized body',
      request(JSON.stringify({ padding: 'x'.repeat(20_000) })),
    ],
  ])(
    'rejects %s before reading policy or durable state',
    async (_label, input) => {
      const response = await POST(input);

      expect(response.status).toBe(400);
      expect(seam.getPolicy).not.toHaveBeenCalled();
      expect(seam.createDatabase).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['invalid submission UUID', { submission_id: 'not-a-uuid' }],
    ['invalid acquisition UUID', { acquisition_session_id: 'not-a-uuid' }],
    ['missing form kind', { form_kind: undefined }],
    ['unsupported form kind', { form_kind: 'whitepaper' }],
    ['form kind wrong type', { form_kind: ['contact'] }],
    ['name too long', { name: 'n'.repeat(201) }],
    ['name wrong type', { name: { nested: true } }],
    ['company too long', { company: 'c'.repeat(201) }],
    ['message too long', { message: 'm'.repeat(2_001) }],
    ['unsupported team size', { form_kind: 'pricing', team_size: '1000+' }],
    ['unsupported timeline', { form_kind: 'pricing', timeline: 'someday' }],
    [
      'unsupported pilot interest',
      { form_kind: 'pricing', pilot_interest: 'perhaps' },
    ],
  ])('rejects %s before opening Neon', async (_label, overrides) => {
    const response = await POST(request(validBody(overrides)));

    expect(response.status).toBe(400);
    expect(seam.createDatabase).not.toHaveBeenCalled();
    expect(seam.accept).not.toHaveBeenCalled();
  });

  it.each([
    'a@b',
    'a@@example.com',
    'Reader <reader@example.com>',
    'reader @example.com',
    `${'a'.repeat(250)}@example.com`,
  ])('rejects an invalid email without echoing or logging it', async (email) => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const response = await POST(request(validBody({ email })));
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(responseBody)).not.toContain(email);
    expect(consoleError).not.toHaveBeenCalled();
    expect(seam.accept).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it.each(['database construction', 'keyring setup'])(
    'fails closed when %s fails',
    async (failure) => {
      if (failure === 'database construction') {
        seam.createDatabase.mockImplementation(() => {
          throw new Error('sensitive database URL');
        });
      } else {
        seam.loadKeyring.mockImplementation(() => {
          throw new Error('sensitive key');
        });
      }

      const response = await POST(request(validBody()));
      const responseBody = await response.json();

      expect(response.status).toBe(503);
      safeError(responseBody);
      expect(seam.accept).not.toHaveBeenCalled();
      expect(seam.nudge).not.toHaveBeenCalled();
    }
  );

  it('closes Neon and fails closed when the acceptance transaction fails', async () => {
    seam.accept.mockRejectedValue(new Error('sensitive transaction response'));

    const response = await POST(request(validBody()));
    const responseBody = await response.json();

    expect(response.status).toBe(503);
    safeError(responseBody);
    expect(seam.accept).toHaveBeenCalledOnce();
    expect(seam.close).toHaveBeenCalledOnce();
    expect(seam.accept.mock.invocationCallOrder[0]).toBeLessThan(
      seam.close.mock.invocationCallOrder[0] as number
    );
    expect(seam.nudge).not.toHaveBeenCalled();
  });

  it('fails closed without nudging when Neon cannot close', async () => {
    seam.close.mockRejectedValue(new Error('sensitive close failure'));

    const response = await POST(request(validBody()));
    const responseBody = await response.json();

    expect(response.status).toBe(503);
    safeError(responseBody);
    expect(seam.accept).toHaveBeenCalledOnce();
    expect(seam.close).toHaveBeenCalledOnce();
    expect(seam.nudge).not.toHaveBeenCalled();
  });

  it('keeps committed acceptance successful when the lifecycle nudge fails', async () => {
    seam.nudge.mockRejectedValue(new Error('sensitive lifecycle URL'));

    const response = await POST(request(validBody()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expectCommittedBeforeNudge();
  });

  it('replays one submission UUID without duplicate activity or logical jobs', async () => {
    const acceptedEvents = new Set<string>();
    const jobKeys = new Set<string>();
    let activityInsertions = 0;
    let jobInsertions = 0;
    const transaction: SqlTransaction = {
      async execute(sql, parameters = []) {
        if (!sql.includes('growth:enqueue-form-jobs')) return { rows: [] };
        const replaySubmissionId = String(parameters[2]);
        const kinds =
          parameters[3] === true
            ? ['fulfill', 'enrich', 'notify']
            : ['fulfill'];
        for (const kind of kinds) {
          const key = `form:${replaySubmissionId}:${kind}`;
          if (!jobKeys.has(key)) {
            jobKeys.add(key);
            jobInsertions += 1;
          }
        }
        return {
          rows: kinds.map((kind) => ({
            idempotency_key: `form:${replaySubmissionId}:${kind}`,
          })),
        };
      },
    };
    const database: SqlExecutor = {
      execute: transaction.execute,
      transaction: async (operation) => operation(transaction),
      close: seam.close,
    };
    const approveContact = vi.fn(
      async (
        _transaction: SqlTransaction,
        input: ApproveContactFromFormInput
      ): Promise<FormApprovalControlState> => {
        if (!acceptedEvents.has(input.eventKey)) {
          acceptedEvents.add(input.eventKey);
          activityInsertions += 1;
        }
        return {
          contactId: '10000000-0000-4000-8000-000000000001',
          authorization: 'approved',
          canSend: true,
          formApprovalGranted: true,
          outreachApprovedAt: occurredAt,
          latestHardStop: null,
          deletedAt: null,
          updatedAt: input.occurredAt,
        };
      }
    );
    seam.createDatabase.mockReturnValue(database);
    seam.accept.mockImplementation((executor, input) =>
      acceptFormSubmission(executor, input, { approveContact })
    );

    const firstResponse = await POST(request(validBody()));
    expect(firstResponse.status).toBe(200);
    expectCommittedBeforeNudge();

    vi.clearAllMocks();
    seam.getPolicy.mockReturnValue(policy);
    seam.createDatabase.mockReturnValue(database);
    seam.loadKeyring.mockReturnValue(keyring);
    seam.now.mockReturnValue(new Date('2026-09-01T18:05:00.000Z'));
    seam.nudge.mockResolvedValue(undefined);
    seam.accept.mockImplementation((executor, input) =>
      acceptFormSubmission(executor, input, { approveContact })
    );

    const replayResponse = await POST(request(validBody()));
    expect(replayResponse.status).toBe(200);
    expectCommittedBeforeNudge();
    expect(activityInsertions).toBe(1);
    expect(jobInsertions).toBe(3);
  });
});
