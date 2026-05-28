// SPDX-License-Identifier: MIT
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAgent, AGENT_CONFIG, AGENT, type AgentConfig } from './agent.provider';
import { MockAgentTransport } from './transport/mock-stream.transport';

describe('provideAgent', () => {
  beforeEach(() => {
    globalThis.console.warn = vi.fn();
  });

  it('registers AGENT_CONFIG internally for the legacy factory defaults-merge path', () => {
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: 'https://api.example.com' })],
    });
    const config = TestBed.inject(AGENT_CONFIG);
    expect(config.apiUrl).toBe('https://api.example.com');
  });

  it('forwards custom transport through the internal AGENT_CONFIG entry', () => {
    const transport = new MockAgentTransport();
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: '', transport })],
    });
    const config = TestBed.inject(AGENT_CONFIG);
    expect(config.transport).toBe(transport);
  });

  it('provides AGENT singleton constructed from config', () => {
    const transport = new MockAgentTransport();
    TestBed.configureTestingModule({
      providers: [
        provideAgent({
          apiUrl: '',
          assistantId: 'test-graph',
          transport,
        }),
      ],
    });
    const ag = TestBed.inject(AGENT);
    expect(ag).toBeDefined();
    // LangGraphAgent has a `submit` function and `messages` / `value` signals.
    expect(typeof ag.submit).toBe('function');
    expect(typeof ag.value).toBe('function');
    expect(typeof ag.messages).toBe('function');
  });

  it('returns the same AGENT instance across injections (singleton)', () => {
    TestBed.configureTestingModule({
      providers: [
        provideAgent({
          apiUrl: '',
          assistantId: 'test-graph',
          transport: new MockAgentTransport(),
        }),
      ],
    });
    const first = TestBed.inject(AGENT);
    const second = TestBed.inject(AGENT);
    expect(first).toBe(second);
  });

  it('throws when AGENT is injected without an assistantId in config', () => {
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: 'http://localhost' })],
    });
    expect(() =>
      TestBed.runInInjectionContext(() => TestBed.inject(AGENT)),
    ).toThrow(/`assistantId` is required to construct the AGENT singleton/);
  });

  it('accepts a factory that resolves config inside an injection context', () => {
    const transport = new MockAgentTransport();
    // The factory form lets config depend on runtime/DI state. Here we prove
    // the factory runs (the returned config drives the AGENT singleton) and is
    // invoked exactly once.
    let calls = 0;
    TestBed.configureTestingModule({
      providers: [
        provideAgent(() => {
          calls += 1;
          return { apiUrl: '', assistantId: 'factory-graph', transport };
        }),
      ],
    });
    const config = TestBed.inject(AGENT_CONFIG);
    expect(config.assistantId).toBe('factory-graph');
    const ag = TestBed.inject(AGENT);
    expect(typeof ag.submit).toBe('function');
    // AGENT reads the already-resolved AGENT_CONFIG, so the factory ran once.
    expect(calls).toBe(1);
  });

  it('does not perform license checks because @threadplane/langgraph is MIT-licensed', async () => {
    const warn = globalThis.console.warn as ReturnType<typeof vi.fn>;
    const legacyLicenseConfig = {
      apiUrl: '',
      license: 'invalid-token',
      __licenseEnvHint: { isNoncommercial: false },
    } as unknown as AgentConfig;

    TestBed.configureTestingModule({
      providers: [provideAgent(legacyLicenseConfig)],
    });
    TestBed.inject(AGENT_CONFIG);
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).not.toHaveBeenCalled();
  });
});
