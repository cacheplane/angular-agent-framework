// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { validateHeroRecording, type HeroRecording } from './hero-recording.types';

const good: HeroRecording = {
  version: 1,
  recordedAt: '2026-09-02T00:00:00.000Z',
  runs: [
    { label: 'prompt', events: [{ tMs: 0, event: { type: 'messages', messages: [] } }] },
    { label: 'resume', events: [{ tMs: 0, event: { type: 'interrupt' } }] },
    { label: 'genui', events: [{ tMs: 12, event: { type: 'values' } }] },
  ],
};

describe('validateHeroRecording', () => {
  it('accepts a three-run recording', () => {
    expect(validateHeroRecording(good)).toEqual(good);
  });
  it('rejects a recording with fewer than three runs', () => {
    expect(() => validateHeroRecording({ ...good, runs: good.runs.slice(0, 2) })).toThrow(/three runs/);
  });
  it('rejects an event without a numeric tMs', () => {
    const bad = { ...good, runs: [{ label: 'x', events: [{ event: { type: 'values' } }] }, good.runs[1], good.runs[2]] };
    expect(() => validateHeroRecording(bad)).toThrow(/tMs/);
  });
  it('rejects non-objects', () => {
    expect(() => validateHeroRecording(null)).toThrow(/object/);
  });
  it('rejects a run with zero events', () => {
    const bad = { ...good, runs: [{ label: 'prompt', events: [] }, good.runs[1], good.runs[2]] };
    expect(() => validateHeroRecording(bad)).toThrow(/no events/);
  });
});
