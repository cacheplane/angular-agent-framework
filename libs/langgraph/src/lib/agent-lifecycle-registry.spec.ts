// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { agent } from './agent.fn';
import { AgentLifecycleRegistry } from './agent-lifecycle-registry';
import { MockAgentTransport } from './transport/mock-stream.transport';

function withInjectionContext<T>(fn: () => T): T {
  let result!: T;
  TestBed.runInInjectionContext(() => { result = fn(); });
  return result;
}

describe('AgentLifecycleRegistry integration with agent()', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('does not error or register when no registry is provided', () => {
    TestBed.configureTestingModule({ providers: [] });
    expect(() =>
      withInjectionContext(() =>
        agent({
          assistantId: 'a',
          apiUrl: 'http://localhost',
          transport: new MockAgentTransport(),
          threadId: null,
        }),
      ),
    ).not.toThrow();
  });

  it('registers the agent lifecycle when AgentLifecycleRegistry is provided', () => {
    TestBed.configureTestingModule({ providers: [AgentLifecycleRegistry] });
    const registry = TestBed.inject(AgentLifecycleRegistry);
    expect(registry.lifecycles()).toEqual([]);

    const a = withInjectionContext(() =>
      agent({
        assistantId: 'a',
        apiUrl: 'http://localhost',
        transport: new MockAgentTransport(),
        threadId: null,
      }),
    );

    const registered = registry.lifecycles();
    expect(registered.length).toBe(1);
    expect(registered[0]).toBe(a.lifecycle);
  });

  it('accumulates multiple agent lifecycles in registration order', () => {
    TestBed.configureTestingModule({ providers: [AgentLifecycleRegistry] });
    const registry = TestBed.inject(AgentLifecycleRegistry);

    const a1 = withInjectionContext(() =>
      agent({
        assistantId: 'a',
        apiUrl: 'http://localhost',
        transport: new MockAgentTransport(),
        threadId: null,
      }),
    );
    const a2 = withInjectionContext(() =>
      agent({
        assistantId: 'b',
        apiUrl: 'http://localhost',
        transport: new MockAgentTransport(),
        threadId: null,
      }),
    );

    const registered = registry.lifecycles();
    expect(registered.length).toBe(2);
    expect(registered[0]).toBe(a1.lifecycle);
    expect(registered[1]).toBe(a2.lifecycle);
  });
});
