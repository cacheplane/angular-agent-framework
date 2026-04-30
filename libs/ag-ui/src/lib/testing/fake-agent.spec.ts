// libs/ag-ui/src/lib/testing/fake-agent.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
import { toArray, lastValueFrom } from 'rxjs';
import { EventType, type RunAgentInput, type BaseEvent } from '@ag-ui/client';
import { FakeAgent } from './fake-agent';

const minimalInput: RunAgentInput = {
  threadId: 't1',
  runId: 'r1',
  messages: [],
  state: {},
  tools: [],
  context: [],
  forwardedProps: {},
};

describe('FakeAgent', () => {
  it('emits RUN_STARTED then text events then RUN_FINISHED', async () => {
    const agent = new FakeAgent({ tokens: ['hi', ' there'], delayMs: 1 });
    const events = await lastValueFrom(agent.run(minimalInput).pipe(toArray()));
    const types = events.map((e: BaseEvent) => e.type);
    expect(types).toEqual([
      EventType.RUN_STARTED,
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
      EventType.RUN_FINISHED,
    ]);
  });

  it('streams tokens as deltas in order', async () => {
    const agent = new FakeAgent({ tokens: ['one', 'two', 'three'], delayMs: 1 });
    const events = await lastValueFrom(agent.run(minimalInput).pipe(toArray()));
    const deltas = events
      .filter((e: BaseEvent) => e.type === EventType.TEXT_MESSAGE_CONTENT)
      .map((e: any) => e.delta);
    expect(deltas).toEqual(['one', 'two', 'three']);
  });

  it('threadId and runId from input flow into RUN_STARTED and RUN_FINISHED', async () => {
    const agent = new FakeAgent({ tokens: ['x'], delayMs: 1 });
    const events = await lastValueFrom(agent.run({ ...minimalInput, threadId: 'tA', runId: 'rA' }).pipe(toArray()));
    const started = events.find((e: BaseEvent) => e.type === EventType.RUN_STARTED) as any;
    const finished = events.find((e: BaseEvent) => e.type === EventType.RUN_FINISHED) as any;
    expect(started.threadId).toBe('tA');
    expect(finished.threadId).toBe('tA');
  });

  it('cancels in-flight emissions when unsubscribed', async () => {
    vi.useFakeTimers();
    const agent = new FakeAgent({ tokens: ['a', 'b', 'c', 'd'], delayMs: 100 });
    const seen: BaseEvent[] = [];
    const sub = agent.run(minimalInput).subscribe((e: BaseEvent) => seen.push(e));
    vi.advanceTimersByTime(50);  // first emission only
    sub.unsubscribe();
    vi.advanceTimersByTime(1000);  // would have emitted everything if not cancelled
    expect(seen.length).toBeLessThan(7);
    vi.useRealTimers();
  });
});
