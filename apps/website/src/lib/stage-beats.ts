/**
 * Scroll → recorded time for the homepage stage (spec §5.2, §6).
 *
 * The shares are authored; the times come from the frame's `ready` message,
 * so the rail's cue windows (derived from the shares) and the seek targets
 * (derived from the recording) are two views of one table.
 */
export const STAGE_BEATS = ['stream', 'persist', 'approve', 'render'] as const;
export type StageBeat = (typeof STAGE_BEATS)[number];

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

export function beatWindows(): BeatWindow[] {
  let acc = 0;
  return STAGE_BEATS.map((beat) => {
    const from = acc / STAGE_SPAN;
    acc += STAGE_SHARES[beat];
    return { beat, from, to: acc / STAGE_SPAN };
  });
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

export function beatAt(p: number): StageBeat {
  const q = clamp01(p);
  const w =
    beatWindows().find((x) => q < x.to) ??
    beatWindows()[STAGE_BEATS.length - 1];
  return w.beat;
}

/** Progress within the beat that owns `p`, 0..1. */
function local(p: number): { beat: StageBeat; f: number } {
  const q = clamp01(p);
  const w =
    beatWindows().find((x) => q < x.to) ??
    beatWindows()[STAGE_BEATS.length - 1];
  return { beat: w.beat, f: clamp01((q - w.from) / (w.to - w.from)) };
}

export function inHold(p: number): boolean {
  const { beat, f } = local(p);
  return beat === 'approve' && f >= APPROVE_HOLD.from && f < APPROVE_HOLD.to;
}

/** True when scroll moved forward across the approve threshold between two frames. */
export function crossedThreshold(prevP: number, nextP: number): boolean {
  const a = beatWindows()[2];
  const th = a.from + (a.to - a.from) * APPROVE_HOLD.to;
  return prevP < th && nextP >= th;
}

/** Piecewise monotonic: recorded milliseconds at act progress `p`. */
export function timeAt(p: number, ready: StageReadyMessage): number {
  if (p >= 1) return ready.totalMs;
  const { beat, f } = local(p);
  const b = ready.beats.find((x) => x.beat === beat);
  if (!b) return 0;
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
      if (f < APPROVE_HOLD.to) return ready.hold.startMs;
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
  const w = beatWindows().find((x) => x.beat === beat)!;
  const fmt = (n: number) => String(+n.toFixed(4));
  if (beat === STAGE_BEATS[0]) return `0 ${fmt(w.to)} 0 0.3`;
  if (beat === STAGE_BEATS[STAGE_BEATS.length - 1])
    return `${fmt(w.from)} 1 0.3 0`;
  return `${fmt(w.from)} ${fmt(w.to)}`;
}

/** Cue windows for the three hold lines inside the approve beat, spread across the hold range. */
export function holdLineCues(count: number): string[] {
  const a = beatWindows()[2];
  const span = a.to - a.from;
  const start = a.from + span * APPROVE_HOLD.from;
  const end = a.from + span * APPROVE_HOLD.to;
  const slot = (end - start) / count;
  return Array.from({ length: count }, (_, i) => {
    const from = start + slot * i;
    const to = i === count - 1 ? end + span * 0.12 : from + slot * 1.15;
    return `${+from.toFixed(4)} ${+Math.min(to, 1).toFixed(4)}`;
  });
}
