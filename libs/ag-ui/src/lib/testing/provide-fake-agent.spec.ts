// libs/ag-ui/src/lib/testing/provide-fake-agent.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AGENT } from '../provide-agent';
import { provideFakeAgent } from './provide-fake-agent';

describe('provideFakeAgent', () => {
  it('registers AGENT with a Fake-backed Agent', () => {
    TestBed.configureTestingModule({ providers: provideFakeAgent() });
    const agent = TestBed.inject(AGENT);
    expect(agent).toBeDefined();
    expect(typeof agent.submit).toBe('function');
  });

  it('passes tokens and delayMs through to FakeAgent', () => {
    TestBed.configureTestingModule({
      providers: provideFakeAgent({ tokens: ['a'], delayMs: 1 }),
    });
    const agent = TestBed.inject(AGENT);
    expect(agent).toBeDefined();
  });
});
