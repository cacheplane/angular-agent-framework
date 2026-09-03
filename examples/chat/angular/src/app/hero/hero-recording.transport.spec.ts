// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { HeroRecordingTransport } from './hero-recording.transport';
import type { AgentTransport, StreamEvent } from '@threadplane/langgraph';

function innerWith(events: StreamEvent[]): AgentTransport {
  return { async *stream() { for (const e of events) yield e; } };
}

describe('HeroRecordingTransport', () => {
  it('passes events through and records them with offsets', async () => {
    let now = 1000;
    const t = new HeroRecordingTransport(innerWith([{ type: 'values' }, { type: 'messages' }]), () => (now += 40));
    const out: StreamEvent[] = [];
    for await (const e of t.stream('a', null, {}, new AbortController().signal)) out.push(e);
    expect(out).toEqual([{ type: 'values' }, { type: 'messages' }]);
    const rec = t.recording();
    expect(rec.runs).toHaveLength(1);
    expect(rec.runs[0].events.map((e) => e.tMs)).toEqual([40, 80]);
  });
  it('labels runs in order: prompt, resume, genui, then run-N', async () => {
    const t = new HeroRecordingTransport(innerWith([{ type: 'values' }]), () => 0);
    const sig = new AbortController().signal;
    for (let i = 0; i < 4; i++) for await (const _ of t.stream('a', null, {}, sig)) { /* drain */ }
    expect(t.recording().runs.map((r) => r.label)).toEqual(['prompt', 'resume', 'genui', 'run-4']);
  });
});
