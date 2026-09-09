import { describe, expect, it, vi } from 'vitest';
import { presentStageSeek } from './stage-rewind';

describe('presentStageSeek', () => {
  it('keeps reconstruction and final layout inside one captured frame transition', async () => {
    const order: string[] = [];
    const controller = { t: () => 100, seek: async () => { order.push('seek'); } };
    const doc = { startViewTransition: (update: () => Promise<void>) => {
      order.push('capture');
      const done = update().then(() => { order.push('reveal'); });
      return { ready: done, updateCallbackDone: done, finished: done };
    } } as unknown as Pick<Document, 'startViewTransition'>;
    await presentStageSeek(50, controller, async () => { order.push('layout'); }, doc);
    expect(order).toEqual(['capture', 'seek', 'layout', 'reveal']);
  });

  it('streams forward without capturing a frame', async () => {
    const capture = vi.fn();
    const seek = vi.fn(async () => undefined);
    await presentStageSeek(101, { t: () => 100, seek }, async () => undefined,
      { startViewTransition: capture } as unknown as Pick<Document, 'startViewTransition'>);
    expect(capture).not.toHaveBeenCalled();
    expect(seek).toHaveBeenCalledWith(101);
  });
});
