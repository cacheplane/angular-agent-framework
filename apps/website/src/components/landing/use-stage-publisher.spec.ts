// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import {
  createStagePublisher,
  STAGE_DEMO_ORIGIN,
  STAGE_MESSAGE_TYPE,
  useStagePublisher,
} from './use-stage-publisher';
import { APPROVE_HOLD, beatWindows } from '../../lib/stage-beats';

const READY = {
  type: STAGE_MESSAGE_TYPE,
  ready: true,
  totalMs: 40_000,
  beats: [
    { beat: 'stream', startMs: 0, endMs: 12_000 },
    { beat: 'persist', startMs: 12_000, endMs: 20_000 },
    { beat: 'approve', startMs: 20_000, endMs: 32_000 },
    { beat: 'render', startMs: 32_000, endMs: 40_000 },
  ],
  hold: { startMs: 27_000, endMs: 30_000 },
  reloadEndMs: 12_600,
};

function setup() {
  const section = document.createElement('section');
  document.body.appendChild(section);
  const posted: unknown[] = [];
  const frame = {
    postMessage: (m: unknown, origin: string) => posted.push({ m, origin }),
  } as unknown as Window;
  const track = vi.fn();
  const pub = createStagePublisher({
    section,
    frameWindow: () => frame,
    track,
  });
  // Simulate the frame's ready message
  window.dispatchEvent(
    new MessageEvent('message', { origin: STAGE_DEMO_ORIGIN, data: READY })
  );
  return { section, posted, track, pub };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('stage publisher', () => {
  it('posts t only when it changes, to the demo origin', () => {
    const { section, posted, pub } = setup();
    section.style.setProperty('--sc-p', '0.1');
    pub.tick();
    pub.tick();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      origin: STAGE_DEMO_ORIGIN,
      m: { type: STAGE_MESSAGE_TYPE, t: expect.any(Number) },
    });
    section.style.setProperty('--sc-p', '0.2');
    pub.tick();
    expect(posted).toHaveLength(2);
    pub.dispose();
  });

  it('posts nothing before ready', () => {
    const section = document.createElement('section');
    const posted: unknown[] = [];
    const pub = createStagePublisher({
      section,
      frameWindow: () =>
        ({ postMessage: (m: unknown) => posted.push(m) } as unknown as Window),
      track: vi.fn(),
    });
    section.style.setProperty('--sc-p', '0.3');
    pub.tick();
    expect(posted).toHaveLength(0);
    pub.dispose();
  });

  it('ignores messages from other origins', () => {
    const { section, pub } = setup();
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        data: { type: STAGE_MESSAGE_TYPE, applied: 9, phase: 'render', t: 1 },
      })
    );
    expect(section.getAttribute('data-sc-verify-state')).toBeNull();
    pub.dispose();
  });

  it("mirrors the frame's applied state into data-sc-verify-state and the hold into data-sc-verify-hold", () => {
    const { section, pub } = setup();
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: STAGE_DEMO_ORIGIN,
        data: {
          type: STAGE_MESSAGE_TYPE,
          applied: 42,
          phase: 'stream',
          t: 900,
        },
      })
    );
    expect(section.getAttribute('data-sc-verify-state')).toBe('stream:42');
    const a = beatWindows()[2];
    section.style.setProperty('--sc-p', String(a.from + (a.to - a.from) * 0.5));
    pub.tick();
    expect(section.getAttribute('data-sc-verify-hold')).toBe('true');
    section.style.setProperty('--sc-p', String(a.from + (a.to - a.from) * 0.9));
    pub.tick();
    expect(section.getAttribute('data-sc-verify-hold')).toBeNull();
    pub.dispose();
  });

  it('tracks enter once, each beat once, the threshold once, complete once', () => {
    const { section, track, pub } = setup();
    const a = beatWindows()[2];
    const th = a.from + (a.to - a.from) * APPROVE_HOLD.to;
    for (const p of [
      0.01,
      0.02,
      beatWindows()[1].from + 0.01,
      th - 0.01,
      th + 0.01,
      th + 0.02,
      0.999,
      1,
    ]) {
      section.style.setProperty('--sc-p', String(p));
      pub.tick();
    }
    const events = track.mock.calls.map(
      (c) => `${c[0]}${c[1] ? ':' + c[1] : ''}`
    );
    expect(events).toEqual([
      'enter',
      'beat:stream',
      'beat:persist',
      'beat:approve',
      'threshold',
      'beat:render',
      'complete',
    ]);
    pub.dispose();
  });

  it('dispose removes the listener and stops posting', () => {
    const { section, posted, pub } = setup();
    pub.dispose();
    section.style.setProperty('--sc-p', '0.5');
    pub.tick();
    expect(posted).toHaveLength(0);
  });

  /**
   * The act's `frameWindow` returns null until the iframe's `load` event and
   * the real window after it. The loop subscribes once, so it must read the
   * latest deps on every tick rather than the closure it was created with —
   * otherwise the first `t` is never posted.
   */
  it('the hook reads the latest deps on every tick, not the ones it mounted with', () => {
    type IOCallback = (entries: { isIntersecting: boolean }[]) => void;
    let ioCallback: IOCallback | null = null;
    class IO {
      constructor(cb: IOCallback) {
        ioCallback = cb;
      }
      observe() {
        /* the test drives the callback directly */
      }
      disconnect() {
        /* no-op */
      }
    }
    vi.stubGlobal('IntersectionObserver', IO);
    // One tick per request, and only when the test pumps it.
    const pending: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      pending.push(cb);
      return pending.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const pump = () => {
      const cbs = pending.splice(0);
      cbs.forEach((cb) => cb(0));
    };

    const section = document.createElement('section');
    document.body.appendChild(section);
    const posted: unknown[] = [];
    const frame = {
      postMessage: (m: unknown, origin: string) => posted.push({ m, origin }),
    } as unknown as Window;
    const track = vi.fn();
    const onReady = vi.fn();

    const { rerender } = renderHook(
      ({ frameWindow }: { frameWindow: () => Window | null }) => {
        const ref = useRef<HTMLElement | null>(section);
        useStagePublisher(ref, true, { frameWindow, track, onReady });
      },
      { initialProps: { frameWindow: () => null } }
    );
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { origin: STAGE_DEMO_ORIGIN, data: READY })
      );
      ioCallback?.([{ isIntersecting: true }]);
    });
    expect(onReady).toHaveBeenCalledTimes(1);
    section.style.setProperty('--sc-p', '0.25');
    act(() => pump());
    expect(posted).toHaveLength(0); // the frame has not loaded

    rerender({ frameWindow: () => frame });
    act(() => pump());
    expect(posted).toHaveLength(1);
    expect(track.mock.calls[0]?.[0]).toBe('enter');
    vi.unstubAllGlobals();
  });
});
