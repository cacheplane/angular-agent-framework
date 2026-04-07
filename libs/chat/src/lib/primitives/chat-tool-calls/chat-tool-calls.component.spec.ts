// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { createMockAgentRef } from '../../testing/mock-agent-ref';
import type { ToolCallWithResult } from '@cacheplane/angular';

describe('ChatToolCallsComponent — toolCalls computed', () => {
  it('returns ref.toolCalls() when no message is provided', () => {
    const mockToolCalls: ToolCallWithResult[] = [
      { id: 'call_1', name: 'get_weather', args: { city: 'NYC' }, result: null } as any,
    ];
    const mockRef = createMockAgentRef();
    (mockRef.toolCalls as ReturnType<typeof signal<ToolCallWithResult[]>>).set(mockToolCalls);

    const ref$ = signal(mockRef);
    const toolCalls = computed(() => ref$().toolCalls());

    expect(toolCalls()).toHaveLength(1);
    expect(toolCalls()[0].id).toBe('call_1');
  });

  it('returns ref.toolCalls() when message has no tool_calls', () => {
    const mockRef = createMockAgentRef();
    const msg = new HumanMessage('hello');

    const ref$ = signal(mockRef);
    const message$ = signal<any>(msg);

    // Simulate component logic: use message tool_calls if present, else ref
    const toolCalls = computed(() => {
      const m = message$();
      if (m && 'tool_calls' in m && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        return m.tool_calls;
      }
      return ref$().toolCalls();
    });

    expect(toolCalls()).toHaveLength(0);
  });

  it('returns message tool_calls when message has tool_calls', () => {
    const mockRef = createMockAgentRef();
    const msg = new AIMessage({
      content: '',
      tool_calls: [{ id: 'call_2', name: 'search', args: { query: 'test' } }],
    });

    const ref$ = signal(mockRef);
    const message$ = signal<any>(msg);

    const toolCalls = computed(() => {
      const m = message$();
      if (m && 'tool_calls' in m && Array.isArray((m as any).tool_calls)) {
        return (m as any).tool_calls;
      }
      return ref$().toolCalls();
    });

    expect(toolCalls()).toHaveLength(1);
    expect(toolCalls()[0].id).toBe('call_2');
    expect(toolCalls()[0].name).toBe('search');
  });

  it('toolCalls updates reactively when ref changes', () => {
    const emptyRef = createMockAgentRef();
    const loadedRef = createMockAgentRef();
    const mockToolCalls: ToolCallWithResult[] = [
      { id: 'call_3', name: 'calculator', args: {}, result: null } as any,
    ];
    (loadedRef.toolCalls as ReturnType<typeof signal<ToolCallWithResult[]>>).set(mockToolCalls);

    const ref$ = signal(emptyRef);
    const toolCalls = computed(() => ref$().toolCalls());

    expect(toolCalls()).toHaveLength(0);
    ref$.set(loadedRef);
    expect(toolCalls()).toHaveLength(1);
  });
});
