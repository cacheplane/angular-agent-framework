// SPDX-License-Identifier: MIT
import type { AgentQueueEntry, AgentTransport, LangGraphSubmitOptions, StreamEvent } from '@threadplane/langgraph';
import type { ThreadState } from '@langchain/langgraph-sdk';
import type { HeroRecording, RecordedRun } from './hero-recording.types';

const RUN_LABELS = ['prompt', 'resume', 'genui'] as const;

/** Used when the inner transport has no `joinStream` to delegate to. */
const EMPTY_STREAM: AsyncIterable<StreamEvent> = {
  [Symbol.asyncIterator]() {
    return { next: () => Promise.resolve({ done: true as const, value: undefined }) };
  },
};

declare global {
  interface Window {
    /** Set by HeroRecordingTransport in record mode; read by the record script. */
    __heroRecording?: HeroRecording;
  }
}

/**
 * Wraps the real transport, forwards everything, and keeps a copy of every
 * `stream()` call's events with millisecond offsets. Only wired when
 * `/hero?record=1` is opened in a non-production build.
 */
export class HeroRecordingTransport implements AgentTransport {
  private readonly runs: RecordedRun[] = [];
  constructor(private readonly inner: AgentTransport, private readonly now: () => number = () => performance.now()) {}

  recording(): HeroRecording { return { version: 1, recordedAt: new Date().toISOString(), runs: [...this.runs] }; }

  async *stream(assistantId: string, threadId: string | null, payload: unknown, signal: AbortSignal, options?: LangGraphSubmitOptions): AsyncIterable<StreamEvent> {
    const start = this.now();
    const events: { tMs: number; event: StreamEvent }[] = [];
    const index = this.runs.length;
    this.runs.push({ label: RUN_LABELS[index] ?? `run-${index + 1}`, events });
    for await (const event of this.inner.stream(assistantId, threadId, payload, signal, options)) {
      events.push({ tMs: Math.round(this.now() - start), event });
      this.publish();
      yield event;
    }
    this.publish();
  }
  joinStream(threadId: string, runId: string, lastEventId: string | undefined, signal: AbortSignal): AsyncIterable<StreamEvent> {
    return this.inner.joinStream ? this.inner.joinStream(threadId, runId, lastEventId, signal) : EMPTY_STREAM;
  }
  createQueuedRun(assistantId: string, threadId: string, payload: unknown, signal: AbortSignal, options?: LangGraphSubmitOptions): Promise<AgentQueueEntry> {
    if (!this.inner.createQueuedRun) throw new Error('inner transport cannot queue runs');
    return this.inner.createQueuedRun(assistantId, threadId, payload, signal, options);
  }
  cancelRun(threadId: string, runId: string, signal: AbortSignal): Promise<void> {
    return this.inner.cancelRun ? this.inner.cancelRun(threadId, runId, signal) : Promise.resolve();
  }
  getHistory(threadId: string, signal: AbortSignal): Promise<ThreadState[]> {
    return this.inner.getHistory ? this.inner.getHistory(threadId, signal) : Promise.resolve([]);
  }
  updateState(threadId: string, values: Record<string, unknown>, signal: AbortSignal, options?: { asNode?: string }): Promise<void> {
    return this.inner.updateState ? this.inner.updateState(threadId, values, signal, options) : Promise.resolve();
  }
  private publish(): void { if (typeof window !== 'undefined') window.__heroRecording = this.recording(); }
}
