// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ElementRef, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatStreamingMdComponent } from './streaming-markdown.component';
import '../../test-setup';

// Signal-input components can't be exercised via TestBed.createComponent +
// componentRef.setInput() under vitest JIT (Angular's JIT compiler does not
// process signal-input metadata, so setInput throws NG0303 — the same reason
// chat-trace, chat-suggestions, and chat-typing-indicator specs in this
// library avoid template-driven signal inputs). Instead we instantiate the
// component inside an injection context with a real DOM host element and
// drive its input by writing to the InputSignal's underlying signal node.

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

function flushRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

interface Fixture {
  component: ChatStreamingMdComponent;
  host: HTMLElement;
  destroy: () => void;
}

function makeFixture(): Fixture {
  const host = document.createElement('div');
  document.body.appendChild(host);
  TestBed.configureTestingModule({
    providers: [{ provide: ElementRef, useValue: new ElementRef(host) }],
  });
  const injector = TestBed.inject(Injector);
  let component!: ChatStreamingMdComponent;
  runInInjectionContext(injector, () => {
    component = new ChatStreamingMdComponent();
  });
  return {
    component,
    host,
    destroy: () => {
      TestBed.resetTestingModule();
      host.remove();
    },
  };
}

describe('ChatStreamingMdComponent', () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = makeFixture();
    setSignalInput(fixture.component.content, '');
  });

  it('renders markdown into innerHTML on first content', async () => {
    setSignalInput(fixture.component.content, '# Heading');
    await flushRaf();
    const el = fixture.host;
    expect(el.innerHTML).toContain('<h1');
    expect(el.innerHTML).toContain('Heading');
  });

  it('coalesces multiple updates into one render per frame', async () => {
    setSignalInput(fixture.component.content, '# A');
    setSignalInput(fixture.component.content, '# AB');
    setSignalInput(fixture.component.content, '# ABC');
    await flushRaf();
    const el = fixture.host;
    expect(el.innerHTML).toContain('ABC');
  });

  it('handles content shrinking without freezing (regression)', async () => {
    setSignalInput(fixture.component.content, '# Long heading');
    await flushRaf();
    setSignalInput(fixture.component.content, '# Short');
    await flushRaf();
    const el = fixture.host;
    expect(el.innerHTML).toContain('Short');
    expect(el.innerHTML).not.toContain('Long heading');
  });

  it('cleans up pending RAF on destroy', async () => {
    const spy = vi.spyOn(globalThis, 'cancelAnimationFrame');
    setSignalInput(fixture.component.content, '# X');
    fixture.destroy();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
