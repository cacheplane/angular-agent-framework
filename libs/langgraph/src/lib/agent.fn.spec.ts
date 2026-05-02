import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { AIMessage as CoreAIMessage } from '@langchain/core/messages';
import { agent } from './agent.fn';
import { MockAgentTransport } from './transport/mock-stream.transport';
import type { StreamEvent } from './agent.types';
import type { ThreadState } from '@langchain/langgraph-sdk';

function withInjectionContext<T>(fn: () => T): T {
  let result!: T;
  TestBed.runInInjectionContext(() => { result = fn(); });
  return result;
}

function threadState(
  checkpointId: string,
  parentCheckpointId: string | null = null,
): ThreadState<Record<string, unknown>> {
  return {
    values: { messages: [checkpointId] },
    next: [],
    checkpoint: {
      thread_id: 'thread-1',
      checkpoint_ns: '',
      checkpoint_id: checkpointId,
      checkpoint_map: null,
    },
    metadata: null,
    created_at: '2026-05-02T00:00:00.000Z',
    parent_checkpoint: parentCheckpointId
      ? {
          thread_id: 'thread-1',
          checkpoint_ns: '',
          checkpoint_id: parentCheckpointId,
          checkpoint_map: null,
        }
      : null,
    tasks: [],
  };
}

describe('agent', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('returns a ref with initial idle status', () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    // status() now returns AgentStatus (runtime-neutral), not ResourceStatus
    expect(ref.status()).toBe('idle');
    expect(ref.isLoading()).toBe(false);
    expect(ref.hasValue()).toBe(false);
    expect(ref.error()).toBeUndefined();
    expect(ref.messages()).toEqual([]);
  });

  it('returns initialValues in value() immediately', () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({
        apiUrl: '', assistantId: 'a', transport,
        initialValues: { count: 99 },
      })
    );
    expect((ref.value() as any).count).toBe(99);
  });

  it('status transitions to running (isLoading) on submit()', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({ message: 'hello' });
    expect(ref.isLoading()).toBe(true);
  });

  it('submit() resolves after the active stream completes', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );

    let settled = false;
    const submitted = ref.submit({ message: 'hello' }).then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    transport.close();
    await submitted;
    expect(settled).toBe(true);
  });

  it('queue() exposes server-side enqueue submissions', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport, threadId: 'thread-1' })
    );

    ref.submit({ message: 'active' });
    await ref.submit({ message: 'queued' }, { multitaskStrategy: 'enqueue' });

    expect(ref.queue().size).toBe(1);
    expect(ref.queue().entries[0]).toMatchObject({
      values: { messages: [{ role: 'human', content: 'queued' }] },
    });

    await ref.queue().clear();
    expect(ref.queue().size).toBe(0);
  });

  it('hasValue becomes true after values event', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({ message: 'hello' });
    transport.emit([{ type: 'values', values: { x: 1 } }]);
    transport.close();
    await new Promise(r => setTimeout(r, 20));
    expect(ref.hasValue()).toBe(true);
    expect((ref.value() as any).x).toBe(1);
  });

  it('error() is set and status is "error" on transport error', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({ message: 'hello' });
    transport.emitError(new Error('fail'));
    await new Promise(r => setTimeout(r, 20));
    expect(ref.status()).toBe('error');
    expect(ref.error()).toBeInstanceOf(Error);
  });

  it('stop() resolves the stream and sets status to idle', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({ message: 'hello' });
    await ref.stop();
    // After stop, status is no longer "running"
    expect(ref.isLoading()).toBe(false);
  });

  it('reload() re-submits the last payload', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    const submitted = ref.submit({ message: 'hello' });
    transport.close();
    await submitted;
    await new Promise(r => setTimeout(r, 10));
    ref.reload();
    expect(ref.isLoading()).toBe(true);
    await ref.stop();
  });

  it('accepts threadId as a Signal', () => {
    const transport = new MockAgentTransport();
    const threadId = signal<string | null>(null);
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport, threadId })
    );
    expect(ref.status()).toBe('idle');
  });

  it('messages() returns Message[] (runtime-neutral) with correct role translation', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({ message: 'hello' });
    transport.emit([{
      type: 'messages',
      messages: [{ id: '1', type: 'human', content: 'hi' }],
    }]);
    transport.close();
    await new Promise(r => setTimeout(r, 20));
    const msgs = ref.messages();
    expect(msgs).toHaveLength(1);
    // Runtime-neutral role: 'human' translates to 'user'
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('hi');
  });

  it('langGraphMessages() returns raw BaseMessage[] without role translation', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport, throttle: false })
    );
    ref.submit({ message: 'hello' });
    transport.emit([{
      type: 'messages',
      messages: [{ id: '1', type: 'human', content: 'hi' }],
    }]);
    transport.close();
    await new Promise(r => setTimeout(r, 30));
    const rawMsgs = ref.langGraphMessages();
    expect(rawMsgs).toHaveLength(1);
    // Raw BaseMessage: no role translation — the internal type field is 'human'
    const raw = rawMsgs[0] as any;
    const type = typeof raw._getType === 'function' ? raw._getType() : raw['type'];
    expect(type).toBe('human');
  });

  it('history() returns AgentCheckpoint[]; langGraphHistory() returns ThreadState[]', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    // Initially both are empty arrays
    expect(ref.history()).toEqual([]);
    expect(ref.langGraphHistory()).toEqual([]);

    // history() returns AgentCheckpoint-shaped objects (runtime-neutral)
    const histVal = ref.history();
    expect(Array.isArray(histVal)).toBe(true);

    // langGraphHistory() returns ThreadState-shaped objects
    const rawHist = ref.langGraphHistory();
    expect(Array.isArray(rawHist)).toBe(true);
  });

  it('normalizes resume submit options into a LangGraph command', async () => {
    const seen: Array<{ payload: unknown; options: unknown }> = [];
    const transport = new MockAgentTransport();
    transport.stream = async function* (
      _assistantId: string,
      _threadId: string | null,
      payload: unknown,
      _signal: AbortSignal,
      options?: unknown,
    ) {
      seen.push({ payload, options });
      yield* [];
    };

    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport, threadId: 'thread-1', throttle: false })
    );

    await ref.submit(null, { resume: { approved: true } });

    expect(seen).toEqual([
      {
        payload: null,
        options: expect.objectContaining({
          command: { resume: { approved: true } },
        }),
      },
    ]);
  });

  it('normalizes resume submit input state into a LangGraph command update', async () => {
    const seen: Array<{ payload: unknown; options: unknown }> = [];
    const transport = new MockAgentTransport();
    transport.stream = async function* (
      _assistantId: string,
      _threadId: string | null,
      payload: unknown,
      _signal: AbortSignal,
      options?: unknown,
    ) {
      seen.push({ payload, options });
      yield* [];
    };

    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport, threadId: 'thread-1', throttle: false })
    );

    await ref.submit({
      resume: { approved: true },
      state: { reviewNotes: 'ship it' },
    });

    expect(seen).toEqual([
      {
        payload: null,
        options: expect.objectContaining({
          command: {
            resume: { approved: true },
            update: { reviewNotes: 'ship it' },
          },
        }),
      },
    ]);
  });

  it('normalizes resume submit input messages into a LangGraph command update', async () => {
    const seen: Array<{ payload: unknown; options: unknown }> = [];
    const transport = new MockAgentTransport();
    transport.stream = async function* (
      _assistantId: string,
      _threadId: string | null,
      payload: unknown,
      _signal: AbortSignal,
      options?: unknown,
    ) {
      seen.push({ payload, options });
      yield* [];
    };

    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport, threadId: 'thread-1', throttle: false })
    );

    await ref.submit({
      message: 'Approved, continue',
      resume: { approved: true },
      state: { reviewer: 'Ada' },
    });

    expect(seen).toEqual([
      {
        payload: null,
        options: expect.objectContaining({
          command: {
            resume: { approved: true },
            update: {
              messages: [{ type: 'human', role: 'human', content: 'Approved, continue' }],
              reviewer: 'Ada',
            },
          },
        }),
      },
    ]);
  });

  it('merges resume submit updates with existing LangGraph command updates', async () => {
    const seen: Array<{ payload: unknown; options: unknown }> = [];
    const transport = new MockAgentTransport();
    transport.stream = async function* (
      _assistantId: string,
      _threadId: string | null,
      payload: unknown,
      _signal: AbortSignal,
      options?: unknown,
    ) {
      seen.push({ payload, options });
      yield* [];
    };

    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport, threadId: 'thread-1', throttle: false })
    );

    await ref.submit(
      {
        resume: { approved: true },
        state: { reviewer: 'Ada' },
      },
      {
        command: {
          update: { workflow: 'release' },
          goto: 'publish',
        },
      },
    );

    expect(seen).toEqual([
      {
        payload: null,
        options: expect.objectContaining({
          command: {
            resume: { approved: true },
            update: {
              workflow: 'release',
              reviewer: 'Ada',
            },
            goto: 'publish',
          },
        }),
      },
    ]);
  });

  it('experimentalBranchTree() exposes a branch tree derived from LangGraph history', async () => {
    const root = threadState('root');
    const left = threadState('left', 'root');
    const right = threadState('right', 'root');
    const transport = new MockAgentTransport();
    transport.history = [root, left, right];

    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport, threadId: 'thread-1', throttle: false })
    );
    await new Promise(r => setTimeout(r, 20));

    const tree = ref.experimentalBranchTree();
    expect(tree.type).toBe('sequence');
    expect(tree.items[0]).toEqual({ type: 'node', value: root, path: [] });
    const fork = tree.items[1];
    expect(fork?.type).toBe('fork');
    if (fork?.type !== 'fork') throw new Error('Expected fork node');
    expect(fork.items.map(sequence => sequence.items[0])).toEqual(
      expect.arrayContaining([
        { type: 'node', value: left, path: ['left'] },
        { type: 'node', value: right, path: ['right'] },
      ]),
    );
  });

  it('messages() translates AIMessage role to "assistant"', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({ message: 'hello' });
    transport.emit([{
      type: 'messages',
      messages: [{ id: '2', type: 'ai', content: 'hello back' }],
    }]);
    transport.close();
    await new Promise(r => setTimeout(r, 20));
    const msgs = ref.messages();
    expect(msgs[0].role).toBe('assistant');
  });

  it('switchThread() resets messages and values', () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.switchThread('thread-2');
    expect(ref.messages()).toEqual([]);
  });

  it('resets state when a bound threadId signal changes', async () => {
    const transport = new MockAgentTransport();
    const threadId = signal<string | null>('thread-1');
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport, threadId })
    );

    ref.submit({ message: 'hello' });
    transport.emit([
      { type: 'values', values: { x: 1 } },
      { type: 'messages', messages: [{ id: '1', type: 'human', content: 'hi' }] as any[] },
    ]);
    await new Promise(r => setTimeout(r, 20));

    expect(ref.hasValue()).toBe(true);
    expect((ref.value() as any).x).toBe(1);
    expect(ref.messages()).toHaveLength(1);

    threadId.set('thread-2');
    await new Promise(r => setTimeout(r, 30));

    expect(ref.hasValue()).toBe(false);
    expect(ref.status()).toBe('idle');
    expect(ref.error()).toBeUndefined();
    expect(ref.value()).toEqual({});
    expect(ref.messages()).toEqual([]);
    expect(ref.history()).toEqual([]);
    expect(ref.interrupt()).toBeUndefined();
    expect(ref.isThreadLoading()).toBe(false);
  });

  it('langGraphInterrupts() exposes raw LangGraph interrupts signal', () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    expect(Array.isArray(ref.langGraphInterrupts())).toBe(true);
  });

  it('langGraphToolCalls() exposes raw ToolCallWithResult[] signal', () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    expect(Array.isArray(ref.langGraphToolCalls())).toBe(true);
  });

  it('toolProgress() reflects tools stream lifecycle events', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport, throttle: false })
    );

    ref.submit({ message: 'hello' });
    transport.emit([{
      type: 'tools',
      data: { event: 'on_tool_start', toolCallId: 'call-1', name: 'search', input: { q: 'angular' } },
    } satisfies StreamEvent]);
    transport.close();
    await new Promise(r => setTimeout(r, 20));

    expect(ref.toolProgress()).toEqual([
      {
        toolCallId: 'call-1',
        name: 'search',
        state: 'starting',
        input: { q: 'angular' },
      },
    ]);
  });

  it('toolCalls() and getToolCalls() expose tool results derived from messages', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport, throttle: false })
    );

    ref.submit({ message: 'hello' });
    transport.emit([{
      type: 'messages',
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
          content: '',
          tool_calls: [{ id: 'call-1', name: 'search', args: { q: 'angular' } }],
        },
        {
          id: 'tool-1',
          type: 'tool',
          tool_call_id: 'call-1',
          content: 'result',
          status: 'success',
        },
      ],
    } satisfies StreamEvent]);
    transport.close();
    await new Promise(r => setTimeout(r, 20));

    expect(ref.langGraphToolCalls()).toHaveLength(1);
    expect(ref.toolCalls()).toEqual([
      {
        id: 'call-1',
        name: 'search',
        args: { q: 'angular' },
        status: 'complete',
        result: 'result',
        error: undefined,
      },
    ]);
    expect(ref.getToolCalls(ref.langGraphMessages()[0] as CoreAIMessage)).toHaveLength(1);
  });

  it('getMessagesMetadata() returns stream metadata captured from message tuples', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport, throttle: false })
    );

    ref.submit({ message: 'hello' });
    transport.emit([{
      type: 'messages',
      messages: [{ id: 'ai-1', type: 'ai', content: 'hello' }],
      messageMetadata: { langgraph_node: 'model', run_id: 'run-1' },
    } satisfies StreamEvent]);
    transport.close();
    await new Promise(r => setTimeout(r, 20));

    const aiMessage = ref.langGraphMessages().find(
      msg => (msg as unknown as Record<string, unknown>)['id'] === 'ai-1',
    );
    if (!aiMessage) throw new Error('Expected streamed AI message');

    expect(ref.getMessagesMetadata(aiMessage, 0)).toEqual({
      messageId: 'ai-1',
      firstSeenState: undefined,
      branch: undefined,
      branchOptions: undefined,
      streamMetadata: { langgraph_node: 'model', run_id: 'run-1' },
    });
  });

  it('subagents() and activeSubagents() expose delegated work as signals', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({
        apiUrl: '',
        assistantId: 'a',
        transport,
        throttle: false,
        subagentToolNames: ['task'],
        filterSubagentMessages: true,
      })
    );

    ref.submit({ message: 'hello' });
    transport.emit([{
      type: 'messages',
      messages: [{
        id: 'ai-1',
        type: 'ai',
        content: '',
        tool_calls: [{
          id: 'call-1',
          name: 'task',
          args: { subagent_type: 'researcher', description: 'Research Angular signals' },
        }],
      }],
    } satisfies StreamEvent]);
    transport.emit([{
      type: 'messages|tools:call-1' as StreamEvent['type'],
      namespace: ['tools:call-1'],
      messages: [{ id: 'sub-ai-1', type: 'ai', content: 'Subagent note' }],
      messageMetadata: { checkpoint_ns: 'tools:call-1|model:abc' },
    } satisfies StreamEvent]);

    await new Promise(r => setTimeout(r, 20));

    expect(ref.activeSubagents()).toHaveLength(1);
    expect(ref.activeSubagents()[0].status()).toBe('running');
    expect(ref.subagents().get('call-1')?.name).toBe('researcher');
    expect(ref.subagents().get('call-1')?.messages()).toEqual([
      expect.objectContaining({ id: 'sub-ai-1', role: 'assistant', content: 'Subagent note' }),
    ]);
    expect(ref.messages()).toHaveLength(1);
    expect(ref.messages()[0].id).toBe('ai-1');

    transport.emit([{
      type: 'messages',
      messages: [{ id: 'tool-1', type: 'tool', tool_call_id: 'call-1', content: 'done', status: 'success' }],
    } satisfies StreamEvent]);
    transport.close();
    await new Promise(r => setTimeout(r, 20));

    expect(ref.activeSubagents()).toHaveLength(0);
    expect(ref.subagents().get('call-1')?.status()).toBe('complete');
  });

  it('exposes helper methods for looking up subagent streams', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({
        apiUrl: '',
        assistantId: 'a',
        transport,
        throttle: false,
        subagentToolNames: ['task'],
      })
    );

    ref.submit({ message: 'hello' });
    const triggeringMessage = {
      id: 'ai-helpers',
      type: 'ai',
      content: '',
      tool_calls: [
        {
          id: 'call-research',
          name: 'task',
          args: { subagent_type: 'researcher', description: 'Research Angular signals' },
        },
        {
          id: 'call-review',
          name: 'task',
          args: { subagent_type: 'reviewer', description: 'Review the notes' },
        },
      ],
    } as unknown as CoreAIMessage;
    transport.emit([{
      type: 'messages',
      messages: [triggeringMessage],
    } satisfies StreamEvent]);
    transport.emit([{
      type: 'messages|tools:call-research' as StreamEvent['type'],
      namespace: ['tools:call-research'],
      messages: [{ id: 'sub-ai-research', type: 'ai', content: 'Research note' }],
    } satisfies StreamEvent]);
    transport.emit([{
      type: 'messages|tools:call-review' as StreamEvent['type'],
      namespace: ['tools:call-review'],
      messages: [{ id: 'sub-ai-review', type: 'ai', content: 'Review note' }],
    } satisfies StreamEvent]);

    await new Promise(r => setTimeout(r, 20));

    expect(ref.getSubagent('call-research')?.name).toBe('researcher');
    expect(ref.getSubagentsByType('reviewer').map(sa => sa.toolCallId)).toEqual(['call-review']);
    expect(ref.getSubagentsByMessage(triggeringMessage).map(sa => sa.toolCallId)).toEqual([
      'call-research',
      'call-review',
    ]);
    expect(ref.getSubagent('missing')).toBeUndefined();
  });

  it('events$ is an Observable-like with .subscribe', () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    expect(typeof ref.events$.subscribe).toBe('function');
  });
});
