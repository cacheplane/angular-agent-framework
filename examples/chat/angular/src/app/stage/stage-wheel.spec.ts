import { describe, expect, it, vi } from 'vitest';
import { stageWheelOwnership } from './stage-wheel';

describe('stage wheel ownership', () => {
  it('forwards wheel units to the page until exploration is explicitly enabled', () => {
    let exploring = false;
    const forward = vi.fn(() => true);
    const stop = stageWheelOwnership(window, () => exploring, forward, vi.fn());
    const wheel = new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, cancelable: true });
    window.dispatchEvent(wheel);
    expect(forward).toHaveBeenCalledWith(0, 48);
    expect(wheel.defaultPrevented).toBe(true);
    exploring = true;
    const local = new WheelEvent('wheel', { deltaY: 80, cancelable: true });
    window.dispatchEvent(local);
    expect(local.defaultPrevented).toBe(false);
    expect(forward).toHaveBeenCalledTimes(1);
    stop();
  });

  it('preserves pinch zoom and standalone scrolling; Escape exits exploration', () => {
    const forward = vi.fn(() => false);
    const resume = vi.fn();
    let exploring = false;
    const stop = stageWheelOwnership(window, () => exploring, forward, resume);
    const zoom = new WheelEvent('wheel', { deltaY: 50, ctrlKey: true, cancelable: true });
    window.dispatchEvent(zoom);
    expect(forward).not.toHaveBeenCalled();
    const standalone = new WheelEvent('wheel', { deltaY: 50, cancelable: true });
    window.dispatchEvent(standalone);
    expect(standalone.defaultPrevented).toBe(false);
    exploring = true;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(resume).toHaveBeenCalledOnce();
    stop();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(resume).toHaveBeenCalledOnce();
  });
});
