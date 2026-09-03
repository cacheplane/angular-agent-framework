// SPDX-License-Identifier: MIT
import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HeroMode } from './hero-mode.component';
import { HeroReplayTransport } from './hero-replay.transport';
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

describe('HeroMode', () => {
  let fx: ComponentFixture<HeroMode>;

  beforeEach(async () => {
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
});
