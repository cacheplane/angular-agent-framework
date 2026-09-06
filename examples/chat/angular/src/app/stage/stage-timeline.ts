// examples/chat/angular/src/app/stage/stage-timeline.ts
import type { StageBeat, StageRecording, StageRun } from './stage-recording.types';

/**
 * Floor on the recorded-time room given to a reload run, which streams
 * nothing: enough for the transcript to visibly blank and restore. A reload
 * that does carry events is never shorter than this floor.
 */
export const RELOAD_MS = 600;
/**
 * The authored hold at the interrupt, in recorded milliseconds. Between the
 * approve run's last event and the resume run's first, nothing advances; the
 * parent maps a large share of scroll to this window (spec §6).
 */
export const HOLD_MS = 3000;

export type StagePhase = 'stream' | 'persist' | 'pause' | 'resume' | 'render';

export interface TimelineRun {
  readonly index: number;
  readonly run: StageRun;
  readonly startMs: number;
  readonly endMs: number;
}

export interface TimelineBeat {
  readonly beat: StageBeat;
  readonly startMs: number;
  readonly endMs: number;
}

export interface StageTimeline {
  readonly runs: readonly TimelineRun[];
  readonly beats: readonly TimelineBeat[];
  /**
   * The single authored hold at the interrupt (spec §6). A recording carries
   * exactly one resume run, so there is exactly one hold; a second resume
   * run is unsupported and would silently overwrite this field.
   */
  readonly hold: { readonly startMs: number; readonly endMs: number };
  readonly totalMs: number;
}

function durationOf(run: StageRun): number {
  if (run.action.kind === 'reload') {
    return Math.max(RELOAD_MS, (run.events[run.events.length - 1]?.tMs ?? 0) + 1);
  }
  const last = run.events[run.events.length - 1]?.tMs ?? 0;
  return Math.max(last, 1);
}

/** Lays runs end to end in recorded milliseconds, inserting the authored HOLD before the resume run. */
export function buildTimeline(rec: StageRecording): StageTimeline {
  const runs: TimelineRun[] = [];
  let cursor = 0;
  let hold = { startMs: 0, endMs: 0 };
  rec.runs.forEach((run, index) => {
    if (run.action.kind === 'resume') {
      hold = { startMs: cursor, endMs: cursor + HOLD_MS };
      cursor += HOLD_MS;
    }
    const startMs = cursor;
    const endMs = startMs + durationOf(run);
    runs.push({ index, run, startMs, endMs });
    cursor = endMs;
  });
  const beats: TimelineBeat[] = [];
  for (const r of runs) {
    const last = beats[beats.length - 1];
    if (last && last.beat === r.run.beat) beats[beats.length - 1] = { ...last, endMs: r.endMs };
    else beats.push({ beat: r.run.beat, startMs: r.startMs, endMs: r.endMs });
  }
  return { runs, beats, hold, totalMs: cursor };
}

/** Names the phase active at t: stream/persist/render follow the run's beat; pause and resume mark the interrupt. */
export function phaseAt(tl: StageTimeline, t: number): StagePhase {
  if (t >= tl.hold.startMs && t < tl.hold.endMs) return 'pause';
  let current = tl.runs[0];
  for (let i = tl.runs.length - 1; i >= 0; i--) {
    if (tl.runs[i].startMs <= t) {
      current = tl.runs[i];
      break;
    }
  }
  if (current.run.action.kind === 'resume') return 'resume';
  return current.run.beat;
}

/** Every run whose start is at or before t, in order. */
export function runsStartedBy(tl: StageTimeline, t: number): readonly TimelineRun[] {
  return tl.runs.filter((r) => r.startMs <= t);
}
