import { describe, it, expect, beforeEach } from 'vitest';
import { MockAgentTransport } from './mock-stream.transport';

describe('MockAgentTransport', () => {
  it('returns empty batch when no script provided', () => {
    const t = new MockAgentTransport();
    expect(t.nextBatch()).toEqual([]);
  });

  it('returns batches in order from script', () => {
    const batch1 = [{ type: 'values' as const, values: {} }];
    const batch2 = [{ type: 'error' as const, error: 'oops' }];
    const t = new MockAgentTransport([batch1, batch2]);
    expect(t.nextBatch()).toEqual(batch1);
    expect(t.nextBatch()).toEqual(batch2);
  });

  it('returns empty batch when script exhausted', () => {
    const t = new MockAgentTransport([[{ type: 'values' as const, values: {} }]]);
    t.nextBatch();
    expect(t.nextBatch()).toEqual([]);
  });

  it('isStreaming returns false initially', () => {
    expect(new MockAgentTransport().isStreaming()).toBe(false);
  });

  it('emit() triggers events on the stream iterable', async () => {
    const t = new MockAgentTransport();
    const events: unknown[] = [];
    const ac = new AbortController();
    const iter = t.stream('agent', null, {}, ac.signal);
    const collecting = (async () => {
      for await (const e of iter) { events.push(e); }
    })();
    t.emit([{ type: 'values', values: { foo: 1 } }]);
    t.close();
    await collecting;
    expect(events).toHaveLength(1);
  });

  it('emitError() causes stream to throw', async () => {
    const t = new MockAgentTransport();
    const ac = new AbortController();
    const iter = t.stream('agent', null, {}, ac.signal);
    t.emitError(new Error('transport error'));
    await expect(async () => {
      for await (const _ of iter) { /* noop */ }
    }).rejects.toThrow('transport error');
  });
});
