// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { runAgentConformance } from '@threadplane/chat/testing';
import { toAgent, type SignalChatResourceMessage } from './to-agent';
import { makeFakeSignalChatResource } from '../testing/fake-signal-chat-resource';

describe('toAgent', () => {
  runAgentConformance('signal-resource toAgent', () => {
    return toAgent(makeFakeSignalChatResource().resource);
  });

  it('maps resource messages and tool calls to the Agent contract', () => {
    const fixture = makeFakeSignalChatResource({
      messages: [
        { role: 'user', content: 'hello' },
        {
          role: 'assistant',
          content: 'checking',
          toolCalls: [
            {
              status: 'pending',
              name: 'lookup',
              toolCallId: 'tool-1',
              args: { city: 'Paris' },
            },
            {
              status: 'done',
              name: 'weather',
              toolCallId: 'tool-2',
              args: { city: 'Paris' },
              result: { status: 'fulfilled', value: { temp: 72 } },
            },
            {
              status: 'done',
              name: 'alerts',
              toolCallId: 'tool-3',
              args: { city: 'Paris' },
              result: { status: 'rejected', reason: new Error('offline') },
            },
          ],
        },
        { role: 'error', content: 'model failed' },
      ],
    });

    const agent = toAgent(fixture.resource);

    expect(agent.messages()).toEqual([
      { id: 'resource-message-0', role: 'user', content: 'hello' },
      {
        id: 'resource-message-1',
        role: 'assistant',
        content: 'checking',
        toolCallIds: ['tool-1', 'tool-2', 'tool-3'],
      },
      {
        id: 'resource-message-2',
        role: 'assistant',
        content: 'model failed',
      },
    ]);
    expect(agent.toolCalls()).toEqual([
      {
        id: 'tool-1',
        name: 'lookup',
        args: { city: 'Paris' },
        status: 'running',
      },
      {
        id: 'tool-2',
        name: 'weather',
        args: { city: 'Paris' },
        status: 'complete',
        result: { temp: 72 },
      },
      {
        id: 'tool-3',
        name: 'alerts',
        args: { city: 'Paris' },
        status: 'error',
        error: expect.any(Error),
      },
    ]);
  });

  it('derives status from loading and error signals', () => {
    const fixture = makeFakeSignalChatResource();
    const agent = toAgent(fixture.resource);

    expect(agent.status()).toBe('idle');
    fixture.isLoading.set(true);
    expect(agent.status()).toBe('running');
    fixture.isLoading.set(false);
    fixture.error.set(new Error('HTTP 500'));
    expect(agent.status()).toBe('error');
    expect(agent.error()?.status).toBe(500);
  });

  it('submits string user messages to the resource', async () => {
    const fixture = makeFakeSignalChatResource();
    const agent = toAgent(fixture.resource);

    await agent.submit({ message: 'hello' });

    expect(fixture.sent).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('does not submit when message is undefined', async () => {
    const fixture = makeFakeSignalChatResource();
    const agent = toAgent(fixture.resource);

    await agent.submit({});

    expect(fixture.sent).toEqual([]);
  });

  it('does not call resource stop while idle', async () => {
    const fixture = makeFakeSignalChatResource();
    const agent = toAgent(fixture.resource);

    await expect(agent.stop()).resolves.toBeUndefined();

    expect(fixture.stopCount).toBe(0);
  });

  it('delegates stop while loading', async () => {
    const fixture = makeFakeSignalChatResource({ isLoading: true });
    const agent = toAgent(fixture.resource);

    await agent.stop();

    expect(fixture.stopCount).toBe(1);
  });

  it('delegates retry when the resource supports resend', async () => {
    const fixture = makeFakeSignalChatResource({ withResend: true });
    const agent = toAgent(fixture.resource);

    await agent.retry();

    expect(fixture.resendCount).toBe(1);
  });

  it('does not throw on retry when resend is unavailable', async () => {
    const fixture = makeFakeSignalChatResource();
    const agent = toAgent(fixture.resource);

    await expect(agent.retry()).resolves.toBeUndefined();
  });

  it('throws when regenerating while loading', async () => {
    const fixture = makeFakeSignalChatResource({
      isLoading: true,
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi', toolCalls: [] },
      ],
    });
    const agent = toAgent(fixture.resource);

    await expect(agent.regenerate(1)).rejects.toThrow(
      'Cannot regenerate while agent is loading another response',
    );
  });

  it('throws when regenerating a non-assistant message', async () => {
    const fixture = makeFakeSignalChatResource({
      messages: [{ role: 'user', content: 'hello' }],
    });
    const agent = toAgent(fixture.resource);

    await expect(agent.regenerate(0)).rejects.toThrow(
      'Message at index 0 is not an assistant message',
    );
  });

  it('throws when regenerating an assistant message without a previous user message', async () => {
    const fixture = makeFakeSignalChatResource({
      messages: [{ role: 'assistant', content: 'hello', toolCalls: [] }],
    });
    const agent = toAgent(fixture.resource);

    await expect(agent.regenerate(0)).rejects.toThrow(
      'No user message found before the target assistant message',
    );
  });

  it('trims through the previous user message and resends on regenerate', async () => {
    const messages: SignalChatResourceMessage[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'first answer', toolCalls: [] },
      { role: 'user', content: 'second' },
      { role: 'assistant', content: 'second answer', toolCalls: [] },
    ];
    const fixture = makeFakeSignalChatResource({ messages, withResend: true });
    const agent = toAgent(fixture.resource);

    await agent.regenerate(3);

    expect(fixture.setMessagesCalls).toEqual([
      [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'first answer', toolCalls: [] },
        { role: 'user', content: 'second' },
      ],
    ]);
    expect(fixture.resendCount).toBe(1);
  });

  it('falls back to reload on regenerate when resend is unavailable', async () => {
    const messages: SignalChatResourceMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi', toolCalls: [] },
    ];
    const fixture = makeFakeSignalChatResource({ messages, withReload: true });
    const agent = toAgent(fixture.resource);

    await agent.regenerate(1);

    expect(fixture.setMessagesCalls).toEqual([[{ role: 'user', content: 'hello' }]]);
    expect(fixture.reloadCount).toBe(1);
  });

  it('serializes non-string message content deterministically', () => {
    const fixture = makeFakeSignalChatResource({
      messages: [
        { role: 'user', content: { nested: ['value'] } },
        { role: 'assistant', content: { answer: 42 }, toolCalls: [] },
      ],
    });
    const agent = toAgent(fixture.resource);

    expect(agent.messages()).toEqual([
      {
        id: 'resource-message-0',
        role: 'user',
        content: '{"nested":["value"]}',
      },
      {
        id: 'resource-message-1',
        role: 'assistant',
        content: '{"answer":42}',
        toolCallIds: [],
      },
    ]);
  });
});
