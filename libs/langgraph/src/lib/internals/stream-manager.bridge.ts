// SPDX-License-Identifier: MIT
import { Observable, takeUntil } from 'rxjs';
import {
  ResourceStatus,
  AgentOptions,
  StreamSubjects,
  StreamEvent,
  AgentTransport,
} from '../agent.types';
import { FetchStreamTransport } from '../transport/fetch-stream.transport';
import { BagTemplate } from '@langchain/langgraph-sdk';
import { getToolCallsWithResults } from '@langchain/langgraph-sdk/utils';
import type { BaseMessage } from '@langchain/core/messages';
import type { Interrupt, Message as LangGraphMessage, ToolCallWithResult, ToolProgress } from '@langchain/langgraph-sdk';

export interface StreamManagerBridgeOptions<T, ResolvedBag extends BagTemplate = BagTemplate> {
  options:   AgentOptions<T, ResolvedBag>;
  subjects:  StreamSubjects<T, ResolvedBag>;
  threadId$: Observable<string | null>;
  destroy$:  Observable<void>;
}

export interface StreamManagerBridge {
  submit:       (values: unknown, opts?: unknown) => Promise<void>;
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
  let abortController: AbortController | null = null;
  let hasSeenThreadId = false;
  const toolProgressMap = new Map<string, ToolProgress>();

  function resetThreadState(): void {
    subjects.values$.next({} as T);
    subjects.messages$.next([]);
    subjects.history$.next([]);
    subjects.interrupt$.next(undefined);
    subjects.interrupts$.next([]);
    subjects.toolProgress$.next([]);
    subjects.toolCalls$.next([]);
    subjects.messageMetadata$.next(new Map());
    subjects.custom$.next([]);
    subjects.isThreadLoading$.next(false);
    toolProgressMap.clear();
  }

  function setThreadId(id: string | null, resetState: boolean): void {
    if (resetState) {
      abortController?.abort();
    }
    currentThreadId = id;
    if (resetState) {
      resetThreadState();
    }
  }

  // Track threadId changes
  threadId$.pipe(takeUntil(destroy$)).subscribe(id => {
    const shouldReset = hasSeenThreadId && currentThreadId !== id;
    hasSeenThreadId = true;
    setThreadId(id, shouldReset);
  });

  async function runStream(payload: unknown): Promise<void> {
    abortController?.abort();
    abortController = new AbortController();

    subjects.status$.next(ResourceStatus.Loading);
    subjects.error$.next(undefined);
    subjects.custom$.next([]);
    subjects.toolProgress$.next([]);
    toolProgressMap.clear();
    lastPayload = payload;

    // Optimistically inject human messages so they appear immediately
    // without waiting for the server to echo them back.
    const inputMessages = (payload as Record<string, unknown>)?.['messages'];
    if (Array.isArray(inputMessages) && inputMessages.length > 0) {
      const existing = subjects.messages$.value;
      subjects.messages$.next([...existing, ...inputMessages as BaseMessage[]]);
    }

    try {
      const iter = transport.stream(
        options.assistantId,
        currentThreadId,
        payload,
        abortController.signal,
      );

      for await (const event of iter) {
        if (abortController.signal.aborted) break;
        processEvent(event);
      }

      if (!abortController.signal.aborted) {
        subjects.status$.next(ResourceStatus.Resolved);
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
    if (isMessagesEvent(event.type)) {
      const msgs = normalizeMessages(event);
      if (!msgs) return;

      const normalized = options.toMessage
        ? msgs.map(options.toMessage)
        : msgs as BaseMessage[];

      // Partial and message-tuple events are incremental. Merge them by id
      // so optimistic human messages and earlier tool messages are preserved.
      if (event.type === 'messages/partial' || event.messageMetadata) {
        subjects.messages$.next(mergeMessages(subjects.messages$.value, normalized));
      } else {
        subjects.messages$.next(normalized);
      }
      storeMessageMetadata(normalized, event);
      syncToolCallsFromMessages();
      return;
    }

    // normalizeSdkEvent spreads event data directly into the event object,
    // so the values/updates payload is at event['data'] (the original data object),
    // NOT at event['values'] or event['updates'].
    switch (event.type) {
      case 'values': {
        const vals = extractEventData(event);
        if (vals != null) {
          subjects.values$.next(vals as T);
          // Also sync messages$ from the values state so the full message
          // history (including human messages) is available to consumers.
          const stateMessages = (vals as Record<string, unknown>)['messages'];
          if (Array.isArray(stateMessages)) {
            if (options.toMessage) {
              subjects.messages$.next(stateMessages.map(options.toMessage));
            } else {
              subjects.messages$.next(stateMessages as BaseMessage[]);
            }
            syncToolCallsFromMessages();
          }
        }
        break;
      }
      case 'updates': {
        const upd = extractEventData(event);
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
    submit: (payload) => runStream(payload),

    stop: async () => {
      abortController?.abort();
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
      } catch (err) {
        subjects.error$.next(err);
        subjects.status$.next(ResourceStatus.Error);
      }
    },

    resubmitLast: async () => {
      if (lastPayload !== null) {
        await runStream(lastPayload);
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
  return type === 'messages' || type.startsWith('messages/');
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
