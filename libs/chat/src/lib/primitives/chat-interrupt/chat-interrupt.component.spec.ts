// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { getInterrupt } from './chat-interrupt.component';
import { createMockStreamResourceRef } from '../../testing/mock-stream-resource-ref';
import type { Interrupt } from '@cacheplane/stream-resource';

describe('getInterrupt()', () => {
  it('returns undefined when no interrupt is present', () => {
    const mockRef = createMockStreamResourceRef();
    expect(getInterrupt(mockRef)).toBeUndefined();
  });

  it('returns the interrupt value when present', () => {
    const mockInterrupt: Interrupt<any> = { value: { question: 'Confirm?' } } as any;
    const mockRef = createMockStreamResourceRef();
    // Cast to access writable signal for test setup
    (mockRef.interrupt as ReturnType<typeof signal<Interrupt<any> | undefined>>).set(mockInterrupt);

    expect(getInterrupt(mockRef)).toBe(mockInterrupt);
  });
});

describe('ChatInterruptComponent — interrupt computed', () => {
  it('interrupt is undefined when ref has no interrupt', () => {
    const mockRef = createMockStreamResourceRef();
    const ref$ = signal(mockRef);

    const interrupt = computed(() => ref$().interrupt());

    expect(interrupt()).toBeUndefined();
  });

  it('interrupt reflects ref.interrupt value when present', () => {
    const mockInterrupt: Interrupt<any> = { value: { step: 'confirm' } } as any;
    const mockRef = createMockStreamResourceRef();
    (mockRef.interrupt as ReturnType<typeof signal<Interrupt<any> | undefined>>).set(mockInterrupt);

    const ref$ = signal(mockRef);
    const interrupt = computed(() => ref$().interrupt());

    expect(interrupt()).toBe(mockInterrupt);
  });

  it('interrupt updates reactively when ref changes', () => {
    const noInterruptRef = createMockStreamResourceRef();
    const interruptRef = createMockStreamResourceRef();
    const mockInterrupt: Interrupt<any> = { value: { type: 'human_review' } } as any;
    (interruptRef.interrupt as ReturnType<typeof signal<Interrupt<any> | undefined>>).set(mockInterrupt);

    const ref$ = signal(noInterruptRef);
    const interrupt = computed(() => ref$().interrupt());

    expect(interrupt()).toBeUndefined();
    ref$.set(interruptRef);
    expect(interrupt()).toBe(mockInterrupt);
  });
});
