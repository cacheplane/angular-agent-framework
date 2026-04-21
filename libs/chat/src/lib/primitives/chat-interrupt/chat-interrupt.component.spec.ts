// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { getInterrupt } from './chat-interrupt.component';
import { createMockAgentRef } from '../../testing/mock-agent-ref';
import type { Interrupt } from '@cacheplane/langgraph';

describe('getInterrupt()', () => {
  it('returns undefined when no interrupt is present', () => {
    const mockRef = createMockAgentRef();
    expect(getInterrupt(mockRef)).toBeUndefined();
  });

  it('returns the interrupt value when present', () => {
    const mockInterrupt: Interrupt<any> = { value: { question: 'Confirm?' } } as any;
    const mockRef = createMockAgentRef();
    // Cast to access writable signal for test setup
    (mockRef.interrupt as ReturnType<typeof signal<Interrupt<any> | undefined>>).set(mockInterrupt);

    expect(getInterrupt(mockRef)).toBe(mockInterrupt);
  });
});

describe('ChatInterruptComponent — interrupt computed', () => {
  it('interrupt is undefined when ref has no interrupt', () => {
    const mockRef = createMockAgentRef();
    const ref$ = signal(mockRef);

    const interrupt = computed(() => ref$().interrupt());

    expect(interrupt()).toBeUndefined();
  });

  it('interrupt reflects ref.interrupt value when present', () => {
    const mockInterrupt: Interrupt<any> = { value: { step: 'confirm' } } as any;
    const mockRef = createMockAgentRef();
    (mockRef.interrupt as ReturnType<typeof signal<Interrupt<any> | undefined>>).set(mockInterrupt);

    const ref$ = signal(mockRef);
    const interrupt = computed(() => ref$().interrupt());

    expect(interrupt()).toBe(mockInterrupt);
  });

  it('interrupt updates reactively when ref changes', () => {
    const noInterruptRef = createMockAgentRef();
    const interruptRef = createMockAgentRef();
    const mockInterrupt: Interrupt<any> = { value: { type: 'human_review' } } as any;
    (interruptRef.interrupt as ReturnType<typeof signal<Interrupt<any> | undefined>>).set(mockInterrupt);

    const ref$ = signal(noInterruptRef);
    const interrupt = computed(() => ref$().interrupt());

    expect(interrupt()).toBeUndefined();
    ref$.set(interruptRef);
    expect(interrupt()).toBe(mockInterrupt);
  });
});
