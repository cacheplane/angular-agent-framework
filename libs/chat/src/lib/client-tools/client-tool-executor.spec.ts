// SPDX-License-Identifier: MIT
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { z } from 'zod/v4';
import { action, view, tools } from './tools';
import { startClientToolExecutor } from './client-tool-executor';
import type { ClientToolsCapability, ClientToolResult } from './client-tools-capability';
import type { Agent } from '../agent/agent';
import type { ToolCall } from '../agent/tool-call';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Drain the microtask queue a handful of times to let Promise chains settle. */
async function drainMicrotasks(rounds = 4): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

// Minimal Angular component stand-in for view/ask (avoids needing full TestBed import)
class FakeComponent {}

// ── factory helpers ───────────────────────────────────────────────────────────

function makeFakeCapability() {
  const pending = signal<readonly ToolCall[]>([]);
  const resolve = vi.fn<[string, ClientToolResult], void>();
  const capability: ClientToolsCapability = {
    setCatalog: vi.fn(),
    pending,
    resolve,
  };
  return { pending, resolve, capability };
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
