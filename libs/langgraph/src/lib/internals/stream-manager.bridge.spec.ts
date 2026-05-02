import { describe, it, expect } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { createStreamManagerBridge } from './stream-manager.bridge';
import { MockAgentTransport } from '../transport/mock-stream.transport';
import { ResourceStatus, AgentTransport, StreamSubjects, CustomStreamEvent, StreamEvent } from '../agent.types';
import { of } from 'rxjs';

function makeSubjects(): StreamSubjects<Record<string, unknown>> {
  return {
    status$:          new BehaviorSubject(ResourceStatus.Idle),
    values$:          new BehaviorSubject({}),
    messages$:        new BehaviorSubject([]),
    error$:           new BehaviorSubject(undefined),
    interrupt$:       new BehaviorSubject(undefined),
    interrupts$:      new BehaviorSubject([]),
    branch$:          new BehaviorSubject(''),
    history$:         new BehaviorSubject([]),
    isThreadLoading$: new BehaviorSubject(false),
    toolProgress$:    new BehaviorSubject([]),
    toolCalls$:       new BehaviorSubject([]),
    messageMetadata$: new BehaviorSubject(new Map()),
    subagents$:       new BehaviorSubject(new Map()),
    custom$:          new BehaviorSubject<CustomStreamEvent[]>([]),
  };
}

describe('createStreamManagerBridge', () => {
  it('creates a bridge with submit and stop methods', () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    expect(typeof bridge.submit).toBe('function');
    expect(typeof bridge.stop).toBe('function');
    expect(typeof bridge.resubmitLast).toBe('function');
  });

  it('sets status to Loading when submit is called', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    bridge.submit({ messages: [] });
    expect(subjects.status$.value).toBe(ResourceStatus.Loading);
    destroy$.next();
  });

  it('sets status to Resolved when stream completes', async () => {
    const transport = new MockAgentTransport([
      [{ type: 'values', values: { count: 1 } }],
    ]);
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    // Do NOT await submit — it only resolves after the stream ends.
    // Close the transport first so the async generator terminates,
    // then await a tick for the status update to propagate.
    bridge.submit({ messages: [] });
    transport.close();
    await new Promise(r => setTimeout(r, 10));
    expect(subjects.status$.value).toBe(ResourceStatus.Resolved);
    destroy$.next();
  });

  it('updates values$ when values event received', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    bridge.submit({});
    transport.emit([{ type: 'values', values: { answer: 42 } }]);
    transport.close();
    await new Promise(r => setTimeout(r, 10));
    expect(subjects.values$.value).toMatchObject({ answer: 42 });
    destroy$.next();
  });

  it('sets status to Error on transport error', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    bridge.submit({});
    transport.emitError(new Error('network fail'));
    await new Promise(r => setTimeout(r, 10));
    expect(subjects.status$.value).toBe(ResourceStatus.Error);
    expect(subjects.error$.value).toBeInstanceOf(Error);
    destroy$.next();
  });

  it.each(['messages/partial', 'messages/complete'] as const)(
    'updates messages$ when SDK %s events are received',
    async (type) => {
      const transport = new MockAgentTransport();
      const subjects = makeSubjects();
      const destroy$ = new Subject<void>();
      const bridge = createStreamManagerBridge({
        options: { apiUrl: '', assistantId: 'test', transport },
        subjects,
        threadId$: of(null),
        destroy$: destroy$.asObservable(),
      });

      bridge.submit({});
      transport.emit([{
        type,
        data: [{ id: '1', type: 'human', content: 'hi' }, { langgraph_node: 'respond' }],
      } as any]);
      transport.close();

      await new Promise(r => setTimeout(r, 10));

      expect(subjects.messages$.value).toHaveLength(1);
      expect(subjects.messages$.value[0]).toMatchObject({ content: 'hi' });
      destroy$.next();
    }
  );

  it.each(['messages/partial', 'messages/complete'] as const)(
    'filters metadata from normalized SDK %s events (messages array path)',
    async (type) => {
      const transport = new MockAgentTransport();
      const subjects = makeSubjects();
      const destroy$ = new Subject<void>();
      const bridge = createStreamManagerBridge({
        options: { apiUrl: '', assistantId: 'test', transport },
        subjects,
        threadId$: of(null),
        destroy$: destroy$.asObservable(),
      });

      bridge.submit({});
      // Simulate post-normalizeSdkEvent shape: messages array includes metadata
      // This is what FetchStreamTransport produces in production
      transport.emit([{
        type,
        messages: [
          { id: 'ai-1', type: 'ai', content: 'Hello' },
          { langgraph_node: 'chatbot', langgraph_triggers: ['start:chatbot'] },
        ],
        data: [
          { id: 'ai-1', type: 'ai', content: 'Hello' },
          { langgraph_node: 'chatbot', langgraph_triggers: ['start:chatbot'] },
        ],
      } as any]);
      transport.close();

      await new Promise(r => setTimeout(r, 10));

      // Only the real message should be in messages$, not the metadata
      expect(subjects.messages$.value).toHaveLength(1);
      expect(subjects.messages$.value[0]).toMatchObject({ id: 'ai-1', content: 'Hello' });
      destroy$.next();
    }
  );

  it('does not accumulate metadata across multiple messages/partial events', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({});

    // First values event — sets up the human message
    transport.emit([{
      type: 'values',
      values: { messages: [{ id: 'h-1', type: 'human', content: 'hi' }] },
    } as any]);

    // Simulate multiple messages/partial events (production SDK shape)
    for (let i = 0; i < 5; i++) {
      transport.emit([{
        type: 'messages/partial',
        messages: [
          { id: 'ai-1', type: 'ai', content: 'Hello'.slice(0, i + 1) },
          { langgraph_node: 'chatbot' },
        ],
        data: [
          { id: 'ai-1', type: 'ai', content: 'Hello'.slice(0, i + 1) },
          { langgraph_node: 'chatbot' },
        ],
      } as any]);
    }

    transport.close();
    await new Promise(r => setTimeout(r, 10));

    // Should only have human + AI messages, no accumulated metadata
    expect(subjects.messages$.value).toHaveLength(2);
    expect(subjects.messages$.value[0]).toMatchObject({ id: 'h-1', content: 'hi' });
    expect(subjects.messages$.value[1]).toMatchObject({ id: 'ai-1', content: 'Hello' });
    destroy$.next();
  });

  it('ignores late events from the previous stream after threadId changes', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const threadId$ = new BehaviorSubject<string | null>('thread-1');
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: threadId$.asObservable(),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({});
    transport.emit([{ type: 'values', values: { count: 1 } }]);
    await new Promise(r => setTimeout(r, 10));

    threadId$.next('thread-2');
    transport.emit([
      { type: 'values', values: { count: 99 } },
      { type: 'messages', messages: [{ id: 'late', type: 'human', content: 'stale' }] as any[] },
    ]);
    await new Promise(r => setTimeout(r, 10));

    expect(subjects.values$.value).toEqual({});
    expect(subjects.messages$.value).toEqual([]);
    destroy$.next();
  });

  it('aborts the active stream when threadId changes', async () => {
    const abortSignals: AbortSignal[] = [];
    const transport: AgentTransport = {
      async *stream(_assistantId, _threadId, _payload, signal) {
        abortSignals.push(signal);
        await new Promise<void>(resolve => {
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
        yield* [];
      },
    };
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const threadId$ = new BehaviorSubject<string | null>('thread-1');
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: threadId$.asObservable(),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({});
    threadId$.next('thread-2');

    await new Promise(r => setTimeout(r, 10));

    expect(abortSignals).toHaveLength(1);
    expect(abortSignals[0].aborted).toBe(true);
    expect(subjects.values$.value).toEqual({});
    expect(subjects.messages$.value).toEqual([]);
    destroy$.next();
  });

  it('stop() aborts the active stream', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });
    bridge.submit({});
    await bridge.stop();
    expect(subjects.status$.value).toBe(ResourceStatus.Resolved);
    destroy$.next();
  });

  it('routes custom events to custom$ subject', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({});
    transport.emit([{
      type: 'custom',
      data: { name: 'state_update', data: { '/mrr/value': 42000 } },
    } as any]);
    transport.close();

    await new Promise(r => setTimeout(r, 10));

    expect(subjects.custom$.value).toHaveLength(1);
    expect(subjects.custom$.value[0]).toEqual({ name: 'state_update', data: { '/mrr/value': 42000 } });
    destroy$.next();
  });

  it('updates toolProgress$ from tools stream events', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({});
    transport.emit([
      { type: 'tools', data: { event: 'on_tool_start', toolCallId: 'call-1', name: 'search', input: { q: 'angular' } } },
      { type: 'tools', data: { event: 'on_tool_event', toolCallId: 'call-1', name: 'search', data: { step: 1 } } },
      { type: 'tools', data: { event: 'on_tool_end', toolCallId: 'call-1', name: 'search', output: 'done' } },
    ] satisfies StreamEvent[]);
    transport.close();

    await new Promise(r => setTimeout(r, 10));

    expect(subjects.toolProgress$.value).toEqual([
      {
        toolCallId: 'call-1',
        name: 'search',
        state: 'completed',
        input: { q: 'angular' },
        data: { step: 1 },
        result: 'done',
      },
    ]);
    destroy$.next();
  });

  it('marks tool progress as error when a tool error event is received', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({});
    transport.emit([
      { type: 'tools', data: { event: 'on_tool_start', toolCallId: 'call-1', name: 'search', input: { q: 'angular' } } },
      { type: 'tools', data: { event: 'on_tool_error', toolCallId: 'call-1', name: 'search', error: 'failed' } },
    ] satisfies StreamEvent[]);
    transport.close();

    await new Promise(r => setTimeout(r, 10));

    expect(subjects.toolProgress$.value).toEqual([
      {
        toolCallId: 'call-1',
        name: 'search',
        state: 'error',
        input: { q: 'angular' },
        error: 'failed',
      },
    ]);
    destroy$.next();
  });

  it('derives toolCalls$ from AI tool calls and matching tool messages', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({});
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

    await new Promise(r => setTimeout(r, 10));

    expect(subjects.toolCalls$.value).toHaveLength(1);
    expect(subjects.toolCalls$.value[0]).toMatchObject({
      id: 'call-1',
      state: 'completed',
      call: { name: 'search', args: { q: 'angular' } },
      result: { content: 'result' },
    });
    destroy$.next();
  });

  it('stores message tuple metadata by message id', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({});
    transport.emit([{
      type: 'messages',
      messages: [{ id: 'ai-1', type: 'ai', content: 'hello' }],
      messageMetadata: { langgraph_node: 'model', run_id: 'run-1' },
    } satisfies StreamEvent]);
    transport.close();

    await new Promise(r => setTimeout(r, 10));

    expect(subjects.messageMetadata$.value.get('ai-1')).toEqual({
      messageId: 'ai-1',
      firstSeenState: undefined,
      branch: undefined,
      branchOptions: undefined,
      streamMetadata: { langgraph_node: 'model', run_id: 'run-1' },
    });
    destroy$.next();
  });

  it('merges message tuple events into the existing transcript', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({ messages: [{ type: 'human', content: 'hello' }] });
    transport.emit([{
      type: 'messages',
      messages: [{ id: 'ai-1', type: 'ai', content: 'hel' }],
      messageMetadata: { langgraph_node: 'model' },
    } satisfies StreamEvent]);
    transport.emit([{
      type: 'messages',
      messages: [{ id: 'ai-1', type: 'ai', content: 'hello' }],
      messageMetadata: { langgraph_node: 'model' },
    } satisfies StreamEvent]);
    transport.close();

    await new Promise(r => setTimeout(r, 10));

    expect(subjects.messages$.value).toEqual([
      { type: 'human', content: 'hello' },
      { id: 'ai-1', type: 'ai', content: 'hello' },
    ]);
    destroy$.next();
  });

  it('tracks configured subagent tool calls through running and completion states', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: {
        apiUrl: '',
        assistantId: 'test',
        transport,
        subagentToolNames: ['task'],
      },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({});
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
      type: 'values|tools:call-1' as StreamEvent['type'],
      namespace: ['tools:call-1'],
      data: { messages: [{ type: 'human', content: 'Research Angular signals' }], notes: 'started' },
    } satisfies StreamEvent]);

    await new Promise(r => setTimeout(r, 10));

    const running = subjects.subagents$.value.get('call-1');
    expect(running?.toolCallId).toBe('call-1');
    expect(running?.status()).toBe('running');
    expect(running?.values()).toMatchObject({ notes: 'started' });

    transport.emit([{
      type: 'messages',
      messages: [{ id: 'tool-1', type: 'tool', tool_call_id: 'call-1', content: 'done', status: 'success' }],
    } satisfies StreamEvent]);
    transport.close();

    await new Promise(r => setTimeout(r, 10));

    expect(subjects.subagents$.value.get('call-1')?.status()).toBe('complete');
    destroy$.next();
  });

  it('routes subagent message tuples out of main messages when filtering is enabled', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: {
        apiUrl: '',
        assistantId: 'test',
        transport,
        subagentToolNames: ['task'],
        filterSubagentMessages: true,
      },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({});
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
    transport.close();

    await new Promise(r => setTimeout(r, 10));

    expect(subjects.messages$.value).toHaveLength(1);
    expect(subjects.messages$.value[0]).toMatchObject({ id: 'ai-1' });
    expect(subjects.subagents$.value.get('call-1')?.messages()).toEqual([
      expect.objectContaining({ id: 'sub-ai-1', type: 'ai', content: 'Subagent note' }),
    ]);
    destroy$.next();
  });

  it('clears tracked subagents when the thread changes', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const threadId$ = new BehaviorSubject<string | null>('thread-1');
    const bridge = createStreamManagerBridge({
      options: {
        apiUrl: '',
        assistantId: 'test',
        transport,
        subagentToolNames: ['task'],
      },
      subjects,
      threadId$: threadId$.asObservable(),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({});
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
      type: 'values|tools:call-1' as StreamEvent['type'],
      namespace: ['tools:call-1'],
      data: { messages: [{ type: 'human', content: 'Research Angular signals' }] },
    } satisfies StreamEvent]);
    await new Promise(r => setTimeout(r, 10));
    expect(subjects.subagents$.value.size).toBe(1);

    threadId$.next('thread-2');
    await new Promise(r => setTimeout(r, 10));

    expect(subjects.subagents$.value.size).toBe(0);
    destroy$.next();
  });

  it('accumulates multiple custom events in order', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });

    bridge.submit({});
    transport.emit([{
      type: 'custom',
      data: { name: 'state_update', data: { '/mrr/value': 42000 } },
    } as any]);
    transport.emit([{
      type: 'custom',
      data: { name: 'progress', data: { step: 2 } },
    } as any]);
    transport.close();

    await new Promise(r => setTimeout(r, 10));

    expect(subjects.custom$.value).toHaveLength(2);
    expect(subjects.custom$.value[0]).toEqual({ name: 'state_update', data: { '/mrr/value': 42000 } });
    expect(subjects.custom$.value[1]).toEqual({ name: 'progress', data: { step: 2 } });
    destroy$.next();
  });

  it('clears custom$ on a new submit', async () => {
    const transport = new MockAgentTransport();
    const subjects = makeSubjects();
    const destroy$ = new Subject<void>();
    const bridge = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport },
      subjects,
      threadId$: of(null),
      destroy$: destroy$.asObservable(),
    });

    // First submit with a custom event
    bridge.submit({});
    transport.emit([{
      type: 'custom',
      data: { name: 'state_update', data: { '/mrr/value': 42000 } },
    } as any]);
    transport.close();
    await new Promise(r => setTimeout(r, 10));

    expect(subjects.custom$.value).toHaveLength(1);

    // Second submit — custom$ should reset to []
    const transport2 = new MockAgentTransport();
    // Replace internal transport by re-creating the bridge with the same subjects
    const destroy2$ = new Subject<void>();
    const bridge2 = createStreamManagerBridge({
      options: { apiUrl: '', assistantId: 'test', transport: transport2 },
      subjects,
      threadId$: of(null),
      destroy$: destroy2$.asObservable(),
    });
    bridge2.submit({});
    await new Promise(r => setTimeout(r, 10));

    expect(subjects.custom$.value).toHaveLength(0);

    transport2.close();
    await new Promise(r => setTimeout(r, 10));
    destroy$.next();
    destroy2$.next();
  });
});
