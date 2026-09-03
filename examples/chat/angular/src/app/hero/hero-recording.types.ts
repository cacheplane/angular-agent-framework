// SPDX-License-Identifier: MIT
import type { StreamEvent } from '@threadplane/langgraph';

/** One transport event with its offset from the start of its run. */
export interface RecordedEvent { readonly tMs: number; readonly event: StreamEvent; }
/** One `AgentTransport.stream()` call, start to finish. */
export interface RecordedRun { readonly label: string; readonly events: readonly RecordedEvent[]; }
/** The committed hero walkthrough: prompt → interrupt, resume, generative UI. */
export interface HeroRecording { readonly version: 1; readonly recordedAt: string; readonly runs: readonly RecordedRun[]; }

export const HERO_RECORDING_RUN_COUNT = 3;

/** Throws a readable error when the fixture is not a usable recording. */
export function validateHeroRecording(input: unknown): HeroRecording {
  if (typeof input !== 'object' || input === null) throw new Error('hero recording must be an object');
  const rec = input as Partial<HeroRecording>;
  if (rec.version !== 1) throw new Error('hero recording version must be 1');
  if (!Array.isArray(rec.runs) || rec.runs.length < HERO_RECORDING_RUN_COUNT) {
    throw new Error(`hero recording needs at least three runs, got ${rec.runs?.length ?? 0}`);
  }
  rec.runs.forEach((run: Partial<RecordedRun>, i: number) => {
    if (typeof run.label !== 'string') throw new Error(`run ${i} has no label`);
    if (!Array.isArray(run.events)) throw new Error(`run ${i} has no events`);
    if (run.events.length === 0) throw new Error(`run ${i} has no events`);
    (run.events as readonly Partial<RecordedEvent>[]).forEach((e: Partial<RecordedEvent>, j: number) => {
      if (typeof e?.tMs !== 'number' || !Number.isFinite(e.tMs)) throw new Error(`run ${i} event ${j} has no numeric tMs`);
      if (typeof e.event !== 'object' || e.event === null) throw new Error(`run ${i} event ${j} has no event`);
    });
  });
  return rec as HeroRecording;
}
