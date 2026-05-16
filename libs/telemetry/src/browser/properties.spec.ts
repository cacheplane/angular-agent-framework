// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { isLocalAnalyticsHost, shouldCaptureAnalytics } from './properties';

describe('browser properties', () => {
  it('detects local hosts for opt-in development capture', () => {
    expect(isLocalAnalyticsHost('localhost:3000')).toBe(true);
    expect(isLocalAnalyticsHost('127.0.0.1:3000')).toBe(true);
    expect(isLocalAnalyticsHost('::1')).toBe(true);
    expect(isLocalAnalyticsHost('[::1]:3000')).toBe(true);
    expect(isLocalAnalyticsHost('ngaf.example')).toBe(false);
    expect(isLocalAnalyticsHost(undefined)).toBe(false);
  });

  it('requires a token and skips local capture unless explicitly enabled', () => {
    expect(shouldCaptureAnalytics({ token: '', captureLocal: false, host: 'ngaf.example' })).toBe(false);
    expect(shouldCaptureAnalytics({ token: 'ph_test', captureLocal: false, host: 'localhost:3000' })).toBe(false);
    expect(shouldCaptureAnalytics({ token: 'ph_test', captureLocal: true, host: 'localhost:3000' })).toBe(true);
    expect(shouldCaptureAnalytics({ token: 'ph_test', captureLocal: false, host: 'ngaf.example' })).toBe(true);
  });
});
