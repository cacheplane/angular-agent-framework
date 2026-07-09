// SPDX-License-Identifier: MIT
import { computed, signal, type Signal } from '@angular/core';
import { EMPTY } from 'rxjs';
import type { Agent } from './agent';
import type { Message } from './message';
import type { ToolCall } from './tool-call';
import type { AgentStatus } from './agent-status';
import type { AgentSubmitInput } from './agent-submit';
import { toAgentError } from './to-agent-error';

interface SignalChatResourceToolCall {
  status: 'pending' | 'done';
  name: string;
  toolCallId: string;
  args: unknown;
  result?: PromiseSettledResult<unknown>;
}

type SignalChatResourceMessage =
  | { role: 'user'; content: unknown }
  | { role: 'assistant'; content?: unknown; toolCalls: SignalChatResourceToolCall[] }
  | { role: 'error'; content: string };

interface SignalChatResourceLike {
  value: Signal<SignalChatResourceMessage[]>;
  isLoading: Signal<boolean>;
  error: Signal<Error | undefined>;
  sendMessage: (message: { role: 'user'; content: unknown }) => void;
  stop: () => void;
  setMessages: (messages: SignalChatResourceMessage[]) => void;
  resendMessages?: () => void;
  reload?: () => boolean;
}

/**
 * Wrap a signal-backed chat resource in the runtime-neutral Agent contract.
 */
export function toSignalChatResourceAgent(resource: SignalChatResourceLike): Agent {
  const messages = computed<Message[]>(() => {
    return resource.value().map((message, index) => toAgentMessage(message, index));
  });

  const toolCalls = computed<ToolCall[]>(() => {
    return resource.value().flatMap((message) => {
      if (message.role !== 'assistant') return [];
      return message.toolCalls.map(toAgentToolCall);
    });
  });

  const isLoading = computed(() => resource.isLoading());
  const error = computed(() => {
    const raw = resource.error();
    return raw ? toAgentError(raw) : undefined;
  });
  const status = computed<AgentStatus>(() => {
    if (isLoading()) return 'running';
    if (error()) return 'error';
    return 'idle';
  });

  return {
    messages,
    status,
    isLoading,
    error,
    toolCalls,
    state: signal<Record<string, unknown>>({}).asReadonly(),
    events$: EMPTY,
    submit: async (input: AgentSubmitInput) => {
      if (input.message === undefined) return;
      resource.sendMessage({ role: 'user', content: input.message });
    },
    stop: async () => {
      if (!resource.isLoading()) return;
      resource.stop();
    },
    retry: async () => {
      resource.resendMessages?.();
    },
    regenerate: async (assistantMessageIndex: number) => {
      if (resource.isLoading()) {
        throw new Error('Cannot regenerate while agent is loading another response');
      }
      const current = resource.value();
      const target = current[assistantMessageIndex];
      if (!target || target.role !== 'assistant') {
        throw new Error(`Message at index ${assistantMessageIndex} is not an assistant message`);
      }
      const userIdx = current
        .slice(0, assistantMessageIndex)
        .map((m, i) => ({ m, i }))
        .reverse()
        .find(({ m }) => m.role === 'user')?.i;
      if (userIdx === undefined) {
        throw new Error('No user message found before the target assistant message');
      }
      resource.setMessages(current.slice(0, userIdx + 1));
      if (resource.resendMessages) {
        resource.resendMessages();
      } else {
        resource.reload?.();
      }
    },
  };
}

function toAgentMessage(message: SignalChatResourceMessage, index: number): Message {
  const id = `resource-message-${index}`;
  switch (message.role) {
    case 'user':
      return { id, role: 'user', content: normalizeContent(message.content) };
    case 'assistant':
      return {
        id,
        role: 'assistant',
        content: normalizeContent(message.content ?? ''),
        toolCallIds: message.toolCalls.map((toolCall) => toolCall.toolCallId),
      };
    case 'error':
      return { id, role: 'assistant', content: message.content };
  }
}

function toAgentToolCall(toolCall: SignalChatResourceToolCall): ToolCall {
  if (toolCall.status === 'pending') {
    return {
      id: toolCall.toolCallId,
      name: toolCall.name,
      args: toolCall.args,
      status: 'running',
    };
  }

  if (toolCall.result?.status === 'rejected') {
    return {
      id: toolCall.toolCallId,
      name: toolCall.name,
      args: toolCall.args,
      status: 'error',
      error: toolCall.result.reason,
    };
  }

  return {
    id: toolCall.toolCallId,
    name: toolCall.name,
    args: toolCall.args,
    status: 'complete',
    result: toolCall.result?.value,
  };
}

function normalizeContent(content: unknown): Message['content'] {
  if (typeof content === 'string') return content;
  if (content === undefined) return '';
  return JSON.stringify(content);
}
