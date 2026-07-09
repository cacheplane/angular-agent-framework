// SPDX-License-Identifier: MIT
import { inject, InjectionToken } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createAgentRef } from '@threadplane/chat';
import { describe, expect, it } from 'vitest';
import { makeFakeSignalChatResource } from '../testing/fake-signal-chat-resource';
import { AGENT, injectAgent, provideAgent } from './provide-agent';

describe('provideAgent', () => {
  it('registers an injectable Agent from a resource', () => {
    const fixture = makeFakeSignalChatResource();
    TestBed.configureTestingModule({
      providers: [provideAgent(fixture.resource)],
    });

    const agent = TestBed.runInInjectionContext(() => injectAgent());

    expect(agent).toBe(TestBed.inject(AGENT));
    expect(agent.messages()).toEqual([]);
  });

  it('resolves resource factories inside an injection context', () => {
    const fixture = makeFakeSignalChatResource();
    const RESOURCE = new InjectionToken('RESOURCE', {
      factory: () => fixture.resource,
    });
    let calls = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: RESOURCE, useValue: fixture.resource },
        provideAgent(() => {
          calls++;
          return inject(RESOURCE);
        }),
      ],
    });

    const agent = TestBed.runInInjectionContext(() => injectAgent());

    expect(agent).toBeDefined();
    expect(calls).toBe(1);
  });

  it('binds an AgentRef token when provided', () => {
    interface TripState {
      day: number;
    }
    const TRIP = createAgentRef<TripState>('trip');
    const fixture = makeFakeSignalChatResource();
    TestBed.configureTestingModule({
      providers: [provideAgent(TRIP, fixture.resource)],
    });

    const defaultAgent = TestBed.runInInjectionContext(() => injectAgent());
    const typedAgent = TestBed.runInInjectionContext(() => injectAgent(TRIP));

    expect(typedAgent).toBe(defaultAgent);
  });
});
