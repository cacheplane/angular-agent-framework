// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { createTelemetryClient } from './telemetry';

describe('createTelemetryClient', () => {
  const origEnv = { ...process.env };
  const origGlobal = (globalThis as Record<string, unknown>).CACHEPLANE_TELEMETRY;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.CACHEPLANE_TELEMETRY;
    delete (globalThis as Record<string, unknown>).CACHEPLANE_TELEMETRY;
  });

  afterEach(() => {
    process.env = origEnv;
    (globalThis as Record<string, unknown>).CACHEPLANE_TELEMETRY = origGlobal;
  });

  it('posts a payload to the endpoint with a generated anon_instance_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createTelemetryClient({
      endpoint: 'https://telemetry.example.com/v1/ping',
      fetch: fetchMock,
    });

    await client.send({
      package: '@cacheplane/langgraph',
      version: '1.0.0',
      licenseId: 'cus_123',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://telemetry.example.com/v1/ping');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.package).toBe('@cacheplane/langgraph');
    expect(body.version).toBe('1.0.0');
    expect(body.license_id).toBe('cus_123');
    expect(typeof body.anon_instance_id).toBe('string');
    expect(body.anon_instance_id.length).toBeGreaterThan(0);
  });

  it('reuses the same anon_instance_id across calls from the same client', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createTelemetryClient({
      endpoint: 'https://telemetry.example.com/v1/ping',
      fetch: fetchMock,
    });
    await client.send({ package: '@cacheplane/langgraph', version: '1.0.0' });
    await client.send({ package: '@cacheplane/langgraph', version: '1.0.0' });

    const id1 = JSON.parse(fetchMock.mock.calls[0][1].body as string).anon_instance_id;
    const id2 = JSON.parse(fetchMock.mock.calls[1][1].body as string).anon_instance_id;
    expect(id1).toBe(id2);
  });

  it('is a no-op when CACHEPLANE_TELEMETRY=0 env is set', async () => {
    process.env.CACHEPLANE_TELEMETRY = '0';
    const fetchMock = vi.fn();
    const client = createTelemetryClient({
      endpoint: 'https://telemetry.example.com/v1/ping',
      fetch: fetchMock,
    });
    await client.send({ package: '@cacheplane/langgraph', version: '1.0.0' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is a no-op when globalThis.CACHEPLANE_TELEMETRY === false', async () => {
    (globalThis as Record<string, unknown>).CACHEPLANE_TELEMETRY = false;
    const fetchMock = vi.fn();
    const client = createTelemetryClient({
      endpoint: 'https://telemetry.example.com/v1/ping',
      fetch: fetchMock,
    });
    await client.send({ package: '@cacheplane/langgraph', version: '1.0.0' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws when fetch rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    const client = createTelemetryClient({
      endpoint: 'https://telemetry.example.com/v1/ping',
      fetch: fetchMock,
    });
    await expect(
      client.send({ package: '@cacheplane/langgraph', version: '1.0.0' }),
    ).resolves.toBeUndefined();
  });
});
