import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createLeadRoute } from '../../app/api/leads/route';
import { createNewsletterRoute } from '../../app/api/newsletter/route';
import { createWhitepaperSignupRoute } from '../../app/api/whitepaper-signup/route';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { FormRateLimitError } from '@threadplane-internal/growth';
import { getFormPolicy } from './form-policy';
import type { GrowthFormRouteDependencies } from './form-route';

const policy = getFormPolicy({ GROWTH_FORM_POLICY: 'growth_v1' });
const submissionId = '20000000-0000-4000-8000-000000000002';

describe.each([
  ['contact', createLeadRoute],
  ['pricing', createLeadRoute],
  ['newsletter', createNewsletterRoute],
  ['whitepaper', createWhitepaperSignupRoute],
] as const)('%s abuse route', (kind, createRoute) => {
  function harness() {
    const accept = vi
      .fn()
      .mockResolvedValue({
        accepted: true,
        approved: true,
        contactId: 'contact',
        submissionId,
      });
    const deps: GrowthFormRouteDependencies = {
      accept,
      getPolicy: () => policy,
      now: () => new Date('2026-09-09T14:00:00Z'),
      loadKeyring: () => ({
        active: {
          version: 1,
          secret: 'route-test-key-that-is-at-least-32-bytes',
        },
      }),
      createDatabase: vi.fn().mockReturnValue({ close: vi.fn() }),
      nudge: vi.fn().mockResolvedValue(undefined),
    };
    const request = (extra: Record<string, unknown> = {}) =>
      new Request('https://threadplane.ai/api/forms', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.1',
        },
        body: JSON.stringify({
          submission_id: submissionId,
          policy_version: policy.version,
          email: 'reader@gmail.com',
          form_kind: kind,
          ...extra,
        }),
      });
    return { accept, deps, request, POST: createRoute(deps).POST };
  }
  it('acknowledges blocked forms silently without dispatching', async () => {
    const h = harness();
    h.accept.mockResolvedValue({
      accepted: true,
      approved: false,
      contactId: 'contact',
      submissionId,
      deliverySuppressed: true,
    });
    const response = await h.POST(
      h.request({
        website_url: 'https://spam.invalid',
        score: 0,
        decision: 'allow',
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(h.deps.nudge).not.toHaveBeenCalled();
    const input = h.accept.mock.calls[0][1];
    expect(input.honeypot).toBe('https://spam.invalid');
    expect(input.score).toBeUndefined();
    expect(input.trustedClientIp).toBeUndefined();
  });
  it('returns Retry-After for a rate limit without dispatching', async () => {
    const h = harness();
    h.accept.mockRejectedValue(new FormRateLimitError(120));
    const response = await h.POST(h.request());
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('120');
    expect(h.deps.nudge).not.toHaveBeenCalled();
  });
  it('keeps ordinary and older submissions without honeypot working', async () => {
    const h = harness();
    expect((await h.POST(h.request())).status).toBe(200);
    expect(h.deps.nudge).toHaveBeenCalledOnce();
  });
  it('continues a borderline submission admitted by the server', async () => {
    const h = harness();
    expect((await h.POST(h.request({ email: 'test@example.com' }))).status).toBe(200);
    expect(h.accept.mock.calls[0][1].email).toBe('test@example.com');
    expect(h.deps.nudge).toHaveBeenCalledOnce();
  });
  it('preserves a silent blocked decision on retry', async () => {
    const h = harness();
    h.accept.mockResolvedValue({
      accepted: true,
      approved: false,
      contactId: 'contact',
      submissionId,
      deliverySuppressed: true,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await h.POST(h.request({ website_url: 'bot' }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    }
    expect(h.deps.nudge).not.toHaveBeenCalled();
  });
});
