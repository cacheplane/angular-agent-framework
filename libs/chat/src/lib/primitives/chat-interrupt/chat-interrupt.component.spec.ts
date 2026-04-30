// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { signal, computed, type WritableSignal } from '@angular/core';
import { getInterrupt } from './chat-interrupt.component';
import { mockAgent } from '../../testing/mock-agent';
import type { AgentInterrupt } from '../../agent/agent-interrupt';

describe('getInterrupt()', () => {
  it('returns undefined when the runtime does not expose interrupt', () => {
    const agent = mockAgent(); // no withInterrupt → agent.interrupt absent
    expect(getInterrupt(agent)).toBeUndefined();
  });

  it('returns undefined when the interrupt signal holds undefined', () => {
    const agent = mockAgent({ withInterrupt: true });
    expect(getInterrupt(agent)).toBeUndefined();
  });

  it('returns the interrupt value when the signal holds one', () => {
    const ix: AgentInterrupt = { id: 'ix-1', value: { question: 'Confirm?' }, resumable: true };
    const agent = mockAgent({ withInterrupt: true });
    (agent.interrupt as WritableSignal<AgentInterrupt | undefined>).set(ix);
    expect(getInterrupt(agent)).toBe(ix);
  });
});

describe('AgentInterruptComponent — interrupt computed', () => {
  it('interrupt is undefined when agent does not expose interrupt', () => {
    const agent = mockAgent();
    const agent$ = signal(agent);
    const interrupt = computed(() => agent$().interrupt?.());
    expect(interrupt()).toBeUndefined();
  });

  it('interrupt reflects agent.interrupt value when present', () => {
    const ix: AgentInterrupt = { id: 'ix-1', value: { step: 'confirm' }, resumable: true };
    const agent = mockAgent({ withInterrupt: true });
    (agent.interrupt as WritableSignal<AgentInterrupt | undefined>).set(ix);
    const agent$ = signal(agent);
    const interrupt = computed(() => agent$().interrupt?.());
    expect(interrupt()).toBe(ix);
  });

  it('interrupt updates reactively when agent changes', () => {
    const noIx = mockAgent({ withInterrupt: true });
    const withIx = mockAgent({ withInterrupt: true });
    const ix: AgentInterrupt = { id: 'ix-2', value: { type: 'human_review' }, resumable: true };
    (withIx.interrupt as WritableSignal<AgentInterrupt | undefined>).set(ix);

    const agent$ = signal<ReturnType<typeof mockAgent>>(noIx);
    const interrupt = computed(() => agent$().interrupt?.());

    expect(interrupt()).toBeUndefined();
    agent$.set(withIx);
    expect(interrupt()).toBe(ix);
  });
});
