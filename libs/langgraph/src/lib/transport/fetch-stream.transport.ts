// SPDX-License-Identifier: MIT
import { Client } from '@langchain/langgraph-sdk';
import type { StreamMode, ThreadState } from '@langchain/langgraph-sdk';
import type { AgentQueueEntry, AgentTransport, LangGraphSubmitOptions, StreamEvent } from '../agent.types';

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
export class FetchStreamTransport implements AgentTransport {
  private client: Client;
  private onThreadId?: (id: string) => void;

  /**
   * @param apiUrl - Base URL of the LangGraph Platform API
   * @param onThreadId - Optional callback invoked when a new thread is created
   */
  constructor(apiUrl: string, onThreadId?: (id: string) => void) {
    // Normalize relative paths (e.g. '/api') to absolute URLs.
    // The LangGraph SDK Client requires an absolute URL, but production
    // environments use relative paths that are proxied by Vercel middleware.
    const absoluteUrl = apiUrl.startsWith('http://') || apiUrl.startsWith('https://')
      ? apiUrl
      : typeof window !== 'undefined'
        ? `${window.location.origin}${apiUrl}`
        : apiUrl;
    this.client = new Client({ apiUrl: absoluteUrl });
    this.onThreadId = onThreadId;
  }

  /** Open a streaming connection, creating a thread if needed. */
  async *stream(
    assistantId: string,
    threadId: string | null,
    payload: unknown,
    signal: AbortSignal,
    options?: LangGraphSubmitOptions,
  ): AsyncIterable<StreamEvent> {
    let thread = threadId;
    if (!thread) {
      const t = await this.client.threads.create();
      thread = t.thread_id;
      this.onThreadId?.(thread);
    }

    const run = this.client.runs.stream(
      thread,
      assistantId,
      buildRunPayload(payload, signal, options),
    );

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

  /** Create a pending server-side run using LangGraph's enqueue strategy. */
  async createQueuedRun(
    assistantId: string,
    threadId: string,
    payload: unknown,
    signal: AbortSignal,
    options?: LangGraphSubmitOptions,
  ): Promise<AgentQueueEntry> {
    const run = await this.client.runs.create(threadId, assistantId, {
      ...buildRunPayload(payload, signal, options),
      multitaskStrategy: 'enqueue',
    });

    return {
      id: run.run_id,
      threadId: run.thread_id ?? threadId,
      values: payload,
      options: { multitaskStrategy: 'enqueue', signal },
      createdAt: run.created_at ? new Date(run.created_at) : new Date(),
    };
  }

  /** Cancel a server-side run. */
  async cancelRun(threadId: string, runId: string, signal: AbortSignal): Promise<void> {
    await this.client.runs.cancel(threadId, runId, false, 'interrupt', { signal });
  }

  /** Load persisted checkpoint history for a thread. */
  async getHistory(threadId: string, signal: AbortSignal): Promise<ThreadState[]> {
    return this.client.threads.getHistory(threadId, { signal });
  }
}

function buildRunPayload(
  input: unknown,
  signal: AbortSignal,
  options?: LangGraphSubmitOptions,
): {
  input: Record<string, unknown> | null;
  streamMode: StreamMode[];
  streamSubgraphs: boolean;
  signal: AbortSignal;
} & Omit<LangGraphSubmitOptions, 'signal' | 'resume' | 'checkpoint' | 'streamMode' | 'streamSubgraphs'> {
  const runOptions = { ...(options ?? {}) };
  const hasCheckpoint = Object.prototype.hasOwnProperty.call(runOptions, 'checkpoint');
  const checkpoint = runOptions.checkpoint;
  const streamMode = runOptions.streamMode;
  const streamSubgraphs = runOptions.streamSubgraphs;
  delete runOptions.signal;
  delete runOptions.resume;
  delete runOptions.checkpoint;
  delete runOptions.streamMode;
  delete runOptions.streamSubgraphs;

  return {
    ...runOptions,
    ...(hasCheckpoint ? { checkpoint } : {}),
    input: input as Record<string, unknown> | null,
    streamMode: streamMode ?? defaultStreamMode(),
    streamSubgraphs: streamSubgraphs ?? true,
    signal,
  };
}

function defaultStreamMode(): StreamMode[] {
  // 'tools' is intentionally omitted: not supported by langgraph_api < 0.9.x
  // Servers reject the entire request with HTTP 422 if any stream_mode in
  // the array is unknown to them. Tool-call data is still derivable from
  // the messages stream.
  return ['values', 'messages-tuple', 'updates', 'custom'];
}

function normalizeSdkEvent(type: StreamEvent['type'], data: unknown): StreamEvent {
  const namespace = extractNamespace(type);
  const baseType = getBaseEventType(type);

  if (baseType === 'messages' && Array.isArray(data) && data.length === 2 && isRecord(data[1])) {
    return { type, ...(namespace ? { namespace } : {}), messages: [data[0]], messageMetadata: data[1], data };
  }

  if (isMessagesEvent(type) && Array.isArray(data)) {
    return { type, ...(namespace ? { namespace } : {}), messages: data, data };
  }

  if (isRecord(data)) {
    return { type, ...(namespace ? { namespace } : {}), ...data, data };
  }

  return { type, ...(namespace ? { namespace } : {}), data };
}

function isMessagesEvent(type: StreamEvent['type']): boolean {
  const baseType = getBaseEventType(type);
  return baseType === 'messages' || baseType.startsWith('messages/');
}

function getBaseEventType(type: StreamEvent['type']): string {
  return String(type).split('|')[0];
}

function extractNamespace(type: StreamEvent['type']): string[] | undefined {
  const parts = String(type).split('|');
  return parts.length > 1 ? parts.slice(1) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
