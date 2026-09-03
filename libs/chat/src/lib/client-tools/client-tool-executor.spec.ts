import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { z } from 'zod/v4';
import { action, view, tools } from './tools';
import { startClientToolExecutor } from './client-tool-executor';
import type { ClientToolsCapability, ClientToolResult } from './client-tools-capability';
import type {
  ClientToolExecutionGuard,
  ClientToolExecutionRecord,
  ClientToolExecutionStore,
} from './client-tool-execution-guard';
import type { Agent } from '../agent/agent';
import type { ToolCall } from '../agent/tool-call';

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Drain the microtask queue a handful of times to let Promise chains settle.
 * The executor races each handler against its abort signal, so a settlement is
 * several ticks deep — keep this comfortably above the longest chain.
 */
async function drainMicrotasks(rounds = 12): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

// Minimal Angular component stand-in for view/ask (avoids needing full TestBed import)
class FakeComponent {}

// ── factory helpers ───────────────────────────────────────────────────────────

function makeFakeCapability() {
  const pending = signal<readonly ToolCall[]>([]);
  // `resolve` is "record AND continue" — both adapters submit a new run from
  // it, so a call to `resolve` IS a run submission.
  const resolve = vi.fn<[string, ClientToolResult], void>();
  const settle = vi.fn<[string, ClientToolResult], void>();
  const flush = vi.fn<[], void>();
  const capability: ClientToolsCapability = {
    setCatalog: vi.fn(),
    pending,
    settle,
    flush,
    resolve,
  };
  return { pending, resolve, settle, flush, capability };
}

/**
 * Capability that mirrors the adapters' real `pending` contract: BOTH `settle()`
 * and `resolve()` route through a `settleResult` that marks the id resolved, and
 * `pending` drops resolved calls. Needed to prove a settled (incl. cancelled)
 * call is never re-dispatched on a later effect pass.
 */
function makeResolvingCapability() {
  const raw = signal<readonly ToolCall[]>([]);
  const resolvedIds = signal<ReadonlySet<string>>(new Set<string>());
  const pending = computed(() => raw().filter((tc) => !resolvedIds().has(tc.id)));
  const markResolved = (id: string): void => {
    resolvedIds.update((s) => new Set(s).add(id));
  };
  const settle = vi.fn<[string, ClientToolResult], void>((id) => markResolved(id));
  const flush = vi.fn<[], void>();
  const resolve = vi.fn<[string, ClientToolResult], void>((id) => markResolved(id));
  const capability: ClientToolsCapability = {
    setCatalog: vi.fn(),
    pending,
    settle,
    flush,
    resolve,
  };
  return { raw, resolve, settle, flush, capability };
}

function makeFakeAgent(capability: ClientToolsCapability): Agent {
  return {
    messages: signal([]),
    status: signal('idle'),
    isLoading: signal(false),
    error: signal(undefined),
    toolCalls: signal([]),
    state: signal({}),
    events$: { subscribe: () => ({ unsubscribe: () => undefined }) } as never,
    submit: vi.fn(),
    stop: vi.fn(),
    retry: vi.fn(),
    regenerate: vi.fn(),
    clientTools: capability,
  };
}

function makeGuardStore(
  claimResult: 'claimed' | ClientToolExecutionRecord = 'claimed',
): ClientToolExecutionStore & {
  claim: ReturnType<typeof vi.fn<[Parameters<ClientToolExecutionStore['claim']>[0]], Promise<'claimed' | ClientToolExecutionRecord>>>;
  record: ReturnType<typeof vi.fn<Parameters<ClientToolExecutionStore['record']>, Promise<void>>>;
  lookup: ReturnType<typeof vi.fn<Parameters<ClientToolExecutionStore['lookup']>, Promise<Record<string, ClientToolExecutionRecord>>>>;
} {
  return {
    claim: vi.fn(async () => claimResult),
    record: vi.fn(async () => undefined),
    lookup: vi.fn(async () => ({})),
  };
}

function makeGuard(store: ClientToolExecutionStore): ClientToolExecutionGuard {
  return { threadId: 'thread-1', store };
}

// ── registry ──────────────────────────────────────────────────────────────────

const weatherRegistry = tools({
  get_weather: action(
    'Get the weather for a city',
    z.object({ city: z.string() }),
    async (a) => ({ temp: 70, city: a.city }),
  ),
  weather_card: view(
    'Show a weather card',
    z.object({ city: z.string() }),
    FakeComponent as never,
  ),
});

const failingRegistry = tools({
  explode: action(
    'Throw from the handler',
    z.object({ value: z.string() }),
    async () => {
      throw new Error('handler exploded');
    },
  ),
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('startClientToolExecutor()', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('resolves a function tool call with ok:true', async () => {
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, weatherRegistry);
    });

    // Regression: a client tool call is marked 'complete' once its args finish
    // streaming, yet it still needs browser execution. The executor must NOT
    // skip 'complete' calls (only `inFlight` + already-resolved/result guards).
    pending.set([{ id: 'c1', name: 'get_weather', args: { city: 'SF' }, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith('c1', { ok: true, value: { temp: 70, city: 'SF' } });
  });

  it('uses a custom settlement handler when provided', async () => {
    const { pending, resolve, capability } = makeFakeCapability();
    const settleToolCall = vi.fn<[ToolCall, ClientToolResult], void>();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, weatherRegistry, { settleToolCall });
    });

    pending.set([{ id: 'c1', name: 'get_weather', args: { city: 'SF' }, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(settleToolCall).toHaveBeenCalledOnce();
    expect(settleToolCall).toHaveBeenCalledWith(
      { id: 'c1', name: 'get_weather', args: { city: 'SF' }, status: 'complete' },
      { ok: true, value: { temp: 70, city: 'SF' } },
    );
    expect(resolve).not.toHaveBeenCalled();
  });

  it('normalizes handler throws to an error result', async () => {
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, failingRegistry);
    });

    pending.set([{ id: 'e1', name: 'explode', args: { value: 'x' }, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(resolve).toHaveBeenCalledWith('e1', {
      ok: false,
      error: 'handler exploded',
    });
  });

  it('normalizes invalid arguments to an error result without calling the handler', async () => {
    const handler = vi.fn(async (a: { city: string }) => ({ temp: 70, city: a.city }));
    const registry = tools({
      get_weather: action(
        'Get the weather for a city',
        z.object({ city: z.string() }),
        handler,
      ),
    });
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
    });

    pending.set([{ id: 'bad-args', name: 'get_weather', args: { city: 123 }, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(handler).not.toHaveBeenCalled();
    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve.mock.calls[0][0]).toBe('bad-args');
    expect(resolve.mock.calls[0][1].ok).toBe(false);
    expect((resolve.mock.calls[0][1] as { error: string }).error).toContain('invalid arguments:');
  });

  it('does not double-resolve the same call id (in-flight guard)', async () => {
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, weatherRegistry);
    });

    const call: ToolCall = { id: 'c1', name: 'get_weather', args: { city: 'SF' }, status: 'running' };

    // Set pending, flush, then set the SAME pending again before the promise resolves
    pending.set([call]);
    TestBed.flushEffects();
    // Re-emit the same list — should NOT start a second execution
    pending.set([call]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(resolve).toHaveBeenCalledOnce();
  });

  it('passes a non-aborted signal to function tool handlers', async () => {
    const seen: AbortSignal[] = [];
    const registry = tools({
      read: action('read', z.object({}), async (_args, context) => {
        seen.push(context.signal);
        return 'done';
      }),
    });
    const { pending, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
    });

    pending.set([{ id: 's1', name: 'read', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(seen).toHaveLength(1);
    expect(seen[0].aborted).toBe(false);
  });

  it('aborts in-flight function tools on stop and settles them without continuing the run', async () => {
    let complete!: (value: string) => void;
    const completion = new Promise<string>((resolve) => {
      complete = resolve;
    });
    const seen: AbortSignal[] = [];
    const registry = tools({
      slow: action('slow', z.object({}), async (_args, context) => {
        seen.push(context.signal);
        return completion;
      }),
    });
    const { pending, resolve, settle, flush, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
    });

    pending.set([{ id: 'slow-1', name: 'slow', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    await agent.stop();
    expect(seen[0].aborted).toBe(true);

    complete('late result');
    await drainMicrotasks();

    // The server thread must never hold a client tool call without a result, so
    // an aborted call settles rather than dangling — but it must settle through
    // settle()+flush(), NEVER resolve(): resolve submits a new run, which would
    // undo the stop the user just asked for.
    expect(resolve).not.toHaveBeenCalled();
    expect(settle).toHaveBeenCalledOnce();
    expect(settle.mock.calls[0][0]).toBe('slow-1');
    expect(settle.mock.calls[0][1].ok).toBe(false);
    expect((settle.mock.calls[0][1] as { error: string }).error).toContain('cancelled');
    expect(flush).toHaveBeenCalled();
  });

  it('submits no run when the user stops a client tool mid-flight', async () => {
    const submittedRuns: string[] = [];
    const registry = tools({
      slow: action('slow', z.object({}), async () => new Promise<string>(() => undefined)),
    });
    const { pending, resolve, capability } = makeFakeCapability();
    resolve.mockImplementation((id) => {
      submittedRuns.push(id);
    });
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
    });

    pending.set([{ id: 'slow-run', name: 'slow', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    await agent.stop();
    await drainMicrotasks(8);

    expect(submittedRuns).toEqual([]);
    expect(agent.submit).not.toHaveBeenCalled();
  });

  it('settles an aborted handler through the non-continuing channel so it cannot re-execute', async () => {
    const continued: Array<[string, ClientToolResult]> = [];
    const cancelled: Array<[string, ClientToolResult]> = [];
    let release!: () => void;
    const registry = tools({
      slow: action('Slow', z.object({}), async () => {
        await new Promise<void>((r) => {
          release = r;
        });
        return 'done';
      }),
    });
    const { pending, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry, {
        settleToolCall: (tc, result) => continued.push([tc.id, result]),
        settleWithoutContinuing: (tc, result) => cancelled.push([tc.id, result]),
      });
    });

    pending.set([{ id: 'slow-1', name: 'slow', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    await agent.stop();
    release();
    await drainMicrotasks();

    expect(continued).toEqual([]);
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0][0]).toBe('slow-1');
    expect(cancelled[0][1].ok).toBe(false);
  });

  it('settles on abort without waiting for a handler that ignores the signal', async () => {
    const cancelled: Array<[string, ClientToolResult]> = [];
    const registry = tools({
      // Never settles, and never looks at context.signal — the common case,
      // since honoring the signal is opt-in.
      stubborn: action('Stubborn', z.object({}), () => new Promise<string>(() => undefined)),
    });
    const { pending, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry, {
        settleWithoutContinuing: (tc, result) => cancelled.push([tc.id, result]),
      });
    });

    pending.set([{ id: 'stubborn-1', name: 'stubborn', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    await agent.stop();
    await drainMicrotasks();

    expect(cancelled).toHaveLength(1);
    expect(cancelled[0][0]).toBe('stubborn-1');
    expect(cancelled[0][1].ok).toBe(false);
  });

  it('does not double-settle when a handler finishes after the abort settled it', async () => {
    let release!: (value: string) => void;
    const registry = tools({
      slow: action('Slow', z.object({}), async () => {
        return new Promise<string>((r) => {
          release = r;
        });
      }),
    });
    const { pending, resolve, settle, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
    });

    pending.set([{ id: 'slow-3', name: 'slow', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    await agent.stop();
    await drainMicrotasks();
    expect(settle).toHaveBeenCalledOnce();

    // The real result arrives long after the cancelled settlement.
    release('late real result');
    await drainMicrotasks(8);

    expect(settle).toHaveBeenCalledOnce();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('does not re-dispatch an aborted client tool on a later effect pass', async () => {
    const handler = vi.fn(async () => {
      await new Promise<void>((r) => {
        release = r;
      });
      return 'done';
    });
    let release!: () => void;
    const registry = tools({
      slow: action('Slow', z.object({}), handler),
    });
    const { raw, resolve, settle, capability } = makeResolvingCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
    });

    raw.set([{ id: 'slow-2', name: 'slow', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    await agent.stop();
    release();
    await drainMicrotasks();

    // The next run re-emits the same tool call list; the cancelled call is now
    // settled (and so in resolvedIds), so it must not be dispatched to the
    // handler a second time.
    raw.set([{ id: 'slow-2', name: 'slow', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(handler).toHaveBeenCalledOnce();
    expect(settle).toHaveBeenCalledOnce();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('aborts in-flight function tools when the injection context is destroyed', async () => {
    const seen: AbortSignal[] = [];
    const registry = tools({
      slow: action('slow', z.object({}), async (_args, context) => {
        seen.push(context.signal);
        return new Promise(() => undefined);
      }),
    });
    const { pending, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
    });

    pending.set([{ id: 'slow-2', name: 'slow', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    TestBed.resetTestingModule();

    expect(seen[0].aborted).toBe(true);
  });

  it('settles on teardown without submitting a run mid-destroy', async () => {
    const registry = tools({
      slow: action('slow', z.object({}), async () => new Promise<string>(() => undefined)),
    });
    const { pending, resolve, settle, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
    });

    pending.set([{ id: 'slow-4', name: 'slow', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    TestBed.resetTestingModule();
    await drainMicrotasks();

    // Destroying the chat with a tool in flight must not submit a run.
    expect(resolve).not.toHaveBeenCalled();
    expect(agent.submit).not.toHaveBeenCalled();
    expect(settle).toHaveBeenCalledOnce();
    expect(settle.mock.calls[0][1].ok).toBe(false);
  });

  it('claims before executing guarded function tools and records before resolving', async () => {
    const order: string[] = [];
    const handler = vi.fn(async () => {
      order.push('handler');
      return 'charged';
    });
    const registry = tools({
      charge: action('Charge a card', z.object({}), handler),
    });
    const store = makeGuardStore('claimed');
    store.claim.mockImplementation(async () => {
      order.push('claim');
      return 'claimed';
    });
    store.record.mockImplementation(async () => {
      order.push('record');
    });
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry, { executionGuard: makeGuard(store) });
    });

    pending.set([{ id: 'charge-1', name: 'charge', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks(8);

    expect(store.claim).toHaveBeenCalledWith({ threadId: 'thread-1', toolCallId: 'charge-1' });
    expect(store.record).toHaveBeenCalledWith(
      { threadId: 'thread-1', toolCallId: 'charge-1' },
      { ok: true, value: 'charged' },
    );
    expect(resolve).toHaveBeenCalledWith('charge-1', { ok: true, value: 'charged' });
    expect(order).toEqual(['claim', 'handler', 'record']);
  });

  it('replays a prior done result without re-running the handler', async () => {
    const handler = vi.fn(async () => 'new-value');
    const registry = tools({
      charge: action('Charge a card', z.object({}), handler),
    });
    const prior: ClientToolResult = { ok: true, value: 'stored-value' };
    const store = makeGuardStore({ status: 'done', result: prior });
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry, { executionGuard: makeGuard(store) });
    });

    pending.set([{ id: 'charge-2', name: 'charge', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(handler).not.toHaveBeenCalled();
    expect(store.record).not.toHaveBeenCalled();
    expect(resolve).toHaveBeenCalledWith('charge-2', prior);
  });

  it('fails closed for stale executing records', async () => {
    const handler = vi.fn(async () => 'new-value');
    const registry = tools({
      charge: action('Charge a card', z.object({}), handler),
    });
    const store = makeGuardStore({ status: 'executing' });
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry, { executionGuard: makeGuard(store) });
    });

    pending.set([{ id: 'charge-3', name: 'charge', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(handler).not.toHaveBeenCalled();
    expect(store.record).toHaveBeenCalledOnce();
    const result = store.record.mock.calls[0][1];
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toContain('charge-3');
    expect(resolve).toHaveBeenCalledWith('charge-3', result);
  });

  it('fails closed for failed records without a stored result', async () => {
    const handler = vi.fn(async () => 'new-value');
    const registry = tools({
      charge: action('Charge a card', z.object({}), handler),
    });
    const store = makeGuardStore({ status: 'failed' });
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry, { executionGuard: makeGuard(store) });
    });

    pending.set([{ id: 'charge-4', name: 'charge', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(handler).not.toHaveBeenCalled();
    expect(store.record).toHaveBeenCalledOnce();
    expect(resolve.mock.calls[0][1].ok).toBe(false);
  });

  it('fails closed when the guard claim fails', async () => {
    const handler = vi.fn(async () => 'new-value');
    const registry = tools({
      charge: action('Charge a card', z.object({}), handler),
    });
    const store = makeGuardStore('claimed');
    store.claim.mockRejectedValue(new Error('store unavailable'));
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry, { executionGuard: makeGuard(store) });
    });

    pending.set([{ id: 'charge-5', name: 'charge', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(handler).not.toHaveBeenCalled();
    expect(store.record).not.toHaveBeenCalled();
    expect(resolve.mock.calls[0][1].ok).toBe(false);
    expect((resolve.mock.calls[0][1] as { error: string }).error).toContain('guard failed');
  });

  it('bypasses the guard for idempotent function tools', async () => {
    const handler = vi.fn(async () => 'cached');
    const registry = tools({
      read: action('Read cached data', z.object({}), handler, { idempotent: true }),
    });
    const store = makeGuardStore('claimed');
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry, { executionGuard: makeGuard(store) });
    });

    pending.set([{ id: 'read-1', name: 'read', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(store.claim).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith('read-1', { ok: true, value: 'cached' });
  });

  it('records and settles without continuing when stopped before a delayed claim resolves', async () => {
    let resolveClaim!: (value: 'claimed') => void;
    const claim = new Promise<'claimed'>((resolve) => {
      resolveClaim = resolve;
    });
    const handler = vi.fn(async () => 'late');
    const registry = tools({
      charge: action('Charge a card', z.object({}), handler),
    });
    const store = makeGuardStore('claimed');
    store.claim.mockReturnValue(claim);
    const { pending, resolve, settle, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry, { executionGuard: makeGuard(store) });
    });

    pending.set([{ id: 'charge-6', name: 'charge', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    await agent.stop();
    resolveClaim('claimed');
    await drainMicrotasks(8);

    expect(handler).not.toHaveBeenCalled();
    // The claim succeeded, so the durable row is now 'executing'. It must be
    // recorded or it stays that way forever and a later reload fails closed
    // with a misleading "interrupted" message.
    expect(store.record).toHaveBeenCalledOnce();
    expect(store.record.mock.calls[0][1].ok).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
    expect(settle).toHaveBeenCalledOnce();
    expect((settle.mock.calls[0][1] as { error: string }).error).toContain('cancelled');
  });

  it('settles without continuing when the claim rejects after a stop', async () => {
    let rejectClaim!: (err: Error) => void;
    const claim = new Promise<'claimed'>((_res, rej) => {
      rejectClaim = rej;
    });
    const handler = vi.fn(async () => 'late');
    const registry = tools({
      charge: action('Charge a card', z.object({}), handler),
    });
    const store = makeGuardStore('claimed');
    store.claim.mockReturnValue(claim);
    const { pending, resolve, settle, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry, { executionGuard: makeGuard(store) });
    });

    pending.set([{ id: 'charge-8', name: 'charge', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    await agent.stop();
    rejectClaim(new Error('store unavailable'));
    await drainMicrotasks(8);

    expect(handler).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
    expect(settle).toHaveBeenCalledOnce();
    expect(settle.mock.calls[0][1].ok).toBe(false);
  });

  it('records the cancelled result when stopped after claiming', async () => {
    let release!: () => void;
    const handler = vi.fn(async () => {
      await new Promise<void>((r) => {
        release = r;
      });
      return 'charged';
    });
    const registry = tools({
      charge: action('Charge a card', z.object({}), handler),
    });
    const store = makeGuardStore('claimed');
    const { pending, resolve, settle, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry, { executionGuard: makeGuard(store) });
    });

    pending.set([{ id: 'charge-7', name: 'charge', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    await agent.stop();
    release();
    await drainMicrotasks(8);

    // The store must not be left at 'executing' — a later reload would then
    // fail closed with a misleading "interrupted" message.
    expect(store.record).toHaveBeenCalledOnce();
    expect(store.record.mock.calls[0][1].ok).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
    expect(settle).toHaveBeenCalledOnce();
    expect(settle.mock.calls[0][1].ok).toBe(false);
  });

  it('wraps agent.stop once across repeated executor starts', () => {
    const registry = tools({ noop: action('n', z.object({}), async () => 'x') });
    const { capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);
    const original = agent.stop;

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
      startClientToolExecutor(agent, registry);
    });

    expect(agent.stop).not.toBe(original);
    const afterFirstWrap = agent.stop;
    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
    });
    expect(agent.stop).toBe(afterFirstWrap);
  });

  it('restores agent.stop once every executor is destroyed', () => {
    const registry = tools({ noop: action('n', z.object({}), async () => 'x') });
    const { capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);
    const original = agent.stop;

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
      startClientToolExecutor(agent, registry);
    });
    expect(agent.stop).not.toBe(original);

    TestBed.resetTestingModule();

    expect(agent.stop).toBe(original);
  });

  it('aborts every live executor on the same agent when stop is called', async () => {
    const seen: AbortSignal[] = [];
    const registry = tools({
      slow: action('slow', z.object({}), async (_args, context) => {
        seen.push(context.signal);
        return new Promise<string>(() => undefined);
      }),
    });
    const { pending, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, registry);
      // A second coordinator wired to the same long-lived (root-provided) agent.
      startClientToolExecutor(agent, registry);
    });

    pending.set([{ id: 'a1', name: 'slow', args: {}, status: 'complete' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    await agent.stop();

    expect(seen).toHaveLength(2);
    expect(seen.map((s) => s.aborted)).toEqual([true, true]);
  });

  it('ignores view/ask tool calls (only function tools are auto-executed)', async () => {
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);

    TestBed.runInInjectionContext(() => {
      startClientToolExecutor(agent, weatherRegistry);
    });

    // weather_card is a view tool — executor must ignore it
    pending.set([
      { id: 'v1', name: 'weather_card', args: { city: 'Boston' }, status: 'running' },
    ]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(resolve).not.toHaveBeenCalled();
  });

  it('is a no-op when the agent does not have the clientTools capability', () => {
    const agent = makeFakeAgent(undefined as never);
    // Remove the capability so agent.clientTools is undefined
    delete (agent as { clientTools?: unknown }).clientTools;

    // Must not throw
    expect(() => {
      TestBed.runInInjectionContext(() => {
        startClientToolExecutor(agent, weatherRegistry);
      });
    }).not.toThrow();
  });
});
