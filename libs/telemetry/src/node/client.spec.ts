import { describe, test, expect, beforeEach, vi } from 'vitest';

import { capturePostinstall, captureEvent, _resetClientForTesting } from './client';
import { disableTelemetry, _resetDisableForTesting } from './disable';

describe('node client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    _resetClientForTesting();
    _resetDisableForTesting();
    delete process.env.DO_NOT_TRACK;
    delete process.env.NGAF_TELEMETRY_DISABLED;
    delete process.env.CI;
    delete process.env.NGAF_TELEMETRY_SAMPLE_RATE;
    delete process.env.npm_config_user_agent;
    process.env.NGAF_TELEMETRY_INGEST_URL = 'https://test.example/api/ingest';
  });

  test('capturePostinstall sends an event with pkg + version', async () => {
    await expect(capturePostinstall({ pkg: '@ngaf/telemetry', version: '0.0.31' }))
      .resolves.toEqual({ sent: true });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({
      event: 'ngaf:postinstall',
      properties: expect.objectContaining({ pkg: '@ngaf/telemetry', version: '0.0.31' }),
    });
  });

  test('capturePostinstall no-ops when DO_NOT_TRACK is set', async () => {
    process.env.DO_NOT_TRACK = '1';
    await expect(capturePostinstall({ pkg: 'x', version: '1' }))
      .resolves.toEqual({ sent: false, reason: 'disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('capturePostinstall no-ops after disableTelemetry()', async () => {
    disableTelemetry();
    await expect(capturePostinstall({ pkg: 'x', version: '1' }))
      .resolves.toEqual({ sent: false, reason: 'disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('capturePostinstall uses NGAF_TELEMETRY_INGEST_URL when set', async () => {
    process.env.NGAF_TELEMETRY_INGEST_URL = 'https://custom.example/api/ingest';
    await capturePostinstall({ pkg: 'x', version: '1' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://custom.example/api/ingest');
  });

  test('capturePostinstall sends sample_weight property', async () => {
    await capturePostinstall({ pkg: 'x', version: '1' });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.properties).toEqual(expect.objectContaining({ sample_weight: expect.any(Number) }));
  });

  test('capturePostinstall includes npm package manager metadata when available', async () => {
    process.env.npm_config_user_agent = 'npm/10.9.2 node/v22.14.0 darwin arm64 workspaces/false';
    await capturePostinstall({ pkg: 'x', version: '1' });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.properties).toEqual(expect.objectContaining({
      package_manager: 'npm',
      package_manager_version: '10.9.2',
    }));
  });

  test('capturePostinstall awaits fetch before resolving', async () => {
    let fetchResolved = false;
    fetchMock.mockImplementationOnce(async () => {
      fetchResolved = true;
      return { ok: true, status: 200 };
    });
    await capturePostinstall({ pkg: 'x', version: '1' });
    expect(fetchResolved).toBe(true);
  });

  test('captureEvent reports failed sends instead of pretending success', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    await expect(captureEvent('ngaf:postinstall', {}))
      .resolves.toEqual({ sent: false, reason: 'failed' });
  });

  test('invalid sample rate falls back to 1 instead of silently dropping telemetry', async () => {
    process.env.NGAF_TELEMETRY_SAMPLE_RATE = 'not-a-number';
    await expect(capturePostinstall({ pkg: 'x', version: '1' }))
      .resolves.toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalled();
  });
});
