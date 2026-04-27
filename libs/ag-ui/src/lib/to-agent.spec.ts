// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { Observable, Subject } from 'rxjs';
import type { AbstractAgent, BaseEvent } from '@ag-ui/client';
import type { RunAgentInput } from '@ag-ui/core';
import { toAgent } from './to-agent';

/**
 * Minimal concrete subclass of AbstractAgent for unit testing.
 *
 * AbstractAgent requires one abstract method: run(input: RunAgentInput).
 * The concrete implementation here emits events from a Subject so tests
 * can push events synchronously.
 *
 * NOTE: abortRun() on the base AbstractAgent class is a no-op ({}). Only
 * HttpAgent overrides it with real AbortController logic. For unit tests
 * we spy on abortRun() directly; integration tests against a real server
 * would exercise HttpAgent's override.
 */
class StubAgent {
  // Subject that tests push events into via runAgent internal dispatch.
  // We override runAgent to emit events through our subscriber pattern.
  private readonly _events = new Subject<BaseEvent>();

  // Simulate subscriber list just like AbstractAgent does
  private readonly _subscribers: Array<{ onEvent?: (p: { event: BaseEvent }) => void; onRunFailed?: (p: { error: Error }) => void }> = [];

  subscribe(sub: { onEvent?: (p: { event: BaseEvent }) => void; onRunFailed?: (p: { error: Error }) => void }) {
    this._subscribers.push(sub);
    return { unsubscribe: () => { /* no-op for tests */ } };
  }

  /** Convenience: push an event to all subscribers. */
  emit(event: BaseEvent): void {
    for (const sub of this._subscribers) {
      sub.onEvent?.({ event });
    }
  }

  /** Convenience: fail the run by calling onRunFailed on all subscribers. */
  failRun(error: Error): void {
    for (const sub of this._subscribers) {
      sub.onRunFailed?.({ error });
    }
  }

  // runAgent: the public API toAgent() calls via submit().
  // We make it a spy so tests can verify call args and control resolution.
  runAgent = vi.fn(async () => ({ result: undefined, newMessages: [] }));

  // abortRun: spy so tests can verify stop() calls it.
  abortRun = vi.fn();

  // addMessage: spy to verify user messages are synced to the source.
  addMessage = vi.fn();

  // run(): required abstract method. Not called directly in our adapter
  // since we mock runAgent(), but must be present for type satisfaction.
  run(_input: RunAgentInput): Observable<BaseEvent> {
    return this._events.asObservable();
  }
}

describe('toAgent', () => {
  it('starts with idle status and no messages', () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    expect(a.status()).toBe('idle');
    expect(a.messages()).toEqual([]);
    expect(a.isLoading()).toBe(false);
  });

  it('reduces RUN_STARTED into running status', () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    stub.emit({ type: 'RUN_STARTED' } as BaseEvent);
    expect(a.status()).toBe('running');
    expect(a.isLoading()).toBe(true);
  });

  it('reduces RUN_FINISHED into idle status', () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    stub.emit({ type: 'RUN_STARTED' } as BaseEvent);
    stub.emit({ type: 'RUN_FINISHED' } as BaseEvent);
    expect(a.status()).toBe('idle');
    expect(a.isLoading()).toBe(false);
  });

  it('appends user message optimistically on submit', async () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    void a.submit({ message: 'hello' });
    expect(a.messages()[0]).toEqual(expect.objectContaining({ role: 'user', content: 'hello' }));
  });

  it('syncs user message to source.addMessage()', async () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    await a.submit({ message: 'hello' });
    expect(stub.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user', content: 'hello' }),
    );
  });

  it('calls source.runAgent() on submit', async () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    await a.submit({ message: 'hi' });
    expect(stub.runAgent).toHaveBeenCalledOnce();
  });

  it('stop() calls source.abortRun()', async () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    await a.stop();
    expect(stub.abortRun).toHaveBeenCalledOnce();
  });

  it('events$ emits state_update on CUSTOM with that name', () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    const seen: unknown[] = [];
    a.events$.subscribe((e) => seen.push(e));
    stub.emit({ type: 'CUSTOM', name: 'state_update', value: { x: 1 } } as unknown as BaseEvent);
    expect(seen).toEqual([{ type: 'state_update', data: { x: 1 } }]);
  });

  it('sets error status when onRunFailed subscriber fires', () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    stub.failRun(new Error('something went wrong'));
    expect(a.status()).toBe('error');
    expect(a.isLoading()).toBe(false);
    expect(a.error()).toBeInstanceOf(Error);
  });

  it('does not append user message when input.message is undefined', async () => {
    const stub = new StubAgent();
    const a = toAgent(stub as unknown as AbstractAgent);
    await a.submit({});
    expect(a.messages()).toEqual([]);
    expect(stub.addMessage).not.toHaveBeenCalled();
  });
});
