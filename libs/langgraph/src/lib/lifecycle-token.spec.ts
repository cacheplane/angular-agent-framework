// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { createAgentRef } from '@threadplane/chat';
import { provideAgent } from './agent.provider';
import { injectAgent } from './inject-agent';
import { AGENT_LIFECYCLE } from './lifecycle';
import { MockAgentTransport } from './transport/mock-stream.transport';

describe('AGENT_LIFECYCLE provider wiring', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('provideAgent(config) provides AGENT_LIFECYCLE as the agent lifecycle', () => {
    TestBed.configureTestingModule({
      providers: [
        provideAgent({
          apiUrl: '',
          assistantId: 'a',
          transport: new MockAgentTransport(),
          threadId: null,
        }),
      ],
    });
    const agent = TestBed.runInInjectionContext(() => injectAgent());
    expect(TestBed.inject(AGENT_LIFECYCLE)).toBe(agent.lifecycle);
  });

  it('provideAgent(ref, config) provides AGENT_LIFECYCLE as that ref agent lifecycle', () => {
    const REF = createAgentRef<Record<string, unknown>>('lifecycle-ref');
    TestBed.configureTestingModule({
      providers: [
        provideAgent(REF, {
          apiUrl: '',
          assistantId: 'a',
          transport: new MockAgentTransport(),
          threadId: null,
        }),
      ],
    });
    const agent = TestBed.runInInjectionContext(() => injectAgent(REF));
    expect(TestBed.inject(AGENT_LIFECYCLE)).toBe(agent.lifecycle);
  });

  it('with several refs at one level AGENT_LIFECYCLE follows the last ref', () => {
    const A = createAgentRef<Record<string, unknown>>('lifecycle-a');
    const B = createAgentRef<Record<string, unknown>>('lifecycle-b');
    TestBed.configureTestingModule({
      providers: [
        provideAgent(A, { apiUrl: '', assistantId: 'a', transport: new MockAgentTransport(), threadId: null }),
        provideAgent(B, { apiUrl: '', assistantId: 'b', transport: new MockAgentTransport(), threadId: null }),
      ],
    });
    const b = TestBed.runInInjectionContext(() => injectAgent(B));
    expect(TestBed.inject(AGENT_LIFECYCLE)).toBe(b.lifecycle);
  });
});
