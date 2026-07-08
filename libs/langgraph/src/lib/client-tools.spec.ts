// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import type { ToolCall } from '@threadplane/chat';
import { createClientToolsCapability, mergeClientTools } from './client-tools';
import type { ClientToolsStore, SubmitFn } from './client-tools';

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

/** Build a submit spy that resolves immediately. */
function makeSubmitFn(): SubmitFn & { calls: Array<{ payload: unknown }> } {
  const calls: Array<{ payload: unknown }> = [];
  const fn = vi.fn(async (payload: unknown) => {
    calls.push({ payload });
  }) as unknown as SubmitFn & { calls: Array<{ payload: unknown }> };
  (fn as unknown as { calls: Array<{ payload: unknown }> }).calls = calls;
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

  it('resolving multiple pending calls issues one submit per resolve', async () => {
    const submitFn = makeSubmitFn();
    const store    = makeStore({ isLoading: false });
    const cap      = createClientToolsCapability(submitFn, store);
    cap.setCatalog([WEATHER_SPEC]);
    store.toolCallsSig.set([
      { id: 'c1', name: 'get_weather', args: {}, status: 'complete' },
      { id: 'c2', name: 'get_weather', args: {}, status: 'complete' },
    ]);

    cap.resolve('c1', { ok: true, value: { temp: 70 } });
    cap.resolve('c2', { ok: true, value: { temp: 71 } });
    await Promise.resolve();

    expect(submitFn).toHaveBeenCalledTimes(2);
    const payloads = (submitFn as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(([payload]) => payload as Record<string, unknown>);
    expect(payloads.map((payload) => (
      (payload['messages'] as Record<string, unknown>[])[0]['tool_call_id']
    ))).toEqual(['c1', 'c2']);
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
