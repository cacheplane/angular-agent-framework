import { describe, it, expect, vi, afterEach } from 'vitest';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createAgentRef } from '@threadplane/chat';
import { provideAgent, injectAgent } from './provide-agent';

afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});

describe('provideAgent — several refs at one injector level', () => {
  it('warns once, naming both refs, and still hands out distinct agents', () => {
    const REF_A = createAgentRef<Record<string, unknown>>('alpha-agent');
    const REF_B = createAgentRef<Record<string, unknown>>('beta-agent');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideAgent(REF_A, { url: 'http://a.example/agent' }),
        provideAgent(REF_B, { url: 'http://b.example/agent' }),
      ],
    });

    const agentA = TestBed.runInInjectionContext(() => injectAgent(REF_A));
    const agentB = TestBed.runInInjectionContext(() => injectAgent(REF_B));

    expect(agentA).not.toBe(agentB);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('alpha-agent');
    expect(message).toContain('beta-agent');
    expect(message).toContain('injectAgent()');
    // The bare token still resolves the LAST ref provided, as the warning says.
    expect(TestBed.runInInjectionContext(() => injectAgent())).toBe(agentB);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn for a single ref at a level', () => {
    const REF = createAgentRef<Record<string, unknown>>('only-agent');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [provideAgent(REF, { url: 'http://single.example/agent' })],
    });

    TestBed.runInInjectionContext(() => injectAgent(REF));
    TestBed.runInInjectionContext(() => injectAgent());

    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn when refs sit at different injector levels', () => {
    const ROOT_REF = createAgentRef<Record<string, unknown>>('root-agent');
    const LEAF_REF = createAgentRef<Record<string, unknown>>('leaf-agent');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    @Component({
      template: '',
      providers: [provideAgent(LEAF_REF, { url: 'http://leaf.example/agent' })],
    })
    class LeafComponent {
      readonly leaf = injectAgent(LEAF_REF);
      readonly root = inject(ROOT_REF.token);
    }

    TestBed.configureTestingModule({
      imports: [LeafComponent],
      providers: [provideAgent(ROOT_REF, { url: 'http://root.example/agent' })],
    });
    const fixture = TestBed.createComponent(LeafComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.leaf).not.toBe(fixture.componentInstance.root);
    expect(warn).not.toHaveBeenCalled();
  });
});
