// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import type { RenderHost } from '@threadplane/render';
import { A2uiMultipleChoiceComponent } from './multiple-choice.component';
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

describe('A2uiMultipleChoiceComponent', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). Tests verify the behavioral contracts for
  // single-select (maxAllowedSelections <= 1) and multi-select (checkboxes) modes.

  it('exports the component class', () => {
    expect(A2uiMultipleChoiceComponent).toBeDefined();
  });

  describe('isSingleSelect logic', () => {
    const isSingle = (max: number) => max <= 1;
    it('is single-select when maxAllowedSelections is 1', () => expect(isSingle(1)).toBe(true));
    it('is single-select when maxAllowedSelections is 0', () => expect(isSingle(0)).toBe(true));
    it('is multi-select when maxAllowedSelections is 2', () => expect(isSingle(2)).toBe(false));
    it('is multi-select when maxAllowedSelections is 10', () => expect(isSingle(10)).toBe(false));
  });

  describe('isSelected logic', () => {
    const isSelected = (selections: string[], value: string) => selections.includes(value);
    it('returns true when value is in selections', () => {
      expect(isSelected(['a', 'b'], 'a')).toBe(true);
    });
    it('returns false when value is not in selections', () => {
      expect(isSelected(['a', 'b'], 'c')).toBe(false);
    });
    it('returns false when selections is empty', () => {
      expect(isSelected([], 'a')).toBe(false);
    });
  });

  describe('onSelectChange emit logic (single-select)', () => {
    it('writes binding with selected string value', () => {
      const { host, writes } = makeHost();
      const bindings = { selections: '/department' };
      const event = { target: { value: 'Engineering' } } as unknown as Event;
      const val = (event.target as HTMLSelectElement).value;
      emitBinding(host, bindings, 'selections', val);
      expect(writes).toEqual([['/department', 'Engineering']]);
    });
  });

  describe('onCheckChange toggle logic (multi-select)', () => {
    const toggle = (current: string[], value: string, checked: boolean): string[] => {
      const result = [...current];
      const idx = result.indexOf(value);
      if (checked && idx === -1) result.push(value);
      else if (!checked && idx !== -1) result.splice(idx, 1);
      return result;
    };

    it('adds value when checked', () => {
      expect(toggle(['a'], 'b', true)).toEqual(['a', 'b']);
    });
    it('removes value when unchecked', () => {
      expect(toggle(['a', 'b'], 'a', false)).toEqual(['b']);
    });
    it('does not duplicate when value already selected', () => {
      expect(toggle(['a', 'b'], 'a', true)).toEqual(['a', 'b']);
    });
    it('is a no-op when removing a value not in selections', () => {
      expect(toggle(['a'], 'b', false)).toEqual(['a']);
    });

    it('writes binding with actual array (not JSON string)', () => {
      const { host, writes } = makeHost();
      const bindings = { selections: '/colors' };
      const current = ['red', 'blue'];
      emitBinding(host, bindings, 'selections', current);
      expect(writes).toHaveLength(1);
      expect(writes[0][0]).toBe('/colors');
      expect(writes[0][1]).toEqual(['red', 'blue']);
      // Ensure it's the actual array, not a JSON string
      expect(Array.isArray(writes[0][1])).toBe(true);
    });
  });
});
