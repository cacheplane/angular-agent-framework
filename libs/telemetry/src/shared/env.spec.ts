import { describe, test, expect, beforeEach } from 'vitest';
import { isTelemetryDisabled, getDisableReason } from './env';

describe('isTelemetryDisabled', () => {
  beforeEach(() => {
    delete process.env.DO_NOT_TRACK;
    delete process.env.TPLANE_TELEMETRY_DISABLED;
    delete process.env.npm_config_do_not_track;
    delete process.env.NPM_CONFIG_DO_NOT_TRACK;
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.CONTINUOUS_INTEGRATION;
    delete process.env.BUILDKITE;
    delete process.env.CIRCLECI;
  });

  test('returns false with no env signals', () => {
    expect(isTelemetryDisabled()).toBe(false);
  });

  test('DO_NOT_TRACK=1 disables', () => {
    process.env.DO_NOT_TRACK = '1';
    expect(isTelemetryDisabled()).toBe(true);
    expect(getDisableReason()).toBe('DO_NOT_TRACK');
  });

  test('DO_NOT_TRACK=true disables', () => {
    process.env.DO_NOT_TRACK = 'true';
    expect(isTelemetryDisabled()).toBe(true);
  });

  test('TPLANE_TELEMETRY_DISABLED=1 disables', () => {
    process.env.TPLANE_TELEMETRY_DISABLED = '1';
    expect(isTelemetryDisabled()).toBe(true);
    expect(getDisableReason()).toBe('TPLANE_TELEMETRY_DISABLED');
  });

  test('npm do-not-track config disables', () => {
    process.env.npm_config_do_not_track = 'true';
    expect(isTelemetryDisabled()).toBe(true);
    expect(getDisableReason()).toBe('DO_NOT_TRACK');
  });

  test('CI=true disables (CI auto-detect)', () => {
    process.env.CI = 'true';
    expect(isTelemetryDisabled()).toBe(true);
    expect(getDisableReason()).toBe('CI');
  });

  test('GITHUB_ACTIONS=true disables', () => {
    process.env.GITHUB_ACTIONS = 'true';
    expect(isTelemetryDisabled()).toBe(true);
  });

  test('DO_NOT_TRACK=0 does NOT disable', () => {
    process.env.DO_NOT_TRACK = '0';
    expect(isTelemetryDisabled()).toBe(false);
  });

  test('precedence: DO_NOT_TRACK reported first when multiple match', () => {
    process.env.DO_NOT_TRACK = '1';
    process.env.TPLANE_TELEMETRY_DISABLED = '1';
    process.env.CI = 'true';
    expect(getDisableReason()).toBe('DO_NOT_TRACK');
  });
});
