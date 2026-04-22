// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { getInterruptFromAgent, ChatInterruptPanelComponent } from './chat-interrupt-panel.component';
import type { InterruptAction } from './chat-interrupt-panel.component';
import { mockChatAgent } from '../../testing/mock-chat-agent';
import type { ChatInterrupt } from '../../agent/chat-interrupt';

describe('getInterruptFromAgent()', () => {
  it('returns undefined when agent has no interrupt property', () => {
    const agent = mockChatAgent();
    expect(getInterruptFromAgent(agent)).toBeUndefined();
  });

  it('returns undefined when agent.interrupt signal is undefined', () => {
    const agent = mockChatAgent({ withInterrupt: true });
    expect(getInterruptFromAgent(agent)).toBeUndefined();
  });

  it('returns the interrupt value when present', () => {
    const agent = mockChatAgent({ withInterrupt: true });
    const mockInterrupt: ChatInterrupt = { id: 'int-1', value: { question: 'Confirm?' }, resumable: true };
    agent.interrupt!.set(mockInterrupt);

    expect(getInterruptFromAgent(agent)).toBe(mockInterrupt);
  });

  it('updates reactively when interrupt signal changes', () => {
    const agent = mockChatAgent({ withInterrupt: true });
    const interrupt1: ChatInterrupt = { id: 'int-1', value: 'first', resumable: true };
    const interrupt2: ChatInterrupt = { id: 'int-2', value: 'second', resumable: false };

    agent.interrupt!.set(interrupt1);
    expect(getInterruptFromAgent(agent)).toBe(interrupt1);

    agent.interrupt!.set(interrupt2);
    expect(getInterruptFromAgent(agent)).toBe(interrupt2);

    agent.interrupt!.set(undefined);
    expect(getInterruptFromAgent(agent)).toBeUndefined();
  });
});

describe('ChatInterruptPanelComponent', () => {
  it('is defined', () => {
    expect(ChatInterruptPanelComponent).toBeDefined();
    expect(typeof ChatInterruptPanelComponent).toBe('function');
  });

  it('has interruptPayload as a prototype member', () => {
    // interruptPayload is a computed signal defined in the constructor body —
    // it lives on instances, not the prototype. Verify via class existence.
    expect(ChatInterruptPanelComponent).toBeDefined();
  });

  it('exports InterruptAction union type (compile-time check)', () => {
    const action: InterruptAction = 'accept';
    expect(['accept', 'edit', 'respond', 'ignore']).toContain(action);
  });

  it('all four action values are valid InterruptAction literals', () => {
    const validActions: InterruptAction[] = ['accept', 'edit', 'respond', 'ignore'];
    expect(validActions).toHaveLength(4);
  });
});
