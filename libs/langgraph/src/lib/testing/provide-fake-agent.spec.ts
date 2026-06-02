// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideFakeAgent } from './provide-fake-agent';
import { injectAgent } from '../inject-agent';

describe('provideFakeAgent (langgraph)', () => {
  it('provides an agent that streams the canned tokens into messages()', async () => {
    TestBed.configureTestingModule({
      providers: [provideFakeAgent({ tokens: ['Hi', ' there'], delayMs: 0 })],
    });
    const agent = TestBed.runInInjectionContext(() => injectAgent());
    await TestBed.runInInjectionContext(async () => {
      await agent.submit({ message: 'hello' });
    });
    await new Promise((r) => setTimeout(r, 20));
    const msgs = agent.messages();
    const assistant = msgs.find((m) => m.role === 'assistant');
    expect(assistant?.content).toContain('Hi there');
  });
});
