import { describe, expect, it, vi } from 'vitest';
import { createStageBridge, STAGE_MESSAGE_TYPE } from './stage-bridge';

function env(referrer = 'https://threadplane.ai/') {
  const listeners: ((e: MessageEvent) => void)[] = [];
  const parent = { postMessage: vi.fn() } as unknown as Window;
  const self = {
    addEventListener: (_: string, cb: (e: MessageEvent) => void) => listeners.push(cb),
    removeEventListener: vi.fn(),
  } as unknown as Window;
  return {
    referrer,
    parent,
    self,
    fire: (data: unknown, origin = 'https://threadplane.ai', source: unknown = parent) =>
      listeners.forEach((l) => l({ data, origin, source } as MessageEvent)),
  };
}

describe('createStageBridge', () => {
  it('delivers seek targets from an allowlisted parent and ignores others', () => {
    const e = env();
    const bridge = createStageBridge({ referrer: e.referrer, parent: e.parent, self: e.self });
    const seen: number[] = [];
    bridge.onSeek((t) => seen.push(t));
    e.fire({ type: STAGE_MESSAGE_TYPE, t: 1200 });
    e.fire({ type: STAGE_MESSAGE_TYPE, t: 5 }, 'https://evil.example');
    e.fire({ type: 'other', t: 7 });
    e.fire({ type: STAGE_MESSAGE_TYPE, t: 'nope' });
    expect(seen).toEqual([1200]);
  });

  it('posts ready and applied state to the parent only', () => {
    const e = env();
    const bridge = createStageBridge({ referrer: e.referrer, parent: e.parent, self: e.self });
    bridge.postReady({
      totalMs: 9000,
      beats: [{ beat: 'stream', startMs: 0, endMs: 1000 }],
      hold: { startMs: 5000, endMs: 8000 },
      reloadEndMs: 1600,
    });
    bridge.postState({ applied: 3, phase: 'stream', t: 120 });
    expect((e.parent.postMessage as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual([
      {
        type: STAGE_MESSAGE_TYPE,
        ready: true,
        totalMs: 9000,
        beats: [{ beat: 'stream', startMs: 0, endMs: 1000 }],
        hold: { startMs: 5000, endMs: 8000 },
        reloadEndMs: 1600,
      },
      { type: STAGE_MESSAGE_TYPE, applied: 3, phase: 'stream', t: 120 },
    ]);
  });

  it('postReady carries the hold and the reload boundary the parent maps scroll through', () => {
    const posted: unknown[] = [];
    const parent = { postMessage: (m: unknown) => posted.push(m) } as unknown as Window;
    const self = { addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as Window;
    const bridge = createStageBridge({ referrer: 'https://threadplane.ai/', parent, self });
    bridge.postReady({
      totalMs: 9000,
      beats: [{ beat: 'stream', startMs: 0, endMs: 1000 }],
      hold: { startMs: 5000, endMs: 8000 },
      reloadEndMs: 1600,
    });
    expect(posted[0]).toMatchObject({
      type: STAGE_MESSAGE_TYPE,
      ready: true,
      hold: { startMs: 5000, endMs: 8000 },
      reloadEndMs: 1600,
    });
  });

  it('re-posts ready once an empty-referrer frame learns the parent origin from a seek', () => {
    const e = env('');
    const bridge = createStageBridge({ referrer: e.referrer, parent: e.parent, self: e.self });
    const seen: number[] = [];
    bridge.onSeek((t) => seen.push(t));
    const ready = {
      totalMs: 9000,
      beats: [{ beat: 'stream' as const, startMs: 0, endMs: 1000 }],
      hold: { startMs: 5000, endMs: 8000 },
      reloadEndMs: 1600,
    };
    bridge.postReady(ready);
    // Nothing yet: the frame has nowhere to answer.
    expect(e.parent.postMessage).not.toHaveBeenCalled();
    e.fire({ type: STAGE_MESSAGE_TYPE, t: 5 }, 'https://evil.example');
    expect(e.parent.postMessage).not.toHaveBeenCalled();
    e.fire({ type: STAGE_MESSAGE_TYPE, t: 0 });
    expect(seen).toEqual([0]);
    const calls = (e.parent.postMessage as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toEqual({ type: STAGE_MESSAGE_TYPE, ready: true, ...ready });
    expect(calls[0][1]).toBe('https://threadplane.ai');
    // A second seek does not repeat the handshake.
    e.fire({ type: STAGE_MESSAGE_TYPE, t: 100 });
    expect(calls).toHaveLength(1);
  });

  it('posts nothing when not embedded', () => {
    const e = env();
    const bridge = createStageBridge({ referrer: '', parent: e.self, self: e.self });
    bridge.postState({ applied: 1, phase: 'stream', t: 0 });
    expect(e.parent.postMessage).not.toHaveBeenCalled();
  });
});
