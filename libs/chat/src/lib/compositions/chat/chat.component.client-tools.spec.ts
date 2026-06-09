// SPDX-License-Identifier: MIT
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Injector, runInInjectionContext, signal, type WritableSignal } from '@angular/core';
import { z } from 'zod/v4';
import { ChatComponent } from './chat.component';
import { mockAgent, type MockAgent } from '../../testing/mock-agent';
import { tools, action, ask } from '../../client-tools/tools';
import type { ClientToolsCapability, ClientToolResult } from '../../client-tools/client-tools-capability';
import type { ClientToolSpec } from '../../client-tools/to-json-schema';
import type { ToolCall } from '../../agent/tool-call';

// Write into an InputSignal by reaching its underlying SIGNAL node — same
// pattern as chat.component.spec.ts (vitest JIT can't process signal-input
// metadata so componentRef.setInput throws NG0303 for required inputs).
function setSignalInput<T>(sig: unknown, value: T): void {
  const obj = sig as Record<symbol, unknown>;
  const signalSymbol = Object.getOwnPropertySymbols(obj).find(
    (s) => s.description === 'SIGNAL',
  );
  if (!signalSymbol) throw new Error('Could not find SIGNAL symbol on input');
  const node = obj[signalSymbol] as {
    applyValueToInputSignal?: (n: unknown, v: T) => void;
    value?: T;
  };
  if (typeof node.applyValueToInputSignal === 'function') {
    node.applyValueToInputSignal(node, value);
  } else {
    node.value = value;
  }
}

class FakeAskComponent {}

interface FakeCap {
  pending: WritableSignal<readonly ToolCall[]>;
  resolve: ReturnType<typeof vi.fn>;
  setCatalog: ReturnType<typeof vi.fn>;
  capability: ClientToolsCapability;
}

function makeFakeCapability(): FakeCap {
  const pending = signal<readonly ToolCall[]>([]);
  const resolve = vi.fn<[string, ClientToolResult], void>();
  const setCatalog = vi.fn<[readonly ClientToolSpec[]], void>();
  const capability: ClientToolsCapability = { setCatalog, pending, resolve };
  return { pending, resolve, setCatalog, capability };
}

/** A mockAgent augmented with a clientTools capability. */
function agentWithClientTools(cap: ClientToolsCapability): MockAgent {
  const agent = mockAgent({ messages: [] });
  (agent as unknown as { clientTools: ClientToolsCapability }).clientTools = cap;
  return agent;
}

const clientToolRegistry = tools({
  get_weather: action(
    'Get the weather',
    z.object({ city: z.string() }),
    async (a) => ({ temp: 70, city: a.city }),
  ),
  confirm: ask(
    'Confirm an action',
    z.object({}),
    FakeAskComponent as never,
  ),
});

async function drainMicrotasks(rounds = 4): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

describe('ChatComponent — client-tools wiring', () => {
  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    injector = TestBed.inject(Injector);
  });

  it('connects the coordinator and ships the catalog once the agent is set', async () => {
    const cap = makeFakeCapability();
    runInInjectionContext(injector, () => {
      const c = new ChatComponent();
      setSignalInput(c.clientTools, clientToolRegistry);
      setSignalInput(c.agent, agentWithClientTools(cap.capability));
      TestBed.flushEffects();
    });
    // connect() is deferred to a microtask (it installs effects, which can't run
    // inside the readiness effect's reactive context).
    await drainMicrotasks();

    expect(cap.setCatalog).toHaveBeenCalledOnce();
    const names = (cap.setCatalog.mock.calls[0][0] as ClientToolSpec[]).map((s) => s.name);
    expect(names).toContain('get_weather');
    expect(names).toContain('confirm');
  });

  it('excludes client view/ask tool names from the default tool-call cards', () => {
    runInInjectionContext(injector, () => {
      const c = new ChatComponent();
      setSignalInput(c.clientTools, clientToolRegistry);
      setSignalInput(c.agent, agentWithClientTools(makeFakeCapability().capability));
      // ask-kind tool is a view component → excluded; function tools are not.
      expect(c.viewToolNames()).toContain('confirm');
      expect(c.excludedToolNames()).toContain('confirm');
      expect(c.viewToolNames()).not.toContain('get_weather');
    });
  });

  it('resolves a pending function call via the wired executor', async () => {
    const cap = makeFakeCapability();
    let comp!: ChatComponent;
    runInInjectionContext(injector, () => {
      comp = new ChatComponent();
      setSignalInput(comp.clientTools, clientToolRegistry);
      setSignalInput(comp.agent, agentWithClientTools(cap.capability));
      TestBed.flushEffects();
    });
    // Let the deferred connect() run (installs the executor effect).
    await drainMicrotasks();

    cap.pending.set([
      { id: 'f1', name: 'get_weather', args: { city: 'SF' }, status: 'running' },
    ]);
    TestBed.flushEffects();
    await drainMicrotasks();

    expect(cap.resolve).toHaveBeenCalledWith('f1', {
      ok: true,
      value: { temp: 70, city: 'SF' },
    });
    void comp;
  });

  it('routes a RenderResultEvent through onClientToolEvent to resolve a pending ask', async () => {
    const cap = makeFakeCapability();
    let comp!: ChatComponent;
    runInInjectionContext(injector, () => {
      comp = new ChatComponent();
      setSignalInput(comp.clientTools, clientToolRegistry);
      setSignalInput(comp.agent, agentWithClientTools(cap.capability));
      TestBed.flushEffects();
    });
    await drainMicrotasks();

    cap.pending.set([
      { id: 'a1', name: 'confirm', args: {}, status: 'running' },
    ]);

    // The (events) output from <chat-tool-views> lands here.
    (comp as unknown as { onClientToolEvent: (e: unknown) => void }).onClientToolEvent({
      type: 'result',
      value: { confirmed: true },
      elementKey: 'confirm',
    });

    expect(cap.resolve).toHaveBeenCalledWith('a1', { ok: true, value: { confirmed: true } });
  });

  it('is a no-op when no clientTools registry is provided', async () => {
    const cap = makeFakeCapability();
    runInInjectionContext(injector, () => {
      const c = new ChatComponent();
      setSignalInput(c.agent, agentWithClientTools(cap.capability));
      TestBed.flushEffects();
    });
    await drainMicrotasks();
    expect(cap.setCatalog).not.toHaveBeenCalled();
  });
});
