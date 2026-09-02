import { describe, expect, it, vi } from 'vitest';

// The website intentionally consumes the growth library through its internal boundary.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  FOUNDER_STOP_TOKEN_MAX_AGE_SECONDS,
  createGrowthActionToken,
  type GrowthTokenKeyring,
  type SqlExecutor,
} from '@threadplane-internal/growth';

import { createFounderStopRoute } from './route';

const contactId = '018f47a2-4a2b-4f86-9f03-3dca36f26e55';
const now = new Date('2026-09-01T12:00:00.000Z');
const keyring: GrowthTokenKeyring = {
  active: { version: 8, secret: 'founder-stop-route-secret-material!' },
  previous: [{ version: 7, secret: 'previous-founder-stop-route-key!' }],
};

function executor(): SqlExecutor {
  return {
    execute: vi.fn(),
    transaction: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as SqlExecutor;
}

function founderToken(
  purpose: 'founder_stop' | 'unsubscribe' = 'founder_stop',
  issuedAt = now
): string {
  return createGrowthActionToken(
    {
      contactId,
      purpose,
      issuedAt,
      eventNonce: 'founder-review-42',
      reason: 'founder_review',
    },
    keyring.active
  );
}

function routeHarness() {
  const database = executor();
  const loadTokenKeyring = vi.fn(() => keyring);
  const createDatabase = vi.fn(() => database);
  const stopContact = vi.fn().mockResolvedValue({
    applied: true,
    effective: true,
  });
  const route = createFounderStopRoute({
    now: () => now,
    loadTokenKeyring,
    createDatabase,
    stopContact,
  });
  return {
    ...route,
    database,
    loadTokenKeyring,
    createDatabase,
    stopContact,
  };
}

function request(path: string, init?: RequestInit): Request {
  return new Request(`https://threadplane.ai${path}`, init);
}

describe('/api/growth/stop', () => {
  it('offers a nonmutating GET confirmation with no raw email or cookie', async () => {
    const harness = routeHarness();
    const token = founderToken();

    const response = await harness.GET(
      request(`/api/growth/stop?token=${token}`) as never
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(body).toContain('Confirm contact stop');
    expect(body).toContain(`name="token" value="${token}"`);
    expect(body).not.toMatch(/@|%40/iu);
    expect(harness.createDatabase).not.toHaveBeenCalled();
    expect(harness.stopContact).not.toHaveBeenCalled();
  });

  it('uses a purpose-bound short-lived POST to invoke the canonical founder stop', async () => {
    const harness = routeHarness();
    const issuedAt = new Date('2026-09-01T11:30:00.000Z');
    const token = founderToken('founder_stop', issuedAt);

    const response = await harness.POST(
      request('/api/growth/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(harness.stopContact).toHaveBeenCalledWith(harness.database, {
      contactId,
      reason: 'manual_suppression',
      eventKey: `token:founder_stop:${contactId}:${issuedAt.getTime()}:founder-review-42`,
      occurredAt: now,
      source: 'signed_founder_stop',
      provenance: {
        actor: 'founder',
        kind: 'founder_action',
        policyVersion: 'growth-lifecycle-v1',
      },
    });
    expect(harness.database.close).toHaveBeenCalledTimes(1);
  });

  it('returns one failure shape for wrong-purpose, expired, and unknown-contact requests', async () => {
    const wrongPurpose = founderToken('unsubscribe');
    const expired = founderToken(
      'founder_stop',
      new Date(now.getTime() - (FOUNDER_STOP_TOKEN_MAX_AGE_SECONDS + 1) * 1_000)
    );
    const responses = [];

    for (const token of [wrongPurpose, expired]) {
      const harness = routeHarness();
      responses.push(
        await harness.POST(
          request('/api/growth/stop', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token }).toString(),
          }) as never
        )
      );
      expect(harness.createDatabase).not.toHaveBeenCalled();
    }

    const unknownContact = routeHarness();
    unknownContact.stopContact.mockRejectedValueOnce(
      new Error(`Growth contact not found: ${contactId}`)
    );
    responses.push(
      await unknownContact.POST(
        request('/api/growth/stop', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: founderToken() }).toString(),
        }) as never
      )
    );

    const shapes = await Promise.all(
      responses.map(async (response) => ({
        body: await response.text(),
        status: response.status,
      }))
    );
    expect(new Set(shapes.map(({ body }) => body)).size).toBe(1);
    expect(new Set(shapes.map(({ status }) => status))).toEqual(new Set([400]));
    expect(shapes[0]?.body).not.toContain(contactId);
  });

  it('rejects missing tokens before loading keys or database configuration', async () => {
    const harness = routeHarness();

    const response = await harness.POST(
      request('/api/growth/stop', { method: 'POST' }) as never
    );

    expect(response.status).toBe(400);
    expect(harness.loadTokenKeyring).not.toHaveBeenCalled();
    expect(harness.createDatabase).not.toHaveBeenCalled();
  });

  it('rejects declared and streamed byte-overflow bodies before loading keys or database state', async () => {
    const declared = routeHarness();
    const declaredResponse = await declared.POST(
      request('/api/growth/stop', {
        method: 'POST',
        headers: {
          'content-length': '2049',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: 'token=x',
      }) as never
    );

    let chunk = 0;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        const value = [
          new TextEncoder().encode('é'.repeat(1024)),
          new TextEncoder().encode('x'),
        ][chunk++];
        if (value) controller.enqueue(value);
        else controller.close();
      },
      cancel,
    });
    const streamed = routeHarness();
    const streamedResponse = await streamed.POST(
      new Request('https://threadplane.ai/api/growth/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: stream,
        duplex: 'half',
      } as RequestInit) as never
    );

    expect([declaredResponse.status, streamedResponse.status]).toEqual([
      400, 400,
    ]);
    expect(cancel).toHaveBeenCalledTimes(1);
    for (const harness of [declared, streamed]) {
      expect(harness.loadTokenKeyring).not.toHaveBeenCalled();
      expect(harness.createDatabase).not.toHaveBeenCalled();
    }
  });

  it('accepts founder confirmation only from a token-only form body', async () => {
    const token = founderToken();
    const invalidRequests = [
      request(`/api/growth/stop?token=${token}`, { method: 'POST' }),
      request(`/api/growth/stop?token=${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: '',
      }),
      request(`/api/growth/stop?token=${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
      }),
      request('/api/growth/stop', {
        method: 'POST',
        body: new URLSearchParams({ token }).toString(),
      }),
      request('/api/growth/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      }),
      request('/api/growth/stop', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: new URLSearchParams({ token }).toString(),
      }),
      request('/api/growth/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token, extra: '1' }).toString(),
      }),
    ];
    const shapes = [];

    for (const invalidRequest of invalidRequests) {
      const harness = routeHarness();
      const response = await harness.POST(invalidRequest as never);
      shapes.push({ body: await response.text(), status: response.status });
      expect(harness.loadTokenKeyring).not.toHaveBeenCalled();
      expect(harness.createDatabase).not.toHaveBeenCalled();
      expect(harness.stopContact).not.toHaveBeenCalled();
    }

    expect(new Set(shapes.map(({ status }) => status))).toEqual(new Set([400]));
    expect(new Set(shapes.map(({ body }) => body)).size).toBe(1);
  });
});
