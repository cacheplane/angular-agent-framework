// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { createMockAgentRef } from './mock-agent-ref';
import { ResourceStatus } from '../agent.types';

describe('createMockAgentRef', () => {
  it('creates a mock with default values', () => {
    const ref = createMockAgentRef();

    expect(ref.messages()).toEqual([]);
    expect(ref.status()).toBe(ResourceStatus.Idle);
    expect(ref.isLoading()).toBe(false);
    expect(ref.error()).toBeNull();
    expect(ref.hasValue()).toBe(false);
    expect(ref.isThreadLoading()).toBe(false);
    expect(ref.interrupt()).toBeUndefined();
    expect(ref.interrupts()).toEqual([]);
    expect(ref.toolProgress()).toEqual([]);
    expect(ref.toolCalls()).toEqual([]);
    expect(ref.branch()).toBe('');
    expect(ref.history()).toEqual([]);
    expect(ref.subagents().size).toBe(0);
    expect(ref.activeSubagents()).toEqual([]);
  });

  it('accepts initial values for signals', () => {
    const ref = createMockAgentRef({
      status: ResourceStatus.Loading,
      isLoading: true,
      hasValue: true,
      isThreadLoading: true,
      error: new Error('test error'),
    });

    expect(ref.status()).toBe(ResourceStatus.Loading);
    expect(ref.isLoading()).toBe(true);
    expect(ref.hasValue()).toBe(true);
    expect(ref.isThreadLoading()).toBe(true);
    expect(ref.error()).toBeInstanceOf(Error);
  });

  it('has callable action methods', async () => {
    const ref = createMockAgentRef();

    await expect(ref.submit(null)).resolves.toBeUndefined();
    await expect(ref.stop()).resolves.toBeUndefined();
    await expect(ref.joinStream('run-1')).resolves.toBeUndefined();
    expect(() => ref.reload()).not.toThrow();
    expect(() => ref.switchThread('thread-1')).not.toThrow();
    expect(() => ref.setBranch('branch-1')).not.toThrow();
  });

  it('getMessagesMetadata returns undefined by default', () => {
    const ref = createMockAgentRef();
    const result = ref.getMessagesMetadata({} as any);
    expect(result).toBeUndefined();
  });

  it('getToolCalls returns empty array by default', () => {
    const ref = createMockAgentRef();
    const result = ref.getToolCalls({} as any);
    expect(result).toEqual([]);
  });
});
