// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { mockAgent } from '../../testing/mock-agent';
import type { Message, ToolCall } from '../../agent';
import { resolveMessageToolCalls } from './resolve-message-tool-calls';

describe('resolveMessageToolCalls', () => {
  const calls: ToolCall[] = [
    { id: 'a', name: 'get_weather', args: { city: 'NYC' }, status: 'complete', result: 'sunny' },
    { id: 'b', name: 'search', args: {}, status: 'running' },
  ];

  it('returns the global list when no message is provided', () => {
    const agent = mockAgent({ toolCalls: calls });
    expect(resolveMessageToolCalls(agent, undefined)).toHaveLength(2);
  });

  it('returns the global list for a user message (non-assistant falls through)', () => {
    const agent = mockAgent({ toolCalls: calls });
    const msg: Message = { id: '1', role: 'user', content: 'hello' };
    expect(resolveMessageToolCalls(agent, msg)).toHaveLength(2);
  });

  it('scopes by toolCallIds on an assistant message', () => {
    const agent = mockAgent({ toolCalls: calls });
    const msg: Message = { id: '2', role: 'assistant', content: '', toolCallIds: ['b'] };
    const out = resolveMessageToolCalls(agent, msg);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b');
  });

  it('scopes by tool_use content blocks on an assistant message', () => {
    const agent = mockAgent({ toolCalls: calls });
    const msg: Message = {
      id: '3', role: 'assistant',
      content: [{ type: 'tool_use', id: 'a', name: 'get_weather', args: { city: 'NYC' } }],
    };
    const out = resolveMessageToolCalls(agent, msg);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
  });

  it('returns [] for an assistant message with no tool-call linkage', () => {
    const agent = mockAgent({ toolCalls: calls });
    const msg: Message = { id: '4', role: 'assistant', content: 'just text, no tools' };
    expect(resolveMessageToolCalls(agent, msg)).toEqual([]);
  });
});
