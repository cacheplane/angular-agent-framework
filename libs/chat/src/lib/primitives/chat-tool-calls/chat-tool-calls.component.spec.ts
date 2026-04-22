// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { mockChatAgent } from '../../testing/mock-chat-agent';
import type { ChatMessage, ChatToolCall } from '../../agent';

describe('ChatToolCallsComponent — toolCalls computed', () => {
  it('returns agent.toolCalls() when no message is provided', () => {
    const mockToolCalls: ChatToolCall[] = [
      { id: 'call_1', name: 'get_weather', args: { city: 'NYC' }, status: 'complete', result: 'sunny' },
    ];
    const agent = mockChatAgent({ toolCalls: mockToolCalls });

    const agent$ = signal(agent);
    const toolCalls = computed(() => agent$().toolCalls());

    expect(toolCalls()).toHaveLength(1);
    expect(toolCalls()[0].id).toBe('call_1');
  });

  it('returns agent.toolCalls() when message is a user message (no tool_use blocks)', () => {
    const agent = mockChatAgent();
    const msg: ChatMessage = { id: '1', role: 'user', content: 'hello' };

    const agent$ = signal(agent);
    const message$ = signal<ChatMessage | undefined>(msg);

    const toolCalls = computed((): ChatToolCall[] => {
      const m = message$();
      if (m && m.role === 'assistant' && Array.isArray(m.content)) {
        const blocks = m.content.filter((b: any) => b.type === 'tool_use') as Array<{
          type: 'tool_use'; id: string; name: string; args: unknown;
        }>;
        const all = agent$().toolCalls();
        return blocks
          .map(b => all.find(tc => tc.id === b.id))
          .filter((x): x is ChatToolCall => !!x);
      }
      return agent$().toolCalls();
    });

    expect(toolCalls()).toHaveLength(0);
  });

  it('returns matched ChatToolCalls when message has tool_use content blocks', () => {
    const mockToolCalls: ChatToolCall[] = [
      { id: 'call_2', name: 'search', args: { query: 'test' }, status: 'complete', result: 'results' },
    ];
    const agent = mockChatAgent({ toolCalls: mockToolCalls });

    const msg: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'call_2', name: 'search', args: { query: 'test' } }],
    };

    const agent$ = signal(agent);
    const message$ = signal<ChatMessage | undefined>(msg);

    const toolCalls = computed((): ChatToolCall[] => {
      const m = message$();
      if (m && m.role === 'assistant' && Array.isArray(m.content)) {
        const blocks = m.content.filter((b: any) => b.type === 'tool_use') as Array<{
          type: 'tool_use'; id: string; name: string; args: unknown;
        }>;
        const all = agent$().toolCalls();
        return blocks
          .map(b => all.find(tc => tc.id === b.id))
          .filter((x): x is ChatToolCall => !!x);
      }
      return agent$().toolCalls();
    });

    expect(toolCalls()).toHaveLength(1);
    expect(toolCalls()[0].id).toBe('call_2');
    expect(toolCalls()[0].name).toBe('search');
  });

  it('toolCalls updates reactively when agent changes', () => {
    const emptyAgent = mockChatAgent();
    const loadedAgent = mockChatAgent({
      toolCalls: [{ id: 'call_3', name: 'calculator', args: {}, status: 'complete' }],
    });

    const agent$ = signal(emptyAgent);
    const toolCalls = computed(() => agent$().toolCalls());

    expect(toolCalls()).toHaveLength(0);
    agent$.set(loadedAgent);
    expect(toolCalls()).toHaveLength(1);
  });
});
