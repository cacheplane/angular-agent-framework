// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { isTyping } from './chat-typing-indicator.component';
import { createMockAgentRef } from '../../testing/mock-agent-ref';

describe('isTyping()', () => {
  it('returns false when ref.isLoading is false', () => {
    const mockRef = createMockAgentRef({ isLoading: false });
    expect(isTyping(mockRef)).toBe(false);
  });

  it('returns true when ref.isLoading is true', () => {
    const mockRef = createMockAgentRef({ isLoading: true });
    expect(isTyping(mockRef)).toBe(true);
  });
});

describe('ChatTypingIndicatorComponent — visible computed', () => {
  it('visible is false when ref.isLoading is false', () => {
    const mockRef = createMockAgentRef({ isLoading: false });
    const ref$ = signal(mockRef);

    const visible = computed(() => ref$().isLoading());

    expect(visible()).toBe(false);
  });

  it('visible is true when ref.isLoading is true', () => {
    const mockRef = createMockAgentRef({ isLoading: true });
    const ref$ = signal(mockRef);

    const visible = computed(() => ref$().isLoading());

    expect(visible()).toBe(true);
  });

  it('visible updates reactively when ref changes', () => {
    const idleRef = createMockAgentRef({ isLoading: false });
    const loadingRef = createMockAgentRef({ isLoading: true });
    const ref$ = signal(idleRef);

    const visible = computed(() => ref$().isLoading());

    expect(visible()).toBe(false);
    ref$.set(loadingRef);
    expect(visible()).toBe(true);
  });
});
