import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchStreamTransport } from './fetch-stream.transport';

const mocks = vi.hoisted(() => ({
  threadsCreate: vi.fn(),
  runsStream: vi.fn(),
  runsJoinStream: vi.fn(),
  clientCtor: vi.fn(function (_config: { apiUrl: string }) {
    return {
      threads: {
        create: mocks.threadsCreate,
      },
      runs: {
        stream: mocks.runsStream,
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
    mocks.runsStream.mockReset();
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
});
