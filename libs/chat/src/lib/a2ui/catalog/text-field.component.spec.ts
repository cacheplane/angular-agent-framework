// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

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
    it('emits on text binding when present', () => {
      const emit = vi.fn();
      const bindings = { text: '/name' };
      const val = 'Alice';
      emitBinding(emit, bindings, 'text', val);
      expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/name:Alice');
    });

    it('emits on value binding as fallback', () => {
      const emit = vi.fn();
      const bindings = { value: '/name' };
      const val = 'Alice';
      emitBinding(emit, bindings, 'value', val);
      expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/name:Alice');
    });

    it('emits empty string for cleared input', () => {
      const emit = vi.fn();
      const bindings = { text: '/name' };
      emitBinding(emit, bindings, 'text', '');
      expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/name:');
    });

    it('does not emit when no binding exists', () => {
      const emit = vi.fn();
      emitBinding(emit, {}, 'text', 'Alice');
      expect(emit).not.toHaveBeenCalled();
    });
  });
});
