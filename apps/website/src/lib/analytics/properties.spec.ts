import { describe, expect, it } from 'vitest';
import {
  getEmailDomain,
  getSourcePage,
  isLocalAnalyticsHost,
  normalizePostHogHost,
  shouldCaptureAnalytics,
  toSafeAnalyticsString,
} from './properties';

describe('analytics properties', () => {
  it('extracts a normalized email domain without retaining the address', () => {
    expect(getEmailDomain('Jane.Smith@Example.COM ')).toBe('example.com');
    expect(getEmailDomain('not-an-email')).toBeNull();
    expect(getEmailDomain('')).toBeNull();
  });

  it('truncates safe analytics strings and drops blank values', () => {
    expect(toSafeAnalyticsString('  hello  ')).toBe('hello');
    expect(toSafeAnalyticsString('abcdef', 3)).toBe('abc');
    expect(toSafeAnalyticsString('   ')).toBeUndefined();
    expect(toSafeAnalyticsString(42)).toBeUndefined();
  });

  it('normalizes source URLs to path, query, and hash only', () => {
    expect(getSourcePage('https://ngaf.example/docs?utm_source=x#intro')).toBe('/docs?utm_source=x#intro');
    expect(getSourcePage('/pricing')).toBe('/pricing');
    expect(getSourcePage('not a url')).toBe('/');
  });

  it('detects local hosts for opt-in development capture', () => {
    expect(isLocalAnalyticsHost('localhost:3000')).toBe(true);
    expect(isLocalAnalyticsHost('127.0.0.1:3000')).toBe(true);
    expect(isLocalAnalyticsHost('ngaf.example')).toBe(false);
  });

  it('requires a token and skips local capture unless explicitly enabled', () => {
    expect(shouldCaptureAnalytics({ token: '', captureLocal: false, host: 'ngaf.example' })).toBe(false);
    expect(shouldCaptureAnalytics({ token: 'ph_test', captureLocal: false, host: 'localhost:3000' })).toBe(false);
    expect(shouldCaptureAnalytics({ token: 'ph_test', captureLocal: true, host: 'localhost:3000' })).toBe(true);
    expect(shouldCaptureAnalytics({ token: 'ph_test', captureLocal: false, host: 'ngaf.example' })).toBe(true);
  });

  it('uses the PostHog US ingest host as the default host', () => {
    expect(normalizePostHogHost(undefined)).toBe('https://us.i.posthog.com');
    expect(normalizePostHogHost('https://eu.i.posthog.com/')).toBe('https://eu.i.posthog.com');
  });
});
