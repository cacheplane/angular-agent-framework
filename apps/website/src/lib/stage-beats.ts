/**
 * Scroll → recorded time for the homepage stage (spec §5.2, §6).
 *
 * The shares are authored; the times come from the frame's `ready` message,
 * so the rail's cue windows (derived from the shares) and the seek targets
 * (derived from the recording) are two views of one table.
 */
export const STAGE_BEATS = ['stream', 'persist', 'approve', 'render'] as const;
export type StageBeat = (typeof STAGE_BEATS)[number];

/** The scroll milestones the publisher reports (`marketing:stage_progress`). */
export type StageMilestone = 'enter' | 'beat' | 'threshold' | 'complete';

/** Viewport-heights of scroll each beat owns. Approve is the peak by a visible margin. */
export const STAGE_SHARES: Readonly<Record<StageBeat, number>> = {
  stream: 1.3,
  persist: 1.2,
  approve: 2.4,
  render: 1.1,
};
export const STAGE_SPAN = Object.values(STAGE_SHARES).reduce(
  (a, b) => a + b,
  0
);
/** Fractions of the approve beat: linear → hold → threshold and resume. */
export const APPROVE_HOLD = { from: 0.35, to: 0.7 } as const;
/** The last slice of the render beat holds on the mounted form. */
export const RENDER_TAIL = 0.15;

export interface StageReadyMessage {
  totalMs: number;
  beats: readonly { beat: StageBeat; startMs: number; endMs: number }[];
  hold: { startMs: number; endMs: number };
  reloadEndMs: number | null;
}

export interface BeatWindow {
  beat: StageBeat;
  from: number;
  to: number;
}

/** The act partitioned by the shares, built once: every helper below reads it per frame. */
const WINDOWS: readonly Readonly<BeatWindow>[] = Object.freeze(
  (() => {
    let acc = 0;
    return STAGE_BEATS.map((beat) => {
      const from = acc / STAGE_SPAN;
      acc += STAGE_SHARES[beat];
      return Object.freeze({ beat, from, to: acc / STAGE_SPAN });
    });
  })()
);
const APPROVE_WINDOW = WINDOWS[STAGE_BEATS.indexOf('approve')];
const LAST_WINDOW = WINDOWS[WINDOWS.length - 1];

/** Act progress at which the approve hold ends and the recording resumes. */
export const APPROVE_THRESHOLD_P =
  APPROVE_WINDOW.from +
  (APPROVE_WINDOW.to - APPROVE_WINDOW.from) * APPROVE_HOLD.to;

export function beatWindows(): readonly Readonly<BeatWindow>[] {
  return WINDOWS;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

function windowAt(q: number): Readonly<BeatWindow> {
  return WINDOWS.find((x) => q < x.to) ?? LAST_WINDOW;
}

export function beatAt(p: number): StageBeat {
  return windowAt(clamp01(p)).beat;
}

/** Progress within the beat that owns `p`, 0..1. */
function local(p: number): { beat: StageBeat; f: number } {
  const q = clamp01(p);
  const w = windowAt(q);
  return { beat: w.beat, f: clamp01((q - w.from) / (w.to - w.from)) };
}

export function inHold(p: number): boolean {
  const { beat, f } = local(p);
  return beat === 'approve' && f >= APPROVE_HOLD.from && f < APPROVE_HOLD.to;
}

/** True when scroll moved forward across the approve threshold between two frames. */
export function crossedThreshold(prevP: number, nextP: number): boolean {
  return prevP < APPROVE_THRESHOLD_P && nextP >= APPROVE_THRESHOLD_P;
}

/**
 * Piecewise monotonic: recorded milliseconds at act progress `p`.
 * A beat the recording does not know degrades forward to the end of the
 * recording rather than rewinding to the start.
 */
export function timeAt(p: number, ready: StageReadyMessage): number {
  if (p >= 1) return ready.totalMs;
  const { beat, f } = local(p);
  const b = ready.beats.find((x) => x.beat === beat);
  if (!b) return ready.totalMs;
  switch (beat) {
    case 'persist': {
      const mid = ready.reloadEndMs;
      if (mid === null) return Math.round(lerp(b.startMs, b.endMs, f));
      return f < 0.5
        ? Math.round(lerp(b.startMs, mid, f / 0.5))
        : Math.round(lerp(mid, b.endMs, (f - 0.5) / 0.5));
    }
    case 'approve': {
      if (f < APPROVE_HOLD.from)
        return Math.round(
          lerp(b.startMs, ready.hold.startMs, f / APPROVE_HOLD.from)
        );
      // One millisecond INSIDE the hold: the frame treats a boundary instant as
      // belonging to the outgoing run (phaseReachedAt subtracts an epsilon), so
      // pinning at hold.startMs exactly would report `stream`, not `pause`.
      if (f < APPROVE_HOLD.to) return Math.min(ready.hold.startMs + 1, ready.hold.endMs);
      return Math.round(
        lerp(
          ready.hold.endMs,
          b.endMs,
          (f - APPROVE_HOLD.to) / (1 - APPROVE_HOLD.to)
        )
      );
    }
    case 'render': {
      const live = 1 - RENDER_TAIL;
      return f >= live
        ? ready.totalMs
        : Math.round(lerp(b.startMs, ready.totalMs, f / live));
    }
    default:
      return Math.round(lerp(b.startMs, b.endMs, f));
  }
}

/**
 * `data-sc-cue` for a beat's rail block: "from to rampIn rampOut" as fractions
 * of act progress. The first beat greets (full at p = 0), the last holds to
 * the end (no leave ramp), the middle ones fade in and out inside their window.
 */
export function cueFor(beat: StageBeat): string {
  const w = WINDOWS[STAGE_BEATS.indexOf(beat)];
  const fmt = (n: number) => String(+n.toFixed(4));
  if (beat === STAGE_BEATS[0]) return `0 ${fmt(w.to)} 0 0.3`;
  if (beat === STAGE_BEATS[STAGE_BEATS.length - 1])
    return `${fmt(w.from)} 1 0.3 0`;
  return `${fmt(w.from)} ${fmt(w.to)}`;
}

/**
 * Cue windows for the hold lines inside the approve beat, spread across the
 * hold range. The last cue overshoots the hold by 12% of the approve span so
 * "Keep scrolling to approve" lingers past the threshold and the instruction
 * is still readable as the resume begins.
 */
export function holdLineCues(count: number): string[] {
  const a = APPROVE_WINDOW;
  const span = a.to - a.from;
  const start = a.from + span * APPROVE_HOLD.from;
  const end = APPROVE_THRESHOLD_P;
  const slot = (end - start) / count;
  return Array.from({ length: count }, (_, i) => {
    const from = start + slot * i;
    const to = i === count - 1 ? end + span * 0.12 : from + slot * 1.15;
    return `${+from.toFixed(4)} ${+Math.min(to, 1).toFixed(4)}`;
  });
}
