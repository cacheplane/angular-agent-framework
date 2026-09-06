// examples/chat/angular/src/app/stage/stage-recording.fixtures.ts
import type { StageRecording } from './stage-recording.types';

export const ev = (tMs: number) => ({ tMs, event: { type: 'values', messages: [] } as never });

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
