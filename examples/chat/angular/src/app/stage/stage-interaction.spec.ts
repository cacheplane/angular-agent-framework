import { describe, expect, it, vi } from 'vitest';
import { stagePresentationAgent } from './stage-interaction';

describe('stage presentation agent', () => {
  it('preserves state access and routes mutations into the live demo without changing replay', async () => {
    const state = vi.fn(() => ({ policy: '120 days' }));
    const submit = vi.fn();
    const stop = vi.fn();
    const regenerate = vi.fn();
    const retry = vi.fn();
    const live = vi.fn();
    const original = { state, submit, stop, regenerate, retry };
    const presentation = stagePresentationAgent(original, live);
    expect(presentation.state).toBe(state);
    expect(presentation.state()).toEqual({ policy: '120 days' });
    await presentation.submit();
    await presentation.stop();
    await presentation.regenerate();
    await presentation.retry();
    expect(live).toHaveBeenCalledTimes(4);
    expect(retry).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(regenerate).not.toHaveBeenCalled();
    original.submit();
    expect(submit).toHaveBeenCalledOnce();
  });
});
