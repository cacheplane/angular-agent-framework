// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { mockAgent } from './mock-agent';
import type { AgentWithHistory } from '../agent';

describe('mockAgent', () => {
  it('starts in idle state with empty messages', () => {
    const agent = mockAgent();
    expect(agent.status()).toBe('idle');
    expect(agent.isLoading()).toBe(false);
    expect(agent.messages()).toEqual([]);
    expect(agent.toolCalls()).toEqual([]);
    expect(agent.state()).toEqual({});
  });

  it('exposes writable signals for test control', () => {
    const agent = mockAgent();
    agent.messages.set([{ id: '1', role: 'user', content: 'hi' }]);
    expect(agent.messages().length).toBe(1);
  });

  it('records submit calls', async () => {
    const agent = mockAgent();
    await agent.submit({ message: 'hello' });
    expect(agent.submitCalls).toEqual([{ input: { message: 'hello' }, opts: undefined }]);
  });

  it('accepts initial state overrides', () => {
    const agent = mockAgent({
      status: 'running',
      messages: [{ id: '1', role: 'user', content: 'hi' }],
    });
    expect(agent.status()).toBe('running');
    expect(agent.messages().length).toBe(1);
  });

  it('provides interrupt and subagents signals when requested', () => {
    const agent = mockAgent({ withInterrupt: true, withSubagents: true });
    expect(agent.interrupt).toBeDefined();
    expect(agent.subagents).toBeDefined();
    expect(agent.interrupt!()).toBeUndefined();
    expect(agent.subagents!().size).toBe(0);
  });
});

describe('mockAgent with history', () => {
  it('exposes history signal when history option supplied', () => {
    const agent = mockAgent({ history: [{ id: 'c1', label: 'start', values: {} }] });
    const withHistory = agent as AgentWithHistory;
    expect(typeof withHistory.history).toBe('function');
    expect(withHistory.history()).toEqual([{ id: 'c1', label: 'start', values: {} }]);
  });

  it('omits history when option absent', () => {
    const agent = mockAgent({});
    expect((agent as Partial<AgentWithHistory>).history).toBeUndefined();
  });
});
