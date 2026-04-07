// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { signal, computed } from '@angular/core';
import { submitMessage } from './chat-input.component';
import { createMockAgentRef } from '../../testing/mock-agent-ref';

describe('submitMessage()', () => {
  it('calls ref.submit with a human message containing the trimmed text', () => {
    const mockRef = createMockAgentRef();
    const submitSpy = vi.spyOn(mockRef, 'submit');

    submitMessage(mockRef, '  hello world  ');

    expect(submitSpy).toHaveBeenCalledOnce();
    const args = submitSpy.mock.calls[0][0] as { messages: Array<{ role: string; content: string }> };
    expect(args.messages).toHaveLength(1);
    expect(args.messages[0].role).toBe('human');
    expect(args.messages[0].content).toBe('hello world');
  });

  it('returns the trimmed text on successful submit', () => {
    const mockRef = createMockAgentRef();
    const result = submitMessage(mockRef, '  hello  ');
    expect(result).toBe('hello');
  });

  it('does not call ref.submit and returns null for whitespace-only text', () => {
    const mockRef = createMockAgentRef();
    const submitSpy = vi.spyOn(mockRef, 'submit');

    const result = submitMessage(mockRef, '   ');

    expect(submitSpy).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('does not call ref.submit and returns null for empty string', () => {
    const mockRef = createMockAgentRef();
    const submitSpy = vi.spyOn(mockRef, 'submit');

    const result = submitMessage(mockRef, '');

    expect(submitSpy).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

describe('ChatInputComponent — isDisabled computed', () => {
  it('isDisabled is false when ref.isLoading is false', () => {
    const mockRef = createMockAgentRef({ isLoading: false });
    const ref$ = signal(mockRef);

    const isDisabled = computed(() => ref$().isLoading());

    expect(isDisabled()).toBe(false);
  });

  it('isDisabled is true when ref.isLoading is true', () => {
    const mockRef = createMockAgentRef({ isLoading: true });
    const ref$ = signal(mockRef);

    const isDisabled = computed(() => ref$().isLoading());

    expect(isDisabled()).toBe(true);
  });

  it('isDisabled updates reactively when ref changes', () => {
    const idleRef = createMockAgentRef({ isLoading: false });
    const loadingRef = createMockAgentRef({ isLoading: true });
    const ref$ = signal(idleRef);

    const isDisabled = computed(() => ref$().isLoading());

    expect(isDisabled()).toBe(false);
    ref$.set(loadingRef);
    expect(isDisabled()).toBe(true);
  });
});
