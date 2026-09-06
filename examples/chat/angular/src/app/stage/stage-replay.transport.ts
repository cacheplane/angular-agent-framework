// examples/chat/angular/src/app/stage/stage-replay.transport.ts
import { signal } from '@angular/core';
import type { AgentQueueEntry, AgentTransport, LangGraphSubmitOptions, StreamEvent } from '@threadplane/langgraph';
import type { ThreadState } from '@langchain/langgraph-sdk';
import { validateStageRecording, type StageRecording } from './stage-recording.types';
import { buildTimeline, type StageTimeline } from './stage-timeline';

export const STAGE_RECORDING_URL = '/stage-replay.json';

async function fetchRecording(): Promise<StageRecording> {
  const res = await fetch(STAGE_RECORDING_URL);
  if (!res.ok) throw new Error(`stage recording fetch failed: ${res.status}`);
  return validateStageRecording(await res.json());
}

/**
 * AgentTransport that replays the committed stage recording under a gate:
 * each `stream()` call answers the next non-reload run, yielding events whose
 * ABSOLUTE recorded time (run start + tMs) is at or before the current target
 * `t`, and waiting for `seek()` to move `t` before yielding the rest. There is
 * no clock: the parent's scroll is the clock. Backward seeks are the
 * controller's job (reset + fast-forward); this transport only ever moves
 * forward within a run, and `reset()` ends any stream still waiting.
 */
export class StageReplayTransport implements AgentTransport {
  private recording: Promise<StageRecording> | null = null;
  private timeline: StageTimeline | null = null;
  private t = 0;
  private readonly wakers = new Set<() => void>();
  /** Bumped by reset(); a stream whose generation is stale ends itself. */
  private generation = 0;
  /** Index of the next run `stream()` will answer. Reload runs are skipped. */
  runIndex = 0;
  private readonly appliedCount = signal(0);
  readonly appliedSignal = this.appliedCount.asReadonly();

  constructor(private readonly load: () => Promise<StageRecording> = fetchRecording) {}

  async ready(): Promise<StageTimeline> {
    const rec = await this.getRecording();
    this.timeline ??= buildTimeline(rec);
    return this.timeline;
  }
  recordingData(): Promise<StageRecording> { return this.getRecording(); }
  /** Events yielded so far across all runs since the last reset. */
  applied(): number { return this.appliedCount(); }

  seek(t: number): void {
    this.t = t;
    this.wakeAll();
  }
  reset(): void {
    this.generation += 1;
    this.runIndex = 0;
    this.appliedCount.set(0);
    this.wakeAll();
  }

  async *stream(_a: string, _thread: string | null, _payload: unknown, abortSignal: AbortSignal, _o?: LangGraphSubmitOptions): AsyncIterable<StreamEvent> {
    const tl = await this.ready();
    const gen = this.generation;
    while (tl.runs[this.runIndex]?.run.action.kind === 'reload') this.runIndex += 1;
    const entry = tl.runs[this.runIndex];
    if (!entry) return;
    this.runIndex += 1;
    for (const { tMs, event } of entry.run.events) {
      while (entry.startMs + tMs > this.t) {
        if (abortSignal.aborted || gen !== this.generation) return;
        await this.wait(abortSignal);
      }
      if (abortSignal.aborted || gen !== this.generation) return;
      this.appliedCount.update((n) => n + 1);
      yield event;
    }
  }

  private wait(abortSignal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const wake = () => { this.wakers.delete(wake); abortSignal.removeEventListener('abort', wake); resolve(); };
      this.wakers.add(wake);
      abortSignal.addEventListener('abort', wake, { once: true });
    });
  }
  private wakeAll(): void { for (const w of [...this.wakers]) w(); }

  /** The latest snapshot recorded after no more runs than have been started on replay. */
  async getHistory(_thread: string, _signal: AbortSignal): Promise<ThreadState[]> {
    const rec = await this.getRecording();
    const snapshot = [...rec.histories]
      .sort((a, b) => a.afterRun - b.afterRun)
      .filter((h) => h.afterRun <= this.runIndex)
      .pop();
    return (snapshot?.states ?? []) as ThreadState[];
  }
  async createQueuedRun(_a: string, threadId: string, payload: unknown, _s: AbortSignal, options?: LangGraphSubmitOptions): Promise<AgentQueueEntry> {
    return { id: 'stage-replay-queued-run', threadId, values: payload, options: { ...options, multitaskStrategy: 'enqueue' }, createdAt: new Date() };
  }
  async cancelRun(): Promise<void> { return; }
  async *joinStream(): AsyncIterable<StreamEvent> { yield* []; }

  private getRecording(): Promise<StageRecording> {
    this.recording ??= this.load().catch((err) => { this.recording = null; throw err; });
    return this.recording;
  }
}
