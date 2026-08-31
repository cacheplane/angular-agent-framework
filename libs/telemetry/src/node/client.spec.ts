import { beforeEach, describe, expect, test, vi } from 'vitest';

import { captureEvent, _resetClientForTesting } from './client';
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
    delete process.env.TPLANE_TELEMETRY_DISABLED;
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TPLANE_TELEMETRY_SAMPLE_RATE;
    process.env.TPLANE_TELEMETRY_INGEST_URL = 'https://test.example/api/ingest';
  });

  test('sends an event only when an application calls captureEvent', async () => {
    await expect(
      captureEvent('tplane:runtime_instance_created', { transport: 'langgraph' })
    ).resolves.toEqual({ sent: true });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({
      event: 'tplane:runtime_instance_created',
      properties: expect.objectContaining({
        transport: 'langgraph',
        sample_weight: 1,
      }),
    });
  });

  test('uses the configured ingest endpoint', async () => {
    process.env.TPLANE_TELEMETRY_INGEST_URL = 'https://custom.example/api/ingest';
    await captureEvent('tplane:stream_started', {});
    expect(fetchMock.mock.calls[0][0]).toBe('https://custom.example/api/ingest');
  });

  test('defaults to the Threadplane ingest proxy', async () => {
    delete process.env.TPLANE_TELEMETRY_INGEST_URL;
    await captureEvent('tplane:stream_started', {});
    expect(fetchMock.mock.calls[0][0]).toBe('https://threadplane.ai/api/ingest');
  });

  test('respects environment opt-out before making a request', async () => {
    process.env.DO_NOT_TRACK = '1';
    await expect(captureEvent('tplane:stream_started', {})).resolves.toEqual({
      sent: false,
      reason: 'disabled',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('respects programmatic opt-out before making a request', async () => {
    disableTelemetry();
    await expect(captureEvent('tplane:stream_started', {})).resolves.toEqual({
      sent: false,
      reason: 'disabled',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('reports failed sends instead of throwing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    await expect(captureEvent('tplane:stream_errored', {})).resolves.toEqual({
      sent: false,
      reason: 'failed',
    });
  });

  test('invalid sample rate falls back to sending', async () => {
    process.env.TPLANE_TELEMETRY_SAMPLE_RATE = 'not-a-number';
    await expect(captureEvent('tplane:stream_started', {})).resolves.toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
