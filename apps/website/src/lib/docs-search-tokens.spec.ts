import { describe, expect, it } from 'vitest';
import { searchTokens } from './docs-search-tokens';

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
