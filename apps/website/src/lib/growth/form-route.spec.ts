import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadEmailHmacKeyring } from './email-keyring';
import { getFormPolicy, GROWTH_FORM_POLICY_VERSION } from './form-policy';
import * as formRoute from './form-route';
import {
  defaultGrowthFormRouteDependencies,
  nudgeLifecycle,
  readBoundedJsonObject,
  stalePolicyResponse,
} from './form-route';

describe('growth form route boundary', () => {
  it('does not expose the legacy silent-truncation text helper', () => {
    expect('text' in formRoute).toBe(false);
  });

  it('wires the server policy into the default route dependencies', () => {
    expect(defaultGrowthFormRouteDependencies().getPolicy).toBe(getFormPolicy);
  });

  it.each([
    ['', 'application/json'],
    ['{', 'application/json'],
    ['null', 'application/json'],
    ['[]', 'application/json'],
    ['{}', 'text/plain'],
  ])('rejects malformed or non-object JSON: %s', async (body, contentType) => {
    const request = new Request('https://threadplane.ai/api/contact', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body,
    });

    await expect(readBoundedJsonObject(request, 32)).resolves.toBeNull();
  });

  it('cancels an unread body when content type is missing or invalid', async () => {
    let cancelled = false;
    const request = new Request('https://threadplane.ai/api/contact', {
      method: 'POST',
      body: new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
        },
      }),
      duplex: 'half',
    } as RequestInit);

    await expect(readBoundedJsonObject(request, 32)).resolves.toBeNull();
    expect(cancelled).toBe(true);
    expect(request.body?.locked).toBe(false);
  });

  it('returns a closed null result when invalid-content-type cancellation fails', async () => {
    let cancellationAttempts = 0;
    const request = new Request('https://threadplane.ai/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: new ReadableStream<Uint8Array>({
        cancel() {
          cancellationAttempts += 1;
          throw new Error('private cancellation detail');
        },
      }),
      duplex: 'half',
    } as RequestInit);

    await expect(readBoundedJsonObject(request, 32)).resolves.toBeNull();
    expect(cancellationAttempts).toBe(1);
    expect(request.body?.locked).toBe(false);
  });

  it('returns only the current growth policy version for stale submissions', async () => {
    const response = stalePolicyResponse({
      mode: 'growth_v1',
      version: GROWTH_FORM_POLICY_VERSION,
      disclosures: {
        contact: 'contact disclosure',
        newsletter: 'newsletter disclosure',
        whitepaper: 'whitepaper disclosure',
      },
    });

    expect(response.status).toBe(409);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('0');
    await expect(response.json()).resolves.toEqual({
      error: 'This form changed. Please retry.',
      policy_version: GROWTH_FORM_POLICY_VERSION,
      retryable: true,
    });
  });

  it('loads a closed keyring shape without exposing invalid secret material', () => {
    expect(
      loadEmailHmacKeyring({
        GROWTH_EMAIL_HMAC_ACTIVE_SECRET: 'a'.repeat(32),
        GROWTH_EMAIL_HMAC_ACTIVE_VERSION: '2',
        GROWTH_EMAIL_HMAC_PREVIOUS_KEYS: JSON.stringify([
          { version: 1, secret: 'b'.repeat(32) },
        ]),
      })
    ).toEqual({
      active: { version: 2, secret: 'a'.repeat(32) },
      previous: [{ version: 1, secret: 'b'.repeat(32) }],
    });

    const sensitiveMalformedValue = '{"secret":"do-not-expose"';
    expect(() =>
      loadEmailHmacKeyring({
        GROWTH_EMAIL_HMAC_ACTIVE_SECRET: 'a'.repeat(32),
        GROWTH_EMAIL_HMAC_ACTIVE_VERSION: '2',
        GROWTH_EMAIL_HMAC_PREVIOUS_KEYS: sensitiveMalformedValue,
      })
    ).toThrow('Growth email HMAC previous keys are invalid');
    try {
      loadEmailHmacKeyring({
        GROWTH_EMAIL_HMAC_ACTIVE_SECRET: 'a'.repeat(32),
        GROWTH_EMAIL_HMAC_ACTIVE_VERSION: '2',
        GROWTH_EMAIL_HMAC_PREVIOUS_KEYS: sensitiveMalformedValue,
      });
    } catch (error) {
      expect(String(error)).not.toContain('do-not-expose');
    }
  });
});

describe('nudgeLifecycle', () => {
  it('uses the same Dawn origin and service secret as scheduled dispatch', async () => {
    const invoke = vi.fn().mockResolvedValue({
      operatorAlerts: [],
      threadId: '00000000-0000-4000-8000-000000000001',
    });

    await nudgeLifecycle(
      { submissionId: '00000000-0000-4000-8000-000000000002' },
      {
        environment: {
          LIFECYCLE_DAWN_URL: 'https://lifecycle.example',
          LIFECYCLE_SERVICE_SECRET: 'service-secret',
          LIFECYCLE_NUDGE_URL: 'https://legacy.example',
          LIFECYCLE_NUDGE_SECRET: 'legacy-secret',
        },
        invoke,
      }
    );

    expect(invoke).toHaveBeenCalledWith({
      baseUrl: 'https://lifecycle.example',
      serviceSecret: 'service-secret',
      submissionId: '00000000-0000-4000-8000-000000000002',
      timeoutMs: 2_000,
      trigger: 'nudge',
    });
  });

  it('sends only the committed submission identity to the lifecycle service', async () => {
    const invoke = vi.fn().mockResolvedValue({
      operatorAlerts: [],
      threadId: '00000000-0000-4000-8000-000000000001',
    });

    await nudgeLifecycle(
      {
        submissionId: '00000000-0000-4000-8000-000000000002',
        email: 'private@example.com',
        name: 'Private Name',
        message: 'Private message',
      } as { submissionId: string },
      {
        environment: {
          LIFECYCLE_DAWN_URL: 'https://lifecycle.example',
          LIFECYCLE_SERVICE_SECRET: 'service-secret',
        },
        invoke,
      }
    );

    const serializedCall = JSON.stringify(invoke.mock.calls);
    expect(serializedCall).toContain('00000000-0000-4000-8000-000000000002');
    expect(serializedCall).not.toContain('private@example.com');
    expect(serializedCall).not.toContain('Private Name');
    expect(serializedCall).not.toContain('Private message');
  });

  it('preserves a configured nonblank lifecycle secret as opaque bytes', async () => {
    const opaqueSecret = ' synthetic-secret-with-padding ';
    let receivedExactSecret = false;
    const invoke = vi.fn().mockImplementation(async (input) => {
      receivedExactSecret = input.serviceSecret === opaqueSecret;
      return {
        operatorAlerts: [],
        threadId: '00000000-0000-4000-8000-000000000001',
      };
    });

    await nudgeLifecycle(
      { submissionId: '00000000-0000-4000-8000-000000000002' },
      {
        environment: {
          LIFECYCLE_DAWN_URL: 'https://lifecycle.example',
          LIFECYCLE_SERVICE_SECRET: opaqueSecret,
        },
        invoke,
      }
    );

    expect(receivedExactSecret).toBe(true);
  });

  it('does nothing until both shared lifecycle settings are configured', async () => {
    const invoke = vi.fn();

    await nudgeLifecycle(
      { submissionId: '00000000-0000-4000-8000-000000000002' },
      { environment: {}, invoke }
    );
    await nudgeLifecycle(
      { submissionId: '00000000-0000-4000-8000-000000000002' },
      {
        environment: {
          LIFECYCLE_DAWN_URL: 'https://lifecycle.example',
          LIFECYCLE_SERVICE_SECRET: '   ',
        },
        invoke,
      }
    );

    expect(invoke).not.toHaveBeenCalled();
  });
});
