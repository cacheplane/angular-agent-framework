import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchFirecrawlCompanyEvidence,
  type FirecrawlOptions,
} from './firecrawl.js';

const html =
  '<title>Example</title><h1>Tools</h1><p>Useful tools</p><script>secret()</script>';
const metadata = {
  sourceURL: 'https://example.com/',
  url: 'https://www.example.com/',
  pageStatusCode: 200,
};
const payload = (data = {}) => ({
  content: html,
  ...metadata,
  ...data,
});
function setup(body: unknown = payload()) {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(Response.json(body));
  const resolve = vi.fn().mockResolvedValue(['93.184.216.34']);
  const options: FirecrawlOptions = {
    serviceUrl: 'https://scraper.example.com',
    secret: 'test-key',
    fetch,
    resolve,
    now: () => new Date('2026-09-01T12:00:00Z'),
  };
  return { fetch, resolve, options };
}
const run = (
  options: FirecrawlOptions,
  domain = 'example.com',
  signal = new AbortController().signal
) => fetchFirecrawlCompanyEvidence(domain, signal, options);
afterEach(() => vi.useRealTimers());
describe('Firecrawl homepage evidence', () => {
  it.each([
    'http://scraper.example.com',
    'http://127.0.0.1:33003',
    'https://user:password@scraper.example.com',
    'https://scraper.example.com/path',
    'https://scraper.example.com/?token=value',
    'https://scraper.example.com/#hash',
    'https://api.firecrawl.dev',
    'https://scraper.example.com:444',
  ])(
    'rejects invalid service configuration %s before network',
    async (serviceUrl) => {
      const { options, fetch, resolve } = setup();
      await expect(run({ ...options, serviceUrl })).rejects.toThrow(
        'configuration'
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(resolve).not.toHaveBeenCalled();
    }
  );
  it('permits an explicitly configured local loopback service', async () => {
    const { options, fetch } = setup();
    await expect(
      run({
        ...options,
        serviceUrl: 'http://127.0.0.1:33003',
        allowLocalHttp: true,
      })
    ).resolves.toHaveLength(1);
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:33003/scrape');
  });
  it('uses exactly one fixed authenticated scrape and maps extracted HTML with actual URL provenance', async () => {
    const { fetch, options } = setup();
    const result = await run(options);
    expect(result).toEqual([
      {
        canonicalUrl: metadata.url,
        retrievedAt: '2026-09-01T12:00:00.000Z',
        contentHash: createHash('sha256').update(html).digest('hex'),
        facts: ['Example', 'Tools'],
        snippets: ['Useful tools'],
      },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://scraper.example.com/scrape');
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { authorization: 'Bearer test-key' },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      url: 'https://example.com/',
    });
  });
  it('requires the key before DNS or network', async () => {
    const { options, fetch, resolve } = setup();
    await expect(run({ ...options, secret: ' ' })).rejects.toThrow(
      'configuration'
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });
  it.each([
    '127.0.0.1',
    'localhost',
    'https://example.com',
    'example.com/path',
  ])('rejects unsafe input %s before network', async (domain) => {
    const { options, fetch } = setup();
    await expect(run(options, domain)).rejects.toThrow('security_rejected');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects mixed public/private DNS answers', async () => {
    const { options, resolve, fetch } = setup();
    resolve.mockResolvedValue(['93.184.216.34', '10.0.0.1']);
    await expect(run(options)).rejects.toThrow('security_rejected');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { ...metadata, sourceURL: 'https://unrelated.com/' },
    {
      sourceURL: metadata.sourceURL,
      url: undefined,
      ogUrl: metadata.url,
      pageStatusCode: 200,
    },
    { ...metadata, url: 'http://example.com/' },
    { ...metadata, url: 'https://127.0.0.1/' },
    { ...metadata, url: 'https://example.com/?token=secret' },
    { ...metadata, url: 'https://example.com/#fragment' },
    { ...metadata, url: 'https://user:pass@example.com/' },
    { ...metadata, url: 'https://example.com:444/' },
    { ...metadata, url: `https://example.com/${'x'.repeat(500)}` },
  ])('rejects invalid provenance %#', async (invalid) => {
    await expect(run(setup(payload(invalid)).options)).rejects.toThrow();
  });
  it('validates final hostname DNS', async () => {
    const { options, resolve } = setup();
    resolve.mockImplementation(async (host) =>
      host === 'www.example.com' ? ['10.0.0.1'] : ['93.184.216.34']
    );
    await expect(run(options)).rejects.toThrow('security_rejected');
  });
  it.each([
    payload({ content: '' }),
    payload({ pageStatusCode: 404 }),
    payload({ content: '<script>secret</script>' }),
  ])('returns no evidence for empty or missing pages %#', async (body) => {
    await expect(run(setup(body).options)).resolves.toEqual([]);
  });
  it.each([401, 402, 429, 500, 302])(
    'rejects API HTTP %s without logging body or retrying',
    async (status) => {
      const { options, fetch } = setup();
      fetch.mockResolvedValue(new Response('private body', { status }));
      const diagnostics: unknown[] = [];
      await expect(
        run({ ...options, onDiagnostic: (d) => diagnostics.push(d) })
      ).rejects.toThrow('api_http_error');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(diagnostics).toEqual([
        { provider: 'firecrawl', outcome: 'api_http_error', apiStatus: status },
      ]);
    }
  );
  it.each([
    { success: false, error: 'private body' },
    { success: true, data: null },
    {
      success: true,
      ...payload({ pageStatusCode: 503 }),
    },
  ])('rejects provider failures %#', async (body) => {
    await expect(run(setup(body).options)).rejects.toThrow();
  });
  it.each([true, false])(
    'caps advertised and streamed JSON bytes (%s)',
    async (advertised) => {
      const { options, fetch } = setup();
      fetch.mockResolvedValue(
        new Response('x'.repeat(2 * 1024 * 1024 + 1), {
          headers: advertised
            ? { 'content-length': String(2 * 1024 * 1024 + 1) }
            : {},
        })
      );
      await expect(run(options)).rejects.toThrow('response_too_large');
    }
  );
  it.each(['dns', 'fetch', 'body'])(
    'bounds stalled %s at total 15 seconds',
    async (stage) => {
      vi.useFakeTimers();
      const { options, fetch, resolve } = setup();
      if (stage === 'dns')
        resolve.mockImplementation(
          () =>
            new Promise(() => {
              /* Simulate a stalled transport. */
            })
        );
      if (stage === 'fetch')
        fetch.mockImplementation(
          () =>
            new Promise(() => {
              /* Simulate a stalled transport. */
            })
        );
      if (stage === 'body')
        fetch.mockResolvedValue(
          new Response(
            new ReadableStream({
              pull: () =>
                new Promise(() => {
                  /* Simulate a stalled transport. */
                }),
              cancel: () =>
                new Promise(() => {
                  /* Simulate a stalled transport. */
                }),
            })
          )
        );
      const checked = expect(run(options)).rejects.toThrow('timeout');
      await vi.advanceTimersByTimeAsync(15000);
      await checked;
    }
  );
  it('propagates cancellation without late evidence even if callback aborts', async () => {
    const { options } = setup();
    const controller = new AbortController();
    const reason = new Error('caller');
    await expect(
      run(
        { ...options, onDiagnostic: () => controller.abort(reason) },
        'example.com',
        controller.signal
      )
    ).rejects.toBe(reason);
  });
  it.each(['dns', 'fetch', 'body'])(
    'propagates caller cancellation during %s without waiting for transport',
    async (stage) => {
      const { options, fetch, resolve } = setup();
      const controller = new AbortController();
      const reason = new Error('caller');
      if (stage === 'dns')
        resolve.mockImplementation(
          () =>
            new Promise(() => {
              /* Simulate a stalled transport. */
            })
        );
      if (stage === 'fetch')
        fetch.mockImplementation(
          () =>
            new Promise(() => {
              /* Simulate a stalled transport. */
            })
        );
      if (stage === 'body')
        fetch.mockResolvedValue(
          new Response(
            new ReadableStream({
              pull: () =>
                new Promise(() => {
                  /* Simulate a stalled transport. */
                }),
            })
          )
        );
      const pending = run(options, 'example.com', controller.signal);
      const checked = expect(pending).rejects.toBe(reason);
      await new Promise((resolve) => setTimeout(resolve, 0));
      controller.abort(reason);
      await checked;
    }
  );
  it('does not request a pre-cancelled capture', async () => {
    const { options, fetch, resolve } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(
      run(options, 'example.com', controller.signal)
    ).rejects.toHaveProperty('name', 'AbortError');
    expect(fetch).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });
  it('checks cancellation after the clock callback', async () => {
    const { options } = setup();
    const controller = new AbortController();
    const reason = new Error('caller');
    await expect(
      run(
        {
          ...options,
          now: () => {
            controller.abort(reason);
            return new Date();
          },
        },
        'example.com',
        controller.signal
      )
    ).rejects.toBe(reason);
  });
  it('keeps the existing six-item and 240-character extraction bounds', async () => {
    const body = `<title>${'x'.repeat(300)}</title>${'<h1>Heading</h1>'.repeat(
      10
    )}${Array.from(
      { length: 10 },
      (_, i) => `<p>${i}${'p'.repeat(300)}</p>`
    ).join('')}<style>private</style>`;
    const result = await run(setup(payload({ content: body })).options);
    expect(result[0].facts.length).toBeLessThanOrEqual(6);
    expect(result[0].snippets).toHaveLength(6);
    expect(
      [...result[0].facts, ...result[0].snippets].every(
        (text) => text.length <= 240
      )
    ).toBe(true);
  });
  it('rejects malformed JSON without leaking its body', async () => {
    const { options, fetch } = setup();
    fetch.mockResolvedValue(new Response('private invalid json'));
    await expect(run(options)).rejects.toThrow(/^invalid_response$/);
  });
  it('ignores observer errors and exposes only bounded diagnostic fields', async () => {
    const { options } = setup(payload({ creditsUsed: 1, private: 'secret' }));
    const diagnostics: unknown[] = [];
    expect(
      await run({
        ...options,
        onDiagnostic: (d) => {
          diagnostics.push(d);
          throw new Error('observer');
        },
      })
    ).toHaveLength(1);
    expect(diagnostics).toEqual([
      {
        provider: 'firecrawl',
        outcome: 'captured',
        apiStatus: 200,
        pageStatus: 200,
        bytes: expect.any(Number),
      },
    ]);
  });
});
