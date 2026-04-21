// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { mockChatAgent } from './mock-chat-agent';

describe('mockChatAgent', () => {
  it('starts in idle state with empty messages', () => {
    const agent = mockChatAgent();
    expect(agent.status()).toBe('idle');
    expect(agent.isLoading()).toBe(false);
    expect(agent.messages()).toEqual([]);
    expect(agent.toolCalls()).toEqual([]);
    expect(agent.state()).toEqual({});
  });

  it('exposes writable signals for test control', () => {
    const agent = mockChatAgent();
    agent.messages.set([{ id: '1', role: 'user', content: 'hi' }]);
    expect(agent.messages().length).toBe(1);
  });

  it('records submit calls', async () => {
    const agent = mockChatAgent();
    await agent.submit({ message: 'hello' });
    expect(agent.submitCalls).toEqual([{ input: { message: 'hello' }, opts: undefined }]);
  });

  it('accepts initial state overrides', () => {
    const agent = mockChatAgent({
      status: 'running',
      messages: [{ id: '1', role: 'user', content: 'hi' }],
    });
    expect(agent.status()).toBe('running');
    expect(agent.messages().length).toBe(1);
  });

  it('provides interrupt and subagents signals when requested', () => {
    const agent = mockChatAgent({ withInterrupt: true, withSubagents: true });
    expect(agent.interrupt).toBeDefined();
    expect(agent.subagents).toBeDefined();
    expect(agent.interrupt!()).toBeUndefined();
    expect(agent.subagents!().size).toBe(0);
  });
});
