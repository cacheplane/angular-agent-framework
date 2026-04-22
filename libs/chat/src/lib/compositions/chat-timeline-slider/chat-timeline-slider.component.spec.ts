// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChatTimelineSliderComponent } from './chat-timeline-slider.component';
import type { ChatCheckpoint } from '../../agent';

describe('ChatTimelineSliderComponent', () => {
  it('replay() emits the checkpoint id when id is present', () => {
    TestBed.runInInjectionContext(() => {
      const slider = new ChatTimelineSliderComponent();
      const spy = vi.fn();
      slider.replayRequested.subscribe(spy);
      slider.replay({ id: 'ck1', values: {} } as ChatCheckpoint);
      expect(spy).toHaveBeenCalledWith('ck1');
    });
  });

  it('replay() does not emit when id is undefined', () => {
    TestBed.runInInjectionContext(() => {
      const slider = new ChatTimelineSliderComponent();
      const spy = vi.fn();
      slider.replayRequested.subscribe(spy);
      slider.replay({ values: {} } as ChatCheckpoint);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('fork() updates selectedIndex and emits the id', () => {
    TestBed.runInInjectionContext(() => {
      const slider = new ChatTimelineSliderComponent();
      const spy = vi.fn();
      slider.forkRequested.subscribe(spy);
      slider.fork({ id: 'ck2', values: {} } as ChatCheckpoint, 3);
      expect(slider.selectedIndex()).toBe(3);
      expect(spy).toHaveBeenCalledWith('ck2');
    });
  });
});
