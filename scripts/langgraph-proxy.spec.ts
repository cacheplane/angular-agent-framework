// scripts/langgraph-proxy.spec.ts
// SPDX-License-Identifier: MIT
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProxyHandler } from './langgraph-proxy';

type MockRes = {
  setHeader: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  _status: number;
};

function makeRes(): MockRes {
  const res: Partial<MockRes> = { _status: 0 };
  res.setHeader = vi.fn();
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res as MockRes;
  });
  res.json = vi.fn();
  res.write = vi.fn();
  res.end = vi.fn();
  res.send = vi.fn();
  return res as MockRes;
}

const DEFAULT_BACKEND = 'https://cockpit-dev.example.us.langgraph.app';

beforeEach(() => {
  process.env['LANGSMITH_API_KEY'] = 'test-key-123';
  vi.restoreAllMocks();
});

describe('createProxyHandler', () => {
  it('returns 500 when LANGSMITH_API_KEY is missing', async () => {
    delete process.env['LANGSMITH_API_KEY'];
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({ method: 'POST', headers: {}, body: {}, url: '/api/foo', query: {} } as never, res as never);
    expect(res._status).toBe(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'LANGSMITH_API_KEY not configured' });
  });

  it('forwards telemetry ingest without requiring LANGSMITH_API_KEY', async () => {
    delete process.env['LANGSMITH_API_KEY'];
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 202, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({
      backendUrl: DEFAULT_BACKEND,
      telemetryIngestUrl: 'https://cacheplane.ai/api/ingest',
    });
    const res = makeRes();
    const body = {
      event: 'ngaf:stream_started',
      distinctId: 'browser:test',
      properties: { surface: 'canonical_demo' },
    };

    await handler({
      method: 'POST',
      headers: { host: 'demo.cacheplane.ai', 'content-type': 'application/json' },
      body,
      url: '/api/ingest',
      query: {},
    } as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://cacheplane.ai/api/ingest');
    expect(init).toEqual(expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }));
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      ...body,
      key: 'phc_public_cacheplane_telemetry',
    });
    expect(res._status).toBe(202);
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
    expect(res.send).toHaveBeenCalledWith('{"ok":true}');
  });

  it('responds 204 to OPTIONS preflight with CORS headers', async () => {
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({ method: 'OPTIONS', headers: {}, body: {}, url: '/api/foo', query: {} } as never, res as never);
    expect(res._status).toBe(204);
    expect(res.setHeader).toHaveBeenCalledWith('access-control-allow-origin', '*');
  });

  it('forwards POST body and injects x-api-key', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({ method: 'POST', headers: { 'content-type': 'application/json', host: 'demo.cacheplane.ai' }, body: { hello: 'world' }, url: '/api/threads', query: {} } as never, res as never);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe(`${DEFAULT_BACKEND}/threads`);
    expect((init as RequestInit).headers).toEqual(
      expect.objectContaining({ 'x-api-key': 'test-key-123' }),
    );
    expect((init as RequestInit).body).toBe(JSON.stringify({ hello: 'world' }));
    expect(res._status).toBe(200);
  });

  it('strips the catch-all query param but keeps real query params', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({ method: 'GET', headers: { host: 'demo.cacheplane.ai' }, body: undefined, url: '/api/threads/abc?[...path]=threads/abc&limit=10', query: {} } as never, res as never);
    expect(fetchMock.mock.calls[0]![0]).toBe(`${DEFAULT_BACKEND}/threads/abc?limit=10`);
  });

  it('streams SSE responses chunk-by-chunk', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: foo\ndata: 1\n\n'));
        controller.enqueue(encoder.encode('event: bar\ndata: 2\n\n'));
        controller.close();
      },
    });
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({ method: 'POST', headers: { host: 'demo.cacheplane.ai' }, body: {}, url: '/api/threads/abc/runs/stream', query: {} } as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/event-stream');
    expect(res.write).toHaveBeenCalledTimes(2);
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('returns 502 on upstream fetch error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({ method: 'POST', headers: { host: 'demo.cacheplane.ai' }, body: {}, url: '/api/threads', query: {} } as never, res as never);
    expect(res._status).toBe(502);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Proxy error' }));
  });

  it('uses the resolveBackend hook when provided', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const resolveBackend = vi.fn(() => 'https://override.example.com');
    const handler = createProxyHandler({ resolveBackend });
    const res = makeRes();
    await handler({ method: 'GET', headers: { host: 'demo.cacheplane.ai', referer: 'https://demo.cacheplane.ai/' }, body: undefined, url: '/api/info', query: {} } as never, res as never);
    expect(resolveBackend).toHaveBeenCalledWith('https://demo.cacheplane.ai/');
    expect(fetchMock.mock.calls[0]![0]).toBe('https://override.example.com/info');
  });

  it('does not call checkRateLimit for non-gated requests', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const checkRateLimit = vi.fn();
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND, checkRateLimit });
    const res = makeRes();
    await handler({ method: 'GET', headers: { host: 'demo.cacheplane.ai' }, body: undefined, url: '/api/info', query: {} } as never, res as never);
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('proceeds to fetch when gated request is under limit', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('data: ok\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    const checkRateLimit = vi.fn().mockResolvedValue({ allowed: true, retryAfterSec: 0, count: 1 });
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND, checkRateLimit });
    const res = makeRes();
    await handler({
      method: 'POST',
      headers: { host: 'demo.cacheplane.ai', 'x-forwarded-for': '203.0.113.5' },
      body: { assistant_id: 'chat' },
      url: '/api/threads/abc/runs/stream',
      query: {},
    } as never, res as never);
    expect(checkRateLimit).toHaveBeenCalledWith('203.0.113.5');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns 429 without calling fetch when gated request is denied', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    const checkRateLimit = vi.fn().mockResolvedValue({ allowed: false, retryAfterSec: 60, count: 11 });
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND, checkRateLimit });
    const res = makeRes();
    await handler({
      method: 'POST',
      headers: { host: 'demo.cacheplane.ai', 'x-forwarded-for': '203.0.113.5' },
      body: { assistant_id: 'chat' },
      url: '/api/threads/abc/runs/stream',
      query: {},
    } as never, res as never);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res._status).toBe(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'rate_limit_exceeded', retryAfterSec: 60 }));
  });

  // === CORS allowlist ===

  it('echoes matching Origin when allowedOrigins is configured', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({
      backendUrl: DEFAULT_BACKEND,
      allowedOrigins: ['https://demo.cacheplane.ai'],
    });
    const res = makeRes();
    await handler({
      method: 'GET',
      headers: { host: 'demo.cacheplane.ai', origin: 'https://demo.cacheplane.ai' },
      body: undefined,
      url: '/api/info',
      query: {},
    } as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith('access-control-allow-origin', 'https://demo.cacheplane.ai');
    expect(res.setHeader).toHaveBeenCalledWith('vary', 'origin');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns 403 when Origin is not in allowlist', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    const handler = createProxyHandler({
      backendUrl: DEFAULT_BACKEND,
      allowedOrigins: ['https://demo.cacheplane.ai'],
    });
    const res = makeRes();
    await handler({
      method: 'GET',
      headers: { host: 'demo.cacheplane.ai', origin: 'https://malicious.example' },
      body: undefined,
      url: '/api/info',
      query: {},
    } as never, res as never);
    expect(res._status).toBe(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'origin_not_allowed' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows requests without an Origin header when allowedOrigins is configured', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({
      backendUrl: DEFAULT_BACKEND,
      allowedOrigins: ['https://demo.cacheplane.ai'],
    });
    const res = makeRes();
    await handler({
      method: 'GET',
      headers: { host: 'demo.cacheplane.ai' },
      body: undefined,
      url: '/api/info',
      query: {},
    } as never, res as never);
    expect(fetchMock).toHaveBeenCalled();
    const calls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls;
    const corsCall = calls.find(([k]) => k === 'access-control-allow-origin');
    expect(corsCall).toBeUndefined();
  });

  it('OPTIONS preflight with allowed Origin returns 204 with echoed Origin', async () => {
    const handler = createProxyHandler({
      backendUrl: DEFAULT_BACKEND,
      allowedOrigins: ['https://demo.cacheplane.ai'],
    });
    const res = makeRes();
    await handler({
      method: 'OPTIONS',
      headers: { origin: 'https://demo.cacheplane.ai' },
      body: undefined,
      url: '/api/info',
      query: {},
    } as never, res as never);
    expect(res._status).toBe(204);
    expect(res.setHeader).toHaveBeenCalledWith('access-control-allow-origin', 'https://demo.cacheplane.ai');
  });

  it('preserves wildcard CORS when allowedOrigins is undefined (legacy examples behavior)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({
      method: 'GET',
      headers: { host: 'demo.cacheplane.ai', origin: 'https://anywhere.example' },
      body: undefined,
      url: '/api/info',
      query: {},
    } as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith('access-control-allow-origin', '*');
  });

  // === Body-size cap ===

  it('returns 413 when body length exceeds maxBodyBytes (via JSON.stringify)', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND, maxBodyBytes: 100 });
    const res = makeRes();
    const bigBody = { content: 'x'.repeat(200) };
    await handler({
      method: 'POST',
      headers: { host: 'demo.cacheplane.ai', 'content-type': 'application/json' },
      body: bigBody,
      url: '/api/threads',
      query: {},
    } as never, res as never);
    expect(res._status).toBe(413);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'payload_too_large',
      maxBytes: 100,
    }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 413 when Content-Length header exceeds maxBodyBytes (short-circuit)', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND, maxBodyBytes: 100 });
    const res = makeRes();
    await handler({
      method: 'POST',
      headers: {
        host: 'demo.cacheplane.ai',
        'content-type': 'application/json',
        'content-length': '500',
      },
      body: { ok: true },
      url: '/api/threads',
      query: {},
    } as never, res as never);
    expect(res._status).toBe(413);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'payload_too_large',
      maxBytes: 100,
      actualBytes: 500,
    }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not enforce cap when maxBodyBytes is undefined (legacy examples behavior)', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const handler = createProxyHandler({ backendUrl: DEFAULT_BACKEND });
    const res = makeRes();
    await handler({
      method: 'POST',
      headers: { host: 'demo.cacheplane.ai', 'content-type': 'application/json', 'content-length': '999999' },
      body: { content: 'x'.repeat(50000) },
      url: '/api/threads',
      query: {},
    } as never, res as never);
    expect(fetchMock).toHaveBeenCalled();
    expect(res._status).toBe(200);
  });
});
