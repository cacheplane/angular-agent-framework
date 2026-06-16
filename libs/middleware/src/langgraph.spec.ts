// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { clientToolSpecs, clientToolNames } from './langgraph/middleware';

const WEATHER = { name: 'get_weather', description: 'Weather', parameters: { type: 'object' } };

describe('clientToolSpecs', () => {
  it('wraps each catalog entry as an OpenAI function tool', () => {
    expect(clientToolSpecs({ messages: [], tools: [WEATHER] })).toEqual([
      { type: 'function', function: { name: 'get_weather', description: 'Weather', parameters: { type: 'object' } } },
    ]);
  });
  it('falls back to client_tools when tools is absent', () => {
    expect(clientToolSpecs({ messages: [], client_tools: [WEATHER] })).toHaveLength(1);
  });
  it('defaults missing description/parameters and drops nameless entries', () => {
    const specs = clientToolSpecs({ messages: [], tools: [{ name: 'x' } as never, { description: 'no name' } as never] });
    expect(specs).toEqual([{ type: 'function', function: { name: 'x', description: '', parameters: {} } }]);
  });
  it('returns [] for empty state', () => {
    expect(clientToolSpecs({ messages: [] })).toEqual([]);
  });
});

describe('clientToolNames', () => {
  it('returns the set of catalog names', () => {
    expect(clientToolNames({ messages: [], tools: [WEATHER] })).toEqual(new Set(['get_weather']));
  });
});
