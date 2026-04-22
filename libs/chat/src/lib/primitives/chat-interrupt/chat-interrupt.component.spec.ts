// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed, type WritableSignal } from '@angular/core';
import { getInterrupt } from './chat-interrupt.component';
import { mockChatAgent } from '../../testing/mock-chat-agent';
import type { ChatInterrupt } from '../../agent/chat-interrupt';

describe('getInterrupt()', () => {
  it('returns undefined when the runtime does not expose interrupt', () => {
    const agent = mockChatAgent(); // no withInterrupt → agent.interrupt absent
    expect(getInterrupt(agent)).toBeUndefined();
  });

  it('returns undefined when the interrupt signal holds undefined', () => {
    const agent = mockChatAgent({ withInterrupt: true });
    expect(getInterrupt(agent)).toBeUndefined();
  });

  it('returns the interrupt value when the signal holds one', () => {
    const ix: ChatInterrupt = { id: 'ix-1', value: { question: 'Confirm?' }, resumable: true };
    const agent = mockChatAgent({ withInterrupt: true });
    (agent.interrupt as WritableSignal<ChatInterrupt | undefined>).set(ix);
    expect(getInterrupt(agent)).toBe(ix);
  });
});

describe('ChatInterruptComponent — interrupt computed', () => {
  it('interrupt is undefined when agent does not expose interrupt', () => {
    const agent = mockChatAgent();
    const agent$ = signal(agent);
    const interrupt = computed(() => agent$().interrupt?.());
    expect(interrupt()).toBeUndefined();
  });

  it('interrupt reflects agent.interrupt value when present', () => {
    const ix: ChatInterrupt = { id: 'ix-1', value: { step: 'confirm' }, resumable: true };
    const agent = mockChatAgent({ withInterrupt: true });
    (agent.interrupt as WritableSignal<ChatInterrupt | undefined>).set(ix);
    const agent$ = signal(agent);
    const interrupt = computed(() => agent$().interrupt?.());
    expect(interrupt()).toBe(ix);
  });

  it('interrupt updates reactively when agent changes', () => {
    const noIx = mockChatAgent({ withInterrupt: true });
    const withIx = mockChatAgent({ withInterrupt: true });
    const ix: ChatInterrupt = { id: 'ix-2', value: { type: 'human_review' }, resumable: true };
    (withIx.interrupt as WritableSignal<ChatInterrupt | undefined>).set(ix);

    const agent$ = signal<ReturnType<typeof mockChatAgent>>(noIx);
    const interrupt = computed(() => agent$().interrupt?.());

    expect(interrupt()).toBeUndefined();
    agent$.set(withIx);
    expect(interrupt()).toBe(ix);
  });
});
