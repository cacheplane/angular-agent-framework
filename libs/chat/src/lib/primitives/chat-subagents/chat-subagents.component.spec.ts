// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { createMockAgentRef } from '../../testing/mock-agent-ref';
import type { SubagentStreamRef } from '@cacheplane/angular';

describe('ChatSubagentsComponent — activeSubagents computed', () => {
  it('returns empty array when no active subagents', () => {
    const mockRef = createMockAgentRef();
    const ref$ = signal(mockRef);

    const activeSubagents = computed(() => ref$().activeSubagents());

    expect(activeSubagents()).toHaveLength(0);
  });

  it('returns active subagents from ref', () => {
    const mockSubagent: SubagentStreamRef = {
      id: 'sub_1',
      isLoading: signal(true),
      messages: signal([]),
      status: signal('running' as any),
      error: signal(null),
    } as any;

    const mockRef = createMockAgentRef();
    (mockRef.activeSubagents as ReturnType<typeof signal<SubagentStreamRef[]>>).set([mockSubagent]);

    const ref$ = signal(mockRef);
    const activeSubagents = computed(() => ref$().activeSubagents());

    expect(activeSubagents()).toHaveLength(1);
    expect(activeSubagents()[0]).toBe(mockSubagent);
  });

  it('activeSubagents updates reactively when ref changes', () => {
    const emptyRef = createMockAgentRef();
    const loadedRef = createMockAgentRef();
    const mockSubagent: SubagentStreamRef = {
      id: 'sub_2',
      isLoading: signal(false),
      messages: signal([]),
      status: signal('done' as any),
      error: signal(null),
    } as any;
    (loadedRef.activeSubagents as ReturnType<typeof signal<SubagentStreamRef[]>>).set([mockSubagent]);

    const ref$ = signal(emptyRef);
    const activeSubagents = computed(() => ref$().activeSubagents());

    expect(activeSubagents()).toHaveLength(0);
    ref$.set(loadedRef);
    expect(activeSubagents()).toHaveLength(1);
  });
});
