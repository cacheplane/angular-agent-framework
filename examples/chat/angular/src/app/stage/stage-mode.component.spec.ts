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
});
