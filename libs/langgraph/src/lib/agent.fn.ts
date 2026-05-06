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

/**
 * Wire-shape of a `RemoveMessage` instruction — LangGraph's `add_messages`
 * reducer recognises this plain-object shape and removes the matching
 * message id from server state. Used by `regenerate()`. We construct the
 * shape directly instead of importing the `RemoveMessage` class from
 * `@langchain/core/messages` because that pulls in the full BaseMessage
 * class hierarchy (~30-50 kB) which Cockpit's bundle-size budget rejects.
 */
type RemoveMessageInstruction = { type: 'remove'; id: string };
import type { Command, Interrupt, ToolCallWithResult } from '@langchain/langgraph-sdk';
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
import { extractCitations } from './internals/extract-citations';

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
  // No throttle on messages$: we need every token emission to propagate to
  // Angular so streaming markdown actually streams. The bridge already
  // batches per-tuple at the SDK level; further throttling at the signal
  // boundary collapses tokens together and breaks visible token-by-token
  // rendering. Same-frame multiple emissions are coalesced by Angular's
  // CD anyway.
  const rawMessages  = toSignal(messages$, { initialValue: [] as BaseMessage[] });
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

  // Project BaseMessage → Message on every recompute. We deliberately do
  // NOT cache: the LangGraph SDK mutates the same AIMessage instance in
  // place during token streaming (appends content to the same object), so
  // any identity-based cache returns stale projections and Angular's
  // `@let content = messageContent(message)` short-circuits — DOM never
  // updates per token. DOM stability is provided by `track message.id`
  // in chat-message-list, not by Message identity.
  const messagesNeutral = computed<Message[]>(() =>
    rawMessages().map((m) => toMessage(m, manager.getReasoningDurationMs)),
  );

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
      return manager.submit(request.payload, request.options);
    },
    stop: () => manager.stop(),

    regenerate: async (assistantMessageIndex: number): Promise<void> => {
      if (isLoading()) {
        throw new Error('Cannot regenerate while agent is loading another response');
      }
      const msgs = messagesNeutral();
      const target = msgs[assistantMessageIndex];
      if (!target || target.role !== 'assistant') {
        throw new Error(`Message at index ${assistantMessageIndex} is not an assistant message`);
      }

      // Find the user message immediately preceding the target assistant message.
      const userIdx = msgs
        .slice(0, assistantMessageIndex)
        .map((m, i) => ({ m, i }))
        .reverse()
        .find(({ m }) => m.role === 'user')?.i;
      if (userIdx === undefined) {
        throw new Error('No user message found before the target assistant message');
      }

      // Snapshot the raw BaseMessages that will be REMOVED (everything after userIdx).
      const rawToRemove = messages$.value.slice(userIdx + 1);

      // Truncate local buffer INCLUSIVE of the user message. The computed
      // messagesNeutral signal immediately reflects this — user message is
      // preserved in the UI while the new response streams in.
      messages$.next(messages$.value.slice(0, userIdx + 1));

      // Build RemoveMessage wire-shape instructions for server-side rollback.
      // LangGraph's add_messages reducer recognises `{ type: 'remove', id }`
      // and removes those entries from the thread state — ensuring the
      // runtime re-runs against the same trimmed state rather than appending
      // new messages on top.
      const removeList: RemoveMessageInstruction[] = rawToRemove
        .map(m => {
          const raw = m as unknown as Record<string, unknown>;
          const id = typeof raw['id'] === 'string' ? raw['id'] : undefined;
          return id ? { type: 'remove' as const, id } : null;
        })
        .filter((rm): rm is RemoveMessageInstruction => rm !== null);

      if (removeList.length > 0) {
        // updateState is a no-op when the transport doesn't support it
        // (e.g. mock transport in unit tests) — safe to call unconditionally.
        await manager.updateState({ messages: removeList });
      }

      // Re-run the graph with no new input so LangGraph executes from the
      // current (trimmed) thread state. The trailing user message becomes the
      // active prompt without being re-appended.
      await manager.submit(null, undefined);
    },

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

function toMessage(
  m: BaseMessage,
  getReasoningDurationMs?: (id: string) => number | undefined,
): Message {
  const raw = m as unknown as Record<string, unknown>;
  const typeVal = typeof m._getType === 'function'
    ? m._getType()
    : (raw['type'] as string | undefined) ?? 'ai';
  const role: Role =
    typeVal === 'human' ? 'user' :
    typeVal === 'tool'  ? 'tool' :
    typeVal === 'system' ? 'system' :
    'assistant';
  const id = (m.id as string | undefined) ?? (raw['id'] as string | undefined) ?? randomId();
  const reasoning = typeof raw['reasoning'] === 'string' && (raw['reasoning'] as string).length > 0
    ? (raw['reasoning'] as string)
    : undefined;
  const reasoningDurationMs = reasoning && getReasoningDurationMs
    ? getReasoningDurationMs(id)
    : undefined;
  const result: Message = {
    id,
    role,
    content: extractTextContent(m.content),
    toolCallId: raw['tool_call_id'] as string | undefined,
    name: raw['name'] as string | undefined,
    reasoning,
    reasoningDurationMs,
    extra: raw,
  };
  const citations = extractCitations(raw as { additional_kwargs?: Record<string, unknown> });
  if (citations) result.citations = citations;
  return result;
}

/**
 * Extract user-visible text from a `BaseMessage.content` value.
 *
 * LangChain's `BaseMessage.content` is `string | MessageContentComplex[]`.
 * Reasoning-capable models (OpenAI gpt-5/o-series, Anthropic) emit complex
 * arrays of typed blocks: `{type: 'text', text}`, `{type: 'reasoning', ...}`,
 * tool-use blocks, etc. We render only the visible text portions and skip
 * anything else. JSON-stringifying the whole array (the previous behaviour)
 * would dump raw `[{"type":"text",...}]` into the chat bubble.
 */
function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const block of content) {
    if (typeof block === 'string') {
      out += block;
      continue;
    }
    if (!isRecord(block)) continue;
    const t = block['type'];
    // Common text-bearing block shapes across providers.
    if (t === 'text' || t === 'output_text' || t === undefined) {
      const text = block['text'];
      if (typeof text === 'string') out += text;
    }
    // Skip reasoning, tool_use, image, etc. — not chat-bubble content.
  }
  return out;
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
    messages: computed(() => sa.messages().map((m) => toMessage(m))) as Signal<Message[]>,
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
  return buildSubmitUpdate(input) ?? {};
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
  const update = buildSubmitUpdate(input);
  const commandUpdate = mergeCommandUpdate(command?.update, update);
  return {
    ...next,
    command: {
      ...command,
      resume,
      ...(commandUpdate === undefined ? {} : { update: commandUpdate }),
    },
  };
}

function buildSubmitUpdate(input: AgentSubmitInput | null | undefined): Record<string, unknown> | undefined {
  if (input == null) return undefined;
  if (input.message !== undefined) {
    const content = typeof input.message === 'string'
      ? input.message
      : input.message.map((b: ContentBlock) => (b.type === 'text' ? b.text : JSON.stringify(b))).join('');
    // `type: 'human'` is what `toMessage()` reads via `_getType` || raw['type'];
    // `role: 'human'` is what the LangGraph server expects in submit payloads.
    // Include both so the optimistic local copy projects as a 'user' bubble
    // (otherwise toMessage falls through to the 'ai' default and renders the
    // user's question as an assistant message).
    return { messages: [{ type: 'human', role: 'human', content }], ...(input.state ?? {}) };
  }
  return input.state;
}

function mergeCommandUpdate(
  existing: Command['update'] | undefined,
  update: Record<string, unknown> | undefined,
): Command['update'] | undefined {
  if (update === undefined) return existing;
  if (existing == null) return update;
  if (isRecord(existing)) return { ...existing, ...update };
  if (Array.isArray(existing)) return [...existing, ...Object.entries(update)];
  return update;
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
