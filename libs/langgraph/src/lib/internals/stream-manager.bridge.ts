// SPDX-License-Identifier: MIT
import { signal } from '@angular/core';
import { Observable, takeUntil } from 'rxjs';
import {
  ResourceStatus,
  AgentOptions,
  StreamSubjects,
  StreamEvent,
  AgentTransport,
  SubagentStreamRef,
  AgentQueue,
  AgentQueueEntry,
  LangGraphSubmitOptions,
} from '../agent.types';
import { FetchStreamTransport } from '../transport/fetch-stream.transport';
import { BagTemplate } from '@langchain/langgraph-sdk';
import { getToolCallsWithResults } from '@langchain/langgraph-sdk/utils';
import {
  SubagentTracker,
  TrackedSubagent,
  extractToolCallIdFromNamespace,
  isSubagentNamespace,
} from './subagent-tracker';
import type { BaseMessage } from '@langchain/core/messages';
import type { Interrupt, Message as LangGraphMessage, ThreadState, ToolCallWithResult, ToolProgress } from '@langchain/langgraph-sdk';

// Local copy of the trace harness — same gating as @ngaf/chat's trace.ts.
// Duplicated here to avoid an @ngaf/chat dep on the langgraph internals path.
function isLgTraceEnabled(): boolean {
  if (typeof globalThis === 'undefined') return false;
  const win = (globalThis as { window?: { __ngafChatTrace?: boolean; localStorage?: Storage } }).window;
  if (!win) return false;
  if (win.__ngafChatTrace === true) return true;
  try { return win.localStorage?.getItem('NGAF_CHAT_STREAM_TRACE') === '1'; } catch { return false; }
}
function lgTrace(...args: unknown[]): void {
  if (isLgTraceEnabled()) {
    // eslint-disable-next-line no-console
    console.debug('[ngaf-chat-stream]', ...args);
  }
}

export interface StreamManagerBridgeOptions<T, ResolvedBag extends BagTemplate = BagTemplate> {
  options:   AgentOptions<T, ResolvedBag>;
  subjects:  StreamSubjects<T, ResolvedBag>;
  threadId$: Observable<string | null>;
  destroy$:  Observable<void>;
}

export interface StreamManagerBridge {
  submit:                (values: unknown, opts?: LangGraphSubmitOptions) => Promise<void>;
  stop:                  () => Promise<void>;
  switchThread:          (id: string | null) => void;
  joinStream:            (runId: string, lastEventId?: string) => Promise<void>;
  resubmitLast:          () => Promise<void>;
  getReasoningDurationMs:(id: string) => number | undefined;
}

export function createStreamManagerBridge<T, ResolvedBag extends BagTemplate = BagTemplate>(
  { options, subjects, threadId$, destroy$ }: StreamManagerBridgeOptions<T, ResolvedBag>
): StreamManagerBridge {
  // Intercept onThreadId to update currentThreadId when the transport
  // auto-creates a thread. Without this, each submit() creates a new thread
  // because currentThreadId stays null.
  const userOnThreadId = options.onThreadId;
  const wrappedOnThreadId = (id: string) => {
    currentThreadId = id;
    userOnThreadId?.(id);
  };
  const transport: AgentTransport =
    options.transport ?? new FetchStreamTransport(options.apiUrl, wrappedOnThreadId);

  let currentThreadId: string | null = null;
  let lastPayload: unknown = null;
  let lastOptions: LangGraphSubmitOptions | undefined;
  let abortController: AbortController | null = null;
  let historyAbortController: AbortController | null = null;
  let hasSeenThreadId = false;
  const toolProgressMap = new Map<string, ToolProgress>();
  const queuedRuns: AgentQueueEntry[] = [];
  let drainingQueue = false;
  const subagentManager = new SubagentTracker({
    subagentToolNames: options.subagentToolNames,
    onSubagentChange: publishSubagents,
  });

  /**
   * Tracks reasoning timing per message id. Keys are message ids; values
   * record when reasoning content first arrived and when response text
   * first appeared (or the canonical message arrived). Cleared on
   * resetThreadState() and on bridge teardown.
   */
  const reasoningTimingMap = new Map<string, { startedAt: number; endedAt?: number }>();

  function resetThreadState(): void {
    historyAbortController?.abort();
    subjects.values$.next({} as T);
    subjects.messages$.next([]);
    subjects.history$.next([]);
    subjects.interrupt$.next(undefined);
    subjects.interrupts$.next([]);
    subjects.toolProgress$.next([]);
    subjects.toolCalls$.next([]);
    subjects.messageMetadata$.next(new Map());
    subjects.subagents$.next(new Map());
    void cancelQueueEntries(takeQueuedRuns()).catch(err => subjects.error$.next(err));
    publishQueue();
    subjects.custom$.next([]);
    subjects.isThreadLoading$.next(false);
    toolProgressMap.clear();
    subagentManager.clear();
    reasoningTimingMap.clear();
  }

  function setThreadId(id: string | null, resetState: boolean): void {
    if (resetState) {
      abortController?.abort();
    }
    currentThreadId = id;
    if (resetState) {
      resetThreadState();
    }
    void refreshHistory();
  }

  // Track threadId changes
  threadId$.pipe(takeUntil(destroy$)).subscribe(id => {
    const shouldReset = hasSeenThreadId && currentThreadId !== id;
    hasSeenThreadId = true;
    setThreadId(id, shouldReset);
  });

  destroy$.subscribe(() => {
    abortController?.abort();
    historyAbortController?.abort();
    reasoningTimingMap.clear();
  });

  async function refreshHistory(): Promise<void> {
    const getHistory = transport.getHistory?.bind(transport);
    if (!currentThreadId || !getHistory) return;

    historyAbortController?.abort();
    const controller = new AbortController();
    historyAbortController = controller;
    const threadId = currentThreadId;
    subjects.isThreadLoading$.next(true);

    try {
      const history = await getHistory(threadId, controller.signal);
      if (!controller.signal.aborted && currentThreadId === threadId) {
        subjects.history$.next(history as ThreadState<T>[]);
      }
    } catch (err) {
      if (!controller.signal.aborted && (err as Error)?.name !== 'AbortError') {
        subjects.error$.next(err);
      }
    } finally {
      if (historyAbortController === controller) {
        historyAbortController = null;
        subjects.isThreadLoading$.next(false);
      }
    }
  }

  function publishQueue(): void {
    subjects.queue$.next(createQueueSnapshot());
  }

  function createQueueSnapshot(): AgentQueue {
    return {
      entries: [...queuedRuns],
      size: queuedRuns.length,
      cancel: cancelQueuedRun,
      clear: clearQueue,
    };
  }

  async function enqueueRun(payload: unknown, opts?: LangGraphSubmitOptions): Promise<void> {
    if (!currentThreadId) {
      throw new Error('Cannot enqueue a run before a LangGraph thread exists.');
    }
    if (!transport.createQueuedRun) {
      throw new Error('The configured LangGraph transport does not support server-side queueing.');
    }

    const controller = new AbortController();
    const entry = await transport.createQueuedRun(
      options.assistantId,
      currentThreadId,
      payload,
      opts?.signal ?? controller.signal,
      opts,
    );
    queuedRuns.push({
      ...entry,
      values: payload,
      options: { ...opts, multitaskStrategy: 'enqueue' },
      createdAt: entry.createdAt ?? new Date(),
    });
    publishQueue();
  }

  async function cancelQueuedRun(id: string): Promise<boolean> {
    const index = queuedRuns.findIndex(entry => entry.id === id);
    if (index === -1) return false;

    const [entry] = queuedRuns.splice(index, 1);
    publishQueue();
    if (!entry || !transport.cancelRun) return false;
    await cancelQueueEntries([entry]);
    return true;
  }

  async function clearQueue(): Promise<void> {
    const entries = takeQueuedRuns();
    publishQueue();
    await cancelQueueEntries(entries);
  }

  function takeQueuedRuns(): AgentQueueEntry[] {
    return queuedRuns.splice(0, queuedRuns.length);
  }

  async function cancelQueueEntries(entries: AgentQueueEntry[]): Promise<void> {
    const cancelRun = transport.cancelRun?.bind(transport);
    if (!cancelRun) return;
    await Promise.all(entries.map(entry =>
      cancelRun(entry.threadId, entry.id, new AbortController().signal)
    ));
  }

  async function drainQueue(): Promise<void> {
    if (drainingQueue || queuedRuns.length === 0) return;
    drainingQueue = true;
    try {
      while (queuedRuns.length > 0) {
        const entry = queuedRuns.shift();
        publishQueue();
        if (!entry || !transport.joinStream) continue;
        await joinQueuedRun(entry);
      }
    } finally {
      drainingQueue = false;
    }
  }

  async function joinQueuedRun(entry: AgentQueueEntry): Promise<void> {
    abortController = new AbortController();
    subjects.custom$.next([]);
    subjects.toolProgress$.next([]);
    toolProgressMap.clear();
    subjects.status$.next(ResourceStatus.Loading);

    try {
      const iter = transport.joinStream
        ? transport.joinStream(entry.threadId, entry.id, undefined, abortController.signal)
        : [];
      for await (const event of iter) {
        if (abortController.signal.aborted) break;
        processEvent(event);
      }
      if (!abortController.signal.aborted) {
        subjects.status$.next(ResourceStatus.Resolved);
        await refreshHistory();
      }
    } catch (err) {
      subjects.error$.next(err);
      subjects.status$.next(ResourceStatus.Error);
    }
  }

  async function runStream(payload: unknown, opts?: LangGraphSubmitOptions): Promise<void> {
    abortController?.abort();
    abortController = new AbortController();

    subjects.status$.next(ResourceStatus.Loading);
    subjects.error$.next(undefined);
    subjects.custom$.next([]);
    subjects.toolProgress$.next([]);
    toolProgressMap.clear();
    lastPayload = payload;
    lastOptions = opts;

    // Optimistically inject human messages so they appear immediately
    // without waiting for the server to echo them back. Assign a stable id
    // when missing — track-by-id in the chat-message-list relies on stable
    // ids across re-emissions, otherwise the optimistic message gets torn
    // down + recreated on every messages$.next() during streaming, which
    // restarts caret/typing animations and causes visible flicker.
    const inputMessages = (payload as Record<string, unknown>)?.['messages'];
    if (Array.isArray(inputMessages) && inputMessages.length > 0) {
      const stamped = (inputMessages as BaseMessage[]).map((m) => {
        const raw = m as unknown as Record<string, unknown>;
        if (typeof raw['id'] === 'string' && raw['id']) return m;
        const id = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return { ...m, id } as BaseMessage;
      });
      const existing = subjects.messages$.value;
      subjects.messages$.next([...existing, ...stamped]);
    }

    try {
      const iter = transport.stream(
        options.assistantId,
        currentThreadId,
        payload,
        opts?.signal ?? abortController.signal,
        opts,
      );

      for await (const event of iter) {
        if (abortController.signal.aborted) break;
        processEvent(event);
      }

      if (!abortController.signal.aborted) {
        subjects.status$.next(ResourceStatus.Resolved);
        await refreshHistory();
        await drainQueue();
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        subjects.status$.next(ResourceStatus.Resolved);
      } else {
        subjects.error$.next(err);
        subjects.status$.next(ResourceStatus.Error);
      }
    }
  }

  function processEvent(event: StreamEvent): void {
    const baseType = getBaseEventType(event.type);
    const namespace = getEventNamespace(event);

    if (isMessagesEvent(event.type)) {
      const msgs = normalizeMessages(event);
      if (!msgs) return;

      const normalized = options.toMessage
        ? msgs.map(options.toMessage)
        : msgs as BaseMessage[];

      if (isSubagentNamespace(namespace)) {
        const namespaceId = namespace ? extractToolCallIdFromNamespace(namespace) : undefined;
        if (namespaceId) {
          for (const msg of normalized) {
            subagentManager.addMessageToSubagent(namespaceId, msg);
          }
          publishSubagents();
        }

        if (options.filterSubagentMessages) {
          return;
        }
      }

      // Partial and message-tuple events are incremental. Merge them by id
      // so optimistic human messages and earlier tool messages are preserved.
      if (event.type === 'messages/partial' || event.messageMetadata) {
        subjects.messages$.next(mergeMessages(subjects.messages$.value, normalized, reasoningTimingMap));
        if (isLgTraceEnabled()) {
          const msgs = subjects.messages$.value;
          const last = msgs[msgs.length - 1];
          lgTrace('bridge.messages-tuple', { id: (last as unknown as Record<string, unknown> | undefined)?.['id'], count: msgs.length });
        }
      } else if (normalized.length === 0) {
        // Defensive: skip empty replacements during streaming. An empty
        // batch shouldn't tear down the entire UI (causes message DOM
        // teardown + streaming renderer reset = visible jank).
      } else {
        // Preserve existing ids by content so the final-id swap doesn't
        // tear down the chat-message DOM (and its streaming-md renderer).
        subjects.messages$.next(preserveIds(subjects.messages$.value, normalized));
      }
      storeMessageMetadata(normalized, event);
      syncSubagentsFromMessages(normalized);
      syncToolCallsFromMessages();
      return;
    }

    // normalizeSdkEvent spreads event data directly into the event object,
    // so the values/updates payload is at event['data'] (the original data object),
    // NOT at event['values'] or event['updates'].
    switch (baseType) {
      case 'values': {
        const vals = extractEventData(event);
        if (isSubagentNamespace(namespace) && isRecord(vals)) {
          updateSubagentValues(namespace, vals);
          break;
        }
        if (vals != null) {
          subjects.values$.next(vals as T);
          // Also sync messages$ from the values state so the full message
          // history (including human messages) is available to consumers.
          const stateMessages = (vals as Record<string, unknown>)['messages'];
          if (Array.isArray(stateMessages) && stateMessages.length > 0) {
            // Defensive: only sync when state carries messages. An empty
            // values payload shouldn't wipe the UI mid-stream.
            const projected = options.toMessage
              ? stateMessages.map(options.toMessage)
              : (stateMessages as BaseMessage[]);
            // Drop empty-content AI placeholders before merging. LangGraph
            // emits intermediate `values` events whose `state.messages`
            // includes an unfilled assistant turn at the tail. Keeping it
            // would create a phantom slot that competes with the chunk-
            // streamed AIMessageChunk arriving via messages-tuple — they'd
            // never merge (different ids; non-overlapping content fragments)
            // and the user sees two assistant bubbles.
            const filtered = projected.filter((m, i) => {
              if (i !== projected.length - 1) return true;
              const t = normalizeMessageType(
                typeof m._getType === 'function' ? m._getType() : (m as unknown as Record<string, unknown>)['type'] as string | undefined,
              );
              if (t !== 'ai') return true;
              const text = extractText(m.content);
              return text.length > 0;
            });
            // Preserve existing ids by content match (server echo / final-id swap).
            const remapped = preserveIds(subjects.messages$.value, filtered);
            // ALWAYS merge values-derived messages into existing rather
            // than replacing. LangGraph emits intermediate values events
            // during streaming where state.messages can lag behind what
            // we've already seen via messages-tuple — replacing would
            // drop the partial AI (or even the optimistic human) and
            // tear down their DOM mid-stream. Merge by id keeps both,
            // updates content where ids match, preserves the rest.
            subjects.messages$.next(mergeMessages(subjects.messages$.value, remapped, reasoningTimingMap));
            if (isLgTraceEnabled()) {
              lgTrace('bridge.values-sync', {
                incomingLength: stateMessages.length,
                mergedLength: subjects.messages$.value.length,
              });
            }
            syncSubagentsFromMessages(stateMessages as BaseMessage[]);
            subagentManager.reconstructFromMessages(
              stateMessages as BaseMessage[],
              { skipIfPopulated: true },
            );
            publishSubagents();
            syncToolCallsFromMessages();
          }
        }
        break;
      }
      case 'updates': {
        const upd = extractEventData(event);
        if (isSubagentNamespace(namespace)) {
          markSubagentRunning(namespace);
          break;
        }
        if (upd != null) {
          subjects.values$.next({
            ...subjects.values$.value,
            ...(upd as object),
          } as T);
        }
        break;
      }
      case 'error':
        subjects.error$.next(event['error']);
        subjects.status$.next(ResourceStatus.Error);
        break;
      case 'interrupt':
        subjects.interrupt$.next(event['interrupt'] as Interrupt);
        break;
      case 'interrupts':
        subjects.interrupts$.next(event['interrupts'] as Interrupt[]);
        break;
      case 'custom': {
        const eventData = event['data'] as Record<string, unknown> | undefined;
        const name = (event['name'] ?? eventData?.['name'] ?? '') as string;
        const data = eventData?.['data'] ?? eventData;
        const current = subjects.custom$.value;
        subjects.custom$.next([...current, { name, data }]);
        break;
      }
      case 'tools':
        updateToolProgress(event);
        break;
    }
  }

  function syncToolCallsFromMessages(): void {
    const toolCalls = getToolCallsWithResults(
      subjects.messages$.value as unknown as LangGraphMessage[],
    ) as ToolCallWithResult[];
    subjects.toolCalls$.next(toolCalls);
  }

  function syncSubagentsFromMessages(messages: BaseMessage[]): void {
    for (const message of messages) {
      const raw = message as unknown as Record<string, unknown>;
      if (isAiMessageWithToolCalls(raw)) {
        subagentManager.registerFromToolCalls(
          raw['tool_calls'] as Array<{ id?: string; name: string; args: Record<string, unknown> | string }>,
          typeof raw['id'] === 'string' ? raw['id'] : null,
        );
      }
      if (isToolMessage(raw)) {
        const content = typeof raw['content'] === 'string'
          ? raw['content']
          : JSON.stringify(raw['content']);
        const status = raw['status'] === 'error' ? 'error' : 'success';
        subagentManager.processToolMessage(raw['tool_call_id'], content, status);
      }
    }
    publishSubagents();
  }

  function updateSubagentValues(namespace: string[] | undefined, values: Record<string, unknown>): void {
    const namespaceId = namespace ? extractToolCallIdFromNamespace(namespace) : undefined;
    if (!namespaceId) return;

    const messages = values['messages'];
    if (Array.isArray(messages) && messages.length > 0) {
      const first = messages[0];
      if (isRecord(first) && (first['type'] === 'human' || first['type'] === 'user') && typeof first['content'] === 'string') {
        subagentManager.matchSubgraphToSubagent(namespaceId, first['content']);
      }
    }
    subagentManager.updateSubagentValues(namespaceId, values);
    publishSubagents();
  }

  function markSubagentRunning(namespace: string[] | undefined): void {
    const namespaceId = namespace ? extractToolCallIdFromNamespace(namespace) : undefined;
    if (!namespaceId) return;
    subagentManager.markRunningFromNamespace(namespaceId, namespace);
    publishSubagents();
  }

  function publishSubagents(): void {
    subjects.subagents$.next(toSubagentRefs(subagentManager.getSubagents()));
  }

  function storeMessageMetadata(messages: BaseMessage[], event: StreamEvent): void {
    if (!event.messageMetadata) return;
    const next = new Map(subjects.messageMetadata$.value);
    messages.forEach((message, index) => {
      const id = (message as unknown as Record<string, unknown>)['id'];
      const messageId = String(id ?? index);
      next.set(messageId, {
        messageId,
        firstSeenState: undefined,
        branch: undefined,
        branchOptions: undefined,
        streamMetadata: event.messageMetadata,
      });
    });
    subjects.messageMetadata$.next(next);
  }

  function updateToolProgress(event: StreamEvent): void {
    const data = extractEventData(event);
    if (!isRecord(data)) return;

    const toolEvent = data['event'];
    const name = data['name'];
    if (typeof toolEvent !== 'string' || typeof name !== 'string') return;

    const toolCallId = typeof data['toolCallId'] === 'string' ? data['toolCallId'] : undefined;
    const key = toolCallId ?? name;
    const existing = toolProgressMap.get(key);

    switch (toolEvent) {
      case 'on_tool_start':
        toolProgressMap.set(key, {
          toolCallId,
          name,
          state: 'starting',
          input: data['input'],
        });
        break;
      case 'on_tool_event':
        toolProgressMap.set(key, {
          toolCallId,
          name,
          ...existing,
          state: 'running',
          data: data['data'],
        });
        break;
      case 'on_tool_end':
        toolProgressMap.set(key, {
          toolCallId,
          name,
          ...existing,
          state: 'completed',
          result: data['output'],
        });
        break;
      case 'on_tool_error':
        toolProgressMap.set(key, {
          toolCallId,
          name,
          ...existing,
          state: 'error',
          error: data['error'],
        });
        break;
      default:
        return;
    }

    subjects.toolProgress$.next([...toolProgressMap.values()]);
  }

  return {
    submit: async (payload, opts) => {
      if (opts?.multitaskStrategy === 'enqueue' && subjects.status$.value === ResourceStatus.Loading) {
        await enqueueRun(payload, opts);
        return;
      }
      await runStream(payload, opts);
    },

    stop: async () => {
      abortController?.abort();
      await clearQueue();
      subjects.status$.next(ResourceStatus.Resolved);
    },

    switchThread: (id) => {
      setThreadId(id, true);
    },

    joinStream: async (runId, lastEventId) => {
      if (!currentThreadId) return;
      abortController?.abort();
      abortController = new AbortController();
      subjects.custom$.next([]);
      subjects.toolProgress$.next([]);
      toolProgressMap.clear();
      subjects.status$.next(ResourceStatus.Loading);
      try {
        const iter = transport.joinStream
          ? transport.joinStream(currentThreadId, runId, lastEventId, abortController.signal)
          : [];
        for await (const event of iter) {
          processEvent(event);
        }
        subjects.status$.next(ResourceStatus.Resolved);
        await refreshHistory();
      } catch (err) {
        subjects.error$.next(err);
        subjects.status$.next(ResourceStatus.Error);
      }
    },

    resubmitLast: async () => {
      if (lastPayload !== null) {
        await runStream(lastPayload, lastOptions);
      }
    },

    getReasoningDurationMs: (id: string): number | undefined => {
      const entry = reasoningTimingMap.get(id);
      if (!entry) return undefined;
      if (entry.endedAt === undefined) return undefined;
      return entry.endedAt - entry.startedAt;
    },
  };
}

/**
 * Extracts the payload data from a normalized SDK event.
 *
 * Handles two formats:
 * 1. SDK events (via normalizeSdkEvent): data at event['data'] (record) + spread into event
 * 2. Mock/test events: data at event[event.type] (e.g., event['values'], event['updates'])
 */
function extractEventData(event: StreamEvent): unknown {
  // Try event['data'] first (SDK format from normalizeSdkEvent)
  const d = event['data'];
  if (d != null && typeof d === 'object' && !Array.isArray(d)) {
    return d;
  }
  // Try event[event.type] (mock/test format: { type: 'values', values: {...} })
  const named = event[event.type];
  if (named != null && typeof named === 'object' && !Array.isArray(named)) {
    return named;
  }
  // Fallback: reconstruct from remaining keys
  const rest = Object.fromEntries(
    Object.entries(event).filter(([key]) => key !== 'type' && key !== 'data'),
  );
  return Object.keys(rest).length > 0 ? rest : d;
}

function isMessagesEvent(type: StreamEvent['type']): boolean {
  const baseType = getBaseEventType(type);
  return baseType === 'messages' || baseType.startsWith('messages/');
}

function getBaseEventType(type: StreamEvent['type']): string {
  return String(type).split('|')[0];
}

function getEventNamespace(event: StreamEvent): string[] | undefined {
  if (Array.isArray(event.namespace)) return event.namespace;
  const parts = String(event.type).split('|');
  return parts.length > 1 ? parts.slice(1) : undefined;
}

function normalizeMessages(event: StreamEvent): unknown[] | null {
  const directMessages = event['messages'];
  if (Array.isArray(directMessages)) {
    // Filter out non-message metadata objects (e.g. { langgraph_node, langgraph_triggers })
    // that the LangGraph SDK includes alongside real messages in messages/* events.
    const filtered = directMessages.filter(isMessageLike);
    return filtered.length > 0 ? filtered : null;
  }

  const data = event['data'];
  if (Array.isArray(data)) {
    if (data.every(isMessageLike)) {
      return data;
    }
    if (isMessageLike(data[0])) {
      return [data[0]];
    }
  }

  const indexedValues = Object.keys(event)
    .filter(key => /^\d+$/.test(key))
    .sort((left, right) => Number(left) - Number(right))
    .map(key => event[key]);

  if (indexedValues.every(isMessageLike)) {
    return indexedValues;
  }
  if (isMessageLike(indexedValues[0])) {
    return [indexedValues[0]];
  }

  return null;
}

/**
 * Collapse adjacent AI messages where one's text is a prefix of the other.
 *
 * When complex-content streaming is in play, the same conceptual assistant
 * message can land in two slots: the canonical AI from values-sync (id
 * `resp_…` or run id) and the chunk-streamed AIMessageChunk from
 * messages-tuple (id `lc_run--…`). Both slots fill in parallel; once both
 * carry the full text we collapse them, keeping the older slot's id so
 * track-by-id stays stable in the chat list.
 */
function collapseAdjacentAi(messages: BaseMessage[]): BaseMessage[] {
  if (messages.length < 2) return messages;
  const out: BaseMessage[] = [];
  for (const msg of messages) {
    const last = out[out.length - 1];
    if (!last) { out.push(msg); continue; }
    const lastType = normalizeMessageType(
      typeof last._getType === 'function' ? last._getType() : (last as unknown as Record<string, unknown>)['type'] as string | undefined,
    );
    const msgType = normalizeMessageType(
      typeof msg._getType === 'function' ? msg._getType() : (msg as unknown as Record<string, unknown>)['type'] as string | undefined,
    );
    if (lastType === 'ai' && msgType === 'ai') {
      const lastText = extractText(last.content);
      const msgText = extractText(msg.content);
      if (lastText.length === 0
          || msgText.length === 0
          || lastText === msgText
          || lastText.startsWith(msgText)
          || msgText.startsWith(lastText)) {
        // Keep the longer content; preserve last (older) id and metadata.
        const longerText = msgText.length >= lastText.length ? msgText : lastText;
        out[out.length - 1] = { ...(last as object), content: longerText } as BaseMessage;
        continue;
      }
    }
    out.push(msg);
  }
  return out;
}

function mergeMessages(
  existing: BaseMessage[],
  incoming: BaseMessage[],
  reasoningTimingMap?: Map<string, { startedAt: number; endedAt?: number }>,
): BaseMessage[] {
  const merged = [...existing];
  for (const msg of incoming) {
    const rawIn = msg as unknown as Record<string, unknown>;
    const id = rawIn['id'];
    let idx = id ? merged.findIndex(m => (m as unknown as Record<string, unknown>)['id'] === id) : -1;
    // Fallback: match by (role, content) when ids differ. This is the path
    // that fires when the server echoes back our optimistic human message
    // with a server-assigned id, or when partial AI tokens carry a chunk
    // id but the final canonical message has a run id. Preserving the
    // existing id here keeps track-by-id stable in the chat list and
    // prevents DOM teardown + animation restarts mid-stream.
    if (idx < 0) {
      idx = findContentMatch(merged, msg);
    }
    // When an AIMessageChunk arrives without an id-match or content-prefix
    // match, treat the trailing AI message as its accumulator. The
    // OpenAI Responses API emits per-chunk events whose ids identify the
    // *event*, not the message, so consecutive chunks land here. Without
    // this we'd append every chunk as a separate bubble.
    if (idx < 0) {
      const inType = normalizeMessageType(rawIn['type'] as string | undefined);
      if (inType === 'ai') {
        for (let i = merged.length - 1; i >= 0; i--) {
          const t = normalizeMessageType(
            typeof (merged[i] as BaseMessage)._getType === 'function'
              ? (merged[i] as BaseMessage)._getType()
              : (merged[i] as unknown as Record<string, unknown>)['type'] as string | undefined,
          );
          if (t === 'ai') { idx = i; break; }
          if (t === 'human' || t === 'tool' || t === 'system') break;
        }
      }
    }
    if (idx >= 0) {
      const existing = merged[idx];
      const existingId = (existing as unknown as Record<string, unknown>)['id'];
      const incomingRaw = msg as unknown as Record<string, unknown>;
      // Keep the *existing* id so downstream track-by-id sees stable identity.
      // For complex-content streaming (OpenAI gpt-5/o-series, Anthropic) the
      // SDK emits per-chunk *delta* arrays — not accumulated arrays — so a
      // straight replacement collapses the rendered bubble to just the
      // latest token. Accumulate text-bearing content across chunks here
      // and hand a string to consumers; downstream code already handles
      // string content uniformly.
      const accumulatedContent = accumulateContent(
        existing.content as unknown,
        incomingRaw['content'],
      );
      // Only accumulate reasoning when the incoming message explicitly carries
      // a `reasoning` field or complex-content array blocks with
      // type='reasoning'/'thinking'. Never use a plain string content value
      // as reasoning source — that would wrongly treat every assistant
      // message text as reasoning content.
      const incomingReasoningSource = 'reasoning' in incomingRaw
        ? incomingRaw['reasoning']
        : (Array.isArray(incomingRaw['content']) ? incomingRaw['content'] : undefined);
      const accumulatedReasoning = accumulateReasoning(
        (existing as unknown as Record<string, unknown>)['reasoning'],
        incomingReasoningSource,
      );
      const idForTiming = (existingId as string | undefined) ?? (incomingRaw['id'] as string | undefined);
      if (idForTiming && reasoningTimingMap) {
        const hasReasoning = accumulatedReasoning.length > 0;
        const hasText = (typeof accumulatedContent === 'string' ? accumulatedContent : '').length > 0;
        if (hasReasoning) {
          const entry = reasoningTimingMap.get(idForTiming) ?? { startedAt: Date.now() };
          if (hasText && entry.endedAt === undefined) entry.endedAt = Date.now();
          reasoningTimingMap.set(idForTiming, entry);
        }
      }
      const next = { ...(msg as object), content: accumulatedContent } as BaseMessage;
      (next as unknown as Record<string, unknown>)['reasoning'] = accumulatedReasoning;
      if (existingId) {
        (next as unknown as Record<string, unknown>)['id'] = existingId;
      }
      merged[idx] = next;
    } else {
      const incomingRaw = msg as unknown as Record<string, unknown>;
      const initialReasoningSource = 'reasoning' in incomingRaw
        ? incomingRaw['reasoning']
        : (Array.isArray(incomingRaw['content']) ? incomingRaw['content'] : undefined);
      const initialReasoning = accumulateReasoning(undefined, initialReasoningSource);
      if (initialReasoning.length > 0 && reasoningTimingMap) {
        const msgId = incomingRaw['id'] as string | undefined;
        if (msgId && !reasoningTimingMap.has(msgId)) {
          reasoningTimingMap.set(msgId, { startedAt: Date.now() });
        }
      }
      const next = { ...(msg as object) } as BaseMessage;
      (next as unknown as Record<string, unknown>)['reasoning'] = initialReasoning;
      merged.push(next);
    }
  }
  return collapseAdjacentAi(merged);
}

/**
 * Merge an incoming chunk's content into prior accumulated content for the
 * same message id.
 *
 * - string + string → concat (delta append)
 * - array + array  → concat extracted text from existing + incoming blocks
 * - array + string → use the string (server final-id swap)
 * - empty existing → use incoming as-is
 *
 * We deliberately collapse complex content arrays to a string at this layer.
 * The langgraph-sdk client does not accumulate complex-content arrays the
 * way it accumulates strings, and per-chunk arrays carry only the latest
 * delta. Concatenating extracted text gives consumers the same uniform
 * string they get for non-reasoning models.
 */
function accumulateContent(existing: unknown, incoming: unknown): string {
  const existingText = extractText(existing);
  const incomingText = extractText(incoming);

  // Always return a string. We never want array content escaping the bridge:
  // (a) downstream consumers expect string content, and (b) findContentMatch
  // stringifies arrays, which would prevent the canonical-message id-swap
  // dedupe from matching the streamed-chunk message after a partial chunk.
  if (existingText.length === 0) return incomingText;
  if (incomingText.length === 0) return existingText;
  // Incoming is a strict-superset of accumulated (final-id swap with full content).
  if (incomingText.startsWith(existingText)) return incomingText;
  // Existing already a strict-superset — chunk arrived after the canonical
  // message merged in via values-sync. Keep what we have.
  if (existingText.startsWith(incomingText)) return existingText;
  // Otherwise treat incoming as a delta and append.
  return existingText + incomingText;
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const block of content) {
    if (typeof block === 'string') { out += block; continue; }
    if (block == null || typeof block !== 'object') continue;
    const rec = block as Record<string, unknown>;
    const t = rec['type'];
    if (t === 'text' || t === 'output_text' || t === undefined) {
      const text = rec['text'];
      if (typeof text === 'string') out += text;
    }
  }
  return out;
}

function extractReasoning(content: unknown): string {
  if (typeof content === 'string') return '';
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const block of content) {
    if (block == null || typeof block !== 'object') continue;
    const rec = block as Record<string, unknown>;
    const t = rec['type'];
    if (t === 'reasoning' || t === 'thinking') {
      const text = rec['text'];
      if (typeof text === 'string') out += text;
    }
  }
  return out;
}

function accumulateReasoning(existing: unknown, incoming: unknown): string {
  const existingText = typeof existing === 'string' ? existing : extractReasoning(existing);
  const incomingText = typeof incoming === 'string' ? incoming : extractReasoning(incoming);
  if (existingText.length === 0) return incomingText;
  if (incomingText.length === 0) return existingText;
  if (incomingText.startsWith(existingText)) return incomingText;
  if (existingText.startsWith(incomingText)) return existingText;
  return existingText + incomingText;
}

/**
 * Replace the incoming messages' ids with the existing array's ids whenever
 * (role, content) matches positionally and the existing id differs. Keeps
 * track-by-id stable across server echoes and final-id swaps.
 */
function preserveIds(existing: BaseMessage[], incoming: BaseMessage[]): BaseMessage[] {
  if (existing.length === 0) return collapseAdjacentAi(incoming);
  const usedExisting = new Set<number>();
  const remapped = incoming.map((msg, i) => {
    const inRaw = msg as unknown as Record<string, unknown>;
    const inId = inRaw['id'];
    // First try same-position match (the dominant case).
    let matchIdx = -1;
    if (i < existing.length && !usedExisting.has(i) && sameRoleAndContent(existing[i], msg)) {
      matchIdx = i;
    } else {
      // Fallback: any unused existing message with matching role+content.
      matchIdx = existing.findIndex((m, j) => !usedExisting.has(j) && sameRoleAndContent(m, msg));
    }
    if (matchIdx < 0) return msg;
    usedExisting.add(matchIdx);
    const existingId = (existing[matchIdx] as unknown as Record<string, unknown>)['id'];
    if (!existingId || existingId === inId) return msg;
    return { ...(msg as object), id: existingId } as BaseMessage;
  });
  return collapseAdjacentAi(remapped);
}

function sameRoleAndContent(a: BaseMessage, b: BaseMessage): boolean {
  const aType = normalizeMessageType(
    typeof a._getType === 'function' ? a._getType() : (a as unknown as Record<string, unknown>)['type'] as string | undefined,
  );
  const bType = normalizeMessageType(
    typeof b._getType === 'function' ? b._getType() : (b as unknown as Record<string, unknown>)['type'] as string | undefined,
  );
  if (aType !== bType) return false;
  const aContent = typeof a.content === 'string' ? a.content : JSON.stringify(a.content);
  const bContent = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
  if (aContent === bContent) return true;
  // For AI messages we accept prefix relationships (streaming → final).
  if (aType === 'ai' && typeof aContent === 'string' && typeof bContent === 'string') {
    return aContent.length > 0 && (bContent.startsWith(aContent) || aContent.startsWith(bContent));
  }
  return false;
}

function findContentMatch(merged: BaseMessage[], incoming: BaseMessage): number {
  const inRaw = incoming as unknown as Record<string, unknown>;
  const inType = normalizeMessageType(
    typeof incoming._getType === 'function' ? incoming._getType() : (inRaw['type'] as string | undefined),
  );
  const inContent = typeof incoming.content === 'string' ? incoming.content : JSON.stringify(incoming.content);
  // Only worth matching for human messages (where the optimistic→echo
  // mismatch happens) and for AI messages where content is a strict prefix
  // of the existing (token-streaming + final-id swap pattern).
  for (let i = merged.length - 1; i >= 0; i--) {
    const m = merged[i] as unknown as Record<string, unknown>;
    const mType = normalizeMessageType(
      typeof (merged[i] as BaseMessage)._getType === 'function'
        ? (merged[i] as BaseMessage)._getType()
        : (m['type'] as string | undefined),
    );
    if (mType !== inType) continue;
    const mContent = typeof (merged[i] as BaseMessage).content === 'string'
      ? (merged[i] as BaseMessage).content as string
      : JSON.stringify((merged[i] as BaseMessage).content);
    if (inType === 'human' && mContent === inContent) return i;
    if (inType === 'ai') {
      // Skip empty placeholders. We don't want a pre-existing empty AI
      // (created by an early values-sync emission with `state.messages`
      // including an unfilled assistant turn) to absorb the first chunk
      // arriving via messages-tuple — that strands subsequent chunks in a
      // separate slot whose content no longer prefix-matches the canonical.
      const aSafe = typeof mContent === 'string' ? mContent : '';
      const bSafe = typeof inContent === 'string' ? inContent : '';
      if (aSafe.length === 0 || bSafe.length === 0) continue;
      if (mContent === inContent || aSafe.startsWith(bSafe) || bSafe.startsWith(aSafe)) return i;
    }
  }
  return -1;
}

/**
 * Normalize message type so AIMessage and AIMessageChunk compare equal.
 * The LangGraph SDK emits type='AIMessageChunk' on the messages-tuple
 * streaming path and type='ai' on the values-sync path for the same
 * canonical assistant message — distinguishing them prevents the
 * content-prefix dedupe from collapsing the duplicate bubbles.
 */
function normalizeMessageType(t: string | undefined): string | undefined {
  if (!t) return t;
  if (t === 'AIMessageChunk' || t === 'AIMessage' || t === 'assistant') return 'ai';
  if (t === 'HumanMessage' || t === 'HumanMessageChunk' || t === 'user') return 'human';
  if (t === 'ToolMessage') return 'tool';
  if (t === 'SystemMessage') return 'system';
  return t;
}

function toSubagentRefs(
  subagents: Map<string, TrackedSubagent>,
): Map<string, SubagentStreamRef> {
  const refs = new Map<string, SubagentStreamRef>();
  subagents.forEach((subagent, key) => {
    refs.set(key, {
      toolCallId: subagent.id,
      name: typeof subagent.toolCall.args['subagent_type'] === 'string'
        ? subagent.toolCall.args['subagent_type']
        : undefined,
      status: signal(subagent.status),
      values: signal(subagent.values),
      messages: signal(subagent.messages as unknown as BaseMessage[]),
    });
  });
  return refs;
}

function isAiMessageWithToolCalls(value: Record<string, unknown>): boolean {
  return (value['type'] === 'ai' || value['type'] === 'assistant')
    && Array.isArray(value['tool_calls']);
}

function isToolMessage(value: Record<string, unknown>): value is Record<string, unknown> & { tool_call_id: string } {
  return value['type'] === 'tool' && typeof value['tool_call_id'] === 'string';
}

function isMessageLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && (
      'content' in value
      || 'type' in value
      || 'id' in value
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const _internalsForTesting = {
  extractText,
  extractReasoning,
  accumulateContent,
  accumulateReasoning,
  collapseAdjacentAi,
  mergeMessages,
  preserveIds,
  normalizeMessageType,
};
