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

import { lastMessage, hasClientToolCall, hasServerToolCall } from './langgraph/middleware';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

const stateWith = (toolCalls: { name: string }[]) => ({
  messages: [new HumanMessage('hi'), new AIMessage({ content: '', tool_calls: toolCalls.map((c) => ({ name: c.name, args: {}, id: c.name })) })],
  tools: [{ name: 'get_weather', description: '', parameters: {} }],
});

describe('lastMessage', () => {
  it('returns the last message or undefined', () => {
    expect(lastMessage({ messages: [] })).toBeUndefined();
    expect(lastMessage({ messages: [new HumanMessage('a'), new HumanMessage('b')] })?.content).toBe('b');
  });
});

describe('hasClientToolCall', () => {
  it('true when the last AI message calls a client tool', () => {
    expect(hasClientToolCall(stateWith([{ name: 'get_weather' }]))).toBe(true);
  });
  it('false when the last AI message calls only non-client tools', () => {
    expect(hasClientToolCall(stateWith([{ name: 'search' }]))).toBe(false);
  });
  it('false when there are no tool calls', () => {
    expect(hasClientToolCall(stateWith([]))).toBe(false);
  });
});

describe('hasServerToolCall', () => {
  it('true when a call name is in serverToolNames', () => {
    expect(hasServerToolCall(stateWith([{ name: 'search' }]), ['search'])).toBe(true);
  });
  it('true when a call name is unknown (not a client tool)', () => {
    expect(hasServerToolCall(stateWith([{ name: 'mystery' }]), [])).toBe(true);
  });
  it('false when the only call is a known client tool', () => {
    expect(hasServerToolCall(stateWith([{ name: 'get_weather' }]), [])).toBe(false);
  });
});
