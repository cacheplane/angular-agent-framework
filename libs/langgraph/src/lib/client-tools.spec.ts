import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import type { CompleteOutcome, ToolCall } from '@threadplane/chat';
import {
  createClientToolsCapability,
  mergeA2uiClientCapabilities,
  mergeClientTools,
  mergeStagedToolMessages,
} from './client-tools';
import type {
  ClientToolsStore,
  PersistToolMessagesFn,
  StagedToolMessageBatch,
  SubmitFn,
} from './client-tools';

// ─── Fakes ───────────────────────────────────────────────────────────────────

/** Build a minimal ClientToolsStore backed by writable signals. */
function makeStore(overrides?: {
  toolCalls?: ToolCall[];
  isLoading?: boolean;
}): ClientToolsStore & {
  toolCallsSig: ReturnType<typeof signal<readonly ToolCall[]>>;
  isLoadingSig: ReturnType<typeof signal<boolean>>;
} {
  const toolCallsSig = signal<readonly ToolCall[]>(overrides?.toolCalls ?? []);
  const isLoadingSig = signal<boolean>(overrides?.isLoading ?? false);
  return {
    toolCalls: toolCallsSig,
    isLoading: isLoadingSig,
    // Mirror the real adapter: layer the client-side outcome onto the matching
    // tool call so tests (and the render chain) can read the frozen result back.
    applyClientResult: (id, patch) =>
      toolCallsSig.update((calls) =>
        calls.map((tc) => (tc.id === id ? { ...tc, ...patch } : tc)),
      ),
    toolCallsSig,
    isLoadingSig,
  };
}

/** Build a submit spy that records the continuation batch and succeeds by default. */
function makeSubmitFn(
  outcome: CompleteOutcome = 'success',
): SubmitFn & { calls: Array<{ payload: unknown; batch?: StagedToolMessageBatch }> } {
  const calls: Array<{ payload: unknown; batch?: StagedToolMessageBatch }> = [];
  const fn = vi.fn(async (payload: unknown, _opts: unknown, batch?: StagedToolMessageBatch) => {
    calls.push({ payload, batch });
    return outcome;
  }) as unknown as SubmitFn & { calls: Array<{ payload: unknown; batch?: StagedToolMessageBatch }> };
  (fn as unknown as { calls: Array<{ payload: unknown; batch?: StagedToolMessageBatch }> }).calls = calls;
  return fn;
}

// ─── Shared fixture ──────────────────────────────────────────────────────────

const WEATHER_SPEC = {
  name:        'get_weather',
  description: 'Returns current weather for a location.',
  parameters:  { type: 'object', properties: { location: { type: 'string' } } },
} as const;

const STOCK_SPEC = {
  name:        'get_stock_price',
  description: 'Returns the current stock price.',
  parameters:  { type: 'object', properties: { ticker: { type: 'string' } } },
} as const;

// ─── mergeA2uiClientCapabilities helper ──────────────────────────────────────

describe('mergeA2uiClientCapabilities', () => {
  const CAPS = { supportedCatalogIds: ['https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'] };

  it('returns payload unchanged when capabilities are undefined', () => {
    const payload = { messages: [] };
    expect(mergeA2uiClientCapabilities(payload, undefined)).toBe(payload);
  });

  it('returns null unchanged (command resume) even with capabilities set', () => {
    expect(mergeA2uiClientCapabilities(null, CAPS)).toBeNull();
  });

  it('merges a2ui_client_capabilities into a plain object payload without mutating it', () => {
    const payload = { messages: [{ type: 'human', content: 'hi' }] };
    const result = mergeA2uiClientCapabilities(payload, CAPS) as Record<string, unknown>;
    expect(result).toEqual({
      messages: [{ type: 'human', content: 'hi' }],
      a2ui_client_capabilities: CAPS,
    });
    expect('a2ui_client_capabilities' in payload).toBe(false);
  });

  it('passes non-record payloads through unchanged', () => {
    expect(mergeA2uiClientCapabilities('raw', CAPS)).toBe('raw');
    const arr = [1];
    expect(mergeA2uiClientCapabilities(arr, CAPS)).toBe(arr);
  });
});

// ─── mergeClientTools helper ─────────────────────────────────────────────────

describe('mergeClientTools', () => {
  it('returns payload unchanged when catalog is empty', () => {
    const payload = { messages: [{ type: 'human', content: 'hi' }] };
    expect(mergeClientTools(payload, [])).toBe(payload);
  });

  it('returns null unchanged even when catalog is non-empty', () => {
    expect(mergeClientTools(null, [WEATHER_SPEC])).toBeNull();
  });

  it('merges client_tools into a plain object payload', () => {
    const payload = { messages: [{ type: 'human', content: 'hi' }] };
    const result = mergeClientTools(payload, [WEATHER_SPEC]) as Record<string, unknown>;
    expect(result).toEqual({
      messages: [{ type: 'human', content: 'hi' }],
      client_tools: [WEATHER_SPEC],
    });
  });

  it('does not mutate the original payload', () => {
    const payload = { messages: [{ type: 'human', content: 'hi' }] };
    mergeClientTools(payload, [WEATHER_SPEC]);
    expect((payload as Record<string, unknown>)['client_tools']).toBeUndefined();
  });

  it('returns an array payload unchanged', () => {
    const payload = [1, 2, 3];
    expect(mergeClientTools(payload, [WEATHER_SPEC])).toBe(payload);
  });
});

// ─── createClientToolsCapability ─────────────────────────────────────────────

describe('createClientToolsCapability', () => {

  // ── setCatalog ──────────────────────────────────────────────────────────────

  it('catalog signal is empty before setCatalog', () => {
    const cap = createClientToolsCapability(makeSubmitFn(), makeStore());
    expect(cap.catalog()).toEqual([]);
  });

  it('setCatalog stores the specs in the catalog signal', () => {
    const cap = createClientToolsCapability(makeSubmitFn(), makeStore());
    cap.setCatalog([WEATHER_SPEC]);
    expect(cap.catalog()).toHaveLength(1);
    expect(cap.catalog()[0].name).toBe('get_weather');
  });

  it('setCatalog replaces a prior catalog', () => {
    const cap = createClientToolsCapability(makeSubmitFn(), makeStore());
    cap.setCatalog([WEATHER_SPEC]);
    cap.setCatalog([STOCK_SPEC]);
    expect(cap.catalog()).toHaveLength(1);
    expect(cap.catalog()[0].name).toBe('get_stock_price');
  });

  // ── pending ─────────────────────────────────────────────────────────────────

  it('pending() is [] when isLoading=true even if tool calls are present', () => {
    const store = makeStore({ isLoading: true });
    const cap   = createClientToolsCapability(makeSubmitFn(), store);
    cap.setCatalog([WEATHER_SPEC]);
    store.toolCallsSig.set([
      { id: 'c1', name: 'get_weather', args: {}, status: 'complete' },
    ]);
    expect(cap.pending()).toEqual([]);
  });

  it('pending() includes a call whose name is in catalog with no result and not loading', () => {
    const store = makeStore({ isLoading: false });
    const cap   = createClientToolsCapability(makeSubmitFn(), store);
    cap.setCatalog([WEATHER_SPEC]);
    store.toolCallsSig.set([
      { id: 'c1', name: 'get_weather', args: {}, status: 'complete' },
    ]);
    const pending = cap.pending();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('c1');
  });

  it('pending() excludes a call whose name is NOT in the catalog', () => {
    const store = makeStore({ isLoading: false });
    const cap   = createClientToolsCapability(makeSubmitFn(), store);
    cap.setCatalog([WEATHER_SPEC]);
    store.toolCallsSig.set([
      { id: 'c2', name: 'some_backend_tool', args: {}, status: 'complete' },
    ]);
    expect(cap.pending()).toEqual([]);
  });

  it('pending() excludes a call that already has a result', () => {
    const store = makeStore({ isLoading: false });
    const cap   = createClientToolsCapability(makeSubmitFn(), store);
    cap.setCatalog([WEATHER_SPEC]);
    store.toolCallsSig.set([
      { id: 'c3', name: 'get_weather', args: {}, status: 'complete', result: { temp: 72 } },
    ]);
    expect(cap.pending()).toEqual([]);
  });

  it('pending() is [] when no catalog is set', () => {
    const store = makeStore({ isLoading: false });
    const cap   = createClientToolsCapability(makeSubmitFn(), store);
    store.toolCallsSig.set([
      { id: 'c4', name: 'get_weather', args: {}, status: 'complete' },
    ]);
    expect(cap.pending()).toEqual([]);
  });

  it('pending() includes multiple matching calls when multiple are present', () => {
    const store = makeStore({ isLoading: false });
    const cap   = createClientToolsCapability(makeSubmitFn(), store);
    cap.setCatalog([WEATHER_SPEC, STOCK_SPEC]);
    store.toolCallsSig.set([
      { id: 'c1', name: 'get_weather',    args: {}, status: 'complete' },
      { id: 'c2', name: 'get_stock_price', args: {}, status: 'complete' },
      { id: 'c3', name: 'backend_tool',   args: {}, status: 'complete' },
    ]);
    const pending = cap.pending();
    expect(pending).toHaveLength(2);
    expect(pending.map(p => p.id)).toContain('c1');
    expect(pending.map(p => p.id)).toContain('c2');
  });

  // ── resolve — ok result ─────────────────────────────────────────────────────

  it('resolve(ok, object) issues a run with a tool message containing JSON content', async () => {
    const submitFn = makeSubmitFn();
    const store    = makeStore({ isLoading: false });
    const cap      = createClientToolsCapability(submitFn, store);
    cap.setCatalog([WEATHER_SPEC]);
    store.toolCallsSig.set([
      { id: 'c1', name: 'get_weather', args: {}, status: 'complete' },
    ]);

    cap.resolve('c1', { ok: true, value: { temp: 70 } });
    await Promise.resolve();

    expect(submitFn).toHaveBeenCalledOnce();
    const payload = (submitFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload['messages']).toHaveLength(1);
    const msg = (payload['messages'] as Record<string, unknown>[])[0];
    expect(msg['type']).toBe('tool');
    expect(msg['role']).toBe('tool');
    expect(msg['tool_call_id']).toBe('c1');
    expect(msg['content']).toBe(JSON.stringify({ temp: 70 }));
  });

  it('resolve(ok, string) does not double-stringify the content', async () => {
    const submitFn = makeSubmitFn();
    const cap      = createClientToolsCapability(submitFn, makeStore());
    cap.setCatalog([WEATHER_SPEC]);

    cap.resolve('cx', { ok: true, value: 'plain string' });
    await Promise.resolve();

    const payload = (submitFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    const msg = (payload['messages'] as Record<string, unknown>[])[0];
    expect(msg['content']).toBe('plain string');
  });

  it('resolve(ok) includes client_tools in the run payload', async () => {
    const submitFn = makeSubmitFn();
    const cap      = createClientToolsCapability(submitFn, makeStore());
    cap.setCatalog([WEATHER_SPEC]);

    cap.resolve('c1', { ok: true, value: { temp: 70 } });
    await Promise.resolve();

    const payload = (submitFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload['client_tools']).toEqual([WEATHER_SPEC]);
  });

  it('resolve(ok) drops id from pending() AND writes the result onto the store tool call', () => {
    const store    = makeStore({ isLoading: false });
    const cap      = createClientToolsCapability(makeSubmitFn(), store);
    cap.setCatalog([WEATHER_SPEC]);
    store.toolCallsSig.set([
      { id: 'c1', name: 'get_weather', args: {}, status: 'complete' },
    ]);

    expect(cap.pending()).toHaveLength(1);
    cap.resolve('c1', { ok: true, value: { cleared: true } });
    // resolvedIds guard drops it, AND the result is now written onto the store
    // tool call (belt-and-braces: the result write alone also excludes it).
    expect(cap.pending()).toHaveLength(0);
    const tc = store.toolCalls().find((t) => t.id === 'c1');
    expect(tc?.result).toEqual({ cleared: true });
    expect(tc?.status).toBe('complete');
    expect(tc?.error).toBeUndefined();
  });

  it('resolve does not affect other pending calls', () => {
    const store = makeStore({ isLoading: false });
    const cap   = createClientToolsCapability(makeSubmitFn(), store);
    cap.setCatalog([WEATHER_SPEC]);
    store.toolCallsSig.set([
      { id: 'c1', name: 'get_weather', args: {}, status: 'complete' },
      { id: 'c2', name: 'get_weather', args: {}, status: 'complete' },
    ]);

    expect(cap.pending()).toHaveLength(2);
    cap.resolve('c1', { ok: true, value: 'sunny' });
    const remaining = cap.pending();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('c2');
  });

  it('settle(ok) drops the id from pending and records the result without submitting', async () => {
    const submitFn = makeSubmitFn();
    const store    = makeStore({ isLoading: false });
    const cap      = createClientToolsCapability(submitFn, store);
    cap.setCatalog([WEATHER_SPEC]);
    store.toolCallsSig.set([
      { id: 'c1', name: 'get_weather', args: {}, status: 'complete' },
    ]);

    cap.settle?.('c1', { ok: true, value: { temp: 70 } });
    await Promise.resolve();

    expect(cap.pending()).toHaveLength(0);
    expect(store.toolCalls().find((tc) => tc.id === 'c1')?.result).toEqual({ temp: 70 });
    expect(submitFn).not.toHaveBeenCalled();
  });

  it('settle plus resolve flushes multiple pending results in one submit', async () => {
    const submitFn = makeSubmitFn();
    const store    = makeStore({ isLoading: false });
    const cap      = createClientToolsCapability(submitFn, store);
    cap.setCatalog([WEATHER_SPEC]);
    store.toolCallsSig.set([
      { id: 'c1', name: 'get_weather', args: {}, status: 'complete' },
      { id: 'c2', name: 'get_weather', args: {}, status: 'complete' },
    ]);

    cap.settle?.('c1', { ok: true, value: { temp: 70 } });
    cap.resolve('c2', { ok: true, value: { temp: 71 } });
    await Promise.resolve();

    expect(submitFn).toHaveBeenCalledTimes(1);
    const payload = (submitFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    const messages = payload['messages'] as Record<string, unknown>[];
    expect(messages.map((message) => message['tool_call_id'])).toEqual(['c1', 'c2']);
  });

  // ── resolve — error result ──────────────────────────────────────────────────

  it('resolve(error) issues a run whose tool message content contains the error', async () => {
    const submitFn = makeSubmitFn();
    const cap      = createClientToolsCapability(submitFn, makeStore());
    cap.setCatalog([WEATHER_SPEC]);

    cap.resolve('c2', { ok: false, error: 'boom' });
    await Promise.resolve();

    const payload = (submitFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    const msg = (payload['messages'] as Record<string, unknown>[])[0];
    expect(msg['content']).toContain('boom');
    expect(msg['tool_call_id']).toBe('c2');
  });

  it('resolve(error) still issues a run', async () => {
    const submitFn = makeSubmitFn();
    const cap      = createClientToolsCapability(submitFn, makeStore());
    cap.setCatalog([WEATHER_SPEC]);

    cap.resolve('c2', { ok: false, error: 'network timeout' });
    await Promise.resolve();

    expect(submitFn).toHaveBeenCalledOnce();
  });

  it('resolve(error) includes client_tools in the run payload', async () => {
    const submitFn = makeSubmitFn();
    const cap      = createClientToolsCapability(submitFn, makeStore());
    cap.setCatalog([WEATHER_SPEC]);

    cap.resolve('c2', { ok: false, error: 'network timeout' });
    await Promise.resolve();

    const payload = (submitFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload['client_tools']).toEqual([WEATHER_SPEC]);
  });

  it('resolve(error) drops id from pending() AND writes { error } + status=error onto the store', () => {
    const store = makeStore({ isLoading: false });
    const cap   = createClientToolsCapability(makeSubmitFn(), store);
    cap.setCatalog([WEATHER_SPEC]);
    store.toolCallsSig.set([
      { id: 'c2', name: 'get_weather', args: {}, status: 'complete' },
    ]);

    expect(cap.pending()).toHaveLength(1);
    cap.resolve('c2', { ok: false, error: 'boom' });
    expect(cap.pending()).toHaveLength(0);
    const tc = store.toolCalls().find((t) => t.id === 'c2');
    expect(tc?.result).toEqual({ error: 'boom' });
    expect(tc?.error).toBe('boom');
    expect(tc?.status).toBe('error');
  });

  // ── catalog shipping in normal submit ───────────────────────────────────────
  // These tests verify that mergeClientTools() correctly prepares the payload
  // that agent.fn.ts passes through before calling manager.submit.

  it('mergeClientTools includes the catalog in a human-message payload', () => {
    const store = makeStore();
    const cap   = createClientToolsCapability(makeSubmitFn(), store);
    cap.setCatalog([WEATHER_SPEC]);

    const humanPayload = {
      messages: [{ type: 'human', role: 'human', content: 'what is the weather?' }],
    };
    const merged = mergeClientTools(humanPayload, cap.catalog()) as Record<string, unknown>;
    expect(merged['client_tools']).toEqual([WEATHER_SPEC]);
    expect(merged['messages']).toEqual(humanPayload.messages);
  });

  it('mergeClientTools with empty catalog leaves payload unmodified (same reference)', () => {
    const humanPayload = {
      messages: [{ type: 'human', role: 'human', content: 'hello' }],
    };
    const result = mergeClientTools(humanPayload, []);
    expect(result).toBe(humanPayload);
  });
});

// ─── staged client-tool messages ────────────────────────────────────────────

describe('staged client-tool messages', () => {
  const spec = { name: 'get_weather', description: 'w', parameters: {} };

  function setup(
    persist?: PersistToolMessagesFn,
    currentThreadIdFn?: () => string | null,
    submitFn: SubmitFn = makeSubmitFn(),
  ) {
    const store = {
      toolCalls: signal([] as readonly ToolCall[]),
      isLoading: signal(false),
      applyClientResult: () => undefined,
    };
    const cap = createClientToolsCapability(submitFn, store, persist, currentThreadIdFn);
    cap.setCatalog([spec]);
    return { cap, submitFn };
  }

  it('gives every settled ToolMessage a stable deterministic id', () => {
    const { cap } = setup();
    cap.settle?.('t1', { ok: true, value: 'a' });
    expect(cap.snapshotToolMessages().messages).toEqual([
      { id: 'client-tool-result-t1', type: 'tool', role: 'tool', tool_call_id: 't1', content: 'a' },
    ]);
  });

  it('returns repeated snapshots without draining', () => {
    const { cap } = setup();
    cap.settle?.('t1', { ok: true, value: 'a' });
    expect(cap.snapshotToolMessages().messages).toEqual(cap.snapshotToolMessages().messages);
  });

  it('acknowledges only the entries captured by its snapshot', () => {
    const { cap } = setup();
    cap.settle?.('t1', { ok: true, value: 'a' });
    const batch = cap.snapshotToolMessages();
    cap.settle?.('t2', { ok: true, value: 'b' });
    batch.acknowledge();
    expect(cap.snapshotToolMessages().messages).toEqual([
      { id: 'client-tool-result-t2', type: 'tool', role: 'tool', tool_call_id: 't2', content: 'b' },
    ]);
  });

  it('does not remove a later same-id settlement when acknowledging an older snapshot', () => {
    const { cap } = setup();
    cap.settle?.('t1', { ok: true, value: 'first' });
    const batch = cap.snapshotToolMessages();
    cap.settle?.('t1', { ok: true, value: 'second' });
    batch.acknowledge();
    expect(cap.snapshotToolMessages().messages).toEqual([
      { id: 'client-tool-result-t1', type: 'tool', role: 'tool', tool_call_id: 't1', content: 'second' },
    ]);
  });

  it('makes a pre-switch acknowledgment a no-op for newly settled messages', () => {
    let threadId: string | null = 'thread-a';
    const { cap } = setup(undefined, () => threadId);
    cap.settle?.('t1', { ok: true, value: 'old' });
    const batch = cap.snapshotToolMessages();
    cap.clearStagedToolMessages();
    threadId = 'thread-b';
    cap.settle?.('t2', { ok: true, value: 'new' });
    batch.acknowledge();
    expect(cap.snapshotToolMessages().messages).toEqual([
      { id: 'client-tool-result-t2', type: 'tool', role: 'tool', tool_call_id: 't2', content: 'new' },
    ]);
  });

  it('clears staged messages on a thread switch', () => {
    const { cap } = setup();
    cap.settle?.('t1', { ok: true, value: 'old' });
    cap.clearStagedToolMessages();
    expect(cap.snapshotToolMessages().messages).toEqual([]);
  });

  it('drops only stale entries when taking a snapshot for the current thread', () => {
    let threadId: string | null = 'thread-a';
    const { cap } = setup(undefined, () => threadId);
    cap.settle?.('old', { ok: true, value: 'old' });
    threadId = 'thread-b';
    cap.settle?.('new', { ok: true, value: 'new' });
    expect(cap.snapshotToolMessages().messages.map((message) => message.tool_call_id)).toEqual(['new']);
  });

  it('flushes an empty snapshot without persistence', async () => {
    const { cap } = setup();
    await expect(cap.flush?.()).resolves.toBeUndefined();
  });

  it('does not persist an empty snapshot when persistence is available', async () => {
    const persist = vi.fn(async () => undefined);
    const { cap } = setup(persist);
    await expect(cap.flush?.()).resolves.toBeUndefined();
    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects a non-empty flush without persistence and retains its messages', async () => {
    const { cap } = setup();
    cap.settle?.('t1', { ok: true, value: 'a' });
    await expect(cap.flush?.()).rejects.toThrow(
      'Custom LangGraph transports using terminal client tools must implement updateState().',
    );
    expect(cap.snapshotToolMessages().messages).toHaveLength(1);
  });

  it('retains messages after a failed flush', async () => {
    const persist = vi.fn(async () => { throw new Error('boom'); });
    const { cap } = setup(persist);
    cap.settle?.('t1', { ok: true, value: 'a' });
    await cap.flush?.();
    expect(cap.snapshotToolMessages().messages).toEqual([
      { id: 'client-tool-result-t1', type: 'tool', role: 'tool', tool_call_id: 't1', content: 'a' },
    ]);
  });

  it('persists every already-buffered message in one successful flush', async () => {
    const persist = vi.fn(async () => undefined);
    const { cap, submitFn } = setup(persist);
    cap.settle?.('t1', { ok: true, value: 'a' });
    cap.settle?.('t2', { ok: true, value: 'b' });
    await cap.flush?.();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0]).toEqual([
      { id: 'client-tool-result-t1', type: 'tool', role: 'tool', tool_call_id: 't1', content: 'a' },
      { id: 'client-tool-result-t2', type: 'tool', role: 'tool', tool_call_id: 't2', content: 'b' },
    ]);
    expect(submitFn).not.toHaveBeenCalled();
    expect(cap.snapshotToolMessages().messages).toEqual([]);
  });

  it('acknowledges only its successful flush snapshot', async () => {
    let releasePersist!: () => void;
    const persist = vi.fn(() => new Promise<void>((resolve) => { releasePersist = resolve; }));
    const { cap } = setup(persist);
    cap.settle?.('t1', { ok: true, value: 'a' });
    const flushed = cap.flush?.();
    cap.settle?.('t2', { ok: true, value: 'b' });
    releasePersist();
    await flushed;
    expect(cap.snapshotToolMessages().messages.map((message) => message.tool_call_id)).toEqual(['t2']);
  });

  it('chains flushes so a later settlement is persisted', async () => {
    let persistCall = 0;
    let releaseFirst!: () => void;
    const persist = vi.fn(() => {
      persistCall += 1;
      if (persistCall === 1) {
        return new Promise<void>((resolve) => { releaseFirst = resolve; });
      }
      return Promise.resolve();
    });
    const { cap } = setup(persist);
    cap.settle?.('t1', { ok: true, value: 'a' });
    const first = cap.flush?.();
    cap.settle?.('t2', { ok: true, value: 'b' });
    const second = cap.flush?.();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(releaseFirst).toBeTypeOf('function');
    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[0][0]).toEqual([
      { id: 'client-tool-result-t1', type: 'tool', role: 'tool', tool_call_id: 't1', content: 'a' },
    ]);
    expect(persist.mock.calls[1][0]).toEqual([
      { id: 'client-tool-result-t2', type: 'tool', role: 'tool', tool_call_id: 't2', content: 'b' },
    ]);
  });

  it('serializes every overlapping flush behind one queue tail', async () => {
    const releaseGates = Array.from({ length: 4 }, () => {
      let resolve!: () => void;
      const promise = new Promise<void>((done) => { resolve = done; });
      return { promise, resolve };
    });
    const persistedIds: string[][] = [];
    let activePersists = 0;
    let maxActivePersists = 0;
    const persist = vi.fn(async (messages: readonly { tool_call_id: string }[]) => {
      const callIndex = persistedIds.length;
      persistedIds.push(messages.map((message) => message.tool_call_id));
      activePersists += 1;
      maxActivePersists = Math.max(maxActivePersists, activePersists);
      await releaseGates[callIndex].promise;
      activePersists -= 1;
    });
    const { cap } = setup(persist);
    const flushes: Array<Promise<void> | undefined> = [];

    try {
      cap.settle?.('t1', { ok: true, value: 'a' });
      flushes.push(cap.flush?.(), cap.flush?.(), cap.flush?.());
      await vi.waitFor(
        () => expect(persist.mock.calls.length).toBeGreaterThanOrEqual(1),
        { timeout: 1000 },
      );

      cap.settle?.('t2', { ok: true, value: 'b' });
      releaseGates[0].resolve();
      await vi.waitFor(
        () => expect(persist.mock.calls.length).toBeGreaterThanOrEqual(2),
        { timeout: 1000 },
      );

      cap.settle?.('t3', { ok: true, value: 'c' });
      flushes.push(cap.flush?.());
      releaseGates[1].resolve();
      await vi.waitFor(
        () => expect(persist.mock.calls.length).toBeGreaterThanOrEqual(3),
        { timeout: 1000 },
      );
      await Promise.resolve();

      cap.settle?.('t4', { ok: true, value: 'd' });
      releaseGates[2].resolve();
      await vi.waitFor(
        () => expect(persist.mock.calls.length).toBeGreaterThanOrEqual(4),
        { timeout: 1000 },
      );
      releaseGates[3].resolve();
      await Promise.all(flushes);

      expect(maxActivePersists).toBe(1);
      expect(persistedIds).toEqual([['t1'], ['t2'], ['t3'], ['t4']]);
    } finally {
      for (const gate of releaseGates) gate.resolve();
      await Promise.allSettled(flushes);
    }
  });

  it('coalesces overlapping flushes for the same snapshot', async () => {
    let releasePersist!: () => void;
    const persist = vi.fn(() => new Promise<void>((resolve) => { releasePersist = resolve; }));
    const { cap } = setup(persist);
    cap.settle?.('t1', { ok: true, value: 'a' });
    const first = cap.flush?.();
    const second = cap.flush?.();
    releasePersist();
    await Promise.all([first, second]);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('allows overlapping flush and resolve to carry the same stable message id', async () => {
    let releasePersist!: () => void;
    const persist = vi.fn(() => new Promise<void>((resolve) => { releasePersist = resolve; }));
    const submitFn = makeSubmitFn();
    const { cap } = setup(persist, undefined, submitFn);
    cap.settle?.('t1', { ok: true, value: 'a' });
    const flushed = cap.flush?.();
    cap.resolve('t2', { ok: true, value: 'b' });
    releasePersist();
    await flushed;
    await Promise.resolve();
    const persisted = persist.mock.calls[0][0] as Array<{ id: string }>;
    const continued = ((submitFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      messages: Array<{ id: string }>;
    }).messages;
    expect(persisted[0].id).toBe('client-tool-result-t1');
    expect(continued.map((message) => message.id)).toEqual([
      'client-tool-result-t1',
      'client-tool-result-t2',
    ]);
  });

  it('does not retain a failed flush from a cleared generation', async () => {
    let rejectPersist!: (error: Error) => void;
    const persist = vi.fn(
      () => new Promise<void>((_resolve, reject) => { rejectPersist = reject; }),
    );
    const { cap } = setup(persist);
    cap.settle?.('t1', { ok: true, value: 'old' });
    const flushed = cap.flush?.();
    cap.clearStagedToolMessages();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    rejectPersist(new Error('boom'));
    await flushed;
    warning.mockRestore();
    expect(cap.snapshotToolMessages().messages).toEqual([]);
  });

  it('acknowledges the exact resolve batch after a successful outcome', async () => {
    const submitFn = makeSubmitFn();
    const { cap } = setup(undefined, undefined, submitFn);
    cap.settle?.('t1', { ok: true, value: 'a' });
    cap.resolve('t2', { ok: true, value: 'b' });
    await Promise.resolve();
    const payload = (submitFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      messages: readonly unknown[];
    };
    const batch = (submitFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][2] as StagedToolMessageBatch;
    expect(batch.messages).toBe(payload.messages);
    expect(cap.snapshotToolMessages().messages).toEqual([]);
  });

  it.each<CompleteOutcome>(['error', 'interrupted', 'aborted', 'paused'])(
    'retains the resolve batch after a %s outcome',
    async (outcome) => {
      const { cap } = setup(undefined, undefined, makeSubmitFn(outcome));
      cap.resolve('t1', { ok: true, value: 'a' });
      await Promise.resolve();
      expect(cap.snapshotToolMessages().messages).toHaveLength(1);
    },
  );

  it('keeps a settlement made after a successful resolve acknowledgment', async () => {
    let resolveSubmit!: (outcome: CompleteOutcome) => void;
    const submitFn = vi.fn(() => new Promise<CompleteOutcome>((resolve) => { resolveSubmit = resolve; })) as SubmitFn;
    const { cap } = setup(undefined, undefined, submitFn);
    cap.resolve('t1', { ok: true, value: 'a' });
    cap.settle?.('t2', { ok: true, value: 'b' });
    resolveSubmit('success');
    await Promise.resolve();
    expect(cap.snapshotToolMessages().messages.map((message) => message.tool_call_id)).toEqual(['t2']);
  });
});

// ─── mergeStagedToolMessages helper ──────────────────────────────────────────

describe('mergeStagedToolMessages', () => {
  const staged = [
    { id: 'client-tool-result-t1', type: 'tool', role: 'tool', tool_call_id: 't1', content: 'a' },
  ] as const;

  it('prepends staged messages ahead of the payload messages', () => {
    const out = mergeStagedToolMessages({ messages: [{ type: 'human', content: 'hi' }] }, staged);
    expect(out).toEqual({
      messages: [
        { id: 'client-tool-result-t1', type: 'tool', role: 'tool', tool_call_id: 't1', content: 'a' },
        { type: 'human', content: 'hi' },
      ],
    });
  });

  it('leaves a null payload unchanged', () => {
    expect(mergeStagedToolMessages(null, staged)).toBeNull();
  });

  it('returns the payload unchanged when nothing is staged', () => {
    const payload = { messages: [] };
    expect(mergeStagedToolMessages(payload, [])).toBe(payload);
  });
});
