// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureSpy = vi.hoisted(() => vi.fn());
vi.mock('posthog-js', () => ({ default: { capture: captureSpy } }));

import { trackCtaClick, trackStageProgress } from './client';

beforeEach(() => {
  captureSpy.mockClear();
});

describe('analytics client', () => {
  it('trackCtaClick captures marketing:cta_click with the source page', () => {
    trackCtaClick({ cta_id: 'hero_install', surface: 'home' });
    expect(captureSpy).toHaveBeenCalledWith(
      'marketing:cta_click',
      expect.objectContaining({ cta_id: 'hero_install', surface: 'home' })
    );
    expect(captureSpy.mock.calls[0][1]).toHaveProperty('source_page');
  });

  it('trackStageProgress captures marketing:stage_progress with the milestone and beat', () => {
    trackStageProgress('beat', 'approve');
    expect(captureSpy).toHaveBeenCalledWith(
      'marketing:stage_progress',
      expect.objectContaining({
        surface: 'home_stage',
        stage_event: 'beat',
        beat: 'approve',
      })
    );
  });

  it('trackStageProgress omits the beat key when there is no beat', () => {
    trackStageProgress('enter');
    const props = captureSpy.mock.calls[0][1];
    expect(props.stage_event).toBe('enter');
    expect('beat' in props).toBe(false);
  });
});
