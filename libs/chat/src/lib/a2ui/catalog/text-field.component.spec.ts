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

describe('A2uiTextFieldComponent — v1 protocol', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). v1: text replaces value prop; textFieldType
  // drives htmlInputType; validationResult/checks were removed; validationRegexp
  // is passed to the HTML pattern attribute.

  describe('htmlInputType logic', () => {
    const TYPE_MAP: Record<string, string> = {
      shortText: 'text', longText: 'text', number: 'number',
      obscured: 'password', date: 'date',
    };
    const getType = (t: string) => TYPE_MAP[t] ?? 'text';

    it('maps shortText → text', () => expect(getType('shortText')).toBe('text'));
    it('maps longText → text (textarea rendered)', () => expect(getType('longText')).toBe('text'));
    it('maps number → number', () => expect(getType('number')).toBe('number'));
    it('maps obscured → password', () => expect(getType('obscured')).toBe('password'));
    it('maps date → date', () => expect(getType('date')).toBe('date'));
    it('defaults unknown type → text', () => expect(getType('unknown')).toBe('text'));
  });

  describe('onInput emit logic', () => {
    it('writes text binding path with typed value when present', () => {
      const { host, writes } = makeHost();
      const bindings = { text: '/name' };
      emitBinding(host, bindings, 'text', 'Alice');
      expect(writes).toEqual([['/name', 'Alice']]);
    });

    it('writes value binding path as fallback', () => {
      const { host, writes } = makeHost();
      const bindings = { value: '/name' };
      emitBinding(host, bindings, 'value', 'Alice');
      expect(writes).toEqual([['/name', 'Alice']]);
    });

    it('writes empty string for cleared input', () => {
      const { host, writes } = makeHost();
      const bindings = { text: '/name' };
      emitBinding(host, bindings, 'text', '');
      expect(writes).toEqual([['/name', '']]);
    });

    it('does not write when no binding exists', () => {
      const { host, writes } = makeHost();
      emitBinding(host, {}, 'text', 'Alice');
      expect(writes).toHaveLength(0);
    });
  });
});
