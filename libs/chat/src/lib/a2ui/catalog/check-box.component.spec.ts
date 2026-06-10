// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import type { RenderHost } from '@threadplane/render';
import { emitBinding } from './emit-binding';

function makeHost(): { host: RenderHost; writes: Array<[string, unknown]> } {
  const writes: Array<[string, unknown]> = [];
  const host: RenderHost = {
    set: (p, v) => writes.push([p, v]),
    emit: () => { /* noop */ },
    result: () => { /* noop */ },
  };
  return { host, writes };
}

describe('A2uiCheckBoxComponent — onChange logic', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). These tests verify the behavioral contract
  // of onChange: extract boolean checked state from event → write binding.

  it('writes binding with true (boolean) when checkbox is checked', () => {
    const { host, writes } = makeHost();
    const bindings = { checked: '/agreed' };
    const event = { target: { checked: true } } as unknown as Event;
    const val = (event.target as HTMLInputElement).checked;
    emitBinding(host, bindings, 'checked', val);
    expect(writes).toEqual([['/agreed', true]]);
  });

  it('writes binding with false (boolean) when checkbox is unchecked', () => {
    const { host, writes } = makeHost();
    const bindings = { checked: '/agreed' };
    const event = { target: { checked: false } } as unknown as Event;
    const val = (event.target as HTMLInputElement).checked;
    emitBinding(host, bindings, 'checked', val);
    expect(writes).toEqual([['/agreed', false]]);
  });

  it('does not write when no binding exists for checked', () => {
    const { host, writes } = makeHost();
    emitBinding(host, {}, 'checked', true);
    expect(writes).toHaveLength(0);
  });
});
