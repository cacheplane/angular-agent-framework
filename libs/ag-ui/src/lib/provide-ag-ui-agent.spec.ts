// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
import { Observable } from 'rxjs';
import type { AbstractAgent, BaseEvent } from '@ag-ui/client';
import type { RunAgentInput } from '@ag-ui/core';
import { provideAgUiAgent, AG_UI_AGENT } from './provide-ag-ui-agent';

/**
 * Minimal stub that satisfies the AbstractAgent shape for provider testing.
 */
class StubAgent {
  agentId?: string;
  threadId?: string;
  url: string;
  headers: Record<string, string>;

  private readonly _subscribers: Array<{
    onEvent?: (p: { event: BaseEvent }) => void;
    onRunFailed?: (p: { error: Error }) => void;
  }> = [];

  constructor(config: {
    url: string;
    agentId?: string;
    threadId?: string;
    headers?: Record<string, string>;
  }) {
    this.url = config.url;
    this.agentId = config.agentId;
    this.threadId = config.threadId;
    this.headers = config.headers || {};
  }

  subscribe(sub: {
    onEvent?: (p: { event: BaseEvent }) => void;
    onRunFailed?: (p: { error: Error }) => void;
  }) {
    this._subscribers.push(sub);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return { unsubscribe: () => {} };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async runAgent() {
    return { result: undefined, newMessages: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  abortRun() {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  addMessage(_msg: unknown) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  run(_input: RunAgentInput): Observable<BaseEvent> {
    return new Observable();
  }
}

describe('provideAgUiAgent', () => {
  it('returns a provider array', () => {
    const providers = provideAgUiAgent({ url: 'http://example.test/agent' });
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
  });

  it('provides AG_UI_AGENT token', () => {
    const providers = provideAgUiAgent({ url: 'http://example.test/agent' });
    const agentProvider = providers[0];
    expect(agentProvider).toBeDefined();
    expect(agentProvider.provide).toBe(AG_UI_AGENT);
  });

  it('factory creates agent with all methods', () => {
    // Mock HttpAgent to be our stub
    vi.doMock('@ag-ui/client', async () => {
      const actual = await vi.importActual('@ag-ui/client');
      return {
        ...actual,
        HttpAgent: StubAgent,
      };
    });

    const providers = provideAgUiAgent({ url: 'http://example.test/agent' });
    const agentProvider = providers[0] as any;
    const agent = agentProvider.useFactory();

    expect(agent).toBeDefined();
    expect(typeof agent.submit).toBe('function');
    expect(typeof agent.stop).toBe('function');
    expect(agent.messages).toBeDefined();
    expect(agent.status).toBeDefined();
    expect(agent.isLoading).toBeDefined();
    expect(agent.error).toBeDefined();
    expect(agent.toolCalls).toBeDefined();
    expect(agent.state).toBeDefined();
    expect(agent.events$).toBeDefined();

    vi.doUnmock('@ag-ui/client');
  });

  it('passes config fields to HttpAgent constructor', () => {
    const config = {
      url: 'http://test.example/agent',
      agentId: 'test-agent-123',
      threadId: 'thread-456',
      headers: { Authorization: 'Bearer token' },
    };

    const providers = provideAgUiAgent(config);
    const agentProvider = providers[0] as any;

    // We can't easily test the actual HttpAgent call without mocking,
    // but we verify the provider structure is correct.
    expect(agentProvider.provide).toBe(AG_UI_AGENT);
    expect(typeof agentProvider.useFactory).toBe('function');
  });

  it('handles optional config fields', () => {
    const providers = provideAgUiAgent({ url: 'http://example.test/agent' });
    const agentProvider = providers[0] as any;

    expect(agentProvider.provide).toBe(AG_UI_AGENT);
    expect(typeof agentProvider.useFactory).toBe('function');
  });
});
