// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAgent, type AgentConfig } from './agent.provider';
import { injectAgent } from './inject-agent';
import { MockAgentTransport } from './transport/mock-stream.transport';
import type { ThreadState } from '@langchain/langgraph-sdk';

function configureAgent(config: AgentConfig): void {
  TestBed.configureTestingModule({
    providers: [provideAgent(config)],
  });
}

function getAgent() {
  return TestBed.runInInjectionContext(() => injectAgent());
}

function tick(ms = 30): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function threadState(checkpointId: string): ThreadState<Record<string, unknown>> {
  return {
    values: { messages: [] },
    next: [],
    checkpoint: {
      thread_id: 'thread-1',
      checkpoint_ns: '',
      checkpoint_id: checkpointId,
      checkpoint_map: null,
    },
    metadata: null,
    created_at: '2026-05-02T00:00:00.000Z',
    parent_checkpoint: null,
    tasks: [],
  };
}

describe('AGENT_LIFECYCLE', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('streamStartedAt is null before any stream', () => {
    const transport = new MockAgentTransport();
    configureAgent({ apiUrl: '', assistantId: 'a', transport });
    const ref = getAgent();
    expect(ref.lifecycle.streamStartedAt()).toBeNull();
  });

  it('streamStartedAt fires on first stream chunk', async () => {
    const transport = new MockAgentTransport();
    configureAgent({ apiUrl: '', assistantId: 'a', transport });
    const ref = getAgent();
    ref.submit({ message: 'hi' });
    transport.emit([{ type: 'values', values: { x: 1 } }]);
    transport.close();
    await tick();
    const at = ref.lifecycle.streamStartedAt();
    expect(at).not.toBeNull();
    expect(typeof at).toBe('number');
  });

  it('interruptReceivedAt fires when interrupt$ becomes non-null', async () => {
    const transport = new MockAgentTransport();
    configureAgent({ apiUrl: '', assistantId: 'a', transport });
    const ref = getAgent();
    ref.submit({ message: 'hi' });
    transport.emit([
      {
        type: 'values',
        values: { __interrupt__: [{ id: 'i-1', value: { question: 'ok?' } }] },
      },
    ]);
    transport.close();
    await tick();
    expect(ref.lifecycle.interruptReceivedAt()).not.toBeNull();
  });

  it('interruptResolvedAt fires on submit({ resume })', async () => {
    const transport = new MockAgentTransport();
    configureAgent({ apiUrl: '', assistantId: 'a', transport, threadId: 'thread-1' });
    const ref = getAgent();
    expect(ref.lifecycle.interruptResolvedAt()).toBeNull();
    void ref.submit({ resume: { approved: true } });
    await tick(10);
    expect(ref.lifecycle.interruptResolvedAt()).not.toBeNull();
  });

  it('threadCreatedAt fires on first submit with no existing threadId', async () => {
    const transport = new MockAgentTransport();
    configureAgent({ apiUrl: '', assistantId: 'a', transport });
    const ref = getAgent();
    expect(ref.lifecycle.threadCreatedAt()).toBeNull();
    void ref.submit({ message: 'first' });
    await tick(10);
    expect(ref.lifecycle.threadCreatedAt()).not.toBeNull();
  });

  it('threadPersistedAt fires when agent restores from existing threadId', async () => {
    const transport = new MockAgentTransport();
    transport.history = [threadState('cp-1')];
    configureAgent({ apiUrl: '', assistantId: 'a', transport, threadId: 'thread-1' });
    const ref = getAgent();
    await tick(30);
    expect(ref.lifecycle.threadPersistedAt()).not.toBeNull();
  });

  it('toolCallStartedAt fires on first tool call append', async () => {
    const transport = new MockAgentTransport();
    configureAgent({ apiUrl: '', assistantId: 'a', transport });
    const ref = getAgent();
    ref.submit({ message: 'hi' });
    transport.emit([{
      type: 'messages',
      messages: [{
        id: 'ai-1',
        type: 'ai',
        content: '',
        tool_calls: [{ id: 'tc-1', name: 'search', args: {} }],
      }],
    }]);
    transport.close();
    await tick();
    expect(ref.lifecycle.toolCallStartedAt()).not.toBeNull();
  });

  it('toolCallCompletedAt fires on tool call result transition', async () => {
    const transport = new MockAgentTransport();
    configureAgent({ apiUrl: '', assistantId: 'a', transport, throttle: false });
    const ref = getAgent();
    ref.submit({ message: 'hi' });
    transport.emit([{
      type: 'messages',
      messages: [
        {
          id: 'ai-1',
          type: 'ai',
          content: '',
          tool_calls: [{ id: 'tc-1', name: 'search', args: {} }],
        },
        {
          id: 'tool-1',
          type: 'tool',
          tool_call_id: 'tc-1',
          content: 'done',
          status: 'success',
        },
      ],
    }]);
    transport.close();
    await tick(30);
    expect(ref.lifecycle.toolCallCompletedAt()).not.toBeNull();
  });

  it('streamErrorAt fires when transport errors', async () => {
    const transport = new MockAgentTransport();
    configureAgent({ apiUrl: '', assistantId: 'a', transport });
    const ref = getAgent();
    ref.submit({ message: 'hi' });
    transport.emitError(new Error('boom'));
    await tick();
    const err = ref.lifecycle.streamErrorAt();
    expect(err).not.toBeNull();
    expect(err!.at).toBeGreaterThan(0);
    expect(typeof err!.classification).toBe('string');
  });

  it('all signals reset to null on switchThread(null)', async () => {
    const transport = new MockAgentTransport();
    configureAgent({ apiUrl: '', assistantId: 'a', transport });
    const ref = getAgent();
    ref.submit({ message: 'hi' });
    transport.emit([{ type: 'values', values: { x: 1 } }]);
    transport.emitError(new Error('boom'));
    await tick();
    expect(ref.lifecycle.streamStartedAt()).not.toBeNull();
    expect(ref.lifecycle.streamErrorAt()).not.toBeNull();

    ref.switchThread(null);
    await tick(10);
    expect(ref.lifecycle.streamStartedAt()).toBeNull();
    expect(ref.lifecycle.streamErrorAt()).toBeNull();
    expect(ref.lifecycle.interruptReceivedAt()).toBeNull();
    expect(ref.lifecycle.interruptResolvedAt()).toBeNull();
    expect(ref.lifecycle.threadCreatedAt()).toBeNull();
    expect(ref.lifecycle.threadPersistedAt()).toBeNull();
    expect(ref.lifecycle.toolCallStartedAt()).toBeNull();
    expect(ref.lifecycle.toolCallCompletedAt()).toBeNull();
  });
});
