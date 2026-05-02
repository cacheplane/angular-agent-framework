// SPDX-License-Identifier: MIT
import {
  inject, DestroyRef, computed, effect,
  isSignal, Signal,
} from '@angular/core';
import { AGENT_CONFIG } from './agent.provider';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Subject, of,
  throttleTime, asyncScheduler,
} from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import type { BaseMessage, AIMessage as CoreAIMessage } from '@langchain/core/messages';
import type { Interrupt, ToolCallWithResult } from '@langchain/langgraph-sdk';
import type { BagTemplate, InferBag } from '@langchain/langgraph-sdk';
import type {
  AgentEvent,
  AgentCheckpoint,
  AgentInterrupt,
  AgentStatus,
  Message,
  Role,
  Subagent,
  ToolCall,
  ToolCallStatus,
  ContentBlock,
  AgentSubmitInput,
  AgentSubmitOptions,
} from '@ngaf/chat';

import {
  AgentOptions,
  LangGraphAgent,
  CustomStreamEvent,
  StreamSubjects,
  SubagentStreamRef,
  ResourceStatus,
  AgentQueue,
  LangGraphSubmitOptions,
} from './agent.types';
import type { ThreadState, ToolProgress } from '@langchain/langgraph-sdk';
import type { MessageMetadata } from '@langchain/langgraph-sdk/ui';
import { createStreamManagerBridge } from './internals/stream-manager.bridge';
import { buildBranchTree } from './internals/branch-tree';

/**
 * Creates a streaming resource connected to a LangGraph agent.
 *
 * Must be called within an Angular injection context (component constructor,
 * field initializer, or `runInInjectionContext`). Returns a unified
 * {@link LangGraphAgent} whose properties are Angular Signals that update
 * in real-time as the agent streams.
 *
 * @typeParam T - The state shape returned by the agent (e.g., `{ messages: BaseMessage[] }`)
 * @typeParam Bag - Optional bag template for typed interrupts and submit payloads
 * @param options - Configuration for the streaming resource
 * @returns A {@link LangGraphAgent} with reactive signals and action methods
 *
 * @example
 * ```typescript
 * // In a component field initializer
 * const chat = agent<{ messages: BaseMessage[] }>({
 *   assistantId: 'chat_agent',
 *   apiUrl: 'http://localhost:2024',
 *   threadId: signal(this.savedThreadId),
 *   onThreadId: (id) => localStorage.setItem('threadId', id),
 * });
 *
 * // Access signals in template
 * // chat.messages(), chat.status(), chat.error()
 * ```
 */
export function agent<
  T = Record<string, unknown>,
  Bag extends BagTemplate = BagTemplate,
>(
  options: AgentOptions<T, InferBag<T, Bag>>,
): LangGraphAgent<T, InferBag<T, Bag>> {
  // Injection context required
  const destroyRef   = inject(DestroyRef);
  const globalConfig = inject(AGENT_CONFIG, { optional: true });
  const destroy$     = new Subject<void>();
  destroyRef.onDestroy(() => { destroy$.next(); destroy$.complete(); });

  // Merge: call-site options take precedence over global provider config
  const apiUrl    = options.apiUrl    ?? globalConfig?.apiUrl    ?? '';
  const transport = options.transport ?? globalConfig?.transport;

  const init = (options.initialValues ?? {}) as T;

  // All subjects created before the bridge
  const status$          = new BehaviorSubject<ResourceStatus>(ResourceStatus.Idle);
  const values$          = new BehaviorSubject<T>(init);
  const messages$        = new BehaviorSubject<BaseMessage[]>([]);
  const error$           = new BehaviorSubject<unknown>(undefined);
  const interrupt$       = new BehaviorSubject<Interrupt<InferBag<T, Bag>['InterruptType']> | undefined>(undefined);
  const interrupts$      = new BehaviorSubject<Interrupt<InferBag<T, Bag>['InterruptType']>[]>([]);
  const branch$          = new BehaviorSubject<string>('');
  const history$         = new BehaviorSubject<ThreadState<T>[]>([]);
  const isThreadLoading$ = new BehaviorSubject<boolean>(false);
  const toolProgress$    = new BehaviorSubject<ToolProgress[]>([]);
  const toolCalls$       = new BehaviorSubject<ToolCallWithResult[]>([]);
  const messageMetadata$ = new BehaviorSubject<Map<string, MessageMetadata<Record<string, unknown>>>>(new Map());
  const subagents$       = new BehaviorSubject<Map<string, SubagentStreamRef>>(new Map());
  const queue$           = new BehaviorSubject<AgentQueue>({
    entries: [],
    size: 0,
    cancel: async () => false,
    clear: async () => undefined,
  });
  const custom$          = new BehaviorSubject<CustomStreamEvent[]>([]);
  const hasValue$        = new BehaviorSubject<boolean>(false);

  function resetDerivedThreadState(): void {
    status$.next(ResourceStatus.Idle);
    error$.next(undefined);
    hasValue$.next(false);
  }

  // Track hasValue — becomes true once values or messages arrive
  values$.pipe(takeUntil(destroy$)).subscribe(v => {
    if (v != null && Object.keys(v as object).length > 0) hasValue$.next(true);
  });
  messages$.pipe(takeUntil(destroy$)).subscribe(m => { if (m.length > 0) hasValue$.next(true); });

  const subjects: StreamSubjects<T, InferBag<T, Bag>> = {
    status$, values$, messages$, error$,
    interrupt$, interrupts$, branch$, history$,
    isThreadLoading$, toolProgress$, toolCalls$, messageMetadata$, subagents$, queue$, custom$,
  };

  // threadId$ — resolved before bridge creation (injection context required for toObservable)
  const threadId$ = isSignal(options.threadId)
    ? toObservable(options.threadId as Signal<string | null>)
    : of((options.threadId as string | null | undefined) ?? null);

  let hasSeenThreadId = false;
  let lastThreadId: string | null = null;
  threadId$.pipe(takeUntil(destroy$)).subscribe((id) => {
    if (hasSeenThreadId && lastThreadId !== id) {
      resetDerivedThreadState();
    }
    hasSeenThreadId = true;
    lastThreadId = id;
  });

  const manager = createStreamManagerBridge({
    options: { ...options, apiUrl, transport },
    subjects,
    threadId$,
    destroy$: destroy$.asObservable(),
  });

  // Throttle helper — default 16ms (~60fps) to batch SSE token updates into
  // at most one signal update per frame, preventing change detection storms.
  const ms = typeof options.throttle === 'number' ? options.throttle : 16;
  const maybeThrottle = <V>(obs: BehaviorSubject<V>) =>
    ms > 0
      ? obs.pipe(throttleTime(ms, asyncScheduler, { leading: true, trailing: true }))
      : obs.asObservable();

  // Convert to Angular Signals (must happen in injection context)
  const value        = toSignal(maybeThrottle(values$),   { initialValue: init });
  const rawMessages  = toSignal(maybeThrottle(messages$), { initialValue: [] as BaseMessage[] });
  const statusSig    = toSignal(status$,          { initialValue: ResourceStatus.Idle });
  const errorSig     = toSignal(error$,           { initialValue: undefined as unknown });
  const hasValueSig  = toSignal(hasValue$,        { initialValue: false });
  const interruptSig = toSignal(interrupt$,       { initialValue: undefined });
  const interruptsSig= toSignal(interrupts$,      { initialValue: [] });
  const branchSig    = toSignal(branch$,          { initialValue: '' });
  const historySig   = toSignal(history$,         { initialValue: [] });
  const threadLoadSig= toSignal(isThreadLoading$, { initialValue: false });
  const toolProgSig  = toSignal(toolProgress$,    { initialValue: [] });
  const rawToolCalls = toSignal(toolCalls$,       { initialValue: [] });
  const subagentsSig = toSignal(subagents$,       { initialValue: new Map<string, SubagentStreamRef>() });
  const queueSig     = toSignal(queue$,           { initialValue: queue$.value });
  const customSig    = toSignal(custom$,           { initialValue: [] as CustomStreamEvent[] });

  const isLoading    = computed(() => statusSig() === ResourceStatus.Loading);
  const activeSubagents = computed(() =>
    [...subagentsSig().values()].filter(s => s.status() === 'running')
  );

  // ── Runtime-neutral projections ───────────────────────────────────────────

  const messagesNeutral = computed<Message[]>(() => rawMessages().map(toMessage));

  const toolCallsNeutral = computed<ToolCall[]>(() => rawToolCalls().map(toToolCall));

  const statusNeutral = computed<AgentStatus>(() => mapStatus(statusSig()));

  const stateNeutral = computed<Record<string, unknown>>(() => {
    const v = value();
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  });

  const interruptNeutral = computed<AgentInterrupt | undefined>(() => {
    const ix = interruptSig();
    return ix ? toInterrupt(ix) : undefined;
  });

  const subagentsNeutral = computed<Map<string, Subagent>>(() => {
    const out = new Map<string, Subagent>();
    subagentsSig().forEach((sa, key) => out.set(key, toSubagent(sa)));
    return out;
  });

  const historyNeutral = computed<AgentCheckpoint[]>(() =>
    historySig().map(toCheckpoint),
  );
  const experimentalBranchTree = computed(() =>
    buildBranchTree(historySig() as ThreadState<T>[]),
  );

  const events$ = buildEvents$(customSig);

  return {
    // ── Runtime-neutral surface (AgentWithHistory) ────────────────────────
    messages:  messagesNeutral,
    status:    statusNeutral,
    isLoading,
    error:     errorSig,
    toolCalls: toolCallsNeutral,
    state:     stateNeutral,
    interrupt: interruptNeutral,
    subagents: subagentsNeutral,
    events$,
    history:   historyNeutral,
    submit: (input: AgentSubmitInput | null | undefined, opts?: AgentSubmitOptions & LangGraphSubmitOptions) => {
      const request = buildSubmitRequest(input, opts);
      manager.submit(request.payload, request.options);
      return Promise.resolve();
    },
    stop: () => manager.stop(),

    // ── Raw LangGraph signals ─────────────────────────────────────────────
    langGraphMessages:   rawMessages as Signal<BaseMessage[]>,
    langGraphInterrupts: interruptsSig,
    langGraphToolCalls:  rawToolCalls,
    langGraphHistory:    historySig,
    experimentalBranchTree,

    // ── Other AgentRef fields preserved ──────────────────────────────────
    value:           value as Signal<T>,
    hasValue:        hasValueSig,
    reload:          () => manager.resubmitLast(),
    toolProgress:    toolProgSig,
    queue:           queueSig,
    activeSubagents,
    getSubagent:     (toolCallId) => subagentsSig().get(toolCallId),
    getSubagentsByType: (type) =>
      [...subagentsSig().values()].filter(sa => sa.name === type),
    getSubagentsByMessage: (msg) => {
      const ids = getToolCallIds(msg);
      const subagents = subagentsSig();
      return ids
        .map(id => subagents.get(id))
        .filter((subagent): subagent is SubagentStreamRef => subagent != null);
    },
    customEvents:    customSig,
    branch:          branchSig,
    setBranch:       (b) => branch$.next(b),
    isThreadLoading: threadLoadSig,
    switchThread:    (id) => {
      resetDerivedThreadState();
      manager.switchThread(id);
    },
    joinStream:          (id, last) => manager.joinStream(id, last),
    getMessagesMetadata: (msg, idx) => {
      const id = (msg as unknown as Record<string, unknown>)['id'];
      const key = id != null ? String(id) : idx != null ? String(idx) : undefined;
      return key ? messageMetadata$.value.get(key) : undefined;
    },
    getToolCalls: (msg) => {
      const id = (msg as unknown as Record<string, unknown>)['id'];
      return id == null
        ? []
        : toolCalls$.value.filter(tc => (tc.aiMessage as unknown as Record<string, unknown>)['id'] === id);
    },
  };
}

// ── Private translation helpers (moved from to-agent.ts) ─────────────────────

/**
 * Build an Observable<AgentEvent> that bridges LangGraph's
 * `Signal<CustomStreamEvent[]>` (append-only array) into a stream of newly
 * emitted events. Each effect firing compares against a cursor tracking the
 * previously-seen length and emits only the tail slice.
 */
function buildEvents$(customSig: Signal<CustomStreamEvent[]>): Observable<AgentEvent> {
  const subject = new Subject<AgentEvent>();
  let seen = 0;
  effect(() => {
    const all = customSig();
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
    name: sa.name,
    status: sa.status,
    messages: computed(() => sa.messages().map(toMessage)) as Signal<Message[]>,
    state: sa.values as Signal<Record<string, unknown>>,
  };
}

function getToolCallIds(msg: CoreAIMessage): string[] {
  const raw = msg as unknown as Record<string, unknown>;
  const toolCalls = raw['tool_calls'];
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls
    .map(toolCall => isRecord(toolCall) && typeof toolCall['id'] === 'string' ? toolCall['id'] : undefined)
    .filter((id): id is string => id != null);
}

function buildSubmitRequest(
  input: AgentSubmitInput | null | undefined,
  opts?: AgentSubmitOptions & LangGraphSubmitOptions,
): { payload: unknown; options?: AgentSubmitOptions & LangGraphSubmitOptions } {
  return {
    payload: buildSubmitPayload(input),
    options: normalizeSubmitOptions(input, opts),
  };
}

function buildSubmitPayload(input: AgentSubmitInput | null | undefined): unknown {
  if (input == null) return null;
  if (input.resume !== undefined) return null;
  if (input.message !== undefined) {
    const content = typeof input.message === 'string'
      ? input.message
      : input.message.map((b: ContentBlock) => (b.type === 'text' ? b.text : JSON.stringify(b))).join('');
    return { messages: [{ role: 'human', content }], ...(input.state ?? {}) };
  }
  return input.state ?? {};
}

function normalizeSubmitOptions(
  input: AgentSubmitInput | null | undefined,
  opts?: AgentSubmitOptions & LangGraphSubmitOptions,
): (AgentSubmitOptions & LangGraphSubmitOptions) | undefined {
  const inputResume = input?.resume;
  const optionResume = opts?.resume;
  const resume = inputResume !== undefined ? inputResume : optionResume;
  if (resume === undefined) return opts;

  const next = { ...(opts ?? {}) };
  delete next.resume;
  const command = next.command;
  return {
    ...next,
    command: {
      ...command,
      resume,
    },
  };
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
