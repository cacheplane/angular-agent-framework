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
