// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import {
  getEmailDomain,
  getSourcePage,
  normalizePostHogHost,
  toSafeAnalyticsString,
} from './properties';

describe('shared properties', () => {
  it('truncates safe analytics strings and drops blank values', () => {
    expect(toSafeAnalyticsString('  hello  ')).toBe('hello');
    expect(toSafeAnalyticsString('abcdef', 3)).toBe('abc');
    expect(toSafeAnalyticsString('   ')).toBeUndefined();
    expect(toSafeAnalyticsString(42)).toBeUndefined();
  });

  it('extracts a normalized email domain', () => {
    expect(getEmailDomain('Jane.Smith@Example.COM ')).toBe('example.com');
    expect(getEmailDomain('not-an-email')).toBeNull();
    expect(getEmailDomain('')).toBeNull();
  });

  it('normalizes source URLs to path, query, and hash only', () => {
    expect(getSourcePage('https://tplane.example/docs?utm_source=x#intro')).toBe('/docs?utm_source=x#intro');
    expect(getSourcePage('/pricing')).toBe('/pricing');
    expect(getSourcePage('not a url')).toBe('/');
  });

  it('uses the PostHog US ingest host as the default', () => {
    expect(normalizePostHogHost(undefined)).toBe('https://us.i.posthog.com');
    expect(normalizePostHogHost('https://eu.i.posthog.com/')).toBe('https://eu.i.posthog.com');
  });
});
