import { describe, test, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  PostHog: vi.fn(),
}));

vi.mock('posthog-node', () => ({
  PostHog: mocks.PostHog,
}));

// Import AFTER mock so the mock takes effect.
import { PostHog } from 'posthog-node';
import { capturePostinstall, _resetClientForTesting } from './client';
import { disableTelemetry, _resetDisableForTesting } from './disable';

describe('node client', () => {
  beforeEach(() => {
    mocks.PostHog.mockReset();
    mocks.PostHog.mockImplementation(function () {
      return {
        capture: vi.fn(),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
    });
    _resetClientForTesting();
    _resetDisableForTesting();
    delete process.env.DO_NOT_TRACK;
    delete process.env.NGAF_TELEMETRY_DISABLED;
    delete process.env.CI;
    process.env.NGAF_TELEMETRY_INGEST_URL = 'https://test.example/api/ingest';
  });

  test('capturePostinstall sends an event with pkg + version', async () => {
    const instance = { capture: vi.fn(), shutdown: vi.fn().mockResolvedValue(undefined) };
    mocks.PostHog.mockImplementation(function () { return instance; });
    await capturePostinstall({ pkg: '@ngaf/telemetry', version: '0.0.31' });
    expect(instance.capture).toHaveBeenCalledWith(expect.objectContaining({
      event: 'ngaf:postinstall',
      properties: expect.objectContaining({ pkg: '@ngaf/telemetry', version: '0.0.31' }),
    }));
  });

  test('capturePostinstall no-ops when DO_NOT_TRACK is set', async () => {
    process.env.DO_NOT_TRACK = '1';
    await capturePostinstall({ pkg: 'x', version: '1' });
    expect(PostHog).not.toHaveBeenCalled();
  });

  test('capturePostinstall no-ops after disableTelemetry()', async () => {
    disableTelemetry();
    await capturePostinstall({ pkg: 'x', version: '1' });
    expect(PostHog).not.toHaveBeenCalled();
  });

  test('capturePostinstall uses NGAF_TELEMETRY_INGEST_URL when set', async () => {
    process.env.NGAF_TELEMETRY_INGEST_URL = 'https://custom.example/api/ingest';
    await capturePostinstall({ pkg: 'x', version: '1' });
    expect(PostHog).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ host: 'https://custom.example/api/ingest' }),
    );
  });

  test('capturePostinstall sends sample_weight property', async () => {
    const instance = { capture: vi.fn(), shutdown: vi.fn().mockResolvedValue(undefined) };
    mocks.PostHog.mockImplementation(function () { return instance; });
    await capturePostinstall({ pkg: 'x', version: '1' });
    expect(instance.capture).toHaveBeenCalledWith(expect.objectContaining({
      properties: expect.objectContaining({ sample_weight: expect.any(Number) }),
    }));
  });

  test('capturePostinstall awaits shutdown before resolving', async () => {
    let shutdownCalled = false;
    const instance = {
      capture: vi.fn(),
      shutdown: vi.fn(async () => { shutdownCalled = true; }),
    };
    mocks.PostHog.mockImplementation(function () { return instance; });
    await capturePostinstall({ pkg: 'x', version: '1' });
    expect(shutdownCalled).toBe(true);
  });
});
