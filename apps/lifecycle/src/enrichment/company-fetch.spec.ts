import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { RequestOptions as HttpsRequestOptions } from 'node:https';
import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import {
  fetchCompanyEvidence,
  resolveWithNodeDns,
  type CompanyFetchDependencies,
  type CompanyRequestInit,
} from './company-fetch.js';

const NOW = new Date('2026-09-01T12:00:00.000Z');

function dependencies(
  overrides: Partial<CompanyFetchDependencies> = {}
): CompanyFetchDependencies {
  return {
    resolve: vi.fn().mockResolvedValue(['93.184.216.34']),
    fetch: vi
      .fn()
      .mockResolvedValue(
        new Response(
          '<html><head><title>Example</title></head><body><h1>Example company</h1><p>Safe public evidence.</p></body></html>',
          { status: 200, headers: { 'content-type': 'text/html' } }
        )
      ),
    now: vi.fn(() => NOW),
    createTimeoutSignal: vi.fn((parentSignal) => ({
      signal: parentSignal,
      clear: vi.fn(),
    })),
    ...overrides,
  };
}

describe('fetchCompanyEvidence SSRF controls', () => {
  it('shares one five-second deadline across DNS and every redirect for a page', async () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    let secondSignal: AbortSignal | undefined;
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        async () =>
          new Promise<Response>((resolve) => {
            setTimeout(
              () =>
                resolve(
                  new Response(null, {
                    status: 302,
                    headers: { location: '/next' },
                  })
                ),
              3_000
            );
          })
      )
      .mockImplementationOnce(
        async (_url: URL, init: CompanyRequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            secondSignal = init.signal ?? undefined;
            secondSignal?.addEventListener(
              'abort',
              () => reject(secondSignal?.reason),
              { once: true }
            );
          })
      );
    const result = fetchCompanyEvidence('example.com', parent.signal, {
      resolve: vi.fn().mockResolvedValue(['93.184.216.34']),
      fetch,
    });
    const observed = result.catch(() => undefined);

    try {
      await vi.advanceTimersByTimeAsync(3_000);
      expect(fetch).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1_999);
      expect(secondSignal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(secondSignal?.aborted).toBe(true);
    } finally {
      parent.abort(new Error('test cleanup'));
      await observed;
      vi.useRealTimers();
    }
  });

  it('cancels outstanding production DNS queries when the request signal aborts', async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const pending = new Promise<string[]>(() => undefined);
    const resolution = resolveWithNodeDns(
      'example.com',
      controller.signal,
      () => ({
        cancel,
        resolve4: vi.fn(() => pending),
        resolve6: vi.fn(() => pending),
      })
    );

    controller.abort(new Error('Dawn cancelled'));

    await expect(resolution).rejects.toThrow(/Dawn cancelled/u);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('enforces the safe default five-second timeout without a custom timer', async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn(
        (
          options: HttpsRequestOptions,
          _callback: (response: IncomingMessage) => void
        ) => {
          void _callback;
          const handle = new EventEmitter() as ClientRequest;
          handle.end = vi.fn();
          options.signal?.addEventListener(
            'abort',
            () => handle.emit('error', options.signal?.reason),
            { once: true }
          );
          return handle;
        }
      );
      const result = fetchCompanyEvidence(
        'example.com',
        new AbortController().signal,
        {
          resolve: vi.fn().mockResolvedValue(['93.184.216.34']),
          request,
        }
      );
      const rejection = expect(result).rejects.toMatchObject({
        name: 'TimeoutError',
      });

      await vi.advanceTimersByTimeAsync(5_000);

      await rejection;
      expect(request).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('pins production HTTPS sockets to the validated IP while preserving hostname verification', async () => {
    const resolve = vi.fn().mockResolvedValue(['93.184.216.34']);
    const request = vi.fn(
      (
        _options: HttpsRequestOptions,
        callback: (response: IncomingMessage) => void
      ) => {
        const handle = new EventEmitter() as ClientRequest;
        handle.end = vi.fn(() => {
          const response = Readable.from([
            Buffer.from('<html><title>Example</title></html>'),
          ]) as IncomingMessage;
          response.statusCode = 200;
          response.headers = { 'content-type': 'text/html' };
          callback(response);
          return handle;
        });
        return handle;
      }
    );

    await fetchCompanyEvidence('example.com', new AbortController().signal, {
      resolve,
      request,
      now: () => NOW,
      createTimeoutSignal: (signal) => ({ signal, clear: vi.fn() }),
    });

    expect(resolve).toHaveBeenCalledTimes(3);
    expect(request).toHaveBeenCalledTimes(3);
    for (const [options] of request.mock.calls) {
      expect(options).toMatchObject({
        hostname: '93.184.216.34',
        port: 443,
        servername: 'example.com',
        rejectUnauthorized: true,
        headers: expect.objectContaining({ host: 'example.com' }),
      });
      expect(options.lookup).toBeUndefined();
    }
  });

  it('destroys the production IncomingMessage when its Web body is abandoned', async () => {
    let calls = 0;
    let firstDestroy: ReturnType<typeof vi.fn> | undefined;
    const request = vi.fn(
      (
        _options: HttpsRequestOptions,
        callback: (response: IncomingMessage) => void
      ) => {
        const handle = new EventEmitter() as ClientRequest;
        handle.end = vi.fn(() => {
          calls += 1;
          const incoming = new Readable({
            read() {
              return undefined;
            },
          }) as IncomingMessage;
          incoming.statusCode = calls === 1 ? 302 : 500;
          incoming.headers =
            calls === 1
              ? { location: '/next' }
              : { 'content-type': 'text/plain' };
          const destroy = vi.fn(incoming.destroy.bind(incoming));
          incoming.destroy = destroy;
          if (calls === 1) firstDestroy = destroy;
          callback(incoming);
          return handle;
        });
        return handle;
      }
    );

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, {
        resolve: vi.fn().mockResolvedValue(['93.184.216.34']),
        request,
        createTimeoutSignal: (signal) => ({ signal, clear: vi.fn() }),
      })
    ).rejects.toThrow(/HTTP 500/u);

    expect(firstDestroy).toHaveBeenCalled();
  });

  it('destroys the production IncomingMessage when Response construction rejects', async () => {
    let incoming: IncomingMessage | undefined;
    const request = vi.fn(
      (
        _options: HttpsRequestOptions,
        callback: (response: IncomingMessage) => void
      ) => {
        const handle = new EventEmitter() as ClientRequest;
        handle.end = vi.fn(() => {
          incoming = Readable.from([
            Buffer.from('invalid status'),
          ]) as IncomingMessage;
          incoming.statusCode = 700;
          incoming.headers = { 'content-type': 'text/plain' };
          vi.spyOn(incoming, 'destroy');
          callback(incoming);
          return handle;
        });
        return handle;
      }
    );

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, {
        resolve: vi.fn().mockResolvedValue(['93.184.216.34']),
        request,
        createTimeoutSignal: (signal) => ({ signal, clear: vi.fn() }),
      })
    ).rejects.toBeInstanceOf(RangeError);

    expect(incoming?.destroy).toHaveBeenCalledOnce();
    expect(incoming?.destroyed).toBe(true);
  });

  it.each([
    ['loopback IPv4', '127.0.0.1'],
    ['private IPv4', '10.0.0.1'],
    ['private IPv4 172', '172.16.0.1'],
    ['private IPv4 192', '192.168.0.1'],
    ['link-local IPv4', '169.254.169.254'],
    ['carrier-grade IPv4', '100.64.0.1'],
    ['documentation IPv4', '192.0.2.1'],
    ['deprecated relay IPv4', '192.88.99.1'],
    ['benchmark IPv4', '198.18.0.1'],
    ['multicast IPv4', '224.0.0.1'],
    ['reserved IPv4', '240.0.0.1'],
    ['unspecified IPv4', '0.0.0.0'],
    ['loopback IPv6', '::1'],
    ['private IPv6', 'fd00::1'],
    ['link-local IPv6', 'fe80::1'],
    ['multicast IPv6', 'ff02::1'],
    ['documentation IPv6', '2001:db8::1'],
    ['retired 6bone IPv6', '3ffe::1'],
    ['documentation IPv6 3fff', '3fff::1'],
    ['reserved ORCHIDv2 IPv6', '2001:20::1'],
    ['unspecified IPv6', '::'],
    ['IPv4-mapped private IPv6', '::ffff:127.0.0.1'],
  ])('rejects %s resolution', async (_label, address) => {
    const deps = dependencies({
      resolve: vi.fn().mockResolvedValue([address]),
    });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).rejects.toThrow(/unsafe address/u);
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it('rejects the whole resolution when any address is unsafe', async () => {
    const deps = dependencies({
      resolve: vi.fn().mockResolvedValue(['93.184.216.34', '127.0.0.1']),
    });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).rejects.toThrow(/unsafe address/u);
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it.each([
    'https://example.com',
    'example.com:8443',
    'user@example.com',
    '127.0.0.1',
    '[::1]',
    'example.com/path',
  ])('rejects an invalid company_domain: %s', async (companyDomain) => {
    await expect(
      fetchCompanyEvidence(
        companyDomain,
        new AbortController().signal,
        dependencies()
      )
    ).rejects.toThrow(/company_domain/u);
  });

  it.each([
    'http://example.com/about',
    'https://other.example/about',
    'https://user:pass@example.com/about',
    'https://example.com:8443/about',
  ])('rejects an unsafe redirect target: %s', async (location) => {
    const deps = dependencies({
      fetch: vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, { status: 302, headers: { location } })
        ),
    });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).rejects.toThrow(/redirect/u);
  });

  it('re-resolves and revalidates every redirect hop', async () => {
    const resolve = vi
      .fn()
      .mockResolvedValueOnce(['93.184.216.34'])
      .mockResolvedValueOnce(['127.0.0.1']);
    const deps = dependencies({
      resolve,
      fetch: vi.fn().mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: '/about' },
        })
      ),
    });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).rejects.toThrow(/unsafe address/u);
    expect(resolve).toHaveBeenNthCalledWith(
      1,
      'example.com',
      expect.any(AbortSignal)
    );
    expect(resolve).toHaveBeenNthCalledWith(
      2,
      'example.com',
      expect.any(AbortSignal)
    );
    expect(deps.fetch).toHaveBeenCalledOnce();
  });

  it('caps deterministic research at three pages', async () => {
    const deps = dependencies();

    const evidence = await fetchCompanyEvidence(
      'example.com',
      new AbortController().signal,
      deps
    );

    expect(evidence).toHaveLength(3);
    expect(deps.fetch).toHaveBeenCalledTimes(3);
    expect(deps.fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ resolvedAddresses: ['93.184.216.34'] })
    );
  });

  it('caps redirects at three total', async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { location: '/next' },
    });
    const deps = dependencies({
      fetch: vi.fn().mockImplementation(async () => redirect.clone()),
    });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).rejects.toThrow(/redirect limit/u);
    expect(deps.fetch).toHaveBeenCalledTimes(4);
  });

  it('cancels a redirect response body before following it', async () => {
    const cancel = vi.fn();
    const redirect = new Response(new ReadableStream<Uint8Array>({ cancel }), {
      status: 302,
      headers: { location: '/next' },
    });
    const deps = dependencies({
      fetch: vi
        .fn()
        .mockResolvedValueOnce(redirect)
        .mockRejectedValueOnce(new Error('stop after redirect')),
    });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).rejects.toThrow(/stop after redirect/u);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('cancels a non-2xx body without masking the HTTP error when cancellation fails', async () => {
    const cancel = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const response = new Response(new ReadableStream<Uint8Array>({ cancel }), {
      status: 500,
    });
    const deps = dependencies({ fetch: vi.fn().mockResolvedValue(response) });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).rejects.toThrow(/HTTP 500/u);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('cancels an advertised oversized body before throwing', async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream<Uint8Array>({ cancel }), {
      headers: { 'content-length': String(250 * 1024 + 1) },
    });
    const deps = dependencies({ fetch: vi.fn().mockResolvedValue(response) });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).rejects.toThrow(/250 KiB/u);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('streams bodies and rejects more than 250 KiB before retaining them', async () => {
    const chunk = new Uint8Array(128 * 1024).fill(97);
    const cancel = vi.fn();
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
        reads += 1;
      },
      cancel,
    });
    const deps = dependencies({
      fetch: vi.fn().mockResolvedValue(new Response(body)),
    });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).rejects.toThrow(/250 KiB/u);
    expect(reads).toBeGreaterThanOrEqual(2);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('cancels after a body read failure without masking the read error', async () => {
    const readError = new Error('body read failed');
    const cancel = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const releaseLock = vi.fn();
    const response = new Response('placeholder');
    vi.spyOn(
      response.body as ReadableStream<Uint8Array>,
      'getReader'
    ).mockReturnValue({
      read: vi.fn().mockRejectedValue(readError),
      cancel,
      releaseLock,
    } as unknown as ReadableStreamDefaultReader<Uint8Array>);
    const deps = dependencies({ fetch: vi.fn().mockResolvedValue(response) });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).rejects.toThrow(/body read failed/u);
    expect(cancel).toHaveBeenCalledOnce();
    expect(releaseLock).toHaveBeenCalledOnce();
  });

  it('applies a five-second timeout to every page and propagates its signal', async () => {
    const timeoutController = new AbortController();
    const createTimeoutSignal = vi.fn(() => ({
      signal: timeoutController.signal,
      clear: vi.fn(),
    }));
    const fetch = vi.fn(async (_url: URL, init: RequestInit) => {
      expect(init.signal).toBe(timeoutController.signal);
      throw new Error('timed out');
    });
    const deps = dependencies({ createTimeoutSignal, fetch });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).rejects.toThrow(/timed out/u);
    expect(createTimeoutSignal).toHaveBeenCalledWith(
      expect.any(AbortSignal),
      5_000
    );
    expect(deps.resolve).toHaveBeenCalledWith(
      'example.com',
      timeoutController.signal
    );
  });

  it('returns only bounded extracted evidence, canonical URL, timestamp, and hash', async () => {
    const fullBody = `<html><head><title>Example</title></head><body><h1>Example company</h1><p>${'bounded evidence '.repeat(
      400
    )}</p></body></html>`;
    const deps = dependencies({
      fetch: vi.fn().mockResolvedValue(new Response(fullBody)),
    });

    const [evidence] = await fetchCompanyEvidence(
      'example.com',
      new AbortController().signal,
      deps
    );

    expect(evidence).toEqual({
      canonicalUrl: 'https://example.com/',
      retrievedAt: NOW.toISOString(),
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      facts: expect.any(Array),
      snippets: expect.any(Array),
    });
    expect(JSON.stringify(evidence)).not.toContain(fullBody);
    expect(JSON.stringify(evidence).length).toBeLessThan(2_500);
  });
});
