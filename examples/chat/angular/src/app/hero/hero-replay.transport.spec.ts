// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import { HeroReplayTransport, type ReplayClock } from './hero-replay.transport';
import type { HeroRecording } from './hero-recording.types';

const recording: HeroRecording = {
  version: 1,
  recordedAt: '2026-09-02T00:00:00.000Z',
  runs: [
    { label: 'prompt', events: [
      { tMs: 0, event: { type: 'messages', messages: [{ id: 'a', type: 'ai', content: 'He' }] } },
      { tMs: 5, event: { type: 'messages', messages: [{ id: 'a', type: 'ai', content: 'Hello' }] } },
      { tMs: 2000, event: { type: 'interrupt' } },
    ] },
    { label: 'resume', events: [{ tMs: 0, event: { type: 'values' } }] },
    { label: 'genui', events: [{ tMs: 0, event: { type: 'values' } }] },
  ],
};

function fakeClock(): ReplayClock & { waits: number[] } {
  const waits: number[] = [];
  return { waits, sleep: async (ms) => { waits.push(ms); } };
}
async function collect(it: AsyncIterable<unknown>): Promise<unknown[]> { const out: unknown[] = []; for await (const e of it) out.push(e); return out; }

describe('HeroReplayTransport', () => {
  it('plays runs in order across successive stream() calls', async () => {
    const t = new HeroReplayTransport(fakeClock(), async () => recording);
    const ctl = new AbortController();
    const first = await collect(t.stream('hero', null, {}, ctl.signal));
    const second = await collect(t.stream('hero', null, {}, ctl.signal));
    expect(first).toHaveLength(3);
    expect(second).toEqual([{ type: 'values' }]);
  });
  it('paces by recorded gaps clamped to [30, 600] ms', async () => {
    const clock = fakeClock();
    const t = new HeroReplayTransport(clock, async () => recording);
    await collect(t.stream('hero', null, {}, new AbortController().signal));
    expect(clock.waits).toEqual([30, 30, 600]);
  });
  it('stops when the signal aborts', async () => {
    const t = new HeroReplayTransport(fakeClock(), async () => recording);
    const ctl = new AbortController();
    const out: unknown[] = [];
    for await (const e of t.stream('hero', null, {}, ctl.signal)) { out.push(e); ctl.abort(); }
    expect(out).toHaveLength(1);
  });
  it('reset() rewinds to the first run', async () => {
    const t = new HeroReplayTransport(fakeClock(), async () => recording);
    const sig = new AbortController().signal;
    await collect(t.stream('hero', null, {}, sig));
    t.reset();
    expect(await collect(t.stream('hero', null, {}, sig))).toHaveLength(3);
  });
  it('yields nothing once every run is consumed', async () => {
    const t = new HeroReplayTransport(fakeClock(), async () => recording);
    const sig = new AbortController().signal;
    for (let i = 0; i < 3; i++) await collect(t.stream('hero', null, {}, sig));
    expect(await collect(t.stream('hero', null, {}, sig))).toEqual([]);
  });
  it('loads the recording only once', async () => {
    const load = vi.fn(async () => recording);
    const t = new HeroReplayTransport(fakeClock(), load);
    const sig = new AbortController().signal;
    await collect(t.stream('hero', null, {}, sig));
    await collect(t.stream('hero', null, {}, sig));
    expect(load).toHaveBeenCalledTimes(1);
  });
});
