// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { provideAgent } from './agent.provider';
import { injectAgent } from './inject-agent';
import { AgentLifecycleRegistry } from './agent-lifecycle-registry';
import { MockAgentTransport } from './transport/mock-stream.transport';

describe('AgentLifecycleRegistry integration with injectAgent()', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('collects an agent built in a child injector from the root registry', () => {
    // The registry is `providedIn: 'root'`, so nothing has to be provided and
    // an agent constructed *below* the root still registers upward.
    TestBed.configureTestingModule({ providers: [] });
    const registry = TestBed.inject(AgentLifecycleRegistry);
    expect(registry.lifecycles()).toEqual([]);

    const child = createEnvironmentInjector(
      provideAgent({
        assistantId: 'a',
        apiUrl: 'http://localhost',
        transport: new MockAgentTransport(),
        threadId: null,
      }),
      TestBed.inject(EnvironmentInjector),
    );
    const a = runInInjectionContext(child, () => injectAgent());

    expect(registry.lifecycles()).toEqual([a.lifecycle]);
  });

  it('unregisters a lifecycle when its injector is destroyed', () => {
    TestBed.configureTestingModule({ providers: [] });
    const registry = TestBed.inject(AgentLifecycleRegistry);

    const child = createEnvironmentInjector(
      provideAgent({
        assistantId: 'a',
        apiUrl: 'http://localhost',
        transport: new MockAgentTransport(),
        threadId: null,
      }),
      TestBed.inject(EnvironmentInjector),
    );
    const a = runInInjectionContext(child, () => injectAgent());
    expect(registry.lifecycles()).toEqual([a.lifecycle]);

    child.destroy();
    expect(registry.lifecycles()).toEqual([]);
  });

  it('registers the agent lifecycle without the app providing the registry', () => {
    TestBed.configureTestingModule({
      providers: [
        provideAgent({
          assistantId: 'a',
          apiUrl: 'http://localhost',
          transport: new MockAgentTransport(),
          threadId: null,
        }),
      ],
    });
    const registry = TestBed.inject(AgentLifecycleRegistry);
    expect(registry.lifecycles()).toEqual([]);

    const a = TestBed.runInInjectionContext(() => injectAgent());

    const registered = registry.lifecycles();
    expect(registered.length).toBe(1);
    expect(registered[0]).toBe(a.lifecycle);
  });

  it('accumulates multiple agent lifecycles in registration order', () => {
    // Use child environment injectors so two singleton AGENTs can coexist
    // while sharing the root AgentLifecycleRegistry.
    TestBed.configureTestingModule({ providers: [] });
    const registry = TestBed.inject(AgentLifecycleRegistry);
    const parent = TestBed.inject(EnvironmentInjector);

    const child1 = createEnvironmentInjector(
      provideAgent({
        assistantId: 'a',
        apiUrl: 'http://localhost',
        transport: new MockAgentTransport(),
        threadId: null,
      }),
      parent,
    );
    const child2 = createEnvironmentInjector(
      provideAgent({
        assistantId: 'b',
        apiUrl: 'http://localhost',
        transport: new MockAgentTransport(),
        threadId: null,
      }),
      parent,
    );

    const a1 = runInInjectionContext(child1, () => injectAgent());
    const a2 = runInInjectionContext(child2, () => injectAgent());

    const registered = registry.lifecycles();
    expect(registered.length).toBe(2);
    expect(registered[0]).toBe(a1.lifecycle);
    expect(registered[1]).toBe(a2.lifecycle);
  });
});
