import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StageMode } from './stage-mode.component';
import { StageReplayTransport } from './stage-replay.transport';
import { MINIMAL } from './stage-recording.fixtures';

describe('StageMode', () => {
  let fx: ComponentFixture<StageMode>;

  beforeEach(async () => {
    StageMode.disableAutoBootForTests();
    TestBed.configureTestingModule({ imports: [StageMode], providers: [provideRouter([])] });
    TestBed.overrideComponent(StageMode, {
      set: { providers: StageMode.providersForTest(new StageReplayTransport(async () => MINIMAL)) },
    });
    fx = TestBed.createComponent(StageMode);
    fx.detectChanges();
    await fx.whenStable();
  });

  afterEach(() => StageMode.enableAutoBoot());

  it('renders the chat, the devtools region, and an inert interrupt host', () => {
    const el = fx.nativeElement as HTMLElement;
    expect(el.querySelector('chat')).toBeTruthy();
    expect(el.querySelector('chat-debug')).toBeTruthy();
    expect(el.querySelector('[data-stage-interrupt]')?.getAttribute('data-inert')).toBe('true');
    expect(el.querySelector('[data-stage-pill]')?.textContent).toMatch(/recorded LangGraph run/i);
  });

  it('exposes the timeline for recorders and seeks to ?t= on boot', async () => {
    await fx.componentInstance.boot(new URLSearchParams('t=25'));
    expect(fx.componentInstance.timeline()?.totalMs).toBeGreaterThan(0);
    expect(fx.componentInstance.controller()?.t()).toBe(25);
    expect(window.__stageApplied?.t).toBe(25);
  });

  describe('transcript pin', () => {
    // The pin is a pair of animation frames; the real ~16ms frame races the
    // controller's macrotask timing, so these specs step a stubbed frame
    // queue by hand and control exactly where each publish lands.
    type Frame = { id: number; cb: FrameRequestCallback };
    let queue: Frame[] = [];
    let cancelled: number[] = [];
    let nextId = 0;
    const realRaf = globalThis.requestAnimationFrame;
    const realCaf = globalThis.cancelAnimationFrame;
    const realWindowRaf = window.requestAnimationFrame;
    const realWindowCaf = window.cancelAnimationFrame;

    beforeEach(() => {
      queue = [];
      cancelled = [];
      nextId = 0;
      const raf = (cb: FrameRequestCallback): number => {
        const id = ++nextId;
        queue.push({ id, cb });
        return id;
      };
      const caf = (id: number): void => {
        cancelled.push(id);
        queue = queue.filter((f) => f.id !== id);
      };
      globalThis.requestAnimationFrame = raf;
      globalThis.cancelAnimationFrame = caf;
      window.requestAnimationFrame = raf;
      window.cancelAnimationFrame = caf;
    });

    afterEach(() => {
      globalThis.requestAnimationFrame = realRaf;
      globalThis.cancelAnimationFrame = realCaf;
      window.requestAnimationFrame = realWindowRaf;
      window.cancelAnimationFrame = realWindowCaf;
    });

    /** Runs exactly the callbacks queued at the time of the call, in order. */
    function step(): void {
      const batch = queue;
      queue = [];
      for (const { cb } of batch) cb(performance.now());
    }

    /** Steps until nothing is queued: settles whatever boot scheduled. */
    function flush(): void {
      for (let i = 0; i < 20 && queue.length > 0; i++) step();
      if (queue.length > 0) throw new Error('animation frames never settled');
    }

    /** The chat's scroll container, with jsdom's zero layout replaced by a tall transcript. */
    async function bootWithScroller(): Promise<HTMLElement> {
      // The chat shows its welcome screen until a message lands, so the scroll
      // container only exists once the first run has been applied.
      await fx.componentInstance.boot(new URLSearchParams('t=0'));
      fx.detectChanges();
      // Boot publishes too: drain its pair so each spec starts with no pin in flight.
      flush();
      const scroller = (fx.nativeElement as HTMLElement).querySelector<HTMLElement>('chat .chat-scroll');
      if (!scroller) throw new Error('chat .chat-scroll did not render');
      // jsdom lays nothing out: stand in for a transcript taller than its box.
      Object.defineProperty(scroller, 'scrollHeight', { configurable: true, writable: true, value: 2400 });
      Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 });
      return scroller;
    }

    /** Applies a seek and lets its publish schedule (or re-arm) the pin; no frame runs. */
    async function publishAt(t: number): Promise<void> {
      const c = fx.componentInstance.controller();
      if (!c) throw new Error('no controller');
      await c.seek(t);
      fx.detectChanges();
    }

    it('pins the transcript to its newest content once a seek settles', async () => {
      const scroller = await bootWithScroller();
      await publishAt(25);
      expect(queue.length).toBeGreaterThan(0);
      step(); // outer frame: views render
      expect(scroller.scrollTop).toBe(0);
      step(); // inner frame: layout settled, the write lands
      expect(scroller.scrollTop).toBe(2400);
    });

    it('re-arms one more pin when a publish lands while a pair is in flight', async () => {
      const scroller = await bootWithScroller();
      await publishAt(25); // schedules the pair
      step(); // outer frame fires: the pair now owns everything before it
      await publishAt(30); // lands between outer and inner: must re-arm
      step(); // inner frame: writes the current height, then re-arms
      expect(scroller.scrollTop).toBe(2400);
      // Content that grows AFTER the first pair's inner frame: without the
      // re-arm nothing is queued and the new 1200px stay below the fold.
      Object.defineProperty(scroller, 'scrollHeight', { configurable: true, writable: true, value: 3600 });
      expect(queue.length).toBeGreaterThan(0);
      step();
      step();
      expect(scroller.scrollTop).toBe(3600);
    });

    it('cancels an in-flight pin on destroy so no frame writes after teardown', async () => {
      const scroller = await bootWithScroller();
      await publishAt(25);
      const pending = queue.map((f) => f.id);
      expect(pending.length).toBeGreaterThan(0);
      fx.destroy();
      expect(cancelled.some((id) => pending.includes(id))).toBe(true);
      expect(queue.some((f) => cancelled.includes(f.id))).toBe(false);
      flush();
      expect(scroller.scrollTop).toBe(0);
    });
  });

  it('posts ready and state through the bridge', async () => {
    const posted: unknown[] = [];
    fx.componentInstance.bridge = {
      onSeek: () => () => undefined,
      postReady: (r) => posted.push(r),
      postState: (s) => posted.push(s),
    };
    await fx.componentInstance.boot(new URLSearchParams('t=0'));
    fx.detectChanges();
    expect(posted[0]).toMatchObject({ totalMs: expect.any(Number) });
    expect(posted.some((p) => (p as { phase?: string }).phase === 'stream')).toBe(true);
  });

  it('keeps the devtools open when a click lands outside the panel', async () => {
    const el = fx.nativeElement as HTMLElement;
    const region = () => el.querySelector('[role="region"][aria-label="Chat devtools"]');
    expect(region()).toBeTruthy();
    document.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    expect(region()).toBeTruthy();
  });
});

describe('StageMode responsive dock', () => {
  const realMatchMedia = window.matchMedia;

  beforeEach(() => StageMode.disableAutoBootForTests());
  afterEach(() => {
    window.matchMedia = realMatchMedia;
    StageMode.enableAutoBoot();
  });

  function stubWidth(width: number): void {
    window.matchMedia = ((query: string) => {
      const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0);
      return { matches: width >= min, media: query } as MediaQueryList;
    }) as typeof window.matchMedia;
  }

  async function mount(): Promise<ComponentFixture<StageMode>> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [StageMode], providers: [provideRouter([])] });
    TestBed.overrideComponent(StageMode, {
      set: { providers: StageMode.providersForTest(new StageReplayTransport(async () => MINIMAL)) },
    });
    const fixture = TestBed.createComponent(StageMode);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders no devtools on a phone-width frame', async () => {
    stubWidth(600);
    const fixture = await mount();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('chat-debug')).toBeNull();
    expect(el.querySelector('.stage')?.getAttribute('data-dock')).toBe('none');
  });

  it('docks bottom on a tablet-width frame and right on a wide one', async () => {
    stubWidth(900);
    let fixture = await mount();
    expect((fixture.nativeElement as HTMLElement).querySelector('.stage')?.getAttribute('data-dock')).toBe(
      'bottom',
    );
    stubWidth(1280);
    fixture = await mount();
    expect((fixture.nativeElement as HTMLElement).querySelector('.stage')?.getAttribute('data-dock')).toBe(
      'right',
    );
  });
});
