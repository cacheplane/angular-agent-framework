// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { PERSONAL_EMAIL_DOMAINS, isPersonalEmailDomain } from './personal-email-domains';

describe('personal email domains', () => {
  it('exposes a non-empty set of well-known free-mail domains', () => {
    expect(PERSONAL_EMAIL_DOMAINS.size).toBeGreaterThan(10);
    expect(PERSONAL_EMAIL_DOMAINS.has('gmail.com')).toBe(true);
    expect(PERSONAL_EMAIL_DOMAINS.has('proton.me')).toBe(true);
  });

  it('returns true for blocklisted domains (case-insensitive)', () => {
    expect(isPersonalEmailDomain('gmail.com')).toBe(true);
    expect(isPersonalEmailDomain('GMAIL.COM')).toBe(true);
    expect(isPersonalEmailDomain('Hotmail.Com')).toBe(true);
    expect(isPersonalEmailDomain('proton.me')).toBe(true);
    expect(isPersonalEmailDomain('163.com')).toBe(true);
  });

  it('returns false for unknown domains and falsy inputs', () => {
    expect(isPersonalEmailDomain('acme.com')).toBe(false);
    expect(isPersonalEmailDomain('cacheplane.ai')).toBe(false);
    expect(isPersonalEmailDomain('')).toBe(false);
    expect(isPersonalEmailDomain(null)).toBe(false);
    expect(isPersonalEmailDomain(undefined)).toBe(false);
  });
});
