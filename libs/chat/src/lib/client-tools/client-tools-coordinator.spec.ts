// SPDX-License-Identifier: MIT
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { z } from 'zod/v4';
import { action, view, ask, tools } from './tools';
import { toClientToolSpecs, createClientToolsCoordinator } from './client-tools-coordinator';
import type { ClientToolsCapability, ClientToolResult } from './client-tools-capability';
import type {
  ClientToolExecutionGuard,
  ClientToolExecutionRecord,
  ClientToolExecutionStore,
} from './client-tool-execution-guard';
import type { Agent } from '../agent/agent';
import type { ToolCall } from '../agent/tool-call';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Drain the microtask queue a handful of times to let Promise chains settle. */
async function drainMicrotasks(rounds = 4): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

// Minimal Angular component stand-in (avoids needing full TestBed import)
class FakeViewComponent {}
class FakeAskComponent {}

// ── factory helpers ───────────────────────────────────────────────────────────

function makeFakeCapability() {
  const pending = signal<readonly ToolCall[]>([]);
  const resolve = vi.fn<[string, ClientToolResult], void>();
  const setCatalog = vi.fn<[readonly unknown[]], void>();
  const capability: ClientToolsCapability = {
    setCatalog,
    pending,
    resolve,
  };
  return { pending, resolve, setCatalog, capability };
}

function makeFakeAgent(capability: ClientToolsCapability | undefined): Agent {
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

function makeGuardStore(): ClientToolExecutionStore & {
  claim: ReturnType<typeof vi.fn<[Parameters<ClientToolExecutionStore['claim']>[0]], Promise<'claimed' | ClientToolExecutionRecord>>>;
  record: ReturnType<typeof vi.fn<Parameters<ClientToolExecutionStore['record']>, Promise<void>>>;
  lookup: ReturnType<typeof vi.fn<Parameters<ClientToolExecutionStore['lookup']>, Promise<Record<string, ClientToolExecutionRecord>>>>;
} {
  return {
    claim: vi.fn(async () => 'claimed'),
    record: vi.fn(async () => undefined),
    lookup: vi.fn(async () => ({})),
  };
}

function makeGuard(store: ClientToolExecutionStore): ClientToolExecutionGuard {
  return { threadId: 'thread-1', store };
}

// ── registry ──────────────────────────────────────────────────────────────────

const testRegistry = tools({
  get_weather: action(
    'Get the weather for a city',
    z.object({ city: z.string() }),
    async (a) => ({ temp: 72, city: a.city }),
  ),
  weather_card: view(
    'Show a weather card',
    z.object({ city: z.string() }),
    FakeViewComponent as never,
  ),
  confirm_booking: ask(
    'Ask user to confirm a booking',
    z.object({ flight: z.string() }),
    FakeAskComponent as never,
  ),
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('toClientToolSpecs()', () => {
  it('returns one spec per tool with name, description, and parameters', () => {
    const specs = toClientToolSpecs(testRegistry);
    expect(specs).toHaveLength(3);

    const weatherSpec = specs.find((s) => s.name === 'get_weather');
    expect(weatherSpec).toBeDefined();
    expect(weatherSpec!.name).toBe('get_weather');
    expect(weatherSpec!.description).toBe('Get the weather for a city');
    expect(weatherSpec!.parameters).toBeDefined();
    expect(weatherSpec!.parameters['type']).toBe('object');

    const cardSpec = specs.find((s) => s.name === 'weather_card');
    expect(cardSpec).toBeDefined();
    expect(cardSpec!.name).toBe('weather_card');
    expect(cardSpec!.description).toBe('Show a weather card');
    expect(cardSpec!.parameters['type']).toBe('object');

    const askSpec = specs.find((s) => s.name === 'confirm_booking');
    expect(askSpec).toBeDefined();
    expect(askSpec!.name).toBe('confirm_booking');
    expect(askSpec!.description).toBe('Ask user to confirm a booking');
    expect(askSpec!.parameters['type']).toBe('object');
  });
});

describe('createClientToolsCoordinator()', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('viewRegistry contains view and ask components but not function tools', () => {
    const coordinator = createClientToolsCoordinator(testRegistry);
    const reg = coordinator.viewRegistry;
    // ViewRegistry is a record of component entries — view/ask tools are present
    expect(reg['weather_card']).toBeDefined();
    expect(reg['confirm_booking']).toBeDefined();
    // function tools should NOT be in the view registry
    expect(reg['get_weather']).toBeUndefined();
  });

  it('connect() calls setCatalog once with all specs', () => {
    const { capability, setCatalog } = makeFakeCapability();
    const agent = makeFakeAgent(capability);
    const coordinator = createClientToolsCoordinator(testRegistry);

    TestBed.runInInjectionContext(() => {
      coordinator.connect(agent);
    });

    expect(setCatalog).toHaveBeenCalledOnce();
    const calledWith = setCatalog.mock.calls[0][0] as readonly unknown[];
    expect(calledWith).toHaveLength(3);
    const names = (calledWith as Array<{ name: string }>).map((s) => s.name);
    expect(names).toContain('get_weather');
    expect(names).toContain('weather_card');
    expect(names).toContain('confirm_booking');
  });

  it('connect() is a no-op when the agent lacks the clientTools capability', () => {
    const agent = makeFakeAgent(undefined);
    const coordinator = createClientToolsCoordinator(testRegistry);

    expect(() => {
      TestBed.runInInjectionContext(() => {
        coordinator.connect(agent);
      });
    }).not.toThrow();
  });

  it('after connect(), view tool calls are auto-acked with { ok:true, value:{shown:true} }', () => {
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);
    const coordinator = createClientToolsCoordinator(testRegistry);

    TestBed.runInInjectionContext(() => {
      coordinator.connect(agent);
    });

    pending.set([{ id: 'v1', name: 'weather_card', args: { city: 'LA' }, status: 'running' }]);
    TestBed.flushEffects();

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith('v1', { ok: true, value: { shown: true } });
  });

  it('view auto-ack is idempotent — second flush does not double-resolve', () => {
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);
    const coordinator = createClientToolsCoordinator(testRegistry);

    TestBed.runInInjectionContext(() => {
      coordinator.connect(agent);
    });

    const call: ToolCall = { id: 'v1', name: 'weather_card', args: { city: 'LA' }, status: 'running' };
    pending.set([call]);
    TestBed.flushEffects();
    // Re-emit the same list — should NOT double-resolve
    pending.set([call]);
    TestBed.flushEffects();

    expect(resolve).toHaveBeenCalledOnce();
  });

  it('after connect(), function tool calls are resolved by the executor', async () => {
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);
    const coordinator = createClientToolsCoordinator(testRegistry);

    TestBed.runInInjectionContext(() => {
      coordinator.connect(agent);
    });

    pending.set([{ id: 'f1', name: 'get_weather', args: { city: 'SF' }, status: 'running' }]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(resolve).toHaveBeenCalledWith('f1', { ok: true, value: { temp: 72, city: 'SF' } });
  });

  it('passes an execution guard to function-tool execution', async () => {
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);
    const store = makeGuardStore();
    const coordinator = createClientToolsCoordinator(testRegistry, {
      executionGuard: makeGuard(store),
    });

    TestBed.runInInjectionContext(() => {
      coordinator.connect(agent);
    });

    pending.set([{ id: 'f2', name: 'get_weather', args: { city: 'SF' }, status: 'running' }]);
    TestBed.flushEffects();
    await drainMicrotasks(8);

    expect(store.claim).toHaveBeenCalledWith({ threadId: 'thread-1', toolCallId: 'f2' });
    expect(store.record).toHaveBeenCalledWith(
      { threadId: 'thread-1', toolCallId: 'f2' },
      { ok: true, value: { temp: 72, city: 'SF' } },
    );
    expect(resolve).toHaveBeenCalledWith('f2', { ok: true, value: { temp: 72, city: 'SF' } });
  });

  it('handleRenderEvent() resolves pending ask tool call by elementKey (tool name)', () => {
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);
    const coordinator = createClientToolsCoordinator(testRegistry);

    TestBed.runInInjectionContext(() => {
      coordinator.connect(agent);
    });

    pending.set([{ id: 'a1', name: 'confirm_booking', args: { flight: 'UA1' }, status: 'running' }]);

    coordinator.handleRenderEvent(agent, {
      type: 'result',
      value: { picked: 2 },
      elementKey: 'confirm_booking',
    });

    expect(resolve).toHaveBeenCalledWith('a1', { ok: true, value: { picked: 2 } });
  });

  it('handleRenderEvent() does NOT resolve a view tool via handleRenderEvent (views auto-ack separately)', () => {
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);
    const coordinator = createClientToolsCoordinator(testRegistry);

    TestBed.runInInjectionContext(() => {
      coordinator.connect(agent);
    });

    // Only view tool in pending — no auto-ack yet (effect not flushed)
    // Reset resolve mock so we isolate just the handleRenderEvent call
    pending.set([{ id: 'v2', name: 'weather_card', args: { city: 'Boston' }, status: 'running' }]);
    resolve.mockClear();

    // Emit a result event with the view tool name — should NOT trigger resolution via handleRenderEvent
    coordinator.handleRenderEvent(agent, {
      type: 'result',
      value: { anything: true },
      elementKey: 'weather_card',
    });

    // resolve was NOT called from handleRenderEvent (view tools are kind:'view', not kind:'ask')
    expect(resolve).not.toHaveBeenCalled();
  });

  it('handleRenderEvent() ignores non-result events', () => {
    const { pending, resolve, capability } = makeFakeCapability();
    const agent = makeFakeAgent(capability);
    const coordinator = createClientToolsCoordinator(testRegistry);

    TestBed.runInInjectionContext(() => {
      coordinator.connect(agent);
    });

    pending.set([{ id: 'a2', name: 'confirm_booking', args: { flight: 'DL9' }, status: 'running' }]);
    resolve.mockClear();

    coordinator.handleRenderEvent(agent, {
      type: 'handler',
      action: 'click',
      params: {},
    });

    expect(resolve).not.toHaveBeenCalled();
  });

  it('handleRenderEvent() is a no-op when the agent lacks clientTools capability', () => {
    const agent = makeFakeAgent(undefined);
    const coordinator = createClientToolsCoordinator(testRegistry);

    expect(() => {
      coordinator.handleRenderEvent(agent, {
        type: 'result',
        value: 'hello',
        elementKey: 'confirm_booking',
      });
    }).not.toThrow();
  });
});

describe('viewRegistry carries each view/ask tool schema (render mount-readiness gate)', () => {
  it('attaches the Standard Schema to view and ask registry entries', () => {
    const viewSchema = z.object({ day: z.number(), places: z.array(z.string()) });
    const askSchema = z.object({ day: z.number() });
    const registry = tools({
      get_it: action('read', z.object({}), async () => ({})),
      day_card: view('show a day', viewSchema, FakeViewComponent),
      clear_day: ask('confirm clear', askSchema, FakeAskComponent),
    });
    const { viewRegistry } = createClientToolsCoordinator(registry);
    // Entries are RenderViewEntry objects { component, schema } — the schema must
    // survive so the render lib can gate the real mount until streamed props validate.
    expect((viewRegistry['day_card'] as { component: unknown }).component).toBe(FakeViewComponent);
    expect((viewRegistry['day_card'] as { schema: unknown }).schema).toBe(viewSchema);
    expect((viewRegistry['clear_day'] as { schema: unknown }).schema).toBe(askSchema);
    // function (non-view/ask) tools are not in the view registry.
    expect(viewRegistry['get_it']).toBeUndefined();
  });
});
