import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  CONTACT_OUTREACH_DISCLOSURE,
  GROWTH_FORM_POLICY_VERSION,
  NEWSLETTER_OUTREACH_DISCLOSURE,
  WHITEPAPER_OUTREACH_DISCLOSURE,
  getFormPolicy,
  matchesSubmittedFormPolicy,
} from './form-policy';

describe('server form policy', () => {
  it('fails closed unless the growth policy is explicitly configured', () => {
    expect(() => getFormPolicy({})).toThrow(/GROWTH_FORM_POLICY/u);
    expect(() => getFormPolicy({ GROWTH_FORM_POLICY: 'legacy' })).toThrow();
    expect(() => getFormPolicy({ GROWTH_FORM_POLICY: 'unknown' })).toThrow();
  });

  it('selects route behavior and exact client disclosure from one server-only switch', () => {
    expect(getFormPolicy({ GROWTH_FORM_POLICY: 'growth_v1' })).toEqual({
      mode: 'growth_v1',
      version: GROWTH_FORM_POLICY_VERSION,
      disclosures: expect.objectContaining({
        whitepaper: expect.any(String),
        newsletter: expect.any(String),
        contact: expect.any(String),
      }),
    });
    expect(WHITEPAPER_OUTREACH_DISCLOSURE).toBe(
      'Send me the guide and a short, three-email follow-up from Brian about building with Threadplane. Unsubscribe anytime.'
    );
    expect(CONTACT_OUTREACH_DISCLOSURE).toBe(
      'By sending, you agree Brian may follow up by email about your request.'
    );
    expect(NEWSLETTER_OUTREACH_DISCLOSURE).toBe(
      'Subscribe to Threadplane updates and a short, three-email welcome from Brian. Unsubscribe anytime.'
    );
  });

  it('rejects missing or stale submitted versions in growth mode', () => {
    const policy = getFormPolicy({ GROWTH_FORM_POLICY: 'growth_v1' });
    expect(matchesSubmittedFormPolicy(policy, undefined)).toBe(false);
    expect(matchesSubmittedFormPolicy(policy, 'growth_v1.stale')).toBe(false);
    expect(matchesSubmittedFormPolicy(policy, GROWTH_FORM_POLICY_VERSION)).toBe(
      true
    );
  });
});
