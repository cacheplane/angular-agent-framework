// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal, WritableSignal } from '@angular/core';
import type {
  ChatAgent,
  ChatMessage,
  ChatStatus,
  ChatToolCall,
  ChatInterrupt,
  ChatSubagent,
  ChatSubmitInput,
  ChatSubmitOptions,
} from '../agent';

export interface MockChatAgent extends ChatAgent {
  messages:  WritableSignal<ChatMessage[]>;
  status:    WritableSignal<ChatStatus>;
  isLoading: WritableSignal<boolean>;
  error:     WritableSignal<unknown>;
  toolCalls: WritableSignal<ChatToolCall[]>;
  state:     WritableSignal<Record<string, unknown>>;
  interrupt?: WritableSignal<ChatInterrupt | undefined>;
  subagents?: WritableSignal<Map<string, ChatSubagent>>;
  /** Captured calls to submit() in order. */
  submitCalls: Array<{ input: ChatSubmitInput; opts?: ChatSubmitOptions }>;
  /** Count of stop() invocations. */
  stopCount: number;
}

export interface MockChatAgentOptions {
  messages?: ChatMessage[];
  status?: ChatStatus;
  isLoading?: boolean;
  error?: unknown;
  toolCalls?: ChatToolCall[];
  state?: Record<string, unknown>;
  withInterrupt?: boolean;
  withSubagents?: boolean;
}

export function mockChatAgent(opts: MockChatAgentOptions = {}): MockChatAgent {
  const messages  = signal<ChatMessage[]>(opts.messages ?? []);
  const status    = signal<ChatStatus>(opts.status ?? 'idle');
  const isLoading = signal<boolean>(opts.isLoading ?? false);
  const error     = signal<unknown>(opts.error ?? null);
  const toolCalls = signal<ChatToolCall[]>(opts.toolCalls ?? []);
  const state     = signal<Record<string, unknown>>(opts.state ?? {});

  const interrupt = opts.withInterrupt
    ? signal<ChatInterrupt | undefined>(undefined)
    : undefined;
  const subagents = opts.withSubagents
    ? signal<Map<string, ChatSubagent>>(new Map())
    : undefined;

  const submitCalls: MockChatAgent['submitCalls'] = [];
  let stopCount = 0;

  const agent: MockChatAgent = {
    messages, status, isLoading, error, toolCalls, state,
    ...(interrupt ? { interrupt } : {}),
    ...(subagents ? { subagents } : {}),
    submit: async (input, opts) => { submitCalls.push({ input, opts }); },
    stop: async () => { stopCount++; },
    submitCalls,
    get stopCount() { return stopCount; },
  };

  return agent;
}
