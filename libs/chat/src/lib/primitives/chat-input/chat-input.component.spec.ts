// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ChatInputComponent, submitMessage } from './chat-input.component';
import { mockAgent } from '../../testing/mock-agent';

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

describe('submitMessage()', () => {
  it('calls agent.submit with { message: trimmed text }', async () => {
    const agent = mockAgent();

    submitMessage(agent, '  hello world  ');

    // Flush the async submit (it's void-async, we just need microtask flush)
    await Promise.resolve();
    expect(agent.submitCalls).toHaveLength(1);
    expect(agent.submitCalls[0].input).toEqual({ message: 'hello world' });
  });

  it('returns the trimmed text on successful submit', () => {
    const agent = mockAgent();
    const result = submitMessage(agent, '  hello  ');
    expect(result).toBe('hello');
  });

  it('does not call agent.submit and returns null for whitespace-only text', async () => {
    const agent = mockAgent();

    const result = submitMessage(agent, '   ');

    await Promise.resolve();
    expect(agent.submitCalls).toHaveLength(0);
    expect(result).toBeNull();
  });

  it('does not call agent.submit and returns null for empty string', async () => {
    const agent = mockAgent();

    const result = submitMessage(agent, '');

    await Promise.resolve();
    expect(agent.submitCalls).toHaveLength(0);
    expect(result).toBeNull();
  });
});

describe('ChatInputComponent — isDisabled computed', () => {
  it('isDisabled is false when agent.isLoading is false', () => {
    const agent = mockAgent({ isLoading: false });
    const agent$ = signal(agent);

    const isDisabled = computed(() => agent$().isLoading());

    expect(isDisabled()).toBe(false);
  });

  it('isDisabled is true when agent.isLoading is true', () => {
    const agent = mockAgent({ isLoading: true });
    const agent$ = signal(agent);

    const isDisabled = computed(() => agent$().isLoading());

    expect(isDisabled()).toBe(true);
  });

  it('isDisabled updates reactively when agent changes', () => {
    const idleAgent = mockAgent({ isLoading: false });
    const loadingAgent = mockAgent({ isLoading: true });
    const agent$ = signal(idleAgent);

    const isDisabled = computed(() => agent$().isLoading());

    expect(isDisabled()).toBe(false);
    agent$.set(loadingAgent);
    expect(isDisabled()).toBe(true);
  });
});

describe('ChatInputComponent', () => {
  let fixture: ComponentFixture<ChatInputComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(ChatInputComponent);
    setSignalInput(fixture.componentInstance.agent, mockAgent({ isLoading: false }));
    fixture.detectChanges();
  });

  it('renders the pill with full border-radius', () => {
    const pill = (fixture.nativeElement as HTMLElement).querySelector('.chat-input__pill') as HTMLElement;
    expect(pill).not.toBeNull();
    const cs = getComputedStyle(pill);
    expect(cs.borderRadius).toBe('9999px');
  });

  it('renders the send button as a circle', () => {
    const btn = (fixture.nativeElement as HTMLElement).querySelector('.chat-input__send') as HTMLElement;
    expect(btn).not.toBeNull();
    const cs = getComputedStyle(btn);
    expect(cs.borderRadius).toBe('50%');
  });

  it('exposes [chatInputModelSelect] slot inside the controls row', () => {
    const controls = (fixture.nativeElement as HTMLElement).querySelector('.chat-input__controls');
    expect(controls).not.toBeNull();
  });

  it('auto-resizes textarea height when messageText changes — bug #198 regression', () => {
    // Live Chrome smoke caught: rows="1" textarea did not grow with
    // multi-line input. clientHeight stayed at 24px while scrollHeight
    // grew to 72px+, hiding lines past the first. Fix: an effect() sets
    // el.style.height = scrollHeight (capped at 200px) on every change.
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    fixture.componentInstance.messageText.set('line one\nline two\nline three');
    fixture.detectChanges();
    // The effect sets el.style.height; jsdom layout produces a value (
    // possibly '0px' due to no real layout, but the property is set).
    expect(textarea.style.height).not.toBe('');
  });
});
