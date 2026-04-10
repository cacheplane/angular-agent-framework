// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiChoicePickerComponent — onChange logic', () => {
  it('should emit binding event on selection', () => {
    const emit = vi.fn();
    const bindings = { selected: '/department' };
    emitBinding(emit, bindings, 'selected', 'Engineering');
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/department:Engineering');
  });

  it('should not emit when no binding exists', () => {
    const emit = vi.fn();
    emitBinding(emit, {}, 'selected', 'Engineering');
    expect(emit).not.toHaveBeenCalled();
  });
});
