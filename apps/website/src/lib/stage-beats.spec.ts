import { describe, expect, it } from 'vitest';
import {
  APPROVE_HOLD,
  APPROVE_THRESHOLD_P,
  STAGE_BEATS,
  STAGE_SPAN,
  beatAt,
  beatWindows,
  crossedThreshold,
  cueFor,
  holdLineCues,
  inHold,
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
    expect(cueFor('render')).toBe(`${fmt(render.from)} 1 0.3 0`);
    expect(cueFor('persist')).toBe(`${fmt(persist.from)} ${fmt(persist.to)}`);
  });
});

describe('holdLineCues', () => {
  it('spreads the hold lines across the approve hold, strictly forward, inside the act', () => {
    const a = beatWindows()[2];
    const cues = holdLineCues(3);
    expect(cues).toHaveLength(3);
    const parsed = cues.map((c) => c.split(' ').map(Number));
    parsed.forEach(([from, to]) => {
      expect(from).toBeGreaterThanOrEqual(a.from);
      expect(to).toBeLessThanOrEqual(1);
      expect(to).toBeGreaterThan(from);
    });
    parsed
      .slice(1)
      .forEach(([from], i) => expect(from).toBeGreaterThan(parsed[i][0]));
  });
  it('lets the last cue linger past the threshold by 12% of the approve span', () => {
    const a = beatWindows()[2];
    const [, to] = holdLineCues(3)[2].split(' ').map(Number);
    expect(to).toBeCloseTo(APPROVE_THRESHOLD_P + (a.to - a.from) * 0.12, 4);
  });
});
