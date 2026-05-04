// libs/langgraph/src/lib/internals/extract-citations.spec.ts
// SPDX-License-Identifier: MIT
import { extractCitations } from './extract-citations';

describe('extractCitations', () => {
  it('returns undefined when no citations or sources', () => {
    expect(extractCitations({ additional_kwargs: {} })).toBeUndefined();
    expect(extractCitations({})).toBeUndefined();
  });

  it('reads additional_kwargs.citations', () => {
    const result = extractCitations({
      additional_kwargs: { citations: [{ id: 'a', title: 'Title A', url: 'https://a' }] },
    });
    expect(result).toEqual([{ id: 'a', index: 1, title: 'Title A', url: 'https://a' }]);
  });

  it('falls back to additional_kwargs.sources', () => {
    const result = extractCitations({
      additional_kwargs: { sources: [{ id: 'b', title: 'B', url: 'https://b' }] },
    });
    expect(result).toEqual([{ id: 'b', index: 1, title: 'B', url: 'https://b' }]);
  });

  it('handles string entries (URL only)', () => {
    expect(extractCitations({ additional_kwargs: { citations: ['https://x'] } }))
      .toEqual([{ id: 'c1', index: 1, url: 'https://x' }]);
  });

  it('coerces key spellings (href/source, name, content/excerpt)', () => {
    expect(extractCitations({
      additional_kwargs: {
        citations: [
          { name: 'N', href: 'https://h', content: 'C' },
          { name: 'O', source: 'https://s', excerpt: 'E' },
        ],
      },
    })).toEqual([
      { id: 'c1', index: 1, title: 'N', url: 'https://h', snippet: 'C' },
      { id: 'c2', index: 2, title: 'O', url: 'https://s', snippet: 'E' },
    ]);
  });

  it('preserves explicit index when provided', () => {
    expect(extractCitations({
      additional_kwargs: { citations: [{ id: 'a', index: 5, title: 'A' }] },
    })).toEqual([{ id: 'a', index: 5, title: 'A' }]);
  });

  it('returns undefined for empty array', () => {
    expect(extractCitations({ additional_kwargs: { citations: [] } })).toBeUndefined();
  });
});
