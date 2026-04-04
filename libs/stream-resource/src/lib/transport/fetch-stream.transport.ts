// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Client } from '@langchain/langgraph-sdk';
import { StreamResourceTransport, StreamEvent } from '../stream-resource.types';

/**
 * Production transport that connects to a LangGraph Platform API via HTTP and SSE.
 *
 * Creates threads automatically if no threadId is provided, and streams events
 * using the LangGraph SDK client.
 *
 * @example
 * ```typescript
 * const transport = new FetchStreamTransport(
 *   'http://localhost:2024',
 *   (id) => console.log('New thread:', id),
 * );
 * ```
 */
export class FetchStreamTransport implements StreamResourceTransport {
  private client: Client;
  private onThreadId?: (id: string) => void;

  /**
   * @param apiUrl - Base URL of the LangGraph Platform API
   * @param onThreadId - Optional callback invoked when a new thread is created
   */
  constructor(apiUrl: string, onThreadId?: (id: string) => void) {
    this.client = new Client({ apiUrl });
    this.onThreadId = onThreadId;
  }

  /** Open a streaming connection, creating a thread if needed. */
  async *stream(
    assistantId: string,
    threadId: string | null,
    payload: unknown,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const streamMode = ['values', 'messages', 'updates', 'events', 'debug'] as const;
    const opts = { signal };

    let thread = threadId;
    if (!thread) {
      const t = await this.client.threads.create();
      thread = t.thread_id;
      this.onThreadId?.(thread);
    }

    const run = this.client.runs.stream(thread, assistantId, {
      input: payload as Record<string, unknown>,
      streamMode: streamMode as unknown as 'values',
      ...opts,
    });

    for await (const event of run) {
      yield normalizeSdkEvent(event.event as StreamEvent['type'], event.data);
    }
  }

  /** Join an already-started run without creating a new thread. */
  async *joinStream(
    threadId: string,
    runId: string,
    lastEventId: string | undefined,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    // SDK joinStream: joins an already-started run without creating a new one.
    const run = this.client.runs.joinStream(threadId, runId, {
      signal,
      ...(lastEventId !== undefined ? { lastEventId } : {}),
    });

    for await (const event of run) {
      yield normalizeSdkEvent(event.event as StreamEvent['type'], event.data);
    }
  }
}

function normalizeSdkEvent(type: StreamEvent['type'], data: unknown): StreamEvent {
  if (isMessagesEvent(type) && Array.isArray(data)) {
    return { type, messages: data, data };
  }

  if (isRecord(data)) {
    return { type, ...data, data };
  }

  return { type, data };
}

function isMessagesEvent(type: StreamEvent['type']): boolean {
  return type === 'messages' || type.startsWith('messages/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
