// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal } from '@angular/core';
import type { Agent } from './agent';

describe('Agent interface', () => {
  it('accepts a minimal implementation without optional capabilities', () => {
    const agent: Agent = {
      messages: signal([]),
      status: signal('idle'),
      isLoading: signal(false),
      error: signal(null),
      toolCalls: signal([]),
      state: signal({}),
      submit: async () => Promise.resolve(),
      stop: async () => Promise.resolve(),
    };
    expect(agent.status()).toBe('idle');
  });

  it('accepts an implementation with interrupts and subagents', () => {
    const agent: Agent = {
      messages: signal([]),
      status: signal('idle'),
      isLoading: signal(false),
      error: signal(null),
      toolCalls: signal([]),
      state: signal({}),
      interrupt: signal(undefined),
      subagents: signal(new Map()),
      submit: async () => Promise.resolve(),
      stop: async () => Promise.resolve(),
    };
    expect(agent.interrupt?.()).toBeUndefined();
  });
});
