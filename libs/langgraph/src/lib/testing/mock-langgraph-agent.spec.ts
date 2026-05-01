// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { mockLangGraphAgent } from './mock-langgraph-agent';

describe('mockLangGraphAgent', () => {
  it('creates a mock with default values', () => {
    const ref = mockLangGraphAgent();

    expect(ref.messages()).toEqual([]);
    expect(ref.langGraphMessages()).toEqual([]);
    expect(ref.status()).toBe('idle');
    expect(ref.isLoading()).toBe(false);
    expect(ref.error()).toBeNull();
    expect(ref.hasValue()).toBe(false);
    expect(ref.isThreadLoading()).toBe(false);
    expect(ref.interrupt()).toBeUndefined();
    expect(ref.langGraphInterrupts()).toEqual([]);
    expect(ref.toolProgress()).toEqual([]);
    expect(ref.toolCalls()).toEqual([]);
    expect(ref.langGraphToolCalls()).toEqual([]);
    expect(ref.branch()).toBe('');
    expect(ref.history()).toEqual([]);
    expect(ref.langGraphHistory()).toEqual([]);
    expect(ref.subagents().size).toBe(0);
    expect(ref.activeSubagents()).toEqual([]);
    expect(ref.customEvents()).toEqual([]);
  });

  it('accepts initial values for signals', () => {
    const ref = mockLangGraphAgent({
      status: 'running',
      isLoading: true,
      hasValue: true,
      isThreadLoading: true,
      error: new Error('test error'),
    });

    expect(ref.status()).toBe('running');
    expect(ref.isLoading()).toBe(true);
    expect(ref.hasValue()).toBe(true);
    expect(ref.isThreadLoading()).toBe(true);
    expect(ref.error()).toBeInstanceOf(Error);
  });

  it('has callable action methods', async () => {
    const ref = mockLangGraphAgent();

    await expect(ref.submit({ message: 'hello' })).resolves.toBeUndefined();
    await expect(ref.stop()).resolves.toBeUndefined();
    await expect(ref.joinStream('run-1')).resolves.toBeUndefined();
    expect(() => ref.reload()).not.toThrow();
    expect(() => ref.switchThread('thread-1')).not.toThrow();
    expect(() => ref.setBranch('branch-1')).not.toThrow();
  });

  it('getMessagesMetadata returns undefined by default', () => {
    const ref = mockLangGraphAgent();
    const result = ref.getMessagesMetadata({} as any);
    expect(result).toBeUndefined();
  });

  it('getToolCalls returns empty array by default', () => {
    const ref = mockLangGraphAgent();
    const result = ref.getToolCalls({} as any);
    expect(result).toEqual([]);
  });

  it('events$ is an Observable-like with .subscribe', () => {
    const ref = mockLangGraphAgent();
    expect(typeof ref.events$.subscribe).toBe('function');
  });

  it('state() returns a plain object derived from value()', () => {
    const ref = mockLangGraphAgent();
    const state = ref.state();
    expect(typeof state).toBe('object');
    expect(state).not.toBeNull();
  });

  it('exposes all langGraph* raw signal fields', () => {
    const ref = mockLangGraphAgent();
    expect(typeof ref.langGraphMessages).toBe('function');
    expect(typeof ref.langGraphInterrupts).toBe('function');
    expect(typeof ref.langGraphToolCalls).toBe('function');
    expect(typeof ref.langGraphHistory).toBe('function');
  });
});
