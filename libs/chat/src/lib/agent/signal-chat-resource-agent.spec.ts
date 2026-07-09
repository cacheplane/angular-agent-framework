// SPDX-License-Identifier: MIT
import { signal, type Signal, type WritableSignal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { runAgentConformance } from '@threadplane/chat/testing';
import { toSignalChatResourceAgent } from './signal-chat-resource-agent';

interface ResourceToolCall {
  status: 'pending' | 'done';
  name: string;
  toolCallId: string;
  args: unknown;
  result?: PromiseSettledResult<unknown>;
}

type ResourceMessage =
  | { role: 'user'; content: unknown }
  | { role: 'assistant'; content?: unknown; toolCalls: ResourceToolCall[] }
  | { role: 'error'; content: string };

interface FakeSignalChatResource {
  value: Signal<ResourceMessage[]>;
  isLoading: Signal<boolean>;
  error: Signal<Error | undefined>;
  sendMessage: (message: { role: 'user'; content: unknown }) => void;
  stop: () => void;
  setMessages: (messages: ResourceMessage[]) => void;
  resendMessages?: () => void;
}

function makeResource(options: {
  messages?: ResourceMessage[];
  isLoading?: boolean;
  error?: Error;
  withResend?: boolean;
} = {}) {
  const messages = signal<ResourceMessage[]>(options.messages ?? []);
  const isLoading = signal(options.isLoading ?? false);
  const error = signal<Error | undefined>(options.error);
  const sent: Array<{ role: 'user'; content: unknown }> = [];
  const setMessagesCalls: ResourceMessage[][] = [];
  let stopCount = 0;
  let resendCount = 0;

  const resource: FakeSignalChatResource = {
    value: messages.asReadonly(),
    isLoading: isLoading.asReadonly(),
    error: error.asReadonly(),
    sendMessage: (message) => {
      sent.push(message);
      messages.update((prev) => [...prev, message]);
    },
    stop: () => {
      if (!isLoading()) throw new Error('Cannot stop when idle');
      stopCount++;
      isLoading.set(false);
    },
    setMessages: (next) => {
      setMessagesCalls.push(next);
      messages.set(next);
    },
    ...(options.withResend
      ? {
          resendMessages: () => {
            resendCount++;
          },
        }
      : {}),
  };

  return {
    resource,
    messages: messages as WritableSignal<ResourceMessage[]>,
    isLoading,
    error,
    sent,
    setMessagesCalls,
    get stopCount() {
      return stopCount;
    },
    get resendCount() {
      return resendCount;
    },
  };
}

describe('toSignalChatResourceAgent', () => {
  runAgentConformance('toSignalChatResourceAgent', () => {
    return toSignalChatResourceAgent(makeResource().resource);
  });

  it('maps resource messages and tool calls to the Agent contract', () => {
    const fixture = makeResource({
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

    const agent = toSignalChatResourceAgent(fixture.resource);

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
    const fixture = makeResource();
    const agent = toSignalChatResourceAgent(fixture.resource);

    expect(agent.status()).toBe('idle');
    fixture.isLoading.set(true);
    expect(agent.status()).toBe('running');
    fixture.isLoading.set(false);
    fixture.error.set(new Error('HTTP 500'));
    expect(agent.status()).toBe('error');
    expect(agent.error()?.status).toBe(500);
  });

  it('submits string user messages to the resource', async () => {
    const fixture = makeResource();
    const agent = toSignalChatResourceAgent(fixture.resource);

    await agent.submit({ message: 'hello' });

    expect(fixture.sent).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('does not call resource stop while idle', async () => {
    const fixture = makeResource();
    const agent = toSignalChatResourceAgent(fixture.resource);

    await expect(agent.stop()).resolves.toBeUndefined();

    expect(fixture.stopCount).toBe(0);
  });

  it('delegates stop while loading', async () => {
    const fixture = makeResource({ isLoading: true });
    const agent = toSignalChatResourceAgent(fixture.resource);

    await agent.stop();

    expect(fixture.stopCount).toBe(1);
  });

  it('delegates retry when the resource supports resend', async () => {
    const fixture = makeResource({ withResend: true });
    const agent = toSignalChatResourceAgent(fixture.resource);

    await agent.retry();

    expect(fixture.resendCount).toBe(1);
  });

  it('trims through the previous user message and resends on regenerate', async () => {
    const messages: ResourceMessage[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'first answer', toolCalls: [] },
      { role: 'user', content: 'second' },
      { role: 'assistant', content: 'second answer', toolCalls: [] },
    ];
    const fixture = makeResource({ messages, withResend: true });
    const agent = toSignalChatResourceAgent(fixture.resource);

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

  it('throws when regenerating a non-assistant message', async () => {
    const fixture = makeResource({
      messages: [{ role: 'user', content: 'hello' }],
    });
    const agent = toSignalChatResourceAgent(fixture.resource);

    await expect(agent.regenerate(0)).rejects.toThrow(
      'Message at index 0 is not an assistant message',
    );
  });
});
