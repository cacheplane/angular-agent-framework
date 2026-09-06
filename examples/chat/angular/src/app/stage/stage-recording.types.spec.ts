// examples/chat/angular/src/app/stage/stage-recording.types.spec.ts
import { describe, expect, it } from 'vitest';
import { validateStageRecording } from './stage-recording.types';
import { MINIMAL } from './stage-recording.fixtures';

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
  it('rejects a negative checkpointIndex', () => {
    const bad = {
      ...MINIMAL,
      runs: MINIMAL.runs.map((r, i) => (i === 3 ? { ...r, action: { ...r.action, checkpointIndex: -1 } } : r)),
    };
    expect(() => validateStageRecording(bad)).toThrow(/checkpointIndex/);
  });
  it('rejects a history with a non-numeric afterRun', () => {
    const bad = { ...MINIMAL, histories: [{ afterRun: 'x', states: [] }] };
    expect(() => validateStageRecording(bad)).toThrow(/afterRun/);
  });
});
