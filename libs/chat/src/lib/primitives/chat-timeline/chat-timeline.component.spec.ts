// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { createMockAgentRef } from '../../testing/mock-agent-ref';
import type { ThreadState } from '@cacheplane/langgraph';

const makeState = (id: string): ThreadState<any> =>
  ({ checkpoint_id: id, values: {}, next: [], metadata: {} } as any);

describe('ChatTimelineComponent — history computed', () => {
  it('returns empty array when ref has no history', () => {
    const mockRef = createMockAgentRef();
    const ref$ = signal(mockRef);

    const history = computed(() => ref$().history());

    expect(history()).toHaveLength(0);
  });

  it('returns history states from ref', () => {
    const states = [makeState('cp-1'), makeState('cp-2')];
    const mockRef = createMockAgentRef();
    (mockRef.history as ReturnType<typeof signal<ThreadState<any>[]>>).set(states);

    const ref$ = signal(mockRef);
    const history = computed(() => ref$().history());

    expect(history()).toHaveLength(2);
    expect(history()[0]).toBe(states[0]);
    expect(history()[1]).toBe(states[1]);
  });

  it('history updates reactively when ref changes', () => {
    const emptyRef = createMockAgentRef();
    const loadedRef = createMockAgentRef();
    const states = [makeState('cp-3')];
    (loadedRef.history as ReturnType<typeof signal<ThreadState<any>[]>>).set(states);

    const ref$ = signal(emptyRef);
    const history = computed(() => ref$().history());

    expect(history()).toHaveLength(0);
    ref$.set(loadedRef);
    expect(history()).toHaveLength(1);
    expect(history()[0]).toBe(states[0]);
  });

  it('history updates reactively when ref.history signal changes', () => {
    const mockRef = createMockAgentRef();
    const ref$ = signal(mockRef);
    const history = computed(() => ref$().history());

    expect(history()).toHaveLength(0);

    const states = [makeState('cp-4'), makeState('cp-5')];
    (mockRef.history as ReturnType<typeof signal<ThreadState<any>[]>>).set(states);

    expect(history()).toHaveLength(2);
  });
});
