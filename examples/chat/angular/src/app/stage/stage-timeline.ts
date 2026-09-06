// examples/chat/angular/src/app/stage/stage-timeline.ts
import type { StageBeat, StageRecording, StageRun } from './stage-recording.types';

/**
 * The recorded-time room given to a reload run, which streams nothing (the
 * validator rejects a reload that carries events): enough for the transcript
 * to visibly blank and restore.
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
  if (run.action.kind === 'reload') return RELOAD_MS;
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
  // The beats and the phases are almost the same vocabulary, except that the
  // `approve` beat spans three phases: the submit run that streams up to the
  // interrupt is `stream`, the authored hold is `pause` (returned above), and
  // the resume run is `resume` (also above). Reporting the submit run as
  // `pause` would leave a parent unable to tell streaming from held.
  return current.run.beat === 'approve' ? 'stream' : current.run.beat;
}

/**
 * How far before a boundary the rendered moment sits. Runs are laid end to
 * end, so a run's end is the next run's start; at that instant the outgoing
 * run still owns the frame.
 */
const PHASE_EPSILON = 1e-3;

/**
 * The phase of the moment the stage has REACHED at t, not of the one about to
 * begin — `t` minus an epsilon. This is what a consumer should render; it is
 * NOT a report of which action has fired (see the boundary note in
 * stage-controller.ts).
 */
export function phaseReachedAt(tl: StageTimeline, t: number): StagePhase {
  return phaseAt(tl, Math.max(0, t - PHASE_EPSILON));
}

/** Every run whose start is at or before t, in order. */
export function runsStartedBy(tl: StageTimeline, t: number): readonly TimelineRun[] {
  return tl.runs.filter((r) => r.startMs <= t);
}
