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

function okPage(): Response {
  return new Response(
    '<html><head><title>Example</title></head><body><h1>Example company</h1><p>Safe public evidence.</p></body></html>',
    { status: 200, headers: { 'content-type': 'text/html' } }
  );
}

describe('fetchCompanyEvidence page resilience', () => {
  it('skips a page that answers 404 and keeps the others', async () => {
    const fetch = vi.fn(async (url: URL) =>
      url.pathname === '/about' ? new Response(null, { status: 404 }) : okPage()
    );
    const deps = dependencies({ fetch });

    const evidence = await fetchCompanyEvidence(
      'example.com',
      new AbortController().signal,
      deps
    );

    expect(evidence.map((page) => page.canonicalUrl)).toEqual([
      'https://example.com/',
      'https://example.com/pricing',
    ]);
  });

  it('returns no evidence when every page fails instead of throwing', async () => {
    const deps = dependencies({
      fetch: vi.fn(async () => new Response(null, { status: 503 })),
    });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).resolves.toEqual([]);
    expect(deps.fetch).toHaveBeenCalledTimes(3);
  });

  it('still rejects when the caller aborts mid-way', async () => {
    const parent = new AbortController();
    const fetch = vi.fn(async () => {
      parent.abort(new Error('caller aborted'));
      throw new Error('page failed');
    });
    const deps = dependencies({ fetch });

    await expect(
      fetchCompanyEvidence('example.com', parent.signal, deps)
    ).rejects.toThrow(/caller aborted/u);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('still rejects an invalid company domain before fetching anything', async () => {
    const deps = dependencies();

    await expect(
      fetchCompanyEvidence('not a domain', new AbortController().signal, deps)
    ).rejects.toThrow(/company_domain/u);
    expect(deps.fetch).not.toHaveBeenCalled();
  });
});

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
      await vi.advanceTimersByTimeAsync(5_000);
      const [firstOptions] = request.mock.calls[0] ?? [];
      expect(firstOptions?.signal?.aborted).toBe(true);
      expect(firstOptions?.signal?.reason).toMatchObject({
        name: 'TimeoutError',
      });

      // The timed-out page is skipped; the remaining two pages each get
      // their own five-second deadline and the call resolves without
      // evidence rather than rejecting.
      await vi.advanceTimersByTimeAsync(5_000);
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(result).resolves.toEqual([]);
      expect(request).toHaveBeenCalledTimes(3);
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
    ).resolves.toEqual([]);

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
    ).resolves.toEqual([]);

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
    ).resolves.toEqual([]);
    expect(deps.fetch).toHaveBeenCalledTimes(6);
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
    ).resolves.toEqual([]);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('cancels a non-2xx body without masking the HTTP error when cancellation fails', async () => {
    const cancel = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const response = new Response(new ReadableStream<Uint8Array>({ cancel }), {
      status: 500,
    });
    const deps = dependencies({
      fetch: vi
        .fn()
        .mockResolvedValueOnce(response)
        .mockImplementation(async () => okPage()),
    });

    const evidence = await fetchCompanyEvidence(
      'example.com',
      new AbortController().signal,
      deps
    );

    expect(evidence.map((page) => page.canonicalUrl)).toEqual([
      'https://example.com/about',
      'https://example.com/pricing',
    ]);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('cancels an advertised oversized body, skips that page, and keeps the others', async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream<Uint8Array>({ cancel }), {
      headers: { 'content-length': String(250 * 1024 + 1) },
    });
    const deps = dependencies({
      fetch: vi
        .fn()
        .mockResolvedValueOnce(response)
        .mockImplementation(async () => okPage()),
    });

    const evidence = await fetchCompanyEvidence(
      'example.com',
      new AbortController().signal,
      deps
    );

    expect(evidence.map((page) => page.canonicalUrl)).toEqual([
      'https://example.com/about',
      'https://example.com/pricing',
    ]);
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
      fetch: vi
        .fn()
        .mockResolvedValueOnce(new Response(body))
        .mockImplementation(async () => okPage()),
    });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).resolves.toHaveLength(2);
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
    const deps = dependencies({
      fetch: vi
        .fn()
        .mockResolvedValueOnce(response)
        .mockImplementation(async () => okPage()),
    });

    await expect(
      fetchCompanyEvidence('example.com', new AbortController().signal, deps)
    ).resolves.toHaveLength(2);
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
    ).resolves.toEqual([]);
    expect(createTimeoutSignal).toHaveBeenCalledWith(
      expect.any(AbortSignal),
      5_000
    );
    expect(deps.resolve).toHaveBeenCalledWith(
      'example.com',
      timeoutController.signal
    );
  });

  it('decodes HTML entities only once when extracting evidence', async () => {
    const deps = dependencies({
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(
            '<html><head><title>Example &amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;</title></head></html>',
            { headers: { 'content-type': 'text/html' } }
          )
        ),
    });

    const [evidence] = await fetchCompanyEvidence(
      'example.com',
      new AbortController().signal,
      deps
    );

    expect(evidence?.facts).toContain(
      'Example &lt;script&gt;alert(1)&lt;/script&gt;'
    );
    expect(evidence?.facts.join(' ')).not.toContain('<script>');
  });

  it('removes executable elements whose closing tag contains whitespace', async () => {
    const deps = dependencies({
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(
            '<html><body><script><p>malicious executable text</p></script ><p>Safe public evidence.</p></body></html>',
            { headers: { 'content-type': 'text/html' } }
          )
        ),
    });

    const [evidence] = await fetchCompanyEvidence(
      'example.com',
      new AbortController().signal,
      deps
    );

    expect(evidence?.snippets).toContain('Safe public evidence.');
    expect(evidence?.snippets.join(' ')).not.toContain(
      'malicious executable text'
    );
  });

  it('preserves document order across paragraph and list-item snippets', async () => {
    const deps = dependencies({
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(
            '<html><body><li>First evidence.</li><p>Second evidence.</p></body></html>',
            { headers: { 'content-type': 'text/html' } }
          )
        ),
    });

    const [evidence] = await fetchCompanyEvidence(
      'example.com',
      new AbortController().signal,
      deps
    );

    expect(evidence?.snippets).toEqual(['First evidence.', 'Second evidence.']);
  });

  it('excludes executable descendants nested inside evidence elements', async () => {
    const deps = dependencies({
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(
            '<html><body><p>Safe evidence.<script>malicious executable text</script></p></body></html>',
            { headers: { 'content-type': 'text/html' } }
          )
        ),
    });

    const [evidence] = await fetchCompanyEvidence(
      'example.com',
      new AbortController().signal,
      deps
    );

    expect(evidence?.snippets).toEqual(['Safe evidence.']);
  });

  it('handles deeply nested bounded HTML without exhausting the call stack', async () => {
    const depth = 18_000;
    const body = `<html><body><p>${'<b>'.repeat(
      depth
    )}Safe evidence.${'</b>'.repeat(depth)}</p></body></html>`;
    const deps = dependencies({
      fetch: vi.fn().mockResolvedValue(
        new Response(body, {
          headers: { 'content-type': 'text/html' },
        })
      ),
    });

    const [evidence] = await fetchCompanyEvidence(
      'example.com',
      new AbortController().signal,
      deps
    );

    expect(evidence?.snippets).toEqual(['Safe evidence.']);
  });

  it('applies the snippet limit after removing duplicates', async () => {
    const duplicates = '<p>Duplicate evidence.</p>'.repeat(6);
    const deps = dependencies({
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(
            `<html><body>${duplicates}<p>Unique evidence.</p></body></html>`,
            { headers: { 'content-type': 'text/html' } }
          )
        ),
    });

    const [evidence] = await fetchCompanyEvidence(
      'example.com',
      new AbortController().signal,
      deps
    );

    expect(evidence?.snippets).toEqual([
      'Duplicate evidence.',
      'Unique evidence.',
    ]);
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
