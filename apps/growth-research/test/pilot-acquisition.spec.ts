import { expect, it } from 'vitest';
import { acquireCompanies } from '../src/pilot/acquisition.js';

it('keeps partial, empty, and failed company captures visible', async () => {
  const result = await acquireCompanies(
    ['atlas.example', 'beacon.example', 'coral.example'],
    new AbortController().signal,
    async (domain) => {
      if (domain === 'coral.example')
        throw new Error('secret provider details');
      if (domain === 'beacon.example') return [];
      return [
        {
          canonicalUrl: 'https://atlas.example/',
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
    'partial',
    'empty',
    'failed',
  ]);
  expect(JSON.stringify(result)).not.toContain('secret provider');
  expect(result.captures[0].unavailablePaths).toEqual(['/about', '/pricing']);
});

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
