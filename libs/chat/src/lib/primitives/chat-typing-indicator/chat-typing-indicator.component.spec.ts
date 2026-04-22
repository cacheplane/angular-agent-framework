// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { isTyping } from './chat-typing-indicator.component';
import { mockChatAgent } from '../../testing/mock-chat-agent';
import type { ChatMessage } from '../../agent';

describe('isTyping()', () => {
  it('returns false when agent.isLoading is false', () => {
    const agent = mockChatAgent({ isLoading: false });
    expect(isTyping(agent)).toBe(false);
  });

  it('returns true when agent.isLoading is true and messages is empty', () => {
    const agent = mockChatAgent({ isLoading: true, messages: [] });
    expect(isTyping(agent)).toBe(true);
  });

  it('returns true when loading and last message is user', () => {
    const agent = mockChatAgent({
      isLoading: true,
      messages: [{ id: '1', role: 'user', content: 'hi' }],
    });
    expect(isTyping(agent)).toBe(true);
  });

  it('returns false when loading and last message is non-empty assistant', () => {
    const agent = mockChatAgent({
      isLoading: true,
      messages: [
        { id: '1', role: 'user', content: 'hi' },
        { id: '2', role: 'assistant', content: 'hello there' },
      ],
    });
    expect(isTyping(agent)).toBe(false);
  });

  it('returns true when loading and last message is empty-content assistant', () => {
    const agent = mockChatAgent({
      isLoading: true,
      messages: [
        { id: '1', role: 'user', content: 'hi' },
        { id: '2', role: 'assistant', content: '' },
      ],
    });
    expect(isTyping(agent)).toBe(true);
  });

  it('returns true when loading and last assistant message has empty block array', () => {
    const agent = mockChatAgent({
      isLoading: true,
      messages: [
        { id: '1', role: 'user', content: 'hi' },
        { id: '2', role: 'assistant', content: [] },
      ],
    });
    expect(isTyping(agent)).toBe(true);
  });
});

describe('ChatTypingIndicatorComponent — visible computed', () => {
  it('visible is false when agent.isLoading is false', () => {
    const agent = mockChatAgent({ isLoading: false });
    const agent$ = signal(agent);

    const visible = computed(() => isTyping(agent$()));

    expect(visible()).toBe(false);
  });

  it('visible is true when agent.isLoading is true and no messages', () => {
    const agent = mockChatAgent({ isLoading: true, messages: [] });
    const agent$ = signal(agent);

    const visible = computed(() => isTyping(agent$()));

    expect(visible()).toBe(true);
  });

  it('visible updates reactively when agent changes', () => {
    const idleAgent = mockChatAgent({ isLoading: false });
    const loadingAgent = mockChatAgent({
      isLoading: true,
      messages: [{ id: '1', role: 'user', content: 'hi' }],
    });
    const agent$ = signal(idleAgent);

    const visible = computed(() => isTyping(agent$()));

    expect(visible()).toBe(false);
    agent$.set(loadingAgent);
    expect(visible()).toBe(true);
  });
});
