// SPDX-License-Identifier: MIT
import type { AgentQueueEntry, AgentTransport, LangGraphSubmitOptions, StreamEvent } from '../agent.types';
import type { ThreadState } from '@langchain/langgraph-sdk';

/**
 * Test transport for deterministic agent testing without a real LangGraph server.
 *
 * Script event batches upfront, then emit them manually or step through them
 * in your test specs. Supports error injection and close control.
 *
 * @example
 * ```typescript
 * const transport = new MockAgentTransport([
 *   [{ type: 'values', data: { messages: [aiMsg('Hello')] } }],
 *   [{ type: 'values', data: { status: 'done' } }],
 * ]);
 * ```
 */
export class MockAgentTransport implements AgentTransport {
  history: ThreadState[] = [];
  readonly historyCalls: string[] = [];
  readonly streams: Array<{ threadId: string | null; payload: unknown; options?: LangGraphSubmitOptions }> = [];
  readonly createdQueuedRuns: AgentQueueEntry[] = [];
  readonly cancelledRuns: Array<{ threadId: string; runId: string }> = [];
  readonly joinedRuns: Array<{ threadId: string; runId: string }> = [];
  private script: StreamEvent[][];
  private scriptIndex = 0;
  private streaming = false;
  private eventQueue: StreamEvent[] = [];
  // Each resolver simply wakes the stream loop to re-check state.
  private resolvers: Array<() => void> = [];
  private closed = false;
  private pendingError: Error | null = null;

  /** @param script - Array of event batches. Each batch is emitted as a group. */
  constructor(script: StreamEvent[][] = []) {
    this.script = script;
  }

  /** Advance to the next scripted batch and return its events. */
  nextBatch(): StreamEvent[] {
    if (this.scriptIndex >= this.script.length) return [];
    return this.script[this.scriptIndex++];
  }

  /** Manually emit events into the stream. */
  emit(events: StreamEvent[]): void {
    this.eventQueue.push(...events);
    this.flush();
  }

  /** Inject an error into the stream. */
  emitError(err: Error): void {
    this.pendingError = err;
    this.flush();
  }

  /** Close the stream. Remaining queued events are drained before completion. */
  close(): void {
    this.closed = true;
    this.flush();
  }

  /** Returns true if a stream is currently active. */
  isStreaming(): boolean {
    return this.streaming;
  }

  async *stream(
    _assistantId: string,
    _threadId: string | null,
    _payload: unknown,
    signal: AbortSignal,
    options?: LangGraphSubmitOptions,
  ): AsyncIterable<StreamEvent> {
    this.streams.push({ threadId: _threadId, payload: _payload, options });
    this.streaming = true;
    try {
      while (!this.closed && !signal.aborted) {
        if (this.pendingError) throw this.pendingError;
        if (this.eventQueue.length > 0) {
          const event = this.eventQueue.shift();
          if (event) yield event;
        } else {
          // Wait until flush() wakes us, then loop again to check state.
          await new Promise<void>((resolve) => {
            if (signal.aborted) { resolve(); return; }
            this.resolvers.push(resolve);
          });
        }
      }
      if (signal.aborted) return;
      // Drain remaining events after close()
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (event) yield event;
      }
    } finally {
      this.streaming = false;
    }
  }

  async createQueuedRun(
    _assistantId: string,
    threadId: string,
    payload: unknown,
    signal: AbortSignal,
    options?: LangGraphSubmitOptions,
  ): Promise<AgentQueueEntry> {
    void signal;
    const entry: AgentQueueEntry = {
      id: `queued-run-${this.createdQueuedRuns.length + 1}`,
      threadId,
      values: payload,
      options: { ...options, multitaskStrategy: 'enqueue' },
      createdAt: new Date(),
    };
    this.createdQueuedRuns.push(entry);
    return entry;
  }

  async cancelRun(threadId: string, runId: string, signal: AbortSignal): Promise<void> {
    void signal;
    this.cancelledRuns.push({ threadId, runId });
  }

  async getHistory(threadId: string, signal: AbortSignal): Promise<ThreadState[]> {
    void signal;
    this.historyCalls.push(threadId);
    return this.history;
  }

  async *joinStream(
    threadId: string,
    runId: string,
    lastEventId: string | undefined,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    void lastEventId;
    void signal;
    this.joinedRuns.push({ threadId, runId });
    yield { type: 'values', values: { queued: true } };
  }

  private flush(): void {
    const resolve = this.resolvers.shift();
    if (resolve) resolve();
  }
}
