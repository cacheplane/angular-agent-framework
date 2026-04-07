// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
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
import type { BaseMessage } from '@langchain/core/messages';
import type { Interrupt } from '@langchain/langgraph-sdk';

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

  function resetThreadState(): void {
    subjects.values$.next({} as T);
    subjects.messages$.next([]);
    subjects.history$.next([]);
    subjects.interrupt$.next(undefined);
    subjects.interrupts$.next([]);
    subjects.isThreadLoading$.next(false);
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
    lastPayload = payload;

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

      // For partial streaming events (messages/partial), merge into existing
      // messages by id instead of replacing — preserves earlier messages
      // (e.g. human messages) that aren't in the partial update.
      if (event.type === 'messages/partial') {
        const existing = subjects.messages$.value;
        const merged = [...existing];
        for (const msg of normalized) {
          const id = (msg as unknown as Record<string, unknown>)['id'];
          const idx = id ? merged.findIndex(m => (m as unknown as Record<string, unknown>)['id'] === id) : -1;
          if (idx >= 0) {
            merged[idx] = msg;
          } else {
            merged.push(msg);
          }
        }
        subjects.messages$.next(merged);
      } else {
        subjects.messages$.next(normalized);
      }
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
      // TODO: 'tool_progress' → subjects.toolProgress$.next(...)
      // TODO: 'tool_calls'    → subjects.toolCalls$.next(...)
      // These require matching the LangGraph SDK's ToolProgressEvent/ToolCallEvent
      // shapes. Implement once the SDK event types are confirmed.
    }
  }

  return {
    submit: (payload, _opts) => runStream(payload),

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
      subjects.status$.next(ResourceStatus.Loading);
      try {
        const iter = transport.joinStream
          ? transport.joinStream(currentThreadId, runId, lastEventId, abortController.signal)
          // eslint-disable-next-line @typescript-eslint/no-empty-function, require-yield
          : (async function*() {})();
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
  const { type: _t, data: _d, ...rest } = event;
  return Object.keys(rest).length > 0 ? rest : d;
}

function isMessagesEvent(type: StreamEvent['type']): boolean {
  return type === 'messages' || type.startsWith('messages/');
}

function normalizeMessages(event: StreamEvent): unknown[] | null {
  const directMessages = event['messages'];
  if (Array.isArray(directMessages)) {
    return directMessages;
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

function isMessageLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && (
      'content' in value
      || 'type' in value
      || 'id' in value
    );
}
