// SPDX-License-Identifier: MIT
import { computed, signal, type Signal } from '@angular/core';
import type { Agent, AgentSubmitInput, AgentStatus, Message, ToolCall } from '@threadplane/chat';
import { toAgentError } from '@threadplane/chat';
import { EMPTY } from 'rxjs';

/** Tool-call shape exposed by a signal-backed chat resource. */
export interface SignalChatResourceToolCall {
  /** Resource-specific lifecycle state for the tool call. */
  status: 'pending' | 'done';
  /** Tool name shown in Threadplane tool-call UI. */
  name: string;
  /** Stable identifier for linking assistant messages to tool-call details. */
  toolCallId: string;
  /** Parsed tool arguments. */
  args: unknown;
  /** Settled tool result, when the resource exposes one. */
  result?: PromiseSettledResult<unknown>;
}

/** Message shape consumed by the signal-resource adapter. */
export type SignalChatResourceMessage =
  | { role: 'user'; content: unknown }
  | { role: 'assistant'; content?: unknown; toolCalls: SignalChatResourceToolCall[] }
  | { role: 'error'; content: string };

/** Minimal structural contract required to adapt a signal-backed chat resource. */
export interface SignalChatResourceLike {
  /** Current resource message history. */
  value: Signal<SignalChatResourceMessage[]>;
  /** Whether the resource is currently producing a response. */
  isLoading: Signal<boolean>;
  /** Current resource error, if any. */
  error: Signal<Error | undefined>;
  /** Send a new user message. */
  sendMessage: (message: { role: 'user'; content: unknown }) => void;
  /** Stop the current response. Called only while `isLoading()` is true. */
  stop: () => void;
  /** Replace resource message history. Used by `Agent.regenerate()`. */
  setMessages: (messages: SignalChatResourceMessage[]) => void;
  /** Re-run against the current history, if supported by the resource. */
  resendMessages?: () => void;
  /** Reload the resource, used as a fallback for `Agent.regenerate()`. */
  reload?: () => boolean;
}

/**
 * Wrap a signal-backed chat resource in the runtime-neutral Agent contract.
 *
 * @example
 * ```ts
 * import { toAgent } from '@threadplane/signal-resource';
 *
 * const agent = toAgent(resource);
 * ```
 */
export function toAgent(resource: SignalChatResourceLike): Agent {
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
  const serialized = JSON.stringify(content);
  return serialized ?? String(content);
}
