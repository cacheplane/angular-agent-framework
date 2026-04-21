// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { computed, Signal } from '@angular/core';
import type { BaseMessage } from '@langchain/core/messages';
import type { ToolCallWithResult, Interrupt } from '@langchain/langgraph-sdk';
import type {
  ChatAgent,
  ChatMessage,
  ChatRole,
  ChatStatus,
  ChatToolCall,
  ChatToolCallStatus,
  ChatInterrupt,
  ChatSubagent,
  ChatSubmitInput,
  ChatSubmitOptions,
} from '@cacheplane/chat';
import type { AgentRef, SubagentStreamRef } from './agent.types';
import { ResourceStatus } from './agent.types';

/**
 * Adapts a LangGraph AgentRef to the runtime-neutral ChatAgent contract.
 * The returned object is a live view; it reads from the same signals and
 * writes back via AgentRef.submit / AgentRef.stop.
 *
 * Must be called within an Angular injection context (uses `computed`).
 */
export function toChatAgent<T>(ref: AgentRef<T, any>): ChatAgent {
  const messages = computed<ChatMessage[]>(() =>
    ref.messages().map(toChatMessage),
  );

  const toolCalls = computed<ChatToolCall[]>(() =>
    ref.toolCalls().map(toChatToolCall),
  );

  const status = computed<ChatStatus>(() => mapStatus(ref.status()));

  const state = computed<Record<string, unknown>>(() => {
    const v = ref.value();
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  });

  const interrupt = computed<ChatInterrupt | undefined>(() => {
    const ix = ref.interrupt();
    return ix ? toChatInterrupt(ix) : undefined;
  });

  const subagents = computed<Map<string, ChatSubagent>>(() => {
    const src = ref.subagents();
    const out = new Map<string, ChatSubagent>();
    src.forEach((sa, key) => out.set(key, toChatSubagent(sa)));
    return out;
  });

  return {
    messages,
    status,
    isLoading: ref.isLoading,
    error:     ref.error,
    toolCalls,
    state,
    interrupt,
    subagents,
    submit: (input: ChatSubmitInput, opts?: ChatSubmitOptions) =>
      ref.submit(buildSubmitPayload(input), opts ? { signal: opts.signal } as never : undefined),
    stop: () => ref.stop(),
  };
}

function mapStatus(s: ResourceStatus): ChatStatus {
  switch (s) {
    case ResourceStatus.Error: return 'error';
    case ResourceStatus.Loading:
    case ResourceStatus.Reloading:
      return 'running';
    default:
      return 'idle';
  }
}

function toChatMessage(m: BaseMessage): ChatMessage {
  const raw = m as unknown as Record<string, unknown>;
  const typeVal = typeof m._getType === 'function'
    ? m._getType()
    : (raw['type'] as string | undefined) ?? 'ai';
  const role: ChatRole =
    typeVal === 'human' ? 'user' :
    typeVal === 'tool'  ? 'tool' :
    typeVal === 'system' ? 'system' :
    'assistant';
  return {
    id: (m.id as string | undefined) ?? (raw['id'] as string | undefined) ?? cryptoRandom(),
    role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    toolCallId: raw['tool_call_id'] as string | undefined,
    name: raw['name'] as string | undefined,
    extra: raw,
  };
}

function toChatToolCall(tc: ToolCallWithResult): ChatToolCall {
  const stateMap: Record<string, ChatToolCallStatus> = {
    pending: 'pending',
    completed: 'complete',
    error: 'error',
  };
  const status: ChatToolCallStatus = stateMap[tc.state] ?? 'running';
  const result = tc.result as (Record<string, unknown> | undefined);
  return {
    id: tc.id,
    name: tc.call.name,
    args: tc.call.args,
    status,
    result: result?.['content'],
    error: tc.state === 'error' ? result?.['content'] : undefined,
  };
}

function toChatInterrupt(ix: Interrupt<unknown>): ChatInterrupt {
  const raw = ix as unknown as Record<string, unknown>;
  return {
    id: (raw['id'] as string | undefined) ?? 'interrupt',
    value: raw['value'] ?? ix,
    resumable: true,
  };
}

function toChatSubagent(sa: SubagentStreamRef): ChatSubagent {
  return {
    toolCallId: sa.toolCallId,
    status: sa.status,
    messages: computed(() => sa.messages().map(toChatMessage)) as Signal<ChatMessage[]>,
    state: sa.values as Signal<Record<string, unknown>>,
  };
}

function buildSubmitPayload(input: ChatSubmitInput): unknown {
  if (input.resume !== undefined) return { __resume__: input.resume };
  if (input.message !== undefined) {
    const content = typeof input.message === 'string'
      ? input.message
      : input.message.map((b) => (b.type === 'text' ? b.text : JSON.stringify(b))).join('');
    return { messages: [{ role: 'human', content }], ...(input.state ?? {}) };
  }
  return input.state ?? {};
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2);
}
