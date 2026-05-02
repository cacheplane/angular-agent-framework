import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchStreamTransport } from './fetch-stream.transport';

const mocks = vi.hoisted(() => ({
  threadsCreate: vi.fn(),
  threadsGetHistory: vi.fn(),
  runsStream: vi.fn(),
  runsCreate: vi.fn(),
  runsCancel: vi.fn(),
  runsJoinStream: vi.fn(),
  clientCtor: vi.fn(function (_config: { apiUrl: string }) {
    return {
      threads: {
        create: mocks.threadsCreate,
        getHistory: mocks.threadsGetHistory,
      },
      runs: {
        stream: mocks.runsStream,
        create: mocks.runsCreate,
        cancel: mocks.runsCancel,
        joinStream: mocks.runsJoinStream,
      },
    };
  }),
}));

vi.mock('@langchain/langgraph-sdk', () => ({
  Client: mocks.clientCtor,
}));

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iter) {
    result.push(item);
  }
  return result;
}

describe('FetchStreamTransport', () => {
  beforeEach(() => {
    mocks.threadsCreate.mockReset();
    mocks.threadsGetHistory.mockReset();
    mocks.runsStream.mockReset();
    mocks.runsCreate.mockReset();
    mocks.runsCancel.mockReset();
    mocks.runsJoinStream.mockReset();
    mocks.clientCtor.mockClear();
  });

  it('normalizes messages/* events with a direct messages array', async () => {
    const message = { id: 'msg-1', type: 'ai', content: 'pong' };
    mocks.runsStream.mockReturnValue(
      (async function* () {
        yield { event: 'messages/partial', data: [message] };
      })(),
    );

    const transport = new FetchStreamTransport('http://example.test');
    const events = await collect(
      transport.stream('assistant-1', 'thread-1', { input: 'hello' }, new AbortController().signal),
    );

    expect(events).toEqual([
      {
        type: 'messages/partial',
        messages: [message],
        data: [message],
      },
    ]);
  });

  it('requests the stream modes required for values, messages, tools, and custom events', async () => {
    mocks.runsStream.mockReturnValue((async function* () {
      yield { event: 'metadata', data: { run_id: 'run-1', thread_id: 'thread-1' } };
    })());

    const transport = new FetchStreamTransport('http://example.test');
    await collect(
      transport.stream('assistant-1', 'thread-1', { input: 'hello' }, new AbortController().signal),
    );

    expect(mocks.runsStream).toHaveBeenCalledWith(
      'thread-1',
      'assistant-1',
      expect.objectContaining({
        streamMode: expect.arrayContaining([
          'values',
          'messages-tuple',
          'updates',
          'tools',
          'custom',
        ]),
      }),
    );
  });

  it('requests subgraph streams so subagent namespaces are delivered', async () => {
    mocks.runsStream.mockReturnValue((async function* () {
      yield { event: 'metadata', data: { run_id: 'run-1', thread_id: 'thread-1' } };
    })());

    const transport = new FetchStreamTransport('http://example.test');
    await collect(
      transport.stream('assistant-1', 'thread-1', { input: 'hello' }, new AbortController().signal),
    );

    expect(mocks.runsStream).toHaveBeenCalledWith(
      'thread-1',
      'assistant-1',
      expect.objectContaining({
        streamSubgraphs: true,
      }),
    );
  });

  it('forwards LangGraph submit options to streamed runs', async () => {
    const checkpoint = {
      checkpoint_ns: '',
      checkpoint_id: 'checkpoint-1',
      checkpoint_map: null,
    };
    const config = { configurable: { userId: 'user-1' } };
    const metadata = { source: 'ui' };
    const command = { resume: { approved: true } };
    mocks.runsStream.mockReturnValue((async function* () {
      yield { event: 'metadata', data: { run_id: 'run-1', thread_id: 'thread-1' } };
    })());

    const transport = new FetchStreamTransport('http://example.test');
    await collect(
      transport.stream(
        'assistant-1',
        'thread-1',
        null,
        new AbortController().signal,
        {
          checkpoint,
          config,
          metadata,
          command,
          durability: 'sync',
          interruptBefore: ['review'],
          onDisconnect: 'continue',
          streamResumable: true,
          feedbackKeys: ['quality'],
        },
      ),
    );

    expect(mocks.runsStream).toHaveBeenCalledWith(
      'thread-1',
      'assistant-1',
      expect.objectContaining({
        input: null,
        checkpoint,
        config,
        metadata,
        command,
        durability: 'sync',
        interruptBefore: ['review'],
        onDisconnect: 'continue',
        streamResumable: true,
        feedbackKeys: ['quality'],
      }),
    );
  });

  it('preserves explicit null checkpoints on streamed runs', async () => {
    mocks.runsStream.mockReturnValue((async function* () {
      yield { event: 'metadata', data: { run_id: 'run-1', thread_id: 'thread-1' } };
    })());

    const transport = new FetchStreamTransport('http://example.test');
    await collect(
      transport.stream(
        'assistant-1',
        'thread-1',
        null,
        new AbortController().signal,
        { checkpoint: null },
      ),
    );

    expect(mocks.runsStream).toHaveBeenCalledWith(
      'thread-1',
      'assistant-1',
      expect.objectContaining({
        checkpoint: null,
      }),
    );
  });

  it('preserves namespaced subgraph event types during normalization', async () => {
    const message = { id: 'sub-ai-1', type: 'ai', content: 'working' };
    const metadata = { checkpoint_ns: 'tools:call-1|model:abc' };
    mocks.runsStream.mockReturnValue(
      (async function* () {
        yield { event: 'messages|tools:call-1', data: [message, metadata] };
      })(),
    );

    const transport = new FetchStreamTransport('http://example.test');
    const events = await collect(
      transport.stream('assistant-1', 'thread-1', { input: 'hello' }, new AbortController().signal),
    );

    expect(events).toEqual([
      {
        type: 'messages|tools:call-1',
        namespace: ['tools:call-1'],
        messages: [message],
        messageMetadata: metadata,
        data: [message, metadata],
      },
    ]);
  });

  it('normalizes message tuple events without dropping metadata', async () => {
    const message = { id: 'ai-1', type: 'ai', content: 'pong' };
    const metadata = { langgraph_node: 'model', run_id: 'run-1' };
    mocks.runsStream.mockReturnValue(
      (async function* () {
        yield { event: 'messages', data: [message, metadata] };
      })(),
    );

    const transport = new FetchStreamTransport('http://example.test');
    const events = await collect(
      transport.stream('assistant-1', 'thread-1', { input: 'hello' }, new AbortController().signal),
    );

    expect(events).toEqual([
      {
        type: 'messages',
        messages: [message],
        messageMetadata: metadata,
        data: [message, metadata],
      },
    ]);
  });

  it('normalizes updates, interrupt, and interrupts payloads', async () => {
    mocks.runsStream.mockReturnValue(
      (async function* () {
        yield { event: 'updates', data: { nodeA: { answer: 42 } } };
        yield { event: 'interrupt', data: { interrupt: { id: 'i-1' } } };
        yield { event: 'interrupts', data: { interrupts: [{ id: 'i-2' }] } };
      })(),
    );

    const transport = new FetchStreamTransport('http://example.test');
    const events = await collect(
      transport.stream('assistant-1', 'thread-1', { input: 'hello' }, new AbortController().signal),
    );

    expect(events).toEqual([
      { type: 'updates', nodeA: { answer: 42 }, data: { nodeA: { answer: 42 } } },
      { type: 'interrupt', interrupt: { id: 'i-1' }, data: { interrupt: { id: 'i-1' } } },
      { type: 'interrupts', interrupts: [{ id: 'i-2' }], data: { interrupts: [{ id: 'i-2' }] } },
    ]);
  });

  it('forwards lastEventId and reuses the existing thread when joining', async () => {
    mocks.runsJoinStream.mockReturnValue(
      (async function* () {
        yield { event: 'values', data: { status: 'resumed' } };
      })(),
    );

    const transport = new FetchStreamTransport('http://example.test');
    const events = await collect(
      transport.joinStream('thread-1', 'run-1', 'event-9', new AbortController().signal),
    );

    expect(mocks.threadsCreate).not.toHaveBeenCalled();
    expect(mocks.runsJoinStream).toHaveBeenCalledWith(
      'thread-1',
      'run-1',
      expect.objectContaining({
        lastEventId: 'event-9',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(events).toEqual([
      { type: 'values', status: 'resumed', data: { status: 'resumed' } },
    ]);
  });

  it('creates a server-side queued run with enqueue multitask strategy', async () => {
    mocks.runsCreate.mockResolvedValue({
      run_id: 'run-queued',
      thread_id: 'thread-1',
      created_at: '2026-05-02T00:00:00.000Z',
    });

    const transport = new FetchStreamTransport('http://example.test');
    const entry = await transport.createQueuedRun(
      'assistant-1',
      'thread-1',
      { messages: [{ type: 'human', content: 'queued' }] },
      new AbortController().signal,
    );

    expect(mocks.runsCreate).toHaveBeenCalledWith(
      'thread-1',
      'assistant-1',
      expect.objectContaining({
        input: { messages: [{ type: 'human', content: 'queued' }] },
        multitaskStrategy: 'enqueue',
        streamSubgraphs: true,
      }),
    );
    expect(entry).toMatchObject({
      id: 'run-queued',
      threadId: 'thread-1',
      values: { messages: [{ type: 'human', content: 'queued' }] },
    });
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it('forwards LangGraph submit options when creating queued runs', async () => {
    const checkpoint = {
      checkpoint_ns: '',
      checkpoint_id: 'checkpoint-queued',
      checkpoint_map: null,
    };
    mocks.runsCreate.mockResolvedValue({
      run_id: 'run-queued',
      thread_id: 'thread-1',
      created_at: '2026-05-02T00:00:00.000Z',
    });

    const transport = new FetchStreamTransport('http://example.test');
    await transport.createQueuedRun(
      'assistant-1',
      'thread-1',
      { messages: [{ type: 'human', content: 'queued' }] },
      new AbortController().signal,
      {
        checkpoint,
        command: { resume: { ok: true } },
        multitaskStrategy: 'interrupt',
      },
    );

    expect(mocks.runsCreate).toHaveBeenCalledWith(
      'thread-1',
      'assistant-1',
      expect.objectContaining({
        checkpoint,
        command: { resume: { ok: true } },
        multitaskStrategy: 'enqueue',
      }),
    );
  });

  it('cancels a queued run by thread and run id', async () => {
    const transport = new FetchStreamTransport('http://example.test');

    await transport.cancelRun('thread-1', 'run-queued', new AbortController().signal);

    expect(mocks.runsCancel).toHaveBeenCalledWith(
      'thread-1',
      'run-queued',
      false,
      'interrupt',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('loads thread history through the LangGraph SDK client', async () => {
    const history = [
      {
        values: { messages: [] },
        next: [],
        checkpoint: {
          thread_id: 'thread-1',
          checkpoint_ns: '',
          checkpoint_id: 'checkpoint-1',
          checkpoint_map: null,
        },
        metadata: null,
        created_at: '2026-05-02T00:00:00.000Z',
        parent_checkpoint: null,
        tasks: [],
      },
    ];
    mocks.threadsGetHistory.mockResolvedValue(history);
    const signal = new AbortController().signal;

    const transport = new FetchStreamTransport('http://example.test');
    const result = await transport.getHistory('thread-1', signal);

    expect(mocks.threadsGetHistory).toHaveBeenCalledWith('thread-1', { signal });
    expect(result).toBe(history);
  });
});
