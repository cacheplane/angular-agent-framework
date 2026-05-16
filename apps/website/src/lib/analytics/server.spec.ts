// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, beforeEach } from 'vitest';

const captureMock = vi.hoisted(() => vi.fn());
vi.mock('posthog-node', () => ({
  PostHog: vi.fn(function () {
    return {
      capture: captureMock,
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

beforeEach(() => {
  captureMock.mockClear();
  process.env.NEXT_PUBLIC_POSTHOG_TOKEN = 'phc_test';
});

describe('captureLeadQualified', () => {
  it('fires marketing:lead_qualified when domain is non-personal and company is non-empty', async () => {
    const { captureLeadQualified } = await import('./server');
    await captureLeadQualified({
      email: 'jane@acme.com',
      company: 'Acme',
      sourcePage: '/pricing',
    });
    expect(captureMock).toHaveBeenCalledTimes(1);
    const call = captureMock.mock.calls[0][0];
    expect(call.event).toBe('marketing:lead_qualified');
    expect(call.properties).toMatchObject({
      email_domain: 'acme.com',
      company: 'Acme',
      source_page: '/pricing',
      track: 'enterprise',
    });
    expect(call.distinctId).toMatch(/^email_sha256:[a-f0-9]{64}$/);
  });

  it('skips when the email domain is personal', async () => {
    const { captureLeadQualified } = await import('./server');
    await captureLeadQualified({
      email: 'jane@gmail.com',
      company: 'Acme',
      sourcePage: '/pricing',
    });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('skips when company is missing', async () => {
    const { captureLeadQualified } = await import('./server');
    await captureLeadQualified({
      email: 'jane@acme.com',
      sourcePage: '/pricing',
    });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('skips when company is blank string', async () => {
    const { captureLeadQualified } = await import('./server');
    await captureLeadQualified({
      email: 'jane@acme.com',
      company: '   ',
      sourcePage: '/pricing',
    });
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('skips when email is malformed', async () => {
    const { captureLeadQualified } = await import('./server');
    await captureLeadQualified({
      email: 'not-an-email',
      company: 'Acme',
    });
    expect(captureMock).not.toHaveBeenCalled();
  });
});
