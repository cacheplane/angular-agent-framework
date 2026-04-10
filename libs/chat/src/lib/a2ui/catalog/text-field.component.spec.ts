// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiTextFieldComponent — onInput logic', () => {
  it('should emit binding event via emitBinding', () => {
    const emit = vi.fn();
    const bindings = { value: '/name' };
    // Simulates what onInput does: extract value, call emitBinding
    const val = 'Alice';
    emitBinding(emit, bindings, 'value', val);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/name:Alice');
  });

  it('should not emit when no binding exists', () => {
    const emit = vi.fn();
    emitBinding(emit, {}, 'value', 'Alice');
    expect(emit).not.toHaveBeenCalled();
  });
});
