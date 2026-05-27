// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAgent } from './agent.provider';
import { injectAgent } from './inject-agent';
import { MockAgentTransport } from './transport/mock-stream.transport';

describe('injectAgent', () => {
  it('returns a LangGraphAgent within an Angular injection context', () => {
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: 'http://localhost/api' })],
    });
    const injected = TestBed.runInInjectionContext(() =>
      injectAgent({
        apiUrl: '',
        assistantId: 'test-assistant',
        transport: new MockAgentTransport(),
      }),
    );
    expect(injected).toBeDefined();
    expect(typeof injected.submit).toBe('function');
    expect(typeof injected.messages).toBe('function');
  });
});
