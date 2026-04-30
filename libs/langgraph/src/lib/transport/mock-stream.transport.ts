// SPDX-License-Identifier: MIT
import { AgentTransport, StreamEvent } from '../agent.types';

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
  ): AsyncIterable<StreamEvent> {
    this.streaming = true;
    try {
      while (!this.closed && !signal.aborted) {
        if (this.pendingError) throw this.pendingError;
        if (this.eventQueue.length > 0) {
          yield this.eventQueue.shift()!;
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
      while (this.eventQueue.length > 0) yield this.eventQueue.shift()!;
    } finally {
      this.streaming = false;
    }
  }

  private flush(): void {
    const resolve = this.resolvers.shift();
    if (resolve) resolve();
  }
}
