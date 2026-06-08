// SPDX-License-Identifier: MIT
import { TestBed } from '@angular/core/testing';
import { provideAgent, AGENT } from './agent.provider';
import { injectAgent } from './inject-agent';
import { MockAgentTransport } from './transport/mock-stream.transport';

describe('injectAgent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAgent({
          apiUrl: 'http://localhost/api',
          assistantId: 'test-assistant',
          transport: new MockAgentTransport(),
        }),
      ],
    });
  });

  it('returns the singleton LangGraph agent provided via provideAgent', () => {
    const agent = TestBed.runInInjectionContext(() => injectAgent());
    expect(agent).toBeDefined();
    // The AGENT token resolves to whatever provideAgent's useFactory returned.
    const tokenValue = TestBed.inject(AGENT);
    expect(agent).toBe(tokenValue);
  });

  it('returns the same Agent across multiple injectAgent() calls (singleton)', () => {
    const a1 = TestBed.runInInjectionContext(() => injectAgent());
    const a2 = TestBed.runInInjectionContext(() => injectAgent());
    expect(a1).toBe(a2);
  });
});
