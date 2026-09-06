import { afterEach, expect, it, vi } from 'vitest';
import { acquireCompanies } from '../src/pilot/acquisition.js';
// Exercise the same internal capture dependency used by pilot acquisition.
// eslint-disable-next-line @nx/enforce-module-boundaries
import * as firecrawl from '../../lifecycle/src/enrichment/firecrawl.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('uses the configured Firecrawl capture by default', async () => {
  vi.stubEnv('COMPANY_SCRAPER_SECRET', 'fixture-key');
  vi.stubEnv('COMPANY_SCRAPER_URL', 'https://scraper.example');
  const capture = vi
    .spyOn(firecrawl, 'fetchFirecrawlCompanyEvidence')
    .mockResolvedValueOnce([]);
  const signal = new AbortController().signal;
  await acquireCompanies(['atlas.example'], signal);
  expect(capture).toHaveBeenCalledWith(
    'atlas.example',
    signal,
    expect.objectContaining({
      secret: 'fixture-key',
      serviceUrl: 'https://scraper.example',
      onDiagnostic: expect.any(Function),
    })
  );
});

it('retains bounded Firecrawl diagnostics when final provenance is unsafe', async () => {
  const result = await acquireCompanies(
    ['atlas.example'],
    new AbortController().signal,
    (domain, signal, options) =>
      firecrawl.fetchFirecrawlCompanyEvidence(domain, signal, {
        ...options,
        secret: 'fixture-key',
        serviceUrl: 'https://scraper.example',
        resolve: async () => ['93.184.216.34'],
        fetch: async () =>
          Response.json({
            sourceURL: 'https://atlas.example/',
            url: 'https://unsafe.example/?secret=private',
            pageStatusCode: 200,
            content: '<title>Atlas</title>',
          }),
      })
  );
  expect(result.captures[0].status).toBe('failed');
  expect(result.cases[0].pages).toEqual([]);
  expect(result.captures[0].pageDiagnostics).toEqual([
    {
      provider: 'firecrawl',
      outcome: 'invalid_provenance',
      apiStatus: 200,
      bytes: expect.any(Number),
    },
  ]);
  expect(JSON.stringify(result)).not.toContain('private');
});

it.each(['/', '/company'])(
  'keeps a captured homepage ending at %s complete alongside empty and failed captures',
  async (finalPath) => {
    const result = await acquireCompanies(
      ['atlas.example', 'beacon.example', 'coral.example'],
      new AbortController().signal,
      async (domain) => {
        if (domain === 'coral.example')
          throw new Error('secret provider details');
        if (domain === 'beacon.example') return [];
        return [
          {
            canonicalUrl: `https://atlas.example${finalPath}`,
            retrievedAt: '2026-09-05T00:00:00.000Z',
            contentHash: 'a'.repeat(64),
            facts: ['Company tools'],
            snippets: [],
          },
        ];
      }
    );
    expect(result.cases).toHaveLength(3);
    expect(result.captures.map((row) => row.status)).toEqual([
      'complete',
      'empty',
      'failed',
    ]);
    expect(JSON.stringify(result)).not.toContain('secret provider');
    expect(result.captures[0].unavailablePaths).toEqual([]);
    expect(result.captures[0].redirectedPathsIndeterminate).toBe(
      finalPath !== '/'
    );
  }
);

it('rejects paths and duplicate domains before acquisition', async () => {
  let calls = 0;
  await expect(
    acquireCompanies(
      ['atlas.example/private'],
      new AbortController().signal,
      async () => {
        calls++;
        return [];
      }
    )
  ).rejects.toThrow();
  await expect(
    acquireCompanies(
      ['atlas.example', 'atlas.example'],
      new AbortController().signal,
      async () => {
        calls++;
        return [];
      }
    )
  ).rejects.toThrow();
  expect(calls).toBe(0);
});

it('removes email-bearing excerpts while retaining an inspectable capture outcome', async () => {
  const result = await acquireCompanies(
    ['atlas.example'],
    new AbortController().signal,
    async () => [
      {
        canonicalUrl: 'https://atlas.example/',
        retrievedAt: '2026-09-05T00:00:00.000Z',
        contentHash: 'a'.repeat(64),
        facts: ['Atlas builds tools.'],
        snippets: ['Contact person@atlas.example'],
      },
    ]
  );
  expect(JSON.stringify(result)).not.toContain('person@');
  expect(result.cases[0].pages[0].facts).toEqual(['Atlas builds tools.']);
  expect(result.captures[0]).toMatchObject({ filteredIdentityItems: 1 });
});
