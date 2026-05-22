// SPDX-License-Identifier: MIT
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAgent, AGENT_CONFIG, type AgentConfig } from './agent.provider';
import { MockAgentTransport } from './transport/mock-stream.transport';

describe('provideAgent', () => {
  beforeEach(() => {
    globalThis.console.warn = vi.fn();
  });

  it('provides AGENT_CONFIG token', () => {
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: 'https://api.example.com' })],
    });
    const config = TestBed.inject(AGENT_CONFIG);
    expect(config.apiUrl).toBe('https://api.example.com');
  });

  it('provides custom transport via config', () => {
    const transport = new MockAgentTransport();
    TestBed.configureTestingModule({
      providers: [provideAgent({ apiUrl: '', transport })],
    });
    const config = TestBed.inject(AGENT_CONFIG);
    expect(config.transport).toBe(transport);
  });

  it('does not perform license checks because @ngaf/langgraph is MIT-licensed', async () => {
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
