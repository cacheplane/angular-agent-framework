import { describe, expect, it } from 'vitest';
import { SEARCH_STOP_WORDS, searchTokens } from './docs-search-tokens';

describe('SEARCH_STOP_WORDS', () => {
  it('pins the exact list, because both sides of search depend on it', () => {
    // The tokenizer is shared so the client's instant matcher and the server
    // route agree on what a query means. Quietly adding or removing a word
    // changes every query on both sides identically, so no behavioural test
    // elsewhere would fail — this is the only thing that catches it.
    expect([...SEARCH_STOP_WORDS].sort()).toEqual([
      'a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with',
    ]);
  });
});

describe('searchTokens', () => {
  it('lowercases and splits on non-token characters', () => {
    expect(searchTokens('Streaming Tool Calls')).toEqual(['streaming', 'tool', 'calls']);
  });

  it('keeps the characters that appear in package and API names', () => {
    // @, . and - are token characters so `@threadplane/ag-ui` survives usefully.
    expect(searchTokens('@threadplane/ag-ui')).toEqual(['@threadplane', 'ag-ui']);
  });

  it('drops stop words so "the agent" searches for "agent"', () => {
    expect(searchTokens('the agent')).toEqual(['agent']);
  });

  it('returns nothing for a query that is only stop words', () => {
    expect(searchTokens('of the')).toEqual([]);
  });
});
