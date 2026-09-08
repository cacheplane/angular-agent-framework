import { describe, expect, it, vi } from 'vitest';
import type { AbstractAgent, AgentSubscriber, BaseEvent } from '@ag-ui/client';
import type { Message } from '@ag-ui/core';
import { toAgent } from './to-agent';

describe('interrupt UI generation', () => {
  it('rejects a stale decision before mutating input, claiming, or dispatching', async () => {
    const subscribers: AgentSubscriber[] = [];
    const source = {
      threadId: 'thread', state: {}, messages: [] as Message[], pendingInterrupts: [],
      subscribe(sub: AgentSubscriber) { subscribers.push(sub); return { unsubscribe() { subscribers.splice(subscribers.indexOf(sub), 1); } }; },
      addMessage(message: Message) { source.messages.push(message); },
      setMessages(messages: Message[]) { source.messages = messages; },
      abortRun: vi.fn(),
      runAgent: vi.fn(async (params?: { runId?: string }) => {
        const input = { threadId: 'thread', runId: params?.runId ?? 'initial' };
        for (const event of [
          { type: 'RUN_STARTED', ...input },
          { type: 'RUN_FINISHED', ...input, outcome: { type: 'interrupt', interrupts: [{ id: 'same-id', reason: 'approve' }] } },
        ]) for (const sub of subscribers) sub.onEvent?.({ event: event as BaseEvent, input } as never);
      }),
    };
    const agent = toAgent(source as unknown as AbstractAgent, { telemetry: false });
    await agent.submit({});
    const initialGeneration = agent.interruptSession().generation;
    await agent.submit({ resume: true }, { interruptGeneration: initialGeneration });
    const before = agent.interruptSession();
    expect(before.generation).toBe(initialGeneration + 1);
    await expect(agent.submit(
      { resume: false, state: { stale: true }, message: 'old answer' },
      { interruptGeneration: initialGeneration },
    )).rejects.toThrow(/generation|stale/i);
    expect(agent.interruptSession()).toEqual(before);
    expect(source.messages).toEqual([]);
    expect(source.state).toEqual({});
    expect(source.runAgent).toHaveBeenCalledTimes(2);
  });
});
