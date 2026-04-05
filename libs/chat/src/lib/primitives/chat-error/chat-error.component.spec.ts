// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { extractErrorMessage } from './chat-error.component';
import { createMockStreamResourceRef } from '../../testing/mock-stream-resource-ref';

describe('extractErrorMessage()', () => {
  it('returns null for null error', () => {
    expect(extractErrorMessage(null)).toBeNull();
  });

  it('returns null for undefined error', () => {
    expect(extractErrorMessage(undefined)).toBeNull();
  });

  it('extracts message from Error object', () => {
    expect(extractErrorMessage(new Error('something went wrong'))).toBe('something went wrong');
  });

  it('returns string errors as-is', () => {
    expect(extractErrorMessage('network failure')).toBe('network failure');
  });

  it('converts unknown values to string', () => {
    expect(extractErrorMessage(42)).toBe('42');
  });
});

describe('ChatErrorComponent — errorMessage computed', () => {
  it('errorMessage is null when ref.error is null', () => {
    const mockRef = createMockStreamResourceRef({ error: null });
    const ref$ = signal(mockRef);

    const errorMessage = computed(() => extractErrorMessage(ref$().error()));

    expect(errorMessage()).toBeNull();
  });

  it('errorMessage reflects Error object message', () => {
    const mockRef = createMockStreamResourceRef({ error: new Error('boom') });
    const ref$ = signal(mockRef);

    const errorMessage = computed(() => extractErrorMessage(ref$().error()));

    expect(errorMessage()).toBe('boom');
  });

  it('errorMessage reflects string error', () => {
    const mockRef = createMockStreamResourceRef({ error: 'timeout' });
    const ref$ = signal(mockRef);

    const errorMessage = computed(() => extractErrorMessage(ref$().error()));

    expect(errorMessage()).toBe('timeout');
  });

  it('errorMessage updates reactively when ref changes', () => {
    const noErrorRef = createMockStreamResourceRef({ error: null });
    const errorRef = createMockStreamResourceRef({ error: new Error('failed') });
    const ref$ = signal(noErrorRef);

    const errorMessage = computed(() => extractErrorMessage(ref$().error()));

    expect(errorMessage()).toBeNull();
    ref$.set(errorRef);
    expect(errorMessage()).toBe('failed');
  });
});
