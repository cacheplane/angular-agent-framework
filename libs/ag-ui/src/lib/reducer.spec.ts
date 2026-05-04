// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import type {
  Message, AgentStatus, ToolCall, AgentEvent,
} from '@ngaf/chat';
import { reduceEvent, type ReducerStore } from './reducer';

function makeStore(): ReducerStore {
  return {
    messages:  signal<Message[]>([]),
    status:    signal<AgentStatus>('idle'),
    isLoading: signal(false),
    error:     signal<unknown>(null),
    toolCalls: signal<ToolCall[]>([]),
    state:     signal<Record<string, unknown>>({}),
    events$:   new Subject<AgentEvent>(),
  };
}

describe('reduceEvent', () => {
  it('RUN_STARTED sets status running, isLoading true, clears error', () => {
    const store = makeStore();
    store.error.set('previous');
    reduceEvent({ type: 'RUN_STARTED' } as any, store);
    expect(store.status()).toBe('running');
    expect(store.isLoading()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('RUN_FINISHED sets status idle, isLoading false', () => {
    const store = makeStore();
    store.status.set('running');
    store.isLoading.set(true);
    reduceEvent({ type: 'RUN_FINISHED' } as any, store);
    expect(store.status()).toBe('idle');
    expect(store.isLoading()).toBe(false);
  });

  it('RUN_ERROR sets status error, captures message', () => {
    const store = makeStore();
    reduceEvent({ type: 'RUN_ERROR', message: 'boom' } as any, store);
    expect(store.status()).toBe('error');
    expect(store.error()).toBe('boom');
  });

  it('TEXT_MESSAGE_START appends an empty assistant message', () => {
    const store = makeStore();
    reduceEvent({ type: 'TEXT_MESSAGE_START', messageId: 'm1' } as any, store);
    expect(store.messages()).toEqual([{ id: 'm1', role: 'assistant', content: '' }]);
  });

  it('TEXT_MESSAGE_CONTENT appends delta to in-flight message', () => {
    const store = makeStore();
    reduceEvent({ type: 'TEXT_MESSAGE_START', messageId: 'm1' } as any, store);
    reduceEvent({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'hi ' } as any, store);
    reduceEvent({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'there' } as any, store);
    expect(store.messages()[0].content).toBe('hi there');
  });

  it('TOOL_CALL_START appends a running tool call', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search' } as any, store);
    expect(store.toolCalls()).toEqual([{ id: 't1', name: 'search', args: {}, status: 'running' }]);
  });

  it('TOOL_CALL_ARGS replaces args on the matching tool call', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search' } as any, store);
    reduceEvent({ type: 'TOOL_CALL_ARGS', toolCallId: 't1', delta: '{"q":"hi"}' } as any, store);
    expect(store.toolCalls()[0].args).toEqual({ q: 'hi' });
  });

  it('TOOL_CALL_END marks the matching tool call complete', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search' } as any, store);
    reduceEvent({ type: 'TOOL_CALL_END', toolCallId: 't1' } as any, store);
    expect(store.toolCalls()[0].status).toBe('complete');
  });

  it('TOOL_CALL_RESULT sets the result on the matching call', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search' } as any, store);
    reduceEvent({ type: 'TOOL_CALL_RESULT', toolCallId: 't1', content: 'found' } as any, store);
    expect(store.toolCalls()[0].result).toBe('found');
  });

  it('STATE_SNAPSHOT replaces state wholesale', () => {
    const store = makeStore();
    store.state.set({ prior: true });
    reduceEvent({ type: 'STATE_SNAPSHOT', snapshot: { fresh: 1 } } as any, store);
    expect(store.state()).toEqual({ fresh: 1 });
  });

  it('STATE_DELTA applies JSON Patch operations', () => {
    const store = makeStore();
    store.state.set({ a: 1 });
    reduceEvent({
      type: 'STATE_DELTA',
      delta: [{ op: 'replace', path: '/a', value: 2 }, { op: 'add', path: '/b', value: 3 }],
    } as any, store);
    expect(store.state()).toEqual({ a: 2, b: 3 });
  });

  it('MESSAGES_SNAPSHOT replaces messages wholesale', () => {
    const store = makeStore();
    store.messages.set([{ id: 'old', role: 'user', content: 'old' }]);
    reduceEvent({
      type: 'MESSAGES_SNAPSHOT',
      messages: [{ id: 'new', role: 'assistant', content: 'fresh' }],
    } as any, store);
    expect(store.messages()).toEqual([{ id: 'new', role: 'assistant', content: 'fresh' }]);
  });

  it('CUSTOM with name=state_update emits AgentStateUpdateEvent', async () => {
    const store = makeStore();
    const events: AgentEvent[] = [];
    store.events$.subscribe((e) => events.push(e));
    reduceEvent({ type: 'CUSTOM', name: 'state_update', value: { count: 1 } } as any, store);
    expect(events).toEqual([{ type: 'state_update', data: { count: 1 } }]);
  });

  it('CUSTOM with other name emits AgentCustomEvent', async () => {
    const store = makeStore();
    const events: AgentEvent[] = [];
    store.events$.subscribe((e) => events.push(e));
    reduceEvent({ type: 'CUSTOM', name: 'tick', value: 42 } as any, store);
    expect(events).toEqual([{ type: 'custom', name: 'tick', data: 42 }]);
  });

  it('unknown event types are no-ops', () => {
    const store = makeStore();
    reduceEvent({ type: 'FUTURE_EVENT' } as any, store);
    expect(store.messages()).toEqual([]);
    expect(store.status()).toBe('idle');
  });
});

describe('reduceEvent — REASONING_MESSAGE_*', () => {
  it('REASONING_MESSAGE_START creates an assistant slot with empty reasoning', () => {
    const store = makeStore();
    reduceEvent({ type: 'REASONING_MESSAGE_START', messageId: 'm1', role: 'assistant' } as any, store);
    const msgs = store.messages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe('m1');
    expect(msgs[0].role).toBe('assistant');
    expect(msgs[0].reasoning).toBe('');
  });

  it('REASONING_MESSAGE_CONTENT appends to the existing reasoning string', () => {
    const store = makeStore();
    reduceEvent({ type: 'REASONING_MESSAGE_START', messageId: 'm1', role: 'assistant' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_CONTENT', messageId: 'm1', delta: 'first ' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_CONTENT', messageId: 'm1', delta: 'then second' } as any, store);
    expect(store.messages()[0].reasoning).toBe('first then second');
  });

  it('REASONING_MESSAGE_CHUNK is treated identically to CONTENT', () => {
    const store = makeStore();
    reduceEvent({ type: 'REASONING_MESSAGE_START', messageId: 'm1', role: 'assistant' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_CHUNK', messageId: 'm1', delta: 'chunk1' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_CHUNK', messageId: 'm1', delta: 'chunk2' } as any, store);
    expect(store.messages()[0].reasoning).toBe('chunk1chunk2');
  });

  it('REASONING_MESSAGE_END writes a non-negative reasoningDurationMs', () => {
    const store = makeStore();
    reduceEvent({ type: 'REASONING_MESSAGE_START', messageId: 'm1', role: 'assistant' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_CONTENT', messageId: 'm1', delta: 'reasoned.' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_END', messageId: 'm1' } as any, store);
    const m = store.messages()[0];
    expect(typeof m.reasoningDurationMs).toBe('number');
    expect(m.reasoningDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('TEXT_MESSAGE_START after REASONING_MESSAGE_START reuses the same id', () => {
    const store = makeStore();
    reduceEvent({ type: 'REASONING_MESSAGE_START', messageId: 'm1', role: 'assistant' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_CONTENT', messageId: 'm1', delta: 'thinking' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_END', messageId: 'm1' } as any, store);
    reduceEvent({ type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' } as any, store);
    reduceEvent({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'hello' } as any, store);
    const msgs = store.messages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].reasoning).toBe('thinking');
    expect(msgs[0].content).toBe('hello');
  });
});
