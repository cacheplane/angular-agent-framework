// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import {
  AgentError,
  type AgentStatus,
  type Message,
  type ToolCall,
  type AgentEvent,
} from '@threadplane/chat';
import type { BaseEvent } from '@ag-ui/core';
import { reduceEvent, type ReducerStore, type CustomStreamEvent, type ActivityEntry } from './reducer';

interface TestDeliveryRun {
  generation: string;
  baselineMessageIds: Set<string>;
  ownedMessageIds: Set<string>;
  snapshotReplacementIds: Set<string>;
  currentAssistantMessageId?: string;
  eligibleBaselineAssistantId?: string;
  protocolRunId?: string;
  outcome?: 'success' | 'error' | 'aborted' | 'interrupted' | 'paused';
}

type TestStore = ReducerStore & {
  deliveryRun: TestDeliveryRun | null;
  allocateDeliveryGeneration: (scope: string) => string;
};

function makeStore(generation = 'run-generation-1'): TestStore {
  let activitySequence = 0;
  return {
    messages:  signal<Message[]>([]),
    status:    signal<AgentStatus>('idle'),
    isLoading: signal(false),
    error:     signal<AgentError | undefined>(undefined),
    toolCalls: signal<ToolCall[]>([]),
    state:     signal<Record<string, unknown>>({}),
    interrupt: signal(undefined),
    events$:   new Subject<AgentEvent>(),
    customEvents: signal<CustomStreamEvent[]>([]),
    activities: signal<Map<string, ActivityEntry>>(new Map()),
    deliveryRun: {
      generation,
      baselineMessageIds: new Set(),
      ownedMessageIds: new Set(),
      snapshotReplacementIds: new Set(),
    },
    allocateDeliveryGeneration: (scope: string) => `${generation}:${scope}:${++activitySequence}`,
  } as TestStore;
}

const ev = (e: Record<string, unknown>) => e as unknown as BaseEvent;

describe('reduceEvent SUBAGENT_* lifecycle', () => {
  it('SUBAGENT_STARTED creates a running subagent activity entry', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher', parentToolCallId: 'call-9' }), store);
    const entry = store.activities().get('sa-1');
    expect(entry?.activityType).toBe('subagent');
    expect(entry?.content()['status']).toBe('running');
    expect(entry?.content()['name']).toBe('researcher');
    expect(entry?.content()['toolCallId']).toBe('call-9');
  });

  it('SUBAGENT_STARTED without parentToolCallId keys the card by subagentRunId', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-2', name: 'forecaster' }), store);
    expect(store.activities().get('sa-2')?.content()['toolCallId']).toBe('sa-2');
  });

  it('attributed TEXT_MESSAGE events feed the child entry and never the transcript', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher' }), store);
    reduceEvent(ev({ type: 'TEXT_MESSAGE_START', messageId: 'm-1', role: 'assistant', subagentRunId: 'sa-1' }), store);
    reduceEvent(ev({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: 'Checking ', subagentRunId: 'sa-1' }), store);
    reduceEvent(ev({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: 'flights', subagentRunId: 'sa-1' }), store);
    const msgs = store.activities().get('sa-1')?.content()['messages'] as Array<Record<string, unknown>>;
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ id: 'm-1', role: 'assistant', content: 'Checking flights' });
    expect(store.messages().some((m) => m.id === 'm-1')).toBe(false); // structural rule
  });

  it('attributed TOOL_CALL events feed the child, not the parent toolCalls signal', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher' }), store);
    reduceEvent(ev({ type: 'TOOL_CALL_START', toolCallId: 't-1', toolCallName: 'web_search', subagentRunId: 'sa-1' }), store);
    reduceEvent(ev({ type: 'TOOL_CALL_ARGS', toolCallId: 't-1', delta: '{"q":"x"}', subagentRunId: 'sa-1' }), store);
    reduceEvent(ev({ type: 'TOOL_CALL_END', toolCallId: 't-1', subagentRunId: 'sa-1' }), store);
    const calls = store.activities().get('sa-1')?.content()['toolCalls'] as Array<Record<string, unknown>>;
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: 't-1', name: 'web_search', status: 'complete', args: { q: 'x' } });
    expect(store.toolCalls()).toHaveLength(0);
  });

  it('an attributed event before SUBAGENT_STARTED creates the entry instead of dropping (buffer-not-drop)', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'TEXT_MESSAGE_START', messageId: 'm-1', role: 'assistant', subagentRunId: 'sa-late' }), store);
    reduceEvent(ev({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: 'early', subagentRunId: 'sa-late' }), store);
    const beforeGeneration = store.activities().get('sa-late')!.generation;
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-late', name: 'researcher', parentToolCallId: 'call-9' }), store);
    const entry = store.activities().get('sa-late')!;
    const content = entry.content();
    expect(content['name']).toBe('researcher');
    expect(content['toolCallId']).toBe('call-9');
    const msgs = content['messages'] as Array<Record<string, unknown>>;
    expect(msgs[0]).toMatchObject({ content: 'early' });
    // The placeholder identity from the buffer-not-drop entry must not leak
    // into a wrapper cached before STARTED arrived — identity changes force a
    // fresh generation so to-agent.ts's (id, generation)-keyed cache rebuilds.
    expect(entry.generation).not.toBe(beforeGeneration);
  });

  it('resume cycle: a re-announce after a fresh RUN_STARTED does not duplicate or lose identity', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher' }), store);
    reduceEvent(ev({ type: 'SUBAGENT_FINISHED', subagentRunId: 'sa-1', outcome: { type: 'suspended', interruptIds: ['i-1'] } }), store);
    reduceEvent(ev({ type: 'RUN_STARTED' }), store);
    expect(store.activities().size).toBe(0); // new run clears activities
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher' }), store);
    expect(store.activities().size).toBe(1);
    const entry = store.activities().get('sa-1')!;
    expect(entry.content()['status']).toBe('running');
    expect(entry.content()['name']).toBe('researcher');
  });

  it('SUBAGENT_FINISHED success completes; suspended stays running; re-announce after suspend does not duplicate', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher' }), store);
    reduceEvent(ev({ type: 'SUBAGENT_FINISHED', subagentRunId: 'sa-1', outcome: { type: 'suspended', interruptIds: ['i-1'] } }), store);
    expect(store.activities().get('sa-1')?.content()['status']).toBe('running');
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher' }), store);
    expect(store.activities().size).toBe(1);
    reduceEvent(ev({ type: 'SUBAGENT_FINISHED', subagentRunId: 'sa-1', outcome: { type: 'success' }, result: 'booked' }), store);
    expect(store.activities().get('sa-1')?.content()['status']).toBe('complete');
  });

  it('SUBAGENT_ERROR marks the entry error and records the message', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'SUBAGENT_STARTED', subagentRunId: 'sa-1', name: 'researcher' }), store);
    reduceEvent(ev({ type: 'SUBAGENT_ERROR', subagentRunId: 'sa-1', message: 'rate limited', code: '429' }), store);
    const content = store.activities().get('sa-1')!.content();
    expect(content['status']).toBe('error');
    expect((content['state'] as Record<string, unknown>)['error']).toBe('rate limited');
  });

  it('unattributed events behave exactly as before (regression)', () => {
    const store = makeStore();
    reduceEvent(ev({ type: 'TEXT_MESSAGE_START', messageId: 'm-1', role: 'assistant' }), store);
    reduceEvent(ev({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: 'hello' }), store);
    expect(store.messages().find((m) => m.id === 'm-1')?.content).toBe('hello');
    expect(store.activities().size).toBe(0);
  });
});
