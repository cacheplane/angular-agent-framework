import { describe, it, expect, vi } from 'vitest';
import type { AbstractAgent, AgentSubscriber, BaseEvent } from '@ag-ui/client';
import type { Message } from '@ag-ui/core';
import { toAgent } from './to-agent';

function harness() {
  const subscribers: AgentSubscriber[] = [];
  let input = { threadId: 'thread-1', runId: 'pause-run' };
  const source = {
    threadId: 'thread-1', state: {} as Record<string, unknown>, messages: [] as Message[],
    pendingInterrupts: [],
    subscribe(sub: AgentSubscriber) { subscribers.push(sub); return { unsubscribe() { subscribers.splice(subscribers.indexOf(sub), 1); } }; },
    addMessage(message: Message) { source.messages.push(message); },
    setMessages(messages: Message[]) { source.messages = messages; },
    abortRun: vi.fn(),
    runAgent: vi.fn(async (params?: { runId?: string }) => {
      input = { ...input, runId: params?.runId ?? 'pause-run' };
      emit({ type: 'RUN_STARTED', ...input });
      emit({ type: 'RUN_FINISHED', ...input, outcome: { type: 'interrupt', interrupts: [{ id: 'i1', reason: 'confirmation' }] } });
    }),
  };
  function emit(event: unknown) {
    if ((event as { runId?: string }).runId) input = { ...input, runId: (event as { runId: string }).runId };
    for (const sub of [...subscribers]) sub.onEvent?.({ event: event as BaseEvent, input } as never);
  }
  const agent = toAgent(source as unknown as AbstractAgent, { telemetry: false });
  return { source, agent, emit };
}

describe('interrupt request ownership', () => {
  it('does not bind a resume to another run before acknowledgement', async () => {
    const { agent, source, emit } = harness();
    await agent.submit({});
    source.runAgent.mockImplementationOnce(async params => {
      emit({ type: 'RUN_STARTED', runId: 'unrelated-run' });
      emit({ type: 'STATE_SNAPSHOT', snapshot: { unrelated: true } });
      expect(agent.interruptSession().phase).toBe('resuming');
      expect(agent.state()).toEqual({});
      emit({ type: 'RUN_STARTED', runId: params?.runId });
      expect(agent.interruptSession().phase).toBe('acknowledged');
      emit({ type: 'RUN_FINISHED', runId: params?.runId });
    });
    await agent.submit({ resume: true });
    expect(agent.error()).toBeUndefined();
    expect(agent.interruptSession().phase).toBe('none');
  });

  it('does not reuse failed ordinary draft state and retries its original input', async () => {
    const { agent, source, emit } = harness();
    source.runAgent.mockImplementationOnce(async () => {
      emit({ type: 'RUN_STARTED', runId: 'first-run' });
      emit({ type: 'STATE_SNAPSHOT', snapshot: { partial: true } });
      throw new Error('failed');
    });
    await agent.submit({ message: 'hello', state: { requested: true } });
    expect(agent.state()).toEqual({});
    expect(source.state).toEqual({});
    source.runAgent.mockImplementationOnce(async () => {
      expect(source.state).toEqual({ requested: true });
      expect(source.messages.map(message => message.content)).toEqual(['hello']);
      emit({ type: 'RUN_STARTED', runId: 'retry-run' });
      emit({ type: 'RUN_FINISHED', runId: 'retry-run' });
    });
    await agent.retry();
    expect(agent.messages().filter(message => message.role === 'user')).toHaveLength(1);
    expect(agent.error()).toBeUndefined();
  });

  it('keeps a provisional compatibility pause unclaimable when the stream fails', async () => {
    const { agent, source, emit } = harness();
    source.runAgent.mockImplementationOnce(async () => {
      emit({ type: 'RUN_STARTED', runId: 'pause-run' });
      emit({ type: 'CUSTOM', name: 'on_interrupt', value: { question: 'Approve?' } });
      throw new Error('stream failed before terminal pause');
    });
    await agent.submit({});
    expect(agent.error()).toBeDefined();
    expect(agent.interruptSession().phase).toBe('collecting');
    await expect(agent.submit({ resume: true })).rejects.toThrow(/pending/);
  });

  it('rejects malformed native terminal batches without committing state', async () => {
    const { agent, source, emit } = harness();
    source.runAgent.mockImplementationOnce(async () => {
      emit({ type: 'RUN_STARTED', runId: 'pause-run' });
      emit({ type: 'RUN_FINISHED', runId: 'pause-run', outcome: { type: 'interrupt', interrupts: [] } });
    });
    await agent.submit({});
    expect(agent.error()).toBeDefined();
    expect(agent.interruptSession().phase).toBe('none');
  });

  it('rolls back and settles an active resume when its caller aborts or disposes', async () => {
    for (const action of ['abort', 'dispose'] as const) {
      const { agent, source, emit } = harness();
      await agent.submit({});
      let finish!: () => void;
      source.runAgent.mockImplementationOnce(async params => {
        emit({ type: 'RUN_STARTED', runId: params?.runId });
        emit({ type: 'STATE_SNAPSHOT', snapshot: { partial: true } });
        await new Promise<void>(resolve => { finish = resolve; });
      });
      const controller = new AbortController();
      const request = agent.submit({ resume: true, state: { patched: true } }, { signal: controller.signal });
      if (action === 'abort') controller.abort(); else agent.dispose();
      expect(agent.state()).toEqual({});
      expect(agent.isLoading()).toBe(false);
      expect(agent.interruptSession().phase).toBe('recovery-required');
      emit({ type: 'STATE_SNAPSHOT', snapshot: { late: true } });
      expect(agent.state()).toEqual({});
      finish(); await request;
    }
  });

  it('blocks client-tool continuation before it mutates outgoing messages during a pause', async () => {
    const { agent, source } = harness();
    await agent.submit({});
    expect(() => agent.clientTools.resolve('tool-1', { ok: true, value: 'done' })).toThrow(/interrupt/i);
    expect(source.messages).toEqual([]);
    expect(source.runAgent).toHaveBeenCalledTimes(1);
  });

  it('rolls failed resume state back to the paused boundary and ignores late state', async () => {
    const { agent, source, emit } = harness();
    source.runAgent.mockImplementationOnce(async () => {
      emit({ type: 'RUN_STARTED', runId: 'pause-run' });
      emit({ type: 'STATE_SNAPSHOT', snapshot: { amount: 12 } });
      emit({ type: 'RUN_FINISHED', runId: 'pause-run', outcome: { type: 'interrupt', interrupts: [{ id: 'i1', reason: 'confirmation' }] } });
      emit({ type: 'STATE_SNAPSHOT', snapshot: { amount: 999 } });
    });
    await agent.submit({});
    expect(agent.state()).toEqual({ amount: 12 });
    source.runAgent.mockImplementationOnce(async params => {
      emit({ type: 'RUN_STARTED', runId: params?.runId });
      emit({ type: 'STATE_SNAPSHOT', snapshot: { partial: true } });
      throw new Error('transport lost');
    });
    await agent.submit({ resume: true, state: { amount: 24 } });
    expect(agent.state()).toEqual({ amount: 12 });
    expect(source.state).toEqual({ amount: 12 });
    expect(agent.interruptSession().phase).toBe('recovery-required');
  });

  it('disposes subscriptions and rejects later submissions', async () => {
    const { agent, source, emit } = harness();
    await agent.submit({});
    agent.dispose();
    emit({ type: 'STATE_SNAPSHOT', snapshot: { stale: true } });
    expect(agent.state()).toEqual({});
    await expect(agent.submit({ message: 'after dispose' })).rejects.toThrow(/disposed/);
    expect(source.runAgent).toHaveBeenCalledTimes(1);
  });

  it('rejects unrelated input without discarding the pause', async () => {
    const { agent, source } = harness();
    await agent.submit({});
    await expect(agent.submit({ message: 'ignore the pause' })).rejects.toThrow(/interrupt/i);
    expect(source.runAgent).toHaveBeenCalledTimes(1);
    expect(agent.interrupt()).toBeDefined();
    expect(source.messages).toEqual([]);
  });

  it('rejects an ordinary retry before changing a fresh paused snapshot', async () => {
    const { agent, source, emit } = harness();
    source.runAgent.mockImplementationOnce(async () => {
      emit({ type: 'RUN_STARTED', runId: 'pause-run' });
      emit({ type: 'STATE_SNAPSHOT', snapshot: { committed: true } });
      emit({ type: 'RUN_FINISHED', runId: 'pause-run', outcome: { type: 'interrupt', interrupts: [{ id: 'i1', reason: '' }] } });
    });
    await agent.submit({ state: { initial: true } });
    await expect(agent.retry()).rejects.toThrow(/interrupt/);
    expect(agent.state()).toEqual({ committed: true });
  });

  it('retains the decision on known pre-dispatch failure and retries it', async () => {
    const { agent, source } = harness();
    await agent.submit({});
    source.runAgent.mockRejectedValueOnce(Object.assign(new Error('not sent'), { requestNotDispatched: true }));
    await agent.submit({ resume: true });
    expect(agent.interrupt()).toBeDefined();
    expect(agent.error()).toBeDefined();
    await agent.retry();
    expect(source.runAgent.mock.calls[2][0]).toEqual(source.runAgent.mock.calls[1][0]);
  });

  it('claims synchronously so a second decision cannot start another request', async () => {
    const { agent, source } = harness();
    await agent.submit({});
    let finish!: () => void;
    source.runAgent.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const first = agent.submit({ resume: true });
    await expect(agent.submit({ resume: false })).rejects.toThrow(/interrupt|progress|claim/i);
    finish();
    await first;
    expect(source.runAgent).toHaveBeenCalledTimes(2);
  });

  it('does not silently retry an ambiguous dispatched decision', async () => {
    const { agent, source } = harness();
    await agent.submit({});
    source.runAgent.mockRejectedValueOnce(new Error('connection lost after send'));
    await agent.submit({ resume: true });
    await expect(agent.retry()).rejects.toThrow(/reconcil|uncertain|recover/i);
    expect(source.runAgent).toHaveBeenCalledTimes(2);
  });
});
