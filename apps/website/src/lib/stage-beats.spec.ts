import { describe, expect, it } from 'vitest';
import {
  APPROVE_HOLD,
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
});

describe('timeAt', () => {
  it('is monotonic non-decreasing across the whole act', () => {
    let last = -1;
    for (let i = 0; i <= 2000; i++) {
      const t = timeAt(i / 2000, READY);
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
    expect(at(APPROVE_HOLD.from)).toBe(READY.hold.startMs);
    expect(at(0.5)).toBe(READY.hold.startMs);
    expect(at(APPROVE_HOLD.to - 1e-6)).toBe(READY.hold.startMs);
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
});

describe('inHold / beatAt / crossedThreshold', () => {
  it('reports the hold only inside the approve hold range', () => {
    const a = beatWindows()[2];
    expect(inHold(a.from + (a.to - a.from) * 0.5)).toBe(true);
    expect(inHold(a.from + (a.to - a.from) * 0.2)).toBe(false);
    expect(inHold(0)).toBe(false);
  });
  it('names the beat at a progress', () => {
    expect(beatAt(0)).toBe('stream');
    expect(beatAt(0.999)).toBe('render');
  });
  it('fires the threshold exactly once per crossing, forwards only', () => {
    const a = beatWindows()[2];
    const th = a.from + (a.to - a.from) * APPROVE_HOLD.to;
    expect(crossedThreshold(th - 0.01, th + 0.01)).toBe(true);
    expect(crossedThreshold(th + 0.01, th - 0.01)).toBe(false);
    expect(crossedThreshold(th + 0.01, th + 0.02)).toBe(false);
  });
});

describe('cueFor', () => {
  it('greets on the first beat, holds on the last, and fades the middle ones', () => {
    expect(cueFor('stream')).toMatch(/^0 0\.21\d+ 0 0\.3$/);
    expect(cueFor('render')).toMatch(/ 1 0\.3 0$/);
    expect(cueFor('persist').split(' ')).toHaveLength(2);
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
});
