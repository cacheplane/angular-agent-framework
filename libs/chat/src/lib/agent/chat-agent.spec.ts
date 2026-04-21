import { signal } from '@angular/core';
import type { ChatAgent } from './chat-agent';

describe('ChatAgent interface', () => {
  it('accepts a minimal implementation without optional capabilities', () => {
    const agent: ChatAgent = {
      messages: signal([]),
      status: signal('idle'),
      isLoading: signal(false),
      error: signal(null),
      toolCalls: signal([]),
      state: signal({}),
      submit: async () => {},
      stop: async () => {},
    };
    expect(agent.status()).toBe('idle');
  });

  it('accepts an implementation with interrupts and subagents', () => {
    const agent: ChatAgent = {
      messages: signal([]),
      status: signal('idle'),
      isLoading: signal(false),
      error: signal(null),
      toolCalls: signal([]),
      state: signal({}),
      interrupt: signal(undefined),
      subagents: signal(new Map()),
      submit: async () => {},
      stop: async () => {},
    };
    expect(agent.interrupt?.()).toBeUndefined();
  });
});
