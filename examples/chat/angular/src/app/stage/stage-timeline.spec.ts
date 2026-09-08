// examples/chat/angular/src/app/stage/stage-timeline.spec.ts
import { describe, expect, it } from 'vitest';
import { MINIMAL } from './stage-recording.fixtures';
import { HOLD_MS, RELOAD_MS, buildTimeline, phaseAt, phaseReachedAt, runsStartedBy } from './stage-timeline';

describe('buildTimeline', () => {
  it('derives reveals from tool results and the first child stream after time compaction', () => {
    const rec = { ...MINIMAL, runs: MINIMAL.runs.map(run => run.beat === 'stream' || run.beat === 'subagents' ? {
      ...run, events: [
        { tMs: 1000, event: { type: 'metadata', data: {} } },
        { tMs: 2000, event: run.beat === 'stream'
          ? { type: 'messages', data: [{ type: 'tool', name: 'search_documents', content: 'policy' }] }
          : { type: 'messages|tools:child', data: [{ content: 'research' }] } },
      ],
    } : run) } as typeof MINIMAL;
    const timeline = buildTimeline(rec);
    for (const beat of timeline.beats.slice(0, 2)) expect(beat.revealMs).toBe(beat.startMs + 400);
  });
  it('compresses idle gaps without changing the recorded events or their order', () => {
    const original = MINIMAL.runs[0];
    const run = { ...original, events: original.events.map((e, i) => ({ ...e, tMs: i === 0 ? 4000 : 8000 })) };
    const replay = buildTimeline({ ...MINIMAL, runs: [run] }).runs[0].run;
    expect(replay.events.map((e) => e.tMs)).toEqual([200, 400]);
    expect(replay.events.map((e) => e.event)).toEqual(run.events.map((e) => e.event));
    expect(run.events.map((e) => e.tMs)).toEqual([4000, 8000]);
  });
  const tl = buildTimeline(MINIMAL);
  it('lays runs end to end, gives a reload a fixed beat, and holds before the resume', () => {
    expect(tl.runs[0]).toMatchObject({ index: 0, startMs: 0, endMs: 50 });
    expect(tl.runs[2]).toMatchObject({ index: 2, startMs: 100, endMs: 100 + RELOAD_MS });
    const approve = tl.runs[5];
    const resume = tl.runs[6];
    expect(resume.startMs).toBe(approve.endMs + HOLD_MS);
    expect(tl.hold).toEqual({ startMs: approve.endMs, endMs: resume.startMs });
    expect(tl.totalMs).toBe(tl.runs[7].endMs);
  });
  it('derives beat boundaries from the runs', () => {
    expect(tl.beats.map((b) => b.beat)).toEqual(['stream', 'subagents', 'persist', 'approve', 'render']);
    expect(tl.beats[0]).toMatchObject({ startMs: 0, endMs: tl.runs[0].endMs });
    expect(tl.beats[3].endMs).toBe(tl.runs[6].endMs);
    expect(tl.beats[4].endMs).toBe(tl.totalMs);
  });
});

describe('phaseAt', () => {
  const tl = buildTimeline(MINIMAL);
  it('names stream, persist, pause, resume, render', () => {
    expect(phaseAt(tl, 0)).toBe('stream');
    expect(phaseAt(tl, tl.runs[1].startMs)).toBe('subagents');
    expect(phaseAt(tl, tl.runs[2].startMs)).toBe('persist');
    expect(phaseAt(tl, tl.hold.startMs + 1)).toBe('pause');
    expect(phaseAt(tl, tl.runs[6].startMs)).toBe('resume');
    expect(phaseAt(tl, tl.totalMs)).toBe('render');
  });
  it('separates the approve submit run (streaming) from the authored hold', () => {
    expect(phaseAt(tl, tl.runs[5].startMs + 1)).toBe('stream');
    expect(phaseAt(tl, tl.hold.startMs + 1)).toBe('pause');
  });
});

describe('phaseReachedAt', () => {
  const tl = buildTimeline(MINIMAL);
  it('names the moment reached, so a run\'s end still belongs to that run', () => {
    expect(phaseReachedAt(tl, tl.runs[0].endMs)).toBe('stream');
    expect(phaseAt(tl, tl.runs[0].endMs)).toBe('subagents');
    expect(phaseReachedAt(tl, 0)).toBe('stream');
  });
});

describe('runsStartedBy', () => {
  const tl = buildTimeline(MINIMAL);
  it('settles the outgoing run at an exact boundary before starting the next action', () => {
    expect(runsStartedBy(tl, tl.runs[0].endMs).map((r) => r.index)).toEqual([0]);
    expect(runsStartedBy(tl, tl.runs[0].endMs + 1).map((r) => r.index)).toEqual([0, 1]);
  });
  it('lists every run whose start is at or before t', () => {
    expect(runsStartedBy(tl, 0).map((r) => r.index)).toEqual([0]);
    expect(runsStartedBy(tl, tl.hold.startMs + 1).map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(runsStartedBy(tl, tl.totalMs).length).toBe(8);
  });
});
