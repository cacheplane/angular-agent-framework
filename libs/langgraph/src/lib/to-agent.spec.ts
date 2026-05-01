// SPDX-License-Identifier: MIT
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { Agent, AgentEvent } from '@ngaf/chat';
import type { AgentRef, CustomStreamEvent } from './agent.types';
import { ResourceStatus } from './agent.types';
import { toAgent } from './to-agent';

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

describe('toAgent (LangGraph adapter)', () => {
  it('translates HumanMessage to role: user', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({ messages: signal([new HumanMessage({ content: 'hi', id: 'm1' })]) });
      const agent = toAgent(ref);
      expect(agent.messages()).toEqual([
        { id: 'm1', role: 'user', content: 'hi', extra: expect.any(Object) },
      ]);
    });
  });

  it('translates AIMessage to role: assistant', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({ messages: signal([new AIMessage({ content: 'hello', id: 'm2' })]) });
      const agent = toAgent(ref);
      expect(agent.messages()[0].role).toBe('assistant');
    });
  });

  it('maps ResourceStatus.Loading to AgentStatus "running" and sets isLoading', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({
        status: signal(ResourceStatus.Loading),
        isLoading: signal(true),
      });
      const agent = toAgent(ref);
      expect(agent.status()).toBe('running');
      expect(agent.isLoading()).toBe(true);
    });
  });

  it('maps ResourceStatus.Error to AgentStatus "error"', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({ status: signal(ResourceStatus.Error) });
      const agent = toAgent(ref);
      expect(agent.status()).toBe('error');
    });
  });

  it('delegates submit to AgentRef.submit with messages[] payload', async () => {
    let captured: unknown = null;
    TestBed.runInInjectionContext(async () => {
      const ref = stubAgentRef({ submit: async (v) => { captured = v; } });
      const agent = toAgent(ref);
      await agent.submit({ message: 'hello' });
      expect(captured).toEqual({ messages: [{ role: 'human', content: 'hello' }] });
    });
  });

  it('delegates stop to AgentRef.stop', async () => {
    let stopped = false;
    TestBed.runInInjectionContext(async () => {
      const ref = stubAgentRef({ stop: async () => { stopped = true; } });
      const agent = toAgent(ref);
      await agent.stop();
      expect(stopped).toBe(true);
    });
  });

  it('translates ThreadState history into AgentCheckpoint[]', () => {
    TestBed.runInInjectionContext(() => {
      const ref = stubAgentRef({
        history: signal([
          { values: { step: 1 }, next: ['nodeA'], checkpoint: { checkpoint_id: 'ck1' } },
          { values: { step: 2 }, next: [],         checkpoint: { checkpoint_id: 'ck2' } },
          { values: { step: 3 }, next: ['nodeC'], checkpoint: undefined },
        ] as any),
      });
      const agent = toAgent(ref);
      expect(agent.history()).toEqual([
        { id: 'ck1', label: 'nodeA', values: { step: 1 } },
        { id: 'ck2', label: undefined, values: { step: 2 } },
        { id: undefined, label: 'nodeC', values: { step: 3 } },
      ]);
    });
  });

  it('translates a state_update CustomStreamEvent into AgentStateUpdateEvent', () => {
    TestBed.runInInjectionContext(() => {
      const customEvents = signal<any[]>([]);
      const ref = stubAgentRef({ customEvents } as any);
      const chat = toAgent(ref);

      const received: any[] = [];
      chat.events$.subscribe((e) => received.push(e));

      customEvents.set([{ name: 'state_update', data: { count: 1 } }]);
      TestBed.flushEffects();

      expect(received).toEqual([{ type: 'state_update', data: { count: 1 } }]);
    });
  });

  it('wraps non-state_update CustomStreamEvent as AgentCustomEvent', () => {
    TestBed.runInInjectionContext(() => {
      const customEvents = signal<any[]>([]);
      const ref = stubAgentRef({ customEvents } as any);
      const chat = toAgent(ref);

      const received: any[] = [];
      chat.events$.subscribe((e) => received.push(e));

      customEvents.set([{ name: 'tick', data: 42 }]);
      TestBed.flushEffects();

      expect(received).toEqual([{ type: 'custom', name: 'tick', data: 42 }]);
    });
  });

  it('exposes events$ that emits newly-appended events as structured AgentEvent', () => {
    const customSig = signal<CustomStreamEvent[]>([]);
    const ref = stubAgentRef({ customEvents: customSig });

    let adapter!: Agent;
    TestBed.runInInjectionContext(() => {
      adapter = toAgent(ref);
    });

    const received: AgentEvent[] = [];
    adapter.events$.subscribe((e) => received.push(e));

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
      { type: 'custom', name: 'a2ui.surface', data: { surfaceId: 'main' } },
    ]);
  });
});
