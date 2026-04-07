import { describe, it, expect, beforeEach } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { createStreamManagerBridge } from './stream-manager.bridge';
import { MockAgentTransport } from '../transport/mock-stream.transport';
import { ResourceStatus, AgentTransport, StreamSubjects } from '../agent.types';
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
    subagents$:       new BehaviorSubject(new Map()),
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
});
