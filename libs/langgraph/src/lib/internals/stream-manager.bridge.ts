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

export interface StreamManagerBridgeOptions<T, ResolvedBag extends BagTemplate = BagTemplate> {
  options:   AgentOptions<T, ResolvedBag>;
  subjects:  StreamSubjects<T, ResolvedBag>;
  threadId$: Observable<string | null>;
  destroy$:  Observable<void>;
}

export interface StreamManagerBridge {
  submit:       (values: unknown, opts?: LangGraphSubmitOptions) => Promise<void>;
  stop:         () => Promise<void>;
  switchThread: (id: string | null) => void;
  joinStream:   (runId: string, lastEventId?: string) => Promise<void>;
  resubmitLast: () => Promise<void>;
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
        subjects.messages$.next(mergeMessages(subjects.messages$.value, normalized));
      } else if (normalized.length === 0) {
        // Defensive: skip empty replacements during streaming. An empty
        // batch shouldn't tear down the entire UI (causes message DOM
        // teardown + streaming renderer reset = visible jank).
      } else {
        subjects.messages$.next(normalized);
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
            if (options.toMessage) {
              subjects.messages$.next(stateMessages.map(options.toMessage));
            } else {
              subjects.messages$.next(stateMessages as BaseMessage[]);
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

function mergeMessages(existing: BaseMessage[], incoming: BaseMessage[]): BaseMessage[] {
  const merged = [...existing];
  for (const msg of incoming) {
    const id = (msg as unknown as Record<string, unknown>)['id'];
    const idx = id ? merged.findIndex(m => (m as unknown as Record<string, unknown>)['id'] === id) : -1;
    if (idx >= 0) {
      merged[idx] = msg;
    } else {
      merged.push(msg);
    }
  }
  return merged;
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
