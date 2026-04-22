// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { ChatAgent, ChatCustomEvent } from '@cacheplane/chat';
import type { AgentRef, CustomStreamEvent } from './agent.types';
import { ResourceStatus } from './agent.types';
import { toChatAgent } from './to-chat-agent';

/* eslint-disable @typescript-eslint/no-empty-function */
function stubAgentRef(overrides: Partial<AgentRef<unknown, any>> = {}): AgentRef<unknown, any> {
  return {
    value:           signal<unknown>(null),
    status:          signal<ResourceStatus>(ResourceStatus.Idle),
    isLoading:       signal(false),
    error:           signal<unknown>(null),
    hasValue:        signal(false),
    reload:          () => {},
    messages:        signal([]),
    interrupt:       signal(undefined),
    interrupts:      signal([]),
    toolProgress:    signal([]),
    toolCalls:       signal([]),
    branch:          signal(''),
    history:         signal([]),
    isThreadLoading: signal(false),
    subagents:       signal(new Map()),
    activeSubagents: signal([]),
    customEvents:    signal([]),
    submit:          async () => {},
    stop:            async () => {},
    switchThread:    () => {},
    joinStream:      async () => {},
    setBranch:       () => {},
    getMessagesMetadata: () => undefined,
    getToolCalls:    () => [],
    ...overrides,
  } as AgentRef<unknown, any>;
}

describe('toChatAgent (LangGraph adapter)', () => {
  it('translates HumanMessage to role: user', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({ messages: signal([new HumanMessage({ content: 'hi', id: 'm1' })]) });
      const chat = toChatAgent(ref);
      expect(chat.messages()).toEqual([
        { id: 'm1', role: 'user', content: 'hi', extra: expect.any(Object) },
      ]);
    });
  });

  it('translates AIMessage to role: assistant', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({ messages: signal([new AIMessage({ content: 'hello', id: 'm2' })]) });
      const chat = toChatAgent(ref);
      expect(chat.messages()[0].role).toBe('assistant');
    });
  });

  it('maps ResourceStatus.Loading to ChatStatus "running" and sets isLoading', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({
        status: signal(ResourceStatus.Loading),
        isLoading: signal(true),
      });
      const chat = toChatAgent(ref);
      expect(chat.status()).toBe('running');
      expect(chat.isLoading()).toBe(true);
    });
  });

  it('maps ResourceStatus.Error to ChatStatus "error"', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({ status: signal(ResourceStatus.Error) });
      const chat = toChatAgent(ref);
      expect(chat.status()).toBe('error');
    });
  });

  it('delegates submit to AgentRef.submit with messages[] payload', async () => {
    let captured: unknown = null;
    TestBed.runInInjectionContext(async () => {
      const ref = stubAgentRef({ submit: async (v) => { captured = v; } });
      const chat = toChatAgent(ref);
      await chat.submit({ message: 'hello' });
      expect(captured).toEqual({ messages: [{ role: 'human', content: 'hello' }] });
    });
  });

  it('delegates stop to AgentRef.stop', async () => {
    let stopped = false;
    TestBed.runInInjectionContext(async () => {
      const ref = stubAgentRef({ stop: async () => { stopped = true; } });
      const chat = toChatAgent(ref);
      await chat.stop();
      expect(stopped).toBe(true);
    });
  });

  it('exposes customEvents$ that emits newly-appended events with type aliased from name', () => {
    const customSig = signal<CustomStreamEvent[]>([]);
    const ref = stubAgentRef({ customEvents: customSig });

    let adapter!: ChatAgent;
    TestBed.runInInjectionContext(() => {
      adapter = toChatAgent(ref);
    });

    const received: ChatCustomEvent[] = [];
    adapter.customEvents$!.subscribe((e) => received.push(e));

    customSig.set([{ name: 'state_update', data: { counter: 1 } }]);
    TestBed.flushEffects();

    expect(received).toEqual([
      { type: 'state_update', data: { counter: 1 } },
    ]);

    customSig.set([
      { name: 'state_update', data: { counter: 1 } },
      { name: 'a2ui.surface', data: { surfaceId: 'main' } },
    ]);
    TestBed.flushEffects();

    expect(received).toEqual([
      { type: 'state_update', data: { counter: 1 } },
      { type: 'a2ui.surface', data: { surfaceId: 'main' } },
    ]);
  });
});
