// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import { extractErrorMessage } from './chat-error.component';
import { mockAgent } from '../../testing/mock-agent';

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
  it('errorMessage is null when agent.error is null', () => {
    const agent = mockAgent({ error: null });
    const agent$ = signal(agent);

    const errorMessage = computed(() => extractErrorMessage(agent$().error()));

    expect(errorMessage()).toBeNull();
  });

  it('errorMessage reflects Error object message', () => {
    const agent = mockAgent({ status: 'error', error: new Error('boom') });
    const agent$ = signal(agent);

    const errorMessage = computed(() => extractErrorMessage(agent$().error()));

    expect(errorMessage()).toBe('boom');
  });

  it('errorMessage reflects string error', () => {
    const agent = mockAgent({ error: 'timeout' });
    const agent$ = signal(agent);

    const errorMessage = computed(() => extractErrorMessage(agent$().error()));

    expect(errorMessage()).toBe('timeout');
  });

  it('errorMessage updates reactively when agent changes', () => {
    const noErrorAgent = mockAgent({ error: null });
    const errorAgent = mockAgent({ status: 'error', error: new Error('failed') });
    const agent$ = signal(noErrorAgent);

    const errorMessage = computed(() => extractErrorMessage(agent$().error()));

    expect(errorMessage()).toBeNull();
    agent$.set(errorAgent);
    expect(errorMessage()).toBe('failed');
  });
});
