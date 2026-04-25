// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { computed, effect, Signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import type { BaseMessage } from '@langchain/core/messages';
import type { ToolCallWithResult, Interrupt } from '@langchain/langgraph-sdk';
import type {
  AgentWithHistory, AgentCheckpoint, AgentEvent,
  Message, Role, ToolCall, ToolCallStatus, AgentStatus,
  AgentInterrupt, Subagent, AgentSubmitInput, AgentSubmitOptions,
} from '@cacheplane/chat';
import type { AgentRef, CustomStreamEvent, SubagentStreamRef, ThreadState } from './agent.types';
import { ResourceStatus } from './agent.types';

/**
 * Adapts a LangGraph AgentRef to the runtime-neutral Agent contract.
 * The returned object is a live view; it reads from the same signals and
 * writes back via AgentRef.submit / AgentRef.stop.
 *
 * Must be called within an Angular injection context (uses `computed` and
 * `effect`).
 */
export function toAgent<T>(ref: AgentRef<T, any>): AgentWithHistory {
  const messages = computed<Message[]>(() =>
    ref.messages().map(toMessage),
  );

  const toolCalls = computed<ToolCall[]>(() =>
    ref.toolCalls().map(toToolCall),
  );

  const status = computed<AgentStatus>(() => mapStatus(ref.status()));

  const state = computed<Record<string, unknown>>(() => {
    const v = ref.value();
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  });

  const interrupt = computed<AgentInterrupt | undefined>(() => {
    const ix = ref.interrupt();
    return ix ? toInterrupt(ix) : undefined;
  });

  const subagents = computed<Map<string, Subagent>>(() => {
    const src = ref.subagents();
    const out = new Map<string, Subagent>();
    src.forEach((sa, key) => out.set(key, toSubagent(sa)));
    return out;
  });

  const events$ = buildEvents$(ref);

  const history = computed<AgentCheckpoint[]>(() =>
    ref.history().map(toCheckpoint),
  );

  return {
    messages,
    status,
    isLoading: ref.isLoading,
    error:     ref.error,
    toolCalls,
    state,
    interrupt,
    subagents,
    events$,
    history,
    submit: (input: AgentSubmitInput, opts?: AgentSubmitOptions) =>
      ref.submit(buildSubmitPayload(input), opts ? { signal: opts.signal } as never : undefined),
    stop: () => ref.stop(),
  };
}

/**
 * Build an Observable<AgentEvent> that bridges LangGraph's
 * `Signal<CustomStreamEvent[]>` (append-only array) into a stream of newly
 * emitted events. Each effect firing compares against a cursor tracking the
 * previously-seen length and emits only the tail slice.
 */
function buildEvents$(
  ref: AgentRef<unknown, any>,
): Observable<AgentEvent> {
  const subject = new Subject<AgentEvent>();
  let seen = 0;
  effect(() => {
    const all = ref.customEvents();
    if (all.length < seen) {
      // Stream reset (new session, thread switch, etc.). Rewind cursor.
      seen = 0;
    }
    for (let i = seen; i < all.length; i++) {
      subject.next(toAgentEvent(all[i]));
    }
    seen = all.length;
  });
  return subject.asObservable();
}

function toAgentEvent(e: CustomStreamEvent): AgentEvent {
  if (e.name === 'state_update' && isRecord(e.data)) {
    return { type: 'state_update', data: e.data };
  }
  return { type: 'custom', name: e.name, data: e.data };
}

function mapStatus(s: ResourceStatus): AgentStatus {
  switch (s) {
    case ResourceStatus.Error: return 'error';
    case ResourceStatus.Loading:
    case ResourceStatus.Reloading:
      return 'running';
    default:
      return 'idle';
  }
}

function toMessage(m: BaseMessage): Message {
  const raw = m as unknown as Record<string, unknown>;
  const typeVal = typeof m._getType === 'function'
    ? m._getType()
    : (raw['type'] as string | undefined) ?? 'ai';
  const role: Role =
    typeVal === 'human' ? 'user' :
    typeVal === 'tool'  ? 'tool' :
    typeVal === 'system' ? 'system' :
    'assistant';
  return {
    id: (m.id as string | undefined) ?? (raw['id'] as string | undefined) ?? randomId(),
    role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    toolCallId: raw['tool_call_id'] as string | undefined,
    name: raw['name'] as string | undefined,
    extra: raw,
  };
}

function toToolCall(tc: ToolCallWithResult): ToolCall {
  const stateMap: Record<string, ToolCallStatus> = {
    pending: 'pending',
    completed: 'complete',
    error: 'error',
  };
  const status: ToolCallStatus = stateMap[tc.state] ?? 'running';
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

function toInterrupt(ix: Interrupt<unknown>): AgentInterrupt {
  const raw = ix as unknown as Record<string, unknown>;
  return {
    id: (raw['id'] as string | undefined) ?? randomId(),
    value: raw['value'] ?? ix,
    resumable: true,
  };
}

function toSubagent(sa: SubagentStreamRef): Subagent {
  return {
    toolCallId: sa.toolCallId,
    status: sa.status,
    messages: computed(() => sa.messages().map(toMessage)) as Signal<Message[]>,
    state: sa.values as Signal<Record<string, unknown>>,
  };
}

function buildSubmitPayload(input: AgentSubmitInput): unknown {
  if (input.resume !== undefined) return { __resume__: input.resume };
  if (input.message !== undefined) {
    const content = typeof input.message === 'string'
      ? input.message
      : input.message.map((b: any) => (b.type === 'text' ? b.text : JSON.stringify(b))).join('');
    return { messages: [{ role: 'human', content }], ...(input.state ?? {}) };
  }
  return input.state ?? {};
}

function randomId(): string {
  return Math.random().toString(36).slice(2);
}

function toCheckpoint(state: ThreadState<unknown>): AgentCheckpoint {
  return {
    id:    state.checkpoint?.checkpoint_id ?? undefined,
    label: state.next?.[0] ?? undefined,
    values: isRecord(state.values) ? state.values : {},
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
