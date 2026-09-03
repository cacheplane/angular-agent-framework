// SPDX-License-Identifier: MIT
import { Injectable } from '@angular/core';
import type { AgentQueueEntry, AgentTransport, LangGraphSubmitOptions, StreamEvent } from '@threadplane/langgraph';
import type { ThreadState } from '@langchain/langgraph-sdk';
import { validateHeroRecording, type HeroRecording } from './hero-recording.types';

export interface ReplayClock { sleep(ms: number): Promise<void>; }

/** Floor keeps tokens visibly streaming even when the recording was near-atomic
 *  (aimock replay is); ceiling keeps long model pauses from stalling the hero. */
export const REPLAY_MIN_GAP_MS = 30;
export const REPLAY_MAX_GAP_MS = 600;
export const HERO_RECORDING_URL = '/hero-replay.json';

const realClock: ReplayClock = { sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };

async function fetchRecording(): Promise<HeroRecording> {
  const res = await fetch(HERO_RECORDING_URL);
  if (!res.ok) throw new Error(`hero recording fetch failed: ${res.status}`);
  return validateHeroRecording(await res.json());
}

/**
 * AgentTransport that answers each `stream()` call with the next recorded run.
 * Backs the hero's replay agent. No backend, no LLM. NOT for production apps.
 */
@Injectable()
export class HeroReplayTransport implements AgentTransport {
  private readonly clock: ReplayClock;
  private readonly load: () => Promise<HeroRecording>;
  private recording: Promise<HeroRecording> | null = null;
  private runIndex = 0;

  constructor(clock?: ReplayClock, load?: () => Promise<HeroRecording>) {
    this.clock = clock ?? realClock;
    this.load = load ?? fetchRecording;
  }

  /** Resolves once the fixture is loaded; the hero posts `ready` after this. */
  ready(): Promise<void> { return this.getRecording().then(() => undefined); }

  reset(): void { this.runIndex = 0; }

  async *stream(_assistantId: string, _threadId: string | null, _payload: unknown, signal: AbortSignal, _options?: LangGraphSubmitOptions): AsyncIterable<StreamEvent> {
    const rec = await this.getRecording();
    const run = rec.runs[this.runIndex];
    if (!run) return;
    this.runIndex += 1;
    let last = 0;
    for (const { tMs, event } of run.events) {
      if (signal.aborted) return;
      const gap = Math.min(REPLAY_MAX_GAP_MS, Math.max(REPLAY_MIN_GAP_MS, tMs - last));
      last = tMs;
      await this.clock.sleep(gap);
      if (signal.aborted) return;
      yield event;
    }
  }

  async createQueuedRun(_assistantId: string, threadId: string, payload: unknown, _signal: AbortSignal, options?: LangGraphSubmitOptions): Promise<AgentQueueEntry> {
    return { id: 'hero-replay-queued-run', threadId, values: payload, options: { ...options, multitaskStrategy: 'enqueue' }, createdAt: new Date() };
  }
  async cancelRun(): Promise<void> { return; }
  async getHistory(): Promise<ThreadState[]> { return []; }
  async *joinStream(): AsyncIterable<StreamEvent> { yield* []; }

  private getRecording(): Promise<HeroRecording> { this.recording ??= this.load(); return this.recording; }
}
