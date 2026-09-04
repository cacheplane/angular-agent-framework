import { describe, it, expect } from 'vitest';
import { InjectionToken, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createAgentRef } from '@threadplane/chat';
import { provideAgent, AGENT_CONFIG, AGENT } from './agent.provider';
import { injectAgent } from './inject-agent';
import { MockAgentTransport } from './transport/mock-stream.transport';

describe('provideAgent', () => {
  it('registers AGENT_CONFIG internally for the legacy factory defaults-merge path', () => {
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: 'https://api.example.com' })],
    });
    const config = TestBed.inject(AGENT_CONFIG);
    expect(config.apiUrl).toBe('https://api.example.com');
  });

  it('forwards custom transport through the internal AGENT_CONFIG entry', () => {
    const transport = new MockAgentTransport();
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: '', transport })],
    });
    const config = TestBed.inject(AGENT_CONFIG);
    expect(config.transport).toBe(transport);
  });

  it('provides AGENT singleton constructed from config', () => {
    const transport = new MockAgentTransport();
    TestBed.configureTestingModule({
      providers: [
        provideAgent({
          apiUrl: '',
          assistantId: 'test-graph',
          transport,
        }),
      ],
    });
    const ag = TestBed.inject(AGENT);
    expect(ag).toBeDefined();
    // LangGraphAgent has a `submit` function and `messages` / `value` signals.
    expect(typeof ag.submit).toBe('function');
    expect(typeof ag.value).toBe('function');
    expect(typeof ag.messages).toBe('function');
  });

  it('returns the same AGENT instance across injections (singleton)', () => {
    TestBed.configureTestingModule({
      providers: [
        provideAgent({
          apiUrl: '',
          assistantId: 'test-graph',
          transport: new MockAgentTransport(),
        }),
      ],
    });
    const first = TestBed.inject(AGENT);
    const second = TestBed.inject(AGENT);
    expect(first).toBe(second);
  });

  it('throws when AGENT is injected without an assistantId in config', () => {
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: 'http://localhost' })],
    });
    expect(() =>
      TestBed.runInInjectionContext(() => TestBed.inject(AGENT)),
    ).toThrow(/`assistantId` is required to construct the AGENT singleton/);
  });

  it('accepts a factory that resolves config inside an injection context', () => {
    const transport = new MockAgentTransport();
    // The factory form lets config depend on runtime/DI state. Here we prove
    // the factory runs (the returned config drives the AGENT singleton) and is
    // invoked exactly once.
    let calls = 0;
    TestBed.configureTestingModule({
      providers: [
        provideAgent(() => {
          calls += 1;
          return { apiUrl: '', assistantId: 'factory-graph', transport };
        }),
      ],
    });
    const config = TestBed.inject(AGENT_CONFIG);
    expect(config.assistantId).toBe('factory-graph');
    const ag = TestBed.inject(AGENT);
    expect(typeof ag.submit).toBe('function');
    // AGENT reads the already-resolved AGENT_CONFIG, so the factory ran once.
    expect(calls).toBe(1);
  });

  describe('AgentRef isolation', () => {
    interface StateA { which: string }
    interface StateB { which: string }

    it('gives each ref its own agent and its own config in ONE providers array', async () => {
      const REF_A = createAgentRef<StateA>('ref-a');
      const REF_B = createAgentRef<StateB>('ref-b');
      const transportA = new MockAgentTransport();
      const transportB = new MockAgentTransport();
      TestBed.configureTestingModule({
        providers: [
          provideAgent(REF_A, {
            apiUrl: '',
            assistantId: 'graph-a',
            transport: transportA,
            initialValues: { which: 'a' },
          }),
          provideAgent(REF_B, {
            apiUrl: '',
            assistantId: 'graph-b',
            transport: transportB,
            initialValues: { which: 'b' },
          }),
        ],
      });

      const agentA = TestBed.runInInjectionContext(() => injectAgent(REF_A));
      const agentB = TestBed.runInInjectionContext(() => injectAgent(REF_B));

      // Distinct instances...
      expect(agentA).not.toBe(agentB);
      // ...each built from ITS OWN config, not the last one registered.
      expect(agentA.value()).toEqual({ which: 'a' });
      expect(agentB.value()).toEqual({ which: 'b' });

      // And each is wired to its own transport: a submit on A must not reach B.
      void agentA.submit({ message: 'to-a' });
      await Promise.resolve();
      expect(transportA.streams.length).toBe(1);
      expect(transportB.streams.length).toBe(0);
      agentA.stop();
    });

    it('keeps single-ref behaviour identical: injectAgent() resolves the same instance', () => {
      const REF = createAgentRef<StateA>('single');
      const transport = new MockAgentTransport();
      TestBed.configureTestingModule({
        providers: [
          provideAgent(REF, {
            apiUrl: '',
            assistantId: 'single-graph',
            transport,
            initialValues: { which: 'single' },
          }),
        ],
      });

      const byRef = TestBed.runInInjectionContext(() => injectAgent(REF));
      const bare = TestBed.runInInjectionContext(() => injectAgent());
      expect(bare).toBe(byRef);
      expect(TestBed.inject(AGENT)).toBe(byRef);
      // The internal AGENT_CONFIG token still resolves for a ref-provided agent.
      expect(TestBed.inject(AGENT_CONFIG).assistantId).toBe('single-graph');
      expect(TestBed.inject(AGENT_CONFIG).transport).toBe(transport);
    });

    it('resolves a ref config factory lazily inside an injection context, exactly once', () => {
      const REF = createAgentRef<StateA>('lazy');
      const ASSISTANT_ID = new InjectionToken<string>('ASSISTANT_ID');
      let calls = 0;
      TestBed.configureTestingModule({
        providers: [
          { provide: ASSISTANT_ID, useValue: 'from-di' },
          provideAgent(REF, () => {
            calls += 1;
            // Only legal if the factory runs in an injection context.
            return {
              apiUrl: '',
              assistantId: inject(ASSISTANT_ID),
              transport: new MockAgentTransport(),
              initialValues: { which: 'lazy' },
            };
          }),
        ],
      });
      // Not run at decoration time.
      expect(calls).toBe(0);

      const agent = TestBed.runInInjectionContext(() => injectAgent(REF));
      expect(agent.value()).toEqual({ which: 'lazy' });
      expect(TestBed.inject(AGENT_CONFIG).assistantId).toBe('from-di');
      // Ref agent and AGENT_CONFIG share one resolution of the factory.
      expect(calls).toBe(1);
      expect(TestBed.runInInjectionContext(() => injectAgent())).toBe(agent);
      expect(calls).toBe(1);
    });

    it('throws the same assistantId error through a ref token', () => {
      const REF = createAgentRef<StateA>('no-assistant');
      TestBed.configureTestingModule({
        providers: [provideAgent(REF, { apiUrl: 'http://localhost' })],
      });
      expect(() =>
        TestBed.runInInjectionContext(() => injectAgent(REF)),
      ).toThrow(/`assistantId` is required to construct the AGENT singleton/);
    });
  });
});
