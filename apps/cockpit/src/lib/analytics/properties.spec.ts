// SPDX-License-Identifier: MIT
import { describe, test, expect } from 'vitest';
import { shouldCaptureAnalytics } from './properties';

describe('shouldCaptureAnalytics', () => {
  test('returns false when no token', () => {
    expect(
      shouldCaptureAnalytics({
        token: undefined,
        captureLocal: true,
        host: 'cockpit.example.com',
      }),
    ).toBe(false);
  });

  test('returns false on localhost when captureLocal is false', () => {
    expect(
      shouldCaptureAnalytics({
        token: 'phc_x',
        captureLocal: false,
        host: 'localhost:4201',
      }),
    ).toBe(false);
  });

  test('returns true on localhost when captureLocal is true', () => {
    expect(
      shouldCaptureAnalytics({
        token: 'phc_x',
        captureLocal: true,
        host: 'localhost:4201',
      }),
    ).toBe(true);
  });

  test('returns true on production host', () => {
    expect(
      shouldCaptureAnalytics({
        token: 'phc_x',
        captureLocal: false,
        host: 'cockpit.example.com',
      }),
    ).toBe(true);
  });
});
