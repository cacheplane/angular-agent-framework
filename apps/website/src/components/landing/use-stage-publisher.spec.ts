// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import {
  createStagePublisher,
  STAGE_DEMO_ORIGIN,
  STAGE_HELLO_INTERVAL_MS,
  STAGE_MESSAGE_TYPE,
  useStagePublisher,
  type StagePublisher,
} from './use-stage-publisher';
import {
  APPROVE_HOLD,
  beatWindows,
  settleAt,
  STAGE_BEATS,
  timeAt,
} from '../../lib/stage-beats';

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
} as const;

/** The publisher under test; `afterEach` disposes it so a failing case cannot leak a listener. */
let current: StagePublisher | null = null;

function fromDemo(data: unknown) {
  window.dispatchEvent(
    new MessageEvent('message', { origin: STAGE_DEMO_ORIGIN, data })
  );
}

function setup(
  opts: {
    frameWindow?: () => Window | null;
    ready?: boolean;
    /** Builds rail markup before construction: the publisher queries it once. */
    rail?: (section: HTMLElement) => void;
  } = {}
) {
  const section = document.createElement('section');
  document.body.appendChild(section);
  opts.rail?.(section);
  const posted: { m: unknown; origin: string }[] = [];
  const frame = {
    postMessage: (m: unknown, origin: string) => posted.push({ m, origin }),
  } as unknown as Window;
  const track = vi.fn();
  const onReady = vi.fn();
  const pub = createStagePublisher({
    section,
    frameWindow: opts.frameWindow ?? (() => frame),
    track,
    onReady,
  });
  current = pub;
  // Simulate the frame's ready message
  if (opts.ready !== false) fromDemo(READY);
  return { section, posted, track, onReady, pub, frame };
}

/** One segment, one beat block and one check per beat, plus the ledger, as the act renders them. */
function fullRail(section: HTMLElement) {
  for (const b of STAGE_BEATS) {
    const seg = document.createElement('a');
    seg.setAttribute('data-stage-segment', b);
    section.appendChild(seg);
    const block = document.createElement('div');
    block.setAttribute('data-stage-beat', b);
    section.appendChild(block);
    const chk = document.createElement('span');
    chk.setAttribute('data-stage-check', b);
    section.appendChild(chk);
  }
  const close = document.createElement('div');
  close.setAttribute('data-stage-close', '');
  section.appendChild(close);
}

afterEach(() => {
  current?.dispose();
  current = null;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('stage publisher', () => {
  it('posts t only when it changes, to the demo origin', () => {
    const { section, posted, pub } = setup();
    section.style.setProperty('--sc-p', '0.1');
    pub.tick();
    pub.tick();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual({
      origin: STAGE_DEMO_ORIGIN,
      m: { type: STAGE_MESSAGE_TYPE, t: timeAt(0.1, READY) },
    });
    section.style.setProperty('--sc-p', '0.2');
    pub.tick();
    expect(posted).toHaveLength(2);
    expect(posted[1]).toEqual({
      origin: STAGE_DEMO_ORIGIN,
      m: { type: STAGE_MESSAGE_TYPE, t: timeAt(0.2, READY) },
    });
  });

  it('posts no seek before ready, only a throttled hello so the frame learns the origin', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { section, posted, pub } = setup({ ready: false });
    section.style.setProperty('--sc-p', '0.3');
    pub.tick();
    now += 100;
    pub.tick();
    // Two ticks inside the interval: exactly one hello.
    expect(posted).toEqual([
      { origin: STAGE_DEMO_ORIGIN, m: { type: STAGE_MESSAGE_TYPE, t: 0 } },
    ]);
    now += STAGE_HELLO_INTERVAL_MS;
    pub.tick();
    expect(posted).toHaveLength(2);
    expect(posted[1]).toEqual({
      origin: STAGE_DEMO_ORIGIN,
      m: { type: STAGE_MESSAGE_TYPE, t: 0 },
    });
    // Once ready arrives the hello stops and the real seek is posted.
    fromDemo(READY);
    now += STAGE_HELLO_INTERVAL_MS * 4;
    pub.tick();
    pub.tick();
    expect(posted).toHaveLength(3);
    expect(posted[2]).toEqual({
      origin: STAGE_DEMO_ORIGIN,
      m: { type: STAGE_MESSAGE_TYPE, t: timeAt(0.3, READY) },
    });
  });

  it('says no hello while the frame window is not there yet', () => {
    const { section, posted, pub } = setup({
      ready: false,
      frameWindow: () => null,
    });
    section.style.setProperty('--sc-p', '0.3');
    pub.tick();
    expect(posted).toHaveLength(0);
  });

  it('ignores messages from other origins', () => {
    const { section } = setup();
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        data: { type: STAGE_MESSAGE_TYPE, applied: 9, phase: 'render', t: 1 },
      })
    );
    expect(section.getAttribute('data-sc-verify-state')).toBeNull();
  });

  it("mirrors the frame's applied state into data-sc-verify-state and the hold into data-sc-verify-hold", () => {
    const { section, pub } = setup();
    fromDemo({
      type: STAGE_MESSAGE_TYPE,
      applied: 42,
      phase: 'stream',
      t: 900,
    });
    expect(section.getAttribute('data-sc-verify-state')).toBe('stream:42');
    const a = beatWindows()[2];
    section.style.setProperty('--sc-p', String(a.from + (a.to - a.from) * 0.5));
    pub.tick();
    expect(section.getAttribute('data-sc-verify-hold')).toBe('true');
    section.style.setProperty('--sc-p', String(a.from + (a.to - a.from) * 0.9));
    pub.tick();
    expect(section.getAttribute('data-sc-verify-hold')).toBeNull();
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
  });

  it('writes segment states and check fills onto the rail as progress moves', () => {
    const { section, pub } = setup({ rail: fullRail });
    const seg = (b: string) =>
      section
        .querySelector(`[data-stage-segment="${b}"]`)
        ?.getAttribute('data-beat-state');
    const checked = (b: string) =>
      section
        .querySelector(`[data-stage-check="${b}"]`)
        ?.hasAttribute('data-checked');
    section.style.setProperty('--sc-p', '0.05');
    pub.tick();
    expect(seg('stream')).toBe('now');
    expect(seg('persist')).toBe('todo');
    expect(checked('stream')).toBe(false);
    section.style.setProperty('--sc-p', String(beatWindows()[1].from + 0.01));
    pub.tick();
    expect(seg('stream')).toBe('done');
    expect(checked('stream')).toBe(true);
    section.style.setProperty('--sc-p', '1');
    pub.tick();
    expect(
      section.querySelectorAll('[data-stage-check][data-checked]')
    ).toHaveLength(4);
  });

  it('marks the current beat block `now` so the visible cue owns the pointer', () => {
    const { section, pub } = setup({ rail: fullRail });
    const block = (b: string) =>
      section
        .querySelector(`[data-stage-beat="${b}"]`)
        ?.getAttribute('data-beat-state');
    section.style.setProperty('--sc-p', '0.05');
    pub.tick();
    expect(block('stream')).toBe('now');
    expect(block('persist')).toBe('todo');
    section.style.setProperty('--sc-p', String(beatWindows()[1].from + 0.01));
    pub.tick();
    expect(block('stream')).toBe('done');
    expect(block('persist')).toBe('now');
  });

  it('activates the closing ledger only past the render settle, and deactivates it on rewind', () => {
    const { section, pub } = setup({ rail: fullRail });
    const close = section.querySelector('[data-stage-close]')!;
    const settle = settleAt('render');
    section.style.setProperty('--sc-p', String(settle - 0.01));
    pub.tick();
    expect(close.hasAttribute('data-active')).toBe(false);
    section.style.setProperty('--sc-p', String(settle));
    pub.tick();
    expect(close.hasAttribute('data-active')).toBe(true);
    section.style.setProperty('--sc-p', '1');
    pub.tick();
    expect(close.hasAttribute('data-active')).toBe(true);
    section.style.setProperty('--sc-p', '0.5');
    pub.tick();
    expect(close.hasAttribute('data-active')).toBe(false);
  });

  it('un-fills the checks and resets the segments on a rewind, as the frame rewinds', () => {
    const { section, pub } = setup({ rail: fullRail });
    section.style.setProperty('--sc-p', '1');
    pub.tick();
    expect(
      section.querySelectorAll('[data-stage-check][data-checked]')
    ).toHaveLength(4);
    section.style.setProperty('--sc-p', '0.05');
    pub.tick();
    expect(
      section.querySelectorAll('[data-stage-check][data-checked]')
    ).toHaveLength(0);
    expect(
      section
        .querySelector('[data-stage-segment="persist"]')
        ?.getAttribute('data-beat-state')
    ).toBe('todo');
  });

  it('updates every check for a beat, in the beat block and in the closing ledger', () => {
    const { section, pub } = setup({
      rail: (section) => {
        for (const where of ['block', 'ledger']) {
          const chk = document.createElement('span');
          chk.setAttribute('data-stage-check', 'stream');
          chk.setAttribute('data-where', where);
          section.appendChild(chk);
        }
      },
    });
    section.style.setProperty('--sc-p', String(beatWindows()[1].from + 0.01));
    pub.tick();
    expect(
      section.querySelectorAll('[data-stage-check="stream"][data-checked]')
    ).toHaveLength(2);
  });

  it('ignores an unknown beat on a segment or check without throwing', () => {
    const seg = document.createElement('a');
    seg.setAttribute('data-stage-segment', 'nope');
    const chk = document.createElement('span');
    chk.setAttribute('data-stage-check', 'nope');
    const { section, pub } = setup({
      rail: (section) => section.append(seg, chk),
    });
    section.style.setProperty('--sc-p', '1');
    expect(() => pub.tick()).not.toThrow();
    expect(seg.hasAttribute('data-beat-state')).toBe(false);
    expect(chk.hasAttribute('data-checked')).toBe(false);
  });

  it('a second tick at the same progress writes no segment or check attributes', () => {
    const { section, pub } = setup({ rail: fullRail });
    const els = [
      ...section.querySelectorAll(
        '[data-stage-segment], [data-stage-beat], [data-stage-check], [data-stage-close]'
      ),
    ];
    expect(els).toHaveLength(13);
    section.style.setProperty('--sc-p', String(beatWindows()[1].from + 0.01));
    pub.tick();
    const sets = els.map((el) => vi.spyOn(el, 'setAttribute'));
    const removes = els.map((el) => vi.spyOn(el, 'removeAttribute'));
    pub.tick();
    for (const s of sets) expect(s).not.toHaveBeenCalled();
    for (const r of removes) expect(r).not.toHaveBeenCalled();
  });

  it('dispose removes the listener and stops posting', () => {
    const { section, posted, pub } = setup();
    pub.dispose();
    section.style.setProperty('--sc-p', '0.5');
    pub.tick();
    expect(posted).toHaveLength(0);
    // The listener is gone: a state message from the demo origin no longer lands.
    fromDemo({ type: STAGE_MESSAGE_TYPE, applied: 7, phase: 'render', t: 1 });
    expect(section.getAttribute('data-sc-verify-state')).toBeNull();
  });

  it('a second ready re-posts the current t, and onReady fires only once', () => {
    const { section, posted, onReady, pub } = setup();
    expect(onReady).toHaveBeenCalledTimes(1);
    section.style.setProperty('--sc-p', '0.1');
    pub.tick();
    pub.tick();
    expect(posted).toHaveLength(1);
    fromDemo(READY);
    pub.tick();
    expect(posted).toHaveLength(2);
    expect(posted[1]).toEqual({
      origin: STAGE_DEMO_ORIGIN,
      m: { type: STAGE_MESSAGE_TYPE, t: timeAt(0.1, READY) },
    });
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('holds the post until frameWindow returns a window, then posts the same t', () => {
    let w: Window | null = null;
    const { section, posted, frame, pub } = setup({ frameWindow: () => w });
    section.style.setProperty('--sc-p', '0.1');
    pub.tick();
    pub.tick();
    expect(posted).toHaveLength(0);
    w = frame;
    pub.tick();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual({
      origin: STAGE_DEMO_ORIGIN,
      m: { type: STAGE_MESSAGE_TYPE, t: timeAt(0.1, READY) },
    });
    pub.tick();
    expect(posted).toHaveLength(1);
  });

  it('ignores a malformed ready: no hold, or a beat with a non-numeric time', () => {
    const { section, posted, onReady, pub } = setup({ ready: false });
    // A malformed ready leaves the publisher un-ready, so the only thing it
    // may post is the hello (t: 0), never a seek.
    const seeks = () => posted.filter((p) => (p.m as { t: number }).t !== 0);
    const { hold: _hold, ...noHold } = READY;
    void _hold;
    fromDemo(noHold);
    section.style.setProperty('--sc-p', '0.1');
    expect(() => pub.tick()).not.toThrow();
    expect(seeks()).toHaveLength(0);
    expect(onReady).not.toHaveBeenCalled();

    fromDemo({
      ...READY,
      beats: [
        { beat: 'stream', startMs: 'x', endMs: 12_000 },
        ...READY.beats.slice(1),
      ],
    });
    section.style.setProperty('--sc-p', '0.11');
    expect(() => pub.tick()).not.toThrow();
    pub.tick();
    expect(seeks()).toHaveLength(0);
    expect(onReady).not.toHaveBeenCalled();

    // A well-formed ready afterwards still works.
    fromDemo(READY);
    pub.tick();
    expect(seeks()).toEqual([
      {
        origin: STAGE_DEMO_ORIGIN,
        m: { type: STAGE_MESSAGE_TYPE, t: timeAt(0.11, READY) },
      },
    ]);
    expect(onReady).toHaveBeenCalledTimes(1);
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

    const { rerender, unmount } = renderHook(
      ({ frameWindow }: { frameWindow: () => Window | null }) => {
        const ref = useRef<HTMLElement | null>(section);
        useStagePublisher(ref, true, { frameWindow, track, onReady });
      },
      { initialProps: { frameWindow: () => null } }
    );
    act(() => {
      fromDemo(READY);
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
    unmount();
  });

  it('a throwing tick does not stop the rAF loop', () => {
    type IOCallback = (entries: { isIntersecting: boolean }[]) => void;
    let ioCallback: IOCallback | null = null;
    class IO {
      constructor(cb: IOCallback) {
        ioCallback = cb;
      }
      observe() {
        /* driven by the test */
      }
      disconnect() {
        /* no-op */
      }
    }
    vi.stubGlobal('IntersectionObserver', IO);
    // Synchronous rAF, bounded so a re-arming loop cannot recurse forever.
    const MAX_FRAMES = 6;
    let frames = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames += 1;
      if (frames <= MAX_FRAMES) cb(0);
      return frames;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const section = document.createElement('section');
    document.body.appendChild(section);
    section.style.setProperty('--sc-p', '0.1');
    const posted: unknown[] = [];
    const frame = {
      postMessage: (m: unknown, origin: string) => posted.push({ m, origin }),
    } as unknown as Window;
    let thrown = 0;
    const track = vi.fn(() => {
      if (thrown === 0) {
        thrown += 1;
        throw new Error('analytics down');
      }
    });

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLElement | null>(section);
      useStagePublisher(ref, true, { frameWindow: () => frame, track });
    });
    act(() => {
      fromDemo(READY);
      ioCallback?.([{ isIntersecting: true }]);
    });
    // The first tick threw inside track('enter') before the seek; the loop
    // re-armed and a later tick posted t.
    expect(thrown).toBe(1);
    expect(frames).toBeGreaterThan(1);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual({
      origin: STAGE_DEMO_ORIGIN,
      m: { type: STAGE_MESSAGE_TYPE, t: timeAt(0.1, READY) },
    });
    expect(error).toHaveBeenCalledWith(
      '[stage] tick failed',
      expect.any(Error)
    );
    unmount();
  });
});
