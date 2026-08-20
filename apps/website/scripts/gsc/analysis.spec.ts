import { describe, expect, it } from 'vitest';
import {
  capList,
  describeInspectionCoverage,
  findStrikingDistance,
  findUnindexed,
  findZeroImpressionPages,
} from './analysis';

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
});

describe('findZeroImpressionPages', () => {
  it('lists sitemap URLs that earned no impressions in the window', () => {
    const result = findZeroImpressionPages(
      ['https://threadplane.ai/a', 'https://threadplane.ai/b'],
      [{ keys: ['https://threadplane.ai/a'], clicks: 1, impressions: 10, ctr: 0.1, position: 5 }],
    );
    expect(result).toEqual(['https://threadplane.ai/b']);
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
