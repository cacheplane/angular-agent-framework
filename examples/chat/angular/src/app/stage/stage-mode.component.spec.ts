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

  /** The chat's scroll container, with jsdom's zero layout replaced by a tall transcript. */
  async function bootWithScroller(): Promise<HTMLElement> {
    // The chat shows its welcome screen until a message lands, so the scroll
    // container only exists once the first run has been applied.
    await fx.componentInstance.boot(new URLSearchParams('t=0'));
    fx.detectChanges();
    const scroller = (fx.nativeElement as HTMLElement).querySelector<HTMLElement>('chat .chat-scroll');
    if (!scroller) throw new Error('chat .chat-scroll did not render');
    // jsdom lays nothing out: stand in for a transcript taller than its box.
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, writable: true, value: 2400 });
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 });
    return scroller;
  }

  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

  /** Polls frame by frame so the test pins the BEHAVIOR, not how many frames deep it lands. */
  async function pinnedWithin(scroller: HTMLElement, frames: number): Promise<boolean> {
    for (let i = 0; i < frames; i++) {
      if (scroller.scrollTop === scroller.scrollHeight) return true;
      await frame();
    }
    return scroller.scrollTop === scroller.scrollHeight;
  }

  it('pins the transcript to its newest content once a seek settles', async () => {
    const scroller = await bootWithScroller();
    await fx.componentInstance.controller()?.seek(25);
    fx.detectChanges();
    expect(await pinnedWithin(scroller, 6)).toBe(true);
    expect(scroller.scrollTop).toBe(2400);
  });

  it('re-arms one more pin when a publish lands while a pair is in flight', async () => {
    const scroller = await bootWithScroller();
    const c = fx.componentInstance.controller();
    if (!c) throw new Error('no controller');
    // The first publish schedules the pair; the second lands while that pair
    // is still in flight, so it must re-arm one more pair rather than be dropped.
    await c.seek(25);
    fx.detectChanges();
    await c.seek(30);
    fx.detectChanges();
    // The content that grows AFTER the first pair's inner frame: the two-frame
    // pair alone would pin at 2400 and leave the new 1200px below the fold.
    await frame();
    await frame();
    expect(scroller.scrollTop).toBe(2400);
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, writable: true, value: 3600 });
    expect(await pinnedWithin(scroller, 6)).toBe(true);
    expect(scroller.scrollTop).toBe(3600);
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
