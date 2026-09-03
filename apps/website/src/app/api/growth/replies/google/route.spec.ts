import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

// The website intentionally consumes the growth library through its internal boundary.
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { SqlExecutor } from '@threadplane-internal/growth';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { sha256Base64Url } from '@threadplane-internal/growth';

import { createGoogleRepliesRoute } from './route';

const now = new Date('2026-09-01T12:00:00.000Z');
const secret = 's'.repeat(32);
const nonce = 'nonce_0123456789abcdef';
const rawBody = JSON.stringify({
  kind: 'reply',
  version: 1,
  gmail_message_id: '18cafe123abd',
  rfc_message_id: '<reply.1@example.com>',
  occurred_at: now.toISOString(),
  from: 'developer@example.com',
  in_reply_to: '<seed.1@threadplane.ai>',
  references: ['<seed.1@threadplane.ai>'],
});

function signedRequest(
  body = rawBody,
  overrides: Record<string, string> = {}
): Request {
  const timestamp =
    overrides['x-threadplane-timestamp'] ?? String(now.getTime());
  const requestNonce = overrides['x-threadplane-nonce'] ?? nonce;
  const signature = `v1=${createHmac('sha256', secret)
    .update(`${timestamp}\n${requestNonce}\n${sha256Base64Url(body)}`)
    .digest('base64url')}`;
  return new Request('https://threadplane.ai/api/growth/replies/google', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-threadplane-timestamp': timestamp,
      'x-threadplane-nonce': requestNonce,
      'x-threadplane-signature': signature,
      ...overrides,
    },
    body,
  });
}

function harness() {
  const order: string[] = [];
  const database = { close: vi.fn() } as unknown as SqlExecutor;
  const verifySignature = vi.fn(() => order.push('verify'));
  const parseEvent = vi.fn(() => {
    order.push('parse');
    return { kind: 'reply' } as never;
  });
  const createDatabase = vi.fn(() => {
    order.push('database');
    return database;
  });
  const processEvent = vi.fn(() => {
    order.push('process');
    return Promise.resolve({
      applied: true,
      outcome: 'reply_stopped',
    } as const);
  });
  const route = createGoogleRepliesRoute({
    now: () => now,
    loadSecret: () => secret,
    verifySignature,
    parseEvent,
    createDatabase,
    processEvent,
  });
  return {
    ...route,
    order,
    database,
    verifySignature,
    parseEvent,
    createDatabase,
    processEvent,
  };
}

describe('/api/growth/replies/google', () => {
  it('verifies exact raw bounded bytes before parsing and database access', async () => {
    const test = harness();
    const response = await test.POST(signedRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(test.order).toEqual(['verify', 'parse', 'database', 'process']);
    expect(test.verifySignature).toHaveBeenCalledWith({
      rawBody,
      timestamp: String(now.getTime()),
      nonce,
      signature: expect.stringMatching(/^v1=/u),
      secret,
      now,
    });
    expect(test.processEvent).toHaveBeenCalledWith(test.database, {
      event: { kind: 'reply' },
      nonce,
      timestamp: String(now.getTime()),
      requestDigest: sha256Base64Url(rawBody),
      receivedAt: now,
    });
    expect(test.database.close).toHaveBeenCalledTimes(1);
  });

  it.each([
    'x-threadplane-timestamp',
    'x-threadplane-nonce',
    'x-threadplane-signature',
  ])(
    'rejects a missing %s before verification, parsing, or DB access',
    async (header) => {
      const test = harness();
      const response = await test.POST(
        signedRequest(rawBody, { [header]: '' })
      );
      expect(response.status).toBe(400);
      expect(test.verifySignature).not.toHaveBeenCalled();
      expect(test.parseEvent).not.toHaveBeenCalled();
      expect(test.createDatabase).not.toHaveBeenCalled();
    }
  );

  it('rejects non-JSON content and malformed, stale, future, tampered, or wrong-secret requests uniformly', async () => {
    const cases = [
      signedRequest(rawBody, { 'content-type': 'text/plain' }),
      signedRequest('{'),
      signedRequest(rawBody, {
        'x-threadplane-timestamp': String(now.getTime() - 300_001),
      }),
      signedRequest(rawBody, {
        'x-threadplane-timestamp': String(now.getTime() + 300_001),
      }),
    ];
    for (const request of cases) {
      const test = harness();
      if (request.headers.get('content-type') === 'application/json') {
        test.verifySignature.mockImplementationOnce(() => {
          throw new Error('invalid');
        });
      }
      const response = await test.POST(request);
      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Unable to process request');
      expect(test.createDatabase).not.toHaveBeenCalled();
    }
  });

  it('rejects declared, streamed, and invalid UTF-8 oversized bodies before verification', async () => {
    const declared = harness();
    expect(
      (await declared.POST(signedRequest('{}', { 'content-length': '32769' })))
        .status
    ).toBe(413);
    expect(declared.verifySignature).not.toHaveBeenCalled();

    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(20_000));
        controller.enqueue(new Uint8Array(20_000));
      },
      cancel,
    });
    const streamed = new Request(
      'https://threadplane.ai/api/growth/replies/google',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-threadplane-timestamp': String(now.getTime()),
          'x-threadplane-nonce': nonce,
          'x-threadplane-signature': `v1=${'A'.repeat(43)}`,
        },
        body: stream,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }
    );
    const streamedHarness = harness();
    expect((await streamedHarness.POST(streamed)).status).toBe(413);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(streamedHarness.verifySignature).not.toHaveBeenCalled();

    const invalidUtf8 = new Request(
      'https://threadplane.ai/api/growth/replies/google',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-threadplane-timestamp': String(now.getTime()),
          'x-threadplane-nonce': nonce,
          'x-threadplane-signature': `v1=${'A'.repeat(43)}`,
        },
        body: new Uint8Array([0xff]),
      }
    );
    const invalidHarness = harness();
    expect((await invalidHarness.POST(invalidUtf8)).status).toBe(413);
    expect(invalidHarness.verifySignature).not.toHaveBeenCalled();
  });

  it('returns safe terminal responses for envelope/schema failures and 503 for retryable processing failures', async () => {
    for (const stage of ['verify', 'parse', 'process'] as const) {
      const test = harness();
      if (stage === 'verify')
        test.verifySignature.mockImplementationOnce(() => {
          throw new Error('replay');
        });
      if (stage === 'parse')
        test.parseEvent.mockImplementationOnce(() => {
          throw new Error('schema');
        });
      if (stage === 'process')
        test.processEvent.mockRejectedValueOnce(new Error('conflict'));
      const response = await test.POST(signedRequest());
      expect(response.status).toBe(stage === 'process' ? 503 : 400);
      expect(await response.text()).toBe('Unable to process request');
    }
  });

  it('acknowledges a durably ignored deleted-contact event so polling can progress', async () => {
    const test = harness();
    test.processEvent.mockResolvedValueOnce({
      applied: true,
      outcome: 'ignored_deleted',
    });

    const response = await test.POST(signedRequest());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Accepted');
    expect(test.database.close).toHaveBeenCalledTimes(1);
  });

  it('acknowledges a durably recorded invalid matched-recipient rejection', async () => {
    const test = harness();
    test.processEvent.mockResolvedValueOnce({
      applied: true,
      outcome: 'rejected_terminal',
      rejectionReason: 'reply_binding_invalid',
    });

    const response = await test.POST(signedRequest());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Accepted');
  });
});
