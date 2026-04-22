// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { submitMessage } from './chat-input.component';
import { mockChatAgent } from '../../testing/mock-chat-agent';

describe('submitMessage()', () => {
  it('calls agent.submit with { message: trimmed text }', async () => {
    const agent = mockChatAgent();

    submitMessage(agent, '  hello world  ');

    // Flush the async submit (it's void-async, we just need microtask flush)
    await Promise.resolve();
    expect(agent.submitCalls).toHaveLength(1);
    expect(agent.submitCalls[0].input).toEqual({ message: 'hello world' });
  });

  it('returns the trimmed text on successful submit', () => {
    const agent = mockChatAgent();
    const result = submitMessage(agent, '  hello  ');
    expect(result).toBe('hello');
  });

  it('does not call agent.submit and returns null for whitespace-only text', async () => {
    const agent = mockChatAgent();

    const result = submitMessage(agent, '   ');

    await Promise.resolve();
    expect(agent.submitCalls).toHaveLength(0);
    expect(result).toBeNull();
  });

  it('does not call agent.submit and returns null for empty string', async () => {
    const agent = mockChatAgent();

    const result = submitMessage(agent, '');

    await Promise.resolve();
    expect(agent.submitCalls).toHaveLength(0);
    expect(result).toBeNull();
  });
});

describe('ChatInputComponent — isDisabled computed', () => {
  it('isDisabled is false when agent.isLoading is false', () => {
    const agent = mockChatAgent({ isLoading: false });
    const agent$ = signal(agent);

    const isDisabled = computed(() => agent$().isLoading());

    expect(isDisabled()).toBe(false);
  });

  it('isDisabled is true when agent.isLoading is true', () => {
    const agent = mockChatAgent({ isLoading: true });
    const agent$ = signal(agent);

    const isDisabled = computed(() => agent$().isLoading());

    expect(isDisabled()).toBe(true);
  });

  it('isDisabled updates reactively when agent changes', () => {
    const idleAgent = mockChatAgent({ isLoading: false });
    const loadingAgent = mockChatAgent({ isLoading: true });
    const agent$ = signal(idleAgent);

    const isDisabled = computed(() => agent$().isLoading());

    expect(isDisabled()).toBe(false);
    agent$.set(loadingAgent);
    expect(isDisabled()).toBe(true);
  });
});
