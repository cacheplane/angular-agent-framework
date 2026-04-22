// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { ChatTimelineSliderComponent } from './chat-timeline-slider.component';

describe('ChatTimelineSliderComponent', () => {
  it('is defined', () => {
    expect(ChatTimelineSliderComponent).toBeDefined();
    expect(typeof ChatTimelineSliderComponent).toBe('function');
  });

  it('checkpointLabel returns label with index+1 when no checkpoint_id', () => {
    const checkpointLabel = ChatTimelineSliderComponent.prototype.checkpointLabel;
    const state = {} as any;
    expect(checkpointLabel(state, 0)).toBe('State 1');
    expect(checkpointLabel(state, 4)).toBe('State 5');
  });

  it('checkpointLabel uses "Checkpoint N" when checkpoint_id is present', () => {
    const checkpointLabel = ChatTimelineSliderComponent.prototype.checkpointLabel;
    const state = { checkpoint: { checkpoint_id: 'abc123' } } as any;
    expect(checkpointLabel(state, 0)).toBe('Checkpoint 1');
    expect(checkpointLabel(state, 2)).toBe('Checkpoint 3');
  });
});
