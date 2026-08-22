import { describe, expect, it } from 'vitest';
import type { InspectionResult } from './api';
import {
  capList,
  describeInspectionCoverage,
  findCanonicalMismatches,
  findStrikingDistance,
  findUnindexed,
  findWeakCtr,
  findZeroImpressionPages,
  normalizeUrl,
} from './analysis';

/** A row with sane defaults, so each test states only the field it is about. */
function row(overrides: Partial<{ key: string; clicks: number; impressions: number; ctr: number; position: number }>) {
  return {
    keys: [overrides.key ?? 'q'],
    clicks: overrides.clicks ?? 0,
    impressions: overrides.impressions ?? 500,
    ctr: overrides.ctr ?? 0,
    position: overrides.position ?? 8,
  };
}

/** An inspection with sane defaults, so each test states only the field it is about. */
function inspection(overrides: Partial<InspectionResult>): InspectionResult {
  return {
    url: 'https://threadplane.ai/a',
    verdict: 'PASS',
    coverageState: 'Submitted and indexed',
    lastCrawlTime: null,
    robotsTxtState: 'ALLOWED',
    indexingState: 'INDEXING_ALLOWED',
    googleCanonical: null,
    userCanonical: null,
    ...overrides,
  };
}

const rows = [
  { keys: ['angular langgraph chat'], clicks: 0, impressions: 400, ctr: 0, position: 11.2 },
  { keys: ['threadplane'], clicks: 90, impressions: 100, ctr: 0.9, position: 1.1 },
  { keys: ['obscure long tail'], clicks: 0, impressions: 3, ctr: 0, position: 42 },
];

describe('findStrikingDistance', () => {
  it('returns rows ranking 5-20 with meaningful impressions, best opportunity first', () => {
    const result = findStrikingDistance(rows, { minImpressions: 50 });
    expect(result.map((r) => r.keys[0])).toEqual(['angular langgraph chat']);
  });

  it('orders surviving rows by descending impressions, not input order', () => {
    const result = findStrikingDistance(
      [
        row({ key: 'middle', impressions: 200 }),
        row({ key: 'smallest', impressions: 60 }),
        row({ key: 'biggest', impressions: 900 }),
      ],
      { minImpressions: 50 },
    );
    expect(result.map((r) => r.keys[0])).toEqual(['biggest', 'middle', 'smallest']);
  });

  it.each([
    ['position exactly 5 is included', { position: 5 }, true],
    ['position exactly 20 is included', { position: 20 }, true],
    ['position just above page one at 4.9 is excluded', { position: 4.9 }, false],
    ['position just past 20 at 20.1 is excluded', { position: 20.1 }, false],
    ['impressions exactly at the floor are included', { impressions: 50 }, true],
    ['impressions one below the floor are excluded', { impressions: 49 }, false],
  ])('%s', (_name, overrides, kept) => {
    const result = findStrikingDistance([row(overrides)], { minImpressions: 50 });
    expect(result).toHaveLength(kept ? 1 : 0);
  });
});

describe('findWeakCtr', () => {
  it('orders surviving rows by descending impressions', () => {
    const result = findWeakCtr(
      [
        row({ key: 'fewer', impressions: 150, ctr: 0.01, position: 3 }),
        row({ key: 'more', impressions: 800, ctr: 0.01, position: 3 }),
      ],
      { minImpressions: 100, maxCtr: 0.02 },
    );
    expect(result.map((r) => r.keys[0])).toEqual(['more', 'fewer']);
  });

  it.each([
    ['position exactly 10 is included', { position: 10, ctr: 0.01 }, true],
    ['position 10.1 is off page one and excluded', { position: 10.1, ctr: 0.01 }, false],
    ['impressions exactly at the floor are included', { impressions: 100, ctr: 0.01 }, true],
    ['impressions one below the floor are excluded', { impressions: 99, ctr: 0.01 }, false],
    ['ctr exactly at the ceiling is EXCLUDED — the bound is strict', { ctr: 0.02 }, false],
    ['ctr just under the ceiling is included', { ctr: 0.0199 }, true],
  ])('%s', (_name, overrides, kept) => {
    const result = findWeakCtr([row({ position: 3, impressions: 500, ...overrides })], {
      minImpressions: 100,
      maxCtr: 0.02,
    });
    expect(result).toHaveLength(kept ? 1 : 0);
  });
});

describe('findCanonicalMismatches', () => {
  it('flags a page Google canonicalized away from our declared canonical', () => {
    const result = findCanonicalMismatches([
      inspection({
        url: 'https://threadplane.ai/pricing',
        googleCanonical: 'https://threadplane.ai/plans',
        userCanonical: 'https://threadplane.ai/pricing',
      }),
    ]);
    expect(result.map((i) => i.url)).toEqual(['https://threadplane.ai/pricing']);
  });

  it.each([
    ['both canonicals absent', null, null],
    ['Google reports one but we declared none — deliberately NOT a mismatch', '/g', null],
    ['we declared one but Google reports none', null, '/u'],
    ['both present and in agreement', '/same', '/same'],
  ])('does not flag when %s', (_name, googleCanonical, userCanonical) => {
    expect(findCanonicalMismatches([inspection({ googleCanonical, userCanonical })])).toEqual([]);
  });
});

describe('normalizeUrl', () => {
  it.each([
    ['protocol differs', 'http://threadplane.ai/blog/foo', 'https://threadplane.ai/blog/foo'],
    ['host case differs', 'https://ThreadPlane.AI/blog/foo', 'https://threadplane.ai/blog/foo'],
    ['leading www differs', 'https://www.threadplane.ai/blog/foo', 'https://threadplane.ai/blog/foo'],
    ['trailing slash differs', 'https://threadplane.ai/blog/foo/', 'https://threadplane.ai/blog/foo'],
    ['a fragment is present', 'https://threadplane.ai/blog/foo#intro', 'https://threadplane.ai/blog/foo'],
    ['a query string is present', 'https://threadplane.ai/blog/foo?ref=x', 'https://threadplane.ai/blog/foo'],
  ])('treats two URLs as the same page when %s', (_name, a, b) => {
    expect(normalizeUrl(a)).toBe(normalizeUrl(b));
  });

  it('keeps genuinely different paths apart', () => {
    expect(normalizeUrl('https://threadplane.ai/a')).not.toBe(normalizeUrl('https://threadplane.ai/b'));
  });

  it('falls back to a textual cleanup instead of throwing on unparseable input', () => {
    expect(normalizeUrl('  not a url?ref=x  ')).toBe('not a url');
    expect(normalizeUrl('')).toBe('');
  });
});

describe('findZeroImpressionPages', () => {
  it('lists sitemap URLs that earned no impressions in the window', () => {
    const result = findZeroImpressionPages(
      ['https://threadplane.ai/a', 'https://threadplane.ai/b'],
      [{ keys: ['https://threadplane.ai/a'], clicks: 1, impressions: 10, ctr: 0.1, position: 5 }],
    );
    expect(result).toEqual(['https://threadplane.ai/b']);
  });

  it('does not report a page as invisible just because Search Console tagged the URL', () => {
    const result = findZeroImpressionPages(
      ['https://threadplane.ai/blog/foo'],
      [
        {
          keys: ['https://www.threadplane.ai/blog/foo/?ref=newsletter#top'],
          clicks: 4,
          impressions: 90,
          ctr: 0.044,
          position: 6,
        },
      ],
    );
    expect(result).toEqual([]);
  });
});

describe('findUnindexed', () => {
  it('flags inspections whose verdict is not PASS', () => {
    const result = findUnindexed([
      {
        url: 'https://threadplane.ai/a',
        verdict: 'PASS',
        coverageState: 'Submitted and indexed',
        lastCrawlTime: null,
        robotsTxtState: 'ALLOWED',
        indexingState: 'INDEXING_ALLOWED',
        googleCanonical: null,
        userCanonical: null,
      },
      {
        url: 'https://threadplane.ai/b',
        verdict: 'NEUTRAL',
        coverageState: 'Discovered - currently not indexed',
        lastCrawlTime: null,
        robotsTxtState: 'ALLOWED',
        indexingState: 'INDEXING_ALLOWED',
        googleCanonical: null,
        userCanonical: null,
      },
    ]);
    expect(result.map((r) => r.url)).toEqual(['https://threadplane.ai/b']);
  });
});

describe('describeInspectionCoverage', () => {
  it('reports a complete sweep when nothing failed', () => {
    expect(describeInspectionCoverage({ inspected: 42, failed: 0 })).toBe(
      'Coverage: complete — all 42 sitemap URLs inspected.',
    );
  });

  it('warns that counts are lower bounds when inspections failed', () => {
    const text = describeInspectionCoverage({ inspected: 8, failed: 2 });
    expect(text).toContain('PARTIAL');
    expect(text).toContain('2 of 10');
    expect(text).toContain('lower bound');
  });
});

describe('capList', () => {
  it('passes a short list through with nothing withheld', () => {
    expect(capList(['a', 'b'], 20)).toEqual({ shown: ['a', 'b'], remaining: 0 });
  });

  it('trims an overflowing list and counts the remainder', () => {
    const items = Array.from({ length: 23 }, (_, i) => `url-${i}`);
    const result = capList(items, 20);
    expect(result.shown).toHaveLength(20);
    expect(result.shown[19]).toBe('url-19');
    expect(result.remaining).toBe(3);
  });
});
