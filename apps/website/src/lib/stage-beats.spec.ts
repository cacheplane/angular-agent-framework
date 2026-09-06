import { describe, expect, it } from 'vitest';
import {
  APPROVE_HOLD,
  APPROVE_THRESHOLD_P,
  RENDER_TAIL,
  STAGE_BEATS,
  STAGE_SPAN,
  beatAt,
  beatWindows,
  closeCue,
  crossedThreshold,
  cueFor,
  holdCue,
  HOLD_LINE_OVERSHOOT,
  inHold,
  isChecked,
  segmentState,
  settleAt,
  timeAt,
  type StageReadyMessage,
} from './stage-beats';

const READY: StageReadyMessage = {
  totalMs: 40_000,
  beats: [
    { beat: 'stream', startMs: 0, endMs: 12_000 },
    { beat: 'persist', startMs: 12_000, endMs: 20_000 },
    { beat: 'approve', startMs: 20_000, endMs: 32_000 },
    { beat: 'render', startMs: 32_000, endMs: 40_000 },
  ],
  hold: { startMs: 27_000, endMs: 30_000 },
  reloadEndMs: 12_600,
};

describe('beatWindows', () => {
  it('partitions the act by the shares, in beat order, summing to the span', () => {
    const w = beatWindows();
    expect(w.map((x) => x.beat)).toEqual([...STAGE_BEATS]);
    expect(w[0].from).toBe(0);
    expect(w[w.length - 1].to).toBe(1);
    w.slice(1).forEach((x, i) => expect(x.from).toBe(w[i].to));
    expect(STAGE_SPAN).toBe(6);
  });
  it('returns one frozen table', () => {
    const w = beatWindows();
    expect(beatWindows()).toBe(w);
    expect(Object.isFrozen(w)).toBe(true);
    w.forEach((x) => expect(Object.isFrozen(x)).toBe(true));
  });
  it('places the approve threshold at the end of the hold', () => {
    const a = beatWindows()[2];
    expect(APPROVE_THRESHOLD_P).toBe(
      a.from + (a.to - a.from) * APPROVE_HOLD.to
    );
  });
});

describe('timeAt', () => {
  it('is monotonic non-decreasing across the whole act, seams included', () => {
    const a = beatWindows()[2];
    const seams = beatWindows().flatMap((w) => [w.from, w.to]);
    seams.push(a.from + (a.to - a.from) * APPROVE_HOLD.from);
    seams.push(APPROVE_THRESHOLD_P);
    const grid = Array.from({ length: 2001 }, (_, i) => i / 2000);
    const samples = [...grid, ...seams].sort((x, y) => x - y);
    let last = -1;
    for (const p of samples) {
      const t = timeAt(p, READY);
      expect(t).toBeGreaterThanOrEqual(last);
      last = t;
    }
  });
  it('lands each beat boundary on the recording boundary', () => {
    const w = beatWindows();
    w.forEach((x, i) =>
      expect(timeAt(x.from, READY)).toBe(READY.beats[i].startMs)
    );
    expect(timeAt(1, READY)).toBe(READY.totalMs);
  });
  it('settles the reload at the persist midpoint', () => {
    const persist = beatWindows()[1];
    expect(timeAt((persist.from + persist.to) / 2, READY)).toBe(
      READY.reloadEndMs
    );
  });
  it('pins time at the interrupt through the hold and resumes past the threshold', () => {
    const a = beatWindows()[2];
    const at = (f: number) => timeAt(a.from + (a.to - a.from) * f, READY);
    // Pinned one millisecond inside the hold, so the frame reports `pause`.
    expect(at(APPROVE_HOLD.from)).toBe(READY.hold.startMs + 1);
    expect(at(0.5)).toBe(READY.hold.startMs + 1);
    expect(at(APPROVE_HOLD.to - 1e-6)).toBe(READY.hold.startMs + 1);
    expect(at(APPROVE_HOLD.to)).toBe(READY.hold.endMs);
    expect(at(1)).toBe(READY.beats[2].endMs);
  });
  it('holds the mounted form through the render tail', () => {
    const r = beatWindows()[3];
    expect(timeAt(r.from + (r.to - r.from) * 0.9, READY)).toBe(READY.totalMs);
  });
  it('clamps outside 0..1 and falls back to linear persist without a reload', () => {
    expect(timeAt(-1, READY)).toBe(0);
    expect(timeAt(2, READY)).toBe(READY.totalMs);
    const noReload = { ...READY, reloadEndMs: null };
    const persist = beatWindows()[1];
    expect(timeAt((persist.from + persist.to) / 2, noReload)).toBe(16_000);
  });
  it('degrades forward to the end of the recording when a beat is missing', () => {
    const missing = {
      ...READY,
      beats: READY.beats.filter((b) => b.beat !== 'persist'),
    };
    const persist = beatWindows()[1];
    expect(timeAt((persist.from + persist.to) / 2, missing)).toBe(
      READY.totalMs
    );
    expect(timeAt(persist.from, missing)).not.toBe(0);
  });
});

describe('inHold / beatAt / crossedThreshold', () => {
  it('reports the hold only inside the approve hold range', () => {
    const a = beatWindows()[2];
    const at = (f: number) => a.from + (a.to - a.from) * f;
    expect(inHold(at(0.5))).toBe(true);
    expect(inHold(at(APPROVE_HOLD.from - 0.01))).toBe(false);
    expect(inHold(at(0.2))).toBe(false);
    expect(inHold(a.from)).toBe(false);
    expect(inHold(APPROVE_THRESHOLD_P)).toBe(false);
  });
  it('names the beat at a progress', () => {
    expect(beatAt(0)).toBe('stream');
    expect(beatAt(0.999)).toBe('render');
    expect(beatAt(1)).toBe('render');
  });
  it('fires only on a forward crossing', () => {
    const a = beatWindows()[2];
    const th = a.from + (a.to - a.from) * APPROVE_HOLD.to;
    expect(crossedThreshold(th - 0.01, th + 0.01)).toBe(true);
    expect(crossedThreshold(th - 0.01, th)).toBe(true);
    expect(crossedThreshold(th + 0.01, th - 0.01)).toBe(false);
    expect(crossedThreshold(th + 0.01, th + 0.02)).toBe(false);
    expect(crossedThreshold(th - 0.02, th - 0.01)).toBe(false);
  });
  it('fires again after a rewind back below the threshold', () => {
    const a = beatWindows()[2];
    const th = a.from + (a.to - a.from) * APPROVE_HOLD.to;
    expect(crossedThreshold(th - 0.01, th + 0.01)).toBe(true);
    expect(crossedThreshold(th + 0.01, th - 0.01)).toBe(false);
    expect(crossedThreshold(th - 0.01, th + 0.01)).toBe(true);
  });
});

describe('cueFor', () => {
  it('greets on the first beat, holds on the last, and fades the middle ones', () => {
    const fmt = (n: number) => String(+n.toFixed(4));
    const [stream, persist, , render] = beatWindows();
    expect(cueFor('stream')).toBe(`0 ${fmt(stream.to)} 0 0.3`);
    expect(cueFor('stream')).toMatch(/^0 0\.21\d+ 0 0\.3$/);
    expect(cueFor('render')).toBe(
      `${fmt(render.from)} ${fmt(settleAt('render'))} 0.1`
    );
    expect(cueFor('persist')).toBe(`${fmt(persist.from)} ${fmt(persist.to)}`);
  });
  it('ends the render block at the render settle so it crossfades into the ledger', () => {
    const [, to] = cueFor('render').split(' ').map(Number);
    expect(to).toBeCloseTo(settleAt('render'), 4);
    expect(to).toBeLessThan(1);
    expect(cueFor('render').split(' ')[1]).toBe(closeCue().split(' ')[0]);
  });
});

describe('settleAt / segmentState', () => {
  it('settles tools and persist at their window end, approve at the threshold, render before its tail', () => {
    const w = beatWindows();
    expect(settleAt('stream')).toBe(w[0].to);
    expect(settleAt('persist')).toBe(w[1].to);
    expect(settleAt('approve')).toBe(APPROVE_THRESHOLD_P);
    expect(settleAt('render')).toBeCloseTo(
      w[3].from + (w[3].to - w[3].from) * (1 - RENDER_TAIL),
      6
    );
  });
  it('reports done / now / todo per beat from progress', () => {
    const w = beatWindows();
    expect(segmentState('stream', 0.05)).toBe('now');
    expect(segmentState('persist', 0.05)).toBe('todo');
    expect(segmentState('stream', w[1].from + 0.01)).toBe('done');
    expect(segmentState('approve', w[2].from + 0.01)).toBe('now');
    expect(segmentState('render', 1)).toBe('now');
  });
  it('a beat is checked once progress passes its settle', () => {
    expect(isChecked('approve', APPROVE_THRESHOLD_P - 0.001)).toBe(false);
    expect(isChecked('approve', APPROVE_THRESHOLD_P)).toBe(true);
    expect(isChecked('render', 0.999)).toBe(true);
  });
});

describe('holdCue / closeCue', () => {
  it('opens the hold line exactly where inHold starts and lingers past the threshold', () => {
    const cue = holdCue();
    expect(cue.split(' ')).toHaveLength(4);
    const [from, to] = cue.split(' ').map(Number);
    const a = beatWindows()[2];
    // The cue is printed to 4 decimals, so compare against the exact edge and
    // probe inHold on either side of that edge.
    const edge = a.from + (a.to - a.from) * APPROVE_HOLD.from;
    expect(from).toBe(Number(edge.toFixed(4)));
    expect(inHold(edge + 1e-6)).toBe(true);
    expect(inHold(edge - 1e-6)).toBe(false);
    expect(to).toBeGreaterThan(APPROVE_THRESHOLD_P);
    expect(to).toBeCloseTo(
      APPROVE_THRESHOLD_P + (a.to - a.from) * HOLD_LINE_OVERSHOOT,
      4
    );
    expect(cue.split(' ').slice(2).join(' ')).toBe('0.3 0.2');
  });
  it('fades the closing ledger in at the render settle and holds it to the end', () => {
    const parts = closeCue().split(' ');
    expect(parts).toHaveLength(4);
    expect(Number(parts[0])).toBeCloseTo(settleAt('render'), 4);
    expect(parts.slice(1).join(' ')).toBe('1 0.1 0');
    expect(closeCue()).toMatch(/ 1 0\.1 0$/);
  });
  it('every rail cue is at full opacity on one of the harness sample points', () => {
    // scroll-craft's cue model (src/vendor/scrollcraft/scrollcraft.js): ramps
    // are fractions of the window, 0.3 each by default, smoothstepped; between
    // the ramps the cue sits at 1. The harness (e2e/scroll-craft/shoot.mjs,
    // --per-act 8) samples p = 0.02 + 0.96 * i/7 and reports a cue that never
    // reaches 1 at any sample as a defect, so every plateau has to contain a
    // sample — and with a margin, since the sample lands on a rounded pixel.
    const opacity = (cue: string, p: number) => {
      const n = cue.split(' ').map(Number);
      const from = n[0];
      const to = n[1];
      const rIn = n.length > 2 ? n[2] : 0.3;
      const rOut = n.length > 3 ? n[3] : 0.3;
      const win = Math.max(to - from, 0.001);
      const inEnd = from + win * rIn;
      const outStart = to - win * rOut;
      if (p < from) return 0;
      if (p < inEnd) return (p - from) / (inEnd - from);
      if (p <= outStart) return 1;
      return 1 - (p - outStart) / (to - outStart);
    };
    const samples = Array.from({ length: 8 }, (_, i) => 0.02 + (0.96 * i) / 7);
    const margin = 0.002; // ≈ 9px of a 4500px travel at 1440×900
    const cues = {
      ...Object.fromEntries(STAGE_BEATS.map((b) => [b, cueFor(b)])),
      hold: holdCue(),
      close: closeCue(),
    };
    for (const [name, cue] of Object.entries(cues)) {
      const full = samples.filter(
        (p) => opacity(cue, p - margin) === 1 && opacity(cue, p + margin) === 1
      );
      expect(
        full,
        `${name} (${cue}) has no harness sample on its plateau`
      ).not.toHaveLength(0);
      // Sample-independent: a plateau a reader can see. The closing ledger's
      // window is the render tail, so its floor is lower; the engine keeps it
      // at 1 while the pinned act scrolls away.
      const n = cue.split(' ').map(Number);
      const win = n[1] - n[0];
      const plateau = win * (1 - (n[2] ?? 0.3) - (n[3] ?? 0.3));
      expect(plateau, `${name} plateau`).toBeGreaterThanOrEqual(
        name === 'close' ? 0.02 : 0.04
      );
    }
  });
  it('keeps every cue inside the act with from < to', () => {
    const cues = [...STAGE_BEATS.map(cueFor), holdCue(), closeCue()];
    for (const cue of cues) {
      const nums = cue.split(' ').map(Number);
      nums.forEach((n) => {
        expect(Number.isFinite(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      });
      expect(nums[0]).toBeLessThan(nums[1]);
    }
  });
});
