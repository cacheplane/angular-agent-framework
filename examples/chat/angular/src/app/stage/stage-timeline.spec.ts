// examples/chat/angular/src/app/stage/stage-timeline.spec.ts
import { describe, expect, it } from 'vitest';
import { MINIMAL } from './stage-recording.fixtures';
import { HOLD_MS, RELOAD_MS, buildTimeline, phaseAt, phaseReachedAt, runsStartedBy } from './stage-timeline';

describe('buildTimeline', () => {
  const tl = buildTimeline(MINIMAL);
  it('lays runs end to end, gives a reload a fixed beat, and holds before the resume', () => {
    expect(tl.runs[0]).toMatchObject({ index: 0, startMs: 0, endMs: 50 });
    expect(tl.runs[1]).toMatchObject({ index: 1, startMs: 50, endMs: 50 + RELOAD_MS });
    const approve = tl.runs[4];
    const resume = tl.runs[5];
    expect(resume.startMs).toBe(approve.endMs + HOLD_MS);
    expect(tl.hold).toEqual({ startMs: approve.endMs, endMs: resume.startMs });
    expect(tl.totalMs).toBe(tl.runs[6].endMs);
  });
  it('derives beat boundaries from the runs', () => {
    expect(tl.beats.map((b) => b.beat)).toEqual(['stream', 'persist', 'approve', 'render']);
    expect(tl.beats[0]).toMatchObject({ startMs: 0, endMs: tl.runs[0].endMs });
    expect(tl.beats[2].endMs).toBe(tl.runs[5].endMs);
    expect(tl.beats[3].endMs).toBe(tl.totalMs);
  });
});

describe('phaseAt', () => {
  const tl = buildTimeline(MINIMAL);
  it('names stream, persist, pause, resume, render', () => {
    expect(phaseAt(tl, 0)).toBe('stream');
    expect(phaseAt(tl, tl.runs[1].startMs)).toBe('persist');
    expect(phaseAt(tl, tl.hold.startMs + 1)).toBe('pause');
    expect(phaseAt(tl, tl.runs[5].startMs)).toBe('resume');
    expect(phaseAt(tl, tl.totalMs)).toBe('render');
  });
});

describe('phaseReachedAt', () => {
  const tl = buildTimeline(MINIMAL);
  it('names the moment reached, so a run\'s end still belongs to that run', () => {
    expect(phaseReachedAt(tl, tl.runs[0].endMs)).toBe('stream');
    expect(phaseAt(tl, tl.runs[0].endMs)).toBe('persist');
    expect(phaseReachedAt(tl, 0)).toBe('stream');
  });
});

describe('runsStartedBy', () => {
  const tl = buildTimeline(MINIMAL);
  it('lists every run whose start is at or before t', () => {
    expect(runsStartedBy(tl, 0).map((r) => r.index)).toEqual([0]);
    expect(runsStartedBy(tl, tl.hold.startMs + 1).map((r) => r.index)).toEqual([0, 1, 2, 3, 4]);
    expect(runsStartedBy(tl, tl.totalMs).length).toBe(7);
  });
});
