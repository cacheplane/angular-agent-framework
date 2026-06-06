// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import type {
  Message, AgentStatus, ToolCall, AgentEvent,
} from '@threadplane/chat';
import { reduceEvent, type ReducerStore } from './reducer';

function makeStore(): ReducerStore {
  return {
    messages:  signal<Message[]>([]),
    status:    signal<AgentStatus>('idle'),
    isLoading: signal(false),
    error:     signal<unknown>(null),
    toolCalls: signal<ToolCall[]>([]),
    state:     signal<Record<string, unknown>>({}),
    interrupt: signal(undefined),
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

  it('TOOL_CALL_START links the tool call to its parent assistant message (creating the slot)', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'weather_card', parentMessageId: 'a1' } as any, store);
    expect(store.toolCalls()).toEqual([{ id: 't1', name: 'weather_card', args: {}, status: 'running' }]);
    const msg = store.messages().find((m) => m.id === 'a1');
    expect(msg).toBeDefined();
    expect(msg!.role).toBe('assistant');
    expect(msg!.toolCallIds).toEqual(['t1']);
  });

  it('TOOL_CALL_START appends toolCallIds to an existing parent assistant message', () => {
    const store = makeStore();
    reduceEvent({ type: 'TEXT_MESSAGE_START', messageId: 'a1' } as any, store);
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'weather_card', parentMessageId: 'a1' } as any, store);
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't2', toolCallName: 'weather_card', parentMessageId: 'a1' } as any, store);
    const a1 = store.messages().filter((m) => m.id === 'a1');
    expect(a1).toHaveLength(1);
    expect(a1[0].toolCallIds).toEqual(['t1', 't2']);
  });

  it('TOOL_CALL_START without parentMessageId does not create or modify messages', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search' } as any, store);
    expect(store.messages()).toEqual([]);
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

  it('TOOL_CALL_RESULT parses JSON string content into an object', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'weather_card' } as any, store);
    reduceEvent({ type: 'TOOL_CALL_RESULT', toolCallId: 't1', content: '{"temperatureF":68,"location":"San Francisco"}' } as any, store);
    expect(store.toolCalls()[0].result).toEqual({ temperatureF: 68, location: 'San Francisco' });
  });

  it('TOOL_CALL_RESULT preserves non-JSON string result as-is', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'search' } as any, store);
    reduceEvent({ type: 'TOOL_CALL_RESULT', toolCallId: 't1', content: 'plain text result' } as any, store);
    expect(store.toolCalls()[0].result).toBe('plain text result');
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

  it('MESSAGES_SNAPSHOT bridges assistant toolCalls to toolCallIds', () => {
    const store = makeStore();
    reduceEvent({
      type: 'MESSAGES_SNAPSHOT',
      messages: [
        { id: 'u1', role: 'user', content: 'hello' },
        { id: 'a1', role: 'assistant', content: '', toolCalls: [{ id: 'tc1', type: 'function', function: { name: 'weather_card', arguments: '{"location":"SF"}' } }] },
        { id: 'a2', role: 'assistant', content: 'Here is the weather.' },
      ],
    } as any, store);
    const a1 = store.messages().find((m) => m.id === 'a1');
    expect(a1).toBeDefined();
    expect(a1!.toolCallIds).toEqual(['tc1']);
    expect((a1 as any).toolCalls).toBeUndefined();
    const a2 = store.messages().find((m) => m.id === 'a2');
    expect(a2!.toolCallIds).toBeUndefined();
  });

  it('MESSAGES_SNAPSHOT inserts snapshot-only tool calls into store.toolCalls', () => {
    const store = makeStore();
    reduceEvent({
      type: 'MESSAGES_SNAPSHOT',
      messages: [
        { id: 'a1', role: 'assistant', content: '', toolCalls: [{ id: 'tc1', type: 'function', function: { name: 'weather_card', arguments: '{"location":"SF"}' } }] },
      ],
    } as any, store);
    const tc = store.toolCalls().find((t) => t.id === 'tc1');
    expect(tc).toBeDefined();
    expect(tc!.name).toBe('weather_card');
    expect(tc!.args).toEqual({ location: 'SF' });
    expect(tc!.status).toBe('complete');
  });

  it('MESSAGES_SNAPSHOT does not duplicate a tool call already in store.toolCalls', () => {
    const store = makeStore();
    reduceEvent({ type: 'TOOL_CALL_START', toolCallId: 'tc1', toolCallName: 'weather_card', parentMessageId: 'a1' } as any, store);
    reduceEvent({ type: 'TOOL_CALL_RESULT', toolCallId: 'tc1', content: '{"temperatureF":68}' } as any, store);
    reduceEvent({
      type: 'MESSAGES_SNAPSHOT',
      messages: [{ id: 'a1', role: 'assistant', content: '', toolCalls: [{ id: 'tc1', type: 'function', function: { name: 'weather_card', arguments: '{}' } }] }],
    } as any, store);
    expect(store.toolCalls().filter((t) => t.id === 'tc1')).toHaveLength(1);
    // The original entry (with result) is kept, not replaced by the snapshot entry.
    expect(store.toolCalls().find((t) => t.id === 'tc1')!.result).toEqual({ temperatureF: 68 });
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

describe('reduceEvent — interrupt', () => {
  it('sets interrupt from a CUSTOM on_interrupt event', () => {
    const store = makeStore();
    reduceEvent({ type: 'CUSTOM', name: 'on_interrupt', value: { kind: 'refund_approval', amount: 42 } } as never, store);
    const ix = store.interrupt();
    expect(ix).toBeTruthy();
    expect(ix!.value).toEqual({ kind: 'refund_approval', amount: 42 });
    expect(ix!.resumable).toBe(true);
    expect(typeof ix!.id).toBe('string');
  });
  it('clears interrupt on RUN_STARTED', () => {
    const store = makeStore();
    store.interrupt.set({ id: 'x', value: {}, resumable: true });
    reduceEvent({ type: 'RUN_STARTED' } as never, store);
    expect(store.interrupt()).toBeUndefined();
  });
  it('still forwards non-interrupt CUSTOM events to events$', () => {
    const store = makeStore();
    const seen: unknown[] = [];
    store.events$.subscribe((e) => seen.push(e));
    reduceEvent({ type: 'CUSTOM', name: 'state_update', value: { a: 1 } } as never, store);
    expect(seen).toEqual([{ type: 'state_update', data: { a: 1 } }]);
    expect(store.interrupt()).toBeUndefined();
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
