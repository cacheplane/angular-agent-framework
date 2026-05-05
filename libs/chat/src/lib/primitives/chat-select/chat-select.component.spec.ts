// libs/chat/src/lib/primitives/chat-select/chat-select.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatSelectComponent, type ChatSelectOption } from './chat-select.component';

const OPTS: readonly ChatSelectOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie', disabled: true },
];

// SIGNAL-symbol writer for input signals (canonical pattern; setInput()
// silently no-ops with NG0303 under vitest JIT).
function setSignalInput<T>(fixture: ComponentFixture<unknown>, name: string, value: T): void {
  const inputs = fixture.componentInstance as Record<string, unknown>;
  const sig = inputs[name];
  const obj = sig as Record<symbol, unknown>;
  const signalSymbol = Object.getOwnPropertySymbols(obj).find(
    (s) => s.description === 'SIGNAL',
  );
  if (!signalSymbol) throw new Error(`Could not find SIGNAL symbol on input "${name}"`);
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

describe('ChatSelectComponent', () => {
  let fixture: ComponentFixture<ChatSelectComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatSelectComponent);
    setSignalInput(fixture, 'options', OPTS);
    setSignalInput(fixture, 'value', 'a');
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  it('renders the selected option label', () => {
    expect(host.querySelector('.chat-select__label')?.textContent).toContain('Alpha');
  });

  it('falls back to placeholder when value not in options', () => {
    setSignalInput(fixture, 'value', '');
    setSignalInput(fixture, 'placeholder', 'Pick one');
    fixture.detectChanges();
    expect(host.querySelector('.chat-select__label')?.textContent).toContain('Pick one');
  });

  it('opens the menu on trigger click', () => {
    expect(host.querySelector('.chat-select__menu')).toBeNull();
    host.querySelector<HTMLButtonElement>('.chat-select__trigger')!.click();
    fixture.detectChanges();
    expect(host.querySelector('.chat-select__menu')).not.toBeNull();
    const opts = host.querySelectorAll('.chat-select__option');
    expect(opts.length).toBe(3);
  });

  it('emits valueChange and closes the menu on option click', () => {
    let emitted: string | undefined;
    fixture.componentInstance.value.subscribe((v) => { emitted = v; });
    host.querySelector<HTMLButtonElement>('.chat-select__trigger')!.click();
    fixture.detectChanges();
    const bravo = host.querySelectorAll<HTMLButtonElement>('.chat-select__option')[1];
    bravo.click();
    fixture.detectChanges();
    expect(emitted).toBe('b');
    expect(host.querySelector('.chat-select__menu')).toBeNull();
  });

  it('does not select a disabled option', () => {
    let emitted: string | undefined;
    fixture.componentInstance.value.subscribe((v) => { emitted = v; });
    host.querySelector<HTMLButtonElement>('.chat-select__trigger')!.click();
    fixture.detectChanges();
    const charlie = host.querySelectorAll<HTMLButtonElement>('.chat-select__option')[2];
    expect(charlie.disabled).toBe(true);
    charlie.click();
    fixture.detectChanges();
    expect(emitted).toBeUndefined();
  });

  it('closes the menu on Escape', () => {
    host.querySelector<HTMLButtonElement>('.chat-select__trigger')!.click();
    fixture.detectChanges();
    expect(host.querySelector('.chat-select__menu')).not.toBeNull();
    const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    host.querySelector<HTMLElement>('.chat-select__menu')!.dispatchEvent(evt);
    fixture.detectChanges();
    expect(host.querySelector('.chat-select__menu')).toBeNull();
  });

  it('closes the menu on Escape when focus is still on the trigger — bug #198 regression', () => {
    // Live Chrome smoke caught: clicking the trigger to open the menu leaves
    // focus on the trigger (not the menu). Pressing Escape there used to be
    // ignored — only Escape inside the menu was handled. Fix: handle Escape
    // in onTriggerKeydown when the menu is open.
    const trigger = host.querySelector<HTMLButtonElement>('.chat-select__trigger')!;
    trigger.click();
    fixture.detectChanges();
    expect(host.querySelector('.chat-select__menu')).not.toBeNull();
    const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    trigger.dispatchEvent(evt);
    fixture.detectChanges();
    expect(host.querySelector('.chat-select__menu')).toBeNull();
  });

  it('disables the trigger when [disabled]=true', () => {
    setSignalInput(fixture, 'disabled', true);
    fixture.detectChanges();
    const btn = host.querySelector<HTMLButtonElement>('.chat-select__trigger')!;
    expect(btn.disabled).toBe(true);
  });
});
