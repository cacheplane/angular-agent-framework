// examples/chat/angular/src/app/stage/stage-recording.types.spec.ts
import { describe, expect, it } from 'vitest';
import { validateStageRecording, type StageRecording } from './stage-recording.types';

const ev = (tMs: number) => ({ tMs, event: { type: 'values', messages: [] } as never });

export const MINIMAL: StageRecording = {
  version: 2,
  recordedAt: '2026-09-06T00:00:00.000Z',
  threadId: 'thread-1',
  runs: [
    { beat: 'stream', action: { kind: 'submit', message: 'Tell me about signals' }, events: [ev(0), ev(50)] },
    { beat: 'persist', action: { kind: 'reload' }, events: [] },
    { beat: 'persist', action: { kind: 'submit', message: 'Shorter, please.' }, events: [ev(0)] },
    { beat: 'persist', action: { kind: 'submit', message: 'As a haiku.', checkpointIndex: 1 }, events: [ev(0)] },
    { beat: 'approve', action: { kind: 'submit', message: 'Clean up backups.' }, events: [ev(0), ev(900)] },
    { beat: 'approve', action: { kind: 'resume', value: 'approved' }, events: [ev(0)] },
    { beat: 'render', action: { kind: 'submit', message: 'Show me a form.' }, events: [ev(0), ev(2000)] },
  ],
  histories: [{ afterRun: 1, states: [] }],
};

describe('validateStageRecording', () => {
  it('accepts a well-formed recording', () => {
    expect(validateStageRecording(MINIMAL)).toBe(MINIMAL);
  });
  it('requires version 2, a thread id, and all four beats in order', () => {
    expect(() => validateStageRecording({ ...MINIMAL, version: 1 })).toThrow(/version/);
    expect(() => validateStageRecording({ ...MINIMAL, threadId: '' })).toThrow(/threadId/);
    const noRender = { ...MINIMAL, runs: MINIMAL.runs.filter((r) => r.beat !== 'render') };
    expect(() => validateStageRecording(noRender)).toThrow(/beats/);
    const swapped = { ...MINIMAL, runs: [MINIMAL.runs[4], ...MINIMAL.runs.slice(0, 4), ...MINIMAL.runs.slice(5)] };
    expect(() => validateStageRecording(swapped)).toThrow(/order/);
  });
  it('lets only a reload run have no events', () => {
    const bad = { ...MINIMAL, runs: MINIMAL.runs.map((r, i) => (i === 0 ? { ...r, events: [] } : r)) };
    expect(() => validateStageRecording(bad)).toThrow(/run 0 has no events/);
  });
  it('requires a resume run to follow the approve submit', () => {
    const bad = { ...MINIMAL, runs: MINIMAL.runs.filter((r) => r.action.kind !== 'resume') };
    expect(() => validateStageRecording(bad)).toThrow(/resume/);
  });
});
