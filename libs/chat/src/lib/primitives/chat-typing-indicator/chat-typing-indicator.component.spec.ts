// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { isTyping } from './chat-typing-indicator.component';
import { createMockStreamResourceRef } from '../../testing/mock-stream-resource-ref';

describe('isTyping()', () => {
  it('returns false when ref.isLoading is false', () => {
    const mockRef = createMockStreamResourceRef({ isLoading: false });
    expect(isTyping(mockRef)).toBe(false);
  });

  it('returns true when ref.isLoading is true', () => {
    const mockRef = createMockStreamResourceRef({ isLoading: true });
    expect(isTyping(mockRef)).toBe(true);
  });
});

describe('ChatTypingIndicatorComponent — visible computed', () => {
  it('visible is false when ref.isLoading is false', () => {
    const mockRef = createMockStreamResourceRef({ isLoading: false });
    const ref$ = signal(mockRef);

    const visible = computed(() => ref$().isLoading());

    expect(visible()).toBe(false);
  });

  it('visible is true when ref.isLoading is true', () => {
    const mockRef = createMockStreamResourceRef({ isLoading: true });
    const ref$ = signal(mockRef);

    const visible = computed(() => ref$().isLoading());

    expect(visible()).toBe(true);
  });

  it('visible updates reactively when ref changes', () => {
    const idleRef = createMockStreamResourceRef({ isLoading: false });
    const loadingRef = createMockStreamResourceRef({ isLoading: true });
    const ref$ = signal(idleRef);

    const visible = computed(() => ref$().isLoading());

    expect(visible()).toBe(false);
    ref$.set(loadingRef);
    expect(visible()).toBe(true);
  });
});
