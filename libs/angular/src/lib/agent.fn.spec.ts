import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { agent } from './agent.fn';
import { MockAgentTransport } from './transport/mock-stream.transport';
import { ResourceStatus } from './agent.types';

function withInjectionContext<T>(fn: () => T): T {
  let result!: T;
  TestBed.runInInjectionContext(() => { result = fn(); });
  return result;
}

describe('agent', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('returns a ref with initial idle status', () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    expect(ref.status()).toBe(ResourceStatus.Idle);
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

  it('status transitions to Loading on submit()', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({});
    expect(ref.isLoading()).toBe(true);
  });

  it('hasValue becomes true after values event', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({});
    transport.emit([{ type: 'values', values: { x: 1 } }]);
    transport.close();
    await new Promise(r => setTimeout(r, 20));
    expect(ref.hasValue()).toBe(true);
    expect((ref.value() as any).x).toBe(1);
  });

  it('error() is set and status is Error on transport error', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({});
    transport.emitError(new Error('fail'));
    await new Promise(r => setTimeout(r, 20));
    expect(ref.status()).toBe(ResourceStatus.Error);
    expect(ref.error()).toBeInstanceOf(Error);
  });

  it('stop() resolves the stream and sets status to Resolved', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({});
    await ref.stop();
    expect(ref.status()).toBe(ResourceStatus.Resolved);
    expect(ref.isLoading()).toBe(false);
  });

  it('reload() re-submits the last payload', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    await ref.submit({ msg: 'hello' });
    transport.close();
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
    expect(ref.status()).toBe(ResourceStatus.Idle);
  });

  it('messages() updates when messages event received', async () => {
    const transport = new MockAgentTransport();
    const ref = withInjectionContext(() =>
      agent({ apiUrl: '', assistantId: 'a', transport })
    );
    ref.submit({});
    transport.emit([{
      type: 'messages',
      messages: [{ id: '1', type: 'human', content: 'hi' }],
    }]);
    transport.close();
    await new Promise(r => setTimeout(r, 20));
    expect(ref.messages()).toHaveLength(1);
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

    ref.submit({});
    transport.emit([
      { type: 'values', values: { x: 1 } },
      { type: 'messages', messages: [{ id: '1', type: 'human', content: 'hi' }] as any[] },
    ]);
    await new Promise(r => setTimeout(r, 20));

    expect(ref.hasValue()).toBe(true);
    expect((ref.value() as any).x).toBe(1);
    expect(ref.messages()).toHaveLength(1);

    threadId.set('thread-2');
    await new Promise(r => setTimeout(r, 0));

    expect(ref.hasValue()).toBe(false);
    expect(ref.status()).toBe(ResourceStatus.Idle);
    expect(ref.error()).toBeUndefined();
    expect(ref.value()).toEqual({});
    expect(ref.messages()).toEqual([]);
    expect(ref.history()).toEqual([]);
    expect(ref.interrupt()).toBeUndefined();
    expect(ref.interrupts()).toEqual([]);
    expect(ref.isThreadLoading()).toBe(false);
  });
});
