import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HeroMode } from './hero-mode.component';
import { HeroReplayTransport } from './hero-replay.transport';
import type { HeroBridge } from './hero-bridge';
import type { HeroRecording } from './hero-recording.types';

const recording: HeroRecording = {
  version: 1,
  recordedAt: '2026-09-02T00:00:00.000Z',
  runs: [
    { label: 'prompt', events: [{ tMs: 0, event: { type: 'messages', messages: [{ id: 'a', type: 'ai', content: 'Plan…' }] } as never }] },
    { label: 'resume', events: [{ tMs: 0, event: { type: 'messages', messages: [{ id: 'a', type: 'ai', content: 'Plan… done.' }] } as never }] },
    { label: 'genui', events: [{ tMs: 0, event: { type: 'messages', messages: [{ id: 'b', type: 'ai', content: 'Form' }] } as never }] },
  ],
};

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(() => requestAnimationFrame(() => setTimeout(() => resolve(), 0)), 0));
}

describe('HeroMode', () => {
  let fx: ComponentFixture<HeroMode>;

  beforeEach(async () => {
    // The five markup specs must not start a real walkthrough on real timers.
    HeroMode.disableAutoBootForTests();
    TestBed.configureTestingModule({ imports: [HeroMode] });
    TestBed.overrideComponent(HeroMode, {
      set: {
        providers: HeroMode.providersForTest(
          new HeroReplayTransport({ sleep: async () => void 0 }, async () => recording),
        ),
      },
    });
    fx = TestBed.createComponent(HeroMode);
    fx.detectChanges();
    await fx.whenStable();
  });

  afterEach(() => {
    HeroMode.enableAutoBoot();
  });

  it('starts in replay mode with the recorded pill and a Take control button', () => {
    const el = fx.nativeElement as HTMLElement;
    expect(fx.componentInstance.mode()).toBe('replay');
    expect(el.querySelector('[data-hero-pill]')?.textContent).toMatch(/recorded LangGraph run/i);
    expect(el.querySelector('button[data-hero-take-control]')).toBeTruthy();
    expect(el.querySelector('chat')).toBeTruthy();
  });

  it('pointerdown inside the surface takes over: live pill, banner, replay link', () => {
    const el = fx.nativeElement as HTMLElement;
    const replayAgent = fx.componentInstance.activeAgent();
    el.querySelector('[data-hero-surface]')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fx.detectChanges();
    expect(fx.componentInstance.mode()).toBe('live');
    // Guards the provideAgent aliasing trap: replay and live must be two agents.
    expect(fx.componentInstance.activeAgent()).not.toBe(replayAgent);
    expect(el.querySelector('[data-hero-pill]')?.textContent).toMatch(/Live · LangGraph/);
    expect(el.querySelector('[data-hero-banner]')?.textContent).toMatch(/walkthrough was a recording/i);
    expect(el.querySelector('button[data-hero-replay]')).toBeTruthy();
    expect(el.querySelector('button[data-hero-take-control]')).toBeNull();
  });

  it('focusin inside the surface also takes over', () => {
    const el = fx.nativeElement as HTMLElement;
    el.querySelector('[data-hero-surface]')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fx.detectChanges();
    expect(fx.componentInstance.mode()).toBe('live');
  });

  it('Replay walkthrough returns to replay mode', () => {
    const el = fx.nativeElement as HTMLElement;
    (el.querySelector('button[data-hero-take-control]') as HTMLButtonElement).click();
    fx.detectChanges();
    (el.querySelector('button[data-hero-replay]') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(fx.componentInstance.mode()).toBe('replay');
  });

  it('posts frame state through the bridge on mode changes', () => {
    const states: string[] = [];
    fx.componentInstance.bridge = { postState: (s) => states.push(s), onVisibility: () => () => void 0 };
    (fx.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[data-hero-take-control]')!.click();
    fx.detectChanges();
    expect(states).toContain('live');
  });

  it('ignores focusin raised while a scripted action is driving the DOM', async () => {
    const surface = (fx.nativeElement as HTMLElement).querySelector('[data-hero-surface]')!;
    // ChatInputComponent.onSubmit() refocuses the textarea on a rAF, which used
    // to bubble a focusin and flip the hero live on its very first send.
    const typing = fx.componentInstance.typeInto('hi');
    surface.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(fx.componentInstance.mode()).toBe('replay');
    await typing;

    const sending = fx.componentInstance.send();
    surface.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(fx.componentInstance.mode()).toBe('replay');
    await sending;
    fx.detectChanges();
    await flush();
    expect(fx.componentInstance.mode()).toBe('replay');
  });

  it('the scripted send really submits, and a later focusin still takes over', async () => {
    const el = fx.nativeElement as HTMLElement;
    await fx.componentInstance.typeInto('hi');
    fx.detectChanges();
    await fx.componentInstance.send();
    fx.detectChanges();
    await flush();
    // Guards the test above against passing vacuously on a no-op send.
    expect(el.querySelector<HTMLTextAreaElement>('textarea[aria-label="Type a message"]')!.value).toBe('');
    expect(fx.componentInstance.mode()).toBe('replay');

    // A focusin outside a scripted action is still a real user, and still wins.
    el.querySelector('[data-hero-surface]')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fx.detectChanges();
    expect(fx.componentInstance.mode()).toBe('live');
  });

  it('a rejecting replay stop does not throw and takeover still lands live', async () => {
    const replayAgent = fx.componentInstance.activeAgent();
    (replayAgent as { stop: () => Promise<void> }).stop = () => Promise.reject(new Error('x'));

    expect(() => fx.componentInstance.takeControl()).not.toThrow();
    fx.detectChanges();
    // Let the rejected promise's .catch() microtask settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(fx.componentInstance.mode()).toBe('live');
  });

  it('types fast enough not to bore: a prompt-sized string beats the old 40ms/char crawl', async () => {
    const el = fx.nativeElement as HTMLElement;
    const textarea = el.querySelector<HTMLTextAreaElement>('textarea[aria-label="Type a message"]')!;
    const seen: string[] = [];
    textarea.addEventListener('input', () => seen.push(textarea.value));
    const text = 'x'.repeat(50);

    const started = performance.now();
    await fx.componentInstance.typeInto(text);
    const elapsed = performance.now() - started;

    // Still character by character — this is typing, not a paste.
    expect(seen).toHaveLength(50);
    expect(textarea.value).toBe(text);
    // 50 chars at the old TYPE_DELAY_MS of 40 took over 2s; at 9ms it is ~0.5s.
    expect(elapsed).toBeLessThan(2000);
  });

  it('reduced motion: typeInto sets the value in one tick, leaving the reading pause to the runner', async () => {
    fx.componentInstance.reducedMotion = true;
    const el = fx.nativeElement as HTMLElement;
    const textarea = el.querySelector<HTMLTextAreaElement>('textarea[aria-label="Type a message"]')!;

    const started = performance.now();
    const typing = fx.componentInstance.typeInto('abc');
    // Instant: the value is set synchronously, before any timer fires.
    expect(textarea.value).toBe('abc');

    await typing;
    // The old READ_PAUSE_MS lived here and made this leg take 1.2s. That hold
    // is now HOLD_AFTER_TYPING_MS in the runner, where BOTH motion settings
    // get it, so this host call must no longer carry a pacing pause of its own.
    expect(performance.now() - started).toBeLessThan(400);
  });

  it('moveCursor holds for the same beat with or without reduced motion', async () => {
    for (const reducedMotion of [false, true]) {
      fx.componentInstance.reducedMotion = reducedMotion;
      const started = performance.now();
      await fx.componentInstance.moveCursor('composer');
      expect(performance.now() - started).toBeGreaterThanOrEqual(600);
    }
  });

  it('clears the half-typed composer on takeover', async () => {
    const el = fx.nativeElement as HTMLElement;
    await fx.componentInstance.typeInto('hello');
    fx.detectChanges();

    fx.componentInstance.takeControl();
    fx.detectChanges();

    const textarea = el.querySelector<HTMLTextAreaElement>('textarea[aria-label="Type a message"]')!;
    expect(textarea.value).toBe('');
    expect(el.querySelector<HTMLButtonElement>('button[aria-label="Send message"]')!.disabled).toBe(true);
  });
});

describe('HeroMode visibility', () => {
  let fx: ComponentFixture<HeroMode>;
  let states: string[];
  let onVisible: (v: boolean) => void;
  let hidden = false;
  const originalHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');

  function setDocumentHidden(v: boolean): void {
    hidden = v;
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(async () => {
    hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    HeroMode.disableAutoBootForTests();
    TestBed.configureTestingModule({ imports: [HeroMode] });
    TestBed.overrideComponent(HeroMode, {
      set: {
        providers: HeroMode.providersForTest(
          new HeroReplayTransport({ sleep: async () => void 0 }, async () => recording),
        ),
      },
    });
    fx = TestBed.createComponent(HeroMode);
    states = [];
    const bridge: HeroBridge = {
      postState: (s) => states.push(s),
      onVisibility: (cb) => {
        onVisible = cb;
        return () => void 0;
      },
    };
    fx.componentInstance.bridge = bridge;
    fx.detectChanges();
    await fx.componentInstance.boot();
    fx.detectChanges();
  });

  afterEach(() => {
    HeroMode.enableAutoBoot();
    delete (document as unknown as { hidden?: unknown }).hidden;
    if (originalHidden) Object.defineProperty(Document.prototype, 'hidden', originalHidden);
  });

  it('boots the runner: ready then scripted', () => {
    expect(states.indexOf('ready')).toBeGreaterThan(-1);
    expect(states.indexOf('scripted')).toBeGreaterThan(states.indexOf('ready'));
  });

  it('keeps the embed and document visibility sources independent', () => {
    onVisible(true);
    expect(fx.componentInstance.visible()).toBe(true);

    setDocumentHidden(true);
    expect(fx.componentInstance.visible()).toBe(false);
    expect(states.at(-1)).toBe('paused');

    // The regression: reading the same field it writes latched this off forever.
    setDocumentHidden(false);
    expect(fx.componentInstance.visible()).toBe(true);
    expect(states.at(-1)).toBe('scripted');
  });

  it('a hidden embed still wins over a visible document', () => {
    setDocumentHidden(false);
    onVisible(false);
    expect(fx.componentInstance.visible()).toBe(false);
  });
});

describe('HeroMode embedded initial frame state', () => {
  it('does not announce scripted before the parent confirms visibility', async () => {
    const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');
    Object.defineProperty(window, 'parent', { configurable: true, value: {} });
    try {
      HeroMode.disableAutoBootForTests();
      TestBed.configureTestingModule({ imports: [HeroMode] });
      TestBed.overrideComponent(HeroMode, {
        set: {
          providers: HeroMode.providersForTest(
            new HeroReplayTransport({ sleep: async () => void 0 }, async () => recording),
          ),
        },
      });
      const fx = TestBed.createComponent(HeroMode);
      const states: string[] = [];
      const bridge: HeroBridge = {
        postState: (s) => states.push(s),
        onVisibility: () => () => void 0,
      };
      fx.componentInstance.bridge = bridge;
      fx.detectChanges();
      await fx.componentInstance.boot();
      fx.detectChanges();

      expect(states).toEqual(['ready', 'paused']);
      expect(states).not.toContain('scripted');
    } finally {
      HeroMode.enableAutoBoot();
      if (originalParent) Object.defineProperty(window, 'parent', originalParent);
    }
  });
});

/**
 * The production stall: the parent's single `visible` post landed before this
 * component registered its `message` listener, so the frame sat on the empty
 * welcome state forever. The frame must keep announcing itself until answered.
 */
describe('HeroMode embedded ready re-announcement', () => {
  const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');
  let fx: ComponentFixture<HeroMode>;
  let states: string[];
  let onVisible: (v: boolean) => void;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const readyCount = () => states.filter((s) => s === 'ready').length;

  beforeEach(async () => {
    Object.defineProperty(window, 'parent', { configurable: true, value: {} });
    HeroMode.disableAutoBootForTests();
    TestBed.configureTestingModule({ imports: [HeroMode] });
    TestBed.overrideComponent(HeroMode, {
      set: {
        providers: HeroMode.providersForTest(
          new HeroReplayTransport({ sleep: async () => void 0 }, async () => recording),
        ),
      },
    });
    fx = TestBed.createComponent(HeroMode);
    states = [];
    onVisible = () => void 0;
    fx.componentInstance.bridge = {
      postState: (s) => states.push(s),
      onVisibility: (cb) => {
        onVisible = cb;
        return () => void 0;
      },
    };
    fx.detectChanges();
    await fx.componentInstance.boot();
    fx.detectChanges();
  });

  afterEach(() => {
    HeroMode.enableAutoBoot();
    if (originalParent) Object.defineProperty(window, 'parent', originalParent);
  });

  it('keeps re-announcing ready while the embedder has not answered', async () => {
    // HERO_READY_ANNOUNCE_MS is 500, so ~1.2s must carry at least two repeats
    // on top of the announcement boot() already made.
    expect(readyCount()).toBe(1);
    await sleep(1200);
    expect(readyCount()).toBeGreaterThanOrEqual(3);
  });

  it('stops re-announcing as soon as a visibility message arrives', async () => {
    await sleep(600);
    // Guards this test against passing vacuously on a frame that never announced.
    expect(readyCount()).toBeGreaterThanOrEqual(2);

    onVisible(true);
    const settled = readyCount();
    await sleep(1200);
    expect(readyCount()).toBe(settled);
  });
});
