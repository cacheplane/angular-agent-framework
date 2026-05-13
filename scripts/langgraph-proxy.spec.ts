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
});
