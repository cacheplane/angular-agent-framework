// examples/chat/angular/src/app/stage/stage-replay.transport.spec.ts
import { describe, expect, it } from 'vitest';
import type { StreamEvent } from '@threadplane/langgraph';
import { MINIMAL } from './stage-recording.fixtures';
import { buildTimeline } from './stage-timeline';
import { StageReplayTransport } from './stage-replay.transport';

async function take(iter: AsyncIterable<StreamEvent>, n: number): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const e of iter) { out.push(e); if (out.length === n) break; }
  return out;
}
function settle(): Promise<void> { return new Promise((r) => setTimeout(r, 0)); }

describe('StageReplayTransport', () => {
  it('yields a run\'s events only up to the target time and waits for the rest', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    await t.ready();
    t.seek(0);
    const iter = t.stream('chat', 'thread-1', {}, new AbortController().signal)[Symbol.asyncIterator]();
    expect((await iter.next()).value).toEqual(MINIMAL.runs[0].events[0].event);
    let second: unknown = 'pending';
    void iter.next().then((r) => (second = r.value));
    await settle();
    expect(second).toBe('pending');
    t.seek(50);
    await settle();
    expect(second).toEqual(MINIMAL.runs[0].events[1].event);
    expect((await iter.next()).done).toBe(true);
  });
  it('advances through runs in order and skips reload runs (they have no stream)', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    await t.ready();
    const tl = buildTimeline(MINIMAL);
    t.seek(tl.totalMs);
    const sig = new AbortController().signal;
    expect(await take(t.stream('chat', 'thread-1', {}, sig), 9)).toHaveLength(2); // run 0
    expect(await take(t.stream('chat', 'thread-1', {}, sig), 9)).toHaveLength(1); // run 2 (run 1 is the reload)
    expect(t.runIndex).toBe(3);
  });
  it('counts applied events', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    await t.ready();
    t.seek(0);
    await take(t.stream('chat', 'thread-1', {}, new AbortController().signal), 1);
    expect(t.applied()).toBe(1);
  });
  it('serves the history snapshot recorded at exactly this position, and never a stale one', async () => {
    const withHistory = { ...MINIMAL, histories: [{ afterRun: 1, states: [{ values: { messages: [] } } as never] }] };
    const t = new StageReplayTransport(async () => withHistory);
    await t.ready();
    expect(await t.getHistory('thread-1', new AbortController().signal)).toEqual([]);
    t.seek(buildTimeline(withHistory).totalMs);
    const sig = new AbortController().signal;
    await take(t.stream('chat', 'thread-1', {}, sig), 9); // run 0 → runIndex 1
    expect(await t.getHistory('thread-1', sig)).toHaveLength(1);
    await take(t.stream('chat', 'thread-1', {}, sig), 9); // run 2 → runIndex 3
    // The bridge projects history over the transcript at every run close, so a
    // snapshot from an earlier position must not be answered.
    expect(await t.getHistory('thread-1', sig)).toEqual([]);
  });
  it('reset() rewinds to the first run and clears applied', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    await t.ready();
    t.seek(50);
    const sig = new AbortController().signal;
    await take(t.stream('chat', 'thread-1', {}, sig), 9);
    t.reset();
    expect(t.runIndex).toBe(0);
    expect(t.applied()).toBe(0);
  });
  it('reset() ends a stream that is waiting on the gate', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    await t.ready();
    t.seek(0);
    const iter = t.stream('chat', 'thread-1', {}, new AbortController().signal)[Symbol.asyncIterator]();
    await iter.next();
    const pending = iter.next();
    t.reset();
    expect((await pending).done).toBe(true);
  });
  it('stops when the signal aborts', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    await t.ready();
    t.seek(0);
    const ctl = new AbortController();
    const iter = t.stream('chat', 'thread-1', {}, ctl.signal)[Symbol.asyncIterator]();
    await iter.next();
    const pending = iter.next();
    ctl.abort();
    expect((await pending).done).toBe(true);
  });
  it('exposes the recording for the controller', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    expect(await t.recordingData()).toBe(MINIMAL);
  });
  it('gates a later run on absolute time, not on its own offset', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    await t.ready();
    t.seek(50);
    const sig = new AbortController().signal;
    await take(t.stream('chat', 'thread-1', {}, sig), 9); // run 0 drains (0..50)
    const iter = t.stream('chat', 'thread-1', {}, sig)[Symbol.asyncIterator](); // run 2 starts at 650
    let first: unknown = 'pending';
    void iter.next().then((r) => (first = r.value));
    await settle();
    expect(first).toBe('pending');
    t.seek(650);
    await settle();
    expect(first).toEqual(MINIMAL.runs[2].events[0].event);
  });
  it('a stream started before reset() does not consume a run after it', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const t = new StageReplayTransport(async () => { await gate; return MINIMAL; });
    t.seek(50);
    const iter = t.stream('chat', 'thread-1', {}, new AbortController().signal)[Symbol.asyncIterator]();
    const pending = iter.next();
    t.reset();
    release();
    expect((await pending).done).toBe(true);
    expect(t.runIndex).toBe(0);
  });
});
