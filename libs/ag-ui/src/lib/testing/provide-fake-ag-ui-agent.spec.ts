// libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AG_UI_AGENT } from '../provide-ag-ui-agent';
import { provideFakeAgUiAgent } from './provide-fake-ag-ui-agent';

describe('provideFakeAgUiAgent', () => {
  it('registers AG_UI_AGENT with a Fake-backed Agent', () => {
    TestBed.configureTestingModule({ providers: provideFakeAgUiAgent() });
    const agent = TestBed.inject(AG_UI_AGENT);
    expect(agent).toBeDefined();
    expect(typeof agent.submit).toBe('function');
  });

  it('passes tokens and delayMs through to FakeAgent', () => {
    TestBed.configureTestingModule({
      providers: provideFakeAgUiAgent({ tokens: ['a'], delayMs: 1 }),
    });
    const agent = TestBed.inject(AG_UI_AGENT);
    expect(agent).toBeDefined();
  });
});
